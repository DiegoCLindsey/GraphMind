// ══════════════════════════════════════════════════════
//  CRUD
// ══════════════════════════════════════════════════════
function newNode() {
  const node = {
    id: gid(), title:'', body:'', tags:[], type:'task', status:'todo',
    assignee:'', start:'', end:'', deadline:'', days:'', cost:'', completion:0, priority:'',
    connections:[], connTypes:{}, comments:[],
    created: new Date().toISOString(), updated: new Date().toISOString()
  };
  S.nodes.unshift(node);
  select(node.id);
  renderList();
  updateCount();
  setTimeout(() => document.getElementById('node-title').focus(), 50);
}

function select(id) {
  S.currentId = id;
  renderList();
  renderEditor();
  // Follow node in graph view without switching away from current view
  if (currentView === 'graph') focusGraphNode(id);
  // Close sidebar on mobile after selection
  if (window.innerWidth <= 700) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
  }
}

function getCurrent() { return S.nodes.find(n => n.id === S.currentId) || null; }

function saveNode() {
  const n = getCurrent();
  if (!n) return;
  n.title = document.getElementById('node-title').value;
  n.body = document.getElementById('node-body').value;
  n.type = document.getElementById('type-select').value;
  n.status = document.getElementById('status-select').value;
  n.assignee = document.getElementById('f-assignee').value;
  n.deadline = document.getElementById('f-deadline').value;
  n.priority = document.getElementById('f-priority').value;
  const isParent = getDirectChildren(n.id).length > 0;
  if (!isParent) {
    n.start = document.getElementById('f-start').value;
    n.end = document.getElementById('f-end').value;
    n.days = document.getElementById('f-hours').value;
    n.cost = document.getElementById('f-cost').value;
    n.completion = parseInt(document.getElementById('f-completion').value) || 0;
    // Only auto-compute end from start+duration when end is absent (legacy/import fallback)
    if (!n.end) calcEndFromDuration(n);
  }
  n.updated = new Date().toISOString();
  renderNodeItem(n.id);
  updateSB(n);
  // Propagate dates (and hours/cost/completion) up to ancestors immediately
  if (typeof recalcMetrics === 'function') recalcMetrics();
  autoSaveLS();
}

function onDurationChange() {
  // Duration changed → recompute end date from start + days
  const n = getCurrent();
  if (!n || getDirectChildren(n.id).length > 0) return;
  n.days = document.getElementById('f-hours').value;
  n.start = document.getElementById('f-start').value;
  if (calcEndFromDuration(n)) {
    document.getElementById('f-end').value = n.end;
  }
  saveNode();
}

function onStartDateChange() {
  // Start changed → validate end ≥ start, then recompute days
  const n = getCurrent();
  if (!n || getDirectChildren(n.id).length > 0) return;
  const startVal = document.getElementById('f-start').value;
  let endVal   = document.getElementById('f-end').value;
  const daysVal = document.getElementById('f-hours').value;
  if (!startVal) { saveNode(); return; }
  // Clamp end to start if it became earlier
  if (endVal && endVal < startVal) {
    endVal = startVal;
    document.getElementById('f-end').value = endVal;
  }
  if (endVal) {
    // end known → derive days
    const days = Math.ceil((new Date(endVal+'T00:00:00') - new Date(startVal+'T00:00:00')) / 86400000) + 1;
    document.getElementById('f-hours').value = days;
  } else if (parseFloat(daysVal) > 0) {
    // no end but days known → compute end
    const s = new Date(startVal+'T00:00:00');
    s.setDate(s.getDate() + Math.round(parseFloat(daysVal)) - 1);
    document.getElementById('f-end').value = s.toISOString().slice(0,10);
  }
  saveNode();
}

function onEndDateChange() {
  // End changed → must be ≥ start; update days
  const n = getCurrent();
  if (!n || getDirectChildren(n.id).length > 0) return;
  const startVal = document.getElementById('f-start').value;
  let endVal   = document.getElementById('f-end').value;
  if (startVal && endVal && endVal < startVal) {
    endVal = startVal;
    document.getElementById('f-end').value = endVal;
    // Visual flash to indicate clamping
    const el = document.getElementById('f-end');
    el.style.borderColor = 'var(--danger)'; setTimeout(() => el.style.borderColor = '', 900);
  }
  if (startVal && endVal) {
    const days = Math.ceil((new Date(endVal+'T00:00:00') - new Date(startVal+'T00:00:00')) / 86400000) + 1;
    document.getElementById('f-hours').value = days;
  }
  saveNode();
}

function calcEndFromDuration(n) {
  // If start + days → compute end
  const days = parseFloat(n.days);
  if (n.start && days > 0) {
    const start = new Date(n.start + 'T00:00:00');
    start.setDate(start.getDate() + Math.round(days) - 1);
    n.end = start.toISOString().slice(0, 10);
    return true;
  }
  return false;
}

function deleteNode() {
  if (!S.currentId) return;
  const n = getCurrent();
  const title = n?.title || t('common.untitled');
  if (!confirm(t('common.confirm_delete').replace('{title}', title))) return;
  const delId = S.currentId;
  S.nodes = S.nodes.filter(n => n.id !== delId);
  S.nodes.forEach(n => { n.connections = n.connections.filter(c => c !== delId); delete n.connTypes[delId]; });
  S.currentId = S.nodes.length ? S.nodes[0].id : null;
  renderList(); renderEditor(); updateCount(); autoSaveLS();
}

