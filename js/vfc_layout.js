app_layouts.vfc = function() {
    function rank(label) {
        return label.split(':')[2];
    }

    function is_tree_edge(diagram, e) {
        return rank(diagram.getNode(diagram.edgeSource()(e)).value.label_) !==
            rank(diagram.getNode(diagram.edgeTarget()(e)).value.label_);
    }

    function is_root_node(n) {
        return rank(n.value.label_) === 'VNF';
    }

    var _rowmap = {
        VNF: 0,
        VFC: 1,
        VM: 2,
        Host: 3
    };
    function node_row(n) {
        return _rowmap[rank(n.value.label_)];
    }

    return {
        rules: {
            nodes: [
                {id: 'layer', partition: 'label_', extract: function(v) { return rank(v); },
                 typename: function(id, value) { return value; }}
            ],
            edges: [
                {source: 'VNF', target: 'VFC', produce: dc_graph.gap_y(100, true)},
                {source: 'VFC', target: 'VM', produce: dc_graph.gap_y(100, true)},
                {source: 'VM', target: 'Host', produce: dc_graph.gap_y(100, true)},

                {source: 'VNF', target: 'VNF', produce: dc_graph.align_y()},
                /*
                 {source: 'VFC', target: 'VFC', produce: dc_graph.align_y()},
                 {source: 'VM', target: 'VM', produce: dc_graph.align_y()},
                 {source: 'Host', target: 'Host', produce: dc_graph.align_y()}*/
            ]
        },
        constraints: function(diagram, nodes, edges) {
            return dc_graph.tree_constraints(is_root_node,
                                             is_tree_edge.bind(null, diagram), 10, 100)
            (diagram, nodes, edges);
        },
        initDiagram: function(diagram) {
            diagram
                .nodeLabel(null)
                .nodeRadius(3)
                .induceNodes(true)
                .parallelEdgeOffset(1)
                .edgeLabel(null)
                .edgeArrowSize(0.5)
                .edgeIsLayout(function(e) {
                    return is_tree_edge(diagram, e);
                })
                .nodeFixed(function(n) {
                    return is_root_node(n) ? true : null;
                })
                .nodeTitle(function(n) { return n.value.name; })
            ;
            if(treeOnly) {
                diagram
                    .initialLayout(dc_graph.tree_positions(null, node_row, is_tree_edge.bind(null, diagram), 50, 50, 10, 100))
                    .initialOnly(true)
                ;
            }
        }
    };
}();
