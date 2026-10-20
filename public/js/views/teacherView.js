/**
 * UniTask AI - O'qituvchi Boshqaruv Paneli (Teacher View)
 */

const TeacherView = {
  assignments: [],
  selectedAssignmentId: null,
  activeSubmissions: [],

  async render() {
    return `
      <div style="margin-bottom: 2rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em;">
              <i class="fas fa-chalkboard-teacher" style="color: var(--primary);"></i> O'qituvchi Ish Stoli
            </h1>
            <p style="font-size: 0.875rem; color: var(--text-muted);">
              Mustaqil ta'lim topshiriqlarini yaratish, AI semantik tahlilini ko'rish va talabalar ishlarini baholash.
            </p>
          </div>
          <button class="btn btn-primary" onclick="TeacherView.showCreateAssignmentModal()">
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
            <div class="empty-state-title">Hozircha topshiriqlar yaratilmagan</div>
            <div class="empty-state-desc">Talabalarga mustaqil ta'lim topshirig'i berish uchun birinchi topshiriqni oching.</div>
            <button class="btn btn-primary" onclick="TeacherView.showCreateAssignmentModal()">
              <i class="fas fa-plus"></i> Birinchi Topshiriqni Yaratish
            </button>
          </div>
        `;
        return;
      }

      // Agar birorta topshiriq tanlanmagan bo'lsa, birinchisini tanlaymiz
      if (!this.selectedAssignmentId && this.assignments.length > 0) {
        this.selectedAssignmentId = this.assignments[0].id;
      }

      const assignmentCards = this.assignments.map(a => {
        const isSelected = a.id === this.selectedAssignmentId;
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
                <i class="fas fa-users"></i> ${a.group_name} &bull; ${AppUI.formatDate(a.created_at)}
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

      const wordsCount = (assignment.content || '').split(/\s+/).filter(w => w.length > 0).length;

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
        const rows = submissions.map((s, idx) => `
          <tr>
            <td>
              <div style="font-weight: 700; color: var(--text-main);">${s.student_name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${s.student_email}</div>
            </td>
            <td>${AppUI.formatDate(s.submitted_at)}</td>
            <td>
              ${s.recommended_score !== null ? `
                <span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.85rem; padding: 0.35rem 0.65rem;">
                  <i class="fas fa-robot"></i> ${s.recommended_score} ball
                </span>
              ` : '<span class="badge badge-pending">Hisoblanmoqda</span>'}
            </td>
            <td>
              ${s.teacher_score !== null ? `
                <strong style="color: var(--success); font-size: 1.05rem;">${s.teacher_score} / 100</strong>
              ` : '<span style="color: var(--text-light); font-size: 0.85rem;">Tasdiqlanmagan</span>'}
            </td>
            <td>${AppUI.getStatusBadge(s.status)}</td>
            <td style="text-align: right;">
              <button class="btn btn-primary btn-sm" onclick="TeacherView.showGradeModal(${s.id})">
                <i class="fas fa-eye"></i> Ko'rish & Baholash
              </button>
            </td>
          </tr>
        `).join('');

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

      detailsPanel.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div>
              <div class="card-title">${assignment.title}</div>
              <div class="card-subtitle"><i class="fas fa-users"></i> ${assignment.group_name} akademik guruhi uchun topshiriq</div>
            </div>
            <button class="btn btn-outline-danger btn-sm" onclick="TeacherView.deleteAssignment(${assignment.id})">
              <i class="fas fa-trash"></i> Topshiriqni O'chirish
            </button>
          </div>
          <div class="card-body">
            <!-- Savol va Nazariya preview -->
            <div style="margin-bottom: 1.25rem;">
              <label class="form-label" style="color: var(--primary);"><i class="fas fa-question-circle"></i> Berilgan Savol / Situatsion Masala:</label>
              <div style="background: var(--primary-light); padding: 0.85rem 1rem; border-radius: var(--radius-md); font-weight: 600; color: #1e1b4b; font-size: 0.925rem;">
                ${assignment.open_question}
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="form-label"><i class="fas fa-book-reader"></i> Mavzu Nazariyasi (Ground Truth):</label>
                <span class="word-badge valid">${wordsCount} ta so'z</span>
              </div>
              <div class="theory-reader-box" style="max-height: 160px;">
                ${assignment.content}
              </div>
              ${assignment.file_path ? `
                <div style="margin-top: 0.75rem;">
                  <a href="${assignment.file_path}" target="_blank" download class="btn btn-outline btn-sm">
                    <i class="fas fa-paperclip"></i> Ilova qilingan fayl: ${assignment.file_name || 'Hujjat'} ${assignment.file_size ? `(${(assignment.file_size / 1024).toFixed(1)} KB)` : ''}
                  </a>
                </div>
              ` : ''}
            </div>
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

  // Yangi topshiriq yaratish modali
  async showCreateAssignmentModal() {
    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    
    if (groups.length === 0) {
      AppUI.showToast('warning', 'Guruh topilmadi', 'Avval Super Admin tomonidan guruh yaratilishi kerak.');
      return;
    }

    const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const html = `
      <form id="modal-form-assignment" onsubmit="TeacherView.handleCreateAssignment(event)">
        <div class="form-group">
          <label class="form-label required">Topshiriq / Mavzu Nomi</label>
          <input type="text" id="assign-title" class="form-control" placeholder="Masalan: 3-Topshiriq: Kiberxavfsizlikda Kriptografik Protokollar" required />
        </div>

        <div class="form-group">
          <label class="form-label required">Akademik Guruhni Tanlang</label>
          <select id="assign-group" class="form-select" required>
            <option value="">-- Guruhni tanlang --</option>
            ${groupOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">Savol yoki Situatsion Masala (Talaba nimaga javob berishi kerak?)</label>
          <textarea id="assign-question" class="form-control" style="min-height: 80px;" placeholder="Masalan: Asimmetrik shifrlash qanday ishlaydi va ochiq/yopiq kalitlar o'rtasidagi farqni tushuntiring." required></textarea>
        </div>

        <!-- Fayl yuklash maydoni (PDF, DOCX, PPTX) -->
        <div class="form-group" style="background: var(--bg-alt); padding: 1rem; border-radius: var(--radius-md); border: 1.5px dashed var(--border);">
          <label class="form-label" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
            <span><i class="fas fa-file-upload text-primary"></i> Nazariy Ma'lumot Fayli (PDF, DOC, DOCX, PPTX)</span>
            <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">Ixtiyoriy</span>
          </label>
          <input 
            type="file" 
            id="assign-file-input" 
            class="form-control" 
            accept=".pdf,.doc,.docx,.pptx,.ppt,.txt" 
            onchange="TeacherView.handleFileSelect(event)" 
          />
          <div class="form-hint" id="assign-file-status">
            <span>Faylni yuklasangiz, tizim undan matnni avtomatik ajratib oladi va talabalarga yuklab olish uchun ilova qiladi.</span>
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <label class="form-label required" style="margin-bottom: 0;">Mavzu Nazariy Matni (Ground Truth)</label>
            <span id="assign-word-counter" class="word-badge warning">0 / 100 ta so'z</span>
          </div>
          <textarea 
            id="assign-content" 
            class="form-control" 
            style="min-height: 180px;" 
            placeholder="AI ushbu matnni haqiqat manbasi (Ground Truth) deb biladi va talaba javobini aynan shu matnga semantik taqqoslaydi. Kamida 100 ta so'z kiritish tavsiya etiladi." 
            oninput="TeacherView.updateWordCount(this.value)"
            required></textarea>
          <div class="form-hint">
            <span>FR-2.1 talabi: AI talaba javobini o'qituvchi bergan ushbu nazariyaga solishtiradi.</span>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
          <button type="submit" class="btn btn-primary" id="btn-save-assignment">
            <i class="fas fa-check"></i> Topshiriqni E'lon Qilish
          </button>
        </div>
      </form>
    `;

    AppUI.openModal('<i class="fas fa-plus-circle text-primary"></i> Yangi Mustaqil Ta\'lim Topshirig\'i Ochish', html, '', 'modal-lg');
  },

  updateWordCount(text) {
    const words = (text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
    const badge = document.getElementById('assign-word-counter');
    if (!badge) return;

    badge.innerText = `${words} / 100 ta so'z`;
    if (words >= 100) {
      badge.className = 'word-badge valid';
    } else {
      badge.className = 'word-badge warning';
    }
  },

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('assign-file-status');
    const contentEl = document.getElementById('assign-content');

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
          TeacherView.updateWordCount(res.extractedText);
        }
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fas fa-check-circle"></i> "${file.name}" faylidan ${res.wordCount} ta so'z muvaffaqiyatli ajratib olindi!</span>`;
        }
        AppUI.showToast('success', 'Fayl o\'qildi', `"${file.name}" faylidagi ma'lumotlar nazariy matn maydoniga joylandi.`);
      } else {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--warning);"><i class="fas fa-info-circle"></i> Fayl biriktirildi (${file.name}), ammo matn topilmadi. Qo'lda to'ldirishingiz mumkin.</span>`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Xatolik: ${err.message}</span>`;
      }
      AppUI.showToast('warning', 'Fayl parsing', err.message);
    }
  },

  async handleCreateAssignment(event) {
    event.preventDefault();
    const title = document.getElementById('assign-title').value;
    const group_id = document.getElementById('assign-group').value;
    const open_question = document.getElementById('assign-question').value;
    const content = document.getElementById('assign-content').value;
    const fileInput = document.getElementById('assign-file-input');
    const btn = document.getElementById('btn-save-assignment');

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...`;

    try {
      let res;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('group_id', group_id);
        formData.append('open_question', open_question);
        formData.append('content', content);
        formData.append('file', fileInput.files[0]);

        res = await Api.assignments.create(formData);
      } else {
        res = await Api.assignments.create({ title, group_id, open_question, content });
      }

      AppUI.showToast('success', 'Muvaffaqiyatli!', `Topshiriq e'lon qilindi.`);
      AppUI.closeModal();
      this.selectedAssignmentId = res.assignment.id;
      await this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check"></i> Topshiriqni E'lon Qilish`;
    }
  },

  async deleteAssignment(id) {
    if (!confirm("Haqiqatan ham bu topshiriqni va unga kelgan barcha javoblarni o'chirmoqchimisiz?")) return;
    try {
      await Api.assignments.delete(id);
      AppUI.showToast('success', 'O\'chirildi', 'Topshiriq o\'chirildi.');
      this.selectedAssignmentId = null;
      await this.loadAssignments();
    } catch (err) {
      AppUI.showToast('danger', 'Xatolik', err.message);
    }
  },

  // Ishni ko'rish va baholash modali
  async showGradeModal(submissionId) {
    try {
      const res = await Api.submissions.getById(submissionId);
      const s = res.submission;

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Talaba haqida ma'lumot -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md);">
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${s.student_name}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted);">${s.group_name} &bull; ${s.student_email}</div>
            </div>
            <div>
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          <!-- Talaba javobi -->
          <div>
            <label class="form-label" style="color: var(--primary);">
              <i class="fas fa-user-edit"></i> Talabaning Yuborgan Javobi:
            </label>
            <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; font-size: 0.925rem; line-height: 1.6; max-height: 200px; overflow-y: auto;">
              ${s.student_answer}
            </div>
          </div>

          <!-- AI Tahlil Hisoboti (Semantic Report) -->
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

            <!-- Xulosa -->
            <div class="ai-section">
              <div class="ai-section-title summary">
                <i class="fas fa-check-circle"></i> O'zlashtirish Darajasi (Xulosa)
              </div>
              <div class="ai-section-content">
                ${s.ai_summary || "Tahlil natijasi mavjud emas."}
              </div>
            </div>

            <!-- Kamchiliklar va bo'shliqlar -->
            <div class="ai-section">
              <div class="ai-section-title gaps">
                <i class="fas fa-exclamation-triangle"></i> Aniqlangan Kamchiliklar & Qoldirilgan Atamalar
              </div>
              <div class="ai-section-content" style="color: #92400e;">
                ${s.ai_gaps || "Jiddiy kamchiliklar yo'q."}
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
              <button class="btn btn-outline btn-sm" onclick="TeacherView.reanalyze(${s.id})">
                <i class="fas fa-redo"></i> AI Bilan Qayta Tahlil Qilish
              </button>
            </div>
          </div>

          <!-- O'qituvchi Bahosi Kiritish Bo'limi -->
          <form id="form-grade-submission" onsubmit="TeacherView.handleGradeSubmit(event, ${s.id})" style="border-top: 2px dashed var(--border); padding-top: 1.25rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.85rem; color: var(--text-main);">
              <i class="fas fa-clipboard-check text-primary"></i> Yakuniy Bahoni Belgilash va Tasdiqlash
            </h4>

            <div style="display: grid; grid-template-columns: 180px 1fr; gap: 1rem; align-items: start; margin-bottom: 1rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label required">Baho (1-100)</label>
                <div style="display: flex; gap: 0.35rem;">
                  <input type="number" id="grade-score" class="form-control" min="0" max="100" value="${s.teacher_score !== null ? s.teacher_score : (s.recommended_score || '')}" required />
                  <button type="button" class="btn btn-secondary btn-sm" title="AI tavsiya qilgan balni nusxalash" onclick="document.getElementById('grade-score').value = ${s.recommended_score || 0}">
                    <i class="fas fa-magic"></i>
                  </button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">O'qituvchi Izohi / Tavsiyasi (Talabaga ko'rinadi)</label>
                <input type="text" id="grade-feedback" class="form-control" placeholder="Masalan: Barakalla! Tushunchalar to'g'ri ifodalangan." value="${s.teacher_feedback || ''}" />
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

      AppUI.openModal(`<i class="fas fa-award text-primary"></i> Mustaqil Ishni Baholash`, html, '', 'modal-lg');
    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  async handleGradeSubmit(event, submissionId) {
    event.preventDefault();
    const teacher_score = document.getElementById('grade-score').value;
    const teacher_feedback = document.getElementById('grade-feedback').value;
    const btn = document.getElementById('btn-save-grade');

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tasdiqlanmoqda...`;

    try {
      await Api.submissions.grade(submissionId, { teacher_score, teacher_feedback });
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
  }
};
