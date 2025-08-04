import { set } from 'd3-collection';
import { property } from './core.js';
import { selectThingsGroup } from './select_things.js';

export function filterSelection(things_group, things_name) {
    things_name = things_name || 'select-nodes';
    const select_nodes_group = selectThingsGroup(things_group || 'select-nodes-group', things_name);

    function selection_changed(diagram) {
        return function(selection) {
            if (selection.length) {
                const selectionSet = set(selection);
                _mode.dimensionAccessor()(diagram).filterFunction(k => selectionSet.has(k));
            } else _mode.dimensionAccessor()(diagram).filter(null);
            diagram.redrawGroup();
        };
    }

    const _mode = {
        parent: property(null).react(p => {
            select_nodes_group.on(
                `set_changed.filter-selection-${things_name}`,
                p ? selection_changed(p) : null,
            );
        }),
    };
    _mode.dimensionAccessor = property(diagram => diagram.nodeDimension());
    return _mode;
}
