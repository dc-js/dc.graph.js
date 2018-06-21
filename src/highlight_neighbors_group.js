dc_graph.register_highlight_neighbors_group = function(neighborsgroup) {
    window.chart_registry.create_type('highlight-neighbors', function() {
        return d3.dispatch('highlight_node');
    });

    return window.chart_registry.create_group('highlight-neighbors', neighborsgroup);
};
