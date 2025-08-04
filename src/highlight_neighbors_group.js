// External dependencies
import { dispatch } from 'd3-dispatch';

export function registerHighlightNeighborsGroup(neighborsgroup) {
    window.chart_registry.create_type('highlight-neighbors', () => dispatch('highlight_node'));

    return window.chart_registry.create_group('highlight-neighbors', neighborsgroup);
}
