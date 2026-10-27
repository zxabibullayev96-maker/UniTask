/**
 * UniTask AI - Talaba topshirishi diagnostikasi va regressiya testi
 */

const { db, initDatabase } = require('./server/config/database');
const submissionController = require('./server/controllers/submissionController');
const path = require('path');
const fs = require('fs');

async function runDiagnosisTest() {
  console.log('===============================================================');
  console.log('🧪 TALABA TEST TOPSHIRISH DIAGNOSTIKASI VA TEKSHIRUVI');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [O'TDI] ${message}`);
      passed++;
    } else {
      console.error(`❌ [XATO] ${message}`);
      failed++;
    }
  }

  // 1. Bazani initsializatsiya qilish
  await initDatabase();

  // 2. PRAGMA table_info tekshiruvi
  const cols = await db.allAsync("PRAGMA table_info(submissions)");
  const colNames = cols.map(c => c.name);
  assert(colNames.includes('ai_report'), "submissions jadvalida 'ai_report' ustuni mavjud");
  assert(colNames.includes('attempt_number'), "submissions jadvalida 'attempt_number' ustuni mavjud");
  assert(colNames.includes('total_score'), "submissions jadvalida 'total_score' ustuni mavjud");
  assert(colNames.includes('max_score'), "submissions jadvalida 'max_score' ustuni mavjud");

  // 3. Sinov talabasi va o'qituvchisi
  const student = await db.getAsync("SELECT * FROM users WHERE role = 'student' LIMIT 1");
  const teacher = await db.getAsync("SELECT * FROM users WHERE role = 'teacher' LIMIT 1");
  assert(student && teacher, "Talaba va o'qituvchi akkauntlari mavjud");

  // 4. Sinov topshirig'i yaratish (2 yopiq + 1 ochiq savol)
  const aRes = await db.runAsync(`
    INSERT INTO assignments (
      teacher_id, group_id, title, content, open_question, total_points, has_dynamic_questions, attempts_limit
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 2)
  `, [teacher.id, student.group_id, 'Diagnostika Sinov Topshirig\'i', 'Nazariya matni', 'Asosiy savol?', 30]);
  const assignmentId = aRes.lastID;

  // Savollar qo'shish
  const q1 = await db.runAsync(`
    INSERT INTO assignment_questions (assignment_id, question_type, question_text, points, order_index)
    VALUES (?, 'closed', ?, 10, 0)
  `, [assignmentId, "1-savol: O'zbekiston poytaxti qayer?"]);
  await db.runAsync(`INSERT INTO question_options (question_id, option_key, option_text, is_correct, order_index) VALUES (?, 'A', 'Toshkent', 1, 0)`, [q1.lastID]);
  const optB = await db.runAsync(`INSERT INTO question_options (question_id, option_key, option_text, is_correct, order_index) VALUES (?, 'B', 'Samarqand', 0, 1)`, [q1.lastID]);

  const q2 = await db.runAsync(`
    INSERT INTO assignment_questions (assignment_id, question_type, question_text, points, order_index)
    VALUES (?, 'open', ?, 20, 1)
  `, [assignmentId, "2-savol: Sun'iy intellektning ta'limdagi ahamiyati haqida yozing."]);

  // 5. Test sessiyasini boshlash
  let startResData = null;
  const startReq = {
    user: student,
    body: { assignment_id: assignmentId }
  };
  const startRes = {
    status: (code) => ({
      json: (data) => { startResData = { status: code, ...data }; return data; }
    }),
    json: (data) => { startResData = { status: 200, ...data }; return data; }
  };
  await submissionController.startTestSession(startReq, startRes);
  assert(startResData && startResData.success, "Test sessiyasi muvaffaqiyatli ochildi");

  // 6. Talaba javoblarini topshirish (submitAnswer)
  let submitResData = null;
  const submitReq = {
    user: student,
    body: {
      assignment_id: assignmentId,
      answers: JSON.stringify([
        { question_id: q1.lastID, selected_option_id: optB.lastID },
        { question_id: q2.lastID, answer_text: "Sun'iy intellekt ta'lim jarayonini avtomatlashtirish, individual ta'lim trayektoriyasini yaratish va talabalarga xolis baho berishda katta ahamiyatga ega." }
      ])
    }
  };
  const submitRes = {
    status: (code) => ({
      json: (data) => { submitResData = { status: code, ...data }; return data; }
    }),
    json: (data) => { submitResData = { status: 200, ...data }; return data; }
  };

  await submissionController.submitAnswer(submitReq, submitRes);

  assert(submitResData && submitResData.status === 201, "Javoblar 201 Created bilan qabul qilindi");
  assert(submitResData && submitResData.success === true, "Javob topshirish success: true qaytardi");
  assert(submitResData && submitResData.submission, "Yaratilgan submission obyekti qaytdi");

  const subId = submitResData.submission.id;

  // 7. Bazadagi ma'lumotlar to'g'riligini tekshirish
  const savedSub = await db.getAsync("SELECT * FROM submissions WHERE id = ?", [subId]);
  assert(savedSub !== null, "Submission bazada mavjud");
  assert(savedSub.ai_report !== null, "Submission ichida 'ai_report' JSON mavjud");
  assert(savedSub.attempt_number === 1, "attempt_number to'g'ri (1)");

  // 8. Savollar javoblarini tekshirish
  const savedAnswers = await db.allAsync("SELECT * FROM submission_answers WHERE submission_id = ?", [subId]);
  assert(savedAnswers.length === 2, "Bazada 2 ta savol uchun alohida yozuv saqlandi");

  // 9. Natijalarni ko'rish API'sini tekshirish (getSubmissionById)
  let getSubData = null;
  const getSubReq = {
    user: student,
    params: { id: subId }
  };
  const getSubRes = {
    status: (code) => ({
      json: (data) => { getSubData = { status: code, ...data }; return data; }
    }),
    json: (data) => { getSubData = { status: 200, ...data }; return data; }
  };
  await submissionController.getSubmissionById(getSubReq, getSubRes);
  assert(getSubData && getSubData.success === true, "getSubmissionById muvaffaqiyatli ishlaydi");
  assert(getSubData.submission.ai_report && typeof getSubData.submission.ai_report === 'object', "ai_report to'g'ri JSON sifatida parse qilingan");
  assert(getSubData.submission.answers.length === 2, "answers ro'yxati to'liq chiqdi");

  // 10. Bir xil urinishni qayta yuborish urinishi (Double submit / UNIQUE constraint)
  let dupSubmitData = null;
  const dupRes = {
    status: (code) => ({
      json: (data) => { dupSubmitData = { status: code, ...data }; return data; }
    }),
    json: (data) => { dupSubmitData = { status: 200, ...data }; return data; }
  };
  await submissionController.submitAnswer(submitReq, dupRes);
  // Ikkinchi marta topshirganda 2-urinish ochiladi (chunki attempts_limit = 2)
  assert(dupSubmitData && dupSubmitData.status === 201, "2-urinish muvaffaqiyatli topshirildi");

  // 3-marta topshirishga uringanda (limit 2 ta edi):
  let limitSubmitData = null;
  const limitRes = {
    status: (code) => ({
      json: (data) => { limitSubmitData = { status: code, ...data }; return data; }
    }),
    json: (data) => { limitSubmitData = { status: 200, ...data }; return data; }
  };
  await submissionController.submitAnswer(submitReq, limitRes);
  assert(limitSubmitData && limitSubmitData.status === 400, "Limit tugaganda 400 xatolik bilan rad etildi (500 emas)");

  console.log('\n===============================================================');
  console.log(`📊 DIAGNOSTIKA NATIJASI: ${passed} ta o'tdi, ${failed} ta xato`);
  console.log('===============================================================\n');

  if (failed === 0) {
    console.log('🎉 Diagnostika va barcha tekshiruvlar 100% muvaffaqiyatli o\'tdi!');
  } else {
    process.exit(1);
  }
}

runDiagnosisTest().catch(err => {
  console.error("Testda xatolik:", err);
  process.exit(1);
});
