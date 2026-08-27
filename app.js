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
    this.sidebarOpen = false;
    this._sidebarAnimating = false;
    this._tooltipOnMove = null;
    
    this.init();
  }
  
  init() {
    this.showIntroOnFirstLaunch();
    // Ensure a persistent floating hamburger exists so it stays clickable above overlays on small screens only
    const shouldHaveFloating = window.innerWidth <= 768; // mobile only
    const existingFh = document.getElementById('floating-hamburger');
    if (shouldHaveFloating && !existingFh) {
      const fh = document.createElement('button');
      fh.id = 'floating-hamburger';
      fh.className = 'hamburger';
      fh.innerHTML = '☰';
      fh.style.cssText = 'position:fixed;left:12px;top:27px;z-index:12000;background:#bc0031;border:1px solid rgba(255,255,255,0.4);color:#fff;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(fh);
    } else if (!shouldHaveFloating && existingFh) {
      existingFh.remove();
    }
    this.render();
    this.initSidebarBehavior();
  }

  openSidebarAnimated() {
    if (this.sidebarOpen || this._sidebarAnimating) return;
    this._sidebarAnimating = true;
    this.sidebarOpen = true;
    this.render();
    // After render, add the class to trigger transition
    requestAnimationFrame(() => {
      const sb = document.querySelector('.sidebar');
      if (!sb) { this._sidebarAnimating = false; return; }
      // ensure starting state is closed
      sb.classList.remove('open');
      // hide floating hamburger while animating/open on small screens or when in landscape (horizontal) mode
      const fh = document.getElementById('floating-hamburger');
      const isLandscape = window.innerWidth > window.innerHeight;
      // hide floating hamburger only in landscape (horizontal) to keep it visible in portrait mobile
      if (fh && isLandscape) fh.style.display = 'none';
      // force reflow
      void sb.offsetWidth;
      sb.classList.add('open');
      const onEnd = () => {
        sb.removeEventListener('transitionend', onEnd);
        this._sidebarAnimating = false;
      };
      sb.addEventListener('transitionend', onEnd);
    });
  }

  closeSidebarAnimated() {
    const sb = document.querySelector('.sidebar');
    if (this._sidebarAnimating) return;
    this._sidebarAnimating = true;
    const fh = document.getElementById('floating-hamburger');
    if (sb && sb.classList.contains('open')) {
      // attach listener first, then remove class to ensure transitionend is caught
      const onEnd = (e) => {
        sb.removeEventListener('transitionend', onEnd);
          this._sidebarAnimating = false;
          this.sidebarOpen = false;
          const isLandscape = window.innerWidth > window.innerHeight;
          if (fh && isLandscape) fh.style.display = 'flex';
        this.render();
      };
      sb.addEventListener('transitionend', onEnd);
      // remove class to start transition out
      // force reflow to ensure transition starts
      void sb.offsetWidth;
      sb.classList.remove('open');
    } else {
      this._sidebarAnimating = false;
      this.sidebarOpen = false;
      const isLandscape = window.innerWidth > window.innerHeight;
      if (fh && isLandscape) fh.style.display = 'flex';
      this.render();
    }
  }

  initSidebarBehavior() {
  // Sidebar open/close is handled by the hamburger toggle and an overlay created when open.
  // This avoids fragile global listeners and makes touch behaviour reliable.
  }
  
  render() {
    const root = document.getElementById("root");
    // Preserve scroll positions of the actual scrollable containers
    const sidebar = document.querySelector(".sidebar");
    const calendar = document.querySelector(".calendar-main");
    const sidebarTop = sidebar ? sidebar.scrollTop : 0;
    const calendarTop = calendar ? calendar.scrollTop : 0;
    root.innerHTML = this.getHTML();
    this.attachEventListeners();
    const newSidebar = document.querySelector(".sidebar");
    const newCalendar = document.querySelector(".calendar-main");
    if (newSidebar) newSidebar.scrollTop = sidebarTop;
    if (newCalendar) newCalendar.scrollTop = calendarTop;
  }

  getHTML() {
    this.heatData = computeHeatmap(this.state.courses);
    const grouped = this.getGroupedCourses();
    const overlayHtml = this.sidebarOpen ? `<div id="sidebar-overlay" style="position:fixed;inset:0;z-index:998;background:rgba(0,0,0,0.0);"></div>` : "";

    return `
      <style>
        * { font-family: "Source Sans 3", "Source Sans Pro", Arial, sans-serif; }
        .header, .header-title, h1, h2, h3 { font-family: "Source Serif 4", "Times New Roman", serif; }
        /* floating hamburger visible only on small screens */
        #floating-hamburger { display: none; }
        @media (max-width: 768px) { #floating-hamburger { display:flex !important; } }
        
      @media (max-width: 768px) {
        /* slide animation with transform for smoother GPU-accelerated animation */
        .sidebar { position: fixed; transform: translateX(-110%); top: 0; width: 220px; height: 100vh; background: #fff; z-index: 999; transition: transform 0.28s ease; overflow-y: auto; box-shadow: 2px 0 8px rgba(0,0,0,0.1); padding-top: 75px; }
        .sidebar.open { transform: translateX(0); }
        .hamburger { display: flex !important; align-items: center; position: fixed; left: 12px; top: 27px; z-index: 10050; }
        main { width: 100%; }
        .calendar-grid { display: flex; flex-direction: column; }
        .month-row { width: 100%; margin-bottom: 20px; }
      
        .header { flex-wrap: wrap; gap: 6px; padding: 8px 10px; }
        .header-left { flex: 1; min-width: 0; overflow: hidden; }
        .header-title { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .header-right { display: flex; flex-wrap: wrap; gap: 4px; }
        .header-btn { font-size: 11px; padding: 8px 8px; }
        .header-btn.danger { font-size: 11px; padding: 8px 8px; }
        .github-link { min-height: 36px; padding: 8px; font-size: 11px; }
      }
      /* On desktop, reserve space for the scrollbar so appearing/disappearing
         doesn't change the sidebar's content width */
      @media (min-width: 769px) {
        .sidebar { scrollbar-gutter: stable; }
      }
      </style>

      <header class="header">
      <button class="hamburger" id="hamburger-btn" style="position:fixed;left:12px;top:27px;z-index:11000;background:#bc0031;border:1px solid rgba(255,255,255,0.4);color:#fff;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:18px;display:none;">☰</button>
        <div class="header-left">
          <img src="https://upload.wikimedia.org/wikipedia/commons/d/d1/Amsterdamuniversitylogo.svg" alt="UvA logo" class="uva-logo" />
          <span class="header-title">Grading Heatmap</span>
        </div>
        <div class="header-right">
          <button class="header-btn" id="share-btn"><i class="fa-solid fa-link"></i>${this.shareMsg ? ` — ${this.shareMsg}` : " Share"}</button>
          <button class="header-btn" id="png-btn"><i class="fa-solid fa-circle-down"></i> Save</button>
          <button class="header-btn danger" id="reset-btn"><i class="fa-solid fa-rotate-left"></i> Reset</button>
          <a
            class="github-link"
            href="https://github.com/sdb81/grading_heatmap"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View this project on GitHub"
            title="View on GitHub"
          ><i class="fa-brands fa-github"></i></a>
        </div>
      </header>

      <div class="body">
        ${overlayHtml}
        ${this.getSidebarHTML(grouped)}
        ${this.getCalendarHTML()}
      </div>

      ${this.tooltip ? this.getTooltipHTML() : ""}
    `;
  }

  getSidebarHTML(grouped) {
    return `
      <aside class="sidebar ${this.sidebarOpen ? 'open' : ''}">
        <div class="sidebar-label">Courses</div>
        <div style="display:flex;gap:6px;margin-bottom:6px;width:100%;">
          <button id="import-rooster-btn" style="flex:1;background:#bc0031;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;font-weight:600;">
            <i class="fa-solid fa-file-import"></i>  Import from Rooster
          </button>
          <button id="import-help-btn" style="background:#e2ded8;color:#555;border:none;border-radius:8px;padding:4px 13px;font-size:12px;cursor:pointer;font-weight:700;transition:background 0.2s;hover: { background: #bbb2ad; };"><i class="fa-solid fa-question"></i></button>
        </div>
        <div class="add-row">
          <input class="input" id="course-input" placeholder="Add manually…" value="${this.newCourseName}">
          <button class="add-btn" id="add-course-btn"><i class="fa-solid fa-plus"></i></button>
        </div>

        ${grouped.map((group, yi) => `
          <div class="year-section" id="year-${yi}" data-year="${yi}">
            <div class="year-label">
              <span>${group.label === "Unassigned" ? "No year specified" : group.label}</span>
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
  
  showModal(title, content, options = {}) {
    if (document.getElementById('modal-overlay')) return;

    const { showCloseButton = true, closeButtonText = 'Close' } = options;

    const html = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
          <h2>${title}</h2>
          <div class="modal-content">${content}</div>
          <div class="modal-footer">
            ${showCloseButton ? `<button class="modal-btn" id="modal-close">${closeButtonText}</button>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('modal-overlay');
    
    if (showCloseButton) {
      document.getElementById('modal-close').addEventListener('click', () => overlay.remove());
    }
    
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  showIntroOnFirstLaunch() {
    if (!localStorage.getItem('hasVisited')) {
      const content = `
        <p>This tool is aimed to help teaching staff better understand and plan grading workload across courses, helping teachers become aware of upcoming grading peaks.</p>
        <p>With this tool, you can import course exams from your UvA Rooster or add deadlines manually.
        For each deadline, the tool provides a visual representation of the 15 working day grading period.</p>
      `;
      this.showModal('Welcome to the Grading Heatmap!', content, { closeButtonText: 'Get started' });
      localStorage.setItem('hasVisited', 'true');
    }
  }

  showImportHelpModal() {
    const content = `
      <ol>
        <li>Log into Rooster using your UvA account at <a href="https://rooster.uva.nl" target="_blank">rooster.uva.nl</a>.</li>
        <li>Press <strong>Add Timetable</strong> and add the preferred course or programme.</li>
        <li>Once added, select courses/programmes and press <strong>Download</strong> &rsaquo; <strong>iCalendar</strong> &rsaquo; <strong>All year</strong>.</li>
        <li>On this page, press the <strong>Import from Rooster</strong> button and select the downloaded file, usually called <em>'timetable_[today's date].ics'</em>.</li>
        <li>Select the exams, resits and activities to include/exclude. Note that courses whose deadlines are not listed on Rooster should be added manually.</li>
        <li>Press <strong>Import</strong>.</li>
      </ol>
    `;
    this.showModal('How to import from UvA Rooster', content);
  }

  showIntroModal() {
    const content = `<p>Welcome to your timetable tool!</p>`;
    this.showModal('Welcome', content);
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
            <input type="text" id="modal-name" value="${assessment.name}" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:8px;font-size:12px;box-sizing:border-box;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Date (DD/MM/YYYY)</label>
            <div style="display:flex;gap:2px;font-size:0;">
              <input type="text" id="modal-day" inputmode="numeric" placeholder="DD" maxlength="2" value="${day}" style="width:30%;padding:6px;border:1px solid #ddd;border-radius:8px;font-size:12px;box-sizing:border-box;">
              <span style="width:8%;text-align:center;color:#999;align-self:center;font-size:12px;">/</span>
              <input type="text" id="modal-month" inputmode="numeric" placeholder="MM" maxlength="2" value="${month}" style="width:30%;padding:6px;border:1px solid #ddd;border-radius:8px;font-size:12px;box-sizing:border-box;">
              <span style="width:8%;text-align:center;color:#999;align-self:center;font-size:12px;">/</span>
              <input type="text" id="modal-year" inputmode="numeric" placeholder="YYYY" maxlength="4" value="${year}" style="width:24%;padding:6px;border:1px solid #ddd;border-radius:8px;font-size:12px;box-sizing:border-box;">
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="modal-save" style="flex:1;background:#bc0031;color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:600;">Save</button>
            <button id="modal-cancel" style="flex:1;background:#ddd;color:#333;border:none;border-radius:8px;padding:8px;cursor:pointer;">Cancel</button>
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
            <span style="font-weight:600;font-size:12px;color:#bc0031;flex:1;">${courseName}</span>
            <select class="import-year-select" data-course="${encodeURIComponent(courseName)}"
              style="font-size:11px;border:1px solid #ddd;border-radius:8px;padding:2px 4px;">
              ${yearOptions}
            </select>
          </div>
          ${items.map((item, i) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#333;margin-bottom:3px;cursor:pointer;">
              <input type="checkbox" class="import-check" data-course="${encodeURIComponent(courseName)}" data-index="${i}" checked
                style="accent-color:#bc0031;">
              <span>${item.label} — ${item.date}</span>
            </label>
          `).join('')}
        </div>
      `;
    }).join('');

    const content = `
      <p style="font-size:0.92rem;color:#666;margin-bottom:12px;">Uncheck anything you don't want to import. New courses will be created automatically; you can assign the year here or later.</p>
      <div style="overflow-y:auto;flex:1;padding-right:4px;">
        ${groupHTML}
      </div>
    `;

    const html = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
          <h2>Import from Rooster</h2>
          <div class="modal-content">${content}</div>
          <div class="modal-footer">
            <button id="modal-cancel" class="modal-btn secondary">Cancel</button>
            <button id="modal-save" class="modal-btn">Import</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('modal-overlay');

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

          course = { id: uid(), name: courseName, color, on: true, assessments: [] };
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
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handler);
      }
    });
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
              <button id="edit-${assessment.id}" style="width:100%;text-align:left;padding:6px;margin-bottom:4px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-size:12px;">
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
            <select id="modal-course" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:8px;font-size:12px;">
              <option value="">-- Select course --</option>
              ${this.state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;">Assessment Name</label>
            <input type="text" id="modal-name" placeholder="e.g. Exam, Essay" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:8px;font-size:12px;box-sizing:border-box;">
          </div>
          <div style="display:flex;gap:8px;">
            <button id="modal-add" style="flex:1;background:#bc0031;color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:600;">Add</button>
            <button id="modal-cancel" style="flex:1;background:#ddd;color:#333;border:none;border-radius:8px;padding:8px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('datepicker-overlay');
    const addBtn  = document.getElementById('modal-add');
    const cancelBtn = document.getElementById('modal-cancel');

    const keydownHandler = (e) => {
      if (e.key === 'Escape') { close(); }
      if (e.key === 'Enter')  { addBtn?.click(); }
    };

    const close = () => {
      document.removeEventListener('keydown', keydownHandler);
      overlay.remove();
    };

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.addEventListener('keydown', keydownHandler);

    addBtn.addEventListener('click', () => {
      // remove key handler first to avoid duplicate add when handlers accumulated
      document.removeEventListener('keydown', keydownHandler);
      const courseId = document.getElementById('modal-course').value;
      const name = document.getElementById('modal-name').value.trim();
      if (!courseId || !name) { alert('Please select a course and enter a name'); return; }
      const course = this.state.courses.find(c => c.id === courseId);
      if (course) {
        // avoid accidental duplicates
        const exists = course.assessments.some(a => a.name === name && a.date === iso);
        if (!exists) {
          course.assessments.push({ id: uid(), name, date: iso });
        } else {
          alert('This assessment already exists for that course and date');
        }
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
        <span class="course-grab" data-course-id="${course.id}" style="font-size:10px;color:#ccc;user-select:none;cursor:grab;touch-action:none;">
          <i class="fa-solid fa-grip-vertical"></i>
        </span>
          <input type="color" id="color-${course.id}" value="${color}" class="color-picker" data-id="${course.id}" style="width:14px;height:14px;border:none;border-radius:50%;cursor:pointer;padding:0;flex-shrink:0;">
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
    const sorted = (course.assessments || [])
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return `
      <div class="course-expand">
        ${sorted.length === 0 ? '<div style="font-size:10px;color:#555;font-style:italic;margin-bottom:6px;">No assessments yet</div>' : ''}
        ${sorted.map(a => `
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
          <button class="semester-btn ${this.semester === 0 ? "active" : ""}" data-sem="0">2026-2027</button>
          <button class="semester-btn ${this.semester === 1 ? "active" : ""}" data-sem="1">Semester 1</button>
          <button class="semester-btn ${this.semester === 2 ? "active" : ""}" data-sem="2">Semester 2</button>
        </div>

        <div id="calendar-ref" style="background:#f8f7f5;padding:4px;">
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
                  title = "Teaching-free Week";
                } else if (typeof FEESTDAGEN_MAP !== 'undefined' && FEESTDAGEN_MAP[iso]) {
                  title = FEESTDAGEN_MAP[iso];
                } else if (isFeestdag(iso)) {
                  title = "National Holiday";
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

  // Ensure clicks inside the sidebar don't bubble to the document (prevents accidental close on mobile)
  const sidebarEl = document.querySelector('.sidebar');
  if (sidebarEl) {
    sidebarEl.addEventListener('click', (e) => { e.stopPropagation(); });
    sidebarEl.addEventListener('touchstart', (e) => { e.stopPropagation(); });
    sidebarEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  }

  // If an overlay is present, clicking it should close the sidebar
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.sidebarOpen = false;
        this.render();
      }
    });
    overlay.addEventListener('touchstart', (e) => {
      if (e.target === overlay) {
        this.sidebarOpen = false;
        this.render();
      }
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

    // Hamburger toggle: don't clone the element (render() replaces DOM so listeners won't duplicate)
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      // Toggle sidebar using animated open/close helpers
      const toggleSidebar = (e) => {
        e && e.stopPropagation();
        if (!this.sidebarOpen) this.openSidebarAnimated(); else this.closeSidebarAnimated();
        // keep floating hamburger visible above overlay
        const fh = document.getElementById('floating-hamburger');
        if (fh) fh.style.display = 'flex';
      };

      // Use pointer events to avoid duplicate events on touch devices
      hamburger.addEventListener('pointerup', (e) => { e.stopPropagation(); toggleSidebar(e); });
      hamburger.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    }

    // Wire the persistent floating hamburger to the same toggle
    const fh = document.getElementById('floating-hamburger');
    if (fh) {
      fh.addEventListener('pointerup', (e) => { e.stopPropagation(); if (!this.sidebarOpen) this.openSidebarAnimated(); else this.closeSidebarAnimated(); });
      fh.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    }

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

    // Make the grab handle start drag on touch/pointer for mobile
    document.querySelectorAll('.course-grab').forEach(handle => {
      handle.addEventListener('pointerdown', (e) => {
        const id = handle.dataset.courseId;
        const card = document.getElementById(`course-${id}`);
        if (!card) return;
        // emulate drag by setting data and adding a dragging class
        this.dragId = id;
        card.classList.add('dragging');

        // attempt to capture pointer to keep receiving events
        try { handle.setPointerCapture && handle.setPointerCapture(e.pointerId); } catch (err) {}

        const onMove = (ev) => {
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const section = el && el.closest && el.closest('.year-section');
          document.querySelectorAll('.year-section').forEach(s => s.classList.toggle('drag-over', s === section));
          this.dragOver = section ? parseInt(section.dataset.year) : null;
        };

        const onUp = (ev) => {
          try { handle.releasePointerCapture && handle.releasePointerCapture(e.pointerId); } catch (err) {}
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          const card2 = document.getElementById(`course-${id}`);
          if (card2) card2.classList.remove('dragging');
          if (this.dragId && this.dragOver != null) {
            this.state.yearMap[this.dragId] = this.dragOver;
            saveState(this.state);
          }
          this.dragId = null;
          this.dragOver = null;
          document.querySelectorAll('.year-section').forEach(s => s.classList.remove('drag-over'));
          this.render();
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
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
      cell.addEventListener("mouseleave", (ev) => {
        const tooltipEl = document.getElementById("tooltip");
        const related = ev.relatedTarget;
        const movingIntoTooltip = related && (related.closest('#tooltip') || related.closest('.day-cell.has-data'));
        if (tooltipEl && movingIntoTooltip) {
          return; // still over day or tooltip
        }
        this.tooltip = null;
        tooltipEl?.remove();
        this.render();
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

  hideTooltip() {
    // Remove tooltip element and its move handler without re-rendering to avoid
    // replacing DOM nodes under the cursor (which can swallow clicks on mac trackpads).
    const tipEl = document.getElementById('tooltip');
    if (tipEl) tipEl.remove();
    if (this._tooltipOnMove) {
      document.removeEventListener('mousemove', this._tooltipOnMove);
      this._tooltipOnMove = null;
    }
    this.tooltip = null;
  }

  showTooltip(e, iso) {
    // Render tooltip into the DOM directly (avoid full app render) so the
    // target day-cell isn't replaced under the cursor — this helps mac trackpad
    // users who click immediately after hover.
    document.getElementById("tooltip")?.remove(); // Clear old tooltip

    const h = this.heatData[iso];
    if (!h) return;
    const lines = [];
    (h.assessments || []).forEach(a => lines.push(`<i class="fa-regular fa-flag"></i> ${a.course}: ${a.name}`));
    if (h.count > 0) lines.push(`<i class="fa-solid fa-spinner"></i> ${h.count} concurrent grading window${h.count > 1 ? "s" : ""}`);
    if (!lines.length) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const tipEl = document.createElement('div');
    tipEl.id = 'tooltip';
    tipEl.className = 'tooltip';
    tipEl.style.left = (rect.left + rect.width / 2) + 'px';
    tipEl.style.top = rect.top + 'px';
    tipEl.innerHTML = lines.map(l => `<div class="tooltip-line">${l}</div>`).join('');
    document.body.appendChild(tipEl);

    // Auto-hide when moving away from day or tooltip
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const inDay = !!(el && el.closest && el.closest('.day-cell.has-data'));
      const inTip = !!(el && el.closest && el.closest('#tooltip'));
      if (!inDay && !inTip) {
        this.hideTooltip();
      }
    };
    this._tooltipOnMove = onMove;
    document.addEventListener('mousemove', onMove);

    tipEl.addEventListener('mouseleave', () => {
      this.hideTooltip();
    }, { once: true });
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
    // Produce a desktop-sized layout regardless of current viewport (mobile or desktop)
    const DESKTOP_WIDTH = 1100;
    const SIDEBAR_WIDTH = 270;

    const container = document.createElement('div');
    container.style.cssText = `display:flex;gap:20px;background:#f8f7f5;padding:20px;font-family:"Source Sans 3","Source Sans Pro",Arial,sans-serif;box-sizing:border-box;width:${DESKTOP_WIDTH}px;`;

    const sidebar = document.createElement('div');
    sidebar.style.cssText = `flex:0 0 ${SIDEBAR_WIDTH}px;width:${SIDEBAR_WIDTH}px;background:#f8f7f5;color:#222;display:flex;flex-direction:column;justify-content:space-between;padding:14px 10px;gap:6px;flex-shrink:0;border-radius:8px;font-family:"Source Sans 3","Source Sans Pro",Arial,sans-serif;`;

    // Top section: title + course groups
    const topSection = document.createElement('div');
    topSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-family: "Source Serif 4", "Times New Roman", serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#353535;margin-bottom:2px;';
    title.textContent = 'Courses';
    topSection.appendChild(title);

    const grouped = this.getGroupedCourses();

    grouped.forEach(group => {
      const visibleCourses = group.courses.filter(c => c.on);
      if (visibleCourses.length === 0) return;

      const yearSection = document.createElement('div');
      yearSection.style.cssText = 'background:#e2ded8;border-radius:8px;padding:8px;margin-bottom:4px;';

      const yearLabel = document.createElement('div');
      yearLabel.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#353535;margin-bottom:6px;';
      yearLabel.textContent = group.label === 'Unassigned' ? 'No Year Specified' : group.label;
      yearSection.appendChild(yearLabel);

      visibleCourses.forEach(course => {
        const card = document.createElement('div');
        card.style.cssText = `background:#f8f7f5;border-radius:8px;margin-bottom:4px;border-left:3px solid ${course.color};box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;`;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:5px;padding:7px 8px;';

        const swatch = document.createElement('div');
        swatch.style.cssText = `width:20px;height:20px;border-radius:50%;background:${course.color};flex-shrink:0;`;

        const name = document.createElement('div');
        name.style.cssText = 'flex:1;font-size:12px;font-weight:600;color:#353535;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        name.textContent = course.name;

        header.appendChild(swatch);
        header.appendChild(name);

        if (course.loadMultiplier === 2) {
          const badge = document.createElement('div');
          badge.style.cssText = 'font-size:10px;font-weight:700;padding:2px 5px;border-radius:8px;background:#bc0031;color:#fff;flex-shrink:0;';
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
    legend.style.cssText = 'margin-top:8px;padding-top:12px;border-top:1px solid #ddd;';

    const legendTitle = document.createElement('div');
    legendTitle.style.cssText = 'font-family: "Source Serif 4", "Times New Roman", serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#353535;margin-bottom:6px;';
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
    // Force calendar width to fill remaining desktop space so mobile CSS rules don't shrink it
    calClone.style.cssText = `flex:1;width:${DESKTOP_WIDTH - SIDEBAR_WIDTH - 40}px;`; // account for gaps/padding

    container.appendChild(sidebar);
    container.appendChild(calClone);
    document.body.appendChild(container);

    // Render at higher scale for crisp output; force width to DESKTOP_WIDTH so result matches desktop layout
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#f8f7f5', width: DESKTOP_WIDTH, useCORS: true });
    document.body.removeChild(container);

    const a = document.createElement('a');
    a.download = 'grading-heatmap.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  reset() {
    if (!confirm("Reset all data?")) return;
    this.state = JSON.parse(JSON.stringify(DEFAULT));
    localStorage.removeItem("uva-heatmap-v2");
    this.render();
  }
}

// Initialize app on load
document.addEventListener("DOMContentLoaded", () => {
  new GradingHeatmapApp();
});
