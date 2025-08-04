import { event as d3Event, select } from 'd3-selection';
import { property } from './core.js';
import { fixNodesGroup } from './fix_nodes.js';
import { keyboard } from './keyboard.js';
import { mode } from './mode.js';
import { selectThingsGroup } from './select_things.js';
import { is_a_mac } from './utils.js';
import { eventCoords } from './utils.js';

export function moveNodes(options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );
    const fix_nodes_group = fixNodesGroup(options.fix_nodes_group || 'fix-nodes-group');
    let _selected = [], _startPos = null, _downNode, _moveStarted;
    let _brush, _drawGraphs, _selectNodes, _restoreBackgroundClick, _keyboard;
    let _maybeSelect = null;

    function _isUnion(event) {
        return event.shiftKey;
    }
    function _isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }

    function selection_changed(_diagram) {
        return function(selection, refresh) {
            if (refresh === undefined)
                refresh = true;
            _selected = selection;
        };
    }
    function for_each_selected(f, selected) {
        selected = selected || _selected;
        selected.forEach(key => {
            const n = _mode.parent().getWholeNode(key);
            f(n, key);
        });
    }
    function draw(diagram, node, edge) {
        node.on('mousedown.move-nodes', function(n) {
            // Need a more general way for modes to say "I got this"
            if (_drawGraphs && _drawGraphs.usePorts() && _drawGraphs.usePorts().eventPort(d3Event))
                return;
            if (!_keyboard.modKeysMatch(_mode.modKeys()))
                return;
            _startPos = eventCoords(diagram, d3Event);
            _downNode = select(this);
            // if the node under the mouse is not in the selection, need to
            // make that node selected
            const key = diagram.nodeKey.eval(n);
            let selected = _selected;
            if (_selected.indexOf(key) < 0) {
                selected = [key];
                _maybeSelect = key;
            } else _maybeSelect = null;
            for_each_selected(n => {
                n.original_position = [n.cola.x, n.cola.y];
            }, selected);
            if (_brush)
                _brush.deactivate();
        });
        function mouse_move(event) {
            if (_startPos) {
                if (!(event.buttons&1)) {
                    mouse_up();
                    return;
                }
                if (_maybeSelect)
                    select_nodes_group.call('set_changed', null, [_maybeSelect]);
                const pos = eventCoords(diagram, event);
                const dx = pos[0]-_startPos[0],
                    dy = pos[1]-_startPos[1];
                if (!_moveStarted && Math.hypot(dx, dy) > _mode.dragSize()) {
                    _moveStarted = true;
                    // prevent click event for this node setting selection just to this
                    if (_downNode)
                        _downNode.style('pointer-events', 'none');
                }
                if (_moveStarted) {
                    for_each_selected(n => {
                        n.cola.x = n.original_position[0]+dx;
                        n.cola.y = n.original_position[1]+dy;
                    });
                    const node2 = node.filter(n => _selected.includes(n.orig.key)),
                        edge2 = edge.filter(e =>
                            _selected.includes(e.source.orig.key)
                            || _selected.includes(e.target.orig.key)
                        );
                    diagram.reposition(node2, edge2);
                }
            }
        }
        function mouse_up() {
            if (_startPos) {
                if (_moveStarted) {
                    _moveStarted = false;
                    if (_downNode) {
                        _downNode.style('pointer-events', null);
                        _downNode = null;
                    }
                    const fixes = [];
                    for_each_selected((n, id) => {
                        fixes.push({
                            id,
                            pos: {x: n.cola.x, y: n.cola.y},
                        });
                    });
                    fix_nodes_group.call('request_fixes', null, fixes);
                }
                if (_brush)
                    _brush.activate();
                _startPos = null;
            }
        }
        node
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
        diagram.svg()
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
    }

    function remove(diagram, node, _edge) {
        node.on('mousedown.move-nodes', null);
        node.on('mousemove.move-nodes', null);
        node.on('mouseup.move-nodes', null);
    }

    const _mode = mode('move-nodes', {
        draw,
        remove,
        parent(p) {
            select_nodes_group.on('set_changed.move-nodes', p ? selection_changed(p) : null);
            if (p) {
                _brush = p.child('brush');
                _drawGraphs = p.child('draw-graphs');
                _selectNodes = p.child('select-nodes');
                _keyboard = p.child('keyboard');
                if (!_keyboard)
                    p.child('keyboard', _keyboard = keyboard());
            } else _brush = _drawGraphs = _selectNodes = null;
        },
    });

    // minimum distance that is considered a drag, not a click
    _mode.dragSize = property(5);
    _mode.modKeys = property(null);

    return _mode;
}
