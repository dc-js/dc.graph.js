dc_graph.move_nodes = function(sourceprops, moveprops) {
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');
    var _selected = [], _moving;

    // http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
    var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }

    function selection_changed(chart) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
            if(refresh)
                chart.refresh();
        };
    }
    function add_behavior(chart, node, edge) {
        chart.cascade(50, true, conditional_properties(function(n) {
            return _moving && _selected.indexOf(n.orig.key) >= 0;
        }, null, sourceprops));

        node.on('mousedown.move-nodes', function(d) {
        });
    }

    function remove_behavior(chart, node, edge) {
        node.on('mousedown.move-nodes', null);
        chart.cascade(50, false, props);
    }

    var _behavior = dc_graph.behavior('move-nodes', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            select_nodes_group.on('node_set_changed.move-nodes', p ? selection_changed(p) : null);
        }
    });

    return _behavior;
};
