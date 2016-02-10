dc_graph.build_type_graph = function(nodes, edges, nkey, ntype, esource, etarget) {
    var nmap = {}, tnodes = {}, tedges = {};
    nodes.forEach(function(n) {
        nmap[nkey(n)] = n;
        var t = ntype(n);
        if(!tnodes[t])
            tnodes[t] = {type: t};
    });
    edges.forEach(function(e) {
        var source = esource(e), target = etarget(e), sn, tn;
        if(!(sn = nmap[source]))
            throw new Error('source key ' + source + ' not found!');
        if(!(tn = nmap[target]))
            throw new Error('target key ' + target + ' not found!');
        var etype = ntype(sn) + '/' + ntype(tn);
        if(!tedges[etype])
            tedges[etype] = {
                type: etype,
                source: ntype(sn),
                target: ntype(tn)
            };
    });
    return {
        nodes: Object.keys(tnodes).map(function(k) { return tnodes[k]; }),
        edges: Object.keys(tedges).map(function(k) { return tedges[k]; })
    };
}
