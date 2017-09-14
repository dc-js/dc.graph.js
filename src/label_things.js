dc_graph.label_things = function(options) {
    options = options || {};
    var select_things_group = dc_graph.select_things_group(options.select_group, options.select_type),
        label_things_group = dc_graph.label_things_group(options.label_group, options.label_type);
    var _selected = [];
    var _keyboard;

    function selection_changed_listener(chart) {
        return function(selection) {
            _selected = selection;
        };
    }

    function grab_focus() {
        _keyboard.focus();
    }

    function edit_label_listener(chart) {
        return function(thing, eventOptions) {
            var box = options.thing_box(thing);
            dc_graph.edit_text(
                chart.g(),
                {
                    text: eventOptions.text || options.thing_label(thing) || options.default_label,
                    align: options.align,
                    box: box,
                    selectText: eventOptions.selectText,
                    accept: function(text) {
                        return options.accept(thing, text)
                            .then(grab_focus) // finallyc
                            .catch(function(error) {
                                grab_focus();
                                throw error;
                            });
                    }
                });
        };
    }

    function add_behavior(chart, node, edge) {
        _keyboard.on('keyup.' + options.label_type, function() {
            if(_selected.length) {
                // printable characters should start edit
                if(d3.event.key.length !== 1)
                    return;
                // less than ideal interface.
                // what if there are other things? can i blame the missing metagraph?
                var thing = options.find_thing(_selected[0], node, edge);
                if(thing.empty()) {
                    console.error("couldn't find thing '" + _selected[0] + "'!");
                    return;
                }
                if(thing.size()>1) {
                    console.error("found too many things for '" + _selected[0] + "' (" + n2.size() + ")!");
                    return;
                }
                label_things_group.edit_label(thing, {text: d3.event.key, selectText: false});
            }
        });
    }

    function remove_behavior(chart, node, edge) {
    }

    var _behavior = dc_graph.behavior(options.label_type, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            select_things_group.on('set_changed.' + options.label_type, p ? selection_changed_listener(p) : null);
            label_things_group.on('edit_label.' + options.label_type, p ? edit_label_listener(p) : null);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
            }
        }
    });
    return _behavior;
};

dc_graph.label_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('edit_label');
    });

    return window.chart_registry.create_group(type, brushgroup);
};
