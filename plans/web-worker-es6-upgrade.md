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

### Phase 4: ✅ Dagre Worker ES6 Conversion (COMPLETED)
- ✅ **Step 4.1**: Convert dagre worker to ES6 modules
  - Uses CDN imports for d3-dispatch and @dagrejs/dagre
  - Upgraded to modern @dagrejs/dagre package (v1.1.5) instead of legacy dagre
  - Sets up minimal global scope for d3.dispatch compatibility
- ✅ **Step 4.2**: Resolve import map conflicts
  - **Solution**: Rollup-plugin-replace to transform @dagrejs/dagre import to CDN URL (same architecture as cola worker)
  - Source uses clean ES6 import: `import * as dagre from '@dagrejs/dagre';`
  - Worker build transforms to: `https://cdn.jsdelivr.net/npm/@dagrejs/dagre@1.1.5/+esm`
- ✅ **Step 4.3**: Test dagre worker functionality
  - Worker loads successfully with modern package
  - Same clean rollup-replace architecture as cola worker
  - Compatible with all existing functionality

### Phase 5: Convert Remaining Workers (NEXT)
- ⏸️ **PENDING**: Convert d3v4-force worker
- ⏸️ **PENDING**: Convert dynagraph worker

### Phase 6: Final Testing (BLOCKED - requires Phase 5 completion)
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

## Key Learnings

### Technical Solutions Discovered

1. **Rollup-Plugin-Replace Pattern**: The most elegant solution for web worker ES6 conversion
   - Clean source code with standard ES6 imports
   - Build-time transformation to CDN URLs for worker context
   - No runtime complexity or global variable pollution
   - Works perfectly for both cola and dagre workers

2. **Package Modernization**: Checking for modern ES6-native packages pays off
   - @dagrejs/dagre (v1.1.5) is superior to legacy dagre package
   - Native ES6 modules eliminate fetch/eval workarounds
   - Modern packages often have better browser compatibility

3. **Global Scope Setup**: Minimal global scope setup for legacy library compatibility
   - Only expose what's absolutely necessary (e.g., `globalThis.d3.dispatch`)
   - Prefer build-time solutions over runtime global assignments

### Architecture Patterns

- **Best Practice**: Use rollup-plugin-replace for build-time import transformation
- **Fallback**: Use fetch/eval for UMD packages that don't work with ES6 imports
- **Upgrade Path**: Always check for modern package versions before implementing workarounds

## Benefits
- Cleaner, more maintainable code
- Better development experience
- Explicit dependency management
- Smaller, more efficient bundles
- Elimination of complex concatenation builds
- Consistent architecture across all workers