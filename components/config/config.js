// ══════════════════════════════════════════════════════
//  CONFIG
//  Draft-based editing: changes apply only on saveCfg()
// ══════════════════════════════════════════════════════
let _cfgDraft = null;

// Called by switchView('config') after DOM is ready
function renderCfgPanel() {
  _cfgDraft = JSON.parse(JSON.stringify(CFG)); // deep clone
  renderCfgStatuses();
  renderCfgTypes();
  renderCfgAppearance();
}

function switchCfgTab(el, tab) {
  document.querySelectorAll('.cfg-tab').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  ['states', 'types', 'appearance'].forEach(t => {
    const p = document.getElementById('cfg-panel-' + t);
    if (p) p.style.display = t === tab ? 'block' : 'none';
  });
}

// ── STATUSES ──────────────────────────────────────────────────────────────────
function renderCfgStatuses() {
  const list = document.getElementById('cfg-statuses-list');
  if (!list) return;
  list.innerHTML = _cfgDraft.statuses.map(s => `
    <div class="cfg-row" data-id="${s.id}">
      <input type="color" class="cfg-color" value="${s.color}"
             onchange="updateCfgStatus('${s.id}','color',this.value)">
      <input class="cfg-name" type="text" value="${esc(s.name)}"
             oninput="updateCfgStatus('${s.id}','name',this.value)">
      <span class="cfg-id-badge">${esc(s.id)}</span>
      <button class="cfg-del" onclick="deleteCfgStatus('${s.id}')"
              ${_cfgDraft.statuses.length <= 1 ? 'disabled' : ''}>✕</button>
    </div>`).join('');
}

function updateCfgStatus(id, field, value) {
  const s = _cfgDraft.statuses.find(x => x.id === id);
  if (s) s[field] = value;
}

function addCfgStatus() {
  const id = 'st_' + Date.now().toString(36);
  _cfgDraft.statuses.push({ id, name: 'Nuevo estado', color: '#888888' });
  renderCfgStatuses();
}

function deleteCfgStatus(id) {
  if (_cfgDraft.statuses.length <= 1) return;
  const inUse = S.nodes.some(n => n.status === id);
  if (inUse && !confirm(`El estado "${id}" está en uso en una o más tareas. ¿Eliminar igualmente?`)) return;
  _cfgDraft.statuses = _cfgDraft.statuses.filter(s => s.id !== id);
  renderCfgStatuses();
}

// ── TYPES ─────────────────────────────────────────────────────────────────────
const SHAPE_OPTIONS = ['circle', 'rect', 'diamond'];

function renderCfgTypes() {
  const list = document.getElementById('cfg-types-list');
  if (!list) return;
  list.innerHTML = _cfgDraft.types.map(t => `
    <div class="cfg-type-card" data-id="${t.id}">
      <div class="cfg-type-row1">
        <input type="color" class="cfg-color" value="${t.color}"
               onchange="updateCfgType('${t.id}','color',this.value)">
        <input class="cfg-name" type="text" value="${esc(t.name)}"
               oninput="updateCfgType('${t.id}','name',this.value)">
        <span class="cfg-id-badge">${esc(t.id)}</span>
        <button class="cfg-del" onclick="deleteCfgType('${t.id}')"
                ${_cfgDraft.types.length <= 1 ? 'disabled' : ''}>✕</button>
      </div>
      <div class="cfg-type-row2">
        <span style="font-size:10px;color:var(--t3);font-family:var(--sans)">Forma</span>
        <select class="cfg-select" onchange="updateCfgType('${t.id}','shape',this.value)">
          ${SHAPE_OPTIONS.map(s => `<option value="${s}" ${t.shape === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <div class="cfg-color-pair">
          <span>Borde</span>
          <input type="color" class="cfg-color" style="width:24px;height:24px"
                 value="${t.borderColor || t.color}"
                 onchange="updateCfgType('${t.id}','borderColor',this.value)">
        </div>
        <label class="cfg-toggle-label">
          <input type="checkbox" ${t.isGroup ? 'checked' : ''}
                 onchange="updateCfgType('${t.id}','isGroup',this.checked)">
          Agrupa hijos
        </label>
      </div>
    </div>`).join('');
}

function updateCfgType(id, field, value) {
  const t = _cfgDraft.types.find(x => x.id === id);
  if (t) t[field] = value;
}

function addCfgType() {
  const id = 'type_' + Date.now().toString(36);
  _cfgDraft.types.push({
    id, name: 'Nuevo tipo', isGroup: false,
    shape: 'circle', color: '#888888', borderColor: '#888888',
  });
  renderCfgTypes();
}

function deleteCfgType(id) {
  if (_cfgDraft.types.length <= 1) return;
  const inUse = S.nodes.some(n => n.type === id);
  if (inUse && !confirm(`El tipo "${id}" está en uso en una o más tareas. ¿Eliminar igualmente?`)) return;
  _cfgDraft.types = _cfgDraft.types.filter(t => t.id !== id);
  renderCfgTypes();
}

// ── APPEARANCE ────────────────────────────────────────────────────────────────
function renderCfgAppearance() {
  // Theme buttons
  document.querySelectorAll('.cfg-theme-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.t === _cfgDraft.theme);
  });
  const customPanel = document.getElementById('cfg-custom-tokens');
  if (customPanel) customPanel.style.display = _cfgDraft.theme === 'custom' ? 'grid' : 'none';

  // Token pickers
  const tok = _cfgDraft.themeTokens || {};
  ['bg','surface','accent','text'].forEach(k => {
    const el = document.getElementById('cfg-tok-' + k);
    if (el && tok[k]) el.value = tok[k];
  });

  // Units
  const cur = document.getElementById('cfg-currency');
  const dur = document.getElementById('cfg-duration');
  if (cur) { cur.value = _cfgDraft.currency || '€'; updateCfgUnitPreview(); }
  if (dur) { dur.value = _cfgDraft.durationUnit || 'd'; updateCfgUnitPreview(); }
}

function setCfgThemeDraft(theme) {
  _cfgDraft.theme = theme;
  renderCfgAppearance();
}

function updateCfgToken(key, value) {
  if (!_cfgDraft.themeTokens) _cfgDraft.themeTokens = {};
  _cfgDraft.themeTokens[key] = value;
}

function updateCfgUnit(key, value) {
  _cfgDraft[key] = value;
  updateCfgUnitPreview();
}

function updateCfgUnitPreview() {
  const cur = document.getElementById('cfg-currency');
  const dur = document.getElementById('cfg-duration');
  const cp  = document.getElementById('cfg-currency-preview');
  const dp  = document.getElementById('cfg-duration-preview');
  if (cp && cur) cp.textContent = `Ej: ${cur.value || '€'}1.500`;
  if (dp && dur) dp.textContent = `Ej: 3.5${dur.value || 'd'}`;
}

// ── THEME ENGINE ────────────────────────────────────────────────────────
function applyTheme() {
  const root = document.documentElement;
  const CUSTOM_VARS = ['--bg','--s1','--accent','--t1']; // cleanup on theme change

  if (CFG.theme === 'light') {
    root.setAttribute('data-theme', 'light');
    CUSTOM_VARS.forEach(v => root.style.removeProperty(v));
  } else if (CFG.theme === 'custom') {
    root.removeAttribute('data-theme');
    const t = CFG.themeTokens || {};
    if (t.bg)      root.style.setProperty('--bg', t.bg);
    if (t.surface) root.style.setProperty('--s1', t.surface);
    if (t.accent)  root.style.setProperty('--accent', t.accent);
    if (t.text)    root.style.setProperty('--t1', t.text);
  } else {
    // dark (default) — remove all overrides
    root.removeAttribute('data-theme');
    CUSTOM_VARS.forEach(v => root.style.removeProperty(v));
  }
}──────
function saveCfg() {
  CFG = JSON.parse(JSON.stringify(_cfgDraft));
  autoSaveLS();
  applyTheme();
  populateEditorSelects();
  renderStatusFilterButtons();
  renderList();
  renderEditor();
  showIndicator('⚙ Configuración guardada');
}

function resetCfgToDefaults() {
  if (!confirm('¿Restaurar todos los ajustes a los valores por defecto?')) return;
  _cfgDraft = JSON.parse(JSON.stringify(CFG_DEFAULTS));
  renderCfgStatuses();
  renderCfgTypes();
  renderCfgAppearance();
}

// ── EDITOR SELECT SYNC ────────────────────────────────────────────────────────
// Populates #type-select and #status-select from CFG (call on init + after saveCfg)
function populateEditorSelects() {
  const typeEl   = document.getElementById('type-select');
  const statusEl = document.getElementById('status-select');
  if (!typeEl || !statusEl) return;

  const prevType   = typeEl.value;
  const prevStatus = statusEl.value;

  typeEl.innerHTML = CFG.types.map(t =>
    `<option value="${t.id}">${esc(t.name)}</option>`
  ).join('');

  statusEl.innerHTML = CFG.statuses.map(s =>
    `<option value="${s.id}">${esc(s.name)}</option>`
  ).join('');

  // Restore previous selection if still valid, otherwise select first
  typeEl.value   = CFG.types.find(t => t.id === prevType)   ? prevType   : CFG.types[0]?.id;
  statusEl.value = CFG.statuses.find(s => s.id === prevStatus) ? prevStatus : CFG.statuses[0]?.id;

  // Re-apply status color on the select element
  const sc = statusColor(statusEl.value);
  statusEl.style.background = sc + '22';
  statusEl.style.borderColor = sc + '55';
  statusEl.style.color = sc;
}

// ── SIDEBAR FILTER BUTTONS ────────────────────────────────────────────────────
// Rebuilds #sb-filter from CFG.statuses (called on init + after saveCfg)
function renderStatusFilterButtons() {
  const container = document.getElementById('sb-filter');
  if (!container) return;

  const current = activeFilter;

  container.innerHTML =
    `<button class="sf ${current === 'all' ? 'on' : ''}" data-f="all" onclick="setFilter(this)">Todo</button>` +
    CFG.statuses.map(s =>
      `<button class="sf ${current === s.id ? 'on' : ''}"
               data-f="${s.id}"
               onclick="setFilter(this)"
               style="${current === s.id ? `color:${s.color};border-color:${s.color}44` : ''}"
       >${esc(s.name)}</button>`
    ).join('');
}
