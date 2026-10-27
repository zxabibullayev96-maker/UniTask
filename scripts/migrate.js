/**
 * UniTask AI - Ma'lumotlar Migratsiyasi va Portativlik Skripti
 * 
 * Ushbu vosita quyidagi imkoniyatlarni taqdim etadi:
 * 1. Barcha jadvallarni JSON faylga to'liq eksport qilish (export)
 * 2. JSON fayldan yangi bazaga (Turso yoki yangi SQLite serveriga) import qilish (import)
 * 3. Hozirgi baza holatini va jadvallar statistikasini tekshirish (status)
 * 
 * Foydalanish:
 *   node scripts/migrate.js export [fayl_nomi.json]
 *   node scripts/migrate.js import <fayl_nomi.json>
 *   node scripts/migrate.js status
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, initDatabase } = require('../server/config/database');

// Jadvallar ketma-ketligi (Foreign key bog'liqliklari bo'yicha to'g'ri tartibda)
const TABLES_ORDER = [
  'groups',
  'users',
  'group_teachers',
  'assignments',
  'assignment_questions',
  'question_options',
  'submissions',
  'submission_answers',
  'test_sessions'
];

async function getTableCount(tableName) {
  try {
    const row = await db.getAsync(`SELECT COUNT(*) as count FROM ${tableName}`);
    return row ? row.count : 0;
  } catch (e) {
    return 0;
  }
}

async function exportData(customOutputPath) {
  console.log('\n📦 UniTask AI - Ma\'lumotlarni eksport qilish boshlandi...');
  await initDatabase();

  const exportDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = customOutputPath || path.join(exportDir, `unitask_export_${timestamp}.json`);

  const dump = {
    version: '1.0.0',
    platform: 'UniTask AI',
    exportedAt: new Date().toISOString(),
    clientType: db.clientType || 'sqlite',
    counts: {},
    data: {}
  };

  for (const table of TABLES_ORDER) {
    try {
      const rows = await db.allAsync(`SELECT * FROM ${table} ORDER BY id ASC`);
      dump.data[table] = rows;
      dump.counts[table] = rows.length;
      console.log(`   - ${table}: ${rows.length} ta yozuv yuklandi`);
    } catch (err) {
      console.warn(`   ⚠️ ${table} jadvalini o'qishda ogohlantirish:`, err.message);
      dump.data[table] = [];
      dump.counts[table] = 0;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), 'utf-8');
  console.log(`\n✅ Barcha ma'lumotlar muvaffaqiyatli saqlandi:`);
  console.log(`📁 Manzil: ${filePath}`);
  return filePath;
}

async function importData(inputFilePath) {
  if (!inputFilePath || !fs.existsSync(inputFilePath)) {
    console.error(`❌ Xatolik: '${inputFilePath}' fayli topilmadi.`);
    process.exit(1);
  }

  console.log(`\n📥 UniTask AI - Ma'lumotlarni import qilish: ${inputFilePath}`);
  const rawContent = fs.readFileSync(inputFilePath, 'utf-8');
  const dump = JSON.parse(rawContent);

  if (!dump.data) {
    console.error('❌ Xatolik: Fayl formati noto\'g\'ri (data obyekti topilmadi).');
    process.exit(1);
  }

  await initDatabase();

  // Foreign keys ni vaqtinchalik o'chirish
  try {
    await db.runAsync('PRAGMA foreign_keys = OFF;');
  } catch (e) {}

  let totalInserted = 0;

  for (const table of TABLES_ORDER) {
    const rows = dump.data[table] || [];
    if (rows.length === 0) continue;

    console.log(`   - [${table}] ${rows.length} ta yozuv import qilinmoqda...`);

    for (const row of rows) {
      const keys = Object.keys(row);
      const values = Object.values(row);
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      await db.runAsync(sql, values);
      totalInserted++;
    }
  }

  try {
    await db.runAsync('PRAGMA foreign_keys = ON;');
  } catch (e) {}

  console.log(`\n🎉 Muvaffaqiyatli yakunlandi! Jami ${totalInserted} ta yozuv bazaga kiritildi.`);
}

async function showStatus() {
  console.log('\n📊 UniTask AI - Joriy Ma\'lumotlar Bazasi Holati:');
  console.log(`   - Drayver: ${db.clientType || 'sqlite'}`);
  if (db.dbPath) console.log(`   - Fayl yo'li: ${db.dbPath}`);
  if (db.databaseUrl) console.log(`   - Bulutli manzil: ${db.databaseUrl}`);

  await initDatabase();

  console.log('\n📋 Jadvallar statistikasi:');
  for (const table of TABLES_ORDER) {
    const count = await getTableCount(table);
    console.log(`   - ${table.padEnd(22)}: ${count} ta yozuv`);
  }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  try {
    if (cmd === 'export') {
      await exportData(arg);
    } else if (cmd === 'import') {
      await importData(arg);
    } else if (cmd === 'status' || !cmd) {
      await showStatus();
    } else {
      console.log(`
Noma'lum buyruq: ${cmd}
Mavjud buyruqlar:
  node scripts/migrate.js status
  node scripts/migrate.js export [output.json]
  node scripts/migrate.js import <input.json>
      `);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Xatolik yuz berdi:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  exportData,
  importData,
  showStatus
};
