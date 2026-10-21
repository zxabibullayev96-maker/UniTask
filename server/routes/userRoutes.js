const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Barcha amallar faqat Super Admin uchun
router.use(authenticateToken, requireRole('admin'));

router.get('/stats', userController.getAdminStats);
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.post('/:id/groups', userController.assignGroupsToTeacher);
router.patch('/:id/status', userController.toggleUserActive);
router.put('/:id/toggle-active', userController.toggleUserActive);
router.delete('/:id', userController.deleteUser);

module.exports = router;