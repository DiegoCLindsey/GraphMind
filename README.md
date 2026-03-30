# ⬡ GraphMind

> Gestor de proyectos visual basado en teoría de grafos — HTML autocontenido, sin servidor, sin suscripción.

[![version](https://img.shields.io/badge/version-1.6.0-6ee7b7?style=flat-square&labelColor=111)](https://github.com/DiegoCLindsey/GraphMind/releases/tag/v1.6.0)
[![license](https://img.shields.io/badge/license-CC%20BY%204.0-a78bfa?style=flat-square&labelColor=111)](https://creativecommons.org/licenses/by/4.0/)
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

### v1.6.0 — 2026-03-30

- **Planificador avanzado de tiempo (GMND-062/063)** — calendario laboral configurable: días de la semana, horario de entrada/salida y horas por jornada; duración de tareas en horas de trabajo en lugar de días; cálculo de fechas saltando fines de semana y días no laborables
- **Barras Gantt segmentadas** — cada tarea se dibuja como bloques independientes por día trabajado; los fines de semana y festivos quedan visualmente libres
- **Festivos y vacaciones** — lista global de días no laborables + festivos personales por asignado; se combinan automáticamente al calcular fechas
- **Calendario por asignado (Modo +)** — override completo: días de la semana, horario y festivos propios; las flechas de dependencia apuntan exactamente al inicio del segmento destino
- **Selector de vista de calendario en Gantt** — desplegable «Vista cal.» para ver el sombreado de horas/días según el calendario global, el de un asignado concreto o sin filtro
- **Correcciones de cálculo** — `recalcAllBlockedDates` ahora cubre tareas con `workHours`; `startHour` se propaga correctamente a `workHoursToEnd`; recalculo de fechas bloqueadas en el arranque

### v1.5.0 — 2026-03-30

- **Archivar vértices (GMND-061)** — botón ⧁ Archivar en la barra de estado del editor; toggle ⧁ en el sidebar para mostrar/ocultar archivados; las tareas archivadas se muestran con una etiqueta `archivado` y se ocultan del grafo y del Gantt por defecto
- **Duplicar tareas (GMND-060)** — botón ⧉ Duplicar en el editor y modo batch en el selector de sidebar; copia el subgrafo de sus relaciones internas manteniendo las conexiones entre nodos seleccionados; nombre original + `(cp)`
- **Fracciones de duración en Gantt** — las barras ahora respetan valores fraccionarios de días (ej. `0.5d` = media barra); ya no se redondea al entero más cercano en el canvas
- **Corrección de fecha en Gantt** — `daysBetween` usa `Math.round` en lugar de `Math.floor` para evitar el desplazamiento de ±1 día causado por el cambio de hora de verano (DST)
- **Versión consistente** — `APP_VERSION`, `<title>`, README, ficheros de ayuda y todos los badges actualizados a `1.4.0`

### v1.3.0 — 2026-03-26

- **Desglosar tarea (GMND-050)** — panel modal para crear subtareas en lote: breadcrumb de ancestros, entradas numeradas, Enter para avanzar, crea N hijos enlazados a toda la cadena padre-abuelo en un clic
- **Gantt interactivo (GMND-051)** — amplia mejora de la vista Gantt:
  - Botón **🔒 Edición** que habilita/deshabilita las interacciones de escritura (evita cambios accidentales)
  - **Click en fila vacía** para asignar fecha de inicio (cursor `cell` como pista visual)
  - **Arrastre del borde derecho** de una barra para redimensionar la fecha de fin (cursor `ew-resize`, indicador visual en el borde, soporte táctil)
  - **Arrastrar para desplazar** (pan) en área vacía del canvas — escritorio y móvil
  - **Centrado automático en Hoy** al abrir la pestaña Gantt
  - Rango por defecto `hoy − 7d → hoy + 30d` para que los nodos sin fecha siempre sean visibles y editables
  - Deduplicación de filas en vista jerarquía (nodos con varios padres ya no aparecen varias veces)
  - Botón ▼ DETALLES visible también en escritorio
- **Caminos críticos múltiples** — `computeCriticalPath()` calcula un camino crítico independiente por componente conexa (un camino por proyecto), en lugar de uno único global
- **Propagación de fechas en cascada** — al editar la fecha de inicio/fin de una tarea hija, los nodos padre actualizan su `start`/`end` inmediatamente (sin necesidad de pulsar ↻ Recalcular)
- **Validación de fechas** — fecha fin se bloquea por debajo de fecha inicio (flash rojo); duración y fecha fin se sincronizan bidireccionalmente: cambiar días recalcula fin y cambiar fin recalcula días

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

## Incoming updates

Funcionalidades planificadas para las próximas versiones, en orden de prioridad:

| # | Feature | Descripción |
|---|---|---|
| 1 | **Eliminar con cascada** | Al borrar una tarea padre aparece un diálogo de confirmación con checkbox "Borrar también las subtareas" (desactivado por defecto). Sin cascada: se elimina solo el padre y los hijos pierden esa conexión. Con cascada: se elimina todo el subárbol recursivamente. |
| 2 | **Pizarras** | Múltiples pizarras independientes (nodos y tagColorMap propios) con configuración global compartida. Selector en la topbar. Export normal (v1.3+) incluye wrapper `boards[]`; export legado (v1.2.x) genera el formato plano antiguo para retrocompatibilidad. Import detecta automáticamente el formato y migra al nuevo si es necesario. |
| 3 | **Equipos y capacidad** | Gestión de equipos con miembros y capacidad individual (horas/día). Nuevo tab "Equipos" en Config. El campo Asignado pasa a ser autocomplete contra los miembros. Vista de carga: tabla miembro × semana con horas planificadas vs. capacidad. |
| 4 | **Cloud save (GitHub Gist)** | Guardado en la nube via GitHub Gist API. Token PAT (scope `gist`) introducido en Config → "Nube". Todas las pizarras se guardan en un único Gist como un JSON. Toggle de auto-sync opcional. |
| 5 | **Drag Gantt (mover barra)** | Arrastrar el cuerpo completo de una barra para desplazar `start` + `end` manteniendo la duración. Diferenciado del stretch por zona de agarre (centro vs. borde derecho). |

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

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

Eres libre de usar, copiar, modificar y distribuir este proyecto, incluso con fines comerciales, siempre que se incluya atribución al autor original.
