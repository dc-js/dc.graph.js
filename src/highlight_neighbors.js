import { property } from './core.js';
import { registerHighlightNeighborsGroup } from './highlight_neighbors_group.js';
import { highlightThings } from './highlight_things.js';
import { registerHighlightThingsGroup } from './highlight_things_group.js';
import { mode } from './mode.js';

export function highlightNeighbors(includeprops, excludeprops, neighborsgroup, thingsgroup) {
    const highlight_neighbors_group = registerHighlightNeighborsGroup(
        neighborsgroup || 'highlight-neighbors-group',
    );
    const highlight_things_group = registerHighlightThingsGroup(
        thingsgroup || 'highlight-things-group',
    );

    function highlight_node(nodeid) {
        const diagram = _mode.parent();
        const nodeset = {}, edgeset = {};
        if (nodeid) {
            nodeset[nodeid] = true;
            _mode.parent().selectAllEdges().each(e => {
                if (diagram.nodeKey.eval(e.source) === nodeid) {
                    edgeset[diagram.edgeKey.eval(e)] = true;
                    nodeset[diagram.nodeKey.eval(e.target)] = true;
                }
                if (diagram.nodeKey.eval(e.target) === nodeid) {
                    edgeset[diagram.edgeKey.eval(e)] = true;
                    nodeset[diagram.nodeKey.eval(e.source)] = true;
                }
            });
            highlight_things_group.call('highlight', null, nodeset, edgeset);
        } else highlight_things_group.call('highlight', null, null, null);
    }
    function draw(diagram, node, _edge) {
        node
            .on('mouseover.highlight-neighbors', n => {
                highlight_neighbors_group.call(
                    'highlight_node',
                    null,
                    _mode.parent().nodeKey.eval(n),
                );
            })
            .on('mouseout.highlight-neighbors', _n => {
                highlight_neighbors_group.call('highlight_node', null, null);
            });
    }

    function remove(diagram, node, _edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        highlight_neighbors_group.call('highlight_node', null, null);
    }

    const _mode = mode('highlight-neighbors', {
        draw,
        remove(diagram, node, edge) {
            remove(diagram, node, edge);
        },
        parent(p) {
            highlight_neighbors_group.on(
                'highlight_node.highlight-neighbors',
                p ? highlight_node : null,
            );
            if (p && !p.child('highlight-things'))
                p.child(
                    'highlight-things',
                    highlightThings(includeprops, excludeprops)
                        .durationOverride(_mode.durationOverride()),
                );
        },
    });
    _mode.durationOverride = property(undefined);
    return _mode;
}
