const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.resolve(__dirname, '../../uploads');
const assignmentsUploadsDir = path.resolve(uploadsDir, 'assignments');
const submissionsUploadsDir = path.resolve(uploadsDir, 'submissions');

// Papkalarni yaratish
[uploadsDir, assignmentsUploadsDir, submissionsUploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Agar talaba javob topshirayotgan bo'lsa -> submissions papkasi
    if (req.baseUrl && req.baseUrl.includes('submissions')) {
      cb(null, submissionsUploadsDir);
    } else {
      cb(null, assignmentsUploadsDir);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u0400-\u04FF-]/g, '_').slice(0, 50);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  }
});

// Qabul qilinadigan MIME turlari va kengaytmalar
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.pptx', '.ppt', '.txt']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error('Faqat PDF, DOC, DOCX, PPTX yoki TXT formatidagi fayllar qabul qilinadi.'), false);
  }

  // Ba'zi brauzerlar octet-stream yuborishi mumkin bo'lgan holatlarni ham hisobga olamiz,
  // ammo ruxsat etilgan MIME yoki octet-stream bo'lishi shart
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype) && file.mimetype !== 'application/octet-stream') {
    return cb(new Error(`Fayl MIME turi yaroqsiz (${file.mimetype}). Faqat haqiqiy hujjat formatlarini yuklang.`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: fileFilter
});

/**
 * Haqiqiy fayl sarlavhasini (magic bytes) tekshirish
 */
function validateFileHeader(filePath, originalName = '') {
  try {
    if (!fs.existsSync(filePath)) return false;

    const ext = path.extname(originalName || filePath).toLowerCase();
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // 1. PDF: %PDF (0x25 0x50 0x44 0x46)
    if (ext === '.pdf') {
      return buffer.slice(0, 4).toString('utf8') === '%PDF';
    }

    // 2. DOCX / PPTX: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    if (ext === '.docx' || ext === '.pptx') {
      return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    }

    // 3. Eski DOC / PPT: OLE Compound File (0xD0 0xCF 0x11 0xE0)
    if (ext === '.doc' || ext === '.ppt') {
      return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
    }

    // 4. TXT: Matnli baytlar (nul byte bo'lmasligi kerak)
    if (ext === '.txt') {
      return !buffer.includes(0x00);
    }

    return false;
  } catch (err) {
    console.error('validateFileHeader xatosi:', err.message);
    return false;
  }
}

/**
 * Muvaffaqiyatsiz so'rovlarda faylni xavfsiz o'chirish
 */
function cleanupUploadedFile(filePath) {
  if (!filePath) return;
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '../../', filePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn('cleanupUploadedFile ogohlantirish:', err.message);
  }
}

module.exports = upload;
module.exports.validateFileHeader = validateFileHeader;
module.exports.cleanupUploadedFile = cleanupUploadedFile;
