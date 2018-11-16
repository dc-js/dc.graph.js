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
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 0, y: -5},
                {x: 10, y: 0},
                {x: 0, y: 5},
                {x: 3, y: 0}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    crow: {
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 10, y: -5},
                {x: 0, y: 0},
                {x: 10, y: 5},
                {x: 7, y: 0}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    dot: {
        frontRef: [8,0],
        drawFunction: function(marker, ofs) {
            marker.append('svg:circle')
                .attr('r', 4)
                .attr('cx', 4 + ofs[0])
                .attr('cy', 0)
                .attr('stroke-width', '0px');
        }
    },
    odot: {
        frontRef: [8,0],
        drawFunction: function(marker, ofs) {
            marker.append('svg:circle')
                .attr('r', 3.5)
                .attr('cx', 4 + ofs[0])
                .attr('cy', 0)
                .attr('fill', 'none')
                .attr('stroke-width', '1px');
        }
    }
};

function arrow_parts(arrdefs, desc) {
    // graphviz appears to use a real parser for this
    var parts = [];
    while(desc && desc.length) {
        var ok = false;
        for(var an in arrdefs)
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

function union_viewbox(vb1, vb2) {
    var left = Math.min(vb1[0], vb2[0]),
        bottom = Math.min(vb1[1], vb2[1]),
        right = Math.max(vb1[0] + vb1[2], vb2[0] + vb2[2]),
        top = Math.max(vb1[1] + vb1[3], vb2[1] + vb2[3]);
    return [left, bottom, right - left, top - bottom];
}

function subtract_points(p1, p2) {
    return [p1[0] - p2[0], p1[1] - p2[1]];
}

function add_points(p1, p2) {
    return [p1[0] + p2[0], p1[1] + p2[1]];
}

function mult_point(p, s) {
    return p.map(function(x) { return x*s; });
}

function defaulted(def) {
    return function(x) {
        return x || def;
    };
}

var view_box = defaulted([0, -5, 10, 10]),
    front_ref = defaulted([10, 0]),
    back_ref = defaulted([0, 0]);

function arrow_offsets(arrdefs, parts) {
    var frontRef = null, backRef = null;
    return parts.map(function(p, i) {
        var fr = front_ref(arrdefs[p].frontRef),
            br = back_ref(arrdefs[p].backRef);
        if(i === 0) {
            frontRef = fr;
            backRef = br;
            return [0, 0];
        } else {
            var ofs = subtract_points(backRef, fr);
            backRef = add_points(br, ofs);
            return ofs;
        }
    });
}

function arrow_bounds(arrdefs, parts) {
    var viewBox = null, offsets = arrow_offsets(arrdefs, parts);
    parts.forEach(function(p, i) {
        var vb = view_box(arrdefs[p].viewBox);
        var ofs = offsets[i];
        if(!viewBox)
            viewBox = vb.slice();
        else
            viewBox = union_viewbox(viewBox, [vb[0] + ofs[0], vb[1] + ofs[1], vb[2], vb[3]]);
    });
    return {offsets: offsets, viewBox: viewBox};
}

function arrow_length(arrdefs, parts) {
    if(!parts.length)
        return 0;
    var offsets = arrow_offsets(arrdefs, parts);
    return front_ref(arrdefs[parts[0]].frontRef)[0] - add_points(back_ref(arrdefs[parts[parts.length-1]].backDef), offsets[parts.length-1])[0];
}

function edgeArrow(diagram, arrdefs, e, kind, desc) {
    var id = diagram.arrowId(e, kind);
    var strokeOfs = diagram.nodeStrokeWidth.eval(kind==='tail' ? e.tail : e.head)/2;
    if(e[kind + 'ArrowLast'] === desc + '-' + strokeOfs)
        return id;
    var parts = arrow_parts(arrdefs, desc),
        marker = diagram.addOrRemoveDef(id, !!parts.length, 'svg:marker');

    if(parts.length) {
        var bounds = arrow_bounds(arrdefs, parts),
            frontRef = front_ref(arrdefs[parts[0]].frontRef);
        bounds.viewBox[0] -= strokeOfs;
        bounds.viewBox[3] += strokeOfs;
        marker
            .attr('viewBox', bounds.viewBox.join(' '))
            .attr('refX', frontRef[0])
            .attr('refY', frontRef[1])
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', bounds.viewBox[2]*diagram.edgeArrowSize.eval(e))
            .attr('markerHeight', bounds.viewBox[3]*diagram.edgeArrowSize.eval(e))
            .attr('stroke', diagram.edgeStroke.eval(e))
            .attr('fill', diagram.edgeStroke.eval(e));
        marker.html(null);
        parts.forEach(function(p, i) {
            marker
                .call(arrdefs[p].drawFunction,
                      add_points([-strokeOfs,0], bounds.offsets[i]));
        });
    }
    e[kind + 'ArrowLast'] = desc;
    return desc ? id : null;
}
