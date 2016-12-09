// arguably depth first search is a stupid algorithm to modularize -
// there are many, many interesting moments to insert a behavior
// and those end up being almost bigger than the function itself

// this is an argument for providing a graph API which could make it
// easy to just write a recursive function instead of using this
dc_graph.depth_first_traversal = function(callbacks) { // {init, root, row, tree, place, sib, push, pop, skip, finish}
    return function(diagram, nodes, edges) {
        callbacks.init && callbacks.init();
        if(callbacks.tree)
            edges = edges.filter(function(e) { return callbacks.tree(e.orig); });
        var indegree = {};
        var outmap = edges.reduce(function(m, e) {
            var tail = diagram.edgeSource.eval(e),
                head = diagram.edgeTarget.eval(e);
            if(!m[tail]) m[tail] = [];
            m[tail].push(e);
            indegree[head] = (indegree[head] || 0) + 1;
            return m;
        }, {});

        var rows = [];
        var placed = {};
        function place_tree(n, r) {
            var key = diagram.nodeKey.eval(n);
            if(placed[key]) {
                callbacks.skip && callbacks.skip(n, indegree[key]);
                return;
            }
            if(!rows[r])
                rows[r] = [];
            callbacks.place && callbacks.place(n, r, rows[r]);
            rows[r].push(n);
            placed[key] = true;
            if(outmap[key])
                outmap[key].forEach(function(e, ei) {
                    if(ei && callbacks.sib)
                        callbacks.sib(false, outmap[key][ei-1].target, e.target);
                    callbacks.push && callbacks.push();
                    place_tree(e.target, r+1);
                });
            callbacks.pop && callbacks.pop(n);
        }

        var roots;
        if(callbacks.root)
            roots = nodes.filter(function(n) { return callbacks.root(n.orig); });
        else {
            roots = nodes.filter(function(n) { return !indegree[diagram.nodeKey.eval(n)]; });
        }
        roots.forEach(function(n, ni) {
            if(ni && callbacks.sib)
                callbacks.sib(true, roots[ni-1], n);
            callbacks.push && callbacks.push();
            place_tree(n, callbacks.row ? callbacks.row(n.orig) : 0);
        });
        callbacks.finish(rows);
    };
};
