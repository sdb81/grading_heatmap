const DEFAULT = { courses: [], yearMap: {} };

function loadState() {
  try {
    const s = localStorage.getItem("uva-heatmap-v2");
    if (s) {
      const state = JSON.parse(s);
      state.courses.forEach(c => { c.loadMultiplier = c.loadMultiplier ?? 1; });
      return state;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT));
}

function saveState(state) {
  localStorage.setItem("uva-heatmap-v2", JSON.stringify(state));
}


function loadFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    const enc = params.get("s");
    if (!enc) return null;

    const p = JSON.parse(decodeURIComponent(escape(atob(enc))));

    // Legacy format
    if (p.courses) {
      p.courses.forEach(c => { c.loadMultiplier = c.loadMultiplier ?? 1; });
      return p;
    }

    // New minimal format
    const yearMap = {};
    const courses = p.c.map(c => {
      const id = uid();
      yearMap[id] = p.y[c.n] ?? 3;
      return {
        id,
        name: c.n,
        color: '#' + c.k,
        on: c.o !== 0,
        loadMultiplier: 1,
        assessments: c.a.map(a => ({ id: uid(), name: a.n, date: `20${a.d.slice(0,2)}-${a.d.slice(2,4)}-${a.d.slice(4,6)}` }))
      };
    });

    return { courses, yearMap };
  } catch {}
  return null;
}

function encodeStateToURL(state) {
  const minimal = {
    c: state.courses.map(c => ({
      n: c.name,
      k: c.color.slice(1),
      o: c.on ? 1 : 0,
      a: c.assessments.map(a => ({
        n: a.name,
        d: a.date.replace(/-/g, '').slice(2)
      }))
    })),
    y: Object.fromEntries(
      state.courses.map(c => [c.name, state.yearMap[c.id] ?? 3])
    )
  };
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(minimal))));
  return window.location.href.split("?")[0] + "?s=" + enc;
}