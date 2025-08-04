/**
 * Tippy.js tooltip support for dc.graph.js
 *
 * Modern replacement for d3.tip using tippy.js for better performance and features.
 *
 * @class tip
 * @memberof dc_graph
 * @return {Object}
 */
import { dispatch } from 'd3-dispatch';
import { select } from 'd3-selection';
import tippy from 'tippy.js';
import { functorWrap, property } from './core.js';
import { mode } from './mode.js';
import { ancestorHasClass } from './utils.js';

export function tip(options) {
    options = options || {};
    const _namespace = options.namespace || 'tip';
    const _instances = new Map(); // element -> tippy instance
    const _dispatch = dispatch('tipped');

    // Map d3.tip directions to tippy placements
    const directionMap = {
        'n': 'top',
        'ne': 'top-end',
        'e': 'right',
        'se': 'bottom-end',
        's': 'bottom',
        'sw': 'bottom-start',
        'w': 'left',
        'nw': 'top-start',
    };

    function createTippyInstance(element, datum) {
        if (_instances.has(element)) {
            return _instances.get(element);
        }

        const instance = tippy(element, {
            content: '',
            placement: directionMap[_mode.direction()] || 'top',
            interactive: _mode.clickable(),
            appendTo: () => document.body,
            allowHTML: true,
            theme: 'light-border',
            animation: 'scale-subtle',
            maxWidth: 350,
            arrow: true,
            trigger: 'manual', // We'll handle showing/hiding manually
            onHidden() {},
        });

        let showTimeout;
        let hideTimeout;

        // Handle mouse enter - check content before showing
        element.addEventListener('mouseenter', event => {
            // Stop propagation to prevent parent tips from showing
            event.stopPropagation();

            if (
                _mode.disabled()
                || (_mode.selection().exclude && _mode.selection().exclude(element))
            ) {
                return;
            }

            // Clear any pending hide timeout
            clearTimeout(hideTimeout);

            // Set up show timeout
            clearTimeout(showTimeout);
            showTimeout = setTimeout(async () => {
                // Hide all other instances first
                _instances.forEach(otherInstance => {
                    if (otherInstance !== instance) {
                        otherInstance.hide();
                    }
                });

                const d = element._dcgraph_datum || datum;
                try {
                    const content = await _mode.content()(d);
                    // Only show tooltip if content is not empty
                    if (content && content.trim() !== '') {
                        instance.setContent(content);
                        instance.show();
                        _dispatch.call('tipped', null, d);
                    }
                } catch (error) {
                    console.warn('Tooltip content error:', error);
                }
            }, _mode.showDelay());
        });

        // Handle mouse leave - hide after delay
        element.addEventListener('mouseleave', () => {
            clearTimeout(showTimeout);
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                instance.hide();
            }, _mode.hideDelay());
        });

        _instances.set(element, instance);
        element._dcgraph_datum = datum;
        return instance;
    }

    function destroyTippyInstance(element) {
        const instance = _instances.get(element);
        if (instance) {
            instance.destroy();
            _instances.delete(element);
            delete element._dcgraph_datum;
        }
    }

    function draw(diagram, node, edge, ehover) {
        const selection = _mode.selection().select(diagram, node, edge, ehover);
        selection.each(function(d) {
            createTippyInstance(this, d);
        });
    }

    function remove(diagram, node, edge, ehover) {
        const selection = _mode.selection().select(diagram, node, edge, ehover);

        selection.each(function() {
            destroyTippyInstance(this);
        });
    }

    const _mode = mode(_namespace, {
        draw,
        remove,
        laterDraw: true,
    });

    /**
     * Specify the direction for tooltips. Currently supports the
     * cardinal and intercardinal directions: 'n', 'ne', 'e', etc.
     * @name direction
     * @memberof dc_graph.tip
     * @instance
     * @param {String} [direction='n']
     * @return {String}
     * @return {dc_graph.tip}
     */
    _mode.direction = property('n');

    /**
     * Specifies the async function to generate content for the tooltip. This function has the
     * signature `async function(d)`, where `d` is the datum of the thing being hovered over.
     * The function should return a promise that resolves to the HTML content string.
     * @name content
     * @memberof dc_graph.tip
     * @instance
     * @param {Function} [content] - Async function that returns Promise<string>
     * @return {Function}
     */
    _mode.content = property(async n => _mode.parent() ? _mode.parent().nodeTitle.eval(n) : '');

    _mode.on = (event, f) => _dispatch.on(event, f);

    _mode.disabled = property(false);
    _mode.programmatic = property(false);

    _mode.displayTip = (filter, n, cb) => {
        if (typeof filter !== 'function') {
            const d = filter;
            filter = d2 => d2 === d;
        }

        const found = _mode.selection().select(
            _mode.parent(),
            _mode.parent().selectAllNodes(),
            _mode.parent().selectAllEdges(),
            null,
        );
        const elements = [];

        found.each(function(d) {
            if (filter(d)) {
                elements.push(this);
            }
        });

        if (elements.length > 0) {
            const which = (n || 0)%elements.length;
            const element = elements[which];
            const instance = _instances.get(element);
            if (instance) {
                instance.show();
                if (cb) cb(element._dcgraph_datum);
            }
        }
        return _mode;
    };

    _mode.hideTip = _delay => {
        _instances.forEach(instance => {
            instance.hide();
        });
        return _mode;
    };

    _mode.selection = property(selectNodeAndEdge());
    _mode.showDelay = _mode.delay = property(0);
    _mode.hideDelay = property(50);
    _mode.offset = property(null); // Not used with tippy, but kept for API compatibility
    _mode.clickable = property(false);
    _mode.linkCallback = property(null);

    return _mode;
}

/**
 * Generates a handler which can be passed to `tip.content` to produce a table of the
 * attributes and values of the hovered object.
 *
 * @name table
 * @memberof dc_graph.tip
 * @instance
 * @return {Function}
 * @example
 * // show all the attributes and values in the node and edge objects
 * var tip = dc_graph.tip();
 * tip.content(dc_graph.tip.table());
 */
export function tipTable() {
    const gen = async function(d) {
        d = gen.fetch()(d);
        if (!d) {
            return ''; // return empty string to prevent tooltip from showing
        }
        let data, keys;
        if (Array.isArray(d))
            data = d;
        else if (typeof d === 'number' || typeof d === 'string')
            data = [d];
        else { // object
            data = keys = Object.keys(d).filter(functorWrap(gen.filter()))
                .filter(k => d[k] !== undefined);
        }
        const table = select(document.createElement('table'));
        const rows = table.selectAll('tr').data(data);
        const rowsEnter = rows.enter().append('tr');
        rowsEnter.append('td').text(item => {
            if (keys && typeof item === 'string')
                return item;
            return JSON.stringify(item);
        });
        if (keys)
            rowsEnter.append('td').text(item => JSON.stringify(d[item]));
        return table.node().outerHTML; // optimizing for clarity over speed (?)
    };
    gen.filter = property(true);
    gen.fetch = property(d => d.orig.value);
    return gen;
}

export function tipJsonTable() {
    const table = tipTable().fetch(d => {
        const jsontip = table.json()(d);
        if (!jsontip) return null;
        try {
            return JSON.parse(jsontip);
        } catch (_xep) {
            return [jsontip];
        }
    });
    table.json = property(d => (d.orig.value.value || d.orig.value).jsontip);
    return table;
}

export function tipHtmlOrJsonTable() {
    const json_table = tipJsonTable();
    const gen = async function(d) {
        const html = gen.html()(d);
        if (html) {
            return html;
        } else {
            return await json_table(d);
        }
    };
    gen.json = json_table.json;
    gen.html = property(d => (d.orig.value.value || d.orig.value).htmltip);
    return gen;
}

export function selectNodeAndEdge() {
    return {
        select(diagram, node, edge, ehover) {
            return ehover ? node.merge(ehover) : node;
        },
        exclude(element) {
            return ancestorHasClass(element, 'port');
        },
    };
}

export function selectNode() {
    return {
        select(diagram, node, _edge, _ehover) {
            return node;
        },
        exclude(element) {
            return ancestorHasClass(element, 'port');
        },
    };
}

export function selectEdge() {
    return {
        select(diagram, node, edge, _ehover) {
            return edge;
        },
    };
}

export function selectPort() {
    return {
        select(diagram, node, _edge, _ehover) {
            return node.selectAll('g.port');
        },
    };
}
