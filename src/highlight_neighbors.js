dc_graph.highlight_neighbors = function(includeprops, excludeprops, neighborsgroup) {
    var highlight_neighbors_group = dc_graph.register_highlight_neighbors_group(neighborsgroup || 'highlight-neighbors-group');
    var _hovered = false;

    function highlight_node(nodeid) {
        _behavior.parent().selectAllNodes().each(function(n) {
            n.dcg_highlighted = false;
        });
        if(nodeid) {
            _behavior.parent().selectAllEdges().each(function(e) {
                e.dcg_highlighted = _behavior.parent().nodeKey.eval(e.source) === nodeid ||
                    _behavior.parent().nodeKey.eval(e.target) === nodeid;
                if(e.dcg_highlighted)
                    e.source.dcg_highlighted = e.target.dcg_highlighted = true;
            });
            _hovered = true;
        } else {
            _behavior.parent().selectAllEdges().each(function(e) {
                e.dcg_highlighted = false;
            });
            _hovered = false;
        }
        var transdur;
        if(_behavior.durationOverride() !== undefined) {
            transdur = _behavior.parent().transitionDuration();
            _behavior.parent().transitionDuration(_behavior.durationOverride());
        }
        _behavior.parent().refresh();
        if(_behavior.durationOverride() !== undefined)
            _behavior.parent().transitionDuration(transdur);
    }
    function add_behavior(diagram, node, edge) {
        diagram.cascade(100, true, node_edge_conditions(
            function(n) {
                return n.dcg_highlighted;
            }, function(e) {
                return e.dcg_highlighted;
            }, includeprops));
        diagram.cascade(110, true, node_edge_conditions(
            function(n) {
                return _hovered && !n.dcg_highlighted;
            }, function(e) {
                return _hovered && !e.dcg_highlighted;
            }, excludeprops));
        node
            .on('mouseover.highlight-neighbors', function(n) {
                highlight_neighbors_group.highlight_node(_behavior.parent().nodeKey.eval(n));
            })
            .on('mouseout.highlight-neighbors', function(n) {
                highlight_neighbors_group.highlight_node(null);
            });
    }

    function remove_behavior(diagram, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        highlight_neighbors_group.highlight_node(null);
        diagram.cascade(100, false, includeprops);
    }

    var _behavior = dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge) {
            remove_behavior(diagram, node, edge);
        },
        parent: function(p) {
            highlight_neighbors_group.on('highlight_node.highlight', p ? highlight_node : null);
        }
    });
    _behavior.durationOverride = property(undefined);
    return _behavior;
};

