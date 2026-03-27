// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
// APP_VERSION is defined in js/defaults.js (loaded first)

let S = { nodes: [], currentId: null };
let activeFilter = 'all';
let connType = 'related';

const TAG_COLORS = ['#a78bfa','#6ee7b7','#f87171','#fbbf24','#60a5fa','#f472b6','#fb923c','#a3e635','#2dd4bf','#e879f9'];
// ── Live config (initialised from CFG_DEFAULTS defined in js/defaults.js) ────────
let CFG = JSON.parse(JSON.stringify(CFG_DEFAULTS));

function statusColor(id)  { return CFG.statuses.find(s => s.id === id)?.color || '#555'; }
function statusLabel(id)  { return CFG.statuses.find(s => s.id === id)?.name  || id; }
function typeConfig(id)   { return CFG.types.find(t => t.id === id) || CFG.types[0]; }
const PRIORITY_ICON = { low:'↓', medium:'→', high:'↑', critical:'‼' };
const PRIORITY_COLOR = { low:'#555', medium:'#fbbf24', high:'#f87171', critical:'#f87171' };
let tagColorMap = {};
let tci = 0;

function gTC(tag) {
  if (!tagColorMap[tag]) tagColorMap[tag] = TAG_COLORS[tci++ % TAG_COLORS.length];
  return tagColorMap[tag];
}
function gid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(d) { if (!d) return '—'; return new Date(d + 'T12:00:00').toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'}); }
function fmtCur(n) { return n != null && n !== '' ? CFG.currency + parseFloat(n).toLocaleString('es',{minimumFractionDigits:0,maximumFractionDigits:2}) : '—'; }
function fmtH(n)   { return n != null && n !== '' ? parseFloat(n).toFixed(1) + CFG.durationUnit : '—'; }

// ── Shared UI helpers ────────────────────────────────────────────────────────
function showIndicator(text) {
  const ind = document.getElementById('sb-save-indicator');
  if (ind) { ind.textContent = text; ind.style.opacity = '1'; setTimeout(() => ind.style.opacity = '0', 2000); }
}

function applySnapshot(data) {
  S.nodes = data.nodes;
  tagColorMap = data.tagColorMap || {};
  tci = data.tci || Object.keys(tagColorMap).length;
  S.currentId = S.nodes.length ? S.nodes[0].id : null;
  if (data.cfg) {
    CFG = {
      ...CFG_DEFAULTS,
      ...data.cfg,
      statuses: data.cfg.statuses?.length ? data.cfg.statuses : CFG_DEFAULTS.statuses,
      types:    data.cfg.types?.length    ? data.cfg.types    : CFG_DEFAULTS.types,
    };
  }
  if (data.graphPositions) _graphPositions = data.graphPositions;
}

function progressColor(pct) {
  return pct >= 80 ? 'var(--accent)' : pct >= 40 ? 'var(--warn)' : 'var(--info)';
}

