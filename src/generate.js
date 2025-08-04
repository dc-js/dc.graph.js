export function nodeName(i) {
    // a-z, A-Z, aa-Zz, then quit
    if (i < 26)
        return String.fromCharCode(97+i);
    else if (i < 52)
        return String.fromCharCode(65+i-26);
    else if (i < 52*52)
        return nodeName(Math.floor(i/52))+nodeName(i%52);
    else throw new Error("no, that's too large");
}
export function nodeObject(i, attrs) {
    attrs = attrs || {};
    return _.extend({
        id: i,
        name: nodeName(i),
    }, attrs);
}

export function edgeObject(namef, i, j, attrs) {
    attrs = attrs || {};
    return _.extend({
        source: i,
        target: j,
        sourcename: namef(i),
        targetname: namef(j),
    }, attrs);
}

export function generate(type, args, env, callback) {
    let nodes, edges, i, j;
    const nodePrefix = env.nodePrefix || '';
    const namef = function(i) {
        return nodes[i].name;
    };
    const N = args[0];
    const linkLength = env.linkLength || 30;
    switch (type) {
        case 'clique':
        case 'cliquestf':
            nodes = new Array(N);
            edges = [];
            for (i = 0; i < N; ++i) {
                nodes[i] = nodeObject(i, {circle: 'A', name: nodePrefix+nodeName(i)});
                for (j = 0; j < i; ++j)
                    edges.push(edgeObject(namef, i, j, {notLayout: true, undirected: true}));
            }
            if (type === 'cliquestf') {
                for (i = 0; i < N; ++i) {
                    nodes[i+N] = nodeObject(i+N);
                    nodes[i+2*N] = nodeObject(i+2*N);
                    edges.push(edgeObject(namef, i, i+N, {undirected: true}));
                    edges.push(edgeObject(namef, i, i+2*N, {undirected: true}));
                }
            }
            break;
        case 'wheel': {
            nodes = new Array(N);
            for (i = 0; i < N; ++i)
                nodes[i] = nodeObject(i, {name: nodePrefix+nodeName(i)});
            edges = wheelEdges(namef, _.range(N), N*linkLength/2);
            const rimLength = edges[0].distance;
            for (i = 0; i < args[1]; ++i)
                for (j = 0; j < N; ++j) {
                    let a = j, b = (j+1)%N, t;
                    if (i%2 === 1) {
                        t = a;
                        a = b;
                        b = t;
                    }
                    edges.push(edgeObject(namef, a, b, {distance: rimLength, par: i+2}));
                }
            break;
        }
        default:
            throw new Error(`unknown generation type ${type}`);
    }
    const graph = {nodes, links: edges};
    callback(null, graph);
}

export function wheelEdges(namef, nindices, R) {
    const N = nindices.length;
    const edges = [];
    const strutSkip = Math.floor(N/2),
        rimLength = 2*R*Math.sin(Math.PI/N),
        strutLength = 2*R*Math.sin(strutSkip*Math.PI/N);
    let i;
    for (i = 0; i < N; ++i)
        edges.push(edgeObject(namef, nindices[i], nindices[(i+1)%N], {distance: rimLength}));
    for (i = 0; i < N/2; ++i) {
        edges.push(
            edgeObject(namef, nindices[i], nindices[(i+strutSkip)%N], {distance: strutLength}),
        );
        if (N%2 && i != Math.floor(N/2))
            edges.push(
                edgeObject(namef, nindices[i], nindices[(i+N-strutSkip)%N], {
                    distance: strutLength,
                }),
            );
    }
    return edges;
}

export function randomGraph(options) {
    options = Object.assign({
        ncolors: 5,
        ndashes: 4,
        nodeKey: 'key',
        edgeKey: 'key',
        sourceKey: 'sourcename',
        targetKey: 'targetname',
        colorTag: 'color',
        dashTag: 'dash',
        nodeKeyGen(i) {
            return `n${i}`;
        },
        edgeKeyGen(i) {
            return `e${i}`;
        },
        newComponentProb: 0.1,
        newNodeProb: 0.9,
        removeEdgeProb: 0.75,
        allowParallelEdges: true,
        log: false,
    }, options);
    if (isNaN(options.newNodeProb))
        options.newNodeProb = 0.9;
    if (options.newNodProb <= 0)
        options.newNodeProb = 0.1;
    const _nodes = [], _edges = [];
    function new_node() {
        const n = {};
        n[options.nodeKey] = options.nodeKeyGen(_nodes.length);
        n[options.colorTag] = Math.floor(Math.random()*options.ncolors);
        _nodes.push(n);
        return n;
    }
    function random_node() {
        return _nodes[Math.floor(Math.random()*_nodes.length)];
    }
    return {
        nodes() {
            return _nodes;
        },
        edges() {
            return _edges;
        },
        generate(N) {
            const edgeInserted = {};
            while (N > 0) {
                const choice = Math.random();
                let n1, n2;
                if (!_nodes.length || choice < options.newComponentProb) {
                    n1 = new_node();
                    N--;
                } else
                    n1 = random_node();
                if (choice < options.newNodeProb) {
                    n2 = new_node();
                    N--;
                } else
                    n2 = random_node();
                if (n1 && n2) {
                    const edge = {};
                    edge[options.edgeKey] = options.edgeKeyGen(_edges.length);
                    const sourceKey = n1[options.nodeKey], targetKey = n2[options.nodeKey];
                    if (!options.allowParallelEdges) {
                        if (edgeInserted[sourceKey] && edgeInserted[sourceKey][targetKey])
                            continue;
                        edgeInserted[sourceKey] = edgeInserted[sourceKey] || {};
                        edgeInserted[sourceKey][targetKey] = true;
                    }
                    edge[options.sourceKey] = sourceKey;
                    edge[options.targetKey] = targetKey;
                    edge[options.dashTag] = Math.floor(Math.random()*options.ndashes);
                    if (options.log)
                        console.log(`${n1[options.nodeKey]} -> ${n2[options.nodeKey]}`);
                    _edges.push(edge);
                }
            }
        },
        remove(N) {
            while (N-- > 0) {
                const choice = Math.random();
                if (choice < options.removeEdgeProb)
                    _edges.splice(Math.floor(Math.random()*_edges.length), 1);
                else {
                    const n = _nodes[Math.floor(Math.random()*_nodes.length)];
                    const eis = [];
                    _edges.forEach((e, ei) => {
                        if (
                            e[options.sourceKey] === n[options.nodeKey]
                            || e[options.targetKey] === n[options.nodeKey]
                        )
                            eis.push(ei);
                    });
                    eis.reverse().forEach(ei => {
                        _edges.splice(ei, 1);
                    });
                }
            }
        },
    };
}
