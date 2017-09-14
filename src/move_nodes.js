dc_graph.move_nodes = function(options) {
    options = options || {};
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');
    var _selected = [], _startPos = null, _downNode, _moveStarted;
    var _brush, _drawGraphs, _selectNodes, _restoreBackgroundClick;

    // http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
    var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }

    function relax_all() {
        var chart = _behavior.parent();
        for_all_nodes(chart.selectAllNodes(), function(n, selected) {
            n.orig.value[_fixedPosTag] = null;
        });
        chart
            .redraw();
    }
    function selection_changed(chart) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
        };
    }
    function for_each_selected(f) {
        _selected.forEach(function(key) {
            var n = _behavior.parent().getWholeNode(key);
            f(n);
        });
    }
    function for_all_nodes(node, f) {
        node.each(function(n) {
            var selected = _selected.indexOf(_behavior.parent().nodeKey.eval(n)) >= 0;
            f(n, selected);
        });
    }
    function add_behavior(chart, node, edge) {
        node.on('mousedown.move-nodes', function(d) {
            // Need a more general way for modes to say "I got this"
            if(_drawGraphs && _drawGraphs.usePorts() && _drawGraphs.usePorts().eventPort())
                return;
            if(_selectNodes)
                if((_restoreBackgroundClick = _selectNodes.clickBackgroundClears()))
                    _selectNodes.clickBackgroundClears(false);
            _startPos = dc_graph.event_coords(chart);
            _downNode = d3.select(this);
            // if the node under the mouse is not in the selection, need to
            // make that node selected
            var key = chart.nodeKey.eval(d);
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
                var pos = dc_graph.event_coords(chart);
                var dx = pos[0] - _startPos[0],
                    dy = pos[1] - _startPos[1];
                if(!_moveStarted && Math.hypot(dx, dy) > _behavior.dragSize()) {
                    _moveStarted = true;
                    if(_downNode)
                        _downNode.style('pointer-events', 'none'); // prevent click event for this node
                }
                if(_moveStarted) {
                    for_each_selected(function(n) {
                        n.cola.x = n.original_position[0] + dx;
                        n.cola.y = n.original_position[1] + dy;
                    });
                    chart.reposition(node, edge);
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
                    var callback = _behavior.fixNode() || promise_identity;
                    var promises = [];
                    for_all_nodes(node, function(n, selected) {
                        var key = chart.nodeKey.eval(n),
                            oldFixed = n.orig.value[_fixedPosTag],
                            changed = false;
                        if(oldFixed) {
                            if(!selected || n.cola.x !== oldFixed.x || n.cola.y !== oldFixed.y)
                                changed = true;
                        }
                        else changed = selected;
                        if(changed) {
                            var promise;
                            if(selected)
                                promise = callback(key, {x: n.cola.x, y: n.cola.y});
                            else
                                promise = callback(key, null);
                            promises.push(promise.then(function(fixed) {
                                n.orig.value[_fixedPosTag] = fixed;
                            }));
                        }
                    });
                    Promise.all(promises).then(function() {
                        chart.redraw();
                        if(_restoreBackgroundClick)
                            _selectNodes.clickBackgroundClears(true);
                    });
                }
                _startPos = null;
            }
        }
        node
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
        chart.svg()
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up)
            .on('click.move-nodes', function() {
                if(!_selected.length)
                    relax_all();
            });
    }

    function remove_behavior(chart, node, edge) {
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
    // callback for setting & fixing node position
    _behavior.fixNode = property(null);

    return _behavior;
};
