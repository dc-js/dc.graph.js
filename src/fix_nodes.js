dc_graph.fix_nodes = function(options) {
    options = options || {};
    var fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var _fixes = [], _wnodes;

    function request_fixes(fixes) {
        _fixes = {};
        fixes.forEach(function(fix) {
            _fixes[fix.id] = fix.pos;
        });
        fix_nodes();
    }
    function fix_nodes() {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = [];
        _wnodes.forEach(function(n) {
            var fixPos = _fixes[_behavior.parent().nodeKey.eval(n)];
            var key = _behavior.parent().nodeKey.eval(n),
                oldFixed = n.orig.value[_fixedPosTag],
                changed = false;
            if(oldFixed) {
                if(!fixPos || fixPos.x !== oldFixed.x || fixPos.y !== oldFixed.y)
                    changed = true;
            }
            else changed = fixPos;
            if(changed) {
                promises.push(
                    callback(key, fixPos ? {x: fixPos.x, y: fixPos.y} : null)
                        .then(function(fixed) {
                            n.orig.value[_fixedPosTag] = fixed;
                        }));
            }
        });
        Promise.all(promises).then(function() {
            _behavior.parent().redraw();
        });
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            fix_nodes_group.on('request_fixes.fix-nodes', p ? request_fixes : null);
            if(p) {
                p.on('data.fix-nodes', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
                    _wnodes = wnodes;
                });
            } else if(_behavior.parent())
                _behavior.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null),
        strategy: property(dc_graph.fix_nodes.strategy.classic())
    };

    return _behavior;
};

dc_graph.fix_nodes.strategy = {};
dc_graph.fix_nodes.strategy.classic = {
    new_node: function(n, pos) {
        node[_fixedPosTag] = pos;
    }

dc_graph.fix_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('fix-nodes', function() {
        return d3.dispatch('request_fixes');
    });

    return window.chart_registry.create_group('fix-nodes', brushgroup);
};
