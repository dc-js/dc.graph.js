dc_graph.generate = function(name, N, callback) {
    var nodes, edges, i, j;
    function gen_node(i) {
        return {
            id: i,
            name: String.fromCharCode(97+i)
        };
    }
    function gen_edge(i, j, length) {
        return {
            source: j,
            target: i,
            sourcename: nodes[j].name,
            targetname: nodes[i].name,
            length: length
        };
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
        for(i = 0; i < N; ++i) {
            edges.push(gen_edge(i, (i+1)%N, rimLength));
            edges.push(gen_edge(i, (i+strutSkip)%N, strutLength));
            if(N%2)
                edges.push(gen_edge(i, (i+N-strutSkip)%N, strutLength));
        }
        break;
    default:
        throw new Error("unknown generation type "+name);
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
};
