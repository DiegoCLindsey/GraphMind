// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

function init() {
  // Load from localStorage; start empty if nothing saved
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.nodes) {
        S.nodes = data.nodes;
        tagColorMap = data.tagColorMap || {};
        tci = data.tci || Object.keys(tagColorMap).length;
        S.currentId = S.nodes.length ? S.nodes[0].id : null;
      }
    }
  } catch(e) { console.warn('GraphMind: error al cargar localStorage', e); }
  renderList(); renderEditor(); updateCount();

  // Auto-collapse editor header on mobile when scrolling body area
  const _editorArea = document.getElementById('editor-body-area');
  if (_editorArea) {
    _editorArea.addEventListener('scroll', function() {
      if (window.innerWidth > 768) return;
      const eh = document.getElementById('eh');
      const grid = document.getElementById('metrics-grid');
      const agg  = document.getElementById('agg-bar');
      if (this.scrollTop > 20) {
        if (!grid.classList.contains('collapsed')) {
          grid.classList.add('collapsed');
          if (agg) agg.classList.add('collapsed');
          const icon = document.getElementById('metrics-toggle-icon');
          const lbl  = document.getElementById('metrics-toggle-label');
          if (icon) icon.textContent = '▶';
          if (lbl)  lbl.textContent  = 'DETALLES';
          eh.style.paddingBottom = '4px';
        }
      } else if (this.scrollTop === 0) {
        eh.style.paddingBottom = '';
      }
    }, { passive: true });
  }
}


// ══════════════════════════════════════════════════════
