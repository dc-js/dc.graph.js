importScripts('cola.js');
importScripts('d3.js');

var _d3cola = null, _tick, _stop;

function init_d3cola(width, height, handleDisconnected, lengthStrategy, baseLength, flowLayout, tickSize) {
    _d3cola = cola.d3adaptor()
        .avoidOverlaps(true)
        .size([width, height])
        .handleDisconnected(handleDisconnected);
    if(_d3cola.tickSize) // non-standard
        _d3cola.tickSize(tickSize);

    switch(lengthStrategy) {
        case 'symmetric':
            _d3cola.symmetricDiffLinkLengths(baseLength);
            break;
        case 'jaccard':
            _d3cola.jaccardLinkLengths(baseLength);
            break;
        case 'individual':
            _d3cola.linkDistance(function(e) {
                return e.dcg_edgeLength || baseLength;
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

function data_d3cola(nodes, edges, constraints, opts) {
    var wnodes = regenerate_objects(_nodes, nodes, function(v) {
        return v.dcg_nodeKey;
    }, function(v1, v) {
        v1.dcg_nodeKey = v.dcg_nodeKey;
        v1.width = v.width;
        v1.height = v.height;
        v1.fixed = !!v.dcg_nodeFixed;

        if(typeof v.dcg_nodeFixed === 'object') {
            v1.x = v.dcg_nodeFixed.x;
            v1.y = v.dcg_nodeFixed.y;
        }
        else {
            // should we support e.g. null to unset x,y?
            if(v.x !== undefined)
                v1.x = v.x;
            if(v.y !== undefined)
                v1.y = v.y;
        }
    });
    var wedges = regenerate_objects(_edges, edges, function(e) {
        return e.dcg_edgeKey;
    }, function(e1, e) {
        e1.dcg_edgeKey = e.dcg_edgeKey;
        // cola edges can work with indices or with object references
        // but it will replace indices with object references
        e1.source = _nodes[e.dcg_edgeSource];
        e1.target = _nodes[e.dcg_edgeTarget];
        e1.dcg_edgeLength = e.dcg_edgeLength;
    });

    // cola needs each node object to have an index property
    wnodes.forEach(function(v, i) {
        v.index = i;
    });

    var groups = null;
    if(opts.groupConnected) {
        var components = cola.separateGraphs(wnodes, wedges);
        groups = components.map(function(g) {
            return {leaves: g.array.map(function(n) { return n.index; })};
        });
    }

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
    _d3cola.on('tick', _tick = function() {
        postResponseState('tick');
    }).on('start', function() {
        postMessage({response: 'start'});
    }).on('end', _stop = function() {
        postResponseState('end');
    });
    _d3cola.nodes(wnodes)
        .links(wedges)
        .constraints(constraints)
        .groups(groups);
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
                    args.lengthStrategy, args.baseLength, args.flowLayout,
                    args.tickSize);
        break;
    case 'data':
        data_d3cola(args.nodes, args.edges, args.constraints, args.opts);
        break;
    case 'start':
        if(args.initialOnly) {
            if(args.showLayoutSteps)
                _tick();
            _stop();
        }
        else
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

