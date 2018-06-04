dc_graph.filter_selection = function(things_group, things_name) {
    things_name = things_name || 'select-nodes';
    var select_nodes_group = dc_graph.select_things_group(things_group || 'select-nodes-group', things_name);

    function selection_changed(diagram) {
        return function(selection) {
            if(selection.length) {
                var set = d3.set(selection);
                _behavior.dimensionAccessor()(diagram).filterFunction(function(k) {
                    return set.has(k);
                });
            } else _behavior.dimensionAccessor()(diagram).filter(null);
            diagram.redrawGroup();
        };
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            select_nodes_group.on('set_changed.filter-selection-' + things_name, p ? selection_changed(p) : null);
        })
    };
    _behavior.dimensionAccessor = property(function(diagram) {
        return diagram.nodeDimension();
    });
    return _behavior;
};
