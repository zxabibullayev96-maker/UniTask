const { db } = require('../config/database');
const { extractTextFromFile } = require('../services/documentParser');
const fs = require('fs');

async function getAssignments(req, res) {
  try {
    const user = req.user;

    // Talaba bo'lsa: Faqat o'z guruhiga tegishli topshiriqlar va o'zining topshirish holati
    if (user.role === 'student') {
      if (!user.group_id) {
        return res.json({ success: true, assignments: [] });
      }

      const assignments = await db.allAsync(`
        SELECT 
          a.id, a.title, a.content, a.open_question, a.file_path, a.file_name, a.file_size, a.created_at,
          g.name as group_name,
          u.name as teacher_name,
          s.id as submission_id,
          s.status as submission_status,
          s.recommended_score,
          s.teacher_score,
          s.submitted_at
        FROM assignments a
        JOIN groups g ON a.group_id = g.id
        JOIN users u ON a.teacher_id = u.id
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
        WHERE a.group_id = ?
        ORDER BY a.id DESC
      `, [user.id, user.group_id]);

      return res.json({ success: true, assignments });
    }

    // O'qituvchi bo'lsa: O'zi yaratgan topshiriqlar va statistika
    if (user.role === 'teacher') {
      const assignments = await db.allAsync(`
        SELECT 
          a.id, a.title, a.content, a.open_question, a.file_path, a.file_name, a.file_size, a.created_at, a.group_id,
          g.name as group_name,
          (SELECT COUNT(*) FROM users st WHERE st.group_id = a.group_id AND st.role = 'student') as total_students,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) as total_submissions,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status = 'reviewed') as pending_review_count,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status = 'graded') as graded_count
        FROM assignments a
        JOIN groups g ON a.group_id = g.id
        WHERE a.teacher_id = ?
        ORDER BY a.id DESC
      `, [user.id]);

      return res.json({ success: true, assignments });
    }

    // Admin bo'lsa: Barcha topshiriqlar
    const assignments = await db.allAsync(`
      SELECT 
        a.id, a.title, a.content, a.open_question, a.file_path, a.file_name, a.file_size, a.created_at, a.group_id,
        g.name as group_name,
        u.name as teacher_name,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) as total_submissions
      FROM assignments a
      JOIN groups g ON a.group_id = g.id
      JOIN users u ON a.teacher_id = u.id
      ORDER BY a.id DESC
    `);

    return res.json({ success: true, assignments });
  } catch (error) {
    console.error('getAssignments xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqlarni olishda xatolik yuz berdi.' });
  }
}

async function getAssignmentById(req, res) {
  try {
    const { id } = req.params;
    const assignment = await db.getAsync(`
      SELECT 
        a.*, 
        g.name as group_name, 
        u.name as teacher_name,
        u.email as teacher_email
      FROM assignments a
      JOIN groups g ON a.group_id = g.id
      JOIN users u ON a.teacher_id = u.id
      WHERE a.id = ?
    `, [id]);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Agar talaba bo'lsa, o'z guruhiga tegishli ekanini tekshiramiz
    if (req.user.role === 'student' && req.user.group_id !== assignment.group_id) {
      return res.status(403).json({ success: false, message: 'Ushbu topshiriq sizning guruhingizga tegishli emas.' });
    }

    // Agar talaba topshirgan bo'lsa, o'sha topshiruv ma'lumotini ham qo'shamiz
    let mySubmission = null;
    if (req.user.role === 'student') {
      mySubmission = await db.getAsync(`
        SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?
      `, [id, req.user.id]);
    }

    return res.json({ success: true, assignment, mySubmission });
  } catch (error) {
    console.error('getAssignmentById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqni yuklashda xatolik yuz berdi.' });
  }
}

async function createAssignment(req, res) {
  try {
    const { title, open_question, group_id } = req.body;
    let content = req.body.content || '';
    const teacher_id = req.user.id;

    if (!title || !open_question || !group_id) {
      return res.status(400).json({ success: false, message: 'Topshiriq nomi, savol va akademik guruh kiritilishi shart.' });
    }

    let filePath = null;
    let fileName = null;
    let fileSize = null;

    // Agar fayl yuklangan bo'lsa (DOCX, PDF, PPTX va h.k.)
    if (req.file) {
      filePath = '/uploads/' + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;

      // Agar o'qituvchi content kiritmagan bo'lsa, fayldan matnni ajratib olamiz
      if (!content || content.trim().length === 0) {
        try {
          const extracted = await extractTextFromFile(req.file.path, req.file.originalname);
          if (extracted && extracted.trim().length > 0) {
            content = extracted.trim();
          }
        } catch (parseErr) {
          console.warn('Fayldan matn ajratishda ogohlantirish:', parseErr.message);
        }
      }
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mavzu nazariy matnini kiriting yoki nazariy ma\'lumot faylini (PDF, DOCX, PPTX) yuklang.' 
      });
    }

    // Guruh mavjudligini tekshirish
    const group = await db.getAsync('SELECT id FROM groups WHERE id = ?', [group_id]);
    if (!group) {
      return res.status(400).json({ success: false, message: 'Tanlangan guruh topilmadi.' });
    }

    const result = await db.runAsync(`
      INSERT INTO assignments (teacher_id, group_id, title, content, open_question, file_path, file_name, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [teacher_id, group_id, title.trim(), content.trim(), open_question.trim(), filePath, fileName, fileSize]);

    const newAssignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [result.lastID]);

    return res.status(201).json({
      success: true,
      message: 'Topshiriq muvaffaqiyatli yaratildi!',
      assignment: newAssignment
    });
  } catch (error) {
    console.error('createAssignment xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriq yaratishda xatolik yuz berdi.' });
  }
}

async function extractTextOnly(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tanlanmadi.' });
    }

    const text = await extractTextFromFile(req.file.path, req.file.originalname);
    const wordCount = (text || '').split(/\s+/).filter(w => w.length > 0).length;

    return res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: '/uploads/' + req.file.filename,
      extractedText: text,
      wordCount: wordCount
    });
  } catch (error) {
    console.error('extractTextOnly xatosi:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Fayldan matnni ajratishda xatolik: ' + error.message 
    });
  }
}

async function deleteAssignment(req, res) {
  try {
    const { id } = req.params;
    const assignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Faqat o'qituvchining o'zi yoki admin o'chira oladi
    if (req.user.role !== 'admin' && assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Siz faqat o\'zingiz yaratgan topshiriqni o\'chira olasiz.' });
    }

    // Faylni o'chirish (agar mavjud bo'lsa)
    if (assignment.file_path) {
      const fullPath = path.resolve(__dirname, '../../', assignment.file_path.replace(/^\//, ''));
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }

    await db.runAsync('DELETE FROM assignments WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Topshiriq muvaffaqiyatli o\'chirildi.' });
  } catch (error) {
    console.error('deleteAssignment xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqni o\'chirishda xatolik yuz berdi.' });
  }
}

module.exports = {
  getAssignments,
  getAssignmentById,
  createAssignment,
  extractTextOnly,
  deleteAssignment
};
