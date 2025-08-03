// Dynagraph layout web worker entry point
import { dynagraphLayout } from '../dynagraph_layout.js';
import { createWorkerHandler } from './worker_common.js';

// Create layout factory that initializes WASM on first init
function dynagraphLayoutWithInit() {
    let wasmInitialized = false;
    
    return function(id, layout) {
        const baseLayout = dynagraphLayout(id, layout);
        const originalInit = baseLayout.init;
        
        // Override init to initialize WASM first
        baseLayout.init = async function(options) {
            if (!wasmInitialized) {
                try {
                    await globalThis.createDynagraphModule();
                    wasmInitialized = true;
                } catch (error) {
                    console.error('[DYNAGRAPH WORKER] Failed to initialize WASM module:', error);
                    throw error;
                }
            }
            return originalInit.call(this, options);
        };
        
        return baseLayout;
    };
}

onmessage = createWorkerHandler(dynagraphLayoutWithInit());