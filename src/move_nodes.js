dc_graph.move_nodes = function(options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');
    var fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _selected = [], _startPos = null, _downNode, _moveStarted;
    var _brush, _drawGraphs, _selectNodes, _restoreBackgroundClick;

    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }

    function selection_changed(diagram) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
        };
    }
    function for_each_selected(f) {
        _selected.forEach(function(key) {
            var n = _behavior.parent().getWholeNode(key);
            f(n, key);
        });
    }
    function add_behavior(diagram, node, edge) {
        node.on('mousedown.move-nodes', function(n) {
            // Need a more general way for modes to say "I got this"
            if(_drawGraphs && _drawGraphs.usePorts() && _drawGraphs.usePorts().eventPort())
                return;
            _startPos = dc_graph.event_coords(diagram);
            _downNode = d3.select(this);
            // if the node under the mouse is not in the selection, need to
            // make that node selected
            var key = diagram.nodeKey.eval(n);
            if(_selected.indexOf(key)<0)
                select_nodes_group.set_changed([key]);
            for_each_selected(function(n) {
                n.original_position = [n.cola.x, n.cola.y];
            });
            if(_brush)
                _brush.deactivate();
        });
        function mouse_move() {
            if(_startPos) {
                var pos = dc_graph.event_coords(diagram);
                var dx = pos[0] - _startPos[0],
                    dy = pos[1] - _startPos[1];
                if(!_moveStarted && Math.hypot(dx, dy) > _behavior.dragSize()) {
                    _moveStarted = true;
                    // prevent click event for this node setting selection just to this
                    if(_downNode)
                        _downNode.style('pointer-events', 'none');
                }
                if(_moveStarted) {
                    for_each_selected(function(n) {
                        n.cola.x = n.original_position[0] + dx;
                        n.cola.y = n.original_position[1] + dy;
                    });
                    diagram.reposition(node, edge);
                }
            }
        }
        function mouse_up() {
            if(_startPos) {
                if(_moveStarted) {
                    _moveStarted = false;
                    if(_downNode) {
                        _downNode.style('pointer-events', null);
                        _downNode = null;
                    }
                    var fixes = [];
                    for_each_selected(function(n, id) {
                        fixes.push({
                            id: id,
                            pos: {x: n.cola.x, y: n.cola.y}
                        });
                    });
                    fix_nodes_group.request_fixes(fixes);
                }
                if(_brush)
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

    function remove_behavior(diagram, node, edge) {
        node.on('mousedown.move-nodes', null);
        node.on('mousemove.move-nodes', null);
        node.on('mouseup.move-nodes', null);
    }

    var _behavior = dc_graph.behavior('move-nodes', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            select_nodes_group.on('set_changed.move-nodes', p ? selection_changed(p) : null);
            _brush = p.child('brush');
            _drawGraphs = p.child('draw-graphs');
            _selectNodes = p.child('select-nodes');
        }
    });

    // minimum distance that is considered a drag, not a click
    _behavior.dragSize = property(5);

    return _behavior;
};
