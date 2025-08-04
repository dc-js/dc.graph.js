export function buildTypeGraph(nodes, edges, nkey, ntype, esource, etarget) {
    const nmap = {}, tnodes = {}, tedges = {};
    nodes.forEach((n) => {
        nmap[nkey(n)] = n;
        const t = ntype(n);
        if(!tnodes[t])
            tnodes[t] = {type: t};
    });
    edges.forEach((e) => {
        const source = esource(e), target = etarget(e);
        let sn, tn;
        if(!(sn = nmap[source]))
            throw new Error(`source key ${  source  } not found!`);
        if(!(tn = nmap[target]))
            throw new Error(`target key ${  target  } not found!`);
        const etype = `${ntype(sn)  }/${  ntype(tn)}`;
        if(!tedges[etype])
            tedges[etype] = {
                type: etype,
                source: ntype(sn),
                target: ntype(tn)
            };
    });
    return {
        nodes: Object.keys(tnodes).map((k) => tnodes[k]),
        edges: Object.keys(tedges).map((k) => tedges[k])
    };
}
