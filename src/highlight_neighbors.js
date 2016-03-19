dc_graph.highlight_neighbors = function(highlightStroke, highlightStrokeWidth) {
    var _behavior = {};

    /**
     #### .parent([object])
     Assigns this behavior to a diagram. It will highlight edges when their end-nodes
     are hovered.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var chart;
            if(p) {
                var once = true;
                chart = p;
                p.on('drawn.highlight-neighbors', function(node, edge) {
                    add_behavior(chart, node, edge);
                    if(once) {
                        clear_all_highlights(chart, edge);
                        once = false;
                    }
                    else draw_highlighted(chart, edge);
                });
            }
            else if(_behavior.parent()) {
                chart = _behavior.parent();
                chart.on('drawn.highlight-neighbors', function(node, edge) {
                    remove_behavior(chart, node, edge);
                    chart.on('drawn.highlight-neighbors', null);
                });
            }
        });

    function draw_highlighted(chart, edge) {
        edge
            .attr('stroke-width', function(e) {
                return e.dcg_highlighted ?
                    highlightStrokeWidth :
                    param(chart.edgeStrokeWidth())(e);
            })
            .attr('stroke', function(e) {
                return e.dcg_highlighted ?
                    highlightStroke :
                    param(chart.edgeStroke())(e);
            });
    }

    function clear_all_highlights(chart, edge) {
        edge.each(function(e) {
            e.dcg_highlighted = false;
        });
        draw_highlighted(chart, edge);
    }

    function add_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-neighbors', function(d) {
                edge.each(function(e) {
                    e.dcg_highlighted = e.source === d || e.target === d;
                });
                draw_highlighted(chart, edge);
            })
            .on('mouseout.highlight-neighbors', function(d) {
                clear_all_highlights(chart, edge);
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        clear_all_highlights(chart, edge);
    }

    return _behavior;
};
