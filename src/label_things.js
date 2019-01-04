dc_graph.label_things = function(options) {
    options = options || {};
    var select_things_group = dc_graph.select_things_group(options.select_group, options.select_type),
        label_things_group = dc_graph.label_things_group(options.label_group, options.label_type);
    var _selected = [];
    var _keyboard, _selectThings;

    function selection_changed_listener(diagram) {
        return function(selection) {
            _selected = selection;
        };
    }

    function grab_focus() {
        _keyboard.focus();
    }

    function edit_label_listener(diagram) {
        return function(thing, eventOptions) {
            var box = options.thing_box(thing);
            options.hide_thing_label(thing, true);
            dc_graph.edit_text(
                diagram.g(),
                {
                    text: eventOptions.text || options.thing_label(thing) || options.default_label,
                    align: options.align,
                    class: options.class,
                    box: box,
                    selectText: eventOptions.selectText,
                    accept: function(text) {
                        return options.accept(thing, text);
                    },
                    finally: function() {
                        options.hide_thing_label(thing, false);
                        grab_focus();
                    }
                });
        };
    }

    function edit_selection(node, edge, eventOptions) {
        // less than ideal interface.
        // what if there are other things? can i blame the missing metagraph?
        var thing = options.find_thing(_selected[0], node, edge);
        if(thing.empty()) {
            console.error("couldn't find thing '" + _selected[0] + "'!");
            return;
        }
        if(thing.size()>1) {
            console.error("found too many things for '" + _selected[0] + "' (" + thing.size() + ")!");
            return;
        }
        label_things_group.edit_label(thing, eventOptions);
    }
    function draw(diagram, node, edge) {
        _keyboard.on('keyup.' + options.label_type, function() {
            if(_selected.length) {
                // printable characters should start edit
                if(d3.event.key.length !== 1)
                    return;
                edit_selection(node, edge, {text: d3.event.key, selectText: false});
            }
        });
        if(_selectThings)
            _selectThings.thinginess().clickables(diagram, node, edge).on('dblclick.' + options.label_type, function() {
                edit_selection(node, edge, {selectText: true});
            });
    }

    function remove(diagram, node, edge) {
    }

    var _mode = dc_graph.mode(options.label_type, {
        draw: draw,
        remove: remove,
        parent: function(p) {
            select_things_group.on('set_changed.' + options.label_type, p ? selection_changed_listener(p) : null);
            label_things_group.on('edit_label.' + options.label_type, p ? edit_label_listener(p) : null);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
                _selectThings = p.child(options.select_type);
            }
        }
    });
    _mode.editSelection = function(eventOptions) {
        edit_selection(_mode.parent().selectAllNodes(), _mode.parent().selectAllEdges(), eventOptions);
    };
    return _mode;
};

dc_graph.label_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('edit_label');
    });

    return window.chart_registry.create_group(type, brushgroup);
};
