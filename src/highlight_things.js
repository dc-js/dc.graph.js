dc_graph.highlight_things = function(includeprops, excludeprops, modename, groupname, cascbase) {
    var highlight_things_group = dc_graph.register_highlight_things_group(groupname || 'highlight-things-group');
    var _active, _nodeset = {}, _edgeset = {};
    cascbase = cascbase || 150;

    function highlight(nodeset, edgeset) {
        _active = nodeset || edgeset;
        _nodeset = nodeset || {};
        _edgeset = edgeset || {};
        _mode.parent().requestRefresh(_mode.durationOverride());
    }
    function draw(diagram) {
        diagram.cascade(cascbase, true, node_edge_conditions(
            function(n) {
                return _nodeset[_mode.parent().nodeKey.eval(n)];
            }, function(e) {
                return _edgeset[_mode.parent().edgeKey.eval(e)];
            }, includeprops));
        diagram.cascade(cascbase+10, true, node_edge_conditions(
            function(n) {
                return _active && !_nodeset[_mode.parent().nodeKey.eval(n)];
            }, function(e) {
                return _active && !_edgeset[_mode.parent().edgeKey.eval(e)];
            }, excludeprops));
    }
    function remove(diagram) {
        diagram.cascade(cascbase, false, includeprops);
        diagram.cascade(cascbase + 10, false, excludeprops);
    }
    var _mode = dc_graph.mode(modename, {
        draw: draw,
        remove: remove,
        parent: function(p) {
            highlight_things_group.on('highlight.' + modename, p ? highlight : null);
        }
    });
    _mode.durationOverride = property(undefined);
    return _mode;
};
