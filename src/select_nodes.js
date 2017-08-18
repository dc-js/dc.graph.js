dc_graph.select_nodes = function(props) {
    var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');
    var thinginess = {
        intersectRect: function(ext) {
            return _behavior.parent().selectAllNodes().data().filter(function(n) {
                return n && ext[0][0] < n.cola.x && n.cola.x < ext[1][0] &&
                    ext[0][1] < n.cola.y && n.cola.y < ext[1][1];
            }).map(this.key);
        },
        clickables: function(chart, node, edge) {
            return node;
        },
        key: function(d) {
            return _behavior.parent().nodeKey.eval(d);
        },
        applyStyles: function(condition) {
            _behavior.parent().cascade(50, true, conditional_properties(condition, null, props));
        },
        removeStyles: function() {
            _behavior.parent().cascade(50, false, props);
        }
    };
    var _behavior = dc_graph.select_things(select_nodes_group, 'select-nodes', thinginess);
    return _behavior;
};

dc_graph.select_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('select-nodes', function() {
        return d3.dispatch('set_changed');
    });

    return window.chart_registry.create_group('select-nodes', brushgroup);
};
