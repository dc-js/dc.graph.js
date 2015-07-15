// load a graph from various formats and return the data in consistent {nodes, links} format
dc_graph.load_graph = function(file, callback) {
    if(/\.json$/.test(file))
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
