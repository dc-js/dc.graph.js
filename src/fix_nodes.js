dc_graph.fix_nodes = function(options) {
    options = options || {};
    var fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var _fixes = [], _nodes, _wnodes, _edges, _wedges;

    var _execute = {
        fix_node: function(n, pos) {
            n[_fixedPosTag] = pos;
        },
        unfix_node: function(n) {
            n[_fixedPosTag] = null;
        },
        clear_fixes: function() {
            _fixes = {};
        },
        register_fix: function(id, pos) {
            _fixes[id] = pos;
        }
    };

    function request_fixes(fixes) {
        _behavior.strategy().request_fixes(_execute, fixes);
        fix_nodes();
    }
    function new_node(n, pos) {
        _behavior.strategy().new_node(_execute, n, pos);
    }
    function new_edge(sourceid, targetid) {
        var source = _nodes[sourceid], target = _nodes[targetid];
        _behavior.strategy().new_edge(_execute, source, target);
    }
    function find_changes() {
        var changes = [];
        _wnodes.forEach(function(n) {
            var key = _behavior.parent().nodeKey.eval(n),
                fixPos = _fixes[key],
                oldFixed = n.orig.value[_fixedPosTag],
                changed = false;
            if(oldFixed) {
                if(!fixPos || fixPos.x !== oldFixed.x || fixPos.y !== oldFixed.y)
                    changed = true;
            }
            else changed = fixPos;
            if(changed)
                changes.push({n: n, fixed: fixPos ? {x: fixPos.x, y: fixPos.y} : null});
        });
        return changes;
    }
    function fix_nodes() {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = find_changes().map(function(change) {
            var key = _behavior.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed)
                .then(function(fixed) {
                    if(fixed)
                        _execute.fix_node(change.n.orig.value, fixed);
                    else
                        _execute.unfix_node(change.n.orig.value);
                });
        });
        return Promise.all(promises).then(function() {
            _behavior.parent().redraw();
        });
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            fix_nodes_group
                .on('request_fixes.fix-nodes', p ? request_fixes : null)
                .on('new_node.fix_nodes', p ? new_node : null)
                .on('new_edge.fix_nodes', p ? new_edge : null);
            if(p) {
                p.on('data.fix-nodes', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
                    _nodes = nodes;
                    _wnodes = wnodes;
                    _edges = edges;
                    _wedges = wedges;
                });
            } else if(_behavior.parent())
                _behavior.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null),
        strategy: property(dc_graph.fix_nodes.strategy.fix_last())
    };

    return _behavior;
};

dc_graph.fix_nodes.strategy = {};
dc_graph.fix_nodes.strategy.fix_last = function() {
    return {
        request_fixes: function(exec, fixes) {
            exec.clear_fixes();
            fixes.forEach(function(fix) {
                exec.register_fix(fix.id, fix.pos);
            });
        },
        new_node: function(exec, n, pos) {
            exec.fix_node(n, pos);
        },
        new_edge: function(exec, source, target) {
            exec.unfix_node(source.orig.value);
            exec.unfix_node(target.orig.value);
        }
    };
};

dc_graph.fix_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('fix-nodes', function() {
        return d3.dispatch('request_fixes', 'new_node', 'new_edge');
    });

    return window.chart_registry.create_group('fix-nodes', brushgroup);
};
