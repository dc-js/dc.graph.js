dc_graph.highlight_neighbors = function(includeprops, excludeprops, neighborsgroup, thingsgroup) {
    var highlight_neighbors_group = dc_graph.register_highlight_neighbors_group(neighborsgroup || 'highlight-neighbors-group');
    var highlight_things_group = dc_graph.register_highlight_things_group(thingsgroup || 'highlight-things-group');

    function highlight_node(nodeid) {
        var diagram = _behavior.parent();
        var nodeset = {}, edgeset = {};
        if(nodeid) {
            nodeset[nodeid] = true;
            _behavior.parent().selectAllEdges().each(function(e) {
                if(diagram.nodeKey.eval(e.source) === nodeid) {
                    edgeset[diagram.edgeKey.eval(e)] = true;
                    nodeset[diagram.nodeKey.eval(e.target)] = true;
                }
                if(diagram.nodeKey.eval(e.target) === nodeid) {
                    edgeset[diagram.edgeKey.eval(e)] = true;
                    nodeset[diagram.nodeKey.eval(e.source)] = true;
                }
            });
            highlight_things_group.highlight(nodeset, edgeset);
        }
        else highlight_things_group.highlight(null, null);
    }
    function add_behavior(diagram, node, edge) {
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
    }

    var _behavior = dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge) {
            remove_behavior(diagram, node, edge);
        },
        parent: function(p) {
            highlight_neighbors_group.on('highlight_node.highlight', p ? highlight_node : null);
            if(!p.child('highlight-things'))
                p.child('highlight-things',
                        dc_graph.highlight_things(includeprops, excludeprops)
                          .durationOverride(_behavior.durationOverride()));
        }
    });
    _behavior.durationOverride = property(undefined);
    return _behavior;
};

