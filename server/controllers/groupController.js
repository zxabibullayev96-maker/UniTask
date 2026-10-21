const { db } = require('../config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

/**
 * Barcha guruhlar ro'yxatini olish (Admin va o'qituvchilar uchun to'liq ma'lumot, ommaviy uchun qisqa)
 */
async function getAllGroups(req, res) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let isPrivilegedUser = false;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && ['admin', 'teacher'].includes(decoded.role)) {
          isPrivilegedUser = true;
        }
      } catch (e) {
        // Token yaroqsiz bo'lsa ommaviy rejim
      }
    }

    if (isPrivilegedUser) {
      // O'qituvchi va Admin uchun to'liq statistika
      const groups = await db.allAsync(`
        SELECT g.*, 
          (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id AND u.role = 'student') as student_count,
          (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id AND u.role = 'student' AND u.is_active = 1) as active_student_count,
          (SELECT COUNT(*) FROM assignments a WHERE a.group_id = g.id) as assignment_count,
          (SELECT COUNT(*) FROM submissions sub JOIN assignments a ON sub.assignment_id = a.id WHERE a.group_id = g.id) as submission_count
        FROM groups g
        ORDER BY g.name ASC
      `);

      // Har bir guruhga biriktirilgan o'qituvchilarni qo'shish
      const allGroupTeachers = await db.allAsync(`
        SELECT gt.group_id, u.id as teacher_id, u.name as teacher_name, u.email as teacher_email, u.is_active
        FROM group_teachers gt
        JOIN users u ON gt.teacher_id = u.id
        ORDER BY u.name ASC
      `);

      const groupTeachersMap = {};
      allGroupTeachers.forEach(gt => {
        if (!groupTeachersMap[gt.group_id]) groupTeachersMap[gt.group_id] = [];
        groupTeachersMap[gt.group_id].push({
          id: gt.teacher_id,
          name: gt.teacher_name,
          email: gt.teacher_email,
          is_active: gt.is_active
        });
      });

      const enrichedGroups = groups.map(g => ({
        ...g,
        teachers: groupTeachersMap[g.id] || []
      }));

      return res.json({ success: true, groups: enrichedGroups });
    } else {
      // Ro'yxatdan o'tish oynasi uchun faqat id va name
      const groups = await db.allAsync(`
        SELECT id, name FROM groups ORDER BY name ASC
      `);
      return res.json({ success: true, groups });
    }
  } catch (error) {
    console.error('getAllGroups xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruhlarni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Bitta guruh tafsiloti (talabalar, biriktirilgan o'qituvchilar va topshiriqlar)
 */
async function getGroupById(req, res) {
  try {
    const { id } = req.params;
    const group = await db.getAsync(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id AND u.role = 'student') as student_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.group_id = g.id) as assignment_count
      FROM groups g
      WHERE g.id = ?
    `, [id]);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Guruh topilmadi.' });
    }

    // Guruh talabalari
    const students = await db.allAsync(`
      SELECT u.id, u.name, u.email, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM submissions s WHERE s.student_id = u.id) as submissions_count,
        (SELECT ROUND(AVG(COALESCE(s.teacher_score, s.recommended_score)), 1) FROM submissions s WHERE s.student_id = u.id) as avg_score
      FROM users u
      WHERE u.group_id = ? AND u.role = 'student'
      ORDER BY u.name ASC
    `, [id]);

    // Guruhga biriktirilgan o'qituvchilar
    const teachers = await db.allAsync(`
      SELECT u.id, u.name, u.email, u.is_active, gt.assigned_at
      FROM group_teachers gt
      JOIN users u ON gt.teacher_id = u.id
      WHERE gt.group_id = ?
      ORDER BY u.name ASC
    `, [id]);

    // Guruh topshiriqlari
    const assignments = await db.allAsync(`
      SELECT a.id, a.title, a.subject, a.created_at, a.due_date, a.total_points, a.has_dynamic_questions,
        u.name as teacher_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as total_submissions
      FROM assignments a
      JOIN users u ON a.teacher_id = u.id
      WHERE a.group_id = ?
      ORDER BY a.id DESC
    `, [id]);

    return res.json({
      success: true,
      group: {
        ...group,
        students,
        teachers,
        assignments
      }
    });

  } catch (error) {
    console.error('getGroupById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruh tafsilotlarini yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Yangi akademik guruh yaratish
 */
async function createGroup(req, res) {
  try {
    const { name, teacher_ids } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Guruh nomini kiritish majburiydir.' });
    }

    const cleanName = name.trim();
    const existing = await db.getAsync('SELECT id FROM groups WHERE name = ?', [cleanName]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ushbu nomdagi guruh allaqachon mavjud.' });
    }

    const result = await db.runAsync('INSERT INTO groups (name) VALUES (?)', [cleanName]);
    const groupId = result.lastID;

    // Agar o'qituvchilar biriktirilgan bo'lsa
    if (Array.isArray(teacher_ids) && teacher_ids.length > 0) {
      for (const tId of teacher_ids) {
        await db.runAsync('INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)', [groupId, tId]);
      }
    }

    const newGroup = await db.getAsync('SELECT * FROM groups WHERE id = ?', [groupId]);

    return res.status(201).json({
      success: true,
      message: 'Guruh muvaffaqiyatli yaratildi.',
      group: newGroup
    });
  } catch (error) {
    console.error('createGroup xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruh yaratishda xatolik yuz berdi.' });
  }
}

/**
 * Guruh nomini tahrirlash va o'qituvchilarni yangilash
 */
async function updateGroup(req, res) {
  try {
    const { id } = req.params;
    const { name, teacher_ids } = req.body;

    const group = await db.getAsync('SELECT * FROM groups WHERE id = ?', [id]);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Guruh topilmadi.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Guruh nomi bo\'sh bo\'lmasligi kerak.' });
    }

    const cleanName = name.trim();
    const duplicate = await db.getAsync('SELECT id FROM groups WHERE name = ? AND id != ?', [cleanName, id]);
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'Bunday nomli boshqa guruh mavjud.' });
    }

    await db.runAsync('UPDATE groups SET name = ? WHERE id = ?', [cleanName, id]);

    // O'qituvchilar ro'yxati berilgan bo'lsa yangilash
    if (Array.isArray(teacher_ids)) {
      await db.runAsync('DELETE FROM group_teachers WHERE group_id = ?', [id]);
      for (const tId of teacher_ids) {
        await db.runAsync('INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)', [id, tId]);
      }
    }

    const updated = await db.getAsync('SELECT * FROM groups WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Guruh muvaffaqiyatli yangilandi.',
      group: updated
    });
  } catch (error) {
    console.error('updateGroup xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruhni yangilashda xatolik yuz berdi.' });
  }
}

/**
 * Guruhga o'qituvchi biriktirish
 */
async function assignTeacherToGroup(req, res) {
  try {
    const { id } = req.params; // group_id
    const { teacher_id } = req.body;

    if (!teacher_id) {
      return res.status(400).json({ success: false, message: 'O\'qituvchi tanlanmadi.' });
    }

    const group = await db.getAsync('SELECT id, name FROM groups WHERE id = ?', [id]);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Guruh topilmadi.' });
    }

    const teacher = await db.getAsync("SELECT id, name FROM users WHERE id = ? AND role = 'teacher'", [teacher_id]);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'O\'qituvchi topilmadi yoki foydalanuvchi o\'qituvchi emas.' });
    }

    await db.runAsync('INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)', [id, teacher_id]);

    const teachers = await db.allAsync(`
      SELECT u.id, u.name, u.email, u.is_active, gt.assigned_at
      FROM group_teachers gt
      JOIN users u ON gt.teacher_id = u.id
      WHERE gt.group_id = ?
      ORDER BY u.name ASC
    `, [id]);

    return res.json({
      success: true,
      message: `"${teacher.name}" o'qituvchisi "${group.name}" guruhiga muvaffaqiyatli biriktirildi.`,
      teachers
    });
  } catch (error) {
    console.error('assignTeacherToGroup xatosi:', error);
    return res.status(500).json({ success: false, message: 'O\'qituvchini biriktirishda xatolik yuz berdi.' });
  }
}

/**
 * O'qituvchini guruhdan olib tashlash
 */
async function removeTeacherFromGroup(req, res) {
  try {
    const { id, teacherId } = req.params;

    await db.runAsync('DELETE FROM group_teachers WHERE group_id = ? AND teacher_id = ?', [id, teacherId]);

    return res.json({
      success: true,
      message: 'O\'qituvchi ushbu guruhdan olib tashlandi.'
    });
  } catch (error) {
    console.error('removeTeacherFromGroup xatosi:', error);
    return res.status(500).json({ success: false, message: 'O\'qituvchini guruhdan chiqarishda xatolik yuz berdi.' });
  }
}

/**
 * Guruhni o'chirish (Tasdiqlash va xavfsizlik nazorati bilan)
 */
async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const group = await db.getAsync('SELECT * FROM groups WHERE id = ?', [id]);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Guruh topilmadi.' });
    }

    const studentCountRow = await db.getAsync('SELECT COUNT(*) as count FROM users WHERE group_id = ?', [id]);
    const studentCount = studentCountRow ? studentCountRow.count : 0;

    const assignCountRow = await db.getAsync('SELECT COUNT(*) as count FROM assignments WHERE group_id = ?', [id]);
    const assignmentCount = assignCountRow ? assignCountRow.count : 0;

    // Agar talabalar yoki topshiriqlar bo'lsa va force=true bo'lmasa, ogohlantirish beramiz
    if ((studentCount > 0 || assignmentCount > 0) && force !== 'true') {
      return res.status(400).json({
        success: false,
        hasRelations: true,
        studentCount,
        assignmentCount,
        message: `Ushbu guruhda ${studentCount} nafar talaba va ${assignmentCount} ta topshiriq mavjud. O'chirishni tasdiqlash uchun tasdiqlash parametrini yuboring.`
      });
    }

    // Talabalarning group_id sini NULL qilamiz
    await db.runAsync('UPDATE users SET group_id = NULL WHERE group_id = ?', [id]);
    // group_teachers jadvalidan tozalash
    await db.runAsync('DELETE FROM group_teachers WHERE group_id = ?', [id]);
    // Guruhni o'chirish
    await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: `"${group.name}" guruhi muvaffaqiyatli o'chirildi.`
    });
  } catch (error) {
    console.error('deleteGroup xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruhni o\'chirishda xatolik yuz berdi.' });
  }
}

module.exports = {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  assignTeacherToGroup,
  removeTeacherFromGroup,
  deleteGroup
};