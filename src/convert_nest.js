// make crossfilter-suitable data from d3.nest {key, values} format
dc_graph.convert_nest = function(nest, attrs, nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    inherit = inherit || {};
    var level = Object.keys(inherit).length;
    if(attrs.length) {
        var attr = attrs.shift();
        var nodes = [], edges = [];
        var children = nest.map(function(v) {
            inherit[attr] = v.key;
            var child = uuid();
            var node = clone(inherit);
            node[nodeKeyAttr] = child;
            node.name = attr + ':' + v.key;
            node._level = level+1;
            nodes.push(node);
            if(parent) {
                var edge = {};
                edge[edgeSourceAttr] = parent;
                edge[edgeTargetAttr] = child;
                edges.push(edge);
            }
            var recurse = dc_graph.convert_nest(v.values, attrs.slice(0), nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, child, clone(inherit));
            return recurse;
        });
        return {nodes: Array.prototype.concat.apply(nodes, children.map(dc.pluck('nodes'))),
                edges: Array.prototype.concat.apply(edges, children.map(dc.pluck('edges')))};
    }
    else return {nodes: nest.map(function(v) {
        v._level = level+1;
        return v;
    }), edges: nest.map(function(v) {
        var edge = {};
        edge[edgeSourceAttr] = parent;
        edge[edgeTargetAttr] = v[nodeKeyAttr];
        return edge;
    })};
};

dc_graph.convert_adjacency_list = function(nodes, namesIn, namesOut) {
    // adjacenciesAttr, edgeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    var edges = Array.prototype.concat.apply([], nodes.map(function(n) {
        return n[namesIn.adjacencies].map(function(adj) {
            var e = {};
            if(namesOut.edgeKey)
                e[namesOut.edgeKey] = uuid();
            e[namesOut.edgeSource] = n[namesIn.nodeKey];
            e[namesOut.edgeTarget] = adj[namesIn.targetKey];
            e[namesOut.adjacency] = adj;
            return e;
        });
    }));
    return {
        nodes: nodes,
        edges: edges
    };
};

