dc_graph.register_highlight_paths_group = function(pathsgroup) {
    window.chart_registry.create_type('highlight-paths', function() {
        return d3.dispatch('paths_changed', 'hover_changed', 'select_changed');
    });

    return window.chart_registry.create_group('highlight-paths', pathsgroup);
};
