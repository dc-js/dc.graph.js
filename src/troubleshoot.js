import {
    add_points,
    addPoints,
    arrowOffsets,
    arrowParts,
    back_ref,
    front_ref,
    multPoint,
} from './arrows.js';
import { property } from './core.js';
import { mode } from './mode.js';

export function troubleshoot() {
    let _debugLayer = null;
    let _translate, _scale = 1, _xDomain, _yDomain;

    function draw(diagram, node, edge, _ehover) {
        if (!_debugLayer)
            _debugLayer = diagram.g().append('g')
                .attr('class', 'troubleshoot')
                .attr('pointer-events', 'none');
        const centers = node.data().map(n => ({
            x: n.cola.x,
            y: n.cola.y,
        }));
        let crosshairs = _debugLayer.selectAll('path.nodecenter').data(centers);
        crosshairs.exit().remove();
        const crosshairsEnter = crosshairs.enter().append('path').attr('class', 'nodecenter');
        crosshairs = crosshairs.merge(crosshairsEnter);
        crosshairs.attr(
            'd',
            c => `M${c.x-_mode.xhairWidth()/2},${c.y} h${_mode.xhairWidth()} M${c.x},${
                c.y-_mode.xhairHeight()/2
            } v${_mode.xhairHeight()}`,
        )
            .attr('opacity', _mode.xhairOpacity() !== null ? _mode.xhairOpacity() : _mode.opacity())
            .attr('stroke', _mode.xhairColor())
            .attr('stroke-width', 1/_scale);
        function cola_point(n) {
            return {x: n.cola.x, y: n.cola.y};
        }
        const colabounds = node.data().map(n =>
            boundary(cola_point(n), n.cola.width, n.cola.height)
        );
        const colaboundary = _debugLayer.selectAll('path.colaboundary').data(colabounds);
        draw_corners(colaboundary, 'colaboundary', _mode.boundsColor());

        const textbounds = node.data().map(n => {
            if (!n.bbox || (!n.bbox.width && !n.bbox.height))
                return null;
            return boundary(cola_point(n), n.bbox.width, n.bbox.height);
        }).filter(n => !!n);
        const textboundary = _debugLayer.selectAll('path.textboundary').data(textbounds);
        draw_corners(textboundary, 'textboundary', _mode.boundsColor());

        const radiibounds = node.data().map(n => {
            if (typeof n.dcg_rx !== 'number')
                return null;
            return boundary(cola_point(n), n.dcg_rx*2, n.dcg_ry*2);
        }).filter(n => !!n);
        const radiiboundary = _debugLayer.selectAll('path.radiiboundary').data(radiibounds);
        draw_corners(radiiboundary, 'radiiboundary', _mode.boundsColor());

        diagram.addOrRemoveDef(
            'debug-orient-marker-head',
            true,
            'svg:marker',
            orient_marker.bind(null, _mode.arrowHeadColor()),
        );
        diagram.addOrRemoveDef(
            'debug-orient-marker-tail',
            true,
            'svg:marker',
            orient_marker.bind(null, _mode.arrowTailColor()),
        );
        const heads = _mode.arrowLength()
            ? edge.data().map(e => ({
                pos: e.pos.new.path.points[e.pos.new.path.points.length-1],
                orient: e.pos.new.orienthead,
            }))
            : [];
        const headOrients = _debugLayer.selectAll('line.heads').data(heads);
        draw_arrow_orient(
            headOrients,
            'heads',
            _mode.arrowHeadColor(),
            '#debug-orient-marker-head',
        );

        const tails = _mode.arrowLength()
            ? edge.data().map(e => ({pos: e.pos.new.path.points[0], orient: e.pos.new.orienttail}))
            : [];
        const tailOrients = _debugLayer.selectAll('line.tails').data(tails);
        draw_arrow_orient(
            tailOrients,
            'tails',
            _mode.arrowTailColor(),
            '#debug-orient-marker-tail',
        );

        const headpts = Array.prototype.concat.apply(
            [],
            edge.data().map(e => {
                const arrowSize = diagram.edgeArrowSize.eval(e);
                return edge_arrow_points(
                    diagram.arrows(),
                    diagram.edgeArrowhead.eval(e),
                    arrowSize,
                    diagram.edgeStrokeWidth.eval(e)/arrowSize,
                    unrad(e.pos.new.orienthead),
                    e.pos.new.full.points[e.pos.new.full.points.length-1],
                    diagram.nodeStrokeWidth.eval(e.target),
                );
            }),
        );
        const hp = _debugLayer.selectAll('path.head-point').data(headpts);
        draw_x(hp, 'head-point', _mode.arrowHeadColor());

        const tailpts = Array.prototype.concat.apply(
            [],
            edge.data().map(e => {
                const arrowSize = diagram.edgeArrowSize.eval(e);
                return edge_arrow_points(
                    diagram.arrows(),
                    diagram.edgeArrowtail.eval(e),
                    arrowSize,
                    diagram.edgeStrokeWidth.eval(e)/arrowSize,
                    unrad(e.pos.new.orienttail),
                    e.pos.new.full.points[0],
                    diagram.nodeStrokeWidth.eval(e.source),
                );
            }),
        );
        const tp = _debugLayer.selectAll('path.tail-point').data(tailpts);
        draw_x(tp, 'tail-point', _mode.arrowTailColor());

        let domain = _debugLayer.selectAll('rect.domain').data([0]);
        const domainEnter = domain.enter().append('rect');
        domain = domain.merge(domainEnter);
        const xd = _mode.parent().x().domain(), yd = _mode.parent().y().domain();
        domain.attr('class', 'domain')
            .attr('fill', 'none')
            .attr('opacity', _mode.domainOpacity())
            .attr('stroke', _mode.domainColor())
            .attr('stroke-width', _mode.domainStrokeWidth()/_scale)
            .attr('x', xd[0])
            .attr('y', yd[0])
            .attr('width', xd[1]-xd[0])
            .attr('height', yd[1]-yd[0]);
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
            left: point.x-wid/2,
            top: point.y-hei/2,
            right: point.x+wid/2,
            bottom: point.y+hei/2,
        };
    }
    function bound_tick(x, y, dx, dy) {
        return `M${x},${y+dy} v${-dy} h${dx}`;
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
        binding.attr('d', corners)
            .attr(
                'opacity',
                _mode.boundsOpacity() !== null ? _mode.boundsOpacity() : _mode.opacity(),
            )
            .attr('stroke', color)
            .attr('stroke-width', 1/_scale)
            .attr('fill', 'none');
    }
    function unrad(orient) {
        return +orient.replace('rad', '');
    }
    function draw_arrow_orient(binding, classname, color, markerUrl) {
        binding.exit().remove();
        binding.enter().append('line').attr('class', classname);
        binding.attr('x1', d => d.pos.x)
            .attr('y1', d => d.pos.y)
            .attr('x2', d => d.pos.x-Math.cos(unrad(d.orient))*_mode.arrowLength())
            .attr('y2', d => d.pos.y-Math.sin(unrad(d.orient))*_mode.arrowLength())
            .attr('stroke', color)
            .attr('stroke-width', _mode.arrowStrokeWidth()/_scale)
            .attr('opacity', _mode.arrowOpacity() !== null ? _mode.arrowOpacity() : _mode.opacity())
            .attr('marker-end', `url(${markerUrl})`);
    }
    function orient_marker(color, markerEnter) {
        markerEnter
            .attr('viewBox', '0 -3 3 6')
            .attr('refX', 3)
            .attr('refY', 0)
            .attr('orient', 'auto');
        markerEnter.append('path')
            .attr('stroke', color)
            .attr('fill', 'none')
            .attr('d', 'M0,3 L3,0 L0,-3');
    }
    function edge_arrow_points(arrows, defn, arrowSize, stemWidth, orient, endp, strokeWidth) {
        const parts = arrowParts(arrows, defn),
            offsets = arrowOffsets(parts, stemWidth),
            xunit = [Math.cos(orient), Math.sin(orient)];
        endp = [endp.x, endp.y];
        if (!parts.length)
            return [[endp[0]-xunit[0]*strokeWidth/2, endp[1]-xunit[1]*strokeWidth/2]];
        const globofs = addPoints(
            [-strokeWidth/arrowSize/2, 0],
            multPoint(front_ref(parts[0].frontRef), -1),
        );
        const pts = offsets.map((ofs, i) =>
            multPoint(
                [
                    globofs,
                    front_ref(parts[i].frontRef),
                    ofs.offset,
                ].reduce(add_points),
                arrowSize,
            )
        );
        pts.push(multPoint(
            [
                globofs,
                back_ref(parts[parts.length-1].backRef),
                offsets[parts.length-1].offset,
            ].reduce(add_points),
            arrowSize,
        ));
        return pts.map(p =>
            addPoints(
                endp,
                [p[0]*xunit[0]-p[1]*xunit[1], p[0]*xunit[1]+p[1]*xunit[0]],
            )
        );
    }

    function draw_x(binding, classname, color) {
        const xw = _mode.xWidth()/2, xh = _mode.xHeight()/2;
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr(
            'd',
            pos =>
                [[[-xw, -xh], [xw, xh]], [[xw, -xh], [-xw, xh]]].map(seg =>
                    `M${seg.map(p => `${pos[0]+p[0]},${pos[1]+p[1]}`).join(' L')}`
                ).join(' '),
        )
            .attr('stroke-width', 2/_scale)
            .attr('stroke', color)
            .attr('opacity', _mode.xOpacity());
    }
    function remove(_diagram, _node, _edge, _ehover) {
        if (_debugLayer)
            _debugLayer.remove();
    }

    const _mode = mode('highlight-paths', {
        laterDraw: true,
        draw,
        remove,
        parent(p) {
            if (p) {
                _translate = p.translate();
                _scale = p.scale();
                p.on('zoomed.troubleshoot', on_zoom);
            } else if (_mode.parent())
                _mode.parent().on('zoomed.troubleshoot', null);
        },
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
}
