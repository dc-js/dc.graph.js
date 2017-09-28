dc_graph.fix_nodes = function(options) {
    options = options || {};
    var fix_nodes_group = dc_graph.select_things_group('fix-nodes-group', 'select-nodes');
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var _fixedNodes = [], _node;

    function fixed_changed(chart) {
        return function(fixed, refresh) {
            if(refresh === undefined)
                refresh = true;
            _fixedNodes = fixed;
            var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
            var promises = [];
            for_all_nodes(_node, _fixedNodes, function(n, selected) {
                var key = chart.nodeKey.eval(n),
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
                chart.redraw();
            });
        };
    }

    function for_all_nodes(node, selection, f) {
        node.each(function(n) {
            var selected = selection.indexOf(_behavior.parent().nodeKey.eval(n)) >= 0;
            f(n, selected);
        });
    }

    function add_behavior(chart, node, edge, ehover) {
        _node = node;
    }

    function remove_behavior(chart, node, edge, ehover) {
    }

    var _behavior = dc_graph.behavior('fix-nodes', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            fix_nodes_group.on('set_changed.fix-nodes', p ? fixed_changed(p) : null);
        }
    });
    // callback for setting & fixing node position
    _behavior.fixNode = property(null);

    return _behavior;
};

