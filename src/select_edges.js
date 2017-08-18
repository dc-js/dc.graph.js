dc_graph.select_edges = function(props) {
    var select_edges_group = dc_graph.select_things_group('select-edges-group', 'select-edges');
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
            return _behavior.parent().selectAllEdges('.edge-hover');
        },
        key: function(d) {
            return _behavior.parent().edgeKey.eval(d);
        },
        applyStyles: function(condition) {
            _behavior.parent().cascade(50, true, conditional_properties(null, condition, props));
        },
        removeStyles: function() {
            _behavior.parent().cascade(50, false, props);
        }
    };
    var _behavior = dc_graph.select_things(select_edges_group, 'select-edges', thinginess);
    return _behavior;
};

dc_graph.select_edges_group = function(brushgroup) {
    window.chart_registry.create_type('select-edges', function() {
        return d3.dispatch('set_changed');
    });

    return window.chart_registry.create_group('select-edges', brushgroup);
};
