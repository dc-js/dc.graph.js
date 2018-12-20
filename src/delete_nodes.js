dc_graph.delete_nodes = function(id_tag, options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');
    var select_edges_group = dc_graph.select_things_group(options.select_edges_group || 'select-edges-group', 'select-edges');
    var _mode = dc_graph.delete_things(select_nodes_group, 'delete-nodes', id_tag);

    _mode.preDelete(function(nodes) {
        // request a delete of all attached edges, using the delete edges mode
        // kind of horrible
        var diagram = _mode.parent();
        var deleteEdgesMode = diagram.child('delete-edges');
        if(!deleteEdgesMode)
            return null; // reject if we can't delete the edges
        // it is likely that the delete_edges mode is listening to the same keyup event we
        // are. introduce a pause to let it process the delete key now, deleting any selected edges.
        // then select any remaining edges connected to the selected nodes and delete those.
        //
        // more evidence that modes need to be able to say "i got this", or that we should have
        // batch deletion. otoh, given the current behavior, delete_nodes deferring to delete_edges
        // makes about as much sense as anything
        return Promise.resolve(undefined).then(function() {
            var deleteEdges = diagram.edgeGroup().all().filter(function(e) {
                return nodes.indexOf(diagram.edgeSource()(e)) !== -1 ||
                    nodes.indexOf(diagram.edgeTarget()(e)) !== -1;
            }).map(diagram.edgeKey());
            select_edges_group.set_changed(deleteEdges);
            return deleteEdgesMode.deleteSelection().then(function() {
                return nodes;
            });
        });
    });
    return _mode;
};
