importScripts('cola.js');
importScripts('d3.js');

var _d3cola = null;

function init_d3cola(width, height, handleDisconnected, lengthStrategy, baseLength, flowLayout) {
    _d3cola = cola.d3adaptor()
        .avoidOverlaps(true)
        .size([width, height])
        .handleDisconnected(handleDisconnected);

    switch(lengthStrategy) {
        case 'symmetric':
            _d3cola.symmetricDiffLinkLengths(baseLength);
            break;
        case 'jaccard':
            _d3cola.jaccardLinkLengths(baseLength);
            break;
        case 'individual':
            _d3cola.linkDistance(function(e) {
                var d = e.orig ? e.dcg_edgeLength :
                        e.internal && e.internal.distance;
                return d || baseLength;
            });
            break;
        case 'none':
        default:
    }
    if(flowLayout) {
        _d3cola.flowLayout(flowLayout.axis, flowLayout.minSeparation);
    }

}

// node and edge objects shared with cola.js, preserved from one iteration
// to the next (as long as the object is still in the layout)
var _nodes = {}, _edges = {};

function data_d3cola(nodes, edges, constraints) {
    // create or re-use the objects cola.js will manipulate
    function wrap_node(v) {
        var key = v.dcg_nodeKey;
        if(!_nodes[key]) _nodes[key] = {};
        var v1 = _nodes[key];
        v1.width = v.width;
        v1.height = v.height;
        if(v.dcg_nodeFixed) {
            v1.x = v.x;
            v1.y = v.y;
            v1.fixed = true;
        }
        else
            v1.fixed = false;
        keep_node[key] = true;
        return v1;
    }
    function wrap_edge(e) {
        var key = e.dcg_edgeKey;
        if(!_edges[key]) _edges[key] = {};
        var e1 = _edges[key];
        // cola edges can work with indices or with object references
        // but it will replace indices with object references
        e1.source = _nodes[e.dcg_edgeSource];
        e1.target = _nodes[e.dcg_edgeTarget];
        keep_edge[key] = true;
        return e1;
    }

    // delete any objects from last round that are no longer used
    // this is mostly so cola.js won't get confused by old attributes
    var keep_node = {}, keep_edge = {};
    var wnodes = nodes.map(wrap_node);
    for(var vk in _nodes)
        if(!keep_node[vk])
            delete _nodes[vk];
    var wedges = edges.map(wrap_edge);
    for(var ek in _edges)
        if(!keep_edge[ek])
            delete _edges[ek];

    // cola needs each node object to have an index property
    wnodes.forEach(function(v, i) {
        v.index = i;
    });

    function postResponseState(response) {
        postMessage({
            response: response,
            args: {
                nodes: wnodes,
                edges: wedges
            }
        });
    }
    _d3cola.on('tick', function() {
        postResponseState('tick');
    }).on('start', function() {
        postMessage({response: 'start'});
    }).on('end', function() {
        postResponseState('end');
    });
    _d3cola.nodes(wnodes)
        .links(wedges)
        .constraints(constraints);
}

function start_d3cola(initialUnconstrainedIterations,
                      initialUserConstraintIterations,
                      initialAllConstraintsIterations,
                      gridSnapIterations) {
    _d3cola.start(initialUnconstrainedIterations,
                  initialUserConstraintIterations,
                  initialAllConstraintsIterations,
                  gridSnapIterations);
}

function stop_d3cola() {
    _d3cola.stop();
}

onmessage = function(e) {
    var args = e.data.args;
    switch(e.data.command) {
    case 'init':
        init_d3cola(args.width, args.height, args.handleDisconnected,
                    args.lengthStrategy, args.baseLength, args.flowLayout);
        break;
    case 'data':
        data_d3cola(args.nodes, args.edges, args.constraints);
        break;
    case 'start':
        start_d3cola(args.initialUnconstrainedIterations,
                     args.initialUserConstraintIterations,
                     args.initialAllConstraintsIterations,
                     args.gridSnapIterationse);
        break;
    case 'stop':
        stop_d3cola();
        break;
    }
};

