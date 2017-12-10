dc_graph.delete_things = function(things_group, mode_name, id_tag) {
    id_tag = id_tag || 'id';
    var _deleteKey = is_a_mac ? 'Backspace' : 'Delete';
    var _keyboard, _selected = [];
    function selection_changed(selection) {
        _selected = selection;
    }
    function row_id(r) {
        return r[id_tag];
    }
    function delete_selection(selection) {
        if(!_behavior.crossfilterAccessor())
            throw new Error('need crossfilterAccessor');
        if(!_behavior.dimensionAccessor())
            throw new Error('need dimensionAccessor');
        selection = selection || _selected;
        if(selection.length === 0)
            return Promise.resolve([]);
        var promise = _behavior.preDelete() ? _behavior.preDelete()(selection) : Promise.resolve(selection);
        if(_behavior.onDelete())
            promise = promise.then(_behavior.onDelete());
        return promise.then(function(selection) {
            if(selection && selection.length) {
                var crossfilter = _behavior.crossfilterAccessor()(_behavior.parent()),
                    dimension = _behavior.dimensionAccessor()(_behavior.parent());
                var all = crossfilter.all().slice(), n = all.length;
                dimension.filter(null);
                crossfilter.remove();
                var filtered = all.filter(function(r) {
                    return selection.indexOf(row_id(r)) === -1;
                });
                if(all.length !== filtered.length + selection.length)
                    console.warn('size after deletion is not previous size minus selection size',
                                 filtered.map(row_id), all.map(row_id), selection);
                crossfilter.add(filtered);

                _behavior.parent().redrawGroup();
            }
            return true;
        });
    }
    function add_behavior(chart) {
        _keyboard.on('keyup.' + mode_name, function() {
            if(d3.event.code === _deleteKey)
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
    _behavior.preDelete = property(null);
    _behavior.onDelete = property(null);
    _behavior.crossfilterAccessor = property(null);
    _behavior.dimensionAccessor = property(null);
    _behavior.deleteSelection = delete_selection;
    return _behavior;
};
