/**
 * Simple SVG renderer for compatibility with legend component
 * This is a minimal implementation to support existing code that imports renderSvg directly
 * @module render_svg
 */

import { property } from './core.js';

export function renderSvg() {
    const _renderer = {};

    _renderer.parent = property(null);
    _renderer.svg = property(null);

    _renderer.rendererType = function() {
        return 'svg';
    };

    return _renderer;
}
