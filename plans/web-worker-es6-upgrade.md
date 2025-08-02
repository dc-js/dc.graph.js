# Web Worker ES6 Module Upgrade

## Overview
This document outlines the plan to modernize the web worker implementation in dc.graph.js to use native ES6 modules instead of the current file concatenation approach.

## Current State
- Workers are built by concatenating source files using Rollup
- Each layout has a corresponding worker file (e.g., `dc.graph.cola.worker.js`)
- Workers include: `core.js`, `generate_objects.js`, `graphviz_attrs.js`, layout file, `webworker_message.js`
- Build process defined in `worker.rollup.config.js`

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

### 1. Convert Worker Creation
```javascript
// Current
const worker = new Worker('dc.graph.cola.worker.js');

// Target
const worker = new Worker('dc.graph.cola.worker.js', { type: 'module' });
```

### 2. Refactor Worker Files
Convert from concatenated scripts to ES6 modules:
```javascript
// Inside worker file
import { dc_graph } from './core.js';
import { generate_objects } from './generate_objects.js';
import { cola_layout } from './cola_layout.js';
```

### 3. Update Build Process
- Remove worker-specific Rollup configs
- Update main build to handle worker module references
- Simplify `package.json` scripts

### 4. Testing
- Verify all layout workers function correctly
- Test with various example files
- Ensure performance is maintained

## Files to Modify
- All `*.worker.js` files
- Worker creation code in main library
- `worker.rollup.config.js` (remove)
- `package.json` build scripts

## Prerequisites
- Complete D3 v5.8 / dc.js v4 upgrade first
- Ensure main library is stable with new dependencies
- All examples working with current worker approach

## Benefits
- Cleaner, more maintainable code
- Better development experience
- Explicit dependency management
- Smaller, more efficient bundles
- Elimination of complex concatenation builds