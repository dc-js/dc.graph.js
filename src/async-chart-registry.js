/**
 * Async versions of dc.js chart registry functions
 * Needed because our render/redraw methods are async (for WASM support)
 * but dc.js doesn't support async operations
 */

import { chartRegistry } from 'dc';

/**
 * Async version of dc.renderAll
 * Re-render all charts in the given chart group asynchronously
 * @param {String} [group] Chart group name
 * @returns {Promise<void>}
 */
export async function renderAllAsync(group) {
    const charts = chartRegistry.list(group);
    for (let i = 0; i < charts.length; ++i) {
        await charts[i].render();
    }
}

/**
 * Async version of dc.redrawAll
 * Redraw all charts in the given chart group asynchronously
 * @param {String} [group] Chart group name
 * @returns {Promise<void>}
 */
export async function redrawAllAsync(group) {
    const charts = chartRegistry.list(group);
    for (let i = 0; i < charts.length; ++i) {
        await charts[i].redraw();
    }
}
