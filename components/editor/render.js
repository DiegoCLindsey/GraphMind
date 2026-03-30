// ══════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════
let _lastRenderedId = null;
let _bodyMode = 'edit';

function renderEditor() {
  const n = getCurrent();
  const editor = document.getElementById('node-editor');
  const empty = document.getElementById('empty-state');
  if (!n) { editor.style.display='none'; empty.style.display='flex'; _lastRenderedId = null; return; }
  empty.style.display='none'; editor.style.display='flex';

  // Reset body mode when switching to a different task
  if (n.id !== _lastRenderedId) {
    _bodyMode = 'edit';
    document.getElementById('body-edit-btn')?.classList.add('on');
    document.getElementById('body-preview-btn')?.classList.remove('on');
    _lastRenderedId = n.id;
  }

  document.getElementById('node-title').value = n.title;
  document.getElementById('node-body').value = n.body;
  document.getElementById('type-select').value = n.type;
  document.getElementById('f-assignee').value = n.assignee || '';
  document.getElementById('f-start').value = n.start || '';
  document.getElementById('f-end').value = n.end || '';
  document.getElementById('f-deadline').value = n.deadline || '';
  document.getElementById('f-hours').value = n.days || n.hours || '';
  document.getElementById('f-cost').value = n.cost || '';
  document.getElementById('f-completion').value = n.completion || 0;
  document.getElementById('f-priority').value = n.priority || '';

  // Lock derived/calculated fields
  const isParent   = getDirectChildren(n.id).length > 0;
  const hasBlockers = !isParent && n.connections.some(cid => n.connTypes[cid] === 'blocked-by');
  // f-end: always calculated; f-start: calculated when has blockers or is parent; rest locked for parents
  const lockRules = { 'f-end': true, 'f-start': isParent || hasBlockers, 'f-hours': isParent, 'f-cost': isParent, 'f-completion': isParent };
  Object.entries(lockRules).forEach(([id, lock]) => {
    const el = document.getElementById(id);
    const lbl = el?.closest('.mfield')?.querySelector('label');
    if (!el) return;
    el.classList.toggle('locked', lock);
    el.readOnly = lock;
    if (lbl) lbl.classList.toggle('locked-lbl', lock);
  });

  // Status select color
  const ss = document.getElementById('status-select');
  ss.value = n.status;
  const sc = statusColor(n.status);
  ss.style.background = sc + '22'; ss.style.borderColor = sc + '55'; ss.style.color = sc;

  // Archive button label
  const arcBtn = document.getElementById('arc-node-btn');
  if (arcBtn) {
    arcBtn.textContent = n.archived ? t('editor.unarchive_task') : t('editor.archive_task');
    arcBtn.style.color = n.archived ? 'var(--warn)' : 'var(--t3)';
  }

  renderTagBadges();
  renderConnDisplay();
  renderComments();
  renderAgg();
  updateSB(n);
  _refreshBodyPreview();
  applyMobileDefaults();
}

// ── Body edit / preview toggle ──────────────────────────────────
function switchBodyMode(mode) {
  _bodyMode = mode;
  _refreshBodyPreview();
  document.getElementById('body-edit-btn')?.classList.toggle('on', mode === 'edit');
  document.getElementById('body-preview-btn')?.classList.toggle('on', mode === 'preview');
}

function _refreshBodyPreview() {
  const ta     = document.getElementById('node-body');
  const pv     = document.getElementById('body-preview');
  if (!ta || !pv) return;
  if (_bodyMode === 'preview') {
    ta.style.display = 'none';
    pv.style.display = '';
    const n = getCurrent();
    const src = n?.body || '';
    if (src.trim()) {
      pv.innerHTML = renderMd(src);
      runMermaid(pv);
    } else {
      pv.innerHTML = t('editor.body_empty');
    }
  } else {
    ta.style.display = '';
    pv.style.display = 'none';
  }
}

let _sbTreeCollapsed = new Set();
let _sbSelectMode = false;
let _sbSelected   = new Set();

function toggleSbSelectMode() {
  _sbSelectMode = !_sbSelectMode;
  _sbSelected.clear();
  const selbar = document.getElementById('sb-selbar');
  const btn    = document.getElementById('sb-select-btn');
  if (selbar) selbar.classList.toggle('visible', _sbSelectMode);
  if (btn)    btn.classList.toggle('on', _sbSelectMode);
  updateSelBar();
  renderList();
}

function toggleSbSelect(id, e) {
  if (e) e.stopPropagation();
  if (_sbSelected.has(id)) _sbSelected.delete(id);
  else _sbSelected.add(id);
  updateSelBar();
  // Update just the checkbox state without full re-render
  const el = document.getElementById('ni-' + id);
  if (el) {
    el.classList.toggle('sel', _sbSelected.has(id));
    const chk = el.querySelector('.ni-sel-chk');
    if (chk) chk.checked = _sbSelected.has(id);
  }
}

function updateSelBar() {
  const el = document.getElementById('sb-sel-count');
  if (el) el.textContent = `${_sbSelected.size} ${t('sidebar.selected_count')}`;
}

function duplicateSelected() {
  if (!_sbSelected.size) return;
  const ids = [..._sbSelected];
  toggleSbSelectMode();
  duplicateNodes(ids);
}

function deleteSelected() {
  if (!_sbSelected.size) return;
  const ids = [..._sbSelected];
  ids.forEach(id => {
    S.nodes = S.nodes.filter(n => n.id !== id);
    S.nodes.forEach(n => { n.connections = n.connections.filter(c => c !== id); delete n.connTypes[id]; });
    if (typeof _graphPositions !== 'undefined') delete _graphPositions[id];
  });
  if (ids.includes(S.currentId)) S.currentId = S.nodes.length ? S.nodes[0].id : null;
  _sbSelected.clear();
  updateSelBar();
  if (typeof recalcAll === 'function') recalcAll();
  autoSaveLS();
  renderList(); renderEditor(); updateCount();
  toggleSbSelectMode();
}

function toggleSbNode(id) {
  if (_sbTreeCollapsed.has(id)) _sbTreeCollapsed.delete(id);
  else _sbTreeCollapsed.add(id);
  renderList();
}

function renderList() {
  const q = document.getElementById('search').value.toLowerCase();
  const list = document.getElementById('node-list');
  const filtered = S.nodes.filter(n => {
    if (!_showArchived && n.archived) return false;
    if (activeFilter !== 'all' && n.status !== activeFilter) return false;
    if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q) && !n.tags.some(tg => tg.includes(q))) return false;
    return true;
  });
  if (!filtered.length) {
    list.innerHTML = `<div style="padding:14px;color:var(--t3);font-size:11px;text-align:center">${t('sidebar.no_results')}</div>`;
    return;
  }
  // Build hierarchical tree (same pattern as Gantt)
  const ids = new Set(filtered.map(n => n.id));
  const hasParentInSet = new Set();
  filtered.forEach(n => getDirectChildren(n.id).forEach(c => { if (ids.has(c.id)) hasParentInSet.add(c.id); }));
  const roots = filtered.filter(n => !hasParentInSet.has(n.id));
  const rows = [];
  const visited = new Set();
  function walk(node, depth) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const children = getDirectChildren(node.id).filter(c => ids.has(c.id));
    rows.push({ n: node, depth, childCount: children.length });
    if (!_sbTreeCollapsed.has(node.id)) children.forEach(c => walk(c, depth + 1));
  }
  roots.forEach(r => walk(r, 0));
  filtered.forEach(n => { if (!visited.has(n.id)) rows.push({ n, depth: 0, childCount: 0 }); });
  list.innerHTML = rows.map(r => nodeItemHTML(r.n, r.depth, r.childCount)).join('');
}

function nodeItemHTML(n, depth = 0, childCount = 0) {
  const on = n.id === S.currentId;
  const sc = statusColor(n.status);
  const title = esc(n.title || t('common.untitled'));
  const pct = n.completion || 0;
  const agg = aggregateMetrics(n.id);
  const dispPct = agg ? agg.avgCompletion : pct;
  const tagHTML = n.tags.slice(0,2).map(tg => `<span style="font-size:9px;padding:1px 5px;border-radius:10px;background:${gTC(tg)}22;color:${gTC(tg)}">#${esc(tg)}</span>`).join('');
  const tCfg     = typeConfig(n.type);
  const typeLabel = tCfg.name;
  const typeColor = tCfg.color;
  const prioHTML = n.priority ? `<span style="color:${PRIORITY_COLOR[n.priority]||'var(--t3)'};font-size:11px;font-weight:700">${PRIORITY_ICON[n.priority]||''}</span>` : '';
  const dlColor = n.deadline && new Date(n.deadline) < new Date() && n.status !== 'done' ? 'var(--danger)' : 'var(--t3)';
  const dlHTML = n.deadline ? `<span style="font-size:9px;font-family:var(--mono);color:${dlColor}">📅${new Date(n.deadline+'T12:00').toLocaleDateString('es',{day:'numeric',month:'short'})}</span>` : '';
  const collapsed = _sbTreeCollapsed.has(n.id);
  const isSel = _sbSelected.has(n.id);
  const archivedBadge = n.archived ? `<span style="font-size:9px;font-family:var(--mono);padding:1px 5px;border-radius:3px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;margin-left:2px">${t('common.archived_badge')}</span>` : '';
  const chevron = childCount > 0
    ? `<button class="ni-chevron" onclick="event.stopPropagation();toggleSbNode('${n.id}')">${collapsed ? '&#9658;' : '&#9660;'}</button>`
    : '<span class="ni-chevron-gap"></span>';
  const selChk = _sbSelectMode
    ? `<input type="checkbox" class="ni-sel-chk" ${isSel ? 'checked' : ''} onclick="toggleSbSelect('${n.id}',event)">`
    : '';
  const clickAction = _sbSelectMode
    ? `toggleSbSelect('${n.id}',event)`
    : `select('${n.id}')`;
  return `<div class="ni ${on?'on':''} ${isSel?'sel':''}" id="ni-${n.id}" onclick="${clickAction}" style="padding-left:${depth*14+9}px">
    <div class="ni-title">
      ${selChk}${chevron}<div class="status-dot" style="background:${sc}"></div>
      ${title}${archivedBadge}
      <span style="margin-left:auto;display:flex;gap:4px;align-items:center">${prioHTML}<span class="ni-type" style="color:${typeColor};border:1px solid ${typeColor}33">${typeLabel}</span></span>
    </div>
    <div class="ni-meta">${tagHTML}${dlHTML}${n.assignee?`<span style="font-size:9px;color:var(--t3)">${esc(n.assignee)}</span>`:''}${agg?`<span style="font-size:9px;color:var(--accent2)">⬡${agg.count}</span>`:''}</div>
    <div class="ni-progress"><div class="ni-progress-fill" style="width:${dispPct}%;background:${progressColor(dispPct)}"></div></div>
  </div>`;
}

function renderNodeItem(id) {
  renderList(); // rebuild to preserve hierarchy/depth
}

function updateSB(n) {
  document.getElementById('sb-created').textContent = 'Creado ' + new Date(n.created).toLocaleDateString('es',{day:'numeric',month:'short'});
  document.getElementById('sb-updated').textContent = '· Act. ' + new Date(n.updated).toLocaleString('es',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function updateCount() {
  document.getElementById('note-count').textContent = S.nodes.length + ' nodos';
}

function setFilter(el) {
  document.querySelectorAll('.sf').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  activeFilter = el.dataset.f;
  renderList();
}

// ══════════════════════════════════════════════════════
//  VIEWS
// ══════════════════════════════════════════════════════
let currentView = 'editor';
function switchView(v) {
  currentView = v;
  const show = id => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  const views = { 'editor':'editor-view', 'graph':'graph-view', 'gantt':'gantt-view', 'help':'help-view', 'config':'config-view' };
  Object.values(views).forEach(hide);
  if (views[v]) show(views[v]);
  document.getElementById('tab-e').classList.toggle('on',     v==='editor');
  document.getElementById('tab-g').classList.toggle('on',     v==='graph');
  document.getElementById('tab-gantt').classList.toggle('on', v==='gantt');
  document.getElementById('tab-help').classList.toggle('on',  v==='help');
  const tabCfg = document.getElementById('tab-cfg');
  if (tabCfg) tabCfg.classList.toggle('on', v==='config');
  if (v==='graph')  renderGraph();
  if (v==='gantt')  { setSidebarFold(true); if (typeof _ganttScrollOnLoad !== 'undefined') _ganttScrollOnLoad = true; setTimeout(renderGantt, 30); }
  if (v==='editor') setSidebarFold(false);
  if (v==='config') renderCfgPanel();
  if (v==='help')   renderHelp();
  if (typeof checkOrientation === 'function') checkOrientation();
}

