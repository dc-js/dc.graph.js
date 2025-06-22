// External dependency loaded as global
const d3 = globalThis.d3;

export function registerHighlightThingsGroup(thingsgroup) {
    window.chart_registry.create_type('highlight-things', function() {
        return d3.dispatch('highlight');
    });

    return window.chart_registry.create_group('highlight-things', thingsgroup);
}
