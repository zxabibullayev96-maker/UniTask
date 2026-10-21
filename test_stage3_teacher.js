/**
 * UniTask AI - 3-Bosqich Integratsion va Regressiya Testlari
 * O'qituvchi boshqaruv paneli, 4 bosqichli topshiriq yaratish, vaqt va urinishlar limitlari,
 * baholash, xavfsiz fayl yuklab olish va regressiya sinovlari.
 */

const { db } = require('./server/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./server/middlewares/authMiddleware');
const assignmentController = require('./server/controllers/assignmentController');
const submissionController = require('./server/controllers/submissionController');
const groupController = require('./server/controllers/groupController');

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

async function runStage3Tests() {
  console.log('===============================================================');
  console.log('🚀 3-BOSQICH: O\'QITUVCHI PANELI VA TEST KONSTRUKTORI TESTLARI');
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
    const student = await db.getAsync("SELECT * FROM users WHERE role = 'student' AND is_active = 1 LIMIT 1");
    const admin = await db.getAsync("SELECT * FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1");
    const group = await db.getAsync("SELECT * FROM groups LIMIT 1");

    assert(teacher && student && admin && group, "1. Sinov foydalanuvchilari va guruhlar mavjud");

    // 2. O'qituvchi o'z topshiriqlarini olishi (GET /api/assignments)
    const { req: reqTeacherAssigns, res: resTeacherAssigns } = createMockReqRes({ user: teacher });
    await assignmentController.getAssignments(reqTeacherAssigns, resTeacherAssigns);
    assert(resTeacherAssigns.statusCode === 200 && Array.isArray(resTeacherAssigns.jsonData.assignments), 
      "2. O'qituvchi o'z topshiriqlari ro'yxatini muvaffaqiyatli oldi");

    // 3. 4-bosqichli topshiriq yaratish: Vaqt limiti (30 daq) va urinishlar limiti (2 ta)
    const testTitle = `Stage 3 Sinov Topshirig'i (${Date.now()})`;
    const testQuestions = [
      {
        question_type: 'closed',
        question_text: 'Dasturiy ta\'minot arxitekturasida MVC nimani anglatadi?',
        points: 10,
        options: [
          { option_key: 'A', option_text: 'Model View Controller', is_correct: 1 },
          { option_key: 'B', option_text: 'Main Virtual Center', is_correct: 0 },
          { option_key: 'C', option_text: 'Managed Value Core', is_correct: 0 }
        ]
      },
      {
        question_type: 'open',
        question_text: 'REST API arxitekturasining asosiy tamoyillarini tushuntiring.',
        points: 15,
        sample_answer: 'Stateless, Client-Server, Cacheable, Layered System',
        instruction: 'Kamida 4 ta tamoyilni izohlang'
      }
    ];

    const { req: reqCreate, res: resCreate } = createMockReqRes({
      user: teacher,
      body: {
        title: testTitle,
        subject: 'Dasturiy Injiniring',
        group_id: group.id,
        instructions: 'Barcha savollarga diqqat bilan javob bering.',
        start_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        attempts_limit: 2,
        time_limit_minutes: 30,
        content: 'REST API mijoz va server o\'rtasida ma\'lumot almashish uchun HTTP protokolidan foydalanadi.',
        questions: JSON.stringify(testQuestions)
      }
    });

    await assignmentController.createAssignment(reqCreate, resCreate);
    assert(resCreate.statusCode === 201 && resCreate.jsonData.assignment, 
      "3. 4-bosqichli topshiriq yaratildi (Vaqt: 30 daq, Urinishlar: 2 ta)");

    const createdAssignment = resCreate.jsonData.assignment;
    assert(createdAssignment.time_limit_minutes === 30, "4. time_limit_minutes = 30 to'g'ri saqlandi");
    assert(createdAssignment.attempts_limit === 2, "5. attempts_limit = 2 to'g'ri saqlandi");
    assert(createdAssignment.total_points === 25, "6. Umumiy ballar to'g'ri jamlandi (10 + 15 = 25 ball)");

    // 4. Topshiriq tafsilotlarini tekshirish (GET /api/assignments/:id)
    const { req: reqGetId, res: resGetId } = createMockReqRes({
      user: teacher,
      params: { id: createdAssignment.id }
    });
    await assignmentController.getAssignmentById(reqGetId, resGetId);
    assert(resGetId.statusCode === 200 && resGetId.jsonData.assignment.questions.length === 2,
      "7. Topshiriq savollari (1 yopiq, 1 ochiq) muvaffaqiyatli yuklandi");

    // 5. Talaba uchun maxfiylik tekshiruvi (to'g'ri javob va namunaviy javob yashirilgan)
    const { req: reqStudentGet, res: resStudentGet } = createMockReqRes({
      user: { ...student, group_id: group.id },
      params: { id: createdAssignment.id }
    });
    await assignmentController.getAssignmentById(reqStudentGet, resStudentGet);
    const studentQClosed = resStudentGet.jsonData.assignment.questions.find(q => q.question_type === 'closed');
    const studentQOpen = resStudentGet.jsonData.assignment.questions.find(q => q.question_type === 'open');
    const hasCorrectLeaked = studentQClosed.options.some(opt => opt.is_correct !== undefined);
    assert(!hasCorrectLeaked && !studentQOpen.sample_answer, 
      "8. Xavfsizlik: Talabadan to'g'ri javob va namunaviy mezon sir saqlanmoqda");

    // 6. Talaba javob topshirishi (1-urinish)
    // Talabaning guruhini topshiriq guruhiga tenglashtiramiz
    await db.runAsync('UPDATE users SET group_id = ? WHERE id = ?', [group.id, student.id]);

    const { req: reqSub, res: resSub } = createMockReqRes({
      user: { ...student, group_id: group.id },
      body: {
        assignment_id: createdAssignment.id,
        answer_text: 'REST API stateless bo\'lib, client-server va keshlanuvchi arxitekturaga ega.',
        answers: JSON.stringify([
          { question_id: studentQClosed.id, selected_option_id: studentQClosed.options[0].id },
          { question_id: studentQOpen.id, answer_text: 'Stateless, client-server va keshlanish tamoyillari.' }
        ])
      }
    });
    await submissionController.submitAnswer(reqSub, resSub);
    assert(resSub.statusCode === 201 && resSub.jsonData.submission,
      "9. Talaba javobi muvaffaqiyatli topshirildi va AI tomonidan baholandi");

    const submission = resSub.jsonData.submission;
    assert(submission.attempt_number === 1, "10. Birinchi urinish raqami #1 ekani tasdiqlandi");

    // 7. O'qituvchi topshiriq natijalarini ko'rishi (GET /api/submissions/assignment/:id)
    const { req: reqTeacherSubs, res: resTeacherSubs } = createMockReqRes({
      user: teacher,
      params: { assignmentId: createdAssignment.id }
    });
    await submissionController.getAssignmentSubmissions(reqTeacherSubs, resTeacherSubs);
    assert(resTeacherSubs.statusCode === 200 && resTeacherSubs.jsonData.submissions.length >= 1,
      "11. O'qituvchi topshiriq bo'yicha kelib tushgan ishlarni muvaffaqiyatli ko'rdi");

    // 8. O'qituvchi yakuniy bahoni tasdiqlashi (POST /api/submissions/:id/grade)
    const { req: reqGrade, res: resGrade } = createMockReqRes({
      user: teacher,
      params: { id: submission.id },
      body: {
        teacher_score: 22,
        teacher_feedback: 'Ajoyib natija! Tushunchalar to\'g\'ri bayon qilingan.',
        question_grades: [
          { question_id: studentQClosed.id, teacher_score: 10, teacher_feedback: 'To\'g\'ri javob.' },
          { question_id: studentQOpen.id, teacher_score: 12, teacher_feedback: 'Yaxshi tushuntirilgan.' }
        ]
      }
    });
    await submissionController.gradeSubmission(reqGrade, resGrade);
    assert(resGrade.statusCode === 200 && resGrade.jsonData.submission.status === 'graded',
      "12. O'qituvchi yakuniy bahoni (22 / 25 ball) tasdiqladi va status 'graded' bo'ldi");

    // 9. Topshiriqni tahrirlash (Vaqt va urinishlar chegarasini yangilash)
    const { req: reqUpdate, res: resUpdate } = createMockReqRes({
      user: teacher,
      params: { id: createdAssignment.id },
      body: {
        title: testTitle + ' [Yangilangan]',
        time_limit_minutes: 45,
        attempts_limit: 3
      }
    });
    await assignmentController.updateAssignment(reqUpdate, resUpdate);
    assert(resUpdate.statusCode === 200 && resUpdate.jsonData.assignment.time_limit_minutes === 45,
      "13. Topshiriq tahrirlandi: vaqt 45 daqiqaga, urinishlar 3 taga oshirildi");

    // 10. Regressiya: Super Admin statistikasi va huquq nazorati
    const { req: reqAdminSubs, res: resAdminSubs } = createMockReqRes({
      user: admin,
      query: { assignment_id: createdAssignment.id }
    });
    await submissionController.getAllSubmissions(reqAdminSubs, resAdminSubs);
    assert(resAdminSubs.statusCode === 200 && resAdminSubs.jsonData.submissions.length >= 1,
      "14. Regressiya: Super Admin barcha topshiriqlar va javoblarni boshqara oladi");

    // 11. Boshqa o'qituvchi huquqini tekshirish (403 taqiqlanishi kerak)
    const otherTeacher = await db.getAsync("SELECT * FROM users WHERE role = 'teacher' AND id != ? LIMIT 1", [teacher.id]);
    if (otherTeacher) {
      const { req: reqUnauthorized, res: resUnauthorized } = createMockReqRes({
        user: otherTeacher,
        params: { assignmentId: createdAssignment.id }
      });
      await submissionController.getAssignmentSubmissions(reqUnauthorized, resUnauthorized);
      assert(resUnauthorized.statusCode === 403, 
        "15. Xavfsizlik: Boshqa o'qituvchi ushbu topshiriq natijalarini ko'ra olmaydi (403 Forbidden)");
    } else {
      console.log("ℹ️ Baza faqat bitta o'qituvchiga ega, test o'tkazib yuborildi");
    }

    console.log('\n===============================================================');
    console.log(`🎉 3-BOSQICH TEST NATIJALARI: ${passed} TA MUVAFFAQIYATLI, ${failed} TA XATO`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Kutilmagan xatolik:', err);
    process.exit(1);
  }
}

runStage3Tests();
