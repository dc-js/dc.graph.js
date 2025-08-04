# Debug Logs Kept After ES6 Worker Migration

This document lists the debug logs that were retained after cleaning up the verbose logging from the ES6 worker migration.

## Logs Kept

### 1. Worker Error Handling
**File**: `src/webworker_layout.js:29`
```javascript
console.error('[WORKER] Worker error for layout ' + workerName + ':', e);
```
**Purpose**: Essential for debugging worker failures, includes layout name for context.

### 2. WASM Initialization Errors
**File**: `src/workers/dynagraph-worker.js:20`
```javascript
console.error('[DYNAGRAPH WORKER] Failed to initialize WASM module:', error);
```
**Purpose**: Critical for debugging WASM loading issues in dynagraph worker.

### 3. Dynagraph Initialization Errors (Main Thread)
**File**: `src/dynagraph_layout.js:310`
```javascript
console.error('[DYNAGRAPH] Failed to initialize dynagraph:', error);
```
**Purpose**: Essential for debugging main thread dynagraph initialization failures.

### 4. Missing parseIncrface Warning
**File**: `src/dynagraph_layout.js:208`
```javascript
console.log('[DYNAGRAPH] parseIncrface not available, skipping');
```
**Purpose**: Helps debug missing incrface parser dependency.

### 5. Incrface Parse Errors
**File**: `src/dynagraph_layout.js:213`
```javascript
console.log('[DYNAGRAPH] incrface parse failed', xep);
```
**Purpose**: Essential for debugging incrface parsing issues.

### 6. Dynagraph Messages (Warnings)
**File**: `src/dynagraph_layout.js:221`
```javascript
console.warn('[DYNAGRAPH] dynagraph message', cmd.message);
```
**Purpose**: Important messages from the dynagraph WASM module.

### 7. Graph Name Mismatch Warnings
**File**: `src/dynagraph_layout.js:225`
```javascript
console.warn('[DYNAGRAPH] graph name mismatch', _Gname, 'vs', graph);
```
**Purpose**: Helps debug communication protocol issues between components.

## Logs Removed

The following types of logs were removed as they were too verbose for production use:

- Step-by-step worker message tracing
- Command processing details
- Normal operation status messages
- Worker lifecycle startup/ready messages
- Detailed message queue operations
- Line-by-line execution tracing

## Context

These logs were added during the migration of dc.graph.js web workers from traditional scripts to ES6 modules with async WASM initialization. The kept logs focus on error conditions and critical warnings that indicate real problems, while removing the verbose tracing that was useful during development but not needed in production.

The worker system now properly handles:
- Async WASM initialization in dynagraph workers
- Message queuing during initialization
- Cross-browser ES6 module support
- Proper error reporting with context