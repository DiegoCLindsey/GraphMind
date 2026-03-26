// ══════════════════════════════════════════════════════
//  CONNECTIONS
// ══════════════════════════════════════════════════════
let pendingConnType = 'related';
function setConnType(el) {
  document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  pendingConnType = el.dataset.ct;
  renderConnPickList();
}

function openConnModal() {
  pendingConnType = 'related';
  document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('.ct-btn[data-ct=related]').classList.add('on');
  renderConnPickList();
  openModal('conn-modal');
}

function renderConnPickList() {
  const n = getCurrent();
  const list = document.getElementById('conn-pick-list');
  const others = S.nodes.filter(x => x.id !== n?.id);
  if (!others.length) { list.innerHTML = '<div class="cpi" style="color:var(--t3)">Sin otros nodos</div>'; return; }
  list.innerHTML = others.map(o => {
    const conn = n?.connections.includes(o.id);
    const ct = conn ? (n.connTypes[o.id] || 'related') : '';
    const sdot = statusColor(o.status);
    return `<div class="cpi ${conn?'sel':''}" onclick="toggleConn('${o.id}')">
      <span class="ck">${conn ? '✓' : '○'}</span>
      <div style="width:6px;height:6px;border-radius:50%;background:${sdot};flex-shrink:0"></div>
      <span style="flex:1">${esc(o.title||'(sin título)')}</span>
      ${conn ? `<span style="font-size:9px;color:var(--t3);font-family:var(--mono)">${ct}</span>` : ''}
    </div>`;
  }).join('');
}

function toggleConn(otherId) {
  const n = getCurrent(); if (!n) return;
  const other = S.nodes.find(x => x.id === otherId); if (!other) return;
  if (n.connections.includes(otherId)) {
    n.connections = n.connections.filter(c => c !== otherId);
    delete n.connTypes[otherId];
    other.connections = other.connections.filter(c => c !== n.id);
    delete other.connTypes[n.id];
  } else {
    n.connections.push(otherId);
    n.connTypes[otherId] = pendingConnType;
    if (!other.connections.includes(n.id)) other.connections.push(n.id);
    // Set reverse type
    const reverseMap = { related:'related', parent:'child', child:'parent', blocks:'blocked-by' };
    other.connTypes[n.id] = reverseMap[pendingConnType] || 'related';
  }
  n.updated = new Date().toISOString();
  renderConnPickList();
  renderConnDisplay();
  renderAgg();
  renderNodeItem(n.id);
}

function renderConnDisplay() {
  const n = getCurrent();
  const c = document.getElementById('conn-display');
  if (!n) { c.innerHTML=''; return; }
  c.innerHTML = n.connections.map(cid => {
    const o = S.nodes.find(x => x.id === cid); if (!o) return '';
    const ct = n.connTypes[cid] || 'related';
    const classes = ct === 'parent' ? 'cp is-parent' : ct === 'child' ? 'cp is-child' : 'cp';
    const icon = ct === 'parent' ? '▲' : ct === 'child' ? '▼' : ct === 'blocks' ? '⊘' : '↔';
    return `<span class="${classes}" onclick="select('${cid}')" title="${ct}">${icon} ${esc(o.title||'(sin título)')}</span>`;
  }).join('');
}

