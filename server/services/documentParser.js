const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');

/**
 * PDF, DOCX, PPTX, TXT fayllardan sof matnni ajratib olish (Text Extraction)
 * @param {string} filePath - Faylning diskdagi to'liq yo'li
 * @param {string} originalName - Faylning asl nomi
 * @returns {Promise<string>} - Ajratib olingan matn
 */
async function extractTextFromFile(filePath, originalName = '') {
  const ext = path.extname(originalName || filePath).toLowerCase();

  try {
    // 1. PDF Fayl
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return cleanExtractedText(pdfData.text);
    }

    // 2. Word (DOCX) Fayl
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return cleanExtractedText(result.value);
    }

    // 3. PowerPoint (PPTX) Fayl
    if (ext === '.pptx') {
      return extractTextFromPptx(filePath);
    }

    // 4. Oddiy matnli fayllar (TXT, MD)
    if (ext === '.txt' || ext === '.md') {
      const text = fs.readFileSync(filePath, 'utf-8');
      return cleanExtractedText(text);
    }

    // 5. Eski DOC format yoki boshqalar
    if (ext === '.doc') {
      // DOC (Word 97-2003) binar format bo'lgani uchun oddiy string extraction
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\u0400-\u04FF\u0100-\u017F\s]/g, ' ');
      return cleanExtractedText(text);
    }

    return '';
  } catch (error) {
    console.error(`[DocumentParser] Matn ajratishda xatolik (${ext}):`, error.message);
    throw new Error(`Fayldan matnni ajratib bo'lmadi: ${error.message}`);
  }
}

/**
 * PPTX fayl ichidagi barcha slaydlardan matnni tartibli ajratib olish
 */
function extractTextFromPptx(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    // ppt/slides/slide*.xml fayllarni saralab topish
    const slideEntries = zipEntries
      .filter(entry => entry.entryName.match(/^ppt\/slides\/slide[0-9]+\.xml$/i))
      .sort((a, b) => {
        const numA = parseInt((a.entryName.match(/[0-9]+/) || [0])[0], 10);
        const numB = parseInt((b.entryName.match(/[0-9]+/) || [0])[0], 10);
        return numA - numB;
      });

    let allSlidesText = [];

    slideEntries.forEach((entry, index) => {
      const xmlContent = entry.getData().toString('utf8');
      // <a:t> matn teglarini qidirish
      const textMatches = xmlContent.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi);
      if (textMatches && textMatches.length > 0) {
        const slideText = textMatches
          .map(tag => tag.replace(/<\/?a:t[^>]*>/gi, '').trim())
          .filter(t => t.length > 0)
          .join(' ');

        if (slideText) {
          allSlidesText.push(`[${index + 1}-Slayd]: ${slideText}`);
        }
      }
    });

    return cleanExtractedText(allSlidesText.join('\n\n'));
  } catch (err) {
    console.error('[DocumentParser] PPTX parsing xatosi:', err);
    return '';
  }
}

/**
 * Matndagi ortiqcha bo'shliqlar va g'alati belgilarni tozalash
 */
function cleanExtractedText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

module.exports = {
  extractTextFromFile
};
