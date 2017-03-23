dc_graph.filter_selection = function() {
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');

    function selection_changed(chart) {
        return function(selection) {
            console.log(selection);
            if(selection.length) {
                var set = d3.set(selection);
                chart.nodeDimension().filterFunction(function(k) {
                    return set.has(k);
                });
            } else chart.nodeDimension().filter(null);
            chart.redrawGroup();
        };
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            select_nodes_group.on('node_set_changed.filter-selection', p ? selection_changed(p) : null);
        })
    };
    return _behavior;
};
