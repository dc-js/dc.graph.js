function point_on_ellipse(A, B, dx, dy) {
    var tansq = Math.tan(Math.atan2(dy, dx));
    tansq = tansq*tansq; // why is this not just dy*dy/dx*dx ? ?
    var ret = {x: A*B/Math.sqrt(B*B + A*A*tansq), y: A*B/Math.sqrt(A*A + B*B/tansq)};
    if(dx<0)
        ret.x = -ret.x;
    if(dy<0)
        ret.y = -ret.y;
    return ret;
}

var eps = 0.0000001;
function between(a, b, c) {
    return a-eps <= b && b <= c+eps;
}

// Adapted from http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/1968345#1968345
function segment_intersection(x1,y1,x2,y2, x3,y3,x4,y4) {
    var x=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4)) /
            ((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    var y=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4)) /
            ((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    if (isNaN(x)||isNaN(y)) {
        return false;
    } else {
        if (x1>=x2) {
            if (!between(x2, x, x1)) {return false;}
        } else {
            if (!between(x1, x, x2)) {return false;}
        }
        if (y1>=y2) {
            if (!between(y2, y, y1)) {return false;}
        } else {
            if (!between(y1, y, y2)) {return false;}
        }
        if (x3>=x4) {
            if (!between(x4, x, x3)) {return false;}
        } else {
            if (!between(x3, x, x4)) {return false;}
        }
        if (y3>=y4) {
            if (!between(y4, y, y3)) {return false;}
        } else {
            if (!between(y3, y, y4)) {return false;}
        }
    }
    return {x: x, y: y};
}


function point_on_polygon(points, x0, y0, x1, y1) {
    for(var i = 0; i < points.length; i+=2) {
        var next = i===points.length-2 ? 0 : i+2;
        var isect = segment_intersection(points[i], points[i+1], points[next], points[next+1],
                                         x0, y0, x1, y1);
        if(isect)
            return isect;
    }
    return null;
}

function point_on_shape(chart, d, deltaX, deltaY) {
    switch(d.dcg_shape.shape) {
    case 'ellipse':
        return point_on_ellipse(d.dcg_rx, d.dcg_ry, deltaX, deltaY);
    case 'polygon':
        return point_on_polygon(d.dcg_points, 0,0, deltaX, deltaY);
    }
}

function elaborate_shape(def) {
    // as many as we can get from
    // http://www.graphviz.org/doc/info/shapes.html
    switch(def.shape) {
    case 'ellipse':
        return {shape: 'ellipse'};
    case 'egg':
        return {shape: 'polygon', sides: 100, distortion: -0.25};
    case 'triangle':
        return {shape: 'polygon', sides: 3};
    case 'diamond':
        return {shape: 'polygon', sides: 4, rotation: 45};
    case 'trapezium':
        return {shape: 'polygon', sides: 4, distortion: -0.5};
    case 'parallelogram':
        return {shape: 'polygon', sides: 4, skew: 0.5};
    case 'pentagon':
        return {shape: 'polygon', sides: 5};
    case 'hexagon':
        return {shape: 'polygon', sides: 6};
    case 'septagon':
        return {shape: 'polygon', sides: 7};
    case 'octagon':
        return {shape: 'polygon', sides: 8};
    case 'invtriangle':
        return {shape: 'polygon', sides: 3, rotation: 180};
    case 'invtrapezium':
        return {shape: 'polygon', sides: 4, distortion: 0.5};
    case 'square':
        return {shape: 'polygon', sides: 4};
    case 'polygon':
        return {
            shape: 'polygon',
            sides: def.sides,
            skew: def.skew,
            distortion: def.distortion,
            rotation: def.rotation
        };
    default: throw new Error('unknown shape ' + def.shape);
    }
}
function infer_shape(chart) {
    return function(d) {
        var def = param(chart.nodeShape())(d);
        d.dcg_shape = elaborate_shape(def);
        d.dcg_shape.abstract = def;
    };
}
function shape_changed(chart) {
    return function(d) {
        var def = param(chart.nodeShape())(d);
        var old = d.dcg_shape.abstract;
        if(def.shape !== old.shape)
            return true;
        else if(def.shape === 'polygon') {
            return def.shape.sides !== old.sides || def.shape.skew !== old.skew ||
                def.shape.distortion !== old.distortion || def.shape.rotation !== old.rotation;
        }
        else return false;
    };
}

function shape_element(chart) {
    return function(d) {
        var shape = d.dcg_shape.shape, elem;
        switch(shape) {
        case 'ellipse':
            elem = 'ellipse';
            break;
        case 'polygon':
            elem = 'path';
            break;
        default:
            throw new Error('unknown shape ' + shape);
        }
        return document.createElementNS("http://www.w3.org/2000/svg", elem);
    };
}

function fit_shape(chart) {
    return function(d) {
        var r = param(chart.nodeRadius())(d);
        var rplus = r*2 + chart.nodePadding();
        var bbox;
        if(param(chart.nodeFitLabel())(d))
            bbox = this.getBBox();
        var fitx = 0;
        if(bbox && bbox.width && bbox.height) {
            // solve (x/A)^2 + (y/B)^2) = 1 for A, with B=r, to fit text in ellipse
            // http://stackoverflow.com/a/433438/676195
            var y_over_B = bbox.height/2/r;
            var rx = bbox.width/2/Math.sqrt(1 - y_over_B*y_over_B);
            fitx = rx*2 + chart.nodePadding();
            d.dcg_rx = Math.max(rx, r);
            d.dcg_ry = r;
            // needs extra width for polygons since they cut in a bit
            // not sure why something so simple works, i looked in graphviz:
            // https://github.com/ellson/graphviz/blob/master/lib/common/shapes.c#L1989
            if(d.dcg_shape.shape==='polygon')
                d.dcg_rx /= Math.cos(Math.PI/d.dcg_shape.sides);
        }
        else d.dcg_rx = d.dcg_ry = r;
        d.width = Math.max(fitx, rplus);
        d.height = rplus;
    };
}

function ellipse_attrs(chart, d) {
    return {
        rx: function(d) { return d.dcg_rx; },
        ry: function(d) { return d.dcg_ry; }
    };
}

function polygon_attrs(chart, d) {
    return {
        d: function(d) {
            var def = d.dcg_shape,
                sides = def.sides || 4,
                skew = def.skew || 0,
                distortion = def.distortion || 0,
                rotation = def.rotation || 0,
                align = (sides%2 ? 0 : 0.5), // even-sided horizontal top, odd pointy top
                pts = [];
            rotation = rotation/360 + 0.25; // start at y axis not x
            for(var i = 0; i<sides; ++i) {
                var theta = -((i+align)/sides + rotation)*Math.PI*2; // svg is up-negative
                var x = d.dcg_rx*Math.cos(theta),
                    y = d.dcg_ry*Math.sin(theta);
                x *= 1 + distortion*((d.dcg_ry-y)/d.dcg_ry - 1);
                x -= skew*y/2;
                pts.push(x, y);
            }
            d.dcg_points = pts;
            return generate_path(pts, 1, true);
        }
    };
}

function shape_attrs(chart) {
    return function(d) {
        var sel = d3.select(this);
        switch(d.dcg_shape.shape) {
        case 'ellipse':
            sel.attr(ellipse_attrs(chart, d));
            break;
        case 'polygon':
            sel.attr(polygon_attrs(chart, d));
            break;
        default: throw new Error('unknown shape ' + d.dcg_shape.shape);
        }
    };
}

function binary_search(f, a, b) {
    var patience = 100;
    if(f(a).val >= 0)
        throw new Error("f(a) must be less than 0");
    if(f(b).val <= 0)
        throw new Error("f(b) must be greater than 0");
    while(true) {
        if(!--patience)
            throw new Error("patience ran out");
        var c = (a+b)/2,
            f_c = f(c), fv = f_c.val;
        if(Math.abs(fv) < 0.5)
            return f_c;
        if(fv > 0)
            b = c;
        else
            a = c;
    }
}


function draw_edge_to_shapes(chart, source, target, sx, sy, tx, ty,
                             neighbor, offset, source_padding, target_padding) {
    var deltaX, deltaY,
        sourcePos, targetPos, sp, tp,
        retPath = {};
    if(!neighbor) {
        deltaX = tx - sx;
        deltaY = ty - sy;
        sp = point_on_shape(chart, source, deltaX, deltaY);
        tp = point_on_shape(chart, target, -deltaX, -deltaY);
        if(!sp) sp = {x: 0, y: 0};
        if(!tp) tp = {x: 0, y: 0};
        sourcePos = {
            x: sx + sp.x,
            y: sy + sp.y
        };
        targetPos = {
            x: tx + tp.x,
            y: ty + tp.y
        };
        retPath = generate_path([sourcePos.x, sourcePos.y, targetPos.x, targetPos.y], 1);
    }
    else {
        var srcang = Math.atan2(neighbor.sourcePos.x, neighbor.sourcePos.y),
            tarang = Math.atan2(neighbor.targetPos.x, neighbor.targetPos.y),
            dist = Math.hypot(tx - sx, ty - sy);
        function p_on_s(node, ang) {
            return point_on_shape(chart, node, Math.cos(ang)*dist, Math.sin(ang)*dist);
        }
        var port0s = p_on_s(source, srcang),
            port0t = p_on_s(target, tarang);
        function compare_dist(node, port0, goal) {
            return function(ang) {
                var port = p_on_s(node, ang);
                if(!port)
                    return {
                        port: {x: 0, y: 0},
                        val: 0,
                        ang: ang
                    };
                else
                    return {
                        port: port,
                        val: Math.hypot(port.x - port0.x, port.y - port0.y) - goal,
                        ang: ang
                    };
            };
        };
        var bss = binary_search(compare_dist(source, port0s, offset),
                                srcang, srcang + 2 * offset / source_padding),
            bst = binary_search(compare_dist(target, port0t, offset),
                                tarang, tarang - 2 * offset / source_padding);

        sp = bss.port;
        tp = bst.port;
        var sdist = Math.hypot(sp.x, sp.y),
            tdist = Math.hypot(tp.x, tp.y),
            c1dist = Math.max(sdist+source_padding/4, Math.min(sdist*2, dist/2)),
            c2dist = Math.min(tdist+target_padding/4, Math.min(tdist*2, dist/2));
        sourcePos = {
            x: sx + sp.x,
            y: sy + sp.y
        };
        var c1X = sx + c1dist * Math.cos(bss.ang),
            c1Y = sy + c1dist * Math.sin(bss.ang),
            c2X = tx + c2dist * Math.cos(bst.ang),
            c2Y = ty + c2dist * Math.sin(bst.ang);
        targetPos = {
            x: tx + tp.x,
            y: ty + tp.y
        };
        retPath = generate_path([sourcePos.x, sourcePos.y, c1X, c1Y, c2X, c2Y, targetPos.x, targetPos.y], 3);
    }
    return {
        sourcePos: sourcePos,
        targetPos: targetPos,
        length: Math.hypot(targetPos.x-sourcePos.x, targetPos.y-sourcePos.y),
        path: retPath
    };
}

