// ══════════════════════════════════════════════════════
//  MARKDOWN + MERMAID
//  Renders Markdown text to HTML, with special handling
//  for ```mermaid code blocks via mermaid.js.
// ══════════════════════════════════════════════════════

(function () {
  // Configure marked once libs are available
  function _initMarked() {
    if (typeof marked === 'undefined') return;
    const renderer = new marked.Renderer();
    const _origCode = renderer.code.bind(renderer);
    renderer.code = function (code, lang) {
      if ((lang || '').toLowerCase() === 'mermaid') {
        // Wrap in mermaid div; mermaid.js will process it
        return `<div class="mermaid-pending">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
      }
      return _origCode(code, lang);
    };
    marked.use({
      renderer,
      breaks: true,  // single \n → <br>
      gfm: true,
    });
  }

  function _initMermaid() {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'var(--mono, monospace)',
    });
  }

  // ── Public API ──────────────────────────────────────

  /**
   * Render Markdown string to HTML string.
   * Falls back to escaped plain text if marked.js is not loaded.
   */
  window.renderMd = function (text) {
    if (!text || !text.trim()) return '';
    if (typeof marked === 'undefined') {
      // Fallback: plain escaped text with line breaks
      return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }
    return marked.parse(text);
  };

  /**
   * Scan a container element for .mermaid-pending blocks and
   * render diagrams into them using mermaid.js.
   */
  window.runMermaid = function (container) {
    if (typeof mermaid === 'undefined') return;
    const els = Array.from((container || document).querySelectorAll('.mermaid-pending'));
    if (!els.length) return;
    els.forEach(el => {
      const src = el.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid';
      wrapper.textContent = src;
      el.replaceWith(wrapper);
    });
    try {
      mermaid.init(undefined, container.querySelectorAll('.mermaid:not([data-processed])'));
    } catch (e) {
      console.warn('GraphMind mermaid render error:', e);
    }
  };

  // Initialise when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _initMarked(); _initMermaid(); });
  } else {
    _initMarked();
    _initMermaid();
  }
}());
