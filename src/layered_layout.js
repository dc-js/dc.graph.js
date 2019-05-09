/**
 * `dc_graph.layered_layout` produces 3D layered layouts, utilizing another layout
 * that supports fixed nodes and position hints for the layers
 * @class layered_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.layered_layout}
 **/
dc_graph.layered_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _supergraph, _subgraphs;
    var _layers;
    var _options = null;

    function init(options) {
        _options = options;

    }

    function data(nodes, edges, constraints) {
        _supergraph = dc_graph.supergraph({nodes: nodes, edges: edges}, {
            nodeKey: function(n) { return n.dcg_nodeKey; },
            edgeKey: function(n) { return n.dcg_edgeKey; },
            nodeValue: function(n) { return n; },
            edgeValue: function(e) { return e; },
            edgeSource: function(e) { return e.dcg_edgeSource; },
            edgeTarget: function(e) { return e.dcg_edgeTarget; }
        });

        // every node belongs natively in one rank
        var nranks = _supergraph.nodes().reduce(function(p, n) {
            var rank = engine.layerAccessor()(n.value());
            p[rank] = p[rank] || [];
            p[rank].push(n);
            return p;
        }, {});
        var eranks = Object.keys(nranks).reduce(function(p, r) {
            p[r] = [];
            return p;
        }, {});

        // nodes are shadowed into any layers to which they are adjacent
        // edges are induced from the native&shadow nodes in each layer
        _supergraph.edges().forEach(function(e) {
            var srank = engine.layerAccessor()(e.source().value()),
                trank = engine.layerAccessor()(e.target().value());
            if(srank == trank) {
                eranks[srank].push(e);
                return;
            }
            nranks[trank].push(e.source());
            eranks[trank].push(e);
            nranks[srank].push(e.target());
            eranks[srank].push(e);
        });

        // produce a subgraph for each layer
        _subgraphs = Object.keys(nranks).reduce(function(p, r) {
            p[r] = _supergraph.subgraph(
                nranks[r].map(function(n) { return n.key(); }),
                eranks[r].map(function(e) { return e.key(); }));
            return p;
        }, {});

        // start from the most populous layer
        var max = null;
        Object.keys(nranks).forEach(function(r) {
            if(max === null ||
               _subgraphs[r].nodes().length > _subgraphs[max].nodes().length)
                max = +r;
        });

        // travel up and down from there, each time fixing the nodes from the last layer
        var ranks = Object.keys(nranks).map(function(r) { return +r; }).sort();
        _layers = ranks.map(function(r) {
            return {
                rank: r,
                z: -r * engine.layerSeparationZ()
            };
        });
        var mi = ranks.indexOf(max);
        var ups = ranks.slice(mi+1), downs = ranks.slice(0, mi).reverse();
        layout_layer(max, -1).then(function(layout) {
            Promise.all([
                layout_layers(layout, max, ups),
                layout_layers(layout, max, downs)
            ]).then(function() {
                _dispatch.end(
                    _supergraph.nodes().map(function(n) { return n.value(); }),
                    _supergraph.edges().map(function(e) { return e.value(); }));
            });
        });
    }

    function layout_layers(layout, last, layers) {
        if(layers.length === 0)
            return Promise.resolve(layout);
        var curr = layers.shift();
        return layout_layer(curr, last).then(function(layout) {
            return layout_layers(layout, curr, layers);
        });
    }

    function layout_layer(r, last) {
        _subgraphs[r].nodes().forEach(function(n) {
            if(engine.layerAccessor()(n.value()) !== r &&
               n.value().x !== undefined &&
               n.value().y !== undefined)
                n.value().dcg_nodeFixed = {
                    x: n.value().x,
                    y: n.value().y
                };
            else n.value().dcg_nodeFixed = null;
        });
        var subengine = engine.engineFactory()();
        subengine.init(_options);
        subengine.data(
            {},
            _subgraphs[r].nodes().map(function(n) {
                return n.value();
            }),
            _subgraphs[r].edges().map(function(e) {
                return e.value();
            }));
        return promise_layout(r, subengine);
    }

    function promise_layout(r, subengine) {
        // stopgap - engine.start() should return a promise
        return new Promise(function(resolve, reject) {
            subengine.on('end', function(nodes, edges) {
                resolve({nodes: nodes, edges: edges});
            });
            subengine.start();
        }).then(function(layout) {
            // copy positions back into the subgraph (and hence supergraph)
            layout.nodes.forEach(function(ln) {
                var n = _subgraphs[r].node(ln.dcg_nodeKey);
                // do not copy positions for shadow nodes
                if(engine.layerAccessor()(n.value()) !== r)
                    return;
                n.value().x = ln.x;
                n.value().y = ln.y;
                n.value().z = -r * engine.layerSeparationZ(); // lowest rank at top
            });
            return layout;
        });
    }

    function start() {
        _dispatch.start();
    }

    function stop() {
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'layered';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return false;
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
        optionNames: function() {
            return []
                .concat(graphviz_keys);
        },
        engineFactory: property(null),
        layerAccessor: property(null),
        layerSeparationZ: property(50),
        layers: function() {
            return _layers;
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {},
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({})
    });
    return engine;
};


