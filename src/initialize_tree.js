// this naive tree-drawer is paraphrased from memory from dot
dc_graph.initialize_tree = function(rootf, treef, gap) {
    var x = 0;
    var dfs = dc_graph.depth_first_traversal(rootf, treef, function(n, r) {
        n.cola.x = x;
        n.cola.y = r*gap;
    }, function() {
        x += 12;
    });

    return dfs;
};
