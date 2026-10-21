/**
 * UniTask AI - O'qituvchi Boshqaruv Paneli (Teacher View)
 * Zamonaviy, soddalashtirilgan va bosqichli test va topshiriqlar konstruktori.
 */

const TeacherView = {
  assignments: [],
  selectedAssignmentId: null,
  activeSubmissions: [],

  // Bosqichli topshiriq yaratish holati
  wizard: {
    currentStep: 1,
    editingAssignmentId: null,
    basicInfo: {
      title: '',
      subject: '',
      group_id: '',
      start_date: '',
      due_date: '',
      instructions: '',
      content: '',
      hasTheoryExpanded: false
    },
    attachedFile: null,
    questions: []
  },

  async render() {
    return `
      <div style="margin-bottom: 2rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em;">
              <i class="fas fa-chalkboard-teacher" style="color: var(--primary);"></i> O'qituvchi Ish Stoli
            </h1>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem;">
              Topshiriq va testlar yaratish, talabalar javoblarini ko'rish hamda AI yordamida baholash.
            </p>
          </div>
          <button class="btn btn-primary" onclick="TeacherView.openCreateWizard()">
            <i class="fas fa-plus"></i> Yangi Topshiriq Ochish
          </button>
        </div>

        <div id="teacher-content-container">
          <div style="text-align: center; padding: 3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    await this.loadAssignments();
  },

  async loadAssignments() {
    const container = document.getElementById('teacher-content-container');
    try {
      const res = await Api.assignments.getAll();
      this.assignments = res.assignments || [];

      if (this.assignments.length === 0) {
        container.innerHTML = `
          <div class="empty-state card">
            <i class="fas fa-folder-open empty-state-icon"></i>
            <div class="empty-state-title">Hozircha topshiriqlar mavjud emas</div>
            <div class="empty-state-desc">Talabalarga mustaqil ta'lim topshirig'i berish uchun birinchi topshiriqni oching.</div>
            <button class="btn btn-primary" onclick="TeacherView.openCreateWizard()">
              <i class="fas fa-plus"></i> Topshiriq Yaratish
            </button>
          </div>
        `;
        return;
      }

      if (!this.selectedAssignmentId && this.assignments.length > 0) {
        this.selectedAssignmentId = this.assignments[0].id;
      }

      const assignmentCards = this.assignments.map(a => {
        const isSelected = a.id === this.selectedAssignmentId;
        const totalPts = a.total_points || 100;
        const qCount = a.question_count || 0;
        const closedCount = a.closed_count || 0;
        const openCount = a.open_count || 0;

        return `
          <div class="card ${isSelected ? 'selected-assignment' : ''}" 
               style="cursor: pointer; border-left: 4px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}; margin-bottom: 0.75rem;"
               onclick="TeacherView.selectAssignment(${a.id})">
            <div class="card-body" style="padding: 1rem 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: ${isSelected ? 'var(--primary)' : 'var(--text-main)'}; line-height: 1.3;">
                  ${a.title}
                </h4>
              </div>
              <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                ${a.subject ? `<span style="font-weight: 600; color: var(--primary);"><i class="fas fa-book"></i> ${a.subject} &bull; </span>` : ''}
                <i class="fas fa-users"></i> ${a.group_name} &bull; ${AppUI.formatDate(a.created_at)}
              </div>
              
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem;">
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

              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span class="badge" style="background: var(--bg-alt); color: var(--text-main);">
                  <i class="fas fa-inbox"></i> ${a.total_submissions || 0} ta ish
                </span>
                ${(a.pending_review_count > 0) ? `
                  <span class="badge badge-reviewed">
                    <i class="fas fa-robot"></i> ${a.pending_review_count} ta baholashga tayyor
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: 360px 1fr; gap: 1.5rem; align-items: start;">
          <!-- Chap ustun: Topshiriqlar ro'yxati -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">Mening Topshiriqlarim (${this.assignments.length})</h3>
            </div>
            <div style="max-height: 80vh; overflow-y: auto; padding-right: 4px;">
              ${assignmentCards}
            </div>
          </div>

          <!-- O'ng ustun: Tanlangan topshiriq tafsiloti va talabalar ishlari -->
          <div id="assignment-details-panel">
            <div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>
          </div>
        </div>
      `;

      if (this.selectedAssignmentId) {
        await this.loadAssignmentDetails(this.selectedAssignmentId);
      }

    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Xatolik: ${e.message}</p></div>`;
    }
  },

  async selectAssignment(id) {
    this.selectedAssignmentId = id;
    await this.loadAssignments();
  },

  async loadAssignmentDetails(assignmentId) {
    const detailsPanel = document.getElementById('assignment-details-panel');
    if (!detailsPanel) return;

    try {
      const res = await Api.submissions.getByAssignment(assignmentId);
      const assignment = res.assignment;
      const submissions = res.submissions || [];
      this.activeSubmissions = submissions;

      const assignRes = await Api.assignments.getById(assignmentId);
      const detailedAssignment = assignRes.assignment;
      const questions = detailedAssignment.questions || [];

      let submissionsHtml = '';
      if (submissions.length === 0) {
        submissionsHtml = `
          <div class="empty-state" style="padding: 2rem;">
            <i class="fas fa-user-clock empty-state-icon" style="font-size: 2.5rem;"></i>
            <div class="empty-state-title" style="font-size: 1rem;">Hozircha javoblar kelib tushmadi</div>
            <div class="empty-state-desc">Ushbu guruh talabalari topshiriqni bajarganda ishlari bu yerda paydo bo'ladi.</div>
          </div>
        `;
      } else {
        const rows = submissions.map((s) => {
          const scoreDisplay = s.total_score !== null 
            ? `${s.total_score} / ${s.max_score || assignment.total_points || 100} ball (${s.recommended_score || 0}%)`
            : (s.recommended_score !== null ? `${s.recommended_score} ball` : 'Hisoblanmoqda');

          const teacherScoreDisplay = s.teacher_score !== null
            ? `<strong style="color: var(--success); font-size: 1.05rem;">${s.teacher_score} ball</strong>`
            : '<span style="color: var(--text-light); font-size: 0.85rem;">Tasdiqlanmagan</span>';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-main);">${s.student_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${s.student_email}</div>
              </td>
              <td>${AppUI.formatDate(s.submitted_at)}</td>
              <td>
                <span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.85rem; padding: 0.35rem 0.65rem;">
                  <i class="fas fa-robot"></i> ${scoreDisplay}
                </span>
              </td>
              <td>${teacherScoreDisplay}</td>
              <td>${AppUI.getStatusBadge(s.status)}</td>
              <td style="text-align: right;">
                <button class="btn btn-primary btn-sm" onclick="TeacherView.showGradeModal(${s.id})">
                  <i class="fas fa-eye"></i> Ko'rish & Baholash
                </button>
              </td>
            </tr>
          `;
        }).join('');

        submissionsHtml = `
          <div class="table-container" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Talaba</th>
                  <th>Topshirilgan Vaqt</th>
                  <th>AI Tavsiya Bali</th>
                  <th>Yakuniy Baho</th>
                  <th>Holat</th>
                  <th style="text-align: right;">Amal</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      }

      // Savollar ko'rinishi
      let questionsPreviewHtml = '';
      if (questions.length > 0) {
        questionsPreviewHtml = `
          <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h5 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">
                <i class="fas fa-list-ol text-primary"></i> Savollar (${questions.length} ta &bull; Jami ${detailedAssignment.total_points || 100} ball)
              </h5>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.65rem; max-height: 250px; overflow-y: auto;">
              ${questions.map((q, idx) => `
                <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-left: 3px solid ${q.question_type === 'closed' ? '#6366f1' : '#0ea5e9'};">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                    <span style="font-weight: 700; color: var(--text-main);">
                      #${idx + 1} ${q.question_type === 'closed' ? '<span style="color: #6366f1;">[Yopiq test]</span>' : '<span style="color: #0ea5e9;">[Ochiq savol]</span>'}
                    </span>
                    <span class="badge" style="background: white; color: var(--text-main);">${q.points} ball</span>
                  </div>
                  <div style="font-size: 0.875rem; color: var(--text-main);">${q.question_text}</div>
                  ${q.question_type === 'closed' && q.options ? `
                    <div style="margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.4rem; font-size: 0.775rem;">
                      ${q.options.map(opt => `
                        <span style="padding: 0.15rem 0.5rem; border-radius: var(--radius-sm); background: ${opt.is_correct ? '#dcfce7' : 'white'}; color: ${opt.is_correct ? '#166534' : 'var(--text-muted)'}; border: 1px solid ${opt.is_correct ? '#86efac' : 'var(--border)'};">
                          <strong>${opt.option_key}:</strong> ${opt.option_text} ${opt.is_correct ? '<i class="fas fa-check" title="To\'g\'ri javob"></i>' : ''}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      detailsPanel.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div>
              <div class="card-title">${assignment.title}</div>
              <div class="card-subtitle">
                ${assignment.subject ? `<strong>Fan:</strong> ${assignment.subject} &bull; ` : ''}
                <i class="fas fa-users"></i> ${assignment.group_name}
                ${assignment.start_date ? ` &bull; <i class="fas fa-calendar-check"></i> Boshlanish: ${AppUI.formatDate(assignment.start_date)}` : ''}
                ${assignment.due_date ? ` &bull; <i class="fas fa-calendar-times"></i> Tugash: ${AppUI.formatDate(assignment.due_date)}` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-outline btn-sm" onclick="TeacherView.openEditWizard(${assignment.id})" title="Topshiriqni tahrirlash">
                <i class="fas fa-edit"></i> Tahrirlash
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="TeacherView.deleteAssignment(${assignment.id})" title="Topshiriqni o'chirish">
                <i class="fas fa-trash"></i> O'chirish
              </button>
            </div>
          </div>
          <div class="card-body">
            ${assignment.instructions ? `
              <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 0.65rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem; color: #15803d;">
                <strong><i class="fas fa-info-circle"></i> Tavsif / Ko'rsatma:</strong> ${assignment.instructions}
              </div>
            ` : ''}

            ${questionsPreviewHtml}

            ${assignment.file_path ? `
              <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
                <a href="${assignment.file_path}" target="_blank" download class="btn btn-outline btn-sm">
                  <i class="fas fa-paperclip"></i> Ilova qilingan fayl: ${assignment.file_name || 'Hujjat'} ${assignment.file_size ? `(${(assignment.file_size / 1024).toFixed(1)} KB)` : ''}
                </a>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Kelib tushgan javoblar jadvali -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <i class="fas fa-clipboard-check text-primary"></i> Kelib Tushgan Javoblar (${submissions.length})
            </div>
          </div>
          ${submissionsHtml}
        </div>
      `;

    } catch (e) {
      detailsPanel.innerHTML = `<div class="empty-state"><p>Xatolik: ${e.message}</p></div>`;
    }
  },

  // =========================================================================
  // SODDALASHTIRILGAN BOSQICHLI TEST VA TOPSHIRIQ YARATISH (Wizard)
  // =========================================================================

  async openCreateWizard() {
    this.wizard = {
      currentStep: 1,
      editingAssignmentId: null,
      basicInfo: {
        title: '',
        subject: '',
        group_id: '',
        start_date: '',
        due_date: '',
        instructions: '',
        content: '',
        hasTheoryExpanded: false
      },
      attachedFile: null,
      questions: [
        {
          id: 'q_' + Date.now() + '_1',
          question_type: 'closed',
          question_text: '',
          points: 5,
          is_expanded: true,
          options: [
            { option_key: 'A', option_text: '', is_correct: 1 },
            { option_key: 'B', option_text: '', is_correct: 0 },
            { option_key: 'C', option_text: '', is_correct: 0 },
            { option_key: 'D', option_text: '', is_correct: 0 }
          ]
        },
        {
          id: 'q_' + Date.now() + '_2',
          question_type: 'open',
          question_text: '',
          points: 10,
          is_expanded: false,
          sample_answer: '',
          instruction: ''
        }
      ]
    };

    await this.renderWizardModal();
  },

  async openEditWizard(assignmentId) {
    try {
      const res = await Api.assignments.getById(assignmentId);
      const a = res.assignment;

      const questions = (a.questions || []).map((q, idx) => ({
        id: q.id || ('q_' + Date.now() + '_' + idx),
        question_type: q.question_type || 'closed',
        question_text: q.question_text || '',
        points: q.points || 5,
        is_expanded: false,
        options: q.options ? q.options.map(opt => ({
          option_key: opt.option_key,
          option_text: opt.option_text,
          is_correct: opt.is_correct === 1 || opt.is_correct === true ? 1 : 0
        })) : [
          { option_key: 'A', option_text: '', is_correct: 1 },
          { option_key: 'B', option_text: '', is_correct: 0 }
        ],
        sample_answer: q.sample_answer || '',
        instruction: q.instruction || ''
      }));

      // Agar savollar bo'sh bo'lsa
      if (questions.length === 0) {
        questions.push({
          id: 'q_' + Date.now() + '_1',
          question_type: 'closed',
          question_text: '',
          points: 5,
          is_expanded: true,
          options: [
            { option_key: 'A', option_text: '', is_correct: 1 },
            { option_key: 'B', option_text: '', is_correct: 0 }
          ]
        });
      }

      this.wizard = {
        currentStep: 1,
        editingAssignmentId: a.id,
        basicInfo: {
          title: a.title || '',
          subject: a.subject || '',
          group_id: a.group_id || '',
          start_date: a.start_date ? a.start_date.substring(0, 16) : '',
          due_date: a.due_date ? a.due_date.substring(0, 16) : '',
          instructions: a.instructions || '',
          content: a.content || '',
          hasTheoryExpanded: !!(a.file_path || (a.content && a.content.length > 50))
        },
        attachedFile: null,
        questions: questions
      };

      await this.renderWizardModal();
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', 'Topshiriqni tahrirlash uchun yuklab bo\'lmadi: ' + e.message);
    }
  },

  async renderWizardModal() {
    const groupsRes = await Api.groups.getAll();
    this.cachedGroups = groupsRes.groups || [];

    const isEdit = !!this.wizard.editingAssignmentId;
    const titleText = isEdit 
      ? '<i class="fas fa-edit text-primary"></i> Topshiriqni Tahrirlash' 
      : '<i class="fas fa-plus-circle text-primary"></i> Yangi Test va Topshiriq Yaratish';

    const modalHtml = `
      <div id="wizard-container" style="display: flex; flex-direction: column;">
        <!-- Stepper Navigatsiyasi -->
        <div class="wizard-stepper">
          <div class="wizard-step-item ${this.wizard.currentStep === 1 ? 'active' : ''} ${this.wizard.currentStep > 1 ? 'completed' : ''}" onclick="TeacherView.goToStep(1)">
            <div class="wizard-step-num">${this.wizard.currentStep > 1 ? '<i class="fas fa-check"></i>' : '1'}</div>
            <div class="wizard-step-title">Asosiy ma'lumotlar</div>
          </div>
          <div class="wizard-step-item ${this.wizard.currentStep === 2 ? 'active' : ''} ${this.wizard.currentStep > 2 ? 'completed' : ''}" onclick="TeacherView.goToStep(2)">
            <div class="wizard-step-num">${this.wizard.currentStep > 2 ? '<i class="fas fa-check"></i>' : '2'}</div>
            <div class="wizard-step-title">Savollar</div>
            <span class="wizard-step-badge" id="step2-badge">${this.wizard.questions.length}</span>
          </div>
          <div class="wizard-step-item ${this.wizard.currentStep === 3 ? 'active' : ''} ${this.wizard.currentStep > 3 ? 'completed' : ''}" onclick="TeacherView.goToStep(3)">
            <div class="wizard-step-num">${this.wizard.currentStep > 3 ? '<i class="fas fa-check"></i>' : '3'}</div>
            <div class="wizard-step-title">Baholash</div>
            <span class="wizard-step-badge" id="step3-badge">${this.calcTotalPoints()} b</span>
          </div>
          <div class="wizard-step-item ${this.wizard.currentStep === 4 ? 'active' : ''}" onclick="TeacherView.goToStep(4)">
            <div class="wizard-step-num">4</div>
            <div class="wizard-step-title">Yakunlash</div>
          </div>
        </div>

        <!-- Bosqichlar Kontenti -->
        <div id="wizard-pane-content">
          <!-- Dinamik ravishda joriy bosqich chiziladi -->
        </div>
      </div>
    `;

    AppUI.openModal(titleText, modalHtml, '', 'modal-xl');
    this.renderCurrentStepPane();
  },

  renderCurrentStepPane() {
    const pane = document.getElementById('wizard-pane-content');
    if (!pane) return;

    if (this.wizard.currentStep === 1) {
      pane.innerHTML = this.getStep1Html();
    } else if (this.wizard.currentStep === 2) {
      pane.innerHTML = this.getStep2Html();
    } else if (this.wizard.currentStep === 3) {
      pane.innerHTML = this.getStep3Html();
    } else if (this.wizard.currentStep === 4) {
      pane.innerHTML = this.getStep4Html();
    }

    // Stepper holatini yangilash
    const items = document.querySelectorAll('.wizard-step-item');
    items.forEach((item, idx) => {
      const stepNum = idx + 1;
      item.className = `wizard-step-item ${this.wizard.currentStep === stepNum ? 'active' : ''} ${this.wizard.currentStep > stepNum ? 'completed' : ''}`;
      const numEl = item.querySelector('.wizard-step-num');
      if (numEl) {
        numEl.innerHTML = this.wizard.currentStep > stepNum ? '<i class="fas fa-check"></i>' : stepNum;
      }
    });

    const b2 = document.getElementById('step2-badge');
    if (b2) b2.innerText = this.wizard.questions.length;

    const b3 = document.getElementById('step3-badge');
    if (b3) b3.innerText = `${this.calcTotalPoints()} b`;
  },

  calcTotalPoints() {
    let sum = 0;
    this.wizard.questions.forEach(q => sum += (parseFloat(q.points) || 0));
    return Math.round(sum * 10) / 10;
  },

  // DOM inputlaridan holatni saqlab qolish
  syncCurrentStepState() {
    if (this.wizard.currentStep === 1) {
      const titleEl = document.getElementById('wiz-title');
      if (titleEl) this.wizard.basicInfo.title = titleEl.value;

      const subEl = document.getElementById('wiz-subject');
      if (subEl) this.wizard.basicInfo.subject = subEl.value;

      const grpEl = document.getElementById('wiz-group');
      if (grpEl) this.wizard.basicInfo.group_id = grpEl.value;

      const startEl = document.getElementById('wiz-start-date');
      if (startEl) this.wizard.basicInfo.start_date = startEl.value;

      const dueEl = document.getElementById('wiz-due-date');
      if (dueEl) this.wizard.basicInfo.due_date = dueEl.value;

      const instEl = document.getElementById('wiz-instructions');
      if (instEl) this.wizard.basicInfo.instructions = instEl.value;

      const contEl = document.getElementById('wiz-content');
      if (contEl) this.wizard.basicInfo.content = contEl.value;
    } else if (this.wizard.currentStep === 2) {
      this.wizard.questions.forEach((q, idx) => {
        const textEl = document.getElementById(`wiz-q-text-${idx}`);
        if (textEl) q.question_text = textEl.value;

        const ptsEl = document.getElementById(`wiz-q-points-${idx}`);
        if (ptsEl) q.points = Math.max(0.5, parseFloat(ptsEl.value) || 1);

        if (q.question_type === 'closed') {
          q.options.forEach((opt, optIdx) => {
            const optEl = document.getElementById(`wiz-opt-text-${idx}-${optIdx}`);
            if (optEl) opt.option_text = optEl.value;

            const radioEl = document.getElementById(`wiz-opt-radio-${idx}-${optIdx}`);
            if (radioEl) opt.is_correct = radioEl.checked ? 1 : 0;
          });
        } else {
          const sampleEl = document.getElementById(`wiz-q-sample-${idx}`);
          if (sampleEl) q.sample_answer = sampleEl.value;

          const instEl = document.getElementById(`wiz-q-inst-${idx}`);
          if (instEl) q.instruction = instEl.value;
        }
      });
    } else if (this.wizard.currentStep === 3) {
      this.wizard.questions.forEach((q, idx) => {
        const ptsEl = document.getElementById(`wiz-grade-pts-${idx}`);
        if (ptsEl) q.points = Math.max(0.5, parseFloat(ptsEl.value) || 1);
      });
    }
  },

  goToStep(stepNumber) {
    this.syncCurrentStepState();

    // 1-bosqichdan keyingisiga o'tishda majburiy maydonlar validatsiyasi
    if (stepNumber > 1) {
      if (!this.wizard.basicInfo.title.trim()) {
        AppUI.showToast('warning', 'Topshiriq nomi', 'Iltimos, topshiriq nomini kiriting.');
        this.wizard.currentStep = 1;
        this.renderCurrentStepPane();
        return;
      }
      if (!this.wizard.basicInfo.group_id) {
        AppUI.showToast('warning', 'Guruh tanlang', 'Topshiriq uchun akademik guruhni tanlang.');
        this.wizard.currentStep = 1;
        this.renderCurrentStepPane();
        return;
      }
    }

    // 2-bosqichdan keyingisiga o'tishda savollar validatsiyasi
    if (stepNumber > 2) {
      if (this.wizard.questions.length === 0) {
        AppUI.showToast('warning', 'Savollar yo\'q', 'Topshiriqda kamida 1 ta savol bo\'lishi shart.');
        this.wizard.currentStep = 2;
        this.renderCurrentStepPane();
        return;
      }

      for (let i = 0; i < this.wizard.questions.length; i++) {
        const q = this.wizard.questions[i];
        if (!q.question_text || !q.question_text.trim()) {
          AppUI.showToast('warning', 'Savol matni', `${i + 1}-savol matnini kiriting.`);
          q.is_expanded = true;
          this.wizard.currentStep = 2;
          this.renderCurrentStepPane();
          return;
        }
        if (q.question_type === 'closed') {
          const emptyOpt = q.options.some(opt => !opt.option_text || !opt.option_text.trim());
          if (emptyOpt) {
            AppUI.showToast('warning', 'Variant matni', `${i + 1}-test savolida barcha variantlarni to'ldiring.`);
            q.is_expanded = true;
            this.wizard.currentStep = 2;
            this.renderCurrentStepPane();
            return;
          }
          const hasCorrect = q.options.some(opt => opt.is_correct === 1);
          if (!hasCorrect) {
            AppUI.showToast('warning', 'To\'g\'ri javob', `${i + 1}-test savolida to'g'ri javobni belgilang.`);
            q.is_expanded = true;
            this.wizard.currentStep = 2;
            this.renderCurrentStepPane();
            return;
          }
        }
      }
    }

    this.wizard.currentStep = stepNumber;
    this.renderCurrentStepPane();
  },

  // =========================================================================
  // 1-BOSQICH: Asosiy ma'lumotlar
  // =========================================================================
  getStep1Html() {
    const b = this.wizard.basicInfo;
    const groupOptions = (this.cachedGroups || []).map(g => `
      <option value="${g.id}" ${String(b.group_id) === String(g.id) ? 'selected' : ''}>${g.name}</option>
    `).join('');

    return `
      <div>
        <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem;">
          
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label required">Topshiriq nomi</label>
              <input type="text" id="wiz-title" class="form-control" placeholder="Masalan: 3-topshiriq: Kriptografiya asoslari" value="${b.title || ''}" required />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Fan yoki mavzu</label>
              <input type="text" id="wiz-subject" class="form-control" placeholder="Masalan: Kiberxavfsizlik" value="${b.subject || ''}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label required">Guruhni tanlash</label>
              <select id="wiz-group" class="form-select" required>
                <option value="">-- Guruhni tanlang --</option>
                ${groupOptions}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Boshlanish muddati</label>
              <input type="datetime-local" id="wiz-start-date" class="form-control" value="${b.start_date || ''}" />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Tugash muddati</label>
              <input type="datetime-local" id="wiz-due-date" class="form-control" value="${b.due_date || ''}" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Topshiriq tavsifi (ixtiyoriy)</label>
            <textarea id="wiz-instructions" class="form-control" style="min-height: 70px;" placeholder="Talabalar uchun qisqa ko'rsatma yoki mavzu yo'riqnomasi...">${b.instructions || ''}</textarea>
          </div>

          <!-- Nazariy material / Fayl biriktirish (Ixtiyoriy ochiluvchi blok) -->
          <div style="margin-top: 1rem;">
            <button type="button" class="accordion-toggle-btn" onclick="TeacherView.toggleTheorySection()">
              <span>
                <i class="fas fa-file-alt text-primary"></i> Qo'shimcha nazariy material yoki fayl biriktirish (Ixtiyoriy)
              </span>
              <i class="fas fa-chevron-${b.hasTheoryExpanded ? 'up' : 'down'}"></i>
            </button>

            <div id="theory-accordion-content" style="display: ${b.hasTheoryExpanded ? 'block' : 'none'}; padding-top: 0.85rem;">
              <div style="background: var(--bg-alt); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <div style="margin-bottom: 0.75rem;">
                  <label class="form-label" style="font-size: 0.8rem;">
                    <i class="fas fa-paperclip"></i> Hujjat biriktirish (PDF, DOCX, PPTX)
                  </label>
                  <input type="file" id="wiz-file-input" class="form-control" accept=".pdf,.doc,.docx,.pptx,.ppt,.txt" onchange="TeacherView.handleWizardFileSelect(event)" />
                  <div id="wiz-file-status" class="form-hint" style="margin-top: 0.25rem;">
                    <span>Fayl yuklansa, matn olinib AI tekshiruvi uchun manba sifatida foydalaniladi.</span>
                  </div>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 0.8rem;">Nazariy matn (AI uchun haqiqat manbasi):</label>
                  <textarea id="wiz-content" class="form-control" style="min-height: 80px;" placeholder="Mavzuga oid nazariy matn...">${b.content || ''}</textarea>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Pastki tugmalar -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="button" class="btn btn-primary" onclick="TeacherView.goToStep(2)">
            Keyingisi: Savollar <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  },

  toggleTheorySection() {
    this.wizard.basicInfo.hasTheoryExpanded = !this.wizard.basicInfo.hasTheoryExpanded;
    const content = document.getElementById('theory-accordion-content');
    if (content) {
      content.style.display = this.wizard.basicInfo.hasTheoryExpanded ? 'block' : 'none';
    }
  },

  async handleWizardFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.wizard.attachedFile = file;
    const statusEl = document.getElementById('wiz-file-status');
    const contentEl = document.getElementById('wiz-content');

    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--primary);"><i class="fas fa-spinner fa-spin"></i> "${file.name}" faylidan matn ajratilmoqda...</span>`;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await Api.assignments.extractText(formData);

      if (res.extractedText && res.extractedText.trim().length > 0) {
        if (contentEl) {
          contentEl.value = res.extractedText;
          this.wizard.basicInfo.content = res.extractedText;
        }
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fas fa-check-circle"></i> "${file.name}" yuklandi (${res.wordCount} ta so'z).</span>`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--warning);"><i class="fas fa-info-circle"></i> Fayl biriktirildi (${file.name}).</span>`;
      }
    }
  },

  // =========================================================================
  // 2-BOSQICH: Savollar Konstruktori
  // =========================================================================
  getStep2Html() {
    let closedCount = 0;
    let openCount = 0;
    this.wizard.questions.forEach(q => {
      if (q.question_type === 'closed') closedCount++;
      if (q.question_type === 'open') openCount++;
    });

    const cardsHtml = this.wizard.questions.map((q, idx) => {
      const isClosed = q.question_type === 'closed';
      const isOpen = q.is_expanded !== false;
      const previewText = q.question_text ? q.question_text.trim() : '(Savol matni kiritilmagan)';

      return `
        <div class="compact-q-card ${isClosed ? 'type-closed' : 'type-open'} ${isOpen ? 'is-open' : ''}" id="wiz-card-${idx}">
          <!-- Ixcham sarlavha -->
          <div class="compact-q-header" onclick="TeacherView.toggleQuestionExpand(${idx})">
            <div class="compact-q-left">
              <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">#${idx + 1}</span>
              <span class="badge ${isClosed ? 'builder-badge-closed' : 'builder-badge-open'}">
                <i class="fas ${isClosed ? 'fa-check-circle' : 'fa-align-left'}"></i>
                ${isClosed ? 'Yopiq test' : 'Ochiq savol'}
              </span>
              <span class="compact-q-title-preview" title="${q.question_text || ''}">${previewText}</span>
              <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-weight: 700; margin-left: auto;">
                ${q.points || 5} ball
              </span>
            </div>

            <div class="compact-q-actions" onclick="event.stopPropagation()">
              <button type="button" class="btn btn-secondary btn-sm" title="Yuqoriga" onclick="TeacherView.moveWizardQuestion(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
                <i class="fas fa-arrow-up"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" title="Pastga" onclick="TeacherView.moveWizardQuestion(${idx}, 1)" ${idx === this.wizard.questions.length - 1 ? 'disabled' : ''}>
                <i class="fas fa-arrow-down"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" title="${isOpen ? 'Yig\'ish' : 'Tahrirlash'}" onclick="TeacherView.toggleQuestionExpand(${idx})">
                <i class="fas fa-${isOpen ? 'chevron-up' : 'pen'}"></i>
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" title="O'chirish" onclick="TeacherView.deleteWizardQuestion(${idx})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Kengaytirilgan tahrirlash qismi -->
          <div class="compact-q-body" style="display: ${isOpen ? 'block' : 'none'};">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <label class="form-label required" style="font-size: 0.85rem; margin: 0;">Savol matni</label>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <label style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Ball:</label>
                <input 
                  type="number" 
                  id="wiz-q-points-${idx}" 
                  class="form-control" 
                  style="width: 70px; height: 30px; text-align: center; font-weight: 700; padding: 0.2rem 0.4rem;" 
                  value="${q.points}" 
                  min="0.5" 
                  step="0.5" 
                  onchange="TeacherView.syncCurrentStepState(); TeacherView.updateSummaryBadges();" 
                />
              </div>
            </div>

            <textarea 
              id="wiz-q-text-${idx}" 
              class="form-control" 
              style="min-height: 60px; margin-bottom: 0.75rem;" 
              placeholder="${isClosed ? 'Test savoli matnini kiriting...' : 'Ochiq savol matnini kiriting...'}" 
              oninput="TeacherView.updateCardPreviewText(${idx}, this.value)" 
              required>${q.question_text || ''}</textarea>

            ${isClosed ? `
              <!-- Yopiq test variantlari -->
              <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
                    Javob variantlari (To'g'ri javobni belgilang):
                  </span>
                  <button type="button" class="btn btn-outline btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="TeacherView.addWizardOption(${idx})">
                    <i class="fas fa-plus"></i> Variant qo'shish
                  </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                  ${q.options.map((opt, optIdx) => `
                    <div class="option-row" style="margin-bottom: 0.35rem;">
                      <div class="option-key-label" style="width: 28px; height: 28px; font-size: 0.8rem;">${opt.option_key}</div>
                      <input 
                        type="text" 
                        id="wiz-opt-text-${idx}-${optIdx}" 
                        class="form-control" 
                        style="font-size: 0.875rem;" 
                        placeholder="${opt.option_key} varianti..." 
                        value="${opt.option_text || ''}" 
                        required 
                      />

                      <label class="option-radio-label ${opt.is_correct ? 'correct' : ''}" style="padding: 0.3rem 0.6rem;">
                        <input 
                          type="radio" 
                          name="wiz-correct-opt-${idx}" 
                          id="wiz-opt-radio-${idx}-${optIdx}" 
                          ${opt.is_correct ? 'checked' : ''} 
                          onchange="TeacherView.setWizardCorrectOption(${idx}, ${optIdx})" 
                        />
                        <span>${opt.is_correct ? 'To\'g\'ri' : 'Noto\'g\'ri'}</span>
                      </label>

                      ${q.options.length > 2 ? `
                        <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.5rem; color: var(--danger);" title="Variantni o'chirish" onclick="TeacherView.removeWizardOption(${idx}, ${optIdx})">
                          <i class="fas fa-times"></i>
                        </button>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : `
              <!-- Ochiq savol mezonlari -->
              <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem;">
                <div class="form-group" style="margin-bottom: 0.65rem;">
                  <label class="form-label" style="font-size: 0.8rem;">Namunaviy javob yoki baholash mezoni</label>
                  <textarea 
                    id="wiz-q-sample-${idx}" 
                    class="form-control" 
                    style="min-height: 60px; background: #fffdf5; border-color: #fde68a;" 
                    placeholder="AI va o'qituvchi baholashi uchun to'g'ri javob namunasi...">${q.sample_answer || ''}</textarea>
                  <div class="form-hint" style="color: #92400e;">
                    <i class="fas fa-lock"></i> Bu ma'lumot talabaga ko'rinmaydi, faqat AI baholashi uchun ishlatiladi.
                  </div>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 0.8rem;">Talaba uchun ko'rsatma (ixtiyoriy)</label>
                  <input 
                    type="text" 
                    id="wiz-q-inst-${idx}" 
                    class="form-control" 
                    placeholder="Masalan: Kamida 3 ta asosiy farqni keltiring." 
                    value="${q.instruction || ''}" 
                  />
                </div>
              </div>
            `}

          </div>
        </div>
      `;
    }).join('');

    return `
      <div>
        <!-- Savollar boshqaruv paneli -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-size: 0.85rem; padding: 0.35rem 0.65rem;">
              <i class="fas fa-tasks text-primary"></i> Jami: ${this.wizard.questions.length} ta savol
            </span>
            <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.8rem;">${closedCount} ta test</span>
            <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 0.8rem;">${openCount} ta ochiq</span>
          </div>

          <!-- Tezkor qo'shish tugmalari -->
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.addQuestionWizard('closed')">
              <i class="fas fa-check-circle"></i> + Test qo'shish
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.addQuestionWizard('open')">
              <i class="fas fa-feather-alt"></i> + Savol qo'shish
            </button>
          </div>
        </div>

        <!-- Savollar ro'yxati -->
        <div id="wiz-questions-list" style="margin-bottom: 1.5rem;">
          ${cardsHtml}
        </div>

        <!-- Pastki navigatsiya -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="TeacherView.goToStep(1)">
            <i class="fas fa-arrow-left"></i> Oldingisi
          </button>
          <button type="button" class="btn btn-primary" onclick="TeacherView.goToStep(3)">
            Keyingisi: Baholash <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  },

  updateCardPreviewText(idx, val) {
    const card = document.getElementById(`wiz-card-${idx}`);
    if (!card) return;
    const previewEl = card.querySelector('.compact-q-title-preview');
    if (previewEl) {
      previewEl.innerText = val.trim() || '(Savol matni kiritilmagan)';
      previewEl.title = val;
    }
  },

  updateSummaryBadges() {
    const b3 = document.getElementById('step3-badge');
    if (b3) b3.innerText = `${this.calcTotalPoints()} b`;
  },

  toggleQuestionExpand(idx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[idx];
    if (q) {
      q.is_expanded = !q.is_expanded;
    }
    this.renderCurrentStepPane();
  },

  addQuestionWizard(type) {
    this.syncCurrentStepState();
    // Oldingi barcha savollarni yig'amiz, yangisi ochiq bo'ladi
    this.wizard.questions.forEach(q => q.is_expanded = false);

    if (type === 'closed') {
      this.wizard.questions.push({
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        question_type: 'closed',
        question_text: '',
        points: 5,
        is_expanded: true,
        options: [
          { option_key: 'A', option_text: '', is_correct: 1 },
          { option_key: 'B', option_text: '', is_correct: 0 },
          { option_key: 'C', option_text: '', is_correct: 0 },
          { option_key: 'D', option_text: '', is_correct: 0 }
        ]
      });
      AppUI.showToast('info', 'Test qo\'shildi', 'Yangi yopiq test savoli qo\'shildi.');
    } else {
      this.wizard.questions.push({
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        question_type: 'open',
        question_text: '',
        points: 10,
        is_expanded: true,
        sample_answer: '',
        instruction: ''
      });
      AppUI.showToast('info', 'Savol qo\'shildi', 'Yangi ochiq savol qo\'shildi.');
    }

    this.renderCurrentStepPane();
  },

  deleteWizardQuestion(idx) {
    this.syncCurrentStepState();
    if (this.wizard.questions.length <= 1) {
      AppUI.showToast('warning', 'O\'chirib bo\'lmaydi', 'Topshiriqda kamida bitta savol qolishi shart.');
      return;
    }
    this.wizard.questions.splice(idx, 1);
    this.renderCurrentStepPane();
  },

  moveWizardQuestion(idx, direction) {
    this.syncCurrentStepState();
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= this.wizard.questions.length) return;

    const temp = this.wizard.questions[idx];
    this.wizard.questions[idx] = this.wizard.questions[targetIdx];
    this.wizard.questions[targetIdx] = temp;

    this.renderCurrentStepPane();
  },

  addWizardOption(qIdx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[qIdx];
    if (!q || q.question_type !== 'closed') return;

    const nextKey = String.fromCharCode(65 + q.options.length);
    q.options.push({
      option_key: nextKey,
      option_text: '',
      is_correct: 0
    });
    this.renderCurrentStepPane();
  },

  removeWizardOption(qIdx, optIdx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[qIdx];
    if (!q || q.question_type !== 'closed') return;

    if (q.options.length <= 2) {
      AppUI.showToast('warning', 'Cheklov', 'Kamida 2 ta javob varianti bo\'lishi shart.');
      return;
    }

    const wasCorrect = q.options[optIdx].is_correct === 1;
    q.options.splice(optIdx, 1);

    q.options.forEach((opt, i) => {
      opt.option_key = String.fromCharCode(65 + i);
    });

    if (wasCorrect && q.options.length > 0) {
      q.options[0].is_correct = 1;
    }

    this.renderCurrentStepPane();
  },

  setWizardCorrectOption(qIdx, optIdx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[qIdx];
    if (!q || q.question_type !== 'closed') return;

    q.options.forEach((opt, i) => {
      opt.is_correct = (i === optIdx) ? 1 : 0;
    });

    this.renderCurrentStepPane();
  },

  // =========================================================================
  // 3-BOSQICH: Baholash
  // =========================================================================
  getStep3Html() {
    const totalPts = this.calcTotalPoints();
    let closedCount = 0;
    let openCount = 0;
    this.wizard.questions.forEach(q => {
      if (q.question_type === 'closed') closedCount++;
      if (q.question_type === 'open') openCount++;
    });

    const rowsHtml = this.wizard.questions.map((q, idx) => {
      const isClosed = q.question_type === 'closed';
      const correctOpt = isClosed ? q.options.find(o => o.is_correct === 1) : null;

      return `
        <div class="grade-table-card">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span style="font-weight: 800; color: var(--text-main);">#${idx + 1}</span>
              <span class="badge ${isClosed ? 'builder-badge-closed' : 'builder-badge-open'}">
                ${isClosed ? 'Yopiq test' : 'Ochiq savol'}
              </span>
              <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;">
                ${q.question_text || '(Savol matni kiritilmagan)'}
              </span>
            </div>

            <div style="font-size: 0.775rem; color: var(--text-muted);">
              ${isClosed ? `
                <span style="color: #166534; font-weight: 600;">
                  <i class="fas fa-check-circle"></i> To'g'ri javob: [${correctOpt ? correctOpt.option_key : 'Tanlanmagan'}] ${correctOpt ? correctOpt.option_text : ''}
                </span>
              ` : `
                <span><i class="fas fa-ruble-sign"></i> Mezon / Namunaviy javob: ${q.sample_answer ? q.sample_answer.substring(0, 60) + '...' : 'Belgilanmagan'}</span>
              `}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin: 0;">Ball:</label>
            <input 
              type="number" 
              id="wiz-grade-pts-${idx}" 
              class="form-control" 
              style="width: 80px; text-align: center; font-weight: 800; font-size: 0.95rem; color: var(--primary);" 
              value="${q.points}" 
              min="0.5" 
              step="0.5" 
              oninput="TeacherView.handleScoreInputChange(${idx}, this.value)" 
            />
          </div>
        </div>
      `;
    }).join('');

    return `
      <div>
        <!-- Umumiy ball kartasi -->
        <div class="scoring-hero-card">
          <div class="scoring-hero-left">
            <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">Umumiy Ball</span>
            <div class="scoring-hero-score" id="scoring-total-display">${totalPts} ball</div>
            <span style="font-size: 0.85rem; opacity: 0.9;">
              Jami ${this.wizard.questions.length} ta savol (${closedCount} test, ${openCount} ochiq)
            </span>
          </div>

          <!-- Barchasiga bir xil ball berish vositasi -->
          <div class="scoring-hero-right">
            <span style="font-size: 0.8rem;">Har bir savolga:</span>
            <input type="number" id="wiz-batch-points" class="form-control" style="width: 60px; height: 32px; padding: 0.2rem; text-align: center;" value="5" min="1" />
            <button type="button" class="btn btn-secondary btn-sm" onclick="TeacherView.applyBatchPoints()">Teng taqsimlash</button>
          </div>
        </div>

        <!-- Savollar ro'yxati -->
        <div style="margin-bottom: 1.5rem;">
          ${rowsHtml}
        </div>

        <!-- Pastki navigatsiya -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="TeacherView.goToStep(2)">
            <i class="fas fa-arrow-left"></i> Oldingisi
          </button>
          <button type="button" class="btn btn-primary" onclick="TeacherView.goToStep(4)">
            Keyingisi: Yakunlash <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  },

  handleScoreInputChange(idx, val) {
    const pts = Math.max(0.5, parseFloat(val) || 0.5);
    this.wizard.questions[idx].points = pts;
    const total = this.calcTotalPoints();
    const scoreDisplay = document.getElementById('scoring-total-display');
    if (scoreDisplay) scoreDisplay.innerText = `${total} ball`;
    this.updateSummaryBadges();
  },

  applyBatchPoints() {
    const batchInput = document.getElementById('wiz-batch-points');
    const pts = Math.max(0.5, parseFloat(batchInput ? batchInput.value : 5) || 5);
    this.wizard.questions.forEach(q => q.points = pts);
    this.renderCurrentStepPane();
    AppUI.showToast('info', 'Ballar yangilandi', `Barcha savollarga ${pts} balldan belgilandi.`);
  },

  // =========================================================================
  // 4-BOSQICH: Yakunlash va Preview
  // =========================================================================
  getStep4Html() {
    const b = this.wizard.basicInfo;
    const groupObj = (this.cachedGroups || []).find(g => String(g.id) === String(b.group_id));
    const groupName = groupObj ? groupObj.name : 'Guruh';
    const totalPts = this.calcTotalPoints();

    return `
      <div>
        <!-- Xulosa ma'lumotlari -->
        <div class="summary-overview-grid">
          <div class="summary-overview-box">
            <div class="summary-overview-label">Topshiriq nomi</div>
            <div class="summary-overview-val">${b.title || '-'}</div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Fan / Mavzu</div>
            <div class="summary-overview-val">${b.subject || 'Belgilanmagan'}</div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Guruh</div>
            <div class="summary-overview-val">${groupName}</div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Maksimal Ball</div>
            <div class="summary-overview-val" style="color: var(--primary);">${totalPts} ball</div>
          </div>
        </div>

        <!-- Talaba ko'rinishida Preview -->
        <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
              <i class="fas fa-eye text-primary"></i> Talabalar ko'radigan ko'rinish (Oldindan ko'rish):
            </div>
            <span class="badge" style="background: var(--bg-alt); color: var(--text-muted); font-size: 0.75rem;">
              Preview rejimi
            </span>
          </div>

          ${b.instructions ? `
            <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 0.65rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem; font-size: 0.85rem; color: #15803d;">
              <strong>Ko'rsatma:</strong> ${b.instructions}
            </div>
          ` : ''}

          <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 380px; overflow-y: auto; padding-right: 4px;">
            ${this.wizard.questions.map((q, idx) => `
              <div class="quiz-question-box" style="padding: 1rem; margin-bottom: 0;">
                <div class="quiz-question-header" style="margin-bottom: 0.75rem; padding-bottom: 0.5rem;">
                  <div>
                    <span style="font-weight: 800; color: var(--primary);">#${idx + 1}-savol</span>
                    <span class="badge" style="background: var(--bg-alt); color: var(--text-main); margin-left: 0.4rem; font-size: 0.75rem;">
                      ${q.question_type === 'closed' ? 'Yopiq test' : 'Ochiq savol'}
                    </span>
                  </div>
                  <span style="font-weight: 700; color: var(--primary); font-size: 0.85rem;">${q.points} ball</span>
                </div>

                <div style="font-size: 0.925rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.75rem;">
                  ${q.question_text || '(Savol matni kiritilmagan)'}
                </div>

                ${q.question_type === 'closed' ? `
                  <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                    ${q.options.map(opt => `
                      <div class="quiz-option-item" style="padding: 0.65rem 0.85rem; margin-bottom: 0;">
                        <div class="quiz-option-circle" style="width: 24px; height: 24px; font-size: 0.75rem;">${opt.option_key}</div>
                        <div style="font-size: 0.875rem; color: var(--text-main);">${opt.option_text || '(Variant)'}</div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  ${q.instruction ? `
                    <div style="font-size: 0.8rem; color: #1d4ed8; margin-bottom: 0.5rem;">
                      <i class="fas fa-info-circle"></i> ${q.instruction}
                    </div>
                  ` : ''}
                  <textarea class="form-control" style="min-height: 60px;" placeholder="Talaba bu yerga o'z javobini yozadi..." disabled></textarea>
                `}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Yakuniy amallar -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="TeacherView.goToStep(3)">
            <i class="fas fa-arrow-left"></i> Oldingisi
          </button>

          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
            <button type="button" class="btn btn-primary" id="btn-save-wizard" onclick="TeacherView.saveWizardAssignment()">
              <i class="fas fa-check"></i> ${this.wizard.editingAssignmentId ? 'O\'zgarishlarni Saqlash' : 'Saqlash va Talabalarga Yuborish'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // TOPSHIRIQNI SAQLASH (Create / Update API)
  // =========================================================================
  async saveWizardAssignment() {
    this.syncCurrentStepState();

    const b = this.wizard.basicInfo;
    const questions = this.wizard.questions;
    const btn = document.getElementById('btn-save-wizard');

    if (!b.title || !b.title.trim()) {
      AppUI.showToast('warning', 'Topshiriq nomi', 'Topshiriq nomini kiriting.');
      this.goToStep(1);
      return;
    }

    if (!b.group_id) {
      AppUI.showToast('warning', 'Guruh tanlang', 'Guruhni tanlang.');
      this.goToStep(1);
      return;
    }

    if (questions.length === 0) {
      AppUI.showToast('warning', 'Savollar yo\'q', 'Kamida bitta savol bo\'lishi shart.');
      this.goToStep(2);
      return;
    }

    // Savollarni formatlash
    const cleanQuestions = questions.map((q, idx) => ({
      question_type: q.question_type,
      question_text: q.question_text.trim(),
      points: Math.max(0.5, parseFloat(q.points) || 1),
      order_index: idx,
      instruction: q.instruction ? q.instruction.trim() : null,
      sample_answer: q.sample_answer ? q.sample_answer.trim() : null,
      options: q.question_type === 'closed' ? q.options.map((opt, optIdx) => ({
        option_key: opt.option_key || String.fromCharCode(65 + optIdx),
        option_text: (opt.option_text || '').trim(),
        is_correct: opt.is_correct === 1 ? 1 : 0
      })) : []
    }));

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...`;
    }

    try {
      const formData = new FormData();
      formData.append('title', b.title.trim());
      formData.append('subject', b.subject ? b.subject.trim() : '');
      formData.append('group_id', b.group_id);
      formData.append('instructions', b.instructions ? b.instructions.trim() : '');
      if (b.start_date) formData.append('start_date', b.start_date);
      if (b.due_date) formData.append('due_date', b.due_date);
      formData.append('content', b.content ? b.content.trim() : "Mavzu bo'yicha mustaqil topshiriq materiallari.");
      formData.append('questions', JSON.stringify(cleanQuestions));

      if (this.wizard.attachedFile) {
        formData.append('file', this.wizard.attachedFile);
      }

      let res;
      if (this.wizard.editingAssignmentId) {
        res = await Api.assignments.update(this.wizard.editingAssignmentId, formData);
        AppUI.showToast('success', 'Muvaffaqiyatli saqlandi', 'Topshiriq o\'zgarishlari muvaffaqiyatli saqlandi.');
      } else {
        res = await Api.assignments.create(formData);
        AppUI.showToast('success', 'Muvaffaqiyatli saqlandi', 'Topshiriq saqlandi va talabalarga yuborildi!');
      }

      AppUI.closeModal();
      if (res && res.assignment) {
        this.selectedAssignmentId = res.assignment.id;
      }
      await this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message || 'Saqlashda xatolik yuz berdi.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check"></i> Saqlash`;
      }
    }
  },

  async deleteAssignment(id) {
    if (!confirm("Haqiqatan ham bu topshiriqni va unga kelgan barcha javoblarni o'chirmoqchimisiz?")) return;
    try {
      await Api.assignments.delete(id);
      AppUI.showToast('success', 'O\'chirildi', 'Topshiriq muvaffaqiyatli o\'chirildi.');
      this.selectedAssignmentId = null;
      await this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // =========================================================================
  // TALABA JAVOBINI KO'RISH VA BAHOLASH (Show Grade Modal)
  // =========================================================================

  async showGradeModal(submissionId) {
    try {
      const res = await Api.submissions.getById(submissionId);
      const s = res.submission;
      const answers = s.answers || [];
      const isDynamic = s.has_dynamic_questions === 1 || answers.length > 0;

      let answersContentHtml = '';

      if (isDynamic) {
        answersContentHtml = `
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-main); margin-bottom: 0.25rem;">
              <i class="fas fa-list-check text-primary"></i> Talabaning Savollar Bo'yicha Javoblari (${answers.length} ta savol):
            </div>

            ${answers.map((ans, idx) => {
              const isClosed = ans.question_type === 'closed';
              const isCorrect = ans.is_correct === 1;
              const maxPts = ans.question_points || 10;
              const aiFb = ans.ai_feedback || {};

              return `
                <div class="grade-answer-card ${isClosed ? (isCorrect ? 'correct-card' : 'incorrect-card') : 'open-card'}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div>
                      <span style="font-weight: 800; color: var(--text-main);">#${idx + 1}-savol:</span>
                      <span class="badge ${isClosed ? 'builder-badge-closed' : 'builder-badge-open'}" style="margin-left: 0.4rem;">
                        ${isClosed ? 'Yopiq Test' : 'Ochiq Savol'}
                      </span>
                      <span style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem; margin-left: 0.4rem;">
                        Maksimal: ${maxPts} ball
                      </span>
                    </div>

                    <div>
                      ${isClosed ? `
                        <span class="badge ${isCorrect ? 'badge-graded' : 'badge-pending'}" style="${isCorrect ? '' : 'background: #fee2e2; color: #b91c1c;'}">
                          <i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i>
                          ${isCorrect ? `To'g'ri (${ans.ai_score} ball)` : `Noto'g'ri (0 ball)`}
                        </span>
                      ` : `
                        <span class="badge badge-reviewed">
                          <i class="fas fa-robot"></i> AI tavsiya: ${ans.ai_score !== null ? `${ans.ai_score} / ${maxPts} ball` : 'Kutilmoqda'}
                        </span>
                      `}
                    </div>
                  </div>

                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
                    ${ans.question_text}
                  </div>

                  ${isClosed ? `
                    <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 0.5rem;">
                      <div style="font-size: 0.85rem; margin-bottom: 0.4rem;">
                        <strong>Talaba tanlagan variant:</strong> 
                        ${ans.selected_option_key ? `
                          <span style="font-weight: 700; color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
                            [${ans.selected_option_key}] ${ans.selected_option_text || ''}
                          </span>
                        ` : '<span style="color: var(--danger); font-style: italic;">Javob belgilanmagan</span>'}
                      </div>

                      ${ans.options ? `
                        <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem;">
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
                      <label style="font-size: 0.825rem; font-weight: 600; color: var(--text-muted);"><i class="fas fa-pen"></i> Talabaning Javob Matni:</label>
                      <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem; font-size: 0.9rem; line-height: 1.6; max-height: 140px; overflow-y: auto;">
                        ${ans.answer_text ? ans.answer_text : '<em style="color: var(--text-muted);">Talaba bo\'sh qoldirgan</em>'}
                      </div>
                    </div>

                    ${ans.question_sample_answer ? `
                      <div style="background: #fffdf5; border: 1px dashed #fde68a; padding: 0.65rem 0.85rem; border-radius: var(--radius-md); font-size: 0.825rem; color: #92400e; margin-bottom: 0.75rem;">
                        <strong><i class="fas fa-check-double"></i> Namunaviy javob / Baholash mezonlari:</strong> ${ans.question_sample_answer}
                      </div>
                    ` : ''}

                    <div class="ai-report-card" style="margin-bottom: 0.85rem;">
                      <div class="ai-header" style="padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                        <div class="ai-brand-badge" style="font-size: 0.75rem;">
                          <i class="fas fa-brain"></i> AI Tahlili (${aiFb.source || 'gpt-4o-mini'})
                        </div>
                        <div style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">
                          Tavsiya ball: ${ans.ai_score !== null ? ans.ai_score : '-'} / ${maxPts}
                        </div>
                      </div>

                      <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-main); margin-bottom: 0.5rem;">
                        <strong>Xulosa:</strong> ${aiFb.summary || "Tahlil qilinmoqda..."}
                      </div>

                      ${aiFb.strengths ? `
                        <div style="font-size: 0.825rem; color: #15803d; margin-bottom: 0.35rem;">
                          <i class="fas fa-check-circle"></i> <strong>To'g'ri jihatlar:</strong> ${aiFb.strengths}
                        </div>
                      ` : ''}

                      ${aiFb.gaps ? `
                        <div style="font-size: 0.825rem; color: #b45309; margin-bottom: 0.35rem;">
                          <i class="fas fa-exclamation-triangle"></i> <strong>Kamchiliklar:</strong> ${aiFb.gaps}
                        </div>
                      ` : ''}

                      ${aiFb.suggestions ? `
                        <div style="font-size: 0.825rem; color: #1d4ed8;">
                          <i class="fas fa-lightbulb"></i> <strong>Tavsiya:</strong> ${aiFb.suggestions}
                        </div>
                      ` : ''}
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem 1rem; border-radius: var(--radius-md); display: grid; grid-template-columns: 180px 1fr; gap: 0.75rem; align-items: center;">
                      <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.25rem;">
                          Baho (0 - ${maxPts}):
                        </label>
                        <div style="display: flex; gap: 0.25rem;">
                          <input 
                            type="number" 
                            id="q-grade-score-${ans.question_id}" 
                            class="form-control q-grade-input" 
                            data-qid="${ans.question_id}" 
                            data-max="${maxPts}" 
                            min="0" 
                            max="${maxPts}" 
                            step="0.5" 
                            value="${ans.teacher_score !== null ? ans.teacher_score : (ans.ai_score || 0)}" 
                            oninput="TeacherView.calcTotalGradeFromInputs()" 
                            required 
                          />
                          <button type="button" class="btn btn-secondary btn-sm" title="AI balini qo'yish" onclick="document.getElementById('q-grade-score-${ans.question_id}').value = ${ans.ai_score || 0}; TeacherView.calcTotalGradeFromInputs();">
                            <i class="fas fa-magic"></i>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                          Ushbu savol uchun izoh:
                        </label>
                        <input 
                          type="text" 
                          id="q-grade-fb-${ans.question_id}" 
                          class="form-control" 
                          placeholder="Savol bo'yicha talabaga qisqa tavsiya..." 
                          value="${ans.teacher_feedback || ''}" 
                        />
                      </div>
                    </div>
                  `}

                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        answersContentHtml = `
          <div>
            <label class="form-label" style="color: var(--primary);">
              <i class="fas fa-user-edit"></i> Talabaning Yuborgan Javobi:
            </label>
            <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; font-size: 0.925rem; line-height: 1.6; max-height: 200px; overflow-y: auto;">
              ${s.student_answer}
            </div>
          </div>

          <div class="ai-report-card">
            <div class="ai-header">
              <div class="ai-brand-badge">
                <i class="fas fa-brain"></i> OpenAI GPT-4o-mini Tahlili
              </div>
              <div class="ai-score-pill">
                <span class="score-number">${s.recommended_score !== null ? s.recommended_score : '-'}</span>
                <span class="score-max">/ 100 ball</span>
              </div>
            </div>

            <div class="ai-section">
              <div class="ai-section-title summary"><i class="fas fa-check-circle"></i> Xulosa</div>
              <div class="ai-section-content">${s.ai_summary || "Tahlil natijasi mavjud emas."}</div>
            </div>

            <div class="ai-section">
              <div class="ai-section-title gaps"><i class="fas fa-exclamation-triangle"></i> Kamchiliklar</div>
              <div class="ai-section-content" style="color: #92400e;">${s.ai_gaps || "Jiddiy kamchiliklar yo'q."}</div>
            </div>
          </div>
        `;
      }

      const totalMaxScore = s.max_score || s.assignment_total_points || 100;
      const initialTotalScore = s.teacher_score !== null ? s.teacher_score : (s.total_score !== null ? s.total_score : (s.recommended_score || 0));

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md);">
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${s.student_name}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted);">${s.group_name} &bull; ${s.student_email}</div>
            </div>
            <div>
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          ${answersContentHtml}

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.reanalyze(${s.id})">
              <i class="fas fa-redo"></i> AI Bilan Qayta Tahlil Qilish
            </button>
          </div>

          <form id="form-grade-submission" onsubmit="TeacherView.handleGradeSubmit(event, ${s.id})" style="border-top: 2px dashed var(--border); padding-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">
                <i class="fas fa-clipboard-check text-primary"></i> Yakuniy Bahoni Tasdiqlash
              </h4>
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--primary);">
                Maksimal ball: ${totalMaxScore} ball
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: start; margin-bottom: 1rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label required">Jami Yakuniy Baho</label>
                <div style="display: flex; gap: 0.35rem;">
                  <input 
                    type="number" 
                    id="grade-score" 
                    class="form-control" 
                    min="0" 
                    max="${totalMaxScore}" 
                    step="0.5" 
                    value="${initialTotalScore}" 
                    required 
                  />
                  <button type="button" class="btn btn-secondary btn-sm" title="Tavsiya balni olish" onclick="document.getElementById('grade-score').value = ${s.total_score || s.recommended_score || 0}">
                    <i class="fas fa-magic"></i>
                  </button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">O'qituvchining Umumiy Xulosasi / Izohi (Talabaga ko'rinadi)</label>
                <input 
                  type="text" 
                  id="grade-feedback" 
                  class="form-control" 
                  placeholder="Masalan: Barakalla! Savollar yaxshi o'zlashtirilgan." 
                  value="${s.teacher_feedback || ''}" 
                />
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="TeacherView.allowResubmit(${s.id})">
                <i class="fas fa-undo"></i> Qayta Topshirishga Ruxsat Berish
              </button>

              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
                <button type="submit" class="btn btn-success" id="btn-save-grade">
                  <i class="fas fa-check-double"></i> Bahoni Tasdiqlash
                </button>
              </div>
            </div>
          </form>

        </div>
      `;

      AppUI.openModal(`<i class="fas fa-award text-primary"></i> Mustaqil Ishni Baholash`, html, '', 'modal-xl');

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  calcTotalGradeFromInputs() {
    const inputs = document.querySelectorAll('.q-grade-input');
    if (!inputs || inputs.length === 0) return;

    let total = 0;
    inputs.forEach(inp => {
      total += (parseFloat(inp.value) || 0);
    });

    const totalEl = document.getElementById('grade-score');
    if (totalEl) {
      totalEl.value = Math.round(total * 10) / 10;
    }
  },

  async handleGradeSubmit(event, submissionId) {
    event.preventDefault();
    const teacher_score = document.getElementById('grade-score').value;
    const teacher_feedback = document.getElementById('grade-feedback').value;
    const btn = document.getElementById('btn-save-grade');

    const questionInputs = document.querySelectorAll('.q-grade-input');
    const question_grades = [];
    questionInputs.forEach(inp => {
      const qid = inp.getAttribute('data-qid');
      const fbEl = document.getElementById(`q-grade-fb-${qid}`);
      question_grades.push({
        question_id: parseInt(qid, 10),
        teacher_score: parseFloat(inp.value) || 0,
        teacher_feedback: fbEl ? fbEl.value : ''
      });
    });

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tasdiqlanmoqda...`;

    try {
      await Api.submissions.grade(submissionId, { 
        teacher_score, 
        teacher_feedback,
        question_grades
      });
      AppUI.showToast('success', 'Tasdiqlandi!', `Talabaning bahosi muvaffaqiyatli saqlandi va 'Baholandi' holatiga o'tkazildi.`);
      AppUI.closeModal();
      await this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check-double"></i> Bahoni Tasdiqlash`;
    }
  },

  async reanalyze(submissionId) {
    if (!confirm("AI ushbu javobni qayta tahlil qilishi uchun so'rov yuborilsinmi?")) return;
    try {
      AppUI.showToast('info', 'AI Tahlil', 'Sun\'iy intellekt qayta tahlil qilmoqda...');
      await Api.submissions.reanalyze(submissionId);
      AppUI.showToast('success', 'Tayyor', 'AI qayta tahlil qildi.');
      this.showGradeModal(submissionId);
      this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  async allowResubmit(submissionId) {
    if (!confirm("Talabaga ushbu topshiriqni qayta yuborishga ruxsat berasizmi? Mavjud topshirilgan ish o'chiriladi.")) return;
    try {
      await Api.submissions.allowResubmit(submissionId);
      AppUI.showToast('success', 'Ruxsat berildi', 'Talabaga qayta topshirish uchun imkoniyat ochildi.');
      AppUI.closeModal();
      await this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Eskirgan chaqiruvlarni qo'llab-quvvatlash uchun alias
  showCreateAssignmentModal() {
    this.openCreateWizard();
  }
};
