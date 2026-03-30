// ══════════════════════════════════════════════════════
//  CONFIG
//  Draft-based editing: changes apply only on saveCfg()
// ══════════════════════════════════════════════════════
let _cfgDraft = null;

// Called by switchView('config') after DOM is ready
function renderCfgPanel() {
  _cfgDraft = JSON.parse(JSON.stringify(CFG));
  // Always reset to first tab so panels are in a known state
  const firstTab = document.querySelector('.cfg-tab[data-tab="states"]');
  if (firstTab) switchCfgTab(firstTab, 'states');
  renderCfgStatuses();
  renderCfgTypes();
  renderCfgAppearance();
  renderCfgPlanner();
}

function switchCfgTab(el, tab) {
  document.querySelectorAll('.cfg-tab').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  ['states', 'types', 'appearance', 'planner'].forEach(t => {
    const p = document.getElementById('cfg-panel-' + t);
    if (p) p.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'appearance') renderCfgAppearance();
  if (tab === 'planner')    renderCfgPlanner();
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
  if (inUse && !confirm(t('config.confirm_del_status').replace('{id}', id))) return;
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
  // Auto-include new type in breakdown filter if an explicit list exists
  if (_cfgDraft.breakdownInheritTypes?.length)
    _cfgDraft.breakdownInheritTypes.push(id);
  renderCfgTypes();
  renderCfgBreakdownTypes();
}

function deleteCfgType(id) {
  if (_cfgDraft.types.length <= 1) return;
  const inUse = S.nodes.some(n => n.type === id);
  if (inUse && !confirm(t('config.confirm_del_type').replace('{id}', id))) return;
  _cfgDraft.types = _cfgDraft.types.filter(t => t.id !== id);
  // Also clean up from breakdown filter if it was explicitly listed
  if (_cfgDraft.breakdownInheritTypes?.length)
    _cfgDraft.breakdownInheritTypes = _cfgDraft.breakdownInheritTypes.filter(x => x !== id);
  renderCfgTypes();
  renderCfgBreakdownTypes();
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
  // Graph animations toggle
  const anChk = document.getElementById('cfg-graph-animations');
  if (anChk) anChk.checked = _cfgDraft.graphAnimations !== false;

  // Breakdown inheritance
  const bdChk = document.getElementById('cfg-bd-inheritance');
  if (bdChk) bdChk.checked = _cfgDraft.breakdownInheritance !== false;
  renderCfgBreakdownTypes();
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

function updateCfgBool(key, value) {
  _cfgDraft[key] = value;
}

function updateCfgBreakdownInheritance(checked) {
  _cfgDraft.breakdownInheritance = checked;
  const wrap = document.getElementById('cfg-bd-types-wrap');
  if (wrap) wrap.style.opacity = checked ? '1' : '0.35';
  if (wrap) wrap.style.pointerEvents = checked ? '' : 'none';
}

function renderCfgBreakdownTypes() {
  const list = document.getElementById('cfg-bd-types-list');
  const wrap = document.getElementById('cfg-bd-types-wrap');
  if (!list) return;
  const selected = _cfgDraft.breakdownInheritTypes || [];
  const inherited = _cfgDraft.breakdownInheritance !== false;
  if (wrap) { wrap.style.opacity = inherited ? '1' : '0.35'; wrap.style.pointerEvents = inherited ? '' : 'none'; }
  list.innerHTML = _cfgDraft.types.map(tp => {
    const id = 'cfg-bd-tp-' + tp.id;
    const checked = selected.length === 0 || selected.includes(tp.id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2);cursor:pointer">
      <input type="checkbox" id="${id}" value="${esc(tp.id)}" ${checked}
             onchange="toggleCfgBreakdownType('${tp.id}',this.checked)">
      <span style="color:${esc(tp.borderColor||tp.color)}">${esc(tp.name)}</span>
    </label>`;
  }).join('');
}

function toggleCfgBreakdownType(typeId, checked) {
  // When all were implicitly selected (empty = all), first uncheck means "lock to remaining"
  const all = _cfgDraft.types.map(t => t.id);
  let sel = _cfgDraft.breakdownInheritTypes || [];
  if (sel.length === 0) sel = [...all]; // materialise the implicit all
  if (checked) { if (!sel.includes(typeId)) sel.push(typeId); }
  else { sel = sel.filter(id => id !== typeId); }
  // If all are checked again, collapse back to empty (= all)
  _cfgDraft.breakdownInheritTypes = sel.length === all.length ? [] : sel;
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
}

// ── SAVE / RESET ──────────────────────────────────────────────────────────────
function saveCfg() {
  CFG = JSON.parse(JSON.stringify(_cfgDraft));
  autoSaveLS();
  applyTheme();
  populateEditorSelects();
  renderStatusFilterButtons();
  renderList();
  renderEditor();
  renderGraph();
  showIndicator(t('config.saved'));
}

function resetCfgToDefaults() {
  if (!confirm(t('config.confirm_reset'))) return;
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

// ── PLANNER ───────────────────────────────────────────────────────────────────
const _DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function renderCfgHolidays() {
  const list = document.getElementById('cfg-holidays-list');
  if (!list) return;
  const holidays = _cfgDraft.planner?.holidays || [];
  if (!holidays.length) {
    list.innerHTML = `<div style="font-size:10px;color:var(--t3);padding:4px 0" data-i18n="config.planner_no_holidays">Sin festivos configurados.</div>`;
    return;
  }
  list.innerHTML = [...holidays].sort().map(d =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
       <span style="font-size:11px;font-family:var(--mono);color:var(--t2)">${d}</span>
       <button class="cfg-del" onclick="removeCfgHoliday('${d}')">✕</button>
     </div>`
  ).join('');
}

function addCfgHoliday() {
  const inp = document.getElementById('cfg-holiday-picker');
  if (!inp?.value) return;
  if (!_cfgDraft.planner) _cfgDraft.planner = {};
  if (!Array.isArray(_cfgDraft.planner.holidays)) _cfgDraft.planner.holidays = [];
  if (!_cfgDraft.planner.holidays.includes(inp.value)) {
    _cfgDraft.planner.holidays.push(inp.value);
    _cfgDraft.planner.holidays.sort();
  }
  inp.value = '';
  renderCfgHolidays();
}

function removeCfgHoliday(dateStr) {
  if (!_cfgDraft.planner?.holidays) return;
  _cfgDraft.planner.holidays = _cfgDraft.planner.holidays.filter(d => d !== dateStr);
  renderCfgHolidays();
}

function renderCfgPlanner() {
  const p = _cfgDraft.planner || {};
  const en = !!p.enabled;

  const enChk = document.getElementById('cfg-planner-enabled');
  if (enChk) enChk.checked = en;

  const body = document.getElementById('cfg-planner-body');
  if (body) { body.style.opacity = en ? '1' : '0.4'; body.style.pointerEvents = en ? '' : 'none'; }

  // Work-day checkboxes
  const wd = document.getElementById('cfg-workdays-row');
  if (wd) {
    const workDays = p.workDays || [1,2,3,4,5];
    wd.innerHTML = _DAY_LABELS.map((name, i) => {
      const checked = workDays.includes(i) ? 'checked' : '';
      return `<label style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-size:11px;color:var(--t2)">
        <input type="checkbox" ${checked} style="accent-color:var(--accent)"
               onchange="toggleCfgWorkDay(${i},this.checked)">
        <span>${name}</span>
      </label>`;
    }).join('');
  }

  const ws = document.getElementById('cfg-work-start');
  const we = document.getElementById('cfg-work-end');
  const dh = document.getElementById('cfg-daily-hours');
  if (ws) ws.value = p.workStart ?? 9;
  if (we) we.value = p.workEnd ?? 17;
  if (dh) dh.value = p.dailyWorkHours ?? 8;
  renderCfgDailyPreview();
  renderCfgAssigneeOverrides();
  renderCfgHolidays();
}

function updateCfgPlanner(key, value) {
  if (!_cfgDraft.planner) _cfgDraft.planner = {};
  _cfgDraft.planner[key] = value;
  if (key === 'enabled') {
    const body = document.getElementById('cfg-planner-body');
    if (body) { body.style.opacity = value ? '1' : '0.4'; body.style.pointerEvents = value ? '' : 'none'; }
  }
}

function toggleCfgWorkDay(dayIdx, checked) {
  if (!_cfgDraft.planner) _cfgDraft.planner = {};
  let wd = _cfgDraft.planner.workDays ? [..._cfgDraft.planner.workDays] : [1,2,3,4,5];
  if (checked) { if (!wd.includes(dayIdx)) wd.push(dayIdx); }
  else { wd = wd.filter(d => d !== dayIdx); }
  _cfgDraft.planner.workDays = wd.sort((a,b) => a-b);
}

function renderCfgDailyPreview() {
  const p = _cfgDraft.planner || {};
  const dh = p.dailyWorkHours || ((p.workEnd||17) - (p.workStart||9));
  const prev = document.getElementById('cfg-daily-preview');
  if (prev) prev.textContent = `→ ${dh}h/jornada`;
}

function renderCfgAssigneeOverrides() {
  const list = document.getElementById('cfg-assignee-overrides');
  if (!list) return;
  const ov = _cfgDraft.planner?.assigneeOverrides || {};
  const entries = Object.entries(ov);
  if (!entries.length) {
    list.innerHTML = `<div style="font-size:10px;color:var(--t3);padding:4px 0" data-i18n="config.planner_no_overrides">Sin sobrescrituras por asignado.</div>`;
    return;
  }
  list.innerHTML = entries.map(([name, cal]) => `
    <div class="cfg-row" style="flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px">
      <input type="text" class="cfg-name" value="${esc(name)}" placeholder="Asignado..."
             style="min-width:80px;max-width:110px;flex:1"
             onblur="renameCfgAssignee('${esc(name)}',this.value)">
      <input type="number" min="0" max="23" step="1" value="${cal.workStart??9}"
             style="width:44px" title="Entrada"
             oninput="updateCfgAssignee('${esc(name)}','workStart',parseInt(this.value)||0)">
      <span style="font-size:10px;color:var(--t3)">→</span>
      <input type="number" min="1" max="24" step="1" value="${cal.workEnd??17}"
             style="width:44px" title="Salida"
             oninput="updateCfgAssignee('${esc(name)}','workEnd',parseInt(this.value)||17)">
      <input type="number" min="0.5" max="24" step="0.5" value="${cal.dailyWorkHours??8}"
             style="width:44px" title="Horas/día"
             oninput="updateCfgAssignee('${esc(name)}','dailyWorkHours',parseFloat(this.value)||8)">
      <span style="font-size:9px;color:var(--t3)">h/d</span>
      <button class="cfg-del" onclick="deleteCfgAssignee('${esc(name)}')">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding-left:4px">
      <span style="font-size:10px;color:var(--t3)" data-i18n="config.planner_assignee_holidays">Festivos personales:</span>
      ${(cal.holidays||[]).sort().map(d =>
        `<span style="font-size:10px;font-family:var(--mono);background:var(--s2);border:1px solid var(--b2);border-radius:3px;padding:1px 5px;color:var(--t2)">
          ${d} <button style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:10px;padding:0 0 0 3px" onclick="removeCfgAssigneeHoliday('${esc(name)}','${d}')">✕</button>
         </span>`
      ).join('')}
      <input type="date" id="cfg-ah-${esc(name)}"
             style="background:var(--s2);border:1px solid var(--b2);border-radius:5px;color:var(--t1);padding:2px 6px;font-size:11px;font-family:var(--mono)">
      <button class="cfg-add-btn" style="padding:2px 8px;font-size:10px" onclick="addCfgAssigneeHoliday('${esc(name)}')">+</button>
    </div>`).join('');
}

function addCfgAssigneeOverride() {
  if (!_cfgDraft.planner) _cfgDraft.planner = {};
  if (!_cfgDraft.planner.assigneeOverrides) _cfgDraft.planner.assigneeOverrides = {};
  const p = _cfgDraft.planner;
  const name = `Asignado ${Object.keys(p.assigneeOverrides).length + 1}`;
  p.assigneeOverrides[name] = {
    workDays: [...(p.workDays || [1,2,3,4,5])],
    workStart: p.workStart ?? 9,
    workEnd: p.workEnd ?? 17,
    dailyWorkHours: p.dailyWorkHours ?? 8,
  };
  renderCfgAssigneeOverrides();
}

function renameCfgAssignee(oldName, newName) {
  const ov = _cfgDraft.planner?.assigneeOverrides;
  if (!ov || !ov[oldName] || !newName || newName === oldName) return;
  ov[newName] = ov[oldName];
  delete ov[oldName];
  renderCfgAssigneeOverrides();
}

function updateCfgAssignee(name, key, value) {
  const ov = _cfgDraft.planner?.assigneeOverrides;
  if (ov?.[name]) ov[name][key] = value;
}

function addCfgAssigneeHoliday(name) {
  const inp = document.getElementById(`cfg-ah-${name}`);
  if (!inp?.value) return;
  const ov = _cfgDraft.planner?.assigneeOverrides;
  if (!ov?.[name]) return;
  if (!Array.isArray(ov[name].holidays)) ov[name].holidays = [];
  if (!ov[name].holidays.includes(inp.value)) {
    ov[name].holidays.push(inp.value);
    ov[name].holidays.sort();
  }
  renderCfgAssigneeOverrides();
}

function removeCfgAssigneeHoliday(name, dateStr) {
  const ov = _cfgDraft.planner?.assigneeOverrides;
  if (!ov?.[name]?.holidays) return;
  ov[name].holidays = ov[name].holidays.filter(d => d !== dateStr);
  renderCfgAssigneeOverrides();
}

function deleteCfgAssignee(name) {
  const ov = _cfgDraft.planner?.assigneeOverrides;
  if (ov) { delete ov[name]; renderCfgAssigneeOverrides(); }
}
