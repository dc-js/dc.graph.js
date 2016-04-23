dc_graph.highlight_neighbors = function(props) {
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_highlighted = false;
        });
    }

    function ternary_props(pred, props) {
        function _if(pred, curr) {
            return function(o, last) {
                return pred(o) ? curr(o) : last();
            };
        }
        var props2 = {};
        for(var p in props)
            props2[p] = _if(pred, param(props[p]));
        return props2;
    }

    function add_behavior(chart, node, edge) {
        chart.cascade(100, ternary_props(function(e) {
            return e.dcg_highlighted;
        }, props));
        node
            .on('mouseover.highlight-neighbors', function(d) {
                edge.each(function(e) {
                    e.dcg_highlighted = e.source === d || e.target === d;
                });
                chart.refresh(node, edge);
            })
            .on('mouseout.highlight-neighbors', function(d) {
                clear_all_highlights(edge);
                chart.refresh(node, edge);
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        clear_all_highlights(edge);
        chart.edgeStrokeWidth.cascade(100, null);
        chart.edgeStroke.cascade(100, null);
    }

    return dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
        }
    });
};

