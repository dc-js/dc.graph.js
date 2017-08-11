/**
 * `dc_graph.d3v4_force_layout` is an adaptor for d3-force version 4 layouts in dc.graph.js
 * @class d3v4_force_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.d3v4_force_layout}
 **/
dc_graph.d3v4_force_layout = function(id) {
    var _layoutId = id || uuid();
    var _simulation = null; // d3-force simulation
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};
    var _wnodes = [], _wedges = [];
    var _originalNodesPosition = {};
    var _options = null;
    var _paths = null;
    var _initialized = false;

    function init(options) {
        _options = options;

        _simulation = d3v4.forceSimulation()
            .force("link", d3v4.forceLink())
            .force("center", d3v4.forceCenter(options.width / 2, options.height / 2))
            .force('gravityX', d3v4.forceX(options.width / 2).strength(_options.gravityStrength))
            .force('gravityY', d3v4.forceY(options.height / 2).strength(_options.gravityStrength))
            .stop();

        _simulation.on('tick', /* _tick = */ function() {
            dispatchState('tick');
        }).on('end', /* _done = */ function() {
            dispatchState('end');
        });

        resetSim();
    }

    function dispatchState(event) {
        _dispatch[event](
            _wnodes,
            _wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }

    function resetSim() {
        _simulation.force("charge", d3v4.forceManyBody().strength(_options.initialCharge));
        _simulation.force('collision', d3v4.forceCollide(_options.collisionRadius));
        _simulation.force('angle', null);
    }

    function data(nodes, edges, constraints, options) {
        var nodeIDs = {};
        nodes.forEach(function(d, i) {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerate_objects(_nodes, nodes, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.id = v.dcg_nodeKey;
        });

        _wedges = regenerate_objects(_edges, edges, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.source = nodeIDs[_nodes[e.dcg_edgeSource].dcg_nodeKey];
            e1.target= nodeIDs[_nodes[e.dcg_edgeTarget].dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.nodes(_wnodes);
        _simulation.force('link').links(_wedges);
    }

    function start(options) {
        _dispatch.start();
        runSimulation();

        _initialized = true;
        //store original positions
        Object.keys(_nodes).forEach(function(key) {
            _originalNodesPosition[key] = {'x': _nodes[key].x, 'y': _nodes[key].y};
        });
    }

    function stop() {
        _simulation.stop();
        dispatchState('end');
    }

    function relayout(paths) {
        if(paths === null) {
            if(_initialized) {
                Object.keys(_nodes).forEach(function(key) {
                    _nodes[key].fx = _originalNodesPosition[key].x;
                    _nodes[key].fy = _originalNodesPosition[key].y;
                });
                runSimulation(1);
            }
        } else {
            var nodeIDs = []; // nodes on path
            paths.forEach(function(path) {
                path.element_list.forEach(function(d) {
                    if( d.element_type === 'node') {
                        nodeIDs.push(d.property_map.ecomp_uid);
                    }
                });
            });

            // fix nodes not on paths
            Object.keys(_nodes).forEach(function(key) {
                //if(!nodeIDs.includes(key)) {
                    //_nodes[key].fx = _originalNodesPosition[key].x;
                    //_nodes[key].fy = _originalNodesPosition[key].y;
                //} else {
                    //_nodes[key].fx = null;
                    //_nodes[key].fy = null;
                //}
                _nodes[key].fx = null;
                _nodes[key].fy = null;
            });

            _simulation.force("link", d3v4.forceLink())
            .force("center", d3v4.forceCenter(_options.width / 2, _options.height / 2))
            .force('gravityX', d3v4.forceX(_options.width / 2).strength(_options.gravityStrength))
            .force('gravityY', d3v4.forceY(_options.height / 2).strength(_options.gravityStrength));
            _simulation.force("charge", d3v4.forceManyBody().strength(_options.chargeForce));
            _simulation.force('angle', function(alpha) {
                angleForces(alpha, paths, _options.angleForce);
            });
            runSimulation();
        }

        resetSim();
    };

    function runSimulation(iterations) {
        var iterations = iterations || 300;
        for (var i = 0; i < iterations; ++i) {
            _simulation.tick();
        }
        stop();
    }

    function angleForces(alpha, paths, k) {

        function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; };
        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); };
        function _angle(v1, v2) {
            var a = _dot(v1,v2) / (_len(v1)*_len(v2));
            a = Math.min(a, 1);
            a = Math.max(a, -1);
            return Math.acos(a);
        };
        // perpendicular unit length vector
        function _pVec(v) {
            var xx = -v.y/v.x, yy = 1;
            var length = _len({'x':xx, 'y':yy});
            return {'x': xx/length, 'y': yy/length};
        };

        function updateNode(node, angle, pVec, k) {
            node.x += pVec.x*(Math.PI-angle)*k;
            node.y += pVec.y*(Math.PI-angle)*k;
        }

        paths.forEach(function(path) {
            if(path.element_list.length < 5) return; // at leaset 3 nodes and 2 edges:  A->B->C
            for(var i = 2; i < path.element_list.length-2; i += 2) {
                var current = _nodes[path.element_list[i].property_map.ecomp_uid];
                var prev = _nodes[path.element_list[i-2].property_map.ecomp_uid];
                var next = _nodes[path.element_list[i+2].property_map.ecomp_uid];

                // calculate the angle
                var vPrev = {'x': prev.x - current.x, 'y': prev.y - current.y};
                var vNext = {'x': next.x - current.x, 'y': next.y - current.y};

                var angle = _angle(vPrev, vNext); // angle in [0, PI]

                var pvecPrev = _pVec(vPrev);
                var pvecNext = _pVec(vNext);

                // make sure the perpendicular vector is in the
                // direction that makes the angle more towards 180 degree
                // 1. calculate the middle point of node 'prev' and 'next'
                var mid = {'x': (prev.x+next.x)/2.0, 'y': (prev.y+next.y)/2.0 };
                // 2. calculate the vectors: 'prev' pointing to 'mid', 'next' pointing to 'mid'
                var prev_mid = {'x': mid.x-prev.x, 'y': mid.y-prev.y};
                var next_mid = {'x': mid.x-next.x, 'y': mid.y-next.y};
                // 3. the 'correct' vector: the angle between pvec and prev_mid(next_mid) should
                //    be an obtuse angle
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {'x': -pvecPrev.x, 'y': -pvecPrev.x};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {'x': -pvecNext.x, 'y': -pvecNext.x};

                // modify positions of prev and next
                updateNode(prev, angle, pvecPrev, k);
                updateNode(next, angle, pvecNext, k);
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
        parent: property(null),
        on: function(event, f) {
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
        data: function(nodes, edges, constraints, options) {
            data(nodes, edges, constraints, options);
        },
        start: function(options) {
            start(options);
        },
        stop: function() {
            stop();
        },
        relayout: function() {
            relayout(_paths);
        },
        paths: function(paths) {
            _paths = paths;
        },
        optionNames: function() {
            return ['angleForce', 'chargeForce', 'gravityStrength', 'collisionRadius',
                    'initialCharge']
                .concat(graphviz_keys);
        },
        angleForce: property(0.01),
        chargeForce: property(-600),
        gravityStrength: property(0.3),
        collisionRadius: property(8),
        initialCharge: property(-100),
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    return engine;
};

dc_graph.d3v4_force_layout.scripts = ['d3.js'];
