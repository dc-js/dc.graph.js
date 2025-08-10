/**
 * Layout engine registry and management
 * @module engine
 */

import { colaLayout } from './cola_layout.js';
import { d3v4ForceLayout } from './d3v4_force_layout.js';
import { dagreLayout } from './dagre_layout.js';
import { dynagraphLayout } from './dynagraph_layout.js';
import { flexboxLayout } from './flexbox_layout.js';
import { graphvizLayout } from './graphviz_layout.js';
import { layeredLayout } from './layered_layout.js';
import { manualLayout } from './manual_layout.js';
import { treeLayout } from './tree_layout.js';
import { webworkerLayout } from './webworker_layout.js';

export function spawnEngine(layout, args, worker) {
    args = args || {};
    worker = worker && !!window.Worker;
    let engine = engines.instantiate(layout, args, worker);
    if (!engine) {
        console.warn(`layout engine ${layout} not found; using default ${_defaultEngine}`);
        engine = engines.instantiate(_defaultEngine, args, worker);
    }
    return engine;
}

const _engines = [
    {
        name: 'dagre',
        params: ['rankdir'],
        workerName: 'dagre',
        instantiate() {
            return dagreLayout();
        },
    },
    {
        name: 'd3v4force',
        workerName: 'd3v4-force',
        instantiate() {
            return d3v4ForceLayout();
        },
    },
    {
        name: 'tree',
        instantiate() {
            return treeLayout();
        },
    },
    {
        names: ['circo', 'dot', 'neato', 'osage', 'twopi', 'fdp'],
        instantiate(layout, args) {
            return graphvizLayout(null, layout, args.server);
        },
    },
    {
        name: 'cola',
        params: ['lengthStrategy'],
        workerName: 'cola',
        instantiate() {
            return colaLayout();
        },
    },
    {
        names: ['dynadag'],
        workerName: 'dynagraph',
        instantiate(layout, args) {
            return dynagraphLayout(null, layout, args.server);
        },
    },
    {
        name: 'manual',
        instantiate() {
            return manualLayout();
        },
    },
    {
        name: 'flexbox',
        instantiate() {
            return flexboxLayout();
        },
    },
    {
        name: 'layered',
        instantiate() {
            return layeredLayout();
        },
    },
];
const _defaultEngine = 'cola';

export const engines = {
    entry_pred(layoutName) {
        return function(e) {
            return e.name && e.name === layoutName || e.names && e.names.includes(layoutName);
        };
    },
    get(layoutName) {
        return _engines.find(this.entry_pred(layoutName));
    },
    is_directed(layoutName) {
        // to a first approximation. cola is sometimes directed
        return ['dagre', 'dot'].includes(layoutName);
    },
    instantiate(layout, args, worker) {
        const entry = this.get(layout);
        if (!entry)
            return null;
        let engine = entry.instantiate(layout, args);
        const params = entry.params || [];
        params.forEach(p => {
            if (args[p])
                engine[p](args[p]);
        });
        if (engine.supportsWebworker && engine.supportsWebworker() && worker)
            engine = webworkerLayout(engine, entry.workerName);
        return engine;
    },
    available() {
        return _engines.reduce(
            (avail, entry) => avail.concat(entry.name ? [entry.name] : entry.names),
            [],
        );
    },
    unregister(layoutName) {
        // meh. this is a bit much. there is such a thing as making the api too "easy".
        const i = _engines.findIndex(this.entry_pred(layoutName));
        let remove = false;
        if (i < 0)
            return false;
        const entry = _engines[i];
        if (entry.name === layoutName)
            remove = true;
        else {
            const j = entry.names.indexOf(layoutName);
            if (j >= 0)
                entry.names.splice(j, 1);
            else
                console.warn('search for engine failed', layoutName);
            if (entry.names.length === 0)
                remove = true;
        }
        if (remove)
            _engines.splice(i, 1);
        return true;
    },
    register(entry) {
        const that = this;
        if (!entry.instantiate) {
            console.error('engine definition needs instantiate: function(layout, args) { ... }');
            return this;
        }
        if (entry.name)
            this.unregister(entry.name);
        else if (entry.names)
            entry.names.forEach(layoutName => {
                that.unregister(layoutName);
            });
        else {
            console.error('engine definition needs name or names[]');
            return this;
        }
        _engines.push(entry);
        return this;
    },
};
