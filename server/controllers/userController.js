const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

/**
 * Barcha foydalanuvchilar ro'yxati (filtrlash, qidiruv va bog'liq guruhlar bilan)
 */
async function getAllUsers(req, res) {
  try {
    const { role, group_id, search, status } = req.query;

    let query = `
      SELECT u.id, u.name, u.email, u.role, u.group_id, u.is_active, u.created_at, g.name as group_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.student_id = u.id) as submissions_count,
        (SELECT ROUND(AVG(COALESCE(s.teacher_score, s.recommended_score)), 1) FROM submissions s WHERE s.student_id = u.id) as avg_score,
        (SELECT COUNT(*) FROM assignments a WHERE a.teacher_id = u.id) as assignments_count
      FROM users u 
      LEFT JOIN groups g ON u.group_id = g.id 
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ` AND u.role = ? `;
      params.push(role);
    }

    if (group_id) {
      query += ` AND u.group_id = ? `;
      params.push(group_id);
    }

    if (status === 'active') {
      query += ` AND u.is_active = 1 `;
    } else if (status === 'blocked') {
      query += ` AND u.is_active = 0 `;
    }

    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ?) `;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY u.id DESC `;

    const users = await db.allAsync(query, params);

    // O'qituvchilar uchun biriktirilgan guruhlarni yuklash
    const allGroupTeachers = await db.allAsync(`
      SELECT gt.teacher_id, g.id as group_id, g.name as group_name
      FROM group_teachers gt
      JOIN groups g ON gt.group_id = g.id
      ORDER BY g.name ASC
    `);

    const teacherGroupsMap = {};
    allGroupTeachers.forEach(gt => {
      if (!teacherGroupsMap[gt.teacher_id]) teacherGroupsMap[gt.teacher_id] = [];
      teacherGroupsMap[gt.teacher_id].push({
        id: gt.group_id,
        name: gt.group_name
      });
    });

    const enrichedUsers = users.map(u => ({
      ...u,
      assigned_groups: teacherGroupsMap[u.id] || []
    }));

    return res.json({ success: true, users: enrichedUsers });
  } catch (error) {
    console.error('getAllUsers xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchilarni olishda xatolik yuz berdi.' });
  }
}

/**
 * Bitta foydalanuvchi ma'lumotlarini olish
 */
async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const user = await db.getAsync(`
      SELECT u.id, u.name, u.email, u.role, u.group_id, u.is_active, u.created_at, g.name as group_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.student_id = u.id) as submissions_count,
        (SELECT ROUND(AVG(COALESCE(s.teacher_score, s.recommended_score)), 1) FROM submissions s WHERE s.student_id = u.id) as avg_score,
        (SELECT COUNT(*) FROM assignments a WHERE a.teacher_id = u.id) as assignments_count
      FROM users u 
      LEFT JOIN groups g ON u.group_id = g.id 
      WHERE u.id = ?
    `, [id]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi.' });
    }

    // Agar o'qituvchi bo'lsa, guruhlarini yuklash
    if (user.role === 'teacher') {
      const assignedGroups = await db.allAsync(`
        SELECT g.id, g.name
        FROM group_teachers gt
        JOIN groups g ON gt.group_id = g.id
        WHERE gt.teacher_id = ?
        ORDER BY g.name ASC
      `, [id]);
      user.assigned_groups = assignedGroups;
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('getUserById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchini olishda xatolik yuz berdi.' });
  }
}

/**
 * Yangi foydalanuvchi yaratish (Super Admin)
 */
async function createUser(req, res) {
  try {
    const { name, email, password, role, group_id, is_active, assigned_groups } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Barcha majburiy maydonlarni to\'ldiring.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.getAsync('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ushbu email bilan foydalanuvchi allaqachon mavjud.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const activeState = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const result = await db.runAsync(
      'INSERT INTO users (name, email, password, role, group_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword, role, role === 'student' ? (group_id || null) : null, activeState]
    );

    const newUserId = result.lastID;

    // Agar o'qituvchi bo'lsa va guruhlar biriktirilgan bo'lsa
    if (role === 'teacher' && Array.isArray(assigned_groups)) {
      for (const gId of assigned_groups) {
        await db.runAsync('INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)', [gId, newUserId]);
      }
    }

    const newUser = await db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, u.is_active, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.id = ?`,
      [newUserId]
    );

    return res.status(201).json({ success: true, message: 'Foydalanuvchi muvaffaqiyatli yaratildi.', user: newUser });
  } catch (error) {
    console.error('createUser xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchi yaratishda xatolik yuz berdi.' });
  }
}

/**
 * Foydalanuvchi ma'lumotlarini tahrirlash (Super Admin)
 */
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, role, group_id, is_active, assigned_groups } = req.body;

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
      if (password.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Yangi parol kamida 6 belgidan iborat bo\'lishi shart.' });
      }
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
    }

    const newRole = role || existingUser.role;
    const newGroupId = newRole === 'student' ? (group_id || null) : null;
    const newName = name ? name.trim() : existingUser.name;
    const newActiveState = is_active !== undefined ? (is_active ? 1 : 0) : existingUser.is_active;

    await db.runAsync(
      'UPDATE users SET name = ?, email = ?, password = ?, role = ?, group_id = ?, is_active = ? WHERE id = ?',
      [newName, cleanEmail, hashedPassword, newRole, newGroupId, newActiveState, id]
    );

    // O'qituvchiga biriktirilgan guruhlar berilgan bo'lsa yangilash
    if (newRole === 'teacher' && Array.isArray(assigned_groups)) {
      await db.runAsync('DELETE FROM group_teachers WHERE teacher_id = ?', [id]);
      for (const gId of assigned_groups) {
        await db.runAsync('INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)', [gId, id]);
      }
    }

    const updatedUser = await db.getAsync(
      `SELECT u.id, u.name, u.email, u.role, u.group_id, u.is_active, g.name as group_name 
       FROM users u 
       LEFT JOIN groups g ON u.group_id = g.id 
       WHERE u.id = ?`,
      [id]
    );

    return res.json({ success: true, message: 'Foydalanuvchi muvaffaqiyatli yangilandi.', user: updatedUser });
  } catch (error) {
    console.error('updateUser xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchini yangilashda xatolik yuz berdi.' });
  }
}

/**
 * O'qituvchiga guruhlarni biriktirish
 */
async function assignGroupsToTeacher(req, res) {
  try {
    const { id } = req.params;
    const { group_ids } = req.body;

    const teacher = await db.getAsync("SELECT id, name FROM users WHERE id = ? AND role = 'teacher'", [id]);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'O\'qituvchi topilmadi.' });
    }

    if (!Array.isArray(group_ids)) {
      return res.status(400).json({ success: false, message: 'Guruhlar ro\'yxati massiv ko\'rinishida bo\'lishi kerak.' });
    }

    await db.runAsync('DELETE FROM group_teachers WHERE teacher_id = ?', [id]);
    for (const gId of group_ids) {
      await db.runAsync('INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)', [gId, id]);
    }

    const assignedGroups = await db.allAsync(`
      SELECT g.id, g.name
      FROM group_teachers gt
      JOIN groups g ON gt.group_id = g.id
      WHERE gt.teacher_id = ?
      ORDER BY g.name ASC
    `, [id]);

    return res.json({
      success: true,
      message: `"${teacher.name}" uchun guruhlar muvaffaqiyatli biriktirildi.`,
      assigned_groups: assignedGroups
    });
  } catch (error) {
    console.error('assignGroupsToTeacher xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruhlarni biriktirishda xatolik yuz berdi.' });
  }
}

/**
 * Foydalanuvchini faollashtirish yoki bloklash (Super Admin)
 */
async function toggleUserActive(req, res) {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'O\'zingizning akkauntingiz faollik holatini o\'zgartira olmaysiz.' });
    }

    const targetUser = await db.getAsync('SELECT * FROM users WHERE id = ?', [userId]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi.' });
    }

    const newActiveState = targetUser.is_active === 1 ? 0 : 1;
    await db.runAsync('UPDATE users SET is_active = ? WHERE id = ?', [newActiveState, userId]);
    const updatedUser = await db.getAsync('SELECT id, name, email, role, group_id, is_active FROM users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: newActiveState === 1 
        ? `"${targetUser.name}" akkaunti muvaffaqiyatli faollashtirildi.` 
        : `"${targetUser.name}" akkaunti muvaffaqiyatli faolsizlantirildi (bloklandi).`,
      is_active: newActiveState,
      user: updatedUser
    });
  } catch (error) {
    console.error('toggleUserActive xatosi:', error);
    return res.status(500).json({ success: false, message: 'Holatni o\'zgartirishda xatolik yuz berdi.' });
  }
}

/**
 * Foydalanuvchini o'chirish (Tasodifiy ma'lumot yo'qotishdan himoyalangan)
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const { force } = req.query;

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, message: 'O\'zingizning akkauntingizni o\'chira olmaysiz.' });
    }

    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi.' });
    }

    // Talaba bo'lsa va topshirgan ishlari mavjud bo'lsa
    if (user.role === 'student') {
      const subCountRow = await db.getAsync('SELECT COUNT(*) as count FROM submissions WHERE student_id = ?', [id]);
      const subCount = subCountRow ? subCountRow.count : 0;

      if (subCount > 0 && force !== 'true') {
        return res.status(400).json({
          success: false,
          hasSubmissions: true,
          submissionCount: subCount,
          message: `Ushbu talabada ${subCount} ta topshirilgan ish va baholar mavjud. Ma'lumotlarni saqlab qolish uchun talabani o'chirish o'rniga bloklash tavsiya etiladi. Baribir o'chirish uchun tasdiqlang.`
        });
      }
    }

    // O'qituvchi bo'lsa va yaratgan topshiriqlari mavjud bo'lsa
    if (user.role === 'teacher') {
      const assignCountRow = await db.getAsync('SELECT COUNT(*) as count FROM assignments WHERE teacher_id = ?', [id]);
      const assignCount = assignCountRow ? assignCountRow.count : 0;

      if (assignCount > 0 && force !== 'true') {
        return res.status(400).json({
          success: false,
          hasAssignments: true,
          assignmentCount: assignCount,
          message: `Ushbu o'qituvchiga tegishli ${assignCount} ta mustaqil topshiriq mavjud. O'chirish o'rniga akkauntni bloklash tavsiya etiladi. Baribir o'chirish uchun tasdiqlang.`
        });
      }

      await db.runAsync('DELETE FROM group_teachers WHERE teacher_id = ?', [id]);
    }

    await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true, message: `"${user.name}" muvaffaqiyatli o'chirildi.` });
  } catch (error) {
    console.error('deleteUser xatosi:', error);
    return res.status(500).json({ success: false, message: 'Foydalanuvchini o\'chirishda xatolik yuz berdi.' });
  }
}

/**
 * Super Admin statistikasi
 */
async function getAdminStats(req, res) {
  try {
    const studentCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const activeStudentCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND is_active = 1");
    const teacherCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
    const activeTeacherCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role = 'teacher' AND is_active = 1");
    const groupCount = await db.getAsync("SELECT COUNT(*) as count FROM groups");
    const assignmentCount = await db.getAsync("SELECT COUNT(*) as count FROM assignments");
    const blockedCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE is_active = 0");
    const activeUsersCount = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE is_active = 1");
    
    const submissionStats = await db.getAsync(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_count,
        SUM(CASE WHEN status = 'graded' THEN 1 ELSE 0 END) as graded_count,
        ROUND(AVG(COALESCE(teacher_score, recommended_score)), 1) as avg_score
      FROM submissions
    `);

    const reviewed = submissionStats ? (submissionStats.reviewed_count || 0) : 0;
    const graded = submissionStats ? (submissionStats.graded_count || 0) : 0;
    const pending = submissionStats ? (submissionStats.pending_count || 0) : 0;
    const totalSubs = submissionStats ? (submissionStats.total_submissions || 0) : 0;

    return res.json({
      success: true,
      stats: {
        students: studentCount.count || 0,
        activeStudents: activeStudentCount.count || 0,
        teachers: teacherCount.count || 0,
        activeTeachers: activeTeacherCount.count || 0,
        groups: groupCount.count || 0,
        assignments: assignmentCount.count || 0,
        submissions: totalSubs,
        pending: pending,
        reviewed: reviewed,
        graded: graded,
        aiReviewed: reviewed + graded,
        blockedUsers: blockedCount.count || 0,
        activeUsers: activeUsersCount.count || 0,
        avgScore: submissionStats ? (submissionStats.avg_score || 0) : 0
      }
    });
  } catch (error) {
    console.error('getAdminStats xatosi:', error);
    return res.status(500).json({ success: false, message: 'Statistikani yuklashda xatolik yuz berdi.' });
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  assignGroupsToTeacher,
  toggleUserActive,
  deleteUser,
  getAdminStats
};