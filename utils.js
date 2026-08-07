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
    const multiplier = course.loadMultiplier || 1;
    (course.assessments || []).forEach(a => {
      if (!a.date) return;
      const iso = a.date;
      if (!map[iso]) map[iso] = { assessments: [], count: 0 };
      map[iso].assessments.push({ course: course.name, name: a.name });
      getGradingDays(iso).forEach(g => {
        if (!map[g]) map[g] = { assessments: [], count: 0 };
        map[g].count += multiplier;
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

function parseICS(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  blocks.shift(); // remove header

  for (const block of blocks) {
    // Extract fields
    const summary = (block.match(/^SUMMARY:(.+)$/m) || [])[1]?.trim() || '';
    const dtstart = (block.match(/^DTSTART[^:]*:(.+)$/m) || [])[1]?.trim() || '';
    const description = block
      .split('DESCRIPTION:')[1]?.split('\nTRANSP')[0]
      ?.replace(/\n /g, '') // unfold wrapped lines
      ?.replace(/\\n/g, '\n') || '';

    // Extract type
    const descriptionMatch = description.match(/Type:\s*(.+?)(?:\n|$)/);
    const type = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Exclude these types
    const excludedTypes = ['tutorial', 'lecture', 'seminar', 'inspection', 'group', 'groep', 'meeting', 'walk-in', 'workshop', 'optional', 'tutoring', 'session', 'practical'];
    const typeLower = type.toLowerCase().split(':')[0]; // Get only the part before the colon
    if (excludedTypes.some(excluded => typeLower.includes(excluded))) continue;

    // Skip if no type at all
    if (!type) continue;

    // Strip [DRAFT] and clean escaped characters from course name
    let courseName = summary
      .replace(/^\[DRAFT\]\s*/i, '')
      .replace(/\\,/g, ',')
      .replace(/\\n/g, '')
      .replace(/\\\s+/g, ' ')
      .trim();

    // Extract assessment label - look for text after "Staff member(s):" line
    let label = '';
    const staffMatch = description.match(/Staff member\(s\):[^\n]+\n+([^\n]+)/);
    if (staffMatch) {
      label = staffMatch[1].trim();
    }
    
    // Boilerplate phrases to exclude
    const boilerplate = [
      'the times',
      'locations',
      'size:',
      'study guide',
      'appointment is managed',
      'subject to change',
      'last synchronised'
    ];
    
    // If label is boilerplate, use type instead
    if (!label || boilerplate.some(phrase => label.toLowerCase().includes(phrase))) {
      label = type || 'Event';
    }
    
    // Clean up label
    label = label
      .replace(/\\,/g, ',')
      .replace(/\\n/g, '')
      .replace(/\\\s+/g, ' ')
      .replace(/computer-based /i, '')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();

    // Parse date from DTSTART (UTC → Amsterdam local)
    const dateMatch = dtstart.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!dateMatch) continue;
    const utcDate = new Date(Date.UTC(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3]),
      parseInt(dateMatch[4]),
      parseInt(dateMatch[5])
    ));
    const local = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    const day   = String(local.getDate()).padStart(2, '0');
    const month = String(local.getMonth() + 1).padStart(2, '0');
    const year  = String(local.getFullYear());

    events.push({ courseName, label, date: `${day}/${month}/${year}`, day, month, year });
  }

  return events;
}