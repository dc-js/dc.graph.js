dc_graph.highlight_things = function(includeprops, excludeprops, thingsgroup) {
    var highlight_things_group = dc_graph.register_highlight_things_group(thingsgroup || 'highlight-things-group');
    var _active, _nodeset = {}, _edgeset = {};

    function highlight(nodeset, edgeset) {
        _active = nodeset || edgeset;
        _nodeset = nodeset;
        _edgeset = edgeset;
        var transdur;
        if(_behavior.durationOverride() !== undefined) {
            transdur = _behavior.parent().transitionDuration();
            _behavior.parent().transitionDuration(_behavior.durationOverride());
        }
        _behavior.parent().refresh();
        if(_behavior.durationOverride() !== undefined)
            _behavior.parent().transitionDuration(transdur);
    }
    function add_behavior(diagram) {
        diagram.cascade(150, true, node_edge_conditions(
            function(n) {
                return _nodeset[_behavior.parent().nodeKey.eval(n)];
            }, function(e) {
                return _edgeset[_behavior.parent().edgeKey.eval(e)];
            }, includeprops));
        diagram.cascade(160, true, node_edge_conditions(
            function(n) {
                return _active && !_nodeset[_behavior.parent().nodeKey.eval(n)];
            }, function(e) {
                return _active && !_edgeset[_behavior.parent().edgeKey.eval(e)];
            }, excludeprops));
    }
    function remove_behavior(diagram) {
        diagram.cascade(150, false, includeprops);
        diagram.cascade(160, false, excludeprops);
    }
    var _behavior = dc_graph.behavior('highlight-things', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            highlight_things_group.on('highlight.highlight-things', p ? highlight : null);
        }
    });
    _behavior.durationOverride = property(undefined);
    return _behavior;
};
