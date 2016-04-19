// this naive tree-drawer is paraphrased from memory from dot
dc_graph.initialize_tree = function(rootf, treef, ofsx, ofsy, xgap, ygap) {
    var x = ofsx;
    var dfs = dc_graph.depth_first_traversal(rootf, treef, function(n, r) {
        n.cola.x = x;
        n.cola.y = r*ygap + ofsy;
    }, function() {
        x += xgap;
    });

    return dfs;
};
