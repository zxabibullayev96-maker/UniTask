/**
 * UniTask AI - Global Holat Boshqaruvi va Yordamchi Funksiyalar
 */

const AppState = {
  user: null,
  token: localStorage.getItem('unitask_token') || null,
  systemStatus: null,

  setUser(user, token) {
    this.user = user;
    this.token = token;
    if (token) {
      localStorage.setItem('unitask_token', token);
    } else {
      localStorage.removeItem('unitask_token');
    }
    if (user) {
      localStorage.setItem('unitask_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('unitask_user');
    }
  },

  loadStoredUser() {
    try {
      const stored = localStorage.getItem('unitask_user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    } catch (e) {
      this.user = null;
    }
  },

  logout() {
    this.setUser(null, null);
    window.location.hash = '#/login';
    AppUI.showToast('info', 'Chiqildi', 'Tizimdan muvaffaqiyatli chiqdingiz.');
    App.router();
  }
};

const AppUI = {
  showToast(type = 'info', title = '', message = '', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'danger') icon = 'fa-exclamation-triangle';
    if (type === 'warning') icon = 'fa-bell';

    toast.innerHTML = `
      <i class="fas ${icon} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${title || 'Bildirishnoma'}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  openModal(title, bodyHtml, footerHtml = '', sizeClass = '') {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    const headerTitle = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    container.className = `modal-container ${sizeClass}`;
    headerTitle.innerHTML = title;
    body.innerHTML = bodyHtml;
    
    if (footerHtml) {
      footer.innerHTML = footerHtml;
      footer.style.display = 'flex';
    } else {
      footer.innerHTML = '';
      footer.style.display = 'none';
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return d.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  },

  getStatusBadge(status) {
    if (status === 'graded') {
      return `<span class="badge badge-graded"><i class="fas fa-check-double"></i> Baholandi</span>`;
    }
    if (status === 'reviewed') {
      return `<span class="badge badge-reviewed"><i class="fas fa-robot"></i> AI Tahlil Qildi</span>`;
    }
    return `<span class="badge badge-pending"><i class="fas fa-clock"></i> Kutilmoqda</span>`;
  },

  getRoleBadge(role) {
    if (role === 'admin') {
      return `<span class="badge badge-role-admin"><i class="fas fa-shield-alt"></i> Super Admin</span>`;
    }
    if (role === 'teacher') {
      return `<span class="badge badge-role-teacher"><i class="fas fa-chalkboard-teacher"></i> O'qituvchi</span>`;
    }
    return `<span class="badge badge-role-student"><i class="fas fa-user-graduate"></i> Talaba</span>`;
  }
};
