dc_graph.troubleshoot = function() {
    var _debugLayer = null;
    var _translate, _scale = 1, _xDomain, _yDomain;

    function draw(diagram, node, edge, ehover) {
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
                return 'M' + (c.x - _mode.xhairWidth()/2) + ',' + c.y + ' h' + _mode.xhairWidth() +
                    ' M' + c.x + ',' + (c.y - _mode.xhairHeight()/2) + ' v' + _mode.xhairHeight();
            },
            opacity: _mode.xhairOpacity() !== null ? _mode.xhairOpacity() : _mode.opacity(),
            stroke: _mode.xhairColor(),
            'stroke-width': 1/_scale
        });
        function cola_point(n) {
            return {x: n.cola.x, y: n.cola.y};
        }
        var colabounds = node.data().map(function(n) {
            return boundary(cola_point(n), n.cola.width, n.cola.height);
        });
        var colaboundary = _debugLayer.selectAll('path.colaboundary').data(colabounds);
        draw_corners(colaboundary, 'colaboundary', _mode.boundsColor());

        var textbounds = node.data().map(function(n) {
            if(!n.bbox || (!n.bbox.width && !n.bbox.height))
                return null;
            return boundary(cola_point(n), n.bbox.width, n.bbox.height);
        }).filter(function(n) { return !!n; });
        var textboundary = _debugLayer.selectAll('path.textboundary').data(textbounds);
        draw_corners(textboundary, 'textboundary', _mode.boundsColor());

        var radiibounds = node.data().map(function(n) {
            if(typeof n.dcg_rx !== 'number')
                return null;
            return boundary(cola_point(n), n.dcg_rx*2, n.dcg_ry*2);
        }).filter(function(n) { return !!n; });
        var radiiboundary = _debugLayer.selectAll('path.radiiboundary').data(radiibounds);
        draw_corners(radiiboundary, 'radiiboundary', _mode.boundsColor());

        diagram.addOrRemoveDef('debug-orient-marker-head',
                               true,
                               'svg:marker',
                               orient_marker.bind(null, _mode.arrowHeadColor()));
        diagram.addOrRemoveDef('debug-orient-marker-tail',
                               true,
                               'svg:marker',
                               orient_marker.bind(null, _mode.arrowTailColor()));
        var heads = _mode.arrowLength() ? edge.data().map(function(e) {
            return {pos: e.pos.new.path.points[e.pos.new.path.points.length-1], orient: e.pos.new.orienthead};
        }) : [];
        var headOrients = _debugLayer.selectAll('line.heads').data(heads);
        draw_arrow_orient(headOrients, 'heads', _mode.arrowHeadColor(), '#debug-orient-marker-head');

        var tails = _mode.arrowLength() ? edge.data().map(function(e) {
            return {pos: e.pos.new.path.points[0], orient: e.pos.new.orienttail};
        }) : [];
        var tailOrients = _debugLayer.selectAll('line.tails').data(tails);
        draw_arrow_orient(tailOrients, 'tails', _mode.arrowTailColor(), '#debug-orient-marker-tail');

        var headpts = Array.prototype.concat.apply([], edge.data().map(function(e) {
            var arrowSize = diagram.edgeArrowSize.eval(e);
            return edge_arrow_points(
                diagram.arrows(),
                diagram.edgeArrowhead.eval(e),
                arrowSize,
                diagram.edgeStrokeWidth.eval(e) / arrowSize,
                unrad(e.pos.new.orienthead),
                e.pos.new.full.points[e.pos.new.full.points.length-1],
                diagram.nodeStrokeWidth.eval(e.target)
            );
        }));
        var hp = _debugLayer.selectAll('path.head-point').data(headpts);
        draw_x(hp, 'head-point', _mode.arrowHeadColor());

        var tailpts = Array.prototype.concat.apply([], edge.data().map(function(e) {
            var arrowSize = diagram.edgeArrowSize.eval(e);
            return edge_arrow_points(
                diagram.arrows(),
                diagram.edgeArrowtail.eval(e),
                arrowSize,
                diagram.edgeStrokeWidth.eval(e) / arrowSize,
                unrad(e.pos.new.orienttail),
                e.pos.new.full.points[0],
                diagram.nodeStrokeWidth.eval(e.source)
            );
        }));
        var tp = _debugLayer.selectAll('path.tail-point').data(tailpts);
        draw_x(tp, 'tail-point', _mode.arrowTailColor());

        var domain = _debugLayer.selectAll('rect.domain').data([0]);
        domain.enter().append('rect');
        var xd = _mode.parent().x().domain(), yd = _mode.parent().y().domain();
        domain.attr({
            class: 'domain',
            fill: 'none',
            opacity: _mode.domainOpacity(),
            stroke: _mode.domainColor(),
            'stroke-width': _mode.domainStrokeWidth()/_scale,
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
        draw(_mode.parent(), _mode.parent().selectAllNodes(), _mode.parent().selectAllEdges());
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
            bound_tick(bounds.left, bounds.top, _mode.boundsWidth(), _mode.boundsHeight()),
            bound_tick(bounds.right, bounds.top, -_mode.boundsWidth(), _mode.boundsHeight()),
            bound_tick(bounds.right, bounds.bottom, -_mode.boundsWidth(), -_mode.boundsHeight()),
            bound_tick(bounds.left, bounds.bottom, _mode.boundsWidth(), -_mode.boundsHeight()),
        ].join(' ');
    }
    function draw_corners(binding, classname, color) {
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr({
            d: corners,
            opacity: _mode.boundsOpacity() !== null ? _mode.boundsOpacity() : _mode.opacity(),
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
            x2: function(d) { return d.pos.x - Math.cos(unrad(d.orient))*_mode.arrowLength(); },
            y2: function(d) { return d.pos.y - Math.sin(unrad(d.orient))*_mode.arrowLength(); },
            stroke: color,
            'stroke-width': _mode.arrowStrokeWidth()/_scale,
            opacity: _mode.arrowOpacity() !== null ? _mode.arrowOpacity() : _mode.opacity(),
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
    function edge_arrow_points(arrows, defn, arrowSize, stemWidth, orient, endp, strokeWidth) {
        var parts = arrow_parts(arrows, defn),
            offsets = arrow_offsets(parts, stemWidth),
            xunit = [Math.cos(orient), Math.sin(orient)];
        endp = [endp.x, endp.y];
        if(!parts.length)
            return [[endp[0] - xunit[0]*strokeWidth/2,
                     endp[1] - xunit[1]*strokeWidth/2]];
        var globofs = add_points(
            [-strokeWidth/arrowSize/2,0],
            mult_point(front_ref(parts[0].frontRef), -1));
        var pts = offsets.map(function(ofs, i) {
            return mult_point([
                globofs,
                front_ref(parts[i].frontRef),
                ofs.offset
            ].reduce(add_points), arrowSize);
        });
        pts.push(mult_point([
            globofs,
            back_ref(parts[parts.length-1].backRef),
            offsets[parts.length-1].offset
        ].reduce(add_points), arrowSize));
        return pts.map(function(p) {
            return add_points(
                endp,
                [p[0]*xunit[0] - p[1]*xunit[1], p[0]*xunit[1] + p[1]*xunit[0]]
            );
        });
    }


    function draw_x(binding, classname, color) {
        var xw = _mode.xWidth()/2, xh = _mode.xHeight()/2;
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
            opacity: _mode.xOpacity()
        });
    }
    function remove(diagram, node, edge, ehover) {
        if(_debugLayer)
            _debugLayer.remove();
    }

    var _mode = dc_graph.mode('highlight-paths', {
        laterDraw: true,
        draw: draw,
        remove: remove,
        parent: function(p) {
            if(p) {
                _translate = p.translate();
                _scale = p.scale();
                p.on('zoomed.troubleshoot', on_zoom);
            }
            else if(_mode.parent())
                _mode.parent().on('zoomed.troubleshoot', null);
        }
    });
    _mode.opacity = property(0.75);

    _mode.xhairOpacity = property(null);
    _mode.xhairWidth = property(10);
    _mode.xhairHeight = property(10);
    _mode.xhairColor = property('blue');

    _mode.boundsOpacity = property(null);
    _mode.boundsWidth = property(10);
    _mode.boundsHeight = property(10);
    _mode.boundsColor = property('green');

    _mode.arrowOpacity = property(null);
    _mode.arrowStrokeWidth = property(3);
    _mode.arrowColor = _mode.arrowHeadColor = property('darkorange');
    _mode.arrowTailColor = property('red');
    _mode.arrowLength = property(100);

    _mode.xWidth = property(1);
    _mode.xHeight = property(1);
    _mode.xOpacity = property(0.8);

    _mode.domainOpacity = property(0.6);
    _mode.domainColor = property('darkorange');
    _mode.domainStrokeWidth = property(4);

    return _mode;
};

