const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function getAllUsers(req, res) {
  try {
    const { role } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.group_id, u.created_at, g.name as group_name 
      FROM users u 
      LEFT JOIN groups g ON u.group_id = g.id 
    `;
    const params = [];

    if (role) {
      query += ` WHERE u.role = ? `;
      params.push(role);
    }

    query += ` ORDER BY u.id DESC `;

    const users = await db.allAsync(query, params);
    return res.json({ success: true, users });
  } catch (error) {
    console.error('getAllUsers xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchilarni olishda xatolik yuz berdi.' });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role, group_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Barcha maydonlarni to\'ldiring.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.getAsync('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ushbu email bilan foydalanuvchi mavjud.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.runAsync(
      'INSERT INTO users (name, email, password, role, group_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword, role, role === 'student' ? group_id : null]
    );

    const newUser = await db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.id = ?`,
      [result.lastID]
    );

    return res.status(201).json({ success: true, message: 'Foydalanuvchi yaratildi.', user: newUser });
  } catch (error) {
    console.error('createUser xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchi yaratishda xatolik yuz berdi.' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, role, group_id } = req.body;

    const existingUser = await db.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi.' });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : existingUser.email;
    if (cleanEmail !== existingUser.email) {
      const emailCheck = await db.getAsync('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, id]);
      if (emailCheck) {
        return res.status(400).json({ success: false, message: 'Ushbu email boshqa foydalanuvchi tomonidan band qilingan.' });
      }
    }

    let hashedPassword = existingUser.password;
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
    }

    const newRole = role || existingUser.role;
    const newGroupId = newRole === 'student' ? (group_id || null) : null;
    const newName = name ? name.trim() : existingUser.name;

    await db.runAsync(
      'UPDATE users SET name = ?, email = ?, password = ?, role = ?, group_id = ? WHERE id = ?',
      [newName, cleanEmail, hashedPassword, newRole, newGroupId, id]
    );

    const updatedUser = await db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.id = ?`,
      [id]
    );

    return res.json({ success: true, message: 'Foydalanuvchi yangilandi.', user: updatedUser });
  } catch (error) {
    console.error('updateUser xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchini yangilashda xatolik yuz berdi.' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'O\'zingizning akkauntingizni o\'chira olmaysiz.' });
    }

    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi.' });
    }

    await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Foydalanuvchi o\'chirildi.' });
  } catch (error) {
    console.error('deleteUser xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchini o\'chirishda xatolik yuz berdi.' });
  }
}

async function getAdminStats(req, res) {
  try {
    const studentCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const teacherCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
    const groupCount = await db.getAsync("SELECT COUNT(*) as count FROM groups");
    const assignmentCount = await db.getAsync("SELECT COUNT(*) as count FROM assignments");
    
    const submissionStats = await db.getAsync(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_count,
        SUM(CASE WHEN status = 'graded' THEN 1 ELSE 0 END) as graded_count,
        ROUND(AVG(COALESCE(teacher_score, recommended_score)), 1) as avg_score
      FROM submissions
    `);

    return res.json({
      success: true,
      stats: {
        students: studentCount.count || 0,
        teachers: teacherCount.count || 0,
        groups: groupCount.count || 0,
        assignments: assignmentCount.count || 0,
        submissions: submissionStats.total_submissions || 0,
        pending: submissionStats.pending_count || 0,
        reviewed: submissionStats.reviewed_count || 0,
        graded: submissionStats.graded_count || 0,
        avgScore: submissionStats.avg_score || 0
      }
    });
  } catch (error) {
    console.error('getAdminStats xatosi:', error);
    return res.status(500).json({ success: false, message: 'Statistikani yuklashda xatolik yuz berdi.' });
  }
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAdminStats
};
