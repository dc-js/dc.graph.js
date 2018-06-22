dc_graph.register_highlight_things_group = function(thingsgroup) {
    window.chart_registry.create_type('highlight-things', function() {
        return d3.dispatch('highlight');
    });

    return window.chart_registry.create_group('highlight-things', thingsgroup);
};
