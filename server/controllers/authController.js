const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

async function register(req, res) {
  try {
    const { name, first_name, last_name, email, password, role, group_id, group_code } = req.body;

    const fullName = (name || `${first_name || ''} ${last_name || ''}`).trim();

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Barcha majburiy maydonlarni to\'ldiring (ism, familiya, email, parol, rol).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const allowedRoles = ['student', 'teacher', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri foydalanuvchi roli tanlangan.' });
    }

    // Guruhni aniqlash (FR-1.2: Talaba uchun guruh majburiy)
    let assignedGroupId = null;
    if (role === 'student') {
      const gInput = group_id || group_code;
      if (!gInput) {
        return res.status(400).json({ success: false, message: 'Talaba uchun akademik guruh yoki guruh kodi kiritilishi shart.' });
      }

      // Agar raqamli ID bo'lsa
      if (!isNaN(gInput) && typeof gInput === 'number') {
        const found = await db.getAsync('SELECT id FROM groups WHERE id = ?', [gInput]);
        if (found) assignedGroupId = found.id;
      }

      // Agar topilmagan bo'lsa yoki string bo'lsa
      if (!assignedGroupId) {
        const gName = String(gInput).trim();
        // Guruh nomi bo'yicha qidirish
        let foundGroup = await db.getAsync('SELECT id FROM groups WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?)', [gName, `%${gName}%`]);
        if (foundGroup) {
          assignedGroupId = foundGroup.id;
        } else {
          // Guruh mavjud bo'lmasa avtomatik yaratish
          const newG = await db.runAsync('INSERT INTO groups (name) VALUES (?)', [`${gName} Guruh`]);
          assignedGroupId = newG.lastID;
        }
      }
    }

    // Email mavjudligini tekshirish
    const existing = await db.getAsync('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ushbu email bilan allaqachon ro\'yxatdan o\'tilgan.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.runAsync(
      'INSERT INTO users (name, email, password, role, group_id) VALUES (?, ?, ?, ?, ?)',
      [fullName, cleanEmail, hashedPassword, role, assignedGroupId]
    );

    const newUser = await db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.id = ?`,
      [result.lastID]
    );

    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, group_id: newUser.group_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz.',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Register xatosi:', error);
    return res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email va parolni kiriting.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.getAsync(
      `SELECT u.*, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.email = ?`,
      [cleanEmail]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, group_id: user.group_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      group_id: user.group_id,
      group_name: user.group_name
    };

    return res.json({
      success: true,
      message: 'Tizimga muvaffaqiyatli kirdingiz.',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Login xatosi:', error);
    return res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi.' });
  }
}

async function getMe(req, res) {
  try {
    const user = await db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi.' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('getMe xatosi:', error);
    return res.status(500).json({ success: false, message: 'Serverda xatolik yuz berdi.' });
  }
}

module.exports = {
  register,
  login,
  getMe
};
