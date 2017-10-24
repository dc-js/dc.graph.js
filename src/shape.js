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
            return {sides: 4};
        }
    }
};

dc_graph.available_shapes = function() {
    var shapes = Object.keys(dc_graph_shapes_);
    return shapes.slice(0, shapes.length-1); // not including polygon
};

var default_shape = {shape: 'ellipse'};

function elaborate_shape(chart, def) {
    var shape = def.shape, def2 = Object.assign({}, def);
    delete def2.shape;
    if(shape === 'random') {
        var available = dc_graph.available_shapes(); // could include chart.shape !== ellipse, polygon
        shape = available[Math.floor(Math.random()*available.length)];
    }
    else if(chart.shape.enum().indexOf(shape) !== -1)
        return chart.shape(shape).elaborate({shape: shape}, def2);
    if(!dc_graph.shape_presets[shape]) {
        console.warn('unknown shape ', shape);
        shape = 'rectangle';
    }
    var preset = dc_graph.shape_presets[shape].preset(def2);
    preset.shape = dc_graph.shape_presets[shape].generator;
    return chart.shape(preset.shape).elaborate(preset, def2);
}

function infer_shape(chart) {
    return function(d) {
        var def = chart.nodeShape.eval(d) || default_shape;
        d.dcg_shape = elaborate_shape(chart, def);
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

function fit_shape(shape, chart) {
    return function(text) {
        text.each(function(d) {
            var bbox;
            if(chart.nodeFitLabel.eval(d)) {
                bbox = this.getBBox();
                var padding;
                var content = chart.nodeContent.eval(d);
                if(content && chart.content(content).padding)
                    padding = chart.content(content).padding(d);
                else {
                    var padding2 = chart.nodeLabelPadding.eval(d);
                    padding = {
                        x: padding2.x*2,
                        y: padding2.y*2
                    };
                }
                bbox.width += padding.x;
                bbox.height += padding.y;
            }
            var fitx = 0;
            if(bbox && bbox.width && bbox.height) {
                var r = chart.nodeRadius.eval(d);
                var radii = shape.calc_radii(d, r, bbox);
                d.dcg_rx = radii.rx;
                d.dcg_ry = radii.ry;
                fitx = radii.rx*2 + chart.nodePadding.eval(d) + chart.nodeStrokeWidth.eval(d);
            } else
                d.dcg_rx = d.dcg_ry = chart.nodeRadius.eval(d);
            var rplus = d.dcg_ry*2 + chart.nodePadding.eval(d) + chart.nodeStrokeWidth.eval(d);
            d.cola.width = Math.max(fitx, rplus);
            d.cola.height = rplus;
        });
    };
}

function ellipse_attrs(chart) {
    return {
        rx: function(d) { return d.dcg_rx; },
        ry: function(d) { return d.dcg_ry; }
    };
}

function polygon_attrs(chart, d) {
    return {
        d: function(d) {
            var rx = d.dcg_rx, ry = d.dcg_ry,
                def = d.dcg_shape,
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
            else
                ry = ry / Math.min(-yext[0], yext[1]);
            d.dcg_points = angles.map(function(theta) {
                var x = rx*theta.x,
                    y = ry*theta.y;
                x *= 1 + distortion*((ry-y)/ry - 1);
                x -= skew*y/2;
                return {x: x, y: y};
            });
            return generate_path(d.dcg_points, 1, true);
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

function draw_edge_to_shapes(chart, e, sx, sy, tx, ty,
                             neighbor, dir, offset, source_padding, target_padding) {
    var deltaX, deltaY,
        sp, tp, points, bezDegree,
        headAng, retPath;
    if(!neighbor) {
        sp = e.sourcePort.pos;
        tp = e.targetPort.pos;
        console.assert(sp);
        console.assert(tp);
        // deltaX = tx - sx;
        // deltaY = ty - sy;
        // sp = chart.shape(e.source.dcg_shape.shape).intersect_vec(e.source, deltaX, deltaY);
        // tp = chart.shape(e.target.dcg_shape.shape).intersect_vec(e.target, -deltaX, -deltaY);
        // if(!sp) sp = {x: 0, y: 0};
        // if(!tp) tp = {x: 0, y: 0};
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
            return chart.shape(node.dcg_shape.shape).intersect_vec(node, Math.cos(ang)*1000, Math.sin(ang)*1000);
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

dc_graph.ellipse_shape = function() {
    var _shape = {
        parent: property(null),
        elaborate: function(preset, def) {
            return Object.assign(preset, def);
        },
        intersect_vec: function(d, deltaX, deltaY) {
            return point_on_ellipse(d.dcg_rx, d.dcg_ry, deltaX, deltaY);
        },
        calc_radii: function(d, ry, bbox) {
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
            nodeEnter.append('ellipse')
                .attr('class', 'node-shape');
        },
        replace: function(nodeChanged) {
            nodeChanged.select('ellipse.node-shape').remove();
            nodeChanged.insert('ellipse', ':first-child')
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
        intersect_vec: function(d, deltaX, deltaY) {
            return point_on_polygon(d.dcg_points, 0, 0, deltaX, deltaY);
        },
        calc_radii: function(d, ry, bbox) {
            // make sure we can fit height in r
            ry = Math.max(ry, bbox.height/2 + 5);
            var rx = bbox.width/2;

            // this is cribbed from graphviz but there is much i don't understand
            // and any errors are mine
            // https://github.com/ellson/graphviz/blob/6acd566eab716c899ef3c4ddc87eceb9b428b627/lib/common/shapes.c#L1996
            rx = rx*Math.sqrt(2)/Math.cos(Math.PI/(d.dcg_shape.sides||4));

            return {rx: rx, ry: ry};
        },
        create: function(nodeEnter) {
            nodeEnter.append('path')
                .attr('class', 'node-shape');
        },
        replace: function(nodeChanged) {
            nodeChanged.select('path.node-shape').remove();
            nodeChanged.insert('path', ':first-child')
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
    var _polygon = dc_graph.polygon_shape();
    var _shape = {
        parent: property(null),
        elaborate: function(preset, def) {
            preset = Object.assign({rx: 10, ry: 10}, preset);
            return Object.assign(preset, def);
        },
        intersect_vec: function(d, deltaX, deltaY) {
            var points = [
                {x:  d.dcg_rx, y:  d.dcg_ry},
                {x:  d.dcg_rx, y: -d.dcg_ry},
                {x: -d.dcg_rx, y: -d.dcg_ry},
                {x: -d.dcg_rx, y:  d.dcg_ry}
            ];
            return point_on_polygon(points, 0, 0, deltaX, deltaY); // not rounded
        },
        calc_radii: function(d, ry, bbox) {
            // use default sides === 4, smelly
            // _polygon.calc_radii(d, ry, bbox);
            return {
                rx: bbox.width / 2,
                ry: Math.max(ry, bbox.height/2 + 5)
            };
        },
        create: function(nodeEnter) {
            nodeEnter.append('rect')
                .attr('class', 'node-shape');
        },
        replace: function(nodeChanged) {
            nodeChanged.select('rect.node-shape').remove();
            nodeChanged.insert('rect', ':first-child')
                .attr('class', 'node-shape');
        },
        update: function(node) {
            node.select('rect.node-shape')
                .attr({
                    x: function(d) {
                        return -d.dcg_rx;
                    },
                    y: function(d) {
                        return -d.dcg_ry;
                    },
                    width: function(d) {
                        return 2*d.dcg_rx;
                    },
                    height: function(d) {
                        return 2*d.dcg_ry;
                    },
                    rx: function(d) {
                        return d.dcg_shape.rx + 'px';
                    },
                    ry: function(d) {
                        return d.dcg_shape.ry + 'px';
                    }
                });
        }
    };
    return _shape;
};

