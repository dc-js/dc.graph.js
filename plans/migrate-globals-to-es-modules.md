# Migrate Global Dependencies to ES Module Imports

## Overview
This plan outlines the migration of global dependencies currently listed in `eslint.config.js` to proper ES module imports with specific named imports where possible.

## Current Global Dependencies to Migrate

From `eslint.config.js` globals section:

1. **`setcola`** - WebCola integration
2. **`Viz`** - Graphviz visualization 
3. **`graphlibDot`** - DOT file parsing
4. **`'_'` (lodash)** - Utility functions
5. **`lysenkoIntervalTree`** - Interval tree operations
6. **`metagraph`** - Graph operations
7. **`computeLayout`** - CSS layout computations
8. **`dc_graph`** - The library itself (special case)

## Migration Strategy

### Phase 1: Analysis and Research

For each dependency, we need to:

1. **Identify all usage locations** using grep
2. **Determine the source** (npm package, local file, CDN)
3. **Check ES module support** in the dependency
4. **Map global methods to specific imports** 
5. **Identify import patterns** (default vs named imports)

### Phase 2: Individual Dependency Plans

#### 1. `Viz` (Graphviz)
- **Current usage**: Global `Viz` object
- **Files to check**: `src/*graphviz*.js`, `web/js/*viz*`
- **Target**: `import { render } from '@viz-js/viz'` or similar
- **Notes**: May need to update from viz.js v2 to @viz-js/viz v3

#### 2. `graphlibDot` (DOT parser)
- **Current usage**: Global `graphlibDot` object  
- **Files to check**: Files that parse .dot/.gv files
- **Target**: `import { parse, write } from 'graphlib-dot'`
- **Notes**: Check if this supports ES modules

#### 3. `'_'` (lodash)
- **Current usage**: Global `_` object
- **Files to check**: All source files using `_.methodName`
- **Target**: Specific imports like `import { map, filter, forEach } from 'lodash'`
- **Priority**: High - lodash has excellent ES module support

#### 4. `setcola` (WebCola)
- **Current usage**: Global `setcola` function
- **Files to check**: `src/cola_layout.js`, `src/annotate_layers.js`
- **Target**: `import { d3adaptor } from 'webcola'` 
- **Notes**: WebCola may expose this differently in ES modules

#### 5. `lysenkoIntervalTree` (Interval Tree)
- **Current usage**: Global `lysenkoIntervalTree` object
- **Files to check**: `src/path_reader.js`
- **Target**: `import IntervalTree from 'interval-tree-1d'`
- **Notes**: Check if the rollup config we removed was actually needed

#### 6. `metagraph` (Graph operations)
- **Current usage**: Global `metagraph` object
- **Files to check**: `src/diagram.js`, `src/supergraph.js`, etc.
- **Target**: May be a local module - `import metagraph from './metagraph.js'`
- **Notes**: This might be defined locally in the codebase

#### 7. `computeLayout` (CSS Layout)
- **Current usage**: Global `computeLayout` function
- **Files to check**: `src/flexbox_layout.js`
- **Target**: `import { computeLayout } from 'yoga-layout'` or similar
- **Notes**: This is likely from the yoga-layout library

#### 8. `dc_graph` (Self-reference)
- **Current usage**: Global `dc_graph` object
- **Files to check**: Throughout the codebase
- **Target**: Internal imports from the module system
- **Notes**: Special case - this is the library referencing itself

### Phase 3: Migration Execution Plan

#### Two-Stage Migration Strategy

For each dependency, we'll complete both stages before moving to the next:

**Stage 1: ES Module Migration**
1. Replace global usage with ES module imports in source code
2. Remove global from eslint.config.js  
3. Test build and lint pass
4. Test basic functionality with vendored files still present

**Stage 2: CDN Migration + Cleanup**
1. Remove vendored files from `web/js/`
2. Remove dependency from `package.json` devDependencies  
3. Add to import maps in all HTML files with jsdelivr CDN + pinned versions
4. User testing with `npm run serve`
5. Fix any issues found

#### Automation Strategy

Based on the successful graphlib-dot migration, we've developed a reusable script pattern:

**Generic Migration Script Template (`scripts/migrate-[dependency].js`)**:
```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Configuration per dependency
const config = {
    name: 'dependency-name',
    cdnUrl: 'https://cdn.jsdelivr.net/npm/package@version/+esm',
    scriptPatterns: [
        /<script[^>]*src="js\/package\.js"[^>]*><\/script>\s*/g,
        /<script[^>]*src="js\/package\.min\.js"[^>]*><\/script>\s*/g
    ],
    excludeFiles: ['index.html', 'arrow-designer.html'], // customize per dependency
    insertAfterPattern: /"@dagrejs\/dagre":\s*"[^"]+",?\s*\n/ // or other landmark
};

// Reusable migration logic...
```

**Adaptation Instructions for Each Dependency**:

1. **Copy and rename** the script: `cp scripts/add-graphlib-dot-to-import-maps.js scripts/migrate-[dependency].js`

2. **Update configuration**:
   - Change `cdnUrl` to correct package and version
   - Update `scriptPatterns` to match the vendored file names
   - Adjust `excludeFiles` based on which HTML files actually use the dependency
   - Modify `insertAfterPattern` to find appropriate insertion point in import maps

3. **Run script** and verify results

4. **Examples for remaining dependencies**:
   - **lysenkoIntervalTree**: CDN `interval-tree-1d@latest`, script pattern `js/lysenko-interval-tree.js`
   - **computeLayout**: CDN `yoga-layout@latest`, script pattern `js/yoga-layout.js`  
   - **Viz**: CDN `@viz-js/viz@latest`, script pattern `js/viz.js`
   - **setcola**: CDN `webcola@latest`, script pattern `js/cola.js`

#### Step 1: Research Phase
```bash
# For each dependency, run analysis:
grep -r "dependencyName" src/ web/ --include="*.js"
npm info packageName
# Check package.json for current versions
# Check if package supports ES modules
```

#### Step 2: Migration Order (by complexity)

1. **`'_'` (lodash)** ✅ - Completed both stages
2. **`graphlibDot`** ✅ - Completed both stages 
3. **`lysenkoIntervalTree`** - Single usage location, straightforward
4. **`computeLayout`** - Single usage location  
5. **`Viz`** - May require version upgrade
6. **`setcola`** - Complex integration with WebCola
7. **`metagraph`** - Need to determine if it's local or external
8. **`dc_graph`** - Most complex, self-referential

#### Step 4: Testing Strategy

##### Automated Testing
- Create test files for each migration
- Ensure web workers still function (they may need different import strategies)
- Verify build process still works
- Run eslint to ensure no new errors

##### Manual Testing Plan (User Validation)

For each dependency migration, I will:

1. **Complete the migration** for one dependency at a time
2. **Run the build process** (`npm run build`) to ensure no build errors
3. **Ask you to test** specific functionality using this protocol:

**Testing Protocol:**
```
Please test the [DEPENDENCY_NAME] migration:

Test Files:
- [ ] web/example1.html - Test basic functionality 
- [ ] web/example2.html - Test advanced features
- [ ] web/workerExample.html - Test web worker integration (if applicable)

Specific Tests:
- [ ] Action 1: Description of what to test
- [ ] Action 2: Description of what to test  
- [ ] Action 3: Description of what to test

Expected Behavior:
- Feature X should work as before
- No console errors should appear
- Performance should be similar

Please report:
✅ PASS: Everything works as expected
❌ FAIL: [Describe what's broken, include console errors, screenshots if helpful]
⚠️  PARTIAL: [Describe what works vs what doesn't]
```

4. **Wait for your feedback** before proceeding to the next dependency
5. **Fix any issues** you report before moving on
6. **Document any workarounds** needed

##### Testing Schedule by Dependency

**1. GraphLib DOT (`graphlibDot`) Migration Test** ✅ **COMPLETED**
```
Migration: graphlibDot (DOT file parser) - SUCCESSFULLY MIGRATED
Target Import: import * as graphlibDot from 'graphlib-dot'
Changes Made:
  - Added ES module import to src/load_graph.js:3
  - Removed 'graphlibDot': 'readonly' from eslint.config.js
  - Removed vendored files: web/js/graphlib-dot.js, web/js/graphlib-dot.min.js
  - Removed graphlib-dot from package.json devDependencies
  - Added to import maps in 10 HTML files with CDN: https://cdn.jsdelivr.net/npm/graphlib-dot@0.6.4/+esm
  - Version detection preserved (v0.6.4 uses .read() method)

Status: ✅ Stage 1 complete, ✅ Stage 2 complete, ✅ Both stages fully migrated

Script: Created scripts/add-graphlib-dot-to-import-maps.js for automated migration
- Handles both adding to import maps and removing old script tags
- Excludes files that don't need the dependency (index.html, arrow-designer.html)
- Reusable pattern for remaining dependencies

Manual Testing Protocol:
□ Load a .gv file in any graph example
□ Verify nodes and edges are parsed correctly 
□ Check that node clustering/subgraphs work
□ No console errors during file parsing
□ Graph renders correctly after parsing
```

**2. WebCola Integration (`setcola`) Migration Test**
```
Migration: setcola (WebCola d3 adapter)
Target Import: import { d3adaptor } from 'webcola'
Current Usage: Global reference for WebCola integration

Functionality Tests:
1. Cola Force-Directed Layout
   - Test: setcola() function creates proper adaptor
   - Test: Constraint-based layout positioning
   - Test: Node positioning and edge routing
   - Expected: Smooth force-directed animations

Test Files to Validate:
- web/compare-layouts.html - Select "cola" layout
- web/network-building.html - Default uses cola
- Any example with force-directed layout

Manual Testing Protocol:
□ Switch to cola layout engine in compare-layouts
□ Verify nodes animate smoothly to positions
□ Check edge routing avoids node overlaps
□ Test constraint satisfaction (if applicable)
□ Verify layout convergence (nodes settle)
```

**3. Viz.js (`Viz`) Migration Test**
```
Migration: Viz (Graphviz renderer)
Target Import: import { render } from '@viz-js/viz'
Current Usage: Graphviz layout engine integration

Functionality Tests:
1. Graphviz Layout Rendering
   - Test: Viz rendering of DOT strings
   - Test: Hierarchical layout algorithms
   - Test: SVG output generation
   - Expected: Clean hierarchical node positioning

Test Files to Validate:
- Any example with "graphviz" layout option
- Examples loading .gv files with layout
- Hierarchical diagram examples

Manual Testing Protocol:
□ Select graphviz layout in compare-layouts  
□ Load hierarchical data (.gv file)
□ Verify clean top-down layout
□ Check edge routing quality
□ No SVG parsing errors
```

**4. CSS Layout (`computeLayout`) Migration Test**  
```
Migration: computeLayout (Yoga layout engine)
Target Import: import { computeLayout } from 'yoga-layout'
Current Usage: src/flexbox_layout.js - CSS flexbox positioning

Functionality Tests:
1. Flexbox Node Positioning
   - Test: computeLayout() calculations
   - Test: Flex container/item relationships
   - Test: Layout constraint satisfaction
   - Expected: Proper CSS flexbox behavior

Test Files to Validate:
- web/flexbox.html - Primary flexbox example
- Any examples using flexbox layout engine

Manual Testing Protocol:
□ Open flexbox.html example
□ Verify nodes align in flex containers
□ Check responsive layout behavior
□ Test different flex properties
□ Verify layout updates on data changes
```

**5. Interval Tree (`lysenkoIntervalTree`) Migration Test**
```
Migration: lysenkoIntervalTree (1D interval operations)
Target Import: import IntervalTree from 'interval-tree-1d'
Current Usage: Path operations and spatial queries

Functionality Tests:
1. Spatial/Temporal Queries
   - Test: Interval tree construction
   - Test: Range queries for overlapping intervals
   - Test: Insert/delete operations
   - Expected: Fast spatial lookups

Test Files to Validate:
- Examples with path highlighting
- Temporal graph examples
- Spatial query features

Manual Testing Protocol:
□ Test path highlighting features
□ Verify spatial queries work correctly
□ Check performance on large datasets
□ Test range selection operations
□ Verify no regression in query speed
```

**6. Metagraph (`metagraph`) Migration Test**
```
Migration: metagraph (Graph operations library)
Target: Determine if local module or external package
Current Usage: Graph manipulation, supergraph features

Functionality Tests:
1. Graph Operations
   - Test: Graph manipulation functions
   - Test: Supergraph/subgraph operations
   - Test: Graph analysis algorithms
   - Expected: Complex graph operations work

Test Files to Validate:
- Examples with graph manipulation
- Supergraph/clustering examples
- Complex network analysis features

Manual Testing Protocol:
□ Test graph clustering/grouping
□ Verify supergraph operations
□ Check graph analysis functions
□ Test large graph performance
□ Verify graph state consistency
```

**7. Lodash (`'_'`) Migration Test**
```
Migration: lodash utilities
Target Import: import { map, filter, forEach, ... } from 'lodash'
Current Usage: Widespread utility functions throughout

Functionality Tests:
1. Data Processing Operations
   - Test: Array manipulation (map, filter, reduce)
   - Test: Object operations (keys, values, merge)
   - Test: Collection utilities (find, groupBy)
   - Expected: All data processing works correctly

Test Files to Validate:
- web/brushing-filtering.html - Heavy data processing
- web/network-building.html - Dynamic data updates
- Any example with complex data manipulation

Manual Testing Protocol:  
□ Test data filtering/brushing
□ Verify chart interactions
□ Check dynamic data updates
□ Test cross-filter integration
□ Verify performance on large datasets

✅ **COMPLETED** - Lodash completely removed:
- Replaced _.extend() with spread operator
- Replaced _.range() with d3.range()  
- Removed from eslint.config.js and package.json
- Build and lint passing
```

**8. DC Graph Self-Reference (`dc_graph`) Migration Test**
```
Migration: dc_graph (Self-referential module access)
Target: Internal ES module imports
Current Usage: Library referencing itself globally

Functionality Tests:
1. Core Library Functions
   - Test: All diagram creation functions
   - Test: Property cascade system
   - Test: Event handling and interactions
   - Expected: Complete library functionality

Test Files to Validate:
- ALL HTML files in web/ directory
- Complete functionality test

Manual Testing Protocol:
□ Test every major example
□ Verify all interaction modes
□ Check property system works
□ Test all layout engines
□ Comprehensive regression testing
```

##### Error Reporting Template

When you find issues, please use this format:

```
Migration: [DEPENDENCY_NAME]
Test File: [FILENAME]
Status: ❌ FAIL

Error Details:
- Console Error: [Copy exact error message]
- Expected: [What should happen]
- Actual: [What actually happened]
- Browser: [Chrome/Firefox/Safari version]
- Steps to Reproduce:
  1. Step one
  2. Step two
  3. Step three

Additional Notes: [Any other observations]
```

##### Rollback Protocol

If you report critical failures:
1. I will immediately investigate the specific error
2. If it can't be fixed quickly (within 1 hour), I will:
   - Rollback the migration for that dependency
   - Keep the global in eslint config
   - Document the issue for future investigation
   - Move to the next dependency

##### Success Criteria for Each Migration

Before asking you to test, each migration must:
- [ ] Build without errors (`npm run build`)
- [ ] Pass eslint without new errors (`npm run lint`)
- [ ] Load in browser without immediate console errors
- [ ] Show basic functionality working

Only then will I request your testing.

### Phase 4: Benefits

#### Immediate Benefits
- **Better tree shaking** - Only import what's used
- **Clearer dependencies** - Explicit imports vs globals
- **Better IDE support** - IntelliSense and type checking
- **Smaller bundles** - Dead code elimination

#### Long-term Benefits  
- **Easier maintenance** - Clear dependency graph
- **Better security** - No global namespace pollution
- **Modern tooling** - Works better with bundlers
- **Future-proof** - ES modules are the standard

### Phase 5: Implementation Notes

#### Import Style Guidelines
- Use **specific named imports** wherever possible
- Avoid `import *` unless necessary
- Group imports logically (external deps, local modules)
- Use consistent import aliases

#### Example Transformations
```javascript
// Before (global)
const result = _.map(data, item => item.value);
Viz.render(dotString);

// After (ES modules)  
import { map } from 'lodash';
import { render } from '@viz-js/viz';

const result = map(data, item => item.value);
render(dotString);
```

### Phase 6: Rollback Plan
- Keep globals list in eslint config but commented out
- Test each migration in isolation
- Have rollback commits ready
- Document any compatibility issues found

## Success Criteria
- [ ] All targeted globals removed from eslint.config.js
- [ ] All imports use specific named imports
- [ ] Build process works without errors
- [ ] All examples continue to function
- [ ] Web workers continue to function
- [ ] Bundle size is same or smaller
- [ ] No runtime errors in production

## Timeline Estimate
- **Research Phase**: 2-3 days
- **Migration Scripts**: 1 day  
- **Individual Migrations**: 1-2 days each (8 total = 8-16 days)
- **Testing & Validation**: 2-3 days
- **Total**: ~2-3 weeks

## Risk Mitigation
- Start with low-risk dependencies (lodash)
- Test each migration thoroughly before proceeding
- Keep detailed logs of changes
- Have working branch for rollback
- Document any breaking changes found