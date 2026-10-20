const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Guruhlar ro'yxati
router.get('/', groupController.getAllGroups);

// Guruh yaratish va o'chirish (Faqat Super Admin)
router.post('/', authenticateToken, requireRole('admin'), groupController.createGroup);
router.delete('/:id', authenticateToken, requireRole('admin'), groupController.deleteGroup);

module.exports = router;
