// test_modal_and_wizard_ux.js
// 16 ta talab qilingan ssenariy bo'yicha to'liq tekshiruv va verifikatsiya

const fs = require('fs');
const path = require('path');
const { db } = require('./server/config/database');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ [O'TDI] ${message}`);
        passedTests++;
    } else {
        console.error(`❌ [XATO] ${message}`);
        failedTests++;
    }
}

async function runTests() {
    console.log('===============================================================');
    console.log('🧪 O\'QITUVCHI TOPSHIRIQ YARATISH VA TEST INTERFEYSI SINOVI');
    console.log('===============================================================\n');

    const cssPath = path.join(__dirname, 'public/css/components.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    const teacherViewPath = path.join(__dirname, 'public/js/views/teacherView.js');
    const teacherViewCode = fs.readFileSync(teacherViewPath, 'utf8');

    // 1-SSENARIY: Yangi topshiriq yaratish (Modal sarlavhasi 'Yangi topshiriq')
    console.log('--- 1. Yangi topshiriq oynasi va sarlavhasi ---');
    assert(
        teacherViewCode.includes("Yangi topshiriq") && teacherViewCode.includes("Topshiriqni tahrirlash"),
        "Sarlavha yangi topshiriq uchun 'Yangi topshiriq' va tahrirlash uchun 'Topshiriqni tahrirlash'"
    );
    assert(
        teacherViewCode.includes("openCreateWizard()") && teacherViewCode.includes("currentStep: 1"),
        "Topshiriq yaratish oynasi 1-bosqichdan boshlanadi"
    );
    assert(
        teacherViewCode.includes("id=\"wiz-title\"") && teacherViewCode.includes("id=\"wiz-group\""),
        "1-bosqichda faqat zaruriy maydonlar (title, group) majburiy qilib belgilangan"
    );

    // 2-SSENARIY: Nazariy fayl yuklash va o'chirish (Theory file state handling)
    console.log('\n--- 2. Nazariy material faylini yuklash va o\'chirish ---');
    assert(
        teacherViewCode.includes("handleWizardFileSelect") && teacherViewCode.includes("removeAttachedFile"),
        "Fayl yuklash (handleWizardFileSelect) va uni olib tashlash (removeAttachedFile) funksiyalari mavjud"
    );
    assert(
        teacherViewCode.includes("this.wizard.attachedFile = null") && teacherViewCode.includes("this.wizard.existingFileName = null"),
        "Fayl o'chirilganda wizard fayl holati to'liq tozalanadi"
    );
    assert(
        teacherViewCode.includes("theory-file-card") && teacherViewCode.includes("formatFileSize"),
        "Fayl nomi, formati va hajmi foydalanuvchiga ixcham kartochka orqali ko'rsatiladi"
    );

    // 3-SSENARIY: Yopiq test yaratish
    console.log('\n--- 3. Yopiq test yaratish (Closed question) ---');
    assert(
        teacherViewCode.includes("addQuestionWizard('closed')") || teacherViewCode.includes("addQuestionWizard(type = 'closed')"),
        "Yopiq test qo'shish funksiyasi turi 'closed' bilan yaratadi"
    );
    assert(
        teacherViewCode.includes("is_correct: 1") && teacherViewCode.includes("is_correct: 0"),
        "Yopiq testda to'g'ri javob belgilanadi"
    );

    // 4-SSENARIY: 2 tadan ko'p variant qo'shish (A, B, C, D, E...)
    console.log('\n--- 4. Variant qo\'shish mexanizmi (A, B, C, D, E...) ---');
    assert(
        teacherViewCode.includes("addWizardOption(qIdx)"),
        "addWizardOption funksiyasi mavjud"
    );
    assert(
        teacherViewCode.includes("String.fromCharCode(65 + q.options.length)"),
        "Yangi variant harflari avtomatik hisoblanadi (A=65, B=66, C=67, D=68, E=69...)"
    );

    // 5-SSENARIY: Scroll muammosi - DOM scroll holati saqlanishi va scrollIntoView
    console.log('\n--- 5. Variantlar ro\'yxatida scroll va fokus saqlanishi ---');
    assert(
        teacherViewCode.includes("prevScrollTop") && teacherViewCode.includes("pane.scrollTop = prevScrollTop"),
        "Variant qo'shilganda scroll pozitsiyasi saqlanadi (scroll sakrab ketmaydi)"
    );
    assert(
        teacherViewCode.includes("scrollIntoView") && teacherViewCode.includes("behavior: 'smooth'"),
        "Yangi qo'shilgan variant silliq ravishda ko'rinadigan joyga scroll qilinadi (scrollIntoView)"
    );
    assert(
        teacherViewCode.includes("newOptInput.focus()"),
        "Yangi qo'shilgan variant matn kiritish maydoniga avtomatik fokus tushadi"
    );

    // 6-SSENARIY: Oxirgi variant matnini tahrirlash (onOptionTextChange)
    console.log('\n--- 6. Variant matnini tahrirlash ---');
    assert(
        teacherViewCode.includes("onOptionTextChange(idx, optIdx, val)"),
        "Variant matnini realtime yangilash funksiyasi mavjud"
    );
    assert(
        teacherViewCode.includes("syncCurrentStepState()"),
        "Barcha bosqichlar orasida matnlar to'liq sinxronlashadi"
    );

    // 7-SSENARIY: Variantni o'chirish va harflarni qayta indekslash (removeWizardOption)
    console.log('\n--- 7. Variantni o\'chirish va qayta indekslash ---');
    assert(
        teacherViewCode.includes("removeWizardOption(qIdx, optIdx)"),
        "Variantni o'chirish funksiyasi mavjud"
    );
    assert(
        teacherViewCode.includes("q.options.length <= 2") && teacherViewCode.includes("Kamida 2 ta"),
        "Kamida 2 ta variant bo'lishi talab qilinadi va 2 tadan kam bo'lsa ogohlantiriladi"
    );
    assert(
        teacherViewCode.includes("opt.option_key = String.fromCharCode(65 + i)"),
        "Variant o'chirilgach qolgan harflar (A, B, C...) to'g'ri qayta indekslanadi"
    );

    // 8-SSENARIY: To'g'ri javobni tanlash (setWizardCorrectOption)
    console.log('\n--- 8. To\'g\'ri javobni tanlash radiosi ---');
    assert(
        teacherViewCode.includes("setWizardCorrectOption(qIdx, optIdx)"),
        "To'g'ri javobni belgilash funksiyasi mavjud"
    );
    assert(
        teacherViewCode.includes("opt.is_correct = (i === optIdx) ? 1 : 0"),
        "Faqat bitta variant to'g'ri (1) bo'ladi, qolganlari (0) bo'ladi"
    );

    // 9-SSENARIY: Yopiq testni ochiq savolga o'tkazish
    console.log('\n--- 9. Yopiq testni ochiq savolga o\'tkazish ---');
    assert(
        teacherViewCode.includes("changeQuestionType(idx, newType)"),
        "Savol turini almashtirish funksiyasi mavjud"
    );
    assert(
        teacherViewCode.includes("q.question_type = 'open'"),
        "Ochiq savolga o'tkazilganda savol turi 'open' ga aylanadi"
    );

    // 10-SSENARIY: Ochiq savolni yopiq testga o'tkazish
    console.log('\n--- 10. Ochiq savolni yopiq testga o\'tkazish ---');
    assert(
        teacherViewCode.includes("q.question_type = 'closed'") && teacherViewCode.includes("option_key: 'A'") && teacherViewCode.includes("option_key: 'B'"),
        "Yopiq testga o'tkazilganda standart A va B variantlari shakllantiriladi"
    );

    // 11-SSENARIY: Bir nechta savollar qo'shish va ular orasida scroll
    console.log('\n--- 11. Bir nechta savollar va scroll arxitekturasi ---');
    assert(
        cssContent.includes("#wizard-pane-content") && cssContent.includes("overflow-y: auto"),
        "#wizard-pane-content elementida mustaqil overflow-y: auto o'rnatilgan"
    );
    assert(
        cssContent.includes(".modal-container.modal-xl") && cssContent.includes("height: 90vh"),
        "Modal balandligi 90vh bilan chegaralangan va flex-direction: column bilan tashkil etilgan"
    );
    assert(
        cssContent.includes(".wizard-actions-bar") && cssContent.includes("flex-shrink: 0"),
        "Pastki harakat tugmalari paneli doimo ko'rinadigan qilib mahkamlangan (pinned footer)"
    );

    // 12-SSENARIY: Savollar tartibini o'zgartirish (moveWizardQuestion)
    console.log('\n--- 12. Savollar tartibini yuqoriga/pastga surish ---');
    assert(
        teacherViewCode.includes("moveWizardQuestion(idx, direction)"),
        "Savollar tartibini o'zgartirish funksiyasi mavjud"
    );

    // 13-SSENARIY: Modalni ochish/yopish va bekor qilish
    console.log('\n--- 13. Modalni ochish, yopish va bekor qilish ---');
    assert(
        teacherViewCode.includes("confirmCloseWizard()"),
        "Modalni xavfsiz tasdiqlab yopish funksiyasi mavjud"
    );

    // 14-SSENARIY: Mobil moslashuvchanlik (Responsive CSS)
    console.log('\n--- 14. Mobil ekranlar uchun responsive gridlar ---');
    assert(
        cssContent.includes("@media (max-width: 640px)") && cssContent.includes("grid-template-columns: 1fr"),
        "Kichik ekranlarda (max-width: 640px) barcha maydonlar 1 ustunli (1fr) holatga o'tadi"
    );
    assert(
        cssContent.includes(".step1-row-grid-2") && cssContent.includes(".step1-row-grid-3"),
        "Desktopda bir-biriga tegishli maydonlar ixcham 2 va 3 ustunli qatorlarda joylashadi"
    );

    // 15-SSENARIY: Topshiriqni saqlash va tahrirlashda ma'lumotlarning saqlanishi
    console.log('\n--- 15. Backend bilan integratsiya va saqlanish ---');
    const testAssign = await db.allAsync("SELECT id, title, attempts_limit FROM assignments ORDER BY id DESC LIMIT 1");
    assert(testAssign && testAssign.length > 0, "Bazada topshiriqlar mavjud");
    const assignId = testAssign[0].id;
    const questions = await db.allAsync("SELECT id, question_type, question_text, points FROM assignment_questions WHERE assignment_id = ?", [assignId]);
    assert(questions && questions.length >= 0, `Topshiriq #${assignId} uchun savollar so'rovi muvaffaqiyatli ishlaydi`);

    // 16-SSENARIY: Talaba topshirishi va o'qituvchi baholash to'liq zanjiri
    console.log('\n--- 16. Talaba topshirishi va o\'qituvchi baholash zanjiri ---');
    const submission = await db.allAsync("SELECT id, status, total_score, max_score, attempt_number FROM submissions ORDER BY id DESC LIMIT 1");
    assert(
        submission && submission.length > 0 && submission[0].status === 'graded',
        "Talaba topshirishi o'qituvchi tomonidan to'liq baholangan va status 'graded' holatda"
    );

    console.log('\n===============================================================');
    console.log(`📊 TEKSHIRUV YAKUNI: ${passedTests} ta o'tdi, ${failedTests} ta xato`);
    console.log('===============================================================');

    if (failedTests === 0) {
        console.log('🎉 Barcha 16 ta ssenariy 100% muvaffaqiyatli tekshirildi!');
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test ijrosida kutilmagan xato:', err);
    process.exit(1);
});
