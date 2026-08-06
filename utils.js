function getISOWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isWorkingDay(iso) {
  const d = new Date(iso + "T00:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (FEESTDAGEN.has(iso)) return false;
  if (VRIJE_ISO_WEEKS.has(getISOWeek(d))) return false;
  return true;
}

function getGradingDays(assessISO) {
  const days = [];
  const cur = new Date(assessISO + "T00:00:00");
  cur.setDate(cur.getDate() + 1);
  while (days.length < 15) {
    const iso = toISO(cur);
    if (isWorkingDay(iso)) days.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function isVrije(iso) {
  return VRIJE_ISO_WEEKS.has(getISOWeek(new Date(iso + "T00:00:00")));
}

function isFeestdag(iso) {
  return FEESTDAGEN.has(iso);
}

function isWeekend(iso) {
  const d = new Date(iso + "T00:00:00").getDay();
  return d === 0 || d === 6;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function buildMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7;
  const weeks = [];
  let week = Array(startDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  while (weeks.length < 6) weeks.push(Array(7).fill(null));
  return weeks;
}

function computeHeatmap(courses) {
  const map = {};
  courses.filter(c => c.on).forEach(course => {
    (course.assessments || []).forEach(a => {
      if (!a.date) return;
      const iso = a.date;
      if (!map[iso]) map[iso] = { assessments: [], count: 0 };
      map[iso].assessments.push({ course: course.name, name: a.name });
      getGradingDays(iso).forEach(g => {
        if (!map[g]) map[g] = { assessments: [], count: 0 };
        map[g].count++;
      });
    });
  });
  return map;
}

function dayBgColor(iso, heatData) {
  const h = heatData[iso];
  const isAssess = h?.assessments?.length > 0;
  if (isAssess) return { bg: "#b8b3ad", fg: "#333", bold: true };
  const cnt = h?.count || 0;
  if (cnt === 0) {
    if (isVrije(iso)) return { bg: "#f5ede0", fg: "#999" };
    if (isFeestdag(iso)) return { bg: "#e8e8e8", fg: "#aaa" };
    if (isWeekend(iso)) return { bg: "#f0f0f0", fg: "#bbb" };
    return { bg: "#fff", fg: "#222" };
  }
  let alpha, bg;
  if (cnt === 1) {
    alpha = 0.2;
    bg = `rgba(200,80,80,${alpha})`;
  } else if (cnt === 2) {
    alpha = 0.4;
    bg = `rgba(180,40,40,${alpha})`;
  } else if (cnt === 3) {
    alpha = 0.6;
    bg = `rgba(160,0,0,${alpha})`;
  } else {
    alpha = 0.85;
    bg = `rgba(139,0,0,${alpha})`;
  }
  return { bg, fg: cnt >= 2 ? "#fff" : "#1a1a1a", bold: false };
}