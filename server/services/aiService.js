/**
 * UniTask AI - Sun'iy Intellekt Tahlil Xizmati (AI Evaluation Service)
 * gpt-4o-mini modelidan foydalanadi (JSON mode).
 * Tarmoq, balans yoki API kalit yo'qligida ishonchli fallback va xato ushlash mexanizmiga ega.
 */

async function evaluateStudentAnswer({ theoryContent, question, studentAnswer }) {
  const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : null;
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // 1. Agar haqiqiy OpenAI API kaliti mavjud bo'lsa, OpenAI ga so'rov yuboramiz
  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const systemPrompt = `Siz oliy ta'lim tizimida talabalar mustaqil ta'lim topshiriqlarini tekshiruvchi professional va xolis ekspert-baholovchi Sun'iy Intellektsiz.
Sizga o'qituvchi tomonidan taqdim etilgan nazariy material (Ground Truth), berilgan savol va talabaning javobi yuboriladi.

Vazifangiz:
1. Talabaning javobini o'qituvchi bergan nazariy matnga nisbatan semantik (ma'no va mohiyat) jihatdan taqqoslang.
2. Talaba asosiy tushunchalarni qay darajada tushunganini baholang.
3. Javobdagi noaniqliklar, noto'g'ri fikrlar yoki mavzudan chetga chiqishlarni aniqlang.
4. Talabaga xolis ball tavsiya eting (1 dan 100 gacha butun son).

Javobingizni FAQAT va FAQAT quyidagi JSON formatida qaytaring (sof o'zbek tilida, hech qanday qo'shimcha belgisiz):
{
  "summary": "Talabaning mavzuni o'zlashtirish darajasi va javobining qisqacha mazmuni",
  "gaps": "Javobdagi xatolar, qoldirib ketilgan muhim atamalar yoki tushunarsiz qolgan jihatlar",
  "recommended_score": 85
}`;

      const userPrompt = `--- O'QITUVCHI NAZARIYASI (GROUND TRUTH) ---
${theoryContent}

--- BERILGAN SAVOL / TOPSHIRIQ ---
${question}

--- TALABANING JAVOBI ---
${studentAnswer}

Iltimos, ushbu javobni qat'iy JSON formatida tahlil qiling.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[OpenAI API xatosi]: Status ${response.status} - ${errorText}`);
        throw new Error(`OpenAI API xatosi: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);

      // JSON maydonlarini tekshirish
      return {
        summary: String(parsed.summary || "Javob ko'rib chiqildi."),
        gaps: String(parsed.gaps || "Jiddiy kamchiliklar aniqlanmadi."),
        recommended_score: Math.min(100, Math.max(0, parseInt(parsed.recommended_score, 10) || 70)),
        source: 'openai-gpt-4o-mini'
      };

    } catch (apiError) {
      console.error('[OpenAI chaqiruvida xatolik]:', apiError.message);
      // FR-3.3 talabi: Agar OpenAI API limitdan oshsa yoki tarmoqda uzilish bo'lsa, tizim qulamasligi kerak
      // Aqlli fallback semantik tahlilchiga uzatamiz
      return runIntelligentFallback({ theoryContent, question, studentAnswer, note: 'OpenAI ulanishi vaqtinchalik uzilganligi sababli ichki semantik tahlilchi qo\'llanildi.' });
    }
  }

  // 2. OpenAI API kaliti kiritilmagan bo'lsa (mahalliy rejim yoki MVP test)
  return runIntelligentFallback({ 
    theoryContent, 
    question, 
    studentAnswer, 
    note: 'OpenAI API kaliti o\'rnatilmaganligi sababli ichki semantik tahlil modeli ishlatildi (.env fayliga OPENAI_API_KEY kiritishingiz mumkin).' 
  });
}

/**
 * Ichki semantik va matn tahlili algoritmi (Fallback / Standalone)
 * Talaba javobining nazariy matnga mos kelishini, asosiy kalit tushunchalarni qamrab olganligini,
 * javob uzunligi va tushuntirish sifatini tahlil qilib, o'zbek tilida professional xulosa beradi.
 */
function runIntelligentFallback({ theoryContent, question, studentAnswer, note = '' }) {
  const cleanTheory = (theoryContent || '').toLowerCase();
  const cleanAnswer = (studentAnswer || '').toLowerCase();
  const cleanQuestion = (question || '').toLowerCase();

  // So'zlar soni
  const answerWords = cleanAnswer.split(/\s+/).filter(w => w.length > 2);
  const theoryWords = cleanTheory.split(/\s+/).filter(w => w.length > 3);

  // Stop words (o'zbek tilidagi yordamchi so'zlar)
  const stopWords = new Set([
    'va', 'ham', 'bilan', 'uchun', 'kabi', 'esa', 'ammo', 'lekin', 'chunki', 'shuning', 
    'ushbu', 'bu', 'shu', 'har', 'bir', 'barcha', 'kerak', 'mumkin', 'emas', 'boladi', 'bo\'ladi'
  ]);

  // Nazariyadagi muhim atamalar
  const theoryTerms = Array.from(new Set(theoryWords.filter(w => !stopWords.has(w) && w.length > 4)));
  
  // Talaba javobida qatnashgan atamalar
  let matchedTerms = [];
  let missingTerms = [];

  theoryTerms.forEach(term => {
    // Ildiz qidirish (o'zbekcha qo'shimchalarni hisobga olgan holda)
    const stem = term.slice(0, Math.min(term.length, 5));
    if (cleanAnswer.includes(stem)) {
      matchedTerms.push(term);
    } else {
      missingTerms.push(term);
    }
  });

  // Ball hisoblash logikasi
  let score = 50;

  // 1. Matn hajmi va batafsilligi
  if (answerWords.length >= 60) {
    score += 20;
  } else if (answerWords.length >= 30) {
    score += 15;
  } else if (answerWords.length >= 15) {
    score += 8;
  } else {
    score -= 15;
  }

  // 2. Nazariy atamalarning qamrovi (coverage)
  const coverageRatio = theoryTerms.length > 0 ? (matchedTerms.length / Math.min(theoryTerms.length, 12)) : 0.5;
  score += Math.round(coverageRatio * 30);

  // Ballni 1-100 oralig'iga cheklash
  score = Math.min(98, Math.max(35, score));

  // O'zbek tilida tahliliy xulosa shakllantirish
  let summary = '';
  let gaps = '';

  if (score >= 85) {
    summary = `Talaba berilgan mavzuni juda yaxshi va chuqur o'zlashtirgan. Javobda nazariy matndagi asosiy ilmiy tushunchalar o'rinli yoritilgan va savolga to'liq mantiqiy javob berilgan. Fikrlar tizimli bayon etilgan.`;
    gaps = missingTerms.length > 0 && missingTerms.length < 5
      ? `Javob deyarli to'liq. Faqat "${missingTerms.slice(0, 3).join(', ')}" kabi qo'shimcha atamalar haqida ham qisqacha to'xtalib o'tilsa, javob mukammal darajaga yetar edi.`
      : `Jiddiy xato yoki kamchiliklar aniqlanmadi. Javob mezonlarga to'liq javob beradi.`;
  } else if (score >= 70) {
    summary = `Talaba mavzuning umumiy mohiyatini to'g'ri anglagan. Savol bo'yicha asosiy fikrlar keltirilgan, biroq ayrim nazariy qoidalar va bog'liqliklar yuzaki yoritilgan.`;
    gaps = `Javobda quyidagi muhim tushunchalar va ilmiy atamalar to'liq aks ettirilmagan: ${missingTerms.slice(0, 4).join(', ') || 'nazariy tahlil chuqurligi'}. Fikrni amaliy misollar bilan boyitish tavsiya etiladi.`;
  } else {
    summary = `Talabaning javobi mavzuni to'liq qamrab olmagan yoki javob hajmi talab etilgan me'yordan ancha qisqa. Asosiy e'tibor ikkinchi darajali fikrlarga qaratilgan.`;
    gaps = `Nazariy matndagi tayanch tushunchalar (${missingTerms.slice(0, 5).join(', ')}) javobda deyarli ishlatilmagan. Talabaga mavzu matnini qayta o'qib chiqish va javobni kengroq asoslash tavsiya etiladi.`;
  }

  if (note) {
    gaps += `\n[Tizim bildirishnomasi: ${note}]`;
  }

  return {
    summary,
    gaps,
    recommended_score: score,
    source: 'unitask-semantic-fallback'
  };
}

module.exports = {
  evaluateStudentAnswer
};
