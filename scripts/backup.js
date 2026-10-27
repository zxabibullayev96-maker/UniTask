/**
 * UniTask AI - To'liq Tizim Zaxira Nusxasini Yaratish (Full Backup Script)
 * 
 * Ushbu skript:
 * 1. Database faylini va to'liq JSON ma'lumotlarini arxivlaydi.
 * 2. Yuklangan barcha fayllarni (uploads/submissions, uploads/assignments) zip arxivga joylaydi.
 * 3. Zaxira manifestini (manifest_<timestamp>.json) yaratadi.
 * 
 * Ishga tushirish:
 *   node scripts/backup.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { exportData } = require('./migrate');

async function createBackup() {
  console.log('===============================================================');
  console.log('🛡️  UniTask AI - TIZIMNI TO\'LIQ ZAXIRA NUSXALASH (BACKUP)');
  console.log('===============================================================\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups', `backup_${timestamp}`);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const manifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    backupId: `backup_${timestamp}`,
    components: {}
  };

  // 1. JSON ma'lumotlar eksporti
  console.log('1️⃣  Ma\'lumotlar bazasi JSON holatida eksport qilinmoqda...');
  const jsonPath = path.join(backupDir, 'database_data.json');
  await exportData(jsonPath);
  manifest.components.databaseJson = {
    path: 'database_data.json',
    sizeBytes: fs.statSync(jsonPath).size
  };

  // 2. Mahalliy SQLite fayli nusxasi (mavjud bo'lsa)
  const defaultDbPath = path.resolve(__dirname, '../../unitask.db');
  const dbFile = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(__dirname, '../unitask.db');
  if (fs.existsSync(dbFile)) {
    console.log('\n2️⃣  SQLite faylidan to\'g\'ridan-to\'g\'ri nusxa olinmoqda...');
    const targetDbPath = path.join(backupDir, 'unitask.db');
    fs.copyFileSync(dbFile, targetDbPath);
    manifest.components.sqliteFile = {
      path: 'unitask.db',
      sizeBytes: fs.statSync(targetDbPath).size
    };
    console.log(`   ✅ Baza fayli nusxalandi (${manifest.components.sqliteFile.sizeBytes} bayt)`);
  }

  // 3. uploads/ papkasidagi barcha fayllarni arxivlash
  console.log('\n3️⃣  Yuklangan fayllar (uploads) arxivlanmoqda...');
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const zipPath = path.join(backupDir, 'uploads.zip');

  if (fs.existsSync(uploadsDir)) {
    const zip = new AdmZip();
    zip.addLocalFolder(uploadsDir, 'uploads');
    zip.writeZip(zipPath);

    let fileCount = 0;
    function countFiles(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          countFiles(full);
        } else {
          fileCount++;
        }
      }
    }
    countFiles(uploadsDir);

    manifest.components.uploads = {
      path: 'uploads.zip',
      fileCount,
      sizeBytes: fs.statSync(zipPath).size
    };
    console.log(`   ✅ uploads.zip yaratildi (${fileCount} ta fayl, ${manifest.components.uploads.sizeBytes} bayt)`);
  } else {
    console.log('   ℹ️ uploads papkasi bo\'sh yoki mavjud emas.');
  }

  // 4. Manifest faylini saqlash
  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n===============================================================');
  console.log('🎉 ZAXIRA NUSXASI MUVAFFAQIYATLI YARATILDI!');
  console.log(`📁 Papka: ${backupDir}`);
  console.log('===============================================================');
  return backupDir;
}

if (require.main === module) {
  createBackup().then(() => process.exit(0)).catch(err => {
    console.error('❌ Backup xatosi:', err);
    process.exit(1);
  });
}

module.exports = { createBackup };
