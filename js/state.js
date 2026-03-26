// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
const APP_VERSION = '1.0.0';

let S = { nodes: [], currentId: null };
let activeFilter = 'all';
let connType = 'related';

const TAG_COLORS = ['#a78bfa','#6ee7b7','#f87171','#fbbf24','#60a5fa','#f472b6','#fb923c','#a3e635','#2dd4bf','#e879f9'];
const STATUS_COLORS = { todo:'#555', doing:'#60a5fa', review:'#fbbf24', done:'#6ee7b7', blocked:'#f87171' };
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
function fmtCur(n) { return n != null && n !== '' ? '€' + parseFloat(n).toLocaleString('es',{minimumFractionDigits:0,maximumFractionDigits:2}) : '—'; }
function fmtH(n) { return n != null && n !== '' ? parseFloat(n).toFixed(1) + 'd' : '—'; }

