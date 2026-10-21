const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Guruhlar ro'yxati (Autentifikatsiyasiz faqat id va name; kiringan bo'lsa to'liq statistika)
router.get('/', groupController.getAllGroups);

// Bitta guruh tafsiloti (o'qituvchi va admin uchun)
router.get('/:id', authenticateToken, requireRole(['admin', 'teacher']), groupController.getGroupById);

// Guruh yaratish, tahrirlash va o'chirish (Faqat Super Admin)
router.post('/', authenticateToken, requireRole('admin'), groupController.createGroup);
router.put('/:id', authenticateToken, requireRole('admin'), groupController.updateGroup);
router.delete('/:id', authenticateToken, requireRole('admin'), groupController.deleteGroup);

// Guruhga o'qituvchi biriktirish va olib tashlash (Faqat Super Admin)
router.post('/:id/teachers', authenticateToken, requireRole('admin'), groupController.assignTeacherToGroup);
router.delete('/:id/teachers/:teacherId', authenticateToken, requireRole('admin'), groupController.removeTeacherFromGroup);

module.exports = router;