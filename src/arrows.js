function calculate_arrowhead_orientation(points, end) {
    var spos = points[0], tpos = points[points.length-1];
    var ref = end === 'head' ? tpos : spos;
    var partial, t = 0.5;
    do {
        t = (end === 'head' ? 1 + t : t) / 2;
        partial = bezier_point(points, t);
    }
    while(Math.hypot(ref.x - partial.x, ref.y - partial.y) > 25);
    return Math.atan2(ref.y - partial.y, ref.x - partial.x) + 'rad';
}

function offsetx(ofsx) {
    return function(p) {
        return {x: p.x + ofsx, y: p.y};
    };
}

dc_graph.builtin_arrows = {
    vee: {
        width: 12,
        height: 12,
        refX: 10,
        refY: 0,
        slength: 10,
        drawFunction: function(marker, ofsx) {
            var points = [
                {x: 0, y: -5},
                {x: 10, y: 0},
                {x: 0, y: 5},
                {x: 3, y: 0}
            ].map(offsetx(ofsx));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    crow: {
        width: 12,
        height: 12,
        refX: 10,
        refY: 0,
        slength: 10,
        drawFunction: function(marker, ofsx) {
            var points = [
                {x: 10, y: -5},
                {x: 0, y: 0},
                {x: 10, y: 5},
                {x: 7, y: 0}
            ].map(offsetx(ofsx));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    dot: {
        width: 10,
        height: 10,
        refX: 10,
        refY: 0,
        slength: 8,
        drawFunction: function(marker, ofsx) {
            marker.append('svg:circle')
                .attr('r', 4)
                .attr('cx', 5 + ofsx)
                .attr('cy', 0)
                .attr('stroke-width', '0px');
        }
    },
    odot: {
        width: 10,
        height: 10,
        refX: 10,
        refY: 0,
        slength: 8,
        drawFunction: function(marker, ofsx) {
            marker.append('svg:circle')
                .attr('r', 4)
                .attr('cx', 5 + ofsx)
                .attr('cy', 0)
                .attr('fill', 'none')
                .attr('stroke-width', '1px');
        }
    }
};

function arrow_parts(desc) {
    // graphviz appears to use a real parser for this
    var parts = [];
    while(desc && desc.length) {
        var ok = false;
        for(var an in dc_graph.builtin_arrows)
            if(desc.substring(0, an.length) === an) {
                ok = true;
                parts.push(an);
                desc = desc.slice(an.length);
                break;
            }
        if(!ok) {
            console.warn("couldn't find arrow name in " + desc);
            break;
        }
    }
    return parts;
}

function arrow_length(parts) {
    return d3.sum(parts, function(p) {
        return dc_graph.builtin_arrows[p].slength;
    });
}

function edgeArrow(diagram, arrdefs, e, kind, desc) {
    var id = diagram.arrowId(e, kind);
    if(e[kind + 'ArrowLast'] === desc)
        return id;
    var parts = arrow_parts(desc),
        marker = diagram.addOrRemoveDef(id, !!parts.length, 'svg:marker');

    if(parts.length) {
        var totlen = arrow_length(parts);
        marker
            .attr('viewBox', [10-totlen, -5, totlen, 10].join(' '))
            .attr('refX', arrdefs[parts[0]].refX)
            .attr('refY', arrdefs[parts[0]].refY)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', totlen*diagram.edgeArrowSize.eval(e))
            .attr('markerHeight', d3.max(parts, function(p) { return arrdefs[p].height; })*diagram.edgeArrowSize.eval(e))
            .attr('stroke', diagram.edgeStroke.eval(e))
            .attr('fill', diagram.edgeStroke.eval(e));
        marker.html(null);
        var ofsx = 0;
        parts.forEach(function(p) {
            marker
                .call(arrdefs[p].drawFunction, ofsx);
            ofsx -= arrdefs[p].slength;
        });
    }
    e[kind + 'ArrowLast'] = desc;
    return desc ? id : null;
}
