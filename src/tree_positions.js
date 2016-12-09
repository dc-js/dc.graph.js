// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_positions = function(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    var x;
    nwidth = d3.functor(nwidth);
    var dfs = dc_graph.depth_first_traversal({
        init: function() {
            x = ofsx;
        },
        root: rootf,
        row: rowf,
        tree: treef,
        place: function(n, r, row) {
            if(row.length) {
                var left = row[row.length-1];
                var g = (nwidth(left) + nwidth(n)) / 2;
                x = Math.max(x, left.left_x + g);
            }
            n.left_x = x;
            n.hit_ins = 1;
            n.cola.y = r*ygap + ofsy;
        },
        sib: function(isroot, left, right) {
            var g = (nwidth(left) + nwidth(right)) / 2;
            if(isroot) g = g*1.5;
            x += g;
        },
        pop: function(n) {
            n.cola.x = (n.left_x + x)/2;
        },
        skip: function(n, indegree) {
            // rolling average of in-neighbor x positions
            n.cola.x = (n.hit_ins*n.cola.x + x)/++n.hit_ins;
            if(n.hit_ins === indegree)
                delete n.hit_ins;
        }
    });

    return dfs;
};

