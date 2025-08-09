# Lint Configuration Management Plan

## Current Challenge

The dc.graph.js project has extensive lists of files that need to be managed across multiple configuration files (package.json, lint-staged, etc.). Currently we have 26+ native JavaScript files that should be linted, scattered across long, unwieldy configuration lines.

**Current approach problems:**
- Long, hard-to-read brace expansion patterns like `{simple-viewer,brushing-filtering,compare-layouts,...,timeline}.js`
- Difficult to add/remove files
- Easy to make typos
- Configuration duplicated across multiple places

## Proposed Solutions

### Option 1: External Configuration File

Create `.lintstagedrc.js`:
```javascript
// Define file lists in one place
const nativeWebFiles = [
  // Demo scripts
  'simple-viewer', 'brushing-filtering', 'compare-layouts', 'explore',
  'flexbox', 'match-game', 'network-building', 'random', 'resizing',
  'shapes-and-text', 'drag-drop-composition', 'app_layout', 'arrow-designer',
  'ceph_layout', 'qfs_layout', 'vfc_layout', 'dynagraph-main',
  
  // Utilities  
  'graph-error', 'sync-url-options', 'querystring', 'example-header',
  'dc.graph.tracker.domain', 'parse-incrface', 'index', 
  
  // Root-vendored files
  'chart.registry', 'd3.flexdivs', 'timeline'
].map(name => `web/js/${name}.js`)

const rootVendoredFiles = [
  'sync-url-options.js', 'querystring.js', 'chart.registry.js', 
  'd3.flexdivs.js', 'dc.graph.tracker.domain.js', 'timeline.js'
]

module.exports = {
  'src/**/*.js': ['eslint --fix', 'dprint fmt'],
  '*.config.js': ['eslint --fix', 'dprint fmt'], 
  'scripts/**/*.js': ['eslint --fix', 'dprint fmt'],
  [nativeWebFiles]: ['eslint --fix', 'dprint fmt'],
  'web/**/*.html': ['prettier --write']
}
```

Update `package.json`:
```json
{
  "scripts": {
    "vendor": "cp ${rootVendoredFiles.join(' ')} web/js/ && cp dc.graph.css web/css/ && cp incrface.mjs web/js/",
    "lint:web": "eslint ${nativeWebFiles.join(' ')} --fix"
  }
}
```

### Option 2: Smart Glob Patterns with .eslintignore

Create `.eslintignore`:
```
# Vendored third-party libraries  
web/js/jquery*.js
web/js/cola.js
web/js/dagre.js
web/js/viz.js
web/js/d3-tip.js
web/js/bootstrap.js
web/js/colorbrewer.js
web/js/queue.js
web/js/*polyfill*.js
web/js/jqueryui-*.js
web/js/lysenko-interval-tree.js

# Generated files
web/js/dc-graph.js
web/js/dc-graph.js.map
web/js/*.worker.js
web/js/*.worker.js.map

# Compiled/special files
web/js/dynagraph.mjs
web/js/incrface.mjs
web/js/graphlib-dot*.js
web/js/d3.flexdivs.js
web/js/metagraph.js
web/js/css-layout.js
```

Simplify package.json:
```json
{
  "scripts": {
    "lint:web": "eslint 'web/js/*.js' --fix"
  },
  "lint-staged": {
    "web/js/*.js": ["eslint --fix", "dprint fmt"]
  }
}
```

### Option 3: Categorized Directory Structure (Future)

Reorganize web/js/ into subdirectories:
```
web/js/
├── native/          # Our files (linted)
│   ├── demos/
│   ├── utils/
│   └── root-vendored/
├── vendored/        # Third-party (not linted)
└── generated/       # Build outputs (not linted)
```

Then: `"lint:web": "eslint 'web/js/native/**/*.js' --fix"`

### Option 4: Build-time File List Generation

Create `scripts/generate-lint-config.js`:
```javascript
// Automatically detect which files should be linted based on:
// - File headers/comments
// - Import patterns
// - Absence from known vendored list
// Generate configuration dynamically
```

## Recommendation: Option 1 (External Config)

**Benefits:**
- Centralized file management
- Easy to read and maintain
- Can reuse lists across different tools
- Supports comments for categorization
- Works with existing toolchain

**Implementation Steps:**
1. Create `.lintstagedrc.js` with file lists
2. Remove lint-staged from package.json 
3. Update npm scripts to use shared lists
4. Test that all files are still linted correctly

**Long-term Enhancement:**
Consider Option 3 (directory restructuring) during the rollup demo generation migration to naturally separate native vs vendored files.

## File Lists for Reference

**Native files to lint (26 files):**
- **Demo scripts (17):** simple-viewer, brushing-filtering, compare-layouts, explore, flexbox, match-game, network-building, random, resizing, shapes-and-text, drag-drop-composition, app_layout, arrow-designer, ceph_layout, qfs_layout, vfc_layout, dynagraph-main
- **Utilities (6):** graph-error, sync-url-options, querystring, example-header, dc.graph.tracker.domain, parse-incrface, index  
- **Root-vendored (3):** chart.registry, d3.flexdivs, timeline

**Vendored files to exclude:**
- Third-party libraries: jquery, cola, dagre, viz, d3-tip, bootstrap, etc.
- Generated: dc-graph.js, workers, source maps
- Compiled: dynagraph.mjs, incrface.mjs, graphlib-dot