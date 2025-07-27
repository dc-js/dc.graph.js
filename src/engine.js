/**
 * Layout engine registry and management
 * @module engine
 */

import { dagreLayout } from './dagre_layout.js';
import { d3v4ForceLayout } from './d3v4_force_layout.js';
import { treeLayout } from './tree_layout.js';
import { graphvizLayout } from './graphviz_layout.js';
import { colaLayout } from './cola_layout.js';
import { dynagraphLayout } from './dynagraph_layout.js';
import { manualLayout } from './manual_layout.js';
import { flexboxLayout } from './flexbox_layout.js';
import { layeredLayout } from './layered_layout.js';
import { webworkerLayout } from './webworker_layout.js';

export function spawnEngine(layout, args, worker) {
    args = args || {};
    worker = worker && !!window.Worker;
    var engine = engines.instantiate(layout, args, worker);
    if(!engine) {
        console.warn('layout engine ' + layout + ' not found; using default ' + _defaultEngine);
        engine = engines.instantiate(_defaultEngine, args, worker);
    }
    return engine;
}

const _engines = [
    {
        name: 'dagre',
        params: ['rankdir'],
        instantiate: function() {
            return dagreLayout();
        }
    },
    {
        name: 'd3v4force',
        instantiate: function() {
            return d3v4ForceLayout();
        }
    },
    {
        name: 'tree',
        instantiate: function() {
            return treeLayout();
        }
    },
    {
        names: ['circo', 'dot', 'neato', 'osage', 'twopi', 'fdp'],
        instantiate: function(layout, args) {
            return graphvizLayout(null, layout, args.server);
        }
    },
    {
        name: 'cola',
        params: ['lengthStrategy'],
        instantiate: function() {
            return colaLayout();
        }
    },
    {
        names: ['dynadag'],
        workerName: 'dynagraph',
        instantiate: function(layout, args) {
            return dynagraphLayout(null, layout, args.server);
        }
    },
    {
        name: 'manual',
        instantiate: function() {
            return manualLayout();
        }
    },
    {
        name: 'flexbox',
        instantiate: function() {
            return flexboxLayout();
        }
    },
    {
        name: 'layered',
        instantiate: function() {
            return layeredLayout();
        }
    }
];
const _defaultEngine = 'cola';

export const engines = {
    entry_pred: function(layoutName) {
        return function(e) {
            return e.name && e.name === layoutName || e.names && e.names.includes(layoutName);
        };
    },
    get: function(layoutName) {
        return _engines.find(this.entry_pred(layoutName));
    },
    is_directed: function(layoutName) {
        // to a first approximation. cola is sometimes directed
        return ['dagre', 'dot'].includes(layoutName);
    },
    instantiate: function(layout, args, worker) {
        var entry = this.get(layout);
        if(!entry)
            return null;
        var engine = entry.instantiate(layout, args),
            params = entry.params || [];
        params.forEach(function(p) {
            if(args[p])
                engine[p](args[p]);
        });
        if(engine.supportsWebworker && engine.supportsWebworker() && worker)
            engine = webworkerLayout(engine, entry.workerName);
        return engine;
    },
    available: function() {
        return _engines.reduce(function(avail, entry) {
            return avail.concat(entry.name ? [entry.name] : entry.names);
        }, []);
    },
    unregister: function(layoutName) {
        // meh. this is a bit much. there is such a thing as making the api too "easy".
        var i = _engines.findIndex(this.entry_pred(layoutName));
        var remove = false;
        if(i < 0)
            return false;
        var entry = _engines[i];
        if(entry.name === layoutName)
            remove = true;
        else {
            var j = entry.names.indexOf(layoutName);
            if(j >= 0)
                entry.names.splice(j, 1);
            else
                console.warn('search for engine failed', layoutName);
            if(entry.names.length === 0)
                remove = true;
        }
        if(remove)
            _engines.splice(i, 1);
        return true;
    },
    register: function(entry) {
        var that = this;
        if(!entry.instantiate) {
            console.error('engine definition needs instantiate: function(layout, args) { ... }');
            return this;
        }
        if(entry.name)
            this.unregister(entry.name);
        else if(entry.names)
            entry.names.forEach(function(layoutName) {
                that.unregister(layoutName);
            });
        else {
            console.error('engine definition needs name or names[]');
            return this;
        }
        _engines.push(entry);
        return this;
    }
};
