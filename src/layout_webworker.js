var _workers = {};
function create_worker(layoutAlgorithm) {
    if(!_workers[layoutAlgorithm]) {
        var worker = _workers[layoutAlgorithm] = {
            worker: new Worker(script_path() + 'dc.graph.' + layoutAlgorithm + '.worker.js'),
            layouts: {}
        };
        worker.worker.onmessage = function(e) {
            var layoutId = e.data.layoutId,
                state = e.data.state;
            if(!worker.layouts[layoutId])
                throw new Error('layoutId "' + layoutId + '" unknown!');
            switch(e.data.response) {
            case 'tick':
                worker.layouts[layoutId].dispatch().tick(state.nodes, state.edges);
                break;
            case 'end':
                worker.layouts[layoutId].dispatch().end(state.nodes, state.edges);
                break;
            case 'stop':
                worker.layouts[layoutId].dispatch().stop();
                break;
            }
        };
    }
    return _workers[layoutAlgorithm];
}

dc_graph.layout_webworker = function(layoutEngine) {
    var _tick, _done, _dispatch = d3.dispatch('init', 'start', 'tick', 'end');
    var _worker = create_worker(layoutEngine.layoutAlgorithm());
    var engine = {};
    _worker.layouts[layoutEngine.layoutId()] = engine;

    // switch(_chart.layoutAlgorithm()) {
    // case 'cola':
    //     Object.assign(args, {
    //         handleDisconnected: _chart.handleDisconnected(),
    //         lengthStrategy: _chart.lengthStrategy(),
    //         baseLength: _chart.baseLength(),
    //         flowLayout: _chart.flowLayout(),
    //         tickSize: _chart.tickSize()
    //     });
    //     break;
    // case 'dagre':
    //     Object.assign(args, {
    //         rankdir: _chart.rankdir()
    //     });
    // }
    engine.init = function(options) {
        options = layoutEngine.optionNames().reduce(
            function(options, option) {
                options[option] = layoutEngine[option]();
                return options;
            }, options);
        _worker.worker.postMessage({
            command: 'init',
            args: {
                layoutId: layoutEngine.layoutId(),
                options: options
            }
        });
        return this;
    };
    engine.data = function(nodes, edges, constraints, options) {
        _worker.worker.postMessage({
            command: 'data',
            args: {
                layoutId: layoutEngine.layoutId(),
                nodes: nodes,
                edges: edges,
                constraints: constraints,
                options: options
            }
        });
    };
    engine.start = function(options) {
        _worker.worker.postMessage({
            command: 'start',
            args: {
                layoutId: layoutEngine.layoutId(),
                options: options
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
    engine.on = function(event, f) {
        _dispatch.on(event, f);
        return this;
    };
    engine.dispatch = function() {
        return _dispatch;
    };
    return engine;
};
