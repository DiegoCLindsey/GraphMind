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
}


// ══════════════════════════════════════════════════════
