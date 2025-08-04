import { selectThings, selectThingsGroup } from './select_things.js';
import { ancestorHasClass, nodeEdgeConditions } from './utils.js';

export function selectNodes(props, options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );

    const thinginess = {
        intersectRect(ext) {
            return _mode.parent().selectAllNodes().data().filter(n =>
                n && ext[0][0] < n.cola.x && n.cola.x < ext[1][0]
                && ext[0][1] < n.cola.y && n.cola.y < ext[1][1]
            ).map(this.key);
        },
        clickables(diagram, node, _edge) {
            return node;
        },
        excludeClick(element) {
            return ancestorHasClass(element, 'port');
        },
        key(n) {
            return _mode.parent().nodeKey.eval(n);
        },
        applyStyles(pred) {
            _mode.parent().cascade(50, true, nodeEdgeConditions(pred, null, props));
        },
        removeStyles() {
            _mode.parent().cascade(50, false, props);
        },
    };
    const _mode = selectThings(select_nodes_group, 'select-nodes', thinginess);
    return _mode;
}
