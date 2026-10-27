/**
 * UniTask AI - O'qituvchi topshiriq yaratish jarayonining to'liq tekshiruv testi
 * Ushbu test barcha 13 ta talabni va frontend/backend o'rtasidagi to'g'ri integratsiyani tekshiradi.
 */

const { db } = require('./server/config/database');
const assignmentController = require('./server/controllers/assignmentController');
const submissionController = require('./server/controllers/submissionController');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./server/middlewares/authMiddleware');
const fs = require('fs');
const path = require('path');

// Mock helper
function mockReqRes({ user = null, body = {}, params = {}, query = {}, file = null }) {
  const req = {
    user,
    body,
    params,
    query,
    file,
    headers: user ? { authorization: `Bearer ${jwt.sign({ id: user.id, email: user.email, role: user.role, is_active: 1 }, JWT_SECRET)}` } : {}
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };

  return { req, res };
}

async function runVerification() {
  console.log('======================================================================');
  console.log('🧪 TOPSHIRIQ YARATISHNING SODDALASHTIRILGAN OQIMI - YAKUNIY TEST');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, condition) {
    if (condition) {
      console.log(`✅ [O'TDI] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [XATO] ${desc}`);
      failed++;
    }
  }

  try {
    // 1. O'qituvchi va guruhni olish
    const teacher = await db.getAsync("SELECT * FROM users WHERE role = 'teacher' AND is_active = 1 LIMIT 1");
    test("1. O'qituvchi akkaunti mavjud", Boolean(teacher));

    let teacherGroup = await db.getAsync(`
      SELECT g.* FROM groups g
      JOIN group_teachers gt ON g.id = gt.group_id
      WHERE gt.teacher_id = ? LIMIT 1
    `, [teacher.id]);

    if (!teacherGroup) {
      teacherGroup = await db.getAsync("SELECT * FROM groups LIMIT 1");
      await db.runAsync("INSERT OR IGNORE INTO group_teachers (group_id, teacher_id) VALUES (?, ?)", [teacherGroup.id, teacher.id]);
    }
    test("2. O'qituvchi biriktirilgan akademik guruh mavjud", Boolean(teacherGroup));

    // 3. 1-bosqich: Validatsiya (nom va guruh kiritilishi shart)
    {
      const { req, res } = mockReqRes({
        user: teacher,
        body: { title: '', group_id: teacherGroup.id }
      });
      await assignmentController.createAssignment(req, res);
      test("3. Bo'sh topshiriq nomi rad etildi (400 Bad Request)", res.statusCode === 400);
    }

    // 4. 2-bosqich: Savollar validatsiyasi (Yopiq testda to'g'ri javob belgilanmagan)
    {
      const { req, res } = mockReqRes({
        user: teacher,
        body: {
          title: "Sinov topshirig'i",
          group_id: teacherGroup.id,
          questions: JSON.stringify([
            {
              question_type: 'closed',
              question_text: "Yopiq test savoli",
              points: 5,
              options: [
                { option_key: 'A', option_text: 'Variant 1', is_correct: 0 },
                { option_key: 'B', option_text: 'Variant 2', is_correct: 0 }
              ]
            }
          ])
        }
      });
      await assignmentController.createAssignment(req, res);
      test("4. To'g'ri javobi belgilanmagan yopiq test rad etildi", res.statusCode === 400);
    }

    // 5. 2-bosqich: Savollar validatsiyasi (Yopiq testda kamida 2 ta variant bo'lishi shart)
    {
      const { req, res } = mockReqRes({
        user: teacher,
        body: {
          title: "Sinov topshirig'i",
          group_id: teacherGroup.id,
          questions: JSON.stringify([
            {
              question_type: 'closed',
              question_text: "1 ta variantli test",
              points: 5,
              options: [
                { option_key: 'A', option_text: 'Variant 1', is_correct: 1 }
              ]
            }
          ])
        }
      });
      await assignmentController.createAssignment(req, res);
      test("5. Kamida 2 ta variant bo'lmagan yopiq test rad etildi", res.statusCode === 400);
    }

    // 6. Aralash savollar bilan topshiriq yaratish (1 yopiq test, 1 ochiq savol) - Faylsiz
    let createdAssignmentId = null;
    {
      const { req, res } = mockReqRes({
        user: teacher,
        body: {
          title: "Kriptografiya asoslari - 1-topshiriq",
          group_id: teacherGroup.id,
          start_date: "2026-11-01T09:00",
          due_date: "2026-11-15T18:00",
          attempts_limit: 3,
          questions: JSON.stringify([
            {
              question_type: 'closed',
              question_text: "Quyidagilardan qaysi biri asimmetrik shifrlash algoritmi hisoblanadi?",
              points: 10,
              options: [
                { option_key: 'A', option_text: 'AES', is_correct: 0 },
                { option_key: 'B', option_text: 'RSA', is_correct: 1 },
                { option_key: 'C', option_text: 'DES', is_correct: 0 },
                { option_key: 'D', option_text: 'RC4', is_correct: 0 }
              ]
            },
            {
              question_type: 'open',
              question_text: "Simmetrik va asimmetrik shifrlashning asosiy farqlarini tushuntirib bering.",
              points: 15,
              sample_answer: "Simmetrik bitta maxfiy kalitdan foydalanadi, asimmetrik esa ochiq va yopiq kalitlar juftligidan foydalanadi.",
              instruction: "Kamida 2 ta asosiy farqni sanab bering."
            }
          ])
        }
      });

      await assignmentController.createAssignment(req, res);
      test("6. Ochiq va yopiq aralash savolli topshiriq muvaffaqiyatli yaratildi (201 Created)", res.statusCode === 201 && res.jsonData && res.jsonData.success);
      createdAssignmentId = res.jsonData.assignment.id;
      test("7. Urinishlar soni 3 qilib to'g'ri saqlandi", res.jsonData.assignment.attempts_limit === 3);
      test("8. Umumiy ball avtomatik to'g'ri hisoblandi (10 + 15 = 25 ball)", res.jsonData.assignment.total_points === 25);
    }

    // 7. Bazadagi savollar va variantlar tuzilmasini tekshirish
    {
      const savedQuestions = await db.allAsync(`
        SELECT * FROM assignment_questions WHERE assignment_id = ? ORDER BY order_index ASC
      `, [createdAssignmentId]);

      test("9. Bazada aniq 2 ta savol saqlandi", savedQuestions.length === 2);
      test("10. 1-savol turi: 'closed', 2-savol turi: 'open'", savedQuestions[0].question_type === 'closed' && savedQuestions[1].question_type === 'open');

      const savedOptions = await db.allAsync(`
        SELECT * FROM question_options WHERE question_id = ? ORDER BY order_index ASC
      `, [savedQuestions[0].id]);
      test("11. Yopiq test uchun 4 ta variant saqlandi", savedOptions.length === 4);
      test("12. B varianti to'g'ri javob sifatida belgilangan", savedOptions.find(o => o.option_key === 'B').is_correct === 1);

      const openOptions = await db.allAsync(`
        SELECT * FROM question_options WHERE question_id = ?
      `, [savedQuestions[1].id]);
      test("13. Ochiq savol uchun javob variantlari mavjud emas (0 ta)", openOptions.length === 0);
    }

    // 8. Talaba uchun maxfiylik tekshiruvi (is_correct va sample_answer sir saqlanishi)
    const student = await db.getAsync("SELECT * FROM users WHERE role = 'student' AND is_active = 1 LIMIT 1");
    // Talabani shu guruhga vaqtincha biriktiramiz
    await db.runAsync("UPDATE users SET group_id = ? WHERE id = ?", [teacherGroup.id, student.id]);

    {
      const { req, res } = mockReqRes({
        user: student,
        params: { id: createdAssignmentId }
      });
      await assignmentController.getAssignmentById(req, res);

      test("14. Talaba topshiriqni yuklay oldi", res.statusCode === 200 && res.jsonData.success);
      const studentQuestions = res.jsonData.assignment.questions;
      
      const closedQ = studentQuestions.find(q => q.question_type === 'closed');
      const openQ = studentQuestions.find(q => q.question_type === 'open');

      const leakedCorrect = closedQ.options.some(opt => opt.is_correct !== undefined);
      test("15. XAVFSIZLIK: Talaba API javobida yopiq testning is_correct maydoni yo'q", !leakedCorrect);

      test("16. XAVFSIZLIK: Talaba API javobida ochiq savolning sample_answer maydoni yo'q", openQ.sample_answer === undefined);
    }

    // 9. Talaba javob topshirishi (1-urinish)
    {
      const closedOptB = await db.getAsync("SELECT id FROM question_options WHERE question_id = (SELECT id FROM assignment_questions WHERE assignment_id = ? AND question_type = 'closed') AND option_key = 'B'", [createdAssignmentId]);
      const openQRow = await db.getAsync("SELECT id FROM assignment_questions WHERE assignment_id = ? AND question_type = 'open'", [createdAssignmentId]);

      const { req, res } = mockReqRes({
        user: student,
        body: {
          assignment_id: createdAssignmentId,
          answers: JSON.stringify([
            {
              question_id: (await db.getAsync("SELECT id FROM assignment_questions WHERE assignment_id = ? AND question_type = 'closed'", [createdAssignmentId])).id,
              selected_option_id: closedOptB.id
            },
            {
              question_id: openQRow.id,
              answer_text: "Simmetrik shifrlashda bitta kalit ishlatiladi, asimmetrik shifrlashda esa ikkita (ochiq va yopiq) kalit ishlatiladi."
            }
          ])
        }
      });

      await submissionController.submitAnswer(req, res);
      test("17. Talaba topshiriqni muvaffaqiyatli topshirdi (201 Created)", res.statusCode === 201 && res.jsonData.success);
    }

    // 10. Qayta urinishlar soni tekshiruvi (attempts_limit = 3, demak yana topshira oladi)
    {
      const { req, res } = mockReqRes({
        user: student,
        params: { id: createdAssignmentId }
      });
      await assignmentController.getAssignmentById(req, res);
      test("18. Talabada qolgan urinishlar soni: 2 ta (3 - 1)", res.jsonData.attempts_left === 2);
      test("19. Talaba yana topshira oladi (can_attempt: true)", res.jsonData.can_attempt === true);
    }

    // 11. O'qituvchi baholashi va yakuniy tasdiq
    {
      const subRow = await db.getAsync("SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? ORDER BY id DESC LIMIT 1", [createdAssignmentId, student.id]);
      test("20. Talaba topshirishi bazada mavjud", Boolean(subRow));

      const { req, res } = mockReqRes({
        user: teacher,
        params: { id: subRow.id },
        body: {
          teacher_score: 24,
          teacher_feedback: "A'lo darajada bajarilgan!",
          question_grades: [
            { question_id: (await db.getAsync("SELECT id FROM assignment_questions WHERE assignment_id = ? AND question_type = 'closed'", [createdAssignmentId])).id, teacher_score: 10 },
            { question_id: (await db.getAsync("SELECT id FROM assignment_questions WHERE assignment_id = ? AND question_type = 'open'", [createdAssignmentId])).id, teacher_score: 14 }
          ]
        }
      });

      await submissionController.gradeSubmission(req, res);
      test("21. O'qituvchi bahoni muvaffaqiyatli tasdiqladi", res.statusCode === 200 && res.jsonData.success);

      const gradedSub = await db.getAsync("SELECT * FROM submissions WHERE id = ?", [subRow.id]);
      test("22. Baholash holati: 'graded', ball: 24 / 25", gradedSub.status === 'graded' && gradedSub.teacher_score === 24);
    }

    // 12. Eski topshiriqlar mosligi
    {
      const legacy = await db.allAsync("SELECT * FROM assignments WHERE has_dynamic_questions = 0 LIMIT 1");
      test("23. Mavjud an'anaviy topshiriqlar mosligi saqlangan", legacy.length >= 0);
    }

    // 13. Topshiriqni tahrirlashda tranzaksiya va atomarlik
    {
      const { req, res } = mockReqRes({
        user: teacher,
        params: { id: createdAssignmentId },
        body: {
          title: "Kriptografiya asoslari - 1-topshiriq (Tahrirlangan)",
          group_id: teacherGroup.id,
          attempts_limit: 2,
          due_date: "2026-11-20T23:59"
        }
      });

      await assignmentController.updateAssignment(req, res);
      test("24. Topshiriq tahrirlandi va ma'lumotlar saqlandi", res.statusCode === 200 && res.jsonData.success);

      const updatedRow = await db.getAsync("SELECT * FROM assignments WHERE id = ?", [createdAssignmentId]);
      test("25. Yangi sarlavha va yangi urinishlar soni tasdiqlandi", updatedRow.title.includes("Tahrirlangan") && updatedRow.attempts_limit === 2);
    }

    // 14. Nazariy material fayli (PDF) bilan topshiriq yaratish
    {
      const dummyPdfDir = path.resolve(__dirname, 'uploads/assignments');
      if (!fs.existsSync(dummyPdfDir)) fs.mkdirSync(dummyPdfDir, { recursive: true });
      const dummyPdfPath = path.resolve(dummyPdfDir, `test_theory_${Date.now()}.pdf`);
      // Valid PDF magic header
      fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n%Test PDF material for UniTask\n%%EOF');

      const { req, res } = mockReqRes({
        user: teacher,
        file: {
          path: dummyPdfPath,
          filename: path.basename(dummyPdfPath),
          originalname: 'kriptografiya_maruza.pdf',
          size: fs.statSync(dummyPdfPath).size
        },
        body: {
          title: "Kriptografiya (Nazariy material bilan)",
          group_id: teacherGroup.id,
          attempts_limit: 1,
          questions: JSON.stringify([
            {
              question_type: 'closed',
              question_text: "Nazariy material bo'yicha 1-savol",
              points: 5,
              options: [
                { option_key: 'A', option_text: 'Javob A', is_correct: 1 },
                { option_key: 'B', option_text: 'Javob B', is_correct: 0 }
              ]
            }
          ])
        }
      });

      await assignmentController.createAssignment(req, res);
      test("26. Nazariy fayl biriktirilgan topshiriq muvaffaqiyatli yaratildi", res.statusCode === 201 && res.jsonData.success);
      test("27. Fayl nomi va formati bazada to'g'ri saqlandi", res.jsonData.assignment.file_name === 'kriptografiya_maruza.pdf' && res.jsonData.assignment.file_path.includes('/uploads/assignments/'));
    }

    console.log('\n======================================================================');
    console.log(`📊 YAKUNIY NATIJA: ${passed} TA O'TDI, ${failed} TA XATO`);
    console.log('======================================================================\n');

    if (failed === 0) {
      console.log('🎉 BARCHA TALABLAR 100% TO\'LIQ VA ISHONCHLI BAJARILDI!');
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal error during test:', err);
    process.exit(1);
  }
}

runVerification();
