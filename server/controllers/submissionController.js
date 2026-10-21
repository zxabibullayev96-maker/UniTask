const path = require('path');
const fs = require('fs');
const { db } = require('../config/database');
const { evaluateStudentAnswer, evaluateOpenQuestion, synthesizeSubmissionReport } = require('../services/aiService');
const { extractTextFromFile } = require('../services/documentParser');
const { validateFileHeader, cleanupUploadedFile } = require('../middlewares/uploadMiddleware');

/**
 * Talaba tomonidan yangi test sessiyasini boshlash (Taymer va urinishlar hisobi)
 */
async function startTestSession(req, res) {
  try {
    const { assignment_id } = req.body;
    const student_id = req.user.id;

    if (!assignment_id) {
      return res.status(400).json({ success: false, message: 'Topshiriq identifikatori kiritilmadi.' });
    }

    const assignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [assignment_id]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    if (req.user.group_id !== assignment.group_id) {
      return res.status(403).json({ success: false, message: 'Siz faqat o\'z guruhingizga berilgan topshiriqni boshlay olasiz.' });
    }

    // Urinishlar sonini tekshirish
    const countRow = await db.getAsync(
      'SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignment_id, student_id]
    );
    const myAttemptsCount = countRow ? countRow.count : 0;
    const attemptsLimit = assignment.attempts_limit || 1;

    if (myAttemptsCount >= attemptsLimit) {
      return res.status(400).json({
        success: false,
        message: `Siz ushbu topshiriq uchun ruxsat etilgan barcha (${attemptsLimit} ta) urinishdan foydalangansiz.`
      });
    }

    // Faol tugatilmagan sessiya mavjudligini tekshirish
    const activeSession = await db.getAsync(`
      SELECT * FROM test_sessions 
      WHERE assignment_id = ? AND student_id = ? AND is_completed = 0
      ORDER BY id DESC LIMIT 1
    `, [assignment_id, student_id]);

    const now = Date.now();

    if (activeSession) {
      if (activeSession.expires_at) {
        const expiresTime = new Date(activeSession.expires_at).getTime();
        if (now > expiresTime) {
          // Vaqti tugagan sessiyani yopamiz
          await db.runAsync('UPDATE test_sessions SET is_completed = 1 WHERE id = ?', [activeSession.id]);
        } else {
          // Faol sessiyani davom ettirish
          const remainingSeconds = Math.max(0, Math.round((expiresTime - now) / 1000));
          let draft = null;
          if (activeSession.draft_answers) {
            try { draft = JSON.parse(activeSession.draft_answers); } catch (e) {}
          }
          return res.json({
            success: true,
            message: 'Mavjud test sessiyasi davom ettirilmoqda.',
            session: {
              ...activeSession,
              remaining_seconds: remainingSeconds,
              is_resumed: true,
              draft
            }
          });
        }
      } else {
        // Cheksiz vaqtli sessiya davom etmoqda
        let draft = null;
        if (activeSession.draft_answers) {
          try { draft = JSON.parse(activeSession.draft_answers); } catch (e) {}
        }
        return res.json({
          success: true,
          message: 'Mavjud test sessiyasi davom ettirilmoqda.',
          session: {
            ...activeSession,
            remaining_seconds: null,
            is_resumed: true,
            draft
          }
        });
      }
    }

    // Yangi test sessiyasini yaratish
    const attemptNumber = myAttemptsCount + 1;
    let expiresAt = null;
    let remainingSeconds = null;

    if (assignment.time_limit_minutes && assignment.time_limit_minutes > 0) {
      const expireDate = new Date(now + assignment.time_limit_minutes * 60 * 1000);
      expiresAt = expireDate.toISOString();
      remainingSeconds = assignment.time_limit_minutes * 60;
    }

    const insertResult = await db.runAsync(`
      INSERT INTO test_sessions (assignment_id, student_id, attempt_number, started_at, expires_at, is_completed)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 0)
    `, [assignment_id, student_id, attemptNumber, expiresAt]);

    const createdSession = await db.getAsync('SELECT * FROM test_sessions WHERE id = ?', [insertResult.lastID]);

    return res.status(201).json({
      success: true,
      message: 'Test sessiyasi muvaffaqiyatli boshlandi.',
      session: {
        ...createdSession,
        remaining_seconds: remainingSeconds,
        is_resumed: false
      }
    });

  } catch (error) {
    console.error('startTestSession xatosi:', error);
    return res.status(500).json({ success: false, message: 'Test sessiyasini boshlashda xatolik yuz berdi.' });
  }
}

/**
 * Talaba tomonidan topshiriq javobini (matn va/yoki fayl) yuborish
 */
async function submitAnswer(req, res) {
  try {
    const { assignment_id, student_answer, answers } = req.body;
    const student_id = req.user.id;

    if (!assignment_id) {
      if (req.file) cleanupUploadedFile(req.file.path);
      return res.status(400).json({ success: false, message: 'Topshiriq identifikatori kiritilmadi.' });
    }

    // Topshiriq mavjudligini tekshirish
    const assignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [assignment_id]);
    if (!assignment) {
      if (req.file) cleanupUploadedFile(req.file.path);
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Talabaning guruhi mos kelishini tekshirish
    if (req.user.group_id !== assignment.group_id) {
      if (req.file) cleanupUploadedFile(req.file.path);
      return res.status(403).json({ success: false, message: 'Siz faqat o\'z guruhingizga berilgan topshiriqlarni topshira olasiz.' });
    }

    // Urinishlar soni cheklovi tekshiruvi
    const countRow = await db.getAsync(
      'SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignment_id, student_id]
    );
    const currentAttempts = countRow ? countRow.count : 0;
    const maxAttempts = assignment.attempts_limit || 1;

    if (currentAttempts >= maxAttempts) {
      if (req.file) cleanupUploadedFile(req.file.path);
      return res.status(400).json({ 
        success: false, 
        message: `Siz ushbu topshiriq uchun ruxsat etilgan barcha (${maxAttempts} ta) urinishdan foydalangansiz.` 
      });
    }

    const attemptNumber = currentAttempts + 1;

    // Test sessiyasi va taymer tekshiruvi (Server-side time enforcement)
    const activeSession = await db.getAsync(`
      SELECT * FROM test_sessions 
      WHERE assignment_id = ? AND student_id = ? AND is_completed = 0
      ORDER BY id DESC LIMIT 1
    `, [assignment_id, student_id]);

    let startedAt = activeSession ? activeSession.started_at : new Date().toISOString();

    if (activeSession && activeSession.expires_at) {
      const expiresTime = new Date(activeSession.expires_at).getTime();
      // Tarmoq kechikishlari uchun 30 soniya bufer vaqt
      if (Date.now() > expiresTime + 30000) {
        if (req.file) cleanupUploadedFile(req.file.path);
        await db.runAsync('UPDATE test_sessions SET is_completed = 1 WHERE id = ?', [activeSession.id]);
        return res.status(400).json({
          success: false,
          message: 'Ajratilgan test vaqti tugagan. Natija qabul qilinmadi.'
        });
      }
    }

    // Yuklangan faylni tekshirish va matn ajratib olish
    let filePath = null;
    let fileName = null;
    let fileSize = null;
    let extractedFileText = '';

    if (req.file) {
      if (!validateFileHeader(req.file.path, req.file.originalname)) {
        cleanupUploadedFile(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Yuklangan fayl haqiqiy hujjat formatiga (PDF, DOCX, DOC, PPTX, PPT, TXT) mos kelmadi yoki buzilgan.'
        });
      }

      filePath = '/uploads/submissions/' + req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;

      try {
        extractedFileText = await extractTextFromFile(req.file.path, req.file.originalname);
      } catch (parseErr) {
        console.warn('Talaba faylidan matn ajratishda ogohlantirish:', parseErr.message);
      }
    }

    // Dinamik savollar mavjudligini tekshirish
    const questions = await db.allAsync(`
      SELECT * FROM assignment_questions 
      WHERE assignment_id = ? 
      ORDER BY order_index ASC, id ASC
    `, [assignment_id]);

    const isDynamic = assignment.has_dynamic_questions === 1 || questions.length > 0;

    if (isDynamic) {
      // Dinamik savollarga berilgan javoblarni tekshiramiz
      let studentAnswersList = answers;
      if (typeof studentAnswersList === 'string') {
        try {
          studentAnswersList = JSON.parse(studentAnswersList);
        } catch (e) {
          studentAnswersList = [];
        }
      }
      if (!Array.isArray(studentAnswersList)) {
        studentAnswersList = [];
      }

      // Xarita: question_id -> javob
      const answerMap = {};
      studentAnswersList.forEach(a => {
        if (a && a.question_id) {
          answerMap[a.question_id] = a;
        }
      });

      let totalMaxPoints = 0;
      let totalEarnedPoints = 0;
      let evaluatedAnswers = [];
      let anyAiFailed = false;

      // Har bir savolni navbat bilan tekshirish
      for (const q of questions) {
        const qPoints = Math.max(0.5, parseFloat(q.points) || 1);
        totalMaxPoints += qPoints;

        const givenAnswer = answerMap[q.id] || {};

        if (q.question_type === 'closed') {
          // Yopiq testni tekshirish
          const selectedOptionId = givenAnswer.selected_option_id ? parseInt(givenAnswer.selected_option_id, 10) : null;
          let isCorrect = 0;
          let earned = 0;
          let selectedOptionText = null;

          if (selectedOptionId) {
            const chosenOption = await db.getAsync(
              'SELECT id, option_key, option_text, is_correct FROM question_options WHERE id = ? AND question_id = ?',
              [selectedOptionId, q.id]
            );

            if (chosenOption) {
              selectedOptionText = chosenOption.option_text;
              if (chosenOption.is_correct === 1) {
                isCorrect = 1;
                earned = qPoints;
              }
            }
          }

          totalEarnedPoints += earned;

          evaluatedAnswers.push({
            question_id: q.id,
            selected_option_id: selectedOptionId,
            answer_text: selectedOptionText,
            is_correct: isCorrect,
            ai_score: earned,
            teacher_score: earned, // Yopiq test uchun boshlang'ich baho
            ai_feedback: JSON.stringify({
              is_correct: isCorrect === 1,
              score: earned,
              max_score: qPoints,
              summary: isCorrect === 1 ? "To'g'ri javob tanlandi." : "Noto'g'ri javob tanlandi.",
              strengths: isCorrect === 1 ? "Variant to'g'ri belgilangan." : "",
              gaps: isCorrect === 0 ? "Noto'g'ri javob belgilangan." : "",
              suggestions: isCorrect === 1 ? "Ajoyib natija!" : "Mavzu bo'yicha test savollarini qayta ko'rib chiqing."
            })
          });

        } else if (q.question_type === 'open') {
          // Ochiq savolni AI yordamida tekshirish (matn + yuklangan fayl)
          const ansText = (givenAnswer.answer_text || '').trim();

          let aiResult;
          try {
            aiResult = await evaluateOpenQuestion({
              theoryContent: assignment.content,
              question: q.question_text,
              instruction: q.instruction,
              sampleAnswer: q.sample_answer,
              studentAnswer: ansText,
              fileText: extractedFileText,
              maxScore: qPoints
            });
          } catch (aiErr) {
            console.error(`AI baholash xatosi (${q.id}-savol):`, aiErr);
            anyAiFailed = true;
            aiResult = {
              score: 0,
              max_score: qPoints,
              summary: "Sun'iy intellekt tahlili navbatda kutmoqda.",
              strengths: "Javob qabul qilindi.",
              gaps: "AI tahlili amalga oshirilmadi, o'qituvchi tomonidan ko'rib chiqiladi.",
              suggestions: "O'qituvchi bahosini kuting.",
              source: 'pending-error'
            };
          }

          const qScore = Math.min(qPoints, Math.max(0, parseFloat(aiResult.score) || 0));
          totalEarnedPoints += qScore;

          evaluatedAnswers.push({
            question_id: q.id,
            selected_option_id: null,
            answer_text: ansText,
            is_correct: null,
            ai_score: qScore,
            teacher_score: null, // O'qituvchi tasdiqlashi uchun kutmoqda
            ai_feedback: JSON.stringify(aiResult)
          });
        }
      }

      // 100 ballik shkaladagi tavsiya ball
      const normalizedPercent = totalMaxPoints > 0 ? Math.round((totalEarnedPoints / totalMaxPoints) * 100) : 0;
      const status = anyAiFailed ? 'pending' : 'reviewed';

      // Butun topshiriq bo'yicha tahliliy hisobotni sintez qilish
      const synthesis = synthesizeSubmissionReport({
        assignment,
        questions,
        evaluatedAnswers,
        fileText: extractedFileText
      });

      // 1. Submissions jadvaliga yozish
      const insertSub = await db.runAsync(`
        INSERT INTO submissions (
          assignment_id, student_id, student_answer,
          ai_summary, ai_gaps, recommended_score, total_score, max_score, status,
          file_path, file_name, file_size, attempt_number, started_at, ai_report
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        assignment_id,
        student_id,
        (student_answer || '').trim() || (fileName ? `[Yuklangan fayl: ${fileName}]` : ''),
        synthesis.summary,
        synthesis.gaps,
        synthesis.recommended_score,
        synthesis.total_score,
        synthesis.max_score,
        status,
        filePath,
        fileName,
        fileSize,
        attemptNumber,
        startedAt,
        synthesis.ai_report
      ]);

      const submissionId = insertSub.lastID;

      // 2. submission_answers jadvaliga har bir savol javobini yozish
      for (const ev of evaluatedAnswers) {
        await db.runAsync(`
          INSERT INTO submission_answers (
            submission_id, question_id, selected_option_id, answer_text,
            is_correct, ai_score, ai_feedback, teacher_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          submissionId,
          ev.question_id,
          ev.selected_option_id,
          ev.answer_text,
          ev.is_correct,
          ev.ai_score,
          ev.ai_feedback,
          ev.teacher_score
        ]);
      }

      // 3. Test sessiyasini yakunlangan deb belgilash
      if (activeSession) {
        await db.runAsync('UPDATE test_sessions SET is_completed = 1 WHERE id = ?', [activeSession.id]);
      }

      const createdSubmission = await db.getAsync(`
        SELECT s.*, a.title as assignment_title 
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        WHERE s.id = ?
      `, [submissionId]);

      return res.status(201).json({
        success: true,
        message: status === 'reviewed' 
          ? `Javoblaringiz qabul qilindi va AI tomonidan baholandi! (Urinish ${attemptNumber}/${maxAttempts})` 
          : `Javoblaringiz qabul qilindi, AI tahlili navbatda kutmoqda. (Urinish ${attemptNumber}/${maxAttempts})`,
        submission: createdSubmission
      });

    } else {
      // Eski formatdagi topshiriq (bitta umumiy javob yoki hujjat)
      const rawAnswer = (student_answer || '').trim();
      if (!rawAnswer && !extractedFileText) {
        if (req.file) cleanupUploadedFile(req.file.path);
        return res.status(400).json({ success: false, message: 'Javob matni yoki hujjat fayli kiritilishi shart.' });
      }

      let aiResult;
      let status = 'reviewed';

      try {
        aiResult = await evaluateStudentAnswer({
          theoryContent: assignment.content,
          question: assignment.open_question,
          studentAnswer: rawAnswer,
          fileText: extractedFileText
        });
      } catch (aiErr) {
        console.error('AI baholashda uzilish:', aiErr);
        status = 'pending';
        aiResult = {
          summary: 'Sun\'iy intellekt tahlili navbatda kutilmoqda yoki tarmoq uzilishi tufayli kechikmoqda.',
          gaps: 'Tahlil natijasi o\'qituvchi tomonidan qo\'lda ko\'rib chiqiladi.',
          recommended_score: null
        };
      }

      const storedAnswer = rawAnswer || (fileName ? `[Yuklangan fayl: ${fileName}]` : '');

      let synthesisReport = null;
      if (status !== 'pending' && aiResult) {
        synthesisReport = JSON.stringify({
          mastery_level: (aiResult.recommended_score >= 85 ? "Yuqori (A'lo)" : (aiResult.recommended_score >= 70 ? "O'rta (Yaxshi)" : "Boshlang'ich")),
          score_percent: aiResult.recommended_score || 0,
          summary: aiResult.summary,
          recommendations: [aiResult.suggestions || "Mavzuni yanada chuqurroq mustahkamlang."],
          needs_manual_review: Boolean(aiResult.needs_manual_review),
          source: aiResult.source || 'openai-gpt-4o-mini'
        });
      }

      const insertResult = await db.runAsync(`
        INSERT INTO submissions (
          assignment_id, student_id, student_answer, 
          ai_summary, ai_gaps, recommended_score, total_score, max_score, status,
          file_path, file_name, file_size, attempt_number, started_at, ai_report
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        assignment_id,
        student_id,
        storedAnswer,
        aiResult.summary,
        aiResult.gaps,
        aiResult.recommended_score,
        aiResult.recommended_score,
        100,
        status,
        filePath,
        fileName,
        fileSize,
        attemptNumber,
        startedAt,
        synthesisReport
      ]);

      if (activeSession) {
        await db.runAsync('UPDATE test_sessions SET is_completed = 1 WHERE id = ?', [activeSession.id]);
      }

      const createdSubmission = await db.getAsync(`
        SELECT s.*, a.title as assignment_title 
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        WHERE s.id = ?
      `, [insertResult.lastID]);

      return res.status(201).json({
        success: true,
        message: status === 'reviewed' 
          ? `Javobingiz qabul qilindi va AI tomonidan tahlil qilindi! (Urinish ${attemptNumber}/${maxAttempts})` 
          : `Javobingiz qabul qilindi, AI tahlili navbatda kutmoqda. (Urinish ${attemptNumber}/${maxAttempts})`,
        submission: createdSubmission
      });
    }

  } catch (error) {
    if (req.file) cleanupUploadedFile(req.file.path);
    console.error('submitAnswer xatosi:', error);
    return res.status(500).json({ success: false, message: 'Javobni topshirishda server xatoligi yuz berdi.' });
  }
}

/**
 * Talabaning o'z topshirgan ishlari ro'yxati
 */
async function getMySubmissions(req, res) {
  try {
    const student_id = req.user.id;
    const submissions = await db.allAsync(`
      SELECT 
        s.*, 
        a.title as assignment_title, 
        a.open_question,
        a.subject,
        a.total_points as assignment_total_points,
        a.has_dynamic_questions,
        a.attempts_limit,
        a.time_limit_minutes,
        u.name as teacher_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON a.teacher_id = u.id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC
    `, [student_id]);

    return res.json({ success: true, submissions });
  } catch (error) {
    console.error('getMySubmissions xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshiriqlarni olishda xatolik yuz berdi.' });
  }
}

/**
 * Topshiriq bo'yicha barcha yuborilgan javoblarni olish (O'qituvchi va Admin)
 */
async function getAssignmentSubmissions(req, res) {
  try {
    const { assignmentId } = req.params;
    const assignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [assignmentId]);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Faqat o'qituvchi o'z topshirig'ini yoki admin ko'ra oladi
    if (req.user.role !== 'admin' && assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ushbu topshiriq natijalarini ko\'rish huquqiga ega emassiz.' });
    }

    const submissions = await db.allAsync(`
      SELECT 
        s.*, 
        u.name as student_name, 
        u.email as student_email,
        g.name as group_name
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      LEFT JOIN groups g ON u.group_id = g.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `, [assignmentId]);

    return res.json({ success: true, assignment, submissions });
  } catch (error) {
    console.error('getAssignmentSubmissions xatosi:', error);
    return res.status(500).json({ success: false, message: 'Natijalarni olishda xatolik yuz berdi.' });
  }
}

/**
 * Bitta topshirilgan ishning to'liq tafsiloti
 */
async function getSubmissionById(req, res) {
  try {
    const { id } = req.params;
    const isStudent = req.user.role === 'student';

    const submission = await db.getAsync(`
      SELECT 
        s.*, 
        a.title as assignment_title, 
        a.subject as assignment_subject,
        a.content as theory_content,
        a.open_question,
        a.instructions as assignment_instructions,
        a.total_points as assignment_total_points,
        a.has_dynamic_questions,
        a.teacher_id,
        u.name as student_name,
        u.email as student_email,
        g.name as group_name,
        t.name as teacher_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON s.student_id = u.id
      LEFT JOIN groups g ON u.group_id = g.id
      JOIN users t ON a.teacher_id = t.id
      WHERE s.id = ?
    `, [id]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Javob topilmadi.' });
    }

    // Huquq tekshiruvi: faqat topshirgan talaba, o'sha topshiriq o'qituvchisi yoki admin ko'ra oladi
    if (isStudent && submission.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ushbu natijani ko\'rish huquqi yo\'q.' });
    }
    if (req.user.role === 'teacher' && submission.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu boshqa o\'qituvchining topshirig\'i.' });
    }

    // submission_answers jadvalidan har bir savol javobini olish
    const rawAnswers = await db.allAsync(`
      SELECT 
        sa.*,
        q.question_type,
        q.question_text,
        q.points as question_points,
        q.instruction as question_instruction,
        q.sample_answer as question_sample_answer,
        q.order_index,
        qo.option_key as selected_option_key,
        qo.option_text as selected_option_text
      FROM submission_answers sa
      JOIN assignment_questions q ON sa.question_id = q.id
      LEFT JOIN question_options qo ON sa.selected_option_id = qo.id
      WHERE sa.submission_id = ?
      ORDER BY q.order_index ASC, q.id ASC
    `, [id]);

    const answers = [];
    for (const ans of rawAnswers) {
      const aObj = { ...ans };

      let parsedFeedback = null;
      try {
        parsedFeedback = aObj.ai_feedback ? JSON.parse(aObj.ai_feedback) : null;
      } catch (e) {
        parsedFeedback = aObj.ai_feedback;
      }
      aObj.ai_feedback = parsedFeedback;

      if (aObj.question_type === 'closed') {
        const allOpts = await db.allAsync(`
          SELECT id, option_key, option_text, is_correct 
          FROM question_options 
          WHERE question_id = ? 
          ORDER BY order_index ASC, id ASC
        `, [ans.question_id]);

        if (isStudent && submission.status !== 'graded') {
          // Baholanmagan bo'lsa to'g'ri variant sir saqlanadi
          aObj.options = allOpts.map(o => ({ id: o.id, option_key: o.option_key, option_text: o.option_text }));
        } else {
          aObj.options = allOpts;
        }
      }

      if (isStudent && submission.status !== 'graded') {
        delete aObj.question_sample_answer;
      }

      answers.push(aObj);
    }

    submission.answers = answers;

    let parsedReport = null;
    try {
      parsedReport = submission.ai_report ? JSON.parse(submission.ai_report) : null;
    } catch (e) {
      parsedReport = null;
    }
    submission.ai_report = parsedReport;

    return res.json({ success: true, submission });
  } catch (error) {
    console.error('getSubmissionById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Javob tafsilotini yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Talaba yuklagan javob faylini xavfsiz yuklab olish
 * Faqat topshirgan talabaning o'zi, topshiriq egasi (o'qituvchi) yoki admin yuklay oladi.
 */
async function downloadSubmissionFile(req, res) {
  try {
    const { id } = req.params;

    const submission = await db.getAsync(`
      SELECT s.id, s.file_path, s.file_name, s.student_id, a.teacher_id 
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ?
    `, [id]);

    if (!submission || !submission.file_path) {
      return res.status(404).json({ success: false, message: 'Biriktirilgan fayl topilmadi.' });
    }

    const isStudentOwner = req.user.role === 'student' && req.user.id === submission.student_id;
    const isTeacherOwner = req.user.role === 'teacher' && req.user.id === submission.teacher_id;
    const isAdmin = req.user.role === 'admin';

    if (!isStudentOwner && !isTeacherOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Ushbu faylni yuklab olish huquqiga ega emassiz.' });
    }

    const fullPath = path.resolve(__dirname, '../../', submission.file_path.replace(/^\//, ''));
    const safeBaseDir = path.resolve(__dirname, '../../uploads');
    if (!fullPath.startsWith(safeBaseDir)) {
      return res.status(403).json({ success: false, message: 'Ruxsat etilmagan fayl yo\'li.' });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'Fayl server diskida topilmadi.' });
    }

    const downloadName = submission.file_name || path.basename(fullPath);
    return res.download(fullPath, downloadName);

  } catch (error) {
    console.error('downloadSubmissionFile xatosi:', error);
    return res.status(500).json({ success: false, message: 'Faylni yuklab olishda xatolik yuz berdi.' });
  }
}

/**
 * O'qituvchi tomonidan ishni qo'lda baholash va tasdiqlash
 */
async function gradeSubmission(req, res) {
  try {
    const { id } = req.params;
    const { teacher_score, teacher_feedback, question_grades } = req.body;

    const submission = await db.getAsync(`
      SELECT s.*, a.teacher_id, a.total_points, a.has_dynamic_questions 
      FROM submissions s 
      JOIN assignments a ON s.assignment_id = a.id 
      WHERE s.id = ?
    `, [id]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Javob topilmadi.' });
    }

    // Faqat o'qituvchining o'zi yoki admin baholay oladi
    if (req.user.role !== 'admin' && submission.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Baholash huquqiga ega emassiz.' });
    }

    let finalScore = 0;
    let finalFeedback = (teacher_feedback || '').trim();

    // Agar o'qituvchi har bir savol bo'yicha alohida baho yuborgan bo'lsa
    let gradesList = question_grades;
    if (typeof gradesList === 'string') {
      try { gradesList = JSON.parse(gradesList); } catch (e) { gradesList = null; }
    }

    if (Array.isArray(gradesList) && gradesList.length > 0) {
      let sumPoints = 0;
      for (const g of gradesList) {
        const qScore = Math.max(0, parseFloat(g.teacher_score) || 0);
        sumPoints += qScore;

        await db.runAsync(`
          UPDATE submission_answers 
          SET teacher_score = ?, teacher_feedback = ?
          WHERE submission_id = ? AND question_id = ?
        `, [qScore, (g.teacher_feedback || '').trim(), id, g.question_id]);
      }
      finalScore = sumPoints;
    } else {
      const scoreNum = parseFloat(teacher_score);
      if (isNaN(scoreNum) || scoreNum < 0) {
        return res.status(400).json({ success: false, message: 'Baho 0 dan kam bo\'lmasligi shart.' });
      }
      finalScore = scoreNum;
    }

    const maxAllowed = submission.max_score || submission.total_points || 100;
    if (finalScore > maxAllowed) {
      return res.status(400).json({ success: false, message: `Baho maksimal balldan (${maxAllowed}) oshmasligi shart.` });
    }

    await db.runAsync(`
      UPDATE submissions 
      SET teacher_score = ?, teacher_feedback = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [finalScore, finalFeedback, id]);

    const updated = await db.getAsync('SELECT * FROM submissions WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Baho muvaffaqiyatli tasdiqlandi!',
      submission: updated
    });
  } catch (error) {
    console.error('gradeSubmission xatosi:', error);
    return res.status(500).json({ success: false, message: 'Baholashda xatolik yuz berdi.' });
  }
}

/**
 * Topshirilgan ishni AI yordamida qayta tahlil qilish
 */
async function reanalyzeSubmission(req, res) {
  try {
    const { id } = req.params;
    const submission = await db.getAsync(`
      SELECT s.*, a.content as theory_content, a.open_question, a.teacher_id, a.has_dynamic_questions, a.total_points
      FROM submissions s 
      JOIN assignments a ON s.assignment_id = a.id 
      WHERE s.id = ?
    `, [id]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Javob topilmadi.' });
    }

    if (req.user.role !== 'admin' && submission.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat berilmadi.' });
    }

    // Fayldan matn ajratish (agar yuklangan bo'lsa)
    let extractedFileText = '';
    if (submission.file_path) {
      const fullPath = path.resolve(__dirname, '../../', submission.file_path.replace(/^\//, ''));
      if (fs.existsSync(fullPath)) {
        try {
          extractedFileText = await extractTextFromFile(fullPath, submission.file_name);
        } catch (e) {
          console.warn('reanalyzeSubmission: fayldan matn ajratib bo\'lmadi:', e.message);
        }
      }
    }

    const subAnswers = await db.allAsync(`
      SELECT sa.*, q.question_type, q.question_text, q.points as question_points, q.instruction, q.sample_answer
      FROM submission_answers sa
      JOIN assignment_questions q ON sa.question_id = q.id
      WHERE sa.submission_id = ?
    `, [id]);

    if (subAnswers.length > 0) {
      let totalEarned = 0;
      let totalMax = 0;
      const updatedAnswers = [];

      for (const sa of subAnswers) {
        const qPts = Math.max(0.5, parseFloat(sa.question_points) || 1);
        totalMax += qPts;

        if (sa.question_type === 'closed') {
          const earned = sa.is_correct === 1 ? qPts : 0;
          totalEarned += earned;
          updatedAnswers.push({
            question_id: sa.question_id,
            is_correct: sa.is_correct,
            ai_score: earned,
            ai_feedback: sa.ai_feedback
          });
        } else if (sa.question_type === 'open') {
          const aiRes = await evaluateOpenQuestion({
            theoryContent: submission.theory_content,
            question: sa.question_text,
            instruction: sa.instruction,
            sampleAnswer: sa.sample_answer,
            studentAnswer: sa.answer_text,
            fileText: extractedFileText,
            maxScore: qPts
          });

          const earned = Math.min(qPts, Math.max(0, parseFloat(aiRes.score) || 0));
          totalEarned += earned;

          await db.runAsync(`
            UPDATE submission_answers 
            SET ai_score = ?, ai_feedback = ?
            WHERE id = ?
          `, [earned, JSON.stringify(aiRes), sa.id]);

          updatedAnswers.push({
            question_id: sa.question_id,
            is_correct: null,
            ai_score: earned,
            ai_feedback: JSON.stringify(aiRes)
          });
        }
      }

      const assignmentObj = {
        title: submission.assignment_title,
        subject: submission.assignment_subject,
        content: submission.theory_content,
        total_points: totalMax
      };

      const questionsList = subAnswers.map(sa => ({
        id: sa.question_id,
        question_type: sa.question_type,
        question_text: sa.question_text,
        points: sa.question_points
      }));

      const synthesis = synthesizeSubmissionReport({
        assignment: assignmentObj,
        questions: questionsList,
        evaluatedAnswers: updatedAnswers,
        fileText: extractedFileText
      });

      // Agar o'qituvchi allaqachon tasdiqlagan bo'lsa, status 'graded' bo'lib qoladi
      const newStatus = submission.status === 'graded' ? 'graded' : 'reviewed';

      await db.runAsync(`
        UPDATE submissions 
        SET ai_summary = ?, ai_gaps = ?, recommended_score = ?, total_score = ?, max_score = ?, ai_report = ?, status = ?
        WHERE id = ?
      `, [synthesis.summary, synthesis.gaps, synthesis.recommended_score, synthesis.total_score, synthesis.max_score, synthesis.ai_report, newStatus, id]);

    } else {
      // Bitta umumiy javobli topshiriq
      const aiResult = await evaluateStudentAnswer({
        theoryContent: submission.theory_content,
        question: submission.open_question,
        studentAnswer: submission.student_answer,
        fileText: extractedFileText
      });

      const synthesisReport = JSON.stringify({
        mastery_level: (aiResult.recommended_score >= 85 ? "Yuqori (A'lo)" : (aiResult.recommended_score >= 70 ? "O'rta (Yaxshi)" : "Boshlang'ich")),
        score_percent: aiResult.recommended_score || 0,
        summary: aiResult.summary,
        recommendations: [aiResult.suggestions || "Mavzuni yanada chuqurroq mustahkamlang."],
        needs_manual_review: Boolean(aiResult.needs_manual_review),
        source: aiResult.source || 'openai-gpt-4o-mini'
      });

      const newStatus = submission.status === 'graded' ? 'graded' : 'reviewed';

      await db.runAsync(`
        UPDATE submissions 
        SET ai_summary = ?, ai_gaps = ?, recommended_score = ?, total_score = ?, max_score = 100, ai_report = ?, status = ?
        WHERE id = ?
      `, [aiResult.summary, aiResult.gaps, aiResult.recommended_score, aiResult.recommended_score, synthesisReport, newStatus, id]);
    }

    const updated = await db.getAsync('SELECT * FROM submissions WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'AI qayta tahlil qildi!',
      submission: updated
    });
  } catch (error) {
    console.error('reanalyzeSubmission xatosi:', error);
    return res.status(500).json({ success: false, message: 'Qayta tahlil qilishda xatolik yuz berdi.' });
  }
}

/**
 * Talabaga qayta topshirish uchun ruxsat berish (oxirgi javobni o'chirish)
 */
async function allowResubmit(req, res) {
  try {
    const { id } = req.params;
    const submission = await db.getAsync(`
      SELECT s.*, a.teacher_id 
      FROM submissions s 
      JOIN assignments a ON s.assignment_id = a.id 
      WHERE s.id = ?
    `, [id]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Javob topilmadi.' });
    }

    if (req.user.role !== 'admin' && submission.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat berilmadi.' });
    }

    // Yuklangan faylni tozalash
    if (submission.file_path) {
      cleanupUploadedFile(submission.file_path);
    }

    await db.runAsync('DELETE FROM submission_answers WHERE submission_id = ?', [id]);
    await db.runAsync('DELETE FROM submissions WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Talabaga topshiriqni qayta topshirish uchun ruxsat berildi.'
    });
  } catch (error) {
    console.error('allowResubmit xatosi:', error);
    return res.status(500).json({ success: false, message: 'Amalni bajarishda xatolik yuz berdi.' });
  }
}

/**
 * Barcha topshirilgan ishlarni olish (Super Admin uchun to'liq tahlil)
 */
async function getAllSubmissions(req, res) {
  try {
    const { status, group_id, assignment_id, search, limit = 100, page = 1 } = req.query;

    let query = `
      SELECT 
        s.*,
        u.name as student_name,
        u.email as student_email,
        g.name as group_name,
        g.id as group_id,
        a.title as assignment_title,
        a.subject as assignment_subject,
        a.total_points as assignment_total_points,
        t.name as teacher_name,
        t.email as teacher_email
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON s.student_id = u.id
      LEFT JOIN groups g ON u.group_id = g.id
      JOIN users t ON a.teacher_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND s.status = ? `;
      params.push(status);
    }

    if (group_id) {
      query += ` AND (u.group_id = ? OR a.group_id = ?) `;
      params.push(group_id, group_id);
    }

    if (assignment_id) {
      query += ` AND s.assignment_id = ? `;
      params.push(assignment_id);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR a.title LIKE ? OR a.subject LIKE ?) `;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY s.submitted_at DESC `;

    const parsedLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (parsedPage - 1) * parsedLimit;

    query += ` LIMIT ? OFFSET ? `;
    params.push(parsedLimit, offset);

    const submissions = await db.allAsync(query, params);

    // Umumiy sonini olish
    let countQuery = `
      SELECT COUNT(*) as total
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN users u ON s.student_id = u.id
      WHERE 1=1
    `;
    const countParams = [];
    if (status) {
      countQuery += ` AND s.status = ? `;
      countParams.push(status);
    }
    if (group_id) {
      countQuery += ` AND (u.group_id = ? OR a.group_id = ?) `;
      countParams.push(group_id, group_id);
    }
    if (assignment_id) {
      countQuery += ` AND s.assignment_id = ? `;
      countParams.push(assignment_id);
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      countQuery += ` AND (u.name LIKE ? OR u.email LIKE ? OR a.title LIKE ? OR a.subject LIKE ?) `;
      countParams.push(term, term, term, term);
    }

    const countRow = await db.getAsync(countQuery, countParams);
    const total = countRow ? countRow.total : 0;

    return res.json({
      success: true,
      submissions,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit)
      }
    });

  } catch (error) {
    console.error('getAllSubmissions xatosi:', error);
    return res.status(500).json({ success: false, message: 'Topshirilgan ishlarni olishda xatolik yuz berdi.' });
  }
}

/**
 * Talabaning test javoblarini oraliq qoralama (draft) sifatida avtomatik saqlash
 */
async function saveDraftAnswers(req, res) {
  try {
    const { assignment_id, answers, student_answer } = req.body;
    const student_id = req.user.id;

    if (!assignment_id) {
      return res.status(400).json({ success: false, message: 'Topshiriq identifikatori kiritilmadi.' });
    }

    const activeSession = await db.getAsync(`
      SELECT * FROM test_sessions 
      WHERE assignment_id = ? AND student_id = ? AND is_completed = 0
      ORDER BY id DESC LIMIT 1
    `, [assignment_id, student_id]);

    if (!activeSession) {
      return res.status(404).json({ success: false, message: 'Faol test sessiyasi topilmadi.' });
    }

    if (activeSession.expires_at) {
      const expiresTime = new Date(activeSession.expires_at).getTime();
      if (Date.now() > expiresTime + 30000) {
        await db.runAsync('UPDATE test_sessions SET is_completed = 1 WHERE id = ?', [activeSession.id]);
        return res.status(400).json({ success: false, message: 'Test vaqti tugagan. Qoralama saqlanmadi.' });
      }
    }

    const draftJson = JSON.stringify({
      answers: answers || [],
      student_answer: student_answer || ''
    });

    await db.runAsync('UPDATE test_sessions SET draft_answers = ? WHERE id = ?', [draftJson, activeSession.id]);

    return res.json({ success: true, message: 'Qoralama muvaffaqiyatli saqlandi.' });
  } catch (error) {
    console.error('saveDraftAnswers xatosi:', error);
    return res.status(500).json({ success: false, message: 'Qoralamani saqlashda xatolik yuz berdi.' });
  }
}

/**
 * Talabaning faol sessiyasini va mavjud qoralamalarini olish
 */
async function getActiveSession(req, res) {
  try {
    const { assignmentId } = req.params;
    const student_id = req.user.id;

    const activeSession = await db.getAsync(`
      SELECT * FROM test_sessions 
      WHERE assignment_id = ? AND student_id = ? AND is_completed = 0
      ORDER BY id DESC LIMIT 1
    `, [assignmentId, student_id]);

    if (!activeSession) {
      return res.json({ success: true, session: null });
    }

    const now = Date.now();
    let remainingSeconds = null;
    let isExpired = false;

    if (activeSession.expires_at) {
      const expiresTime = new Date(activeSession.expires_at).getTime();
      remainingSeconds = Math.max(0, Math.round((expiresTime - now) / 1000));
      isExpired = now > expiresTime;
      if (now > expiresTime + 30000) {
        await db.runAsync('UPDATE test_sessions SET is_completed = 1 WHERE id = ?', [activeSession.id]);
        return res.json({ success: true, session: null, is_expired: true });
      }
    }

    let draft = null;
    if (activeSession.draft_answers) {
      try { draft = JSON.parse(activeSession.draft_answers); } catch (e) {}
    }

    return res.json({
      success: true,
      session: {
        ...activeSession,
        remaining_seconds: remainingSeconds,
        is_expired: isExpired,
        draft
      }
    });
  } catch (error) {
    console.error('getActiveSession xatosi:', error);
    return res.status(500).json({ success: false, message: 'Sessiyani yuklashda xatolik yuz berdi.' });
  }
}

module.exports = {
  getAllSubmissions,
  startTestSession,
  submitAnswer,
  getMySubmissions,
  getAssignmentSubmissions,
  getSubmissionById,
  downloadSubmissionFile,
  gradeSubmission,
  reanalyzeSubmission,
  saveDraftAnswers,
  getActiveSession,
  allowResubmission: allowResubmit
};