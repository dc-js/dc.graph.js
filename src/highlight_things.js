dc_graph.highlight_things = function(includeprops, excludeprops, modename, groupname, cascbase) {
    var highlight_things_group = dc_graph.register_highlight_things_group(groupname || 'highlight-things-group');
    var _active, _nodeset = {}, _edgeset = {};
    cascbase = cascbase || 150;

    function highlight(nodeset, edgeset) {
        _active = nodeset || edgeset;
        _nodeset = nodeset || {};
        _edgeset = edgeset || {};
        _behavior.parent().requestRefresh(_behavior.durationOverride());
    }
    function add_behavior(diagram) {
        diagram.cascade(cascbase, true, node_edge_conditions(
            function(n) {
                return _nodeset[_behavior.parent().nodeKey.eval(n)];
            }, function(e) {
                return _edgeset[_behavior.parent().edgeKey.eval(e)];
            }, includeprops));
        diagram.cascade(cascbase+10, true, node_edge_conditions(
            function(n) {
                return _active && !_nodeset[_behavior.parent().nodeKey.eval(n)];
            }, function(e) {
                return _active && !_edgeset[_behavior.parent().edgeKey.eval(e)];
            }, excludeprops));
    }
    function remove_behavior(diagram) {
        diagram.cascade(cascbase, false, includeprops);
        diagram.cascade(cascbase + 10, false, excludeprops);
    }
    var _behavior = dc_graph.behavior(modename, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            highlight_things_group.on('highlight.' + modename, p ? highlight : null);
        }
    });
    _behavior.durationOverride = property(undefined);
    return _behavior;
};
