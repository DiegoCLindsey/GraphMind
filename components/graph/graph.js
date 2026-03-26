// ══════════════════════════════════════════════════════
//  GRAPH
// ══════════════════════════════════════════════════════
let sim, zoomB;

function renderGraph() {
  invalidateCPCache();
  const svgEl = document.getElementById('graph-svg');
  const W = svgEl.clientWidth || 800, H = svgEl.clientHeight || 600;
  svgEl.innerHTML = '';
  const svg = d3.select('#graph-svg');

  zoomB = d3.zoom().scaleExtent([0.1,5]).on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoomB);

  // ── DEFS: filters for blob soft glow ──────────────────────────────────────
  const defs = svg.append('defs');

  // Blur filter for hull fill (soft blob interior)
  const fBlur = defs.append('filter').attr('id','blob-blur').attr('x','-30%').attr('y','-30%').attr('width','160%').attr('height','160%');
  fBlur.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','14');

  // Blur + dilate for blob outline
  const fOutline = defs.append('filter').attr('id','blob-outline').attr('x','-30%').attr('y','-30%').attr('width','160%').attr('height','160%');
  fOutline.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','8').attr('result','blur');
  fOutline.append('feColorMatrix').attr('in','blur').attr('type','matrix')
    .attr('values','1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7').attr('result','sharp');

  // Arrow markers
  ['related','parent','child','blocks'].forEach(t => {
    const col = t==='blocks'?'#f87171':t==='parent'||t==='child'?'#a78bfa':'rgba(255,255,255,0.2)';
    defs.append('marker').attr('id','arr-'+t).attr('viewBox','0 -4 8 8').attr('refX',22).attr('refY',0)
      .attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto')
      .append('path').attr('d','M0,-4L8,0L0,4').attr('fill',col);
  });

  const g = svg.append('g');

  // ── DATA ──────────────────────────────────────────────────────────────────
  const nodes = S.nodes.map(n => ({...n}));
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Build parent→children map for hull grouping
  const projectGroups = new Map(); // projectId → [childIds]
  S.nodes.forEach(n => {
    if (n.type === 'project') {
      const kids = getDirectChildren(n.id).map(c => c.id);
      if (kids.length > 0) projectGroups.set(n.id, kids);
    }
  });

  // Links — skip parent/child links *into* a project blob (they're implicit in the hull)
  // Type priority: blocks > parent/child > related/blocked-by
  // We must resolve the canonical type independently of iteration order,
  // because the first node seen for a pair may have the weaker reverse-type ('blocked-by','related')
  // while the second has the real intent ('blocks','parent','child').
  const TYPE_PRIORITY = { blocks: 4, parent: 3, child: 3, 'blocked-by': 2, related: 1 };
  function canonicalLinkType(nId, otherId) {
    const nNode   = S.nodes.find(x => x.id === nId);
    const otherNode = S.nodes.find(x => x.id === otherId);
    const typeA = nNode?.connTypes[otherId]   || 'related';
    const typeB = otherNode?.connTypes[nId]   || 'related';
    // If one side says 'blocks', that wins — preserve source/target direction
    if (typeA === 'blocks') return { type: 'blocks', source: nId,    target: otherId };
    if (typeB === 'blocks') return { type: 'blocks', source: otherId, target: nId    };
    // parent/child next
    if (typeA === 'parent') return { type: 'parent', source: nId,    target: otherId };
    if (typeB === 'parent') return { type: 'parent', source: otherId, target: nId    };
    if (typeA === 'child')  return { type: 'child',  source: nId,    target: otherId };
    if (typeB === 'child')  return { type: 'child',  source: otherId, target: nId    };
    // fallback
    return { type: typeA !== 'blocked-by' ? typeA : typeB, source: nId, target: otherId };
  }

  const links = [];
  const seen = new Set();
  S.nodes.forEach(n => {
    n.connections.forEach(cid => {
      const key = [n.id, cid].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const { type, source, target } = canonicalLinkType(n.id, cid);
      // Hide parent↔child links when either end is a project — visually redundant with hull
      const srcIsProject = S.nodes.find(x=>x.id===source)?.type === 'project';
      const tgtIsProject = S.nodes.find(x=>x.id===target)?.type === 'project';
      if ((type==='parent'||type==='child') && (srcIsProject || tgtIsProject)) return;
      links.push({ source, target, type });
    });
  });

  const cpSet = computeCriticalPath();

  // ── HULL LAYER (drawn first, behind everything) ───────────────────────────
  const hullLayer = g.append('g').attr('class','hull-layer');

  // Project color palette (distinct per project)
  const PROJECT_PALETTE = [
    { fill:'#a78bfa', stroke:'#c4b5fd' },  // violet
    { fill:'#6ee7b7', stroke:'#a7f3d0' },  // emerald
    { fill:'#60a5fa', stroke:'#93c5fd' },  // blue
    { fill:'#fb923c', stroke:'#fdba74' },  // orange
    { fill:'#f472b6', stroke:'#f9a8d4' },  // pink
    { fill:'#34d399', stroke:'#6ee7b7' },  // teal
    { fill:'#fbbf24', stroke:'#fde68a' },  // amber
  ];
  const projectPaletteMap = new Map();
  let pi = 0;
  projectGroups.forEach((_, pid) => { projectPaletteMap.set(pid, PROJECT_PALETTE[pi++ % PROJECT_PALETTE.length]); });

  // One path per project group
  const hullPaths = new Map();
  projectGroups.forEach((childIds, pid) => {
    const pal = projectPaletteMap.get(pid);
    const grp = hullLayer.append('g');

    // Filled soft blob (blurred circle-union)
    const pathFill = grp.append('path')
      .attr('fill', pal.fill)
      .attr('opacity', 0.07)
      .attr('filter', 'url(#blob-outline)')
      .style('pointer-events','none');

    // Crisp outline
    const pathOutline = grp.append('path')
      .attr('fill', 'none')
      .attr('stroke', pal.stroke)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray','none')
      .attr('opacity', 0.55)
      .style('pointer-events','none');

    // Project label (floats above blob)
    const projNode = S.nodes.find(x => x.id === pid);
    const labelEl = grp.append('text')
      .text((projNode?.title || '').toUpperCase())
      .attr('text-anchor','middle')
      .attr('fill', pal.stroke)
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('font-family','IBM Plex Mono,monospace')
      .attr('opacity', 0.7)
      .attr('letter-spacing', 1.2)
      .style('pointer-events','none');

    // Completion arc (thin ring around blob centroid)
    const arcEl = grp.append('path')
      .attr('fill','none')
      .attr('stroke', pal.stroke)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.6)
      .style('pointer-events','none');

    // Clickable overlay (invisible, on top of fill)
    const clickArea = grp.append('path')
      .attr('fill', pal.fill)
      .attr('opacity', 0)
      .attr('filter', 'url(#blob-outline)')
      .style('cursor','pointer')
      .on('click', () => { select(pid); switchView('editor'); })
      .on('mouseover', (e) => {
        const pn = S.nodes.find(x=>x.id===pid);
        if (pn) showTip(e, {...pn, _fromHull:true});
      })
      .on('mouseout', () => { document.getElementById('graph-tip').style.opacity='0'; });

    hullPaths.set(pid, { pathFill, pathOutline, labelEl, arcEl, clickArea, childIds, pid });
  });

  // Helper: compute blob path from points (pts includes the project node as last point)
  // pts.length = childCount + 1 (project centroid)
  function hullPath(pts, pad) {
    if (pts.length === 0) return '';

    // Project node is always the last point (pushed in updateHulls)
    // childCount = pts.length - 1
    const childCount = pts.length - 1;
    const proj = pts[pts.length - 1]; // [cx, cy] — project centroid

    if (childCount <= 1) {
      // Circle centred on project node, radius = distance to child + pad (min 72)
      const child = pts[0] || proj;
      const dx = child[0] - proj[0], dy = child[1] - proj[1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      const r = Math.max(dist + pad, 72);
      const [x, y] = proj;
      return `M${x},${y-r} A${r},${r},0,1,1,${x-0.01},${y-r} Z`;
    }

    if (childCount === 2) {
      // Ellipse: foci = the two children, project is the centre.
      // rx = half-distance between children + pad (min 85)
      // ry = pad (min 52)
      const [f1, f2] = pts; // the two children
      const mx = (f1[0]+f2[0])/2, my = (f1[1]+f2[1])/2;
      const dx = f2[0]-f1[0], dy = f2[1]-f1[1];
      const dist = Math.sqrt(dx*dx+dy*dy) || 1;
      const angle = Math.atan2(dy, dx);
      const rx = Math.max(dist/2 + pad, 85);
      const ry = Math.max(pad, 52);
      // 4 axis points of the rotated ellipse → Catmull-Rom
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const axPts = [
        [mx + rx*cos,    my + rx*sin   ],
        [mx - ry*sin,    my + ry*cos   ],
        [mx - rx*cos,    my - rx*sin   ],
        [mx + ry*sin,    my - ry*cos   ],
      ];
      return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(axPts);
    }

    // 3+ children: padded convex hull with Catmull-Rom smoothing
    const cx = pts.reduce((s,p)=>s+p[0],0)/pts.length;
    const cy2 = pts.reduce((s,p)=>s+p[1],0)/pts.length;
    const hull = d3.polygonHull(pts);
    if (!hull) return '';
    const padded = hull.map(([x,y]) => {
      const ddx=x-cx, ddy=y-cy2, len=Math.sqrt(ddx*ddx+ddy*ddy)||1;
      return [x + ddx/len*pad, y + ddy/len*pad];
    });
    return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(padded);
  }

  function updateHulls() {
    hullPaths.forEach(({ pathFill, pathOutline, labelEl, arcEl, clickArea, childIds, pid }) => {
      const projNode = nodeById.get(pid);
      const pts = childIds
        .map(cid => nodeById.get(cid))
        .filter(n => n && n.x != null)
        .map(n => [n.x, n.y]);
      // Include project node itself in hull
      if (projNode && projNode.x != null) pts.push([projNode.x, projNode.y]);
      if (pts.length === 0) return;

      const PAD = 38;
      const d = hullPath(pts, PAD);
      pathFill.attr('d', d);
      pathOutline.attr('d', d);
      clickArea.attr('d', d);

      // Centroid for label + arc
      const cx = pts.reduce((s,p)=>s+p[0],0)/pts.length;
      const cy2 = pts.reduce((s,p)=>s+p[1],0)/pts.length;

      // Push label above blob
      const minY = Math.min(...pts.map(p=>p[1]));
      labelEl.attr('x', cx).attr('y', minY - PAD - 6);

      // Completion arc around centroid
      const agg = aggregateMetrics(pid);
      const pct = agg ? agg.avgCompletion : (projNode?.completion || 0);
      if (pct > 0) {
        const R = 14;
        const startAngle = -Math.PI/2;
        const endAngle = startAngle + (pct/100)*2*Math.PI;
        const x1 = cx + R*Math.cos(startAngle), y1 = cy2 + R*Math.sin(startAngle);
        const x2 = cx + R*Math.cos(endAngle),   y2 = cy2 + R*Math.sin(endAngle);
        const large = pct > 50 ? 1 : 0;
        arcEl.attr('d', pct >= 100
          ? `M${cx},${cy2-R} A${R},${R},0,1,1,${cx-0.01},${cy2-R} Z`
          : `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2}`);
        arcEl.attr('opacity', 0.7);
      } else {
        arcEl.attr('d','');
      }
    });
  }

  // ── LINKS ─────────────────────────────────────────────────────────────────
  const link = g.append('g').selectAll('line').data(links).enter().append('line')
    .attr('stroke', d => {
      const onCP = cpSet.has(d.source.id||d.source) && cpSet.has(d.target.id||d.target);
      if (onCP&&(d.type==='parent'||d.type==='child')) return 'rgba(248,113,113,0.6)';
      return d.type==='blocks'?'rgba(248,113,113,0.35)':d.type==='parent'||d.type==='child'?'rgba(167,139,250,0.35)':'rgba(255,255,255,0.07)';
    })
    .attr('stroke-width', d => {
      const onCP = cpSet.has(d.source.id||d.source) && cpSet.has(d.target.id||d.target);
      return (onCP&&(d.type==='parent'||d.type==='child'))?2.5:d.type==='parent'||d.type==='child'?2:1;
    })
    .attr('stroke-dasharray', d => d.type==='related'?'3,3':'none')
    .attr('marker-end', d => `url(#arr-${d.type})`);

  // ── NODES ─────────────────────────────────────────────────────────────────
  const nRadius = d => {
    if (d.type === 'project') return 0; // invisible anchor
    const children = getDirectChildren(d.id);
    return 7 + Math.min(children.length * 3 + d.connections.length * 1.5, 18);
  };

  // Filter out project nodes from the visual node group — they render as blobs
  const visibleNodes = nodes.filter(d => d.type !== 'project' || !projectGroups.has(d.id));
  const hiddenProjectIds = new Set(nodes.filter(d => d.type === 'project' && projectGroups.has(d.id)).map(d=>d.id));

  const nodeG = g.append('g').selectAll('g').data(visibleNodes).enter().append('g')
    .style('cursor','pointer')
    .call(d3.drag()
      .on('start',(e,d)=>{ if(!e.active) sim.alphaTarget(.3).restart(); d.fx=d.x;d.fy=d.y; })
      .on('drag',(e,d)=>{ d.fx=e.x;d.fy=e.y; })
      .on('end',(e,d)=>{ if(!e.active) sim.alphaTarget(0); d.fx=null;d.fy=null; })
    )
    .on('click',(e,d)=>{ select(d.id); switchView('editor'); })
    .on('mouseover',(e,d)=>showTip(e,d))
    .on('mouseout',()=>{ document.getElementById('graph-tip').style.opacity='0'; });

  // milestone outer ring
  nodeG.filter(d=>d.type==='milestone').append('circle')
    .attr('r', d=>nRadius(d)+4)
    .attr('fill','none')
    .attr('stroke','rgba(251,191,36,0.4)')
    .attr('stroke-width',1.5)
    .attr('stroke-dasharray','4,2');

  // progress pie
  nodeG.each(function(d) {
    const pct = d.id===getCurrent()?.id ? (aggregateMetrics(d.id)?.avgCompletion??d.completion) : d.completion;
    if (pct>0) {
      const r=nRadius(d);
      const angle=(pct/100)*2*Math.PI-Math.PI/2;
      const x2=r*Math.cos(angle), y2=r*Math.sin(angle);
      const large=pct>50?1:0;
      d3.select(this).append('path')
        .attr('d',`M0,${-r} A${r},${r},0,${large},1,${x2},${y2} L0,0 Z`)
        .attr('fill',pct>=80?'rgba(110,231,183,0.25)':pct>=40?'rgba(251,191,36,0.2)':'rgba(96,165,250,0.2)');
    }
  });

  // main circle
  nodeG.append('circle')
    .attr('r', nRadius)
        .attr('fill', d=>statusColor(d.status)+'33')
    .attr('stroke', d=>d.id===S.currentId?'#f0f0f0':statusColor(d.status))
    .attr('stroke-width', d=>d.id===S.currentId?2:1);

  // priority dot
  nodeG.filter(d=>d.priority==='critical'||d.priority==='high').append('circle')
    .attr('cx',d=>nRadius(d)-2).attr('cy',d=>-(nRadius(d)-2))
    .attr('r',3).attr('fill',d=>d.priority==='critical'?'#f87171':'#fbbf24');

  // label
  nodeG.filter(d=>nRadius(d)>0).append('text')
    .text(d=>(d.title||'(sin título)').slice(0,20))
    .attr('text-anchor','middle')
    .attr('dy',d=>nRadius(d)+13)
    .attr('fill','rgba(255,255,255,0.5)')
    .attr('font-size',10)
    .attr('font-family','IBM Plex Sans,sans-serif');

  // completion %
  nodeG.filter(d=>d.completion>0||getDirectChildren(d.id).length>0).append('text')
    .text(d=>{ const agg=aggregateMetrics(d.id); return (agg?agg.avgCompletion:d.completion)+'%'; })
    .attr('text-anchor','middle').attr('dy','0.35em')
    .attr('fill','rgba(255,255,255,0.7)').attr('font-size',9)
    .attr('font-family','IBM Plex Mono,monospace');

  // ── SIMULATION ────────────────────────────────────────────────────────────
  // Cluster force: project node snaps to centroid of children each tick,
  // and children are gently attracted toward that centroid.
  function clusterForce(alpha) {
    projectGroups.forEach((childIds, pid) => {
      const proj = nodeById.get(pid);
      if (!proj) return;

      // 1. Compute centroid of children that have positions
      const positioned = childIds.map(cid => nodeById.get(cid)).filter(n => n && n.x != null);
      if (!positioned.length) return;
      const cx = positioned.reduce((s, n) => s + n.x, 0) / positioned.length;
      const cy = positioned.reduce((s, n) => s + n.y, 0) / positioned.length;

      // 2. Move project node directly to centroid (no physics — it's invisible, just an anchor)
      proj.x  = cx;
      proj.y  = cy;
      proj.vx = 0;
      proj.vy = 0;

      // 3. Pull children toward project centroid with a gentle spring
      const pull = 0.12 * alpha;
      positioned.forEach(child => {
        child.vx += (cx - child.x) * pull;
        child.vy += (cy - child.y) * pull;
      });
    });
  }

  sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id).distance(d=>d.type==='parent'||d.type==='child'?70:130).strength(.5))
    .force('charge', d3.forceManyBody().strength(d=>d.type==='project'?0:-180))
    .force('center', d3.forceCenter(W/2,H/2))
    .force('collision', d3.forceCollide(d=>d.type==='project'?0:nRadius(d)+12))
    .force('cluster', clusterForce)
    .on('tick', ()=>{
      link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y)
          .attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
      nodeG.attr('transform',d=>`translate(${d.x},${d.y})`);
      updateHulls();
    });
}

function showTip(e, d) {
  const agg = aggregateMetrics(d.id);
  const overdue = d.deadline && new Date(d.deadline) < new Date() && d.status!=='done';
  const pct = agg ? agg.avgCompletion : (d.completion||0);
  let html = `<div class="gt-title">${esc(d.title||'(sin título)')}</div>`;
  html += `<div class="gt-row"><span class="gk">Estado</span><span class="gv" style="color:${statusColor(d.status)}">${statusLabel(d.status)}</span></div>`;
  if (d.assignee) html += `<div class="gt-row"><span class="gk">Asignado</span><span class="gv">${esc(d.assignee)}</span></div>`;
  if (d.hours) html += `<div class="gt-row"><span class="gk">Est. horas</span><span class="gv">${fmtH(d.days||d.hours)}</span></div>`;
  if (d.cost) html += `<div class="gt-row"><span class="gk">Coste est.</span><span class="gv">${fmtCur(d.cost)}</span></div>`;
  if (d.deadline) html += `<div class="gt-row"><span class="gk">Límite</span><span class="gv" style="color:${overdue?'var(--danger)':'var(--t1)'}">${fmtDate(d.deadline)}</span></div>`;
  if (agg) {
    html += `<div class="gt-row"><span class="gk">Subtareas</span><span class="gv">${agg.done}/${agg.count}</span></div>`;
    html += `<div class="gt-row"><span class="gk">Horas total</span><span class="gv">${fmtH(agg.totalHours.toFixed(1))}</span></div>`;
    html += `<div class="gt-row"><span class="gk">Coste total</span><span class="gv" style="color:var(--warn)">${fmtCur(agg.totalCost.toFixed(2))}</span></div>`;
  }
  html += `<div class="gt-prog"><div style="font-size:9px;color:var(--t3);display:flex;justify-content:space-between"><span>${agg?'Progreso conjunto':'Completitud'}</span><span>${pct}%</span></div><div class="gt-prog-bar"><div class="gt-prog-fill" style="width:${pct}%"></div></div></div>`;
  const tip = document.getElementById('graph-tip');
  tip.innerHTML = html;
  tip.style.left = (e.offsetX+14)+'px'; tip.style.top = (e.offsetY+14)+'px'; tip.style.opacity='1';
}

function gReset() { if(zoomB) d3.select('#graph-svg').transition().duration(400).call(zoomB.transform, d3.zoomIdentity); }
function gZoom(f) { if(zoomB) d3.select('#graph-svg').transition().duration(250).call(zoomB.scaleBy,f); }

