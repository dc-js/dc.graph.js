dc_graph.annotate_layers = function() {
    var _drawLayer;
    var _mode = dc_graph.mode('annotate-layers', {
        laterDraw: true,
        renderers: ['svg', 'webgl'],
        draw: draw,
        remove: remove
    });
    function draw() {
        var rendererType = _mode.parent().renderer().rendererType();
        if(rendererType === 'svg') {
            var engine = _mode.parent().layoutEngine();
            if(engine.layoutAlgorithm() === 'cola' &&
               engine.setcolaSpec()) {
                _drawLayer = _mode.parent().select('g.draw').selectAll('g.divider-layer').data([0]);
                _drawLayer.enter().append('g').attr('class', 'divider-layer');
                var boundary_nodes = engine.setcolaNodes().filter(function(n) {
                    return /^sort_order_boundary/.test(n.name);
                });
                var lines = _drawLayer.selectAll('line.divider').data(boundary_nodes);
                lines.exit().remove();
                lines.enter().append('line')
                    .attr('class', 'divider');
                lines.attr({
                    stroke: _mode.stroke(),
                    'stroke-width': _mode.strokeWidth(),
                    'stroke-dasharray': _mode.strokeDashArray(),
                    x1: -5000,
                    y1: function(n) {
                        return n.y;
                    },
                    x2: 5000,
                    y2:  function(n) {
                        return n.y;
                    }
                });
            }
        }
    }
    function remove() {
        if(_drawLayer)
            _drawLayer.remove();
    }

    _mode.stroke = property('black');
    _mode.strokeWidth = property(2);
    _mode.strokeDashArray = property([5,5]);
    return _mode;
};
