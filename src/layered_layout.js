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
    var _options = null;

    function init(options) {
        _options = options;

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
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {},
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({})
    });
    engine.pathStraightenForce = engine.angleForce;
    return engine;
};


