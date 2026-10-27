/**
 * UniTask AI - Zaxira Nusxasidan Tizimni Qayta Tiklash (Restore Script)
 * 
 * Xavfsizlik qoidasi:
 * Tiklashni boshlashdan oldin joriy holatning avtomatik ROLLBACK zaxirasi olinadi!
 * 
 * Ishga tushirish:
 *   node scripts/restore.js [backup_papka_nomi_yoki_yo'li]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { importData } = require('./migrate');

async function restoreBackup(targetDirOrName) {
  console.log('===============================================================');
  console.log('🔄 UniTask AI - TIZIMNI ZAXIRADAN QAYTA TIKLASH (RESTORE)');
  console.log('===============================================================\n');

  let backupDir = targetDirOrName;
  const backupsRoot = path.resolve(__dirname, '../backups');

  if (!backupDir) {
    // Eng so'nggi backupni avtomatik topish
    if (!fs.existsSync(backupsRoot)) {
      console.error('❌ Xatolik: backups papkasi topilmadi.');
      process.exit(1);
    }
    const allDirs = fs.readdirSync(backupsRoot)
      .filter(name => name.startsWith('backup_') && fs.statSync(path.join(backupsRoot, name)).isDirectory())
      .sort()
      .reverse();

    if (allDirs.length === 0) {
      console.error('❌ Xatolik: Hech qanday backup papkasi topilmadi.');
      process.exit(1);
    }
    backupDir = path.join(backupsRoot, allDirs[0]);
    console.log(`ℹ️  Eng so'nggi zaxira nusxasi tanlandi: ${allDirs[0]}`);
  } else if (!path.isAbsolute(backupDir)) {
    if (fs.existsSync(path.join(backupsRoot, backupDir))) {
      backupDir = path.join(backupsRoot, backupDir);
    } else {
      backupDir = path.resolve(backupDir);
    }
  }

  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Xatolik: '${backupDir}' zaxira papkasi topilmadi.`);
    process.exit(1);
  }

  console.log(`📁 Tiklanayotgan zaxira: ${backupDir}\n`);

  // 1. Rollback zaxira nusxasini olish (Xavfsizlik)
  console.log('🛡️  1. Xavfsizlik: Joriy holatning tezkor ROLLBACK nusxasi olinmoqda...');
  const rollbackDir = path.join(backupsRoot, `pre_restore_rollback_${Date.now()}`);
  fs.mkdirSync(rollbackDir, { recursive: true });

  const currentDbPath = path.resolve(__dirname, '../unitask.db');
  if (fs.existsSync(currentDbPath)) {
    fs.copyFileSync(currentDbPath, path.join(rollbackDir, 'unitask.db'));
    console.log('   ✅ Hozirgi unitask.db rollback uchun saqlandi.');
  }

  // 2. Database tiklash
  const backupJson = path.join(backupDir, 'database_data.json');
  const backupDb = path.join(backupDir, 'unitask.db');

  if (fs.existsSync(backupDb) && (!process.env.DB_CLIENT || process.env.DB_CLIENT === 'sqlite')) {
    console.log('\n2. SQLite fayli to\'g\'ridan-to\'g\'ri almashtirilmoqda...');
    fs.copyFileSync(backupDb, currentDbPath);
    console.log('   ✅ unitask.db fayli qayta tiklandi.');
  } else if (fs.existsSync(backupJson)) {
    console.log('\n2. Ma\'lumotlar JSON orqali bazaga import qilinmoqda...');
    await importData(backupJson);
    console.log('   ✅ Bazadagi ma\'lumotlar import qilindi.');
  }

  // 3. uploads/ papkasini tiklash
  const uploadsZip = path.join(backupDir, 'uploads.zip');
  if (fs.existsSync(uploadsZip)) {
    console.log('\n3. uploads papkasi arxivdan ochilmoqda...');
    const targetUploads = path.resolve(__dirname, '../uploads');
    const zip = new AdmZip(uploadsZip);
    zip.extractAllTo(path.resolve(__dirname, '..'), true);
    console.log('   ✅ uploads/ papkasidagi barcha fayllar muvaffaqiyatli qaytarildi.');
  }

  console.log('\n===============================================================');
  console.log('🎉 TIZIM MUVAFFAQIYATLI TIKLANDI!');
  console.log(`🛡️  Favqulodda rollback papkasi: ${rollbackDir}`);
  console.log('===============================================================');
}

if (require.main === module) {
  const target = process.argv[2];
  restoreBackup(target).then(() => process.exit(0)).catch(err => {
    console.error('❌ Restore xatosi:', err);
    process.exit(1);
  });
}

module.exports = { restoreBackup };
