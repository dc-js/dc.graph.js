dc_graph.select_nodes = function(props, options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');

    var thinginess = {
        intersectRect: function(ext) {
            return _mode.parent().selectAllNodes().data().filter(function(n) {
                return n && ext[0][0] < n.cola.x && n.cola.x < ext[1][0] &&
                    ext[0][1] < n.cola.y && n.cola.y < ext[1][1];
            }).map(this.key);
        },
        clickables: function(diagram, node, edge) {
            return node;
        },
        excludeClick: function(element) {
            return ancestor_has_class(element, 'port');
        },
        key: function(n) {
            return _mode.parent().nodeKey.eval(n);
        },
        applyStyles: function(pred) {
            _mode.parent().cascade(50, true, node_edge_conditions(pred, null, props));
        },
        removeStyles: function() {
            _mode.parent().cascade(50, false, props);
        }
    };
    var _mode = dc_graph.select_things(select_nodes_group, 'select-nodes', thinginess);
    return _mode;
};
