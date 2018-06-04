dc_graph.highlight_neighbors = function(props) {
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_highlighted = false;
        });
    }

    function add_behavior(diagram, node, edge) {
        diagram.cascade(100, true, node_edge_conditions(null, function(e) {
            return e.dcg_highlighted;
        }, props));
        node
            .on('mouseover.highlight-neighbors', function(n) {
                edge.each(function(e) {
                    e.dcg_highlighted = e.source === n || e.target === n;
                });
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
        diagram.cascade(100, false, props);
    }

    return dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge) {
            remove_behavior(diagram, node, edge);
        }
    });
};

