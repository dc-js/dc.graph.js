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

#### Step 1: Research Phase
```bash
# For each dependency, run analysis:
grep -r "dependencyName" src/ web/ --include="*.js"
npm info packageName
# Check package.json for current versions
# Check if package supports ES modules
```

#### Step 2: Create Migration Scripts
Create helper scripts to:
- Find all usage patterns for each global
- Generate replacement import statements
- Validate that imports work correctly

#### Step 3: Migration Order (by complexity)

1. **`'_'` (lodash)** - Start here, well-documented ES module support
2. **`lysenkoIntervalTree`** - Single usage location, straightforward
3. **`computeLayout`** - Single usage location  
4. **`graphlibDot`** - Limited usage, specific functionality
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

**1. Lodash (`'_'`) Migration Test**
- Test files: All examples that use utility functions
- Focus: Array/object manipulation, data processing
- Key examples: `brushing-filtering.html`, `network-building.html`

**2. Interval Tree (`lysenkoIntervalTree`) Migration Test**  
- Test files: Examples using path operations
- Focus: Path finding, graph traversal
- Key examples: Any with path highlighting

**3. CSS Layout (`computeLayout`) Migration Test**
- Test files: `flexbox.html` and related examples
- Focus: Node positioning, layout algorithms
- Key examples: Flexbox layout examples

**4. GraphLib DOT (`graphlibDot`) Migration Test**
- Test files: Examples loading `.gv` or `.dot` files  
- Focus: File parsing, graph loading
- Key examples: Any example loading graphviz files

**5. Viz.js (`Viz`) Migration Test**
- Test files: Examples using Graphviz layout
- Focus: Graphviz rendering, DOT processing
- Key examples: Any with graphviz layout engine

**6. WebCola (`setcola`) Migration Test**
- Test files: Examples using cola layout engine
- Focus: Force-directed layout, constraints
- Key examples: `compare-layouts.html`, `network-building.html`

**7. Metagraph (`metagraph`) Migration Test**
- Test files: Examples with graph operations
- Focus: Graph manipulation, supergraph features
- Key examples: Complex graph examples

**8. DC Graph Self-Reference (`dc_graph`) Migration Test**
- Test files: All examples (comprehensive test)
- Focus: Core library functionality
- Key examples: Every HTML file in web/

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