// this naive tree-drawer is paraphrased from memory from dot
dc_graph.initialize_tree = function(rootf, treef, gap) {
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
        function place_tree(n, r, x) {
            var key = param(diagram.nodeKey())(n);
            if(placed[key])
                return x;
            if(!rows[r])
                rows[r] = [];
            n.cola.x = x;
            n.cola.y = r*gap;
            rows[r].push(n);
            placed[key] = true;
            if(outmap[key])
                outmap[key].forEach(function(e, ei) {
                    if(ei)
                        x += 12;
                    x = place_tree(e.target, r+1, x);
                });
            return x;
        }

        var roots;
        if(rootf)
            roots = nodes.filter(function(n) { return rootf(n.orig); });
        else {
            throw new Error("root-finder not implemented (it's easy!)");
        }
        var x = 0;
        roots.forEach(function(n, ni) {
            if(ni)
                x += 12;
            x = place_tree(n, 0, x);
        });
    };
};
