/**
 * Web worker layout wrapper
 * @module webworker_layout
 */

import { dispatch } from 'd3-dispatch';
import { scriptPath } from './utils.js';

var _workers = {};
var NUMBER_RESULTS = 3;
function createWorker(workerName) {
    if(!_workers[workerName]) {
        var worker = _workers[workerName] = {
            worker: new Worker(scriptPath() + 'dc.graph.' + workerName + '.worker.js', { type: 'module' }),
            layouts: {}
        };
        worker.worker.onmessage = function(e) {
            var layoutId = e.data.layoutId;
            if(!worker.layouts[layoutId])
                throw new Error('layoutId "' + layoutId + '" unknown!');
            var engine = worker.layouts[layoutId].getEngine();
            var layoutName = engine.layoutAlgorithm?.() || 'unknown';
            if(e.data.args.length > NUMBER_RESULTS && engine.processExtraWorkerResults)
                engine.processExtraWorkerResults.apply(engine, e.data.args.slice(NUMBER_RESULTS));
            var dispatch = worker.layouts[layoutId].dispatch();
            dispatch.call(e.data.response, null, ...e.data.args);
        };
        worker.worker.onerror = function(e) {
            console.error('[WORKER] Worker error for layout ' + workerName + ':', e);
        };
    }
    return _workers[workerName];
}

export function webworkerLayout(layoutEngine, workerName) {
    var _tick, _done, _dispatch = dispatch('init', 'start', 'tick', 'end');
    var _worker = createWorker(workerName || layoutEngine.layoutAlgorithm());
    var engine = {};
    _worker.layouts[layoutEngine.layoutId()] = engine;

    engine.parent = function(parent) {
        if(layoutEngine.parent)
            layoutEngine.parent(parent);
    };
    // Helper function to clone options while filtering out functions
    function serializeOptions(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (typeof obj === 'function') {
            console.warn('[WORKER] Filtering out function from options:', obj.toString().slice(0, 100) + '...');
            return null; // Remove functions
        }
        if (Array.isArray(obj)) return obj.map(serializeOptions);
        
        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = serializeOptions(obj[key]);
                if (value !== null) { // Only include non-null values
                    result[key] = value;
                }
            }
        }
        return result;
    }
    
    engine.init = async function(options) {
        options = layoutEngine.optionNames().reduce(
            function(options, option) {
                const value = layoutEngine[option]();
                // Serialize each option value as we collect it
                options[option] = serializeOptions(value);
                return options;
            }, options);
        if(layoutEngine.propagateOptions)
            layoutEngine.propagateOptions(options);
        
        return new Promise((resolve, reject) => {
            // Set up one-time listener for init completion
            const originalOnMessage = _worker.worker.onmessage;
            const initTimeout = setTimeout(() => {
                _worker.worker.onmessage = originalOnMessage;
                reject(new Error('Worker init timeout'));
            }, 10000); // 10 second timeout
            
            _worker.worker.onmessage = function(e) {
                if (e.data.response === 'init' && e.data.layoutId === layoutEngine.layoutId()) {
                    clearTimeout(initTimeout);
                    _worker.worker.onmessage = originalOnMessage;
                    resolve();
                } else {
                    // Pass other messages to original handler
                    originalOnMessage.call(this, e);
                }
            };
            
            _worker.worker.postMessage({
                command: 'init',
                args: {
                    layoutId: layoutEngine.layoutId(),
                    options: serializeOptions(options)
                }
            });
        });
    };
    engine.data = function(graph, nodes, edges, clusters, constraints) {
        _worker.worker.postMessage({
            command: 'data',
            args: {
                layoutId: layoutEngine.layoutId(),
                graph: graph,
                nodes: nodes,
                edges: edges,
                clusters: clusters,
                constraints: constraints
            }
        });
    };
    engine.start = function() {
        _worker.worker.postMessage({
            command: 'start',
            args: {
                layoutId: layoutEngine.layoutId()
            }
        });
    };
    engine.stop = function() {
        _worker.worker.postMessage({
            command: 'stop',
            args: {
                layoutId: layoutEngine.layoutId()
            }
        });
        return this;
    };
    // stopgap while layout options are still on diagram
    engine.getEngine = function() {
        return layoutEngine;
    };
    // somewhat sketchy - do we want this object to be transparent or not?
    var passthroughs = ['layoutAlgorithm', 'populateLayoutNode', 'populateLayoutEdge',
                        'rankdir', 'ranksep'];
    passthroughs.concat(layoutEngine.optionNames(),
                        layoutEngine.passThru ? layoutEngine.passThru() : []).forEach(function(name) {
        engine[name] = function() {
            var ret = layoutEngine[name].apply(layoutEngine, arguments);
            return arguments.length ? this : ret;
        };
    });
    engine.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    engine.dispatch = function() {
        return _dispatch;
    };
    return engine;
};
