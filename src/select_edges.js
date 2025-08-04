import { selectThings, selectThingsGroup } from './select_things.js';
import { nodeEdgeConditions } from './utils.js';

export function selectEdges(props, options) {
    options = options || {};
    const select_edges_group = selectThingsGroup(
        options.select_edges_group || 'select-edges-group',
        'select-edges',
    );
    const thinginess = {
        intersectRect(ext) {
            return this.clickables().data().filter(e => {
                // this nonsense because another select_things may have invalidated the edge positions (!!)
                const sp = {
                        x: e.source.cola.x+e.sourcePort.pos.x,
                        y: e.source.cola.y+e.sourcePort.pos.y,
                    },
                    tp = {
                        x: e.target.cola.x+e.targetPort.pos.x,
                        y: e.target.cola.y+e.targetPort.pos.y,
                    };
                return [sp, tp].some(p =>
                    ext[0][0] < p.x && p.x < ext[1][0]
                    && ext[0][1] < p.y && p.y < ext[1][1]
                );
            }).map(this.key);
        },
        clickables() {
            return _mode.parent().selectAllEdges('.edge-hover');
        },
        key(e) {
            return _mode.parent().edgeKey.eval(e);
        },
        applyStyles(pred) {
            _mode.parent().cascade(50, true, nodeEdgeConditions(null, pred, props));
        },
        removeStyles() {
            _mode.parent().cascade(50, false, props);
        },
    };
    const _mode = selectThings(select_edges_group, 'select-edges', thinginess);
    return _mode;
}
