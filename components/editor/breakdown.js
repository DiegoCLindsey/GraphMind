// ══════════════════════════════════════════════════════
//  BREAKDOWN — "Desglosar tarea"
//  Opens a batch-input panel to create multiple child
//  tasks connected to the active node AND all its
//  ancestors in the hierarchy.
// ══════════════════════════════════════════════════════

// Returns ancestors from closest-parent to root
function getAncestors(nodeId) {
  const visited = new Set();
  function walk(id) {
    if (visited.has(id)) return [];
    visited.add(id);
    const parents = S.nodes.filter(p => {
      if (p.id === id) return false;
      return getDirectChildren(p.id).some(c => c.id === id);
    });
    let chain = [...parents];
    parents.forEach(p => { chain = chain.concat(walk(p.id)); });
    return chain;
  }
  const seen = new Set();
  return walk(nodeId).filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
}

function openBreakdown() {
  const n = getCurrent();
  if (!n) return;

  // Build ancestor chain: root → … → active
  const ancestors = getAncestors(n.id).reverse(); // root first
  const chain = [...ancestors, n];

  // Breadcrumb
  const breadcrumb = document.getElementById('bd-breadcrumb');
  breadcrumb.innerHTML = chain.map((nd, i) =>
    `<span class="bd-crumb${i === chain.length - 1 ? ' bd-crumb-active' : ''}">${esc(nd.title || t('common.untitled'))}</span>`
  ).join('<span class="bd-sep">›</span>');

  // Reset input list
  _bdRows = [];
  const list = document.getElementById('bd-list');
  list.innerHTML = '';
  addBreakdownRow();

  openModal('breakdown-modal');
  // Focus first input
  setTimeout(() => list.querySelector('input')?.focus(), 60);
}

let _bdRows = [];

function addBreakdownRow(value = '') {
  const id = 'bd-inp-' + Date.now() + Math.random().toString(36).slice(2);
  _bdRows.push(id);
  const list = document.getElementById('bd-list');
  const row = document.createElement('div');
  row.className = 'bd-row';
  row.id = 'bd-row-' + id;
  row.innerHTML = `
    <span class="bd-row-num">${_bdRows.length}</span>
    <input id="${id}" class="bd-inp" type="text" value="${esc(value)}"
      placeholder="${t('editor.breakdown_ph')}"
      onkeydown="bdKeyDown(event, '${id}')"
      oninput="bdUpdateButton()">
    <button class="bd-del" onclick="removeBdRow('${id}')" title="Eliminar">✕</button>`;
  list.appendChild(row);
  bdUpdateButton();
  return id;
}

function removeBdRow(id) {
  _bdRows = _bdRows.filter(r => r !== id);
  document.getElementById('bd-row-' + id)?.remove();
  // Re-number
  document.querySelectorAll('.bd-row-num').forEach((el, i) => el.textContent = i + 1);
  bdUpdateButton();
}

function bdKeyDown(e, id) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const idx = _bdRows.indexOf(id);
    if (idx === _bdRows.length - 1) {
      // Last row → add new one and focus it
      const newId = addBreakdownRow();
      setTimeout(() => document.getElementById(newId)?.focus(), 30);
    } else {
      // Move to next
      document.getElementById(_bdRows[idx + 1])?.focus();
    }
  } else if (e.key === 'Escape') {
    closeModal('breakdown-modal');
  }
}

function bdUpdateButton() {
  const btn = document.getElementById('bd-create-btn');
  if (!btn) return;
  const titles = _bdRows.map(id => document.getElementById(id)?.value.trim()).filter(Boolean);
  const n = titles.length;
  btn.textContent = t('editor.breakdown_create').replace('{n}', n || 0);
  btn.disabled = n === 0;
}

function createBreakdownTasks() {
  const active = getCurrent();
  if (!active) return;

  const titles = _bdRows
    .map(id => document.getElementById(id)?.value.trim())
    .filter(Boolean);

  if (!titles.length) {
    showIndicator(t('editor.breakdown_empty'));
    return;
  }

  // Collect parents: active task + all ancestors
  const ancestors = getAncestors(active.id);
  const allParents = [active, ...ancestors]; // active is closest parent

  titles.forEach(title => {
    const node = {
      id: gid(), title, body: '', tags: [], type: 'task', status: 'todo',
      assignee: '', start: '', end: '', deadline: '', days: '', cost: '',
      completion: 0, priority: '',
      connections: [], connTypes: {}, comments: [],
      created: new Date().toISOString(), updated: new Date().toISOString(),
    };

    // Connect to every parent in the chain
    allParents.forEach(parent => {
      if (!node.connections.includes(parent.id)) {
        node.connections.push(parent.id);
        node.connTypes[parent.id] = 'parent'; // parent is above new task
      }
      if (!parent.connections.includes(node.id)) {
        parent.connections.push(node.id);
        parent.connTypes[node.id] = 'child';  // new task is child of parent
      }
    });

    S.nodes.push(node);
  });

  recalcAll();
  renderList();
  renderEditor();
  updateCount();
  autoSaveLS();
  closeModal('breakdown-modal');
  showIndicator(`✓ ${titles.length} ${t('editor.breakdown_btn').replace('⊕ ', '')}`);
}
