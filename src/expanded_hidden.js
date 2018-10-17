dc_graph.expand_collapse.expanded_hidden = function(opts) {
    var options = Object.assign({
        nodeKey: function(n) { return n.key; },
        edgeSource: function(e) { return e.value.source; },
        edgeTarget: function(e) { return e.value.target; }
    }, opts);
    var _expanded = {}, _hidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    var _filter = options.nodeCrossfilter.dimension(options.nodeKey);
    function apply_filter() {
        var _shown = {};
        Object.keys(_expanded).forEach(function(nk) {
            _shown[nk] = true;
            adjacent_nodes(nk).forEach(function(nk2) {
                if(!_hidden[nk2])
                    _shown[nk2] = true;
            });
        });
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
