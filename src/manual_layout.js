dc_graph.manual_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');

    var _wnodes;

    function init(options) {
    }
    function data(nodes) {
        _wnodes = nodes;
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch[event](
            wnodes,
            wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }
    function start() {
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    var _engine = {
        layoutAlgorithm: function() {
            return 'manual';
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
        data: function(graph, nodes, edges) {
            data(nodes);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return [];
        },
        populateLayoutNode: function(n1, n) {
            ['x', 'y'].forEach(function(attr) {
                if(n.orig.value[attr] !== undefined)
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge: function() {},
        addressToKey: property(function(ad) { return ad.join(','); }),
        keyToAddress: property(function(nid) { return nid.split(','); })
    };
    return _engine;
};

dc_graph.manual_layout.scripts = ['css-layout.js'];
