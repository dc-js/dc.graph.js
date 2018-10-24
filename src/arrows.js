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

dc_graph.builtin_arrows = {
    vee: {
        width: 12,
        height: 12,
        refX: 10,
        refY: 0,
        slength: 10,
        drawFunction: function(marker, ofsx) {
            marker.append('svg:path')
                .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
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
            marker.append('svg:path')
                .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
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
