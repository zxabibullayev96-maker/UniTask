const { db } = require('../config/database');
const { evaluateStudentAnswer, evaluateOpenQuestion } = require('../services/aiService');

async function submitAnswer(req, res) {
  try {
    const { assignment_id, student_answer, answers } = req.body;
    const student_id = req.user.id;

    if (!assignment_id) {
      return res.status(400).json({ success: false, message: 'Topshiriq identifikatori kiritilmadi.' });
    }

    // Topshiriq mavjudligini tekshirish
    const assignment = await db.getAsync('SELECT * FROM assignments WHERE id = ?', [assignment_id]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Talabaning guruhi mos kelishini tekshirish
    if (req.user.group_id !== assignment.group_id) {
      return res.status(403).json({ success: false, message: 'Siz faqat o\'z guruhingizga berilgan topshiriqlarni topshira olasiz.' });
    }

    // FR-2.3: Bitta topshiriqqa talaba faqat bir marta javob yubora oladi
    const existingSubmission = await db.getAsync(
      'SELECT id, status FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignment_id, student_id]
    );

    if (existingSubmission) {
      return res.status(400).json({ 
        success: false, 
        message: 'Siz ushbu topshiriqqa allaqachon javob topshirgansiz. Qayta topshirish uchun o\'qituvchiga murojaat qiling.' 
      });
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
          // Ochiq savolni AI yordamida tekshirish
          const ansText = (givenAnswer.answer_text || '').trim();

          let aiResult;
          try {
            aiResult = await evaluateOpenQuestion({
              theoryContent: assignment.content,
              question: q.question_text,
              instruction: q.instruction,
              sampleAnswer: q.sample_answer,
              studentAnswer: ansText,
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

      const mainSummary = `Dinamik topshiriq: ${questions.length} ta savol bajarildi. Yopiq va ochiq savollar bo'yicha to'plangan tavsiya ball: ${Math.round(totalEarnedPoints * 10) / 10} / ${totalMaxPoints} ball (${normalizedPercent}%).`;

      // 1. Submissions jadvaliga yozish
      const insertSub = await db.runAsync(`
        INSERT INTO submissions (
          assignment_id, student_id, student_answer,
          ai_summary, ai_gaps, recommended_score, total_score, max_score, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        assignment_id,
        student_id,
        mainSummary,
        mainSummary,
        "Har bir savol bo'yicha alohida tahlillar quyida keltirilgan.",
        normalizedPercent,
        Math.round(totalEarnedPoints * 10) / 10,
        totalMaxPoints,
        status
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

      const createdSubmission = await db.getAsync(`
        SELECT s.*, a.title as assignment_title 
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        WHERE s.id = ?
      `, [submissionId]);

      return res.status(201).json({
        success: true,
        message: status === 'reviewed' 
          ? 'Javoblaringiz qabul qilindi va AI tomonidan muvaffaqiyatli baholandi!' 
          : 'Javoblaringiz qabul qilindi, AI tahlili navbatda kutmoqda.',
        submission: createdSubmission
      });

    } else {
      // Eski formatdagi topshiriq (bitta umumiy javob)
      if (!student_answer || !student_answer.trim()) {
        return res.status(400).json({ success: false, message: 'Javob matnini kiritish majburiydir.' });
      }

      let aiResult;
      let status = 'reviewed';

      try {
        aiResult = await evaluateStudentAnswer({
          theoryContent: assignment.content,
          question: assignment.open_question,
          studentAnswer: student_answer.trim()
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

      const insertResult = await db.runAsync(`
        INSERT INTO submissions (
          assignment_id, student_id, student_answer, 
          ai_summary, ai_gaps, recommended_score, total_score, max_score, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        assignment_id,
        student_id,
        student_answer.trim(),
        aiResult.summary,
        aiResult.gaps,
        aiResult.recommended_score,
        aiResult.recommended_score,
        100,
        status
      ]);

      const createdSubmission = await db.getAsync(`
        SELECT s.*, a.title as assignment_title 
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        WHERE s.id = ?
      `, [insertResult.lastID]);

      return res.status(201).json({
        success: true,
        message: status === 'reviewed' 
          ? 'Javobingiz qabul qilindi va AI tomonidan muvaffaqiyatli tahlil qilindi!' 
          : 'Javobingiz qabul qilindi, AI tahlili navbatda kutmoqda.',
        submission: createdSubmission
      });
    }

  } catch (error) {
    console.error('submitAnswer xatosi:', error);
    return res.status(500).json({ success: false, message: 'Javobni topshirishda server xatoligi yuz berdi.' });
  }
}

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
        // Savolning barcha variantlarini olish (talaba to'g'ri javobni ko'rishi mumkinmi? Faqat baholangandan keyin)
        const allOpts = await db.allAsync(`
          SELECT id, option_key, option_text, is_correct 
          FROM question_options 
          WHERE question_id = ? 
          ORDER BY order_index ASC, id ASC
        `, [ans.question_id]);

        if (isStudent && submission.status !== 'graded') {
          // Baholanmagan bo'lsa to'g'ri variantni sir saqlaymiz
          aObj.options = allOpts.map(o => ({ id: o.id, option_key: o.option_key, option_text: o.option_text }));
        } else {
          aObj.options = allOpts;
        }
      }

      if (isStudent && submission.status !== 'graded') {
        // Baholanmaguncha namunaviy mezon ko'rsatilmaydi
        delete aObj.question_sample_answer;
      }

      answers.push(aObj);
    }

    submission.answers = answers;

    return res.json({ success: true, submission });
  } catch (error) {
    console.error('getSubmissionById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Javob tafsilotini yuklashda xatolik yuz berdi.' });
  }
}

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
      // Umumiy kiritilgan ball
      const scoreNum = parseFloat(teacher_score);
      if (isNaN(scoreNum) || scoreNum < 0) {
        return res.status(400).json({ success: false, message: 'Baho 0 dan kam bo\'lmasligi shart.' });
      }
      finalScore = scoreNum;
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

    const subAnswers = await db.allAsync(`
      SELECT sa.*, q.question_type, q.question_text, q.points as question_points, q.instruction, q.sample_answer
      FROM submission_answers sa
      JOIN assignment_questions q ON sa.question_id = q.id
      WHERE sa.submission_id = ?
    `, [id]);

    if (subAnswers.length > 0) {
      let totalEarned = 0;
      let totalMax = 0;

      for (const sa of subAnswers) {
        const qPts = Math.max(0.5, parseFloat(sa.question_points) || 1);
        totalMax += qPts;

        if (sa.question_type === 'closed') {
          totalEarned += (sa.is_correct === 1 ? qPts : 0);
        } else if (sa.question_type === 'open') {
          const aiRes = await evaluateOpenQuestion({
            theoryContent: submission.theory_content,
            question: sa.question_text,
            instruction: sa.instruction,
            sampleAnswer: sa.sample_answer,
            studentAnswer: sa.answer_text,
            maxScore: qPts
          });

          const earned = Math.min(qPts, Math.max(0, parseFloat(aiRes.score) || 0));
          totalEarned += earned;

          await db.runAsync(`
            UPDATE submission_answers 
            SET ai_score = ?, ai_feedback = ?
            WHERE id = ?
          `, [earned, JSON.stringify(aiRes), sa.id]);
        }
      }

      const normalized = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
      const mainSummary = `Qayta tahlil qilindi. To'plangan tavsiya ball: ${Math.round(totalEarned * 10) / 10} / ${totalMax} ball (${normalized}%).`;

      await db.runAsync(`
        UPDATE submissions 
        SET ai_summary = ?, ai_gaps = ?, recommended_score = ?, total_score = ?, max_score = ?, status = 'reviewed'
        WHERE id = ?
      `, [mainSummary, "AI barcha ochiq savollarni qayta baholadi.", normalized, Math.round(totalEarned * 10) / 10, totalMax, id]);

    } else {
      // Eski formatdagi topshiriq
      const aiResult = await evaluateStudentAnswer({
        theoryContent: submission.theory_content,
        question: submission.open_question,
        studentAnswer: submission.student_answer
      });

      await db.runAsync(`
        UPDATE submissions 
        SET ai_summary = ?, ai_gaps = ?, recommended_score = ?, total_score = ?, max_score = 100, status = 'reviewed'
        WHERE id = ?
      `, [aiResult.summary, aiResult.gaps, aiResult.recommended_score, aiResult.recommended_score, id]);
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

module.exports = {
  submitAnswer,
  getMySubmissions,
  getAssignmentSubmissions,
  getSubmissionById,
  gradeSubmission,
  reanalyzeSubmission,
  allowResubmission: allowResubmit
};
