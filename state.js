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
  return DEFAULT;
}

function saveState(state) {
  localStorage.setItem("uva-heatmap-v2", JSON.stringify(state));
}

function loadFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    const enc = params.get("s");
    if (enc) {
      const state = JSON.parse(decodeURIComponent(escape(atob(enc))));
      state.courses.forEach(c => { c.loadMultiplier = c.loadMultiplier ?? 1; });
      return state;
    }
  } catch {}
  return null;
}

function encodeStateToURL(state) {
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  return window.location.href.split("?")[0] + "?s=" + enc;
}