/**
 * UniTask AI - Super Admin Boshqaruv Paneli
 */

const AdminView = {
  currentTab: 'stats', // 'stats' | 'groups' | 'users' | 'assignments'
  groupsCache: [],
  usersCache: [],

  async render() {
    return `
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em;">
              <i class="fas fa-shield-alt" style="color: var(--primary);"></i> Super Admin Paneli
            </h1>
            <p style="font-size: 0.875rem; color: var(--text-muted);">
              Universitet akademik guruhlari, o'qituvchi va talabalar akkauntlari hamda AI tizimini markazlashgan boshqarish.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem;" id="admin-header-actions">
            <button class="btn btn-outline btn-sm" onclick="AdminView.showAddGroupModal()">
              <i class="fas fa-plus"></i> Yangi Guruh Qo'shish
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminView.showAddUserModal()">
              <i class="fas fa-user-plus"></i> Foydalanuvchi Yaratish
            </button>
          </div>
        </div>

        <!-- Admin Tabs -->
        <div class="tabs-nav">
          <button class="tab-btn ${this.currentTab === 'stats' ? 'active' : ''}" onclick="AdminView.switchTab('stats')">
            <i class="fas fa-chart-line"></i> Umumiy Tahlil & Statistika
          </button>
          <button class="tab-btn ${this.currentTab === 'groups' ? 'active' : ''}" onclick="AdminView.switchTab('groups')">
            <i class="fas fa-users-class"></i> Akademik Guruhlar
          </button>
          <button class="tab-btn ${this.currentTab === 'users' ? 'active' : ''}" onclick="AdminView.switchTab('users')">
            <i class="fas fa-user-shield"></i> Foydalanuvchilar (RBAC)
          </button>
          <button class="tab-btn ${this.currentTab === 'assignments' ? 'active' : ''}" onclick="AdminView.switchTab('assignments')">
            <i class="fas fa-book-open"></i> Barcha Topshiriqlar
          </button>
        </div>

        <!-- Content Container -->
        <div id="admin-tab-content">
          ${await this.renderTabContent()}
        </div>
      </div>
    `;
  },

  async switchTab(tab) {
    this.currentTab = tab;
    const content = document.getElementById('admin-tab-content');
    content.innerHTML = `<div style="text-align: center; padding: 3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>`;
    
    // Update active tab buttons
    document.querySelectorAll('.tabs-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    content.innerHTML = await this.renderTabContent();
  },

  async renderTabContent() {
    if (this.currentTab === 'stats') return await this.renderStatsTab();
    if (this.currentTab === 'groups') return await this.renderGroupsTab();
    if (this.currentTab === 'users') return await this.renderUsersTab();
    if (this.currentTab === 'assignments') return await this.renderAssignmentsTab();
    return '';
  },

  // 1. Statistika Tabi
  async renderStatsTab() {
    try {
      const statsRes = await Api.users.getStats();
      const sysRes = await Api.getSystemStatus();
      const s = statsRes.stats;

      return `
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon primary"><i class="fas fa-user-graduate"></i></div>
            <div class="stat-content">
              <div class="stat-value">${s.students}</div>
              <div class="stat-label">Jami Talabalar</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon secondary"><i class="fas fa-chalkboard-teacher"></i></div>
            <div class="stat-content">
              <div class="stat-value">${s.teachers}</div>
              <div class="stat-label">Professor-o'qituvchilar</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon warning"><i class="fas fa-layer-group"></i></div>
            <div class="stat-content">
              <div class="stat-value">${s.groups}</div>
              <div class="stat-label">Akademik Guruhlar</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon success"><i class="fas fa-file-alt"></i></div>
            <div class="stat-content">
              <div class="stat-value">${s.assignments}</div>
              <div class="stat-label">Faol Topshiriqlar</div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
          <!-- Topshiriqlar va AI tahlil ko'rsatkichi -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-tasks text-primary"></i> Topshiriqlar Holati</div>
            </div>
            <div class="card-body">
              <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
                <span>Jami topshirilgan ishlar:</span>
                <strong>${s.submissions} ta</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
                <span>AI tahlil qilgan (Reviewed):</span>
                <span class="badge badge-reviewed">${s.reviewed} ta</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
                <span>O'qituvchi baholagan (Graded):</span>
                <span class="badge badge-graded">${s.graded} ta</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 0.75rem 0;">
                <span>O'rtacha o'zlashtirish bali:</span>
                <strong style="color: var(--primary); font-size: 1.1rem;">${s.avgScore || 0} / 100</strong>
              </div>
            </div>
          </div>

          <!-- AI & Tizim Texnik Holati -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fas fa-microchip text-primary"></i> Sun'iy Intellekt Holati</div>
            </div>
            <div class="card-body">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${sysRes.hasOpenAiKey ? 'var(--success)' : 'var(--warning)'}; box-shadow: 0 0 10px ${sysRes.hasOpenAiKey ? 'var(--success)' : 'var(--warning)'};"></div>
                <strong>${sysRes.aiStatus}</strong>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;">
                ${sysRes.hasOpenAiKey 
                  ? 'OpenAI gpt-4o-mini API ulanishi muvaffaqiyatli ishlayapti. Javoblar JSON mode da semantik tekshiriladi.' 
                  : 'OpenAI API kaliti o\'rnatilmagan yoki kiritilmagan. Tizim to\'xtab qolmasligi uchun ichki aqlli o\'zbek tili semantik tahlil algoritmi to\'liq faol holatda ishlamoqda.'}
              </p>
              <div style="background: var(--bg-alt); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.8rem; font-family: monospace;">
                Model: ${sysRes.model} | Versiya: ${sysRes.version}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      return `<div class="empty-state"><p>Statistikani yuklashda xatolik yuz berdi: ${e.message}</p></div>`;
    }
  },

  // 2. Guruhlar Tabi
  async renderGroupsTab() {
    try {
      const res = await Api.groups.getAll();
      this.groupsCache = res.groups || [];

      if (this.groupsCache.length === 0) {
        return `
          <div class="empty-state card">
            <i class="fas fa-layer-group empty-state-icon"></i>
            <div class="empty-state-title">Akademik guruhlar mavjud emas</div>
            <div class="empty-state-desc">Tizimda talabalarni biriktirish uchun yangi guruh yarating.</div>
            <button class="btn btn-primary" onclick="AdminView.showAddGroupModal()">
              <i class="fas fa-plus"></i> Yangi Guruh Qo'shish
            </button>
          </div>
        `;
      }

      const rows = this.groupsCache.map((g, idx) => `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${g.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${AppUI.formatDate(g.created_at)}</div>
          </td>
          <td>
            <span class="badge" style="background: var(--bg-alt); color: var(--text-main);">
              <i class="fas fa-user-graduate"></i> ${g.student_count || 0} nafar talaba
            </span>
          </td>
          <td>
            <span class="badge" style="background: var(--primary-light); color: var(--primary);">
              <i class="fas fa-book"></i> ${g.assignment_count || 0} ta topshiriq
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteGroup(${g.id}, '${g.name.replace(/'/g, "\\'")}')">
              <i class="fas fa-trash"></i> O'chirish
            </button>
          </td>
        </tr>
      `).join('');

      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Mavjud Akademik Guruhlar (${this.groupsCache.length})</div>
            <button class="btn btn-primary btn-sm" onclick="AdminView.showAddGroupModal()">
              <i class="fas fa-plus"></i> Guruh Yaratish
            </button>
          </div>
          <div class="table-container" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 60px;">№</th>
                  <th>Guruh Nomi</th>
                  <th>Talabalar Soni</th>
                  <th>Topshiriqlar Soni</th>
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
    } catch (e) {
      return `<div class="empty-state"><p>Guruhlarni yuklashda xatolik: ${e.message}</p></div>`;
    }
  },

  // 3. Foydalanuvchilar Tabi
  async renderUsersTab() {
    try {
      const res = await Api.users.getAll();
      this.usersCache = res.users || [];

      const rows = this.usersCache.map(u => `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${u.name}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${u.email}</div>
          </td>
          <td>${AppUI.getRoleBadge(u.role)}</td>
          <td>${u.group_name || '<span style="color: var(--text-light);">-</span>'}</td>
          <td>${AppUI.formatDate(u.created_at)}</td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="AdminView.showEditUserModal(${u.id})">
                <i class="fas fa-edit"></i>
              </button>
              ${u.id !== AppState.user.id ? `
                <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteUser(${u.id}, '${u.name.replace(/'/g, "\\'")}')">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');

      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Tizimdagi Foydalanuvchilar (${this.usersCache.length})</div>
            <button class="btn btn-primary btn-sm" onclick="AdminView.showAddUserModal()">
              <i class="fas fa-user-plus"></i> Yangi Foydalanuvchi
            </button>
          </div>
          <div class="table-container" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Roli</th>
                  <th>Biriktirilgan Guruh</th>
                  <th>Ro'yxatdan O'tgan</th>
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
    } catch (e) {
      return `<div class="empty-state"><p>Foydalanuvchilarni yuklashda xatolik: ${e.message}</p></div>`;
    }
  },

  // 4. Barcha Topshiriqlar Tabi
  async renderAssignmentsTab() {
    try {
      const res = await Api.assignments.getAll();
      const assignments = res.assignments || [];

      if (assignments.length === 0) {
        return `
          <div class="empty-state card">
            <i class="fas fa-book-open empty-state-icon"></i>
            <div class="empty-state-title">Hozircha topshiriqlar mavjud emas</div>
            <div class="empty-state-desc">O'qituvchilar tomonidan yaratilgan mustaqil ta'lim topshiriqlari bu yerda ko'rinadi.</div>
          </div>
        `;
      }

      const rows = assignments.map(a => `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${a.title}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${a.group_name}</div>
          </td>
          <td>${a.teacher_name || '-'}</td>
          <td><span class="badge badge-reviewed">${a.total_submissions || 0} ta ish</span></td>
          <td>${AppUI.formatDate(a.created_at)}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline-danger btn-sm" onclick="AdminView.deleteAssignment(${a.id}, '${a.title.replace(/'/g, "\\'")}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Barcha Topshiriqlar (${assignments.length})</div>
          </div>
          <div class="table-container" style="border: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Topshiriq / Guruh</th>
                  <th>O'qituvchi</th>
                  <th>Topshirganlar</th>
                  <th>Yaratilgan Sana</th>
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
    } catch (e) {
      return `<div class="empty-state"><p>Topshiriqlarni yuklashda xatolik: ${e.message}</p></div>`;
    }
  },

  // Modallar va Operatsiyalar
  showAddGroupModal() {
    const html = `
      <form id="modal-form-add-group" onsubmit="AdminView.handleAddGroup(event)">
        <div class="form-group">
          <label class="form-label required">Guruh Nomi</label>
          <input type="text" id="new-group-name" class="form-control" placeholder="Masalan: 912-20 Guruh (Dasturiy injiniring)" required autofocus />
          <div class="form-hint">Fakultet yoki yo'nalish nomi bilan kiritish tavsiya etiladi.</div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary" id="btn-save-group">Saqlash</button>
        </div>
      </form>
    `;
    AppUI.openModal('<i class="fas fa-plus-circle text-primary"></i> Yangi Guruh Yaratish', html);
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
      this.switchTab('groups');
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Saqlash`;
    }
  },

  async deleteGroup(id, name) {
    if (!confirm(`Haqiqatan ham "${name}" guruhini o'chirmoqchimisiz? Guruhga biriktirilgan talabalar mustaqil qoladi.`)) {
      return;
    }

    try {
      await Api.groups.delete(id);
      AppUI.showToast('success', 'O\'chirildi', `Guruh o'chirildi.`);
      this.switchTab('groups');
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  async showAddUserModal() {
    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const html = `
      <form id="modal-form-add-user" onsubmit="AdminView.handleAddUser(event)">
        <div class="form-group">
          <label class="form-label required">To'liq Ism-sharifi</label>
          <input type="text" id="new-user-name" class="form-control" placeholder="Masalan: Rustamov Anvar" required />
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
    if (role === 'student') {
      groupField.style.display = 'block';
    } else {
      groupField.style.display = 'none';
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
      this.switchTab('users');
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  async showEditUserModal(id) {
    const user = this.usersCache.find(u => u.id === id);
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
          <input type="password" id="edit-user-pass" class="form-control" placeholder="Yangi parol" minlength="6" />
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
          <select id="new-user-group" class="form-select">
            <option value="">-- Guruh yo'q --</option>
            ${groupOptions}
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary">Yangilash</button>
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
    const group_id = role === 'student' ? document.getElementById('new-user-group').value : null;

    try {
      await Api.users.update(id, { name, email, password, role, group_id });
      AppUI.showToast('success', 'Yangilandi', 'Foydalanuvchi ma\'lumotlari muvaffaqiyatli saqlandi.');
      AppUI.closeModal();
      this.switchTab('users');
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  async deleteUser(id, name) {
    if (!confirm(`Haqiqatan ham "${name}" foydalanuvchisini o'chirmoqchimisiz?`)) return;
    try {
      await Api.users.delete(id);
      AppUI.showToast('success', 'O\'chirildi', 'Foydalanuvchi o\'chirildi.');
      this.switchTab('users');
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  async deleteAssignment(id, title) {
    if (!confirm(`"${title}" topshirig'ini o'chirishni xohlaysizmi? Unga tegishli barcha topshirilgan ishlar ham o'chiriladi.`)) return;
    try {
      await Api.assignments.delete(id);
      AppUI.showToast('success', 'O\'chirildi', 'Topshiriq o\'chirildi.');
      this.switchTab('assignments');
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  }
};
