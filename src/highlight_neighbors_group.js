// External dependency loaded as global
const d3 = globalThis.d3;

export function registerHighlightNeighborsGroup(neighborsgroup) {
    window.chart_registry.create_type('highlight-neighbors', function() {
        return d3.dispatch('highlight_node');
    });

    return window.chart_registry.create_group('highlight-neighbors', neighborsgroup);
}
