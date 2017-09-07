dc_graph.select_things = function(things_group, things_name, thinginess) {
    var _selected = [], _oldSelected;

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

    function selection_changed(chart) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
            if(refresh)
                chart.refresh();
        };
    }
    function background_click_event(chart, v) {
        chart.svg().on('click.' + things_name, v ? function(d) {
            if(d3.event.target === this)
                things_group.set_changed([]);
        } : null);
    }
    function brushstart() {
        if(isUnion(d3.event.sourceEvent) || isToggle(d3.event.sourceEvent))
            _oldSelected = _selected.slice();
        else {
            _oldSelected = [];
            things_group.set_changed([]);
        }
    }
    function brushmove(ext) {
        console.log('brushmove', things_name);
        var rectSelect = thinginess.intersectRect(ext);
        var newSelected;
        if(isUnion(d3.event.sourceEvent))
            newSelected = rectSelect.reduce(add_array, _oldSelected);
        else if(isToggle(d3.event.sourceEvent))
            newSelected = rectSelect.reduce(toggle_array, _oldSelected);
        else
            newSelected = rectSelect;
        things_group.set_changed(newSelected);
    }

    function add_behavior(chart, node, edge) {
        var condition = _behavior.noneIsAll() ? function(t) {
            return !_selected.length || _selected.indexOf(thinginess.key(t)) >= 0;
        } : function(t) {
            return _selected.indexOf(thinginess.key(t)) >= 0;
        };
        thinginess.applyStyles(condition);

        thinginess.clickables(chart, node, edge).on('click.' + things_name, function(d) {
            var key = thinginess.key(d), newSelected;
            if(_behavior.multipleSelect()) {
                if(isUnion(d3.event))
                    newSelected = add_array(_selected, key);
                else if(isToggle(d3.event))
                    newSelected = toggle_array(_selected, key);
            }
            if(!newSelected) {
                if(_selected.length === 1 && _selected[0] === key && _behavior.secondClickEvent()) {
                    _behavior.secondClickEvent()(d3.select(this));
                    d3.event.stopPropagation();
                }
                newSelected = [key];
            }
            things_group.set_changed(newSelected);
        });

        if(_behavior.multipleSelect()) {
            var brush_mode = chart.child('brush');
            brush_mode.activate();
        }
        else
            background_click_event(chart, _behavior.clickBackgroundClears());

        if(_behavior.autoCropSelection()) {
            // drop any selected which no longer exist in the diagram
            var present = thinginess.clickables(chart, node, edge).data().map(thinginess.key);
            var now_selected = _selected.filter(function(k) { return present.indexOf(k) >= 0; });
            if(_selected.length !== now_selected.length)
                things_group.set_changed(now_selected, false);
        }
    }

    function remove_behavior(chart, node, edge) {
        thinginess.clickables(chart, node, edge).on('click.' + things_name, null);
        chart.svg().on('click.' + things_name, null);
        thinginess.removeStyles();
    }

    var _behavior = dc_graph.behavior(things_name, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            things_group.on('set_changed.' + things_name, p ? selection_changed(p) : null);
            if(p) {
                var brush_mode = p.child('brush');
                if(!brush_mode) {
                    brush_mode = dc_graph.brush();
                    p.child('brush', brush_mode);
                }
                brush_mode
                    .on('brushstart.' + things_name, brushstart)
                    .on('brushmove.' + things_name, brushmove);
            }
        }
    });

    _behavior.multipleSelect = property(true);
    _behavior.clickBackgroundClears = property(true, false).react(function(v) {
        if(!_behavior.multipleSelect() && _behavior.parent())
            background_click_event(_behavior.parent(), v);
    });
    _behavior.secondClickEvent = property(null);
    _behavior.noneIsAll = property(false);
    // if you're replacing the data, you probably want the selection not to be preserved when a thing
    // with the same key re-appears later (true). however, if you're filtering dc.js-style, you
    // probably want filters to be independent between charts (false)
    _behavior.autoCropSelection = property(true);
    return _behavior;
};

dc_graph.select_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('set_changed');
    });

    return window.chart_registry.create_group(type, brushgroup);
};
