# ⬡ GraphMind

> Gestor de proyectos visual basado en teoría de grafos — HTML autocontenido, sin servidor, sin suscripción.

[![version](https://img.shields.io/badge/version-1.2.0-6ee7b7?style=flat-square&labelColor=111)](https://github.com/DiegoCLindsey/GraphMind/releases/tag/v1.2.0)
[![license](https://img.shields.io/badge/license-MIT-a78bfa?style=flat-square&labelColor=111)]()
[![deploy](https://img.shields.io/badge/GitHub%20Pages-live-60a5fa?style=flat-square&labelColor=111)](https://diegoclindsey.github.io/GraphMind/)

---

## ¿Qué es GraphMind?

GraphMind organiza el trabajo como un **grafo de nodos**. Cada nodo es una tarea, proyecto, hito o idea. Las conexiones forman jerarquías padre→hijo y relaciones de dependencia. Los nodos padre agregan automáticamente las métricas de sus hijos: fechas, duración, coste y completitud se calculan en cascada.

Todo vive en un único archivo HTML — sin base de datos, sin backend, sin cuenta. Los datos se guardan en `localStorage` y se exportan/importan como JSON.

---

## Características principales

| Módulo | Descripción |
|---|---|
| **Editor** | Campos completos: título, tipo, estado, tags, asignado, prioridad, fechas, duración, coste, completitud |
| **Grafo** | Vista D3.js interactiva con formas por tipo, colores por estado, leyenda y tooltip enriquecido |
| **Gantt** | Diagrama de barras con zoom, agrupación, filtros y cálculo de camino crítico |
| **Configuración** | Estados, tipos, tema claro/oscuro/personalizado, moneda y unidad de duración |
| **Markdown** | Descripción y comentarios soportan Markdown completo + diagramas Mermaid |
| **i18n** | Interfaz en Español e Inglés con toggle 🇬🇧/🇪🇸 persistido |
| **Comentarios** | Añadir, editar inline (Ctrl+Enter) y eliminar comentarios por tarea |
| **Ayuda** | Guía integrada cargada desde Markdown, actualizada por versión e idioma |

---

## Uso rápido

```bash
# Opción A — GitHub Pages (producción)
# Abre https://diegoclindsey.github.io/GraphMind/

# Opción B — servidor local
npx serve .
# o
python -m http.server 8080
```

> ⚠️ La app usa `fetch()` para cargar partials HTML. **No funciona con `file://`** — necesita un servidor HTTP.

---

## Documentación

La **guía de uso completa** está integrada en la propia aplicación, en la pestaña **? Ayuda**. Cubre:

- Conceptos básicos del modelo de grafo
- Crear y editar tareas, campos y métricas
- Descripción con Markdown y diagramas Mermaid
- Conexiones entre nodos y tipos de relación
- Nodos padre y métricas en cascada
- Camino crítico (Gantt + Grafo + Editor)
- Vista Gantt: zoom, grupos, filtros, tooltips
- Vista Grafo: navegación, leyenda, seguimiento
- Comentarios: añadir, editar y eliminar
- Configuración: estados, tipos, tema, unidades
- Guardar, exportar e importar JSON
- Cambio de idioma (ES/EN)
- Atajos de teclado

Los archivos fuente de la ayuda son [`components/help/es.md`](components/help/es.md) y [`components/help/en.md`](components/help/en.md).

---

## Changelog

### v1.2.0 — 2026-03-26

- **i18n ES/EN** — motor `t()`, 16 archivos de locale por componente, botón 🇬🇧/🇪🇸 en topbar, todos los strings del DOM y el JS traducidos (GMND-041)
- **Markdown + Mermaid** en la descripción de tareas: toggle Editar/Vista previa, renderizado con `marked.js` + `mermaid.js` (GMND-041)
- **Markdown + Mermaid en comentarios** — el texto de cada comentario se renderiza como Markdown (GMND-041)
- **Edición inline de comentarios** — icono ✎ en hover, Ctrl+Enter para guardar, Escape para cancelar, marca *(editado)* con timestamp (GMND-042)
- **Ayuda en Markdown** — `es.md` / `en.md` cargados de forma lazy según el locale activo, con estilos propios (GMND-043)

### v1.1.0 — 2026-03-XX

- **Panel de configuración** — estados y tipos personalizables, temas claro/oscuro/personalizado con tokens CSS, moneda y unidad de duración (GMND-031)
- **Graph follow** — el grafo centra automáticamente el nodo seleccionado (GMND-031)
- **Formas de vértice** — cada tipo de nodo puede tener forma `circle`, `rect` o `diamond` (GMND-031)
- **Arquitectura i18n-ready** en tema y configuración (GMND-031)

### v1.0.0 — 2026-03-XX

- Lanzamiento inicial
- Grafo D3.js interactivo con jerarquías y dependencias
- Editor de tareas con métricas en cascada
- Diagrama Gantt con camino crítico
- Guardado automático en localStorage + exportación JSON
- Filtros, búsqueda y barra lateral colapsable

---

## Estructura del proyecto

```
GraphMind/
├── index.html                  # Punto de entrada
├── css/                        # Estilos globales (tokens, reset, layout)
├── js/
│   ├── defaults.js             # Versión y configuración por defecto
│   ├── state.js                # Estado global (S, CFG)
│   ├── crud.js                 # Crear / actualizar / eliminar nodos
│   ├── aggregation.js          # Métricas en cascada y camino crítico
│   ├── storage.js              # localStorage + exportación/importación JSON
│   ├── markdown.js             # Helper renderMd() + runMermaid()
│   ├── ui.js                   # Helpers UI (indicadores, temas)
│   ├── init.js                 # Inicialización de listeners
│   └── loader.js               # Carga de partials HTML + arranque
├── i18n/
│   ├── engine.js               # Motor i18n: t(), setLocale(), applyTranslations()
│   ├── es/                     # Strings en español (8 namespaces)
│   └── en/                     # Strings en inglés (8 namespaces)
└── components/
    ├── topbar/                 # Barra superior + navegación
    ├── sidebar/                # Lista de tareas + filtros
    ├── editor/                 # Editor de tarea + comentarios
    ├── graph/                  # Vista grafo D3.js
    ├── gantt/                  # Vista Gantt canvas
    ├── config/                 # Panel de configuración
    ├── help/                   # Ayuda (es.md, en.md, help.js)
    └── modals/                 # Modales (conexión, IO)
```

---

## Licencia

MIT — libre para usar, modificar y distribuir.
