// ══════════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('keydown', e => { if(e.key==='Escape') document.querySelectorAll('.overlay.open').forEach(el=>closeModal(el.id)); });

// ══════════════════════════════════════════════════════
//  MOBILE SIDEBAR & COLLAPSIBLE METRICS
// ══════════════════════════════════════════════════════
let metricsCollapsed = false;
function toggleMetrics() {
  metricsCollapsed = !metricsCollapsed;
  const grid = document.getElementById('metrics-grid');
  const agg = document.getElementById('agg-bar');
  const icon = document.getElementById('metrics-toggle-icon');
  const lbl = document.getElementById('metrics-toggle-label');
  if (metricsCollapsed) {
    grid.classList.add('collapsed');
    if (agg) agg.classList.add('collapsed');
    icon.textContent = '▶';
    lbl.textContent = 'DETALLES (oculto)';
  } else {
    grid.classList.remove('collapsed');
    if (agg) agg.classList.remove('collapsed');
    icon.textContent = '▼';
    lbl.textContent = 'DETALLES';
  }
}

// Auto-collapse metrics on mobile when opening editor
function applyMobileDefaults() {
  if (window.innerWidth <= 700 && !metricsCollapsed) {
    // collapse by default on mobile
    metricsCollapsed = true;
    const grid = document.getElementById('metrics-grid');
    const icon = document.getElementById('metrics-toggle-icon');
    const lbl = document.getElementById('metrics-toggle-label');
    if (grid) {
      grid.classList.add('collapsed');
      icon.textContent = '▶';
      lbl.textContent = 'DETALLES (oculto)';
    }
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  sb.classList.toggle('open');
  bd.classList.toggle('open');
}

function setSidebarFold(folded) {
  if (window.innerWidth <= 768) return; // mobile uses overlay — don't fold
  const sb  = document.getElementById('sidebar');
  const btn = document.getElementById('sb-fold-btn');
  if (!sb) return;
  sb.classList.toggle('sb-folded', folded);
  if (btn) btn.innerHTML = folded ? '&#9654;' : '&#9664; Tareas';
  if (btn) btn.title = folded ? 'Expandir barra lateral' : 'Colapsar barra lateral';
}

function toggleSidebarFold() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  setSidebarFold(!sb.classList.contains('sb-folded'));
}


// ── Gantt config panel (mobile) ──────────────────────────────────────────────
function toggleGanttCfg() {
  document.getElementById('gantt-toolbar-panel').classList.toggle('open');
}
// Close config panel when clicking outside
document.addEventListener('click', e => {
  const panel = document.getElementById('gantt-toolbar-panel');
  const btn   = document.getElementById('gantt-cfg-btn');
  if (panel && !panel.contains(e.target) && e.target !== btn) {
    panel.classList.remove('open');
  }
});

// ── Gantt tree panel collapse ─────────────────────────────────────────────────
let ganttTreeCollapsed = false;
function toggleGanttTree() {
  ganttTreeCollapsed = !ganttTreeCollapsed;
  const left = document.getElementById('gantt-left');
  const btn  = document.getElementById('gantt-toggle-tree');
  left.classList.toggle('collapsed', ganttTreeCollapsed);
  btn.textContent = ganttTreeCollapsed ? '▶' : '◀';
  // Trigger re-render so header canvas resizes
  setTimeout(renderGantt, 60);
}

// ── Editor header snap-collapse on mobile scroll ──────────────────────────────
let ehSnapped = false;
function toggleEhSnap(force) {
  if (window.innerWidth > 768) return;
  ehSnapped = force !== undefined ? force : !ehSnapped;
  const eh = document.getElementById('eh');
  eh.classList.toggle('snap-collapsed', ehSnapped);
  const bar = document.getElementById('eh-snap-bar');
  if (bar) bar.style.background = ehSnapped ? 'var(--accent)' : 'var(--b1)';
}

// Attach scroll listener to editor body area (called by setupListeners after DOM ready)
function attachEditorScroll() {
  const area = document.getElementById('editor-body-area');
  if (!area) return;
  area.addEventListener('scroll', () => {
    if (window.innerWidth > 768) return;
    const sy = area.scrollTop;
    // Snap editor header at 60px
    if (sy > 60 && !ehSnapped) toggleEhSnap(true);
    if (sy < 10 && ehSnapped)  toggleEhSnap(false);
    // Auto-collapse metrics at 20px (via toggleMetrics para mantener el estado sincronizado)
    if (sy > 20 && !metricsCollapsed) toggleMetrics();
  }, { passive: true });
}

// ══════════════════════════════════════════════════════
//  SETUP LISTENERS — call after DOM partials are injected
// ══════════════════════════════════════════════════════
function setupListeners() {
  // Overlay click-outside to close modals
  document.querySelectorAll('.overlay').forEach(el => el.addEventListener('click', e => {
    if (e.target === el) closeModal(el.id);
  }));

  // Status select color sync
  document.getElementById('status-select').addEventListener('change', function() {
    const sc = statusColor(this.value);
    this.style.background = sc + '22';
    this.style.borderColor = sc + '55';
    this.style.color = sc;
  });

  // Editor snap-collapse on mobile scroll
  attachEditorScroll();

  // Gantt ResizeObserver
  const ganttWrap = document.getElementById('gantt-right-wrap');
  if (ganttWrap) {
    new ResizeObserver(() => { if (currentView === 'gantt') renderGantt(); }).observe(ganttWrap);
  }
}

