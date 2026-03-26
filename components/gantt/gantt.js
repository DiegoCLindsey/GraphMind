//  GANTT ENGINE
// ══════════════════════════════════════════════════════
const G = {
  dayW: 26, rowH: 36, headerH: 50,
  collapsed: new Set(), minDate: null, maxDate: null,
  hitRects: [], rows: []
};

// Drag state for right-edge stretch (persists across renders)
let _ganttDrag = { active: false, nodeId: null, origEnd: null, origStart: null, startX: 0, lastDelta: 0, moved: false };
let _ganttDragRAF = 0;
// Pan state for click-drag-to-scroll
let _ganttPan  = { active: false, startX: 0, startY: 0, scrollL: 0, scrollT: 0, moved: false };

function ganttZoom(dir) {
  const step = G.dayW < 16 ? 2 : G.dayW < 32 ? 4 : 8;
  G.dayW = Math.max(4, Math.min(100, G.dayW + dir * step));
  renderGantt();
}

function ganttScrollToday() {
  if (!G.minDate) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const x = daysBetween(G.minDate, today) * G.dayW - 200;
  const sc2=document.getElementById('gantt-scroll'); sc2.scrollLeft=Math.max(0,x);
}

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

function parseDay(s) {
  return s ? new Date(s + 'T00:00:00') : null;
}

function toGMDDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getNodeRange(n) {
  let s = parseDay(n.start), e = parseDay(n.end) || parseDay(n.deadline);
  if (!s && !e) return null;
  if (!s) s = new Date(e);
  if (!e) e = new Date(s);
  return { s, e };
}

function buildRows() {
  const grp = document.getElementById('gantt-group-select')?.value || 'hierarchy';
  const flt = document.getElementById('gantt-filter-select')?.value || 'all';
  let nodes = S.nodes.filter(n => flt === 'all' || n.status === flt);

  if (grp === 'flat') {
    return nodes.map(n => ({ n, depth: 0, grp: false }));
  }

  if (grp === 'hierarchy') {
    const ids = new Set(nodes.map(n => n.id));
    const hasParent = new Set();
    nodes.forEach(n => getDirectChildren(n.id).forEach(c => { if (ids.has(c.id)) hasParent.add(c.id); }));
    const roots = nodes.filter(n => !hasParent.has(n.id));
    const rows = [];
    function walk(node, depth) {
      rows.push({ n: node, depth, grp: false });
      if (!G.collapsed.has(node.id)) {
        getDirectChildren(node.id).filter(c => ids.has(c.id)).forEach(c => walk(c, depth+1));
      }
    }
    roots.forEach(r => walk(r, 0));
    return rows;
  }

  if (grp === 'assignee') {
    const map = {};
    nodes.forEach(n => { const k = n.assignee || '(sin asignar)'; (map[k]=map[k]||[]).push(n); });
    const rows = [];
    Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,ns]) => {
      const gid = 'ag-'+k;
      rows.push({ n:null, depth:0, grp:true, label:k, gid });
      if (!G.collapsed.has(gid)) ns.forEach(n => rows.push({ n, depth:1, grp:false }));
    });
    return rows;
  }

  if (grp === 'tag') {
    const map = {};
    nodes.forEach(n => { const k = n.tags[0] || '(sin tag)'; (map[k]=map[k]||[]).push(n); });
    const rows = [];
    Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,ns]) => {
      const gid = 'tg-'+k;
      rows.push({ n:null, depth:0, grp:true, label:'#'+k, gid });
      if (!G.collapsed.has(gid)) ns.forEach(n => rows.push({ n, depth:1, grp:false }));
    });
    return rows;
  }
  return nodes.map(n => ({ n, depth:0, grp:false }));
}

function computeRange(rows) {
  let min = null, max = null;
  const check = d => {
    if (!d) return;
    if (!min || d < min) min = new Date(d);
    if (!max || d > max) max = new Date(d);
  };
  rows.forEach(r => {
    if (!r.n) return;
    const rng = getNodeRange(r.n);
    if (rng) { check(rng.s); check(rng.e); }
    check(parseDay(r.n.deadline));
  });
  if (!min) {
    // No dates at all — use today ± 30 days so dateless nodes still render
    const today = new Date(); today.setHours(0,0,0,0);
    const a = new Date(today); a.setDate(a.getDate() - 7);
    const b = new Date(today); b.setDate(b.getDate() + 30);
    return { min: a, max: b };
  }
  const a = new Date(min); a.setDate(a.getDate()-7);
  const b = new Date(max); b.setDate(b.getDate()+14);
  return { min: a, max: b };
}

function rRect(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function renderGantt() {
  invalidateCPCache();
  const view = document.getElementById('gantt-view');
  if (view.style.display === 'none') return;

  const rows = buildRows();
  G.rows = rows; // stored for empty-row click handler
  const range = computeRange(rows); // always non-null now
  const emptyEl = document.getElementById('gantt-empty');

  // Show empty only when there are zero node-rows (no tasks at all)
  const hasNodes = rows.some(r => !r.grp && r.n);
  if (!hasNodes) {
    emptyEl.style.display = 'flex';
    document.getElementById('gantt-rows-inner').innerHTML = '';
    return;
  }
  emptyEl.style.display = 'none';
  G.minDate = range.min; G.maxDate = range.max;
  const totalDays = daysBetween(range.min, range.max) + 1;
  const totalW = totalDays * G.dayW;
  const totalH = rows.length * G.rowH;
  const today = new Date(); today.setHours(0,0,0,0);

  // LEFT PANEL
  const leftEl = document.getElementById('gantt-rows-inner');
  leftEl.innerHTML = rows.map((r,i) => {
    if (r.grp) {
      const coll = G.collapsed.has(r.gid);
      return `<div class="gr-left grl-parent" onclick="gCollapse('${r.gid}')">
        <span class="gr-col-btn">${coll?'▶':'▼'}</span>
        <span class="gr-title-lbl" style="font-weight:600;color:var(--t2);flex:1">${esc(r.label)}</span>
      </div>`;
    }
    const n = r.n;
    const sc = statusColor(n.status);
    const kids = getDirectChildren(n.id);
    const agg = aggregateMetrics(n.id);
    const pct = agg ? agg.avgCompletion : (n.completion||0);
    const isP = n.type==='project' || kids.length>0;
    const coll = G.collapsed.has(n.id);
    const icons = {project:'◈',milestone:'◆',task:'◇',idea:'○'};
    const indent = r.depth * 14;
    return `<div class="gr-left ${n.id===S.currentId?'hl':''} ${isP?'grl-parent':''}" id="grl-${n.id}"
      onclick="select('${n.id}')" style="padding-left:${8+indent}px">
      ${kids.length ? `<span class="gr-col-btn" onclick="event.stopPropagation();gCollapse('${n.id}')">${coll?'▶':'▼'}</span>` : '<span style="width:14px;flex-shrink:0"></span>'}
      <span style="font-size:9px;color:${sc};flex-shrink:0">${icons[n.type]||'◇'}</span>
      <div class="gr-dot-sm" style="background:${sc}"></div>
      <span class="gr-title-lbl" style="${isP?'font-weight:500':'color:var(--t2)'}">${esc(n.title||'(sin título)')}</span>
      <div class="gr-right-meta">
        ${n.assignee?`<span style="font-size:9px;color:var(--t3)">${esc(n.assignee.split(' ')[0])}</span>`:''}
        <span class="gr-pct-lbl" style="color:${pct>=80?'var(--accent)':pct>=40?'var(--warn)':'var(--t3)'}">${pct}%</span>
      </div>
    </div>`;
  }).join('');

  // CANVAS SETUP
  const rightWrapEl = document.getElementById('gantt-right-wrap');
  const W = Math.max(rightWrapEl.clientWidth || 600, 100);

  // Header canvas — fixed width = right panel width
  const hCanvas = document.getElementById('gantt-header-canvas');
  hCanvas.width = W; hCanvas.height = G.headerH;
  hCanvas.style.width = W + 'px'; hCanvas.style.height = G.headerH + 'px';

  // Canvas wrap — full content width, force scroll container to know the real width
  const wrap = document.getElementById('gantt-canvas-wrap');
  wrap.style.width = totalW + 'px';
  wrap.style.height = totalH + 'px';
  wrap.style.minWidth = totalW + 'px'; // critical: prevents flex from collapsing width

  // Set inner rows height so left panel can measure it
  const innerEl = document.getElementById('gantt-rows-inner');
  innerEl.style.height = totalH + 'px';

  // Single scroll handler: sync left panel + redraw header
  const scrollEl = document.getElementById('gantt-scroll');
  const leftRowsEl = document.getElementById('gantt-rows-left');
  scrollEl.onscroll = function() {
    // Sync left panel vertical offset via translateY
    innerEl.style.transform = 'translateY(' + (-this.scrollTop) + 'px)';
    // Redraw sticky header with new horizontal offset
    drawHeader(totalW, totalDays, this.scrollLeft);
  };
  // Reset on fresh render
  innerEl.style.transform = 'translateY(0)';

  const gCanvas = document.getElementById('gantt-grid-canvas');
  gCanvas.width = totalW; gCanvas.height = totalH;
  gCanvas.style.width = totalW + 'px'; gCanvas.style.height = totalH + 'px';

  const bCanvas = document.getElementById('gantt-bars-canvas');
  bCanvas.width = totalW; bCanvas.height = totalH;
  bCanvas.style.width = totalW + 'px'; bCanvas.style.height = totalH + 'px';

  // GRID
  const gc = gCanvas.getContext('2d');
  gc.clearRect(0,0,totalW,totalH);
  const todayX = daysBetween(range.min, today) * G.dayW;

  rows.forEach((r,i) => {
    const y = i * G.rowH;
    if (r.grp || r.n?.type==='project') { gc.fillStyle='rgba(255,255,255,0.02)'; gc.fillRect(0,y,totalW,G.rowH); }
    if (r.n?.id===S.currentId) { gc.fillStyle='rgba(167,139,250,0.05)'; gc.fillRect(0,y,totalW,G.rowH); }
    gc.fillStyle='rgba(255,255,255,0.035)'; gc.fillRect(0,y+G.rowH-1,totalW,1);
  });

  for (let d=0; d<=totalDays; d++) {
    const x = d*G.dayW;
    const dt = new Date(range.min); dt.setDate(dt.getDate()+d);
    const isWE = dt.getDay()===0||dt.getDay()===6;
    const isMon = dt.getDay()===1;
    const isFOM = dt.getDate()===1;
    if (isWE && G.dayW>=8) { gc.fillStyle='rgba(255,255,255,0.018)'; gc.fillRect(x,0,G.dayW,totalH); }
    if (isFOM) { gc.strokeStyle='rgba(255,255,255,0.1)'; gc.lineWidth=1; gc.beginPath(); gc.moveTo(x,0); gc.lineTo(x,totalH); gc.stroke(); }
    else if (isMon && G.dayW>=5) { gc.strokeStyle='rgba(255,255,255,0.04)'; gc.lineWidth=1; gc.beginPath(); gc.moveTo(x,0); gc.lineTo(x,totalH); gc.stroke(); }
  }
  if (todayX>=0 && todayX<=totalW) {
    gc.strokeStyle='rgba(110,231,183,0.45)'; gc.lineWidth=1.5; gc.setLineDash([4,3]);
    gc.beginPath(); gc.moveTo(todayX,0); gc.lineTo(todayX,totalH); gc.stroke(); gc.setLineDash([]);
  }

  // BARS
  const bc = bCanvas.getContext('2d');
  bc.clearRect(0,0,totalW,totalH);
  G.hitRects = [];
  const _ganttCPSet = computeCriticalPath(); // compute once for all bars

  rows.forEach((r,i) => {
    if (r.grp) return;
    const n = r.n;
    const y = i * G.rowH;
    const cy = y + G.rowH/2;
    const sc = statusColor(n.status);
    const agg = aggregateMetrics(n.id);
    const pct = (agg ? agg.avgCompletion : (n.completion||0)) / 100;
    const rng = getNodeRange(n);
    const isP = n.type==='project' || getDirectChildren(n.id).length>0;
    const isMil = n.type==='milestone';
    const overdue = n.deadline && parseDay(n.deadline) < today && n.status!=='done';

    // Deadline marker
    if (n.deadline) {
      const dlX = daysBetween(range.min, parseDay(n.deadline)) * G.dayW;
      bc.strokeStyle = overdue ? 'rgba(248,113,113,0.7)' : 'rgba(251,191,36,0.5)';
      bc.lineWidth = 1; bc.setLineDash([3,2]);
      bc.beginPath(); bc.moveTo(dlX+G.dayW/2,y+2); bc.lineTo(dlX+G.dayW/2,y+G.rowH-2); bc.stroke();
      bc.setLineDash([]);
      bc.fillStyle = overdue ? 'rgba(248,113,113,0.8)' : 'rgba(251,191,36,0.7)';
      bc.beginPath(); bc.moveTo(dlX+G.dayW/2,y+4); bc.lineTo(dlX+G.dayW/2+6,y+9); bc.lineTo(dlX+G.dayW/2,y+14); bc.closePath(); bc.fill();
    }

    if (isMil) {
      if (!rng) return;
      const mx = daysBetween(range.min, rng.s)*G.dayW + G.dayW/2;
      const ms = 8;
      const milColor = pct >= 1 ? '#6ee7b7' : pct > 0 ? '#fbbf24' : '#a78bfa';
      bc.fillStyle = milColor + 'cc';
      bc.beginPath(); bc.moveTo(mx,cy-ms); bc.lineTo(mx+ms,cy); bc.lineTo(mx,cy+ms); bc.lineTo(mx-ms,cy); bc.closePath(); bc.fill();
      bc.strokeStyle='rgba(255,255,255,0.3)'; bc.lineWidth=1; bc.stroke();
      // Completion ring around milestone
      if (pct > 0 && pct < 1) {
        bc.strokeStyle = '#6ee7b7aa'; bc.lineWidth = 2;
        bc.beginPath(); bc.arc(mx, cy, ms+3, -Math.PI/2, -Math.PI/2 + pct*2*Math.PI); bc.stroke();
      }
      G.hitRects.push({x:mx-ms-3,y:y+2,w:(ms+3)*2,h:G.rowH-4,n});
      return;
    }

    if (!rng) return;
    const x1 = daysBetween(range.min, rng.s)*G.dayW;
    const x2 = daysBetween(range.min, rng.e)*G.dayW + G.dayW;
    const bw = Math.max(x2-x1, G.dayW);
    const bh = isP ? 14 : 18;
    const by = cy - bh/2;

    // Completion color: green=done, amber=in progress, blue=not started
    const pctRaw = Math.round(pct * 100);
    const doneColor   = '#6ee7b7'; // accent green
    const activeColor = '#60a5fa'; // blue — in-progress fill
    const emptyColor  = sc + '25'; // dim status color bg
    const onCP = _ganttCPSet.has(n.id);

    // BG (empty part of bar)
    bc.fillStyle = emptyColor;
    rRect(bc,x1,by,bw,bh,isP?3:7); bc.fill();

    // Progress fill (clipped to bar width)
    if (pct > 0) {
      const fillW = Math.max(bw * pct, isP ? 4 : 6);
      // Use clip to keep rounded corners on fill
      bc.save();
      rRect(bc,x1,by,bw,bh,isP?3:7);
      bc.clip();
      // Color ramp: <40% blue, 40-80% amber, >80% green
      const fillColor = pct >= 0.8 ? doneColor : pct >= 0.4 ? '#fbbf24' : activeColor;
      bc.fillStyle = fillColor + (isP ? 'bb' : 'cc');
      bc.fillRect(x1, by, fillW, bh);
      // Subtle shine stripe at top of fill
      if (!isP && bh >= 14) {
        bc.fillStyle = 'rgba(255,255,255,0.12)';
        bc.fillRect(x1, by, fillW, Math.ceil(bh * 0.35));
      }
      bc.restore();
    }

    // Border
    if (onCP) {
      bc.strokeStyle='rgba(248,113,113,0.9)'; bc.lineWidth=2;
    } else {
      bc.strokeStyle = pct >= 0.8 ? doneColor+'99' : sc+'55'; bc.lineWidth=1;
    }
    rRect(bc,x1,by,bw,bh,isP?3:7); bc.stroke();

    // Parent brackets (stronger visual anchor)
    if (isP) {
      bc.fillStyle = sc + 'dd';
      bc.fillRect(x1, by-3, 3, bh+6);
      bc.fillRect(x1+bw-3, by-3, 3, bh+6);
    }

    // Completion % badge (right side of bar, if space)
    if (bw > 48 && pctRaw > 0) {
      const badge = pctRaw + '%';
      bc.font = `500 9px "IBM Plex Mono",monospace`;
      bc.textBaseline = 'middle';
      const bw2 = bc.measureText(badge).width;
      const badgeX = x1 + bw - bw2 - 5;
      const badgeY = cy;
      if (badgeX > x1 + 4) {
        bc.fillStyle = 'rgba(0,0,0,0.45)';
        bc.fillText(badge, badgeX, badgeY);
        bc.fillStyle = pct >= 0.8 ? doneColor : pct >= 0.4 ? '#fbbf24' : 'rgba(255,255,255,0.7)';
        bc.fillText(badge, badgeX - 0.5, badgeY - 0.5);
      }
    }

    // Title text
    if (G.dayW>=14 && bw>36) {
      bc.fillStyle='rgba(255,255,255,0.85)'; bc.font=`${isP?'500':'400'} 10px "IBM Plex Sans",sans-serif`; bc.textBaseline='middle';
      const maxTxtW = pctRaw > 0 && bw > 60 ? bw - 36 : bw - 10;
      let txt=n.title||'';
      while(bc.measureText(txt).width > maxTxtW && txt.length > 2) txt = txt.slice(0,-1);
      if(txt !== n.title) txt = txt.slice(0,-1) + '…';
      bc.fillText(txt, x1+5, cy);
    }

    // Dependency arrows (blocks)
    n.connections.forEach(cid => {
      if (n.connTypes[cid]!=='blocks') return;
      const ti = rows.findIndex(r2=>r2.n?.id===cid);
      if (ti<0) return;
      const tr = getNodeRange(rows[ti].n);
      if (!tr) return;
      const tx = daysBetween(range.min,tr.s)*G.dayW;
      const ty2 = ti*G.rowH+G.rowH/2;
      bc.strokeStyle='rgba(248,113,113,0.4)'; bc.lineWidth=1; bc.setLineDash([]);
      bc.beginPath(); bc.moveTo(x1+bw,cy);
      bc.bezierCurveTo(x1+bw+20,cy,tx-20,ty2,tx,ty2); bc.stroke();
      bc.fillStyle='rgba(248,113,113,0.5)';
      bc.beginPath(); bc.moveTo(tx,ty2); bc.lineTo(tx-6,ty2-3); bc.lineTo(tx-6,ty2+3); bc.closePath(); bc.fill();
    });

    // Edge grip indicator (right 2px of bar, subtle)
    if (bw > 14) {
      bc.fillStyle = 'rgba(255,255,255,0.28)';
      bc.fillRect(x1 + bw - 3, by + 3, 2, bh - 6);
    }

    G.hitRects.push({x:x1,y:y+2,w:bw,h:G.rowH-4,n});
  });

  drawHeader(totalW, totalDays, scrollEl.scrollLeft || 0);
  updateGanttStats(rows);

  // ── TOOLTIP + CLICK + STRETCH + PAN ─────────────────────────────────────────
  const EDGE_W = Math.max(10, Math.round(G.dayW * 0.45));
  const tip = document.getElementById('gantt-tip');
  const hideTip = () => { tip.style.opacity = '0'; };

  const showTip = (e, hit) => {
    if (!hit) { hideTip(); return; }
    const n = hit.n; const agg = aggregateMetrics(n.id); const pct = agg ? agg.avgCompletion : (n.completion || 0);
    const overdue = n.deadline && parseDay(n.deadline) < today && n.status !== 'done';
    let h = `<div class="gt-title">${esc(n.title || '(sin título)')}</div>`;
    if (n.assignee) h += `<div class="gt-row"><span class="gt-k">Asignado</span><span class="gt-v">${esc(n.assignee)}</span></div>`;
    if (n.start) h += `<div class="gt-row"><span class="gt-k">Inicio</span><span class="gt-v">${fmtDate(n.start)}</span></div>`;
    if (n.end)   h += `<div class="gt-row"><span class="gt-k">Fin</span><span class="gt-v">${fmtDate(n.end)}</span></div>`;
    if (n.deadline) h += `<div class="gt-row"><span class="gt-k">Límite</span><span class="gt-v" style="color:${overdue?'var(--danger)':'var(--warn)'}">${fmtDate(n.deadline)}</span></div>`;
    if (n.days || n.hours) h += `<div class="gt-row"><span class="gt-k">Horas</span><span class="gt-v">${fmtH(n.days || n.hours)}</span></div>`;
    if (n.cost) h += `<div class="gt-row"><span class="gt-k">Coste</span><span class="gt-v">${fmtCur(n.cost)}</span></div>`;
    if (agg)    h += `<div class="gt-row"><span class="gt-k">Subtareas</span><span class="gt-v">${agg.done}/${agg.count} · €${agg.totalCost.toFixed(0)}</span></div>`;
    const fillC = pct >= 80 ? '#6ee7b7' : pct >= 40 ? '#fbbf24' : '#60a5fa';
    h += `<div class="gt-pb"><div class="gt-pf" style="width:${pct}%;background:${fillC}"></div></div>`;
    tip.innerHTML = h;
    const gvRect = document.getElementById('gantt-view').getBoundingClientRect();
    let tx = e.clientX - gvRect.left + 14, ty = e.clientY - gvRect.top + 14;
    if (tx + 244 > gvRect.width)  tx = e.clientX - gvRect.left - 258;
    if (ty + 160 > gvRect.height) ty = e.clientY - gvRect.top - 170;
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; tip.style.opacity = '1';
  };

  // ── Shared pointer-down logic (mouse + touch) ────────────────────────────
  const _canvasXY = (clientX, clientY) => {
    const r = bCanvas.getBoundingClientRect();
    return { mx: clientX - r.left, my: clientY - r.top };
  };

  const _startInteraction = (clientX, clientY) => {
    const { mx, my } = _canvasXY(clientX, clientY);
    const hit = G.hitRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    if (hit && mx >= hit.x + hit.w - EDGE_W) {
      _ganttDrag = { active: true, nodeId: hit.n.id, origEnd: hit.n.end, origStart: hit.n.start, startX: mx, lastDelta: 0, moved: false };
      return 'stretch';
    }
    if (!hit) {
      const se = document.getElementById('gantt-scroll');
      _ganttPan = { active: true, startX: clientX, startY: clientY, scrollL: se.scrollLeft, scrollT: se.scrollTop, moved: false };
      return 'pan';
    }
    return null;
  };

  const _moveInteraction = (clientX, clientY) => {
    if (_ganttDrag.active) {
      const { mx } = _canvasXY(clientX, clientY);
      const deltaX = mx - _ganttDrag.startX;
      const deltaDays = Math.round(deltaX / G.dayW);
      if (deltaDays !== _ganttDrag.lastDelta) {
        _ganttDrag.lastDelta = deltaDays;
        _ganttDrag.moved = Math.abs(deltaX) > 4;
        const n = S.nodes.find(nd => nd.id === _ganttDrag.nodeId);
        if (n) {
          const base = parseDay(_ganttDrag.origEnd) || parseDay(_ganttDrag.origStart) || new Date();
          const newEnd = new Date(base); newEnd.setDate(newEnd.getDate() + deltaDays);
          const minEnd = parseDay(_ganttDrag.origStart) || newEnd;
          if (newEnd >= minEnd) {
            n.end = toGMDDate(newEnd);
            cancelAnimationFrame(_ganttDragRAF);
            _ganttDragRAF = requestAnimationFrame(renderGantt);
          }
        }
      }
      return 'stretch';
    }
    if (_ganttPan.active) {
      const dx = clientX - _ganttPan.startX, dy = clientY - _ganttPan.startY;
      _ganttPan.moved = _ganttPan.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
      const se = document.getElementById('gantt-scroll');
      se.scrollLeft = _ganttPan.scrollL - dx;
      se.scrollTop  = _ganttPan.scrollT - dy;
      return 'pan';
    }
    return null;
  };

  // ── Mouse events ─────────────────────────────────────────────────────────
  bCanvas.onmousedown = (e) => {
    if (e.button !== 0) return;
    const mode = _startInteraction(e.clientX, e.clientY);
    if (mode === 'stretch') { e.preventDefault(); bCanvas.style.cursor = 'ew-resize'; }
    if (mode === 'pan')     { e.preventDefault(); bCanvas.style.cursor = 'grabbing'; hideTip(); }
  };

  bCanvas.onmousemove = (e) => {
    const mode = _moveInteraction(e.clientX, e.clientY);
    if (mode === 'stretch') { hideTip(); bCanvas.style.cursor = 'ew-resize'; return; }
    if (mode === 'pan')     { hideTip(); bCanvas.style.cursor = 'grabbing'; return; }
    // Hover state
    const { mx, my } = _canvasXY(e.clientX, e.clientY);
    const hit = G.hitRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    if (hit) {
      if (mx >= hit.x + hit.w - EDGE_W) { hideTip(); bCanvas.style.cursor = 'ew-resize'; }
      else { showTip(e, hit); bCanvas.style.cursor = 'pointer'; }
    } else {
      hideTip();
      const row = G.rows[Math.floor(my / G.rowH)];
      bCanvas.style.cursor = (row && !row.grp && row.n && !getNodeRange(row.n)) ? 'cell' : 'grab';
    }
  };

  bCanvas.onmouseleave = () => { hideTip(); };

  bCanvas.onclick = (e) => {
    if (_ganttDrag.moved) { _ganttDrag.moved = false; return; }
    if (_ganttPan.moved)  { _ganttPan.moved  = false; return; }
    const { mx, my } = _canvasXY(e.clientX, e.clientY);
    const hit = G.hitRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    if (hit) {
      if (mx < hit.x + hit.w - EDGE_W) { select(hit.n.id); switchView('editor'); }
    } else {
      const row = G.rows[Math.floor(my / G.rowH)];
      if (!row || row.grp || !row.n) return;
      const dayOffset = Math.floor(mx / G.dayW);
      const clickDate = new Date(G.minDate); clickDate.setDate(clickDate.getDate() + dayOffset);
      row.n.start = toGMDDate(clickDate);
      if (!row.n.end) row.n.end = toGMDDate(clickDate);
      autoSaveLS(); recalcAll(); renderGantt();
    }
  };

  // ── Touch events (stretch only; pan is native via #gantt-scroll) ─────────
  bCanvas.ontouchstart = (e) => {
    const t = e.changedTouches[0];
    const { mx } = _canvasXY(t.clientX, t.clientY);
    const hit = G.hitRects.find(r => {
      const { mx: hx, my: hy } = _canvasXY(t.clientX, t.clientY);
      return hx >= r.x && hx <= r.x + r.w && hy >= r.y && hy <= r.y + r.h;
    });
    if (hit && mx >= hit.x + hit.w - EDGE_W * 1.8) {
      e.preventDefault();
      _ganttDrag = { active: true, nodeId: hit.n.id, origEnd: hit.n.end, origStart: hit.n.start, startX: mx, lastDelta: 0, moved: false };
    }
  };
  bCanvas.ontouchmove = (e) => {
    if (!_ganttDrag.active) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    _moveInteraction(t.clientX, t.clientY);
  };
  bCanvas.ontouchend = (e) => {
    if (!_ganttDrag.active) return;
    e.preventDefault();
    // commit handled by module-level mouseup listener
    _ganttDrag.active = false;
    cancelAnimationFrame(_ganttDragRAF);
    const n = S.nodes.find(nd => nd.id === _ganttDrag.nodeId);
    if (n && _ganttDrag.moved) { autoSaveLS(); recalcAll(); renderGantt(); }
    else if (n) { n.end = _ganttDrag.origEnd; renderGantt(); }
  };
}

function drawHeader(totalW, totalDays, scrollX) {
  const canvas=document.getElementById('gantt-header-canvas');
  if(!canvas||!G.minDate) return;
  const W=canvas.width, H=canvas.height;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#111'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(0,H-1,W,1);
  const today=new Date(); today.setHours(0,0,0,0);
  let prevM=-1;
  for(let d=0;d<=totalDays;d++){
    const x=d*G.dayW-scrollX;
    if(x<-G.dayW||x>W+G.dayW) continue;
    const dt=new Date(G.minDate); dt.setDate(dt.getDate()+d);
    const m=dt.getMonth(), dom=dt.getDate(), dow=dt.getDay();
    const isWE=dow===0||dow===6, isToday=dt.getTime()===today.getTime();
    if(m!==prevM){
      prevM=m;
      ctx.fillStyle='rgba(240,240,240,0.7)'; ctx.font='500 11px "IBM Plex Sans",sans-serif'; ctx.textBaseline='middle';
      ctx.fillText(dt.toLocaleDateString('es',{month:'long',year:'numeric'}), x+4, 13);
      ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(x,0,1,H);
    }
    if(isToday){ ctx.fillStyle='rgba(110,231,183,0.12)'; ctx.fillRect(x,24,G.dayW,H-24); }
    if(isWE&&G.dayW>=8){ ctx.fillStyle='rgba(255,255,255,0.025)'; ctx.fillRect(x,24,G.dayW,H-24); }
    if(G.dayW>=16){
      ctx.font=`${isToday?'600':'400'} 10px "IBM Plex Mono",monospace`;
      ctx.fillStyle=isToday?'#6ee7b7':isWE?'rgba(255,255,255,0.22)':'rgba(255,255,255,0.42)';
      ctx.textBaseline='middle'; ctx.fillText(dom, x+G.dayW/2-5, 37);
    } else if(G.dayW>=5&&dom===1){
      ctx.font='400 9px "IBM Plex Mono",monospace'; ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.textBaseline='middle';
      ctx.fillText(dom, x+1, 37);
    }
    if(dow===1&&G.dayW<16&&G.dayW>=5){ ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(x,28,1,H-28); }
  }
  const todayX=daysBetween(G.minDate,today)*G.dayW-scrollX;
  if(todayX>=0&&todayX<=W){ ctx.fillStyle='#6ee7b7'; ctx.beginPath(); ctx.arc(todayX+G.dayW/2,H-5,3,0,Math.PI*2); ctx.fill(); }
}

function updateGanttStats(rows) {
  const ns=rows.filter(r=>!r.grp&&r.n).map(r=>r.n);
  const h=ns.reduce((s,n)=>s+(parseFloat(n.days||n.hours)||0),0);
  const c=ns.reduce((s,n)=>s+(parseFloat(n.cost)||0),0);
  const p=ns.length?Math.round(ns.reduce((s,n)=>s+(n.completion||0),0)/ns.length):0;
  document.getElementById('gs-count').textContent=ns.length;
  document.getElementById('gs-hours').textContent=h.toFixed(1)+'d';
  document.getElementById('gs-cost').textContent='€'+c.toLocaleString('es',{maximumFractionDigits:0});
  document.getElementById('gs-pct').textContent=p+'%';
}

function gCollapse(id) {
  if(G.collapsed.has(id)) G.collapsed.delete(id); else G.collapsed.add(id);
  renderGantt();
}


// Commit stretch / end pan on mouseup (fires even when mouse leaves the canvas)
document.addEventListener('mouseup', () => {
  if (_ganttDrag.active) {
    _ganttDrag.active = false;
    cancelAnimationFrame(_ganttDragRAF);
    const n = S.nodes.find(nd => nd.id === _ganttDrag.nodeId);
    if (n && _ganttDrag.moved) { autoSaveLS(); recalcAll(); renderGantt(); }
    else if (n) { n.end = _ganttDrag.origEnd; renderGantt(); }
  }
  if (_ganttPan.active) {
    _ganttPan.active = false;
    const bc = document.getElementById('gantt-bars-canvas');
    if (bc) bc.style.cursor = 'default';
  }
});

// ── ROTATE LOCK ──
function checkOrientation() {
  const msg = document.getElementById('rotate-msg');
  const isNarrow = window.innerWidth < 520;
  const onVisual = currentView === 'gantt' || currentView === 'graph';
  msg.style.display = (isNarrow && onVisual) ? 'flex' : 'none';
}
window.addEventListener('resize', checkOrientation);
// ResizeObserver and init() are called by js/loader.js after DOM partials are injected

// 
//  GANTT BOTTOM SHEET (MOBILE)
// 
function openGanttSheet() {
  document.getElementById('gantt-cfg-sheet').classList.add('open');
  document.getElementById('gantt-sheet-backdrop').classList.add('open');
}

function closeGanttSheet() {
  document.getElementById('gantt-cfg-sheet').classList.remove('open');
  document.getElementById('gantt-sheet-backdrop').classList.remove('open');
}
