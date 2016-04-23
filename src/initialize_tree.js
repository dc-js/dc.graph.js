// this naive tree-drawer is paraphrased from memory from dot
dc_graph.initialize_tree = function(rootf, rowf, treef, ofsx, ofsy, xgap, ygap) {
    var x = ofsx;
    var dfs = dc_graph.depth_first_traversal(rootf, rowf, treef, function(n, r) {
        n.left_x = x;
        n.cola.y = r*ygap + ofsy;
    }, function() {
        x += xgap;
    }, null, function(n) {
        n.cola.x = (n.left_x + x)/2;
    });

    return dfs;
};

