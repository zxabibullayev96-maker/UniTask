/**
 * UniTask AI - O'qituvchi Boshqaruv Paneli (Teacher View)
 * Ochiq va yopiq testlarni dinamik yaratish, tahrirlash, tartiblash va AI yordamida baholash.
 */

const TeacherView = {
  assignments: [],
  selectedAssignmentId: null,
  activeSubmissions: [],
  tempQuestions: [], // Topshiriq yaratish/tahrirlash vaqtidagi savollar holati

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
              Mustaqil ta'lim topshiriqlarini yaratish, dinamik testlar tuzish, AI semantik tahlilini ko'rish va talabalar ishlarini baholash.
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
            <div class="empty-state-desc">Talabalarga mustaqil ta'lim topshirig'i berish uchun birinchi topshiriqni oching. Ochiq va yopiq test savollarini xohlagancha qo'sha olasiz.</div>
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
        const totalPts = a.total_points || 100;
        const qCount = a.question_count || 0;
        const closedCount = a.closed_count || 0;
        const openCount = a.open_count || 0;

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
                ${a.subject ? `<span style="font-weight: 600; color: var(--primary);"><i class="fas fa-book"></i> ${a.subject} &bull; </span>` : ''}
                <i class="fas fa-users"></i> ${a.group_name} &bull; ${AppUI.formatDate(a.created_at)}
              </div>
              
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem;">
                ${a.has_dynamic_questions ? `
                  <span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.75rem;">
                    <i class="fas fa-layer-group"></i> ${qCount} ta savol (${closedCount} test, ${openCount} ochiq)
                  </span>
                  <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.75rem;">
                    <i class="fas fa-star"></i> Jami: ${totalPts} ball
                  </span>
                ` : `
                  <span class="badge" style="background: var(--bg-alt); color: var(--text-main); font-size: 0.75rem;">
                    <i class="fas fa-pen-alt"></i> 1 ta ochiq savol (100 ball)
                  </span>
                `}
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

      // Savollar ro'yxatini yuklaymiz
      const assignRes = await Api.assignments.getById(assignmentId);
      const detailedAssignment = assignRes.assignment;
      const questions = detailedAssignment.questions || [];

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
        const rows = submissions.map((s, idx) => {
          const scoreDisplay = s.total_score !== null 
            ? `${s.total_score} / ${s.max_score || assignment.total_points || 100} ball (${s.recommended_score || 0}%)`
            : (s.recommended_score !== null ? `${s.recommended_score} ball` : 'Hisoblanmoqda');

          const teacherScoreDisplay = s.teacher_score !== null
            ? `<strong style="color: var(--success); font-size: 1.05rem;">${s.teacher_score} ball</strong>`
            : '<span style="color: var(--text-light); font-size: 0.85rem;">Tasdiqlanmagan</span>';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-main);">${s.student_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${s.student_email}</div>
              </td>
              <td>${AppUI.formatDate(s.submitted_at)}</td>
              <td>
                <span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.85rem; padding: 0.35rem 0.65rem;">
                  <i class="fas fa-robot"></i> ${scoreDisplay}
                </span>
              </td>
              <td>${teacherScoreDisplay}</td>
              <td>${AppUI.getStatusBadge(s.status)}</td>
              <td style="text-align: right;">
                <button class="btn btn-primary btn-sm" onclick="TeacherView.showGradeModal(${s.id})">
                  <i class="fas fa-eye"></i> Ko'rish & Baholash
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
          <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h5 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">
                <i class="fas fa-list-ol text-primary"></i> Topshiriq Savollari (${questions.length} ta &bull; Jami ${detailedAssignment.total_points || 100} ball)
              </h5>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto;">
              ${questions.map((q, idx) => `
                <div style="background: var(--bg-alt); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-left: 3px solid ${q.question_type === 'closed' ? '#6366f1' : '#0ea5e9'};">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                    <span style="font-weight: 700; color: var(--text-main);">
                      ${idx + 1}-savol: ${q.question_type === 'closed' ? '<span style="color: #6366f1;">[Yopiq test]</span>' : '<span style="color: #0ea5e9;">[Ochiq savol]</span>'}
                    </span>
                    <span class="badge" style="background: white; color: var(--text-main);">${q.points} ball</span>
                  </div>
                  <div style="font-size: 0.875rem; color: var(--text-main);">${q.question_text}</div>
                  ${q.question_type === 'closed' && q.options ? `
                    <div style="margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.775rem;">
                      ${q.options.map(opt => `
                        <span style="padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); background: ${opt.is_correct ? '#dcfce7' : 'white'}; color: ${opt.is_correct ? '#166534' : 'var(--text-muted)'}; border: 1px solid ${opt.is_correct ? '#86efac' : 'var(--border)'};">
                          <strong>${opt.option_key}:</strong> ${opt.option_text} ${opt.is_correct ? '<i class="fas fa-check" title="To\'g\'ri javob"></i>' : ''}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        questionsPreviewHtml = `
          <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <label class="form-label" style="color: var(--primary);"><i class="fas fa-question-circle"></i> Berilgan Ochiq Savol:</label>
            <div style="background: var(--primary-light); padding: 0.85rem 1rem; border-radius: var(--radius-md); font-weight: 600; color: #1e1b4b; font-size: 0.925rem;">
              ${assignment.open_question}
            </div>
          </div>
        `;
      }

      detailsPanel.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div>
              <div class="card-title">${assignment.title}</div>
              <div class="card-subtitle">
                ${assignment.subject ? `<strong>Fan:</strong> ${assignment.subject} &bull; ` : ''}
                <i class="fas fa-users"></i> ${assignment.group_name}
                ${assignment.due_date ? ` &bull; <i class="fas fa-calendar-alt"></i> Muddat: ${AppUI.formatDate(assignment.due_date)}` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-outline-danger btn-sm" onclick="TeacherView.deleteAssignment(${assignment.id})">
                <i class="fas fa-trash"></i> O'chirish
              </button>
            </div>
          </div>
          <div class="card-body">
            <!-- Ko'rsatmalar (agar bo'lsa) -->
            ${assignment.instructions ? `
              <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 0.65rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem; color: #15803d;">
                <strong><i class="fas fa-info-circle"></i> Talabalarga ko'rsatma:</strong> ${assignment.instructions}
              </div>
            ` : ''}

            <!-- Savollar qismi -->
            ${questionsPreviewHtml}

            <!-- Nazariya preview -->
            <div style="margin-top: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="form-label"><i class="fas fa-book-reader"></i> Mavzu Nazariyasi (Ground Truth):</label>
                <span class="word-badge valid">${wordsCount} ta so'z</span>
              </div>
              <div class="theory-reader-box" style="max-height: 140px;">
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

  // =========================================================================
  // DINAMIK SAVOLLAR KONSTRUKTORI (Question Builder)
  // =========================================================================

  async showCreateAssignmentModal() {
    const groupsRes = await Api.groups.getAll();
    const groups = groupsRes.groups || [];
    
    if (groups.length === 0) {
      AppUI.showToast('warning', 'Guruh topilmadi', 'Avval Super Admin tomonidan guruh yaratilishi kerak.');
      return;
    }

    const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    // Boshlang'ich savollar holati: 1 ta Yopiq test va 1 ta Ochiq savol
    this.tempQuestions = [
      {
        id: 'q_' + Date.now() + '_1',
        question_type: 'closed',
        question_text: '',
        points: 5,
        options: [
          { option_key: 'A', option_text: '', is_correct: 1 },
          { option_key: 'B', option_text: '', is_correct: 0 },
          { option_key: 'C', option_text: '', is_correct: 0 },
          { option_key: 'D', option_text: '', is_correct: 0 }
        ]
      },
      {
        id: 'q_' + Date.now() + '_2',
        question_type: 'open',
        question_text: '',
        instruction: '',
        sample_answer: '',
        points: 10
      }
    ];

    const html = `
      <form id="modal-form-assignment" onsubmit="TeacherView.handleCreateAssignment(event)">
        
        <!-- 1. Asosiy ma'lumotlar -->
        <div style="background: var(--bg-alt); padding: 1.25rem; border-radius: var(--radius-lg); margin-bottom: 1.25rem; border: 1px solid var(--border);">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 1rem;">
            <i class="fas fa-info-circle text-primary"></i> 1. Topshiriqning Asosiy Ma'lumotlari
          </h4>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label required">Topshiriq Nomi</label>
              <input type="text" id="assign-title" class="form-control" placeholder="Masalan: 3-Topshiriq: Kriptografiya va Axborot Xavfsizligi" required />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Fan yoki Mavzu</label>
              <input type="text" id="assign-subject" class="form-control" placeholder="Masalan: Axborot xavfsizligi" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label required">Akademik Guruh</label>
              <select id="assign-group" class="form-select" required>
                <option value="">-- Guruhni tanlang --</option>
                ${groupOptions}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Topshirish Muddati (Deadline)</label>
              <input type="datetime-local" id="assign-due-date" class="form-control" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Talabalar uchun Ko'rsatma / Yo'riqnoma (Ixtiyoriy)</label>
            <input type="text" id="assign-instructions" class="form-control" placeholder="Masalan: Barcha test savollarini diqqat bilan yeching. Ochiq savollarga batafsil javob bering." />
          </div>
        </div>

        <!-- 2. Nazariy Matn va Fayl -->
        <div style="background: var(--bg-alt); padding: 1.25rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0;">
              <i class="fas fa-book-reader text-primary"></i> 2. Mavzu Nazariyasi (Ground Truth)
            </h4>
            <span id="assign-word-counter" class="word-badge warning">0 / 100 ta so'z</span>
          </div>

          <!-- Fayl yuklash -->
          <div style="margin-bottom: 0.85rem; padding: 0.75rem 1rem; border: 1.5px dashed var(--border); border-radius: var(--radius-md); background: white;">
            <label class="form-label" style="font-size: 0.825rem; margin-bottom: 0.25rem;">
              <i class="fas fa-file-upload text-primary"></i> Nazariy Ma'lumot Faylini Biriktirish (PDF, DOCX, PPTX)
            </label>
            <input 
              type="file" 
              id="assign-file-input" 
              class="form-control" 
              accept=".pdf,.doc,.docx,.pptx,.ppt,.txt" 
              onchange="TeacherView.handleFileSelect(event)" 
            />
            <div class="form-hint" id="assign-file-status" style="margin-top: 0.25rem;">
              <span>Fayl yuklasangiz, matn avtomatik ajratib olinadi va talabaga yuklab olish uchun ilova qilinadi.</span>
            </div>
          </div>

          <textarea 
            id="assign-content" 
            class="form-control" 
            style="min-height: 120px;" 
            placeholder="AI ushbu matnni haqiqat manbasi (Ground Truth) deb biladi va talaba ochiq savollari javobini shu matnga semantik taqqoslaydi." 
            oninput="TeacherView.updateWordCount(this.value)"
            required></textarea>
        </div>

        <!-- 3. Dinamik Savollar Konstruktori -->
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">
                <i class="fas fa-tasks text-primary"></i> 3. Savollar Konstruktori
              </h4>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">
                Istalgan miqdorda yopiq test va ochiq savollar qo'shing. Savollar soniga sun'iy cheklov yo'q.
              </p>
            </div>

            <!-- Savol qo'shish tugmalari -->
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.addClosedQuestion()">
                <i class="fas fa-plus-circle"></i> + Yopiq test qo'shish
              </button>
              <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.addOpenQuestion()">
                <i class="fas fa-plus-circle"></i> + Ochiq savol qo'shish
              </button>
            </div>
          </div>

          <!-- Savollar statistikasi paneli -->
          <div id="questions-summary-bar-container"></div>

          <!-- Savollar kartalari konteyneri -->
          <div id="questions-builder-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
        </div>

        <!-- Pastki amallar -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1.25rem; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="TeacherView.showPreviewModal()">
            <i class="fas fa-eye"></i> Oldindan Ko'rish (Preview)
          </button>

          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Bekor qilish</button>
            <button type="submit" class="btn btn-primary" id="btn-save-assignment">
              <i class="fas fa-check"></i> Topshiriqni E'lon Qilish
            </button>
          </div>
        </div>

      </form>
    `;

    AppUI.openModal('<i class="fas fa-plus-circle text-primary"></i> Yangi Mustaqil Ta\'lim Topshirig\'i Ochish', html, '', 'modal-xl');

    // Savollar konstruktorini birinchi marta chizish
    this.renderQuestionsBuilder();
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
          statusEl.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fas fa-check-circle"></i> "${file.name}" faylidan ${res.wordCount} ta so'z ajratildi!</span>`;
        }
        AppUI.showToast('success', 'Fayl o\'qildi', `"${file.name}" faylidagi ma'lumotlar joylandi.`);
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

  // DOM dagi inputlardan holatni yangilash
  syncQuestionsFromDOM() {
    this.tempQuestions.forEach((q, idx) => {
      const textEl = document.getElementById(`q-text-${idx}`);
      if (textEl) q.question_text = textEl.value;

      const ptsEl = document.getElementById(`q-points-${idx}`);
      if (ptsEl) q.points = Math.max(0.5, parseFloat(ptsEl.value) || 1);

      if (q.question_type === 'closed') {
        q.options.forEach((opt, optIdx) => {
          const optTextEl = document.getElementById(`opt-text-${idx}-${optIdx}`);
          if (optTextEl) opt.option_text = optTextEl.value;

          const radioEl = document.getElementById(`opt-radio-${idx}-${optIdx}`);
          if (radioEl) opt.is_correct = radioEl.checked ? 1 : 0;
        });
      } else {
        const instEl = document.getElementById(`q-inst-${idx}`);
        if (instEl) q.instruction = instEl.value;

        const sampleEl = document.getElementById(`q-sample-${idx}`);
        if (sampleEl) q.sample_answer = sampleEl.value;
      }
    });
  },

  // Yopiq test qo'shish
  addClosedQuestion() {
    this.syncQuestionsFromDOM();
    this.tempQuestions.push({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      question_type: 'closed',
      question_text: '',
      points: 2,
      options: [
        { option_key: 'A', option_text: '', is_correct: 1 },
        { option_key: 'B', option_text: '', is_correct: 0 },
        { option_key: 'C', option_text: '', is_correct: 0 },
        { option_key: 'D', option_text: '', is_correct: 0 }
      ]
    });
    this.renderQuestionsBuilder();
    AppUI.showToast('info', 'Yopiq test qo\'shildi', 'Yangi test savoli qo\'shildi.');
  },

  // Ochiq savol qo'shish
  addOpenQuestion() {
    this.syncQuestionsFromDOM();
    this.tempQuestions.push({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      question_type: 'open',
      question_text: '',
      instruction: '',
      sample_answer: '',
      points: 10
    });
    this.renderQuestionsBuilder();
    AppUI.showToast('info', 'Ochiq savol qo\'shildi', 'Yangi ochiq savol qo\'shildi.');
  },

  // Savolni o'chirish
  removeQuestion(idx) {
    this.syncQuestionsFromDOM();
    if (this.tempQuestions.length <= 1) {
      AppUI.showToast('warning', 'O\'chirib bo\'lmaydi', 'Topshiriqda kamida bitta savol bo\'lishi shart.');
      return;
    }
    this.tempQuestions.splice(idx, 1);
    this.renderQuestionsBuilder();
  },

  // Savol o'rnini almashtirish (Move Up / Down)
  moveQuestion(idx, direction) {
    this.syncQuestionsFromDOM();
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.tempQuestions.length) return;

    const temp = this.tempQuestions[idx];
    this.tempQuestions[idx] = this.tempQuestions[newIdx];
    this.tempQuestions[newIdx] = temp;

    this.renderQuestionsBuilder();
  },

  // Variant qo'shish
  addOption(qIdx) {
    this.syncQuestionsFromDOM();
    const q = this.tempQuestions[qIdx];
    if (!q || q.question_type !== 'closed') return;

    const nextKey = String.fromCharCode(65 + q.options.length);
    q.options.push({
      option_key: nextKey,
      option_text: '',
      is_correct: 0
    });

    this.renderQuestionsBuilder();
  },

  // Variantni o'chirish (kamida 2 ta variant qolishi kerak)
  removeOption(qIdx, optIdx) {
    this.syncQuestionsFromDOM();
    const q = this.tempQuestions[qIdx];
    if (!q || q.question_type !== 'closed') return;

    if (q.options.length <= 2) {
      AppUI.showToast('warning', 'Cheklov', 'Yopiq testda kamida 2 ta javob varianti bo\'lishi shart.');
      return;
    }

    const wasCorrect = q.options[optIdx].is_correct === 1;
    q.options.splice(optIdx, 1);

    // Qolgan variantlarning harflarini qayta A, B, C... qilib tuzamiz
    q.options.forEach((opt, i) => {
      opt.option_key = String.fromCharCode(65 + i);
    });

    // Agar o'chirilgan variant to'g'ri javob bo'lgan bo'lsa, birinchi variantni to'g'ri qilamiz
    if (wasCorrect && q.options.length > 0) {
      q.options[0].is_correct = 1;
    }

    this.renderQuestionsBuilder();
  },

  // To'g'ri javobni tanlash
  setCorrectOption(qIdx, optIdx) {
    this.syncQuestionsFromDOM();
    const q = this.tempQuestions[qIdx];
    if (!q || q.question_type !== 'closed') return;

    q.options.forEach((opt, i) => {
      opt.is_correct = (i === optIdx) ? 1 : 0;
    });

    this.renderQuestionsBuilder();
  },

  // Konstruktorni qayta chizish
  renderQuestionsBuilder() {
    const listEl = document.getElementById('questions-builder-list');
    const summaryEl = document.getElementById('questions-summary-bar-container');
    if (!listEl) return;

    let totalPoints = 0;
    let closedCount = 0;
    let openCount = 0;

    this.tempQuestions.forEach(q => {
      totalPoints += (parseFloat(q.points) || 0);
      if (q.question_type === 'closed') closedCount++;
      if (q.question_type === 'open') openCount++;
    });

    totalPoints = Math.round(totalPoints * 10) / 10;

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="questions-summary-bar">
          <div class="summary-stat-item">
            <i class="fas fa-layer-group text-primary"></i> Jami: <strong>${this.tempQuestions.length} ta savol</strong>
          </div>
          <div class="summary-stat-item">
            <i class="fas fa-check-square" style="color: #6366f1;"></i> Yopiq testlar: <strong>${closedCount} ta</strong>
          </div>
          <div class="summary-stat-item">
            <i class="fas fa-align-left" style="color: #0ea5e9;"></i> Ochiq savollar: <strong>${openCount} ta</strong>
          </div>
          <div class="summary-stat-item">
            <i class="fas fa-star" style="color: #f59e0b;"></i> Umumiy Maksimal Ball: <strong>${totalPoints} ball</strong>
          </div>
        </div>
      `;
    }

    if (this.tempQuestions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border);">
          <p>Hozircha savollar qo'shilmadi. Yuqoridagi tugmalar orqali yopiq yoki ochiq savol qo'shing.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.tempQuestions.map((q, idx) => {
      const isClosed = q.question_type === 'closed';

      return `
        <div class="builder-question-card ${isClosed ? 'border-closed' : 'border-open'}" id="q-card-${idx}">
          
          <!-- Savol sarlavhasi va amallar -->
          <div class="builder-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-weight: 800; font-size: 1rem; color: var(--text-main);">#${idx + 1}</span>
              <span class="builder-badge ${isClosed ? 'builder-badge-closed' : 'builder-badge-open'}">
                <i class="fas ${isClosed ? 'fa-check-circle' : 'fa-feather-alt'}"></i>
                ${isClosed ? 'Yopiq Test Savoli' : 'Ochiq Savol'}
              </span>
            </div>

            <div class="builder-actions">
              <div style="display: flex; align-items: center; gap: 0.35rem; margin-right: 0.5rem;">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin: 0;">Maksimal ball:</label>
                <input 
                  type="number" 
                  id="q-points-${idx}" 
                  class="form-control" 
                  style="width: 70px; padding: 0.25rem 0.5rem; height: 32px; font-weight: 700; text-align: center;" 
                  value="${q.points}" 
                  min="0.5" 
                  step="0.5" 
                  onchange="TeacherView.syncQuestionsFromDOM(); TeacherView.renderQuestionsBuilder();"
                />
              </div>

              <!-- Yuqoriga / Pastga / O'chirish -->
              <button type="button" class="btn btn-secondary btn-sm" title="Yuqoriga ko'tarish" onclick="TeacherView.moveQuestion(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
                <i class="fas fa-arrow-up"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" title="Pastga tushirish" onclick="TeacherView.moveQuestion(${idx}, 1)" ${idx === this.tempQuestions.length - 1 ? 'disabled' : ''}>
                <i class="fas fa-arrow-down"></i>
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" title="Savolni o'chirish" onclick="TeacherView.removeQuestion(${idx})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Savol matni -->
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label required" style="font-size: 0.85rem;">Savol Matni</label>
            <textarea 
              id="q-text-${idx}" 
              class="form-control" 
              style="min-height: 60px;" 
              placeholder="${isClosed ? 'Masalan: Quyidagi shifrlash algoritmlaridan qaysi biri asimmetrik hisoblanadi?' : 'Masalan: Asimmetrik va simmetrik shifrlashning asosiy farqlarini misollar orqali tushuntiring.'}" 
              required>${q.question_text || ''}</textarea>
          </div>

          <!-- Savol turiga qarab maydonlar -->
          ${isClosed ? `
            <!-- Yopiq test variantlari -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label class="form-label required" style="font-size: 0.825rem; margin: 0;">
                  Javob Variantlari (To'g'ri javobni tanlash uchun variant yonidagi tugmani belgilang):
                </label>
                <button type="button" class="btn btn-outline btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="TeacherView.addOption(${idx})">
                  <i class="fas fa-plus"></i> Variant qo'shish
                </button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                ${q.options.map((opt, optIdx) => `
                  <div class="option-row">
                    <div class="option-key-label">${opt.option_key}</div>
                    
                    <input 
                      type="text" 
                      id="opt-text-${idx}-${optIdx}" 
                      class="form-control" 
                      style="font-size: 0.875rem;" 
                      placeholder="${opt.option_key} varianti matni..." 
                      value="${opt.option_text || ''}" 
                      required 
                    />

                    <!-- To'g'ri javob radiosi -->
                    <label class="option-radio-label ${opt.is_correct ? 'correct' : ''}" title="Ushbu variantni to'g'ri javob sifatida belgilash">
                      <input 
                        type="radio" 
                        name="correct-opt-${idx}" 
                        id="opt-radio-${idx}-${optIdx}" 
                        ${opt.is_correct ? 'checked' : ''} 
                        onchange="TeacherView.setCorrectOption(${idx}, ${optIdx})" 
                      />
                      <span>${opt.is_correct ? '<i class="fas fa-check"></i> To\'g\'ri' : 'Noto\'g\'ri'}</span>
                    </label>

                    <!-- Variantni o'chirish -->
                    ${q.options.length > 2 ? `
                      <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.35rem 0.5rem; color: var(--danger);" title="Variantni o'chirish" onclick="TeacherView.removeOption(${idx}, ${optIdx})">
                        <i class="fas fa-times"></i>
                      </button>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
              <div class="form-hint" style="margin-top: 0.35rem;">
                <span><i class="fas fa-shield-alt"></i> To'g'ri javob talabaga topshiriq vaqtida ko'rsatilmaydi, faqat backendda tekshirish uchun saqlanadi.</span>
              </div>
            </div>
          ` : `
            <!-- Ochiq savol ko'rsatmasi va namunaviy javobi -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.825rem;">Talaba uchun Javob Yozish Ko'rsatmasi (Ixtiyoriy)</label>
                <input 
                  type="text" 
                  id="q-inst-${idx}" 
                  class="form-control" 
                  placeholder="Masalan: Kamida 3 ta asosiy farqni va real hayotdagi qo'llanishini keltiring." 
                  value="${q.instruction || ''}" 
                />
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.825rem;">Namunaviy Javob yoki Baholash Mezonlari (Rubric)</label>
                <textarea 
                  id="q-sample-${idx}" 
                  class="form-control" 
                  style="min-height: 70px; background: #fffdf5; border-color: #fde68a;" 
                  placeholder="AI va o'qituvchi baholashi uchun to'g'ri javob andozasi yoki asosiy mezonlar...">${q.sample_answer || ''}</textarea>
                <div class="secret-teacher-note">
                  <i class="fas fa-user-shield"></i> <strong>Maxfiy:</strong> Ushbu namunaviy javob va mezonlar talabaga ko'rsatilmaydi! U faqat AI semantik tahlili va o'qituvchi baholashi uchun ishlatiladi.
                </div>
              </div>
            </div>
          `}

        </div>
      `;
    }).join('');
  },

  // Oldindan ko'rish (Preview Modal)
  showPreviewModal() {
    this.syncQuestionsFromDOM();

    const title = document.getElementById('assign-title')?.value || 'Topshiriq Nomi';
    const subject = document.getElementById('assign-subject')?.value || '';
    const instructions = document.getElementById('assign-instructions')?.value || '';

    let totalPoints = 0;
    this.tempQuestions.forEach(q => totalPoints += (parseFloat(q.points) || 0));

    const html = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 1.25rem 1.5rem; border-radius: var(--radius-lg); color: white;">
          <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 0.25rem;">TALABA KO'RISHI MUMKIN BO'LGAN REJIM (PREVIEW)</div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: white; margin-bottom: 0.35rem;">${title}</h2>
          <div style="font-size: 0.85rem; opacity: 0.9;">
            ${subject ? `<span><strong>Fan:</strong> ${subject} &bull; </span>` : ''}
            <span><strong>Jami:</strong> ${this.tempQuestions.length} ta savol &bull; ${Math.round(totalPoints * 10) / 10} ball</span>
          </div>
        </div>

        ${instructions ? `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; color: #15803d;">
            <strong><i class="fas fa-info-circle"></i> O'qituvchi ko'rsatmasi:</strong> ${instructions}
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${this.tempQuestions.map((q, idx) => `
            <div class="quiz-question-box">
              <div class="quiz-question-header">
                <div>
                  <span style="font-weight: 800; color: var(--primary);">#${idx + 1}-savol</span>
                  <span class="badge" style="background: var(--bg-alt); color: var(--text-main); margin-left: 0.5rem;">
                    ${q.question_type === 'closed' ? 'Yopiq test' : 'Ochiq savol'}
                  </span>
                </div>
                <span style="font-weight: 700; color: var(--primary); font-size: 0.9rem;">${q.points} ball</span>
              </div>

              <div style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 1rem; line-height: 1.5;">
                ${q.question_text || '<em style="color: var(--text-muted);">(Savol matni kiritilmagan)</em>'}
              </div>

              ${q.question_type === 'closed' ? `
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  ${q.options.map(opt => `
                    <div class="quiz-option-item">
                      <div class="quiz-option-circle">${opt.option_key}</div>
                      <div style="font-size: 0.925rem; color: var(--text-main);">${opt.option_text || '(Variant matni)'}</div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                ${q.instruction ? `
                  <div style="background: #eff6ff; padding: 0.6rem 0.85rem; border-radius: var(--radius-md); font-size: 0.825rem; color: #1d4ed8; margin-bottom: 0.75rem;">
                    <i class="fas fa-lightbulb"></i> <strong>Ko'rsatma:</strong> ${q.instruction}
                  </div>
                ` : ''}
                <textarea class="form-control" style="min-height: 100px;" placeholder="Talaba javob yozish maydoni..." disabled></textarea>
                <div class="form-hint"><span>Talaba bu yerga o'zining kengaytirilgan javobini yozadi.</span></div>
              `}
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" onclick="AppUI.closeModal()">Tahrirlashga Qaytish</button>
        </div>
      </div>
    `;

    AppUI.openModal('<i class="fas fa-eye text-primary"></i> Topshiriqning Talaba Uchun Ko\'rinishi', html, '', 'modal-lg');
  },

  // Topshiriqni saqlash / e'lon qilish
  async handleCreateAssignment(event) {
    event.preventDefault();
    this.syncQuestionsFromDOM();

    const title = document.getElementById('assign-title').value;
    const subject = document.getElementById('assign-subject').value;
    const group_id = document.getElementById('assign-group').value;
    const instructions = document.getElementById('assign-instructions').value;
    const due_date = document.getElementById('assign-due-date').value;
    const content = document.getElementById('assign-content').value;
    const fileInput = document.getElementById('assign-file-input');
    const btn = document.getElementById('btn-save-assignment');

    if (this.tempQuestions.length === 0) {
      AppUI.showToast('warning', 'Savollar yo\'q', 'Topshiriqda kamida bitta savol bo\'lishi shart.');
      return;
    }

    // Har bir savolni validatsiya qilish
    for (let i = 0; i < this.tempQuestions.length; i++) {
      const q = this.tempQuestions[i];
      if (!q.question_text || !q.question_text.trim()) {
        AppUI.showToast('warning', 'Savol matni', `${i + 1}-savol matnini kiriting.`);
        return;
      }
      if (q.question_type === 'closed') {
        const emptyOpt = q.options.some(opt => !opt.option_text || !opt.option_text.trim());
        if (emptyOpt) {
          AppUI.showToast('warning', 'Variant matni', `${i + 1}-yopiq testda barcha variantlarni to'ldiring.`);
          return;
        }
        const hasCorrect = q.options.some(opt => opt.is_correct === 1);
        if (!hasCorrect) {
          AppUI.showToast('warning', 'To\'g\'ri javob', `${i + 1}-yopiq testda to'g'ri javobni tanlang.`);
          return;
        }
      }
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saqlanmoqda...`;

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('subject', subject);
      formData.append('group_id', group_id);
      formData.append('instructions', instructions);
      if (due_date) formData.append('due_date', due_date);
      formData.append('content', content);
      formData.append('questions', JSON.stringify(this.tempQuestions));

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
      }

      const res = await Api.assignments.create(formData);

      AppUI.showToast('success', 'Muvaffaqiyatli!', `Topshiriq ${this.tempQuestions.length} ta savol bilan e'lon qilindi.`);
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

  // =========================================================================
  // TALABA JAVOBINI KO'RISH VA BAHOLASH MODALI (Show Grade Modal)
  // =========================================================================

  async showGradeModal(submissionId) {
    try {
      const res = await Api.submissions.getById(submissionId);
      const s = res.submission;
      const answers = s.answers || [];
      const isDynamic = s.has_dynamic_questions === 1 || answers.length > 0;

      let answersContentHtml = '';

      if (isDynamic) {
        // Dinamik savollar bo'yicha baholash
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
                  <!-- Header -->
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

                  <!-- Savol matni -->
                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem;">
                    ${ans.question_text}
                  </div>

                  ${isClosed ? `
                    <!-- Yopiq test variantlari holati -->
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
                              <strong>${opt.option_key}:</strong> ${opt.option_text} ${opt.is_correct ? '(To\'g\'ri javob)' : ''}
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  ` : `
                    <!-- Ochiq savol javobi va AI tahlili -->
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

                    <!-- AI Semantik Tahlili kartasi -->
                    <div class="ai-report-card" style="margin-bottom: 0.85rem;">
                      <div class="ai-header" style="padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                        <div class="ai-brand-badge" style="font-size: 0.75rem;">
                          <i class="fas fa-brain"></i> AI Tahlili (${aiFb.source || 'gpt-4o-mini'})
                        </div>
                        <div style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">
                          Tavsiya ball: ${ans.ai_score !== null ? ans.ai_score : '-'} / ${maxPts}
                        </div>
                      </div>

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
                    </div>

                    <!-- O'qituvchining ushbu savol uchun bahosi -->
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
        // Eski formatdagi topshiriq (bitta umumiy matn)
        answersContentHtml = `
          <div>
            <label class="form-label" style="color: var(--primary);">
              <i class="fas fa-user-edit"></i> Talabaning Yuborgan Javobi:
            </label>
            <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; font-size: 0.925rem; line-height: 1.6; max-height: 200px; overflow-y: auto;">
              ${s.student_answer}
            </div>
          </div>

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

      const html = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Talaba profili ma'lumotlari -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-alt); padding: 0.85rem 1.25rem; border-radius: var(--radius-md);">
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${s.student_name}</div>
              <div style="font-size: 0.775rem; color: var(--text-muted);">${s.group_name} &bull; ${s.student_email}</div>
            </div>
            <div>
              ${AppUI.getStatusBadge(s.status)}
            </div>
          </div>

          <!-- Savollar va javoblar bo'limi -->
          ${answersContentHtml}

          <!-- Qayta tahlil tugmasi -->
          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-outline btn-sm" onclick="TeacherView.reanalyze(${s.id})">
              <i class="fas fa-redo"></i> AI Bilan Qayta Tahlil Qilish
            </button>
          </div>

          <!-- O'qituvchi yakuniy bahoni tasdiqlash bo'limi -->
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

      AppUI.openModal(`<i class="fas fa-award text-primary"></i> Mustaqil Ishni Baholash`, html, '', 'modal-xl');

    } catch (e) {
      AppUI.showToast('danger', 'Xatolik', e.message);
    }
  },

  // Alohida savollar bahosidan jami ballni hisoblash
  calcTotalGradeFromInputs() {
    const inputs = document.querySelectorAll('.q-grade-input');
    if (!inputs || inputs.length === 0) return;

    let total = 0;
    inputs.forEach(inp => {
      total += (parseFloat(inp.value) || 0);
    });

    const totalEl = document.getElementById('grade-score');
    if (totalEl) {
      totalEl.value = Math.round(total * 10) / 10;
    }
  },

  // Bahoni saqlash
  async handleGradeSubmit(event, submissionId) {
    event.preventDefault();
    const teacher_score = document.getElementById('grade-score').value;
    const teacher_feedback = document.getElementById('grade-feedback').value;
    const btn = document.getElementById('btn-save-grade');

    // Savollar bo'yicha baholarni to'plash
    const questionInputs = document.querySelectorAll('.q-grade-input');
    const question_grades = [];
    questionInputs.forEach(inp => {
      const qid = inp.getAttribute('data-qid');
      const fbEl = document.getElementById(`q-grade-fb-${qid}`);
      question_grades.push({
        question_id: parseInt(qid, 10),
        teacher_score: parseFloat(inp.value) || 0,
        teacher_feedback: fbEl ? fbEl.value : ''
      });
    });

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tasdiqlanmoqda...`;

    try {
      await Api.submissions.grade(submissionId, { 
        teacher_score, 
        teacher_feedback,
        question_grades
      });
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
