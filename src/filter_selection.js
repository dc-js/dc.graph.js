import { selectThingsGroup } from './select_things.js';
import { property } from './core.js';
import { set } from 'd3-collection';

export function filterSelection(things_group, things_name) {
    things_name = things_name || 'select-nodes';
    var select_nodes_group = selectThingsGroup(things_group || 'select-nodes-group', things_name);

    function selection_changed(diagram) {
        return function(selection) {
            if(selection.length) {
                var set = set(selection);
                _mode.dimensionAccessor()(diagram).filterFunction(function(k) {
                    return set.has(k);
                });
            } else _mode.dimensionAccessor()(diagram).filter(null);
            diagram.redrawGroup();
        };
    }

    var _mode = {
        parent: property(null).react(function(p) {
            select_nodes_group.on('set_changed.filter-selection-' + things_name, p ? selection_changed(p) : null);
        })
    };
    _mode.dimensionAccessor = property(function(diagram) {
        return diagram.nodeDimension();
    });
    return _mode;
};
