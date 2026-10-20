# UniTask AI — Talabalar Mustaqil Ta'lim Topshiriqlarini Sun'iy Intellekt Yordamida Avtomatlashtirilgan Tahlil va Baholash Platformasi

![UniTask AI Banner](https://img.shields.io/badge/UniTask%20AI-EdTech%20Platform-4f46e5?style=for-the-badge&logo=openai&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B%20LTS-green?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-Framework-black?style=for-the-badge&logo=express)
![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?style=for-the-badge&logo=sqlite)
![OpenAI](https://img.shields.io/badge/AI%20Model-GPT--4o--mini%20(JSON%20mode)-orange?style=for-the-badge&logo=openai)

---

## 📌 1. Loyiha Haqida

**UniTask AI** — Oliy ta'lim muassasalari talabalarining mustaqil ta'lim topshiriqlari, nazorat savollari va matnli tushunchalarini OpenAI (GPT modeli) asosida semantik tahlil qiluvchi, o'zlashtirishdagi bo'shliqlarni aniqlovchi va professor-o'qituvchiga tavsiya etilgan ball hamda tahliliy hisobot taqdim etuvchi zamonaviy EdTech veb-platformasidir.

### Asosiy Maqsadlar:
- **O'qituvchi vaqtini 80% gacha tejash:** Yuzlab talabalar javoblarini qo'lda birma-bir o'qib chiqish o'rniga, AI tayyorlagan semantik xulosa va tavsiya ball asosida tezkor qaror qabul qilish.
- **Xolis Semantik Tahlil:** Talaba javoblarini shunchaki kalit so'zlar bo'yicha emas, o'qituvchi yuklagan nazariy matn (Ground Truth) ga nisbatan ma'no va mohiyat darajasida solishtirish.
- **Ta'lim Sifatini Oshirish:** Talabaga qaysi atamalarni qoldirib ketgani yoki qaysi tushunchalarda chalkashlik borligini aniq ko'rsatib berish.
- **Shaffof Baholash:** Yakuniy bahoni tasdiqlash yoki o'zgartirish to'liq o'qituvchi nazoratida qoladi.

---

## 🛠 2. Texnologik Stack

| Qatlam | Texnologiya | Tavsifi |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Modern Vanilla CSS3, JavaScript (ES6+) | Rollarga mos dinamik SPA (Single Page Application), to'liq responsive dizayn, sof o'zbek tilida |
| **Backend** | Node.js (v18+ LTS), Express.js | RESTful API arxitekturasi, JWT autentifikatsiya, xavfsiz marshrutlash |
| **Ma'lumotlar Bazasi** | SQLite3 | Guruhlar, foydalanuvchilar, topshiriqlar va AI tahlillari uchun munosabatli (relational) baza |
| **Sun'iy Intellekt** | OpenAI API (`gpt-4o-mini`, JSON mode) | Semantik taqqoslash, xulosa va 1-100 shkalasida ball berish + Aqlli Fallback mexanizmi |
| **Infratuzilma** | Docker, Docker Compose | Konteynerizatsiya va bulutli hostingga tayyor |

---

## 👥 3. Tizim Rollari va Demo Akkauntlar

Tizimda 3 ta qat'iy rol mavjud:

| Rol | Email | Parol | Mas'uliyati |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@unitask.uz` | `admin123` | Tizim statistikasi, akademik guruhlar yaratish, o'qituvchilar va talabalar akkauntlarini boshqarish |
| **O'qituvchi** | `teacher@unitask.uz` | `teacher123` | Guruhlarga topshiriq ochish (Ground Truth nazariya + savol), ishlarni ko'rish, AI tahlilini o'rganish va baholash |
| **Talaba 1** | `student@unitask.uz` | `student123` | Nazariyani o'qish, savolga javob yozish, "Topshirish" orqali AI tahliliga yuborish, baholarni ko'rish (912-20 guruh) |
| **Talaba 2** | `student2@unitask.uz` | `student123` | 912-20 guruh talabasi (ko'rib chiqish kutilayotgan ish namunasi) |

> 💡 **Eslatma:** Tizimga kirish sahifasida **"Tezkor Kirish (Demo)"** blokidagi tugmalar orqali istalgan rolga bir bosishda kirishingiz mumkin.

---

## 🚀 4. Ishga Tushirish Qo'llanmasi

### Talablar:
- Node.js (v18 yoki undan yuqori)
- npm (Node Package Manager)

### Qadamlar:

1. **Repozitoriyga o'ting va bog'liqliklarni o'rnating:**
   ```bash
   cd UniTask
   npm install
   ```

2. **Muhit o'zgaruvchilarini sozlang:**
   `.env` faylini oching va xohlasangiz o'zingizning OpenAI API kalitingizni kiriting:
   ```env
   PORT=3000
   JWT_SECRET=unitask_secret_jwt_key_2025_secure_edtech_platform
   OPENAI_API_KEY=sk-your-openai-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```
   > ⚠️ **Muhim:** Agar `OPENAI_API_KEY` kiritilmasa yoki balans tugasa ham tizim to'xtab qolmaydi! Loyiha ichki aqlli o'zbek tili semantik tahlil dvigateliga ega (FR-3.3 talabi bo'yicha to'liq xatoliklarni ushlaydi).

3. **Serverni ishga tushiring:**
   ```bash
   npm start
   ```
   *Dasturchi rejimida avtomatik qayta yuklash bilan:*
   ```bash
   npm run dev
   ```

4. **Brauzerda oching:**
   ```
   http://localhost:3000
   ```

---

## 🐳 5. Docker orqali ishga tushirish

Loyiha Docker konteynerida to'liq izolyatsiyalangan holda ishlay oladi:

```bash
docker-compose up --build -d
```
Konteyner ishga tushgach, `http://localhost:3000` manzilida ochiladi.

---

## 📡 6. REST API Hujjatlari

### Autentifikatsiya (`/api/auth`)
- `POST /api/auth/register` — Yangi foydalanuvchini ro'yxatdan o'tkazish (talaba bo'lsa `group_id` majburiy).
- `POST /api/auth/login` — Tizimga kirish (JWT token qaytaradi).
- `GET /api/auth/me` — Joriy foydalanuvchi ma'lumotlarini olish.

### Guruhlar (`/api/groups`)
- `GET /api/groups` — Barcha akademik guruhlar ro'yxati.
- `POST /api/groups` — Yangi guruh yaratish (Faqat Super Admin).
- `DELETE /api/groups/:id` — Guruhni o'chirish (Faqat Super Admin).

### Foydalanuvchilar (`/api/users`)
- `GET /api/users/stats` — Tizim statistikasi (Faqat Super Admin).
- `GET /api/users` — Barcha foydalanuvchilar ro'yxati (Faqat Super Admin).
- `POST /api/users` — Yangi foydalanuvchi yaratish (Faqat Super Admin).
- `PUT /api/users/:id` — Foydalanuvchini tahrirlash (Faqat Super Admin).
- `DELETE /api/users/:id` — Foydalanuvchini o'chirish (Faqat Super Admin).

### Topshiriqlar (`/api/assignments`)
- `GET /api/assignments` — Rolga mos topshiriqlar ro'yxati (talaba uchun o'z guruhi, o'qituvchi uchun o'z topshiriqlari).
- `GET /api/assignments/:id` — Topshiriq tafsilotlari va Ground Truth nazariyasi.
- `POST /api/assignments` — Yangi topshiriq yaratish (O'qituvchi / Admin).
- `DELETE /api/assignments/:id` — Topshiriqni o'chirish.

### Baholash va Javoblar (`/api/submissions`)
- `POST /api/submissions` — Talaba javob topshiradi va AI avtomatik baholaydi (5-15s).
- `GET /api/submissions/my` — Talabaning o'z topshirgan ishlari.
- `GET /api/submissions/assignment/:assignmentId` — Topshiriqqa kelgan barcha javoblar (O'qituvchi).
- `GET /api/submissions/:id` — Bitta ishning to'liq tahlili.
- `POST /api/submissions/:id/grade` — O'qituvchi yakuniy bahoni tasdiqlashi (`teacher_score`, `status: graded`).
- `POST /api/submissions/:id/re-analyze` — AI bilan qayta tahlil qilish.
- `DELETE /api/submissions/:id` — Talabaga qayta topshirish uchun ruxsat berish.

---

## 🔒 7. Xavfsizlik va Ishonchlilik
1. **Xavfsiz API kaliti:** OpenAI kaliti faqat backend `.env` faylida saqlanadi va frontendga hech qachon sizib chiqmaydi.
2. **SQL Injection himoyasi:** SQLite3 parametrlangan so'rovlari (`?`) orqali xavfsizlik ta'minlangan.
3. **Parol xavfsizligi:** Barcha parollar `bcrypt` (10 raundli tuzlash) orqali xeshlangan holda saqlanadi.
4. **JWT Sessiya:** Har bir so'rov RBAC (Role-Based Access Control) orqali tekshiriladi.
5. **FR-3.3 Xatoliklarni boshqarish:** Tarmoq uzilsa yoki OpenAI API band bo'lsa tizim yiqilmaydi va aqlli xulosa shakllantiradi.

---
## 👨‍💻 Muallif

**Xabibullayev Zikirillo** — UniTask AI loyihasi muallifi.
