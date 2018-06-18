dc_graph.highlight_neighbors = function(includeprops, excludeprops) {
    var _hovered = false;
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_highlighted = false;
        });
        _hovered = false;
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
                node.each(function(n) {
                    n.dcg_highlighted = false;
                });
                edge.each(function(e) {
                    e.dcg_highlighted = e.source === n || e.target === n;
                    if(e.dcg_highlighted)
                        e.source.dcg_highlighted = e.target.dcg_highlighted = true;
                });
                _hovered = true;
                diagram.refresh(node, edge);
            })
            .on('mouseout.highlight-neighbors', function(n) {
                clear_all_highlights(edge);
                diagram.refresh(node, edge);
            });
    }

    function remove_behavior(diagram, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        clear_all_highlights(edge);
        diagram.cascade(100, false, includeprops);
    }

    return dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge) {
            remove_behavior(diagram, node, edge);
        }
    });
};

