// ══════════════════════════════════════════════════════
//  COMMENTS
// ══════════════════════════════════════════════════════
let _editingCommentId = null;

function addComment() {
  const n = getCurrent(); if (!n) return;
  const text = document.getElementById('comment-inp').value.trim();
  const author = document.getElementById('comment-author-inp').value.trim() || 'Yo';
  if (!text) return;
  n.comments.push({ id: gid(), author, text, date: new Date().toISOString() });
  document.getElementById('comment-inp').value = '';
  _editingCommentId = null;
  renderComments();
  saveNode();
  autoSaveLS();
}

function deleteComment(cid) {
  const n = getCurrent(); if (!n) return;
  if (_editingCommentId === cid) _editingCommentId = null;
  n.comments = n.comments.filter(c => c.id !== cid);
  renderComments();
  saveNode();
  autoSaveLS();
}

function editComment(cid) {
  _editingCommentId = cid;
  renderComments();
  // Focus the textarea after render
  const ta = document.getElementById(`cedit-${cid}`);
  if (ta) { ta.focus(); ta.selectionStart = ta.value.length; }
}

function saveCommentEdit(cid) {
  const n = getCurrent(); if (!n) return;
  const ta = document.getElementById(`cedit-${cid}`);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) return;
  const c = n.comments.find(x => x.id === cid);
  if (c) {
    c.text = newText;
    c.edited = new Date().toISOString();
  }
  _editingCommentId = null;
  renderComments();
  saveNode();
  autoSaveLS();
}

function cancelCommentEdit() {
  _editingCommentId = null;
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
    const locale = getLocale() === 'en' ? 'en-GB' : 'es';
    const date = new Date(c.date).toLocaleString(locale, {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const editedMark = c.edited
      ? `<span class="comment-edited" title="${new Date(c.edited).toLocaleString(locale)}">(${getLocale()==='en'?'edited':'editado'})</span>`
      : '';
    const isEditing = _editingCommentId === c.id;

    const bodyHtml = isEditing
      ? `<div class="comment-edit-wrap">
           <textarea id="cedit-${c.id}" class="comment-edit-ta" rows="3"
             onkeydown="if(event.ctrlKey&&event.key==='Enter')saveCommentEdit('${c.id}');else if(event.key==='Escape')cancelCommentEdit()"
           >${esc(c.text)}</textarea>
           <div class="comment-edit-actions">
             <button class="cact-save" onclick="saveCommentEdit('${c.id}')">${t('editor.comment_save')}</button>
             <button class="cact-cancel" onclick="cancelCommentEdit()">${t('editor.comment_cancel')}</button>
           </div>
         </div>`
      : `<div class="comment-text md-render">${renderMd(c.text)}</div>`;

    return `<div class="comment${isEditing?' editing':''}" data-cid="${c.id}">
      <div class="comment-avatar" style="background:${col}22;color:${col}">${initials}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${esc(c.author)}</span>
          <span class="comment-date">${date}</span>
          ${editedMark}
          <span class="comment-actions">
            <span class="comment-edit-btn" onclick="editComment('${c.id}')" title="${t('editor.comment_edit')}">✎</span>
            <span class="comment-del" onclick="deleteComment('${c.id}')" title="${t('common.delete')}">✕</span>
          </span>
        </div>
        ${bodyHtml}
      </div>
    </div>`;
  }).join('');

  if (_editingCommentId === null) runMermaid(list);
}
