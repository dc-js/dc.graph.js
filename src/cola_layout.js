/**
 * `dc_graph.cola_layout` is an adaptor for cola.js layouts in dc.graph.js
 * @class cola_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.cola_layout}
 **/
dc_graph.cola_layout = function(id) {
    var _layoutId = id || uuid();
    var _d3cola = null;
    var _setcola_nodes;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _flowLayout;
    // node and edge objects shared with cola.js, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};
    var _options;

    function init(options) {
        _options = options;
        _d3cola = cola.d3adaptor()
            .avoidOverlaps(true)
            .size([options.width, options.height])
            .handleDisconnected(options.handleDisconnected);

        if(_d3cola.tickSize) // non-standard
            _d3cola.tickSize(options.tickSize);

        switch(options.lengthStrategy) {
        case 'symmetric':
            _d3cola.symmetricDiffLinkLengths(options.baseLength);
            break;
        case 'jaccard':
            _d3cola.jaccardLinkLengths(options.baseLength);
            break;
        case 'individual':
            _d3cola.linkDistance(function(e) {
                return e.dcg_edgeLength || options.baseLength;
            });
            break;
        case 'none':
        default:
        }
        if(options.flowLayout) {
            _d3cola.flowLayout(options.flowLayout.axis, options.flowLayout.minSeparation);
        }
    }

    function data(nodes, edges, clusters, constraints) {
        var wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.dcg_nodeParentCluster = v.dcg_nodeParentCluster;
            v1.width = v.width;
            v1.height = v.height;
            v1.fixed = !!v.dcg_nodeFixed;
            _options.nodeAttrs.forEach(function(key) {
                v1[key] = v[key];
            });

            if(v1.fixed && typeof v.dcg_nodeFixed === 'object') {
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
        var wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[e.dcg_edgeSource];
            e1.target = _nodes[e.dcg_edgeTarget];
            e1.dcg_edgeLength = e.dcg_edgeLength;
            _options.edgeAttrs.forEach(function(key) {
                e1[key] = e[key];
            });
        });

        // cola needs each node object to have an index property
        wnodes.forEach(function(v, i) {
            v.index = i;
        });

        var groups = null;
        if(engine.groupConnected()) {
            var components = cola.separateGraphs(wnodes, wedges);
            groups = components.map(function(g) {
                return {
                    dcg_autoGroup: true,
                    leaves: g.array.map(function(n) { return n.index; })
                };
            });
        } else if(clusters) {
            var G = {};
            groups = clusters.filter(function(c) {
                return /^cluster/.test(c.dcg_clusterKey);
            }).map(function(c, i) {
                return G[c.dcg_clusterKey] = {
                    dcg_clusterKey: c.dcg_clusterKey,
                    index: i,
                    groups: [],
                    leaves: []
                };
            });
            clusters.forEach(function(c) {
                if(c.dcg_clusterParent && G[c.dcg_clusterParent])
                    G[c.dcg_clusterParent].groups.push(G[c.dcg_clusterKey].index);
            });
            wnodes.forEach(function(n, i) {
                if(n.dcg_nodeParentCluster && G[n.dcg_nodeParentCluster])
                    G[n.dcg_nodeParentCluster].leaves.push(i);
            });
        }

        function dispatchState(event) {
            // clean up extra setcola annotations
            wnodes.forEach(function(n) {
                Object.keys(n).forEach(function(key) {
                    if(/^get/.test(key) && typeof n[key] === 'function')
                        delete n[key];
                });
            });
            _dispatch[event](
                wnodes,
                wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                }),
                groups.filter(function(g) {
                    return !g.dcg_autoGroup;
                }).map(function(g) {
                    g = Object.assign({}, g);
                    g.bounds = {
                        left: g.bounds.x,
                        top: g.bounds.y,
                        right: g.bounds.X,
                        bottom: g.bounds.Y
                    };
                    return g;
                }),
                _setcola_nodes
            );
        }
        _d3cola.on('tick', /* _tick = */ function() {
            dispatchState('tick');
        }).on('start', function() {
            _dispatch.start();
        }).on('end', /* _done = */ function() {
            dispatchState('end');
        });

        if(_options.setcolaSpec && typeof setcola !== 'undefined') {
            console.log('generating setcola constrains');
            var setcola_result = setcola
                .nodes(wnodes)
                .links(wedges)
                .constraints(_options.setcolaSpec)
                .gap(10) //default value is 10, can be customized in setcolaSpec
                .layout();

            _setcola_nodes = setcola_result.nodes.filter(function(n) { return n._cid; });
            _d3cola.nodes(setcola_result.nodes)
                .links(setcola_result.links)
                .constraints(setcola_result.constraints)
                .groups(groups);
        } else {
            _d3cola.nodes(wnodes)
                .links(wedges)
                .constraints(constraints)
                .groups(groups);
        }

    }

    function start() {
        _d3cola.start(engine.unconstrainedIterations(),
                      engine.userConstraintIterations(),
                      engine.allConstraintsIterations(),
                      engine.gridSnapIterations());
    }

    function stop() {
        if(_d3cola)
            _d3cola.stop();
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    graphviz.rankdir(null);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'cola';
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
            this.propagateOptions(options);
            init(options);
            return this;
        },
        data: function(graph, nodes, edges, clusters, constraints) {
            data(nodes, edges, clusters, constraints);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return ['handleDisconnected', 'lengthStrategy', 'baseLength', 'flowLayout',
                    'tickSize', 'groupConnected', 'setcolaSpec', 'setcolaNodes']
                .concat(graphviz_keys);
        },
        passThru: function() {
            return ['extractNodeAttrs', 'extractEdgeAttrs'];
        },
        propagateOptions: function(options) {
            if(!options.nodeAttrs)
                options.nodeAttrs = Object.keys(engine.extractNodeAttrs());
            if(!options.edgeAttrs)
                options.edgeAttrs = Object.keys(engine.extractEdgeAttrs());
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {},
        /**
         * Instructs cola.js to fit the connected components.
         * @method handleDisconnected
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Boolean} [handleDisconnected=true]
         * @return {Boolean}
         * @return {dc_graph.cola_layout}
         **/
        handleDisconnected: property(true),
        /**
         * Currently, three strategies are supported for specifying the lengths of edges:
         * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
         * `baseLength`
         * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
         * the edge. See
         * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
         * for more details.
         * 'none' - no edge lengths will be specified
         * @method lengthStrategy
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Function|String} [lengthStrategy='symmetric']
         * @return {Function|String}
         * @return {dc_graph.cola_layout}
         **/
        lengthStrategy: property('symmetric'),
        /**
         * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
         * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
         * lengths.
         * @method baseLength
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Number} [baseLength=30]
         * @return {Number}
         * @return {dc_graph.cola_layout}
         **/
        baseLength: property(30),
        /**
         * If `flowLayout` is set, it determines the axis and separation for
         * {@link http://marvl.infotech.monash.edu/webcola/doc/classes/cola.layout.html#flowlayout cola flow layout}.
         * If it is not set, `flowLayout` will be calculated from the {@link dc_graph.graphviz_attrs#rankdir rankdir}
         * and {@link dc_graph.graphviz_attrs#ranksep ranksep}; if `rankdir` is also null (the
         * default for cola layout), then there will be no flow.
         * @method flowLayout
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Object} [flowLayout=null]
         * @example
         * // No flow (default)
         * diagram.flowLayout(null)
         * // flow in x with min separation 200
         * diagram.flowLayout({axis: 'x', minSeparation: 200})
         **/
        flowLayout: function(flow) {
            if(!arguments.length) {
                if(_flowLayout)
                    return _flowLayout;
                var dir = engine.rankdir();
                switch(dir) {
                case 'LR': return {axis: 'x', minSeparation: engine.ranksep() + engine.parent().nodeRadius()*2};
                case 'TB': return {axis: 'y', minSeparation: engine.ranksep() + engine.parent().nodeRadius()*2};
                default: return null; // RL, BT do not appear to be possible (negative separation) (?)
                }
            }
            _flowLayout = flow;
            return this;
        },
        unconstrainedIterations: property(10),
        userConstraintIterations: property(20),
        allConstraintsIterations: property(20),
        gridSnapIterations: property(0),
        tickSize: property(1),
        groupConnected: property(false),
        setcolaSpec: property(null),
        setcolaNodes: function() {
            return _setcola_nodes;
        },
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({}),
        processExtraWorkerResults: function(setcolaNodes) {
            _setcola_nodes = setcolaNodes;
        }
    });
    return engine;
};

dc_graph.cola_layout.scripts = ['d3.js', 'cola.js'];
dc_graph.cola_layout.optional_scripts = ['setcola.js'];
