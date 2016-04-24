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
    for(var i = 0; i < points.length; ++i) {
        var next = i===points.length-1 ? 0 : i+1;
        var isect = segment_intersection(points[i].x, points[i].y, points[next].x, points[next].y,
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
        return point_on_polygon(d.dcg_points, 0, 0, deltaX, deltaY);
    }
}

// as many as we can get from
// http://www.graphviz.org/doc/info/shapes.html
var dc_graph_shapes_ = {
    ellipse: function() {
        return {shape: 'ellipse'};
    },
    egg: function() {
        return {shape: 'polygon', sides: 100, distortion: -0.25};
    },
    triangle: function() {
        return {shape: 'polygon', sides: 3};
    },
    diamond: function() {
        return {shape: 'polygon', sides: 4, rotation: 45};
    },
    trapezium: function() {
        return {shape: 'polygon', sides: 4, distortion: -0.5};
    },
    parallelogram: function() {
        return {shape: 'polygon', sides: 4, skew: 0.5};
    },
    pentagon: function() {
        return {shape: 'polygon', sides: 5};
    },
    hexagon: function() {
        return {shape: 'polygon', sides: 6};
    },
    septagon: function() {
        return {shape: 'polygon', sides: 7};
    },
    octagon: function() {
        return {shape: 'polygon', sides: 8};
    },
    invtriangle: function() {
        return {shape: 'polygon', sides: 3, rotation: 180};
    },
    invtrapezium: function() {
        return {shape: 'polygon', sides: 4, distortion: 0.5};
    },
    square: function() {
        return {shape: 'polygon', sides: 4};
    },
    polygon: function(def) {
        return {
            shape: 'polygon',
            sides: def.sides,
            skew: def.skew,
            distortion: def.distortion,
            rotation: def.rotation
        };
    }
};

var default_shape = {shape: 'ellipse'};

function elaborate_shape(def) {
    var shape = def.shape;
    if(def.shape === 'random') {
        var keys = Object.keys(dc_graph_shapes_);
        shape = def._shape = keys[Math.floor(Math.random()*keys.length)];
    }
    return (dc_graph_shapes_[shape] || function() {
        throw new Error('unknown shape ' + def.shape);
    })(def);
}

function infer_shape(chart) {
    return function(d) {
        var def = chart.nodeShape.eval(d) || default_shape;
        d.dcg_shape = elaborate_shape(def);
        d.dcg_shape.abstract = def;
    };
}

function shape_changed(chart) {
    return function(d) {
        var def = chart.nodeShape.eval(d) || default_shape;
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
        var r = chart.nodeRadius.eval(d);
        var rplus = r*2 + chart.nodePadding();
        var bbox;
        if(chart.nodeFitLabel.eval(d))
            bbox = this.getBBox();
        var fitx = 0;
        if(bbox && bbox.width && bbox.height) {
            // make sure we can fit height in r
            r = Math.max(r, bbox.height/2 + 5);
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
                d.dcg_rx /= Math.cos(Math.PI/(d.dcg_shape.sides||4));
        }
        else d.dcg_rx = d.dcg_ry = r;
        d.cola.width = Math.max(fitx, rplus);
        d.cola.height = rplus;
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
                pts.push({x: x, y: y});
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
                             neighbor, dir, offset, source_padding, target_padding) {
    var deltaX, deltaY,
        sp, tp, points, bezDegree,
        headAng, retPath;
    if(!neighbor) {
        deltaX = tx - sx;
        deltaY = ty - sy;
        sp = point_on_shape(chart, source, deltaX, deltaY);
        tp = point_on_shape(chart, target, -deltaX, -deltaY);
        if(!sp) sp = {x: 0, y: 0};
        if(!tp) tp = {x: 0, y: 0};
        points = [{
            x: sx + sp.x,
            y: sy + sp.y
        }, {
            x: tx + tp.x,
            y: ty + tp.y
        }];
        bezDegree = 1;
    }
    else {
        var p_on_s = function(node, ang) {
            return point_on_shape(chart, node, Math.cos(ang)*1000, Math.sin(ang)*1000);
        };
        var compare_dist = function(node, port0, goal) {
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
        var srcang = Math.atan2(neighbor.sourcePort.y, neighbor.sourcePort.x),
            tarang = Math.atan2(neighbor.targetPort.y, neighbor.targetPort.x),
            bss, bst;
        if(chart.nodeRadius.eval(source) > 2) {
            bss = binary_search(compare_dist(source, neighbor.sourcePort, offset),
                                srcang, srcang + 2 * dir * offset / source_padding);
        }
        else bss = {ang: srcang, port: {x: 0, y: 0}};
        if(chart.nodeRadius.eval(target) > 2) {
            bst = binary_search(compare_dist(target, neighbor.targetPort, offset),
                                tarang, tarang - 2 * dir * offset / source_padding);
        }
        else bst = {ang: tarang, port: {x: 0, y: 0}};

        sp = bss.port;
        tp = bst.port;

        var sdist = Math.hypot(sp.x, sp.y),
            tdist = Math.hypot(tp.x, tp.y),
            c1dist = sdist+source_padding/2,
            c2dist = tdist+target_padding/2;
        var c1X = sx + c1dist * Math.cos(bss.ang),
            c1Y = sy + c1dist * Math.sin(bss.ang),
            c2X = tx + c2dist * Math.cos(bst.ang),
            c2Y = ty + c2dist * Math.sin(bst.ang);
        points = [
            {x: sx + sp.x, y: sy + sp.y},
            {x: c1X, y: c1Y},
            {x: c2X, y: c2Y},
            {x: tx + tp.x, y: ty + tp.y}
        ];
        bezDegree = 3;
    }
    return {
        sourcePort: sp,
        targetPort: tp,
        points: points,
        bezDegree: bezDegree
    };
}


// from https://www.jasondavies.com/animated-bezier/
function interpolate(d, p) {
    var r = [];
    for (var i=1; i<d.length; i++) {
        var d0 = d[i-1], d1 = d[i];
        r.push({x: d0.x + (d1.x - d0.x) * p, y: d0.y + (d1.y - d0.y) * p});
    }
    return r;
}

function getLevels(points, t_) {
    var x = [points];
    for (var i=1; i<points.length; i++) {
        x.push(interpolate(x[x.length-1], t_));
    }
    return x;
}

// get a point on a bezier segment, where 0 <= t <= 1
function bezier_point(points, t_) {
    var q = getLevels(points, t_);
    return q[q.length-1][0];
}
