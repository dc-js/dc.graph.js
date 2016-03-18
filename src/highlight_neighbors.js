dc_graph.highlight_neighbors = function(highlightStroke, highlightStrokeWidth) {
    var _behavior = {};

    /**
     #### .parent([object])
     Assigns this behavior to a diagram. It will highlight edges when their end-nodes
     are hovered.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            if(p)
                p.on('drawn.highlight-neighbors', function(node, edge) {
                    add_behavior(_behavior.parent(), node, edge);
                });
            else if(_behavior.parent()) {
                var old_parent = _behavior.parent();
                old_parent.on('drawn.highlight-neighbors', function(node, edge) {
                    remove_behavior(old_parent, node, edge);
                    old_parent.on('drawn.highlight-neighbors', null);
                });
            }
        });

    function add_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-neighbors', function(d) {
                edge
                    .attr('stroke-width', function(e) {
                        return (e.source === d || e.target === d ?
                                param(chart.edgeHighlightStrokeWidth()) :
                                param(chart.edgeStrokeWidth()))(e);
                    })
                    .attr('stroke', function(e) {
                        return (e.source === d || e.target === d ?
                                param(chart.edgeHighlightStroke()) :
                                param(chart.edgeStroke()))(e);
                    });
            })
            .on('mouseout.highlight-neighbors', function(d) {
                edge
                    .attr('stroke-width', param(chart.edgeStrokeWidth()))
                    .attr('stroke', param(chart.edgeStroke()));
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        edge
            .attr('stroke-width', param(chart.edgeStrokeWidth()))
            .attr('stroke', param(chart.edgeStroke()));
    }

    return _behavior;
};
