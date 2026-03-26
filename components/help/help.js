// ══════════════════════════════════════════════════════
//  HELP
//  Loads the Markdown file for the current locale,
//  renders it with marked.js + Mermaid and injects
//  the result into #help-content.
// ══════════════════════════════════════════════════════

const _helpCache = {};  // locale → rendered HTML string

async function renderHelp() {
  const locale = (typeof getLocale === 'function') ? getLocale() : 'es';
  const container = document.getElementById('help-content');
  if (!container) return;

  // Serve from cache when locale hasn't changed
  if (_helpCache[locale]) {
    container.innerHTML = _helpCache[locale];
    runMermaid(container);
    return;
  }

  // Loading state
  container.innerHTML = '<div class="help-loading">…</div>';

  try {
    const url = `components/help/${locale}.md`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const html = renderMd(md);
    _helpCache[locale] = html;
    container.innerHTML = html;
    runMermaid(container);
  } catch (err) {
    // Fallback: try Spanish if English failed
    if (locale !== 'es' && !_helpCache['es']) {
      try {
        const res = await fetch('components/help/es.md');
        const md = await res.text();
        _helpCache['es'] = renderMd(md);
      } catch (_) { /* ignore */ }
    }
    container.innerHTML = _helpCache['es']
      || `<p style="color:var(--t3);font-size:13px">No se pudo cargar la ayuda: ${err.message}</p>`;
    if (_helpCache['es']) runMermaid(container);
  }
}
