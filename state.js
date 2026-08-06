const DEFAULT = { courses: [], yearMap: {} };

function loadState() {
  try {
    const s = localStorage.getItem("uva-heatmap-v2");
    if (s) return JSON.parse(s);
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
    if (enc) return JSON.parse(decodeURIComponent(escape(atob(enc))));
  } catch {}
  return null;
}

function encodeStateToURL(state) {
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  return window.location.href.split("?")[0] + "?s=" + enc;
}