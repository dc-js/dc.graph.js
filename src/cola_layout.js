dc_graph.cola_layout = function(id) {
    var _layoutId = id || uuid();
    var _d3cola = null;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects shared with cola.js, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};

    function init(options) {
        // width, height, handleDisconnected, lengthStrategy, baseLength, flowLayout, tickSize
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

    function data(nodes, edges, constraints, opts) {
        var wnodes = regenerate_objects(_nodes, nodes, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.fixed = !!v.dgc_nodeFixed;

            if(typeof v.dgc_nodeFixed === 'object') {
                v1.x = v.dgc_nodeFixed.x;
                v1.y = v.dgc_nodeFixed.y;
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

        function dispatchState(event) {
            _dispatch[event](
                wnodes,
                wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                })
            );
        }
        _d3cola.on('tick', /* _tick = */ function() {
            dispatchState('tick');
        }).on('start', function() {
            _dispatch.start();
        }).on('end', /* _done = */ function() {
            dispatchState('end');
        });
        _d3cola.nodes(wnodes)
            .links(wedges)
            .constraints(constraints)
            .groups(groups);
    }

    function start(options) {
        _d3cola.start(options.initialUnconstrainedIterations,
                      options.initialUserConstraintIterations,
                      options.initialAllConstraintsIterations,
                      options.gridSnapIterations);
    }

    function stop() {
        _d3cola.stop();
    }

    return {
        layoutAlgorithm: function() {
            return 'cola';
        },
        layoutId: function() {
            return _layoutId;
        },
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
        data: function(nodes, edges, constraints, opts) {
            data(nodes, edges, constraints, opts);
        },
        start: function(options) {
            start(options);
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return ['handleDisconnected', 'lengthStrategy', 'baseLength', 'flowLayout', 'tickSize'];
        },
        /**
         * Instructs cola.js to fit the connected components.
         * @name handleDisconnected
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Boolean} [handleDisconnected=true]
         * @return {Boolean}
         * @return {dc_graph.diagram}
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
         * @name lengthStrategy
         * @memberof dc_graph.diagram
         * @instance
         * @param {Function|String} [lengthStrategy='symmetric']
         * @return {Function|String}
         * @return {dc_graph.diagram}
         **/
        lengthStrategy: property('symmetric'),
        /**
         * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
         * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
         * lengths.
         * @name baseLength
         * @memberof dc_graph.diagram
         * @instance
         * @param {Number} [baseLength]
         * @return {Number}
         * @return {dc_graph.diagram}
         **/
        baseLength: property(30),
        /**
         * This should be equivalent to rankdir and ranksep in the dagre/graphviz nomenclature, but for
         * now it is separate.
         * @name flowLayout
         * @memberof dc_graph.diagram
         * @instance
         * @param {Object} [flowLayout]
         * @example
         * // No flow (default)
         * chart.flowLayout(null)
         * // flow in x with min separation 200
         * chart.flowLayout({axis: 'x', minSeparation: 200})
         **/
        flowLayout: property(null),
        tickSize: property(1)
    };
};

dc_graph.cola_layout.scripts = ['d3.js', 'cola.js'];
