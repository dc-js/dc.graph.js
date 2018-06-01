/**
 * `dc_graph.d3_force_layout` is an adaptor for d3-force layouts in dc.graph.js
 * @class d3_force_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.d3_force_layout}
 **/
dc_graph.d3_force_layout = function(id) {
    var _layoutId = id || uuid();
    var _simulation = null; // d3-force simulation
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};
    var _wnodes = [], _wedges = [];
    var _options = null;
    var _paths = null;

    function init(options) {
        _options = options;

        _simulation = d3.layout.force()
            .size([options.width, options.height]);

        _simulation.on('tick', /* _tick = */ function() {
            dispatchState('tick');
        }).on('start', function() {
            _dispatch.start();
        }).on('end', /* _done = */ function() {
            dispatchState('end');
        });
    }

    function dispatchState(event) {
        _dispatch[event](
            _wnodes,
            _wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }

    function data(nodes, edges, constraints) {
        var nodeIDs = {};
        nodes.forEach(function(d, i) {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.id = v.dcg_nodeKey;
            if(v.dcg_nodeFixed) {
                v1.fixed = true;
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            } else v1.fixed = false;
        });

        _wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[e.dcg_edgeSource];
            e1.source.id = nodeIDs[e1.source.dcg_nodeKey];
            e1.target = _nodes[e.dcg_edgeTarget];
            e1.target.id = nodeIDs[e1.target.dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.nodes(_wnodes);
        _simulation.links(_wedges);
    }

    function start() {
        installForces();
        runSimulation(_options.iterations);
    }

    function stop() {
        if(_simulation)
            _simulation.stop();
    }

    function savePositions() {
        var data = {};
        Object.keys(_nodes).forEach(function(key) {
            data[key] = {x: _nodes[key].x, y: _nodes[key].y};
        });
        return data;
    }

    function restorePositions(data) {
        Object.keys(data).forEach(function(key) {
            if(_nodes[key]) {
                _nodes[key].fixed = false;
                _nodes[key].x = data[key].x;
                _nodes[key].y = data[key].y;
            }
        });
    }

    function installForces() {
        if(_paths === null)
            _simulation.gravity(_options.gravityStrength)
                .charge(_options.initialCharge);
        else {
            if(_options.fixOffPathNodes) {
                var nodesOnPath = d3.set(); // nodes on path
                _paths.forEach(function(path) {
                    path.forEach(function(nid) {
                        nodesOnPath.add(nid);
                    });
                });

                // fix nodes not on paths
                Object.keys(_nodes).forEach(function(key) {
                    if(!nodesOnPath.has(key)) {
                        _nodes[key].fixed = true;
                    } else {
                        _nodes[key].fixed = false;
                    }
                });
            }

            // enlarge charge force to separate nodes on paths
            _simulation.charge(_options.chargeForce);
        }
    };

    function runSimulation(iterations) {
        if(!iterations) {
            dispatchState('end');
            return;
        }
        _simulation.start();
        for (var i = 0; i < 300; ++i) {
            _simulation.tick();
            if(_paths)
                applyPathAngleForces();
        }
        _simulation.stop();
    }

    function applyPathAngleForces() {
        function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; };
        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); };
        function _angle(v1, v2) {
            var a = _dot(v1, v2) / (_len(v1)*_len(v2));
            a = Math.min(a, 1);
            a = Math.max(a, -1);
            return Math.acos(a);
        };
        // perpendicular unit length vector
        function _pVec(v) {
            var xx = -v.y/v.x, yy = 1;
            var length = _len({x: xx, y: yy});
            return {x: xx/length, y: yy/length};
        };

        function updateNode(node, angle, pVec, alpha) {
            node.x += pVec.x*(Math.PI-angle)*alpha;
            node.y += pVec.y*(Math.PI-angle)*alpha;
        }

        _paths.forEach(function(path) {
            if(path.length < 3) return; // at least 3 nodes (and 2 edges):  A->B->C
            for(var i = 1; i < path.length-1; ++i) {
                var current = _nodes[path[i]];
                var prev = _nodes[path[i-1]];
                var next = _nodes[path[i+1]];

                // calculate the angle
                var vPrev = {x: prev.x - current.x, y: prev.y - current.y};
                var vNext = {x: next.x - current.x, y: next.y - current.y};

                var angle = _angle(vPrev, vNext); // angle in [0, PI]

                var pvecPrev = _pVec(vPrev);
                var pvecNext = _pVec(vNext);

                // make sure the perpendicular vector is in the
                // direction that makes the angle more towards 180 degree
                // 1. calculate the middle point of node 'prev' and 'next'
                var mid = {x: (prev.x+next.x)/2.0, y: (prev.y+next.y)/2.0};
                // 2. calculate the vectors: 'prev' pointing to 'mid', 'next' pointing to 'mid'
                var prev_mid = {x: mid.x-prev.x, y: mid.y-prev.y};
                var next_mid = {x: mid.x-next.x, y: mid.y-next.y};
                // 3. the 'correct' vector: the angle between pvec and prev_mid(next_mid) should
                //    be an obtuse angle
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.y};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.y};

                // modify positions of prev and next
                updateNode(prev, angle, pvecPrev, _options.angleForce);
                updateNode(next, angle, pvecNext, _options.angleForce);
            }

        });
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'd3-force';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges, constraints) {
            data(nodes, edges, constraints);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        paths: function(paths) {
            _paths = paths;
        },
        savePositions: savePositions,
        restorePositions: restorePositions,
        optionNames: function() {
            return ['iterations', 'angleForce', 'chargeForce', 'gravityStrength',
                    'initialCharge', 'fixOffPathNodes']
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.02),
        chargeForce: property(-500),
        gravityStrength: property(1.0),
        initialCharge: property(-400),
        fixOffPathNodes: property(false),
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    return engine;
};

dc_graph.d3_force_layout.scripts = ['d3.js'];
