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
        if(!_mode.crossfilterAccessor())
            throw new Error('need crossfilterAccessor');
        if(!_mode.dimensionAccessor())
            throw new Error('need dimensionAccessor');
        selection = selection || _selected;
        if(selection.length === 0)
            return Promise.resolve([]);
        var promise = _mode.preDelete() ? _mode.preDelete()(selection) : Promise.resolve(selection);
        if(_mode.onDelete())
            promise = promise.then(_mode.onDelete());
        return promise.then(function(selection) {
            if(selection && selection.length) {
                var crossfilter = _mode.crossfilterAccessor()(_mode.parent()),
                    dimension = _mode.dimensionAccessor()(_mode.parent());
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

                _mode.parent().redrawGroup();
            }
            return true;
        });
    }
    function draw(diagram) {
        _keyboard.on('keyup.' + mode_name, function() {
            if(d3.event.code === _deleteKey)
                delete_selection();
        });
    }
    function remove(diagram) {
    }
    var _mode = dc_graph.mode(mode_name, {
        draw: draw,
        remove: remove,
        parent: function(p) {
            things_group.on('set_changed.' + mode_name, selection_changed);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
            }
        }
    });
    _mode.preDelete = property(null);
    _mode.onDelete = property(null);
    _mode.crossfilterAccessor = property(null);
    _mode.dimensionAccessor = property(null);
    _mode.deleteSelection = delete_selection;
    return _mode;
};
