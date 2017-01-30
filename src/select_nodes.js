dc_graph.select_nodes = function(props) {
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');
    var _selected = [], _oldSelected;
    var _brush;

    // http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
    var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }
    function add_array(a, v) {
        return a.indexOf(v) >= 0 ? a : a.concat([v]);
    }
    function toggle_array(a, v) {
        return a.indexOf(v) >= 0 ? a.filter(function(x) { return x != v; }) : a.concat([v]);
    }

    function selection_changed_listener(chart) {
        return function(selection) {
            _selected = selection;
            chart.refresh();
        };
    }
    function background_click_event(chart, v) {
        chart.svg().on('click.select-nodes', v ? function(d) {
            select_nodes_group.node_set_changed([]);
        } : null);
    }
    function add_behavior(chart, node, edge) {
        var condition = _behavior.noneIsAll() ? function(n) {
            return !_selected.length || _selected.indexOf(n.orig.key) >= 0;
        } : function(n) {
            return _selected.indexOf(n.orig.key) >= 0;
        };
        chart.cascade(50, true, conditional_properties(condition, null, props));

        node.on('click.select-nodes', function(d) {
            var key = chart.nodeKey.eval(d), newSelected;
            if(isUnion(d3.event))
                newSelected = add_array(_selected, key);
            else if(isToggle(d3.event))
                newSelected = toggle_array(_selected, key);
            else {
                if(_selected.length === 1 && _selected[0] === key && _behavior.secondClickEvent())
                    _behavior.secondClickEvent()(d3.select(this));
                newSelected = [key];
            }
            select_nodes_group.node_set_changed(newSelected);
            d3.event.stopPropagation();
        });
        function brushstart() {
            if(isUnion(d3.event.sourceEvent) || isToggle(d3.event.sourceEvent))
                _oldSelected = _selected.slice();
            else {
                _oldSelected = [];
                select_nodes_group.node_set_changed([]);
            }
        }
        function brushmove() {
            var ext = _brush.extent();
            var rectSelect = node.data().filter(function(n) {
                return ext[0][0] < n.cola.x && n.cola.x < ext[1][0] &&
                    ext[0][1] < n.cola.y && n.cola.y < ext[1][1];
            }).map(function(n) {
                return n.orig.key;
            });
            var newSelected;
            if(isUnion(d3.event.sourceEvent))
                newSelected = rectSelect.reduce(add_array, _oldSelected);
            else if(isToggle(d3.event.sourceEvent))
                newSelected = rectSelect.reduce(toggle_array, _oldSelected);
            else
                newSelected = rectSelect;
            select_nodes_group.node_set_changed(newSelected);
        }
        function brushend() {
            gBrush.call(_brush.clear());
        }
        _brush = d3.svg.brush()
            .x(chart.x()).y(chart.y())
            .on('brushstart', brushstart)
            .on('brush', brushmove)
            .on('brushend', brushend);

        var gBrush = chart.g().insert('g', ':first-child')
                .attr('class', 'brush')
                .call(_brush);
        background_click_event(chart, _behavior.clickBackgroundClears());

        // drop any selected which no longer exist in the diagram
        var present = node.data().map(function(d) { return d.orig.key; });
        var now_selected = _selected.filter(function(k) { return present.indexOf(k) >= 0; });
        if(_selected.length !== now_selected.length)
            select_nodes_group.node_set_changed(now_selected);
    }

    function remove_behavior(chart, node, edge) {
        node.on('click.select-nodes', null);
        chart.svg().on('click.select-nodes', null);
        chart.cascade(50, false, props);
    }

    var _behavior = dc_graph.behavior('select-nodes', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
        },
        parent: function(p) {
            select_nodes_group.on('node_set_changed.select-nodes', p ? selection_changed_listener(p) : null);
        }
    });

    _behavior.clickBackgroundClears = property(true, false).react(function(v) {
        if(_behavior.parent())
            background_click_event(_behavior.parent(), v);
    });
    _behavior.secondClickEvent = property(null);
    _behavior.noneIsAll = property(false);
    return _behavior;
};

dc_graph.select_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('select-nodes', function() {
        return d3.dispatch('node_set_changed');
    });

    return window.chart_registry.create_group('select-nodes', brushgroup);
};
