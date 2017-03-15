var convert_nest_helper = function(data, attrs, options, parent, level, inherit) {
    level = level || 0;
    if(attrs.length) {
        var attr = attrs.shift();
        var nodes = [], edges = [];
        var children = data.map(function(v) {
            var key = v[options.nestKey];
            var childKey = options.nestKeysUnique ? key : uuid();
            var node;
            if(options.ancestorKeys) {
                inherit = inherit || {};
                if(attr)
                    inherit[attr] = key;
                node = Object.assign({}, inherit);
            } else node = {};
            node._level = level;
            node[options.nodeKey] = childKey;
            if(options.label && options.labelFun)
                node[options.label] = options.labelFun(key, attr, v);
            if(options.level)
                node[options.level] = level+1;
            nodes.push(node);
            if(parent) {
                var edge = {};
                edge[options.edgeSource] = parent;
                edge[options.edgeTarget] = childKey;
                edges.push(edge);
            }
            var recurse = convert_nest_helper(v.values, attrs.slice(0), options,
                                              childKey, level+1, Object.assign({}, inherit));
            return recurse;
        });
        return {nodes: Array.prototype.concat.apply(nodes, children.map(dc.pluck('nodes'))),
                edges: Array.prototype.concat.apply(edges, children.map(dc.pluck('edges')))};
    }
    else return {nodes: data.map(function(v) {
        v._level = level+1;
        return v;
    }), edges: data.map(function(v) {
        var edge = {};
        edge[options.edgeSource] = parent;
        edge[options.edgeTarget] = v[options.nodeKey];
        return edge;
    })};
};

dc_graph.convert_nest = function(data, attrs, options) {
    options = Object.assign({
        nodeKey: 'key',
        edgeKey: 'key',
        edgeSource: 'sourcename',
        edgeTarget: 'targetname',
        nestKey: 'key'
    }, options);
    if(Array.isArray(data))
        return convert_nest_helper(data, attrs, options);
    else {
        attrs = [''].concat(attrs);
        return convert_nest_helper([data], attrs, options);
    }
};

dc_graph.convert_adjacency_list = function(nodes, namesIn, namesOut) {
    // adjacenciesAttr, edgeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    var edges = Array.prototype.concat.apply([], nodes.map(function(n) {
        return n[namesIn.adjacencies].map(function(adj) {
            var e = {};
            if(namesOut.edgeKey)
                e[namesOut.edgeKey] = uuid();
            e[namesOut.edgeSource] = n[namesIn.nodeKey];
            e[namesOut.edgeTarget] = namesIn.targetKey ? adj[namesIn.targetKey] : adj;
            if(namesOut.adjacency)
                e[namesOut.adjacency] = adj;
            return e;
        });
    }));
    return {
        nodes: nodes,
        edges: edges
    };
};

