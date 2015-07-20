dc_graph.node_name = function(i) {
    // a-z, A-Z, aa-Zz, then quit
    if(i<26)
        return String.fromCharCode(97+i);
    else if(i<52)
        return String.fromCharCode(65+i-26);
    else if(i<52*52)
        return dc_graph.node_name(Math.floor(i/52)) + dc_graph.node_name(i%52);
    else throw new Error("no, that's too large");
};
dc_graph.node_object = function(i, attrs) {
    attrs = attrs || {};
    return _.extend({
        id: i,
        name: dc_graph.node_name(i)
    }, attrs);
};

dc_graph.edge_object = function(nodes, i, j, attrs) {
    attrs = attrs || {};
    return _.extend({
        source: i,
        target: j,
        sourcename: nodes[i].name,
        targetname: nodes[j].name
    }, attrs);
};

dc_graph.generate = function(name, N, callback) {
    var nodes, edges, i, j;
    switch(name) {
    case 'clique':
        nodes = new Array(N);
        edges = [];
        for(i = 0; i<N; ++i) {
            nodes[i] = dc_graph.node_object(i, {circle: "A"});
            for(j=0; j<i; ++j)
                edges.push(dc_graph.edge_object(nodes, i, j), {nonLayout: true });
        }
        break;
    case 'wheel':
        nodes = new Array(N);
        for(i = 0; i < N; ++i)
            nodes[i] = dc_graph.node_object(i);
        edges = dc_graph.wheel_edges(nodes, N*15);
        break;
    default:
        throw new Error("unknown generation type "+name);
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
};

dc_graph.wheel_edges = function(nodes, R) {
    var N = nodes.length;
    var edges = [];
    var strutSkip = Math.floor(N/2),
        rimLength = 2 * R * Math.sin(Math.PI / N),
        strutLength = 2 * R * Math.sin(strutSkip * Math.PI / N);
    for(var i = 0; i < N; ++i)
        edges.push(dc_graph.edge_object(nodes, i, (i+1)%N, {length: rimLength}));
    for(i = 0; i < N/2; ++i) {
        edges.push(dc_graph.edge_object(nodes, i, (i+strutSkip)%N, {length: strutLength}));
        if(N%2 && i != Math.floor(N/2))
            edges.push(dc_graph.edge_object(nodes, i, (i+N-strutSkip)%N, {length: strutLength}));
    }
    return edges;
};
