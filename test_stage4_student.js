/**
 * UniTask AI - 4-Bosqich Integratsion va Regressiya Testlari
 * Talaba paneli, topshiriqlar holati (5 xil status), test sessiyasi, server-side taymer,
 * qoralama (draft) avtomatik saqlash, urinishlar limiti, fayl tekshiruvi va natijalar xavfsizligi.
 */

const { db } = require('./server/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./server/middlewares/authMiddleware');
const assignmentController = require('./server/controllers/assignmentController');
const submissionController = require('./server/controllers/submissionController');
const fs = require('fs');
const path = require('path');

// Mock HTTP helper
function createMockReqRes({ user, body = {}, params = {}, query = {}, file = null }) {
  const req = {
    user: user || null,
    body,
    params,
    query,
    file,
    headers: user ? { authorization: `Bearer ${jwt.sign({ id: user.id, email: user.email, role: user.role, is_active: 1 }, JWT_SECRET)}` } : {}
  };

  const res = {
    statusCode: 200,
    headers: {},
    jsonData: null,
    downloadPath: null,
    downloadName: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    download(filePath, name) {
      this.downloadPath = filePath;
      this.downloadName = name;
      return this;
    }
  };

  return { req, res };
}

async function runStage4Tests() {
  console.log('===============================================================');
  console.log('🚀 4-BOSQICH: TALABA PANELI VA TOPSHIRIQ BAJARISH TESTLARI');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.error(`❌ ${message}`);
      failed++;
    }
  }

  try {
    // 1. O'qituvchi va talaba foydalanuvchilarini olish
    const teacher = await db.getAsync("SELECT * FROM users WHERE role = 'teacher' AND is_active = 1 LIMIT 1");
    let student = await db.getAsync("SELECT * FROM users WHERE role = 'student' AND is_active = 1 LIMIT 1");
    const otherStudent = await db.getAsync("SELECT * FROM users WHERE role = 'student' AND is_active = 1 AND id != ? LIMIT 1", [student.id]);
    const group = await db.getAsync("SELECT * FROM groups LIMIT 1");

    assert(teacher && student && group, "Bazadan o'qituvchi, talaba va guruh muvaffaqiyatli olindi");

    // Talabaning guruhini tekshirish/biriktirish
    if (student.group_id !== group.id) {
      await db.runAsync("UPDATE users SET group_id = ? WHERE id = ?", [group.id, student.id]);
      student = await db.getAsync("SELECT * FROM users WHERE id = ?", [student.id]);
    }

    // 2. Sinov uchun yangi topshiriq yaratish (vaqt va urinishlar chegarasi bilan)
    const testAssignmentTitle = `Stage4 Talaba Test Topshirig'i ${Date.now()}`;
    const createReq = createMockReqRes({
      user: teacher,
      body: {
        title: testAssignmentTitle,
        subject: "Dasturlash Asoslari",
        group_id: group.id,
        content: "Topshiriq nazariyasi va tushuntirish matni",
        instructions: "Barcha savollarga to'liq va o'z vaqtida javob bering.",
        total_points: 30,
        attempts_limit: 2,
        time_limit_minutes: 15, // 15 daqiqalik test
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 kundan keyin
        questions: JSON.stringify([
          {
            question_type: 'closed',
            question_text: 'JavaScript qanday dasturlash tili hisoblanadi?',
            points: 10,
            options: [
              { option_key: 'A', option_text: 'Kompilyatsiya qilinuvchi faqat backend tili', is_correct: false },
              { option_key: 'B', option_text: 'Dinamik tiplangan skript tili', is_correct: true },
              { option_key: 'C', option_text: 'Faqat ma\'lumotlar bazasi tili', is_correct: false }
            ]
          },
          {
            question_type: 'open',
            question_text: 'Asinxronlik (Async/Await) va uning afzalliklarini tushuntirib bering.',
            points: 20,
            instruction: 'Kamida 2 ta afzallikni sanab bering.',
            sample_answer: 'Async/await promise lar bilan ishlashni soddalashtiradi va kodni o\'qishni osonlashtiradi.'
          }
        ])
      }
    });

    await assignmentController.createAssignment(createReq.req, createReq.res);
    assert(createReq.res.statusCode === 201 && createReq.res.jsonData?.success, "O'qituvchi tomonidan dinamik test topshirig'i yaratildi");
    const assignmentId = createReq.res.jsonData.assignment.id;

    // 3. Talaba topshiriqlar ro'yxatini olish (5 holat tekshiruvi: not_started, in_progress, etc.)
    const listReq = createMockReqRes({ user: student });
    await assignmentController.getAssignments(listReq.req, listReq.res);
    assert(listReq.res.statusCode === 200, "Talaba topshiriqlar ro'yxatini muvaffaqiyatli oldi");

    const foundTask = listReq.res.jsonData.assignments.find(a => a.id === assignmentId);
    assert(foundTask !== undefined, "Talaba ro'yxatida yangi topshiriq mavjud");
    assert(foundTask?.student_status === 'not_started', `Topshiriq boshlang'ich holati 'not_started' (haqiqiy: ${foundTask?.student_status})`);
    assert(foundTask?.attempts_left === 2, `Qolgan urinishlar to'g'ri hisoblangan: ${foundTask?.attempts_left}`);
    assert(foundTask?.can_attempt === true, "Talaba topshiriqni boshlash imkoniyatiga ega");

    // 4. Xavfsizlik: Talabaga savollar yuborilganda to'g'ri javoblar va namunaviy javoblar sir saqlanishi kerak
    const getByIdReq = createMockReqRes({ user: student, params: { id: assignmentId } });
    await assignmentController.getAssignmentById(getByIdReq.req, getByIdReq.res);
    assert(getByIdReq.res.statusCode === 200, "Talaba topshiriq tafsilotlarini oldi");

    const fetchedQuestions = getByIdReq.res.jsonData.assignment.questions;
    const closedQ = fetchedQuestions.find(q => q.question_type === 'closed');
    const openQ = fetchedQuestions.find(q => q.question_type === 'open');

    const hasCorrectLeak = closedQ.options.some(o => 'is_correct' in o);
    const hasSampleLeak = 'sample_answer' in openQ;
    assert(!hasCorrectLeak, "Yopiq savollarda to'g'ri javob (is_correct) talabaga oshkor qilinmadi");
    assert(!hasSampleLeak, "Ochiq savollarda namunaviy javob (sample_answer) talabaga oshkor qilinmadi");

    // 5. Test sessiyasini boshlash (POST /api/submissions/start)
    const startReq = createMockReqRes({
      user: student,
      body: { assignment_id: assignmentId }
    });
    await submissionController.startTestSession(startReq.req, startReq.res);
    assert(startReq.res.statusCode === 201 && startReq.res.jsonData.success, "Test sessiyasi muvaffaqiyatli boshlandi");
    assert(startReq.res.jsonData.session.expires_at !== null, "Test sessiyasiga tugash vaqti (expires_at) biriktirildi");
    assert(startReq.res.jsonData.session.remaining_seconds > 0, `Qolgan vaqt soniyalarda hisoblandi: ${startReq.res.jsonData.session.remaining_seconds} soniya`);

    // 6. Sessiyani qayta chaqirish (Resumption) - bir xil sessiya qaytishi kerak
    const resumeReq = createMockReqRes({
      user: student,
      body: { assignment_id: assignmentId }
    });
    await submissionController.startTestSession(resumeReq.req, resumeReq.res);
    assert(resumeReq.res.statusCode === 200 && resumeReq.res.jsonData.session.is_resumed === true, "Mavjud faol sessiya qayta tiklandi (resumed)");

    // 7. Qoralama (Draft) javoblarni saqlash (POST /api/submissions/draft)
    const draftOptions = closedQ.options;
    const chosenOption = draftOptions[1]; // B variant
    const draftAnswers = [
      { question_id: closedQ.id, selected_option_id: chosenOption.id },
      { question_id: openQ.id, answer_text: "Qoralama: Async kodni sinxron kabi yozish imkonini beradi." }
    ];

    const saveDraftReq = createMockReqRes({
      user: student,
      body: {
        assignment_id: assignmentId,
        answers: draftAnswers,
        student_answer: "Umumiy qoralama izohi"
      }
    });
    await submissionController.saveDraftAnswers(saveDraftReq.req, saveDraftReq.res);
    assert(saveDraftReq.res.statusCode === 200 && saveDraftReq.res.jsonData.success, "Qoralama (draft) serverga muvaffaqiyatli saqlandi");

    // 8. Faol sessiya va qoralamani tekshirish (GET /api/submissions/session/:assignmentId)
    const getSessionReq = createMockReqRes({
      user: student,
      params: { assignmentId }
    });
    await submissionController.getActiveSession(getSessionReq.req, getSessionReq.res);
    assert(getSessionReq.res.statusCode === 200 && getSessionReq.res.jsonData.session !== null, "Faol sessiya ma'lumotlari olindi");
    assert(getSessionReq.res.jsonData.session.draft !== null, "Saqlangan qoralama (draft) muvaffaqiyatli o'qildi");
    assert(getSessionReq.res.jsonData.session.draft.answers.length === 2, "Qoralama ichidagi barcha savollar javobi to'liq tiklandi");

    // 9. Topshiriqlar ro'yxatida holat 'in_progress' bo'lganini tekshirish
    const listInProgressReq = createMockReqRes({ user: student });
    await assignmentController.getAssignments(listInProgressReq.req, listInProgressReq.res);
    const inProgressTask = listInProgressReq.res.jsonData.assignments.find(a => a.id === assignmentId);
    assert(inProgressTask?.student_status === 'in_progress', `Topshiriq holati 'in_progress' ga o'zgardi (haqiqiy: ${inProgressTask?.student_status})`);

    // 10. Fayl xavfsizligi tekshiruvi: Soxta (spoofed) faylni yuborishni bloklash
    const fakeFilePath = path.join(__dirname, 'fake_dangerous.pdf');
    fs.writeFileSync(fakeFilePath, 'MZThisIsAnExecutableFileContentNotRealPDFHeader12345');
    const fakeFileReq = createMockReqRes({
      user: student,
      body: {
        assignment_id: assignmentId,
        answers: JSON.stringify(draftAnswers)
      },
      file: {
        path: fakeFilePath,
        originalname: 'dangerous.pdf',
        size: 50,
        filename: 'fake_dangerous.pdf'
      }
    });
    await submissionController.submitAnswer(fakeFileReq.req, fakeFileReq.res);
    assert(fakeFileReq.res.statusCode === 400 && fakeFileReq.res.jsonData?.message?.includes('haqiqiy'), "Soxtalashtirilgan noto'g'ri fayl (magic bytes) muvaffaqiyatli rad etildi");
    if (fs.existsSync(fakeFilePath)) fs.unlinkSync(fakeFilePath);

    // 11. Haqiqiy mustaqil ish fayli bilan topshiriqni muvaffaqiyatli topshirish
    const validFilePath = path.join(__dirname, 'student_valid_work.txt');
    fs.writeFileSync(validFilePath, 'Talaba mustaqil ish hisoboti. Barcha shartlar bajarildi.');
    const validFileReq = createMockReqRes({
      user: student,
      body: {
        assignment_id: assignmentId,
        answers: JSON.stringify([
          { question_id: closedQ.id, selected_option_id: chosenOption.id },
          { question_id: openQ.id, answer_text: "Async/await promise lar bilan ishlashni soddalashtiradi va try/catch orqali xatolarni oson ushlash imkonini beradi." }
        ]),
        student_answer: "Mening mustaqil ishim va test javoblarim ilova qilindi."
      },
      file: {
        path: validFilePath,
        originalname: 'student_valid_work.txt',
        size: 75,
        filename: 'student_valid_work.txt'
      }
    });

    await submissionController.submitAnswer(validFileReq.req, validFileReq.res);
    assert(validFileReq.res.statusCode === 201 && validFileReq.res.jsonData.success, "Talaba topshiriqni va biriktirilgan faylni muvaffaqiyatli topshirdi");
    const submissionId = validFileReq.res.jsonData.submission.id;
    assert(submissionId > 0, `Javob bazaga saqlandi (ID: ${submissionId})`);

    // 12. Yopiq savol ballining avtomatik to'g'ri hisoblangani
    const subTotalScore = validFileReq.res.jsonData.submission.total_score;
    assert(subTotalScore >= 10, `Yopiq savol to'g'ri belgilangani uchun avtomatik 10 ball berildi (jami: ${subTotalScore})`);

    // 13. Topshirishdan so'ng sessiya yakunlangani va ro'yxatda holat 'submitted' bo'lganini tekshirish
    const listSubmittedReq = createMockReqRes({ user: student });
    await assignmentController.getAssignments(listSubmittedReq.req, listSubmittedReq.res);
    const submittedTask = listSubmittedReq.res.jsonData.assignments.find(a => a.id === assignmentId);
    assert(submittedTask?.student_status === 'submitted', `Topshiriq holati 'submitted' bo'ldi (haqiqiy: ${submittedTask?.student_status})`);
    assert(submittedTask?.attempts_left === 1, `Qolgan urinishlar soni kamaydi (qoldi: ${submittedTask?.attempts_left})`);

    // 14. Natijalarni ko'rish va Maxfiylik chegarasi (Privacy Boundary)
    const getMySubReq = createMockReqRes({
      user: student,
      params: { id: submissionId }
    });
    await submissionController.getSubmissionById(getMySubReq.req, getMySubReq.res);
    assert(getMySubReq.res.statusCode === 200 && getMySubReq.res.jsonData.success, "Talaba o'z topshirig'i natijasini to'liq ko'ra oldi");
    assert(getMySubReq.res.jsonData.submission.answers.length === 2, "Savollar bo'yicha to'liq tahlil va javoblar qaytdi");

    if (otherStudent) {
      const hackReq = createMockReqRes({
        user: otherStudent,
        params: { id: submissionId }
      });
      await submissionController.getSubmissionById(hackReq.req, hackReq.res);
      assert(hackReq.res.statusCode === 403, "Boshqa talaba begona topshiriq natijasini ko'rishga uringanda 403 Forbidden oldi");

      const hackDownloadReq = createMockReqRes({
        user: otherStudent,
        params: { id: submissionId }
      });
      await submissionController.downloadSubmissionFile(hackDownloadReq.req, hackDownloadReq.res);
      assert(hackDownloadReq.res.statusCode === 403, "Boshqa talaba birovning yuklagan faylini olishga uringanda 403 Forbidden oldi");
    }

    // 15. Server-side taymer muddati o'tib ketgan holatni sinovdan o'tkazish
    // Yangi test sessiyasi ochamiz va uning expires_at vaqtini o'tmishga o'rnatamiz
    const expiredTaskResult = await db.runAsync(`
      INSERT INTO assignments (title, subject, group_id, teacher_id, content, open_question, total_points, attempts_limit, time_limit_minutes, due_date)
      VALUES ('Vaqti o''tgan topshiriq', 'Matematika', ?, ?, 'Nazariya', 'Sinov savoli', 20, 1, 1, CURRENT_TIMESTAMP)
    `, [group.id, teacher.id]);
    const expiredTaskId = expiredTaskResult.lastID;

    // O'tgan vaqt bilan test sessiyasi yaratamiz
    const pastExpireDate = new Date(Date.now() - 60000).toISOString(); // 1 daqiqa oldin tugagan
    await db.runAsync(`
      INSERT INTO test_sessions (assignment_id, student_id, attempt_number, started_at, expires_at, is_completed)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, ?, 0)
    `, [expiredTaskId, student.id, pastExpireDate]);

    // Muddat o'tganda javob yuborishga urinish
    const timeoutSubmitReq = createMockReqRes({
      user: student,
      body: {
        assignment_id: expiredTaskId,
        answers: JSON.stringify([]),
        student_answer: "Kechikkan javob"
      }
    });
    await submissionController.submitAnswer(timeoutSubmitReq.req, timeoutSubmitReq.res);
    assert(timeoutSubmitReq.res.statusCode === 400 && timeoutSubmitReq.res.jsonData?.message?.includes('tugagan'), "Vaqt muddati o'tgan sessiyadan yuborilgan topshiriq server tomonidan rad etildi");

    // 16. Urinishlar chegarasidan (attempts_limit) oshib ketishni rad etish
    const checkExceedStart = createMockReqRes({
      user: student,
      body: { assignment_id: expiredTaskId }
    });
    // Agar attempts_limit = 1 bo'lsa va submissions bor bo'lsa
    await db.runAsync(`
      INSERT INTO submissions (assignment_id, student_id, attempt_number, status, total_score, student_answer)
      VALUES (?, ?, 1, 'reviewed', 15, 'Oldingi urinish javobi')
    `, [expiredTaskId, student.id]);

    await submissionController.startTestSession(checkExceedStart.req, checkExceedStart.res);
    assert(checkExceedStart.res.statusCode === 400, "Urinishlar soni tugaganda yangi test sessiyasi boshlash bloklandi");

    // 17. O'qituvchi ishni baholaganidan so'ng talabaning holati 'graded' bo'lishi
    await db.runAsync(`
      UPDATE submissions 
      SET status = 'graded', teacher_score = 28, teacher_feedback = 'Juda yaxshi, to''liq tushuntirilgan'
      WHERE id = ?
    `, [submissionId]);

    const listGradedReq = createMockReqRes({ user: student });
    await assignmentController.getAssignments(listGradedReq.req, listGradedReq.res);
    const gradedTask = listGradedReq.res.jsonData.assignments.find(a => a.id === assignmentId);
    assert(gradedTask?.student_status === 'graded', `Topshiriq holati 'graded' bo'ldi (haqiqiy: ${gradedTask?.student_status})`);

    // Clean up temporary test files
    if (fs.existsSync(validFilePath)) fs.unlinkSync(validFilePath);

  } catch (err) {
    console.error('Testlar davomida kutilmagan xatolik:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`📊 YAKUNIY NATIJA: ${passed} ta o'tdi, ${failed} ta muvaffaqiyatsiz bo'ldi.`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage4Tests().then(() => {
  console.log('🏁 4-Bosqich testlari muvaffaqiyatli yakunlandi.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
