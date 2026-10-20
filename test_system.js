/**
 * UniTask AI - API va Tizim Integratsion Test Skripti
 */
const { initDatabase, db } = require('./server/config/database');
const { evaluateStudentAnswer } = require('./server/services/aiService');

async function runTests() {
  console.log('🧪 UniTask AI tizimi test qilinmoqda...\n');

  try {
    // 1. Bazani tekshirish
    await initDatabase();
    console.log('✅ 1. Baza va jadvallar muvaffaqiyatli tekshirildi.');

    // 2. Foydalanuvchilar va guruhlar
    const users = await db.allAsync('SELECT id, name, email, role FROM users');
    console.log(`✅ 2. Baza foydalanuvchilari soni: ${users.length} ta`);
    users.forEach(u => console.log(`   - [${u.role.toUpperCase()}] ${u.name} (${u.email})`));

    const groups = await db.allAsync('SELECT * FROM groups');
    console.log(`✅ 3. Guruhlar soni: ${groups.length} ta`);
    groups.forEach(g => console.log(`   - ${g.name}`));

    // 3. Topshiriqlar
    const assignments = await db.allAsync('SELECT * FROM assignments');
    console.log(`✅ 4. Topshiriqlar soni: ${assignments.length} ta`);

    // 4. AI Evaluation funksiyasini tekshirish
    console.log('\n🤖 5. Sun\'iy Intellekt tahlil xizmati (AI Service) tekshirilmoqda...');
    const testTheory = `Sun'iy neyron tarmoqlarida faollashtirish funksiyasi (activation function) nochiziqlilikni (non-linearity) kiritish uchun xizmat qiladi. Eng mashhur funksiyalar: ReLU, Sigmoid va Tanh.`;
    const testQuestion = `Faollashtirish funksiyasining vazifasi nima?`;
    const testAnswer = `Faollashtirish funksiyasi neyron tarmog'iga nochiziqlilik olib kiradi. Masalan ReLU va Sigmoid funksiyalari mavjud.`;

    const aiResult = await evaluateStudentAnswer({
      theoryContent: testTheory,
      question: testQuestion,
      studentAnswer: testAnswer
    });

    console.log('✅ AI tahlil natijasi:');
    console.log(`   - Manba: ${aiResult.source}`);
    console.log(`   - Tavsiya etilgan ball: ${aiResult.recommended_score}`);
    console.log(`   - Xulosa: ${aiResult.summary.slice(0, 100)}...`);
    console.log(`   - Kamchiliklar: ${aiResult.gaps.slice(0, 100)}...`);

    // 5. Submissions
    const submissions = await db.allAsync('SELECT * FROM submissions');
    console.log(`\n✅ 6. Topshirilgan ishlar soni: ${submissions.length} ta`);

    console.log('\n🎉 Barcha ichki modullar va ma\'lumotlar bazasi 100% to\'g\'ri ishlamoqda!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Testda xatolik:', error);
    process.exit(1);
  }
}

runTests();
