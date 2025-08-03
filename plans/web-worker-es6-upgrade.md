# Web Worker ES6 Module Upgrade

## Overview
This document outlines the plan to modernize the web worker implementation in dc.graph.js to use native ES6 modules instead of the current file concatenation approach.

## Current State
- Workers are built using Rollup with ES6 modules as input (src/workers/*.js)
- Each layout has a corresponding worker file built to root directory (e.g., `dc.graph.cola.worker.js`)
- Workers use importScripts() to load dependencies (d3.js, cola.js, etc.) in banner
- Build process defined in `worker.rollup.config.js`
- Worker files use IIFE format, not true ES6 modules yet
- ✅ **Fixed**: Workers now integrated with rollup copy plugin
- ✅ **Fixed**: Workers now build automatically with `npm run build` and `npm run dev`

## Target State
- Workers use native ES6 modules with `{ type: 'module' }`
- Direct imports from modular source files
- Eliminate concatenation-based builds
- Cleaner dependency management

## Browser Support
As of 2024, all modern browsers support module workers:
- Chrome: Since v80 (Feb 2020)
- Safari: Since v15
- Firefox: Since July 2024

## Implementation Plan

### Phase 1: ✅ Update Build Process (COMPLETED)
- ✅ **Step 1.1**: Integrate workers with rollup copy plugin
- ✅ **Step 1.2**: Integrate with main build commands
- ✅ Workers now build automatically with `npm run build` and `npm run dev`

### Phase 2: ✅ Convert Worker Creation (COMPLETED)
- ✅ Updated webworker_layout.js to use `{ type: 'module' }`
- ✅ Workers now load as ES6 modules

### Phase 3: ✅ Cola Worker ES6 Conversion (COMPLETED)
- ✅ **Step 3.1**: Convert cola worker to ES6 modules
  - Uses CDN imports for d3-dispatch, d3-selection, webcola
  - Sets up global scope compatibility for WebCola
- ✅ **Step 3.2**: Resolve d3-dispatch import conflicts
  - **Solution**: Rollup-plugin-replace to transform dispatch usage at build time
  - Comments out ES6 import: `import { dispatch } from 'd3-dispatch';`
  - Replaces usage with: `globalThis.d3.dispatch`
- ✅ **Step 3.3**: Test cola worker functionality
  - Worker loads successfully without errors
  - Compatible with simple-viewer.html

### Phase 4: Convert Remaining Workers (NEXT)
- 🔄 **CURRENT**: Convert dagre worker to ES6 modules
- ⏸️ **PENDING**: Convert d3v4-force worker (after dagre)
- ⏸️ **PENDING**: Convert dynagraph worker (after d3v4-force)

### Phase 5: Final Testing (BLOCKED - requires Phase 4 completion)
- Test all workers with various example files
- Ensure performance is maintained

## Files to Modify
- All `*.worker.js` files
- Worker creation code in main library
- `worker.rollup.config.js` (remove)
- `package.json` build scripts

## Prerequisites  
- ✅ Complete D3 v5 / dc.js v4 upgrade first
- ✅ Ensure main library is stable with new dependencies  
- ✅ All examples working with current worker approach
- Test current worker functionality before upgrade

## Benefits
- Cleaner, more maintainable code
- Better development experience
- Explicit dependency management
- Smaller, more efficient bundles
- Elimination of complex concatenation builds