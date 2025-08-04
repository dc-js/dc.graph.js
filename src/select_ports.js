import { selectThings, selectThingsGroup } from './select_things.js';
import { conditionalProperties } from './utils.js';

export function selectPorts(props, options) {
    options = options || {};
    const port_style = options.portStyle || 'symbols';
    const select_ports_group = selectThingsGroup(options.select_ports_group || 'select-ports-group', 'select-ports');
    const thinginess = {
        laterDraw: true,
        intersectRect: null, // multiple selection not supported for now
        clickables() {
            return _mode.parent().selectAllNodes('g.port');
        },
        key(p) {
            // this scheme also won't work with multiselect
            return p.named ?
                {node: _mode.parent().nodeKey.eval(p.node), name: p.name} :
            {edge: _mode.parent().edgeKey.eval(p.edges[0]), name: p.name};
        },
        applyStyles(pred) {
            _mode.parent().portStyle(port_style).cascade(50, true, conditionalProperties(pred, props));
        },
        removeStyles() {
            _mode.parent().portStyle(port_style).cascade(50, false, props);
        },
        keysEqual(k1, k2) {
            return k1.name === k2.name && (k1.node ? k1.node === k2.node : k1.edge === k2.edge);
        }
    };
    const _mode = selectThings(select_ports_group, 'select-ports', thinginess);
    return _mode;
};
