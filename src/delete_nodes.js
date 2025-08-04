import { deleteThings } from './delete_things.js';
import { selectThingsGroup } from './select_things.js';

export function deleteNodes(id_tag, options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );
    const select_edges_group = selectThingsGroup(
        options.select_edges_group || 'select-edges-group',
        'select-edges',
    );
    const _mode = deleteThings(select_nodes_group, 'delete-nodes', id_tag);

    _mode.preDelete(nodes => {
        // request a delete of all attached edges, using the delete edges mode
        // kind of horrible
        const diagram = _mode.parent();
        const deleteEdgesMode = diagram.child('delete-edges');
        if (!deleteEdgesMode)
            return null; // reject if we can't delete the edges
        // it is likely that the delete_edges mode is listening to the same keyup event we
        // are. introduce a pause to let it process the delete key now, deleting any selected edges.
        // then select any remaining edges connected to the selected nodes and delete those.
        //
        // more evidence that modes need to be able to say "i got this", or that we should have
        // batch deletion. otoh, given the current behavior, delete_nodes deferring to delete_edges
        // makes about as much sense as anything
        return Promise.resolve(undefined).then(() => {
            const deleteEdges = diagram.edgeGroup().all().filter(e =>
                nodes.indexOf(diagram.edgeSource()(e)) !== -1
                || nodes.indexOf(diagram.edgeTarget()(e)) !== -1
            ).map(diagram.edgeKey());
            select_edges_group.call('set_changed', null, deleteEdges);
            return deleteEdgesMode.deleteSelection().then(() => nodes);
        });
    });
    return _mode;
}
