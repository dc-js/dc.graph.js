dc_graph.fix_nodes = function(options) {
    options = options || {};
    var fix_nodes_group = dc_graph.select_things_group('fix-nodes-group', 'select-nodes');
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var _fixedNodes = [], _wnodes;

    function fixed_changed(chart) {
        return function(fixed, refresh) {
            if(refresh === undefined)
                refresh = true;
            _fixedNodes = fixed;
            fix_nodes();
        };
    }
    function fix_nodes() {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = [];
        _wnodes.forEach(function(n) {
            var selected = _fixedNodes.indexOf(_behavior.parent().nodeKey.eval(n)) >= 0;
            var key = _behavior.parent().nodeKey.eval(n),
                oldFixed = n.orig.value[_fixedPosTag],
                changed = false;
            if(oldFixed) {
                if(!selected || n.cola.x !== oldFixed.x || n.cola.y !== oldFixed.y)
                    changed = true;
            }
            else changed = selected;
            if(changed) {
                promises.push(
                    callback(key, selected ? {x: n.cola.x, y: n.cola.y} : null)
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
            fix_nodes_group.on('set_changed.fix-nodes', p ? fixed_changed(p) : null);
            if(p) {
                p.on('data.fix-nodes', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
                    _wnodes = wnodes;
                });
            } else if(_behavior.parent())
                _behavior.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null)
    };

    return _behavior;
};

