dc_graph.highlight_radius = function(options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');
    var highlight_things_group = dc_graph.register_highlight_things_group(options.highlight_things_group || 'highlight-things-group');
    var _graph, _selection = [];

    function recurse(n, r, nodeset, edgeset) {
        nodeset[n.key()] = true;
        if(r) {
            n.outs().filter(function(e) {
                return !edgeset[e.key()];
            }).forEach(function(e) {
                edgeset[e.key()] = true;
                recurse(e.target(), r-1, nodeset, edgeset);
            });
            n.ins().filter(function(e) {
                return !edgeset[e.key()];
            }).forEach(function(e) {
                edgeset[e.key()] = true;
                recurse(e.source(), r-1, nodeset, edgeset);
            });
        }
    }
    function selection_changed(nodes) {
        _selection = nodes;
        console.assert(_graph);
        var nodeset = {}, edgeset = {};
        nodes.forEach(function(nkey) {
            recurse(_graph.node(nkey), _mode.radius(), nodeset, edgeset);
        });
        if(!Object.keys(nodeset).length && !Object.keys(edgeset).length)
            nodeset = edgeset = null;
        highlight_things_group.highlight(nodeset, edgeset);
    }

    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _graph = metagraph.graph(wnodes, wedges, {
            nodeKey: diagram.nodeKey.eval,
            edgeKey: diagram.edgeKey.eval,
            edgeSource: diagram.edgeSource.eval,
            edgeTarget: diagram.edgeTarget.eval
        });
        var sel2 = _selection.filter(function(nk) {
            return !!_graph.node(nk);
        });
        if(sel2.length < _selection.length)
            window.setTimeout(function() {
                select_nodes_group.set_changed(sel2);
            }, 0);
    }
    var _mode = {
        parent: function(p) {
            if(p) {
                p.on('data.highlight-radius', on_data);
            } else if(_mode.parent())
                _mode.parent().on('data.highlight-radius', null);
            select_nodes_group.on('set_changed.highlight-radius', selection_changed);
        }
    };
    _mode.radius = property(1);
    return _mode;
};
