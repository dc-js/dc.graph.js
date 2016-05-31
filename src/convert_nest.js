// make crossfilter-suitable data from d3.nest {key, values} format
dc_graph.convert_nest = function(nest, attrs, nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    inherit = inherit || {};
    if(attrs.length) {
        var attr = attrs.shift();
        var nodes = [], edges = [];
        var children = nest.map(function(v) {
            inherit[attr] = v.key;
            var child = attr + ':' + v.key;
            var node = clone(inherit);
            node[nodeKeyAttr] = child;
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
    else return {nodes: nest, edges: nest.map(function(v) {
        var edge = {};
        edge[edgeSourceAttr] = parent;
        edge[edgeTargetAttr] = v[nodeKeyAttr];
        return edge;
    })};
};
