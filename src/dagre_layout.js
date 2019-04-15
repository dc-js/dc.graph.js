/**
 * `dc_graph.dagre_layout` is an adaptor for dagre.js layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `dagre_layout` also implements the attributes from
 * {@link dc_graph.graphviz_attrs graphviz_attrs}
 * @class dagre_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.dagre_layout}
 **/
dc_graph.dagre_layout = function(id) {
    var _layoutId = id || uuid();
    var _dagreGraph = null, _tick, _done;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};

    function init(options) {
        // Create a new directed graph
        _dagreGraph = new dagre.graphlib.Graph({multigraph: true, compound: true});

        // Set an object for the graph label
        _dagreGraph.setGraph({rankdir: options.rankdir, nodesep: options.nodesep, ranksep: options.ranksep});

        // Default to assigning a new object as a label for each new edge.
        _dagreGraph.setDefaultEdgeLabel(function() { return {}; });
    }

    function data(nodes, edges, clusters) {
        var wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            /*
              dagre does not seem to accept input positions
              if(v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
              }
             */
        }, function(k, o) {
            _dagreGraph.setNode(k, o);
        }, function(k) {
            _dagreGraph.removeNode(k);
        });
        var wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, function(k, o, e) {
            _dagreGraph.setEdge(e.dcg_edgeSource, e.dcg_edgeTarget, o);
        }, function(k, e) {
            _dagreGraph.removeEdge(e.dcg_edgeSource, e.dcg_edgeTarget, e.dcg_edgeKey);
        });
        clusters = clusters.filter(function(c) {
            return /^cluster/.test(c.dcg_clusterKey);
        });
        clusters.forEach(function(c) {
            _dagreGraph.setNode(c.dcg_clusterKey, c);
        });
        clusters.forEach(function(c) {
            if(c.dcg_clusterParent)
                _dagreGraph.setParent(c.dcg_clusterKey, c.dcg_clusterParent);
        });
        nodes.forEach(function(n) {
            if(n.dcg_nodeParentCluster)
                _dagreGraph.setParent(n.dcg_nodeKey, n.dcg_nodeParentCluster);
        });

        function dispatchState(event) {
            _dispatch[event](
                wnodes,
                wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                }),
                clusters.map(function(c) {
                    var c = Object.assign({}, _dagreGraph.node(c.dcg_clusterKey));
                    c.bounds = {
                        left: c.x - c.width/2,
                        top: c.y - c.height/2,
                        right: c.x + c.width/2,
                        bottom: c.y + c.height/2
                    };
                    return c;
                })
            );
        }
        _tick = function() {
            dispatchState('tick');
        };
        _done = function() {
            dispatchState('end');
        };
    }

    function start(options) {
        _dispatch.start();
        dagre.layout(_dagreGraph);
        _done();
    }

    function stop() {
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'dagre';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
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
        data: function(graph, nodes, edges, clusters) {
            data(nodes, edges, clusters);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return graphviz_keys;
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
};

dc_graph.dagre_layout.scripts = ['d3.js', 'dagre.js'];
