/**
 * UniTask AI - Talaba Foydalanuvchi Interfeysi (Student View)
 * Zamonaviy ish stoli, topshiriq tafsilotlari, nazariy materiallar,
 * server vaqti bilan himoyalangan test sessiyasi, oraliq qoralamalarni avtomatik saqlash,
 * mustaqil ish fayli biriktirish va AI tahlili natijalarini ko'rish.
 */

const StudentView = {
  assignments: [],
  filteredAssignments: [],
  currentAssignment: null,
  activeSession: null,
  studentAnswers: {}, // { [questionId]: { question_id, selected_option_id, answer_text } }
  attachedWorkFile: null,
  countdownTimerId: null,
  autoSaveTimerId: null,
  isAutoSaving: false,

  // Filtrlar
  filters: {
    search: '',
    subject: '',
    teacher: '',
    status: '', // '', 'not_started', 'in_progress', 'submitted', 'graded', 'expired'
    due: ''     // '', 'soon', 'expired', 'unlimited'
  },

  async render() {
    return `
      <div style="margin-bottom: 2rem;">
        <!-- Talaba Dashboard Headeri -->
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); border-radius: var(--radius-lg); padding: 1.75rem 2rem; color: white; margin-bottom: 1.5rem; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.75rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; margin-bottom: 0.5rem;">
                <i class="fas fa-graduation-cap"></i> ${AppState.user.group_name || 'Akademik Guruh'}
              </div>
              <h1 style="font-size: 1.75rem; font-weight: 800; color: white; letter-spacing: -0.02em; margin: 0;">
                Xush kelibsiz, ${AppState.user.name}!
              </h1>
              <p style="font-size: 0.9rem; opacity: 0.85; margin-top: 0.35rem; margin-bottom: 0;">
                Mustaqil ta'lim topshiriqlarini bajaring, nazariy materiallarni o'rganing va AI semantik tahlili orqali bilimlaringizni oshiring.
              </p>
            </div>

            <div style="text-align: right;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.85rem; padding: 0.5rem 1rem; border: 1px solid rgba(16, 185, 129, 0.4);">
                <i class="fas fa-circle" style="font-size: 0.5rem; vertical-align: middle;"></i> Tizim Faol
              </span>
            </div>
          </div>
        </div>

        <!-- Student Dynamic Content Container -->
        <div id="student-content-container">
          <div style="text-align: center; padding: 4rem;">
            <i class="fas fa-spinner fa-spin fa-2x text-primary"></i>
            <div style="margin-top: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">Topshiriqlar yuklanmoqda...</div>
          </div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    await this.loadData();
  },

  async loadData() {
    try {
      const res = await Api.assignments.getAll();
      this.assignments = res.assignments || [];
      this.renderDashboard();
    } catch (e) {
      const container = document.getElementById('student-content-container');
      if (container) {
        container.innerHTML = `
          <div class="empty-state card">
            <i class="fas fa-exclamation-triangle empty-state-icon text-danger"></i>
            <div class="empty-state-title">Ma'lumotlarni yuklab bo'lmadi</div>
            <div class="empty-state-desc">${e.message}</div>
            <button class="btn btn-primary" onclick="StudentView.loadData()">
              <i class="fas fa-redo"></i> Qayta urinish
            </button>
          </div>
        `;
      }
    }
  },

  // Real API statistikalarini hisoblash
  computeStats() {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    let total = this.assignments.length;
    let pending = 0;
    let inProgress = 0;
    let submitted = 0;
    let graded = 0;
    let endingSoon = 0;

    this.assignments.forEach(a => {
      const st = a.student_status;
      if (st === 'not_started') pending++;
      if (st === 'in_progress') inProgress++;
      if (st === 'submitted') submitted++;
      if (st === 'graded') graded++;

      if (a.due_date && st !== 'graded') {
        const dueDate = new Date(a.due_date);
        if (dueDate >= now && dueDate <= in3Days) {
          endingSoon++;
        }
      }
    });

    return { total, pending, inProgress, submitted, graded, endingSoon };
  },

  // Filtrlar bo'yicha topshiriqlarni saralash
  getFilteredAssignments() {
    const { search, subject, teacher, status, due } = this.filters;
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    return this.assignments.filter(a => {
      // Qidiruv
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const matchTitle = (a.title || '').toLowerCase().includes(term);
        const matchSub = (a.subject || '').toLowerCase().includes(term);
        const matchTeacher = (a.teacher_name || '').toLowerCase().includes(term);
        if (!matchTitle && !matchSub && !matchTeacher) return false;
      }

      // Fan
      if (subject && (a.subject || '').toLowerCase() !== subject.toLowerCase()) {
        return false;
      }

      // O'qituvchi
      if (teacher && (a.teacher_name || '').toLowerCase() !== teacher.toLowerCase()) {
        return false;
      }

      // Holat
      if (status && a.student_status !== status) {
        return false;
      }

      // Muddat
      if (due === 'soon') {
        if (!a.due_date) return false;
        const d = new Date(a.due_date);
        if (d < now || d > in3Days) return false;
      } else if (due === 'expired') {
        if (!a.due_date || new Date(a.due_date) >= now) return false;
      } else if (due === 'unlimited') {
        if (a.due_date) return false;
      }

      return true;
    });
  },

  renderDashboard() {
    const container = document.getElementById('student-content-container');
    if (!container) return;

    if (this.assignments.length === 0) {
      container.innerHTML = `
        <div class="empty-state card" style="padding: 3.5rem 1.5rem;">
          <i class="fas fa-book-reader empty-state-icon text-primary" style="font-size: 3rem; margin-bottom: 1rem;"></i>
          <div class="empty-state-title" style="font-size: 1.25rem;">Guruhda hozircha topshiriqlar mavjud emas</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0.5rem auto 1.5rem auto;">
            O'qituvchilaringiz sizning guruhingiz uchun mustaqil ta'lim topshirig'i yoki test joylashtirganda bu yerda ko'rinadi.
          </div>
        </div>
      `;
      return;
    }

    const stats = this.computeStats();
    const filtered = this.getFilteredAssignments();

    // Dinamik fanlar va o'qituvchilar ro'yxati
    const subjects = Array.from(new Set(this.assignments.map(a => a.subject).filter(Boolean)));
    const teachers = Array.from(new Set(this.assignments.map(a => a.teacher_name).filter(Boolean)));

    container.innerHTML = `
      <!-- 5-Stats Cards -->
      <div class="student-stats-grid">
        <div class="student-stat-card">
          <div class="teacher-stat-icon" style="background: #e0e7ff; color: #4338ca;">
            <i class="fas fa-tasks"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value">${stats.total}</div>
            <div class="teacher-stat-label">Jami topshiriqlar</div>
          </div>
        </div>

        <div class="student-stat-card">
          <div class="teacher-stat-icon" style="background: #fef3c7; color: #92400e;">
            <i class="fas fa-hourglass-start"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value" style="color: #b45309;">${stats.pending + stats.inProgress}</div>
            <div class="teacher-stat-label">Bajarilishi kerak</div>
          </div>
        </div>

        <div class="student-stat-card">
          <div class="teacher-stat-icon" style="background: #e0f2fe; color: #0369a1;">
            <i class="fas fa-paper-plane"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value">${stats.submitted}</div>
            <div class="teacher-stat-label">Topshirilgan ishlar</div>
          </div>
        </div>

        <div class="student-stat-card">
          <div class="teacher-stat-icon" style="background: #dcfce7; color: #166534;">
            <i class="fas fa-award"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value" style="color: #15803d;">${stats.graded}</div>
            <div class="teacher-stat-label">Baholangan</div>
          </div>
        </div>

        <div class="student-stat-card">
          <div class="teacher-stat-icon" style="background: #fee2e2; color: #b91c1c;">
            <i class="fas fa-clock"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value" style="color: #b91c1c;">${stats.endingSoon}</div>
            <div class="teacher-stat-label">Muddati yaqinlashgan</div>
          </div>
        </div>
      </div>

      <!-- Toolbar & Filters -->
      <div class="teacher-toolbar" style="margin-bottom: 1.5rem;">
        <div class="teacher-search-box">
          <i class="fas fa-search"></i>
          <input 
            type="text" 
            class="form-control" 
            placeholder="Topshiriq nomi, fan yoki o'qituvchi bo'yicha qidiruv..." 
            value="${this.filters.search}" 
            oninput="StudentView.handleFilterChange('search', this.value)" 
          />
        </div>

        <div class="teacher-filters">
          <!-- Fan filtri -->
          <select class="form-select" style="width: auto; min-width: 140px; font-size: 0.85rem;" onchange="StudentView.handleFilterChange('subject', this.value)">
            <option value="">Barcha fanlar (${subjects.length})</option>
            ${subjects.map(s => `<option value="${s}" ${this.filters.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>

          <!-- O'qituvchi filtri -->
          <select class="form-select" style="width: auto; min-width: 140px; font-size: 0.85rem;" onchange="StudentView.handleFilterChange('teacher', this.value)">
            <option value="">Barcha o'qituvchilar</option>
            ${teachers.map(t => `<option value="${t}" ${this.filters.teacher === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>

          <!-- Holat filtri -->
          <select class="form-select" style="width: auto; min-width: 140px; font-size: 0.85rem;" onchange="StudentView.handleFilterChange('status', this.value)">
            <option value="">Barcha holatlar</option>
            <option value="not_started" ${this.filters.status === 'not_started' ? 'selected' : ''}>Boshlanmagan</option>
            <option value="in_progress" ${this.filters.status === 'in_progress' ? 'selected' : ''}>Jarayonda (Faol test)</option>
            <option value="submitted" ${this.filters.status === 'submitted' ? 'selected' : ''}>Topshirilgan (Kutilmoqda)</option>
            <option value="graded" ${this.filters.status === 'graded' ? 'selected' : ''}>Baholangan</option>
            <option value="expired" ${this.filters.status === 'expired' ? 'selected' : ''}>Muddati o'tgan</option>
          </select>

          <!-- Muddat filtri -->
          <select class="form-select" style="width: auto; min-width: 130px; font-size: 0.85rem;" onchange="StudentView.handleFilterChange('due', this.value)">
            <option value="">Barcha muddatlar</option>
            <option value="soon" ${this.filters.due === 'soon' ? 'selected' : ''}>Yaqin 3 kunda tugaydigan</option>
            <option value="expired" ${this.filters.due === 'expired' ? 'selected' : ''}>Muddati o'tgan</option>
            <option value="unlimited" ${this.filters.due === 'unlimited' ? 'selected' : ''}>Cheklanmagan muddat</option>
          </select>

          ${this.hasActiveFilters() ? `
            <button class="btn btn-secondary btn-sm" onclick="StudentView.resetFilters()" title="Filtrlarni tozalash">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Topshiriqlar Kartalari Ro'yxati -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">
            Topshiriqlar ro'yxati (${filtered.length} ta)
          </h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            Kartani bosib tafsilotlar yoki testni oching
          </span>
        </div>

        ${filtered.length === 0 ? `
          <div class="empty-state card" style="padding: 2.5rem 1rem;">
            <i class="fas fa-search empty-state-icon" style="font-size: 2.5rem;"></i>
            <div class="empty-state-title" style="font-size: 1rem;">Mos topshiriq topilmadi</div>
            <div class="empty-state-desc" style="font-size: 0.85rem;">Tanlangan filtrlar bo'yicha hech qanday topshiriq mos kelmadi.</div>
            <button class="btn btn-outline btn-sm" style="margin-top: 0.75rem;" onclick="StudentView.resetFilters()">
              <i class="fas fa-undo"></i> Filtrlarni tozalash
            </button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.25rem;">
            ${filtered.map(a => this.renderTaskCard(a)).join('')}
          </div>
        `}
      </div>
    `;
  },

  hasActiveFilters() {
    return Boolean(
      this.filters.search ||
      this.filters.subject ||
      this.filters.teacher ||
      this.filters.status ||
      this.filters.due
    );
  },

  handleFilterChange(key, value) {
    this.filters[key] = value;
    this.renderDashboard();
  },

  resetFilters() {
    this.filters = {
      search: '',
      subject: '',
      teacher: '',
      status: '',
      due: ''
    };
    this.renderDashboard();
  },

  renderTaskCard(a) {
    const now = new Date();
    const isExpired = a.due_date && new Date(a.due_date) < now;
    const qCount = a.question_count || 0;
    const attemptsLimit = a.attempts_limit || 1;
    const myAttempts = a.my_attempts_count || 0;
    const attemptsLeft = Math.max(0, attemptsLimit - myAttempts);

    // Holat nishonini shakllantirish
    let statusBadgeHtml = '';
    let actionButtonHtml = '';

    if (a.student_status === 'graded') {
      const finalScore = a.teacher_score !== null ? a.teacher_score : (a.total_score || a.recommended_score || 0);
      statusBadgeHtml = `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700;"><i class="fas fa-check-double"></i> Baholangan: ${finalScore} / ${a.total_points || 100} ball</span>`;
      actionButtonHtml = `
        <button class="btn btn-success btn-sm" onclick="StudentView.showResultModal(${a.submission_id})">
          <i class="fas fa-award"></i> Baho va AI Tahlilini Ko'rish
        </button>
      `;
    } else if (a.student_status === 'submitted') {
      statusBadgeHtml = `<span class="badge badge-reviewed"><i class="fas fa-robot"></i> Topshirilgan (${a.recommended_score || 0} ball AI tavsiya)</span>`;
      actionButtonHtml = `
        <button class="btn btn-primary btn-sm" onclick="StudentView.showResultModal(${a.submission_id})">
          <i class="fas fa-eye"></i> Natijani Ko'rish
        </button>
      `;
    } else if (a.student_status === 'in_progress') {
      statusBadgeHtml = `<span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 700;"><i class="fas fa-spinner fa-spin"></i> Test Jarayonda</span>`;
      actionButtonHtml = `
        <button class="btn btn-warning btn-sm" onclick="StudentView.startTest(${a.id})" style="color: #92400e; font-weight: 700;">
          <i class="fas fa-play"></i> Testni Davom Ettirish
        </button>
      `;
    } else if (a.student_status === 'expired') {
      statusBadgeHtml = `<span class="badge" style="background: #fee2e2; color: #991b1b;"><i class="fas fa-calendar-times"></i> Muddati o'tgan</span>`;
      actionButtonHtml = `
        <button class="btn btn-secondary btn-sm" onclick="StudentView.showDetailsModal(${a.id})">
          <i class="fas fa-info-circle"></i> Tafsilotlar
        </button>
      `;
    } else {
      // not_started
      statusBadgeHtml = `<span class="badge" style="background: #e0e7ff; color: #4338ca;"><i class="fas fa-edit"></i> Boshlanmagan</span>`;
      actionButtonHtml = `
        <button class="btn btn-primary btn-sm" onclick="StudentView.startTest(${a.id})">
          <i class="fas fa-pen"></i> Testni Boshlash
        </button>
      `;
    }

    return `
      <div class="student-task-card">
        <div>
          <!-- Header: Sarlavha va Holat -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
            <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0; line-height: 1.35;">
              ${a.title}
            </h4>
            <div style="flex-shrink: 0;">
              ${statusBadgeHtml}
            </div>
          </div>

          <!-- O'qituvchi va Fan -->
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            ${a.subject ? `<span style="font-weight: 600; color: var(--primary);"><i class="fas fa-book"></i> ${a.subject} &bull; </span>` : ''}
            <span><i class="fas fa-user-tie"></i> ${a.teacher_name}</span>
          </div>

          <!-- Asosiy parametrlar nishonlari -->
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.75rem;">
              <i class="fas fa-star text-warning"></i> ${a.total_points || 100} ball
            </span>

            ${a.has_dynamic_questions ? `
              <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.75rem;">
                <i class="fas fa-list-ol"></i> ${qCount} ta savol
              </span>
            ` : `
              <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.75rem;">
                <i class="fas fa-pen-alt"></i> Matnli topshiriq
              </span>
            `}

            <span class="badge" style="background: ${attemptsLeft > 0 ? '#dcfce7' : '#fee2e2'}; color: ${attemptsLeft > 0 ? '#166534' : '#991b1b'}; font-size: 0.75rem;">
              <i class="fas fa-redo"></i> Urinishlar: ${myAttempts} / ${attemptsLimit} ta
            </span>

            ${a.time_limit_minutes ? `
              <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.75rem;">
                <i class="fas fa-stopwatch"></i> ${a.time_limit_minutes} daqiqa
              </span>
            ` : `
              <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.75rem;">
                <i class="fas fa-infinity"></i> Cheksiz vaqt
              </span>
            `}
          </div>

          <!-- Tugash muddati -->
          <div style="font-size: 0.775rem; color: ${isExpired ? 'var(--danger)' : 'var(--text-muted)'}; margin-bottom: 1.25rem;">
            <i class="fas fa-calendar-alt"></i> Tugash muddati: 
            <strong>${a.due_date ? AppUI.formatDate(a.due_date) : 'Cheklanmagan'}</strong>
          </div>
        </div>

        <!-- Amallar qatori -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.85rem;">
          <button class="btn btn-outline btn-sm" onclick="StudentView.showDetailsModal(${a.id})">
            <i class="fas fa-book-open"></i> Materiallar
          </button>
          ${actionButtonHtml}
        </div>
      </div>
    `;
  },

  // =========================================================================
  // TOPSHIRIQ TAFSILOTLARI VA NAZARIY MATERIALLAR MODALI
  // =========================================================================

  async showDetailsModal(assignmentId) {
    try {
      const res = await Api.assignments.getById(assignmentId);
      const a = res.assignment;
      const questions = a.questions || [];
      const now = new Date();
      const isExpired = a.due_date && new Date(a.due_date) < now;
      const myAttempts = res.my_attempts_count || 0;
      const attemptsLimit = a.attempts_limit || 1;
      const attemptsLeft = Math.max(0, attemptsLimit - myAttempts);
      const canAttempt = attemptsLeft > 0 && !isExpired;

      const hasTheory = Boolean(a.content && a.content.trim().length > 0 && a.content !== "Mavzu bo'yicha mustaqil topshiriq materiallari.");

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Asosiy Banner -->
          <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 1.25rem 1.5rem; border-radius: var(--radius-lg); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: white; margin: 0;">${a.title}</h2>
              <span class="badge" style="background: rgba(255,255,255,0.2); color: white; font-size: 0.85rem;">
                <i class="fas fa-star"></i> Maksimal: ${a.total_points || 100} ball
              </span>
            </div>
            <div style="font-size: 0.85rem; opacity: 0.9;">
              ${a.subject ? `<span><strong>Fan:</strong> ${a.subject} &bull; </span>` : ''}
              <span><i class="fas fa-user-tie"></i> O'qituvchi: ${a.teacher_name}</span>
              ${a.due_date ? ` &bull; <span><i class="fas fa-clock"></i> Tugash muddati: ${AppUI.formatDate(a.due_date)}</span>` : ''}
            </div>
          </div>

          <!-- Shartlar va Limitlar paneli -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
            <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Ajratilgan Vaqt:</div>
              <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem;">
                ${a.time_limit_minutes ? `<i class="fas fa-stopwatch text-primary"></i> ${a.time_limit_minutes} daqiqa` : '<i class="fas fa-infinity text-muted"></i> Cheklanmagan'}
              </div>
            </div>

            <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Urinishlar Limiti:</div>
              <div style="font-size: 1rem; font-weight: 800; color: ${attemptsLeft > 0 ? 'var(--success)' : 'var(--danger)'}; margin-top: 0.2rem;">
                <i class="fas fa-redo"></i> ${myAttempts} / ${attemptsLimit} ta (Qolgan: ${attemptsLeft})
              </div>
            </div>

            <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Savollar Tuzilishi:</div>
              <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem;">
                <i class="fas fa-tasks text-primary"></i> ${questions.length > 0 ? `${questions.length} ta savol` : '1 ta matnli vazifa'}
              </div>
            </div>
          </div>

          <!-- O'qituvchi Yo'riqnomasi -->
          ${a.instructions ? `
            <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 0.85rem 1.25rem; border-radius: var(--radius-md); font-size: 0.875rem; color: #15803d; line-height: 1.5;">
              <strong><i class="fas fa-info-circle"></i> O'qituvchi yo'riqnomasi:</strong> ${a.instructions}
            </div>
          ` : ''}

          <!-- Nazariy Manba (Ground Truth) -->
          ${hasTheory ? `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label class="form-label" style="font-size: 0.9rem; font-weight: 700; margin: 0; color: var(--text-main);">
                  <i class="fas fa-book-open text-primary"></i> O'quv va Nazariy Materiallar
                </label>
                <span class="badge" style="background: var(--bg-alt); color: var(--text-muted); font-size: 0.75rem;">
                  ${a.content.length} ta belgi
                </span>
              </div>

              <div class="wizard-theory-preview-box" style="max-height: 200px;">
                ${a.content}
              </div>
            </div>
          ` : ''}

          <!-- Biriktirilgan manba hujjati -->
          ${a.file_path ? `
            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <i class="fas fa-file-pdf text-danger fa-2x"></i>
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${a.file_name || 'Mavzu bo\'yicha o\'quv hujjati'}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    ${a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB &bull; ` : ''}O'qituvchi ilova qilgan rasmiy material
                  </div>
                </div>
              </div>
              <a href="${a.file_path}" target="_blank" download class="btn btn-outline btn-sm">
                <i class="fas fa-download"></i> Hujjatni yuklab olish
              </a>
            </div>
          ` : ''}

          <!-- Ogohlantirishlar & Eslatmalar -->
          ${a.time_limit_minutes ? `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem;">
              <i class="fas fa-exclamation-triangle text-warning" style="font-size: 1.25rem;"></i>
              <div style="font-size: 0.825rem; color: #92400e;">
                <strong>Vaqt chegarasi:</strong> Test boshlanganidan so'ng <strong>${a.time_limit_minutes} daqiqa</strong> vaqt sanaladi va to'xtatilmaydi.
              </div>
            </div>
          ` : ''}

          <!-- Modal Pastki Tugmalari -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
            
            ${canAttempt ? `
              <button type="button" class="btn btn-primary btn-lg" onclick="StudentView.startTest(${a.id})">
                <i class="fas fa-play-circle"></i> Testni Boshlash
              </button>
            ` : (res.mySubmission ? `
              <button type="button" class="btn btn-success btn-lg" onclick="StudentView.showResultModal(${res.mySubmission.id})">
                <i class="fas fa-award"></i> Natijani Ko'rish
              </button>
            ` : `
              <button type="button" class="btn btn-secondary btn-lg" disabled>
                Urinishlar tugagan
              </button>
            `)}
          </div>

        </div>
      `;

      AppUI.openModal(`<i class="fas fa-book-reader text-primary"></i> ${a.title}`, html, '', 'modal-xl');

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // =========================================================================
  // TESTNI BOSHLASH VA VAQTNI BOSHQARISH (Active Test Session)
  // =========================================================================

  async startTest(assignmentId) {
    try {
      // 1. Serverda sessiya yaratish yoki mavjudini davom ettirish
      const startRes = await Api.submissions.startSession(assignmentId);
      const session = startRes.session;
      this.activeSession = session;

      // 2. Topshiriq tafsilotlarini yuklash
      const assignRes = await Api.assignments.getById(assignmentId);
      const a = assignRes.assignment;
      this.currentAssignment = a;
      this.studentAnswers = {};
      this.attachedWorkFile = null;

      const questions = a.questions || [];
      const isDynamic = a.has_dynamic_questions === 1 || questions.length > 0;

      // 3. Qoralamalarni (draft) tiklash
      // Serverdagi qoralama yoki localStorage dan
      let draftData = session.draft || null;
      if (!draftData) {
        const local = localStorage.getItem('unitask_draft_' + assignmentId);
        if (local) {
          try { draftData = JSON.parse(local); } catch (e) {}
        }
      }

      if (isDynamic) {
        questions.forEach(q => {
          this.studentAnswers[q.id] = {
            question_id: q.id,
            selected_option_id: null,
            answer_text: ''
          };
        });

        if (draftData && Array.isArray(draftData.answers)) {
          draftData.answers.forEach(dAns => {
            if (this.studentAnswers[dAns.question_id]) {
              this.studentAnswers[dAns.question_id].selected_option_id = dAns.selected_option_id || null;
              this.studentAnswers[dAns.question_id].answer_text = dAns.answer_text || '';
            }
          });
        }
      }

      this.renderActiveTestModal(isDynamic, draftData ? draftData.student_answer : '');

      // 4. Taymerni ishga tushirish
      if (session.remaining_seconds !== null && session.remaining_seconds !== undefined) {
        this.startCountdownTimer(session.remaining_seconds, assignmentId);
      }

      if (session.is_resumed) {
        AppUI.showToast('info', 'Sessiya tiklandi', 'Mavjud test sessiyangiz va qoralamalaringiz tiklandi.');
      } else {
        AppUI.showToast('success', 'Test boshlandi', `Urinish #${session.attempt_number || 1} muvaffaqiyatli boshlandi.`);
      }

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  startCountdownTimer(seconds, assignmentId) {
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
    }

    let remaining = seconds;
    const updateDisplay = () => {
      const el = document.getElementById('test-timer-display');
      if (!el) return;

      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      el.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (remaining <= 60) {
        el.className = 'test-timer-badge danger';
      } else if (remaining <= 300) {
        el.className = 'test-timer-badge warning';
      } else {
        el.className = 'test-timer-badge';
      }
    };

    updateDisplay();

    this.countdownTimerId = setInterval(async () => {
      remaining--;
      updateDisplay();

      if (remaining <= 0) {
        clearInterval(this.countdownTimerId);
        this.countdownTimerId = null;
        alert("Ajratilgan test vaqti tugadi! Javoblaringiz avtomatik topshirilmoqda...");
        const form = document.getElementById('form-student-submit');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }
    }, 1000);
  },

  renderActiveTestModal(isDynamic, legacyDraftText = '') {
    const a = this.currentAssignment;
    const questions = a.questions || [];
    const attemptNum = this.activeSession ? this.activeSession.attempt_number : 1;

    let questionsContentHtml = '';

    if (isDynamic) {
      questionsContentHtml = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Savollar Navigatori (Pills) -->
          <div>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">
              Savollar navigatsiyasi (Tez o'tish):
            </div>
            <div class="question-nav-pills">
              ${questions.map((q, idx) => {
                const ans = this.studentAnswers[q.id];
                const isAnswered = ans && (ans.selected_option_id || (ans.answer_text && ans.answer_text.trim().length > 0));
                return `
                  <a href="#quiz-q-box-${q.id}" class="q-nav-pill ${isAnswered ? 'answered' : ''}" id="q-pill-${q.id}">
                    ${idx + 1}
                  </a>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Savol kartalari -->
          ${questions.map((q, idx) => {
            const isClosed = q.question_type === 'closed';
            const currentAns = this.studentAnswers[q.id] || {};

            return `
              <div class="quiz-question-box" id="quiz-q-box-${q.id}" style="padding: 1.25rem; border: 1.5px solid var(--border); border-radius: var(--radius-lg);">
                <div class="quiz-question-header" style="margin-bottom: 0.85rem; padding-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
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
                <div style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 1.25rem; line-height: 1.5;">
                  ${q.question_text}
                </div>

                ${isClosed ? `
                  <!-- Yopiq test variantlari (Xavfsiz: to'g'ri javoblar sir saqlanadi) -->
                  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${(q.options || []).map(opt => {
                      const isSelected = String(currentAns.selected_option_id) === String(opt.id);
                      return `
                        <div 
                          class="quiz-option-item ${isSelected ? 'selected' : ''}" 
                          id="opt-item-${q.id}-${opt.id}" 
                          onclick="StudentView.selectOption(${q.id}, ${opt.id})"
                        >
                          <div class="quiz-option-circle" id="opt-circle-${q.id}-${opt.id}">${opt.option_key}</div>
                          <div style="font-size: 0.95rem; color: var(--text-main); line-height: 1.4; flex: 1;">${opt.option_text}</div>
                        </div>
                      `;
                    }).join('')}
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
                      <label class="form-label required" style="font-size: 0.85rem; margin: 0;">Sizning javobingiz:</label>
                      <span id="open-ans-count-${q.id}" class="word-badge">0 so'z</span>
                    </div>

                    <textarea 
                      id="open-ans-text-${q.id}" 
                      class="form-control" 
                      style="min-height: 120px; line-height: 1.6;" 
                      placeholder="Ushbu savol bo'yicha javobingizni asosli bayon eting..." 
                      oninput="StudentView.handleOpenAnswerInput(${q.id}, this.value)"
                      required>${currentAns.answer_text || ''}</textarea>
                  </div>
                `}

              </div>
            `;
          }).join('')}

        </div>
      `;
    } else {
      questionsContentHtml = `
        <div style="margin-top: 1rem;">
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
            oninput="StudentView.handleLegacyInput(this.value)"
            required>${legacyDraftText || ''}</textarea>
        </div>
      `;
    }

    const modalHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Sticky Header: Taymer, Qoralamalar holati va Progress -->
        <div style="position: sticky; top: -1rem; z-index: 10; background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="badge" style="background: #eef2ff; color: #4338ca; font-weight: 700; font-size: 0.85rem;">
              <i class="fas fa-redo"></i> Urinish #${attemptNum}
            </span>
            <span id="answered-progress-badge" class="badge" style="background: var(--bg-alt); color: var(--text-main); font-size: 0.85rem;">
              0 / ${questions.length} ta bajarildi
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 1rem;">
            <!-- Auto-save indicator -->
            <div id="autosave-status" class="autosave-indicator saved">
              <i class="fas fa-check-circle"></i> Saqlandi
            </div>

            <!-- Timer -->
            ${a.time_limit_minutes ? `
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Qolgan vaqt:</span>
                <span id="test-timer-display" class="test-timer-badge">
                  --:--
                </span>
              </div>
            ` : `
              <span class="badge" style="background: #f1f5f9; color: #64748b;">
                <i class="fas fa-infinity"></i> Cheksiz vaqt
              </span>
            `}
          </div>
        </div>

        <!-- Savollar va javob formasi -->
        <form id="form-student-submit" onsubmit="StudentView.handleSubmitAnswers(event, ${a.id}, ${isDynamic})">
          ${questionsContentHtml}

          <!-- Mustaqil ish faylini ilova qilish (Optional File Upload) -->
          <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: var(--radius-lg); padding: 1.25rem; margin-top: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <label class="form-label" style="font-size: 0.9rem; font-weight: 700; margin: 0; color: var(--text-main);">
                <i class="fas fa-paperclip text-primary"></i> Mustaqil ish hujjatini biriktirish (Ixtiyoriy)
              </label>
              ${this.attachedWorkFile ? `
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="StudentView.clearAttachedWorkFile()">
                  <i class="fas fa-trash"></i> Faylni o'chirish
                </button>
              ` : ''}
            </div>

            ${this.attachedWorkFile ? `
              <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-file-alt text-primary fa-lg"></i>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${this.attachedWorkFile.name}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${(this.attachedWorkFile.size / 1024).toFixed(1)} KB</div>
                </div>
                <span class="badge" style="background: #dcfce7; color: #166534;">Tayyor</span>
              </div>
            ` : `
              <input 
                type="file" 
                id="student-work-file" 
                class="form-control" 
                accept=".pdf,.doc,.docx,.pptx,.ppt,.txt" 
                onchange="StudentView.handleWorkFileSelect(event)" 
              />
              <div class="form-hint" style="margin-top: 0.35rem;">
                Ruxsat etilgan formatlar: PDF, DOC, DOCX, PPTX, TXT (maksimal hajm: 50MB). Agar topshiriq taqdimot yoki hujjat topshirishni talab qilsa yuklang.
              </div>
            `}
          </div>

          <!-- Pastki topshirish amallari -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1.25rem; margin-top: 1.5rem;">
            <button type="button" class="btn btn-secondary" onclick="StudentView.confirmLeaveTest()">
              Testdan chiqish (Qoralama saqlanadi)
            </button>
            
            <button type="submit" class="btn btn-primary btn-lg" id="btn-submit-task">
              <i class="fas fa-paper-plane"></i> Testni Yakunlash va Topshirish
            </button>
          </div>
        </form>

      </div>
    `;

    AppUI.openModal(`<i class="fas fa-tasks text-primary"></i> ${a.title}`, modalHtml, '', 'modal-xl');
    this.updateAnswerProgress();
  },

  handleWorkFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      AppUI.showToast('danger', 'Hajm katta', 'Fayl hajmi 50MB dan oshmasligi kerak.');
      event.target.value = '';
      return;
    }

    this.attachedWorkFile = file;
    AppUI.showToast('success', 'Fayl biriktirildi', `"${file.name}" topshirishga tayyorlandi.`);
    const isDynamic = this.currentAssignment.has_dynamic_questions === 1 || (this.currentAssignment.questions || []).length > 0;
    this.renderActiveTestModal(isDynamic);
  },

  clearAttachedWorkFile() {
    this.attachedWorkFile = null;
    const isDynamic = this.currentAssignment.has_dynamic_questions === 1 || (this.currentAssignment.questions || []).length > 0;
    this.renderActiveTestModal(isDynamic);
  },

  confirmLeaveTest() {
    if (confirm("Test oynasidan chiqmoqchimisiz? Kiritilgan javoblaringiz qoralama sifatida saqlangan va test vaqti tugamaguncha davom ettirishingiz mumkin.")) {
      if (this.countdownTimerId) {
        clearInterval(this.countdownTimerId);
        this.countdownTimerId = null;
      }
      AppUI.closeModal();
      this.loadData();
    }
  },

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
    this.triggerAutoSave();
  },

  handleOpenAnswerInput(questionId, text) {
    if (!this.studentAnswers[questionId]) {
      this.studentAnswers[questionId] = { question_id: questionId, selected_option_id: null, answer_text: '' };
    }

    this.studentAnswers[questionId].answer_text = text;

    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const badge = document.getElementById(`open-ans-count-${questionId}`);
    if (badge) {
      badge.innerText = `${words} so'z`;
      if (words >= 15) {
        badge.className = 'word-badge valid';
      } else {
        badge.className = 'word-badge';
      }
    }

    this.updateAnswerProgress();
    this.triggerAutoSave();
  },

  handleLegacyInput(text) {
    const words = (text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
    const badge = document.getElementById('legacy-answer-counter');
    if (badge) {
      badge.innerText = `${words} so'z`;
      if (words >= 25) {
        badge.className = 'word-badge valid';
      } else {
        badge.className = 'word-badge';
      }
    }
    this.triggerAutoSave();
  },

  updateAnswerProgress() {
    if (!this.currentAssignment || !this.currentAssignment.questions) return;
    const questions = this.currentAssignment.questions;

    let answeredCount = 0;
    questions.forEach(q => {
      const ans = this.studentAnswers[q.id];
      let isAns = false;
      if (ans) {
        if (q.question_type === 'closed' && ans.selected_option_id) {
          answeredCount++;
          isAns = true;
        } else if (q.question_type === 'open' && ans.answer_text && ans.answer_text.trim().length > 0) {
          answeredCount++;
          isAns = true;
        }
      }

      // Pill holatini yangilash
      const pill = document.getElementById(`q-pill-${q.id}`);
      if (pill) {
        pill.classList.toggle('answered', isAns);
      }
    });

    const badge = document.getElementById('answered-progress-badge');
    if (badge) {
      badge.innerText = `${answeredCount} / ${questions.length} ta bajarildi`;
      if (answeredCount === questions.length && questions.length > 0) {
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
      } else {
        badge.style.background = 'var(--bg-alt)';
        badge.style.color = 'var(--text-main)';
      }
    }
  },

  // Oraliq qoralamani avtomatik saqlash (Debounced Auto-save)
  triggerAutoSave() {
    const statusEl = document.getElementById('autosave-status');
    if (statusEl) {
      statusEl.className = 'autosave-indicator saving';
      statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...';
    }

    if (this.autoSaveTimerId) {
      clearTimeout(this.autoSaveTimerId);
    }

    this.autoSaveTimerId = setTimeout(async () => {
      await this.saveDraftNow();
    }, 2500);
  },

  async saveDraftNow() {
    if (!this.currentAssignment) return;
    const assignmentId = this.currentAssignment.id;
    const isDynamic = this.currentAssignment.has_dynamic_questions === 1 || (this.currentAssignment.questions || []).length > 0;

    let legacyText = '';
    const legEl = document.getElementById('legacy-student-answer');
    if (legEl) legacyText = legEl.value;

    const answersList = Object.values(this.studentAnswers);

    // 1. LocalStorage ga saqlash
    localStorage.setItem('unitask_draft_' + assignmentId, JSON.stringify({
      answers: answersList,
      student_answer: legacyText
    }));

    // 2. Serverga saqlash
    const statusEl = document.getElementById('autosave-status');
    try {
      await Api.submissions.saveDraft({
        assignment_id: assignmentId,
        answers: answersList,
        student_answer: legacyText
      });

      if (statusEl) {
        statusEl.className = 'autosave-indicator saved';
        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Saqlandi';
      }
    } catch (e) {
      if (statusEl) {
        statusEl.className = 'autosave-indicator offline';
        statusEl.innerHTML = '<i class="fas fa-save"></i> Brauzerda saqlandi';
      }
    }
  },

  // =========================================================================
  // JAVOBLARNI YAKUNIY TOPSHIRISH
  // =========================================================================

  async handleSubmitAnswers(event, assignmentId, isDynamic) {
    if (event) event.preventDefault();
    if (this.isSubmitting) return;

    const questions = this.currentAssignment.questions || [];
    let unansweredCount = 0;

    if (isDynamic) {
      questions.forEach(q => {
        const a = this.studentAnswers[q.id];
        if (!a) {
          unansweredCount++;
        } else if (q.question_type === 'closed' && !a.selected_option_id) {
          unansweredCount++;
        } else if (q.question_type === 'open' && (!a.answer_text || !a.answer_text.trim())) {
          unansweredCount++;
        }
      });
    }

    if (unansweredCount > 0) {
      const proceed = confirm(`Diqqat! ${unansweredCount} ta savolga hali javob berilmadi.\nBaribir topshiriqni yakunlab, AI tahliliga yuborishni xohlaysizmi?`);
      if (!proceed) return;
    } else {
      const proceed = confirm("Testni yakunlab topshirishni tasdiqlaysizmi?");
      if (!proceed) return;
    }

    // Taymerni to'xtatish
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }

    // FormData shakllantirish (Matn + Fayl)
    const formData = new FormData();
    formData.append('assignment_id', assignmentId);

    if (isDynamic) {
      formData.append('answers', JSON.stringify(Object.values(this.studentAnswers)));
    } else {
      const legEl = document.getElementById('legacy-student-answer');
      formData.append('student_answer', legEl ? legEl.value.trim() : '');
    }

    if (this.attachedWorkFile) {
      formData.append('file', this.attachedWorkFile);
    }

    // Modal ichini AI tahlili animatsiyasiga almashtirish
    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="ai-evaluating-container">
          <div class="ai-radar-spinner">
            <div class="radar-circle"></div>
            <div class="radar-circle"></div>
            <div class="radar-circle"></div>
            <div class="radar-core"><i class="fas fa-brain"></i></div>
          </div>

          <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">
            Sun'iy Intellekt Ishingizni Tahlil Qilmoqda...
          </h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); max-width: 480px; margin-bottom: 1.5rem; line-height: 1.5;">
            Yopiq testlar backendda tekshirilmoqda, ochiq savollar va yuklangan fayl esa GPT AI orqali semantik baholanmoqda.
          </p>

          <div class="eval-steps-list">
            <div class="eval-step-item active" id="step-1">
              <i class="fas fa-spinner fa-spin"></i> 1. Javoblar serverga qabul qilindi va sessiya yopildi
            </div>
            <div class="eval-step-item" id="step-2">
              <i class="far fa-circle"></i> 2. Yopiq testlar ballari va ochiq savollar semantik tahlili
            </div>
            <div class="eval-step-item" id="step-3">
              <i class="far fa-circle"></i> 3. Bilimdagi bo'shliqlar, xulosa va tavsiyalar hisoblanmoqda...
            </div>
          </div>
        </div>
      `;

      setTimeout(() => {
        const s1 = document.getElementById('step-1');
        const s2 = document.getElementById('step-2');
        if (s1 && s2) {
          s1.className = 'eval-step-item completed';
          s1.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 1. Javoblar serverga qabul qilindi`;
          s2.className = 'eval-step-item active';
          s2.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 2. AI ochiq savollarni semantik tahlil qilmoqda...`;
        }
      }, 1500);

      setTimeout(() => {
        const s2 = document.getElementById('step-2');
        const s3 = document.getElementById('step-3');
        if (s2 && s3) {
          s2.className = 'eval-step-item completed';
          s2.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 2. AI semantik tahlili yakunlandi`;
          s3.className = 'eval-step-item active';
          s3.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 3. Natijalar va ballar hisoblanmoqda...`;
        }
      }, 3500);
    }

    this.isSubmitting = true;
    try {
      const res = await Api.submissions.submitAnswer(formData);

      // Local qoralamani tozalash
      localStorage.removeItem('unitask_draft_' + assignmentId);

      setTimeout(() => {
        AppUI.showToast('success', 'Muvaffaqiyatli!', res.message || 'Ish topshirildi.');
        StudentView.showResultModal(res.submission.id);
        StudentView.loadData();
      }, 1000);

    } catch (err) {
      AppUI.showToast('danger', 'Xatolik yuz berdi', err.message);
      AppUI.closeModal();
      this.loadData();
    } finally {
      this.isSubmitting = false;
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
                          ${isCorrect ? `To'g'ri (${ans.ai_score || qMax} / ${qMax} ball)` : `Noto'g'ri (0 / ${qMax} ball)`}
                        </span>
                      ` : `
                        <span class="badge badge-reviewed">
                          <i class="fas fa-robot"></i> AI ball: ${ans.ai_score !== null ? `${ans.ai_score} / ${qMax} ball` : 'Kutilmoqda'}
                        </span>
                      `}
                    </div>
                  </div>

                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; line-height: 1.4;">
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
                          <i class="fas fa-brain"></i> AI Semantik Tahlili
                        </div>
                        <div style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">
                          Tavsiya: ${ans.ai_score !== null ? `${ans.ai_score} / ${qMax} ball` : 'Kutilmoqda'}
                        </div>
                      </div>

                      <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-main); margin-bottom: 0.4rem;">
                        <strong>Xulosa:</strong> ${aiFb.summary || "Tahlil ma'lumotlari kutilmoqda."}
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
                          <i class="fas fa-arrow-right"></i> <strong>Tavsiya:</strong> ${aiFb.suggestions}
                        </div>
                      ` : ''}

                      ${aiFb.identified_concepts && aiFb.identified_concepts.length > 0 ? `
                        <div style="margin-top: 0.35rem; display: flex; gap: 0.3rem; flex-wrap: wrap; align-items: center;">
                          <span style="font-size: 0.725rem; color: #166534; font-weight: 600;">O'zlashtirilgan atamalar:</span>
                          ${aiFb.identified_concepts.map(c => `<span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.7rem; padding: 0.15rem 0.4rem;">${c}</span>`).join('')}
                        </div>
                      ` : ''}
                    </div>

                    ${ans.teacher_score !== null ? `
                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: #166534; margin-top: 0.5rem;">
                        <strong>O'qituvchi qo'ygan baho:</strong> ${ans.teacher_score} / ${qMax} ball
                        ${ans.teacher_feedback ? ` &bull; <em>"${ans.teacher_feedback}"</em>` : ''}
                      </div>
                    ` : ''}
                  `}

                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        answersBreakdownHtml = `
          <div class="ai-report-card">
            <div class="ai-header">
              <div class="ai-brand-badge">
                <i class="fas fa-brain"></i> AI Baholash Tahlili
              </div>
              <div class="ai-score-pill">
                <span class="score-number">${s.recommended_score !== null ? s.recommended_score : '-'}</span>
                <span class="score-max">/ 100 ball</span>
              </div>
            </div>

            <div class="ai-section">
              <div class="ai-section-title summary"><i class="fas fa-check-circle"></i> Xulosa</div>
              <div class="ai-section-content">${s.ai_summary || "Tahlil natijasi kutilmoqda."}</div>
            </div>

            <div class="ai-section">
              <div class="ai-section-title gaps"><i class="fas fa-lightbulb"></i> Kamchiliklar</div>
              <div class="ai-section-content" style="color: #92400e;">${s.ai_gaps || "Jiddiy kamchiliklar aniqlanmadi."}</div>
            </div>
          </div>

          <div>
            <label class="form-label"><i class="fas fa-comment-alt"></i> Siz Topshirgan Javob Matni:</label>
            <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; font-size: 0.875rem; line-height: 1.6; max-height: 140px; overflow-y: auto;">
              ${s.student_answer || '<em style="color: var(--text-muted);">(Matn kiritilmagan)</em>'}
            </div>
          </div>
        `;
      }

      const scoreDisplay = s.total_score !== null 
        ? `${s.total_score} / ${maxPts} ball`
        : (s.recommended_score !== null ? `${s.recommended_score} ball (AI tavsiya)` : 'Hisoblanmoqda');

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Banner -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main);">${s.assignment_title}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; margin-top: 0.15rem;">
                <span><i class="fas fa-user-tie"></i> O'qituvchi: ${s.teacher_name}</span> &bull;
                <span>Topshirildi: ${AppUI.formatDate(s.submitted_at)}</span>
                ${s.attempt_number ? `<span class="badge" style="background: white; border: 1px solid var(--border);">Urinish #${s.attempt_number}</span>` : ''}
              </div>
            </div>

            <div>
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          <!-- Talaba yuklagan mustaqil ish fayli (agar mavjud bo'lsa) -->
          ${s.file_name ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-file-alt text-success fa-lg"></i>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem; color: #166534;">Siz yuklagan hujjat: ${s.file_name}</div>
                  <div style="font-size: 0.75rem; color: #15803d;">${s.file_size ? `${(s.file_size / 1024).toFixed(1)} KB` : ''}</div>
                </div>
              </div>
              <button type="button" class="btn btn-success btn-sm" onclick="Api.submissions.downloadFile(${s.id}, '${(s.file_name || 'fayl').replace(/'/g, "\\'")}')">
                <i class="fas fa-download"></i> Faylni yuklab olish
              </button>
            </div>
          ` : ''}

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
                <div style="font-weight: 700; color: #92400e; font-size: 0.9rem;"><i class="fas fa-robot"></i> AI Tavsiya Bali Hisoblandi</div>
                <div style="font-size: 0.8rem; color: #b45309;">O'qituvchi tekshirib tasdiqlagach yakuniy rasmiy baho chiqadi.</div>
              </div>
              <div style="font-weight: 800; color: var(--primary); font-size: 1.25rem;">
                ${scoreDisplay}
              </div>
            </div>
          `}

          ${s.ai_report ? `
            <div class="card" style="border: 1px solid #c7d2fe; background: #f8faff;">
              <div class="card-header" style="background: #eef2ff; border-bottom: 1px solid #e0e7ff; padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="ai-brand-badge" style="font-size: 0.75rem;"><i class="fas fa-brain"></i> AI Tahlili</span>
                  <span class="badge" style="background: white; border: 1px solid #c7d2fe; color: var(--primary); font-weight: 700;">
                    Bilim darajangiz: ${s.ai_report.mastery_level || 'Aniqlanmoqda'}
                  </span>
                </div>
                <div style="font-size: 0.8rem; font-weight: 700; color: #3730a3;">
                  Umumiy o'zlashtirish: ${s.ai_report.score_percent || 0}%
                </div>
              </div>

              <div class="card-body" style="padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="font-size: 0.875rem; color: var(--text-main); line-height: 1.5;">
                  ${s.ai_report.summary || s.ai_summary || "Topshiriq tahlil qilingan."}
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem;">
                  ${s.ai_report.well_understood_concepts && s.ai_report.well_understood_concepts.length > 0 ? `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 0.65rem 0.85rem;">
                      <div style="font-size: 0.775rem; font-weight: 700; color: #166534; margin-bottom: 0.3rem;">
                        <i class="fas fa-check-circle"></i> Yaxshi o'zlashtirilgan jihatlar:
                      </div>
                      <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.775rem; color: #15803d; line-height: 1.4;">
                        ${s.ai_report.well_understood_concepts.map(c => `<li>${c}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}

                  ${s.ai_report.missing_concepts && s.ai_report.missing_concepts.length > 0 ? `
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); padding: 0.65rem 0.85rem;">
                      <div style="font-size: 0.775rem; font-weight: 700; color: #92400e; margin-bottom: 0.3rem;">
                        <i class="fas fa-exclamation-circle"></i> O'rganilishi kerak bo'lgan tushunchalar:
                      </div>
                      <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.775rem; color: #b45309; line-height: 1.4;">
                        ${s.ai_report.missing_concepts.map(c => `<li>${c}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
                </div>

                ${s.ai_report.recommendations && s.ai_report.recommendations.length > 0 ? `
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); padding: 0.65rem 0.85rem;">
                    <div style="font-size: 0.775rem; font-weight: 700; color: #1e40af; margin-bottom: 0.3rem;">
                      <i class="fas fa-lightbulb"></i> Siz uchun tavsiyalar:
                    </div>
                    <ul style="margin: 0; padding-left: 1.1rem; font-size: 0.775rem; color: #1d4ed8; line-height: 1.4;">
                      ${s.ai_report.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

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
