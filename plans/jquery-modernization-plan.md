# jQuery Modernization Plan

## Current State Analysis

The codebase currently uses jQuery in limited but specific places:

### Files Using jQuery (native, not vendored):
1. **drag-drop-composition.js** (15 instances) - Heavy usage
2. **sync-url-options.js** (6 instances) - Form interactions
3. **match-game.js** (1 instance) - Resizable widget
4. **resizing.js** (1 instance) - Resizable widget  
5. **ceph_layout.js** (2 instances) - DOM manipulation

### jQuery Functionality Categories:

#### **Easy to Replace with D3:**
- DOM Selection: `$('#id')` → `d3.select('#id')`
- Class manipulation: `.addClass()`, `.removeClass()` → `.classed()`
- Event handling: `.click()`, `.on()` → `.on()`
- Attribute/property access: `.val()`, `.is()` → `.property()`, `.attr()`
- Content manipulation: `.append()` → `.append()`

#### **Requires Modern Library Replacement:**
- **Drag & Drop**: `.draggable()`, `.droppable()` (jQuery UI)
- **Resizable**: `.resizable()` (jQuery UI)
- **Inline Editing**: `.editable()` (x-editable plugin)
- **Bootstrap Integration**: `.on('hide.bs.collapse')` events

## Recommended Modern Libraries (2025)

### **Drag & Drop Replacement**
**Top Choice: SortableJS** 
- Dependency-free, works with vanilla JS
- Native HTML5 Drag & Drop API
- Touch device support
- 28k GitHub stars, actively maintained
- **Alternative**: Interact.js for more control

### **Resizable Replacement**
**Top Choice: Interact.js**
- Provides dragging, dropping, AND resizing
- Lightweight, no dependencies
- Pointer events API for modern touch support
- **Alternative**: CSS `resize` property for simple cases

### **Inline Editing Replacement**
**Top Choice: Scribio**
- Modern TypeScript-based replacement for x-editable  
- No jQuery dependency
- Built-in XSS protection with DOMPurify
- Highly customizable with custom types and renderers
- **Alternative**: Malle for simpler cases

## Migration Strategy

### **Phase 1: DOM/Event Migration (Low Risk)**
**Effort**: ~2-3 hours
**Files**: sync-url-options.js, ceph_layout.js, basic parts of drag-drop-composition.js

Replace basic jQuery usage:
```javascript
// Before
$('#button').click(function() { ... })
$('#input').val()
$('#element').addClass('active')

// After  
d3.select('#button').on('click', function() { ... })
d3.select('#input').property('value')
d3.select('#element').classed('active', true)
```

### **Phase 2: Widget Replacement (Medium Risk)**
**Effort**: ~4-6 hours
**Files**: match-game.js, resizing.js (resizable widgets)

Replace jQuery UI widgets:
```javascript
// Before
$('#resize').resizable({
    resize: function(event, ui) { ... }
})

// After (using Interact.js)
import interact from 'interactjs'
interact('#resize')
  .resizable({
    edges: { left: true, right: true, bottom: true, top: true }
  })
  .on('resizemove', function(event) { ... })
```

### **Phase 3: Complex UI Replacement (Higher Risk)**
**Effort**: ~6-8 hours  
**Files**: drag-drop-composition.js (drag/drop + inline editing)

Replace complex jQuery UI interactions:
```javascript
// Before
$('#canvas').droppable({ drop: function(event, ui) { ... }})
$('#solution-name').editable({ success: function() { ... }})

// After (using SortableJS + Scribio)
import Sortable from 'sortablejs'
import { Scribio } from 'scribio'

new Sortable(document.getElementById('canvas'), {
  onAdd: function(evt) { ... }
})
new Scribio('#solution-name', {
  onSave: function(value) { ... }
})
```

## Benefits

### **Performance**
- Eliminate jQuery (30kb) + jQuery UI (250kb) + x-editable (50kb) = **~330kb reduction**
- Modern libraries are typically 10-50kb each
- Better tree-shaking with modern bundlers

### **Maintainability**  
- Remove deprecated dependencies
- Modern ES6+ APIs instead of jQuery patterns
- Better TypeScript support
- More consistent with D3-based architecture

### **Modern Features**
- Touch/mobile support out of the box
- Better accessibility
- Modern pointer events instead of mouse events
- CSS Grid/Flexbox integration

## Implementation Notes

### **Bootstrap Integration**
- For Bootstrap collapse events, use native DOM events:
```javascript
// Before
$('#palette').on('hide.bs.collapse', handler)

// After
document.getElementById('palette').addEventListener('hide.bs.collapse', handler)
```

### **Gradual Migration**
- Can be done incrementally (file by file)
- Start with lowest-risk files first
- Maintain parallel functionality during transition
- Test extensively with existing UI interactions

### **Dependency Management**
```javascript
// New dependencies to add:
npm install sortablejs interact.js scribio

// Dependencies to remove:
npm uninstall jquery jquery-ui x-editable
```

## Testing Strategy

1. **Unit Tests**: Verify each widget replacement works identically
2. **Integration Tests**: Test cross-widget interactions still work  
3. **Browser Tests**: Ensure touch/mobile compatibility
4. **Performance Tests**: Measure bundle size reduction

## Risk Assessment

- **Low Risk**: Basic DOM/event replacement
- **Medium Risk**: Widget replacement (well-established alternatives exist)
- **Higher Risk**: Complex drag-drop workflows in drag-drop-composition.js

## Timeline Estimate

- **Total Effort**: 12-17 hours
- **Can be done incrementally** over multiple sessions
- **Immediate benefits** after Phase 1 (reduced bundle size)
- **Full benefits** after Phase 3 (modern, maintainable codebase)

## Consolidated Library Analysis: One vs Multiple Libraries

### **Single Library Option: Interact.js**

**Can Interact.js handle all our needs?**
- ✅ **Drag & Drop**: Full support with inertia, snapping, multi-touch
- ✅ **Resizable**: Full support with edge/corner resizing, constraints
- ❌ **Inline Editing**: No built-in support (would need custom implementation)

**Interact.js Pros:**
- Single dependency (16kb gzipped)
- Unified API for drag/drop + resize
- Excellent touch/mobile support
- Framework-agnostic
- Well-maintained (11.8k GitHub stars)

**Interact.js Cons:**
- No inline editing functionality
- Lower-level API (more code to implement dropzones)
- Less "ready-to-use" than specialized libraries

### **Multi-Library Approach: Specialized Tools**

| Feature | Library | Size | Pros | Cons |
|---------|---------|------|------|------|
| Drag/Drop | SortableJS | 19kb | Plug-and-play, extensive features | Drag/drop only |
| Resize | Interact.js | 16kb | Multi-touch, constraints | Need drag/drop elsewhere |
| Inline Edit | Scribio | 8kb | Modern, XSS protection | Editing only |

**Total Size**: ~43kb vs 16kb for Interact.js alone

### **Recommendation: Hybrid Approach**

**Best solution for our codebase:**
1. **Interact.js** for drag/drop + resize (unified, lower-level control)
2. **Scribio** for inline editing (modern, secure, lightweight)

**Why this combination:**
- Only 24kb total (16kb + 8kb)
- Interact.js handles both drag/drop AND resize with one API
- Scribio provides modern inline editing we can't get elsewhere
- Better than 3 separate libraries (SortableJS + Interact.js + Scribio = 43kb)

## Bootstrap 5 Integration Impact

### **Good News: Bootstrap 5 is jQuery-Free**

Bootstrap 5 natively supports vanilla JavaScript:

```javascript
// ✅ Bootstrap 5 Native (what we should use)
const myCollapseEl = document.querySelector('#myCollapse')
myCollapseEl.addEventListener('shown.bs.collapse', function(event) {
  // Our code here
})

// ❌ Current jQuery approach (what we're replacing)
$('#palette').on('hide.bs.collapse', function() {
  // Our code here  
})
```

### **Bootstrap Event Migration**
- All Bootstrap 5 components work with native JavaScript
- Event names remain the same (`hide.bs.collapse`, `show.bs.modal`, etc.)
- Just need to switch from jQuery event binding to `addEventListener`
- No Bootstrap functionality lost

### **Migration Impact**
- **Low Risk**: Bootstrap 5 designed for this transition
- **No Breaking Changes**: Same event system, just different syntax
- **Better Performance**: Eliminates jQuery event delegation overhead
- **Future-Proof**: Aligns with modern web standards

## Updated Dependencies

### **Remove**
```bash
npm uninstall jquery jquery-ui x-editable
# Removes ~330kb total
```

### **Add**
```bash
npm install interactjs scribio
# Adds ~24kb total
```

### **Net Savings**
- **Bundle Size**: -306kb (~93% reduction)
- **HTTP Requests**: Fewer library files to load
- **Maintenance**: Modern, actively maintained dependencies

## Decision

**Final Recommendation**: Use **Interact.js + Scribio** combination with native Bootstrap 5 events.

This provides:
- ✅ All functionality we need (drag/drop/resize/inline-edit)
- ✅ Minimal dependencies (2 libraries, 24kb total)
- ✅ Full Bootstrap 5 compatibility 
- ✅ Modern, maintainable codebase
- ✅ Massive bundle size reduction (93% smaller)
- ✅ Better performance and touch support

Proceed with gradual migration starting with Phase 1. The modern alternatives are mature, well-maintained, and provide significant benefits in terms of performance, maintainability, and future-proofing.