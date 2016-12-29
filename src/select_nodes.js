// this currently only supports single selection with a click
// but it can be expanded with modifier-key clicks and rectangular selection etc.
dc_graph.select_nodes = function(props) {
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');
    var _selected = []

    function selection_changed_listener(chart) {
        return function(selection) {
            _selected = selection;
            chart.refresh();
        };
    }
    function add_behavior(chart, node, edge) {
        chart.cascade(50, true, conditional_properties(function(n) {
            return _selected.indexOf(n.orig.key) >= 0;
        }, null, props));
        node.on('click.select-nodes', function(d) {
            select_nodes_group.node_set_changed([chart.nodeKey.eval(d)]);
            d3.event.stopPropagation();
        });
        chart.svg().on('click.select-nodes', function(d) {
            select_nodes_group.node_set_changed([]);
        });
        // drop any selected which no longer exist in the diagram
        var present = node.data().map(function(d) { return d.orig.key; });
        var now_selected = _selected.filter(function(k) { return present.indexOf(k) >= 0; });
        if(_selected.length !== now_selected.length)
            select_nodes_group.node_set_changed(now_selected);
    }

    function remove_behavior(chart, node, edge) {
        node.on('click.select-nodes', null);
        chart.svg().on('click.select-nodes', null);
        chart.cascade(50, false, props);
    }

    return dc_graph.behavior('select-nodes', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
        },
        parent: function(p) {
            select_nodes_group.on('node_set_changed.select-nodes', p ? selection_changed_listener(p) : null);
        }
    });
};

dc_graph.select_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('select-nodes', function() {
        return d3.dispatch('node_set_changed');
    });

    return window.chart_registry.create_group('select-nodes', brushgroup);
};
