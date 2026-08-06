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
      <header class="header">
        <div class="header-left">
          <img src="https://upload.wikimedia.org/wikipedia/commons/d/d1/Amsterdamuniversitylogo.svg" alt="UvA logo" class="uva-logo" />
          <span class="header-title">Grading Heatmap 2026–27</span>
        </div>
        <div class="header-right">
          <button class="header-btn" id="share-btn"><i class="fa-solid fa-link"></i>${this.shareMsg ? ` — ${this.shareMsg}` : " Share"}</button>
          <button class="header-btn" id="png-btn"><i class="fa-solid fa-download"></i> PNG</button>
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
        <div class="add-row">
          <input class="input" id="course-input" placeholder="Course name…" value="${this.newCourseName}">
          <button class="add-btn" id="add-course-btn">+</button>
        </div>

        ${grouped.map((group, yi) => `
          <div class="year-section" id="year-${yi}" data-year="${yi}">
            <div class="year-label">
              <span>${group.label === "Unassigned" ? "Unassigned: drag to year" : group.label}</span>
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
  
  editAssessmentModal(courseId, assessmentId, fromDate = null) {
    const course = this.state.courses.find(c => c.id === courseId);
    const assessment = course?.assessments.find(a => a.id === assessmentId);
    if (!assessment) return;

    const [year, month, day] = assessment.date.split('-');

    const html = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;" id="modal-overlay">
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

    const overlay   = document.getElementById("modal-overlay");
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

  showDatePickerModal(iso) {
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
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;" id="modal-overlay">
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
    
    // Add keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById("modal-overlay")?.remove();
      }
      if (e.key === 'Enter' && document.getElementById("modal-add")) {
        document.getElementById("modal-add").click();
      }
    });

    document.getElementById("modal-add").addEventListener("click", () => {
      const courseId = document.getElementById("modal-course").value;
      const name = document.getElementById("modal-name").value.trim();
      if (!courseId || !name) {
        alert("Please select a course and enter a name");
        return;
      }
      
      const course = this.state.courses.find(c => c.id === courseId);
      if (course) {
        course.assessments.push({
          id: uid(),
          name: name,
          date: iso
        });
        saveState(this.state);
      }
      
      document.getElementById("modal-overlay").remove();
      this.render();
    });
    
    document.getElementById("modal-cancel").addEventListener("click", () => {
      document.getElementById("modal-overlay").remove();
    });

    // Add edit listeners
    assessmentsOnDay.forEach(a => {
      const course = this.state.courses.find(c => c.name === a.course);
      const assessment = course?.assessments.find(x => x.name === a.name);
      const btn = document.getElementById(`edit-${assessment.id}`);
      if (btn) {
        btn.addEventListener("click", () => {
          document.getElementById("modal-overlay").remove();
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
    // Header buttons
    document.getElementById("add-course-btn")?.addEventListener("click", () => this.addCourse());
    document.getElementById("course-input")?.addEventListener("keydown", e => e.key === "Enter" && this.addCourse());
    document.getElementById("share-btn")?.addEventListener("click", () => this.share());
    document.getElementById("png-btn")?.addEventListener("click", () => this.downloadPNG());
    document.getElementById("reset-btn")?.addEventListener("click", () => this.reset());

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
      color: COURSE_COLORS[this.state.courses.length % COURSE_COLORS.length]
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
    if (!name.trim() || !day || !month || !year) return;
    
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const course = this.state.courses.find(c => c.id === courseId);
    if (course) {
      course.assessments.push({
        id: uid(),
        name: name,
        date: iso
      });
      this.newAssessment = { name: "", day: "", month: "", year: "" };
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
    (h.assessments || []).forEach(a => lines.push(`📋 ${a.course}: ${a.name}`));
    if (h.count > 0) lines.push(`⏱ ${h.count} grading window${h.count > 1 ? "s" : ""} active`);
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
    const calRef = document.getElementById("calendar-ref");
    if (!calRef) return;
    const canvas = await html2canvas(calRef, { scale: 2, backgroundColor: "#f5f5f0" });
    const a = document.createElement("a");
    a.download = "grading-heatmap.png";
    a.href = canvas.toDataURL("image/png");
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