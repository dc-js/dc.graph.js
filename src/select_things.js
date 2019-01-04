dc_graph.select_things = function(things_group, things_name, thinginess) {
    var _selected = [], _oldSelected;
    var _mousedownThing = null;

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

    function selection_changed(diagram) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
            if(refresh)
                diagram.requestRefresh();
        };
    }
    var _have_bce = false;
    function background_click_event(diagram, v) {
        // we seem to have nodes-background interrupting edges-background by reinstalling uselessly
        if(_have_bce === v)
            return;
        diagram.svg().on('click.' + things_name, v ? function(t) {
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
        if(!thinginess.intersectRect)
            return;
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

    function draw(diagram, node, edge) {
        var condition = _mode.noneIsAll() ? function(t) {
            return !_selected.length || contains(_selected, thinginess.key(t));
        } : function(t) {
            return contains(_selected, thinginess.key(t));
        };
        thinginess.applyStyles(condition);

        thinginess.clickables(diagram, node, edge).on('mousedown.' + things_name, function(t) {
            _mousedownThing = t;
        });

        thinginess.clickables(diagram, node, edge).on('mouseup.' + things_name, function(t) {
            if(thinginess.excludeClick && thinginess.excludeClick(d3.event.target))
                return;
            // it's only a click if the same target was mousedown & mouseup
            // but we can't use click event because things may have been reordered
            if(_mousedownThing !== t)
                return;
            var key = thinginess.key(t), newSelected;
            if(_mode.multipleSelect()) {
                if(isUnion(d3.event))
                    newSelected = add_array(_selected, key);
                else if(isToggle(d3.event))
                    newSelected = toggle_array(_selected, key);
            }
            if(!newSelected)
                newSelected = [key];
            things_group.set_changed(newSelected);
        });

        if(_mode.multipleSelect()) {
            var brush_mode = diagram.child('brush');
            brush_mode.activate();
        }
        else
            background_click_event(diagram, _mode.clickBackgroundClears());

        if(_mode.autoCropSelection()) {
            // drop any selected which no longer exist in the diagram
            var present = thinginess.clickables(diagram, node, edge).data().map(thinginess.key);
            var now_selected = _selected.filter(function(k) { return contains(present, k); });
            if(_selected.length !== now_selected.length)
                things_group.set_changed(now_selected, false);
        }
    }

    function remove(diagram, node, edge) {
        thinginess.clickables(diagram, node, edge).on('click.' + things_name, null);
        diagram.svg().on('click.' + things_name, null);
        thinginess.removeStyles();
    }

    var _mode = dc_graph.mode(things_name, {
        draw: draw,
        remove: remove,
        parent: function(p) {
            things_group.on('set_changed.' + things_name, p ? selection_changed(p) : null);
            if(p && _mode.multipleSelect()) {
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

    _mode.multipleSelect = property(true);
    _mode.clickBackgroundClears = property(true, false).react(function(v) {
        if(!_mode.multipleSelect() && _mode.parent())
            background_click_event(_mode.parent(), v);
    });
    _mode.noneIsAll = property(false);
    // if you're replacing the data, you probably want the selection not to be preserved when a thing
    // with the same key re-appears later (true). however, if you're filtering dc.js-style, you
    // probably want filters to be independent between diagrams (false)
    _mode.autoCropSelection = property(true);
    // if you want to do the cool things select_things can do
    _mode.thinginess = function() {
        return thinginess;
    };
    return _mode;
};

dc_graph.select_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('set_changed');
    });

    return window.chart_registry.create_group(type, brushgroup);
};
