// this naive tree-drawer is paraphrased from memory from dot
import { depthFirstTraversal } from './depth_first_traversal.js';

export function treePositions(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    console.warn('treePositions is deprecated; use the layout engine tree_layout instead');
    if (rootf || treef) {
        console.warn('treePositions: rootf and treef are ignored');
    }
    let x;
    nwidth = typeof nwidth === 'function' ? nwidth : () => nwidth;
    function best_dist(left, right) {
        return (nwidth(left)+nwidth(right))/2;
    }
    const dfs = depthFirstTraversal({
        nodeid(n) {
            return n.cola.dcg_nodeKey;
        },
        sourceid(n) {
            return n.cola.dcg_edgeSource;
        },
        targetid(n) {
            return n.cola.dcg_edgeTarget;
        },
        init() {
            x = ofsx;
        },
        row(n) {
            return rowf(n.orig);
        },
        place(n, r, row) {
            if (row.length) {
                const left = row[row.length-1];
                const g = (nwidth(left)+nwidth(n))/2;
                x = Math.max(x, left.left_x+g);
            }
            n.left_x = x;
            n.hit_ins = 1;
            n.cola.y = r*ygap+ofsy;
        },
        sib(isroot, left, right) {
            let g = best_dist(left, right);
            if (isroot) g = g*1.5;
            x += g;
        },
        pop(n) {
            n.cola.x = (n.left_x+x)/2;
        },
        skip(n, indegree) {
            // rolling average of in-neighbor x positions
            n.cola.x = (n.hit_ins*n.cola.x+x)/++n.hit_ins;
            if (n.hit_ins === indegree)
                delete n.hit_ins;
        },
        finish(rows) {
            // this is disgusting. patch up any places where nodes overlap by scanning
            // right far enough to find the space, then fill from left to right at the
            // minimum gap
            rows.forEach(row => {
                const sort = row.sort((a, b) => a.cola.x-b.cola.x);
                let badi = null, badl = null, want;
                for (let i = 0; i < sort.length-1; ++i) {
                    const left = sort[i], right = sort[i+1];
                    if (!badi) {
                        if (right.cola.x-left.cola.x < best_dist(left, right)) {
                            badi = i;
                            badl = left.cola.x;
                            want = best_dist(left, right);
                        } // else still not bad
                    } else {
                        want += best_dist(left, right);
                        if (i < sort.length-2 && right.cola.x < badl+want)
                            continue; // still bad
                        else {
                            if (badi > 0)
                                --badi; // might want to use more left
                            let l, limit;
                            if (i < sort.length-2) { // found space before right
                                const extra = right.cola.x-(badl+want);
                                l = sort[badi].cola.x+extra/2;
                                limit = i+1;
                            } else {
                                l = Math.max(
                                    sort[badi].cola.x,
                                    badl-best_dist(
                                        sort[badi],
                                        sort[badi+1],
                                    )-(want-right.cola.x+badl)/2,
                                );
                                limit = sort.length;
                            }
                            for (let j = badi+1; j < limit; ++j) {
                                l += best_dist(sort[j-1], sort[j]);
                                sort[j].cola.x = l;
                            }
                            badi = badl = want = null;
                        }
                    }
                }
            });
        },
    });

    return function(diagram, nodes, edges) {
        return dfs(nodes, edges);
    };
}
