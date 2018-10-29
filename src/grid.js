dc_graph.grid = function() {
    var _gridLayer = null;

    function add_behavior(diagram, node, edge, ehover) {
        _gridLayer = _behavior.parent().g().selectAll('g.grid-layer').data([0]);
        _gridLayer.enter().append('g').attr('class', 'grid-layer');
    }

    function remove_behavior(diagram, node, edge, ehover) {
        if(_gridLayer)
            _gridLayer.remove();
    }

    function on_zoom(translate, scale, xDomain, yDomain) {
        if(_gridLayer) {
            var vline_data = scale >= _behavior.threshold() ? d3.range(Math.floor(xDomain[0]), Math.ceil(xDomain[1]) + 1) : [];
            var vlines = _gridLayer.selectAll('line.grid-line.vertical').data(vline_data);
            vlines.exit().remove();
            vlines.enter().append('line')
                .attr('class', 'grid-line vertical');
            vlines.attr({
                x1: function(d) { return d - 0.5; },
                y1: yDomain[0],
                x2: function(d) { return d - 0.5; },
                y2: yDomain[1]
            });
            var hline_data = scale >= _behavior.threshold() ? d3.range(Math.floor(yDomain[0]), Math.ceil(yDomain[1]) + 1) : [];
            var hlines = _gridLayer.selectAll('line.grid-line.horizontal').data(hline_data);
            hlines.exit().remove();
            hlines.enter().append('line')
                .attr('class', 'grid-line horizontal');
            hlines.attr({
                x1: xDomain[0],
                y1: function(d) { return d - 0.5; },
                x2: xDomain[1],
                y2: function(d) { return d - 0.5; }
            });
        }
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            if(p)
                p.on('zoomed.grid', on_zoom);
        }
    });

    _behavior.threshold = property(4);

    return _behavior;
};

