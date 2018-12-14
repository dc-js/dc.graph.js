function process_dot(callback, error, text) {
    if(error) {
        callback(error, null);
        return;
    }
    var nodes, edges;
    if(graphlibDot.parse) { // graphlib-dot 1.1.0 (where did i get it from?)
        var digraph = graphlibDot.parse(text);

        var nodeNames = digraph.nodes();
        nodes = new Array(nodeNames.length);
        nodeNames.forEach(function (name, i) {
            var node = nodes[i] = digraph._nodes[nodeNames[i]];
            node.id = i;
            node.name = name;
        });

        var edgeNames = digraph.edges();
        edges = [];
        edgeNames.forEach(function(e) {
            var edge = digraph._edges[e];
            edges.push(Object.assign({}, edge.value, {
                source: digraph._nodes[edge.u].id,
                target: digraph._nodes[edge.v].id,
                sourcename: edge.u,
                targetname: edge.v
            }));
        });
    } else { // graphlib-dot 0.6
        digraph = graphlibDot.read(text);

        nodeNames = digraph.nodes();
        nodes = new Array(nodeNames.length);
        nodeNames.forEach(function (name, i) {
            var node = nodes[i] = digraph._nodes[nodeNames[i]];
            node.id = i;
            node.name = name;
        });

        edges = [];
        digraph.edges().forEach(function(e) {
            edges.push(Object.assign({}, e.value, {
                source: digraph._nodes[e.v].id,
                target: digraph._nodes[e.w].id,
                sourcename: e.v,
                targetname: e.w
            }));
        });
    }
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

dc_graph.file_formats = [
    {
        exts: 'json',
        from_url: d3.json
    },
    {
        exts: ['gv', 'dot'],
        from_url: function(url, callback) {
            d3.text(url, process_dot.bind(null, callback));
        }
    },
    {
        exts: 'psv',
        from_url: function(url, callback) {
            d3.dsv('|', 'text/plain')(url, process_dsv.bind(null, callback));
        }
    },
    {
        exts: 'csv',
        from_url: function(url, callback) {
            d3.csv(url, process_dsv.bind(null, callback));
        }
    }
];

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
    else {
        var file1noq = ignore_query(file1);
        var format = dc_graph.file_formats.find(function(format) {
            var exts = format.exts;
            if(!Array.isArray(exts))
                exts = [exts];
            return exts.find(function(ext) {
                return new RegExp('\.' + ext + '$').test(file1noq);
            });
        });
        if(format)
            format.from_url(file1, callback);
        else {
            var spl = file1noq.split('.');
            if(spl.length)
                callback(new Error('do not know how to process graph extension ' + spl[spl.length-1]));
            else
                callback(new Error('need file extension to process graph file automatically, filename ' + file1noq));
        }
    }
};
