dc_graph.expand_collapse.expanded_hidden = function(opts) {
    var options = Object.assign({
        nodeKey: function(n) { return n.key; },
        edgeKey: function(e) { return e.key; },
        edgeSource: function(e) { return e.value.source; },
        edgeTarget: function(e) { return e.value.target; }
    }, opts);
    var _expanded = {}, _hidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    var _filter = options.nodeCrossfilter.dimension(options.nodeKey);

    function get_shown(expanded) {
        return Object.keys(expanded).reduce(function(p, nk) {
            p[nk] = true;
            adjacent_nodes(nk).forEach(function(nk2) {
                if(!_hidden[nk2])
                    p[nk2] = true;
            });
            return p;
        }, {});
    }
    function apply_filter() {
        var _shown = get_shown(_expanded);
        _filter.filterFunction(function(nk) {
            return _shown[nk];
        });
    }
    function adjacent_edges(nk) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeSource(e) === nk || options.edgeTarget(e) === nk;
        });
    }
    // function out_edges(nk) {
    //     return options.edgeGroup.all().filter(function(e) {
    //         return options.edgeSource(e) === nk;
    //     });
    // }
    // function in_edges(nk) {
    //     return options.edgeGroup.all().filter(function(e) {
    //         return options.edgeTarget(e) === nk;
    //     });
    // }
    function adjacent_nodes(nk) {
        return adjacent_edges(nk).map(function(e) {
            return options.edgeSource(e) === nk ? options.edgeTarget(e) : options.edgeSource(e);
        });
    }

    apply_filter();
    var _strategy = {
        get_degree: function(nk) {
            return adjacent_edges(nk).length;
        },
        expand: function(nk) {
            _expanded[nk] = true;
            apply_filter();
            dc.redrawAll();
        },
        collapsibles: function(nk, dir) {
            var whatif = Object.assign({}, _expanded);
            delete whatif[nk];
            var shown = get_shown(_expanded), would = get_shown(whatif);
            var going = Object.keys(shown)
                .filter(function(nk2) { return !would[nk2]; })
                .reduce(function(p, v) {
                    p[v] = true;
                    return p;
                }, {});
            return {
                nodes: going,
                edges: options.edgeGroup.all().filter(function(e) {
                    return going[options.edgeSource(e)] || going[options.edgeTarget(e)];
                }).reduce(function(p, e) {
                    p[options.edgeKey(e)] = true;
                    return p;
                }, {})
            };
        },
        collapse: function(nk, collapsible) {
            delete _expanded[nk];
            apply_filter();
            dc.redrawAll();
        },
        hide: function(nk) {
            _hidden[nk] = true;
            this.collapse(nk); // in case
        }
    };
    return _strategy;
};
