// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_positions = function(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    console.warn('dc_graph.tree_positions is deprecated; use the layout engine tree_layout instead');
    if(rootf || treef) {
        console.warn('dc_graph.tree_positions: rootf and treef are ignored');
    }
    var x;
    nwidth = d3.functor(nwidth);
    function best_dist(left, right) {
        return (nwidth(left) + nwidth(right)) / 2;
    }
    var dfs = dc_graph.depth_first_traversal({
        nodeid: function(n) {
            return n.cola.dcg_nodeKey;
        },
        sourceid: function(n) {
            return n.cola.dcg_edgeSource;
        },
        targetid: function(n) {
            return n.cola.dcg_edgeTarget;
        },
        init: function() {
            x = ofsx;
        },
        row: function(n) {
            return rowf(n.orig);
        },
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
            // this is disgusting. patch up any places where nodes overlap by scanning
            // right far enough to find the space, then fill from left to right at the
            // minimum gap
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
                        if(i < sort.length - 2 && right.cola.x < badl + want)
                            continue; // still bad
                        else {
                            if(badi>0)
                                --badi; // might want to use more left
                            var l, limit;
                            if(i < sort.length - 2) { // found space before right
                                var extra = right.cola.x - (badl + want);
                                l = sort[badi].cola.x + extra/2;
                                limit = i+1;
                            } else {
                                l = Math.max(sort[badi].cola.x, badl - best_dist(sort[badi], sort[badi+1]) - (want - right.cola.x + badl)/2);
                                limit = sort.length;
                            }
                            for(var j = badi+1; j<limit; ++j) {
                                l += best_dist(sort[j-1], sort[j]);
                                sort[j].cola.x = l;
                            }
                            badi = badl = want = null;
                        }
                    }
                }
            });
        }
    });

    return function(diagram, nodes, edges) {
        return dfs(nodes, edges);
    };
};

