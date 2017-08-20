dc_graph.delete_things = function(things_group, mode_name) {
    var _keyboard, _selected = [];
    function selection_changed(selection) {
        _selected = selection;
    }
    function delete_selection() {
        if(!_behavior.crossfilterAccessor())
            throw new Error('need crossfilterAccessor');
        if(!_behavior.dimensionAccessor())
            throw new Error('need dimensionAccessor');
        var authorize = _behavior.onDelete() ? _behavior.onDelete()(_selected) : Promise.resolve(_selected);
        authorize.then(function(selection) {
            if(selection && selection.length) {
                var crossfilter = _behavior.crossfilterAccessor()(_behavior.parent()),
                    dimension = _behavior.dimensionAccessor()(_behavior.parent());
                dimension.filterFunction(function(k) {
                    return selection.indexOf(k) !== -1;
                });
                crossfilter.remove();
                dimension.filter(null);
                _behavior.parent().redrawGroup();
            }
        });
    }
    function add_behavior(chart) {
        _keyboard.on('keyup.' + mode_name, function() {
            if(d3.event.code === 'Delete')
                delete_selection();
        });
    }
    function remove_behavior(chart) {
    }
    var _behavior = dc_graph.behavior(mode_name, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            things_group.on('set_changed.' + mode_name, selection_changed);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
            }
        }
    });
    _behavior.onDelete = property(null);
    _behavior.crossfilterAccessor = property(null);
    _behavior.dimensionAccessor = property(null);
    return _behavior;
};
