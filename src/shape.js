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

// as many as we can get from
// http://www.graphviz.org/doc/info/shapes.html
dc_graph.shape_presets = {
    egg: {
        // not really: an ovoid should be two half-ellipses stuck together
        // https://en.wikipedia.org/wiki/Oval
        generator: 'polygon',
        preset: function() {
            return {sides: 100, distortion: -0.25};
        }
    },
    triangle: {
        generator: 'polygon',
        preset: function() {
            return {sides: 3};
        }
    },
    rectangle: {
        generator: 'polygon',
        preset: function() {
            return {sides: 4};
        }
    },
    diamond: {
        generator: 'polygon',
        preset: function() {
            return {sides: 4, rotation: 45};
        }
    },
    trapezium: {
        generator: 'polygon',
        preset: function() {
            return {sides: 4, distortion: -0.5};
        }
    },
    parallelogram: {
        generator: 'polygon',
        preset: function() {
            return {sides: 4, skew: 0.5};
        }
    },
    pentagon: {
        generator: 'polygon',
        preset: function() {
            return {sides: 5};
        }
    },
    hexagon: {
        generator: 'polygon',
        preset: function() {
            return {sides: 6};
        }
    },
    septagon: {
        generator: 'polygon',
        preset: function() {
            return {sides: 7};
        }
    },
    octagon: {
        generator: 'polygon',
        preset: function() {
            return {sides: 8};
        }
    },
    invtriangle: {
        generator: 'polygon',
        preset: function() {
            return {sides: 3, rotation: 180};
        }
    },
    invtrapezium: {
        generator: 'polygon',
        preset: function() {
            return {sides: 4, distortion: 0.5};
        }
    },
    square: {
        generator: 'polygon',
        preset: function() {
            return {
                sides: 4,
                regular: true
            };
        }
    },
    plain: {
        generator: 'rounded-rect',
        preset: function() {
            return {
                noshape: true
            };
        }
    }
};

dc_graph.available_shapes = function() {
    var shapes = Object.keys(dc_graph.shape_presets);
    return shapes.slice(0, shapes.length-1); // not including polygon
};

var default_shape = {shape: 'ellipse'};

function elaborate_shape(diagram, def) {
    if(typeof def === 'string') def = {shape: def};
    var shape = def.shape, def2 = Object.assign({}, def);
    delete def2.shape;
    if(shape === 'random') {
        var available = dc_graph.available_shapes(); // could include diagram.shape !== ellipse, polygon
        shape = available[Math.floor(Math.random()*available.length)];
    }
    else if(diagram.shape.enum().indexOf(shape) !== -1)
        return diagram.shape(shape).elaborate({shape: shape}, def2);
    if(!dc_graph.shape_presets[shape]) {
        console.warn('unknown shape ', shape);
        return default_shape;
    }
    var preset = dc_graph.shape_presets[shape].preset(def2);
    preset.shape = dc_graph.shape_presets[shape].generator;
    return diagram.shape(preset.shape).elaborate(preset, def2);
}

function infer_shape(diagram) {
    return function(n) {
        var def = diagram.nodeShape.eval(n) || default_shape;
        n.dcg_shape = elaborate_shape(diagram, def);
        n.dcg_shape.abstract = def;
    };
}

function shape_changed(diagram) {
    return function(n) {
        var def = diagram.nodeShape.eval(n) || default_shape;
        var old = n.dcg_shape.abstract;
        if(def.shape !== old.shape)
            return true;
        else if(def.shape === 'polygon') {
            return def.shape.sides !== old.sides || def.shape.skew !== old.skew ||
                def.shape.distortion !== old.distortion || def.shape.rotation !== old.rotation;
        }
        else return false;
    };
}

function node_label_padding(diagram, n) {
    var nlp = diagram.nodeLabelPadding.eval(n);
    if(typeof nlp === 'number' || typeof nlp === 'string')
        return {x: +nlp, y: +nlp};
    else return nlp;
}

function fit_shape(shape, diagram) {
    return function(content) {
        content.each(function(n) {
            var bbox = null;
            if((!shape.useTextSize || shape.useTextSize(n.dcg_shape)) && diagram.nodeFitLabel.eval(n)) {
                bbox = getBBoxNoThrow(this);
                bbox = {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
                var padding;
                var content = diagram.nodeContent.eval(n);
                if(content && diagram.content(content).padding)
                    padding = diagram.content(content).padding(n);
                else {
                    var padding2 = node_label_padding(diagram, n);
                    padding = {
                        x: padding2.x*2,
                        y: padding2.y*2
                    };
                }
                bbox.width += padding.x;
                bbox.height += padding.y;
                n.bbox = bbox;
            }
            var r = 0, radii;
            if(!shape.useRadius || shape.useRadius(n.dcg_shape))
                r = diagram.nodeRadius.eval(n);
            if(bbox && bbox.width && bbox.height || shape.useTextSize && !shape.useTextSize(n.dcg_shape))
                radii = shape.calc_radii(n, r, bbox);
            else
                radii = {rx: r, ry: r};
            n.dcg_rx = radii.rx;
            n.dcg_ry = radii.ry;

            var w = radii.rx*2, h = radii.ry*2;
            // fixme: this is only consistent if regular || !squeeze
            // but we'd need to calculate polygon first in order to find out
            // (not a bad idea, just no time right now)
            if(w<h) w = h;

            if(!shape.usePaddingAndStroke || shape.usePaddingAndStroke(n.dcg_shape)) {
                var pands = diagram.nodePadding.eval(n) + diagram.nodeStrokeWidth.eval(n);
                w += pands;
                h += pands;
            }
            n.cola.width = w;
            n.cola.height = h;
        });
    };
}

function ellipse_attrs(diagram) {
    return {
        rx: function(n) { return n.dcg_rx; },
        ry: function(n) { return n.dcg_ry; }
    };
}

function polygon_attrs(diagram, n) {
    return {
        d: function(n) {
            var rx = n.dcg_rx, ry = n.dcg_ry,
                def = n.dcg_shape,
                sides = def.sides || 4,
                skew = def.skew || 0,
                distortion = def.distortion || 0,
                rotation = def.rotation || 0,
                align = (sides%2 ? 0 : 0.5), // even-sided horizontal top, odd pointy top
                angles = [];
            rotation = rotation/360 + 0.25; // start at y axis not x
            for(var i = 0; i<sides; ++i) {
                var theta = -((i+align)/sides + rotation)*Math.PI*2; // svg is up-negative
                angles.push({x: Math.cos(theta), y: Math.sin(theta)});
            }
            var yext = d3.extent(angles, function(theta) { return theta.y; });
            if(def.regular)
                rx = ry = Math.max(rx, ry);
            else if(rx < ry && !def.squeeze)
                rx = ry;
            else
                ry = ry / Math.min(-yext[0], yext[1]);
            n.dcg_points = angles.map(function(theta) {
                var x = rx*theta.x,
                    y = ry*theta.y;
                x *= 1 + distortion*((ry-y)/ry - 1);
                x -= skew*y/2;
                return {x: x, y: y};
            });
            return generate_path(n.dcg_points, 1, true);
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

function draw_edge_to_shapes(diagram, e, sx, sy, tx, ty,
                             neighbor, dir, offset, source_padding, target_padding) {
    var deltaX, deltaY,
        sp, tp, points, bezDegree,
        headAng, retPath;
    if(!neighbor) {
        sp = e.sourcePort.pos;
        tp = e.targetPort.pos;
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
            return diagram.shape(node.dcg_shape.shape).intersect_vec(node, Math.cos(ang)*1000, Math.sin(ang)*1000);
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
            tarang = Math.atan2(neighbor.targetPort.y, neighbor.targetPort.x);
        var bss, bst;

        // don't like this but throwing is unacceptable
        try {
            bss = binary_search(compare_dist(e.source, neighbor.sourcePort, offset),
                                srcang, srcang + 2 * dir * offset / source_padding);
        }
        catch(x) {
            bss = {ang: srcang, port: neighbor.sourcePort};
        }
        try {
            bst = binary_search(compare_dist(e.target, neighbor.targetPort, offset),
                                tarang, tarang - 2 * dir * offset / source_padding);
        }
        catch(x) {
            bst = {ang: tarang, port: neighbor.targetPort};
        }

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

function is_one_segment(path) {
    return path.bezDegree === 1 && path.points.length === 2 ||
        path.bezDegree === 3 && path.points.length === 4;
}

function as_bezier3(path) {
    var p = path.points;
    if(path.bezDegree === 3) return p;
    else if(path.bezDegree === 1)
        return [
            {
                x: p[0].x,
                y: p[0].y
            },
            {
                x: p[0].x + (p[1].x - p[0].x)/3,
                y: p[0].y + (p[1].y - p[0].y)/3
            },
            {
                x: p[0].x + 2*(p[1].x - p[0].x)/3,
                y: p[0].y + 2*(p[1].y - p[0].y)/3
            },
            {
                x: p[1].x,
                y: p[1].y
            }
        ];
    else throw new Error('unknown bezDegree ' + path.bezDegree);
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

// from https://stackoverflow.com/questions/8369488/splitting-a-bezier-curve#8405756
// somewhat redundant with the above but different objective
function split_bezier(p, t) {
    var x1 = p[0].x, y1 = p[0].y,
        x2 = p[1].x, y2 = p[1].y,
        x3 = p[2].x, y3 = p[2].y,
        x4 = p[3].x, y4 = p[3].y,

        x12 = (x2-x1)*t+x1,
        y12 = (y2-y1)*t+y1,

        x23 = (x3-x2)*t+x2,
        y23 = (y3-y2)*t+y2,

        x34 = (x4-x3)*t+x3,
        y34 = (y4-y3)*t+y3,

        x123 = (x23-x12)*t+x12,
        y123 = (y23-y12)*t+y12,

        x234 = (x34-x23)*t+x23,
        y234 = (y34-y23)*t+y23,

        x1234 = (x234-x123)*t+x123,
        y1234 = (y234-y123)*t+y123;

    return [
        [{x: x1, y: y1}, {x: x12, y: y12}, {x: x123, y: y123}, {x: x1234, y: y1234}],
        [{x: x1234, y: y1234}, {x: x234, y: y234}, {x: x34, y: y34}, {x: x4, y: y4}]
    ];
}
function split_bezier_n(p, n) {
    var ret = [];
    while(n > 1) {
        var parts = split_bezier(p, 1/n);
        ret.push(parts[0][0], parts[0][1], parts[0][2]);
        p = parts[1];
        --n;
    }
    ret.push.apply(ret, p);
    return ret;
}

dc_graph.no_shape = function() {
    var _shape = {
        parent: property(null),
        elaborate: function(preset, def) {
            return Object.assign(preset, def);
        },
        useTextSize: function() { return false; },
        useRadius: function() { return false; },
        usePaddingAndStroke: function() { return false; },
        intersect_vec: function(n, deltaX, deltaY) {
            return {x: 0, y: 0};
        },
        calc_radii: function(n, ry, bbox) {
            return {rx: 0, ry: 0};
        },
        create: function(nodeEnter) {
        },
        replace: function(nodeChanged) {
        },
        update: function(node) {
        }
    };
    return _shape;
};

dc_graph.ellipse_shape = function() {
    var _shape = {
        parent: property(null),
        elaborate: function(preset, def) {
            return Object.assign(preset, def);
        },
        intersect_vec: function(n, deltaX, deltaY) {
            return point_on_ellipse(n.dcg_rx, n.dcg_ry, deltaX, deltaY);
        },
        calc_radii: function(n, ry, bbox) {
            // make sure we can fit height in r
            ry = Math.max(ry, bbox.height/2 + 5);
            var rx = bbox.width/2;

            // solve (x/A)^2 + (y/B)^2) = 1 for A, with B=r, to fit text in ellipse
            // http://stackoverflow.com/a/433438/676195
            var y_over_B = bbox.height/2/ry;
            rx = rx/Math.sqrt(1 - y_over_B*y_over_B);
            rx = Math.max(rx, ry);

            return {rx: rx, ry: ry};
        },
        create: function(nodeEnter) {
            nodeEnter.insert('ellipse', ':first-child')
                .attr('class', 'node-shape');
        },
        update: function(node) {
            node.select('ellipse.node-shape')
                .attr(ellipse_attrs(_shape.parent()));
        }
    };
    return _shape;
};

dc_graph.polygon_shape = function() {
    var _shape = {
        parent: property(null),
        elaborate: function(preset, def) {
            return Object.assign(preset, def);
        },
        intersect_vec: function(n, deltaX, deltaY) {
            return point_on_polygon(n.dcg_points, 0, 0, deltaX, deltaY);
        },
        calc_radii: function(n, ry, bbox) {
            // make sure we can fit height in r
            ry = Math.max(ry, bbox.height/2 + 5);
            var rx = bbox.width/2;

            // this is cribbed from graphviz but there is much i don't understand
            // and any errors are mine
            // https://github.com/ellson/graphviz/blob/6acd566eab716c899ef3c4ddc87eceb9b428b627/lib/common/shapes.c#L1996
            rx = rx*Math.sqrt(2)/Math.cos(Math.PI/(n.dcg_shape.sides||4));

            return {rx: rx, ry: ry};
        },
        create: function(nodeEnter) {
            nodeEnter.insert('path', ':first-child')
                .attr('class', 'node-shape');
        },
        update: function(node) {
            node.select('path.node-shape')
                .attr(polygon_attrs(_shape.parent()));
        }
    };
    return _shape;
};

dc_graph.rounded_rectangle_shape = function() {
    var _shape = {
        parent: property(null),
        elaborate: function(preset, def) {
            preset = Object.assign({rx: 10, ry: 10}, preset);
            return Object.assign(preset, def);
        },
        intersect_vec: function(n, deltaX, deltaY) {
            var points = [
                {x:  n.dcg_rx, y:  n.dcg_ry},
                {x:  n.dcg_rx, y: -n.dcg_ry},
                {x: -n.dcg_rx, y: -n.dcg_ry},
                {x: -n.dcg_rx, y:  n.dcg_ry}
            ];
            return point_on_polygon(points, 0, 0, deltaX, deltaY); // not rounded
        },
        useRadius: function(shape) {
            return !shape.noshape;
        },
        calc_radii: function(n, ry, bbox) {
            var fity = bbox.height/2;
            // fixme: fudge to make sure text is not too tall for node
            if(!n.dcg_shape.noshape)
                fity += 5;
            return {
                rx: bbox.width / 2,
                ry: Math.max(ry, fity)
            };
        },
        create: function(nodeEnter) {
            nodeEnter.filter(function(n) {
                return !n.dcg_shape.noshape;
            }).insert('rect', ':first-child')
                .attr('class', 'node-shape');
        },
        update: function(node) {
            node.select('rect.node-shape')
                .attr({
                    x: function(n) {
                        return -n.dcg_rx;
                    },
                    y: function(n) {
                        return -n.dcg_ry;
                    },
                    width: function(n) {
                        return 2*n.dcg_rx;
                    },
                    height: function(n) {
                        return 2*n.dcg_ry;
                    },
                    rx: function(n) {
                        return n.dcg_shape.rx + 'px';
                    },
                    ry: function(n) {
                        return n.dcg_shape.ry + 'px';
                    }
                });
        }
    };
    return _shape;
};

