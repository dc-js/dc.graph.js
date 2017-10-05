dc_graph.troubleshoot = function() {
    var _debugLayer = null;

    function add_behavior(chart, node, edge, ehover) {
        if(!_debugLayer)
            _debugLayer = chart.g().append('g').attr('class', 'draw-graphs');
        var centers = node.data().map(function(n) {
            return {
                x: n.cola.x,
                y: n.cola.y
            };
        });
        var crosshairs = _debugLayer.selectAll('path.nodecenter').data(centers);
        crosshairs.exit().remove();
        crosshairs.enter().append('path').attr('class', 'nodecenter');
        crosshairs.attr({
            d: function(d) {
                return 'M' + (d.x - _behavior.xhairWidth()/2) + ',' + d.y + ' h' + _behavior.xhairWidth() +
                    ' M' + d.x + ',' + (d.y - _behavior.xhairHeight()/2) + ' v' + _behavior.xhairHeight();
            },
            opacity: _behavior.xhairOpacity() !== null ? _behavior.xhairOpacity() : _behavior.opacity(),
            stroke: _behavior.xhairColor()
        });
    }

    function remove_behavior(chart, node, edge, ehover) {
        if(_debugLayer)
            _debugLayer.remove();
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        laterDraw: true,
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });
    _behavior.opacity = property(0.75);
    _behavior.xhairOpacity = property(null);
    _behavior.xhairWidth = property(10);
    _behavior.xhairHeight = property(10);
    _behavior.xhairColor = property('blue');

    return _behavior;
};

