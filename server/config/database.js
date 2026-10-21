const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../../unitask.db');
const db = new sqlite3.Database(dbPath);

// Helper promisified wrappers for sqlite3
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

db.getAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

db.allAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

// Initialize tables and seed initial data
async function initDatabase() {
  // Foreign keys yoqish
  await db.runAsync('PRAGMA foreign_keys = ON;');

  // 1. groups jadvali
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. users jadvali
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. assignments jadvali
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      open_question TEXT NOT NULL,
      file_path TEXT DEFAULT NULL,
      file_name TEXT DEFAULT NULL,
      file_size INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ustunlar mavjudligini tekshirish va dinamik qo'shish (migratsiya)
  try {
    const tableInfo = await db.allAsync("PRAGMA table_info(assignments)");
    const colNames = tableInfo.map(c => c.name);
    if (!colNames.includes('file_path')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN file_path TEXT DEFAULT NULL");
    }
    if (!colNames.includes('file_name')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN file_name TEXT DEFAULT NULL");
    }
    if (!colNames.includes('file_size')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN file_size INTEGER DEFAULT NULL");
    }
    if (!colNames.includes('subject')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN subject TEXT DEFAULT NULL");
    }
    if (!colNames.includes('instructions')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN instructions TEXT DEFAULT NULL");
    }
    if (!colNames.includes('start_date')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN start_date DATETIME DEFAULT NULL");
    }
    if (!colNames.includes('due_date')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN due_date DATETIME DEFAULT NULL");
    }
    if (!colNames.includes('total_points')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN total_points REAL DEFAULT 100");
    }
    if (!colNames.includes('has_dynamic_questions')) {
      await db.runAsync("ALTER TABLE assignments ADD COLUMN has_dynamic_questions INTEGER DEFAULT 0");
    }
  } catch (migErr) {
    console.warn("Assignments migratsiyasida ogohlantirish:", migErr.message);
  }

  // 4. submissions jadvali
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_answer TEXT NOT NULL,
      ai_summary TEXT,
      ai_gaps TEXT,
      recommended_score INTEGER,
      teacher_score INTEGER DEFAULT NULL,
      teacher_feedback TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'graded')),
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      graded_at DATETIME DEFAULT NULL,
      UNIQUE(assignment_id, student_id)
    );
  `);

  // Submissions migratsiyasi (yangi ustunlar)
  try {
    const subInfo = await db.allAsync("PRAGMA table_info(submissions)");
    const subCols = subInfo.map(c => c.name);
    if (!subCols.includes('total_score')) {
      await db.runAsync("ALTER TABLE submissions ADD COLUMN total_score REAL DEFAULT NULL");
    }
    if (!subCols.includes('max_score')) {
      await db.runAsync("ALTER TABLE submissions ADD COLUMN max_score REAL DEFAULT NULL");
    }
  } catch (subMigErr) {
    console.warn("Submissions migratsiyasida ogohlantirish:", subMigErr.message);
  }

  // 5. assignment_questions jadvali (Dinamik ochiq va yopiq savollar)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS assignment_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      question_type TEXT NOT NULL CHECK(question_type IN ('closed', 'open')),
      question_text TEXT NOT NULL,
      points REAL NOT NULL DEFAULT 10,
      order_index INTEGER NOT NULL DEFAULT 0,
      instruction TEXT DEFAULT NULL,
      sample_answer TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. question_options jadvali (Yopiq test variantlari)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
      option_key TEXT NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
      order_index INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 7. submission_answers jadvali (Talaba javoblari va har bir savol bahosi)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS submission_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
      selected_option_id INTEGER DEFAULT NULL REFERENCES question_options(id) ON DELETE SET NULL,
      answer_text TEXT DEFAULT NULL,
      is_correct INTEGER DEFAULT NULL,
      ai_score REAL DEFAULT NULL,
      ai_feedback TEXT DEFAULT NULL,
      teacher_score REAL DEFAULT NULL,
      teacher_feedback TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default demo data if database is empty
  await seedInitialData();
}

async function seedInitialData() {
  const userCount = await db.getAsync('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    return; // Allaqachon ma'lumotlar bor
  }

  console.log('🌱 Boshlang\'ich ma\'lumotlar (seed) kiritilmoqda...');

  // Guruhlar
  const g1 = await db.runAsync('INSERT INTO groups (name) VALUES (?)', ['912-20 Guruh (Dasturiy injiniring)']);
  const g2 = await db.runAsync('INSERT INTO groups (name) VALUES (?)', ['914-21 Guruh (Sun\'iy intellekt)']);
  const g3 = await db.runAsync('INSERT INTO groups (name) VALUES (?)', ['810-22 Guruh (Kiberxavfsizlik)']);

  const salt = await bcrypt.genSalt(10);
  const adminPass = await bcrypt.hash('admin123', salt);
  const teacherPass = await bcrypt.hash('teacher123', salt);
  const studentPass = await bcrypt.hash('student123', salt);

  // Super Admin
  await db.runAsync(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    ['Tizim Administratori', 'admin@unitask.uz', adminPass, 'admin']
  );

  // O'qituvchilar
  const t1 = await db.runAsync(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    ['Dotsent Karimova Nargiza Saidovna', 'teacher@unitask.uz', teacherPass, 'teacher']
  );

  await db.runAsync(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    ['Prof. Aliyev Jamshid Rustamovich', 'teacher2@unitask.uz', teacherPass, 'teacher']
  );

  // Talabalar
  const s1 = await db.runAsync(
    'INSERT INTO users (name, email, password, role, group_id) VALUES (?, ?, ?, ?, ?)',
    ['Rustamov Jasur Anvarovich', 'student@unitask.uz', studentPass, 'student', g1.lastID]
  );

  const s2 = await db.runAsync(
    'INSERT INTO users (name, email, password, role, group_id) VALUES (?, ?, ?, ?, ?)',
    ['Alimova Madina Bobirovna', 'student2@unitask.uz', studentPass, 'student', g1.lastID]
  );

  const s3 = await db.runAsync(
    'INSERT INTO users (name, email, password, role, group_id) VALUES (?, ?, ?, ?, ?)',
    ['Bekmurodov Shoxruh Otabek o\'g\'li', 'student3@unitask.uz', studentPass, 'student', g2.lastID]
  );

  // Namunaviy topshiriq 1 (912-20 guruh uchun)
  const theory1 = `Sun'iy neyron tarmoqlari (SNT) — inson miyasi biologik neyronlarining ishlash mexanizmini modellashtirishga asoslangan mashinali o'rganish paradigmasidir. Har bir sun'iy neyron bir nechta kiruvchi signallarni (kirish qiymatlarini) qabul qiladi, har bir kirish o'zining og'irlik koeffitsientiga (weight) ega bo'ladi. Ushbu kirishlar va og'irliklar ko'paytmasi yig'indisi hisoblanadi hamda unga siljish koeffitsienti (bias) qo'shiladi. 

Olingan chiziqli yig'indi faollashtirish funksiyasi (activation function) orqali o'tkaziladi. Faollashtirish funksiyasining asosiy vazifasi — modelga nochiziqlilikni (non-linearity) kiritishdan iborat. Agar faollashtirish funksiyasi bo'lmasa yoki u faqat chiziqli bo'lsa, qancha qatlamli neyron tarmoq bo'lishidan qat'i nazar, u oddiy chiziqli regressiya modeliga aylanib qoladi va murakkab real dunyo bog'liqliklarini o'rgana olmaydi.

Zamonaviy chuqur o'rganishda eng ko'p qo'llaniladigan faollashtirish funksiyalari: ReLU (Rectified Linear Unit), Sigmoid, Tanh va Leaky ReLU hisoblanadi. Shuningdek, tarmoqni o'qitish jarayonida orqaga tarqalish (Backpropagation) algoritmi va gradient tushishi (Gradient Descent) optimallashtiruvchilaridan foydalaniladi.`;

  const q1 = `Sun'iy neyronning biologik neyron bilan asosiy o'xshashliklarini va nima sababdan faollashtirish funksiyasi (activation function) neyron tarmoqlarda o'ta muhim ahamiyatga ega ekanligini batafsil tushuntirib bering.`;

  const a1 = await db.runAsync(
    'INSERT INTO assignments (teacher_id, group_id, title, content, open_question) VALUES (?, ?, ?, ?, ?)',
    [t1.lastID, g1.lastID, '1-Topshiriq: Neyron Tarmoqlari va Faollashtirish Funksiyalari', theory1, q1]
  );

  // Namunaviy topshiriq 2 (912-20 guruh uchun)
  const theory2 = `Algoritm murakkabligi kompyuter fanlarida algoritm samaradorligini va uning ishlashi uchun zarur bo'lgan resurslar miqdorini baholashda qo'llaniladi. Asosiy ikki turdagi murakkablik mavjud: vaqt murakkabligi (Time Complexity) va xotira murakkabligi (Space Complexity).

Vaqt murakkabligini matematik ifodalash uchun asimptotik notatsiyalar, ayniqsa Big-O (Katta O) notatsiyasi standart hisoblanadi. Big-O eng yomon holatdagi (worst-case scenario) o'sish tartibini ifodalaydi.
Misol uchun:
- O(1) — O'zgarmas (Constant) vaqt: kiruvchi ma'lumot hajmidan qat'i nazar bir xil vaqtda bajariladi (massiv indeksiga murojaat qilish).
- O(log n) — Logarifmik vaqt: har qadamda qidiruv maydoni ikki barobar qisqaradi (ikkilik qidiruv - binary search).
- O(n) — Chiziqli vaqt: elementlar soniga to'g'ri mutanosib (chiziqli qidiruv).
- O(n^2) — Kvadratik vaqt: ichma-ich sikllar mavjud bo'lganda (pufakchali saralash - bubble sort).
Optimal algoritmni tanlash katta hajmdagi ma'lumotlarni qayta ishlashda tizimning barqarorligi va tezligini ta'minlaydi.`;

  const q2 = `Big-O notatsiyasining amaliy ahamiyatini tushuntiring hamda O(1), O(log n) va O(n^2) vaqt murakkabliklariga ega bo'lgan real dasturlash algoritmlaridan misollar keltiring.`;

  await db.runAsync(
    'INSERT INTO assignments (teacher_id, group_id, title, content, open_question) VALUES (?, ?, ?, ?, ?)',
    [t1.lastID, g1.lastID, '2-Topshiriq: Algoritmlarning Vaqt Murakkabligi va Big-O Notatsiyasi', theory2, q2]
  );

  // Namunaviy submission (Talaba 1 topshirgan va O'qituvchi baholagan)
  const sampleAnswer1 = `Sun'iy neyron biologik miyadagi neyrondan andoza olgan. Biologik neyronda dendritlar signal qabul qilsa, sun'iy neyronda kirish x-lari qabul qilinadi. Har bir bog'lanish kuchi og'irliklar (weights) bilan ifodalanadi. Keyin neyron tanasida (akson tepaligida) signallar yig'ilib, ma'lum chegara oshganda signal keyingi neyronlarga uzatiladi.

Faollashtirish funksiyasi juda zarur, chunki u neyron tarmog'iga nochiziqlilikni (non-linearity) olib kiradi. Agar faollashtirish funksiyasi bo'lmasa, ko'p qatlamli neyron tarmoq faqat oddiy chiziqli funksiyalarni hisoblaydi va murakkab tasvirlarni tanish, ovozni anglash kabi masalalarni echa olmaydi. Amalda eng ko'p ReLU funksiyasi qo'llaniladi.`;

  await db.runAsync(`
    INSERT INTO submissions (
      assignment_id, student_id, student_answer, 
      ai_summary, ai_gaps, recommended_score, teacher_score, teacher_feedback, 
      status, submitted_at, graded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 hours'), datetime('now', '-30 minutes'))
  `, [
    a1.lastID,
    s1.lastID,
    sampleAnswer1,
    "Talaba mavzuni chuqur o'zlashtirgan. Biologik va sun'iy neyron o'rtasidagi analogiya (dendritlar, og'irliklar, signal o'tkazish) aniq va to'g'ri ochib berilgan. Faollashtirish funksiyasining nochiziqlilik kiritishdagi roli to'liq tushuntirilgan.",
    "Deyarli kamchilik yo'q. Qatlamlarda bias (siljish) koeffitsienti va orqaga tarqalish (backpropagation) jarayoni haqida qo'shimcha to'xtalib o'tilsa, javob yanada mukammal bo'lar edi.",
    92,
    95,
    "Barakalla Jasur! Tushunchalar juda aniq ifodalangan. Amaliy misollar ham o'rinli.",
    'graded'
  ]);

  // Namunaviy submission 2 (Talaba 2 topshirgan, AI tahlil qilgan, o'qituvchi tasdiqlashi kutilyapti - 'reviewed')
  const sampleAnswer2 = `Sun'iy neyron kompyuterda sun'iy intellekt yaratish uchun kerak. Biologik neyronga o'xshab signallarni oladi va qo'shib chiqadi.
Faollashtirish funksiyasi neyron qachon ishlashi yoki ishlamasligini belgilaydi. Masalan ReLU va Sigmoid funksiyalari bor. Ular orqali tarmoq o'rganadi.`;

  await db.runAsync(`
    INSERT INTO submissions (
      assignment_id, student_id, student_answer, 
      ai_summary, ai_gaps, recommended_score, teacher_score, teacher_feedback, 
      status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 hours'))
  `, [
    a1.lastID,
    s2.lastID,
    sampleAnswer2,
    "Talaba mavzu bo'yicha asosiy tushunchalarga ega, biroq javob ancha qisqa va yuzaki berilgan. Faollashtirish funksiyasi haqida aytilgan, ammo uning asosiy vazifasi bo'lgan 'nochiziqlilik (non-linearity)' tushunchasi tilga olinmagan.",
    "Javobda quyidagi muhim jihatlar yetishmaydi: 1) Og'irliklar (weights) va bias tushunchasi; 2) Nochiziqlilik kiritilmasa tarmoq oddiy chiziqli regressiya bo'lib qolishi haqidagi xulosa; 3) Biologik neyron tuzilishi (dendrit, akson) bilan batafsil qiyoslash.",
    68,
    null,
    null,
    'reviewed'
  ]);

  console.log('✅ Boshlang\'ich test ma\'lumotlari muvaffaqiyatli yuklandi!');
}

module.exports = {
  db,
  initDatabase
};
