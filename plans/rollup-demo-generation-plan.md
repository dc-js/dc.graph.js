# Rollup-Based Demo Generation Plan

## Overview

Currently, dc.graph.js demos are built with a mixed approach: source files edited directly in `web/js/` with manually maintained HTML files containing duplicate import maps. This plan outlines a migration to a Rollup-based system that generates both demo JavaScript and HTML files from centralized sources.

## Current State Analysis

### Demo Structure
- **13 HTML demos** in `web/*.html` (simple-viewer, brushing-filtering, explore, etc.)
- **Native demo scripts**: `simple-viewer.js`, `brushing-filtering.js`, `compare-layouts.js`, `explore.js`, `graph-error.js`
- **Vendored libraries**: cola.js, dagre.js, viz.js, jquery.js, etc. (should not be linted)
- **Import maps duplicated** across all 13 HTML files with 90%+ consistency

### Import Map Patterns
**Core imports (100% consistent across demos):**
```json
{
  "d3": "https://cdn.jsdelivr.net/npm/d3@5.16.0/+esm",
  "dc": "https://cdn.jsdelivr.net/npm/dc@4.0.5/+esm", 
  "crossfilter2": "https://cdn.jsdelivr.net/npm/crossfilter2@1.5.4/+esm",
  "@dagrejs/dagre": "https://cdn.jsdelivr.net/npm/@dagrejs/dagre@1.1.5/+esm",
  "@dagrejs/graphlib-dot": "https://cdn.jsdelivr.net/npm/@dagrejs/graphlib-dot@1.0.2/+esm"
}
```

**Common imports (80%+ consistent):**
- d3-selection, d3-scale, d3-collection, tippy.js

**Demo-specific imports:**
- Layout engines: yoga-layout (flexbox only), webcola, dagre, viz.js
- D3 modules: d3-fetch, d3-shape, d3-scale-chromatic
- Local utilities: querystring

## Proposed Architecture

### Option 1: Source-First with Rollup Generation
```
src/demos/
├── simple-viewer/
│   ├── index.js           # Demo entry point
│   ├── template.html      # HTML template
│   └── config.json        # Demo-specific imports & metadata
├── brushing-filtering/
│   ├── index.js
│   ├── template.html  
│   └── config.json
└── shared/
    ├── base-imports.json  # Core import map
    ├── base.html          # Base HTML template
    └── common.css         # Shared styles
```

**Generated output:**
```
web/
├── simple-viewer.html     # Generated from template + imports
├── simple-viewer.js       # Processed through Rollup
├── brushing-filtering.html
├── brushing-filtering.js
└── js/                    # Vendored files remain
    ├── cola.js
    ├── jquery.js
    └── dc-graph.js        # Main library
```

### Rollup Configuration

**Demo Build Config (`rollup.demos.config.js`):**
```javascript
import html from '@rollup/plugin-html'
import { generateImportMap } from './plugins/import-map-generator.js'

const demos = ['simple-viewer', 'brushing-filtering', 'explore', 'compare-layouts']

export default demos.map(demo => ({
  input: `src/demos/${demo}/index.js`,
  output: {
    file: `web/${demo}.js`,
    format: 'es'
  },
  external: ['d3', 'dc', 'crossfilter2'], // Don't bundle CDN imports
  plugins: [
    generateImportMap({
      base: 'src/demos/shared/base-imports.json',
      demo: `src/demos/${demo}/config.json`
    }),
    html({
      template: ({ files, meta }) => generateHtmlFromTemplate(
        `src/demos/${demo}/template.html`,
        meta.importMap,
        files
      ),
      fileName: `${demo}.html`
    })
  ]
}))
```

**Import Map Generator Plugin:**
```javascript
function generateImportMap({ base, demo }) {
  return {
    name: 'import-map-generator',
    generateBundle(options, bundle) {
      const baseImports = JSON.parse(readFileSync(base))
      const demoImports = JSON.parse(readFileSync(demo)) 
      
      const merged = {
        imports: { ...baseImports.imports, ...demoImports.imports }
      }
      
      this.emitFile({
        type: 'asset',
        fileName: 'import-map.json',
        source: JSON.stringify(merged, null, 2)
      })
      
      // Make available to HTML template
      bundle.importMap = merged
    }
  }
}
```

## Implementation Plan

### Phase 1: Infrastructure Setup
1. **Create demo source structure** in `src/demos/`
2. **Extract common import map** to `src/demos/shared/base-imports.json`
3. **Build import map generator plugin**
4. **Create HTML template system**

### Phase 2: Demo Migration (One at a time)
1. **Start with simple-viewer** (simplest demo)
2. **Move `web/js/simple-viewer.js` → `src/demos/simple-viewer/index.js`**
3. **Extract template from `web/simple-viewer.html`**
4. **Configure demo-specific imports**
5. **Test generation produces identical output**
6. **Repeat for each demo**

### Phase 3: Build Integration
1. **Update npm scripts:**
   ```json
   {
     "build:demos": "rollup -c rollup.demos.config.js",
     "build:all": "npm run build && npm run build:demos",
     "dev:demos": "rollup -c rollup.demos.config.js -w"
   }
   ```
2. **Update lint-staged to include `src/demos/`**
3. **Configure dev server to serve generated files**

### Phase 4: Cleanup & Optimization
1. **Remove duplicate import maps from version control**
2. **Add validation to ensure import map consistency**  
3. **Consider CSS extraction and optimization**
4. **Document new workflow**

## Benefits

### Immediate
- **Single source of truth** for import maps
- **Version consistency** automatically enforced
- **Reduced duplication** across 13 HTML files
- **Proper source/build separation**

### Long-term  
- **Template-based HTML generation** enables global layout changes
- **Rollup optimizations** (tree-shaking, code splitting)
- **Asset hashing** for cache busting
- **Development server integration** with HMR
- **Easier demo creation** - copy template, configure imports

## Risks & Mitigation

### Build Complexity
- **Risk**: More complex build system
- **Mitigation**: Phase rollout, maintain old system until stable

### Development Workflow Changes
- **Risk**: Developers editing wrong files
- **Mitigation**: Clear documentation, linting rules, file organization

### Import Resolution Issues  
- **Risk**: External imports not resolving correctly
- **Mitigation**: Extensive testing, rollup external configuration

## Success Criteria

1. **All 13 demos generate identical HTML/JS** compared to current manual system
2. **Single import map change** updates all relevant demos
3. **New demo creation** requires only source files, no manual HTML editing  
4. **Build performance** remains acceptable (<30s for full demo build)
5. **Development workflow** remains smooth with watch/reload

## Timeline Estimate

- **Phase 1**: 1-2 days (infrastructure)
- **Phase 2**: 3-4 days (migrate 5 main demos)  
- **Phase 3**: 1 day (build integration)
- **Phase 4**: 1 day (cleanup)

**Total: ~1 week** for complete migration

## Future Enhancements

- **Vite migration** for better dev experience
- **Component-based templates** (shared header/footer)
- **CSS preprocessing** integration
- **Bundle analysis** and optimization
- **Static site generation** for GitHub Pages