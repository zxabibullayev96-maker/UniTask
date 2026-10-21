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
        const error = new Error(data.message || 'Xatolik yuz berdi');
        error.data = data;
        error.status = response.status;
        throw error;
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
    getById: (id) => Api.request(`/groups/${id}`),
    create: (data) => Api.request('/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => Api.request(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    assignTeacher: (groupId, teacherId) => Api.request(`/groups/${groupId}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId })
    }),
    removeTeacher: (groupId, teacherId) => Api.request(`/groups/${groupId}/teachers/${teacherId}`, {
      method: 'DELETE'
    }),
    delete: (id, force = false) => Api.request(`/groups/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE'
    })
  },

  // Foydalanuvchilar (Admin)
  users: {
    getAll: (paramsOrRole) => {
      let queryString = '';
      if (typeof paramsOrRole === 'string') {
        queryString = `?role=${paramsOrRole}`;
      } else if (typeof paramsOrRole === 'object' && paramsOrRole !== null) {
        const q = new URLSearchParams();
        Object.entries(paramsOrRole).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') q.append(k, v);
        });
        queryString = `?${q.toString()}`;
      }
      return Api.request(`/users${queryString}`);
    },
    getById: (id) => Api.request(`/users/${id}`),
    create: (data) => Api.request('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => Api.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    assignGroups: (id, groupIds) => Api.request(`/users/${id}/groups`, {
      method: 'POST',
      body: JSON.stringify({ group_ids: groupIds })
    }),
    toggleStatus: (id, isActive) => Api.request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    }),
    delete: (id, force = false) => Api.request(`/users/${id}${force ? '?force=true' : ''}`, {
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
    update: (id, data) => {
      const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
      return Api.request(`/assignments/${id}`, {
        method: 'PUT',
        body: isFormData ? data : JSON.stringify(data)
      });
    },
    extractText: (formData) => Api.request('/assignments/extract-text', {
      method: 'POST',
      body: formData
    }),
    delete: (id, force = false) => Api.request(`/assignments/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE'
    })
  },

  // Javoblar va AI Baholash
  submissions: {
    submitAnswer: (data) => {
      const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
      return Api.request('/submissions', {
        method: 'POST',
        body: isFormData ? data : JSON.stringify(data)
      });
    },
    startSession: (assignmentId) => Api.request('/submissions/start', {
      method: 'POST',
      body: JSON.stringify({ assignment_id: assignmentId })
    }),
    saveDraft: (data) => Api.request('/submissions/draft', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getActiveSession: (assignmentId) => Api.request(`/submissions/session/${assignmentId}`),
    getMy: () => Api.request('/submissions/my'),
    getAll: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.append(k, v);
      });
      const qs = q.toString() ? `?${q.toString()}` : '';
      return Api.request(`/submissions/all${qs}`);
    },
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
    }),
    async downloadFile(id, fileName = 'fayl') {
      const token = AppState.token;
      const res = await fetch(`/api/submissions/${id}/file`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Faylni yuklab olishda xatolik yuz berdi');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  },

  // Tizim holati
  getSystemStatus: () => Api.request('/system-status')
};