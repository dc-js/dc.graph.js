dc_graph.expand_collapse.expanded_hidden = function(opts) {
    var options = Object.assign({
        nodeKey: function(n) { return n.key; },
        edgeKey: function(e) { return e.key; },
        edgeSource: function(e) { return e.value.source; },
        edgeTarget: function(e) { return e.value.target; }
    }, opts);
    var _nodeExpanded = {}, _nodeHidden = {}, _edgeHidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    var _nodeDim = options.nodeCrossfilter.dimension(options.nodeKey),
        _edgeDim = options.edgeCrossfilter && options.edgeCrossfilter.dimension(options.edgeRawKey);

    function get_shown(expanded) {
        return Object.keys(expanded).reduce(function(p, nk) {
            p[nk] = true;
            adjacent_nodes(nk).forEach(function(nk2) {
                if(!_nodeHidden[nk2])
                    p[nk2] = true;
            });
            return p;
        }, {});
    }
    function apply_filter() {
        var _shown = get_shown(_nodeExpanded);
        _nodeDim.filterFunction(function(nk) {
            return _shown[nk];
        });
        _edgeDim && _edgeDim.filterFunction(function(ek) {
            return !_edgeHidden[ek];
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
        get_edges: function(nk) {
            return adjacent_edges(nk);
        },
        expand: function(nk) {
            _nodeExpanded[nk] = true;
            apply_filter();
            dc.redrawAll();
        },
        expandedNodes: function(_) {
            if(!arguments.length)
                return _nodeExpanded;
            _nodeExpanded = _;
            apply_filter();
            dc.redrawAll();
            return this;
        },
        collapsibles: function(nk, dir) {
            var whatif = Object.assign({}, _nodeExpanded);
            delete whatif[nk];
            var shown = get_shown(_nodeExpanded), would = get_shown(whatif);
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
            delete _nodeExpanded[nk];
            apply_filter();
            dc.redrawAll();
        },
        hideNode: function(nk) {
            _nodeHidden[nk] = true;
            this.collapse(nk); // in case
        },
        hideEdge: function(ek) {
            if(!options.edgeCrossfilter)
                console.warn('expanded_hidden needs edgeCrossfilter to hide edges');
            _edgeHidden[ek] = true;
            apply_filter();
            dc.redrawAll();
        }
    };
    return _strategy;
};
