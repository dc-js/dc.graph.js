// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_constraints = function(rootf, treef, xgap, ygap) {
    return function(diagram, nodes, edges) {
        var constraints = [];
        var x = 0;
        var dfs = dc_graph.depth_first_traversal(rootf, null, treef, function(n, r, row) {
            if(row.length) {
                var last = row[row.length-1];
                constraints.push({
                    left: diagram.nodeKey.eval(last),
                    right: diagram.nodeKey.eval(n),
                    axis: 'x',
                    gap: x-last.foo_x,
                    equality: true
                });
            }
            n.foo_x = x;
            // n.cola.x = x;
            // n.cola.y = r*ygap;
        }, function() {
            x += xgap;
        });
        dfs(diagram, nodes, edges);
        return constraints;
    };
};
