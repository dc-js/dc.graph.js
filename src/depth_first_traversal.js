// this naive tree-drawer is paraphrased from memory from dot
dc_graph.depth_first_traversal = function(rootf, treef, placef, sibf, pushf, popf) {
    return function(diagram, nodes, edges) {
        if(treef)
            edges = edges.filter(function(e) { return treef(e.orig); });

        var outmap = edges.reduce(function(m, e) {
            var tail = param(diagram.edgeSource())(e),
                head = param(diagram.edgeTarget())(e);
            if(!m[tail]) m[tail] = [];
            m[tail].push(e);
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
            popf && popf();
        }

        var roots;
        if(rootf)
            roots = nodes.filter(function(n) { return rootf(n.orig); });
        else {
            throw new Error("root-finder not implemented (it's easy!)");
        }
        roots.forEach(function(n, ni) {
            if(ni && sibf)
                sibf();
            pushf && pushf();
            place_tree(n, 0);
        });
    };
};
