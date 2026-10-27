/**
 * UniTask AI - Ma'lumotlar Bazasi Adapteri (Database Abstraction Layer)
 * 
 * Ushbu modul loyihani quyidagi rejimlar bo'yicha moslashuvchan boshqaradi:
 * 1. 'sqlite' (Mahalliy SQLite fayli yoki Render Persistent Disk):
 *    DB_PATH muhit o'zgaruvchisi orqali boshqariladi.
 * 2. 'turso' (Turso / LibSQL Bulutli Serverless SQLite):
 *    TURSO_DATABASE_URL va TURSO_AUTH_TOKEN orqali to'g'ridan-to'g'ri ulanadi.
 * 
 * Ikkala drayver ham bir xil standart Promisified API taqdim etadi:
 * - db.runAsync(sql, params) -> { lastID, changes }
 * - db.getAsync(sql, params) -> row
 * - db.allAsync(sql, params) -> rows
 * - db.execAsync(sql) -> batch execution
 * - db.healthCheck() -> status info
 */

const path = require('path');
const fs = require('fs');

// Parametrlarni Turso HTTP formati uchun formatlash yordamchisi
function formatTursoArgs(params = []) {
  return params.map(val => {
    if (val === null || val === undefined) {
      return { type: 'null' };
    }
    if (typeof val === 'number') {
      return Number.isInteger(val)
        ? { type: 'integer', value: String(val) }
        : { type: 'float', value: val };
    }
    if (typeof val === 'boolean') {
      return { type: 'integer', value: val ? '1' : '0' };
    }
    if (Buffer.isBuffer(val)) {
      return { type: 'blob', base64: val.toString('base64') };
    }
    return { type: 'text', value: String(val) };
  });
}

// Turso natijalarini oddiy JS qiymatiga o'tkazish
function parseTursoVal(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer') {
    const num = Number(cell.value);
    return Number.isSafeInteger(num) ? num : cell.value;
  }
  if (cell.type === 'float') return Number(cell.value);
  if (cell.type === 'blob' && cell.base64) {
    return Buffer.from(cell.base64, 'base64');
  }
  return cell.value !== undefined ? cell.value : null;
}

// Turso natijalarini oddiy JS obyektlar massiviga aylantirish
function transformTursoRows(result) {
  if (!result || !result.cols || !result.rows) return [];
  const colNames = result.cols.map(c => c.name);
  return result.rows.map(row => {
    const obj = {};
    for (let i = 0; i < colNames.length; i++) {
      obj[colNames[i]] = parseTursoVal(row[i]);
    }
    return obj;
  });
}

// ----------------------------------------------------------------------------
// 1. TURSO HTTP DRAYVERI (Hech qanday qo'shimcha native paketlarsiz ishlaydi)
// ----------------------------------------------------------------------------
function createTursoDriver({ databaseUrl, authToken }) {
  // libsql:// protokolini https:// ga o'tkazish
  let httpUrl = databaseUrl.replace(/^libsql:\/\//i, 'https://');
  if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
    httpUrl = 'https://' + httpUrl;
  }
  if (!httpUrl.endsWith('/v2/pipeline')) {
    httpUrl = httpUrl.replace(/\/+$/, '') + '/v2/pipeline';
  }

  async function executePipeline(sql, params = []) {
    const body = {
      requests: [
        {
          type: 'execute',
          stmt: {
            sql: sql.trim(),
            args: formatTursoArgs(params)
          }
        },
        { type: 'close' }
      ]
    };

    const res = await fetch(httpUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Turso HTTP xatosi (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const firstResult = data.results && data.results[0];

    if (!firstResult) {
      throw new Error('Turso serveridan bo\'sh javob olindi.');
    }

    if (firstResult.type === 'error') {
      throw new Error(`Turso SQL xatosi: ${firstResult.error?.message || JSON.stringify(firstResult.error)}`);
    }

    return firstResult.response?.result;
  }

  const driver = {
    clientType: 'turso',
    databaseUrl: httpUrl,

    async runAsync(sql, params = []) {
      const result = await executePipeline(sql, params);
      const lastID = result?.last_insert_rowid ? Number(result.last_insert_rowid) : null;
      const changes = result?.affected_row_count || 0;
      return { lastID, changes };
    },

    async getAsync(sql, params = []) {
      const result = await executePipeline(sql, params);
      const rows = transformTursoRows(result);
      return rows.length > 0 ? rows[0] : undefined;
    },

    async allAsync(sql, params = []) {
      const result = await executePipeline(sql, params);
      return transformTursoRows(result);
    },

    async execAsync(sql) {
      // Bir nechta ifodalarni bo'lib yuborish
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const requests = statements.map(s => ({
        type: 'execute',
        stmt: { sql: s }
      }));
      requests.push({ type: 'close' });

      const res = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Turso exec xatosi (${res.status}): ${errText}`);
      }

      const data = await res.json();
      for (const item of data.results || []) {
        if (item.type === 'error') {
          throw new Error(`Turso SQL batch xatosi: ${item.error?.message}`);
        }
      }
      return true;
    },

    async healthCheck() {
      try {
        const row = await driver.getAsync('SELECT 1 as live');
        return { ok: Boolean(row && row.live === 1), client: 'turso', endpoint: httpUrl };
      } catch (e) {
        return { ok: false, client: 'turso', error: e.message };
      }
    }
  };

  return driver;
}

// ----------------------------------------------------------------------------
// 2. SQLITE3 DRAYVERI (Mahalliy fayl yoki Persistent Disk)
// ----------------------------------------------------------------------------
function createSQLiteDriver({ dbPath }) {
  const sqlite3 = require('sqlite3').verbose();

  // Papka mavjudligini tekshirish
  try {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  } catch (dirErr) {
    console.warn("Baza papkasini tekshirishda ogohlantirish:", dirErr.message);
  }

  const rawDb = new sqlite3.Database(dbPath);

  const driver = {
    clientType: 'sqlite',
    dbPath,
    rawDb,

    runAsync(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },

    getAsync(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    },

    allAsync(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    },

    execAsync(sql) {
      return new Promise((resolve, reject) => {
        rawDb.exec(sql, err => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    },

    async healthCheck() {
      try {
        const row = await driver.getAsync('SELECT 1 as live');
        return { ok: Boolean(row && row.live === 1), client: 'sqlite', path: dbPath };
      } catch (e) {
        return { ok: false, client: 'sqlite', error: e.message };
      }
    }
  };

  return driver;
}

// ----------------------------------------------------------------------------
// 3. ADAPTER FABRIKASI (Environment variables orqali avtomatik tanlash)
// ----------------------------------------------------------------------------
function initDbAdapter() {
  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
  const dbClient = (process.env.DB_CLIENT || '').toLowerCase();

  if (dbClient === 'turso' || (tursoUrl && tursoToken)) {
    console.log(`🌐 [Database Adapter] Bulutli Turso (LibSQL) drayveri faollashtirildi.`);
    return createTursoDriver({ databaseUrl: tursoUrl, authToken: tursoToken });
  }

  const defaultDbPath = path.resolve(__dirname, '../../unitask.db');
  const resolvedDbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;
  console.log(`💾 [Database Adapter] SQLite3 drayveri faollashtirildi (${resolvedDbPath}).`);
  return createSQLiteDriver({ dbPath: resolvedDbPath });
}

module.exports = {
  initDbAdapter,
  createTursoDriver,
  createSQLiteDriver
};
