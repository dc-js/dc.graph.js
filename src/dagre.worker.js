importScripts('dagre.js');

var _dagreGraph = null, _tick, _done;

function init_dagre(width, height, rankdir) {
    // Create a new directed graph
    _dagreGraph = new dagre.graphlib.Graph();

    // Set an object for the graph label
    _dagreGraph.setGraph({rankdir: rankdir});

    // Default to assigning a new object as a label for each new edge.
    _dagreGraph.setDefaultEdgeLabel(function() { return {}; });
}

// node and edge objects shared with cola.js, preserved from one iteration
// to the next (as long as the object is still in the layout)
var _nodes = {}, _edges = {};

function data_dagre(nodes, edges, constraints, opts) {
    var wnodes = regenerate_objects(_nodes, nodes, function(v) {
        return v.dcg_nodeKey;
    }, function(v1, v) {
        v1.dcg_nodeKey = v.dcg_nodeKey;
        v1.width = v.width;
        v1.height = v.height;
    }, function(k, o) {
        _dagreGraph.setNode(k, o);
    }, function(k) {
        _dagreGraph.removeNode(k);
    });
    var wedges = regenerate_objects(_edges, edges, function(e) {
        return e.dcg_edgeKey;
    }, function(e1, e) {
        e1.dcg_edgeKey = e.dcg_edgeKey;
        e1.dcg_edgeSource = e.dcg_edgeSource;
        e1.dcg_edgeTarget = e.dcg_edgeTarget;
    }, function(k, o, e) {
        _dagreGraph.setEdge(e.dcg_edgeSource, e.dcg_edgeTarget, o);
    }, function(k, e) {
        _dagreGraph.removeEdge(e.dcg_edgeSource, e.dcg_edgeTarget);
    });

    function postResponseState(response) {
        postMessage({
            response: response,
            args: {
                nodes: wnodes,
                edges: wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                })
            }
        });
    }
    _tick = function() {
        postResponseState('tick');
    };
    _done = function() {
        postResponseState('end');
    };
}

function start_dagre(initialUnconstrainedIterations,
                      initialUserConstraintIterations,
                      initialAllConstraintsIterations,
                     gridSnapIterations) {
    postMessage({response: 'start'});
    dagre.layout(_dagreGraph);
    _done();
}

function stop_dagre() {
}

onmessage = function(e) {
    var args = e.data.args;
    switch(e.data.command) {
    case 'init':
        init_dagre(args.width, args.height, args.rankdir);
        break;
    case 'data':
        data_dagre(args.nodes, args.edges, args.constraints, args.opts);
        break;
    case 'start':
        if(args.initialOnly) {
            if(args.showLayoutSteps)
                _tick();
            _done();
        }
        else
            start_dagre(args.initialUnconstrainedIterations,
                         args.initialUserConstraintIterations,
                         args.initialAllConstraintsIterations,
                         args.gridSnapIterationse);
        break;
    case 'stop':
        stop_dagre();
        break;
    }
};

