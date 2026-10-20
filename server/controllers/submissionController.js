const { db } = require('../config/database');
const { evaluateStudentAnswer } = require('../services/aiService');

async function submitAnswer(req, res) {
  try {
    const { assignment_id, student_answer } = req.body;
    const student_id = req.user.id;

    if (!assignment_id || !student_answer || !student_answer.trim()) {
      return res.status(400).json({ success: false, message: 'Javob matnini kiritish majburiydir.' });
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

    // Sun'iy intellekt tahlilini boshlash
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
      // FR-3.3: Agar AI da xatolik bo'lsa status 'pending' bo'lib qoladi
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
        ai_summary, ai_gaps, recommended_score, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      assignment_id,
      student_id,
      student_answer.trim(),
      aiResult.summary,
      aiResult.gaps,
      aiResult.recommended_score,
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
    const submission = await db.getAsync(`
      SELECT 
        s.*, 
        a.title as assignment_title, 
        a.content as theory_content,
        a.open_question,
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
    if (req.user.role === 'student' && submission.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ushbu natijani ko\'rish huquqi yo\'q.' });
    }
    if (req.user.role === 'teacher' && submission.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu boshqa o\'qituvchining topshirig\'i.' });
    }

    return res.json({ success: true, submission });
  } catch (error) {
    console.error('getSubmissionById xatosi:', error);
    return res.status(500).json({ success: false, message: 'Javob tafsilotini yuklashda xatolik yuz berdi.' });
  }
}

async function gradeSubmission(req, res) {
  try {
    const { id } = req.params;
    const { teacher_score, teacher_feedback } = req.body;

    const submission = await db.getAsync(`
      SELECT s.*, a.teacher_id 
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

    const scoreNum = parseInt(teacher_score, 10);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      return res.status(400).json({ success: false, message: 'Baho 0 dan 100 gacha bo\'lishi shart.' });
    }

    // FR-4.3: Tasdiqlangan baho statusi 'graded' ga o'zgaradi va talaba profilida ko'rinadi
    await db.runAsync(`
      UPDATE submissions 
      SET teacher_score = ?, teacher_feedback = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [scoreNum, (teacher_feedback || '').trim(), id]);

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
      SELECT s.*, a.content as theory_content, a.open_question, a.teacher_id
      FROM submissions s 
      JOIN assignments a ON s.assignment_id = a.id 
      WHERE s.id = ?
    `, [id]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Javob topilmadi.' });
    }

    // Faqat o'qituvchi yoki admin qayta tahlil qildira oladi
    if (req.user.role !== 'admin' && submission.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat berilmadi.' });
    }

    const aiResult = await evaluateStudentAnswer({
      theoryContent: submission.theory_content,
      question: submission.open_question,
      studentAnswer: submission.student_answer
    });

    await db.runAsync(`
      UPDATE submissions 
      SET ai_summary = ?, ai_gaps = ?, recommended_score = ?, status = 'reviewed'
      WHERE id = ?
    `, [aiResult.summary, aiResult.gaps, aiResult.recommended_score, id]);

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

async function allowResubmission(req, res) {
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

    await db.runAsync('DELETE FROM submissions WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Talabaga topshiriqni qayta topshirish uchun ruxsat berildi.'
    });
  } catch (error) {
    console.error('allowResubmission xatosi:', error);
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
  allowResubmission
};
