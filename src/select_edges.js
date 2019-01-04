dc_graph.select_edges = function(props, options) {
    options = options || {};
    var select_edges_group = dc_graph.select_things_group(options.select_edges_group || 'select-edges-group', 'select-edges');
    var thinginess = {
        intersectRect: function(ext) {
            return this.clickables().data().filter(function(e) {
                // this nonsense because another select_things may have invalidated the edge positions (!!)
                var sp = {
                    x: e.source.cola.x + e.sourcePort.pos.x,
                    y: e.source.cola.y + e.sourcePort.pos.y
                },
                    tp = {
                        x: e.target.cola.x + e.targetPort.pos.x,
                        y: e.target.cola.y + e.targetPort.pos.y
                    };
                return [sp, tp].some(function(p) {
                    return ext[0][0] < p.x && p.x < ext[1][0] &&
                        ext[0][1] < p.y && p.y < ext[1][1];
                });
            }).map(this.key);
        },
        clickables: function() {
            return _mode.parent().selectAllEdges('.edge-hover');
        },
        key: function(e) {
            return _mode.parent().edgeKey.eval(e);
        },
        applyStyles: function(pred) {
            _mode.parent().cascade(50, true, node_edge_conditions(null, pred, props));
        },
        removeStyles: function() {
            _mode.parent().cascade(50, false, props);
        }
    };
    var _mode = dc_graph.select_things(select_edges_group, 'select-edges', thinginess);
    return _mode;
};
