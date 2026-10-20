const { db } = require('../config/database');

async function getAllGroups(req, res) {
  try {
    const groups = await db.allAsync(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id AND u.role = 'student') as student_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.group_id = g.id) as assignment_count
      FROM groups g
      ORDER BY g.name ASC
    `);
    return res.json({ success: true, groups });
  } catch (error) {
    console.error('getAllGroups xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruhlarni yuklashda xatolik yuz berdi.' });
  }
}

async function createGroup(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Guruh nomini kiriting.' });
    }

    const cleanName = name.trim();
    const existing = await db.getAsync('SELECT id FROM groups WHERE name = ?', [cleanName]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ushbu nomdagi guruh allaqachon mavjud.' });
    }

    const result = await db.runAsync('INSERT INTO groups (name) VALUES (?)', [cleanName]);
    const newGroup = await db.getAsync('SELECT * FROM groups WHERE id = ?', [result.lastID]);

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

async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    const group = await db.getAsync('SELECT * FROM groups WHERE id = ?', [id]);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Guruh topilmadi.' });
    }

    await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Guruh muvaffaqiyatli o\'chirildi.' });
  } catch (error) {
    console.error('deleteGroup xatosi:', error);
    return res.status(500).json({ success: false, message: 'Guruhni o\'chirishda xatolik yuz berdi.' });
  }
}

module.exports = {
  getAllGroups,
  createGroup,
  deleteGroup
};
