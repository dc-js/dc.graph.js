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
            var ofs = _behavior.wholeOnLines() ? 0 : 0.5;
            var vline_data = scale >= _behavior.threshold() ? d3.range(Math.floor(xDomain[0]), Math.ceil(xDomain[1]) + 1) : [];
            var vlines = _gridLayer.selectAll('line.grid-line.vertical')
                .data(vline_data, function(d) { return d - ofs; });
            vlines.exit().remove();
            vlines.enter().append('line')
                .attr({
                    class: 'grid-line vertical',
                    x1: function(d) { return d - ofs; },
                    x2: function(d) { return d - ofs; }
                });
            vlines.attr({
                'stroke-width': 1/scale,
                y1: yDomain[0],
                y2: yDomain[1]
            });
            var hline_data = scale >= _behavior.threshold() ? d3.range(Math.floor(yDomain[0]), Math.ceil(yDomain[1]) + 1) : [];
            var hlines = _gridLayer.selectAll('line.grid-line.horizontal')
                .data(hline_data, function(d) { return d - ofs; });
            hlines.exit().remove();
            hlines.enter().append('line')
                .attr({
                    class: 'grid-line horizontal',
                    y1: function(d) { return d - ofs; },
                    y2: function(d) { return d - ofs; }
                });
            hlines.attr({
                'stroke-width': 1/scale,
                x1: xDomain[0],
                x2: xDomain[1]
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
    _behavior.wholeOnLines = property(true);

    return _behavior;
};

