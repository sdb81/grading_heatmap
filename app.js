class GradingHeatmapApp {
  constructor() {
    this.state = loadFromURL() || loadState();
    this.heatData = {};
    this.tooltip = null;
    this.semester = 0;
    this.dragId = null;
    this.dragOver = null;
    this.expandedCourse = null;
    this.newCourseName = "";
    this.newAssessment = { name: "", date: "" };
    this.shareMsg = "";
    
    this.init();
  }
  
  init() {
    this.render();
    this.attachEventListeners();
    this.initSidebarBehavior();
  }

  initSidebarBehavior() {
  document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const hamburger = document.getElementById('hamburger-btn');
    if (window.innerWidth <= 768 && sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !hamburger?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }, true);
  }
  
  render() {
    const root = document.getElementById("root");
    root.innerHTML = this.getHTML();
    this.attachEventListeners();
  }

  getHTML() {
    this.heatData = computeHeatmap(this.state.courses);
    const grouped = this.getGroupedCourses();

    return `
      <style>
      @media (max-width: 768px) {
        input, select, textarea {
          font-size: 16px !important;
        }
        .sidebar { position: fixed; left: -100%; top: 0; width: 250px; height: 100vh; background: #fff; z-index: 999; transition: left 0.3s; overflow-y: auto; box-shadow: 2px 0 8px rgba(0,0,0,0.1); padding-top: 75px; }
        .sidebar.open { left: 0; }
        .hamburger { display: flex !important; align-items: center; }
        main { width: 100%; }
        .calendar-grid { display: flex; flex-direction: column; }
        .month-row { width: 100%; margin-bottom: 20px; }
      }
      </style>

      <header class="header">
      <button class="hamburger" id="hamburger-btn" style="z-index:1001;background:#8B0000;border:1px solid rgba(255,255,255,0.4);color:#fff;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:18px;display:none;">☰</button>
        <div class="header-left">
          <img src="https://upload.wikimedia.org/wikipedia/commons/d/d1/Amsterdamuniversitylogo.svg" alt="UvA logo" class="uva-logo" />
          <span class="header-title">Grading Heatmap 2026–27</span>
        </div>
        <div class="header-right">
          <button class="header-btn" id="share-btn"><i class="fa-solid fa-link"></i>${this.shareMsg ? ` — ${this.shareMsg}` : " Share"}</button>
          <button class="header-btn" id="png-btn"><i class="fa-solid fa-download"></i> Save as Image</button>
          <button class="header-btn danger" id="reset-btn"><i class="fa-solid fa-trash"></i> Reset</button>
        </div>
      </header>

      <div class="body">
        ${this.getSidebarHTML(grouped)}
        ${this.getCalendarHTML()}
      </div>

      ${this.tooltip ? this.getTooltipHTML() : ""}
    `;
  }

  getSidebarHTML(grouped) {
    return `
      <aside class="sidebar">
        <div class="sidebar-label">Courses</div>
        <div style="display:flex;gap:6px;margin-bottom:6px;width:100%;">
          <button id="import-rooster-btn" style="flex:1;background:#8B0000;color:#fff;border:none;border-radius:4px;padding:6px 10px;font-size:12px;cursor:pointer;font-weight:600;">
            <i class="fa-solid fa-file-import"></i> Import from Rooster
          </button>
          <button id="import-help-btn" style="background:#dad6d0;color:#555;border:none;border-radius:4px;padding:6px 8px;font-size:12px;cursor:pointer;font-weight:700;">?</button>
        </div>
        <div class="add-row">
          <input class="input" id="course-input" placeholder="Course name…" value="${this.newCourseName}">
          <button class="add-btn" id="add-course-btn">+</button>
        </div>

        ${grouped.map((group, yi) => `
          <div class="year-section" id="year-${yi}" data-year="${yi}">
            <div class="year-label">
              <span>${group.label === "Unassigned" ? "Unassigned: drag to year" : group.label}</span>
              <button class="icon-btn year-toggle-btn" data-year="${yi}" title="Show/hide all">
                ${group.courses.every(c => c.on)
                  ? '<i class="fa-solid fa-eye"></i>'
                  : '<i class="fa-solid fa-eye-slash"></i>'}
              </button>
            </div>
            ${group.courses.length === 0 ? '<div class="empty-msg">No courses</div>' : ''}
            ${group.courses.map(c => this.getCourseCardHTML(c)).join("")}
          </div>
        `).join("")}

        <div class="legend">
          <div class="sidebar-label" style="margin-bottom:6px;">Legend</div>
          ${[
            ["#b8b3ad","Assessment date"],
            ["rgba(200,80,80,0.2)","1 Grading load"],
            ["rgba(180,40,40,0.4)","2 Grading loads"],
            ["rgba(160,0,0,0.6)","3 Grading loads"],
            ["rgba(139,0,0,0.85)","4+ Grading loads"],
            ["#f5ede0","Teaching-free week"],
            ["#e8e8e8","Public holiday"],
            ["#f0f0f0","Weekend"],
          ].map(([bg, lbl]) => `
            <div class="legend-row">
              <div class="legend-box" style="background:${bg};"></div>
              <span class="legend-text">${lbl}</span>
            </div>
          `).join("")}
        </div>
      </aside>
    `;
  }

  updateAutoYear() {
    const month = parseInt(this.newAssessment.month);
    if (month >= 9) {
      this.newAssessment.year = "2026";
    } else if (month >= 1 && month <= 6) {
      this.newAssessment.year = "2027";
    }
    this.render();
  }
  
  showImportHelpModal() {
    if (document.getElementById('help-modal-overlay')) return;
    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;" id="help-modal-overlay">
        <div style="background:#fff;border-radius:8px;padding:20px;width:360px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <h3 style="margin:0 0 12px 0;color:#222;">How to import from UvA Rooster</h3>
          <div style="font-size:12px;color:#333;line-height:1.7;overflow-y:auto;">
            <ol style="margin:0;padding-left:16px;">
              <li style="margin-bottom:8px;">Log into Rooster using your UvA account at <a href="https://rooster.uva.nl" target="_blank" style="color:#8B0000;">rooster.uva.nl</a>.</li>
              <li style="margin-bottom:8px;">Press <strong>Add Timetable</strong>, and add the preferred course or programme. The tool supports importing at course-level and at programme-level.</li>
              <li style="margin-bottom:8px;">Once added, select the courses and/or programmes you would like to include. Then press <strong>Download</strong> &rsaquo; <strong>iCalendar</strong> &rsaquo; <strong>All year</strong> and <strong>Download</strong>.</li>
              <li style="margin-bottom:8px;">On this page, press the <strong>Import from Rooster</strong> button and select the file you just downloaded.</li>
              <li style="margin-bottom:8px;">Select the exams, resits and other activities you want to include or exclude. Note that sometimes, non-exam events may be presented in this overview.</li>
              <li>Press <strong>Import</strong>.</li>
            </ol>
          </div>
          <button id="help-modal-close" style="margin-top:16px;background:#ddd;color:#333;border:none;border-radius:4px;padding:8px;cursor:pointer;font-weight:600;">Close</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('help-modal-overlay');
    document.getElementById('help-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  editAssessmentModal(courseId, assessmentId, fromDate = null) {
    if (document.getElementById('edit-modal-overlay')) return;
    const course = this.state.courses.find(c => c.id === courseId);
    const assessment = course?.assessments.find(a => a.id === assessmentId);
    if (!assessment) return;

    const [year, month, day] = assessment.date.split('-');

    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;" id="edit-modal-overlay">
        <div style="background:#fff;border-radius:8px;padding:20px;max-width:300px;box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <h3 style="margin-bottom:12px;color:#222;">Edit Assessment</h3>
          <div style="margin-bottom:8px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Assessment Name</label>
            <input type="text" id="modal-name" value="${assessment.name}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Date (DD/MM/YYYY)</label>
            <div style="display:flex;gap:2px;font-size:0;">
              <input type="text" id="modal-day" inputmode="numeric" placeholder="DD" maxlength="2" value="${day}" style="width:30%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;">
              <span style="width:8%;text-align:center;color:#999;align-self:center;font-size:12px;">/</span>
              <input type="text" id="modal-month" inputmode="numeric" placeholder="MM" maxlength="2" value="${month}" style="width:30%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;">
              <span style="width:8%;text-align:center;color:#999;align-self:center;font-size:12px;">/</span>
              <input type="text" id="modal-year" inputmode="numeric" placeholder="YYYY" maxlength="4" value="${year}" style="width:24%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;">
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="modal-save" style="flex:1;background:#8B0000;color:#fff;border:none;border-radius:4px;padding:8px;cursor:pointer;font-weight:600;">Save</button>
            <button id="modal-cancel" style="flex:1;background:#ddd;color:#333;border:none;border-radius:4px;padding:8px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);

    const overlay    = document.getElementById("edit-modal-overlay");
    const dayInput   = document.getElementById("modal-day");
    const monthInput = document.getElementById("modal-month");
    const yearInput  = document.getElementById("modal-year");
    const saveBtn    = document.getElementById("modal-save");
    const cancelBtn  = document.getElementById("modal-cancel");

    const handleSave = () => {
      const name = document.getElementById("modal-name").value.trim();
      const d = dayInput.value.trim();
      const m = monthInput.value.trim();
      const y = yearInput.value.trim();
      if (!name || !d || !m || !y) { alert("Please fill in all fields"); return; }
      const newIso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      assessment.name = name;
      assessment.date = newIso;
      saveState(this.state);
      overlay.remove();
      this.render();
    };

    dayInput.addEventListener('input', () => {
      let val = dayInput.value.replace(/\D/g, '').slice(0, 2);
      dayInput.value = val;
      const d = parseInt(val);
      const shouldAdvance = val.length === 2 || (val.length === 1 && d >= 4 && d <= 9);
      if (shouldAdvance) { monthInput.focus(); monthInput.select(); }
    });

    monthInput.addEventListener('blur', () => {
      const val = monthInput.value.replace(/\D/g, '');
      const m = parseInt(val);
      if (m >= 1 && m <= 12) {
        yearInput.value = m >= 9 ? '2026' : '2027';
      }
    });

    yearInput.addEventListener('input', () => {
      yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
    });

    yearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && yearInput.value.length === 4) { e.preventDefault(); handleSave(); }
      if (e.key === 'Backspace' && yearInput.value.length === 0) { e.preventDefault(); monthInput.focus(); }
    });

    monthInput.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && monthInput.value.length === 0) { e.preventDefault(); dayInput.focus(); }
    });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.remove(); }, { once: true });

    saveBtn.addEventListener("click", handleSave);
    cancelBtn.addEventListener("click", () => overlay.remove());
  }

  handleICSUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const events = parseICS(ev.target.result);
        if (!events.length) { alert('No importable events found in this file.'); return; }
        this.showImportPreviewModal(events);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  showImportPreviewModal(events) {
    // Group events by course name
    const grouped = {};
    for (const ev of events) {
      if (!grouped[ev.courseName]) grouped[ev.courseName] = [];
      grouped[ev.courseName].push(ev);
    }

    const groupHTML = Object.entries(grouped).map(([courseName, items]) => {
      const existing = this.state.courses.find(c => c.name.toLowerCase() === courseName.toLowerCase());
      const currentYear = existing ? (this.state.yearMap[existing.id] ?? 3) : 3;

      const yearOptions = YEAR_LABELS.map((label, i) =>
        `<option value="${i}" ${i === currentYear ? 'selected' : ''}>${label}</option>`
      ).join('');

      return `
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-weight:600;font-size:12px;color:#8B0000;flex:1;">${courseName}</span>
            <select class="import-year-select" data-course="${encodeURIComponent(courseName)}"
              style="font-size:11px;border:1px solid #ddd;border-radius:4px;padding:2px 4px;">
              ${yearOptions}
            </select>
          </div>
          ${items.map((item, i) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#333;margin-bottom:3px;cursor:pointer;">
              <input type="checkbox" class="import-check" data-course="${encodeURIComponent(courseName)}" data-index="${i}" checked
                style="accent-color:#8B0000;">
              <span>${item.label} — ${item.date}</span>
            </label>
          `).join('')}
        </div>
      `;
    }).join('');

    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;" id="import-preview-overlay">
        <div style="background:#fff;border-radius:8px;padding:20px;width:340px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <h3 style="margin-bottom:4px;color:#222;">Import from Rooster</h3>
          <p style="font-size:11px;color:#666;margin-bottom:12px;">Uncheck anything you don't want to import. New courses will be created automatically.</p>
          <div style="overflow-y:auto;flex:1;padding-right:4px;">
            ${groupHTML}
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button id="modal-save" style="flex:1;background:#8B0000;color:#fff;border:none;border-radius:4px;padding:8px;cursor:pointer;font-weight:600;">Import</button>
            <button id="modal-cancel" style="flex:1;background:#ddd;color:#333;border:none;border-radius:4px;padding:8px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById("import-preview-overlay");
    document.getElementById('modal-save').addEventListener('click', () => {
      const usedColors = this.state.courses.map(c => c.color).filter(Boolean);
      let colorIndex = 0;

      const checked = document.querySelectorAll('.import-check:checked');
      checked.forEach(cb => {
        const courseName = decodeURIComponent(cb.dataset.course);
        const index = parseInt(cb.dataset.index);
        const item = grouped[courseName][index];

        // Read year for this course
        const yearSelect = document.querySelector(
          `.import-year-select[data-course="${cb.dataset.course}"]`
        );
        const yearIndex = yearSelect ? parseInt(yearSelect.value) : 3;

        // Find or create course
        let course = this.state.courses.find(c =>
          c.name.toLowerCase() === courseName.toLowerCase()
        );
        if (!course) {
          // Pick next unused colour
          const color = COURSE_COLORS.find(c => !usedColors.includes(c))
            || COURSE_COLORS[colorIndex % COURSE_COLORS.length];
          colorIndex++;
          usedColors.push(color);

          course = { id: uid(), name: courseName, color, assessments: [] };
          this.state.courses.push(course);
        }

        // Assign year
        if (!this.state.yearMap) this.state.yearMap = {};
        this.state.yearMap[course.id] = yearIndex;

        // Avoid duplicates
        const iso = `${item.year}-${item.month}-${item.day}`;
        const exists = course.assessments.some(a => a.name === item.label && a.date === iso);
        if (!exists) {
          course.assessments.push({ id: uid(), name: item.label, date: iso });
        }
      });

      saveState(this.state);
      overlay.remove();
      this.render();
    });

    document.getElementById('modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.remove(); }, { once: true });
  }

  showDatePickerModal(iso) {
    if (document.getElementById('datepicker-overlay')) return;
    const [year, month, day] = iso.split('-');
    const assessmentsOnDay = this.heatData[iso]?.assessments || [];
    
    let editOptions = "";
    if (assessmentsOnDay.length > 0) {
      editOptions = `
        <div style="margin-bottom:12px;border-top:1px solid #ddd;padding-top:12px;">
          <p style="font-size:12px;color:#666;margin-bottom:8px;font-weight:600;">Edit existing:</p>
          ${assessmentsOnDay.map(a => {
            const course = this.state.courses.find(c => c.name === a.course);
            const assessment = course?.assessments.find(x => x.name === a.name);
            return `
              <button id="edit-${assessment.id}" style="width:100%;text-align:left;padding:6px;margin-bottom:4px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:12px;">
                ${a.course}: ${a.name}
              </button>
            `;
          }).join("")}
        </div>
      `;
    }

    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;" id="datepicker-overlay">
        <div style="background:#fff;border-radius:8px;padding:20px;max-width:300px;box-shadow:0 4px 16px rgba(0,0,0,0.3);">
          <h3 style="margin-bottom:12px;color:#222;">Add Assessment for ${day}/${month}/${year}</h3>
          ${editOptions}
          <div style="margin-bottom:8px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Course</label>
            <select id="modal-course" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">
              <option value="">-- Select course --</option>
              ${this.state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Assessment Name</label>
            <input type="text" id="modal-name" placeholder="e.g. Exam, Essay" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;">
          </div>
          <div style="display:flex;gap:8px;">
            <button id="modal-add" style="flex:1;background:#8B0000;color:#fff;border:none;border-radius:4px;padding:8px;cursor:pointer;font-weight:600;">Add</button>
            <button id="modal-cancel" style="flex:1;background:#ddd;color:#333;border:none;border-radius:4px;padding:8px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('datepicker-overlay');
    const addBtn  = document.getElementById('modal-add');
    const cancelBtn = document.getElementById('modal-cancel');

    const close = () => overlay.remove();

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
      if (e.key === 'Enter')  { addBtn?.click(); }
    });

    addBtn.addEventListener('click', () => {
      const courseId = document.getElementById('modal-course').value;
      const name = document.getElementById('modal-name').value.trim();
      if (!courseId || !name) { alert('Please select a course and enter a name'); return; }
      const course = this.state.courses.find(c => c.id === courseId);
      if (course) {
        course.assessments.push({ id: uid(), name, date: iso });
        saveState(this.state);
      }
      close();
      this.render();
    });

    // Edit buttons
    assessmentsOnDay.forEach(a => {
      const course = this.state.courses.find(c => c.name === a.course);
      const assessment = course?.assessments.find(x => x.name === a.name);
      if (assessment) {
        document.getElementById(`edit-${assessment.id}`)?.addEventListener('click', () => {
          close();
          this.editAssessmentModal(course.id, assessment.id, true);
        });
      }
    });
  }

  getCourseCardHTML(course) {
    const isExpanded = this.expandedCourse === course.id;
    const color = course.color;
    return `
      <div class="course-card" id="course-${course.id}" data-course-id="${course.id}" style="border-left-color:${color};" draggable="true">
        <div class="course-header">
        <span style="font-size:10px;color:#ccc;user-select:none;cursor:grab;"><i class="fa-solid fa-grip-vertical"></i></span>
          <input type="color" id="color-${course.id}" value="${color}" class="color-picker" data-id="${course.id}" style="width:20px;height:20px;border:none;border-radius:3px;cursor:pointer;padding:0;">
          <span class="course-name ${!course.on ? "off" : ""}">${course.name}</span>
          <button class="multiplier-btn ${course.loadMultiplier === 2 ? 'active' : ''}" data-id="${course.id}" title="Parallel groups">2×</button>
          <button class="icon-btn toggle-btn" data-id="${course.id}" title="${course.on ? "Hide" : "Show"}">
            ${course.on ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>'}
          </button>
          <span class="icon-btn expand-btn" data-id="${course.id}">
            ${isExpanded ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>'}
          </span>
          <button class="icon-btn delete-btn" data-id="${course.id}"><i class="fa-solid fa-xmark"></i></button>
        </div>
        ${isExpanded ? this.getCourseExpandHTML(course) : ""}
      </div>
    `;
  }

  getCourseExpandHTML(course) {
    return `
      <div class="course-expand">
        ${(course.assessments || []).length === 0 ? '<div style="font-size:10px;color:#555;font-style:italic;margin-bottom:6px;">No assessments yet</div>' : ''}
        ${(course.assessments || []).map(a => `
          <div class="assessment-item">
            <div style="flex:1;">
              <div class="assessment-name">${a.name}</div>
              <div class="assessment-date">${a.date}</div>
            </div>
            <button class="icon-btn edit-assessment-btn" data-course-id="${course.id}" data-assessment-id="${a.id}">✎</button>
            <button class="icon-btn del-assessment-btn" data-course-id="${course.id}" data-assessment-id="${a.id}">✕</button>
          </div>
        `).join("")}
        <div style="margin-top:8px;">
          <input class="assessment-input" id="assess-name-${course.id}" placeholder="Assessment name" value="${this.newAssessment.name}">
          <div style="display:flex;gap:4px;margin-bottom:4px;">
            <input class="assessment-input date-input" 
              id="assess-day-${course.id}" 
              type="text" inputmode="numeric" placeholder="DD" maxlength="2" 
              style="flex:0.3;" 
              value="${this.newAssessment.day || ""}"
              data-course-id="${course.id}"
              data-field="day">
            <span style="align-self:center;color:#999;">/</span>
            <input class="assessment-input date-input" 
              id="assess-month-${course.id}" 
              type="text" inputmode="numeric" placeholder="MM" maxlength="2" 
              style="flex:0.3;" 
              value="${this.newAssessment.month || ""}"
              data-course-id="${course.id}"
              data-field="month">
            <span style="align-self:center;color:#999;">/</span>
            <input class="assessment-input" 
              id="assess-year-${course.id}" 
              type="text" inputmode="numeric" placeholder="YYYY" maxlength="4" 
              style="flex:0.4;" 
              value="${this.newAssessment.year || ""}"
              data-course-id="${course.id}"
              data-field="year"
              readonly>
          </div>
          <button class="add-assessment-btn" data-course-id="${course.id}">+ Add Assessment</button>
        </div>
      </div>
    `;
  }

  getCalendarHTML() {
    const sem1 = [{y:2026,m:7},{y:2026,m:8},{y:2026,m:9},{y:2026,m:10},{y:2026,m:11},{y:2027,m:0}];
    const sem2 = [{y:2027,m:1},{y:2027,m:2},{y:2027,m:3},{y:2027,m:4},{y:2027,m:5},{y:2027,m:6}];
    const months = this.semester === 0 ? [...sem1, ...sem2] : this.semester === 1 ? sem1 : sem2;

    return `
      <main class="calendar-main">
        <div class="semester-row">
          <button class="semester-btn ${this.semester === 0 ? "active" : ""}" data-sem="0">All</button>
          <button class="semester-btn ${this.semester === 1 ? "active" : ""}" data-sem="1">Semester 1</button>
          <button class="semester-btn ${this.semester === 2 ? "active" : ""}" data-sem="2">Semester 2</button>
        </div>

        <div id="calendar-ref" style="background:#f0ede8;padding:4px;">
          <div class="calendar-grid">
            ${months.map(({y, m}) => this.getMonthHTML(y, m)).join("")}
          </div>
        </div>
      </main>
    `;
  }

  getMonthHTML(year, month) {
    const weeks = buildMonth(year, month);
    return `
      <div class="month-card">
        <div class="month-header">${MONTH_NAMES[month]} ${year}</div>
        <div class="month-grid">
          <div class="day-headers">
            ${["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => `<div class="day-header">${d}</div>`).join("")}
          </div>
          ${weeks.map(week => `
            <div class="week-row">
              ${week.map(day => {
                if (!day) return '<div></div>';
                const iso = toISO(day);
                const { bg, fg, bold } = dayBgColor(iso, this.heatData);
                const hasData = !!this.heatData[iso];
                let title = "";
                if (isVrije(iso)) {
                  title = "Onderwijsvrije week";
                } else if (typeof FEESTDAGEN_MAP !== 'undefined' && FEESTDAGEN_MAP[iso]) {
                  title = FEESTDAGEN_MAP[iso];
                } else if (isFeestdag(iso)) {
                  title = "Nationale feestdag";
                }
                let borderColor = "transparent";

                // Get course colour for assessment day
                if (this.heatData[iso]?.assessments?.length > 0) {
                  const courseNames = this.heatData[iso].assessments.map(a => a.course);
                  const course = this.state.courses.find(c => courseNames.includes(c.name));
                  if (course) borderColor = course.color;
                  title = this.heatData[iso].assessments.map(a => `${a.course}: ${a.name}`).join(", ");
                }

                return `
                  <div class="day-cell ${bold ? "bold" : ""} ${hasData ? "has-data" : ""}" 
                      style="background:${bg};color:${fg};border-color:${borderColor};" 
                      data-iso="${iso}"
                      title="${title}">
                    ${day.getDate()}
                  </div>
                `;
              }).join("")}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  getTooltipHTML() {
    return `
      <div class="tooltip" id="tooltip" style="left:${this.tooltip.x}px;top:${this.tooltip.y}px;">
        ${this.tooltip.lines.map(l => `<div class="tooltip-line">${l}</div>`).join("")}
      </div>
    `;
  }

  getGroupedCourses() {
    return YEAR_LABELS.map((label, yi) => ({
      label, yi,
      courses: this.state.courses.filter(c => (this.state.yearMap[c.id] ?? 3) === yi)
    }));
  }

attachEventListeners() {
  // Helper to replace and rebind to avoid duplicate listeners
  const bind = (id, event, handler) => {
    const old = document.getElementById(id);
    if (!old) return;
    const el = old.cloneNode(true);
    old.replaceWith(el);
    el.addEventListener(event, handler);
  };

  bind('add-course-btn', 'click', () => this.addCourse());
  bind('course-input', 'keydown', e => e.key === 'Enter' && this.addCourse());
  bind('share-btn', 'click', () => this.share());
  bind('png-btn', 'click', () => this.downloadPNG());
  bind('reset-btn', 'click', () => this.reset());
  bind('import-rooster-btn', 'click', () => this.handleICSUpload());
  bind('import-help-btn', 'click', () => this.showImportHelpModal());

  document.querySelector('.sidebar')?.addEventListener('click', e => {
    const btn = e.target.closest('.multiplier-btn');
    if (btn) {
      const course = this.state.courses.find(c => c.id === btn.dataset.id);
      if (course) {
        course.loadMultiplier = course.loadMultiplier === 2 ? 1 : 2;
        saveState(this.state);
        this.render();
      }
    }
  });

  // Hamburger
  const oldHamburger = document.getElementById('hamburger-btn');
  if (oldHamburger) {
    const hamburger = oldHamburger.cloneNode(true);
    oldHamburger.replaceWith(hamburger);
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.sidebar')?.classList.toggle('open');
    });
  }

    // Semester buttons
    document.querySelectorAll(".semester-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        this.semester = parseInt(e.target.dataset.sem);
        this.render();
      });
    });

    // Course actions
    document.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        this.toggleCourse(btn.dataset.id);
      });
    });

    document.querySelectorAll(".expand-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        this.expandedCourse = this.expandedCourse === btn.dataset.id ? null : btn.dataset.id;
        this.render();
      });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        this.deleteCourse(btn.dataset.id);
      });
    });

    // Colour picker
    document.querySelectorAll(".color-picker").forEach(picker => {
      picker.addEventListener("change", e => {
        const courseId = e.target.dataset.id;
        const course = this.state.courses.find(c => c.id === courseId);
        if (course) {
          course.color = e.target.value;
          saveState(this.state);
          this.render();
        }
      });
    });

    const oldBtn = document.getElementById('hamburger-btn');
    const hamburger = oldBtn.cloneNode(true);
    oldBtn.replaceWith(hamburger);

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelector('.sidebar')?.classList.toggle('open');
    });

    // Assessment actions
    document.querySelectorAll(".add-assessment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cid = btn.dataset.courseId;
        this.newAssessment.name = document.getElementById(`assess-name-${cid}`)?.value || "";
        this.newAssessment.day = document.getElementById(`assess-day-${cid}`)?.value || "";
        this.newAssessment.month = document.getElementById(`assess-month-${cid}`)?.value || "";
        this.newAssessment.year = document.getElementById(`assess-year-${cid}`)?.value || "";
        this.addAssessment(cid);
      });
    });

    // Year toggle buttons
    document.querySelectorAll('.year-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const yi = parseInt(btn.dataset.year);
        const courses = this.state.courses.filter(c => (this.state.yearMap[c.id] ?? 3) === yi);
        const allOn = courses.every(c => c.on);
        courses.forEach(c => c.on = !allOn);
        saveState(this.state);
        this.render();
      });
    });

    document.querySelectorAll(".del-assessment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.deleteAssessment(btn.dataset.courseId, btn.dataset.assessmentId);
      });
    });

    // Edit assessment
    document.querySelectorAll(".edit-assessment-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        this.editAssessmentModal(btn.dataset.courseId, btn.dataset.assessmentId);
      });
    });

    // Drag and drop
    document.querySelectorAll(".course-card").forEach(card => {
      card.addEventListener("dragstart", () => {
        this.dragId = card.dataset.courseId;
      });
      card.addEventListener("dragend", () => {
        this.dragId = null;
        this.dragOver = null;
        this.render();
      });
    });

    document.querySelectorAll(".year-section").forEach(section => {
      section.addEventListener("dragover", e => {
        e.preventDefault();
        this.dragOver = parseInt(section.dataset.year);
        section.classList.add("drag-over");
      });
      section.addEventListener("dragleave", () => {
        section.classList.remove("drag-over");
      });
      section.addEventListener("drop", e => {
        e.preventDefault();
        if (this.dragId) {
          this.state.yearMap[this.dragId] = this.dragOver;
          saveState(this.state);
          this.dragId = null;
          this.dragOver = null;
          this.render();
        }
      });
    });

    // Day cells tooltip
    document.querySelectorAll(".day-cell.has-data").forEach(cell => {
      cell.addEventListener("mouseenter", e => this.showTooltip(e, cell.dataset.iso));
      cell.addEventListener("mouseleave", () => {
        this.tooltip = null;
        document.getElementById("tooltip")?.remove();
      });
    });

    // Update inputs when expanded
    if (this.expandedCourse) {
      const cid = this.expandedCourse;
      const nameInput  = document.getElementById(`assess-name-${cid}`);
      const dayInput   = document.getElementById(`assess-day-${cid}`);
      const monthInput = document.getElementById(`assess-month-${cid}`);
      const yearInput  = document.getElementById(`assess-year-${cid}`);

      if (nameInput) {
        nameInput.addEventListener("input", e => {
          this.newAssessment.name = e.target.value;
        });
        // Enter on name moves to day
        nameInput.addEventListener("keydown", e => {
          if (e.key === "Enter") { e.preventDefault(); dayInput?.focus(); }
        });
      }

      if (dayInput) {
        dayInput.addEventListener("input", e => {
          let val = e.target.value.replace(/\D/g, '').slice(0, 2);
          e.target.value = val;
          this.newAssessment.day = val;

          const d = parseInt(val);
          const shouldAdvance = val.length === 2 || (val.length === 1 && d >= 4 && d <= 9);

          if (shouldAdvance) {
            monthInput?.focus();
            monthInput?.select();
          }
        });
        // Backspace on empty goes back to name
        dayInput.addEventListener("keydown", e => {
          if (e.key === "Backspace" && dayInput.value.length === 0) {
            e.preventDefault(); nameInput?.focus();
          }
        });
      }

      if (monthInput) {
        monthInput.addEventListener("input", e => {
          let val = e.target.value.replace(/\D/g, '').slice(0, 2);
          e.target.value = val;
          this.newAssessment.month = val;

          const m = parseInt(val);
          const shouldAdvance = val.length === 2 || (val.length === 1 && m >= 2 && m <= 9);

          if (shouldAdvance) {
            const autoYear = m >= 9 ? '2026' : '2027';
            this.newAssessment.year = autoYear;
            yearInput.value = autoYear;
            yearInput.removeAttribute('readonly');
            yearInput?.focus();
            yearInput?.select();
          }
        });
        // Backspace on empty goes back to day
        monthInput.addEventListener("keydown", e => {
          if (e.key === "Backspace" && monthInput.value.length === 0) {
            e.preventDefault(); dayInput?.focus();
          }
        });
        monthInput.addEventListener('blur', () => {
          const val = monthInput.value.replace(/\D/g, '');
          const m = parseInt(val);
          if (m >= 1 && m <= 12) {
            const autoYear = m >= 9 ? '2026' : '2027';
            this.newAssessment.year = autoYear;
            yearInput.value = autoYear;
            yearInput.removeAttribute('readonly');
          }
        });
      }

      if (yearInput) {
        yearInput.addEventListener("input", e => {
          let val = e.target.value.replace(/\D/g, '').slice(0, 4);
          e.target.value = val;
          this.newAssessment.year = val;
        });
        // Enter submits, Backspace on empty goes back to month
        yearInput.addEventListener("keydown", e => {
          if (e.key === "Enter" && yearInput.value.length === 4) {
            e.preventDefault();
            this.newAssessment.name  = nameInput?.value || "";
            this.newAssessment.day   = dayInput?.value || "";
            this.newAssessment.month = monthInput?.value || "";
            this.newAssessment.year  = yearInput?.value || "";
            this.addAssessment(cid);
          }
          if (e.key === "Backspace" && yearInput.value.length === 0) {
            e.preventDefault(); monthInput?.focus();
          }
        });
      }
    }
    // Click day to add assessment
    document.querySelectorAll(".day-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        const iso = cell.dataset.iso;
        if (iso) {
          this.showDatePickerModal(iso);
        }
      });
    });
  }

  addCourse() {
    const input = document.getElementById("course-input");
    const name = input?.value.trim();
    if (!name) return;

    const id = uid();
    this.state.courses.push({
      id, name,
      on: true,
      assessments: [],
      color: COURSE_COLORS[this.state.courses.length % COURSE_COLORS.length],
      loadMultiplier: 1
    });
    this.state.yearMap[id] = 3;
    this.newCourseName = "";
    saveState(this.state);
    this.render();
  }

  deleteCourse(id) {
    this.state.courses = this.state.courses.filter(c => c.id !== id);
    delete this.state.yearMap[id];
    if (this.expandedCourse === id) this.expandedCourse = null;
    saveState(this.state);
    this.render();
  }

  toggleCourse(id) {
    const course = this.state.courses.find(c => c.id === id);
    if (course) {
      course.on = !course.on;
      saveState(this.state);
      this.render();
    }
  }

  addAssessment(courseId) {
    const { day, month, year, name } = this.newAssessment;
    
    if (!name.trim()) {
      alert('Assessment name cannot be empty');
      return;
    }
    
    if (!day || !month || !year) {
      alert('Please fill in all date fields');
      return;
    }
    
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const course = this.state.courses.find(c => c.id === courseId);
    if (course) {
      course.assessments.push({
        id: uid(),
        name: name,
        date: iso
      });
      this.newAssessment = { name: '', day: '', month: '', year: '' };
      saveState(this.state);
      this.render();
    }
  }

  deleteAssessment(courseId, assessmentId) {
    const course = this.state.courses.find(c => c.id === courseId);
    if (course) {
      course.assessments = course.assessments.filter(a => a.id !== assessmentId);
      saveState(this.state);
      this.render();
    }
  }

  showTooltip(e, iso) {
    const h = this.heatData[iso];
    if (!h) return;
    const lines = [];
    (h.assessments || []).forEach(a => lines.push(`<i class="fa-regular fa-flag"></i> ${a.course}: ${a.name}`));
    if (h.count > 0) lines.push(`<i class="fa-solid fa-spinner"></i> ${h.count} concurrent grading window${h.count > 1 ? "s" : ""}`);
    if (!lines.length) return;

    const rect = e.currentTarget.getBoundingClientRect();
    this.tooltip = { x: rect.left + rect.width / 2, y: rect.top, lines };
    this.render();
  }

  share() {
    try {
      const url = encodeStateToURL(this.state);
      navigator.clipboard.writeText(url);
      this.shareMsg = "Copied!";
      this.render();
      setTimeout(() => {
        this.shareMsg = "";
        this.render();
      }, 2000);
    } catch {
      this.shareMsg = "Copy failed";
      this.render();
    }
  }

  async downloadPNG() {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;gap:20px;background:#f0ede8;padding:20px;font-family:sans-serif;box-sizing:border-box;';

    const sidebar = document.createElement('div');
    sidebar.style.cssText = 'flex:0 0 270px;background:#f0ede8;color:#222;display:flex;flex-direction:column;justify-content:space-between;padding:14px 10px;gap:6px;flex-shrink:0;border-radius:8px;font-family:sans-serif;';

    // Top section: title + course groups
    const topSection = document.createElement('div');
    topSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#353535;margin-bottom:2px;';
    title.textContent = 'Courses';
    topSection.appendChild(title);

    const grouped = this.getGroupedCourses();

    grouped.forEach(group => {
      const visibleCourses = group.courses.filter(c => c.on);
      if (visibleCourses.length === 0) return;

      const yearSection = document.createElement('div');
      yearSection.style.cssText = 'background:#dad6d0;border-radius:8px;padding:8px;margin-bottom:4px;';

      const yearLabel = document.createElement('div');
      yearLabel.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#353535;margin-bottom:6px;';
      yearLabel.textContent = group.label === 'Unassigned' ? 'Unassigned' : group.label;
      yearSection.appendChild(yearLabel);

      visibleCourses.forEach(course => {
        const card = document.createElement('div');
        card.style.cssText = `background:#f0ede8;border-radius:8px;margin-bottom:4px;border-left:3px solid ${course.color};box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;`;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:5px;padding:7px 8px;';

        const swatch = document.createElement('div');
        swatch.style.cssText = `width:20px;height:20px;border-radius:3px;background:${course.color};flex-shrink:0;`;

        const name = document.createElement('div');
        name.style.cssText = 'flex:1;font-size:12px;font-weight:600;color:#353535;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        name.textContent = course.name;

        header.appendChild(swatch);
        header.appendChild(name);

        if (course.loadMultiplier === 2) {
          const badge = document.createElement('div');
          badge.style.cssText = 'font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;background:#8B0000;color:#fff;flex-shrink:0;';
          badge.textContent = '2×';
          header.appendChild(badge);
        }

        card.appendChild(header);

        if (!course.assessments || course.assessments.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size:10px;color:#555;font-style:italic;padding:0 8px 6px 8px;';
          empty.textContent = 'No assessments yet';
          card.appendChild(empty);
        } else {
          course.assessments.forEach(a => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;flex-direction:column;padding:3px 8px;border-bottom:1px solid #e0e0e0;';

            const aName = document.createElement('div');
            aName.style.cssText = 'font-size:11px;color:#333;';
            aName.textContent = a.name;

            const aDate = document.createElement('div');
            aDate.style.cssText = 'font-size:10px;color:#999;';
            aDate.textContent = a.date;

            item.appendChild(aName);
            item.appendChild(aDate);
            card.appendChild(item);
          });
        }

        yearSection.appendChild(card);
      });

      topSection.appendChild(yearSection);
    });

    sidebar.appendChild(topSection);

    // Legend at the bottom
    const legend = document.createElement('div');
    legend.style.cssText = 'margin-top:8px;';

    const legendTitle = document.createElement('div');
    legendTitle.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#353535;margin-bottom:6px;';
    legendTitle.textContent = 'Legend';
    legend.appendChild(legendTitle);

    const legendItems = [
      ['#b8b3ad', 'Assessment date'],
      ['rgba(200,80,80,0.2)', '1 Grading load'],
      ['rgba(180,40,40,0.4)', '2 Grading loads'],
      ['rgba(160,0,0,0.6)', '3 Grading loads'],
      ['rgba(139,0,0,0.85)', '4+ Grading loads'],
      ['#f5ede0', 'Teaching-free week'],
      ['#e8e8e8', 'Public holiday'],
      ['#f0f0f0', 'Weekend'],
    ];

    legendItems.forEach(([bg, label]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';

      const box = document.createElement('div');
      box.style.cssText = `width:14px;height:14px;border-radius:50%;background:${bg};flex-shrink:0;border:1px solid rgba(0,0,0,0.08);`;

      const text = document.createElement('div');
      text.style.cssText = 'font-size:11px;color:#353535;';
      text.textContent = label;

      row.appendChild(box);
      row.appendChild(text);
      legend.appendChild(row);
    });

    sidebar.appendChild(legend);

    const calClone = document.getElementById('calendar-ref').cloneNode(true);
    calClone.style.cssText = 'flex:1;';

    container.appendChild(sidebar);
    container.appendChild(calClone);
    document.body.appendChild(container);

    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#f0ede8' });
    document.body.removeChild(container);

    const a = document.createElement('a');
    a.download = 'grading-heatmap.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  reset() {
    if (!confirm("Reset all data?")) return;
    this.state = DEFAULT;
    localStorage.removeItem("uva-heatmap-v2");
    this.render();
  }
}

// Initialize app on load
document.addEventListener("DOMContentLoaded", () => {
  new GradingHeatmapApp();
});
