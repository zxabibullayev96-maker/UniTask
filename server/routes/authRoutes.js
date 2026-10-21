const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { rateLimit } = require('../middlewares/rateLimitMiddleware');

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: "Kirish urinishlari juda ko'payib ketdi." });
const registerLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: "Ro'yxatdan o'tish so'rovlari ko'payib ketdi." });

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
