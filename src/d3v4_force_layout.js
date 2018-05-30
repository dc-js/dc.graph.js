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
    var _options = null;
    var _paths = null;

    function init(options) {
        _options = options;

        _simulation = d3v4.forceSimulation()
            .force('link', d3v4.forceLink())
            .force('center', d3v4.forceCenter(options.width / 2, options.height / 2))
            .force('gravityX', d3v4.forceX(options.width / 2).strength(_options.gravityStrength))
            .force('gravityY', d3v4.forceY(options.height / 2).strength(_options.gravityStrength))
            .force('collision', d3v4.forceCollide(_options.collisionRadius))
            .force('charge', d3v4.forceManyBody())
            .stop();
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
                v1.fx = v.dcg_nodeFixed.x;
                v1.fy = v.dcg_nodeFixed.y;
            } else v1.fx = v1.fy = null;
        });

        _wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.source = nodeIDs[_nodes[e.dcg_edgeSource].dcg_nodeKey];
            e1.target = nodeIDs[_nodes[e.dcg_edgeTarget].dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.nodes(_wnodes);
        _simulation.force('link').links(_wedges);
    }

    function start() {
        _dispatch.start();
        installForces(_paths);
        runSimulation(_options.iterations);
    }

    function stop() {
        // not running asynchronously, no _simulation.stop();
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
                _nodes[key].fx = data[key].x;
                _nodes[key].fy = data[key].y;
            }
        });
    }
    function installForces(paths) {
        if(paths === null) {
            _simulation.force('charge').strength(_options.initialCharge);
            _simulation.force('angle', null);
        } else {
            var nodesOnPath;
            if(_options.fixOffPathNodes) {
                nodesOnPath = d3.set();
                paths.forEach(function(path) {
                    path.forEach(function(nid) {
                        nodesOnPath.add(nid);
                    });
                });
            }

            // fix nodes not on paths
            Object.keys(_nodes).forEach(function(key) {
                if(_options.fixOffPathNodes && !nodesOnPath.has(key)) {
                    _nodes[key].fx = _nodes[key].x;
                    _nodes[key].fy = _nodes[key].y;
                } else {
                    _nodes[key].fx = null;
                    _nodes[key].fy = null;
                }
            });

            _simulation.force('charge').strength(_options.chargeForce);
            _simulation.force('angle', function(alpha) {
                angleForces(alpha, paths, _options.angleForce);
            });
        }
    };

    function runSimulation(iterations) {
        _simulation.alpha(1);
        for (var i = 0; i < iterations; ++i) {
            _simulation.tick();
            dispatchState('tick');
        }
        dispatchState('end');
    }

    function angleForces(alpha, paths, k) {
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

        function _displaceAdjacent(node, angle, pVec, k) {
            return {
                x: pVec.x*(Math.PI-angle)*k,
                y: pVec.y*(Math.PI-angle)*k
            };
        }

        function _displaceCenter(dadj1, dadj2) {
            return {
                x: -(dadj1.x + dadj2.x),
                y: -(dadj1.y + dadj2.y)
            };
        }

        function _offsetNode(node, disp) {
            node.x += disp.x;
            node.y += disp.y;
        }
        var report = [];
        paths.forEach(function(path, i) {
            // ignore path where any nodes have gone away
            if(!path.every(function(k) { return _nodes[k]; }))
                return;
            if(path.length < 3) return; // at least 3 nodes (and 2 edges):  A->B->C
            report.push({
                delay: 3000,
                nodes: path.map(function(n) {
                    return {
                        id: n,
                        x: _nodes[n].x,
                        y: _nodes[n].y
                    };
                }),
                edges: path.reduce(function(p, n) {
                    if(typeof p === 'string')
                        return [{source: p, target: n}];
                    p.push({source: p[p.length-1].target, target: n});
                    return p;
                })
            });
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
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.x};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.x};

                // modify positions of nodes
                var prevDisp = _displaceAdjacent(prev, angle, pvecPrev, k);
                var nextDisp = _displaceAdjacent(next, angle, pvecNext, k);
                var centerDisp = _displaceCenter(prevDisp, nextDisp);
                report.push({
                    delay: 1000,
                    nodes: [{
                        id: path[i-1],
                        x: prev.x,
                        y: prev.y,
                        force: prevDisp
                    }, {
                        id: path[i],
                        x: current.x,
                        y: current.y,
                        force: centerDisp
                    }, {
                        id: path[i+1],
                        x: next.x,
                        y: next.y,
                        force: nextDisp
                    }],
                    edges: [{
                        source: path[i-1],
                        target: path[i],
                    }, {
                        source: path[i],
                        target: path[i+1]
                    }]
                });
                _offsetNode(prev, prevDisp);
                _offsetNode(next, nextDisp);
                _offsetNode(current, centerDisp);
            }
        });
        return report;
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'd3v4-force';
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
            return ['iterations', 'angleForce', 'chargeForce', 'gravityStrength', 'collisionRadius',
                    'initialCharge', 'fixOffPathNodes']
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.01),
        chargeForce: property(-600),
        gravityStrength: property(0.3),
        collisionRadius: property(8),
        initialCharge: property(-100),
        fixOffPathNodes: property(false),
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    return engine;
};

dc_graph.d3v4_force_layout.scripts = ['d3.js', 'd3v4-force.js'];
