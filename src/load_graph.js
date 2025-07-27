import { set } from 'd3-collection';
import { json, text, dsv, csv } from 'd3-fetch';

function processDot(text) {
    return new Promise((resolve, reject) => {
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
    resolve(graph);
    });
}

function processDsv(data) {
    return new Promise((resolve, reject) => {
    var keys = Object.keys(data[0]);
    var source = keys[0], target = keys[1];
    var nodes = set(data.map(function(r) { return r[source]; }));
    data.forEach(function(r) {
        nodes.add(r[target]);
    });
    nodes = nodes.values().map(function(k) { return {name: k}; });
    resolve({
        nodes: nodes,
        links: data.map(function(r, i) {
            return {
                key: i,
                sourcename: r[source],
                targetname: r[target]
            };
        })
    });
    });
}

export const fileFormats = [
    {
        exts: 'json',
        mimes: 'application/json',
        from_url: url => json(url),
        from_text: text => Promise.resolve(JSON.parse(text))
    },
    {
        exts: ['gv', 'dot'],
        mimes: 'text/vnd.graphviz',
        from_url: url => text(url).then(textData => processDot(textData)),
        from_text: text => processDot(text)
    },
    {
        exts: 'psv',
        mimes: 'text/psv',
        from_url: url => dsv('|', 'text/plain')(url).then(data => processDsv(data)),
        from_text: text => processDsv(dsv('|').parse(text))
    },
    {
        exts: 'csv',
        mimes: 'text/csv',
        from_url: url => csv(url).then(data => processDsv(data)),
        from_text: text => processDsv(csv.parse(text))
    }
];

export function matchFileFormat(filename) {
    return fileFormats.find(function(format) {
        var exts = format.exts;
        if(!Array.isArray(exts))
            exts = [exts];
        return exts.find(function(ext) {
                return new RegExp('\.' + ext + '$').test(filename);
        });
    });
};

export function matchMimeType(mime) {
    return fileFormats.find(function(format) {
        var mimes = format.mimes;
        if(!Array.isArray(mimes))
            mimes = [mimes];
        return mimes.includes(mime);
    });
};

function unknownFormatError(filename) {
    var spl = filename.split('.');
    if(spl.length)
        return new Error('do not know how to process graph file extension ' + spl[spl.length-1]);
    else
        return new Error('need file extension to process graph file automatically, filename ' + filename);
}

function unknownMimeError(mime) {
    return new Error('do not know how to process mime type ' + mime);
}

// load a graph from various formats and return the data in consistent {nodes, links} format
export function loadGraph(file1, file2) {
    // ignore any query parameters for checking extension
    const ignore_query = file => file ? file.replace(/\?.*/, '') : null;
    
    if(file2) {
        // this is not general - really titan-specific
        return Promise.all([json(file1), json(file2)])
            .then(([nodes, edges]) => ({nodes: nodes.results, edges: edges.results}));
    }
    else {
        if(/^data:/.test(file1)) {
            const parts = file1.slice(5).split(/,(.+)/);
            const format = matchMimeType(parts[0]);
            if(format)
                return format.from_text(parts[1]);
            else 
                return Promise.reject(unknownMimeError(parts[0]));
        } else {
            const file1noq = ignore_query(file1);
            const format = matchFileFormat(file1noq);
            if(format)
                return format.from_url(file1);
            else 
                return Promise.reject(unknownFormatError(file1noq));
        }
    }
};

export function loadGraphText(text, filename) {
    const format = matchFileFormat(filename);
    if(format)
        return format.from_text(text);
    else 
        return Promise.reject(unknownFormatError(filename));
};

export function dataUrl(data) {
    return 'data:application/json,' + JSON.stringify(data);
};
