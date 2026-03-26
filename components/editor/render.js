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

  // Lock derived fields for parent nodes
  const isParent = getDirectChildren(n.id).length > 0;
  const lockIds = ['f-start','f-end','f-hours','f-cost','f-completion'];
  lockIds.forEach(id => {
    const el = document.getElementById(id);
    const lbl = el.closest('.mfield')?.querySelector('label');
    if (isParent) {
      el.classList.add('locked');
      if (lbl) lbl.classList.add('locked-lbl');
    } else {
      el.classList.remove('locked');
      if (lbl) lbl.classList.remove('locked-lbl');
    }
  });

  // Status select color
  const ss = document.getElementById('status-select');
  ss.value = n.status;
  const sc = statusColor(n.status);
  ss.style.background = sc + '22'; ss.style.borderColor = sc + '55'; ss.style.color = sc;

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

function renderList() {
  const q = document.getElementById('search').value.toLowerCase();
  const filtered = S.nodes.filter(n => {
    if (activeFilter !== 'all' && n.status !== activeFilter) return false;
    if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q) && !n.tags.some(t=>t.includes(q))) return false;
    return true;
  });
  const list = document.getElementById('node-list');
  list.innerHTML = filtered.length ? filtered.map(n => nodeItemHTML(n)).join('') :
    `<div style="padding:14px;color:var(--t3);font-size:11px;text-align:center">${t('sidebar.no_results')}</div>`;
}

function nodeItemHTML(n) {
  const on = n.id === S.currentId;
  const sc = statusColor(n.status);
  const title = esc(n.title || t('common.untitled'));
  const pct = n.completion || 0;
  const agg = aggregateMetrics(n.id);
  const dispPct = agg ? agg.avgCompletion : pct;
  const tagHTML = n.tags.slice(0,2).map(t => `<span style="font-size:9px;padding:1px 5px;border-radius:10px;background:${gTC(t)}22;color:${gTC(t)}">#${esc(t)}</span>`).join('');
  const tCfg     = typeConfig(n.type);
  const typeLabel = tCfg.name;
  const typeColor = tCfg.color;
  const prioHTML = n.priority ? `<span style="color:${PRIORITY_COLOR[n.priority]||'var(--t3)'};font-size:11px;font-weight:700">${PRIORITY_ICON[n.priority]||''}</span>` : '';
  const dlColor = n.deadline && new Date(n.deadline) < new Date() && n.status !== 'done' ? 'var(--danger)' : 'var(--t3)';
  const dlHTML = n.deadline ? `<span style="font-size:9px;font-family:var(--mono);color:${dlColor}">📅${new Date(n.deadline+'T12:00').toLocaleDateString('es',{day:'numeric',month:'short'})}</span>` : '';
  return `<div class="ni ${on?'on':''}" id="ni-${n.id}" onclick="select('${n.id}')">
    <div class="ni-title">
      <div class="status-dot" style="background:${sc}"></div>
      ${title}
      <span style="margin-left:auto;display:flex;gap:4px;align-items:center">${prioHTML}<span class="ni-type" style="color:${typeColor};border:1px solid ${typeColor}33">${typeLabel}</span></span>
    </div>
    <div class="ni-meta">${tagHTML}${dlHTML}${n.assignee?`<span style="font-size:9px;color:var(--t3)">${esc(n.assignee)}</span>`:''}${agg?`<span style="font-size:9px;color:var(--accent2)">⬡${agg.count}</span>`:''}</div>
    <div class="ni-progress"><div class="ni-progress-fill" style="width:${dispPct}%;background:${progressColor(dispPct)}"></div></div>
  </div>`;
}

function renderNodeItem(id) {
  const el = document.getElementById('ni-'+id);
  const n = S.nodes.find(x => x.id === id);
  if (el && n) el.outerHTML = nodeItemHTML(n);
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
  if (v==='gantt')  setTimeout(renderGantt, 30);
  if (v==='config') renderCfgPanel();
  if (v==='help')   renderHelp();
  if (typeof checkOrientation === 'function') checkOrientation();
}

