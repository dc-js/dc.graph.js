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
            var handler = dispatch[e.data.response];
            if(!handler) {
                console.error(`Worker dispatch error - missing handler for ${layoutName} layout:`, {
                    layoutId: layoutId,
                    layoutName: layoutName,
                    response: e.data.response,
                    availableEvents: Object.keys(dispatch),
                    dispatchObject: dispatch,
                    args: e.data.args,
                    fullMessage: e.data
                });
                throw new Error(`No dispatch handler for event "${e.data.response}" on layout "${layoutName}" (${layoutId})`);
            }
            handler.apply(null, e.data.args);
        };
        worker.worker.onerror = function(e) {
            console.error('Worker error:', e);
            console.error('Error details:', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                error: e.error
            });
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
    engine.init = function(options) {
        options = layoutEngine.optionNames().reduce(
            function(options, option) {
                options[option] = layoutEngine[option]();
                return options;
            }, options);
        if(layoutEngine.propagateOptions)
            layoutEngine.propagateOptions(options);
        _worker.worker.postMessage({
            command: 'init',
            args: {
                layoutId: layoutEngine.layoutId(),
                options: options
            }
        });
        return this;
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
