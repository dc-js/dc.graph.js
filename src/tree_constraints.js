// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_constraints = function(rootf, treef, xgap, ygap) {
    return function(diagram, nodes, edges) {
        var constraints = [];
        var x = 0;
        var dfs = dc_graph.depth_first_traversal(rootf, treef, function(n, r, row) {
            n.left_x = x;
            // n.cola.x = x;
            // n.cola.y = r*ygap;
        }, function() {
            x += xgap;
        }, null, null, function(n, row) {
            var last = row[row.length-1], right = x;
            if(row.length) {
                constraints.push({
                    left: param(diagram.nodeKey())(last),
                    right: param(diagram.nodeKey())(n),
                    axis: 'x',
                    gap: (n.left_x + right - 2*last.left_x)/2,
                    equality: true
                });
            }
        });
        dfs(diagram, nodes, edges);
        return constraints;
    };
};
