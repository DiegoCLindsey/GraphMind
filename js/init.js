// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

function init() {
  // Load from localStorage; start empty if nothing saved
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.nodes) applySnapshot(data);
    }
  } catch(e) { console.warn('GraphMind: error al cargar localStorage', e); }
  // Recompute planner endHour and blocked start dates after load (calendar may have changed)
  if (typeof recalcAllBlockedDates === 'function') recalcAllBlockedDates();
  // Always persist CFG on startup so defaults land in localStorage/export from session 1
  autoSaveLS();
  renderList(); renderEditor(); updateCount();
}


// ══════════════════════════════════════════════════════
