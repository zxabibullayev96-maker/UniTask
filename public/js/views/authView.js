/**
 * UniTask AI - Minimalist & Zamonaviy Autentifikatsiya Ko'rinishi (Login & Register)
 */

const AuthView = {
  currentMode: 'login', // 'login' | 'register'
  groupsCache: [],

  async render() {
    try {
      const res = await Api.groups.getAll();
      this.groupsCache = res.groups || [];
    } catch (e) {
      this.groupsCache = [];
    }

    return `
      <div class="auth-page-wrapper">
        <div class="auth-card ${this.currentMode === 'register' ? 'register-mode' : ''}" id="auth-main-card">
          ${this.currentMode === 'login' ? this.renderLoginContent() : this.renderRegisterContent()}
        </div>
      </div>
    `;
  },

  renderLoginContent() {
    return `
      <div class="auth-form-animated">
        <div class="auth-card-header">
          <div class="auth-card-logo">
            <i class="fas fa-brain"></i>
          </div>
          <h2 class="auth-card-title">UniTask AI</h2>
          <p class="auth-card-subtitle">Tizimga kirish uchun ma'lumotlaringizni kiriting</p>
        </div>

        <form id="form-auth-login" onsubmit="AuthView.handleLogin(event)">
          <div class="auth-field">
            <label class="auth-label" for="login-email">Email</label>
            <div class="auth-input-wrapper">
              <input 
                type="email" 
                id="login-email" 
                class="auth-input" 
                placeholder="namuna@unitask.uz" 
                required 
                autofocus 
              />
            </div>
          </div>

          <div class="auth-field">
            <label class="auth-label" for="login-password">Parol</label>
            <div class="auth-input-wrapper">
              <input 
                type="password" 
                id="login-password" 
                class="auth-input" 
                placeholder="Parolingizni kiriting" 
                required 
              />
              <button 
                type="button" 
                class="auth-password-toggle" 
                onclick="AuthView.togglePassword('login-password', 'login-pwd-icon')"
                tabindex="-1"
                title="Parolni ko'rsatish"
              >
                <i class="fas fa-eye" id="login-pwd-icon"></i>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-auth-submit" id="btn-login-submit">
            <span>Kirish</span>
            <i class="fas fa-arrow-right" style="font-size: 0.85rem;"></i>
          </button>
        </form>

        <div class="auth-footer-switch">
          <span>Akkauntingiz yo'qmi?</span>
          <button type="button" class="auth-switch-btn" onclick="AuthView.setMode('register')">
            Ro'yxatdan o'tish
          </button>
        </div>
      </div>
    `;
  },

  renderRegisterContent() {
    const groupDatalist = this.groupsCache.map(g => `<option value="${g.name}"></option>`).join('');

    return `
      <div class="auth-form-animated">
        <div class="auth-card-header">
          <div class="auth-card-logo">
            <i class="fas fa-user-plus"></i>
          </div>
          <h2 class="auth-card-title">Ro'yxatdan o'tish</h2>
          <p class="auth-card-subtitle">Platformadan foydalanish uchun hisob yarating</p>
        </div>

        <form id="form-auth-register" onsubmit="AuthView.handleRegister(event)">
          <div class="auth-grid-2">
            <div class="auth-field">
              <label class="auth-label" for="reg-firstname">Ism</label>
              <input 
                type="text" 
                id="reg-firstname" 
                class="auth-input" 
                placeholder="Azizbek" 
                required 
                autofocus 
              />
            </div>
            <div class="auth-field">
              <label class="auth-label" for="reg-lastname">Familiya</label>
              <input 
                type="text" 
                id="reg-lastname" 
                class="auth-input" 
                placeholder="Karimov" 
                required 
              />
            </div>
          </div>

          <div class="auth-field">
            <label class="auth-label" for="reg-email">Email</label>
            <input 
              type="email" 
              id="reg-email" 
              class="auth-input" 
              placeholder="azizbek@unitask.uz" 
              required 
            />
          </div>

          <div class="auth-field">
            <label class="auth-label" for="reg-password">Parol</label>
            <div class="auth-input-wrapper">
              <input 
                type="password" 
                id="reg-password" 
                class="auth-input" 
                placeholder="Kamida 6 ta belgi" 
                minlength="6" 
                required 
              />
              <button 
                type="button" 
                class="auth-password-toggle" 
                onclick="AuthView.togglePassword('reg-password', 'reg-pwd-icon')"
                tabindex="-1"
                title="Parolni ko'rsatish"
              >
                <i class="fas fa-eye" id="reg-pwd-icon"></i>
              </button>
            </div>
          </div>

          <div class="auth-field">
            <label class="auth-label" for="reg-role">Rol</label>
            <select id="reg-role" class="auth-input" onchange="AuthView.onRoleChange(this.value)" required>
              <option value="student">Talaba</option>
              <option value="teacher">O'qituvchi</option>
            </select>
          </div>

          <div class="auth-field" id="field-group-container">
            <label class="auth-label" for="reg-group-code">Guruh kodi</label>
            <input 
              type="text" 
              id="reg-group-code" 
              class="auth-input" 
              list="existing-groups-list" 
              placeholder="Masalan: 912-20" 
              required 
            />
            <datalist id="existing-groups-list">
              ${groupDatalist}
            </datalist>
          </div>

          <button type="submit" class="btn-auth-submit" id="btn-reg-submit">
            <span>Ro'yxatdan o'tish</span>
            <i class="fas fa-check" style="font-size: 0.85rem;"></i>
          </button>
        </form>

        <div class="auth-footer-switch">
          <span>Allaqachon akkauntingiz bormi?</span>
          <button type="button" class="auth-switch-btn" onclick="AuthView.setMode('login')">
            Kirish
          </button>
        </div>
      </div>
    `;
  },

  setMode(mode) {
    this.currentMode = mode;
    const card = document.getElementById('auth-main-card');
    if (!card) return;

    if (mode === 'register') {
      card.classList.add('register-mode');
      card.innerHTML = this.renderRegisterContent();
    } else {
      card.classList.remove('register-mode');
      card.innerHTML = this.renderLoginContent();
    }
  },

  onRoleChange(role) {
    const groupField = document.getElementById('field-group-container');
    const groupInput = document.getElementById('reg-group-code');
    if (!groupField || !groupInput) return;

    if (role === 'student') {
      groupField.style.display = 'block';
      groupInput.setAttribute('required', 'required');
    } else {
      groupField.style.display = 'none';
      groupInput.removeAttribute('required');
    }
  },

  togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;

    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  },

  async handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-login-submit');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tekshirilmoqda...`;

    try {
      const res = await Api.auth.login({ email, password });
      AppState.setUser(res.user, res.token);
      AppUI.showToast('success', 'Xush kelibsiz!', `${res.user.name}, tizimga muvaffaqiyatli kirdingiz.`);
      App.router();
    } catch (err) {
      AppUI.showToast('danger', 'Kirishda xatolik', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Kirish</span> <i class="fas fa-arrow-right" style="font-size: 0.85rem;"></i>`;
    }
  },

  async handleRegister(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-reg-submit');
    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const groupCode = role === 'student' ? document.getElementById('reg-group-code').value.trim() : null;

    if (role === 'student' && !groupCode) {
      AppUI.showToast('warning', 'Guruh kodi kiritilmadi', 'Talaba uchun guruh kodi majburiydir.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Yaratilmoqda...`;

    try {
      const res = await Api.auth.register({
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`,
        email,
        password,
        role,
        group_code: groupCode
      });

      AppState.setUser(res.user, res.token);
      AppUI.showToast('success', 'Tabriklaymiz!', `${res.user.name}, hisobingiz yaratildi.`);
      App.router();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Ro'yxatdan o'tish</span> <i class="fas fa-check" style="font-size: 0.85rem;"></i>`;
    }
  }
};
