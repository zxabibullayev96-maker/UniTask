/**
 * UniTask AI - Talaba Foydalanuvchi Interfeysi (Student View)
 */

const StudentView = {
  assignments: [],
  mySubmissions: [],

  async render() {
    return `
      <div style="margin-bottom: 2rem;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: var(--radius-lg); padding: 1.75rem 2rem; color: white; margin-bottom: 2rem; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.75rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; margin-bottom: 0.5rem;">
                <i class="fas fa-graduation-cap"></i> ${AppState.user.group_name || 'Akademik Guruh'}
              </div>
              <h1 style="font-size: 1.75rem; font-weight: 800; color: white; letter-spacing: -0.02em;">
                Salom, ${AppState.user.name}!
              </h1>
              <p style="font-size: 0.9rem; opacity: 0.85;">
                Mustaqil ta'lim topshiriqlarini bajaring, AI semantik tahlili orqali bilimingizdagi bo'shliqlarni aniqlang va yuqori ballarga erishing.
              </p>
            </div>
            <div style="text-align: right;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.85rem; padding: 0.5rem 1rem; border: 1px solid rgba(16, 185, 129, 0.4);">
                <i class="fas fa-circle" style="font-size: 0.5rem; vertical-align: middle;"></i> Tizim Faol
              </span>
            </div>
          </div>
        </div>

        <!-- Student Content Tabs / Filter -->
        <div id="student-assignments-container">
          <div style="text-align: center; padding: 3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    await this.loadData();
  },

  async loadData() {
    const container = document.getElementById('student-assignments-container');
    try {
      const res = await Api.assignments.getAll();
      this.assignments = res.assignments || [];

      if (this.assignments.length === 0) {
        container.innerHTML = `
          <div class="empty-state card">
            <i class="fas fa-book-reader empty-state-icon"></i>
            <div class="empty-state-title">Hozircha guruhda topshiriqlar mavjud emas</div>
            <div class="empty-state-desc">O'qituvchingiz yangi mustaqil ta'lim topshirig'i yuklaganda bu yerda ko'rinadi.</div>
          </div>
        `;
        return;
      }

      // 3 toifaga ajratamiz:
      // 1. Yangi (topshirilmagan)
      // 2. AI tekshirgan / kutilyapti (pending yoki reviewed)
      // 3. O'qituvchi baholagan (graded)
      const pendingTasks = this.assignments.filter(a => !a.submission_status);
      const submittedTasks = this.assignments.filter(a => a.submission_status && a.submission_status !== 'graded');
      const gradedTasks = this.assignments.filter(a => a.submission_status === 'graded');

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <!-- 1. Bajarilishi kerak bo'lgan topshiriqlar -->
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-edit text-primary"></i> Bajarilishi Kerak Bo'lgan Topshiriqlar (${pendingTasks.length})
              </h3>
            </div>
            ${pendingTasks.length > 0 
              ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.25rem;">
                   ${pendingTasks.map(a => this.renderPendingTaskCard(a)).join('')}
                 </div>`
              : `<div class="card" style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                   <i class="fas fa-check-circle" style="color: var(--success); font-size: 1.25rem;"></i> Barcha yangi topshiriqlar topshirilgan!
                 </div>`
            }
          </div>

          <!-- 2. AI Tahlili / Tekshiruvdagi ishlar -->
          ${submittedTasks.length > 0 ? `
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-robot" style="color: #6366f1;"></i> AI Tahlili Tayyor / O'qituvchi Ko'rib Chiqishi Kutilayotgan Ishlar (${submittedTasks.length})
                </h3>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.25rem;">
                ${submittedTasks.map(a => this.renderSubmittedTaskCard(a)).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 3. Baholangan ishlar -->
          ${gradedTasks.length > 0 ? `
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-check-double text-success"></i> O'qituvchi Tomonidan Baholangan Ishlar (${gradedTasks.length})
                </h3>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.25rem;">
                ${gradedTasks.map(a => this.renderGradedTaskCard(a)).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Topshiriqlarni yuklashda xatolik: ${e.message}</p></div>`;
    }
  },

  renderPendingTaskCard(a) {
    return `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card-body">
          <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            <i class="fas fa-user-tie"></i> ${a.teacher_name} &bull; ${AppUI.formatDate(a.created_at)}
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; line-height: 1.4;">
            ${a.title}
          </h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 1rem;">
            <strong>Savol:</strong> ${a.open_question}
          </p>
        </div>
        <div class="card-footer" style="background: white; border-top: 1px solid var(--border);">
          <span class="badge badge-pending"><i class="fas fa-hourglass-start"></i> Topshirilmagan</span>
          <button class="btn btn-primary btn-sm" onclick="StudentView.showSubmitModal(${a.id})">
            <i class="fas fa-pen"></i> Topshirish
          </button>
        </div>
      </div>
    `;
  },

  renderSubmittedTaskCard(a) {
    return `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-left: 4px solid #6366f1;">
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.775rem; color: var(--text-muted);">${AppUI.formatDate(a.submitted_at)}</span>
            ${AppUI.getStatusBadge(a.submission_status)}
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
            ${a.title}
          </h4>
          <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.825rem; font-weight: 600; color: var(--text-muted);"><i class="fas fa-brain"></i> AI Tavsiya Bali:</span>
            <span style="font-weight: 800; color: var(--primary); font-size: 1.15rem;">${a.recommended_score !== null ? `${a.recommended_score} ball` : 'Kutilmoqda'}</span>
          </div>
        </div>
        <div class="card-footer" style="background: white; border-top: 1px solid var(--border);">
          <span style="font-size: 0.775rem; color: var(--text-muted);"><i class="fas fa-user-clock"></i> O'qituvchi tasdiqlashi kutilmoqda</span>
          <button class="btn btn-secondary btn-sm" onclick="StudentView.showResultModal(${a.submission_id})">
            <i class="fas fa-eye"></i> Tahlilni Ko'rish
          </button>
        </div>
      </div>
    `;
  },

  renderGradedTaskCard(a) {
    return `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-left: 4px solid var(--success);">
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.775rem; color: var(--text-muted);">${AppUI.formatDate(a.submitted_at)}</span>
            <span class="badge badge-graded"><i class="fas fa-check-double"></i> Baholandi</span>
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
            ${a.title}
          </h4>
          <div style="background: var(--success-light); padding: 0.75rem 1rem; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.85rem; font-weight: 600; color: #065f46;"><i class="fas fa-star"></i> Yakuniy Baho:</span>
            <strong style="font-size: 1.35rem; color: #065f46;">${a.teacher_score} / 100</strong>
          </div>
        </div>
        <div class="card-footer" style="background: white; border-top: 1px solid var(--border);">
          <span style="font-size: 0.775rem; color: var(--text-muted);"><i class="fas fa-check-circle text-success"></i> O'qituvchi baholadi</span>
          <button class="btn btn-outline btn-sm" onclick="StudentView.showResultModal(${a.submission_id})">
            <i class="fas fa-chart-pie"></i> Hisobotni Ko'rish
          </button>
        </div>
      </div>
    `;
  },

  // Topshirish modali
  async showSubmitModal(assignmentId) {
    try {
      const res = await Api.assignments.getById(assignmentId);
      const a = res.assignment;

      const wordsCount = (a.content || '').split(/\s+/).filter(w => w.length > 0).length;

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- 1. O'qituvchi Nazariyasi (Ground Truth Reader) -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <label class="form-label" style="margin-bottom: 0; color: var(--text-main);">
                <i class="fas fa-book-open text-primary"></i> 1-Qadam: Mavzu Nazariyasini O'qib Chiqing (Ground Truth)
              </label>
              <span class="word-badge valid">${wordsCount} ta so'z</span>
            </div>
            ${a.file_path ? `
              <div style="margin-bottom: 0.75rem; background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-main);">
                  <i class="fas fa-paperclip text-primary fa-lg"></i>
                  <span><strong>O'qituvchi ilova qilgan fayl:</strong> ${a.file_name || 'Nazariy material'}</span>
                </div>
                <a href="${a.file_path}" target="_blank" download class="btn btn-outline btn-sm">
                  <i class="fas fa-download"></i> Faylni yuklab olish
                </a>
              </div>
            ` : ''}
            <div class="theory-reader-box">
              ${a.content}
            </div>
            <div class="form-hint">
              <span>Sun'iy intellekt sizning javobingizni yuqoridagi nazariyaga semantik mosligini tekshiradi.</span>
            </div>
          </div>

          <!-- 2. Savol / Topshiriq -->
          <div>
            <label class="form-label" style="color: var(--primary);">
              <i class="fas fa-question-circle"></i> 2-Qadam: Berilgan Savol / Situatsion Masala:
            </label>
            <div style="background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); font-weight: 600; color: #1e1b4b; font-size: 0.95rem; line-height: 1.5;">
              ${a.open_question}
            </div>
          </div>

          <!-- 3. Talaba javobi yozish maydoni -->
          <form id="form-submit-answer" onsubmit="StudentView.handleSubmitAnswer(event, ${a.id})">
            <div class="form-group" style="margin-bottom: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <label class="form-label required" style="margin-bottom: 0;">
                  <i class="fas fa-pen-alt"></i> 3-Qadam: O'z Javobingizni Yozing
                </label>
                <span id="student-answer-counter" class="word-badge">0 so'z</span>
              </div>
              <textarea 
                id="student-answer-text" 
                class="form-control" 
                style="min-height: 160px;" 
                placeholder="Savolga o'z tushunchangiz bo'yicha batafsil va ilmiy javob bering. Nazariyadagi asosiy tushunchalarni o'rinli qo'llashga harakat qiling..." 
                oninput="StudentView.updateAnswerCount(this.value)"
                required autofocus></textarea>
              <div class="form-hint">
                <span>Eslatma: Topshiriq bir marta topshiriladi va darhol AI tahliliga yuboriladi.</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;">
              <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-task">
                <i class="fas fa-paper-plane"></i> Topshirish va AI Tahliliga Yuborish
              </button>
            </div>
          </form>
        </div>
      `;

      AppUI.openModal(`<i class="fas fa-tasks text-primary"></i> ${a.title}`, html, '', 'modal-lg');
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  updateAnswerCount(text) {
    const words = (text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
    const badge = document.getElementById('student-answer-counter');
    if (!badge) return;

    badge.innerText = `${words} so'z`;
    if (words >= 30) {
      badge.className = 'word-badge valid';
    } else {
      badge.className = 'word-badge';
    }
  },

  async handleSubmitAnswer(event, assignmentId) {
    event.preventDefault();
    const answer = document.getElementById('student-answer-text').value;
    const words = answer.trim().split(/\s+/).filter(w => w.length > 0).length;

    if (words < 5) {
      AppUI.showToast('warning', 'Javob juda qisqa', 'Iltimos, savolga kamida bir nechta so\'z bilan javob yozing.');
      return;
    }

    // Modal ichini AI tahlil animatsiyasiga almashtiramiz (Non-functional requirement 6: 5-15s AI tahlili holati)
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
      <div class="ai-evaluating-container">
        <div class="ai-radar-spinner">
          <div class="radar-circle"></div>
          <div class="radar-circle"></div>
          <div class="radar-circle"></div>
          <div class="radar-core"><i class="fas fa-brain"></i></div>
        </div>

        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">
          Sun'iy Intellekt Ishingizni Tahlil Qilmoqda...
        </h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 450px; margin-bottom: 1.5rem;">
          GPT modeli javobingizni o'qituvchi nazariyasiga nisbatan semantik jihatdan taqqoslamoqda va tavsiya etilgan ballni hisoblamoqda.
        </p>

        <div class="eval-steps-list">
          <div class="eval-step-item active" id="step-1">
            <i class="fas fa-spinner fa-spin"></i> 1. Javob matni qabul qilindi va tuzilishi tekshirilmoqda
          </div>
          <div class="eval-step-item" id="step-2">
            <i class="far fa-circle"></i> 2. Nazariy matn bilan semantik taqqoslash
          </div>
          <div class="eval-step-item" id="step-3">
            <i class="far fa-circle"></i> 3. Xulosa, aniqlangan kamchiliklar va tavsiya ball
          </div>
        </div>
      </div>
    `;

    // Visual step transitions
    setTimeout(() => {
      const s1 = document.getElementById('step-1');
      const s2 = document.getElementById('step-2');
      if (s1 && s2) {
        s1.className = 'eval-step-item completed';
        s1.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 1. Javob tuzilishi tahlil qilindi`;
        s2.className = 'eval-step-item active';
        s2.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 2. Nazariy matn bilan semantik taqqoslash`;
      }
    }, 1800);

    setTimeout(() => {
      const s2 = document.getElementById('step-2');
      const s3 = document.getElementById('step-3');
      if (s2 && s3) {
        s2.className = 'eval-step-item completed';
        s2.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 2. Semantik taqqoslash yakunlandi`;
        s3.className = 'eval-step-item active';
        s3.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 3. AI tahlil hisoboti shakllantirilmoqda...`;
      }
    }, 3800);

    try {
      const res = await Api.submissions.submitAnswer({
        assignment_id: assignmentId,
        student_answer: answer
      });

      // Kichik kechikish bilan tahlil natijasini ko'rsatamiz
      setTimeout(() => {
        AppUI.showToast('success', 'Qabul qilindi!', res.message);
        StudentView.showResultModal(res.submission.id);
        StudentView.loadData();
      }, 1000);

    } catch (err) {
      AppUI.showToast('danger', 'Xatolik yuz berdi', err.message);
      AppUI.closeModal();
      this.loadData();
    }
  },

  // Natijani ko'rish modali
  async showResultModal(submissionId) {
    try {
      const res = await Api.submissions.getById(submissionId);
      const s = res.submission;

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Holat banneri -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md);">
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${s.assignment_title}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted);"><i class="fas fa-user-tie"></i> O'qituvchi: ${s.teacher_name} &bull; ${AppUI.formatDate(s.submitted_at)}</div>
            </div>
            <div>
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          <!-- O'qituvchi bahosi (agar mavjud bo'lsa) -->
          ${s.teacher_score !== null ? `
            <div class="card" style="border: 2px solid var(--success); background: var(--success-light);">
              <div class="card-body" style="padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 700; color: #065f46; font-size: 1.1rem;"><i class="fas fa-award"></i> O'qituvchining Yakuniy Bahosi</span>
                  <span style="font-size: 1.75rem; font-weight: 800; color: #065f46;">${s.teacher_score} / 100</span>
                </div>
                ${s.teacher_feedback ? `
                  <div style="font-size: 0.9rem; color: #047857; margin-top: 0.25rem;">
                    <strong>O'qituvchi izohi:</strong> "${s.teacher_feedback}"
                  </div>
                ` : ''}
              </div>
            </div>
          ` : `
            <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; color: #92400e;">
              <i class="fas fa-info-circle"></i> O'qituvchi hali yakuniy bahoni tasdiqlamagan. Quyidagi AI bali o'qituvchiga tavsiya etilgan ball hisoblanadi.
            </div>
          `}

          <!-- AI Tahlil Hisoboti -->
          <div class="ai-report-card">
            <div class="ai-header">
              <div class="ai-brand-badge">
                <i class="fas fa-brain"></i> OpenAI GPT-4o-mini Tahliliy Xulosasi
              </div>
              <div class="ai-score-pill">
                <span class="score-number">${s.recommended_score !== null ? s.recommended_score : '-'}</span>
                <span class="score-max">/ 100 ball</span>
              </div>
            </div>

            <!-- Xulosa -->
            <div class="ai-section">
              <div class="ai-section-title summary">
                <i class="fas fa-check-circle"></i> Mavzuni O'zlashtirish Darajasi
              </div>
              <div class="ai-section-content">
                ${s.ai_summary || "Hozircha tahlil ma'lumoti yo'q."}
              </div>
            </div>

            <!-- Aniqlangan kamchiliklar -->
            <div class="ai-section">
              <div class="ai-section-title gaps">
                <i class="fas fa-lightbulb"></i> Bilimdagi Bo'shliqlar & Tavsiyalar
              </div>
              <div class="ai-section-content" style="color: #92400e;">
                ${s.ai_gaps || "Kamchiliklar aniqlanmadi."}
              </div>
            </div>
          </div>

          <!-- Sizning javobingiz -->
          <div>
            <label class="form-label"><i class="fas fa-comment-alt"></i> Siz Topshirgan Javob Matni:</label>
            <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; font-size: 0.875rem; line-height: 1.6; max-height: 150px; overflow-y: auto;">
              ${s.student_answer}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
            <button class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
          </div>
        </div>
      `;

      AppUI.openModal(`<i class="fas fa-clipboard-check text-primary"></i> Topshiriq Natijasi va AI Tahlili`, html, '', 'modal-lg');
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  }
};
