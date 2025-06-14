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

The project uses Grunt for building. Key commands:

```bash
# Build the library (concatenates source files)
grunt build

# Build and copy assets to web directory  
grunt copy

# Run development server with live reload on port 8888
grunt server

# Generate documentation
grunt docs

# Run linting
grunt lint

# Build minified version
grunt uglify
```

**Build outputs:**
- `dc.graph.js` - main library file (concatenated from src/ files in order defined in Gruntfile.js)
- `dc.graph.min.js` - minified version
- `dc.graph.*.worker.js` - web worker files for different layout engines
- Files are also copied to `web/js/` for examples

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

Layout computation can be offloaded to web workers for performance. Worker files are built by concatenating specific source files:
- Each layout has a corresponding worker file (e.g., `dc.graph.cola.worker.js`)
- Workers include: `core.js`, `generate_objects.js`, `graphviz_attrs.js`, layout file, `webworker_message.js`

## Examples and Testing

- Example files in `web/` directory demonstrate various features
- No automated test suite - examples serve as integration tests
- `grunt server` runs local development server for testing examples

## Dependencies

**Runtime dependencies:**
- D3 v3 (core visualization)
- dc.js ~2.1.0 (chart integration) 
- crossfilter2 (data filtering)
- Various layout libraries: webcola, dagre, viz.js

**Note:** Project is based on older D3 v3 and is not actively maintained but still functional.

## Development Notes

- Use gtimeout because we're on a mac
- Use `npx grunt server` for this repo

## Claude Memories

- please remove trailing whitespace from your edits