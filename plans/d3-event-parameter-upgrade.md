# D3 Event Parameter Upgrade

## Overview
This document outlines the plan to modernize event handling in dc.graph.js from the deprecated `d3.event` global to the D3 v5+ pattern of receiving events as parameters.

## Current State
The codebase uses the D3 v3 pattern where `d3.event` is a global property available in event handlers:
```javascript
.on('click', function(d) {
    if(d3.event.shiftKey) {
        // handle shift-click
    }
    var coords = [d3.event.clientX, d3.event.clientY];
})
```

## Target State
Convert to D3 v5+ pattern where event is passed as a parameter:
```javascript
.on('click', function(event, d) {
    if(event.shiftKey) {
        // handle shift-click  
    }
    var coords = [event.clientX, event.clientY];
})
```

## Why This Matters
- **D3 v5+ compatibility** - `d3.event` is deprecated and will be removed
- **Better encapsulation** - No reliance on global state
- **Modern pattern** - Follows current D3 best practices
- **TypeScript friendly** - Explicit event typing

## Files Containing d3.event Usage
Based on analysis, these files use `d3.event`:

- `src/select_things.js` - Click handling and modifier keys
- `src/utils.js` - Mouse coordinate calculations
- `src/spline_paths.js` - Shift key detection
- `src/keyboard.js` - Key event handling
- `src/diagram.js` - Zoom event handling ✅ **ALREADY FIXED**

## Common Usage Patterns

### 1. Modifier Key Detection
```javascript
// Current
if(d3.event.shiftKey) { /* ... */ }
if(isUnion(d3.event)) { /* ... */ }
if(isToggle(d3.event)) { /* ... */ }

// Target
if(event.shiftKey) { /* ... */ }
if(isUnion(event)) { /* ... */ }
if(isToggle(event)) { /* ... */ }
```

### 2. Mouse Coordinates
```javascript
// Current
var coords = [d3.event.clientX, d3.event.clientY];
var target = d3.event.target;

// Target  
var coords = [event.clientX, event.clientY];
var target = event.target;
```

### 3. Keyboard Events
```javascript
// Current
if(_mod_keys.has(d3.event.key)) {
    _pressed.add(d3.event.key);
}

// Target
if(_mod_keys.has(event.key)) {
    _pressed.add(event.key);
}
```

### 4. Zoom Events (Already Fixed)
```javascript
// Current (was)
function doZoom() {
    var scale = d3.event.scale;
    var translate = d3.event.translate;
}

// Target (done)
function doZoom(event) {
    var scale = event.transform.k;
    var translate = [event.transform.x, event.transform.y];
}
```

## Implementation Strategy

### Phase 1: Event Handler Signatures
Update all event handler function signatures to receive event as first parameter:
```javascript
// Before
.on('click', function(d, i) { /* d3.event usage */ })

// After  
.on('click', function(event, d) { /* event usage */ })
```

### Phase 2: Replace d3.event References
Replace all `d3.event` references with the `event` parameter:
```javascript
// Before
d3.event.shiftKey
d3.event.clientX
d3.event.target

// After
event.shiftKey  
event.clientX
event.target
```

### Phase 3: Helper Function Updates
Update utility functions that expect `d3.event` to receive event as parameter:
```javascript
// Before
function eventCoords(diagram) {
    return diagram.invertCoord([d3.event.clientX - bound.left,
                              d3.event.clientY - bound.top]);
}

// After
function eventCoords(diagram, event) {
    return diagram.invertCoord([event.clientX - bound.left,
                              event.clientY - bound.top]);
}
```

## Specific Files and Changes

### src/select_things.js
- Update click handlers to receive `event` parameter
- Replace `d3.event.target`, `d3.event.shiftKey`, etc.
- Update `isUnion()` and `isToggle()` calls

### src/utils.js  
- Update `eventCoords()` function signature
- Replace mouse coordinate calculations
- Update any event-dependent utilities

### src/spline_paths.js
- Update shift key detection in path drawing
- Replace `d3.event.shiftKey` references

### src/keyboard.js
- Update keydown/keyup handlers
- Replace `d3.event.key` references
- Update modifier key tracking

## Testing Strategy
1. **File-by-file conversion** - Convert one file at a time
2. **Interactive testing** - Test mouse and keyboard interactions
3. **Cross-browser testing** - Ensure event handling works across browsers
4. **Regression testing** - Verify no functionality is lost

## Temporary Workaround
For the current D3 v5 upgrade, we're using `import { event } from 'd3'` as a temporary bridge, where `event` provides the current event. This allows the upgrade to proceed while maintaining compatibility. The full event parameter conversion should happen after the D3 v5 upgrade is stable.

## API Compatibility Notes
- **D3 v3**: `d3.event` is always available in event handlers
- **D3 v4**: `d3.event` still available but deprecated  
- **D3 v5+**: `d3.event` removed, must use event parameter
- **Modern D3**: Event is first parameter, data is second parameter

## Prerequisites  
- Complete D3 v5.8 upgrade first
- All ES6 imports working
- Basic functionality tested

## Estimated Effort
- **Analysis and planning**: 1 hour
- **Implementation**: 4-6 hours  
- **Testing and refinement**: 2-3 hours
- **Documentation updates**: 1 hour

**Total**: ~8-11 hours focused work