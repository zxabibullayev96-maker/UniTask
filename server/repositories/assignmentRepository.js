/**
 * UniTask AI - Topshiriqlar Ma'lumot Qatlami (Assignment Repository)
 */
const { db } = require('../config/database');

const AssignmentRepository = {
  async findById(id) {
    return db.getAsync(
      `SELECT a.*, u.name as teacher_name, g.name as group_name 
       FROM assignments a
       JOIN users u ON a.teacher_id = u.id
       JOIN groups g ON a.group_id = g.id
       WHERE a.id = ?`,
      [id]
    );
  },

  async getAll({ teacherId = null, groupId = null } = {}) {
    let query = `
      SELECT a.*, u.name as teacher_name, g.name as group_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count
      FROM assignments a
      JOIN users u ON a.teacher_id = u.id
      JOIN groups g ON a.group_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (teacherId) {
      query += ' AND a.teacher_id = ?';
      params.push(teacherId);
    }
    if (groupId) {
      query += ' AND a.group_id = ?';
      params.push(groupId);
    }

    query += ' ORDER BY a.created_at DESC';
    return db.allAsync(query, params);
  },

  async count() {
    const row = await db.getAsync('SELECT COUNT(*) as count FROM assignments');
    return row ? row.count : 0;
  }
};

module.exports = AssignmentRepository;
