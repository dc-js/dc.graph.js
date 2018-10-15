dc_graph.troubleshoot = function() {
    var _debugLayer = null;

    function add_behavior(diagram, node, edge, ehover) {
        if(!_debugLayer)
            _debugLayer = diagram.g().append('g').attr({
                class: 'troubleshoot',
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
            d: function(c) {
                return 'M' + (c.x - _behavior.xhairWidth()/2) + ',' + c.y + ' h' + _behavior.xhairWidth() +
                    ' M' + c.x + ',' + (c.y - _behavior.xhairHeight()/2) + ' v' + _behavior.xhairHeight();
            },
            opacity: _behavior.xhairOpacity() !== null ? _behavior.xhairOpacity() : _behavior.opacity(),
            stroke: _behavior.xhairColor()
        });
        function cola_point(n) {
            return {x: n.cola.x, y: n.cola.y};
        }
        var colabounds = node.data().map(function(n) {
            return boundary(cola_point(n), n.cola.width, n.cola.height);
        });
        var colaboundary = _debugLayer.selectAll('path.colaboundary').data(colabounds);
        draw_corners(colaboundary, 'colaboundary');

        var textbounds = node.data().map(function(n) {
            if(!n.bbox)
                return null;
            return boundary(cola_point(n), n.bbox.width, n.bbox.height);
        }).filter(function(n) { return !!n; });
        var textboundary = _debugLayer.selectAll('path.textboundary').data(textbounds);
        draw_corners(textboundary, 'textboundary');

        var radiibounds = node.data().map(function(n) {
            if(!typeof n.dcg_rx === 'number')
                return null;
            return boundary(cola_point(n), n.dcg_rx*2, n.dcg_ry*2);
        }).filter(function(n) { return !!n; });
        var radiiboundary = _debugLayer.selectAll('path.radiiboundary').data(radiibounds);
        draw_corners(radiiboundary, 'radiiboundary');

        var domain = _debugLayer.selectAll('rect.domain').data([0]);
        domain.enter().append('rect');
        var xd = _behavior.parent().x().domain(), yd = _behavior.parent().y().domain();
        domain.attr({
            class: 'domain',
            fill: 'none',
            opacity: _behavior.domainOpacity(),
            stroke: _behavior.domainColor(),
            'stroke-width': _behavior.domainStrokeWidth(),
            x: xd[0],
            y: yd[0],
            width: xd[1] - xd[0],
            height: yd[1] - yd[0]
        });
    }
    function boundary(point, wid, hei) {
        return {
            left: point.x - wid/2,
            top: point.y - hei/2,
            right: point.x + wid/2,
            bottom: point.y + hei/2
        };
    };
    function bound_tick(x, y, dx, dy) {
        return 'M' + x + ',' + (y + dy) + ' v' + -dy + ' h' + dx;
    }
    function corners(bounds) {
        return [
            bound_tick(bounds.left, bounds.top, _behavior.boundsWidth(), _behavior.boundsHeight()),
            bound_tick(bounds.right, bounds.top, -_behavior.boundsWidth(), _behavior.boundsHeight()),
            bound_tick(bounds.right, bounds.bottom, -_behavior.boundsWidth(), -_behavior.boundsHeight()),
            bound_tick(bounds.left, bounds.bottom, _behavior.boundsWidth(), -_behavior.boundsHeight()),
        ].join(' ');
    }
    function draw_corners(binding, classname) {
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr({
            d: corners,
            opacity: _behavior.boundsOpacity() !== null ? _behavior.boundsOpacity() : _behavior.opacity(),
            stroke: _behavior.boundsColor(),
            fill: 'none'
        });
    }

    function remove_behavior(diagram, node, edge, ehover) {
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

    _behavior.domainOpacity = property(0.6);
    _behavior.domainColor = property('darkorange');
    _behavior.domainStrokeWidth = property(11);

    return _behavior;
};

