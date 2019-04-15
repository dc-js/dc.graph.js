function process_dot(callback, error, text) {
    if(error) {
        callback(error, null);
        return;
    }
    var nodes, edges, node_cluster = {}, clusters = [];
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
        // TODO: if this version exists in the wild, look at how it does subgraphs/clusters
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
            edges.push(Object.assign({}, digraph.edge(e.v, e.w), {
                source: digraph._nodes[e.v].id,
                target: digraph._nodes[e.w].id,
                sourcename: e.v,
                targetname: e.w
            }));
        });

        // iterative bfs for variety (recursion would work just as well)
        var cluster_names = {};
        var queue = digraph.children().map(function(c) { return Object.assign({parent: null, key: c}, digraph.node(c)); });
        while(queue.length) {
            var item = queue.shift(),
                children = digraph.children(item.key);
            if(children.length) {
                clusters.push(item);
                cluster_names[item.key] = true;
            }
            else
                node_cluster[item.key] = item.parent;
            queue = queue.concat(children.map(function(c) { return {parent: item.key, key: c}; }));
        }
        // clusters as nodes not currently supported
        nodes = nodes.filter(function(n) {
            return !cluster_names[n.name];
        });
    }
    var graph = {nodes: nodes, links: edges, node_cluster: node_cluster, clusters: clusters};
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
        mimes: 'application/json',
        from_url: d3.json,
        from_text: function(text, callback) {
            callback(null, JSON.parse(text));
        }
    },
    {
        exts: ['gv', 'dot'],
        mimes: 'text/vnd.graphviz',
        from_url: function(url, callback) {
            d3.text(url, process_dot.bind(null, callback));
        },
        from_text: function(text, callback) {
            process_dot(callback, null, text);
        }
    },
    {
        exts: 'psv',
        mimes: 'text/psv',
        from_url: function(url, callback) {
            d3.dsv('|', 'text/plain')(url, process_dsv.bind(null, callback));
        },
        from_text: function(text, callback) {
            process_dsv(callback, null, d3.dsv('|').parse(text));
        }
    },
    {
        exts: 'csv',
        mimes: 'text/csv',
        from_url: function(url, callback) {
            d3.csv(url, process_dsv.bind(null, callback));
        },
        from_text: function(text, callback) {
            process_dsv(callback, null, d3.csv.parse(text));
        }
    }
];

dc_graph.match_file_format = function(filename) {
    return dc_graph.file_formats.find(function(format) {
        var exts = format.exts;
        if(!Array.isArray(exts))
            exts = [exts];
        return exts.find(function(ext) {
                return new RegExp('\.' + ext + '$').test(filename);
        });
    });
};

dc_graph.match_mime_type = function(mime) {
    return dc_graph.file_formats.find(function(format) {
        var mimes = format.mimes;
        if(!Array.isArray(mimes))
            mimes = [mimes];
        return mimes.includes(mime);
    });
};

function unknown_format_error(filename) {
    var spl = filename.split('.');
    if(spl.length)
        return new Error('do not know how to process graph file extension ' + spl[spl.length-1]);
    else
        return new Error('need file extension to process graph file automatically, filename ' + filename);
}

function unknown_mime_error(mime) {
    return new Error('do not know how to process mime type ' + mime);
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
    else {
        var format;
        if(/^data:/.test(file1)) {
            var parts = file1.slice(5).split(/,(.+)/);
            format = dc_graph.match_mime_type(parts[0]);
            if(format)
                format.from_text(parts[1], callback);
            else callback(unknown_mime_error(parts[0]));
        } else {
            var file1noq = ignore_query(file1);
            format = dc_graph.match_file_format(file1noq);
            if(format)
                format.from_url(file1, callback);
            else callback(unknown_format_error(file1noq));
        }
    }
};

dc_graph.load_graph_text = function(text, filename, callback) {
    var format = dc_graph.match_file_format(filename);
    if(format)
        format.from_text(text, callback);
    else callback(unknown_format_error(filename));
};

dc_graph.data_url = function(data) {
    return 'data:application/json,' + JSON.stringify(data);
};
