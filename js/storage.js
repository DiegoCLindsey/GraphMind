// ══════════════════════════════════════════════════════
//  LOCALSTORAGE
// ══════════════════════════════════════════════════════
const LS_KEY = 'graphmind_session';

function saveToLS() {
  try {
    const data = JSON.stringify({ version:'0.0.8', nodes: S.nodes, tagColorMap, tci });
    localStorage.setItem(LS_KEY, data);
    const ind = document.getElementById('sb-save-indicator');
    if (ind) { ind.textContent = '💾 Guardado'; ind.style.opacity='1'; setTimeout(()=>ind.style.opacity='0', 2000); }
  } catch(e) { alert('Error al guardar: ' + e.message); }
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { alert('No hay sesión guardada en este navegador.'); return; }
    const data = JSON.parse(raw);
    if (!data.nodes) throw new Error('Datos inválidos');
    S.nodes = data.nodes;
    tagColorMap = data.tagColorMap || {};
    tci = data.tci || Object.keys(tagColorMap).length;
    S.currentId = S.nodes.length ? S.nodes[0].id : null;
    renderList(); renderEditor(); updateCount();
    const ind = document.getElementById('sb-save-indicator');
    if (ind) { ind.textContent = '📂 Recuperado'; ind.style.opacity='1'; setTimeout(()=>ind.style.opacity='0', 2000); }
  } catch(e) { alert('Error al recuperar: ' + e.message); }
}

let _autoSaveTimer = null;
function autoSaveLS() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ version:'0.0.8', nodes: S.nodes, tagColorMap, tci })); } catch(e) {}
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
    title.textContent = 'Exportar JSON';
    ta.value = JSON.stringify({version:'0.0.8', nodes:S.nodes, tagColorMap}, null, 2);
    ta.readOnly = true;
    btn.textContent = 'Copiar';
    btn.onclick = () => { navigator.clipboard.writeText(ta.value).then(()=>{ btn.textContent='✓ Copiado'; setTimeout(()=>btn.textContent='Copiar',2000); }); };
  } else {
    title.textContent = 'Importar JSON';
    ta.value = ''; ta.readOnly = false; ta.placeholder = 'Pega aquí tu JSON de GraphMind...';
    btn.textContent = 'Importar';
    btn.onclick = () => {
      try {
        const data = JSON.parse(ta.value);
        if (!data.nodes) throw new Error('Formato inválido — falta "nodes"');
        S.nodes = data.nodes;
        tagColorMap = data.tagColorMap || {};
        tci = Object.keys(tagColorMap).length;
        S.currentId = S.nodes.length ? S.nodes[0].id : null;
        renderList(); renderEditor(); updateCount();
        closeModal('io-modal');
      } catch(err) { alert('Error al importar: ' + err.message); }
    };
  }
  openModal('io-modal');
}

