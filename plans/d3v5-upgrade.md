# D3 v5 Example Upgrade Guide

## Overview
This document outlines the process for upgrading HTML examples from D3 v3 script tags to D3 v5 ES6 modules with importmaps.

## Current Status

### ✅ Completed Examples (10)
Examples already converted to D3 v5 with importmaps:
- explore.html
- drag-drop-composition.html  
- compare-layouts.html
- index.html
- brushing-filtering.html
- random.html
- simple-viewer.html
- network-building.html
- arrow-designer.html
- **match-game.html** (just completed)

### 🔄 Remaining Examples (3)
Examples still using D3 v3 script tags that need conversion:
1. **flexbox.html** (Least complex - minimal dependencies)
2. **shapes-and-text.html** (Medium complexity - multiple layout engines)  
3. **resizing.html** (High complexity - multiple layout engines, dynamic resizing, URL sync)

### 🗑️ Removed Examples (2)
- collapse-equivalent-subgraphs.html (deleted - no test data)
- original-test-page.html (deleted per user request)

## Upgrade Process

### Step 1: HTML Changes
Replace D3 v3 script tags with ES6 importmap:

**Remove:**
```html
<script type="text/javascript" src="js/d3.js"></script>
<script type="text/javascript" src="js/crossfilter.js"></script>
<script type="text/javascript" src="js/dc.js"></script>
<script type="text/javascript" src="js/lodash.js"></script>
```

**Add:**
```html
<script type="importmap">
{
  "imports": {
    "d3": "https://cdn.jsdelivr.net/npm/d3@5.16.0/+esm",
    "d3-array": "https://cdn.jsdelivr.net/npm/d3-array@1.2.4/+esm",
    "d3-collection": "https://cdn.jsdelivr.net/npm/d3-collection@1.0.7/+esm",
    "d3-scale": "https://cdn.jsdelivr.net/npm/d3-scale@2.2.2/+esm",
    "d3-selection": "https://cdn.jsdelivr.net/npm/d3-selection@1.4.2/+esm",
    "crossfilter2": "https://cdn.jsdelivr.net/npm/crossfilter2@1.5.4/+esm",
    "dc": "https://cdn.jsdelivr.net/npm/dc@4.0.5/+esm",
    "lodash": "https://cdn.jsdelivr.net/npm/lodash@4.17.21/+esm"
  }
}
</script>
```

### Step 2: Common Additional Dependencies

**For flexbox examples:**
```html
"yoga-layout": "https://cdn.jsdelivr.net/npm/yoga-layout@1.10.0/+esm"
```

**For examples with tooltips:**
```html
"tippy.js": "https://cdn.jsdelivr.net/npm/tippy.js@6.3.7/+esm"
```

**For examples with multiple layout engines:**
```html
"webcola": "https://cdn.jsdelivr.net/npm/webcola@3.4.0/+esm",
"dagre": "https://cdn.jsdelivr.net/npm/dagre@0.8.5/+esm"
```

### Step 3: JavaScript File Updates

**Add specific imports at top of .js file:**
```javascript
import { range } from 'd3-array';           // for d3.range usage
import { renderAll } from 'dc';             // for dc.renderAll() usage
import { scaleOrdinal } from 'd3-scale';    // for d3.scaleOrdinal usage
```

**Update function calls:**
```javascript
// Before
d3.range(10)
dc.renderAll()

// After  
range(10)
renderAll()
```

### Step 4: Module Loading Issues

**Remove conflicting script tags:**
- Remove `querystring.js` from script tags if importing as module
- Keep jQuery/jQuery UI as script tags (not ES6 modules)
- Keep chart.registry.js as script tag

**Handle global dependencies:**
- querystring: Import as `import querystring from './querystring.js'`
- Other utilities: Import as needed from dc-graph.js

### Step 5: Common Error Patterns & Fixes

**"Unexpected token 'export'" Error:**
- Cause: File has `export` but loaded as regular script
- Fix: Either import as module OR remove from script tags

**"Failed to resolve module specifier" Error:**
- Cause: Missing dependency in importmap
- Fix: Add missing package to importmap

**"X is not a function" Error:**
- Cause: Global variable not available, need specific import
- Fix: Import specific function from appropriate D3 sub-package

## Package Versions (Tested & Working)

```json
{
  "d3": "5.16.0",
  "d3-array": "1.2.4", 
  "d3-collection": "1.0.7",
  "d3-scale": "2.2.2",
  "d3-selection": "1.4.2",
  "crossfilter2": "1.5.4",
  "dc": "4.0.5",
  "lodash": "4.17.21",
  "yoga-layout": "1.10.0",
  "tippy.js": "6.3.7",
  "webcola": "3.4.0",
  "dagre": "0.8.5"
}
```

## Testing Checklist

For each converted example:
- [ ] Page loads without console errors
- [ ] Graph renders correctly 
- [ ] Interactions work (hover, click, etc.)
- [ ] Layout algorithms function properly
- [ ] No "Failed to resolve module" errors
- [ ] No "Unexpected token export" errors

## Notes

- **Always rebuild library** after making source changes: `npm run build && cp dist/dc-graph.* web/js/`
- **Order matters**: Convert examples from least to most complex to build confidence
- **Module conflicts**: ES6 modules and script tags don't mix - pick one approach per dependency
- **D3 v5 compatibility**: Use specific sub-package imports, not the full D3 bundle where possible

## Next Steps

1. Convert flexbox.html (simple case)
2. Convert shapes-and-text.html (medium complexity)  
3. Convert resizing.html (most complex)
4. Update this document with any new patterns discovered