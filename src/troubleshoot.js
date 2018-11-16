dc_graph.troubleshoot = function() {
    var _debugLayer = null;
    var _translate, _scale = 1, _xDomain, _yDomain;

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
            stroke: _behavior.xhairColor(),
            'stroke-width': 1/_scale
        });
        function cola_point(n) {
            return {x: n.cola.x, y: n.cola.y};
        }
        var colabounds = node.data().map(function(n) {
            return boundary(cola_point(n), n.cola.width, n.cola.height);
        });
        var colaboundary = _debugLayer.selectAll('path.colaboundary').data(colabounds);
        draw_corners(colaboundary, 'colaboundary', _behavior.boundsColor());

        var textbounds = node.data().map(function(n) {
            if(!n.bbox || (!n.bbox.width && !n.bbox.height))
                return null;
            return boundary(cola_point(n), n.bbox.width, n.bbox.height);
        }).filter(function(n) { return !!n; });
        var textboundary = _debugLayer.selectAll('path.textboundary').data(textbounds);
        draw_corners(textboundary, 'textboundary', _behavior.boundsColor());

        var radiibounds = node.data().map(function(n) {
            if(typeof n.dcg_rx !== 'number')
                return null;
            return boundary(cola_point(n), n.dcg_rx*2, n.dcg_ry*2);
        }).filter(function(n) { return !!n; });
        var radiiboundary = _debugLayer.selectAll('path.radiiboundary').data(radiibounds);
        draw_corners(radiiboundary, 'radiiboundary', _behavior.boundsColor());

        diagram.addOrRemoveDef('debug-orient-marker-head',
                               true,
                               'svg:marker',
                               orient_marker.bind(null, _behavior.arrowHeadColor()));
        diagram.addOrRemoveDef('debug-orient-marker-tail',
                               true,
                               'svg:marker',
                               orient_marker.bind(null, _behavior.arrowTailColor()));
        var heads = _behavior.arrowLength() ? edge.data().map(function(e) {
            return {pos: e.pos.new.path.points[e.pos.new.path.points.length-1], orient: e.pos.new.orienthead};
        }) : [];
        var headOrients = _debugLayer.selectAll('line.heads').data(heads);
        draw_arrow_orient(headOrients, 'heads', _behavior.arrowHeadColor(), '#debug-orient-marker-head');

        var tails = _behavior.arrowLength() ? edge.data().map(function(e) {
            return {pos: e.pos.new.path.points[0], orient: e.pos.new.orienttail};
        }) : [];
        var tailOrients = _debugLayer.selectAll('line.tails').data(tails);
        draw_arrow_orient(tailOrients, 'tails', _behavior.arrowTailColor(), '#debug-orient-marker-tail');

        var headpts = edge.data().map(function(e) {
            return edge_arrow_points(
                diagram.arrows(),
                diagram.edgeArrowhead.eval(e),
                unrad(e.pos.new.orienthead),
                e.pos.new.path.points[e.pos.new.path.points.length-1],
                diagram.nodeStrokeWidth.eval(e.head)
            );
        }).flat();
        var hp = _debugLayer.selectAll('path.head-point').data(headpts);
        draw_x(hp, 'head-point', _behavior.arrowHeadColor());

        var tailpts = edge.data().map(function(e) {
            return edge_arrow_points(
                diagram.arrows(),
                diagram.edgeArrowtail.eval(e),
                unrad(e.pos.new.orienttail),
                e.pos.new.path.points[0],
                diagram.nodeStrokeWidth.eval(e.tail)
            );
        }).flat();
        var tp = _debugLayer.selectAll('path.tail-point').data(tailpts);
        draw_x(tp, 'tail-point', _behavior.arrowTailColor());

        var domain = _debugLayer.selectAll('rect.domain').data([0]);
        domain.enter().append('rect');
        var xd = _behavior.parent().x().domain(), yd = _behavior.parent().y().domain();
        domain.attr({
            class: 'domain',
            fill: 'none',
            opacity: _behavior.domainOpacity(),
            stroke: _behavior.domainColor(),
            'stroke-width': _behavior.domainStrokeWidth()/_scale,
            x: xd[0],
            y: yd[0],
            width: xd[1] - xd[0],
            height: yd[1] - yd[0]
        });
    }
    function on_zoom(translate, scale, xDomain, yDomain) {
        _translate = translate;
        _scale = scale;
        _xDomain = xDomain;
        _yDomain = yDomain;
        add_behavior(_behavior.parent(), _behavior.parent().selectAllNodes(), _behavior.parent().selectAllEdges());
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
    function draw_corners(binding, classname, color) {
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr({
            d: corners,
            opacity: _behavior.boundsOpacity() !== null ? _behavior.boundsOpacity() : _behavior.opacity(),
            stroke: color,
            'stroke-width': 1/_scale,
            fill: 'none'
        });
    }
        function unrad(orient) {
            return +orient.replace('rad','');
        }
    function draw_arrow_orient(binding, classname, color, markerUrl) {
        binding.exit().remove();
        binding.enter().append('line').attr('class', classname);
        binding.attr({
            x1: function(d) { return d.pos.x; },
            y1: function(d) { return d.pos.y; },
            x2: function(d) { return d.pos.x - Math.cos(unrad(d.orient))*_behavior.arrowLength(); },
            y2: function(d) { return d.pos.y - Math.sin(unrad(d.orient))*_behavior.arrowLength(); },
            stroke: color,
            'stroke-width': _behavior.arrowStrokeWidth()/_scale,
            opacity: _behavior.arrowOpacity() !== null ? _behavior.arrowOpacity() : _behavior.opacity(),
            'marker-end': 'url(' + markerUrl + ')'
        });
    }
    function orient_marker(color, markerEnter) {
        markerEnter
            .attr({
                viewBox: '0 -3 3 6',
                refX: 3,
                refY: 0,
                orient: 'auto'
            });
        markerEnter.append('path')
            .attr('stroke', color)
            .attr('fill', 'none')
            .attr('d', 'M0,3 L3,0 L0,-3');
    }
    function edge_arrow_points(arrows, defn, orient, endp, strokeWidth) {
        var parts = arrow_parts(arrows, defn),
            offsets = arrow_offsets(arrows, parts),
            xunit = [Math.cos(orient), Math.sin(orient)];
        endp = [endp.x, endp.y];
        if(!parts.length)
            return [[endp[0] - xunit[0]*strokeWidth/2,
                     endp[1] - xunit[1]*strokeWidth/2]];
        var globofs = add_points(
            [-strokeWidth/2,0],
            mult_point(front_ref(arrows[parts[0]].frontRef), -1));
        var pts = offsets.map(function(ofs, i) {
            return [
                globofs,
                front_ref(arrows[parts[i]].frontRef),
                ofs.offset
            ].reduce(add_points);
        });
        pts.push([
            globofs,
            back_ref(arrows[parts[parts.length-1]].backRef),
            offsets[parts.length-1].offset
        ].reduce(add_points));
        return pts.map(function(p) {
            return add_points(
                endp,
                [p[0]*xunit[0] - p[1]*xunit[1], p[0]*xunit[1] + p[1]*xunit[0]]
            );
        });
    }


    function draw_x(binding, classname, color) {
        var xw = _behavior.xWidth()/2, xh = _behavior.xHeight()/2;
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr({
            d: function(pos) {
                return [[[-xw,-xh],[xw,xh]], [[xw,-xh], [-xw,xh]]].map(function(seg) {
                    return 'M' + seg.map(function(p) {
                        return (pos[0] + p[0]) + ',' + (pos[1] + p[1]);
                    }).join(' L');
                }).join(' ');
            },
            'stroke-width': 2/_scale,
            stroke: color,
            opacity: _behavior.xOpacity()
        });
    }
    function remove_behavior(diagram, node, edge, ehover) {
        if(_debugLayer)
            _debugLayer.remove();
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        laterDraw: true,
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            if(p) {
                _translate = p.translate();
                _scale = p.scale();
                p.on('zoomed.troubleshoot', on_zoom);
            }
        }
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

    _behavior.arrowOpacity = property(null);
    _behavior.arrowStrokeWidth = property(3);
    _behavior.arrowColor = _behavior.arrowHeadColor = property('darkorange');
    _behavior.arrowTailColor = property('red');
    _behavior.arrowLength = property(100);

    _behavior.xWidth = property(1);
    _behavior.xHeight = property(1);
    _behavior.xOpacity = property(0.8);

    _behavior.domainOpacity = property(0.6);
    _behavior.domainColor = property('darkorange');
    _behavior.domainStrokeWidth = property(4);

    return _behavior;
};

