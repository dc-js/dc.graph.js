dc_graph.troubleshoot = function() {
    var _debugLayer = null;

    function add_behavior(chart, node, edge, ehover) {
        if(!_debugLayer)
            _debugLayer = chart.g().append('g').attr({
                class: 'draw-graphs',
                'pointer-events': 'none'
            });
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
        var boundaries = node.data().map(function(n) {
            return {
                left: n.cola.x - n.cola.width/2,
                top: n.cola.y - n.cola.height/2,
                right: n.cola.x + n.cola.width/2,
                bottom: n.cola.y + n.cola.height/2
            };
        });
        function bound_tick(x, y, dx, dy) {
            return 'M' + x + ',' + (y + dy) + ' v' + -dy + ' h' + dx;
        }
        var nodebounds = _debugLayer.selectAll('path.nodebounds').data(boundaries);
        nodebounds.exit().remove();
        nodebounds.enter().append('path').attr('class', 'nodebounds');
        nodebounds.attr({
            d: function(d) {
                return [
                    bound_tick(d.left, d.top, _behavior.boundsWidth(), _behavior.boundsHeight()),
                    bound_tick(d.right, d.top, -_behavior.boundsWidth(), _behavior.boundsHeight()),
                    bound_tick(d.right, d.bottom, -_behavior.boundsWidth(), -_behavior.boundsHeight()),
                    bound_tick(d.left, d.bottom, _behavior.boundsWidth(), -_behavior.boundsHeight()),
                ].join(' ');
            },
            opacity: _behavior.boundsOpacity() !== null ? _behavior.boundsOpacity() : _behavior.opacity(),
            stroke: _behavior.boundsColor(),
            fill: 'none'
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

    _behavior.boundsOpacity = property(null);
    _behavior.boundsWidth = property(10);
    _behavior.boundsHeight = property(10);
    _behavior.boundsColor = property('green');

    return _behavior;
};

