// this naive tree-drawer is paraphrased from memory from dot
dc_graph.depth_first_traversal = function(rootf, rowf, treef, placef, sibf, pushf, popf) {
    return function(diagram, nodes, edges) {
        if(treef)
            edges = edges.filter(function(e) { return treef(e.orig); });
        var indegree = {};
        var outmap = edges.reduce(function(m, e) {
            var tail = param(diagram.edgeSource())(e),
                head = param(diagram.edgeTarget())(e);
            if(!m[tail]) m[tail] = [];
            m[tail].push(e);
            indegree[head] = (indegree[head] || 0) + 1;
            return m;
        }, {});

        var rows = [];
        var placed = {};
        function place_tree(n, r) {
            var key = param(diagram.nodeKey())(n);
            if(placed[key])
                return;
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
            roots = nodes.filter(function(n) { return !indegree[param(diagram.nodeKey())(n)]; });
        }
        roots.forEach(function(n, ni) {
            if(ni && sibf)
                sibf();
            pushf && pushf();
            place_tree(n, rowf ? rowf(n.orig) : 0);
        });
    };
};
