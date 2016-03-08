/*!
 *  dc.graph 0.1.1
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2016 AT&T Intellectual Property & the dc.graph.js Developers
 *  https://github.com/dc-js/dc.graph.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */
// create or re-use objects in a map, delete the ones that were not reused
function regenerate_objects(preserved, list, key, assign) {
    var keep = {};
    function wrap(o) {
        var k = key(o);
        if(!preserved[k]) preserved[k] = {};
        var o1 = preserved[k];
        assign(o1, o);
        keep[k] = true;
        return o1;
    }
    var wlist = list.map(wrap);
    // delete any objects from last round that are no longer used
    for(var k in preserved)
        if(!keep[k])
            delete preserved[k];
    return wlist;
}

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

function data_d3cola(nodes, edges, constraints) {
    var wnodes = regenerate_objects(_nodes, nodes, function(v) {
        return v.dcg_nodeKey;
    }, function(v1, v) {
        v1.dcg_nodeKey = v.dcg_nodeKey;
        v1.width = v.width;
        v1.height = v.height;
        if(v.dcg_nodeFixed) {
            v1.x = v.x;
            v1.y = v.y;
            v1.fixed = true;
        }
        else
            v1.fixed = false;
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


//# sourceMappingURL=dc.graph-worker.js.map