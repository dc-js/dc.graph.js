// arguably depth first search is a stupid algorithm to modularize -
// there are many, many interesting moments to insert a behavior
// and those end up being almost bigger than the function itself

// this is an argument for providing a graph API which could make it
// easy to just write a recursive function instead of using this
dc_graph.depth_first_traversal = function(rootf, rowf, treef, placef, sibf, pushf, popf, skipf) {
    return function(diagram, nodes, edges) {
        if(treef)
            edges = edges.filter(function(e) { return treef(e.orig); });
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
                skipf && skipf(n, indegree[key]);
                return;
            }
            if(!rows[r])
                rows[r] = [];
            placef && placef(n, r, rows[r]);
            rows[r].push(n);
            placed[key] = true;
            if(outmap[key])
                outmap[key].forEach(function(e, ei) {
                    if(ei && sibf)
                        sibf();
                    pushf && pushf();
                    place_tree(e.target, r+1);
                });
            popf && popf(n);
        }

        var roots;
        if(rootf)
            roots = nodes.filter(function(n) { return rootf(n.orig); });
        else {
            roots = nodes.filter(function(n) { return !indegree[diagram.nodeKey.eval(n)]; });
        }
        roots.forEach(function(n, ni) {
            if(ni && sibf)
                sibf();
            pushf && pushf();
            place_tree(n, rowf ? rowf(n.orig) : 0);
        });
    };
};
