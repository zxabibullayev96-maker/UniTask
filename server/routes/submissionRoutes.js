const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// Talaba amallari
router.post('/', requireRole('student'), submissionController.submitAnswer);
router.get('/my', requireRole('student'), submissionController.getMySubmissions);

// O'qituvchi va Admin amallari
router.get('/assignment/:assignmentId', requireRole(['teacher', 'admin']), submissionController.getAssignmentSubmissions);
router.post('/:id/grade', requireRole(['teacher', 'admin']), submissionController.gradeSubmission);
router.post('/:id/re-analyze', requireRole(['teacher', 'admin']), submissionController.reanalyzeSubmission);
router.delete('/:id', requireRole(['teacher', 'admin']), submissionController.allowResubmission);

// Har ikki rol ko'rishi mumkin bo'lgan ish tafsiloti
router.get('/:id', submissionController.getSubmissionById);

module.exports = router;
