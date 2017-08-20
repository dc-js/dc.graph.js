dc_graph.delete_nodes = function() {
    var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');
    var select_edges_group = dc_graph.select_things_group('select-edges-group', 'select-edges');
    var _behavior = dc_graph.delete_things(select_nodes_group, 'delete-nodes');

    _behavior.afterAuth(function(nodes) {
        // request a delete of all attached edges, using the delete edges mode
        // kind of horrible
        var diagram = _behavior.parent();
        var deleteEdgesMode = diagram.child('delete-edges');
        if(!deleteEdgesMode)
            return null; // reject if we can't delete the edges
        var deleteEdges = diagram.edgeGroup().all().filter(function(e) {
            return nodes.indexOf(diagram.edgeSource()(e)) !== -1 ||
                nodes.indexOf(diagram.edgeTarget()(e)) !== -1;
        }).map(diagram.edgeKey());
        select_edges_group.set_changed(deleteEdges);
        return deleteEdgesMode.deleteSelection().then(function() {
            return nodes;
        });
    });
    return _behavior;
};
