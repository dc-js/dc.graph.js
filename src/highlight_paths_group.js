// External dependencies
import { dispatch } from 'd3-dispatch';

export function registerHighlightPathsGroup(pathsgroup) {
    window.chart_registry.create_type('highlight-paths', function() {
        return dispatch('paths_changed', 'hover_changed', 'select_changed');
    });

    return window.chart_registry.create_group('highlight-paths', pathsgroup);
}
