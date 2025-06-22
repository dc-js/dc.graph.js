// this naive tree-drawer is paraphrased from memory from dot
import { depthFirstTraversal } from './depth_first_traversal.js';

export function treeConstraints(rootf, treef, xgap, ygap) {
    console.warn('treeConstraints is deprecated - it never worked right and may not be a good idea');
    return function(diagram, nodes, edges) {
        var constraints = [];
        var x = 0;
        var dfs = depthFirstTraversal({
            root: rootf,
            tree: treef,
            place: function(n, r, row) {
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
            },
            sib: function() {
                x += xgap;
            }
        });
        dfs(diagram, nodes, edges);
        return constraints;
    };
};
