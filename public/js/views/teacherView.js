/**
 * UniTask AI - O'qituvchi Boshqaruv Paneli (Teacher View)
 * Zamonaviy, soddalashtirilgan ish stoli va 4 bosqichli test/topshiriq konstruktori.
 */

const TeacherView = {
  assignments: [],
  selectedAssignmentId: null,
  activeSubmissions: [],
  cachedGroups: [],
  submissionFilter: 'all', // 'all', 'pending', 'graded'

  // Dashboard filtrlari
  filters: {
    search: '',
    subject: '',
    groupId: '',
    status: '', // '', 'active', 'expired'
    type: ''    // '', 'dynamic', 'traditional'
  },

  // Bosqichli topshiriq yaratish holati (Wizard)
  wizard: {
    currentStep: 1, // 1: Topshiriq ma'lumotlari, 2: Test tuzish, 3: Tekshirish va yaratish
    editingAssignmentId: null,
    basicInfo: {
      title: '',
      group_id: '',
      start_date: '',
      due_date: '',
      attempts_limit: 1
    },
    attachedFile: null,
    existingFileName: null,
    existingFilePath: null,
    existingFileSize: null,
    questions: []
  },

  async render() {
    return `
      <div style="margin-bottom: 2rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em; margin: 0;">
              <i class="fas fa-chalkboard-teacher text-primary"></i> O'qituvchi Ish Stoli
            </h1>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem; margin-bottom: 0;">
              Mustaqil ta'lim topshiriqlari, testlar yaratish, talabalar javoblarini ko'rish hamda AI yordamida baholash.
            </p>
          </div>
          <button class="btn btn-primary" onclick="TeacherView.openCreateWizard()">
            <i class="fas fa-plus"></i> Topshiriq yaratish
          </button>
        </div>

        <div id="teacher-content-container">
          <div style="text-align: center; padding: 4rem;">
            <i class="fas fa-spinner fa-spin fa-2x text-primary"></i>
            <div style="margin-top: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">Ma'lumotlar yuklanmoqda...</div>
          </div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    await this.loadInitialData();
  },

  async loadInitialData() {
    try {
      const [assignRes, groupsRes] = await Promise.all([
        Api.assignments.getAll(),
        Api.groups.getAll()
      ]);

      this.assignments = assignRes.assignments || [];
      this.cachedGroups = groupsRes.groups || [];

      if (!this.selectedAssignmentId && this.assignments.length > 0) {
        this.selectedAssignmentId = this.assignments[0].id;
      }

      this.renderDashboard();
    } catch (e) {
      const container = document.getElementById('teacher-content-container');
      if (container) {
        container.innerHTML = `
          <div class="empty-state card">
            <i class="fas fa-exclamation-triangle empty-state-icon text-danger"></i>
            <div class="empty-state-title">Ma'lumotlarni yuklab bo'lmadi</div>
            <div class="empty-state-desc">${e.message}</div>
            <button class="btn btn-primary" onclick="TeacherView.loadInitialData()">
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
    let active = 0;
    let totalSubmissions = 0;
    let pendingReview = 0;
    let endingSoon = 0;

    this.assignments.forEach(a => {
      totalSubmissions += (a.total_submissions || 0);
      pendingReview += (a.pending_review_count || 0);

      const isExpired = a.due_date && new Date(a.due_date) < now;
      if (!isExpired) {
        active++;
      }

      if (a.due_date) {
        const dueDate = new Date(a.due_date);
        if (dueDate >= now && dueDate <= in3Days) {
          endingSoon++;
        }
      }
    });

    return { total, active, totalSubmissions, pendingReview, endingSoon };
  },

  // Filtrlar bo'yicha saralangan topshiriqlar
  getFilteredAssignments() {
    const { search, subject, groupId, status, type } = this.filters;
    const now = new Date();

    return this.assignments.filter(a => {
      // Qidiruv
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const matchTitle = (a.title || '').toLowerCase().includes(term);
        const matchSub = (a.subject || '').toLowerCase().includes(term);
        const matchGrp = (a.group_name || '').toLowerCase().includes(term);
        if (!matchTitle && !matchSub && !matchGrp) return false;
      }

      // Fan
      if (subject && (a.subject || '').toLowerCase() !== subject.toLowerCase()) {
        return false;
      }

      // Guruh
      if (groupId && String(a.group_id) !== String(groupId)) {
        return false;
      }

      // Holat
      if (status === 'active') {
        if (a.due_date && new Date(a.due_date) < now) return false;
      } else if (status === 'expired') {
        if (!a.due_date || new Date(a.due_date) >= now) return false;
      }

      // Turi
      if (type === 'dynamic') {
        if (!a.has_dynamic_questions && (!a.question_count || a.question_count === 0)) return false;
      } else if (type === 'traditional') {
        if (a.has_dynamic_questions || (a.question_count && a.question_count > 0)) return false;
      }

      return true;
    });
  },

  renderDashboard() {
    const container = document.getElementById('teacher-content-container');
    if (!container) return;

    if (this.assignments.length === 0) {
      container.innerHTML = `
        <div class="empty-state card" style="padding: 3.5rem 1.5rem;">
          <i class="fas fa-folder-open empty-state-icon text-primary" style="font-size: 3rem; margin-bottom: 1rem;"></i>
          <div class="empty-state-title" style="font-size: 1.25rem;">Hozircha topshiriqlar mavjud emas</div>
          <div class="empty-state-desc" style="max-width: 480px; margin: 0.5rem auto 1.5rem auto;">
            Talabalarga mustaqil ta'lim topshirig'i yoki interaktiv test berish uchun birinchi topshiriqni oching.
          </div>
          <button class="btn btn-primary" onclick="TeacherView.openCreateWizard()">
            <i class="fas fa-plus"></i> Topshiriq yaratish
          </button>
        </div>
      `;
      return;
    }

    const stats = this.computeStats();
    const filtered = this.getFilteredAssignments();

    // Dinamik fanlar ro'yxati
    const subjects = Array.from(new Set(this.assignments.map(a => a.subject).filter(Boolean)));

    // Tanlangan topshiriq mavjudligini tekshirish
    if (this.selectedAssignmentId) {
      const exists = filtered.some(a => a.id === this.selectedAssignmentId);
      if (!exists && filtered.length > 0) {
        this.selectedAssignmentId = filtered[0].id;
      }
    } else if (filtered.length > 0) {
      this.selectedAssignmentId = filtered[0].id;
    }

    // Topshiriqlar ro'yxati HTML
    let assignmentsListHtml = '';
    if (filtered.length === 0) {
      assignmentsListHtml = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <i class="fas fa-search empty-state-icon" style="font-size: 2rem;"></i>
          <div class="empty-state-title" style="font-size: 0.95rem;">Topshiriq topilmadi</div>
          <div class="empty-state-desc" style="font-size: 0.8rem;">Tanlangan filtrlar bo'yicha hech qanday topshiriq mos kelmadi.</div>
          <button class="btn btn-outline btn-sm" style="margin-top: 0.75rem;" onclick="TeacherView.resetFilters()">
            <i class="fas fa-undo"></i> Filtrlarni tozalash
          </button>
        </div>
      `;
    } else {
      assignmentsListHtml = filtered.map(a => {
        const isSelected = a.id === this.selectedAssignmentId;
        const now = new Date();
        const isExpired = a.due_date && new Date(a.due_date) < now;
        const qCount = a.question_count || 0;
        const closedCount = a.closed_count || 0;
        const openCount = a.open_count || 0;

        return `
          <div class="card assignment-card-item ${isSelected ? 'selected' : ''}" 
               onclick="TeacherView.selectAssignment(${a.id})">
            <div class="card-body" style="padding: 1rem 1.15rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
                <h4 style="font-size: 0.95rem; font-weight: 700; color: ${isSelected ? 'var(--primary)' : 'var(--text-main)'}; line-height: 1.35; margin: 0;">
                  ${a.title}
                </h4>
                ${isExpired 
                  ? '<span class="badge" style="background: #fee2e2; color: #991b1b; font-size: 0.7rem; flex-shrink: 0;">Muddati o\'tgan</span>' 
                  : '<span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.7rem; flex-shrink: 0;">Faol</span>'}
              </div>

              <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 0.6rem;">
                ${a.subject ? `<span style="font-weight: 600; color: var(--primary);"><i class="fas fa-book"></i> ${a.subject} &bull; </span>` : ''}
                <i class="fas fa-users"></i> ${a.group_name} &bull; ${AppUI.formatDate(a.created_at)}
              </div>

              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                ${a.has_dynamic_questions ? `
                  <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.725rem;">
                    <i class="fas fa-layer-group"></i> ${qCount} ta savol (${closedCount} test, ${openCount} ochiq)
                  </span>
                  <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.725rem;">
                    <i class="fas fa-star"></i> ${a.total_points || 100} ball
                  </span>
                ` : `
                  <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-size: 0.725rem;">
                    <i class="fas fa-pen-alt"></i> Matnli topshiriq (100 ball)
                  </span>
                `}

                ${a.time_limit_minutes ? `
                  <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.725rem;">
                    <i class="fas fa-stopwatch"></i> ${a.time_limit_minutes} daq
                  </span>
                ` : ''}

                ${a.attempts_limit > 1 ? `
                  <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.725rem;">
                    <i class="fas fa-redo"></i> ${a.attempts_limit} urinish
                  </span>
                ` : ''}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.775rem; border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.25rem;">
                <span style="color: var(--text-muted); font-weight: 600;">
                  <i class="fas fa-inbox"></i> ${a.total_submissions || 0} ta topshirilgan
                </span>
                ${a.pending_review_count > 0 ? `
                  <span class="badge badge-reviewed" style="font-size: 0.725rem;">
                    <i class="fas fa-bell"></i> ${a.pending_review_count} ta tekshirish kutilmoqda
                  </span>
                ` : `
                  <span style="color: var(--text-light); font-size: 0.75rem;">
                    ${a.graded_count || 0} ta baholangan
                  </span>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    container.innerHTML = `
      <!-- 5-Stats Cards -->
      <div class="teacher-stats-grid">
        <div class="teacher-stat-card">
          <div class="teacher-stat-icon" style="background: #e0e7ff; color: #4338ca;">
            <i class="fas fa-folder"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value">${stats.total}</div>
            <div class="teacher-stat-label">Jami topshiriqlar</div>
          </div>
        </div>

        <div class="teacher-stat-card">
          <div class="teacher-stat-icon" style="background: #dcfce7; color: #166534;">
            <i class="fas fa-bolt"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value">${stats.active}</div>
            <div class="teacher-stat-label">Faol topshiriqlar</div>
          </div>
        </div>

        <div class="teacher-stat-card">
          <div class="teacher-stat-icon" style="background: #e0f2fe; color: #0369a1;">
            <i class="fas fa-clipboard-check"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value">${stats.totalSubmissions}</div>
            <div class="teacher-stat-label">Topshirilgan ishlar</div>
          </div>
        </div>

        <div class="teacher-stat-card">
          <div class="teacher-stat-icon" style="background: #fef3c7; color: #92400e;">
            <i class="fas fa-clock"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value" style="color: ${stats.pendingReview > 0 ? '#b45309' : 'inherit'};">${stats.pendingReview}</div>
            <div class="teacher-stat-label">Tekshirish kutilmoqda</div>
          </div>
        </div>

        <div class="teacher-stat-card">
          <div class="teacher-stat-icon" style="background: #fce7f3; color: #be185d;">
            <i class="fas fa-hourglass-half"></i>
          </div>
          <div class="teacher-stat-info">
            <div class="teacher-stat-value">${stats.endingSoon}</div>
            <div class="teacher-stat-label">Yaqin muddatda tugaydigan</div>
          </div>
        </div>
      </div>

      <!-- Toolbar & Filters -->
      <div class="teacher-toolbar">
        <div class="teacher-search-box">
          <i class="fas fa-search"></i>
          <input 
            type="text" 
            class="form-control" 
            placeholder="Topshiriq nomi yoki fan bo'yicha qidiruv..." 
            value="${this.filters.search}" 
            oninput="TeacherView.handleFilterChange('search', this.value)" 
          />
        </div>

        <div class="teacher-filters">
          <!-- Fan filtri -->
          <select class="form-select" style="width: auto; min-width: 140px; font-size: 0.85rem;" onchange="TeacherView.handleFilterChange('subject', this.value)">
            <option value="">Barcha fanlar (${subjects.length})</option>
            ${subjects.map(s => `<option value="${s}" ${this.filters.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>

          <!-- Guruh filtri -->
          <select class="form-select" style="width: auto; min-width: 140px; font-size: 0.85rem;" onchange="TeacherView.handleFilterChange('groupId', this.value)">
            <option value="">Barcha guruhlar</option>
            ${this.cachedGroups.map(g => `<option value="${g.id}" ${String(this.filters.groupId) === String(g.id) ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>

          <!-- Holat filtri -->
          <select class="form-select" style="width: auto; min-width: 130px; font-size: 0.85rem;" onchange="TeacherView.handleFilterChange('status', this.value)">
            <option value="">Barcha holatlar</option>
            <option value="active" ${this.filters.status === 'active' ? 'selected' : ''}>Faol topshiriqlar</option>
            <option value="expired" ${this.filters.status === 'expired' ? 'selected' : ''}>Muddati tugagan</option>
          </select>

          <!-- Topshiriq turi filtri -->
          <select class="form-select" style="width: auto; min-width: 130px; font-size: 0.85rem;" onchange="TeacherView.handleFilterChange('type', this.value)">
            <option value="">Barcha turlar</option>
            <option value="dynamic" ${this.filters.type === 'dynamic' ? 'selected' : ''}>Dinamik testlar</option>
            <option value="traditional" ${this.filters.type === 'traditional' ? 'selected' : ''}>Matnli topshiriq</option>
          </select>

          ${this.hasActiveFilters() ? `
            <button class="btn btn-secondary btn-sm" onclick="TeacherView.resetFilters()" title="Filtrlarni tozalash">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Main Two-Column Layout -->
      <div style="display: grid; grid-template-columns: 380px 1fr; gap: 1.5rem; align-items: start;">
        <!-- Chap ustun: Topshiriqlar ro'yxati -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin: 0;">
              Topshiriqlar (${filtered.length}${filtered.length !== this.assignments.length ? ` / ${this.assignments.length}` : ''})
            </h3>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              Tanlash uchun bosing
            </span>
          </div>
          <div style="max-height: calc(100vh - 360px); overflow-y: auto; padding-right: 4px;">
            ${assignmentsListHtml}
          </div>
        </div>

        <!-- O'ng ustun: Tanlangan topshiriq tafsilotlari va javoblar -->
        <div id="assignment-details-panel">
          <div style="text-align: center; padding: 3rem;">
            <i class="fas fa-spinner fa-spin fa-2x text-primary"></i>
          </div>
        </div>
      </div>
    `;

    if (this.selectedAssignmentId) {
      this.loadAssignmentDetails(this.selectedAssignmentId);
    } else {
      const panel = document.getElementById('assignment-details-panel');
      if (panel) {
        panel.innerHTML = `
          <div class="empty-state card" style="padding: 3rem 1.5rem;">
            <i class="fas fa-mouse-pointer empty-state-icon text-primary"></i>
            <div class="empty-state-title">Topshiriqni tanlang</div>
            <div class="empty-state-desc">Chap ustundagi ro'yxatdan topshiriqni tanlang yoki yangisini yarating.</div>
          </div>
        `;
      }
    }
  },

  hasActiveFilters() {
    return Boolean(
      this.filters.search ||
      this.filters.subject ||
      this.filters.groupId ||
      this.filters.status ||
      this.filters.type
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
      groupId: '',
      status: '',
      type: ''
    };
    this.renderDashboard();
  },

  async selectAssignment(id) {
    this.selectedAssignmentId = id;
    this.renderDashboard();
  },

  async loadAssignmentDetails(assignmentId) {
    const detailsPanel = document.getElementById('assignment-details-panel');
    if (!detailsPanel) return;

    try {
      const [res, assignRes] = await Promise.all([
        Api.submissions.getByAssignment(assignmentId),
        Api.assignments.getById(assignmentId)
      ]);

      const assignment = res.assignment;
      const submissions = res.submissions || [];
      this.activeSubmissions = submissions;

      const detailedAssignment = assignRes.assignment;
      const questions = detailedAssignment.questions || [];

      // Submissions filter
      let filteredSubmissions = submissions;
      if (this.submissionFilter === 'pending') {
        filteredSubmissions = submissions.filter(s => s.status === 'reviewed' || s.status === 'submitted');
      } else if (this.submissionFilter === 'graded') {
        filteredSubmissions = submissions.filter(s => s.status === 'graded');
      }

      const pendingCount = submissions.filter(s => s.status === 'reviewed' || s.status === 'submitted').length;
      const gradedCount = submissions.filter(s => s.status === 'graded').length;

      let submissionsHtml = '';
      if (filteredSubmissions.length === 0) {
        submissionsHtml = `
          <div class="empty-state" style="padding: 2.5rem 1rem;">
            <i class="fas fa-inbox empty-state-icon" style="font-size: 2.5rem;"></i>
            <div class="empty-state-title" style="font-size: 1rem;">Javoblar mavjud emas</div>
            <div class="empty-state-desc" style="font-size: 0.85rem;">
              ${this.submissionFilter === 'all' 
                ? "Ushbu topshiriq bo'yicha talabalardan hali javob kelib tushmadi." 
                : "Tanlangan toifada talabalar ishlari topilmadi."}
            </div>
          </div>
        `;
      } else {
        const rows = filteredSubmissions.map(s => {
          const scoreDisplay = s.total_score !== null 
            ? `${s.total_score} / ${s.max_score || assignment.total_points || 100} ball`
            : (s.recommended_score !== null ? `${s.recommended_score} ball (AI)` : 'Hisoblanmoqda');

          const teacherScoreDisplay = s.teacher_score !== null
            ? `<strong style="color: var(--success); font-size: 1.05rem;">${s.teacher_score} ball</strong>`
            : '<span style="color: var(--text-light); font-size: 0.85rem;">Tasdiqlanmagan</span>';

          const attemptBadge = s.attempt_number 
            ? `<span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.75rem;">#${s.attempt_number}-urinish</span>`
            : '';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">${s.student_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem;">
                  <span>${s.student_email}</span>
                  ${attemptBadge}
                </div>
              </td>
              <td style="font-size: 0.825rem; color: var(--text-muted);">
                ${AppUI.formatDate(s.submitted_at)}
              </td>
              <td>
                ${s.file_name ? `
                  <button type="button" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="event.stopPropagation(); Api.submissions.downloadFile(${s.id}, '${(s.file_name || 'fayl').replace(/'/g, "\\'")}')">
                    <i class="fas fa-file-download text-primary"></i> ${s.file_name.length > 18 ? s.file_name.substring(0, 15) + '...' : s.file_name}
                  </button>
                ` : '<span style="color: var(--text-light); font-size: 0.8rem;">-</span>'}
              </td>
              <td>
                <span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.8rem; padding: 0.3rem 0.55rem;">
                  <i class="fas fa-robot"></i> ${scoreDisplay}
                </span>
              </td>
              <td>${teacherScoreDisplay}</td>
              <td>${AppUI.getStatusBadge(s.status)}</td>
              <td style="text-align: right;">
                <button class="btn btn-primary btn-sm" onclick="TeacherView.showGradeModal(${s.id})">
                  <i class="fas fa-award"></i> Baholash
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
                  <th>Yuklangan Fayl</th>
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
          <div style="margin-top: 1.25rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h5 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">
                <i class="fas fa-list-ol text-primary"></i> Savollar (${questions.length} ta &bull; Jami ${detailedAssignment.total_points || 100} ball)
              </h5>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="TeacherView.toggleQuestionsDetails()">
                <span id="toggle-q-label"><i class="fas fa-chevron-down"></i> Barchasini ko'rsatish</span>
              </button>
            </div>
            
            <div id="questions-details-container" style="display: none; flex-direction: column; gap: 0.65rem; max-height: 320px; overflow-y: auto; padding-right: 4px;">
              ${questions.map((q, idx) => `
                <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-left: 3px solid ${q.question_type === 'closed' ? '#6366f1' : '#0ea5e9'};">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
                    <span style="font-weight: 700; color: var(--text-main);">
                      #${idx + 1} ${q.question_type === 'closed' ? '<span style="color: #6366f1;">[Yopiq test]</span>' : '<span style="color: #0ea5e9;">[Ochiq savol]</span>'}
                    </span>
                    <span class="badge" style="background: white; color: var(--text-main); font-weight: 700;">${q.points} ball</span>
                  </div>
                  <div style="font-size: 0.875rem; color: var(--text-main); line-height: 1.4;">${q.question_text}</div>
                  ${q.question_type === 'closed' && q.options ? `
                    <div style="margin-top: 0.45rem; display: flex; flex-wrap: wrap; gap: 0.4rem; font-size: 0.775rem;">
                      ${q.options.map(opt => `
                        <span style="padding: 0.2rem 0.55rem; border-radius: var(--radius-sm); background: ${opt.is_correct ? '#dcfce7' : 'white'}; color: ${opt.is_correct ? '#166534' : 'var(--text-muted)'}; border: 1px solid ${opt.is_correct ? '#86efac' : 'var(--border)'}; font-weight: ${opt.is_correct ? '700' : 'normal'};">
                          <strong>${opt.option_key}:</strong> ${opt.option_text} ${opt.is_correct ? '<i class="fas fa-check-circle" style="margin-left: 0.25rem;"></i>' : ''}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}
                  ${q.sample_answer ? `
                    <div style="margin-top: 0.45rem; font-size: 0.775rem; color: #92400e; background: #fffdf5; padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); border: 1px dashed #fde68a;">
                      <strong>Namunaviy mezon:</strong> ${q.sample_answer}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Nazariy material bloki
      let theoryBlockHtml = '';
      if (assignment.content && assignment.content.trim().length > 0 && assignment.content !== "Mavzu bo'yicha mustaqil topshiriq materiallari.") {
        theoryBlockHtml = `
          <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.85rem;">
            <details style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem;">
              <summary style="cursor: pointer; font-weight: 700; color: var(--text-main);">
                <i class="fas fa-book-open text-primary"></i> Nazariy materialni o'qish (${assignment.content.length} ta belgi)
              </summary>
              <div style="margin-top: 0.65rem; white-space: pre-wrap; line-height: 1.6; color: var(--text-main); max-height: 200px; overflow-y: auto; padding-right: 4px;">
                ${assignment.content}
              </div>
            </details>
          </div>
        `;
      }

      detailsPanel.innerHTML = `
        <!-- Assignment Info Card -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header" style="padding: 1.25rem 1.5rem;">
            <div>
              <div class="card-title" style="font-size: 1.25rem;">${assignment.title}</div>
              <div class="card-subtitle" style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.35rem; align-items: center;">
                ${assignment.subject ? `<span><strong style="color: var(--primary);"><i class="fas fa-book"></i> ${assignment.subject}</strong></span> &bull;` : ''}
                <span><i class="fas fa-users"></i> ${assignment.group_name}</span> &bull;
                ${assignment.start_date ? `<span><i class="fas fa-calendar-check"></i> Boshlanish: ${AppUI.formatDate(assignment.start_date)}</span> &bull;` : ''}
                ${assignment.due_date ? `<span><i class="fas fa-calendar-times"></i> Tugash: ${AppUI.formatDate(assignment.due_date)}</span>` : '<span>Cheklanmagan muddat</span>'}
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

          <div class="card-body" style="padding: 1.25rem 1.5rem;">
            <!-- Limitlar & Ko'rsatmalar paneli -->
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
              <span class="badge" style="background: #eef2ff; color: #4338ca; font-size: 0.8rem; padding: 0.35rem 0.65rem;">
                <i class="fas fa-redo"></i> Urinishlar limiti: <strong>${assignment.attempts_limit || 1} marta</strong>
              </span>

              <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.8rem; padding: 0.35rem 0.65rem;">
                <i class="fas fa-stopwatch"></i> Ajratilgan vaqt: <strong>${assignment.time_limit_minutes ? `${assignment.time_limit_minutes} daqiqa` : 'Cheklanmagan'}</strong>
              </span>

              <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.8rem; padding: 0.35rem 0.65rem;">
                <i class="fas fa-star"></i> Maksimal baho: <strong>${assignment.total_points || 100} ball</strong>
              </span>
            </div>

            ${assignment.instructions ? `
              <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 0.85rem; font-size: 0.875rem; color: #15803d; line-height: 1.5;">
                <strong><i class="fas fa-info-circle"></i> Yo'riqnoma / Tavsif:</strong> ${assignment.instructions}
              </div>
            ` : ''}

            ${assignment.file_path ? `
              <div style="margin-top: 0.85rem;">
                <a href="${assignment.file_path}" target="_blank" download class="btn btn-outline btn-sm" style="font-size: 0.8rem;">
                  <i class="fas fa-paperclip text-primary"></i> Biriktirilgan manba hujjati: ${assignment.file_name || 'Hujjat'} ${assignment.file_size ? `(${(assignment.file_size / 1024).toFixed(1)} KB)` : ''}
                </a>
              </div>
            ` : ''}

            ${theoryBlockHtml}
            ${questionsPreviewHtml}
          </div>
        </div>

        <!-- Submissions Table Card -->
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div class="card-title" style="font-size: 1rem;">
              <i class="fas fa-clipboard-check text-primary"></i> Kelib Tushgan Javoblar (${submissions.length})
            </div>

            <!-- Submissions Filter Tabs -->
            <div style="display: flex; gap: 0.35rem;">
              <button 
                class="btn btn-sm ${this.submissionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="TeacherView.setSubmissionsFilter('all')">
                Barchasi (${submissions.length})
              </button>
              <button 
                class="btn btn-sm ${this.submissionFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="TeacherView.setSubmissionsFilter('pending')">
                Kutilmoqda (${pendingCount})
              </button>
              <button 
                class="btn btn-sm ${this.submissionFilter === 'graded' ? 'btn-primary' : 'btn-secondary'}" 
                onclick="TeacherView.setSubmissionsFilter('graded')">
                Baholangan (${gradedCount})
              </button>
            </div>
          </div>

          ${submissionsHtml}
        </div>
      `;

    } catch (e) {
      detailsPanel.innerHTML = `<div class="empty-state"><p>Xatolik: ${e.message}</p></div>`;
    }
  },

  setSubmissionsFilter(filter) {
    this.submissionFilter = filter;
    if (this.selectedAssignmentId) {
      this.loadAssignmentDetails(this.selectedAssignmentId);
    }
  },

  toggleQuestionsDetails() {
    const el = document.getElementById('questions-details-container');
    const label = document.getElementById('toggle-q-label');
    if (!el || !label) return;

    if (el.style.display === 'none') {
      el.style.display = 'flex';
      label.innerHTML = '<i class="fas fa-chevron-up"></i> Yig\'ish';
    } else {
      el.style.display = 'none';
      label.innerHTML = '<i class="fas fa-chevron-down"></i> Barchasini ko\'rsatish';
    }
  },

  // =========================================================================
  // 3 BOSQICHLI TEST VA TOPSHIRIQ KONSTRUKTORI (Unified 3-Step Wizard)
  // =========================================================================

  async openCreateWizard() {
    this.wizard = {
      currentStep: 1,
      editingAssignmentId: null,
      basicInfo: {
        title: '',
        group_id: '',
        start_date: '',
        due_date: '',
        attempts_limit: 1
      },
      attachedFile: null,
      existingFileName: null,
      existingFilePath: null,
      existingFileSize: null,
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
          ],
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
          { option_key: 'B', option_text: '', is_correct: 0 },
          { option_key: 'C', option_text: '', is_correct: 0 },
          { option_key: 'D', option_text: '', is_correct: 0 }
        ],
        sample_answer: q.sample_answer || '',
        instruction: q.instruction || ''
      }));

      if (questions.length === 0) {
        questions.push({
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
          ],
          sample_answer: '',
          instruction: ''
        });
      }

      this.wizard = {
        currentStep: 1,
        editingAssignmentId: a.id,
        basicInfo: {
          title: a.title || '',
          group_id: a.group_id || '',
          start_date: a.start_date ? a.start_date.substring(0, 16) : '',
          due_date: a.due_date ? a.due_date.substring(0, 16) : '',
          attempts_limit: a.attempts_limit || 1
        },
        attachedFile: null,
        existingFileName: a.file_name || null,
        existingFilePath: a.file_path || null,
        existingFileSize: a.file_size || null,
        questions: questions
      };

      await this.renderWizardModal();
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', "Topshiriqni tahrirlash uchun yuklab bo'lmadi: " + e.message);
    }
  },

  async renderWizardModal() {
    if (this.cachedGroups.length === 0) {
      const groupsRes = await Api.groups.getAll();
      this.cachedGroups = groupsRes.groups || [];
    }

    const isEdit = !!this.wizard.editingAssignmentId;
    const titleText = isEdit 
      ? '<i class="fas fa-edit text-primary"></i> Topshiriqni tahrirlash' 
      : '<i class="fas fa-plus-circle text-primary"></i> Yangi topshiriq';

    const modalHtml = `
      <div id="wizard-container" class="wizard-container" style="display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%;">
        <!-- 3 Bosqichli Yagona Stepper -->
        <div class="wizard-stepper">
          <div class="wizard-step-item ${this.wizard.currentStep === 1 ? 'active' : ''} ${this.wizard.currentStep > 1 ? 'completed' : ''}" onclick="TeacherView.goToStep(1)">
            <div class="wizard-step-num">${this.wizard.currentStep > 1 ? '<i class="fas fa-check"></i>' : '1'}</div>
            <div class="wizard-step-title">1-bosqich: Topshiriq ma'lumotlari</div>
          </div>
          <div class="wizard-step-item ${this.wizard.currentStep === 2 ? 'active' : ''} ${this.wizard.currentStep > 2 ? 'completed' : ''}" onclick="TeacherView.goToStep(2)">
            <div class="wizard-step-num">${this.wizard.currentStep > 2 ? '<i class="fas fa-check"></i>' : '2'}</div>
            <div class="wizard-step-title">2-bosqich: Test tuzish</div>
            <span class="wizard-step-badge" id="step2-badge">${this.wizard.questions.length} ta (${this.calcTotalPoints()} b)</span>
          </div>
          <div class="wizard-step-item ${this.wizard.currentStep === 3 ? 'active' : ''}" onclick="TeacherView.goToStep(3)">
            <div class="wizard-step-num">3</div>
            <div class="wizard-step-title">3-bosqich: Tekshirish va yaratish</div>
          </div>
        </div>

        <!-- Bosqichlar Kontenti (Scrollable Center Area) -->
        <div id="wizard-pane-content" class="wizard-pane-content" style="flex: 1; min-height: 0; overflow-y: auto; padding-right: 0.35rem;">
          <!-- Dinamik ravishda joriy bosqich chiziladi -->
        </div>

        <!-- Pastki harakat tugmalari paneli (Fixed / Pinned Bottom Actions) -->
        <div id="wizard-actions-bar" class="wizard-actions-bar" style="flex-shrink: 0; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: white; margin-top: auto;">
          <!-- Dinamik ravishda joriy bosqich tugmalari chiziladi -->
        </div>
      </div>
    `;

    AppUI.openModal(titleText, modalHtml, '', 'modal-xl');
    this.renderCurrentStepPane();
  },

  renderCurrentStepPane() {
    const pane = document.getElementById('wizard-pane-content');
    const actionsBar = document.getElementById('wizard-actions-bar');
    if (!pane) return;

    if (this.wizard.currentStep === 1) {
      pane.innerHTML = this.getStep1Html();
      if (actionsBar) actionsBar.innerHTML = this.getStep1ActionsHtml();
    } else if (this.wizard.currentStep === 2) {
      pane.innerHTML = this.getStep2Html();
      if (actionsBar) actionsBar.innerHTML = this.getStep2ActionsHtml();
    } else if (this.wizard.currentStep === 3) {
      pane.innerHTML = this.getStep3Html();
      if (actionsBar) actionsBar.innerHTML = this.getStep3ActionsHtml();
    }

    // Stepper holatini yangilash
    document.querySelectorAll('.wizard-step-item').forEach((el, idx) => {
      const step = idx + 1;
      el.classList.toggle('active', step === this.wizard.currentStep);
      el.classList.toggle('completed', step < this.wizard.currentStep);
      const numEl = el.querySelector('.wizard-step-num');
      if (numEl) {
        numEl.innerHTML = step < this.wizard.currentStep ? '<i class="fas fa-check"></i>' : String(step);
      }
    });

    const step2Badge = document.getElementById('step2-badge');
    if (step2Badge) {
      step2Badge.innerText = `${this.wizard.questions.length} ta (${this.calcTotalPoints()} b)`;
    }
  },

  getStep1ActionsHtml() {
    return `
      <button type="button" class="btn btn-secondary" onclick="TeacherView.confirmCloseWizard()">Bekor qilish</button>
      <button type="button" class="btn btn-primary" onclick="TeacherView.goToStep(2)">
        Keyingi: test tuzish <i class="fas fa-arrow-right"></i>
      </button>
    `;
  },

  getStep2ActionsHtml() {
    return `
      <button type="button" class="btn btn-secondary" onclick="TeacherView.goToStep(1)">
        <i class="fas fa-arrow-left"></i> Orqaga
      </button>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="TeacherView.confirmCloseWizard()">Bekor qilish</button>
        <button type="button" class="btn btn-primary" onclick="TeacherView.goToStep(3)">
          Keyingi: tekshirish <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    `;
  },

  getStep3ActionsHtml() {
    const isEdit = !!this.wizard.editingAssignmentId;
    return `
      <button type="button" class="btn btn-secondary" onclick="TeacherView.goToStep(2)">
        <i class="fas fa-arrow-left"></i> Orqaga
      </button>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="TeacherView.confirmCloseWizard()">Bekor qilish</button>
        <button 
          type="button" 
          class="btn btn-primary" 
          id="btn-save-wizard" 
          onclick="TeacherView.saveWizardAssignment()">
          <i class="fas fa-paper-plane"></i> ${isEdit ? "O'zgarishlarni saqlash" : "Topshiriqni yaratish"}
        </button>
      </div>
    `;
  },

  calcTotalPoints() {
    let sum = 0;
    this.wizard.questions.forEach(q => sum += (parseFloat(q.points) || 0));
    return Math.round(sum * 10) / 10;
  },

  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  // DOM inputlaridan holatni sinxronlash
  syncCurrentStepState() {
    if (this.wizard.currentStep === 1) {
      const titleEl = document.getElementById('wiz-title');
      if (titleEl) this.wizard.basicInfo.title = titleEl.value;

      const groupEl = document.getElementById('wiz-group');
      if (groupEl) this.wizard.basicInfo.group_id = groupEl.value;

      const startEl = document.getElementById('wiz-start-date');
      if (startEl) this.wizard.basicInfo.start_date = startEl.value;

      const dueEl = document.getElementById('wiz-due-date');
      if (dueEl) this.wizard.basicInfo.due_date = dueEl.value;

      const attemptsEl = document.getElementById('wiz-attempts-limit');
      if (attemptsEl) this.wizard.basicInfo.attempts_limit = Math.max(1, parseInt(attemptsEl.value, 10) || 1);
    } else if (this.wizard.currentStep === 2) {
      this.wizard.questions.forEach((q, idx) => {
        const textEl = document.getElementById(`wiz-q-text-${idx}`);
        if (textEl) q.question_text = textEl.value;

        const ptsEl = document.getElementById(`wiz-q-points-${idx}`);
        if (ptsEl) q.points = Math.max(0.5, parseFloat(ptsEl.value) || 1);

        if (q.question_type === 'closed') {
          if (Array.isArray(q.options)) {
            q.options.forEach((opt, optIdx) => {
              const optEl = document.getElementById(`wiz-opt-text-${idx}-${optIdx}`);
              if (optEl) opt.option_text = optEl.value;

              const radioEl = document.getElementById(`wiz-opt-radio-${idx}-${optIdx}`);
              if (radioEl) opt.is_correct = radioEl.checked ? 1 : 0;
            });
          }
        } else {
          const sampleEl = document.getElementById(`wiz-q-sample-${idx}`);
          if (sampleEl) q.sample_answer = sampleEl.value;

          const instEl = document.getElementById(`wiz-q-inst-${idx}`);
          if (instEl) q.instruction = instEl.value;
        }
      });
    }
  },

  goToStep(stepNumber) {
    this.syncCurrentStepState();

    // 1-bosqich validatsiyasi
    if (this.wizard.currentStep === 1 && stepNumber > 1) {
      if (!this.wizard.basicInfo.title || !this.wizard.basicInfo.title.trim()) {
        AppUI.showToast('warning', 'Topshiriq nomi', "Iltimos, topshiriq nomini kiriting.");
        const titleEl = document.getElementById('wiz-title');
        if (titleEl) titleEl.focus();
        return;
      }
      if (!this.wizard.basicInfo.group_id) {
        AppUI.showToast('warning', 'Guruh tanlang', "Topshiriq uchun akademik guruhni tanlang.");
        const grpEl = document.getElementById('wiz-group');
        if (grpEl) grpEl.focus();
        return;
      }
      if (this.wizard.basicInfo.start_date && this.wizard.basicInfo.due_date) {
        const start = new Date(this.wizard.basicInfo.start_date);
        const due = new Date(this.wizard.basicInfo.due_date);
        if (due <= start) {
          AppUI.showToast('warning', 'Muddat xatosi', "Tugash muddati boshlanish vaqtidan keyin bo'lishi kerak.");
          const dueEl = document.getElementById('wiz-due-date');
          if (dueEl) dueEl.focus();
          return;
        }
      }
    }

    // 2-bosqich (Savollar) dan 3-bosqichga o'tish validatsiyasi
    if (stepNumber === 3) {
      if (this.wizard.questions.length === 0) {
        AppUI.showToast('warning', "Savollar yo'q", "Topshiriqda kamida 1 ta savol bo'lishi shart.");
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
          const qTextEl = document.getElementById(`wiz-q-text-${i}`);
          if (qTextEl) qTextEl.focus();
          return;
        }
        if (q.question_type === 'closed') {
          if (!q.options || q.options.length < 2) {
            AppUI.showToast('warning', 'Variantlar soni', `${i + 1}-yopiq test savolida kamida 2 ta variant bo'lishi shart.`);
            q.is_expanded = true;
            this.wizard.currentStep = 2;
            this.renderCurrentStepPane();
            return;
          }
          const emptyOpt = q.options.some(opt => !opt.option_text || !opt.option_text.trim());
          if (emptyOpt) {
            AppUI.showToast('warning', 'Variant matni', `${i + 1}-yopiq test savolida barcha variant matnlarini to'ldiring.`);
            q.is_expanded = true;
            this.wizard.currentStep = 2;
            this.renderCurrentStepPane();
            return;
          }
          const hasCorrect = q.options.some(opt => opt.is_correct === 1);
          if (!hasCorrect) {
            AppUI.showToast('warning', 'To\'g\'ri javob', `${i + 1}-yopiq test savolida to'g'ri javob variantini belgilang.`);
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
  // 1-BOSQICH: Topshiriq ma'lumotlari (Soddalashtirilgan)
  // =========================================================================
  getStep1Html() {
    const b = this.wizard.basicInfo;
    const groupOptions = (this.cachedGroups || []).map(g => `
      <option value="${g.id}" ${String(b.group_id) === String(g.id) ? 'selected' : ''}>${g.name}</option>
    `).join('');

    // Nazariy fayl bloki
    let fileInfoHtml = '';
    const attached = this.wizard.attachedFile;
    const existingName = this.wizard.existingFileName;

    if (attached) {
      const ext = attached.name.substring(attached.name.lastIndexOf('.')).toLowerCase();
      let icon = 'fa-file-alt text-primary';
      if (ext === '.pdf') icon = 'fa-file-pdf text-danger';
      else if (['.doc', '.docx'].includes(ext)) icon = 'fa-file-word text-primary';
      else if (['.ppt', '.pptx'].includes(ext)) icon = 'fa-file-powerpoint text-warning';

      fileInfoHtml = `
        <div class="theory-file-card">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: white; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);">
              <i class="fas ${icon}" style="font-size: 1.25rem;"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-main);">${attached.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
                <span class="badge" style="background: white; border: 1px solid var(--border); color: var(--text-main); font-size: 0.7rem; font-weight: 700;">${ext.replace('.', '').toUpperCase()}</span>
                &bull; ${this.formatFileSize(attached.size)}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <input type="file" id="wiz-file-input" style="display: none;" accept=".pdf,.doc,.docx,.pptx,.ppt" onchange="TeacherView.handleWizardFileSelect(event)" />
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('wiz-file-input').click()">
              <i class="fas fa-sync-alt"></i> Almashtirish
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="TeacherView.removeAttachedFile()">
              <i class="fas fa-trash"></i> Olib tashlash
            </button>
          </div>
        </div>
      `;
    } else if (existingName) {
      const ext = existingName.substring(existingName.lastIndexOf('.')).toLowerCase();
      let icon = 'fa-file-alt text-primary';
      if (ext === '.pdf') icon = 'fa-file-pdf text-danger';
      else if (['.doc', '.docx'].includes(ext)) icon = 'fa-file-word text-primary';
      else if (['.ppt', '.pptx'].includes(ext)) icon = 'fa-file-powerpoint text-warning';

      fileInfoHtml = `
        <div class="theory-file-card">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: white; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);">
              <i class="fas ${icon}" style="font-size: 1.25rem;"></i>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-main);">${existingName}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
                <span class="badge" style="background: white; border: 1px solid var(--border); color: var(--text-main); font-size: 0.7rem; font-weight: 700;">${ext.replace('.', '').toUpperCase()}</span>
                &bull; Mavjud fayl saqlanadi
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <input type="file" id="wiz-file-input" style="display: none;" accept=".pdf,.doc,.docx,.pptx,.ppt" onchange="TeacherView.handleWizardFileSelect(event)" />
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('wiz-file-input').click()">
              <i class="fas fa-sync-alt"></i> Almashtirish
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="TeacherView.removeAttachedFile()">
              <i class="fas fa-trash"></i> Olib tashlash
            </button>
          </div>
        </div>
      `;
    } else {
      fileInfoHtml = `
        <div class="theory-upload-zone" onclick="document.getElementById('wiz-file-input').click()" style="padding: 1.25rem 1rem;">
          <input type="file" id="wiz-file-input" style="display: none;" accept=".pdf,.doc,.docx,.pptx,.ppt" onchange="TeacherView.handleWizardFileSelect(event)" />
          <i class="fas fa-cloud-upload-alt text-primary" style="font-size: 2rem; margin-bottom: 0.35rem; opacity: 0.85;"></i>
          <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.2rem;">
            Nazariy material yuklash <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(Ixtiyoriy)</span>
          </div>
          <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 0.65rem;">
            PDF, DOC, DOCX yoki PPTX formatidagi fayllar
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); document.getElementById('wiz-file-input').click()">
            <i class="fas fa-paperclip"></i> Fayl tanlash
          </button>
        </div>
      `;
    }

    return `
      <div class="wizard-step1-container">
        <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem;">
          
          <div class="step1-row-grid-2">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label required">Topshiriq nomi</label>
              <input type="text" id="wiz-title" class="form-control" placeholder="Masalan: Kriptografiya asoslari" value="${b.title || ''}" required />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label required">Guruh</label>
              <select id="wiz-group" class="form-select" required>
                <option value="">-- Guruhni tanlang --</option>
                ${groupOptions}
              </select>
            </div>
          </div>

          <div class="step1-row-grid-3">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Boshlanish vaqti</label>
              <input type="datetime-local" id="wiz-start-date" class="form-control" value="${b.start_date || ''}" />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Tugash muddati</label>
              <input type="datetime-local" id="wiz-due-date" class="form-control" value="${b.due_date || ''}" />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Urinishlar soni</label>
              <input 
                type="number" 
                id="wiz-attempts-limit" 
                class="form-control" 
                min="1" 
                step="1" 
                value="${b.attempts_limit || 1}" 
                placeholder="1" 
              />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span><i class="fas fa-file-alt text-primary"></i> Nazariy material</span>
              <span style="font-size: 0.775rem; color: var(--text-muted); font-weight: normal;">PDF, DOC, DOCX, PPTX (Ixtiyoriy)</span>
            </label>
            ${fileInfoHtml}
          </div>

        </div>
      </div>
    `;
  },

  handleWizardFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.pptx', '.ppt'];
    if (!allowed.includes(ext)) {
      AppUI.showToast('danger', 'Format xatosi', "Faqat PDF, DOC, DOCX, PPTX fayllari qabul qilinadi.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      AppUI.showToast('danger', 'Hajm xatosi', "Fayl hajmi 50MB dan oshmasligi kerak.");
      return;
    }

    this.wizard.attachedFile = file;
    this.wizard.existingFileName = null;
    this.renderCurrentStepPane();
    AppUI.showToast('success', 'Fayl tanlandi', `"${file.name}" muvaffaqiyatli biriktirildi.`);
  },

  removeAttachedFile() {
    this.wizard.attachedFile = null;
    this.wizard.existingFileName = null;
    this.wizard.basicInfo.file_path = null;
    this.renderCurrentStepPane();
    AppUI.showToast('info', 'Fayl olib tashlandi', "Biriktirilgan nazariy material olib tashlandi.");
  },

  // =========================================================================
  // 2-BOSQICH: Test tuzish (Silliq scroll va to'liq variant boshqaruvi)
  // =========================================================================
  getStep2Html() {
    const b = this.wizard.basicInfo;
    const groupObj = (this.cachedGroups || []).find(g => String(g.id) === String(b.group_id));
    const groupName = groupObj ? groupObj.name : 'Guruh tanlanmagan';
    const totalPts = this.calcTotalPoints();

    let closedCount = 0;
    let openCount = 0;
    this.wizard.questions.forEach(q => {
      if (q.question_type === 'closed') closedCount++;
      if (q.question_type === 'open') openCount++;
    });

    let materialBadgeHtml = '';
    if (this.wizard.attachedFile) {
      materialBadgeHtml = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 0.8rem;" title="${this.wizard.attachedFile.name}"><i class="fas fa-file-alt"></i> ${this.wizard.attachedFile.name} (${this.formatFileSize(this.wizard.attachedFile.size)})</span>`;
    } else if (this.wizard.existingFileName) {
      materialBadgeHtml = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 0.8rem;" title="${this.wizard.existingFileName}"><i class="fas fa-file-alt"></i> ${this.wizard.existingFileName}</span>`;
    } else {
      materialBadgeHtml = `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.8rem;"><i class="fas fa-minus-circle"></i> Yuklanmagan (ixtiyoriy)</span>`;
    }

    // Savol kartalari
    let cardsHtml = '';
    if (this.wizard.questions.length === 0) {
      cardsHtml = `
        <div class="empty-state" style="padding: 2.5rem 1rem; background: #fafafa; border: 2px dashed var(--border); border-radius: var(--radius-lg); text-align: center;">
          <i class="fas fa-clipboard-question text-muted" style="font-size: 2.5rem; margin-bottom: 0.75rem;"></i>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">Hozircha hech qanday savol qo'shilmagan</div>
          <div style="font-size: 0.825rem; color: var(--text-muted); margin: 0.35rem 0 1rem 0;">
            Topshiriq uchun yopiq test yoki ochiq savollarni qo'shing.
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button type="button" class="btn btn-primary btn-sm" onclick="TeacherView.addQuestionWizard('closed')">
              <i class="fas fa-check-circle"></i> + Yopiq test qo'shish
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="TeacherView.addQuestionWizard('open')">
              <i class="fas fa-pen-alt"></i> + Ochiq savol qo'shish
            </button>
          </div>
        </div>
      `;
    } else {
      cardsHtml = this.wizard.questions.map((q, idx) => {
        const isClosed = q.question_type === 'closed';
        const isOpen = q.is_expanded !== false;
        const previewText = q.question_text ? q.question_text.trim() : "(Savol matni kiritilmagan)";
        const qId = q.id || `q_${idx}`;

        return `
          <div class="compact-q-card ${isClosed ? 'type-closed' : 'type-open'} ${isOpen ? 'is-open' : ''}" id="wiz-card-${idx}">
            <!-- Ixcham sarlavha -->
            <div class="compact-q-header" onclick="TeacherView.toggleQuestionExpand(${idx})">
              <div class="compact-q-left">
                <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">#${idx + 1}</span>

                <!-- Savol turini almashtirish boshqaruv elementi -->
                <div onclick="event.stopPropagation()">
                  <select 
                    class="question-type-select ${isClosed ? 'type-closed' : 'type-open'}" 
                    id="wiz-q-type-${idx}"
                    onchange="TeacherView.changeQuestionType(${idx}, this.value)"
                    title="Savol turini almashtirish">
                    <option value="closed" ${isClosed ? 'selected' : ''}>Yopiq test</option>
                    <option value="open" ${!isClosed ? 'selected' : ''}>Ochiq savol</option>
                  </select>
                </div>

                <span class="compact-q-title-preview" title="${q.question_text || ''}">${previewText}</span>
                <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-weight: 700; margin-left: auto;">
                  ${q.points || 5} ball
                </span>
              </div>

              <div class="compact-q-actions" onclick="event.stopPropagation()">
                <button type="button" class="btn btn-secondary btn-sm" title="Yuqoriga surish" onclick="TeacherView.moveWizardQuestion(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
                  <i class="fas fa-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" title="Pastga surish" onclick="TeacherView.moveWizardQuestion(${idx}, 1)" ${idx === this.wizard.questions.length - 1 ? 'disabled' : ''}>
                  <i class="fas fa-arrow-down"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" title="${isOpen ? 'Yig\'ish' : 'Tahrirlash'}" onclick="TeacherView.toggleQuestionExpand(${idx})">
                  <i class="fas fa-${isOpen ? 'chevron-up' : 'chevron-down'}"></i>
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
                  <label style="font-size: 0.8rem; color: var(--text-muted); margin: 0; font-weight: 700;">Ball:</label>
                  <input 
                    type="number" 
                    id="wiz-q-points-${idx}" 
                    class="form-control" 
                    style="width: 75px; height: 32px; text-align: center; font-weight: 700; padding: 0.2rem 0.4rem;" 
                    value="${q.points}" 
                    min="0.5" 
                    step="0.5" 
                    oninput="TeacherView.onQuestionPointsChange(${idx}, this.value)" 
                  />
                </div>
              </div>

              <textarea 
                id="wiz-q-text-${idx}" 
                class="form-control" 
                style="min-height: 65px; margin-bottom: 0.75rem;" 
                placeholder="${isClosed ? 'Yopiq test savoli matnini kiriting...' : 'Ochiq savol matnini kiriting...'}" 
                oninput="TeacherView.updateCardPreviewText(${idx}, this.value)" 
                required>${q.question_text || ''}</textarea>

              ${isClosed ? `
                <!-- Yopiq test variantlari -->
                <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
                      Javob variantlari (To'g'ri javobni tanlang):
                    </span>
                    <button type="button" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.65rem; font-size: 0.775rem;" onclick="TeacherView.addWizardOption(${idx})">
                      <i class="fas fa-plus"></i> Variant qo'shish
                    </button>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 0.45rem;" id="wiz-options-list-${idx}">
                    ${(q.options || []).map((opt, optIdx) => `
                      <div class="quiz-builder-option-row" id="wiz-opt-row-${idx}-${optIdx}">
                        <input 
                          type="radio" 
                          name="wiz-radio-${qId}" 
                          id="wiz-opt-radio-${idx}-${optIdx}" 
                          class="quiz-builder-radio" 
                          ${opt.is_correct === 1 ? 'checked' : ''} 
                          onchange="TeacherView.setWizardCorrectOption(${idx}, ${optIdx})" 
                          title="To'g'ri javob qilib belgilash" 
                        />
                        <span class="quiz-opt-key-badge">
                          ${opt.option_key}
                        </span>
                        <input 
                          type="text" 
                          id="wiz-opt-text-${idx}-${optIdx}" 
                          class="form-control quiz-opt-input" 
                          placeholder="${opt.option_key}-variant matni..." 
                          value="${opt.option_text || ''}" 
                          oninput="TeacherView.onOptionTextChange(${idx}, ${optIdx}, this.value)"
                          required 
                        />
                        <button 
                          type="button" 
                          class="btn btn-outline-danger btn-sm btn-opt-del" 
                          title="Variantni o'chirish" 
                          onclick="TeacherView.removeWizardOption(${idx}, ${optIdx})" 
                          ${(q.options || []).length <= 2 ? 'disabled' : ''}>
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : `
                <!-- Ochiq savol parametrlari (Variantlar ko'rsatilmaydi!) -->
                <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem;">
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; margin-bottom: 0.25rem;">
                      <i class="fas fa-robot text-primary"></i> Namunaviy javob yoki baholash mezoni (AI tahlili va tekshirish uchun - ixtiyoriy):
                    </label>
                    <textarea 
                      id="wiz-q-sample-${idx}" 
                      class="form-control" 
                      style="min-height: 55px; font-size: 0.85rem;" 
                      placeholder="AI talaba javobini qanday mezonlar bo'yicha baholashi kerak? (Kutilayotgan kalit so'zlar yoki to'liq namunaviy javob)...">${q.sample_answer || ''}</textarea>
                  </div>

                  <div>
                    <label class="form-label" style="font-size: 0.8rem; margin-bottom: 0.25rem;">
                      Talaba uchun yo'riqnoma (ixtiyoriy):
                    </label>
                    <input 
                      type="text" 
                      id="wiz-q-inst-${idx}" 
                      class="form-control" 
                      style="font-size: 0.85rem;" 
                      placeholder="Masalan: Javobingizni asoslang yoki kamida 2 ta misol keltiring..." 
                      value="${q.instruction || ''}" 
                    />
                  </div>
                </div>
              `}

            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div>
        <!-- Sahifa yuqorisidagi ma'lumotlar paneli (Header summary) -->
        <div class="step2-summary-header">
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="font-weight: 800; font-size: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>${b.title || 'Nomsiz topshiriq'}</span>
              <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.75rem;"><i class="fas fa-users"></i> ${groupName}</span>
              <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.75rem;"><i class="fas fa-redo"></i> ${b.attempts_limit || 1} ta urinish</span>
            </div>
            <div style="font-size: 0.775rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem; flex-wrap: wrap;">
              <span>Nazariy material:</span>
              ${materialBadgeHtml}
            </div>
          </div>

          <div>
            <span id="step2-summary-badge" class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.85rem; padding: 0.4rem 0.75rem; font-weight: 700;">
              <i class="fas fa-star"></i> Jami: ${totalPts} ball (${this.wizard.questions.length} ta savol: ${closedCount} test, ${openCount} ochiq)
            </span>
          </div>
        </div>

        <!-- Savol qo'shish tugmalari paneli -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="TeacherView.addQuestionWizard('closed')">
              <i class="fas fa-plus-circle"></i> + Yopiq test qo'shish
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="TeacherView.addQuestionWizard('open')">
              <i class="fas fa-plus"></i> + Ochiq savol qo'shish
            </button>
          </div>

          <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.toggleAllQuestions()">
            <i class="fas fa-compress-arrows-alt"></i> Yig'ish / Ochish
          </button>
        </div>

        <!-- Savol kartalari ro'yxati (Asosiy oyna ichida to'liq tabiiy scroll bilan) -->
        <div class="wizard-questions-list" id="wizard-questions-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${cardsHtml}
        </div>
      </div>
    `;
  },

  changeQuestionType(idx, newType) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[idx];
    if (!q) return;

    if (newType === 'closed') {
      q.question_type = 'closed';
      if (!Array.isArray(q.options) || q.options.length < 2) {
        q.options = [
          { option_key: 'A', option_text: '', is_correct: 1 },
          { option_key: 'B', option_text: '', is_correct: 0 }
        ];
      }
    } else {
      q.question_type = 'open';
      if (!q.sample_answer) q.sample_answer = '';
      if (!q.instruction) q.instruction = '';
    }

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;

    this.renderCurrentStepPane();

    if (pane) {
      pane.scrollTop = prevScrollTop;
    }
  },

  addQuestionWizard(type = 'closed') {
    this.syncCurrentStepState();
    const isClosed = type === 'closed';
    const newIdx = this.wizard.questions.length;

    const newQuestion = {
      id: null,
      question_type: isClosed ? 'closed' : 'open',
      question_text: '',
      points: 5,
      order_index: newIdx,
      is_expanded: true,
      options: isClosed ? [
        { option_key: 'A', option_text: '', is_correct: 1 },
        { option_key: 'B', option_text: '', is_correct: 0 }
      ] : [],
      sample_answer: '',
      instruction: ''
    };

    this.wizard.questions.push(newQuestion);
    this.renderCurrentStepPane();

    // Yangi qo'shilgan savolga silliq scroll qilish va uning matn maydoniga fokus qilish
    setTimeout(() => {
      const qCard = document.getElementById(`wiz-card-${newIdx}`);
      const qInput = document.getElementById(`wiz-q-text-${newIdx}`);
      if (qCard) {
        qCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      if (qInput) {
        qInput.focus();
      }
    }, 50);
  },

  toggleQuestionExpand(idx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[idx];
    if (q) {
      q.is_expanded = !q.is_expanded;
      const pane = document.getElementById('wizard-pane-content');
      const prevScrollTop = pane ? pane.scrollTop : 0;
      this.renderCurrentStepPane();
      if (pane) pane.scrollTop = prevScrollTop;
    }
  },

  toggleAllQuestions() {
    this.syncCurrentStepState();
    const allOpen = this.wizard.questions.every(q => q.is_expanded !== false);
    const targetState = !allOpen;
    this.wizard.questions.forEach(q => q.is_expanded = targetState);

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;
    this.renderCurrentStepPane();
    if (pane) pane.scrollTop = prevScrollTop;
  },

  updateCardPreviewText(idx, val) {
    const q = this.wizard.questions[idx];
    if (q) {
      q.question_text = val;
      const card = document.getElementById(`wiz-card-${idx}`);
      if (card) {
        const previewEl = card.querySelector('.compact-q-title-preview');
        if (previewEl) {
          previewEl.innerText = val.trim() || "(Savol matni kiritilmagan)";
          previewEl.title = val;
        }
      }
    }
  },

  onQuestionPointsChange(idx, val) {
    const q = this.wizard.questions[idx];
    if (q) {
      q.points = Math.max(0.5, parseFloat(val) || 1);
      const total = this.calcTotalPoints();
      const badge = document.getElementById('step2-summary-badge');
      const step2Badge = document.getElementById('step2-badge');
      let closedCount = 0;
      let openCount = 0;
      this.wizard.questions.forEach(item => {
        if (item.question_type === 'closed') closedCount++;
        if (item.question_type === 'open') openCount++;
      });
      if (badge) {
        badge.innerHTML = `<i class="fas fa-star"></i> Jami: ${total} ball (${this.wizard.questions.length} ta savol: ${closedCount} test, ${openCount} ochiq)`;
      }
      if (step2Badge) {
        step2Badge.innerText = `${this.wizard.questions.length} ta (${total} b)`;
      }
    }
  },

  onOptionTextChange(idx, optIdx, val) {
    const q = this.wizard.questions[idx];
    if (q && q.options && q.options[optIdx]) {
      q.options[optIdx].option_text = val;
    }
  },

  moveWizardQuestion(idx, direction) {
    this.syncCurrentStepState();
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= this.wizard.questions.length) return;

    const temp = this.wizard.questions[idx];
    this.wizard.questions[idx] = this.wizard.questions[targetIdx];
    this.wizard.questions[targetIdx] = temp;

    this.wizard.questions.forEach((q, i) => q.order_index = i);

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;
    this.renderCurrentStepPane();
    if (pane) pane.scrollTop = prevScrollTop;
  },

  deleteWizardQuestion(idx) {
    this.syncCurrentStepState();
    if (!confirm(`${idx + 1}-savolni o'chirishni tasdiqlaysizmi?`)) return;

    this.wizard.questions.splice(idx, 1);
    this.wizard.questions.forEach((q, i) => q.order_index = i);

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;
    this.renderCurrentStepPane();
    if (pane) pane.scrollTop = prevScrollTop;
  },

  addWizardOption(qIdx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[qIdx];
    if (!q || q.question_type !== 'closed') return;
    if (!Array.isArray(q.options)) q.options = [];

    const nextKey = String.fromCharCode(65 + q.options.length);
    q.options.push({
      option_key: nextKey,
      option_text: '',
      is_correct: 0
    });

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;

    this.renderCurrentStepPane();

    if (pane) {
      pane.scrollTop = prevScrollTop;
    }

    // Yangi variant maydonini avtomatik fokus qilish va ko'rinadigan joyga keltirish
    const newOptIdx = q.options.length - 1;
    const newOptInput = document.getElementById(`wiz-opt-text-${qIdx}-${newOptIdx}`);
    if (newOptInput) {
      newOptInput.focus();
      newOptInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  removeWizardOption(qIdx, optIdx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[qIdx];
    if (!q || q.question_type !== 'closed' || !Array.isArray(q.options)) return;

    if (q.options.length <= 2) {
      AppUI.showToast('warning', 'Cheklov', "Kamida 2 ta javob varianti bo'lishi shart.");
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

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;

    this.renderCurrentStepPane();

    if (pane) {
      pane.scrollTop = prevScrollTop;
    }
  },

  setWizardCorrectOption(qIdx, optIdx) {
    this.syncCurrentStepState();
    const q = this.wizard.questions[qIdx];
    if (!q || q.question_type !== 'closed' || !Array.isArray(q.options)) return;

    q.options.forEach((opt, i) => {
      opt.is_correct = (i === optIdx) ? 1 : 0;
    });

    const pane = document.getElementById('wizard-pane-content');
    const prevScrollTop = pane ? pane.scrollTop : 0;

    this.renderCurrentStepPane();

    if (pane) {
      pane.scrollTop = prevScrollTop;
    }
  },

  // =========================================================================
  // 3-BOSQICH: Tekshirish va yaratish
  // =========================================================================
  getStep3Html() {
    const b = this.wizard.basicInfo;
    const groupObj = (this.cachedGroups || []).find(g => String(g.id) === String(b.group_id));
    const groupName = groupObj ? groupObj.name : 'Guruh tanlanmagan';
    const totalPts = this.calcTotalPoints();

    let closedCount = 0;
    let openCount = 0;
    this.wizard.questions.forEach(q => {
      if (q.question_type === 'closed') closedCount++;
      if (q.question_type === 'open') openCount++;
    });

    let materialText = "Yuklanmagan (ixtiyoriy)";
    if (this.wizard.attachedFile) {
      materialText = `${this.wizard.attachedFile.name} (${this.formatFileSize(this.wizard.attachedFile.size)})`;
    } else if (this.wizard.existingFileName) {
      materialText = `${this.wizard.existingFileName}`;
    }

    // Kamchiliklar tekshiruvi (Checklist)
    const issues = [];
    if (!b.title || !b.title.trim()) {
      issues.push({ step: 1, text: "Topshiriq nomi kiritilmagan." });
    }
    if (!b.group_id) {
      issues.push({ step: 1, text: "Akademik guruh tanlanmagan." });
    }
    if (this.wizard.questions.length === 0) {
      issues.push({ step: 2, text: "Topshiriqda hech qanday savol mavjud emas." });
    }
    this.wizard.questions.forEach((q, i) => {
      if (!q.question_text || !q.question_text.trim()) {
        issues.push({ step: 2, text: `#${i + 1}-savolning matni kiritilmagan.` });
      }
      if (q.question_type === 'closed') {
        if (!q.options || q.options.length < 2) {
          issues.push({ step: 2, text: `#${i + 1}-yopiq testda kamida 2 ta variant bo'lishi kerak.` });
        }
        const hasCorrect = q.options && q.options.some(o => o.is_correct === 1);
        if (!hasCorrect) {
          issues.push({ step: 2, text: `#${i + 1}-yopiq test savolida to'g'ri javob tanlanmagan.` });
        }
      }
    });

    return `
      <div>
        <!-- Xulosaviy Statistik Kartalar -->
        <div class="summary-overview-grid" style="margin-bottom: 1.25rem;">
          <div class="summary-overview-box">
            <div class="summary-overview-label">Topshiriq nomi</div>
            <div class="summary-overview-val" title="${b.title || ''}">${b.title || '-'}</div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Akademik Guruh</div>
            <div class="summary-overview-val">${groupName}</div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Muddatlar</div>
            <div class="summary-overview-val" style="font-size: 0.85rem;">
              ${b.start_date ? AppUI.formatDate(b.start_date) : "Darhol"} &rarr; ${b.due_date ? AppUI.formatDate(b.due_date) : "Muddatsiz"}
            </div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Urinishlar & Nazariy material</div>
            <div class="summary-overview-val" style="font-size: 0.85rem;">
              ${b.attempts_limit || 1} ta urinish &bull; ${materialText}
            </div>
          </div>
          <div class="summary-overview-box">
            <div class="summary-overview-label">Savollar va Ball</div>
            <div class="summary-overview-val" style="color: var(--primary);">
              ${totalPts} ball (${this.wizard.questions.length} ta: ${closedCount} test, ${openCount} ochiq)
            </div>
          </div>
        </div>

        <!-- Kamchiliklar yoki Tayyorlik holati -->
        ${issues.length > 0 ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 1rem 1.25rem; margin-bottom: 1.25rem;">
            <div style="font-weight: 700; color: #b45309; font-size: 0.9rem; margin-bottom: 0.5rem;">
              <i class="fas fa-exclamation-triangle"></i> Diqqat! Topshiriqni e'lon qilishdan oldin quyidagi kamchiliklarni bartaraf eting:
            </div>
            <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #92400e;">
              ${issues.map(iss => `
                <li style="margin-bottom: 0.25rem;">
                  ${iss.text}
                  <a href="javascript:void(0)" style="font-weight: 700; color: var(--primary); margin-left: 0.5rem; text-decoration: underline;" onclick="TeacherView.goToStep(${iss.step})">
                    ${iss.step}-bosqichga o'tish &rarr;
                  </a>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.75rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
            <i class="fas fa-check-circle text-success" style="font-size: 1.25rem;"></i>
            <div style="font-size: 0.85rem; color: #166534; font-weight: 600;">
              Barcha maydonlar to'g'ri to'ldirilgan. Topshiriq yaratishga to'liq tayyor!
            </div>
          </div>
        `}

        <!-- Savollarning qisqa ro'yxati -->
        <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
              <i class="fas fa-list-check text-primary"></i> Kiritilgan savollar xulosasi:
            </div>
            <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-weight: 700;">
              ${this.wizard.questions.length} ta savol
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${this.wizard.questions.map((q, idx) => `
              <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-left: 3px solid ${q.question_type === 'closed' ? '#6366f1' : '#0ea5e9'};">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 0.25rem;">
                  <span style="font-weight: 700; color: var(--text-main);">
                    #${idx + 1} ${q.question_type === 'closed' ? '<span style="color: #6366f1;">[Yopiq test]</span>' : '<span style="color: #0ea5e9;">[Ochiq savol]</span>'}
                  </span>
                  <span class="badge" style="background: white; color: var(--text-main); font-weight: 700;">${q.points} ball</span>
                </div>
                <div style="font-size: 0.875rem; color: var(--text-main); line-height: 1.4;">${q.question_text || '(Savol matni kiritilmagan)'}</div>
                ${q.question_type === 'closed' && q.options ? `
                  <div style="margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.4rem; font-size: 0.75rem;">
                    ${q.options.map(opt => `
                      <span style="padding: 0.15rem 0.45rem; border-radius: var(--radius-sm); background: ${opt.is_correct ? '#dcfce7' : 'white'}; color: ${opt.is_correct ? '#166534' : 'var(--text-muted)'}; border: 1px solid ${opt.is_correct ? '#86efac' : 'var(--border)'};">
                        <strong>${opt.option_key}:</strong> ${opt.option_text || '(bo\'sh)'} ${opt.is_correct ? '<i class="fas fa-check" title="To\'g\'ri javob"></i>' : ''}
                      </span>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  confirmCloseWizard() {
    if (confirm("Topshiriq yaratish oynasini yopmoqchimisiz? Saqlanmagan ma'lumotlar bekor qilinadi.")) {
      AppUI.closeModal();
    }
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
      AppUI.showToast('warning', 'Topshiriq nomi', "Topshiriq nomini kiriting.");
      this.goToStep(1);
      return;
    }

    if (!b.group_id) {
      AppUI.showToast('warning', 'Guruh tanlang', "Guruhni tanlang.");
      this.goToStep(1);
      return;
    }

    if (questions.length === 0) {
      AppUI.showToast('warning', "Savollar yo'q", "Kamida bitta savol bo'lishi shart.");
      this.goToStep(2);
      return;
    }

    // Savollarni tekshirish
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text || !q.question_text.trim()) {
        AppUI.showToast('warning', 'Savol matni', `${i + 1}-savol matnini kiriting.`);
        q.is_expanded = true;
        this.goToStep(2);
        return;
      }
      if (q.question_type === 'closed') {
        if (!q.options || q.options.length < 2) {
          AppUI.showToast('warning', 'Variantlar', `${i + 1}-yopiq testda kamida 2 ta variant bo'lishi shart.`);
          q.is_expanded = true;
          this.goToStep(2);
          return;
        }
        const hasCorrect = q.options.some(o => o.is_correct === 1);
        if (!hasCorrect) {
          AppUI.showToast('warning', 'To\'g\'ri javob', `${i + 1}-yopiq testda to'g'ri javobni tanlang.`);
          q.is_expanded = true;
          this.goToStep(2);
          return;
        }
      }
    }

    // Savollarni tozalash
    const cleanQuestions = questions.map((q, idx) => ({
      question_type: q.question_type,
      question_text: q.question_text.trim(),
      points: Math.max(0.5, parseFloat(q.points) || 1),
      order_index: idx,
      instruction: q.instruction ? q.instruction.trim() : null,
      sample_answer: q.sample_answer ? q.sample_answer.trim() : null,
      options: q.question_type === 'closed' ? (q.options || []).map((opt, optIdx) => ({
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
      formData.append('group_id', b.group_id);
      
      if (b.start_date) formData.append('start_date', b.start_date);
      if (b.due_date) formData.append('due_date', b.due_date);

      formData.append('attempts_limit', b.attempts_limit || 1);
      formData.append('questions', JSON.stringify(cleanQuestions));

      if (this.wizard.attachedFile) {
        formData.append('file', this.wizard.attachedFile);
      }

      let res;
      if (this.wizard.editingAssignmentId) {
        res = await Api.assignments.update(this.wizard.editingAssignmentId, formData);
        AppUI.showToast('success', 'Muvaffaqiyatli saqlandi', "Topshiriq o'zgarishlari saqlandi.");
      } else {
        res = await Api.assignments.create(formData);
        AppUI.showToast('success', 'Muvaffaqiyatli yaratildi', "Topshiriq saqlandi va guruh talabalariga e'lon qilindi!");
      }

      AppUI.closeModal();

      // Qayta yuklash
      const assignRes = await Api.assignments.getAll();
      this.assignments = assignRes.assignments || [];
      if (res && res.assignment) {
        this.selectedAssignmentId = res.assignment.id;
      }
      this.renderDashboard();

    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message || "Saqlashda xatolik yuz berdi.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-paper-plane"></i> ${this.wizard.editingAssignmentId ? "O'zgarishlarni saqlash" : "Topshiriqni yaratish"}`;
      }
    }
  },

  async deleteAssignment(id) {
    if (!confirm("Haqiqatan ham bu topshiriqni va unga tegishli barcha natijalarni o'chirmoqchimisiz?")) return;
    try {
      await Api.assignments.delete(id);
      AppUI.showToast('success', "O'chirildi", "Topshiriq muvaffaqiyatli o'chirildi.");
      this.selectedAssignmentId = null;
      await this.loadInitialData();
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

                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; line-height: 1.4;">
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
                              <strong>${opt.option_key}:</strong> ${opt.option_text} ${opt.is_correct ? "(To'g'ri javob)" : ''}
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
                          <i class="fas fa-brain"></i> AI Semantik Tahlili (${aiFb.source || 'unitask-ai-engine'})
                        </div>
                        <div style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">
                          Tavsiya ball: ${ans.ai_score !== null ? ans.ai_score : '-'} / ${maxPts}
                        </div>
                      </div>

                      ${aiFb.needs_manual_review ? `
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 0.4rem 0.65rem; font-size: 0.75rem; color: #b91c1c; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
                          <i class="fas fa-exclamation-triangle"></i>
                          <span><strong>Qo'lda tekshirish tavsiya etiladi:</strong> ${aiFb.review_reason || "Noaniqlik aniqlandi"}</span>
                        </div>
                      ` : ''}

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

                      ${aiFb.identified_concepts && aiFb.identified_concepts.length > 0 ? `
                        <div style="margin-top: 0.4rem; display: flex; gap: 0.3rem; flex-wrap: wrap; align-items: center;">
                          <span style="font-size: 0.75rem; color: #166534; font-weight: 600;">Topilgan tushunchalar:</span>
                          ${aiFb.identified_concepts.map(c => `<span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.7rem; padding: 0.15rem 0.4rem;">${c}</span>`).join('')}
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
              ${s.student_answer || '<em style="color: var(--text-muted);">Matn kiritilmagan</em>'}
            </div>
          </div>

          <div class="ai-report-card" style="margin-top: 1rem;">
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

      let aiOverviewHtml = '';
      const rep = s.ai_report;
      if (rep) {
        aiOverviewHtml = `
          <div class="card" style="border: 1px solid #c7d2fe; background: #f8faff;">
            <div class="card-header" style="background: #eef2ff; border-bottom: 1px solid #e0e7ff; padding: 0.85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span class="ai-brand-badge" style="font-size: 0.8rem;"><i class="fas fa-brain"></i> AI Tahliliy Hisoboti</span>
                <span class="badge" style="background: white; border: 1px solid #c7d2fe; color: var(--primary); font-weight: 700;">
                  Bilim darajasi: ${rep.mastery_level || 'Baholanmoqda'}
                </span>
              </div>
              <div style="font-size: 0.85rem; font-weight: 700; color: #3730a3;">
                AI tavsiya ball: ${s.total_score !== null ? s.total_score : (s.recommended_score || 0)} / ${totalMaxScore} ball (${rep.score_percent || 0}%)
              </div>
            </div>

            <div class="card-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;">
              <div style="font-size: 0.9rem; line-height: 1.5; color: var(--text-main);">
                <strong><i class="fas fa-chart-line text-primary"></i> Umumiy Xulosa:</strong> ${rep.summary || s.ai_summary || "Tahlil qilingan."}
              </div>

              ${rep.needs_manual_review ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 0.6rem 0.85rem; font-size: 0.825rem; color: #b91c1c; display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-exclamation-triangle fa-lg"></i>
                  <div>
                    <strong>Qo'lda tekshirish tavsiya etiladi:</strong> ${rep.review_reason || "Baho yoki javobda noaniqlik aniqlandi."}
                  </div>
                </div>
              ` : ''}

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
                ${rep.well_understood_concepts && rep.well_understood_concepts.length > 0 ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 0.75rem 1rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #166534; margin-bottom: 0.4rem;">
                      <i class="fas fa-check-circle"></i> Yaxshi o'zlashtirilgan tushunchalar:
                    </div>
                    <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: #15803d; line-height: 1.4;">
                      ${rep.well_understood_concepts.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${rep.missing_concepts && rep.missing_concepts.length > 0 ? `
                  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); padding: 0.75rem 1rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #92400e; margin-bottom: 0.4rem;">
                      <i class="fas fa-exclamation-circle"></i> Bilimdagi bo'shliqlar va kamchiliklar:
                    </div>
                    <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: #b45309; line-height: 1.4;">
                      ${rep.missing_concepts.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>

              ${rep.pedagogical_recommendation ? `
                <div style="background: #f1f5f9; border-left: 3px solid #64748b; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.825rem; color: #334155;">
                  <strong><i class="fas fa-chalkboard-teacher"></i> O'qituvchi uchun pedagogik tavsiya:</strong> ${rep.pedagogical_recommendation}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      const modalHtml = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Student Info Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main);">${s.student_name}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; margin-top: 0.15rem;">
                <span>${s.group_name} &bull; ${s.student_email}</span>
                ${s.attempt_number ? `<span class="badge" style="background: white; border: 1px solid var(--border);">#${s.attempt_number}-urinish</span>` : ''}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          <!-- Student Attached File (if exists) -->
          ${s.file_name ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i class="fas fa-file-alt text-success" style="font-size: 1.5rem;"></i>
                <div>
                  <div style="font-weight: 700; font-size: 0.875rem; color: #166534;">${s.file_name}</div>
                  <div style="font-size: 0.75rem; color: #15803d;">${s.file_size ? `${(s.file_size / 1024).toFixed(1)} KB &bull; ` : ''}Talaba tomonidan yuklangan fayl</div>
                </div>
              </div>
              <button type="button" class="btn btn-success btn-sm" onclick="Api.submissions.downloadFile(${s.id}, '${(s.file_name || 'fayl').replace(/'/g, "\\'")}')">
                <i class="fas fa-download"></i> Xavfsiz yuklab olish
              </button>
            </div>
          ` : ''}

          ${aiOverviewHtml}
          ${answersContentHtml}

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.reanalyze(${s.id})">
              <i class="fas fa-redo"></i> AI Bilan Qayta Tahlil Qilish
            </button>
          </div>

          <!-- Final Grade Submission Form -->
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

      AppUI.openModal('<i class="fas fa-award text-primary"></i> Mustaqil Ishni Baholash', modalHtml, '', 'modal-xl');

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  calcTotalGradeFromInputs() {
    const inputs = document.querySelectorAll('.q-grade-input');
    if (!inputs || inputs.length === 0) return;

    let total = 0;
    inputs.forEach(inp => {
      total += Math.max(0, parseFloat(inp.value) || 0);
    });

    const totalEl = document.getElementById('grade-score');
    if (totalEl) {
      totalEl.value = Math.round(total * 10) / 10;
    }
  },

  async handleGradeSubmit(event, submissionId) {
    event.preventDefault();
    const btn = document.getElementById('btn-save-grade');
    const teacherScore = parseFloat(document.getElementById('grade-score').value);
    const teacherFeedback = document.getElementById('grade-feedback').value;

    const questionGrades = [];
    document.querySelectorAll('.q-grade-input').forEach(inp => {
      const qid = inp.getAttribute('data-qid');
      const qScore = parseFloat(inp.value) || 0;
      const fbEl = document.getElementById(`q-grade-fb-${qid}`);
      const qFb = fbEl ? fbEl.value : '';

      questionGrades.push({
        question_id: qid,
        teacher_score: qScore,
        teacher_feedback: qFb
      });
    });

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...';
    }

    try {
      await Api.submissions.grade(submissionId, {
        teacher_score: teacherScore,
        teacher_feedback: teacherFeedback,
        question_grades: questionGrades
      });

      AppUI.showToast('success', 'Baho saqlandi', "Talabaning ishi muvaffaqiyatli baholandi.");
      AppUI.closeModal();

      if (this.selectedAssignmentId) {
        await this.loadAssignmentDetails(this.selectedAssignmentId);
      }
      const assignRes = await Api.assignments.getAll();
      this.assignments = assignRes.assignments || [];
      this.renderDashboard();
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-double"></i> Bahoni Tasdiqlash';
      }
    }
  },

  async reanalyze(submissionId) {
    if (!confirm("AI ushbu javobni qayta tahlil qilsinmi?")) return;
    try {
      AppUI.showToast('info', 'AI Tahlili', "Qayta tahlil boshlandi...");
      await Api.submissions.reanalyze(submissionId);
      AppUI.showToast('success', 'Muvaffaqiyatli', "AI tahlili yangilandi.");
      await this.showGradeModal(submissionId);
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  async allowResubmit(submissionId) {
    if (!confirm("Talabaga javobni qaytadan topshirishiga ruxsat bermoqchimisiz? Ushbu javob o'chiriladi.")) return;
    try {
      await Api.submissions.allowResubmit(submissionId);
      AppUI.showToast('success', 'Ruxsat berildi', "Talabaga topshiriqni qayta topshirishga ruxsat berildi.");
      AppUI.closeModal();
      if (this.selectedAssignmentId) {
        await this.loadAssignmentDetails(this.selectedAssignmentId);
      }
      const assignRes = await Api.assignments.getAll();
      this.assignments = assignRes.assignments || [];
      this.renderDashboard();
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // Eskirgan chaqiruvlarni qo'llab-quvvatlash uchun alias
  showCreateAssignmentModal() {
    this.openCreateWizard();
  }
};
