const { db } = require('../config/database');
const { extractTextFromFile } = require('../services/documentParser');
const fs = require('fs');
const path = require('path');

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
          a.id, a.title, a.subject, a.content, a.open_question, a.instructions, a.start_date, a.due_date,
          a.total_points, a.has_dynamic_questions,
          a.file_path, a.file_name, a.file_size, a.created_at,
          g.name as group_name,
          u.name as teacher_name,
          s.id as submission_id,
          s.status as submission_status,
          s.recommended_score,
          s.teacher_score,
          s.total_score,
          s.max_score,
          s.submitted_at,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id) as question_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'closed') as closed_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'open') as open_count
        FROM assignments a
        JOIN groups g ON a.group_id = g.id
        JOIN users u ON a.teacher_id = u.id
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
        WHERE a.group_id = ?
        ORDER BY a.id DESC
      `, [user.id, user.group_id]);

      return res.json({ success: true, assignments });
    }

    // O'qituvchi bo'lsa: O'zi yaratgan topshiriqlar va to'liq statistika
    if (user.role === 'teacher') {
      const assignments = await db.allAsync(`
        SELECT 
          a.id, a.title, a.subject, a.content, a.open_question, a.instructions, a.start_date, a.due_date,
          a.total_points, a.has_dynamic_questions,
          a.file_path, a.file_name, a.file_size, a.created_at, a.group_id,
          g.name as group_name,
          (SELECT COUNT(*) FROM users st WHERE st.group_id = a.group_id AND st.role = 'student') as total_students,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) as total_submissions,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status = 'reviewed') as pending_review_count,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status = 'graded') as graded_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id) as question_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'closed') as closed_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'open') as open_count
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
        a.id, a.title, a.subject, a.content, a.open_question, a.instructions, a.start_date, a.due_date,
        a.total_points, a.has_dynamic_questions,
        a.file_path, a.file_name, a.file_size, a.created_at, a.group_id,
        g.name as group_name,
        u.name as teacher_name,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) as total_submissions,
        (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id) as question_count,
        (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'closed') as closed_count,
        (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'open') as open_count
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
    const isStudent = req.user.role === 'student';

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
    if (isStudent && req.user.group_id !== assignment.group_id) {
      return res.status(403).json({ success: false, message: 'Ushbu topshiriq sizning guruhingizga tegishli emas.' });
    }

    // Savollarni yuklash
    const rawQuestions = await db.allAsync(`
      SELECT * FROM assignment_questions 
      WHERE assignment_id = ? 
      ORDER BY order_index ASC, id ASC
    `, [id]);

    const questions = [];
    for (const q of rawQuestions) {
      const qObj = { ...q };

      if (q.question_type === 'closed') {
        // Variantlarni olish
        const options = await db.allAsync(`
          SELECT id, question_id, option_key, option_text, is_correct, order_index 
          FROM question_options 
          WHERE question_id = ? 
          ORDER BY order_index ASC, id ASC
        `, [q.id]);

        if (isStudent) {
          // XAVFSIZLIK: Talabaga to'g'ri javob ko'rsatilmaydi!
          qObj.options = options.map(opt => ({
            id: opt.id,
            question_id: opt.question_id,
            option_key: opt.option_key,
            option_text: opt.option_text,
            order_index: opt.order_index
          }));
        } else {
          // O'qituvchi va admin uchun to'liq
          qObj.options = options;
        }
      } else {
        // Ochiq savol
        if (isStudent) {
          // XAVFSIZLIK: Namunaviy javob va ichki baholash mezonlari talabadan sir saqlanadi!
          delete qObj.sample_answer;
        }
      }

      questions.push(qObj);
    }

    assignment.questions = questions;

    // Agar talaba topshirgan bo'lsa, topshiruv ma'lumoti va javoblarini qo'shamiz
    let mySubmission = null;
    if (isStudent) {
      mySubmission = await db.getAsync(`
        SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?
      `, [id, req.user.id]);

      if (mySubmission) {
        const answers = await db.allAsync(`
          SELECT 
            sa.*,
            q.question_type,
            q.question_text,
            q.points as question_points,
            qo.option_key as selected_option_key,
            qo.option_text as selected_option_text
          FROM submission_answers sa
          JOIN assignment_questions q ON sa.question_id = q.id
          LEFT JOIN question_options qo ON sa.selected_option_id = qo.id
          WHERE sa.submission_id = ?
          ORDER BY q.order_index ASC, q.id ASC
        `, [mySubmission.id]);

        mySubmission.answers = answers.map(ans => {
          let parsedFeedback = null;
          try {
            parsedFeedback = ans.ai_feedback ? JSON.parse(ans.ai_feedback) : null;
          } catch (e) {
            parsedFeedback = ans.ai_feedback;
          }
          return {
            ...ans,
            ai_feedback: parsedFeedback
          };
        });
      }
    }

    return res.json({ success: true, assignment, mySubmission });
  } catch (error) {
    console.error('getAssignmentById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqni yuklashda xatolik yuz berdi.' });
  }
}

async function createAssignment(req, res) {
  try {
    const { title, subject, group_id, instructions, start_date, due_date } = req.body;
    let content = req.body.content || '';
    let open_question = req.body.open_question || '';
    const teacher_id = req.user.id;

    if (!title || !group_id) {
      return res.status(400).json({ success: false, message: 'Topshiriq nomi va akademik guruh kiritilishi shart.' });
    }

    // Guruh mavjudligini tekshirish
    const group = await db.getAsync('SELECT id FROM groups WHERE id = ?', [group_id]);
    if (!group) {
      return res.status(400).json({ success: false, message: 'Tanlangan guruh topilmadi.' });
    }

    // Savollar ro'yxatini qayta ishlash
    let questions = req.body.questions;
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        questions = [];
      }
    }

    const hasDynamicQuestions = Array.isArray(questions) && questions.length > 0;

    // Fayl bilan ishlash
    let filePath = null;
    let fileName = null;
    let fileSize = null;

    if (req.file) {
      filePath = '/uploads/' + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;

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

    // Validatsiya
    if (!content || content.trim().length === 0) {
      content = "Mavzu bo'yicha mustaqil topshiriq materiallari.";
    }

    let totalPoints = 0;

    if (hasDynamicQuestions) {
      // Dinamik savollarni tekshirish
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text || !q.question_text.trim()) {
          return res.status(400).json({ success: false, message: `${i + 1}-savolning matni kiritilmagan.` });
        }
        if (!['closed', 'open'].includes(q.question_type)) {
          return res.status(400).json({ success: false, message: `${i + 1}-savol turi noto'g'ri (faqat 'closed' yoki 'open').` });
        }

        const pts = Math.max(0.5, parseFloat(q.points) || 1);
        totalPoints += pts;

        if (q.question_type === 'closed') {
          if (!Array.isArray(q.options) || q.options.length < 2) {
            return res.status(400).json({ success: false, message: `${i + 1}-yopiq testda kamida 2 ta javob varianti bo'lishi shart.` });
          }
          const hasCorrect = q.options.some(opt => opt.is_correct === true || opt.is_correct === 1 || opt.is_correct === '1');
          if (!hasCorrect) {
            return res.status(400).json({ success: false, message: `${i + 1}-yopiq testda bitta to'g'ri javob tanlanishi shart.` });
          }
        }
      }

      if (!open_question || !open_question.trim()) {
        const firstOpen = questions.find(q => q.question_type === 'open');
        open_question = firstOpen ? firstOpen.question_text : questions[0].question_text;
      }
    } else {
      // Eski format (bitta ochiq savol)
      if (!open_question || !open_question.trim()) {
        return res.status(400).json({ success: false, message: 'Topshiriq uchun kamida bitta savol kiritilishi shart.' });
      }
      totalPoints = 100;
    }

    // 1. Topshiriqni yaratish
    const result = await db.runAsync(`
      INSERT INTO assignments (
        teacher_id, group_id, title, subject, content, open_question, instructions, start_date, due_date,
        total_points, has_dynamic_questions, file_path, file_name, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      teacher_id,
      group_id,
      title.trim(),
      subject ? subject.trim() : null,
      content.trim(),
      open_question.trim(),
      instructions ? instructions.trim() : null,
      start_date || null,
      due_date || null,
      totalPoints,
      hasDynamicQuestions ? 1 : 0,
      filePath,
      fileName,
      fileSize
    ]);

    const assignmentId = result.lastID;

    // 2. Dinamik savollarni va variantlarini saqlash
    if (hasDynamicQuestions) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const pts = Math.max(0.5, parseFloat(q.points) || 1);

        const qRes = await db.runAsync(`
          INSERT INTO assignment_questions (
            assignment_id, question_type, question_text, points, order_index, instruction, sample_answer
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          assignmentId,
          q.question_type,
          q.question_text.trim(),
          pts,
          i,
          q.instruction ? q.instruction.trim() : null,
          q.sample_answer ? q.sample_answer.trim() : null
        ]);

        const questionId = qRes.lastID;

        if (q.question_type === 'closed' && Array.isArray(q.options)) {
          for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
            const opt = q.options[optIdx];
            const isCorrect = (opt.is_correct === true || opt.is_correct === 1 || opt.is_correct === '1') ? 1 : 0;
            const key = opt.option_key || String.fromCharCode(65 + optIdx);

            await db.runAsync(`
              INSERT INTO question_options (question_id, option_key, option_text, is_correct, order_index)
              VALUES (?, ?, ?, ?, ?)
            `, [
              questionId,
              key,
              (opt.option_text || '').trim(),
              isCorrect,
              optIdx
            ]);
          }
        }
      }
    }

    const newAssignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [assignmentId]);

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

async function updateAssignment(req, res) {
  try {
    const { id } = req.params;
    const assignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [id]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Faqat o'qituvchi o'z topshirig'ini yoki admin tahrirlay oladi
    if (req.user.role !== 'admin' && assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ushbu topshiriqni tahrirlash huquqiga ega emassiz.' });
    }

    const { title, subject, group_id, instructions, start_date, due_date } = req.body;
    let content = req.body.content !== undefined ? req.body.content : assignment.content;
    let open_question = req.body.open_question !== undefined ? req.body.open_question : assignment.open_question;

    let questions = req.body.questions;
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        questions = null;
      }
    }

    // Fayl yangilansa
    let filePath = assignment.file_path;
    let fileName = assignment.file_name;
    let fileSize = assignment.file_size;

    if (req.file) {
      filePath = '/uploads/' + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }

    // Mavjud topshirilgan ishlar soni
    const submissionCount = await db.getAsync('SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ?', [id]);
    const hasSubmissions = submissionCount && submissionCount.count > 0;

    let totalPoints = assignment.total_points || 100;
    let hasDynamic = assignment.has_dynamic_questions;

    // Agar yangi savollar berilgan bo'lsa va hali hech kim topshirmagan bo'lsa, savollarni qayta saqlaymiz
    if (Array.isArray(questions) && questions.length > 0) {
      if (!hasSubmissions) {
        totalPoints = 0;
        // Eski savollar va variantlarni tozalash
        const oldQuestions = await db.allAsync('SELECT id FROM assignment_questions WHERE assignment_id = ?', [id]);
        for (const oq of oldQuestions) {
          await db.runAsync('DELETE FROM question_options WHERE question_id = ?', [oq.id]);
        }
        await db.runAsync('DELETE FROM assignment_questions WHERE assignment_id = ?', [id]);

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const pts = Math.max(0.5, parseFloat(q.points) || 1);
          totalPoints += pts;

          const qRes = await db.runAsync(`
            INSERT INTO assignment_questions (
              assignment_id, question_type, question_text, points, order_index, instruction, sample_answer
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            q.question_type,
            q.question_text.trim(),
            pts,
            i,
            q.instruction ? q.instruction.trim() : null,
            q.sample_answer ? q.sample_answer.trim() : null
          ]);

          if (q.question_type === 'closed' && Array.isArray(q.options)) {
            for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
              const opt = q.options[optIdx];
              const isCorrect = (opt.is_correct === true || opt.is_correct === 1 || opt.is_correct === '1') ? 1 : 0;
              await db.runAsync(`
                INSERT INTO question_options (question_id, option_key, option_text, is_correct, order_index)
                VALUES (?, ?, ?, ?, ?)
              `, [
                qRes.lastID,
                opt.option_key || String.fromCharCode(65 + optIdx),
                (opt.option_text || '').trim(),
                isCorrect,
                optIdx
              ]);
            }
          }
        }
        hasDynamic = 1;
      }
    }

    await db.runAsync(`
      UPDATE assignments SET
        title = ?,
        subject = ?,
        group_id = ?,
        content = ?,
        open_question = ?,
        instructions = ?,
        start_date = ?,
        due_date = ?,
        total_points = ?,
        has_dynamic_questions = ?,
        file_path = ?,
        file_name = ?,
        file_size = ?
      WHERE id = ?
    `, [
      title ? title.trim() : assignment.title,
      subject !== undefined ? (subject ? subject.trim() : null) : assignment.subject,
      group_id ? group_id : assignment.group_id,
      content ? content.trim() : assignment.content,
      open_question ? open_question.trim() : assignment.open_question,
      instructions !== undefined ? (instructions ? instructions.trim() : null) : assignment.instructions,
      start_date !== undefined ? start_date : assignment.start_date,
      due_date !== undefined ? due_date : assignment.due_date,
      totalPoints,
      hasDynamic,
      filePath,
      fileName,
      fileSize,
      id
    ]);

    const updated = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Topshiriq muvaffaqiyatli yangilandi!',
      assignment: updated
    });
  } catch (error) {
    console.error('updateAssignment xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqni yangilashda xatolik yuz berdi.' });
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
  updateAssignment,
  extractTextOnly,
  deleteAssignment
};
