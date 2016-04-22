function can_get_graph_from_this(data) {
    return (data.nodes || data.vertices) &&  (data.edges || data.links);
}

function munge_graph(data) {
    // we want data = {nodes, edges} and the field names for keys; find those in common json formats
    var nodes, edges, nodekeyattr = "name", sourceattr = "sourcename", targetattr = "targetname";

    if(!can_get_graph_from_this(data)) {
        var wrappers = ['database', 'response'];
        var wi = wrappers.findIndex(function(f) { return data[f] && can_get_graph_from_this(data[f]); });
        if(wi<0)
            throw new Error("couldn't find the data!");
        data = data[wrappers[wi]];
    }
    edges = data.edges || data.links;
    nodes = data.nodes || data.vertices;

    function find_attr(o, attrs) {
        return attrs.filter(function(a) { return !!o[a]; });
    }

    //var edgekeyattr = "id";
    var edge0 = edges[0];
    if(edge0[sourceattr] === undefined) {
        var sourceattrs = ['source_ecomp_uid', "node1", "source", "tail"], targetattrs = ['target_ecomp_uid', "node2", "target", "head"];
        //var edgekeyattrs = ['id', '_id', 'ecomp_uid'];
        var edgewrappers = ['edge'];
        if(edge0.node0 && edge0.node1) { // specific conflict here
            sourceattr = 'node0';
            targetattr = 'node1';
        }
        else {
            var candidates = find_attr(edge0, sourceattrs);
            if(!candidates.length) {
                wi = edgewrappers.findIndex(function(w) { return edge0[w] && find_attr(edge0[w], sourceattrs).length; });
                if(wi<0)
                    throw new Error("didn't find any source attr");
                edges = edges.map(function(e) { return e[edgewrappers[wi]]; });
                edge0 = edges[0];
                candidates = find_attr(edge0, sourceattrs);
            }
            if(candidates.length > 1)
                console.warn('found more than one possible source attr', candidates);
            sourceattr = candidates[0];

            candidates = find_attr(edge0, targetattrs);
            if(!candidates.length)
                throw new Error("didn't find any target attr");
            if(candidates.length > 1)
                console.warn('found more than one possible target attr', candidates);
            targetattr = candidates[0];

            /*
             // we're currently assembling our own edgeid
            candidates = find_attr(edge0, edgekeyattrs);
            if(!candidates.length)
                throw new Error("didn't find any edge key");
            if(candidates.length > 1)
                console.warn('found more than one edge key attr', candidates);
            edgekeyattr = candidates[0];
             */
        }
    }
    var node0 = nodes[0];
    if(node0[nodekeyattr] === undefined) {
        var nodekeyattrs = ['ecomp_uid', 'id', '_id'];
        var nodewrappers = ['vertex'];
        candidates = find_attr(node0, nodekeyattrs);
        if(!candidates.length) {
            wi = nodewrappers.findIndex(function(w) { return node0[w] && find_attr(node0[w], nodekeyattrs).length; });
            if(wi<0)
                throw new Error("couldn't find the node data");
            nodes = nodes.map(function(n) { return n[nodewrappers[wi]]; });
            node0 = nodes[0];
            candidates = find_attr(node0, nodekeyattrs);
        }
        if(candidates.length > 1)
            console.warn('found more than one possible node key attr', candidates);
        nodekeyattr = candidates[0];
    }

    return {
        nodes: nodes,
        edges: edges,
        nodekeyattr: nodekeyattr,
        sourceattr: sourceattr,
        targetattr: targetattr
    };
}
