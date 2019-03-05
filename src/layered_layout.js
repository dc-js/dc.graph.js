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
    var _nodes = {}, _edges = {};
    var _wnodes = [], _wedges = [];
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
        var supergraph = dc_graph.supergraph({nodes: nodes, edges: edges}, {
            nodeKey: function(n) { return n.dcg_nodeKey; },
            edgeKey: function(n) { return n.dcg_edgeKey; },
            edgeSource: function(e) { return e.dcg_edgeSource; },
            edgeTarget: function(n) { return n.dcg_edgeTarget; }
        });

        console.log(supergraph.nodes().length);
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
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    engine.pathStraightenForce = engine.angleForce;
    return engine;
};


