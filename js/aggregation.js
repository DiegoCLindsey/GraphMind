// ══════════════════════════════════════════════════════
//  AGGREGATION
// ══════════════════════════════════════════════════════
function getDirectChildren(nodeId) {
  const n = S.nodes.find(x => x.id === nodeId);
  if (!n) return [];
  const children = [];
  // n says these are children (type=child from n's perspective)
  n.connections.forEach(cid => {
    if (n.connTypes[cid] === 'child') {
      const c = S.nodes.find(x => x.id === cid);
      if (c) children.push(c);
    }
  });
  // other nodes that say n is their parent (type=parent from their perspective means n is parent)
  S.nodes.forEach(c => {
    if (c.id !== nodeId && c.connections.includes(nodeId) && c.connTypes[nodeId] === 'parent' && !children.find(x => x.id === c.id)) {
      children.push(c);
    }
  });
  return children;
}

function aggregateMetrics(nodeId) {
  const visited = new Set();
  function gather(id) {
    if (visited.has(id)) return [];
    visited.add(id);
    const children = getDirectChildren(id);
    let all = [...children];
    children.forEach(c => { all = all.concat(gather(c.id)); });
    return all;
  }
  const descendants = gather(nodeId);
  if (!descendants.length) return null;
  // Only leaf nodes (no children) contribute hours/cost to avoid double-counting
  const leaves = descendants.filter(d => getDirectChildren(d.id).length === 0);
  const countAll = descendants.length;
  const totalHours = leaves.reduce((s, c) => s + (parseFloat(c.days || c.hours) || 0), 0);
  const totalCost = leaves.reduce((s, c) => s + (parseFloat(c.cost) || 0), 0);
  // Direct children for weighted completion
  const directKids = getDirectChildren(nodeId);
  const avgCompletion = directKids.length
    ? directKids.reduce((s, c) => s + (aggregateCompletion(c.id, new Set([nodeId]))), 0) / directKids.length
    : 0;
  // Date range across all descendants with dates
  let minStart = null, maxEnd = null;
  descendants.forEach(d => {
    if (d.start) { const dt = new Date(d.start+'T00:00:00'); if (!minStart || dt < minStart) minStart = dt; }
    if (d.end)   { const dt = new Date(d.end+'T00:00:00');   if (!maxEnd   || dt > maxEnd)   maxEnd   = dt; }
  });
  const done = descendants.filter(c => c.status === 'done').length;
  const overdue = descendants.filter(c => c.deadline && new Date(c.deadline) < new Date() && c.status !== 'done').length;
  return {
    count: countAll, totalHours, totalCost,
    avgCompletion: Math.round(avgCompletion), done, overdue,
    minStart: minStart ? minStart.toISOString().slice(0,10) : null,
    maxEnd:   maxEnd   ? maxEnd.toISOString().slice(0,10)   : null
  };
}

function aggregateCompletion(nodeId, _visited) {
  _visited = _visited || new Set();
  if (_visited.has(nodeId)) return 0;   // cycle guard
  _visited.add(nodeId);
  const kids = getDirectChildren(nodeId);
  if (!kids.length) {
    const n = S.nodes.find(x => x.id === nodeId);
    return n ? (parseInt(n.completion) || 0) : 0;
  }
  return kids.reduce((s, c) => s + aggregateCompletion(c.id, _visited), 0) / kids.length;
}

// Critical path: longest path per connected component (one CP per project/tree).
// Returns a Set of node IDs that lie on ANY critical path in the workspace.
let _cpCache = null;
function invalidateCPCache() { _cpCache = null; }
function computeCriticalPath() {
  if (_cpCache) return _cpCache;

  // Duration of a node in days
  const dur = (n) => {
    if (n.start && n.end) {
      const d = Math.ceil((new Date(n.end+'T00:00:00') - new Date(n.start+'T00:00:00')) / 86400000) + 1;
      return Math.max(d, 1);
    }
    return parseFloat(n.days || n.hours) || 1;
  };

  // Directed edges (parent→child hierarchy + blocks→blocked-by)
  const edges = [];
  S.nodes.forEach(n => {
    getDirectChildren(n.id).forEach(c => edges.push({ from: n.id, to: c.id }));
    n.connections.forEach(cid => { if (n.connTypes[cid] === 'blocks') edges.push({ from: n.id, to: cid }); });
  });

  // Build undirected adjacency to find connected components (Union-Find)
  const parent = {}; S.nodes.forEach(n => parent[n.id] = n.id);
  const find = id => { if (parent[id] !== id) parent[id] = find(parent[id]); return parent[id]; };
  const union = (a, b) => { parent[find(a)] = find(b); };
  edges.forEach(e => union(e.from, e.to));

  // Group nodes by component root
  const components = {};
  S.nodes.forEach(n => {
    const root = find(n.id);
    (components[root] = components[root] || []).push(n.id);
  });

  // Topological sort (global, works across all components)
  const inDeg = {}; S.nodes.forEach(n => inDeg[n.id] = 0);
  edges.forEach(e => { inDeg[e.to] = (inDeg[e.to] || 0) + 1; });
  const queue = S.nodes.filter(n => !inDeg[n.id]).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift(); order.push(id);
    edges.filter(e => e.from === id).forEach(e => { if (!--inDeg[e.to]) queue.push(e.to); });
  }
  // Append any nodes not reached (cycles, isolated) so they're always included
  S.nodes.forEach(n => { if (!order.includes(n.id)) order.push(n.id); });

  // Forward pass: longest path distances
  const dist = {}, prev = {};
  S.nodes.forEach(n => { dist[n.id] = 0; prev[n.id] = null; });
  order.forEach(id => {
    const n = S.nodes.find(x => x.id === id);
    const d = dur(n);
    edges.filter(e => e.from === id).forEach(e => {
      const nd = dist[id] + d;
      if (nd > dist[e.to]) { dist[e.to] = nd; prev[e.to] = id; }
    });
  });

  // Per component: trace back from the node with the highest dist (the bottleneck leaf)
  const path = new Set();
  Object.values(components).forEach(ids => {
    if (ids.length < 2) return; // single isolated node — not a meaningful critical path
    const sinkId = ids.reduce((best, id) => dist[id] > dist[best] ? id : best, ids[0]);
    let cur = sinkId;
    while (cur) { path.add(cur); cur = prev[cur]; }
  });

  _cpCache = path;
  return path;
}

// Pure data mutation: recalculates all parent nodes' derived fields bottom-up (no DOM)
function recalcMetrics() {
  const visited = new Set();
  function processNode(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const children = getDirectChildren(id);
    children.forEach(c => processNode(c.id)); // recurse children first
    const n = S.nodes.find(x => x.id === id);
    if (!n || !children.length) return;
    const agg = aggregateMetrics(id);
    if (!agg) return;
    n.days = agg.totalHours.toFixed(1);
    n.cost = agg.totalCost.toFixed(2);
    n.completion = agg.avgCompletion;
    if (agg.minStart) n.start = agg.minStart;
    if (agg.maxEnd)   n.end   = agg.maxEnd;
    n.updated = new Date().toISOString();
  }
  S.nodes.forEach(n => processNode(n.id));
}

// Recalculate all parent nodes' derived fields, then re-render
function recalcAll() {
  recalcMetrics();
  renderList();
  renderEditor();
  autoSaveLS();
  showIndicator(t('common.recalculated'));
}

function renderAgg() {
  const n = getCurrent();
  const agg = document.getElementById('agg-bar');
  if (!n) { agg.style.display = 'none'; return; }
  const metrics = aggregateMetrics(n.id);
  if (!metrics) { agg.style.display = 'none'; return; }
  agg.style.display = 'block';
  document.getElementById('agg-metrics').innerHTML = `
    <div class="agg-m"><div class="av" style="color:var(--accent2)">${metrics.count}</div><div class="al">${t('editor.agg_subtasks')}</div></div>
    <div class="agg-m"><div class="av" style="color:var(--accent)">${metrics.done}</div><div class="al">${t('editor.agg_done')}</div></div>
    <div class="agg-m"><div class="av" style="color:var(--info)">${fmtH(metrics.totalHours.toFixed(1))}</div><div class="al">${t('editor.agg_time')}</div></div>
    <div class="agg-m"><div class="av" style="color:var(--warn)">${fmtCur(metrics.totalCost.toFixed(2))}</div><div class="al">${t('editor.agg_cost')}</div></div>
    ${metrics.overdue ? `<div class="agg-m"><div class="av" style="color:var(--danger)">${metrics.overdue}</div><div class="al">${t('editor.agg_overdue')}</div></div>` : ''}
  `;
  document.getElementById('agg-pct').textContent = metrics.avgCompletion + '%';
  // Critical path indicator
  const cp = computeCriticalPath();
  const n2 = getCurrent();
  if (n2 && cp.has(n2.id)) {
    const cpEl = document.getElementById('agg-cp-badge');
    if (cpEl) cpEl.style.display = 'inline-flex';
  } else {
    const cpEl = document.getElementById('agg-cp-badge');
    if (cpEl) cpEl.style.display = 'none';
  }
  document.getElementById('agg-progress-fill').style.width = metrics.avgCompletion + '%';
  const fillEl = document.getElementById('agg-progress-fill');
  fillEl.style.background = progressColor(metrics.avgCompletion);
}

