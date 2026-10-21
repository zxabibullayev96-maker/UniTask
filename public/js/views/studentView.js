/**
 * UniTask AI - Talaba Foydalanuvchi Interfeysi (Student View)
 * Ochiq va yopiq testlarni yechish, ko'rib chiqish va AI semantik tahlili natijalarini kuzatish.
 */

const StudentView = {
  assignments: [],
  mySubmissions: [],
  currentAssignment: null,
  studentAnswers: {}, // { [questionId]: { question_id, selected_option_id, answer_text } }

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
    const totalPts = a.total_points || 100;
    const qCount = a.question_count || 0;
    const closedCount = a.closed_count || 0;
    const openCount = a.open_count || 0;

    return `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div class="card-body">
          <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            ${a.subject ? `<span style="font-weight: 600; color: var(--primary);"><i class="fas fa-book"></i> ${a.subject} &bull; </span>` : ''}
            <i class="fas fa-user-tie"></i> ${a.teacher_name} &bull; ${AppUI.formatDate(a.created_at)}
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem; line-height: 1.4;">
            ${a.title}
          </h4>
          
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
            ${a.has_dynamic_questions ? `
              <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.75rem;">
                <i class="fas fa-layer-group"></i> ${qCount} ta savol (${closedCount} test, ${openCount} ochiq)
              </span>
              <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.75rem;">
                <i class="fas fa-star"></i> Jami: ${totalPts} ball
              </span>
            ` : `
              <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-size: 0.75rem;">
                <i class="fas fa-pen-alt"></i> 1 ta ochiq savol (100 ball)
              </span>
            `}
          </div>

          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 0.75rem;">
            ${a.instructions ? `<strong>Ko'rsatma:</strong> ${a.instructions}` : (a.open_question || 'Mustaqil ta\'lim topshirig\'i')}
          </p>

          ${a.due_date ? `
            <div style="font-size: 0.775rem; color: #dc2626; font-weight: 600;">
              <i class="fas fa-clock"></i> Muddat: ${AppUI.formatDate(a.due_date)}
            </div>
          ` : ''}
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
    const scoreDisplay = a.total_score !== null 
      ? `${a.total_score} / ${a.max_score || a.total_points || 100} ball (${a.recommended_score || 0}%)`
      : (a.recommended_score !== null ? `${a.recommended_score} ball` : 'Kutilmoqda');

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
            <span style="font-weight: 800; color: var(--primary); font-size: 1.05rem;">${scoreDisplay}</span>
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
    const maxPts = a.max_score || a.total_points || 100;

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
            <strong style="font-size: 1.35rem; color: #065f46;">${a.teacher_score} / ${maxPts} ball</strong>
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

  // =========================================================================
  // TOPSHIRIQNI BAJARISH MODALI (Show Submit Modal)
  // =========================================================================

  async showSubmitModal(assignmentId) {
    try {
      const res = await Api.assignments.getById(assignmentId);
      const a = res.assignment;
      this.currentAssignment = a;
      this.studentAnswers = {}; // Tozalash

      const questions = a.questions || [];
      const isDynamic = a.has_dynamic_questions === 1 || questions.length > 0;
      const wordsCount = (a.content || '').split(/\s+/).filter(w => w.length > 0).length;

      // Dinamik savollar uchun boshlang'ich bo'sh javoblarni tayyorlaymiz
      if (isDynamic) {
        questions.forEach(q => {
          this.studentAnswers[q.id] = {
            question_id: q.id,
            selected_option_id: null,
            answer_text: ''
          };
        });
      }

      let questionsHtml = '';

      if (isDynamic) {
        questionsHtml = `
          <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: #e0e7ff; padding: 0.75rem 1.25rem; border-radius: var(--radius-md);">
              <span style="font-weight: 700; color: #3730a3; font-size: 0.95rem;">
                <i class="fas fa-tasks"></i> Savollar ro'yxati (${questions.length} ta savol &bull; Jami ${a.total_points || 100} ball)
              </span>
              <span id="answered-progress-badge" class="badge" style="background: white; color: #3730a3;">
                0 / ${questions.length} ta bajarildi
              </span>
            </div>

            ${questions.map((q, idx) => {
              const isClosed = q.question_type === 'closed';

              return `
                <div class="quiz-question-box" id="quiz-q-box-${q.id}">
                  <div class="quiz-question-header">
                    <div>
                      <span style="font-weight: 800; color: var(--primary); font-size: 1rem;">#${idx + 1}-savol</span>
                      <span class="badge ${isClosed ? 'builder-badge-closed' : 'builder-badge-open'}" style="margin-left: 0.5rem;">
                        ${isClosed ? 'Yopiq Test' : 'Ochiq Savol'}
                      </span>
                    </div>
                    <span style="font-weight: 700; color: var(--primary); font-size: 0.9rem;">
                      ${q.points} ball
                    </span>
                  </div>

                  <!-- Savol matni -->
                  <div style="font-size: 1.05rem; font-weight: 600; color: var(--text-main); margin-bottom: 1.25rem; line-height: 1.5;">
                    ${q.question_text}
                  </div>

                  ${isClosed ? `
                    <!-- Yopiq test variantlari (Xavfsiz: to'g'ri javoblar umuman yo'q) -->
                    <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                      ${(q.options || []).map(opt => `
                        <div 
                          class="quiz-option-item" 
                          id="opt-item-${q.id}-${opt.id}" 
                          onclick="StudentView.selectOption(${q.id}, ${opt.id})"
                        >
                          <div class="quiz-option-circle" id="opt-circle-${q.id}-${opt.id}">${opt.option_key}</div>
                          <div style="font-size: 0.95rem; color: var(--text-main); line-height: 1.4;">${opt.option_text}</div>
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <!-- Ochiq savol javob yozish maydoni -->
                    <div>
                      ${q.instruction ? `
                        <div style="background: #eff6ff; border-left: 3px solid #3b82f6; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.825rem; color: #1e40af; margin-bottom: 0.75rem;">
                          <i class="fas fa-lightbulb"></i> <strong>Ko'rsatma:</strong> ${q.instruction}
                        </div>
                      ` : ''}

                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                        <label class="form-label required" style="font-size: 0.85rem; margin: 0;">Sizning batafsil javobingiz:</label>
                        <span id="open-ans-count-${q.id}" class="word-badge">0 so'z</span>
                      </div>

                      <textarea 
                        id="open-ans-text-${q.id}" 
                        class="form-control" 
                        style="min-height: 120px;" 
                        placeholder="Ushbu savol bo'yicha o'z bilimlaringiz va xulosalaringizni bayon eting..." 
                        oninput="StudentView.handleOpenAnswerInput(${q.id}, this.value)"
                        required></textarea>
                      <div class="form-hint">
                        <span>AI sizning javobingizni tushunchalar to'liqligi va ilmiy aniqligi bo'yicha baholaydi.</span>
                      </div>
                    </div>
                  `}

                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        // Eski formatdagi topshiriq (bitta umumiy savol)
        questionsHtml = `
          <div style="margin-top: 1.5rem;">
            <label class="form-label" style="color: var(--primary);">
              <i class="fas fa-question-circle"></i> Berilgan Savol / Situatsion Masala:
            </label>
            <div style="background: var(--primary-light); padding: 1rem; border-radius: var(--radius-md); font-weight: 600; color: #1e1b4b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.25rem;">
              ${a.open_question}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <label class="form-label required" style="margin-bottom: 0;">
                <i class="fas fa-pen-alt"></i> Sizning Javobingiz:
              </label>
              <span id="legacy-answer-counter" class="word-badge">0 so'z</span>
            </div>
            <textarea 
              id="legacy-student-answer" 
              class="form-control" 
              style="min-height: 160px;" 
              placeholder="Savolga o'z tushunchangiz bo'yicha batafsil va ilmiy javob bering..." 
              oninput="StudentView.updateLegacyAnswerCount(this.value)"
              required></textarea>
          </div>
        `;
      }

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Topshiriq Headeri -->
          <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 1.25rem 1.5rem; border-radius: var(--radius-lg); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: white; margin: 0;">${a.title}</h2>
              <span class="badge" style="background: rgba(255,255,255,0.2); color: white; font-size: 0.85rem;">
                <i class="fas fa-star"></i> Jami: ${a.total_points || 100} ball
              </span>
            </div>
            <div style="font-size: 0.85rem; opacity: 0.9;">
              ${a.subject ? `<span><strong>Fan:</strong> ${a.subject} &bull; </span>` : ''}
              <span><i class="fas fa-user-tie"></i> O'qituvchi: ${a.teacher_name}</span>
              ${a.due_date ? ` &bull; <span><i class="fas fa-clock"></i> Muddat: ${AppUI.formatDate(a.due_date)}</span>` : ''}
            </div>
          </div>

          <!-- O'qituvchi ko'rsatmasi (agar mavjud bo'lsa) -->
          ${a.instructions ? `
            <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 0.75rem 1.25rem; border-radius: var(--radius-md); font-size: 0.875rem; color: #15803d;">
              <strong><i class="fas fa-info-circle"></i> O'qituvchi ko'rsatmasi:</strong> ${a.instructions}
            </div>
          ` : ''}

          <!-- Nazariya Ground Truth o'quvchi bloki -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <label class="form-label" style="margin-bottom: 0; color: var(--text-main);">
                <i class="fas fa-book-open text-primary"></i> Mavzu Nazariyasi (Ground Truth)
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

            <div class="theory-reader-box" style="max-height: 160px;">
              ${a.content}
            </div>
          </div>

          <!-- Savollar bloki -->
          <form id="form-student-submit" onsubmit="StudentView.handleSubmitAnswers(event, ${a.id}, ${isDynamic})">
            ${questionsHtml}

            <!-- Pastki topshirish amallari -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1.25rem; margin-top: 1.5rem;">
              <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
              
              <button type="submit" class="btn btn-primary btn-lg" id="btn-submit-task">
                <i class="fas fa-paper-plane"></i> Javoblarni Topshirish va AI Tahliliga Yuborish
              </button>
            </div>
          </form>

        </div>
      `;

      AppUI.openModal(`<i class="fas fa-tasks text-primary"></i> ${a.title}`, html, '', 'modal-xl');

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // Yopiq test variantini tanlash
  selectOption(questionId, optionId) {
    if (!this.studentAnswers[questionId]) {
      this.studentAnswers[questionId] = { question_id: questionId, selected_option_id: null, answer_text: '' };
    }

    this.studentAnswers[questionId].selected_option_id = optionId;

    // UI da tanlangan variantni active qilish
    const qBox = document.getElementById(`quiz-q-box-${questionId}`);
    if (qBox) {
      const items = qBox.querySelectorAll('.quiz-option-item');
      items.forEach(it => it.classList.remove('selected'));

      const selectedItem = document.getElementById(`opt-item-${questionId}-${optionId}`);
      if (selectedItem) {
        selectedItem.classList.add('selected');
      }
    }

    this.updateAnswerProgress();
  },

  // Ochiq savol javobini kiritish
  handleOpenAnswerInput(questionId, text) {
    if (!this.studentAnswers[questionId]) {
      this.studentAnswers[questionId] = { question_id: questionId, selected_option_id: null, answer_text: '' };
    }

    this.studentAnswers[questionId].answer_text = text;

    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const badge = document.getElementById(`open-ans-count-${questionId}`);
    if (badge) {
      badge.innerText = `${words} so'z`;
      if (words >= 20) {
        badge.className = 'word-badge valid';
      } else {
        badge.className = 'word-badge';
      }
    }

    this.updateAnswerProgress();
  },

  // Javoblar progressini yangilash
  updateAnswerProgress() {
    if (!this.currentAssignment || !this.currentAssignment.questions) return;
    const questions = this.currentAssignment.questions;

    let answeredCount = 0;
    questions.forEach(q => {
      const ans = this.studentAnswers[q.id];
      if (ans) {
        if (q.question_type === 'closed' && ans.selected_option_id) {
          answeredCount++;
        } else if (q.question_type === 'open' && ans.answer_text && ans.answer_text.trim().length > 0) {
          answeredCount++;
        }
      }
    });

    const badge = document.getElementById('answered-progress-badge');
    if (badge) {
      badge.innerText = `${answeredCount} / ${questions.length} ta bajarildi`;
      if (answeredCount === questions.length) {
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
      } else {
        badge.style.background = 'white';
        badge.style.color = '#3730a3';
      }
    }
  },

  updateLegacyAnswerCount(text) {
    const words = (text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
    const badge = document.getElementById('legacy-answer-counter');
    if (!badge) return;

    badge.innerText = `${words} so'z`;
    if (words >= 30) {
      badge.className = 'word-badge valid';
    } else {
      badge.className = 'word-badge';
    }
  },

  // Javoblarni topshirish
  async handleSubmitAnswers(event, assignmentId, isDynamic) {
    event.preventDefault();

    let payload = { assignment_id: assignmentId };

    if (isDynamic) {
      const questions = this.currentAssignment.questions || [];
      const answersList = [];

      let unansweredCount = 0;

      questions.forEach(q => {
        const a = this.studentAnswers[q.id] || { question_id: q.id, selected_option_id: null, answer_text: '' };
        if (q.question_type === 'closed' && !a.selected_option_id) {
          unansweredCount++;
        }
        if (q.question_type === 'open' && (!a.answer_text || !a.answer_text.trim())) {
          unansweredCount++;
        }
        answersList.push(a);
      });

      if (unansweredCount > 0) {
        const proceed = confirm(`Diqqat: ${unansweredCount} ta savolga javob belgilanmadi! Baribir topshirishni xohlaysizmi?`);
        if (!proceed) return;
      }

      payload.answers = answersList;
    } else {
      const text = document.getElementById('legacy-student-answer').value;
      if (!text || text.trim().length < 5) {
        AppUI.showToast('warning', 'Javob qisqa', 'Iltimos, savolga kamida bir necha so\'z yozing.');
        return;
      }
      payload.student_answer = text;
    }

    // Modal ichini AI tahlil radar animatsiyasiga almashtirish
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
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 480px; margin-bottom: 1.5rem;">
          Yopiq testlar backendda to'g'ri javoblar bilan tekshirilmoqda, ochiq savollar esa GPT AI orqali semantik baholanmoqda.
        </p>

        <div class="eval-steps-list">
          <div class="eval-step-item active" id="step-1">
            <i class="fas fa-spinner fa-spin"></i> 1. Javoblar serverga qabul qilindi va tekshirilmoqda
          </div>
          <div class="eval-step-item" id="step-2">
            <i class="far fa-circle"></i> 2. Yopiq testlar ballari va ochiq savollar semantik tahlili
          </div>
          <div class="eval-step-item" id="step-3">
            <i class="far fa-circle"></i> 3. Natijalar, xulosalar va tavsiyalar hisoblanmoqda...
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const s1 = document.getElementById('step-1');
      const s2 = document.getElementById('step-2');
      if (s1 && s2) {
        s1.className = 'eval-step-item completed';
        s1.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 1. Javoblar muvaffaqiyatli qabul qilindi`;
        s2.className = 'eval-step-item active';
        s2.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 2. AI ochiq savollarni semantik tahlil qilmoqda...`;
      }
    }, 1800);

    setTimeout(() => {
      const s2 = document.getElementById('step-2');
      const s3 = document.getElementById('step-3');
      if (s2 && s3) {
        s2.className = 'eval-step-item completed';
        s2.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 2. AI semantik tahlili yakunlandi`;
        s3.className = 'eval-step-item active';
        s3.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 3. Yakuniy hisobot shakllantirilmoqda...`;
      }
    }, 3800);

    try {
      const res = await Api.submissions.submitAnswer(payload);

      setTimeout(() => {
        AppUI.showToast('success', 'Muvaffaqiyatli!', res.message);
        StudentView.showResultModal(res.submission.id);
        StudentView.loadData();
      }, 1000);

    } catch (err) {
      AppUI.showToast('danger', 'Xatolik yuz berdi', err.message);
      AppUI.closeModal();
      this.loadData();
    }
  },

  // =========================================================================
  // NATIJANI VA AI TAHLILINI KO'RISH MODALI (Show Result Modal)
  // =========================================================================

  async showResultModal(submissionId) {
    try {
      const res = await Api.submissions.getById(submissionId);
      const s = res.submission;
      const answers = s.answers || [];
      const isDynamic = s.has_dynamic_questions === 1 || answers.length > 0;
      const maxPts = s.max_score || s.assignment_total_points || 100;

      let answersBreakdownHtml = '';

      if (isDynamic) {
        answersBreakdownHtml = `
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">
              <i class="fas fa-list-ol text-primary"></i> Savollar Bo'yicha Natijalaringiz (${answers.length} ta savol):
            </h4>

            ${answers.map((ans, idx) => {
              const isClosed = ans.question_type === 'closed';
              const isCorrect = ans.is_correct === 1;
              const qMax = ans.question_points || 10;
              const aiFb = ans.ai_feedback || {};

              return `
                <div class="grade-answer-card ${isClosed ? (isCorrect ? 'correct-card' : 'incorrect-card') : 'open-card'}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
                    <div>
                      <span style="font-weight: 800; color: var(--text-main);">#${idx + 1}-savol:</span>
                      <span class="badge ${isClosed ? 'builder-badge-closed' : 'builder-badge-open'}" style="margin-left: 0.35rem;">
                        ${isClosed ? 'Yopiq Test' : 'Ochiq Savol'}
                      </span>
                    </div>

                    <div>
                      ${isClosed ? `
                        <span class="badge ${isCorrect ? 'badge-graded' : 'badge-pending'}" style="${isCorrect ? '' : 'background: #fee2e2; color: #b91c1c;'}">
                          <i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i>
                          ${isCorrect ? `To'g'ri (${ans.ai_score} / ${qMax} ball)` : `Noto'g'ri (0 / ${qMax} ball)`}
                        </span>
                      ` : `
                        <span class="badge badge-reviewed">
                          <i class="fas fa-robot"></i> AI ball: ${ans.ai_score !== null ? `${ans.ai_score} / ${qMax} ball` : 'Kutilmoqda'}
                        </span>
                      `}
                    </div>
                  </div>

                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
                    ${ans.question_text}
                  </div>

                  ${isClosed ? `
                    <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem;">
                      <div>
                        <strong>Siz tanlagan javob:</strong> 
                        ${ans.selected_option_key ? `
                          <span style="font-weight: 700; color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
                            [${ans.selected_option_key}] ${ans.selected_option_text || ''}
                          </span>
                        ` : '<span style="color: var(--danger); font-style: italic;">Javob berilmagan</span>'}
                      </div>
                      
                      ${s.status === 'graded' && ans.options ? `
                        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border); font-size: 0.8rem;">
                          <div style="color: var(--text-muted); margin-bottom: 0.25rem;">Variantlar holati:</div>
                          ${ans.options.map(opt => `
                            <div style="color: ${opt.is_correct ? '#15803d' : 'var(--text-muted)'}; font-weight: ${opt.is_correct ? '700' : 'normal'};">
                              ${opt.is_correct ? '<i class="fas fa-check-circle" style="color: var(--success);"></i>' : '<i class="far fa-circle"></i>'}
                              <strong>${opt.option_key}:</strong> ${opt.option_text} ${opt.is_correct ? '(To\'g\'ri javob)' : ''}
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  ` : `
                    <div style="margin-bottom: 0.75rem;">
                      <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Siz yozgan javob:</label>
                      <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.75rem 1rem; font-size: 0.875rem; line-height: 1.6; max-height: 120px; overflow-y: auto;">
                        ${ans.answer_text || '<em style="color: var(--text-muted);">(Javob yozilmagan)</em>'}
                      </div>
                    </div>

                    <!-- AI Tahlili -->
                    <div class="ai-report-card">
                      <div class="ai-header" style="padding-bottom: 0.4rem; margin-bottom: 0.4rem;">
                        <div class="ai-brand-badge" style="font-size: 0.75rem;">
                          <i class="fas fa-brain"></i> AI Tahliliy Xulosasi
                        </div>
                        <div style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">
                          ${ans.ai_score !== null ? `${ans.ai_score} / ${qMax} ball` : '-'}
                        </div>
                      </div>

                      <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-main); margin-bottom: 0.4rem;">
                        ${aiFb.summary || "Tahlil ma'lumotlari kutilmoqda."}
                      </div>

                      ${aiFb.strengths ? `
                        <div style="font-size: 0.825rem; color: #15803d; margin-bottom: 0.35rem;">
                          <i class="fas fa-check-circle"></i> <strong>To'g'ri jihatlar:</strong> ${aiFb.strengths}
                        </div>
                      ` : ''}

                      ${aiFb.gaps ? `
                        <div style="font-size: 0.825rem; color: #b45309; margin-bottom: 0.35rem;">
                          <i class="fas fa-lightbulb"></i> <strong>Kamchiliklar & Bilimdagi bo'shliqlar:</strong> ${aiFb.gaps}
                        </div>
                      ` : ''}

                      ${aiFb.suggestions ? `
                        <div style="font-size: 0.825rem; color: #1d4ed8;">
                          <i class="fas fa-book"></i> <strong>Tavsiya:</strong> ${aiFb.suggestions}
                        </div>
                      ` : ''}
                    </div>

                    ${ans.teacher_feedback ? `
                      <div style="margin-top: 0.5rem; background: #f0fdf4; border-left: 3px solid #22c55e; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.825rem; color: #15803d;">
                        <strong><i class="fas fa-chalkboard-teacher"></i> O'qituvchi izohi:</strong> "${ans.teacher_feedback}"
                      </div>
                    ` : ''}
                  `}

                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        // Eski formatdagi topshiriq
        answersBreakdownHtml = `
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

            <div class="ai-section">
              <div class="ai-section-title summary"><i class="fas fa-check-circle"></i> O'zlashtirish Darajasi</div>
              <div class="ai-section-content">${s.ai_summary || "Hozircha ma'lumot yo'q."}</div>
            </div>

            <div class="ai-section">
              <div class="ai-section-title gaps"><i class="fas fa-lightbulb"></i> Kamchiliklar</div>
              <div class="ai-section-content" style="color: #92400e;">${s.ai_gaps || "Kamchiliklar aniqlanmadi."}</div>
            </div>
          </div>

          <div>
            <label class="form-label"><i class="fas fa-comment-alt"></i> Siz Topshirgan Javob Matni:</label>
            <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; font-size: 0.875rem; line-height: 1.6; max-height: 140px; overflow-y: auto;">
              ${s.student_answer}
            </div>
          </div>
        `;
      }

      const scoreDisplay = s.total_score !== null 
        ? `${s.total_score} / ${maxPts} ball (${s.recommended_score || 0}%)`
        : (s.recommended_score !== null ? `${s.recommended_score} ball` : 'Kutilmoqda');

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Banner -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md);">
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${s.assignment_title}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted);"><i class="fas fa-user-tie"></i> O'qituvchi: ${s.teacher_name} &bull; ${AppUI.formatDate(s.submitted_at)}</div>
            </div>
            <div>
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          <!-- Yakuniy baho bloki -->
          ${s.teacher_score !== null ? `
            <div class="card" style="border: 2px solid var(--success); background: var(--success-light);">
              <div class="card-body" style="padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 700; color: #065f46; font-size: 1.1rem;"><i class="fas fa-award"></i> O'qituvchining Yakuniy Tasdiqlagan Bahosi</span>
                  <span style="font-size: 1.75rem; font-weight: 800; color: #065f46;">${s.teacher_score} / ${maxPts} ball</span>
                </div>
                ${s.teacher_feedback ? `
                  <div style="font-size: 0.9rem; color: #047857; margin-top: 0.25rem;">
                    <strong>O'qituvchi umumiy izohi:</strong> "${s.teacher_feedback}"
                  </div>
                ` : ''}
              </div>
            </div>
          ` : `
            <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 0.85rem 1.25rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; color: #92400e; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> AI Tavsiya Bali Hisoblandi</div>
                <div style="font-size: 0.8rem; color: #b45309;">O'qituvchi ko'rib chiqqach yakuniy baho tasdiqlanadi.</div>
              </div>
              <div style="font-weight: 800; color: var(--primary); font-size: 1.25rem;">
                ${scoreDisplay}
              </div>
            </div>
          `}

          <!-- Savollar tafsiloti -->
          ${answersBreakdownHtml}

          <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
            <button class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
          </div>

        </div>
      `;

      AppUI.openModal(`<i class="fas fa-clipboard-check text-primary"></i> Topshiriq Natijasi va AI Tahlili`, html, '', 'modal-xl');

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  }
};
