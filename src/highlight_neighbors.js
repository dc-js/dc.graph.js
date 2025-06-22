import { mode } from './mode.js';
import { property } from './core.js';
import { registerHighlightNeighborsGroup } from './highlight_neighbors_group.js';
import { registerHighlightThingsGroup } from './highlight_things_group.js';
import { highlightThings } from './highlight_things.js';

export function highlightNeighbors(includeprops, excludeprops, neighborsgroup, thingsgroup) {
    var highlight_neighbors_group = registerHighlightNeighborsGroup(neighborsgroup || 'highlight-neighbors-group');
    var highlight_things_group = registerHighlightThingsGroup(thingsgroup || 'highlight-things-group');

    function highlight_node(nodeid) {
        var diagram = _mode.parent();
        var nodeset = {}, edgeset = {};
        if(nodeid) {
            nodeset[nodeid] = true;
            _mode.parent().selectAllEdges().each(function(e) {
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
    function draw(diagram, node, edge) {
        node
            .on('mouseover.highlight-neighbors', function(n) {
                highlight_neighbors_group.highlight_node(_mode.parent().nodeKey.eval(n));
            })
            .on('mouseout.highlight-neighbors', function(n) {
                highlight_neighbors_group.highlight_node(null);
            });
    }

    function remove(diagram, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        highlight_neighbors_group.highlight_node(null);
    }

    var _mode = mode('highlight-neighbors', {
        draw: draw,
        remove: function(diagram, node, edge) {
            remove(diagram, node, edge);
        },
        parent: function(p) {
            highlight_neighbors_group.on('highlight_node.highlight-neighbors', p ? highlight_node : null);
            if(p && !p.child('highlight-things'))
                p.child('highlight-things',
                        highlightThings(includeprops, excludeprops)
                          .durationOverride(_mode.durationOverride()));
        }
    });
    _mode.durationOverride = property(undefined);
    return _mode;
};

