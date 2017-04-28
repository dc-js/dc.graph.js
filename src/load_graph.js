function process_dot(callback, error, text) {
    if(error) {
        callback(error, null);
        return;
    }
    var digraph = graphlibDot.parse(text);

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
}

function process_dsv(callback, error, data) {
    if(error) {
        callback(error, null);
        return;
    }
    var keys = Object.keys(data[0]);
    var source = keys[0], target = keys[1];
    var nodes = d3.set(data.map(function(r) { return r[source]; }));
    data.forEach(function(r) {
        nodes.add(r[target]);
    });
    nodes = nodes.values().map(function(k) { return {name: k}; });
    callback(null, {
        nodes: nodes,
        links: data.map(function(r, i) {
            return {
                key: i,
                sourcename: r[source],
                targetname: r[target]
            };
        })
    });
}

// load a graph from various formats and return the data in consistent {nodes, links} format
dc_graph.load_graph = function() {
    // ignore any query parameters for checking extension
    function ignore_query(file) {
        if(!file)
            return null;
        return file.replace(/\?.*/, '');
    }
    var file1, file2, callback;
    file1 = arguments[0];
    if(arguments.length===3) {
        file2 = arguments[1];
        callback = arguments[2];
    }
    else if(arguments.length===2) {
        callback = arguments[1];
    }
    else throw new Error('need two or three arguments');

    if(file2) {
        // this is not general - really titan-specific
        queue()
            .defer(d3.json, file1)
            .defer(d3.json, file2)
            .await(function(error, nodes, edges) {
                if(error)
                    callback(error, null);
                else
                    callback(null, {nodes: nodes.results, edges: edges.results});
            });
    }
    else if(/\.json$/.test(ignore_query(file1)))
        d3.json(file1, callback);
    else if(/\.gv|\.dot$/.test(ignore_query(file1)))
        d3.text(file1, process_dot.bind(null, callback));
    else if(/\.psv$/.test(ignore_query(file1)))
        d3.dsv('|', 'text/plain')(file1, process_dsv.bind(null, callback));
    else if(/\.csv$/.test(ignore_query(file1)))
        d3.csv(file1, process_dsv.bind(null, callback));
};
