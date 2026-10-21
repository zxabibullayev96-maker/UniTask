const { db } = require('../config/database');
const { extractTextFromFile } = require('../services/documentParser');
const { validateFileHeader, cleanupUploadedFile } = require('../middlewares/uploadMiddleware');
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
          a.total_points, a.has_dynamic_questions, a.attempts_limit, a.time_limit_minutes,
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
          s.attempt_number as my_last_attempt_number,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.student_id = ?) as my_attempts_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id) as question_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'closed') as closed_count,
          (SELECT COUNT(*) FROM assignment_questions q WHERE q.assignment_id = a.id AND q.question_type = 'open') as open_count,
          (SELECT ts.id FROM test_sessions ts WHERE ts.assignment_id = a.id AND ts.student_id = ? AND ts.is_completed = 0 AND (ts.expires_at IS NULL OR ts.expires_at > CURRENT_TIMESTAMP) LIMIT 1) as active_session_id
        FROM assignments a
        JOIN groups g ON a.group_id = g.id
        JOIN users u ON a.teacher_id = u.id
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ? 
          AND s.id = (SELECT subMax.id FROM submissions subMax WHERE subMax.assignment_id = a.id AND subMax.student_id = ? ORDER BY subMax.id DESC LIMIT 1)
        WHERE a.group_id = ?
        ORDER BY a.id DESC
      `, [user.id, user.id, user.id, user.id, user.group_id]);

      // Talaba uchun urinishlar va holatni aniq hisoblash
      const now = new Date();
      const mapped = assignments.map(a => {
        const attemptsLimit = a.attempts_limit || 1;
        const myAttempts = a.my_attempts_count || 0;
        const attemptsLeft = Math.max(0, attemptsLimit - myAttempts);
        const hasActiveSession = Boolean(a.active_session_id);
        const isExpired = a.due_date && new Date(a.due_date) < now;

        let studentStatus = 'not_started';
        if (a.submission_status === 'graded') {
          studentStatus = 'graded';
        } else if (a.submission_status === 'reviewed' || a.submission_status === 'submitted') {
          studentStatus = 'submitted';
        } else if (hasActiveSession) {
          studentStatus = 'in_progress';
        } else if (isExpired && myAttempts === 0) {
          studentStatus = 'expired';
        }

        return {
          ...a,
          attempts_left: attemptsLeft,
          can_attempt: attemptsLeft > 0 && (!isExpired || hasActiveSession),
          has_active_session: hasActiveSession,
          student_status: studentStatus
        };
      });

      return res.json({ success: true, assignments: mapped });
    }

    // O'qituvchi bo'lsa: O'zi yaratgan topshiriqlar va to'liq statistika
    if (user.role === 'teacher') {
      const assignments = await db.allAsync(`
        SELECT 
          a.id, a.title, a.subject, a.content, a.open_question, a.instructions, a.start_date, a.due_date,
          a.total_points, a.has_dynamic_questions, a.attempts_limit, a.time_limit_minutes,
          a.file_path, a.file_name, a.file_size, a.created_at, a.group_id,
          g.name as group_name,
          (SELECT COUNT(*) FROM users st WHERE st.group_id = a.group_id AND st.role = 'student') as total_students,
          (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id) as total_submissions,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status = 'reviewed') as pending_review_count,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.assignment_id = a.id AND sub.status = 'graded') as graded_count,
        (SELECT ROUND(AVG(COALESCE(sub.teacher_score, sub.recommended_score)), 1) FROM submissions sub WHERE sub.assignment_id = a.id) as avg_score,
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
        a.total_points, a.has_dynamic_questions, a.attempts_limit, a.time_limit_minutes,
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
          qObj.options = options;
        }
      } else {
        if (isStudent) {
          // XAVFSIZLIK: Namunaviy javob talabadan sir saqlanadi
          delete qObj.sample_answer;
        }
      }

      questions.push(qObj);
    }

    assignment.questions = questions;

    // Agar talaba bo'lsa, uning topshiruvlari va urinishlar ma'lumotini qo'shamiz
    let mySubmissions = [];
    let myAttemptsCount = 0;
    let attemptsLeft = assignment.attempts_limit || 1;
    let activeSession = null;

    if (isStudent) {
      mySubmissions = await db.allAsync(`
        SELECT * FROM submissions 
        WHERE assignment_id = ? AND student_id = ?
        ORDER BY attempt_number DESC, id DESC
      `, [id, req.user.id]);

      myAttemptsCount = mySubmissions.length;
      attemptsLeft = Math.max(0, (assignment.attempts_limit || 1) - myAttemptsCount);

      // Faol test sessiyasi bormi tekshirish
      activeSession = await db.getAsync(`
        SELECT * FROM test_sessions 
        WHERE assignment_id = ? AND student_id = ? AND is_completed = 0
        ORDER BY id DESC LIMIT 1
      `, [id, req.user.id]);

      if (activeSession && activeSession.expires_at) {
        const now = Date.now();
        const expires = new Date(activeSession.expires_at).getTime();
        activeSession.remaining_seconds = Math.max(0, Math.round((expires - now) / 1000));
        activeSession.is_expired = now > expires;
      }
    }

    return res.json({ 
      success: true, 
      assignment, 
      mySubmission: mySubmissions[0] || null,
      mySubmissions,
      my_attempts_count: myAttemptsCount,
      attempts_left: attemptsLeft,
      can_attempt: attemptsLeft > 0,
      activeSession
    });
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

    // Urinishlar soni validatsiyasi
    let attemptsLimit = 1;
    if (req.body.attempts_limit !== undefined && req.body.attempts_limit !== null && req.body.attempts_limit !== '') {
      const parsedAttempts = parseInt(req.body.attempts_limit, 10);
      if (isNaN(parsedAttempts) || parsedAttempts < 1) {
        return res.status(400).json({ success: false, message: 'Urinishlar soni kamida 1 bo\'lishi shart.' });
      }
      attemptsLimit = parsedAttempts;
    }

    // Test vaqti (daqiqa) validatsiyasi
    let timeLimitMinutes = null;
    if (req.body.time_limit_minutes !== undefined && req.body.time_limit_minutes !== null && req.body.time_limit_minutes !== '') {
      const parsedTime = parseInt(req.body.time_limit_minutes, 10);
      if (isNaN(parsedTime) || parsedTime < 1) {
        return res.status(400).json({ success: false, message: 'Test vaqti kamida 1 daqiqa bo\'lishi shart.' });
      }
      timeLimitMinutes = parsedTime;
    }

    // Guruh mavjudligini tekshirish
    const group = await db.getAsync('SELECT id FROM groups WHERE id = ?', [group_id]);
    if (!group) {
      return res.status(400).json({ success: false, message: 'Tanlangan guruh topilmadi.' });
    }

    // O'qituvchi faqat o'ziga biriktirilgan guruhga topshiriq yarata oladi
    if (req.user.role === 'teacher') {
      const assignedCountRow = await db.getAsync('SELECT COUNT(*) as count FROM group_teachers WHERE teacher_id = ?', [teacher_id]);
      if (assignedCountRow && assignedCountRow.count > 0) {
        const isAssigned = await db.getAsync('SELECT id FROM group_teachers WHERE group_id = ? AND teacher_id = ?', [group_id, teacher_id]);
        if (!isAssigned) {
          return res.status(403).json({ success: false, message: 'Siz faqat o\'zingizga biriktirilgan akademik guruhlar uchun topshiriq yarata olasiz.' });
        }
      }
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
      if (!validateFileHeader(req.file.path, req.file.originalname)) {
        cleanupUploadedFile(req.file.path);
        return res.status(400).json({ success: false, message: 'Yuklangan fayl haqiqiy hujjat formatiga mos kelmadi yoki buzilgan.' });
      }
      filePath = '/uploads/assignments/' + req.file.filename;
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

    if (!content || content.trim().length === 0) {
      content = "Mavzu bo'yicha mustaqil topshiriq materiallari.";
    }

    let totalPoints = 0;

    if (hasDynamicQuestions) {
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
      if (!open_question || !open_question.trim()) {
        return res.status(400).json({ success: false, message: 'Topshiriq uchun kamida bitta savol kiritilishi shart.' });
      }
      totalPoints = 100;
    }

    // 1. Topshiriqni yaratish
    const result = await db.runAsync(`
      INSERT INTO assignments (
        teacher_id, group_id, title, subject, content, open_question, instructions, start_date, due_date,
        total_points, has_dynamic_questions, attempts_limit, time_limit_minutes, file_path, file_name, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      attemptsLimit,
      timeLimitMinutes,
      filePath,
      fileName,
      fileSize
    ]);

    const assignmentId = result.lastID;

    // 2. Dinamik savollarni saqlash
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
    if (req.file) cleanupUploadedFile(req.file.path);
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

    if (req.user.role !== 'admin' && assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ushbu topshiriqni tahrirlash huquqiga ega emassiz.' });
    }

    const { title, subject, group_id, instructions, start_date, due_date } = req.body;
    let content = req.body.content !== undefined ? req.body.content : assignment.content;
    let open_question = req.body.open_question !== undefined ? req.body.open_question : assignment.open_question;

    // Agar guruh o'zgartirilayotgan bo'lsa, o'qituvchining huquqini tekshirish
    if (req.user.role === 'teacher' && group_id && parseInt(group_id, 10) !== assignment.group_id) {
      const assignedCountRow = await db.getAsync('SELECT COUNT(*) as count FROM group_teachers WHERE teacher_id = ?', [req.user.id]);
      if (assignedCountRow && assignedCountRow.count > 0) {
        const isAssigned = await db.getAsync('SELECT id FROM group_teachers WHERE group_id = ? AND teacher_id = ?', [group_id, req.user.id]);
        if (!isAssigned) {
          return res.status(403).json({ success: false, message: 'Siz faqat o\'zingizga biriktirilgan akademik guruhlar uchun topshiriqni o\'zgartira olasiz.' });
        }
      }
    }

    // Urinishlar soni yangilash
    let attemptsLimit = assignment.attempts_limit || 1;
    if (req.body.attempts_limit !== undefined && req.body.attempts_limit !== null && req.body.attempts_limit !== '') {
      const parsedAttempts = parseInt(req.body.attempts_limit, 10);
      if (isNaN(parsedAttempts) || parsedAttempts < 1) {
        return res.status(400).json({ success: false, message: 'Urinishlar soni kamida 1 bo\'lishi shart.' });
      }
      attemptsLimit = parsedAttempts;
    }

    // Test vaqti yangilash
    let timeLimitMinutes = assignment.time_limit_minutes;
    if (req.body.time_limit_minutes !== undefined) {
      if (req.body.time_limit_minutes === null || req.body.time_limit_minutes === '') {
        timeLimitMinutes = null;
      } else {
        const parsedTime = parseInt(req.body.time_limit_minutes, 10);
        if (isNaN(parsedTime) || parsedTime < 1) {
          return res.status(400).json({ success: false, message: 'Test vaqti kamida 1 daqiqa bo\'lishi shart.' });
        }
        timeLimitMinutes = parsedTime;
      }
    }

    let questions = req.body.questions;
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        questions = null;
      }
    }

    let filePath = assignment.file_path;
    let fileName = assignment.file_name;
    let fileSize = assignment.file_size;

    if (req.file) {
      if (!validateFileHeader(req.file.path, req.file.originalname)) {
        cleanupUploadedFile(req.file.path);
        return res.status(400).json({ success: false, message: 'Yuklangan fayl haqiqiy hujjat formatiga mos kelmadi yoki buzilgan.' });
      }
      filePath = '/uploads/assignments/' + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }

    const submissionCount = await db.getAsync('SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ?', [id]);
    const hasSubmissions = submissionCount && submissionCount.count > 0;

    let totalPoints = assignment.total_points || 100;
    let hasDynamic = assignment.has_dynamic_questions;

    if (Array.isArray(questions) && questions.length > 0) {
      if (!hasSubmissions) {
        totalPoints = 0;
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
        attempts_limit = ?,
        time_limit_minutes = ?,
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
      attemptsLimit,
      timeLimitMinutes,
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
    if (req.file) cleanupUploadedFile(req.file.path);
    console.error('updateAssignment xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqni yangilashda xatolik yuz berdi.' });
  }
}

async function extractTextOnly(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tanlanmadi.' });
    }
    if (!validateFileHeader(req.file.path, req.file.originalname)) {
      cleanupUploadedFile(req.file.path);
      return res.status(400).json({ success: false, message: 'Yuklangan fayl haqiqiy hujjat formatiga mos kelmadi yoki buzilgan.' });
    }

    const text = await extractTextFromFile(req.file.path, req.file.originalname);
    const wordCount = (text || '').split(/\s+/).filter(w => w.length > 0).length;

    return res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      filePath: '/uploads/assignments/' + req.file.filename,
      extractedText: text,
      wordCount: wordCount
    });
  } catch (error) {
    if (req.file) cleanupUploadedFile(req.file.path);
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

    if (req.user.role !== 'admin' && assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Siz faqat o\'zingiz yaratgan topshiriqni o\'chira olasiz.' });
    }

    const subCountRow = await db.getAsync('SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ?', [id]);
    const subCount = subCountRow ? subCountRow.count : 0;
    if (subCount > 0 && req.query.force !== 'true') {
      return res.status(400).json({
        success: false,
        hasSubmissions: true,
        submissionCount: subCount,
        message: `Ushbu topshiriqqa ${subCount} ta talaba javob topshirgan. O'chirish bilan barcha javoblar va baholar ham yo'qoladi. Baribir o'chirish uchun tasdiqlang.`
      });
    }

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
