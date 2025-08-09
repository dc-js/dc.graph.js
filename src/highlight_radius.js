import { graph } from 'metagraph';
import { property } from './core.js';
import { registerHighlightThingsGroup } from './highlight_things_group.js';
import { selectThingsGroup } from './select_things.js';

export function highlightRadius(options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );
    const highlight_things_group = registerHighlightThingsGroup(
        options.highlight_things_group || 'highlight-things-group',
    );
    let _graph, _selection = [];

    function recurse(n, r, nodeset, edgeset) {
        nodeset[n.key()] = true;
        if (r) {
            n.outs().filter(e => !edgeset[e.key()]).forEach(e => {
                edgeset[e.key()] = true;
                recurse(e.target(), r-1, nodeset, edgeset);
            });
            n.ins().filter(e => !edgeset[e.key()]).forEach(e => {
                edgeset[e.key()] = true;
                recurse(e.source(), r-1, nodeset, edgeset);
            });
        }
    }
    function selection_changed(nodes) {
        _selection = nodes;
        console.assert(_graph);
        let nodeset = {}, edgeset = {};
        nodes.forEach(nkey => {
            recurse(_graph.node(nkey), _mode.radius(), nodeset, edgeset);
        });
        if (!Object.keys(nodeset).length && !Object.keys(edgeset).length)
            nodeset = edgeset = null;
        highlight_things_group.call('highlight', null, nodeset, edgeset);
    }

    function on_data(diagram, nodes, wnodes, edges, wedges, _ports, _wports) {
        _graph = graph(wnodes, wedges, {
            nodeKey: diagram.nodeKey.eval,
            edgeKey: diagram.edgeKey.eval,
            edgeSource: diagram.edgeSource.eval,
            edgeTarget: diagram.edgeTarget.eval,
        });
        const sel2 = _selection.filter(nk => !!_graph.node(nk));
        if (sel2.length < _selection.length)
            window.setTimeout(() => {
                select_nodes_group.call('set_changed', null, sel2);
            }, 0);
    }
    const _mode = {
        parent(p) {
            if (p) {
                p.on('data.highlight-radius', on_data);
            } else if (_mode.parent())
                _mode.parent().on('data.highlight-radius', null);
            select_nodes_group.on('set_changed.highlight-radius', selection_changed);
        },
    };
    _mode.radius = property(1);
    return _mode;
}
