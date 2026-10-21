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

/**
 * Dinamik ochiq savollarni baholash funksiyasi (evaluateOpenQuestion)
 * Talaba javobini 6 ta mezon asosida tahlil qilib, strukturaviy natija beradi:
 * - Savolga moslik
 * - Mazmunning to‘g‘riligi
 * - Muhim tushunchalar mavjudligi
 * - Javobning to‘liqligi
 * - Mantiqiy izchillik
 * - O‘qituvchi belgilagan namunaviy javob/mezonlarga muvofiqlik
 */
async function evaluateOpenQuestion({ theoryContent, question, instruction, sampleAnswer, studentAnswer, maxScore = 10 }) {
  const targetMax = Math.max(1, Number(maxScore) || 10);
  const apiKey = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : null;
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const cleanAns = (studentAnswer || '').trim();
  if (!cleanAns) {
    return {
      score: 0,
      max_score: targetMax,
      summary: "Talaba tomonidan javob yozilmagan (bo'sh qoldirilgan).",
      strengths: "Javob kiritilmagan.",
      gaps: "Savol javobsiz qoldirilgan.",
      suggestions: "Kelgusida savollarni e'tiborsiz qoldirmasdan, hech bo'lmaganda o'z fikrlaringizni bayon eting.",
      source: 'auto-empty'
    };
  }

  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const systemPrompt = `Siz oliy ta'lim tizimida talabalar ochiq savollariga bergan javoblarini professional, xolis va talabchanlik bilan baholovchi Sun'iy Intellekt ekspertisiz.
Sizga berilgan:
- Topshiriq mavzusi nazariyasi (agar mavjud bo'lsa)
- Ochiq savol matni
- Savol bo'yicha ko'rsatma (agar mavjud bo'lsa)
- O'qituvchining namunaviy javobi yoki baholash mezonlari (Rubric)
- Savol uchun maksimal ball: ${targetMax}
- Talabaning javobi

Quyidagi 6 ta mezon asosida tahlil qiling:
1. Savolga moslik (savoldan chetga chiqmaganlik).
2. Mazmunning ilmiy va amaliy to‘g‘riligi.
3. Muhim ilmiy tushunchalar va atamalarning mavjudligi.
4. Javobning to‘liqligi va dalillanganligi.
5. Fikr bayonining mantiqiy izchilligi.
6. O‘qituvchi belgilagan mezonlar va namunaviy javobga mosligi.

MUHIM QOIDALAR:
- Javobni FAQAT kalit so'zlar bo'yicha baholamang! Talaba o'z so'zlari bilan to'g'ri tushuntirgan, sinonimlardan to'g'ri foydalangan bo'lsa ham yuqori ballga loyiq.
- Taklif etilayotgan ball 0 dan ${targetMax} gacha bo'lgan son bo'lishi shart (0 <= score <= ${targetMax}).
- Namunaviy javob va ichki mezonlarni oshkor qilmang, faqat tahlil qiling.
- Barcha izoh va tahlillar sof, tushunarli o'zbek adabiy tilida yozilishi shart.

Javobingizni FAQAT va FAQAT quyidagi JSON formatida qaytaring:
{
  "score": 8.5,
  "max_score": ${targetMax},
  "summary": "Javobning qisqa mazmuni va umumiy xulosa",
  "strengths": "To'g'ri ochib berilgan jihatlar va kuchli tomonlar",
  "gaps": "Mavzudan chetga chiqishlar, yetishmayotgan tushunchalar yoki noaniqliklar",
  "suggestions": "Talaba kelajakda o'z bilimini qanday oshirishi bo'yicha amaliy tavsiya"
}`;

      const userPrompt = `--- MAVZU NAZARIYASI ---
${theoryContent || 'Mavjud emas'}

--- OCHIQ SAVOL ---
${question}

--- O'QITUVCHI KO'RSATMASI ---
${instruction || "Qo'shimcha ko'rsatma yo'q"}

--- O'QITUVCHINING NAMUNAVIY JAVOBI / MEZONLARI ---
${sampleAnswer || "Namunaviy javob ko'rsatilmagan (nazariya va savol asosida tekshiring)"}

--- SAVOLNING MAKSIMAL BALLI ---
${targetMax} ball

--- TALABANING JAVOBI ---
${cleanAns}

Iltimos, ushbu javobni ko'rsatilgan mezonlar asosida qat'iy JSON formatida baholang.`;

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
          temperature: 0.25
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[OpenAI OpenQuestion Error]: Status ${response.status} - ${errorText}`);
        throw new Error(`OpenAI API xatosi: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);

      let calculatedScore = Number(parsed.score);
      if (isNaN(calculatedScore)) calculatedScore = Math.round(targetMax * 0.7);
      calculatedScore = Math.min(targetMax, Math.max(0, calculatedScore));

      return {
        score: Math.round(calculatedScore * 10) / 10,
        max_score: targetMax,
        summary: String(parsed.summary || "Talabaning javobi ko'rib chiqildi."),
        strengths: String(parsed.strengths || "Javob savol mavzusiga mos keladi."),
        gaps: String(parsed.gaps || "Jiddiy kamchiliklar aniqlanmadi."),
        suggestions: String(parsed.suggestions || "Mavzuni yanada chuqurroq o'rganishda davom eting."),
        source: 'openai-gpt-4o-mini'
      };

    } catch (apiError) {
      console.error('[OpenAI OpenQuestion tahlilida uzilish]:', apiError.message);
      return runIntelligentFallbackOpenQuestion({
        theoryContent,
        question,
        instruction,
        sampleAnswer,
        studentAnswer: cleanAns,
        maxScore: targetMax,
        note: 'OpenAI ulanishi vaqtinchalik uzilganligi sababli ichki semantik tahlil qo\'llanildi.'
      });
    }
  }

  // Kalit bo'lmasa fallback ishlaydi
  return runIntelligentFallbackOpenQuestion({
    theoryContent,
    question,
    instruction,
    sampleAnswer,
    studentAnswer: cleanAns,
    maxScore: targetMax
  });
}

/**
 * Dinamik ochiq savollar uchun aqlli semantik Fallback baholovchi
 */
function runIntelligentFallbackOpenQuestion({ theoryContent, question, instruction, sampleAnswer, studentAnswer, maxScore = 10, note = '' }) {
  const cleanAns = (studentAnswer || '').toLowerCase();
  const words = cleanAns.split(/\s+/).filter(w => w.length > 2);
  const wordCount = words.length;

  const targetMax = Math.max(1, Number(maxScore) || 10);

  // Stop words
  const stopWords = new Set([
    'va', 'ham', 'bilan', 'uchun', 'kabi', 'esa', 'ammo', 'lekin', 'chunki', 'shuning', 
    'ushbu', 'bu', 'shu', 'har', 'bir', 'barcha', 'kerak', 'mumkin', 'emas', 'boladi', 'bo\'ladi'
  ]);

  // Savol, nazariya va namunaviy javobdan tayanch tushunchalarni yig'ish
  const referenceText = `${theoryContent || ''} ${question || ''} ${sampleAnswer || ''}`.toLowerCase();
  const refWords = referenceText.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const uniqueRefTerms = Array.from(new Set(refWords));

  let matchedTerms = [];
  let missingTerms = [];

  uniqueRefTerms.forEach(term => {
    const stem = term.slice(0, Math.min(term.length, 5));
    if (cleanAns.includes(stem)) {
      matchedTerms.push(term);
    } else {
      missingTerms.push(term);
    }
  });

  // 100 ballik nisbat hisoblaymiz, keyin targetMax ga o'tkazamiz
  let basePercentage = 40;

  // So'zlar hajmi baholanishi
  if (wordCount >= 45) {
    basePercentage += 25;
  } else if (wordCount >= 20) {
    basePercentage += 18;
  } else if (wordCount >= 8) {
    basePercentage += 10;
  } else {
    basePercentage -= 15;
  }

  // Tushunchalar qamrovi
  const coverageRatio = uniqueRefTerms.length > 0 
    ? (matchedTerms.length / Math.min(uniqueRefTerms.length, 8))
    : 0.6;
  basePercentage += Math.round(coverageRatio * 30);

  // Namunaviy javobga yaqinlik
  if (sampleAnswer && sampleAnswer.trim().length > 0) {
    const sampleWords = sampleAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    const sampleMatched = sampleWords.filter(w => cleanAns.includes(w.slice(0, 4))).length;
    if (sampleWords.length > 0 && (sampleMatched / sampleWords.length) > 0.4) {
      basePercentage += 10;
    }
  }

  basePercentage = Math.min(96, Math.max(20, basePercentage));
  const calculatedScore = Math.round((basePercentage / 100) * targetMax * 10) / 10;

  let summary = '';
  let strengths = '';
  let gaps = '';
  let suggestions = '';

  if (basePercentage >= 85) {
    summary = `Talabaning javobi savol mohiyatini to'liq ochib bergan va ilmiy jihatdan asosli bayon etilgan.`;
    strengths = `Asosiy tushunchalar to'g'ri ifodalangan, fikr bayoni izchil va tushunarli.`;
    gaps = missingTerms.length > 0 && missingTerms.length < 4
      ? `Javob deyarli to'liq. "${missingTerms.slice(0, 2).join(', ')}" tushunchalari haqida ham to'xtalib o'tilsa, yanada mukammal bo'lardi.`
      : `Jiddiy kamchiliklar aniqlanmadi.`;
    suggestions = `O'rganilgan mavzuni amaliy loyihalarda mustahkamlash tavsiya etiladi.`;
  } else if (basePercentage >= 65) {
    summary = `Talaba savol bo'yicha asosiy tushunchalarga ega, biroq javob ayrim jihatlari bilan to'ldirishni talab qiladi.`;
    strengths = `Mavzuning umumiy g'oyasi to'g'ri ilg'angan.`;
    gaps = `Javobda ba'zi muhim tayanch atamalar va tahliliy dalillar to'liq yoritilmagan (${missingTerms.slice(0, 3).join(', ') || 'nazariy chuqurlik'}).`;
    suggestions = `Mavzu nazariyasini qayta o'qib, o'z fikrlaringizni kengroq misollar bilan boyitishni tavsiya qilamiz.`;
  } else {
    summary = `Talaba javobi juda qisqa yoki savol talablariga to'liq javob bermagan.`;
    strengths = `Savolga munosabat bildirilgan.`;
    gaps = `Savol mazmunini ochib beruvchi yetarli dalil va atamalar mavjud emas.`;
    suggestions = `Mavzu matnini batafsil o'rganib chiqib, savolga kengroq tushuntirish berish lozim.`;
  }

  if (note) {
    gaps += ` [${note}]`;
  }

  return {
    score: calculatedScore,
    max_score: targetMax,
    summary,
    strengths,
    gaps,
    suggestions,
    source: 'unitask-semantic-fallback'
  };
}

module.exports = {
  evaluateStudentAnswer,
  evaluateOpenQuestion
};
