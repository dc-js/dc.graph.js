// load a graph from various formats and return the data in consistent {nodes, links} format
dc_graph.load_graph = function(file, callback) {
    if(/^clique[0-9]+$/.test(file)) {
        var N = +/[0-9]+/.exec(file)[0];
        var nodes = new Array(N),
            edges = [];
        for(var i=0; i<N; ++i) {
            nodes[i] = {
                id: i,
                name: String.fromCharCode(97+i)
            };
            for(var j=0; j<i; ++j)
                edges.push({
                    source: j,
                    target: i,
                    sourcename: nodes[j].name,
                    targetname: nodes[i].name
                });
        }
        var graph = {nodes: nodes, links: edges};
        callback(null, graph);
    }
    else if(/\.json$/.test(file))
        d3.json(file, callback);
    else if(/\.gv|\.dot$/.test(file))
        d3.text(file, function (error, f) {
            if(error) {
                callback(error, null);
                return;
            }
            var digraph = graphlibDot.parse(f);

            var nodeNames = digraph.nodes();
            var nodes = new Array(nodeNames.length);
            nodeNames.forEach(function (name, i) {
                var node = nodes[i] = digraph._nodes[nodeNames[i]];
                node.id = i;
                node.name = name;
            });

            var edgeNames = digraph.edges();
            var edges = [];
            edgeNames.forEach(function(e) {
                var edge = digraph._edges[e];
                edges.push({
                    source: digraph._nodes[edge.u].id,
                    target: digraph._nodes[edge.v].id,
                    sourcename: edge.u,
                    targetname: edge.v
                });
            });
            var graph = {nodes: nodes, links: edges};
            callback(null, graph);
        });
};
