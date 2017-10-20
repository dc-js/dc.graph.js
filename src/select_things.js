dc_graph.select_things = function(things_group, things_name, thinginess) {
    var _selected = [], _oldSelected;

    var contains_predicate = thinginess.keysEqual ?
            function(k1) {
                return function(k2) {
                    return thinginess.keysEqual(k1, k2);
                };
            } :
        function(k1) {
            return function(k2) {
                return k1 === k2;
            };
        };
    function contains(array, key) {
        return !!_selected.find(contains_predicate(key));
    }
    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }
    function add_array(array, key) {
        return contains(array, key) ? array : array.concat([key]);
    }
    function toggle_array(array, key) {
        return contains(array, key) ? array.filter(function(x) { return x != key; }) : array.concat([key]);
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
    var _have_bce = false;
    function background_click_event(chart, v) {
        // we seem to have nodes-background interrupting edges-background by reinstalling uselessly
        if(_have_bce === v)
            return;
        chart.svg().on('click.' + things_name, v ? function(d) {
            if(d3.event.target === this)
                things_group.set_changed([]);
        } : null);
        _have_bce = v;
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
            return !_selected.length || contains(_selected, thinginess.key(t));
        } : function(t) {
            return contains(_selected, thinginess.key(t));
        };
        thinginess.applyStyles(condition);

        thinginess.clickables(chart, node, edge).on('click.' + things_name, function(d) {
            if(thinginess.excludeClick && thinginess.excludeClick(d3.event.target))
                return;
            var key = thinginess.key(d), newSelected;
            if(_behavior.multipleSelect()) {
                if(isUnion(d3.event))
                    newSelected = add_array(_selected, key);
                else if(isToggle(d3.event))
                    newSelected = toggle_array(_selected, key);
            }
            if(!newSelected)
                newSelected = [key];
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
            var now_selected = _selected.filter(function(k) { return contains(present, k); });
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
        },
        laterDraw: thinginess.laterDraw || false
    });

    _behavior.multipleSelect = property(true);
    _behavior.clickBackgroundClears = property(true, false).react(function(v) {
        if(!_behavior.multipleSelect() && _behavior.parent())
            background_click_event(_behavior.parent(), v);
    });
    _behavior.noneIsAll = property(false);
    // if you're replacing the data, you probably want the selection not to be preserved when a thing
    // with the same key re-appears later (true). however, if you're filtering dc.js-style, you
    // probably want filters to be independent between charts (false)
    _behavior.autoCropSelection = property(true);
    // if you want to do the cool things select_things can do
    _behavior.thinginess = function() {
        return thinginess;
    };
    return _behavior;
};

dc_graph.select_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('set_changed');
    });

    return window.chart_registry.create_group(type, brushgroup);
};
