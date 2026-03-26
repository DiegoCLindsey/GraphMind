// ══════════════════════════════════════════════════════
//  TAGS
// ══════════════════════════════════════════════════════
function handleTag(e) {
  const inp = document.getElementById('tag-inp');
  if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) {
    e.preventDefault();
    const tag = inp.value.trim().replace(/[,\s]+/g,'-').toLowerCase();
    const n = getCurrent(); if (!n || !tag || n.tags.includes(tag)) { inp.value=''; return; }
    n.tags.push(tag); gTC(tag); inp.value = ''; renderTagBadges(); saveNode();
  }
  if (e.key === 'Backspace' && inp.value === '') {
    const n = getCurrent(); if (n && n.tags.length) { n.tags.pop(); renderTagBadges(); saveNode(); }
  }
}
function removeTag(t) {
  const n = getCurrent(); if (!n) return;
  n.tags = n.tags.filter(x => x !== t); renderTagBadges(); saveNode();
}
function renderTagBadges() {
  const n = getCurrent();
  const c = document.getElementById('tags-c');
  if (!n) { c.innerHTML=''; return; }
  c.innerHTML = n.tags.map(t => {
    const col = gTC(t);
    return `<span class="tag-b" style="background:${col}1a;color:${col};border:1px solid ${col}33">#${esc(t)}<span class="rx" onclick="removeTag('${esc(t)}')">×</span></span>`;
  }).join('');
}

