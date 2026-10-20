/**
 * UniTask AI - Backend REST API Murojaat Klienti
 */

const Api = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };

    if (AppState.token) {
      headers['Authorization'] = `Bearer ${AppState.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (response.status === 401) {
        // Sessiya tugagan yoki token yaroqsiz
        AppState.setUser(null, null);
        window.location.hash = '#/login';
        AppUI.showToast('danger', 'Sessiya tugadi', 'Iltimos, qayta tizimga kiring.');
        App.router();
        throw new Error(data.message || 'Avtorizatsiyadan o\'tilmagan');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Xatolik yuz berdi');
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Autentifikatsiya
  auth: {
    login: (credentials) => Api.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
    register: (userData) => Api.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    getMe: () => Api.request('/auth/me')
  },

  // Guruhlar
  groups: {
    getAll: () => Api.request('/groups'),
    create: (data) => Api.request('/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (id) => Api.request(`/groups/${id}`, {
      method: 'DELETE'
    })
  },

  // Foydalanuvchilar (Admin)
  users: {
    getAll: (role) => Api.request(`/users${role ? `?role=${role}` : ''}`),
    create: (data) => Api.request('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => Api.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => Api.request(`/users/${id}`, {
      method: 'DELETE'
    }),
    getStats: () => Api.request('/users/stats')
  },

  // Topshiriqlar
  assignments: {
    getAll: () => Api.request('/assignments'),
    getById: (id) => Api.request(`/assignments/${id}`),
    create: (data) => {
      const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
      return Api.request('/assignments', {
        method: 'POST',
        body: isFormData ? data : JSON.stringify(data)
      });
    },
    extractText: (formData) => Api.request('/assignments/extract-text', {
      method: 'POST',
      body: formData
    }),
    delete: (id) => Api.request(`/assignments/${id}`, {
      method: 'DELETE'
    })
  },

  // Javoblar va AI Baholash
  submissions: {
    submitAnswer: (data) => Api.request('/submissions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getMy: () => Api.request('/submissions/my'),
    getByAssignment: (assignmentId) => Api.request(`/submissions/assignment/${assignmentId}`),
    getById: (id) => Api.request(`/submissions/${id}`),
    grade: (id, gradeData) => Api.request(`/submissions/${id}/grade`, {
      method: 'POST',
      body: JSON.stringify(gradeData)
    }),
    reanalyze: (id) => Api.request(`/submissions/${id}/re-analyze`, {
      method: 'POST'
    }),
    allowResubmit: (id) => Api.request(`/submissions/${id}`, {
      method: 'DELETE'
    })
  },

  // Tizim holati
  getSystemStatus: () => Api.request('/system-status')
};
