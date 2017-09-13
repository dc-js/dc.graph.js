dc_graph.move_nodes = function() {
    var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');
    var _selected = [], _startPos = null;
    var _brush;

    // http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
    var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
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
    function add_behavior(chart, node, edge) {
        node.on('mousedown.move-nodes', function(d) {
            _startPos = dc_graph.event_coords(chart);
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
                for_each_selected(function(n) {
                    n.cola.x = n.original_position[0] + dx;
                    n.cola.y = n.original_position[1] + dy;
                });
                chart.reposition(node, edge);
            }
        }
        function mouse_up() {
            if(_startPos) {
                chart.relax();
                for_each_selected(function(n) {
                    n.cola.dcg_nodeFixed = {x: n.cola.x, y: n.cola.y};
                });
                // chart.on('end.move-nodes', function() {
                //     chart
                //         .on('end.move-nodes', null)
                //         .relax()
                //         .redraw();
                // });
                chart.redraw();
                _startPos = null;
            }
        }
        node
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
        chart.svg()
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
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
        }
    });

    return _behavior;
};
