var convert_tree_helper = function(data, attrs, options, parent, level, inherit) {
    level = level || 0;
    if(attrs.length > (options.valuesByAttr ? 1 : 0)) {
        var attr = attrs.shift();
        var nodes = [], edges = [];
        var children = data.map(function(v) {
            var key = v[options.nestKey];
            var childKey = options.nestKeysUnique ? key : uuid();
            if(childKey) {
                var node;
                if(options.ancestorKeys) {
                    inherit = inherit || {};
                    if(attr)
                        inherit[attr] = key;
                    node = Object.assign({}, inherit);
                } else node = {};
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
            }
            var children = options.valuesByAttr ? v[attrs[0]] : v.values;
            var recurse = convert_tree_helper(children, attrs.slice(0), options,
                                              childKey, level+1, Object.assign({}, inherit));
            return recurse;
        });
        return {nodes: Array.prototype.concat.apply(nodes, children.map(dc.pluck('nodes'))),
                edges: Array.prototype.concat.apply(edges, children.map(dc.pluck('edges')))};
    }
    else return {nodes: data.map(function(v) {
        v = Object.assign({}, v);
        if(options.level)
            v[options.level] = level+1;
        return v;
    }), edges: data.map(function(v) {
        var edge = {};
        edge[options.edgeSource] = parent;
        edge[options.edgeTarget] = v[options.nodeKey];
        return edge;
    })};
};

dc_graph.convert_tree = function(data, attrs, options) {
    options = Object.assign({
        nodeKey: 'key',
        edgeKey: 'key',
        edgeSource: 'sourcename',
        edgeTarget: 'targetname',
        nestKey: 'key'
    }, options);
    if(Array.isArray(data))
        return convert_tree_helper(data, attrs, options, options.root, 0, options.inherit);
    else {
        attrs = [''].concat(attrs);
        return convert_tree_helper([data], attrs, options, options.root, 0, options.inherit);
    }
};

dc_graph.convert_nest = function(nest, attrs, nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    return dc_graph.convert_tree(nest, attrs, {
        nodeKey: nodeKeyAttr,
        edgeSource: edgeSourceAttr,
        edgeTarget: edgeTargetAttr,
        root: parent,
        inherit: inherit,
        ancestorKeys: true,
        label: 'name',
        labelFun: function(key, attr, v) { return attr + ':' + key; },
        level: '_level'
    });
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

