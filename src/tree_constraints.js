// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_constraints = function(rootf, treef, gap) {
    return function(diagram, nodes, edges) {
        var constraints = [];
        var dfs = dc_graph.depth_first_traversal(rootf, treef, function(n, r, row) {
            if(row.length)
                constraints.push({
                    left: param(diagram.nodeKey())(row[row.length-1]),
                    right: param(diagram.nodeKey())(n),
                    axis: 'x',
                    gap: gap,
                    equality: true
                });
        });
        dfs(diagram, nodes, edges);
        return constraints;
    };
};
