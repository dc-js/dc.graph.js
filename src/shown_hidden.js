dc_graph.expand_collapse.shown_hidden = function(opts) {
    var options = Object.assign({
        nodeKey: function(n) { return n.key; }, // this one is raw rows, others are post-crossfilter-group
        edgeKey: function(e) { return e.key; },
        edgeSource: function(e) { return e.value.source; },
        edgeTarget: function(e) { return e.value.target; }
    }, opts);
    var _nodeShown = {}, _nodeHidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    var _filter = options.nodeCrossfilter.dimension(options.nodeKey);
    function apply_filter() {
        _filter.filterFunction(function(nk) {
            return _nodeShown[nk];
        });
    }
    function adjacent_edges(nk) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeSource(e) === nk || options.edgeTarget(e) === nk;
        });
    }
    function adjacent_nodes(nk) {
        return adjacent_edges(nk).map(function(e) {
            return options.edgeSource(e) === nk ? options.edgeTarget(e) : options.edgeSource(e);
        });
    }
    function adjacencies(nk) {
        return adjacent_edges(nk).map(function(e) {
            return options.edgeSource(e) === nk ? [e,options.edgeTarget(e)] : [e,options.edgeSource(e)];
        });
    }
    function out_edges(nk) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeSource(e) === nk;
        });
    }
    function in_edges(nk) {
        return options.edgeGroup.all().filter(function(e) {
            return options.edgeTarget(e) === nk;
        });
    }
    function is_collapsible(n1, n2) {
        return options.edgeGroup.all().every(function(e2) {
            var n3;
            if(options.edgeSource(e2) === n2)
                n3 = options.edgeTarget(e2);
            else if(options.edgeTarget(e2) === n2)
                n3 = options.edgeSource(e2);
            return !n3 || n3 === n1 || !_nodeShown[n3];
        });
    }
    apply_filter();
    var _strategy = {};
    if(options.directional)
        Object.assign(_strategy, {
            get_degree: function(nk, dir) {
                switch(dir) {
                case 'out': return out_edges(nk).length;
                case 'in': return in_edges(nk).length;
                default: throw new Error('unknown direction ' + dir);
                }
            },
            expand: function(nk, dir, skip_draw) {
                _nodeShown[nk] = true;
                switch(dir) {
                case 'out':
                    out_edges(nk).forEach(function(e) {
                        if(!_nodeHidden[options.edgeTarget(e)])
                            _nodeShown[options.edgeTarget(e)] = true;
                    });
                    break;
                case 'in':
                    in_edges(nk).forEach(function(e) {
                        if(!_nodeHidden[options.edgeSource(e)])
                            _nodeShown[options.edgeSource(e)] = true;
                    });
                    break;
                default: throw new Error('unknown direction ' + dir);
                }
                if(!skip_draw) {
                    apply_filter();
                    dc.redrawAll();
                }
            },
            expandedNodes: function(_) {
                if(!arguments.length)
                    throw new Error('not supported'); // should not be called
                var that = this;
                _nodeShown = {};
                Object.keys(_).forEach(function(nk) {
                    that.expand(nk, 'out', true);
                    that.expand(nk, 'in', true);
                });
                apply_filter();
                dc.redrawAll();
                return this;
            },
            collapsibles: function(nk, dir) {
                var nodes = {}, edges = {};
                (dir === 'out' ? out_edges(nk) : in_edges(nk)).forEach(function(e) {
                    var n2 = dir === 'out' ? options.edgeTarget(e) : options.edgeSource(e);
                    if(is_collapsible(nk, n2)) {
                        nodes[n2] = true;
                        adjacent_edges(n2).forEach(function(e) {
                            edges[options.edgeKey(e)] = true;
                        });
                    }
                });
                return {nodes: nodes, edges: edges};
            },
            collapse: function(nk, dir) {
                Object.keys(this.collapsibles(nk, dir).nodes).forEach(function(nk) {
                    _nodeShown[nk] = false;
                });
                apply_filter();
                dc.redrawAll();
            },
            hideNode: function(nk) {
                _nodeHidden[nk] = true;
                _nodeShown[nk] = false;
                apply_filter();
                dc.redrawAll();
            },
            dirs: ['out', 'in']
        });
    else
        Object.assign(_strategy, {
            get_degree: function(nk) {
                return adjacent_edges(nk).length;
            },
            expand: function(nk) {
                _nodeShown[nk] = true;
                adjacent_nodes(nk).forEach(function(nk) {
                    if(!_nodeHidden[nk])
                        _nodeShown[nk] = true;
                });
                apply_filter();
                dc.redrawAll();
            },
            expandedNodes: function(_) {
                if(!arguments.length)
                    throw new Error('not supported'); // should not be called
                var that = this;
                _nodeShown = {};
                Object.keys(_).forEach(function(nk) {
                    that.expand(nk);
                });
                return this;
            },
            collapsibles: function(nk, dir) {
                var nodes = {}, edges = {};
                adjacencies(nk).forEach(function(adj) {
                    var e = adj[0], n2 = adj[1];
                    if(is_collapsible(nk, n2)) {
                        nodes[n2] = true;
                        edges[options.edgeKey(e)] = true;
                    }
                });
                return {nodes: nodes, edges: edges};
            },
            collapse: function(nk, dir) {
                Object.keys(_strategy.collapsibles(nk, dir).nodes).forEach(function(nk) {
                    _nodeShown[nk] = false;
                });
                apply_filter();
                dc.redrawAll();
            },
            hideNode: function(nk) {
                _nodeHidden[nk] = true;
                _nodeShown[nk] = false;
                apply_filter();
                dc.redrawAll();
            }
        });
    return _strategy;
};
