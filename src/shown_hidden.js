dc_graph.expand_collapse.shown_hidden = function(opts) {
    var options = Object.assign({
        nodeKey: function(n) { return n.key; },
        edgeSource: function(e) { return e.value.source; },
        edgeTarget: function(e) { return e.value.target; }
    }, opts);
    var _shown = {}, _hidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    var _filter = options.nodeCrossfilter.dimension(options.nodeKey);
    function apply_filter() {
        _filter.filterFunction(function(key) {
            return _shown[key];
        });
    }
    function adjacent_edges(key) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeSource(e) === key || options.edgeTarget(e) === key;
        });
    }
    function out_edges(key) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeSource(e) === key;
        });
    }
    function in_edges(key) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeTarget(e) === key;
        });
    }
    function adjacent_nodes(key) {
        return adjacent_edges(key).map(function(e) {
            return options.edgeSource(e) === key ? options.edgeTarget(e) : options.edgeSource(e);
        });
    }

    var _strategy = {
        start: function(nk) {
            _shown = {};
            if(nk)
                _shown[nk] = true;
            apply_filter();
            return _strategy;
        }

    };
    if(options.directional)
        Object.assign(_strategy, {
            get_degree: function(key, dir) {
                switch(dir) {
                case 'out': return out_edges(key).length;
                case 'in': return in_edges(key).length;
                default: throw new Error('unknown direction ' + dir);
                }
            },
            expand: function(key, dir) {
                switch(dir) {
                case 'out':
                    out_edges(key).forEach(function(e) {
                        if(!_hidden[options.edgeTarget(e)])
                            _shown[options.edgeTarget(e)] = true;
                    });
                    break;
                case 'in':
                    in_edges(key).forEach(function(e) {
                        if(!_hidden[options.edgeSource(e)])
                            _shown[options.edgeSource(e)] = true;
                    });
                    break;
                default: throw new Error('unknown direction ' + dir);
                }
                apply_filter();
                dc.redrawAll();
            },
            collapse: function(key, collapsible, dir) {
                switch(dir) {
                case 'out':
                    out_edges(key).forEach(function(e) {
                        if(collapsible(options.edgeTarget(e)))
                            _shown[options.edgeTarget(e)] = false;
                    });
                    break;
                case 'in':
                    in_edges(key).forEach(function(e) {
                        if(collapsible(options.edgeSource(e)))
                            _shown[options.edgeSource(e)] = false;
                    });
                    break;
                default: throw new Error('unknown direction ' + dir);
                }
                apply_filter();
                dc.redrawAll();
            },
            hide: function(key) {
                _hidden[key] = true;
                _shown[key] = false;
                apply_filter();
                dc.redrawAll();
            },
            dirs: ['out', 'in']
        });
    else
        Object.assign(_strategy, {
            get_degree: function(key) {
                return adjacent_edges(key).length;
            },
            expand: function(key) {
                adjacent_nodes(key).forEach(function(nk) {
                    if(!_hidden[nk])
                        _shown[nk] = true;
                });
                apply_filter();
                dc.redrawAll();
            },
            collapse: function(key, collapsible) {
                adjacent_nodes(key).filter(collapsible).forEach(function(nk) {
                    _shown[nk] = false;
                });
                apply_filter();
                dc.redrawAll();
            },
            hide: function(key) {
                _hidden[key] = true;
                _shown[key] = false;
                apply_filter();
                dc.redrawAll();
            }
        });
    return _strategy;
};
