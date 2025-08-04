// External dependencies
import { dispatch } from 'd3-dispatch';

export function registerHighlightThingsGroup(thingsgroup) {
    window.chart_registry.create_type('highlight-things', () => dispatch('highlight'));

    return window.chart_registry.create_group('highlight-things', thingsgroup);
}
