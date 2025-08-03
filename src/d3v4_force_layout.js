/**
 * D3 v4 force layout adaptor for dc.graph.js
 * @module d3v4_force_layout
 */

// External dependencies
import { dispatch } from 'd3-dispatch';
import { set } from 'd3-collection';
import { forceSimulation, forceLink, forceCenter, forceX, forceY, forceCollide, forceManyBody } from 'd3-force';
import { forceStraightenPaths } from 'd3-force-straighten-paths';
import { uuid, property } from './core.js';
import { regenerateObjects } from './generate_objects.js';
import { graphvizAttrs } from './graphviz_attrs.js';

/**
 * `d3v4ForceLayout` is an adaptor for d3-force version 4 layouts in dc.graph.js
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} d3v4 force layout engine
 **/
export function d3v4ForceLayout(id) {
    var _layoutId = id || uuid();
    var _simulation = null; // d3-force simulation
    var _dispatch = dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};
    var _wnodes = [], _wedges = [];
    var _options = null;
    var _paths = null;

    function init(options) {
        _options = options;

        _simulation = forceSimulation()
            .force('link', forceLink())
            .force('center', forceCenter(options.width / 2, options.height / 2))
            .force('gravityX', forceX(options.width / 2).strength(_options.gravityStrength))
            .force('gravityY', forceY(options.height / 2).strength(_options.gravityStrength))
            .force('collision', forceCollide(_options.collisionRadius))
            .force('charge', forceManyBody())
            .stop();
    }

    function dispatchState(event) {
        _dispatch.call(event, null,
            _wnodes,
            (_wedges || []).map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }

    function data(nodes, edges) {
        var nodeIDs = {};
        nodes.forEach(function(d, i) {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerateObjects(_nodes, nodes, null, function(v) {
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

        _wedges = regenerateObjects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.source = nodeIDs[_nodes[e.dcg_edgeSource].dcg_nodeKey];
            e1.target = nodeIDs[_nodes[e.dcg_edgeTarget].dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.force('straighten', null);
        _simulation.nodes(_wnodes);
        _simulation.force('link').links(_wedges);
    }

    function start() {
        _dispatch.call("start");
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
        if(paths)
            paths = paths.filter(function(path) {
                return path.nodes.every(function(nk) { return _nodes[nk]; });
            });
        if(paths === null || !paths.length) {
            _simulation.force('charge').strength(_options.initialCharge);
        } else {
            var nodesOnPath;
            if(_options.fixOffPathNodes) {
                nodesOnPath = set();
                paths.forEach(function(path) {
                    path.nodes.forEach(function(nid) {
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
            _simulation.force('straighten', forceStraightenPaths()
                              .id(function(n) { return n.dcg_nodeKey; })
                              .angleForce(_options.angleForce)
                              .pathNodes(function(p) { return p.nodes; })
                              .pathStrength(function(p) { return p.strength; })
                              .paths(paths));
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

    var graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);

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
        supportsMoving: function() {
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
    engine.pathStraightenForce = engine.angleForce;
    return engine;
};

// Scripts needed for web worker
d3v4ForceLayout.scripts = ['d3.js', 'd3v4-force.js'];
