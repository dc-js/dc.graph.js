/**
 * Manual layout for dc.graph.js
 * @module manual_layout
 */

// External dependencies
import { dispatch } from 'd3-dispatch';
import { property, uuid } from './core.js';

export function manualLayout(id) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');

    let _wnodes;

    function init(_options) {
    }
    function data(nodes) {
        _wnodes = nodes;
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch.call(event, null, wnodes, wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})));
    }
    function start() {
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    const _engine = {
        layoutAlgorithm() {
            return 'manual';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, _edges) {
            data(nodes);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return [];
        },
        populateLayoutNode(n1, n) {
            ['x', 'y'].forEach(attr => {
                if (n.orig.value[attr] !== undefined)
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge() {},
        addressToKey: property(ad => ad.join(',')),
        keyToAddress: property(nid => nid.split(',')),
    };
    return _engine;
}

// Scripts needed for web worker
manualLayout.scripts = ['css-layout.js'];
