// ══════════════════════════════════════════════════════
//  HTML LOADER
//  Fetches all HTML partials, los inyecta en orden en el
//  DOM y arranca la app una vez el markup está listo.
//
//  Requiere servidor HTTP (GitHub Pages, live-server…).
//  No funciona con file:// por restricciones de fetch().
// ══════════════════════════════════════════════════════
(async function () {
  const app  = document.getElementById('app');
  const main = document.getElementById('main');

  // [url, elemento destino, posición insertAdjacentHTML]
  const partials = [
    ['components/topbar/topbar.html',         document.body, 'afterbegin'],  // antes de #app
    ['components/sidebar/sidebar.html',       app,           'afterbegin'],  // antes de #main
    ['components/editor/editor.html',         main,          'afterbegin'],  // primer hijo de #main
    ['components/graph/graph.html',           main,          'beforeend' ],
    ['components/gantt/gantt.html',           main,          'beforeend' ],
    ['components/help/help.html',             main,          'beforeend' ],
    ['components/config/config.html',          main,          'beforeend' ],
    ['components/modals/modals.html',          document.body, 'beforeend' ],
    ['components/gantt/gantt-sheet.html',     document.body, 'beforeend' ],
  ];

  try {
    // Carga todos los partials en paralelo (más rápido)
    const htmls = await Promise.all(
      partials.map(([url]) =>
        fetch(url).then(r => {
          if (!r.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${r.status})`);
          return r.text();
        })
      )
    );

    // Inyecta en orden para mantener la estructura correcta del DOM
    htmls.forEach((html, i) => {
      const [, parent, position] = partials[i];
      parent.insertAdjacentHTML(position, html);
    });

  } catch (err) {
    console.error('GraphMind loader:', err);
    document.body.innerHTML = `
      <div style="color:#f87171;padding:40px;font-family:'IBM Plex Mono',monospace;background:#080808;height:100vh;box-sizing:border-box">
        <div style="font-size:16px;font-weight:600;margin-bottom:12px">⚠ Error al cargar GraphMind</div>
        <div style="font-size:13px;color:#909090;margin-bottom:20px">${err.message}</div>
        <div style="font-size:11px;color:#555;line-height:1.8">
          Este proyecto usa <code>fetch()</code> para cargar partials HTML,<br>
          lo que requiere un servidor HTTP. No funciona con <code>file://</code>.<br><br>
          <b style="color:#f0f0f0">Opciones:</b><br>
          • GitHub Pages (producción)<br>
          • <code>npx serve .</code> o <code>python -m http.server</code> (local)
        </div>
      </div>`;
    return;
  }

  // DOM listo — conectar listeners y arrancar
  setupListeners();
  applyTheme();
  populateEditorSelects();   // debe ir antes de init() para que renderEditor tenga opciones
  renderStatusFilterButtons();
  init();
})();
