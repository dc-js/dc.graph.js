// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_positions = function(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    var x;
    nwidth = d3.functor(nwidth);
    function best_dist(left, right) {
        return (nwidth(left) + nwidth(right)) / 2;
    }
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
            var g = best_dist(left, right);
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
        },
        finish: function(rows) {
            rows.forEach(function(row) {
                var sort = row.sort(function(a, b) { return a.cola.x - b.cola.x; });
                var badi = null, badl = null, want;
                for(var i=0; i<sort.length-1; ++i) {
                    var left = sort[i], right = sort[i+1];
                    if(!badi) {
                        if(right.cola.x - left.cola.x < best_dist(left, right)) {
                            badi = i;
                            badl = left.cola.x;
                            want = best_dist(left, right);
                        } // else still not bad
                    } else {
                        want += best_dist(left, right);
                        if(i === sort.length - 2 || right.cola.x < badl + want)
                            continue; // still bad
                        else {
                            if(badi>0)
                                --badi; // might want to use more left
                            for(var j = badi+1; j<i+1; ++j)
                                sort[j].cola.x = sort[j-1].cola.x + best_dist(sort[j-1], sort[j]);
                            badi = badl = want = null;
                        }
                    }
                }
            });
        }
    });

    return dfs;
};

