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
    box: {
        frontRef: [8,0],
        drawFunction: function(marker, ofs) {
            marker.append('rect')
                .attr({
                    x: ofs[0],
                    y: -4,
                    width: 8,
                    height: 8,
                    'stroke-width': 0
                });
        }
    },
    obox: {
        frontRef: [8,0],
        drawFunction: function(marker, ofs) {
            marker.append('rect')
                .attr({
                    x: ofs[0] + 0.5,
                    y: -3.5,
                    width: 7,
                    height: 7,
                    'stroke-width': 1,
                    fill: 'none'
                });
        }
    },
    curve: {
        stems: [true,false],
        kernstems: [0, 0.25],
        frontRef: [8,0],
        drawFunction: function(marker, ofs) {
            marker.append('svg:path')
                .attr({
                    d: ['M', 4 + ofs[0], 3.5,
                        'A', 3.5, 3.5, 0, 0, 0, 4 + ofs[0], -3.5,
                        'M', 7 + ofs[0],  0,
                        'h  -7'].join(' '),
                    'stroke-width': 1,
                    fill: 'none'
                });
        }
    },
    icurve: {
        stems: [false,true],
        kernstems: [0.25,0],
        frontRef: [8,0],
        drawFunction: function(marker, ofs) {
            marker.append('svg:path')
                .attr({
                    d: ['M', 4 + ofs[0], 3.5,
                        'A', 3.5, 3.5, 0, 0, 1, 4 + ofs[0], -3.5,
                        'M', 1 + ofs[0],  0,
                        'h  7'].join(' '),
                    'stroke-width': 1,
                    fill: 'none'
                });
        }
    },
    diamond: {
        frontRef: [12,0],
        viewBox: [0, -4, 12, 8],
        kernstems: [1.5,1.5],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 0, y: 0},
                {x: 6, y: 4},
                {x: 12, y: 0},
                {x: 6, y: -4}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr({
                    d: generate_path(points, 1, true),
                    'stroke-width': 0
                });
        }
    },
    odiamond: {
        frontRef: [12,0],
        viewBox: [0, -4, 12, 8],
        kernstems: [1.5,1.5],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 0.9, y: 0},
                {x: 6, y: 3.4},
                {x: 11.1, y: 0},
                {x: 6, y: -3.4}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr({
                    d: generate_path(points, 1, true),
                    'stroke-width': 1,
                    fill: 'none'
                });
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
    },
    normal: {
        frontRef: [8,0],
        viewBox: [0, -3, 8, 6],
        kernstems: [0,2],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 0, y: 3},
                {x: 8, y: 0},
                {x: 0, y: -3}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    onormal: {
        frontRef: [8,0],
        viewBox: [0, -3, 8, 6],
        kernstems: [0,2],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 0.5, y: 2.28},
                {x: 6.57, y: 0},
                {x: 0.5, y: -2.28}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr({
                    d: generate_path(points, 1, true),
                    'stroke-width': 1,
                    fill: 'none'
                });
        }
    },
    inv: {
        frontRef: [8,0],
        viewBox: [0, -3, 8, 6],
        kernstems: [2,0],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 8, y: 3},
                {x: 0, y: 0},
                {x: 8, y: -3}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    oinv: {
        frontRef: [8,0],
        viewBox: [0, -3, 8, 6],
        kernstems: [2,0],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 7.5, y: 2.28},
                {x: 1.43, y: 0},
                {x: 7.5, y: -2.28}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr({
                    d: generate_path(points, 1, true),
                    'stroke-width': 1,
                    fill: 'none'
                });
        }
    },
    tee: {
        frontRef: [5,0],
        viewBox: [0, -5, 5, 10],
        stems: [true,false],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 2, y: 5},
                {x: 5, y: 5},
                {x: 5, y: -5},
                {x: 2, y: -5},
                {x: 2, y: -0.5},
                {x: 0, y: -0.5},
                {x: 0, y: 0.5},
                {x: 2, y: 0.5}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    vee: {
        stems: [true,false],
        kernstems: [0,1],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 0, y: -5},
                {x: 10, y: 0},
                {x: 0, y: 5},
                {x: 4.5, y: 0.5},
                {x: 0, y: 0.5},
                {x: 0, y: -0.5},
                {x: 4.5, y: -0.5}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
        }
    },
    crow: {
        stems: [false,true],
        kernstems: [1,0],
        drawFunction: function(marker, ofs) {
            var points = [
                {x: 10, y: -5},
                {x: 0, y: 0},
                {x: 10, y: 5},
                {x: 5.5, y: 0.5},
                {x: 10, y: 0.5},
                {x: 10, y: -0.5},
                {x: 5.5, y: -0.5}
            ].map(offsetx(ofs[0]));
            marker.append('svg:path')
                .attr('d', generate_path(points, 1, true))
                .attr('stroke-width', '0px');
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
        var fr = front_ref(arrdefs[p].frontRef).slice(),
            br = back_ref(arrdefs[p].backRef).slice();
        if(arrdefs[p].kernstems) {
            if(i !== 0 && arrdefs[p].kernstems[1] &&
               arrdefs[parts[i-1]].stems && arrdefs[parts[i-1]].stems[0])
                fr[0] -= arrdefs[p].kernstems[1];
            if(arrdefs[p].kernstems[0] &&
               (i === parts.length-1 || arrdefs[parts[i+1]].stems && arrdefs[parts[i+1]].stems[1]))
                br[0] += arrdefs[p].kernstems[0];
        }
        if(i === 0) {
            frontRef = fr;
            backRef = br;
            return {backRef: backRef, offset: [0, 0]};
        } else {
            var ofs = subtract_points(backRef, fr);
            backRef = add_points(br, ofs);
            return {backRef: backRef, offset: ofs};
        }
    });
}

function arrow_bounds(arrdefs, parts) {
    var viewBox = null, offsets = arrow_offsets(arrdefs, parts);
    parts.forEach(function(p, i) {
        var vb = view_box(arrdefs[p].viewBox);
        var ofs = offsets[i].offset;
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
    return front_ref(arrdefs[parts[0]].frontRef)[0] - offsets[parts.length-1].backRef[0];
}

function edgeArrow(diagram, arrdefs, e, kind, desc) {
    var id = diagram.arrowId(e, kind);
    var strokeOfs = diagram.nodeStrokeWidth.eval(kind==='tail' ? e.source : e.target)/2;
    if(e[kind + 'ArrowLast'] === desc + '-' + strokeOfs)
        return id;
    var parts = arrow_parts(arrdefs, desc),
        marker = diagram.addOrRemoveDef(id, !!parts.length, 'svg:marker');

    if(parts.length) {
        var bounds = arrow_bounds(arrdefs, parts),
            frontRef = front_ref(arrdefs[parts[0]].frontRef),
            arrowSize = diagram.edgeArrowSize.eval(e);
        bounds.viewBox[0] -= strokeOfs/arrowSize;
        bounds.viewBox[3] += strokeOfs/arrowSize;
        marker
            .attr('viewBox', bounds.viewBox.join(' '))
            .attr('refX', frontRef[0])
            .attr('refY', frontRef[1])
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', bounds.viewBox[2]*arrowSize)
            .attr('markerHeight', bounds.viewBox[3]*arrowSize)
            .attr('stroke', diagram.edgeStroke.eval(e))
            .attr('fill', diagram.edgeStroke.eval(e));
        marker.html(null);
        parts.forEach(function(p, i) {
            marker
                .call(arrdefs[p].drawFunction,
                      add_points([-strokeOfs/arrowSize,0], bounds.offsets[i].offset));
        });
    }
    e[kind + 'ArrowLast'] = desc;
    return desc ? id : null;
}
