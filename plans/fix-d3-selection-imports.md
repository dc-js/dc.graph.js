# Fix D3 Selection Import Issues for .join() Support

## Problem Statement

D3 version conflicts between the main bundle (`d3@5.8.0`) and individual modules (`d3-selection@1.4.2`) are preventing `.join()` method from being available. The join() syntax was introduced in D3 v5.8.0, but modular imports are resolving to incompatible versions.

## Root Cause

- D3 v5.8.0 bundle includes d3-selection with `.join()` support
- But `import { select } from 'd3-selection'` resolves to standalone modules that may not match
- Version conflicts cause selections to lack the `.join()` method
- Browser error: `TypeError: modernRoot.selectAll(...).data(...).join is not a function`

## Solution Strategy

**Switch from modular d3-selection imports to D3 bundle imports** for all files that use `.join()`.

This ensures consistent D3 version and avoids module resolution conflicts.

## Files Requiring Changes

### High Priority - Files Using Both `select` and `.join()`

1. **src/render_svg.js** ⭐ CRITICAL
   - Imports: `select, selectAll` from d3-selection
   - Uses: 19 instances of `.join()` in complex SVG rendering
   - Impact: Core rendering functionality

### Medium Priority - Files Using `select` but Not `.join()`

2. **src/diagram.js**
   - Imports: `select` from d3-selection 
   - Current: No `.join()` usage
   - Risk: May need `.join()` in future

3. **src/tip.js**
   - Imports: `event as d3Event, select` from d3-selection
   - Current: No `.join()` usage

4. **src/symbol_port_style.js**
   - Imports: `select, event as d3Event` from d3-selection
   - Current: No `.join()` usage (has string joins only)

5. **src/legend.js**
   - Imports: `select` from d3-selection
   - Current: No `.join()` usage (has string joins only)

6. **src/node_contents.js**
   - Imports: `select` from d3-selection
   - Current: No `.join()` usage

7. **src/utils.js**
   - Imports: `select` from d3-selection
   - Current: No `.join()` usage (has string joins only)

8. **src/draw_graphs.js**
   - Imports: `event as d3Event, select` from d3-selection
   - Current: No `.join()` usage (has string joins only)

9. **src/keyboard.js**
   - Imports: `select, event` from d3-selection
   - Current: No `.join()` usage

10. **src/path_selector.js**
    - Imports: `select` from d3-selection
    - Current: No `.join()` usage

11. **src/move_nodes.js**
    - Imports: `select, event as d3Event` from d3-selection
    - Current: No `.join()` usage

### Event-Only Imports (Lower Priority)

12. **src/select_things.js** - Only imports `event`
13. **src/brush.js** - Only imports `event`
14. **src/spline_paths.js** - Only imports `event`
15. **src/expand_collapse.js** - Only imports `event as d3Event`
16. **src/delete_things.js** - Only imports `event as d3Event`
17. **src/label_things.js** - Only imports `event`

## Implementation Plan

### Phase 1: Fix Critical File (render_svg.js)

1. **Update render_svg.js imports:**
   ```javascript
   // BEFORE
   import { select, selectAll } from 'd3-selection';
   
   // AFTER
   import { select, selectAll } from 'd3';
   ```

2. **Update importmap in web/explore.html:**
   ```javascript
   // Ensure d3@5.8.0 is available
   "d3": "https://cdn.jsdelivr.net/npm/d3@5.8.0/+esm"
   ```

3. **Test render_svg.js .join() functionality**

### Phase 2: Update All Select-Using Files

For files 2-11 above, update imports from:
```javascript
import { select } from 'd3-selection';
// TO
import { select } from 'd3';
```

For files that import both select and event:
```javascript
import { select, event as d3Event } from 'd3-selection';
// TO  
import { select, event as d3Event } from 'd3';
```

### Phase 3: Event-Only Files (Optional)

Files 12-17 only import `event` and can remain unchanged unless issues arise.

## Testing Strategy

1. **Build test:** `npm run build` should succeed
2. **Browser test:** Load `web/explore.html` - should render without join() errors  
3. **Functionality test:** Verify all D3 interactions work (zoom, hover, selection)
4. **Regression test:** Test other examples (simple-viewer.html, etc.)

## Rollback Plan

If issues arise:
1. Revert specific file imports back to `d3-selection`
2. Use traditional enter/update/exit pattern instead of `.join()` 
3. Document which files need bundle vs modular imports

## Expected Outcome

- All `.join()` calls work consistently
- No more "join is not a function" errors
- Unified D3 version across codebase
- Foundation for future D3 join() adoption

## Estimated Effort

- **Phase 1:** 30 minutes (critical fix)
- **Phase 2:** 1-2 hours (systematic updates)  
- **Phase 3:** 30 minutes (optional cleanup)
- **Testing:** 1 hour

**Total:** 3-4 hours