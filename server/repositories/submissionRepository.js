/**
 * UniTask AI - Topshirilgan Ishlar Ma'lumot Qatlami (Submission Repository)
 */
const { db } = require('../config/database');

const SubmissionRepository = {
  async findById(id) {
    return db.getAsync(
      `SELECT s.*, 
        u.name as student_name, u.email as student_email,
        a.title as assignment_title, a.open_question, a.total_points
       FROM submissions s
       JOIN users u ON s.student_id = u.id
       JOIN assignments a ON s.assignment_id = a.id
       WHERE s.id = ?`,
      [id]
    );
  },

  async findByAssignmentAndStudent(assignmentId, studentId, attemptNumber = 1) {
    return db.getAsync(
      'SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? AND attempt_number = ?',
      [assignmentId, studentId, attemptNumber]
    );
  },

  async count() {
    const row = await db.getAsync('SELECT COUNT(*) as count FROM submissions');
    return row ? row.count : 0;
  }
};

module.exports = SubmissionRepository;
