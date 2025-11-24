// Dynagraph module setup for main thread (non-worker mode)
import createDynagraphModule from './dynagraph.mjs';
import { parse as parseIncrface } from './incrface.mjs';

// Setup global functions for dynagraph layout
globalThis.parseIncrface = parseIncrface;
globalThis.createDynagraphModule = createDynagraphModule;

// Track initialization state
let dynagraphInitialized = false;
let dynagraphInitializing = false;

// Lazy initialization function - only called when dynagraph is actually used
globalThis.ensureDynagraphInitialized = async function() {
    if (dynagraphInitialized) {
        return; // Already initialized
    }

    if (dynagraphInitializing) {
        // Already initializing, wait for it to complete
        while (dynagraphInitializing) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        return;
    }

    dynagraphInitializing = true;
    try {
        console.log('Initializing dynagraph module for main thread...');
        await createDynagraphModule();
        dynagraphInitialized = true;
        console.log('Dynagraph module initialized for main thread');
    } catch (error) {
        console.error('Failed to initialize dynagraph module:', error);
        throw error;
    } finally {
        dynagraphInitializing = false;
    }
};
