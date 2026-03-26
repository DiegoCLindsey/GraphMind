// ══════════════════════════════════════════════════════
//  COMMENTS
// ══════════════════════════════════════════════════════
function addComment() {
  const n = getCurrent(); if (!n) return;
  const text = document.getElementById('comment-inp').value.trim();
  const author = document.getElementById('comment-author-inp').value.trim() || 'Yo';
  if (!text) return;
  n.comments.push({ id: gid(), author, text, date: new Date().toISOString() });
  document.getElementById('comment-inp').value = '';
  renderComments();
  saveNode();
  autoSaveLS();
}
function deleteComment(cid) {
  const n = getCurrent(); if (!n) return;
  n.comments = n.comments.filter(c => c.id !== cid);
  renderComments();
}
function renderComments() {
  const n = getCurrent();
  const list = document.getElementById('comments-list');
  if (!n || !n.comments.length) {
    list.innerHTML = `<div style="font-size:11px;color:var(--t3);margin-bottom:10px">${t('editor.no_comments')}</div>`;
    return;
  }
  list.innerHTML = n.comments.map(c => {
    const initials = c.author.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const col = gTC(c.author);
    const date = new Date(c.date).toLocaleString(getLocale() === 'en' ? 'en-GB' : 'es', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    return `<div class="comment">
      <div class="comment-avatar" style="background:${col}22;color:${col}">${initials}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-date">${date}</span>
          <span class="comment-del" onclick="deleteComment('${c.id}')">✕</span>
        </div>
        <div class="comment-text md-render">${renderMd(c.text)}</div>
      </div>
    </div>`;
  }).join('');
  runMermaid(list);
}

