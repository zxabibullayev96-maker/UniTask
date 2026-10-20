require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./config/database');

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

// Statik fayllar (Frontend SPA & Yuklangan fayllar)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Tizim holati (Health check & AI status)
app.get('/api/system-status', (req, res) => {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'));
  res.json({
    success: true,
    platform: 'UniTask AI',
    version: '1.0.0',
    aiStatus: hasOpenAiKey ? 'OpenAI GPT-4o-mini faol' : 'Ichki Semantik Tahlil Rejimi (Standby)',
    hasOpenAiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

// Xatoliklarni qayta ishlash middleware
app.use((err, req, res, next) => {
  console.error('Server xatoligi:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Serverda kutilmagan xatolik yuz berdi.'
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

startServer();
