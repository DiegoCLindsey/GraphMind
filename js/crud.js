// ══════════════════════════════════════════════════════
//  CRUD
// ══════════════════════════════════════════════════════
function newNode() {
  const node = {
    id: gid(), title:'', body:'', tags:[], type:'task', status:'todo',
    assignee:'', start:'', end:'', deadline:'', days:'', cost:'', completion:0, priority:'',
    connections:[], connTypes:{}, comments:[], archived: false,
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
  const isParent   = getDirectChildren(n.id).length > 0;
  const hasBlockers = n.connections.some(cid => n.connTypes[cid] === 'blocked-by');
  if (!isParent) {
    if (!hasBlockers) n.start = document.getElementById('f-start').value;
    n.days = document.getElementById('f-hours').value;
    n.cost = document.getElementById('f-cost').value;
    n.completion = parseInt(document.getElementById('f-completion').value) || 0;
    // end is always calculated from start + days
    calcEndFromDuration(n);
    document.getElementById('f-end').value = n.end || '';
  }
  n.updated = new Date().toISOString();
  renderNodeItem(n.id);
  updateSB(n);
  // Propagate dates (and hours/cost/completion) up to ancestors immediately
  if (typeof invalidateCPCache === 'function') invalidateCPCache();
  if (typeof recalcMetrics === 'function') recalcMetrics();
  autoSaveLS();
}

// Compute start (from blockers) and end (start + days) for a leaf node
function computeNodeDates(n) {
  if (!n || getDirectChildren(n.id).length > 0) return;
  const blockerIds = n.connections.filter(cid => n.connTypes[cid] === 'blocked-by');
  if (blockerIds.length > 0) {
    const maxEnd = blockerIds.reduce((best, cid) => {
      const b = S.nodes.find(x => x.id === cid);
      if (!b?.end) return best;
      return (!best || b.end > best) ? b.end : best;
    }, '');
    if (maxEnd) {
      // B starts the day AFTER A's last day (end date is inclusive)
      const d = new Date(maxEnd + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      n.start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
  }
  if (!n.days) n.days = '1';
  calcEndFromDuration(n);
}

// Cascade date changes down the blocks chain (pure data, no rendering)
function propagateBlockedDatesData(id) {
  S.nodes.forEach(n => {
    if (!n.connections.includes(id)) return;
    if (n.connTypes[id] !== 'blocked-by') return;
    computeNodeDates(n);
    n.updated = new Date().toISOString();
    propagateBlockedDatesData(n.id);
  });
}

function onDurationChange() {
  const n = getCurrent();
  if (!n || getDirectChildren(n.id).length > 0) return;
  n.days = document.getElementById('f-hours').value;
  calcEndFromDuration(n);
  document.getElementById('f-end').value = n.end || '';
  propagateBlockedDatesData(n.id);
  saveNode();
}

function onStartDateChange() {
  const n = getCurrent();
  if (!n || getDirectChildren(n.id).length > 0) return;
  const hasBlockers = n.connections.some(cid => n.connTypes[cid] === 'blocked-by');
  if (hasBlockers) return; // field is readonly, shouldn't fire
  n.start = document.getElementById('f-start').value;
  calcEndFromDuration(n);
  document.getElementById('f-end').value = n.end || '';
  propagateBlockedDatesData(n.id);
  saveNode();
}

function onEndDateChange() { /* end is always calculated — no-op */ }

function calcEndFromDuration(n) {
  // If start + days → compute end (use local date components to avoid UTC offset bug)
  const days = parseFloat(n.days);
  if (n.start && days > 0) {
    const d = new Date(n.start + 'T00:00:00');
    d.setDate(d.getDate() + Math.round(days) - 1);
    n.end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return true;
  }
  return false;
}

// ── Archive ───────────────────────────────────────────────────────────────────
function archiveCurrentNode() {
  const n = getCurrent();
  if (!n) return;
  n.archived = !n.archived;
  n.updated = new Date().toISOString();
  autoSaveLS();
  renderEditor();
  renderList();
  showIndicator(n.archived ? t('common.archived') : t('common.unarchived'));
}

function toggleShowArchived() {
  _showArchived = !_showArchived;
  const btn = document.getElementById('sb-archived-btn');
  if (btn) btn.classList.toggle('on', _showArchived);
  renderList();
  if (typeof renderGantt === 'function') renderGantt();
  if (typeof renderGraph === 'function') renderGraph();
}

// ── Duplicate ─────────────────────────────────────────────────────────────────
function duplicateNodes(ids) {
  const idSet = new Set(ids);
  const idMap  = {};
  ids.forEach(id => { idMap[id] = gid(); });

  const newNodes = [];
  ids.forEach(oldId => {
    const orig = S.nodes.find(n => n.id === oldId);
    if (!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id    = idMap[oldId];
    copy.title = (copy.title || '') + ' (cp)';
    // Keep ONLY internal connections (within the duplicated set), remapped to new IDs
    copy.connections = orig.connections.filter(cid => idMap[cid]).map(cid => idMap[cid]);
    copy.connTypes   = {};
    orig.connections.forEach(cid => {
      if (idMap[cid]) copy.connTypes[idMap[cid]] = orig.connTypes[cid];
    });
    copy.created = new Date().toISOString();
    copy.updated = new Date().toISOString();
    newNodes.push(copy);
    // Offset graph position slightly so duplicates don't overlap originals
    if (typeof _graphPositions !== 'undefined' && _graphPositions[oldId]) {
      _graphPositions[copy.id] = { x: _graphPositions[oldId].x + 50, y: _graphPositions[oldId].y + 50 };
    }
  });

  newNodes.forEach(n => S.nodes.push(n));
  if (newNodes.length) select(newNodes[0].id);
  if (typeof recalcAll === 'function') recalcAll();
  renderList(); updateCount(); autoSaveLS();
  showIndicator(t('common.duplicated'));
}

function duplicateCurrentNode() {
  if (!S.currentId) return;
  duplicateNodes([S.currentId]);
}

let _deleteTargetId = null;

function deleteNode() {
  if (!S.currentId) return;
  _deleteTargetId = S.currentId;
  openDeleteConfirm(_deleteTargetId);
}

function openDeleteConfirm(id) {
  const n = S.nodes.find(x => x.id === id);
  const title = n?.title || t('common.untitled');
  const children = getDirectChildren(id);
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl   = document.getElementById('confirm-modal-msg');
  const cascBtn = document.getElementById('confirm-modal-btn-cascade');
  if (titleEl) titleEl.textContent = t('common.confirm_delete_title');
  if (msgEl)   msgEl.textContent   = t('common.confirm_delete').replace('{title}', title);
  if (cascBtn) cascBtn.style.display = children.length ? '' : 'none';
  openModal('confirm-modal');
}

function confirmDeleteNode(cascade) {
  const id = _deleteTargetId;
  if (!id) return;
  closeModal('confirm-modal');
  if (cascade) {
    const toDelete = new Set();
    function collectDescendants(nid) {
      if (toDelete.has(nid)) return;
      toDelete.add(nid);
      getDirectChildren(nid).forEach(c => collectDescendants(c.id));
    }
    collectDescendants(id);
    toDelete.forEach(did => {
      S.nodes = S.nodes.filter(n => n.id !== did);
      S.nodes.forEach(n => { n.connections = n.connections.filter(c => c !== did); delete n.connTypes[did]; });
      if (typeof _graphPositions !== 'undefined') delete _graphPositions[did];
    });
  } else {
    S.nodes = S.nodes.filter(n => n.id !== id);
    S.nodes.forEach(n => { n.connections = n.connections.filter(c => c !== id); delete n.connTypes[id]; });
    if (typeof _graphPositions !== 'undefined') delete _graphPositions[id];
  }
  _deleteTargetId = null;
  if (!S.nodes.find(n => n.id === S.currentId)) S.currentId = S.nodes.length ? S.nodes[0].id : null;
  if (typeof recalcAll === 'function') recalcAll();
  renderList(); renderEditor(); updateCount(); autoSaveLS();
}

