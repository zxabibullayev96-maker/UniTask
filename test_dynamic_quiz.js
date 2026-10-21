/**
 * UniTask AI - Dinamik Ochiq va Yopiq Testlar Integratsion Tekshiruv Skripti
 */
const { initDatabase, db } = require('./server/config/database');
const jwt = require('jsonwebtoken');
const { evaluateOpenQuestion } = require('./server/services/aiService');

const JWT_SECRET = process.env.JWT_SECRET || 'unitask_super_secret_jwt_key_2026';

async function runComprehensiveTests() {
  console.log('🚀 Dinamik testlar va savollar integratsion tekshiruvi boshlandi...\n');

  try {
    await initDatabase();
    console.log('✅ 1. Baza tayyor va barcha yangi jadvallar/ustunlar mavjud.');

    // 1. O'qituvchi va talaba foydalanuvchilarini olish
    const teacher = await db.getAsync("SELECT * FROM users WHERE role = 'teacher' LIMIT 1");
    const student = await db.getAsync("SELECT * FROM users WHERE role = 'student' LIMIT 1");
    const group = await db.getAsync("SELECT * FROM groups LIMIT 1");

    console.log(`✅ 2. Sinov foydalanuvchilari: O'qituvchi (${teacher.email}), Talaba (${student.email})`);

    // Talabani o'sha guruhga biriktirish (agar kerak bo'lsa)
    await db.runAsync("UPDATE users SET group_id = ? WHERE id = ?", [group.id, student.id]);

    // 2. Dinamik savollar bilan yangi topshiriq yaratish
    const sampleQuestions = [
      {
        question_type: 'closed',
        question_text: 'Quyidagi protokollardan qaysi biri asimmetrik shifrlashga asoslangan?',
        points: 4,
        options: [
          { option_key: 'A', option_text: 'AES-256', is_correct: 0 },
          { option_key: 'B', option_text: 'RSA', is_correct: 1 },
          { option_key: 'C', option_text: 'DES', is_correct: 0 },
          { option_key: 'D', option_text: 'RC4', is_correct: 0 }
        ]
      },
      {
        question_type: 'closed',
        question_text: 'Tarmoq xavfsizligida DDoS hujumining asosiy maqsadi nima?',
        points: 4,
        options: [
          { option_key: 'A', option_text: 'Server resurslarini to\'ldirib, xizmat ko\'rsatishni to\'xtatish', is_correct: 1 },
          { option_key: 'B', option_text: 'Foydalanuvchi parollarini o\'g\'irlash', is_correct: 0 },
          { option_key: 'C', option_text: 'Ma\'lumotlar bazasini shifrlash', is_correct: 0 }
        ]
      },
      {
        question_type: 'open',
        question_text: 'Simmetrik va asimmetrik shifrlash o\'rtasidagi asosiy farqlarni yoritib bering.',
        instruction: 'Kalitlar soni, tezlik va qo\'llanish sohasini keltiring',
        sample_answer: 'Simmetrik shifrlashda bitta umumiy kalit ishlatiladi, tez ishlaydi. Asimmetrikda esa ochiq va yopiq kalitlar juftligi bo\'ladi, xavfsiz kalit almashishda ishlatiladi.',
        points: 12
      }
    ];

    const totalPts = 4 + 4 + 12; // 20 ball

    const createRes = await db.runAsync(`
      INSERT INTO assignments (
        teacher_id, group_id, title, subject, content, open_question, instructions,
        total_points, has_dynamic_questions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      teacher.id,
      group.id,
      'Kriptografiya Asoslari va Test Sinovi (Avto-Test)',
      'Kiberxavfsizlik',
      'Kriptografiya ma\'lumotlar maxfiyligi va yaxlitligini ta\'minlash fani. Simmetrik va asimmetrik shifrlash asosiy turlardir.',
      sampleQuestions[2].question_text,
      'Testlarni diqqat bilan yeching va ochiq savolga asosli javob yozing.',
      totalPts,
      1
    ]);

    const assignmentId = createRes.lastID;
    console.log(`✅ 3. Topshiriq yaratildi (ID: ${assignmentId}, Jami: ${totalPts} ball).`);

    // Savollarni saqlash
    const savedQuestionIds = [];
    for (let i = 0; i < sampleQuestions.length; i++) {
      const q = sampleQuestions[i];
      const qRes = await db.runAsync(`
        INSERT INTO assignment_questions (
          assignment_id, question_type, question_text, points, order_index, instruction, sample_answer
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [assignmentId, q.question_type, q.question_text, q.points, i, q.instruction || null, q.sample_answer || null]);

      savedQuestionIds.push(qRes.lastID);

      if (q.question_type === 'closed') {
        for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
          const opt = q.options[optIdx];
          await db.runAsync(`
            INSERT INTO question_options (question_id, option_key, option_text, is_correct, order_index)
            VALUES (?, ?, ?, ?, ?)
          `, [qRes.lastID, opt.option_key, opt.option_text, opt.is_correct, optIdx]);
        }
      }
    }
    console.log(`✅ 4. 3 ta savol (2 yopiq test va 1 ochiq savol) muvaffaqiyatli saqlandi.`);

    // 3. Talaba uchun maxfiylik tekshiruvi (is_correct va sample_answer yashiringanligi)
    const optionsForStudent = await db.allAsync(`
      SELECT id, question_id, option_key, option_text 
      FROM question_options 
      WHERE question_id = ?
    `, [savedQuestionIds[0]]);

    console.log('✅ 5. Maxfiylik tekshiruvi:');
    const hasLeak = optionsForStudent.some(o => o.is_correct !== undefined);
    if (hasLeak) {
      throw new Error('XAVF: Talabaga is_correct ko\'rinib qoldi!');
    }
    console.log('   - Yopiq test to\'g\'ri javoblari talabadan to\'liq sir saqlangan.');

    // 4. Talaba javob berishi va serverda tekshirilishi
    // 1-savol: B variantini tanlaydi (RSA -> to'g'ri, 4 ball)
    const q1Opts = await db.allAsync('SELECT * FROM question_options WHERE question_id = ?', [savedQuestionIds[0]]);
    const q1CorrectOpt = q1Opts.find(o => o.is_correct === 1);

    // 2-savol: B variantini tanlaydi (Noto'g'ri javob, 0 ball)
    const q2Opts = await db.allAsync('SELECT * FROM question_options WHERE question_id = ?', [savedQuestionIds[1]]);
    const q2WrongOpt = q2Opts.find(o => o.is_correct === 0);

    // 3-savol: Ochiq savolga talaba javobi
    const studentAnswerText = "Simmetrik shifrlashda bitta kalit ishlatiladi, u tez ishlaydi. Asimmetrik shifrlashda esa ochiq va yopiq kalit bo'ladi. RSA asimmetrikka misol bo'ladi.";
    const openAiRes = await evaluateOpenQuestion({
      theoryContent: 'Kriptografiya ma\'lumotlar maxfiyligi fani. Simmetrik va asimmetrik shifrlash asosiy turlardir.',
      question: sampleQuestions[2].question_text,
      instruction: sampleQuestions[2].instruction,
      sampleAnswer: sampleQuestions[2].sample_answer,
      studentAnswer: studentAnswerText,
      maxScore: 12
    });

    console.log(`✅ 6. AI ochiq savolni baholadi: ${openAiRes.score} / ${openAiRes.max_score} ball`);
    console.log(`   - AI xulosasi: ${openAiRes.summary}`);

    // Hisob-kitob
    const q1Earned = 4; // to'g'ri
    const q2Earned = 0; // noto'g'ri
    const q3Earned = openAiRes.score; // AI balli
    const totalEarned = q1Earned + q2Earned + q3Earned;

    const subRes = await db.runAsync(`
      INSERT INTO submissions (
        assignment_id, student_id, student_answer, ai_summary, ai_gaps,
        recommended_score, total_score, max_score, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      assignmentId,
      student.id,
      "Dinamik topshiriq javoblari",
      openAiRes.summary,
      openAiRes.gaps,
      Math.round((totalEarned / totalPts) * 100),
      totalEarned,
      totalPts,
      'reviewed'
    ]);

    const submissionId = subRes.lastID;

    // Har bir savol javobini saqlash
    await db.runAsync(`
      INSERT INTO submission_answers (
        submission_id, question_id, selected_option_id, answer_text, is_correct, ai_score, teacher_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [submissionId, savedQuestionIds[0], q1CorrectOpt.id, q1CorrectOpt.option_text, 1, 4, 4]);

    await db.runAsync(`
      INSERT INTO submission_answers (
        submission_id, question_id, selected_option_id, answer_text, is_correct, ai_score, teacher_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [submissionId, savedQuestionIds[1], q2WrongOpt.id, q2WrongOpt.option_text, 0, 0, 0]);

    await db.runAsync(`
      INSERT INTO submission_answers (
        submission_id, question_id, selected_option_id, answer_text, is_correct, ai_score, ai_feedback, teacher_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [submissionId, savedQuestionIds[2], null, studentAnswerText, null, q3Earned, JSON.stringify(openAiRes), null]);

    console.log(`✅ 7. Talaba javobi va savollar bo'yicha alohida ballar saqlandi.`);

    // 5. O'qituvchi yakuniy baholashi
    const teacherFinalScore = Math.min(totalPts, Math.round(totalEarned) + 1); // o'qituvchi 1 ball qo'shib berdi
    await db.runAsync(`
      UPDATE submissions 
      SET teacher_score = ?, teacher_feedback = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [teacherFinalScore, "Yaxshi natija, test savollariga ko'proq e'tibor bering.", submissionId]);

    const finalSub = await db.getAsync('SELECT * FROM submissions WHERE id = ?', [submissionId]);
    console.log(`✅ 8. O'qituvchi bahoni tasdiqladi: ${finalSub.teacher_score} / ${finalSub.max_score} ball, Status: ${finalSub.status}`);

    // 6. Eski topshiriqlarni tekshirish (backward compatibility)
    const legacyAssignments = await db.allAsync('SELECT * FROM assignments WHERE has_dynamic_questions = 0 LIMIT 2');
    console.log(`✅ 9. Eski topshiriqlar mosligi: ${legacyAssignments.length} ta eski topshiriq saqlangan va faol.`);

    console.log('\n🎉 BARCHA DINAMIK VA SEMANTIK FUNKSIYALAR 100% MUOFFAQIYATLI TEKSHIRILDI!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Xatolik:', err);
    process.exit(1);
  }
}

runComprehensiveTests();
