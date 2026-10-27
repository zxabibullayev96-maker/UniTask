/**
 * UniTask AI - Foydalanuvchilar Ma'lumot Qatlami (User Repository)
 * Barcha foydalanuvchilar bilan bog'liq SQL so'rovlarini markazlashtiradi.
 */
const { db } = require('../config/database');

const UserRepository = {
  async findById(id) {
    return db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, u.is_active, u.created_at, g.name as group_name
       FROM users u
       LEFT JOIN groups g ON u.group_id = g.id
       WHERE u.id = ?`,
      [id]
    );
  },

  async findByEmail(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    return db.getAsync(
      `SELECT u.*, g.name as group_name
       FROM users u
       LEFT JOIN groups g ON u.group_id = g.id
       WHERE LOWER(u.email) = LOWER(?)`,
      [cleanEmail]
    );
  },

  async create({ name, email, password, role, group_id = null, is_active = 1 }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const res = await db.runAsync(
      'INSERT INTO users (name, email, password, role, group_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), cleanEmail, password, role, group_id, is_active]
    );
    return this.findById(res.lastID);
  },

  async update(id, fields = {}) {
    const allowed = ['name', 'email', 'role', 'group_id', 'is_active', 'password'];
    const updates = [];
    const params = [];

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        updates.push(`${key} = ?`);
        params.push(key === 'email' ? String(val).trim().toLowerCase() : val);
      }
    }

    if (updates.length === 0) return this.findById(id);

    params.push(id);
    await db.runAsync(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    await db.runAsync('DELETE FROM group_teachers WHERE teacher_id = ?', [id]);
    const res = await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
    return res.changes > 0;
  },

  async count(role = null) {
    if (role) {
      const row = await db.getAsync('SELECT COUNT(*) as count FROM users WHERE role = ?', [role]);
      return row ? row.count : 0;
    }
    const row = await db.getAsync('SELECT COUNT(*) as count FROM users');
    return row ? row.count : 0;
  },

  async getAll({ role = null, is_active = null, search = null } = {}) {
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.group_id, u.is_active, u.created_at, g.name as group_name
      FROM users u
      LEFT JOIN groups g ON u.group_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }
    if (is_active !== null && is_active !== undefined) {
      query += ' AND u.is_active = ?';
      params.push(is_active);
    }
    if (search) {
      query += ' AND (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.created_at DESC, u.id DESC';
    return db.allAsync(query, params);
  }
};

module.exports = UserRepository;
