# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

dc.graph.js is a JavaScript library for dynamic, interactive graph visualization using D3.js. It provides network diagram capabilities that integrate with dc.js crossfilter charts. The library supports multiple graph layout engines and offers various interaction modes including drawing, editing, exploring, selection, brushing and filtering.

**Key Architecture:**
- Built on D3 v3 with compatibility layer for dc.js charts
- Core diagram component (`dc_graph.diagram`) in `src/diagram.js` - main entry point for all visualizations
- Modular layout system supporting WebCola, dagre, d3-force, graphviz, and flexbox layouts
- Web worker support for computationally intensive layouts (files ending in `.worker.js`)
- Plugin-based interaction system with modes for selection, editing, highlighting, etc.

## Commit Message Guidelines

- Prefix all commit messages with "claude: "

## Build System

The project uses npm scripts with Rollup for building. Key commands:

```bash
# Build the library (bundles ES6 modules with Rollup)
npm run build

# Build and watch for changes during development
npm run dev

# Run development server on port 8888
npm run serve

# Build and start development server
npm start
```

**Build outputs:**
- `dist/dc-graph.js` - main library file (ES6 modules bundled with Rollup)
- `dist/dc-graph.js.map` - source map
- `dc.graph.*.worker.js` - web worker files for different layout engines
- **Files automatically copied to `web/js/` via rollup copy plugin**

## Source Architecture 

**Core files (loaded in this order):**
- `src/core.js` - Global namespace, utility functions, property system
- `src/diagram.js` - Main diagram class, rendering, interaction management
- `src/engine.js` - Layout engine abstraction layer
- `src/render_svg.js` / `src/render_webgl.js` - Rendering backends

**Layout engines** (`src/*_layout.js`):
- `cola_layout.js` - WebCola constraint-based layout
- `dagre_layout.js` - Dagre hierarchical layout  
- `d3_force_layout.js` / `d3v4_force_layout.js` - Force-directed layouts
- `graphviz_layout.js` - Graphviz integration via viz.js
- `flexbox_layout.js` - CSS flexbox-based layout

**Interaction modes** (src/ files with prefixes):
- `select_*` - Selection behaviors for nodes/edges/ports
- `highlight_*` - Highlighting behaviors (neighbors, paths, radius)
- `draw_*` - Drawing and editing modes
- `expand_collapse.js` - Collapsible node groups

**Data processing:**
- `generate_objects.js` - Converts crossfilter data to graph objects
- `munge_graph.js` - Graph data transformation utilities
- `validate.js` - Graph data validation

## Web Workers

Layout computation can be offloaded to web workers for performance:
- Each layout has a corresponding worker file (e.g., `dc.graph.cola.worker.js`)
- Workers are built from source files in `src/workers/` using ES modules
- Worker files import layout functions directly and use shared `worker_common.js` for message handling

## Examples and Testing

- Example files in `web/` directory demonstrate various features
- No automated test suite - examples serve as integration tests
- `npm run serve` runs local development server for testing examples

## Dependencies

**Runtime dependencies:**
- D3 v3 (core visualization) - migrating to D3 v5.16.0
- dc.js 4.0.5 (chart integration) - IMPORTANT: Use 4.0.5, not newer versions
- crossfilter2 (data filtering)
- Various layout libraries: webcola, dagre, viz.js

**Note:** Project is being migrated from D3 v3 to D3 v5. Currently using dc.js 4.0.5 for compatibility.

## Development Notes

- Use gtimeout because we're on a mac
- Use `npm run serve` for development server

## D3 v5 Migration Rules

**Dispatch API Changes**: In D3 v3→v5, dispatch calls changed from `dispatch.eventName(args...)` to `dispatch.call('eventName', thisArg, args...)`. Always use `null` as the thisArg parameter.

- ❌ D3 v3: `dispatch.selected(data)`
- ✅ D3 v5: `dispatch.call('selected', null, data)`

**Event Handling Issues**: 
- TODO: SVG mouseup events aren't firing properly in D3 v5 - temporarily using click events for node creation in draw_graphs.js
- Event handling may need further investigation for full mouse interaction compatibility

## Claude Memories

- please remove trailing whitespace from your edits
- **Testing workflow**: Gordon runs a dev server with auto-build/reload, so usually no need to manually build. But `npm run build` is safe if needed (rollup copy plugin updates web/js/ automatically)
- be terse and avoid purple prose in commit messages
- do not check artifacts into the repo
- yes but please stop adding useless comments
- use arrow functions wherever possible
- remember to user jsdelivr for d3 imports
- use conditional chaining
- always use let and const not var

- don't run npm start, gordon will do that