// arguably depth first search is a stupid algorithm to modularize -
// there are many, many interesting moments to insert a behavior
// and those end up being almost bigger than the function itself

// this is an argument for providing a graph API which could make it
// easy to just write a recursive function instead of using this
/**
 * Depth first traversal utility
 * @module depth_first_traversal
 */

export function depthFirstTraversal(callbacks) { // {[init, root, row, tree, place, sib, push, pop, skip,] finish, nodeid, sourceid, targetid}
    return function(nodes, edges) {
        callbacks.init && callbacks.init();
        if (callbacks.tree)
            edges = edges.filter(e => callbacks.tree(e));
        const indegree = {};
        const outmap = edges.reduce((m, e) => {
            const tail = callbacks.sourceid(e),
                head = callbacks.targetid(e);
            if (!m[tail]) m[tail] = [];
            m[tail].push(e);
            indegree[head] = (indegree[head] || 0)+1;
            return m;
        }, {});
        const nmap = nodes.reduce((m, n) => {
            const key = callbacks.nodeid(n);
            m[key] = n;
            return m;
        }, {});

        const rows = [];
        const placed = {};
        function place_tree(n, r) {
            const key = callbacks.nodeid(n);
            if (placed[key]) {
                callbacks.skip && callbacks.skip(n, indegree[key]);
                return;
            }
            if (!rows[r])
                rows[r] = [];
            callbacks.place && callbacks.place(n, r, rows[r]);
            rows[r].push(n);
            placed[key] = true;
            if (outmap[key])
                outmap[key].forEach((e, ei) => {
                    const target = nmap[callbacks.targetid(e)];
                    if (ei && callbacks.sib)
                        callbacks.sib(false, nmap[callbacks.targetid(outmap[key][ei-1])], target);
                    callbacks.push && callbacks.push();
                    place_tree(target, r+1);
                });
            callbacks.pop && callbacks.pop(n);
        }

        let roots;
        if (callbacks.root)
            roots = nodes.filter(n => callbacks.root(n));
        else {
            roots = nodes.filter(n => !indegree[callbacks.nodeid(n)]);
            if (nodes.length && !roots.length) // all nodes are in a cycle
                roots = [nodes[0]];
        }
        roots.forEach((n, ni) => {
            if (ni && callbacks.sib)
                callbacks.sib(true, roots[ni-1], n);
            callbacks.push && callbacks.push();
            place_tree(n, callbacks.row && callbacks.row(n) || 0);
        });
        callbacks.finish(rows);
    };
}

// basically, see if it's any simpler if we start from scratch
// (well, of course it's simpler because we have less callbacks)
// same caveats as above
export function undirectedDfs(callbacks) { // {[comp, node], nodeid, sourceid, targetid}
    return function(nodes, edges) {
        const adjacencies = edges.reduce((m, e) => {
            const tail = callbacks.sourceid(e),
                head = callbacks.targetid(e);
            if (!m[tail]) m[tail] = [];
            if (!m[head]) m[head] = [];
            m[tail].push(head);
            m[head].push(tail);
            return m;
        }, {});
        const nmap = nodes.reduce((m, n) => {
            const key = callbacks.nodeid(n);
            m[key] = n;
            return m;
        }, {});
        const found = {};
        function recurse(n) {
            const nid = callbacks.nodeid(n);
            callbacks.node(compid, n);
            found[nid] = true;
            if (adjacencies[nid])
                adjacencies[nid].forEach(adj => {
                    if (!found[adj])
                        recurse(nmap[adj]);
                });
        }
        let compid = 0;
        nodes.forEach(n => {
            if (!found[callbacks.nodeid(n)]) {
                callbacks.comp && callbacks.comp(compid);
                recurse(n);
                ++compid;
            }
        });
    };
}
