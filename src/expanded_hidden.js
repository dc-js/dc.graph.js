dc_graph.expand_collapse.expanded_hidden = function(opts) {
    var options = Object.assign({
        nodeKey: function(n) { return n.key; },
        edgeKey: function(e) { return e.key; },
        edgeSource: function(e) { return e.value.source; },
        edgeTarget: function(e) { return e.value.target; }
    }, opts);
    var _nodeHidden = {}, _edgeHidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    var _nodeDim = options.nodeCrossfilter.dimension(options.nodeKey),
        _edgeDim = options.edgeCrossfilter && options.edgeCrossfilter.dimension(options.edgeRawKey);

    function get_shown(expanded) {
        return Object.keys(expanded).reduce(function(p, dir) {
            return Array.from(expanded[dir]).reduce(function(p, nk) {
                p[nk] = true;
                let list;
                switch(dir) {
                case 'in':
                    list = in_edges(nk).map(e => options.edgeSource(e));
                    break;
                case 'out':
                    list = out_edges(nk).map(e => options.edgeTarget(e));
                    break;
                case 'both':
                    list = adjacent_nodes(nk);
                    break;
                }
                list.forEach(function(nk2) {
                    if(!_nodeHidden[nk2])
                        p[nk2] = true;
                });
                return p;
            }, p);
        }, {});
    }
    function apply_filter(ec) {
        var _shown = get_shown(ec.getExpanded());
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
    function adjacent_nodes(nk) {
        return adjacent_edges(nk).map(function(e) {
            return options.edgeSource(e) === nk ? options.edgeTarget(e) : options.edgeSource(e);
        });
    }

    const dfs_pre_order = (nk, seen, traverse, other, fall, funseen, pe = null, pres = null) => {
        fall(pe, pres, nk);
        if(seen.has(nk))
            return;
        seen.add(nk);
        const nres = funseen(pe, pres, nk);
        for(const e of traverse(nk))
            dfs_pre_order(other(e), seen, traverse, other, fall, funseen, e, nres);
    };

    var _strategy = {
        get_edges: function(nk, dir) {
            switch(dir) {
            case 'in':
                return in_edges(nk);
            case 'out':
                return out_edges(nk);
            case 'both':
                return adjacent_edges(nk);
            default:
                throw new Error(`unknown dir ${dir}`);
            }
        },
        get_tree_edges: (nk, dir, once = false) => {
            const traverse = dir === 'in' ? in_edges :
                  dir === 'out' ? out_edges :
                  adjacent_nodes;
            const other = dir === 'in' ? e => options.edgeSource(e) :
                  dir === 'out' ? e => options.edgeTarget(e) :
                  n => n;
            if(once) {
                let edges, nks;
                if(dir === 'both') {
                    const ie = in_edges(nk), oe = out_edges(nk);
                    edges = [...ie, ...oe];
                    nks = [...ie.map(options.edgeSource), ...oe.map(options.edgeTarget)];
                } else {
                    edges = traverse(nk);
                    nks = edges.map(other);
                }
                return {[nk]: {edges, nks}};
            }
            const nodes = {}, seen = new Set();
            dfs_pre_order(nk, seen, traverse, other, (pe, pres, nk) => {
                if(pres) {
                    pres.edges.push(pe);
                    pres.nks.push(nk);
                }
            }, (pe, pres, nk) => {
                return nodes[nk] = {edges: [], nks: []};
            });
            return nodes;
        },
        partition_among_visible: (tree_edges, visible_nodes) => {
        },
        apply_expanded: () => {
            apply_filter(_strategy.expandCollapse());
            dc.redrawAll();
        },
        expandedNodes: function(_) {
            if(!arguments.length)
                throw new Error('not supported'); // should not be called
            apply_filter(_strategy.expandCollapse());
            dc.redrawAll();
            return this;
        },
        collapsibles: function(nks, dir) {
            const expanded = _strategy.expandCollapse().getExpanded();
            var whatif = structuredClone(expanded);
            nks.forEach(
                nk => whatif[dir].delete(nk)
            );
            var shown = get_shown(expanded), would = get_shown(whatif);
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
        hideNode: function(nk) {
            _nodeHidden[nk] = true;
            this.collapse(nk); // in case
        },
        hideEdge: function(ek) {
            if(!options.edgeCrossfilter)
                console.warn('expanded_hidden needs edgeCrossfilter to hide edges');
            _edgeHidden[ek] = true;
            apply_filter(_strategy.expandCollapse());
            dc.redrawAll();
        },
        expandCollapse: property(null).react(function(ec) {
            if(ec)
                apply_filter(ec);

        })
    };
    if(options.directional)
        _strategy.dirs = ['out', 'in'];
    return _strategy;
};
