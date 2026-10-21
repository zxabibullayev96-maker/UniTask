const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'unitask_secret_jwt_key_2025_secure_edtech_platform';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Avtorizatsiyadan o\'tilmagan. Token topilmadi.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Yaroqsiz yoki muddati o\'tgan token.' });
    }

    try {
      // Foydalanuvchi faolligini tekshirish (is_active)
      const dbUser = await db.getAsync('SELECT id, is_active FROM users WHERE id = ?', [user.id]);
      if (!dbUser || dbUser.is_active === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Ushbu akkaunt ma\'muriyat tomonidan faolsizlantirilgan.' 
        });
      }

      req.user = user;
      next();
    } catch (e) {
      req.user = user;
      next();
    }
  });
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Ruxsat berilmadi. Ushbu amalni bajarish uchun huquq yetarli emas.' 
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
