dc_graph.generate = function(name, N, callback) {
    var nodes, edges, i, j;
    function nodename(i) {
        // a-z, A-Z, aa-Zz, then quit
        if(i<26)
            return String.fromCharCode(97+i);
        else if(i<52)
            return String.fromCharCode(65+i-26);
        else if(i<52*52)
            return nodename(Math.floor(i/52)) + nodename(i%52);
        else throw new Error("no, that's too large");
    }
    function gen_node(i, attrs) {
        attrs = attrs || {};
        return _.extend({
            id: i,
            name: nodename(i)
        }, attrs);
    }
    function gen_edge(i, j, attrs) {
        attrs = attrs || {};
        return _.extend({
            source: i,
            target: j,
            sourcename: nodes[i].name,
            targetname: nodes[j].name,
            length: length
        }, attrs);
    }
    switch(name) {
    case 'clique':
        nodes = new Array(N);
        edges = [];
        for(i = 0; i<N; ++i) {
            nodes[i] = gen_node(i);
            for(j=0; j<i; ++j)
                edges.push(gen_edge(i, j));
        }
        break;
    case 'wheel':
        var r = N*15,
            strutSkip = Math.floor(N/2),
            rimLength = 2 * r * Math.sin(Math.PI / N),
            strutLength = 2 * r * Math.sin(strutSkip * Math.PI / N);
        nodes = new Array(N);
        edges = [];
        for(i = 0; i < N; ++i)
            nodes[i] = gen_node(i);
        for(i = 0; i < N; ++i)
            edges.push(gen_edge(i, (i+1)%N, {length: rimLength}));
        for(i = 0; i < N/2; ++i) {
            edges.push(gen_edge(i, (i+strutSkip)%N, {length: strutLength}));
            if(N%2 && i != Math.floor(N/2))
                edges.push(gen_edge(i, (i+N-strutSkip)%N, {length: strutLength}));
        }
        break;
    default:
        throw new Error("unknown generation type "+name);
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
};
