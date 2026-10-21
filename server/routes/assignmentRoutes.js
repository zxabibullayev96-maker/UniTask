const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(authenticateToken);

router.get('/', assignmentController.getAssignments);
router.get('/:id', assignmentController.getAssignmentById);

// Topshiriq yaratish (ixtiyoriy fayl bilan birga: doc, docx, pdf, pptx)
router.post('/', requireRole(['teacher', 'admin']), upload.single('file'), assignmentController.createAssignment);

// Topshiriqni tahrirlash
router.put('/:id', requireRole(['teacher', 'admin']), upload.single('file'), assignmentController.updateAssignment);

// Fayldan matnni oldindan ajratib olish (Preview / Instant extract)
router.post('/extract-text', requireRole(['teacher', 'admin']), upload.single('file'), assignmentController.extractTextOnly);

router.delete('/:id', requireRole(['teacher', 'admin']), assignmentController.deleteAssignment);

module.exports = router;
