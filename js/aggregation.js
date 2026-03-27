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
  const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    minStart: minStart ? fmtLocal(minStart) : null,
    maxEnd:   maxEnd   ? fmtLocal(maxEnd)   : null
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

  const fmtD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // End date of a node as a comparable string (YYYY-MM-DD), computed from stored fields
  const nodeEnd = (n) => {
    if (n.end) return n.end;
    if (n.start) {
      const days = parseFloat(n.days || n.hours) || 1;
      const d = new Date(n.start + 'T00:00:00');
      d.setDate(d.getDate() + Math.round(days) - 1);
      return fmtD(d);
    }
    return '';
  };

  // ── Phase 1: CPM over blocks graph (leaf/peer nodes) ──────────────────
  // blocks edges: A blocks B → edge A→B
  const blockEdges = [];
  S.nodes.forEach(n => {
    n.connections.forEach(cid => {
      if (n.connTypes[cid] === 'blocks') blockEdges.push({ from: n.id, to: cid });
    });
  });

  // Only run CPM if there are blocks relationships
  const cpLeaves = new Set(); // leaf nodes on the critical path

  if (blockEdges.length > 0) {
    // Topological sort (Kahn) over blocks graph
    const inDeg = {}; S.nodes.forEach(n => { inDeg[n.id] = 0; });
    blockEdges.forEach(e => { inDeg[e.to] = (inDeg[e.to] || 0) + 1; });
    const queue = S.nodes.filter(n => !inDeg[n.id]).map(n => n.id);
    const order = [];
    while (queue.length) {
      const id = queue.shift(); order.push(id);
      blockEdges.filter(e => e.from === id).forEach(e => { if (!--inDeg[e.to]) queue.push(e.to); });
    }
    S.nodes.forEach(n => { if (!order.includes(n.id)) order.push(n.id); });

    // Forward pass: cpEnd[id] = latest end date reachable through the blocks chain ending at id
    // prev[id] = which predecessor was the bottleneck
    const cpEnd = {}, prev = {};
    S.nodes.forEach(n => { cpEnd[n.id] = nodeEnd(n); prev[n.id] = null; });

    order.forEach(id => {
      blockEdges.filter(e => e.from === id).forEach(e => {
        // If following the chain from id makes e.to end later, update
        // (e.to's end is already computed based on its start which comes from max blocker end)
        // We track which blocker is the one actually driving the start of e.to
        const toNode = S.nodes.find(x => x.id === e.to);
        if (!toNode) return;
        const toEnd = nodeEnd(toNode);
        // The bottleneck for e.to is the blocker whose cpEnd is the max
        // (its end +1day = toNode.start, so the one with the latest cpEnd drives the chain)
        if (!prev[e.to] || cpEnd[id] > cpEnd[prev[e.to]]) {
          prev[e.to] = id;
        }
        // propagate: cpEnd of e.to is driven by the chain
        if (cpEnd[id] > cpEnd[e.to] || !cpEnd[e.to]) cpEnd[e.to] = toEnd;
      });
    });

    // Sinks = nodes in the blocks graph that don't block anything else
    const blocksAnything = new Set(blockEdges.map(e => e.from));
    const sinksInGraph   = S.nodes.filter(n =>
      // participates in blocks graph (either blocks or is blocked)
      (n.connections.some(cid => n.connTypes[cid] === 'blocks') ||
       n.connections.some(cid => n.connTypes[cid] === 'blocked-by')) &&
      !blocksAnything.has(n.id)
    );

    if (sinksInGraph.length > 0) {
      // Find the sink with the latest cpEnd
      const sink = sinksInGraph.reduce((best, n) =>
        (cpEnd[n.id] || '') > (cpEnd[best.id] || '') ? n : best
      );
      // Trace back from sink
      let cur = sink.id;
      while (cur) { cpLeaves.add(cur); cur = prev[cur]; }
    }
  }

  // ── Phase 2: If no blocks graph, fall back to subtreeEnd hierarchy ─────
  if (cpLeaves.size === 0) {
    const endTs = (n) => {
      const e = nodeEnd(n);
      return e ? new Date(e + 'T00:00:00').getTime() : 0;
    };
    const seCache = {};
    function subtreeEnd(id) {
      if (seCache[id] !== undefined) return seCache[id];
      seCache[id] = -1;
      const n = S.nodes.find(x => x.id === id);
      if (!n) return 0;
      let best = endTs(n);
      getDirectChildren(id).forEach(c => { best = Math.max(best, subtreeEnd(c.id)); });
      seCache[id] = best;
      return best;
    }
    S.nodes.forEach(n => subtreeEnd(n.id));
    const childSet = new Set();
    S.nodes.forEach(n => getDirectChildren(n.id).forEach(c => childSet.add(c.id)));
    const roots = S.nodes.filter(n => !childSet.has(n.id));
    function trace(id) {
      cpLeaves.add(id);
      const kids = getDirectChildren(id);
      if (!kids.length) return;
      const best = kids.reduce((b, c) => subtreeEnd(c.id) > subtreeEnd(b.id) ? c : b);
      trace(best.id);
    }
    roots.forEach(root => {
      if (getDirectChildren(root.id).length === 0) return;
      trace(root.id);
    });
  }

  // ── Phase 3: Propagate CP upward through hierarchy ────────────────────
  const path = new Set(cpLeaves);
  cpLeaves.forEach(leafId => {
    // Walk up: mark all ancestors
    function markAncestors(id) {
      S.nodes.forEach(n => {
        if (n.connections.includes(id) && n.connTypes[id] === 'child') {
          // n is parent of id
          if (!path.has(n.id)) { path.add(n.id); markAncestors(n.id); }
        }
      });
    }
    markAncestors(leafId);
  });

  _cpCache = path;
  return path;
}

// Global blocked-dates pass: topological order over blocks graph → compute start/end for each blocked node
function recalcAllBlockedDates() {
  // Build blocks edges: A blocks B → {from:A, to:B}
  const blockEdges = [];
  S.nodes.forEach(n => {
    n.connections.forEach(cid => {
      if (n.connTypes[cid] === 'blocks') blockEdges.push({ from: n.id, to: cid });
    });
  });
  if (!blockEdges.length) return;

  // Topological sort (Kahn)
  const inDeg = {};
  S.nodes.forEach(n => { inDeg[n.id] = 0; });
  blockEdges.forEach(e => { inDeg[e.to] = (inDeg[e.to] || 0) + 1; });
  const queue = S.nodes.filter(n => !inDeg[n.id]).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    blockEdges.filter(e => e.from === id).forEach(e => { if (!--inDeg[e.to]) queue.push(e.to); });
  }
  // Append any not reached (isolated from blocks graph)
  S.nodes.forEach(n => { if (!order.includes(n.id)) order.push(n.id); });

  // Process in topological order: recompute dates for nodes that have blockers
  order.forEach(id => {
    const n = S.nodes.find(x => x.id === id);
    if (!n || getDirectChildren(n.id).length > 0) return; // skip parents (handled by recalcMetrics)
    const hasBlockers = n.connections.some(cid => n.connTypes[cid] === 'blocked-by');
    if (hasBlockers && typeof computeNodeDates === 'function') {
      computeNodeDates(n);
      n.updated = new Date().toISOString();
    } else if (n.start && n.days) {
      // No blockers: ensure end = start + days  
      if (typeof calcEndFromDuration === 'function') calcEndFromDuration(n);
    }
  });
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
  recalcAllBlockedDates(); // propagate blocks chain first (leaf dates)
  recalcMetrics();         // then aggregate up the hierarchy
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

