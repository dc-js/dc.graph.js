// this naive tree-drawer is paraphrased from memory from dot
dc_graph.initialize_tree = function(rootf, treef, gap) {
    return function(diagram, nodes, edges) {
        if(treef)
            edges = edges.filter(treef);

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
            rows[r].push(n);
            placed[key] = true;
            if(outmap[key])
                outmap[key].forEach(function(e) {
                    place_tree(e.target, r+1);
                });
        }

        var roots;
        if(rootf)
            roots = nodes.filter(rootf);
        else {
            throw new Error("root-finder not implemented (it's easy!)");
        }
        roots.forEach(function(n) {
            place_tree(n, 0);
        });
        rows.forEach(function(row, ri) {
            var x = 0, y = ri*gap;
            row.forEach(function(n) {
                n.cola.x = x;
                n.cola.y = y;
                x += 20; // NO
            });
        });
    };
};
