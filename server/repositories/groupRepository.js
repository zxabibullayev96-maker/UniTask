/**
 * UniTask AI - Guruhlar Ma'lumot Qatlami (Group Repository)
 */
const { db } = require('../config/database');

const GroupRepository = {
  async findById(id) {
    return db.getAsync('SELECT * FROM groups WHERE id = ?', [id]);
  },

  async findByName(name) {
    const cleanName = String(name || '').trim();
    return db.getAsync(
      'SELECT id, name, created_at FROM groups WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?)',
      [cleanName, `%${cleanName}%`]
    );
  },

  async create(name) {
    const res = await db.runAsync('INSERT INTO groups (name) VALUES (?)', [String(name).trim()]);
    return this.findById(res.lastID);
  },

  async getAll() {
    return db.allAsync(`
      SELECT g.*, 
        COUNT(DISTINCT u.id) as student_count,
        COUNT(DISTINCT gt.teacher_id) as teacher_count
      FROM groups g
      LEFT JOIN users u ON u.group_id = g.id AND u.role = 'student'
      LEFT JOIN group_teachers gt ON gt.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name ASC
    `);
  },

  async delete(id) {
    await db.runAsync('DELETE FROM group_teachers WHERE group_id = ?', [id]);
    const res = await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);
    return res.changes > 0;
  }
};

module.exports = GroupRepository;
