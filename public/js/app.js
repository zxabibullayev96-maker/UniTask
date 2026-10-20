/**
 * UniTask AI - Asosiy SPA Ilova Dvigateli va Router
 */

const App = {
  async init() {
    console.log('UniTask AI ilovasi ishga tushirilmoqda...');
    AppState.loadStoredUser();

    // Agar token bo'lsa, serverdan joriy foydalanuvchini tasdiqlaymiz
    if (AppState.token) {
      try {
        const res = await Api.auth.getMe();
        AppState.setUser(res.user, AppState.token);
      } catch (err) {
        console.warn('Avtorizatsiya eskirgan:', err.message);
        AppState.setUser(null, null);
      }
    }

    // Hashchange hodisasini tinglash
    window.addEventListener('hashchange', () => this.router());

    // Birinchi marta yo'naltirish
    await this.router();
  },

  async router() {
    this.updateHeader();

    const viewport = document.getElementById('main-viewport');
    if (!viewport) return;

    // Agar foydalanuvchi kirmagan bo'lsa -> Login ekrani
    if (!AppState.user) {
      window.location.hash = '#/login';
      viewport.innerHTML = await AuthView.render();
      return;
    }

    // Foydalanuvchi roliga qarab yo'naltirish
    const role = AppState.user.role;

    if (role === 'admin') {
      viewport.innerHTML = await AdminView.render();
    } else if (role === 'teacher') {
      viewport.innerHTML = await TeacherView.render();
      if (typeof TeacherView.afterRender === 'function') {
        await TeacherView.afterRender();
      }
    } else if (role === 'student') {
      viewport.innerHTML = await StudentView.render();
      if (typeof StudentView.afterRender === 'function') {
        await StudentView.afterRender();
      }
    } else {
      viewport.innerHTML = `<div class="empty-state"><p>Noma'lum rol.</p></div>`;
    }
  },

  updateHeader() {
    const navActions = document.getElementById('nav-actions');
    if (!navActions) return;

    if (!AppState.user) {
      navActions.innerHTML = '';
      return;
    }

    const u = AppState.user;
    const initial = (u.name || 'U').charAt(0).toUpperCase();

    let roleText = "Talaba";
    if (u.role === 'admin') roleText = "Super Admin";
    if (u.role === 'teacher') roleText = "O'qituvchi";

    navActions.innerHTML = `
      <div class="user-profile-badge">
        <div class="user-avatar">${initial}</div>
        <div class="user-info">
          <span class="user-name">${u.name}</span>
          <span class="user-role-tag">${roleText} ${u.group_name ? `(${u.group_name})` : ''}</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="AppState.logout()" title="Tizimdan chiqish">
        <i class="fas fa-sign-out-alt"></i> Chiqish
      </button>
    `;
  }
};

// Sahifa yuklanganda ishga tushirish
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
