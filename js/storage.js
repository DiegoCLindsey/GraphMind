// ══════════════════════════════════════════════════════
//  LOCALSTORAGE
// ══════════════════════════════════════════════════════
const LS_KEY = 'graphmind_session';

function saveToLS() {
  try {
    const data = JSON.stringify({ version: APP_VERSION, nodes: S.nodes, tagColorMap, tci, cfg: CFG });
    localStorage.setItem(LS_KEY, data);
    showIndicator(t('common.saved'));
  } catch(e) { alert(t('common.error_save') + e.message); }
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { alert(t('common.no_session')); return; }
    const data = JSON.parse(raw);
    if (!data.nodes) throw new Error(t('common.invalid_data'));
    applySnapshot(data);
    renderList(); renderEditor(); updateCount();
    showIndicator(t('common.loaded'));
  } catch(e) { alert(t('common.error_load') + e.message); }
}

let _autoSaveTimer = null;
function autoSaveLS() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ version: APP_VERSION, nodes: S.nodes, tagColorMap, tci, cfg: CFG })); } catch(e) {}
  }, 800);
}

// ══════════════════════════════════════════════════════
//  IMPORT / EXPORT
// ══════════════════════════════════════════════════════
function openIO(mode) {
  const title = document.getElementById('io-title');
  const ta = document.getElementById('io-ta');
  const btn = document.getElementById('io-btn');
  if (mode === 'export') {
    title.textContent = t('modals.io_export_title');
    ta.value = JSON.stringify({version: APP_VERSION, nodes:S.nodes, tagColorMap, cfg: CFG}, null, 2);
    ta.readOnly = true;
    btn.textContent = t('modals.io_copy_btn');
    btn.onclick = () => { navigator.clipboard.writeText(ta.value).then(()=>{ btn.textContent=t('common.copied'); setTimeout(()=>btn.textContent=t('modals.io_copy_btn'),2000); }); };
  } else {
    title.textContent = t('modals.io_import_title');
    ta.value = ''; ta.readOnly = false; ta.placeholder = t('modals.io_import_ph');
    btn.textContent = t('modals.io_import_btn');
    btn.onclick = () => {
      try {
        const data = JSON.parse(ta.value);
        if (!data.nodes) throw new Error(t('common.invalid_format'));
        applySnapshot(data);
        renderList(); renderEditor(); updateCount();
        closeModal('io-modal');
      } catch(err) { alert(t('common.error_import') + err.message); }
    };
  }
  openModal('io-modal');
}

