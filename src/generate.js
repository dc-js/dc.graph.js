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

dc_graph.edge_object = function(namef, i, j, attrs) {
    attrs = attrs || {};
    return _.extend({
        source: i,
        target: j,
        sourcename: namef(i),
        targetname: namef(j)
    }, attrs);
};

dc_graph.generate = function(type, args, env, callback) {
    var nodes, edges, i, j;
    var nodePrefix = env.nodePrefix || '';
    var namef = function(i) {
        return nodes[i].name;
    };
    var N = args[0];
    var linkLength = env.linkLength || 30;
    switch(type) {
    case 'clique':
    case 'cliquestf':
        nodes = new Array(N);
        edges = [];
        for(i = 0; i<N; ++i) {
            nodes[i] = dc_graph.node_object(i, {circle: "A", name: nodePrefix+dc_graph.node_name(i)});
            for(j=0; j<i; ++j)
                edges.push(dc_graph.edge_object(namef, i, j, {notLayout: true, undirected: true}));
        }
        if(type==='cliquestf')
            for(i = 0; i<N; ++i) {
                nodes[i+N] = dc_graph.node_object(i+N);
                nodes[i+2*N] = dc_graph.node_object(i+2*N);
                edges.push(dc_graph.edge_object(namef, i, i+N, {undirected: true}));
                edges.push(dc_graph.edge_object(namef, i, i+2*N, {undirected: true}));
            }
        break;
    case 'wheel':
        nodes = new Array(N);
        for(i = 0; i < N; ++i)
            nodes[i] = dc_graph.node_object(i, {name: nodePrefix+dc_graph.node_name(i)});
        edges = dc_graph.wheel_edges(namef, _.range(N), N*linkLength/2);
        var rimLength = edges[0].distance;
        for(i = 0; i < args[1]; ++i)
            for(j = 0; j < N; ++j) {
                var a = j, b = (j+1)%N, t;
                if(i%2 === 1) {
                    t = a;
                    a = b;
                    b = t;
                }
                edges.push(dc_graph.edge_object(namef, a, b, {distance: rimLength, par: i+2}));
            }
        break;
    default:
        throw new Error("unknown generation type "+type);
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
};

dc_graph.wheel_edges = function(namef, nindices, R) {
    var N = nindices.length;
    var edges = [];
    var strutSkip = Math.floor(N/2),
        rimLength = 2 * R * Math.sin(Math.PI / N),
        strutLength = 2 * R * Math.sin(strutSkip * Math.PI / N);
    for(var i = 0; i < N; ++i)
        edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+1)%N], {distance: rimLength}));
    for(i = 0; i < N/2; ++i) {
        edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+strutSkip)%N], {distance: strutLength}));
        if(N%2 && i != Math.floor(N/2))
            edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+N-strutSkip)%N], {distance: strutLength}));
    }
    return edges;
};

dc_graph.random_graph = function(options) {
    options = Object.assign({
        ncolors: 5,
        ndashes: 4,
        nodeKey: 'key',
        edgeKey: 'key',
        sourceKey: 'sourcename',
        targetKey: 'targetname',
        colorTag: 'color',
        dashTag: 'dash',
        nodeKeyGen: function(i) { return 'n' + i; },
        edgeKeyGen: function(i) { return 'e' + i; },
        newComponentProb: 0.1,
        newNodeProb: 0.9,
        removeEdgeProb: 0.75,
        log: false
    }, options);
    if(isNaN(options.newNodeProb))
        options.newNodeProb = 0.9;
    if(options.newNodProb <= 0)
        options.newNodeProb = 0.1;
    var _nodes = [], _edges = [];
    function new_node() {
        var n = {};
        n[options.nodeKey] = options.nodeKeyGen(_nodes.length);
        n[options.colorTag] = Math.floor(Math.random()*options.ncolors);
        _nodes.push(n);
        return n;
    }
    function random_node() {
        return _nodes[Math.floor(Math.random()*_nodes.length)];
    }
    return {
        nodes: function() {
            return _nodes;
        },
        edges: function() {
            return _edges;
        },
        generate: function(N) {
            while(N-- > 0) {
                var choice = Math.random();
                var n1, n2;
                if(!_nodes.length || choice < options.newComponentProb)
                    n1 = new_node();
                else
                    n1 = random_node();
                if(choice < options.newNodeProb)
                    n2 = new_node();
                else
                    n2 = random_node();
                if(n1 && n2) {
                    var edge = {};
                    edge[options.edgeKey] = options.edgeKeyGen(_edges.length);
                    edge[options.sourceKey] = n1[options.nodeKey];
                    edge[options.targetKey] = n2[options.nodeKey];
                    edge[options.dashTag] = Math.floor(Math.random()*options.ndashes);
                    if(options.log)
                        console.log(n1[options.nodeKey] + ' -> ' + n2[options.nodeKey]);
                    _edges.push(edge);
                }
            }
        },
        remove: function(N) {
            while(N-- > 0) {
                var choice = Math.random();
                if(choice < options.removeEdgeProb)
                    _edges.splice(Math.floor(Math.random()*_edges.length), 1);
                else {
                    var n = _nodes[Math.floor(Math.random()*_nodes.length)];
                    var eis = [];
                    _edges.forEach(function(e, ei) {
                        if(e[options.sourceKey] === n[options.nodeKey] ||
                           e[options.targetKey] === n[options.nodeKey])
                            eis.push(ei);
                    });
                    eis.reverse().forEach(function(ei) {
                        _edges.splice(ei, 1);
                    });
                }
            }
        }
    };
};
