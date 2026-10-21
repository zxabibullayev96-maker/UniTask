const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(authenticateToken);

// Barcha topshirilgan ishlar (Faqat Super Admin)
router.get('/all', requireRole('admin'), submissionController.getAllSubmissions);
router.get('/', requireRole('admin'), submissionController.getAllSubmissions);

// Talaba amallari
router.post('/start', requireRole('student'), submissionController.startTestSession);
router.post('/draft', requireRole('student'), submissionController.saveDraftAnswers);
router.get('/session/:assignmentId', requireRole('student'), submissionController.getActiveSession);
router.post('/', requireRole('student'), upload.single('file'), submissionController.submitAnswer);
router.get('/my', requireRole('student'), submissionController.getMySubmissions);

// Xavfsiz fayl yuklab olish (Talaba egasi, O'qituvchi egasi yoki Admin)
router.get('/:id/file', submissionController.downloadSubmissionFile);

// O'qituvchi va Admin amallari
router.get('/assignment/:assignmentId', requireRole(['teacher', 'admin']), submissionController.getAssignmentSubmissions);
router.post('/:id/grade', requireRole(['teacher', 'admin']), submissionController.gradeSubmission);
router.post('/:id/re-analyze', requireRole(['teacher', 'admin']), submissionController.reanalyzeSubmission);
router.delete('/:id', requireRole(['teacher', 'admin']), submissionController.allowResubmission);

// Har ikki rol ko'rishi mumkin bo'lgan ish tafsiloti
router.get('/:id', submissionController.getSubmissionById);

module.exports = router;