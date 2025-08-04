// Dynagraph layout web worker entry point
import { dynagraphLayout } from '../dynagraph_layout.js';
import { createWorkerHandler } from './worker_common.js';

// Initialize WASM once when worker loads
let wasmInitialized = false;

async function initializeWASM() {
    if (!wasmInitialized) {
        try {
            await globalThis.createDynagraphModule();
            wasmInitialized = true;
        } catch (error) {
            console.error('[DYNAGRAPH WORKER] Failed to initialize WASM module:', error);
            throw error;
        }
    }
}

// Create layout factory that ensures WASM is initialized
function dynagraphLayoutWithWASM(id, layout) {
    const baseLayout = dynagraphLayout(id, layout);
    const originalInit = baseLayout.init;

    // Override init to ensure WASM is initialized first
    baseLayout.init = async function(options) {
        await initializeWASM();
        return originalInit.call(this, options);
    };

    return baseLayout;
}

onmessage = createWorkerHandler(dynagraphLayoutWithWASM);
