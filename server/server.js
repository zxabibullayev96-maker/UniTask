require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, db, dbPath } = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const userRoutes = require('./routes/userRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Statik fayllar (Frontend SPA)
app.use(express.static(path.join(__dirname, '../public')));

// Xavfsizlik: Talabalar yuklagan shaxsiy javob fayllari (/uploads/submissions) ochiq statik berilmaydi
// Faqat himoyalangan /api/submissions/:id/file marshruti orqali yuklab olinadi
app.use((req, res, next) => {
  try {
    const normalizedPath = decodeURIComponent(req.path).replace(/\\/g, '/').toLowerCase();
    if (normalizedPath.startsWith('/uploads/submissions')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Talabalar javoblari xavfsizlik maqsadida ochiq havola orqali ko\'rsatilmaydi.' 
      });
    }
  } catch (e) {
    // Agar URI decoding xatosi bo'lsa xavfsiz holda rad etish
    if (req.path.toLowerCase().includes('submissions')) {
      return res.status(403).json({ success: false, message: 'Ruxsatsiz so\'rov.' });
    }
  }
  next();
});
// O'quv materiallari statik tarzda taqdim etiladi
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Tizim holati (Health check, AI status & Database audit)
app.get('/api/system-status', async (req, res) => {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'));
  
  let userCount = 0;
  let dbStatus = 'disconnected';
  try {
    const row = await db.getAsync('SELECT COUNT(*) as count FROM users');
    userCount = row ? row.count : 0;
    dbStatus = 'connected';
  } catch (dbErr) {
    dbStatus = 'error: ' + dbErr.message;
  }

  const clientType = db.clientType || 'sqlite';
  const storageMode = clientType === 'turso' 
    ? 'cloud_serverless_turso' 
    : (process.env.DB_PATH ? 'persistent_configured' : 'ephemeral_local');

  res.json({
    success: true,
    platform: 'UniTask AI',
    version: '1.0.0',
    aiStatus: hasOpenAiKey ? 'OpenAI GPT-4o-mini faol' : 'Ichki Semantik Tahlil Rejimi (Standby)',
    hasOpenAiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    database: {
      status: dbStatus,
      clientType,
      userCount,
      storageMode,
      target: clientType === 'turso' ? 'Turso Cloud LibSQL' : path.basename(dbPath)
    },
    time: new Date().toISOString()
  });
});

// API Marshrutlari
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);

// SPA Fallback: barcha noma'lum GET so'rovlarni index.html ga yo'naltirish
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Xatoliklarni qayta ishlash middleware (Multer va umumiy xatolar)
app.use((err, req, res, next) => {
  console.error('Server xatoligi:', err.message || err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Fayl hajmi ruxsat etilgan limitdan (50MB) katta.' });
    }
    return res.status(400).json({ success: false, message: 'Fayl yuklashda xatolik: ' + err.message });
  }
  if (err.message && err.message.includes('Faqat PDF, DOC, DOCX, PPTX')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  res.status(500).json({
    success: false,
    message: err.message || 'Serverda kutilmagan xatolik yuz berdi.'
  });
});

// Bazani ishga tushirish va serverni tinglash
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 UniTask AI serveri muvaffaqiyatli ishga tushdi!`);
      console.log(`🌐 Manzil: http://localhost:${PORT}`);
      console.log(`🤖 AI Rejimi: ${process.env.OPENAI_API_KEY ? 'OpenAI gpt-4o-mini' : 'Aqlli Fallback Semantik Tahlil'}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Serverni ishga tushirishda xatolik:', error);
    process.exit(1);
  }
}

// Faqat to'g'ridan-to'g'ri ishga tushirilganda listen qiladi (testlar uchun export qilinadi)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
