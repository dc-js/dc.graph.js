// External dependency loaded as global
const d3 = globalThis.d3;

export function registerHighlightPathsGroup(pathsgroup) {
    window.chart_registry.create_type('highlight-paths', function() {
        return d3.dispatch('paths_changed', 'hover_changed', 'select_changed');
    });

    return window.chart_registry.create_group('highlight-paths', pathsgroup);
}
