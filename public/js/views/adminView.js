/**
 * UniTask AI - Super Admin Boshqaruv Paneli
 * Barcha asosiy bo'limlar: Statistika, O'qituvchilar, Talabalar, Guruhlar, Topshiriqlar, Topshirilgan ishlar
 */

const AdminView = {
  currentTab: 'stats', // 'stats' | 'teachers' | 'students' | 'groups' | 'assignments' | 'submissions'
  
  // Keshlar va filtrlash holatlari
  statsCache: null,
  teachersCache: [],
  studentsCache: [],
  groupsCache: [],
  assignmentsCache: [],
  submissionsCache: [],

  // Filtrlar
  filters: {
    teacherSearch: '',
    teacherStatus: '',
    studentSearch: '',
    studentGroup: '',
    studentStatus: '',
    groupSearch: '',
    assignmentSearch: '',
    assignmentGroup: '',
    submissionSearch: '',
    submissionStatus: '',
    submissionGroup: ''
  },

  async render() {
    return `
      <div style="margin-bottom: 2.5rem;">
        <!-- Yuqori sarlavha va tezkor amallar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fas fa-shield-alt" style="color: var(--primary);"></i> Super Admin Boshqaruv Markazi
            </h1>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem;">
              Universitet akademik guruhlari, professor-o'qituvchilar, talabalar, topshiriqlar va AI tahlillarini to'liq nazorat qilish.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="AdminView.refreshCurrentTab()" title="Ma'lumotlarni yangilash">
              <i class="fas fa-sync-alt"></i> Yangilash
            </button>
            <button class="btn btn-outline btn-sm" onclick="AdminView.showAddGroupModal()">
              <i class="fas fa-layer-group"></i> Yangi Guruh
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminView.showAddUserModal()">
              <i class="fas fa-user-plus"></i> Yangi Foydalanuvchi
            </button>
          </div>
        </div>

        <!-- 6 ta Asosiy Boshqaruv Tablari -->
        <div class="tabs-nav" style="overflow-x: auto; flex-wrap: nowrap; padding-bottom: 0.25rem;">
          <button class="tab-btn ${this.currentTab === 'stats' ? 'active' : ''}" onclick="AdminView.switchTab('stats')">
            <i class="fas fa-chart-pie"></i> Statistika
          </button>
          <button class="tab-btn ${this.currentTab === 'teachers' ? 'active' : ''}" onclick="AdminView.switchTab('teachers')">
            <i class="fas fa-chalkboard-teacher"></i> O'qituvchilar
          </button>
          <button class="tab-btn ${this.currentTab === 'students' ? 'active' : ''}" onclick="AdminView.switchTab('students')">
            <i class="fas fa-user-graduate"></i> Talabalar
          </button>
          <button class="tab-btn ${this.currentTab === 'groups' ? 'active' : ''}" onclick="AdminView.switchTab('groups')">
            <i class="fas fa-users-class"></i> Guruhlar
          </button>
          <button class="tab-btn ${this.currentTab === 'assignments' ? 'active' : ''}" onclick="AdminView.switchTab('assignments')">
            <i class="fas fa-book-open"></i> Topshiriqlar
          </button>
          <button class="tab-btn ${this.currentTab === 'submissions' ? 'active' : ''}" onclick="AdminView.switchTab('submissions')">
            <i class="fas fa-inbox"></i> Topshirilgan Ishlar
          </button>
        </div>

        <!-- Tab Kontenti -->
        <div id="admin-tab-content" style="margin-top: 1.25rem;">
          ${await this.renderTabContent()}
        </div>
      </div>
    `;
  },

  async switchTab(tab) {
    this.currentTab = tab;
    const content = document.getElementById('admin-tab-content');
    if (!content) return;

    content.innerHTML = `<div style="text-align: center; padding: 4rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i><p style="margin-top: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">Yuklanmoqda...</p></div>`;
    
    document.querySelectorAll('.tabs-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) {
      event.currentTarget.classList.add('active');
    }

    content.innerHTML = await this.renderTabContent();
  },

  async refreshCurrentTab() {
    await this.switchTab(this.currentTab);
    AppUI.showToast('info', 'Yangilandi', 'Ma\'lumotlar ma\'lumotlar bazasidan yangilandi.');
  },

  async renderTabContent() {
    try {
      if (this.currentTab === 'stats') return await this.renderStatsTab();
      if (this.currentTab === 'teachers') return await this.renderTeachersTab();
      if (this.currentTab === 'students') return await this.renderStudentsTab();
      if (this.currentTab === 'groups') return await this.renderGroupsTab();
      if (this.currentTab === 'assignments') return await this.renderAssignmentsTab();
      if (this.currentTab === 'submissions') return await this.renderSubmissionsTab();
    } catch (err) {
      console.error('Tab yuklash xatosi:', err);
      return `
        <div class="empty-state card">
          <i class="fas fa-exclamation-triangle empty-state-icon" style="color: var(--danger);"></i>
          <div class="empty-state-title">Ma'lumotlarni yuklab bo'lmadi</div>
          <div class="empty-state-desc">${err.message || 'Server bilan aloqada xatolik yuz berdi.'}</div>
          <button class="btn btn-primary btn-sm" onclick="AdminView.refreshCurrentTab()">Qayta urinish</button>
        </div>
      `;
    }
    return '';
  },

  // =========================================================================
  // 1. STATISTIKA TABI
  // =========================================================================
  async renderStatsTab() {
    const statsRes = await Api.users.getStats();
    const sysRes = await Api.getSystemStatus();
    const s = statsRes.stats || {};
    this.statsCache = s;

    return `
      <!-- Stats 6-talik Grid -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="stat-card">
          <div class="stat-icon primary"><i class="fas fa-user-graduate"></i></div>
          <div class="stat-content">
            <div class="stat-value">${s.students || 0}</div>
            <div class="stat-label">Jami Talabalar</div>
            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.25rem;">
              <span style="color: var(--success);"><i class="fas fa-check-circle"></i> ${s.activeStudents || 0} faol</span>
              ${s.students - s.activeStudents > 0 ? ` · <span style="color: var(--danger);"><i class="fas fa-ban"></i> ${s.students - s.activeStudents} blok</span>` : ''}
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon secondary"><i class="fas fa-chalkboard-teacher"></i></div>
          <div class="stat-content">
            <div class="stat-value">${s.teachers || 0}</div>
            <div class="stat-label">O'qituvchilar</div>
            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.25rem;">
              <span style="color: var(--success);"><i class="fas fa-check-circle"></i> ${s.activeTeachers || 0} faol</span>
              ${s.teachers - s.activeTeachers > 0 ? ` · <span style="color: var(--danger);"><i class="fas fa-ban"></i> ${s.teachers - s.activeTeachers} blok</span>` : ''}
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon warning"><i class="fas fa-layer-group"></i></div>
          <div class="stat-content">
            <div class="stat-value">${s.groups || 0}</div>
            <div class="stat-label">Akademik Guruhlar</div>
            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.25rem;">Universitet bo'yicha</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon success"><i class="fas fa-file-alt"></i></div>
          <div class="stat-content">
            <div class="stat-value">${s.assignments || 0}</div>
            <div class="stat-label">Mustaqil Topshiriqlar</div>
            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.25rem;">Faol o'quv vazifalari</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #e0e7ff; color: #4338ca;"><i class="fas fa-inbox"></i></div>
          <div class="stat-content">
            <div class="stat-value">${s.submissions || 0}</div>
            <div class="stat-label">Topshirilgan Ishlar</div>
            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.25rem;">Jami topshirishlar soni</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #fce7f3; color: #be185d;"><i class="fas fa-robot"></i></div>
          <div class="stat-content">
            <div class="stat-value">${s.aiReviewed || 0}</div>
            <div class="stat-label">AI Tekshirgan Ishlar</div>
            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.25rem;">
              <span>${s.graded || 0} ta baholangan</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tahliliy kartalar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-tasks text-primary"></i> Topshiriqlar & Baholash Ko'rsatkichi</div>
          </div>
          <div class="card-body">
            <div style="display: flex; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border);">
              <span>Jami topshirilgan javoblar:</span>
              <strong>${s.submissions || 0} ta</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border);">
              <span>AI avtomatik tekshirgan (Reviewed):</span>
              <span class="badge badge-reviewed">${s.reviewed || 0} ta</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border);">
              <span>O'qituvchi tasdiqlagan (Graded):</span>
              <span class="badge badge-graded">${s.graded || 0} ta</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border);">
              <span>Tekshirish navbatida (Pending):</span>
              <span class="badge badge-pending">${s.pending || 0} ta</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 0;">
              <span>Platforma bo'yicha o'rtacha o'zlashtirish:</span>
              <strong style="color: var(--primary); font-size: 1.25rem;">${s.avgScore || 0} / 100</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fas fa-microchip text-primary"></i> Sun'iy Intellekt va Tizim Holati</div>
          </div>
          <div class="card-body">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: ${sysRes.hasOpenAiKey ? 'var(--success)' : 'var(--warning)'}; box-shadow: 0 0 10px ${sysRes.hasOpenAiKey ? 'var(--success)' : 'var(--warning)'};"></div>
              <strong style="font-size: 1rem;">${sysRes.aiStatus}</strong>
            </div>
            <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;">
              ${sysRes.hasOpenAiKey 
                ? 'OpenAI gpt-4o-mini tahlilchi modeli faol. Talabalar javoblari 25 soniyalik timeout va semantik JSON rubric asosida baholanadi.' 
                : 'OpenAI API kaliti kiritilmagan. Tizim avtonom holda o\'zbek tili lug\'ati va semantik algoritmi asosida ishonchli fallback rejimida ishlamoqda.'}
            </p>
            <div style="background: var(--bg-alt); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.825rem; font-family: monospace; display: flex; flex-direction: column; gap: 0.35rem;">
              <div><strong>Platforma:</strong> ${sysRes.platform} v${sysRes.version}</div>
              <div><strong>AI Modeli:</strong> ${sysRes.model}</div>
              <div><strong>Foydalanuvchilar:</strong> ${s.activeUsers || 0} faol / ${s.blockedUsers || 0} bloklangan</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // 2. O'QITUVCHILAR BOSHQARUVI TABI
  // =========================================================================
  async renderTeachersTab() {
    const res = await Api.users.getAll({ role: 'teacher' });
    this.teachersCache = res.users || [];

    const groupsRes = await Api.groups.getAll();
    this.groupsCache = groupsRes.groups || [];

    return this.renderTeachersTable();
  },

  renderTeachersTable() {
    let teachers = [...this.teachersCache];

    // Filterlash
    if (this.filters.teacherSearch) {
      const q = this.filters.teacherSearch.toLowerCase();
      teachers = teachers.filter(t => (t.name || '').toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q));
    }
    if (this.filters.teacherStatus === 'active') {
      teachers = teachers.filter(t => t.is_active === 1);
    } else if (this.filters.teacherStatus === 'blocked') {
      teachers = teachers.filter(t => t.is_active === 0);
    }

    const rows = teachers.length === 0 ? `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <div>O'qituvchilar topilmadi</div>
        </td>
      </tr>
    ` : teachers.map((t, idx) => {
      const assignedGroups = t.assigned_groups || [];
      const groupsHtml = assignedGroups.length > 0
        ? assignedGroups.map(g => `<span class="teacher-group-tag"><i class="fas fa-users"></i> ${g.name}</span>`).join(' ')
        : `<span style="font-size: 0.775rem; color: var(--text-muted); font-style: italic;">Biriktirilmagan</span>`;

      return `
        <tr>
          <td style="width: 50px;"><strong>#${idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${t.name}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${t.email}</div>
          </td>
          <td style="max-width: 250px;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center;">
              ${groupsHtml}
              <button class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="AdminView.showTeacherGroupsModal(${t.id})" title="Guruhlarni biriktirish">
                <i class="fas fa-cog"></i>
              </button>
            </div>
          </td>
          <td>
            <span class="badge" style="background: var(--bg-alt); color: var(--text-main);">
              <i class="fas fa-book"></i> ${t.assignments_count || 0} ta
            </span>
          </td>
          <td>
            ${t.is_active === 1 
              ? `<span class="badge badge-active"><i class="fas fa-check-circle"></i> Faol</span>` 
              : `<span class="badge badge-blocked"><i class="fas fa-ban"></i> Bloklangan</span>`}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="AdminView.showEditUserModal(${t.id})" title="Tahrirlash">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn ${t.is_active === 1 ? 'btn-outline-danger' : 'btn-success'} btn-sm" onclick="AdminView.toggleUserStatus(${t.id}, '${t.name.replace(/'/g, "\\'")}', ${t.is_active})" title="${t.is_active === 1 ? 'Bloklash' : 'Faollashtirish'}">
                <i class="fas ${t.is_active === 1 ? 'fa-lock' : 'fa-unlock'}"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteUser(${t.id}, '${t.name.replace(/'/g, "\\'")}', 'teacher')" title="O'chirish">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div class="card-title">
            <i class="fas fa-chalkboard-teacher text-primary"></i> Professor-O'qituvchilar Ro'yxati (${teachers.length})
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminView.showAddTeacherModal()">
            <i class="fas fa-plus"></i> Yangi O'qituvchi Qo'shish
          </button>
        </div>

        <div class="card-body" style="padding-bottom: 0;">
          <!-- Toolbar -->
          <div class="admin-toolbar">
            <div class="admin-search-box">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Ism yoki email bo'yicha qidirish..." value="${this.filters.teacherSearch}" oninput="AdminView.handleTeacherSearch(this.value)">
            </div>
            <div class="admin-filters">
              <select class="form-select" style="width: auto; min-width: 140px;" onchange="AdminView.handleTeacherStatusFilter(this.value)">
                <option value="" ${this.filters.teacherStatus === '' ? 'selected' : ''}>Barcha holatlar</option>
                <option value="active" ${this.filters.teacherStatus === 'active' ? 'selected' : ''}>Faqat Faol</option>
                <option value="blocked" ${this.filters.teacherStatus === 'blocked' ? 'selected' : ''}>Faqat Bloklangan</option>
              </select>
            </div>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>O'qituvchi</th>
                <th>Biriktirilgan Guruhlar</th>
                <th>Topshiriqlari</th>
                <th>Holat</th>
                <th style="text-align: right;">Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleTeacherSearch(val) {
    this.filters.teacherSearch = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderTeachersTable();
  },

  handleTeacherStatusFilter(val) {
    this.filters.teacherStatus = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderTeachersTable();
  },

  // =========================================================================
  // 3. TALABALAR BOSHQARUVI TABI
  // =========================================================================
  async renderStudentsTab() {
    const res = await Api.users.getAll({ role: 'student' });
    this.studentsCache = res.users || [];

    const groupsRes = await Api.groups.getAll();
    this.groupsCache = groupsRes.groups || [];

    return this.renderStudentsTable();
  },

  renderStudentsTable() {
    let students = [...this.studentsCache];

    // Filterlash
    if (this.filters.studentSearch) {
      const q = this.filters.studentSearch.toLowerCase();
      students = students.filter(s => (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
    }
    if (this.filters.studentGroup) {
      students = students.filter(s => String(s.group_id) === String(this.filters.studentGroup));
    }
    if (this.filters.studentStatus === 'active') {
      students = students.filter(s => s.is_active === 1);
    } else if (this.filters.studentStatus === 'blocked') {
      students = students.filter(s => s.is_active === 0);
    }

    const groupOptions = (this.groupsCache || []).map(g => `
      <option value="${g.id}" ${String(this.filters.studentGroup) === String(g.id) ? 'selected' : ''}>${g.name}</option>
    `).join('');

    const rows = students.length === 0 ? `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-user-graduate" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <div>Talabalar topilmadi</div>
        </td>
      </tr>
    ` : students.map((s, idx) => `
      <tr>
        <td style="width: 50px;"><strong>#${idx + 1}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${s.name}</div>
          <div style="font-size: 0.775rem; color: var(--text-muted);">${s.email}</div>
        </td>
        <td>
          ${s.group_name 
            ? `<span class="badge" style="background: var(--bg-alt); color: var(--text-main);"><i class="fas fa-users"></i> ${s.group_name}</span>` 
            : `<span style="color: var(--text-light); font-style: italic;">Guruhsiz</span>`}
        </td>
        <td>
          <span class="badge badge-reviewed">${s.submissions_count || 0} ta ish</span>
        </td>
        <td>
          <strong style="color: var(--primary);">${s.avg_score !== null && s.avg_score !== undefined ? s.avg_score : '-'}</strong>
        </td>
        <td>
          ${s.is_active === 1 
            ? `<span class="badge badge-active"><i class="fas fa-check-circle"></i> Faol</span>` 
            : `<span class="badge badge-blocked"><i class="fas fa-ban"></i> Bloklangan</span>`}
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="AdminView.showEditUserModal(${s.id})" title="Tahrirlash / Guruhni o'zgartirish">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn ${s.is_active === 1 ? 'btn-outline-danger' : 'btn-success'} btn-sm" onclick="AdminView.toggleUserStatus(${s.id}, '${s.name.replace(/'/g, "\\'")}', ${s.is_active})" title="${s.is_active === 1 ? 'Bloklash' : 'Faollashtirish'}">
              <i class="fas ${s.is_active === 1 ? 'fa-lock' : 'fa-unlock'}"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteUser(${s.id}, '${s.name.replace(/'/g, "\\'")}', 'student')" title="O'chirish">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div class="card-title">
            <i class="fas fa-user-graduate text-primary"></i> Talabalar Ro'yxati (${students.length})
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminView.showAddStudentModal()">
            <i class="fas fa-plus"></i> Yangi Talaba Qo'shish
          </button>
        </div>

        <div class="card-body" style="padding-bottom: 0;">
          <div class="admin-toolbar">
            <div class="admin-search-box">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Talaba ismi yoki email bo'yicha qidirish..." value="${this.filters.studentSearch}" oninput="AdminView.handleStudentSearch(this.value)">
            </div>
            <div class="admin-filters">
              <select class="form-select" style="width: auto; min-width: 160px;" onchange="AdminView.handleStudentGroupFilter(this.value)">
                <option value="">Barcha guruhlar</option>
                ${groupOptions}
              </select>
              <select class="form-select" style="width: auto; min-width: 140px;" onchange="AdminView.handleStudentStatusFilter(this.value)">
                <option value="" ${this.filters.studentStatus === '' ? 'selected' : ''}>Barcha holatlar</option>
                <option value="active" ${this.filters.studentStatus === 'active' ? 'selected' : ''}>Faqat Faol</option>
                <option value="blocked" ${this.filters.studentStatus === 'blocked' ? 'selected' : ''}>Faqat Bloklangan</option>
              </select>
            </div>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Talaba</th>
                <th>Akademik Guruh</th>
                <th>Topshirgan</th>
                <th>O'rtacha Ball</th>
                <th>Holat</th>
                <th style="text-align: right;">Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleStudentSearch(val) {
    this.filters.studentSearch = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderStudentsTable();
  },

  handleStudentGroupFilter(val) {
    this.filters.studentGroup = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderStudentsTable();
  },

  handleStudentStatusFilter(val) {
    this.filters.studentStatus = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderStudentsTable();
  },

  // =========================================================================
  // 4. GURUHLAR BOSHQARUVI TABI
  // =========================================================================
  async renderGroupsTab() {
    const res = await Api.groups.getAll();
    this.groupsCache = res.groups || [];
    return this.renderGroupsTable();
  },

  renderGroupsTable() {
    let groups = [...this.groupsCache];

    if (this.filters.groupSearch) {
      const q = this.filters.groupSearch.toLowerCase();
      groups = groups.filter(g => (g.name || '').toLowerCase().includes(q));
    }

    const rows = groups.length === 0 ? `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-layer-group" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <div>Guruhlar topilmadi</div>
        </td>
      </tr>
    ` : groups.map((g, idx) => {
      const teachers = g.teachers || [];
      const teacherNames = teachers.length > 0
        ? teachers.map(t => `<span class="teacher-group-tag"><i class="fas fa-chalkboard-teacher"></i> ${t.name}</span>`).join(' ')
        : `<span style="font-size: 0.775rem; color: var(--text-muted); font-style: italic;">Biriktirilmagan</span>`;

      return `
        <tr>
          <td style="width: 50px;"><strong>#${idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${g.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${AppUI.formatDate(g.created_at)}</div>
          </td>
          <td>
            <span class="badge" style="background: var(--bg-alt); color: var(--text-main);">
              <i class="fas fa-user-graduate"></i> ${g.student_count || 0} nafar talaba
            </span>
          </td>
          <td style="max-width: 250px;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center;">
              ${teacherNames}
              <button class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="AdminView.showAssignTeacherModal(${g.id})" title="O'qituvchilarni biriktirish">
                <i class="fas fa-user-plus"></i>
              </button>
            </div>
          </td>
          <td>
            <span class="badge badge-reviewed">
              <i class="fas fa-book"></i> ${g.assignment_count || 0} ta topshiriq (${g.submission_count || 0} ish)
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="AdminView.showGroupDetailsModal(${g.id})" title="Guruh tafsiloti va talabalari">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="AdminView.showEditGroupModal(${g.id})" title="Nomini tahrirlash">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteGroup(${g.id}, '${g.name.replace(/'/g, "\\'")}')" title="O'chirish">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div class="card-title">
            <i class="fas fa-users-class text-primary"></i> Akademik Guruhlar (${groups.length})
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminView.showAddGroupModal()">
            <i class="fas fa-plus"></i> Yangi Guruh Yaratish
          </button>
        </div>

        <div class="card-body" style="padding-bottom: 0;">
          <div class="admin-toolbar">
            <div class="admin-search-box">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Guruh nomi bo'yicha qidirish..." value="${this.filters.groupSearch}" oninput="AdminView.handleGroupSearch(this.value)">
            </div>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Guruh Nomi</th>
                <th>Talabalar Soni</th>
                <th>Biriktirilgan O'qituvchilar</th>
                <th>Topshiriqlar</th>
                <th style="text-align: right;">Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleGroupSearch(val) {
    this.filters.groupSearch = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderGroupsTable();
  },

  // =========================================================================
  // 5. MUSTAQIL TOPSHIRIQLAR TABI
  // =========================================================================
  async renderAssignmentsTab() {
    const res = await Api.assignments.getAll();
    this.assignmentsCache = res.assignments || [];

    const groupsRes = await Api.groups.getAll();
    this.groupsCache = groupsRes.groups || [];

    return this.renderAssignmentsTable();
  },

  renderAssignmentsTable() {
    let assignments = [...this.assignmentsCache];

    if (this.filters.assignmentSearch) {
      const q = this.filters.assignmentSearch.toLowerCase();
      assignments = assignments.filter(a => 
        (a.title || '').toLowerCase().includes(q) || 
        (a.subject || '').toLowerCase().includes(q) ||
        (a.teacher_name || '').toLowerCase().includes(q)
      );
    }

    if (this.filters.assignmentGroup) {
      assignments = assignments.filter(a => String(a.group_id) === String(this.filters.assignmentGroup));
    }

    const groupOptions = (this.groupsCache || []).map(g => `
      <option value="${g.id}" ${String(this.filters.assignmentGroup) === String(g.id) ? 'selected' : ''}>${g.name}</option>
    `).join('');

    const rows = assignments.length === 0 ? `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-book-open" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <div>Topshiriqlar topilmadi</div>
        </td>
      </tr>
    ` : assignments.map((a, idx) => `
      <tr>
        <td style="width: 50px;"><strong>#${idx + 1}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${a.title}</div>
          <div style="font-size: 0.775rem; color: var(--primary); font-weight: 600;">${a.subject || 'Fan ko\'rsatilmagan'}</div>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.85rem;">${a.teacher_name || '-'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-users"></i> ${a.group_name}</div>
        </td>
        <td>
          <div style="font-size: 0.8rem;">
            <span><i class="fas fa-redo"></i> Urinishlar: <strong>${a.attempts_limit || 1}</strong></span><br>
            <span><i class="fas fa-clock"></i> Vaqt: <strong>${a.time_limit_minutes ? a.time_limit_minutes + ' daqiqa' : 'Cheksiz'}</strong></span>
          </div>
        </td>
        <td>
          <span class="badge badge-reviewed" style="cursor: pointer;" onclick="AdminView.filterSubmissionsByAssignment(${a.id})" title="Natijalarni ko'rish">
            <i class="fas fa-check-double"></i> ${a.total_submissions || 0} ta topshirilgan
          </span>
          ${a.graded_count ? `<div style="font-size: 0.725rem; color: var(--success); margin-top: 0.2rem;"><i class="fas fa-check"></i> ${a.graded_count} baholangan</div>` : ''}
        </td>
        <td>
          <div style="font-size: 0.775rem; color: var(--text-muted);">
            <div>Yaratilgan: ${AppUI.formatDate(a.created_at)}</div>
            ${a.due_date ? `<div style="color: var(--danger);">Muddat: ${AppUI.formatDate(a.due_date)}</div>` : ''}
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="AdminView.showAssignmentDetailsModal(${a.id})" title="Topshiriq tafsilotlari">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline btn-sm" onclick="AdminView.filterSubmissionsByAssignment(${a.id})" title="Javoblar ro'yxati">
              <i class="fas fa-inbox"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteAssignment(${a.id}, '${a.title.replace(/'/g, "\\'")}')" title="O'chirish">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div class="card-title">
            <i class="fas fa-book-open text-primary"></i> Barcha Mustaqil Topshiriqlar (${assignments.length})
          </div>
        </div>

        <div class="card-body" style="padding-bottom: 0;">
          <div class="admin-toolbar">
            <div class="admin-search-box">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Topshiriq, fan yoki o'qituvchi bo'yicha qidirish..." value="${this.filters.assignmentSearch}" oninput="AdminView.handleAssignmentSearch(this.value)">
            </div>
            <div class="admin-filters">
              <select class="form-select" style="width: auto; min-width: 160px;" onchange="AdminView.handleAssignmentGroupFilter(this.value)">
                <option value="">Barcha guruhlar</option>
                ${groupOptions}
              </select>
            </div>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Topshiriq va Fan</th>
                <th>O'qituvchi / Guruh</th>
                <th>Urinish & Vaqt</th>
                <th>Topshirganlar</th>
                <th>Muddatlar</th>
                <th style="text-align: right;">Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleAssignmentSearch(val) {
    this.filters.assignmentSearch = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderAssignmentsTable();
  },

  handleAssignmentGroupFilter(val) {
    this.filters.assignmentGroup = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderAssignmentsTable();
  },

  filterSubmissionsByAssignment(assignmentId) {
    this.filters.submissionSearch = '';
    this.currentTab = 'submissions';
    this.switchTab('submissions');
  },

  // =========================================================================
  // 6. TALABALAR TOPSHIRGAN ISHLAR TABI
  // =========================================================================
  async renderSubmissionsTab() {
    const res = await Api.submissions.getAll();
    this.submissionsCache = res.submissions || [];

    const groupsRes = await Api.groups.getAll();
    this.groupsCache = groupsRes.groups || [];

    return this.renderSubmissionsTable();
  },

  renderSubmissionsTable() {
    let subs = [...this.submissionsCache];

    if (this.filters.submissionSearch) {
      const q = this.filters.submissionSearch.toLowerCase();
      subs = subs.filter(s => 
        (s.student_name || '').toLowerCase().includes(q) ||
        (s.student_email || '').toLowerCase().includes(q) ||
        (s.assignment_title || '').toLowerCase().includes(q) ||
        (s.teacher_name || '').toLowerCase().includes(q)
      );
    }

    if (this.filters.submissionStatus) {
      subs = subs.filter(s => s.status === this.filters.submissionStatus);
    }

    if (this.filters.submissionGroup) {
      subs = subs.filter(s => String(s.group_id) === String(this.filters.submissionGroup));
    }

    const groupOptions = (this.groupsCache || []).map(g => `
      <option value="${g.id}" ${String(this.filters.submissionGroup) === String(g.id) ? 'selected' : ''}>${g.name}</option>
    `).join('');

    const rows = subs.length === 0 ? `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <div>Topshirilgan ishlar topilmadi</div>
        </td>
      </tr>
    ` : subs.map((s, idx) => {
      let statusBadge = `<span class="badge badge-pending">Navbatda</span>`;
      if (s.status === 'reviewed') statusBadge = `<span class="badge badge-reviewed">AI Tekshirgan</span>`;
      if (s.status === 'graded') statusBadge = `<span class="badge badge-graded">O'qituvchi Baholagan</span>`;

      return `
        <tr>
          <td style="width: 50px;"><strong>#${idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${s.student_name}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);"><i class="fas fa-users"></i> ${s.group_name || 'Guruhsiz'}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.875rem;">${s.assignment_title}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-chalkboard-teacher"></i> ${s.teacher_name || '-'}</div>
          </td>
          <td>
            <span class="badge" style="background: var(--bg-alt); color: var(--text-main);">
              Urinish #${s.attempt_number || 1}
            </span>
          </td>
          <td>
            ${s.file_name ? `
              <button class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="AdminView.downloadSubmissionFile(${s.id}, '${s.file_name.replace(/'/g, "\\'")}')" title="Xavfsiz yuklab olish">
                <i class="fas fa-paperclip text-primary"></i> ${s.file_name.length > 20 ? s.file_name.slice(0, 18) + '...' : s.file_name}
              </button>
            ` : `<span style="color: var(--text-light); font-size: 0.75rem;">Matnli javob</span>`}
          </td>
          <td>
            <div>${statusBadge}</div>
            <div style="font-size: 0.775rem; margin-top: 0.2rem;">
              AI Tavsiya: <strong>${s.recommended_score !== null && s.recommended_score !== undefined ? s.recommended_score + '%' : '-'}</strong>
            </div>
          </td>
          <td>
            <strong style="color: ${s.teacher_score !== null ? 'var(--success)' : 'var(--text-muted)'}; font-size: 1rem;">
              ${s.teacher_score !== null && s.teacher_score !== undefined ? s.teacher_score : 'Kutilmoqda'}
            </strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">/ ${s.max_score || 100}</span>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="AdminView.showSubmissionDetailsModal(${s.id})" title="To'liq tahlilni ko'rish">
                <i class="fas fa-eye"></i> Tahlil
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div class="card-title">
            <i class="fas fa-inbox text-primary"></i> Talabalar Topshirgan Barcha Ishlar (${subs.length})
          </div>
        </div>

        <div class="card-body" style="padding-bottom: 0;">
          <div class="admin-toolbar">
            <div class="admin-search-box">
              <i class="fas fa-search"></i>
              <input type="text" class="form-control" placeholder="Talaba, topshiriq yoki o'qituvchi bo'yicha qidirish..." value="${this.filters.submissionSearch}" oninput="AdminView.handleSubmissionSearch(this.value)">
            </div>
            <div class="admin-filters">
              <select class="form-select" style="width: auto; min-width: 150px;" onchange="AdminView.handleSubmissionStatusFilter(this.value)">
                <option value="" ${this.filters.submissionStatus === '' ? 'selected' : ''}>Barcha holatlar</option>
                <option value="reviewed" ${this.filters.submissionStatus === 'reviewed' ? 'selected' : ''}>AI Tekshirgan</option>
                <option value="graded" ${this.filters.submissionStatus === 'graded' ? 'selected' : ''}>Baholangan</option>
                <option value="pending" ${this.filters.submissionStatus === 'pending' ? 'selected' : ''}>Navbatda</option>
              </select>
              <select class="form-select" style="width: auto; min-width: 160px;" onchange="AdminView.handleSubmissionGroupFilter(this.value)">
                <option value="">Barcha guruhlar</option>
                ${groupOptions}
              </select>
            </div>
          </div>
        </div>

        <div class="table-container" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Talaba va Guruh</th>
                <th>Topshiriq va O'qituvchi</th>
                <th>Urinish</th>
                <th>Yuklangan Fayl</th>
                <th>AI Tahlil Holati</th>
                <th>Yakuniy Baho</th>
                <th style="text-align: right;">Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleSubmissionSearch(val) {
    this.filters.submissionSearch = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderSubmissionsTable();
  },

  handleSubmissionStatusFilter(val) {
    this.filters.submissionStatus = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderSubmissionsTable();
  },

  handleSubmissionGroupFilter(val) {
    this.filters.submissionGroup = val;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = this.renderSubmissionsTable();
  },

  // =========================================================================
  // MODALLAR VA AMALLAR
  // =========================================================================

  // Foydalanuvchi faolligini o'zgartirish (Bloklash / Faollashtirish)
  async toggleUserStatus(id, name, currentActiveState) {
    const actionName = currentActiveState === 1 ? 'bloklashni' : 'faollashtirishni';
    if (!confirm(`"${name}" akkauntini ${actionName} xohlaysizmi?`)) return;

    try {
      const res = await Api.users.toggleStatus(id, currentActiveState === 0);
      AppUI.showToast('success', 'Muvaffaqiyatli', res.message || 'Holat o\'zgartirildi.');
      
      // Keshni yangilaymiz
      const userT = this.teachersCache.find(u => u.id === id);
      if (userT) userT.is_active = res.is_active;

      const userS = this.studentsCache.find(u => u.id === id);
      if (userS) userS.is_active = res.is_active;

      if (this.currentTab === 'teachers') {
        const content = document.getElementById('admin-tab-content');
        if (content) content.innerHTML = this.renderTeachersTable();
      } else if (this.currentTab === 'students') {
        const content = document.getElementById('admin-tab-content');
        if (content) content.innerHTML = this.renderStudentsTable();
      } else {
        await this.refreshCurrentTab();
      }
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Foydalanuvchini o'chirish (Tasdiqlash va xavfsizlik nazorati bilan)
  async deleteUser(id, name, role) {
    if (!confirm(`Haqiqatan ham "${name}" foydalanuvchisini o'chirmoqchimisiz?`)) return;

    try {
      await Api.users.delete(id);
      AppUI.showToast('success', 'O\'chirildi', `"${name}" foydalanuvchisi o'chirildi.`);
      await this.refreshCurrentTab();
    } catch (err) {
      if (err.data && (err.data.hasSubmissions || err.data.hasAssignments)) {
        const confirmForce = confirm(`${err.message}\n\nDiqqat: Baribir majburiy o'chirishni tasdiqlaysizmi?`);
        if (confirmForce) {
          try {
            await Api.users.delete(id, true);
            AppUI.showToast('success', 'O\'chirildi', 'Foydalanuvchi majburiy tarzda o\'chirildi.');
            await this.refreshCurrentTab();
          } catch (forceErr) {
            AppUI.showToast('danger', 'Xatolik', forceErr.message);
          }
        }
      } else {
        AppUI.showToast('danger', 'Xatolik', err.message);
      }
    }
  },

  // Yangi O'qituvchi qo'shish modali
  async showAddTeacherModal() {
    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    const groupCheckboxes = groups.map(g => `
      <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; font-size: 0.85rem; cursor: pointer;">
        <input type="checkbox" name="teacher_groups" value="${g.id}">
        <span>${g.name}</span>
      </label>
    `).join('');

    const html = `
      <form id="modal-form-add-teacher" onsubmit="AdminView.handleAddTeacher(event)">
        <div class="form-group">
          <label class="form-label required">O'qituvchining Ism-sharifi</label>
          <input type="text" id="new-teacher-name" class="form-control" placeholder="Masalan: Dotsent Karimova Nargiza" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Email</label>
          <input type="email" id="new-teacher-email" class="form-control" placeholder="teacher@unitask.uz" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Parol</label>
          <input type="password" id="new-teacher-pass" class="form-control" placeholder="Kamida 6 belgi" required minlength="6" />
        </div>
        <div class="form-group">
          <label class="form-label">Biriktiriladigan Akademik Guruhlar</label>
          <div style="max-height: 140px; overflow-y: auto; background: var(--bg-alt); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
            ${groupCheckboxes || '<span style="color: var(--text-muted); font-size: 0.8rem;">Guruhlar mavjud emas</span>'}
          </div>
          <div class="form-hint">O'qituvchi ushbu guruhlarga topshiriq berishi mumkin bo'ladi.</div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary" id="btn-save-teacher">O'qituvchini Saqlash</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-chalkboard-teacher text-primary"></i> Yangi O\'qituvchi Yaratish', html);
  },

  async handleAddTeacher(event) {
    event.preventDefault();
    const name = document.getElementById('new-teacher-name').value;
    const email = document.getElementById('new-teacher-email').value;
    const password = document.getElementById('new-teacher-pass').value;
    
    const checkboxes = document.querySelectorAll('input[name="teacher_groups"]:checked');
    const assigned_groups = Array.from(checkboxes).map(c => parseInt(c.value, 10));

    try {
      await Api.users.create({ name, email, password, role: 'teacher', assigned_groups });
      AppUI.showToast('success', 'Yaratildi', `O'qituvchi "${name}" muvaffaqiyatli qo'shildi.`);
      AppUI.closeModal();
      this.currentTab = 'teachers';
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Yangi Talaba qo'shish modali
  async showAddStudentModal() {
    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const html = `
      <form id="modal-form-add-student" onsubmit="AdminView.handleAddStudent(event)">
        <div class="form-group">
          <label class="form-label required">Talabaning Ism-sharifi</label>
          <input type="text" id="new-student-name" class="form-control" placeholder="Masalan: Rustamov Jasur" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Email</label>
          <input type="email" id="new-student-email" class="form-control" placeholder="student@unitask.uz" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Parol</label>
          <input type="password" id="new-student-pass" class="form-control" placeholder="Kamida 6 belgi" required minlength="6" />
        </div>
        <div class="form-group">
          <label class="form-label required">Akademik Guruh</label>
          <select id="new-student-group" class="form-select" required>
            <option value="">-- Guruhni tanlang --</option>
            ${groupOptions}
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary">Talabani Saqlash</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-user-graduate text-primary"></i> Yangi Talaba Yaratish', html);
  },

  async handleAddStudent(event) {
    event.preventDefault();
    const name = document.getElementById('new-student-name').value;
    const email = document.getElementById('new-student-email').value;
    const password = document.getElementById('new-student-pass').value;
    const group_id = document.getElementById('new-student-group').value;

    try {
      await Api.users.create({ name, email, password, role: 'student', group_id });
      AppUI.showToast('success', 'Yaratildi', `Talaba "${name}" muvaffaqiyatli qo'shildi.`);
      AppUI.closeModal();
      this.currentTab = 'students';
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Umumiy Yangi Foydalanuvchi Modali
  async showAddUserModal() {
    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const html = `
      <form id="modal-form-add-user" onsubmit="AdminView.handleAddUser(event)">
        <div class="form-group">
          <label class="form-label required">To'liq Ism-sharifi</label>
          <input type="text" id="new-user-name" class="form-control" placeholder="Ism Familiya" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Email</label>
          <input type="email" id="new-user-email" class="form-control" placeholder="user@unitask.uz" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Parol</label>
          <input type="password" id="new-user-pass" class="form-control" placeholder="Kamida 6 belgi" required minlength="6" />
        </div>
        <div class="form-group">
          <label class="form-label required">Rol</label>
          <select id="new-user-role" class="form-select" onchange="AdminView.toggleUserGroupField(this.value)" required>
            <option value="student">Talaba</option>
            <option value="teacher">O'qituvchi</option>
            <option value="admin">Super Admin</option>
          </select>
        </div>
        <div class="form-group" id="modal-group-field">
          <label class="form-label">Akademik Guruh (Talabalar uchun)</label>
          <select id="new-user-group" class="form-select">
            <option value="">-- Guruhni tanlang --</option>
            ${groupOptions}
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary" id="btn-save-user">Yaratish</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-user-plus text-primary"></i> Yangi Foydalanuvchi Yaratish', html);
  },

  toggleUserGroupField(role) {
    const groupField = document.getElementById('modal-group-field');
    if (groupField) {
      groupField.style.display = (role === 'student') ? 'block' : 'none';
    }
  },

  async handleAddUser(event) {
    event.preventDefault();
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;
    const group_id = role === 'student' ? document.getElementById('new-user-group').value : null;

    try {
      await Api.users.create({ name, email, password, role, group_id });
      AppUI.showToast('success', 'Yaratildi', `Foydalanuvchi ${name} qo'shildi.`);
      AppUI.closeModal();
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Foydalanuvchini Tahrirlash Modali
  async showEditUserModal(id) {
    const userRes = await Api.users.getById(id);
    const user = userRes.user;
    if (!user) return;

    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    const groupOptions = groups.map(g => `
      <option value="${g.id}" ${user.group_id === g.id ? 'selected' : ''}>${g.name}</option>
    `).join('');

    const html = `
      <form id="modal-form-edit-user" onsubmit="AdminView.handleEditUser(event, ${id})">
        <div class="form-group">
          <label class="form-label required">Ism-sharif</label>
          <input type="text" id="edit-user-name" class="form-control" value="${user.name}" required />
        </div>
        <div class="form-group">
          <label class="form-label required">Email</label>
          <input type="email" id="edit-user-email" class="form-control" value="${user.email}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Yangi Parol (O'zgartirish shart bo'lmasa bo'sh qoldiring)</label>
          <input type="password" id="edit-user-pass" class="form-control" placeholder="Yangi parol (ixtiyoriy)" minlength="6" />
        </div>
        <div class="form-group">
          <label class="form-label required">Rol</label>
          <select id="edit-user-role" class="form-select" onchange="AdminView.toggleUserGroupField(this.value)" required>
            <option value="student" ${user.role === 'student' ? 'selected' : ''}>Talaba</option>
            <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>O'qituvchi</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Super Admin</option>
          </select>
        </div>
        <div class="form-group" id="modal-group-field" style="display: ${user.role === 'student' ? 'block' : 'none'};">
          <label class="form-label">Akademik Guruh</label>
          <select id="edit-user-group" class="form-select">
            <option value="">-- Guruh yo'q --</option>
            ${groupOptions}
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary">Saqlash</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-user-edit text-primary"></i> Foydalanuvchini Tahrirlash', html);
  },

  async handleEditUser(event, id) {
    event.preventDefault();
    const name = document.getElementById('edit-user-name').value;
    const email = document.getElementById('edit-user-email').value;
    const password = document.getElementById('edit-user-pass').value;
    const role = document.getElementById('edit-user-role').value;
    const group_id = role === 'student' ? document.getElementById('edit-user-group').value : null;

    try {
      await Api.users.update(id, { name, email, password, role, group_id });
      AppUI.showToast('success', 'Yangilandi', 'Foydalanuvchi ma\'lumotlari muvaffaqiyatli saqlandi.');
      AppUI.closeModal();
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // O'qituvchiga Guruhlarni Biriktirish Modali
  async showTeacherGroupsModal(teacherId) {
    const userRes = await Api.users.getById(teacherId);
    const teacher = userRes.user;
    if (!teacher) return;

    const groupsRes = await Api.groups.getAll();
    const allGroups = groupsRes.groups || [];
    const assignedIds = new Set((teacher.assigned_groups || []).map(g => g.id));

    const checkboxes = allGroups.map(g => `
      <label style="display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem; cursor: pointer;">
        <input type="checkbox" name="assign_groups_list" value="${g.id}" ${assignedIds.has(g.id) ? 'checked' : ''}>
        <span><strong>${g.name}</strong> (${g.student_count || 0} nafar talaba)</span>
      </label>
    `).join('');

    const html = `
      <form onsubmit="AdminView.handleAssignTeacherGroups(event, ${teacherId})">
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">
          <strong>${teacher.name}</strong> o'qituvchisi biriktiriladigan akademik guruhlarni belgilang:
        </p>
        <div style="max-height: 240px; overflow-y: auto; padding: 0.5rem; background: var(--bg-alt); border-radius: var(--radius-md); border: 1px solid var(--border);">
          ${checkboxes || '<span style="color: var(--text-muted);">Guruhlar mavjud emas</span>'}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary">Guruhlarni Saqlash</button>
        </div>
      </form>
    `;
    AppUI.openModal(`<i class="fas fa-chalkboard-teacher text-primary"></i> Guruhlarni Biriktirish (${teacher.name})`, html);
  },

  async handleAssignTeacherGroups(event, teacherId) {
    event.preventDefault();
    const checkboxes = document.querySelectorAll('input[name="assign_groups_list"]:checked');
    const group_ids = Array.from(checkboxes).map(c => parseInt(c.value, 10));

    try {
      await Api.users.assignGroups(teacherId, group_ids);
      AppUI.showToast('success', 'Biriktirildi', 'Guruhlar ro\'yxati yangilandi.');
      AppUI.closeModal();
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Guruhga O'qituvchi Biriktirish Modali
  async showAssignTeacherModal(groupId) {
    const groupRes = await Api.groups.getById(groupId);
    const group = groupRes.group;
    if (!group) return;

    const teachersRes = await Api.users.getAll({ role: 'teacher' });
    const allTeachers = teachersRes.users || [];
    const assignedIds = new Set((group.teachers || []).map(t => t.id));

    const options = allTeachers.filter(t => !assignedIds.has(t.id)).map(t => `
      <option value="${t.id}">${t.name} (${t.email})</option>
    `).join('');

    const assignedList = (group.teachers || []).map(t => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <span><i class="fas fa-chalkboard-teacher text-primary"></i> <strong>${t.name}</strong> (${t.email})</span>
        <button class="btn btn-outline-danger btn-sm" style="padding: 0.2rem 0.45rem;" onclick="AdminView.removeTeacherFromGroup(${groupId}, ${t.id})">
          <i class="fas fa-times"></i> Olib tashlash
        </button>
      </div>
    `).join('');

    const html = `
      <div>
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">Hozirgi Biriktirilgan O'qituvchilar:</h4>
          <div style="background: var(--bg-alt); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
            ${assignedList || '<span style="color: var(--text-muted); font-size: 0.85rem;">Hali birorta ham o\'qituvchi biriktirilmagan.</span>'}
          </div>
        </div>

        <form onsubmit="AdminView.handleAssignTeacherToGroup(event, ${groupId})">
          <div class="form-group">
            <label class="form-label required">Yangi O'qituvchi Qo'shish</label>
            <select id="select-assign-teacher" class="form-select" required>
              <option value="">-- O'qituvchini tanlang --</option>
              ${options}
            </select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
            <button type="submit" class="btn btn-primary" ${options ? '' : 'disabled'}>Biriktirish</button>
          </div>
        </form>
      </div>
    `;
    AppUI.openModal(`<i class="fas fa-users-class text-primary"></i> Guruh O'qituvchilari: ${group.name}`, html);
  },

  async handleAssignTeacherToGroup(event, groupId) {
    event.preventDefault();
    const teacherId = document.getElementById('select-assign-teacher').value;
    if (!teacherId) return;

    try {
      await Api.groups.assignTeacher(groupId, teacherId);
      AppUI.showToast('success', 'Biriktirildi', 'O\'qituvchi guruhga biriktirildi.');
      this.showAssignTeacherModal(groupId);
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  async removeTeacherFromGroup(groupId, teacherId) {
    if (!confirm('Ushbu o\'qituvchini guruhdan olib tashlashni tasdiqlaysizmi?')) return;
    try {
      await Api.groups.removeTeacher(groupId, teacherId);
      AppUI.showToast('success', 'Olib tashlandi', 'O\'qituvchi guruhdan chiqarildi.');
      this.showAssignTeacherModal(groupId);
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Yangi Guruh Qo'shish Modali
  showAddGroupModal() {
    const html = `
      <form id="modal-form-add-group" onsubmit="AdminView.handleAddGroup(event)">
        <div class="form-group">
          <label class="form-label required">Guruh Nomi</label>
          <input type="text" id="new-group-name" class="form-control" placeholder="Masalan: 912-20 Guruh (Dasturiy injiniring)" required autofocus />
          <div class="form-hint">Yo'nalish va guruh raqami bilan aniq yozish tavsiya etiladi.</div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary" id="btn-save-group">Saqlash</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-layer-group text-primary"></i> Yangi Guruh Yaratish', html);
  },

  async handleAddGroup(event) {
    event.preventDefault();
    const name = document.getElementById('new-group-name').value;
    const btn = document.getElementById('btn-save-group');

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...`;

    try {
      await Api.groups.create({ name });
      AppUI.showToast('success', 'Yaratildi', `"${name}" guruhi muvaffaqiyatli qo'shildi.`);
      AppUI.closeModal();
      this.currentTab = 'groups';
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Saqlash`;
    }
  },

  // Guruh Nomini Tahrirlash Modali
  async showEditGroupModal(id) {
    const group = this.groupsCache.find(g => g.id === id);
    if (!group) return;

    const html = `
      <form onsubmit="AdminView.handleEditGroup(event, ${id})">
        <div class="form-group">
          <label class="form-label required">Guruh Nomi</label>
          <input type="text" id="edit-group-name" class="form-control" value="${group.name}" required autofocus />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary">Yangilash</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-edit text-primary"></i> Guruh Nomini Tahrirlash', html);
  },

  async handleEditGroup(event, id) {
    event.preventDefault();
    const name = document.getElementById('edit-group-name').value;

    try {
      await Api.groups.update(id, { name });
      AppUI.showToast('success', 'Yangilandi', 'Guruh nomi muvaffaqiyatli yangilandi.');
      AppUI.closeModal();
      await this.refreshCurrentTab();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Guruh Tafsiloti Modali (Talabalar, O'qituvchilar va Topshiriqlar)
  async showGroupDetailsModal(id) {
    try {
      const res = await Api.groups.getById(id);
      const g = res.group;

      const studentsHtml = (g.students || []).map((s, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td><strong>${s.name}</strong><br><small style="color: var(--text-muted);">${s.email}</small></td>
          <td>${s.submissions_count || 0} ta topshirgan</td>
          <td><strong>${s.avg_score || '-'}</strong></td>
          <td>${s.is_active === 1 ? '<span class="badge badge-active">Faol</span>' : '<span class="badge badge-blocked">Blok</span>'}</td>
        </tr>
      `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Talabalar yo'q</td></tr>`;

      const teachersHtml = (g.teachers || []).map(t => `
        <span class="teacher-group-tag"><i class="fas fa-chalkboard-teacher"></i> ${t.name} (${t.email})</span>
      `).join(' ') || '<span style="color: var(--text-muted); font-size: 0.85rem;">O\'qituvchilar biriktirilmagan</span>';

      const assignmentsHtml = (g.assignments || []).map(a => `
        <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 0.85rem;">
          <span><strong>${a.title}</strong> (${a.subject || 'Fan yo\'q'})</span>
          <span>${a.total_submissions || 0} ta topshirilgan</span>
        </div>
      `).join('') || '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">Hozircha topshiriqlar mavjud emas</div>';

      const html = `
        <div>
          <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
            <div style="flex: 1; background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.75rem; color: var(--text-muted);">Jami Talabalar</div>
              <div style="font-size: 1.25rem; font-weight: 700;">${g.students ? g.students.length : 0} nafar</div>
            </div>
            <div style="flex: 1; background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.75rem; color: var(--text-muted);">Topshiriqlar Soni</div>
              <div style="font-size: 1.25rem; font-weight: 700;">${g.assignments ? g.assignments.length : 0} ta</div>
            </div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.4rem;">Biriktirilgan Professor-o'qituvchilar:</h4>
            <div>${teachersHtml}</div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.4rem;">Guruh Topshiriqlari:</h4>
            <div style="max-height: 120px; overflow-y: auto;">${assignmentsHtml}</div>
          </div>

          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.4rem;">Guruh Talabalari Ro'yxati:</h4>
            <div class="table-container" style="max-height: 220px; overflow-y: auto;">
              <table class="data-table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Talaba</th>
                    <th>Ishlar</th>
                    <th>O'rtacha</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentsHtml}
                </tbody>
              </table>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
          </div>
        </div>
      `;

      AppUI.openModal(`<i class="fas fa-users-class text-primary"></i> Guruh Tafsiloti: ${g.name}`, html);
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // Guruhni O'chirish
  async deleteGroup(id, name) {
    if (!confirm(`Haqiqatan ham "${name}" guruhini o'chirmoqchimisiz?`)) return;

    try {
      await Api.groups.delete(id);
      AppUI.showToast('success', 'O\'chirildi', `"${name}" guruhi o'chirildi.`);
      await this.refreshCurrentTab();
    } catch (err) {
      if (err.data && err.data.hasRelations) {
        const confirmForce = confirm(`${err.message}\n\nGuruhni baribir majburiy o'chirishni tasdiqlaysizmi? (Talabalar guruhsiz holatga o'tadi)`);
        if (confirmForce) {
          try {
            await Api.groups.delete(id, true);
            AppUI.showToast('success', 'O\'chirildi', 'Guruh majburiy tarzda o\'chirildi.');
            await this.refreshCurrentTab();
          } catch (fErr) {
            AppUI.showToast('danger', 'Xatolik', fErr.message);
          }
        }
      } else {
        AppUI.showToast('danger', 'Xatolik', err.message);
      }
    }
  },

  // Topshiriq Tafsilotlari Modali
  async showAssignmentDetailsModal(id) {
    try {
      const res = await Api.assignments.getById(id);
      const a = res.assignment;

      const questionsList = (a.questions || []).map((q, idx) => `
        <div style="background: var(--bg-alt); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 0.5rem; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.35rem;">
            <span>${idx + 1}-Savol (${q.question_type === 'closed' ? 'Yopiq test' : 'Ochiq savol'})</span>
            <span style="color: var(--primary);">${q.points} ball</span>
          </div>
          <div>${q.question_text}</div>
          ${q.instruction ? `<div style="font-size: 0.775rem; color: var(--text-muted); margin-top: 0.25rem;"><em>Ko'rsatma: ${q.instruction}</em></div>` : ''}
        </div>
      `).join('') || `<div style="font-size: 0.85rem; color: var(--text-muted);">${a.open_question || 'Savollar mavjud emas'}</div>`;

      const html = `
        <div>
          <div style="background: var(--bg-alt); padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.875rem;">
            <div><strong>Fan:</strong> ${a.subject || 'Ko\'rsatilmagan'}</div>
            <div><strong>O'qituvchi:</strong> ${a.teacher_name || '-'} (${a.teacher_email || ''})</div>
            <div><strong>Akademik Guruh:</strong> ${a.group_name}</div>
            <div><strong>Urinishlar chegarasi:</strong> ${a.attempts_limit || 1} ta | <strong>Test vaqti:</strong> ${a.time_limit_minutes ? a.time_limit_minutes + ' daqiqa' : 'Cheksiz'}</div>
            <div><strong>Maksimal Ball:</strong> ${a.total_points || 100} ball</div>
          </div>

          <div style="margin-bottom: 1rem;">
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.35rem;">Nazariy Material:</h4>
            <div style="max-height: 140px; overflow-y: auto; background: white; border: 1px solid var(--border); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; line-height: 1.5;">
              ${a.content || 'Material mavjud emas'}
            </div>
          </div>

          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.35rem;">Savollar (${(a.questions || []).length} ta):</h4>
            <div style="max-height: 200px; overflow-y: auto;">${questionsList}</div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
            <button type="button" class="btn btn-primary" onclick="AppUI.closeModal(); AdminView.filterSubmissionsByAssignment(${a.id});">
              <i class="fas fa-inbox"></i> Topshirilgan Ishlarni Ko'rish
            </button>
          </div>
        </div>
      `;
      AppUI.openModal(`<i class="fas fa-book-open text-primary"></i> Topshiriq: ${a.title}`, html);
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // Topshiriqni O'chirish
  async deleteAssignment(id, title) {
    if (!confirm(`"${title}" topshirig'ini o'chirishni tasdiqlaysizmi?`)) return;

    try {
      await Api.assignments.delete(id);
      AppUI.showToast('success', 'O\'chirildi', 'Topshiriq muvaffaqiyatli o\'chirildi.');
      await this.refreshCurrentTab();
    } catch (err) {
      if (err.data && err.data.hasSubmissions) {
        const confirmForce = confirm(`${err.message}\n\nDiqqat: Baribir majburiy o'chirishni tasdiqlaysizmi?`);
        if (confirmForce) {
          try {
            await Api.assignments.delete(id, true);
            AppUI.showToast('success', 'O\'chirildi', 'Topshiriq va uning barcha javoblari majburiy o\'chirildi.');
            await this.refreshCurrentTab();
          } catch (fErr) {
            AppUI.showToast('danger', 'Xatolik', fErr.message);
          }
        }
      } else {
        AppUI.showToast('danger', 'Xatolik', err.message);
      }
    }
  },

  // Topshirilgan Ish Tafsiloti va AI Xulosasi Modali
  async showSubmissionDetailsModal(id) {
    try {
      const res = await Api.submissions.getById(id);
      const s = res.submission;

      // Savollar va javoblar
      const answersHtml = (s.answers || []).map((ans, idx) => {
        let feedbackObj = ans.ai_feedback;
        return `
          <div style="background: var(--bg-alt); padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong>${idx + 1}-Savol (${ans.question_type === 'closed' ? 'Yopiq test' : 'Ochiq savol'}):</strong>
              <span class="badge ${ans.is_correct === 1 ? 'badge-graded' : (ans.is_correct === 0 ? 'badge-blocked' : 'badge-reviewed')}">
                ${ans.ai_score !== null ? ans.ai_score + ' ball' : 'Kutilmoqda'}
              </span>
            </div>
            <div style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-main);">${ans.question_text}</div>
            
            <div style="background: white; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 0.85rem; margin-bottom: 0.5rem;">
              <strong>Talabaning javobi:</strong> ${ans.question_type === 'closed' ? (ans.selected_option_key + ') ' + (ans.selected_option_text || '')) : (ans.answer_text || '<em style="color: var(--text-muted);">(Bo\'sh)</em>')}
            </div>

            ${feedbackObj ? `
              <div style="font-size: 0.8rem; color: var(--text-muted); background: #f8fafc; padding: 0.5rem; border-radius: var(--radius-sm);">
                ${feedbackObj.summary ? `<div><strong>AI Xulosasi:</strong> ${feedbackObj.summary}</div>` : ''}
                ${feedbackObj.strengths ? `<div style="color: var(--success);"><strong>Ijobiy:</strong> ${feedbackObj.strengths}</div>` : ''}
                ${feedbackObj.gaps ? `<div style="color: #b45309;"><strong>Kamchiliklar:</strong> ${feedbackObj.gaps}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('') || `
        <div style="background: white; border: 1px solid var(--border); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.875rem;">
          <strong>Talaba javobi:</strong><br>${s.student_answer || '(Javob kiritilmagan)'}
        </div>
      `;

      const html = `
        <div>
          <!-- Header info -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; background: var(--bg-alt); padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.825rem;">
            <div><strong>Talaba:</strong> ${s.student_name} (${s.group_name || 'Guruhsiz'})</div>
            <div><strong>Topshiriq:</strong> ${s.assignment_title}</div>
            <div><strong>O'qituvchi:</strong> ${s.teacher_name || '-'}</div>
            <div><strong>Urinish:</strong> #${s.attempt_number || 1}</div>
            <div><strong>Topshirilgan:</strong> ${AppUI.formatDate(s.submitted_at)}</div>
            <div><strong>Baho:</strong> ${s.teacher_score !== null ? `<span style="color: var(--success); font-weight: 700;">${s.teacher_score} / ${s.max_score || 100}</span>` : 'Tasdiqlanmagan'}</div>
          </div>

          <!-- Yuklangan Fayl (agar bo'lsa) -->
          ${s.file_name ? `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #eef2ff; border: 1px solid #c7d2fe; padding: 0.65rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
              <span><i class="fas fa-file-alt text-primary"></i> <strong>Biriktirilgan fayl:</strong> ${s.file_name}</span>
              <button class="btn btn-primary btn-sm" onclick="AdminView.downloadSubmissionFile(${s.id}, '${s.file_name.replace(/'/g, "\\'")}')">
                <i class="fas fa-download"></i> Yuklab Olish
              </button>
            </div>
          ` : ''}

          <!-- AI Umumiy Xulosasi -->
          <div class="card" style="margin-bottom: 1rem; border: 1px solid #e0e7ff; background: #fdfdfe;">
            <div class="card-header" style="padding: 0.65rem 1rem; background: #f8fafc;">
              <div class="card-title" style="font-size: 0.875rem;"><i class="fas fa-robot text-primary"></i> Sun'iy Intellekt Tahlili va Tavsiya Bali (${s.recommended_score !== null ? s.recommended_score + '%' : '-'})</div>
            </div>
            <div class="card-body" style="padding: 0.85rem 1rem; font-size: 0.85rem; line-height: 1.5;">
              <div><strong>Umumiy Xulosa:</strong> ${s.ai_summary || 'Xulosa yo\'q'}</div>
              ${s.ai_gaps ? `<div style="margin-top: 0.35rem; color: #b45309;"><strong>Aniqlangan Kamchiliklar:</strong> ${s.ai_gaps}</div>` : ''}
            </div>
          </div>

          <!-- Savollar tafsiloti -->
          <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.5rem;">Savollar va Javoblar:</h4>
          <div style="max-height: 260px; overflow-y: auto;">${answersHtml}</div>

          <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Yopish</button>
          </div>
        </div>
      `;

      AppUI.openModal(`<i class="fas fa-file-signature text-primary"></i> Javob Tafsiloti (Urinish #${s.attempt_number || 1})`, html);
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // Talaba Yuklagan Faylni Xavfsiz Yuklab Olish
  async downloadSubmissionFile(id, fileName) {
    try {
      AppUI.showToast('info', 'Yuklab olinmoqda', `${fileName} yuklab olinmoqda...`);
      await Api.submissions.downloadFile(id, fileName);
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  }
};
