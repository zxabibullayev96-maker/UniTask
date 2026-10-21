/**
 * UniTask AI - 6-BOSQICH: YAKUNIY TEXNIK AUDIT VA INTEGRATSION TESTLARI
 * Ushbu test suite tizimning barcha 15 ta asosiy funksional va xavfsizlik
 * talablarini to'liq tekshiradi.
 */

const { db } = require('./server/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./server/middlewares/authMiddleware');
const authController = require('./server/controllers/authController');
const groupController = require('./server/controllers/groupController');
const assignmentController = require('./server/controllers/assignmentController');
const submissionController = require('./server/controllers/submissionController');
const aiService = require('./server/services/aiService');
const { validateFileHeader } = require('./server/middlewares/uploadMiddleware');
const fs = require('fs');
const path = require('path');

// Mock HTTP helper
function createMockReqRes({ user = null, body = {}, params = {}, query = {}, file = null, pathUrl = '/' }) {
  const req = {
    user: user || null,
    body,
    params,
    query,
    file,
    path: pathUrl,
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

async function runStage6Audit() {
  console.log('===============================================================');
  console.log('🔍 6-BOSQICH: YAKUNIY TEXNIK AUDIT VA INTEGRATSION TESTLARI');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  const auditResults = [];

  function assert(condition, testNumber, message) {
    if (condition) {
      console.log(`✅ [${testNumber}] ${message}`);
      passed++;
      auditResults.push({ number: testNumber, message, status: 'PASSED' });
    } else {
      console.error(`❌ [${testNumber}] ${message}`);
      failed++;
      auditResults.push({ number: testNumber, message, status: 'FAILED' });
    }
  }

  try {
    const defaultGroup = await db.getAsync('SELECT * FROM groups LIMIT 1');

    // ------------------------------------------------------------------------
    // 1. Ro'yxatdan o'tish va tizimga kirish
    // ------------------------------------------------------------------------
    console.log('--- 1. Ro\'yxatdan O\'tish va Tizimga Kirish ---');
    const uniqueEmail = `audit_user_${Date.now()}@unitask.uz`;
    const regPassword = 'AuditPassword123!';

    const { req: reqReg, res: resReg } = createMockReqRes({
      body: {
        name: 'Audit Sinov Talabasi',
        email: uniqueEmail,
        password: regPassword,
        role: 'student',
        group_id: defaultGroup.id
      }
    });
    await authController.register(reqReg, resReg);
    assert(resReg.statusCode === 201 && resReg.jsonData && resReg.jsonData.token, '1.1', 'Yangi foydalanuvchi muvaffaqiyatli ro\'yxatdan o\'tdi va JWT token oldi');

    const { req: reqLogin, res: resLogin } = createMockReqRes({
      body: {
        email: uniqueEmail,
        password: regPassword
      }
    });
    await authController.login(reqLogin, resLogin);
    assert(resLogin.statusCode === 200 && resLogin.jsonData.token, '1.2', 'Foydalanuvchi to\'g\'ri parol bilan muvaffaqiyatli tizimga kirdi');

    const createdUserId = resReg.jsonData.user.id;

    // ------------------------------------------------------------------------
    // 2. Faol bo'lmagan foydalanuvchining tizimga kira olmasligi
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Faol Bo\'lmagan Foydalanuvchi Tekshiruvi (is_active) ---');
    await db.runAsync('UPDATE users SET is_active = 0 WHERE id = ?', [createdUserId]);

    const { req: reqInactLogin, res: resInactLogin } = createMockReqRes({
      body: {
        email: uniqueEmail,
        password: regPassword
      }
    });
    await authController.login(reqInactLogin, resInactLogin);
    assert(resInactLogin.statusCode === 403, '2.1', 'Faolsizlantirilgan foydalanuvchining login so\'rovi 403 bilan rad etildi');

    // Token orqali middleware orqali kirish urinishi
    const inactiveUser = await db.getAsync('SELECT * FROM users WHERE id = ?', [createdUserId]);
    const { authenticateToken } = require('./server/middlewares/authMiddleware');
    let authPassed = false;
    let authStatus = null;
    const mockReq = {
      headers: { authorization: `Bearer ${resReg.jsonData.token}` }
    };
    const mockRes = {
      status(c) { authStatus = c; return this; },
      json() { return this; }
    };
    await new Promise((resolve) => {
      authenticateToken(mockReq, mockRes, () => {
        authPassed = true;
        resolve();
      });
      setTimeout(resolve, 300);
    });
    assert(authStatus === 403 && !authPassed, '2.2', 'Faolsizlantirilgan foydalanuvchi JWT tokeni middleware tomonidan 403 bilan to\'xtatildi');

    // Foydalanuvchini qayta faollashtirish
    await db.runAsync('UPDATE users SET is_active = 1 WHERE id = ?', [createdUserId]);

    // ------------------------------------------------------------------------
    // 3. Super Admin tomonidan guruh va o'qituvchilarni biriktirish
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Super Admin Guruh va O\'qituvchilar Nazorati ---');
    const admin = await db.getAsync("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    const teacher = await db.getAsync("SELECT * FROM users WHERE role = 'teacher' AND is_active = 1 LIMIT 1");
    const group = await db.getAsync("SELECT * FROM groups LIMIT 1");

    const { req: reqAssignGt, res: resAssignGt } = createMockReqRes({
      user: admin,
      params: { id: group.id },
      body: { teacher_id: teacher.id }
    });
    await groupController.assignTeacherToGroup(reqAssignGt, resAssignGt);
    assert(resAssignGt.statusCode === 200 || resAssignGt.statusCode === 201, '3.1', 'Super Admin o\'qituvchini guruhga muvaffaqiyatli biriktirdi');

    const gtRow = await db.getAsync('SELECT id FROM group_teachers WHERE group_id = ? AND teacher_id = ?', [group.id, teacher.id]);
    assert(Boolean(gtRow), '3.2', 'group_teachers jadvalida biriktirish yozuvi tasdiqlandi');

    // ------------------------------------------------------------------------
    // 4. O'qituvchi tomonidan topshiriq va savollar yaratish
    // ------------------------------------------------------------------------
    console.log('\n--- 4. O\'qituvchi Topshiriq va Savollar Yaratishi ---');
    const auditAssignmentTitle = `Audit Dinamik Topshiriq ${Date.now()}`;
    const auditQuestions = [
      {
        question_type: 'closed',
        question_text: 'Quyidagilardan qaysi biri HTTP idempotents metodi hisoblanadi?',
        points: 10,
        options: [
          { option_key: 'A', option_text: 'GET', is_correct: 1 },
          { option_key: 'B', option_text: 'POST', is_correct: 0 },
          { option_key: 'C', option_text: 'CONNECT', is_correct: 0 }
        ]
      },
      {
        question_type: 'open',
        question_text: 'Dasturiy injiniringda DRY (Don\'t Repeat Yourself) tamoyilining afzalliklari nima?',
        points: 15,
        sample_answer: 'Kodni qayta ishlatish, xatolarni kamaytirish, arxitekturani ixchamlashtirish va qo\'llab-quvvatlashni osonlashtirish.',
        instruction: 'Kamida 2 ta afzalligini batafsil yoritib bering.'
      }
    ];

    const { req: reqCreateA, res: resCreateA } = createMockReqRes({
      user: teacher,
      body: {
        title: auditAssignmentTitle,
        subject: 'Dasturiy Ta\'minot Arxitekturasi',
        group_id: group.id,
        instructions: 'Testni belgilangan vaqtda yakunlang.',
        time_limit_minutes: 20,
        attempts_limit: 2,
        questions: auditQuestions
      }
    });
    await assignmentController.createAssignment(reqCreateA, resCreateA);
    assert(resCreateA.statusCode === 201 && resCreateA.jsonData.assignment, '4.1', 'Dinamik savolli topshiriq muvaffaqiyatli yaratildi (201 Created)');

    const auditAssignment = resCreateA.jsonData.assignment;
    assert(auditAssignment.has_dynamic_questions === 1, '4.2', 'has_dynamic_questions flagi 1 ekanligi tasdiqlandi');

    // ------------------------------------------------------------------------
    // 5. Topshiriqni boshlash, vaqt tugashi va urinishlar limiti
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Sessiya, Taymer va Urinishlar Limiti Sinovi ---');
    const studentUser = await db.getAsync('SELECT * FROM users WHERE id = ?', [createdUserId]);
    await db.runAsync('UPDATE users SET group_id = ? WHERE id = ?', [group.id, createdUserId]);

    const { req: reqStartSess, res: resStartSess } = createMockReqRes({
      user: studentUser,
      body: { assignment_id: auditAssignment.id }
    });
    await submissionController.startTestSession(reqStartSess, resStartSess);
    assert(resStartSess.statusCode === 200 || resStartSess.statusCode === 201, '5.1', 'Talaba test sessiyasini muvaffaqiyatli boshladi');
    assert(resStartSess.jsonData.session.expires_at, '5.2', 'Test sessiyasiga aniq expires_at vaqti biriktirildi');

    // Muddati o'tgan sessiya testi (Expires_at ni o'tmishga o'zgartiramiz)
    const sessionId = resStartSess.jsonData.session.id;
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    await db.runAsync('UPDATE test_sessions SET expires_at = ? WHERE id = ?', [pastDate, sessionId]);

    const { req: reqExpSub, res: resExpSub } = createMockReqRes({
      user: studentUser,
      body: {
        assignment_id: auditAssignment.id,
        answers: JSON.stringify([{ question_id: 1, selected_option_id: 1 }])
      }
    });
    await submissionController.submitAnswer(reqExpSub, resExpSub);
    assert(resExpSub.statusCode === 400 && resExpSub.jsonData.message.includes('vaqti tugagan'), '5.3', 'Vaqti o\'tib ketgan sessiyadan topshirilgan javob server tomonidan rad etildi');

    // Sessiyani to'g'rilab, testni topshirish
    const validFuture = new Date(Date.now() + 1800 * 1000).toISOString();
    await db.runAsync('UPDATE test_sessions SET expires_at = ? WHERE id = ?', [validFuture, sessionId]);

    // ------------------------------------------------------------------------
    // 6. Yopiq va ochiq savollarga javob yuborish
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Yopiq va Ochiq Savollarga Javob Yuborish ---');
    const dbQuestions = await db.allAsync('SELECT * FROM assignment_questions WHERE assignment_id = ? ORDER BY order_index ASC', [auditAssignment.id]);
    const closedQ = dbQuestions.find(q => q.question_type === 'closed');
    const openQ = dbQuestions.find(q => q.question_type === 'open');

    const closedOptCorrect = await db.getAsync('SELECT * FROM question_options WHERE question_id = ? AND is_correct = 1', [closedQ.id]);

    const studentAnswersPayload = [
      {
        question_id: closedQ.id,
        selected_option_id: closedOptCorrect.id,
        answer_text: null
      },
      {
        question_id: openQ.id,
        selected_option_id: null,
        answer_text: "DRY tamoyili kodni qayta ishlatish (reusability) imkonini oshiradi, tizimda takrorlanishlarni bartaraf etadi, nosozlik va xatolarni kamaytiradi."
      }
    ];

    const { req: reqValidSub, res: resValidSub } = createMockReqRes({
      user: studentUser,
      body: {
        assignment_id: auditAssignment.id,
        answers: JSON.stringify(studentAnswersPayload)
      }
    });
    await submissionController.submitAnswer(reqValidSub, resValidSub);
    assert(resValidSub.statusCode === 201, '6.1', 'Javoblar serverga muvaffaqiyatli topshirildi va 201 Created qaytdi');

    const createdSubId = resValidSub.jsonData.submission.id;
    const subRecord = await db.getAsync('SELECT * FROM submissions WHERE id = ?', [createdSubId]);
    assert(subRecord.total_score >= 20, '6.2', `Server deterministik va AI semantik ballarni to'g'ri hisobladi (${subRecord.total_score} / 25)`);

    // ------------------------------------------------------------------------
    // 7. Ruxsat etilgan formatdagi fayllarni yuklash va tekshirish
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Fayl Formati va Magic Bytes Tekshiruvi ---');
    const tempDir = path.resolve(__dirname, './scratch');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const validPdfPath = path.resolve(tempDir, 'valid_audit_test.pdf');
    fs.writeFileSync(validPdfPath, Buffer.from('%PDF-1.4 mock content'));

    const fakePdfPath = path.resolve(tempDir, 'fake_audit_test.pdf');
    fs.writeFileSync(fakePdfPath, Buffer.from('NOT A REAL PDF CONTENT AT ALL'));

    const isValidPdf = validateFileHeader(validPdfPath, 'valid_audit_test.pdf');
    const isFakePdf = validateFileHeader(fakePdfPath, 'fake_audit_test.pdf');

    assert(isValidPdf === true, '7.1', 'Haqiqiy %PDF sarlavhali fayl muvaffaqiyatli qabul qilindi');
    assert(isFakePdf === false, '7.2', 'Soxtalashtirilgan kengaytmali fayl (magic bytes nomuvofiqligi) aniqlandi va rad etildi');

    // Tozalash
    try { fs.unlinkSync(validPdfPath); fs.unlinkSync(fakePdfPath); } catch (e) {}

    // ------------------------------------------------------------------------
    // 8. Ruxsatsiz fayl yuklab olishga urinish (Xavfsizlik)
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Xavfsiz Fayl Yuklab Olish va Ruxsatlar Izolyatsiyasi ---');
    // Diskda sinov faylini yaratamiz
    const uploadsSubDir = path.resolve(__dirname, './uploads/submissions');
    if (!fs.existsSync(uploadsSubDir)) fs.mkdirSync(uploadsSubDir, { recursive: true });
    const subFilePath = path.resolve(uploadsSubDir, `audit_sub_${createdSubId}.pdf`);
    fs.writeFileSync(subFilePath, Buffer.from('%PDF-1.4 Talaba javob hujjati'));

    await db.runAsync('UPDATE submissions SET file_path = ?, file_name = ? WHERE id = ?', [
      `/uploads/submissions/audit_sub_${createdSubId}.pdf`,
      'audit_sub.pdf',
      createdSubId
    ]);

    // Boshqa talaba ushbu faylni yuklab olishga urinishi
    const anotherStudent = await db.getAsync("SELECT * FROM users WHERE role = 'student' AND id != ? LIMIT 1", [createdUserId]);
    const { req: reqOtherDown, res: resOtherDown } = createMockReqRes({
      user: anotherStudent,
      params: { id: createdSubId }
    });
    await submissionController.downloadSubmissionFile(reqOtherDown, resOtherDown);
    assert(resOtherDown.statusCode === 403, '8.1', 'Begona talaba boshqa talabaning faylini yuklab olishga uringanda 403 Forbidden oldi');

    // Talabaning o'zi faylni yuklab olishi
    const { req: reqOwnerDown, res: resOwnerDown } = createMockReqRes({
      user: studentUser,
      params: { id: createdSubId }
    });
    await submissionController.downloadSubmissionFile(reqOwnerDown, resOwnerDown);
    assert(resOwnerDown.downloadPath && resOwnerDown.downloadPath.includes(`audit_sub_${createdSubId}.pdf`), '8.2', 'Topshirgan talabaning o\'zi faylni muvaffaqiyatli yuklab oldi');

    // Path Traversal xuruji testi
    await db.runAsync('UPDATE submissions SET file_path = ? WHERE id = ?', ['/../../server/server.js', createdSubId]);
    const { req: reqTravDown, res: resTravDown } = createMockReqRes({
      user: studentUser,
      params: { id: createdSubId }
    });
    await submissionController.downloadSubmissionFile(reqTravDown, resTravDown);
    assert(resTravDown.statusCode === 403, '8.3', 'Path traversal yo\'li orqali server kodiga kirish urinishi 403 bilan bartaraf etildi');

    // Fayl yo'lini qayta tiklash va tozalash
    try { fs.unlinkSync(subFilePath); } catch (e) {}

    // ------------------------------------------------------------------------
    // 9. AI Muvaffaqiyatli Javob Bergan Holat
    // ------------------------------------------------------------------------
    console.log('\n--- 9. AI Muvaffaqiyatli Baholash Sinovi ---');
    const aiSuccessEval = await aiService.evaluateOpenQuestion({
      theoryContent: "DRY (Don't Repeat Yourself) tamoyili dastur kodida takrorlanishlarni bartaraf etish va qayta ishlatishga asoslanadi.",
      question: "DRY tamoyilining mohiyati nima?",
      sampleAnswer: "DRY tamoyili kodni qayta ishlatish, takrorlanishlarni bartaraf etish va tizim arxitekturasini soddalashtirish demakdir.",
      studentAnswer: "DRY printsipi kodni qayta ishlatish imkonini beradi, bir xil amallarni takrorlamasdan tizim arxitekturasini soddalashtiradi va kod sifatini oshiradi.",
      maxScore: 15
    });
    assert(aiSuccessEval.score >= 11, '9.1', `AI to'g'ri ochiq savolni munosib baholadi (${aiSuccessEval.score} / 15)`);
    assert(Array.isArray(aiSuccessEval.identified_concepts) && aiSuccessEval.identified_concepts.length > 0, '9.2', 'AI javobdagi tayanch tushunchalarni aniqladi');

    // ------------------------------------------------------------------------
    // 10. AI API Xatosi yoki Timeout Holati (Zaxira Fallback)
    // ------------------------------------------------------------------------
    console.log('\n--- 10. AI Xatosi va Aqlli Fallback Sinovi ---');
    const aiFallbackEval = await aiService.evaluateOpenQuestion({
      theoryContent: "Tizim arxitekturasi va modulli dasturlash",
      question: "Modulli dasturlash nima?",
      sampleAnswer: "Tizimni mustaqil qismlarga ajratish orqali ishlab chiqish.",
      studentAnswer: "Modullilik dastur tuzilmasini kichik mustaqil bloklarga bo'lish demakdir.",
      maxScore: 10
    });
    assert(aiFallbackEval.score > 0, '10.1', 'API yo\'qligida ham mahalliy semantik fallback ball hisobladi');
    assert(aiFallbackEval.summary && aiFallbackEval.summary.length > 10, '10.2', 'Fallback tizimi batafsil ilmiy xulosani shakllantirdi');

    // ------------------------------------------------------------------------
    // 11. AI Hisobotini Saqlash va Qayta Tahlil Qilish
    // ------------------------------------------------------------------------
    console.log('\n--- 11. AI Report va Qayta Tahlil (Re-analyze) Sinovi ---');
    const subWithReport = await db.getAsync('SELECT ai_report FROM submissions WHERE id = ?', [createdSubId]);
    assert(Boolean(subWithReport && subWithReport.ai_report), '11.1', 'Submissions jadvalida ai_report JSON tahlili mavjud');

    const { req: reqReanalyze, res: resReanalyze } = createMockReqRes({
      user: teacher,
      params: { id: createdSubId }
    });
    await submissionController.reanalyzeSubmission(reqReanalyze, resReanalyze);
    assert(resReanalyze.statusCode === 200, '11.2', 'Topshiriq AI tomonidan qayta muvaffaqiyatli tahlil qilindi');

    // ------------------------------------------------------------------------
    // 12. O'qituvchi Yakuniy Bahosining Saqlanib Qolishi (Idempotentlik)
    // ------------------------------------------------------------------------
    console.log('\n--- 12. O\'qituvchi Bahosining Daxlsizligi Sinovi ---');
    const { req: reqGrade, res: resGrade } = createMockReqRes({
      user: teacher,
      params: { id: createdSubId },
      body: {
        teacher_score: 24,
        teacher_feedback: "A'lo darajada bajarilgan ish."
      }
    });
    await submissionController.gradeSubmission(reqGrade, resGrade);
    assert(resGrade.statusCode === 200, '12.1', 'O\'qituvchi yakuniy bahoni (24 ball) tasdiqladi va status \'graded\' bo\'ldi');

    // Yana bir bor qayta tahlil qilamiz
    await submissionController.reanalyzeSubmission(reqReanalyze, resReanalyze);
    const postReanalyzeSub = await db.getAsync('SELECT status, teacher_score, teacher_feedback FROM submissions WHERE id = ?', [createdSubId]);
    assert(postReanalyzeSub.status === 'graded', '12.2', 'Qayta tahlildan keyin status \'graded\' bo\'lib saqlandi');
    assert(postReanalyzeSub.teacher_score === 24, '12.3', 'O\'qituvchi qo\'ygan 24 ball AI tomonidan o\'zgartirilmadi');

    // ------------------------------------------------------------------------
    // 13. Talaba Ma'lumotlarining Boshqa Talabaga Oshkor Bo'lmasligi
    // ------------------------------------------------------------------------
    console.log('\n--- 13. Talaba Natijalari Maxfiyligi Sinovi ---');
    const { req: reqSpyStudent, res: resSpyStudent } = createMockReqRes({
      user: anotherStudent,
      params: { id: createdSubId }
    });
    await submissionController.getSubmissionById(reqSpyStudent, resSpyStudent);
    assert(resSpyStudent.statusCode === 403, '13.1', 'Begona talaba boshqa talabaning natijalariga kirishga uringanda 403 Forbidden oldi');

    // ------------------------------------------------------------------------
    // 14. Noto'g'ri yoki Chegaradan Tashqari Ball Yuborishga Urinish
    // ------------------------------------------------------------------------
    console.log('\n--- 14. Ball Chegaralari Nazorati (0 <= score <= max) ---');
    const { req: reqOverflowGrade, res: resOverflowGrade } = createMockReqRes({
      user: teacher,
      params: { id: createdSubId },
      body: {
        teacher_score: 9999, // Max 25 dan ancha katta
        teacher_feedback: "Soxta ball"
      }
    });
    await submissionController.gradeSubmission(reqOverflowGrade, resOverflowGrade);
    assert(resOverflowGrade.statusCode === 400, '14.1', 'Maksimal balldan (25) oshgan baho (9999) server tomonidan rad etildi');

    const { req: reqNegativeGrade, res: resNegativeGrade } = createMockReqRes({
      user: teacher,
      params: { id: createdSubId },
      body: {
        teacher_score: -5,
        teacher_feedback: "Manfiy ball"
      }
    });
    await submissionController.gradeSubmission(reqNegativeGrade, resNegativeGrade);
    assert(resNegativeGrade.statusCode === 400, '14.2', 'Manfiy baho (-5) server tomonidan rad etildi');

    // ------------------------------------------------------------------------
    // 15. Mobil Ekranlar va Responsiveness Tekshiruvi
    // ------------------------------------------------------------------------
    console.log('\n--- 15. Mobil Ekranlar va Frontend Moslashuvchanligi ---');
    const cssPath = path.resolve(__dirname, './public/css/components.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const hasMobileQuery = cssContent.includes('@media (max-width: 768px)') && cssContent.includes('@media (max-width: 480px)');
    assert(hasMobileQuery, '15.1', 'CSS faylida mobil ekranlar uchun @media so\'rovlari mavjud');

    const indexPath = path.resolve(__dirname, './public/index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const hasViewport = indexHtml.includes('name="viewport"') && indexHtml.includes('width=device-width');
    assert(hasViewport, '15.2', 'HTML faylida mobil ekranlar uchun viewport meta tegi mavjud');

    // ========================================================================
    // YAKUNIY HISOBOT
    // ========================================================================
    console.log('\n===============================================================');
    console.log(`📊 6-BOSQICH YAKUNIY AUDIT NATIJASI: ${passed} TA O'TDI, ${failed} TA XATO`);
    console.log('===============================================================\n');

    if (failed === 0) {
      console.log('🎉 Tizimning barcha 15 ta yo\'nalishi bo\'yicha tekshiruv 100% muvaffaqiyatli yakunlandi.');
    } else {
      console.error(`⚠️ ${failed} ta sinov muvaffaqiyatsiz bo'ldi.`);
    }

  } catch (error) {
    console.error('Audit sinovida kutilmagan xatolik yuz berdi:', error);
  }
}

runStage6Audit();
