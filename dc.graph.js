/*!
 *  dc.graph 0.3.16
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2016 AT&T Intellectual Property & the dc.graph.js Developers
 *  https://github.com/dc-js/dc.graph.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */
(function() { function _dc_graph(d3, crossfilter, dc) {
'use strict';

/**
 * The entire dc.graph.js library is scoped under the **dc_graph** name space. It does not introduce
 * anything else into the global name space.
 *
 * Like in dc.js and most libraries built on d3, most `dc_graph` functions are designed to allow function chaining, meaning they return the current chart
 * instance whenever it is appropriate.  The getter forms of functions do not participate in function
 * chaining because they return values that are not the chart.
 * @namespace dc_graph
 * @version 0.3.16
 * @example
 * // Example chaining
 * chart.width(600)
 *      .height(400)
 *      .nodeDimension(nodeDim)
 *      .nodeGroup(nodeGroup);
 */

var dc_graph = {
    version: '0.3.16',
    constants: {
        CHART_CLASS: 'dc-graph'
    }
};

var property = function (defaultValue, unwrap) {
    if(unwrap === undefined)
        unwrap = get_original;
    else if(unwrap === false)
        unwrap = identity;
    var value = defaultValue, react = null;
    var cascade = [];
    var ret = function (_) {
        if (!arguments.length) {
            return value;
        }
        if(react)
            react(_);
        value = _;
        return this;
    };
    ret.cascade = function (n, f) {
        for(var i = 0; i<cascade.length; ++i) {
            if(cascade[i].n === n) {
                if(f)
                    cascade[i].f = f;
                else delete cascade[i];
                return ret;
            } else if(cascade[i].n > n) {
                cascade.splice(i, 0, {n: n, f: f});
                return ret;
            }
        }
        cascade.push({n: n, f: f});
        return ret;
    };
    ret._eval = function(o, n) {
        if(n===0 || !cascade.length)
            return dc_graph.functor_wrap(ret(), unwrap)(o);
        else {
            var last = cascade[n-1];
            return last.f(o, function() {
                return ret._eval(o, n-1);
            });
        }
    };
    ret.eval = function(o) {
        return ret._eval(o, cascade.length);
    };
    ret.react = function(_) {
        if (!arguments.length) {
            return react;
        }
        react = _;
        return this;
    };
    return ret;
};

// i'm sure there's a word for this in haskell
function conditional_properties(npred, epred, props) {
    function _if(pred, curr) {
        return function(o, last) {
            return pred(o) ? curr(o) : last();
        };
    }
    var props2 = {};
    for(var p in props) {
        if(/^node/.test(p)) {
            if(npred)
                props2[p] = _if(npred, param(props[p]));
        }
        else if(/^edge/.test(p)) {
            if(epred)
                props2[p] = _if(epred, param(props[p]));
        }
        else console.error('only know how to deal with properties that start with "node" or "edge"');
    }
    return props2;
}

var identity = function(x) { return x; };
function compose(f, g) {
    return function() {
        return f(g.apply(null, arguments));
    };
}

// version of d3.functor that optionally wraps the function with another
// one, if the parameter is a function
dc_graph.functor_wrap = function (v, wrap) {
    if(typeof v === "function") {
        return wrap ? function(x) {
            return v(wrap(x));
        } : v;
    }
    else return function() {
        return v;
    };
};

function get_original(x) {
    return x.orig;
}

// we want to allow either values or functions to be passed to specify parameters.
// if a function, the function needs a preprocessor to extract the original key/value
// pair from the wrapper object we put it in.
function param(v) {
    return dc_graph.functor_wrap(v, get_original);
}

// http://jsperf.com/cloning-an-object/101
function clone(obj) {
    var target = {};
    for(var i in obj) {
        if(obj.hasOwnProperty(i)) {
            target[i] = obj[i];
        }
    }
    return target;
}

// http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

// because i don't think we need to bind edge point data (yet!)
var bez_cmds = {
    1: 'L', 2: 'Q', 3: 'C'
};

function generate_path(pts, bezDegree, close) {
    var cats = ['M', pts[0].x, ',', pts[0].y], remain = bezDegree;
    var hasNaN = false;
    for(var i = 1; i < pts.length; ++i) {
        if(isNaN(pts[i].x) || isNaN(pts[i].y))
            hasNaN = true;
        cats.push(remain===bezDegree ? bez_cmds[bezDegree] : ' ', pts[i].x, ',', pts[i].y);
        if(--remain===0)
            remain = bezDegree;
    }
    if(remain!=bezDegree)
        console.log("warning: pts.length didn't match bezian degree", pts, bezDegree);
    if(close)
        cats.push('Z');
    return cats.join('');
}

// for IE (do we care really?)
Math.hypot = Math.hypot || function() {
  var y = 0;
  var length = arguments.length;

  for (var i = 0; i < length; i++) {
    if (arguments[i] === Infinity || arguments[i] === -Infinity) {
      return Infinity;
    }
    y += arguments[i] * arguments[i];
  }
  return Math.sqrt(y);
};

// arguably depth first search is a stupid algorithm to modularize -
// there are many, many interesting moments to insert a behavior
// and those end up being almost bigger than the function itself

// this is an argument for providing a graph API which could make it
// easy to just write a recursive function instead of using this
dc_graph.depth_first_traversal = function(callbacks) { // {init, root, row, tree, place, sib, push, pop, skip, finish}
    return function(diagram, nodes, edges) {
        callbacks.init && callbacks.init();
        if(callbacks.tree)
            edges = edges.filter(function(e) { return callbacks.tree(e.orig); });
        var indegree = {};
        var outmap = edges.reduce(function(m, e) {
            var tail = diagram.edgeSource.eval(e),
                head = diagram.edgeTarget.eval(e);
            if(!m[tail]) m[tail] = [];
            m[tail].push(e);
            indegree[head] = (indegree[head] || 0) + 1;
            return m;
        }, {});

        var rows = [];
        var placed = {};
        function place_tree(n, r) {
            var key = diagram.nodeKey.eval(n);
            if(placed[key]) {
                callbacks.skip && callbacks.skip(n, indegree[key]);
                return;
            }
            if(!rows[r])
                rows[r] = [];
            callbacks.place && callbacks.place(n, r, rows[r]);
            rows[r].push(n);
            placed[key] = true;
            if(outmap[key])
                outmap[key].forEach(function(e, ei) {
                    if(ei && callbacks.sib)
                        callbacks.sib(false, outmap[key][ei-1].target, e.target);
                    callbacks.push && callbacks.push();
                    place_tree(e.target, r+1);
                });
            callbacks.pop && callbacks.pop(n);
        }

        var roots;
        if(callbacks.root)
            roots = nodes.filter(function(n) { return callbacks.root(n.orig); });
        else {
            roots = nodes.filter(function(n) { return !indegree[diagram.nodeKey.eval(n)]; });
        }
        roots.forEach(function(n, ni) {
            if(ni && callbacks.sib)
                callbacks.sib(true, roots[ni-1], n);
            callbacks.push && callbacks.push();
            place_tree(n, callbacks.row ? callbacks.row(n.orig) : 0);
        });
        callbacks.finish(rows);
    };
};

// create or re-use objects in a map, delete the ones that were not reused
function regenerate_objects(preserved, list, key, assign, create, destroy) {
    if(!create) create = function(k, o) { };
    if(!destroy) destroy = function(k) { };
    var keep = {};
    function wrap(o) {
        var k = key(o);
        if(!preserved[k])
            create(k, preserved[k] = {}, o);
        var o1 = preserved[k];
        assign(o1, o);
        keep[k] = true;
        return o1;
    }
    var wlist = list.map(wrap);
    // delete any objects from last round that are no longer used
    for(var k in preserved)
        if(!keep[k]) {
            destroy(k, preserved[k]);
            delete preserved[k];
        }
    return wlist;
}

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
    rectangle: function() {
        return {shape: 'polygon', sides: 4};
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

dc_graph.available_shapes = function() {
    var shapes = Object.keys(dc_graph_shapes_);
    return shapes.slice(0, shapes.length-1);
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
        var bbox;
        if(chart.nodeFitLabel.eval(d))
            bbox = this.getBBox();
        var fitx = 0;
        if(bbox && bbox.width && bbox.height) {
            // make sure we can fit height in r
            r = Math.max(r, bbox.height/2 + 5);
            var rx;
            if(d.dcg_shape.shape === 'ellipse') {
                // solve (x/A)^2 + (y/B)^2) = 1 for A, with B=r, to fit text in ellipse
                // http://stackoverflow.com/a/433438/676195
                var y_over_B = bbox.height/2/r;
                rx = bbox.width/2/Math.sqrt(1 - y_over_B*y_over_B);
                d.dcg_rx = Math.max(rx, r);
                d.dcg_ry = r;
            } else {
                rx = bbox.width/2;
                // this is cribbed from graphviz but there is much i don't understand
                // and any errors are mine
                // https://github.com/ellson/graphviz/blob/6acd566eab716c899ef3c4ddc87eceb9b428b627/lib/common/shapes.c#L1996
                d.dcg_rx = rx*Math.sqrt(2)/Math.cos(Math.PI/(d.dcg_shape.sides||4));
                d.dcg_ry = r;
            }
            fitx = rx*2 + chart.nodePadding.eval(d) + chart.nodeStrokeWidth.eval(d);
        }
        else d.dcg_rx = d.dcg_ry = r;
        var rplus = r*2 + chart.nodePadding.eval(d) + chart.nodeStrokeWidth.eval(d);
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
                angles = [];
            rotation = rotation/360 + 0.25; // start at y axis not x
            for(var i = 0; i<sides; ++i) {
                var theta = -((i+align)/sides + rotation)*Math.PI*2; // svg is up-negative
                angles.push({x: Math.cos(theta), y: Math.sin(theta)});
            }
            var yext = d3.extent(angles, function(theta) { return theta.y; });
            var rx = d.dcg_rx,
                ry = d.dcg_ry / Math.min(-yext[0], yext[1]);
            d.dcg_points = angles.map(function(theta) {
                var x = rx*theta.x,
                    y = ry*theta.y;
                x *= 1 + distortion*((d.dcg_ry-y)/d.dcg_ry - 1);
                x -= skew*y/2;
                return {x: x, y: y};
            });
            return generate_path(d.dcg_points, 1, true);
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
            tarang = Math.atan2(neighbor.targetPort.y, neighbor.targetPort.x);
        var bss, bst;

        // don't like this but throwing is unacceptable
        try {
            bss = binary_search(compare_dist(source, neighbor.sourcePort, offset),
                                srcang, srcang + 2 * dir * offset / source_padding);
        }
        catch(x) {
            bss = {ang: srcang, port: neighbor.sourcePort};
        }
        try {
            bst = binary_search(compare_dist(target, neighbor.targetPort, offset),
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

/**
 * `dc_graph.diagram` is a dc.js-compatible network visualization component. It registers in
 * the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
 * logically derives from the dc.js
 * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin},
 * but it does not physically derive from it since so much is different about network
 * visualization versus conventional charts.
 * @name diagram
 * @memberof dc_graph
 * @param {String|node} parent - Any valid
 * {@link https://github.com/mbostock/d3/wiki/Selections#selecting-elements d3 single selector}
 * specifying a dom block element such as a div; or a dom element.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed
 * in. Filter interaction with a chart will only trigger events and redraws within the
 * chart's group.
 * @return {dc_graph.diagram}
 **/
dc_graph.diagram = function (parent, chartGroup) {
    // different enough from regular dc charts that we don't use bases
    var _chart = dc.marginMixin({});
    var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _worker = null;
    var _dispatch = d3.dispatch('end', 'start', 'drawn');
    var _nodes = {}, _edges = {}; // hold state between runs
    var _stats = {};
    var _nodes_snapshot, _edges_snapshot;
    var _children = {}, _arrows = {};
    var _running = false; // for detecting concurrency issues
    var _translate = [0,0], _scale = 1;
    var _zoom, _xScale, _yScale;
    var _anchor, _chartGroup;

    /**
     * Set or get the width attribute of the diagram. See `.height` below.
     * @name width
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [width=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.width = property(200).react(function(w) {
        resizeSvg(w,0);
    });

    /**
     * Set or get the height attribute of the diagram. The width and height are applied to the
     * SVG element generated by the diagram when rendered. If a value is given, then the
     * diagram is returned for method chaining. If no value is given, then the current value of
     * the height attribute will be returned. Default: 200
     * @name height
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [height=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.height = property(200).react(function(h) {
        resizeSvg(0,h);
    });

    /**
     * Get or set the root element, which is usually the parent div. Normally the root is set
     * when the diagram is constructed; setting it later may have unexpected consequences.
     * @name root
     * @memberof dc_graph.diagram
     * @instance
     * @param {node} [root]
     * @return {node}
     * @return {dc_graph.diagram}
     **/
    _chart.root = property(null).react(function(e) {
        if(e.empty())
            console.log('Warning: parent selector ' + parent + " doesn't seem to exist");
    });

    /**
     * Get or set whether mouse wheel rotation or touchpad gestures will zoom the diagram, and
     * whether dragging on the background pans the diagram.
     * @name mouseZoomable
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [mouseZoomable=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.mouseZoomable = property(true);

    /**
     * Set or get the fitting strategy for the canvas, which affects how the
     * [viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox) and
     * [preserveAspectRatio](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/preserveAspectRatio)
     * attributes get set. All options except `null` set the `viewBox` attribute.
     *
     * These options set the `viewBox` and adjust the scale and translate to implement the margins.
     * * `'default'` - uses the default behavior of `xMidYMid meet` (but with margins)
     * * `'vertical'` - fits the canvas vertically (with vertical margins) and centers it
     * horizontally. If the canvas is taller than the viewport, it will meet vertically and
     * there will be blank areas to the left and right. If the canvas is wider than the
     * viewport, it will be sliced.
     * * `'horizontal'` - fitst the canvas horizontally (with horizontal margins) and centers
     * it vertically. If the canvas is wider than the viewport, it will meet horizontally and
     * there will be blank areas above and below. If the canvas is taller than the viewport, it
     * will be sliced.
     *
     * Other options
     * * `null` - no attempt is made to fit the canvas to the svg element, `viewBox` is unset.
     * * another string - sets the `viewBox` and uses the string for `preserveAspectRatio`.
     * * function - will be called with (viewport width, viewport height, canvas width, canvas
     * height) and result will be used to set `preserveAspectRatio`.
     * @name fitStrategy
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [fitStrategy='default']
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _chart.fitStrategy = property('default');

    /**
     * Do not allow panning (scrolling) to push the diagram out of the viewable area, if there
     * is space for it to be shown. */
    _chart.restrictPan = property(false);

    /**
     * Auto-zoom behavior.
     * * `'always'` - zoom every time layout happens
     * * `'once'` - zoom the first time layout happens
     * * `null` - manual, call `zoomToFit` to fit
     * @name autoZoom
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [autoZoom=null]
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _chart.autoZoom = property(null);
    _chart.zoomToFit = function() {
        if(!(_nodeLayer && _edgeLayer))
            return;
        var node = _nodeLayer.selectAll('.node'),
            edge = _edgeLayer.selectAll('.edge');
        auto_zoom(node, edge);
    };

    /**
     * Set or get the crossfilter dimension which represents the nodes (vertices) in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.

     * *The node dimension currently does nothing, but once selection is supported, it will be
     * used for filtering other charts on the same crossfilter instance based on the nodes
     * selected.*
     * @name nodeDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [nodeDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeDimension = property();

    /**
     * Set or get the crossfilter group which is the data source for the nodes in the
     * diagram. The diagram will use the group's `.all()` method to get an array of `{key,
     * value}` pairs, where the key is a unique identifier, and the value is usually an object
     * containing the node's attributes. All accessors work with these key/value pairs.

     * If the group is changed or returns different values, the next call to `.redraw()` will
     * reflect the changes incrementally.

     * It is possible to pass another object with the same `.all()` interface instead of a
     * crossfilter group.
     * @name nodeGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [nodeGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeGroup = property();

    /**
     * Set or get the crossfilter dimension which represents the edges in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.

     * *The edge dimension currently does nothing, but once selection is supported, it will be
     * used for filtering other charts on the same crossfilter instance based on the edges
     * selected.*

     * @name edgeDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [edgeDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeDimension = property();

    /**
     * Set or get the crossfilter group which is the data source for the edges in the
     * diagram. See `.nodeGroup` above for the way data is loaded from a crossfilter group.

     * The values in the key/value pairs returned by `diagram.edgeGroup().all()` need to
     * support, at a minimum, the `nodeSource` and `nodeTarget`, which should return the same
     * keys as the `nodeKey`

     * @name edgeGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [edgeGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeGroup = property();

    /**
     * Set or get the function which will be used to retrieve the unique key for each node. By
     * default, this accesses the `key` field of the object passed to it. The keys should match
     * the keys returned by the `.edgeSource` and `.edgeTarget`.

     * @name nodeKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeKey]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeKey = _chart.nodeKeyAccessor = property(function(kv) {
        return kv.key;
    });

    /**
     * Set or get the function which will be used to retrieve the unique key for each edge. By
     * default, this accesses the `key` field of the object passed to it.

     * @name edgeKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeKey]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeKey = _chart.edgeKeyAccessor = property(function(kv) {
        return kv.key;
    });

    /**
     * Set or get the function which will be used to retrieve the source (origin/tail) key of
     * the edge objects.  The key must equal the key returned by the `.nodeKey` for one of the
     * nodes; if it does not, or if the node is currently filtered out, the edge will not be
     * displayed. By default, looks for `.value.sourcename`.

     * @name edgeSource
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeSource]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeSource = _chart.sourceAccessor = property(function(kv) {
        return kv.value.sourcename;
    });

    /**
     * Set or get the function which will be used to retrieve the target (destination/head) key
     * of the edge objects.  The key must equal the key returned by the `.nodeKey` for one of
     * the nodes; if it does not, or if the node is currently filtered out, the edge will not
     * be displayed. By default, looks for `.value.targetname`.
     * @name edgeTarget
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeTarget]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeTarget = _chart.targetAccessor = property(function(kv) {
        return kv.value.targetname;
    });

    /**
     * Set or get the function which will be used to retrieve the radius, in pixels, for each
     * node. This determines the height of nodes,and if `nodeFitLabel` is false, the width too.
     * @name nodeRadius
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeRadius=25]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeRadius = _chart.nodeRadiusAccessor = property(25);

    /**
     * Set or get the function which will be used to retrieve the stroke width, in pixels, for
     * drawing the outline of each node. According to the SVG specification, the outline will
     * be drawn half on top of the fill, and half outside. Default: 1
     * @name nodeStrokeWidth
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeStrokeWidth=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeStrokeWidth = _chart.nodeStrokeWidthAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the stroke color for the outline
     * of each node.
     * @name nodeStroke
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeStroke='black']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeStroke = _chart.nodeStrokeAccessor = property('black');

    /**
     * If set, the value returned from `nodeFill` will be processed through this
     * {@link https://github.com/mbostock/d3/wiki/Scales d3.scale}
     * to return the fill color. If falsy, uses the identity function (no scale).
     * @name nodeFillScale
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|d3.scale} [nodeFillScale]
     * @return {Function|d3.scale}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeFillScale = property(null);

    /**
     * Set or get the function which will be used to retrieve the fill color for the body of each
     * node.
     * @name nodeFill
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeFill='white']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeFill = _chart.nodeFillAccessor = property('white');

    /**
     * Set or get the function which will be used to retrieve the opacity of each node.
     * @name nodeOpacity
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeOpacity=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeOpacity = property(1);

    /**
     * Set or get the padding or minimum distance, in pixels, for a node. (Will be distributed
     * to both sides of the node.)
     * @name nodePadding
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodePadding=6]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.nodePadding = property(6);

    /**
     * Set or get the function which will be used to retrieve the label text to display in each
     * node. By default, looks for a field `label` or `name` inside the `value` field.
     * @name nodeLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeLabel]
     * @return {Function|String}
     * @example
     * // Default behavior
     * diagram.nodeLabel(function(kv) {
     *   return kv.value.label || kv.value.name;
     * });
     * @return {dc_graph.diagram}
     **/
    _chart.nodeLabel = _chart.nodeLabelAccessor = property(function(kv) {
        return kv.value.label || kv.value.name;
    });

    /**
     * Set or get the function which will be used to retrieve the label fill color. Default: null
     * @name nodeLabelFill
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeLabelFill=null]
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeLabelFill = _chart.nodeLabelFillAccessor = property(null);

    /**
     * Whether to fit the node shape around the label
     * @name nodeFitLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Boolean} [nodeFitLabel=true]
     * @return {Function|Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeFitLabel = _chart.nodeFitLabelAccessor = property(true);

    /**
     * The shape to use for drawing each node, specified as an object with at least the field
     * `shape`. The names of shapes are mostly taken
     * [from graphviz](http://www.graphviz.org/doc/info/shapes.html); currently ellipse, egg,
     * triangle, rectangle, diamond, trapezium, parallelogram, pentagon, hexagon, septagon, octagon,
     * invtriangle, invtrapezium, square, polygon are supported.
     *
     * If `shape = polygon`:
     * * `sides`: number of sides for a polygon
     * @name nodeShape
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Object} [nodeShape={shape: 'ellipse'}]
     * @return {Function|Object}
     * @return {dc_graph.diagram}
     * @example
     * // set shape to diamond or parallelogram based on flag
     * diagram.nodeShape(function(kv) {
     *   return {shape: kv.value.flag ? 'diamond' : 'parallelogram'};
     * });
     **/
    _chart.nodeShape = property(default_shape);

    /**
     * Set or get the function which will be used to retrieve the node title, usually rendered
     * as a tooltip. By default, uses the key of the node.
     * @name nodeTitle
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeTitle]
     * @return {Function|String}
     * @example
     * // Default behavior
     * chart.nodeTitle(function(kv) {
     *   return _chart.nodeKeyAccessor()(kv);
     * });
     * @return {dc_graph.diagram}
     **/
    _chart.nodeTitle = _chart.nodeTitleAccessor = property(function(kv) {
        return _chart.nodeKeyAccessor()(kv);
    });

    /**
     * By default, nodes are added to the layout in the order that `.nodeGroup().all()` returns
     * them. If specified, `.nodeOrdering` provides an accessor that returns a key to sort the
     * nodes on.  *It would be better not to rely on ordering to affect layout, but it may
     * affect the layout in some cases.*
     * @name nodeOrdering
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeOrdering]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeOrdering = property(null);

    /**
     * Specify an accessor that returns an {x,y} coordinate for a node that should be
     * {@link https://github.com/tgdwyer/WebCola/wiki/Fixed-Node-Positions fixed in place},
     * and returns falsy for other nodes.
     * @name nodeFixed
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Object} [nodeFixed]
     * @return {Function|Object}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeFixed = _chart.nodeFixedAccessor = property(null);


    /**
     * Set or get the function which will be used to retrieve the stroke color for the edges.
     * @name edgeStroke
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeStroke='black']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeStroke = _chart.edgeStrokeAccessor = property('black');

    /**
     * Set or get the function which will be used to retrieve the stroke width for the edges.
     * @name edgeStrokeWidth
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeStrokeWidth=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeStrokeWidth = _chart.edgeStrokeWidthAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the edge opacity, a number from 0
     * to 1.
     * @name edgeOpacity
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeOpacity=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeOpacity = _chart.edgeOpacityAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the edge label text. The label is
     * displayed when an edge is hovered over. By default, uses the `edgeKey`.
     * @name edgeLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeLabel]
     * @example
     * // Default behavior
     * chart.edgeLabel(function(d) {
     *   return _chart.edgeKey()(d);
     * });
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeLabel = _chart.edgeLabelAccessor = property(function(d) {
        return _chart.edgeKey()(d);
    });

    /**
     * Set or get the function which will be used to retrieve the name of the arrowhead to use
     * for the target/ head/destination of the edge. Arrow symbols can be specified with
     * `.defineArrow()`. Return null to display no arrowhead.
     * @name edgeArrowhead
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeArrowhead='vee']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeArrowhead = _chart.edgeArrowheadAccessor = property('vee');

    /**
     * Set or get the function which will be used to retrieve the name of the arrow tail to use
     * for the tail/source of the edge. Arrow symbols can be specified with
     * `.defineArrow()`. Return null to display no arrowtail.
     * @name edgeArrowtail
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeArrowtail=null]
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeArrowtail = _chart.edgeArrowtailAccessor = property(null);

    /**
     * Multiplier for arrow size.
     * @name edgeArrowSize
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeArrowSize=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeArrowSize = property(1);

    /**
     * To draw an edge but not have it affect the layout, specify a function which returns
     * false for that edge.  By default, will return false if the `notLayout` field of the edge
     * value is truthy, true otherwise.
     * @name edgeIsLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Boolean} [edgeIsLayout]
     * @example
     * // Default behavior
     * chart.edgeIsLayout(function(kv) {
     *   return !kv.value.notLayout;
     * });
     * @return {Function|Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeIsLayout = _chart.edgeIsLayoutAccessor = property(function(kv) {
        return !kv.value.notLayout;
    });

    // conversely, you could have an edge but not want to draw it - not documenting this
    // yet because it seems like it maybe should be combined with edgeIsLayout
    _chart.edgeIsShown = _chart.edgeIsLayoutAccessor = property(true);

    /**
     * Currently, three strategies are supported for specifying the lengths of edges:
     * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
     * `baseLength`
     * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
     * the edge. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
     * for more details.
     * 'none' - no edge lengths will be specified
     * @name lengthStrategy
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [lengthStrategy='symmetric']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _chart.lengthStrategy = property('symmetric');

    /**
     * When the `.lengthStrategy` is 'individual', this accessor will be used to read the
     * length of each edge.  By default, reads the `distance` field of the edge. If the
     * distance is falsy, uses the `baseLength`.
     * @name edgeLength
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeLength]
     * @example
     * // Default behavior
     * chart.edgeLength(function(kv) {
     *   return kv.value.distance;
     * });
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeLength = _chart.edgeDistanceAccessor = property(function(kv) {
        return kv.value.distance;
    });

    /**
     * This should be equivalent to rankdir and ranksep in the dagre/graphviz nomenclature, but for
     * now it is separate.
     * @name flowLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [flowLayout]
     * @example
     * // No flow (default)
     * chart.flowLayout(null)
     * // flow in x with min separation 200
     * chart.flowLayout({axis: 'x', minSeparation: 200})
     **/
    _chart.flowLayout = property(null);

    /**
     * Direction to draw ranks. Currently for dagre and expand_collapse, but I think cola could be
     * generated from graphviz-style since it is more general.
     * @name rankdir
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [rankdir]
     **/
    _chart.rankdir = property('TB');

    /**
     * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
     * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
     * lengths.
     * @name baseLength
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [baseLength]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.baseLength = property(30);

    /**
     * Gets or sets the transition duration, the length of time each change to the diagram will
     * be animated.
     * @name transitionDuration
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [transitionDuration]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.transitionDuration = property(500);

    /**
     * How transitions should be split into separate animations to emphasize
     * the delete, modify, and insert operations:
     * * `none`: modify and insert operations animate at the same time
     * * `modins`: modify operations happen before inserts
     * * `insmod`: insert operations happen before modifies
     *
     * Deletions always happen before/during layout computation.
     * @name stageTransitions
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [stageTransitions]
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _chart.stageTransitions = property('none');

    /**
     * The delete transition happens simultaneously with layout, which can take longer
     * than the transition duration. Delaying it can bring it closer to the other
     * staged transitions.
     * @name deleteDelay
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [deleteDelay]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.deleteDelay = property(0);

    /**
     * Whether to put connected components each in their own group, to stabilize layout.
     * @name groupConnected
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [stageTransitions]
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _chart.groupConnected = property(false);

    /**
     * Gets or sets the maximum time spent doing layout for a render or redraw. Set to 0 for no
     * limit.
     * @name timeLimit
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [timeLimit=0]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _chart.timeLimit = property(0);

    /**
     * Gets or sets a function which will be called with the current nodes and edges on each
     * redraw in order to derive new layout constraints. The constraints are built from scratch
     * on each redraw.

     * This can be used to generate alignment (rank) or axis constraints. By default, no
     * constraints will be added, although cola.js uses constraints internally to implement
     * flow and overlap prevention. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints the cola.js wiki}
     * for more details.

     * For convenience, dc.graph.js implements a other constraints on top of those implemented
     * by cola.js:
     * * 'ordering' - the nodes will be ordered on the specified `axis` according to the keys
     * returned by the `ordering` function, by creating separation constraints using the
     * specified `gap`.
     * * 'circle' - (experimental) the nodes will be placed in a circle using "wheel"
     * edge lengths similar to those described in
     * {@link http://www.csse.monash.edu.au/~tdwyer/Dwyer2009FastConstraints.pdf Scalable, Versatile, and Simple Constrained Graph Layout}
     * *Although this is not as performant or stable as might be desired, it may work for
     * simple cases. In particular, it should use edge length *constraints*, which don't yet
     * exist in cola.js.*
     *
     * Because it is tedious to write code to generate constraints for a graph, **dc.graph.js**
     * also includes a {@link #dc_graph+constraint_pattern constraint generator} to produce
     * this constrain function, specifying the constraints themselves in a graph.
     * @name constrain
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [constrain]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.constrain = property(function(nodes, edges) {
        return [];
    });

    /**
     * If there are multiple edges between the same two nodes, start them this many pixels away
     * from the original so they don't overlap.
     * @name parallelEdgeOffset
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [parallelEdgeOffset=10]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.parallelEdgeOffset = property(10);

    /**
     * By default, edges are added to the layout in the order that `.edgeGroup().all()` returns
     * them. If specified, `.edgeOrdering` provides an accessor that returns a key to sort the
     * edges on.

     * *It would be better not to rely on ordering to affect layout, but it may affect the
     * layout in some cases. (Probably less than node ordering, but it does affect which
     * parallel edge is which.)*
     * @name edgeOrdering
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeOrdering]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.edgeOrdering = property(null);

    _chart.cascade = function(level, add, props) {
        for(var p in props) {
            if(!_chart[p])
                throw new Error('unknown attribute ' + p);
            _chart[p].cascade(level, add ? props[p] : null);
        }
        return _chart;
    };

    /**
     * Currently there are some bugs when the same instance of cola.js is used multiple
     * times. (In particular, overlaps between nodes may not be eliminated
     * {@link https://github.com/tgdwyer/WebCola/issues/118 if cola is not reinitialized}
     * This flag can be set true to construct a new cola layout object on each redraw. However,
     * layout seems to be more stable if this is set false, so hopefully this will be fixed
     * soon.
     * @name initLayoutOnRedraw
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [initLayoutOnRedraw=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.initLayoutOnRedraw = property(false);

    /**
     * Whether to perform layout when the data is unchanged from the last redraw.
     * @name layoutUnchanged
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [layoutUnchanged=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.layoutUnchanged = property(false);

    /**
     * When `layoutUnchanged` is false, this will force layout to happen again. This may be needed
     * when changing a parameter but not changing the topology of the graph. (Yes, probably should
     * not be necessary.)
     * @name relayout
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _chart.relayout = function() {
        _nodes_snapshot = _edges_snapshot = null;
        return this;
    };

    /**
     * Function to call to generate an initial layout. Takes (diagram, nodes, edges)
     * @name initialLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [initialLayout=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.initialLayout = property(null);

    _chart.initialOnly = property(false);

    /**
     * By default, all nodes are included, and edges are only included if both end-nodes are
     * visible.  If `.induceNodes` is set, then only nodes which have at least one edge will be
     * shown.
     * @name induceNodes
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [induceNodes=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.induceNodes = property(false);

    /**
     * If this flag is true, the positions of nodes and will be updated while layout is
     * iterating. If false, the positions will only be updated once layout has
     * stabilized. Note: this may not be compatible with transitionDuration.
     * @name showLayoutSteps
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [showLayoutSteps=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.showLayoutSteps = property(false);

    /**
     * Assigns a legend object which will be displayed within the same SVG element and
     * according to the visual encoding of this diagram.
     * @name legend
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [legend]
     * @return {Object}
     * @return {dc_graph.diagram}
     **/
    _chart.legend = property(null).react(function(l) {
        l.parent(_chart);
    });

    /**
     * Specifies another kind of child layer or interface. For example, this can
     * be used to display tooltips on nodes using `dc_graph.tip`.

     * The child needs to support a `parent` method, the diagram to modify.
     * @name child
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [id] - the name of the child to modify or add
     * @param {Object} [object] - the child object to add, or null to remove
     * @example
     * // Display tooltips on node hover, via the d3-tip library
     * var tip = dc_graph.tip()
     * tip.content(function(d, k) {
     *   // you can do an asynchronous call here, e.g. d3.json, if you need
     *   // to fetch data to show the tooltip - just call k() with the content
     *   k("This is <em>" + d.orig.value.name + "</em>");
     * });
     * diagram.child('tip', tip);
     * @return {dc_graph.diagram}
     **/
    _chart.child = function(id, object) {
        if(arguments.length === 1)
            return _children[id];
        // do not notify unnecessarily
        if(_children[id] === object)
            return _chart;
        if(_children[id])
            _children[id].parent(null);
        _children[id] = object;
        if(object)
            object.parent(_chart);
        return _chart;
    };

    /**
     * Currently, you can specify 'cola' (the default) or 'dagre' as the Layout Algorithm and it
     * will replace the back-end. In the future, there will be subclasses like colaDiagram and
     * dagreDiagram with appropriate interfaces for each, but it is not yet clear which features are
     * common between them.
     * @name layoutAlgorithm
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [algo] - the name of the layout algorithm to use
     * @example
     * // use dagre for layout
     * diagram.layoutAlgorithm('dagre');
     * @return {dc_graph.diagram}
     **/
    _chart.layoutAlgorithm = property('cola');

    _chart.tickSize = property(1);


    _chart.edgeId = function(d) {
        return 'edge-' + _chart.edgeKey.eval(d).replace(/[^\w-_]/g, '-');
    };

    _chart.arrowId = function(d, kind) {
        return 'arrow-' + kind + '-' + _chart.edgeId(d);
    };

    _chart.textpathId = function(d) {
        return 'textpath-' + _chart.edgeId(d);
    };

    // this kind of begs a (meta)graph ADT
    // instead of munging this into the diagram
    _chart.getNode = function(id) {
        return _nodes[id] ? _nodes[id].orig : null;
    };

    /**
     * Instructs cola.js to fit the connected components. Default: true
     * @name handleDisconnected
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [handleDisconnected=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.handleDisconnected = property(true);

    function initLayout() {
        if(!_worker)
            _worker = new Worker('js/dc.graph.' + _chart.layoutAlgorithm() + '.worker.js');
        var args = {
            width: _chart.width(),
            height: _chart.height()
        };
        // generalize this? class hierarchy, what?
        switch(_chart.layoutAlgorithm()) {
        case 'cola':
            Object.assign(args, {
                handleDisconnected: _chart.handleDisconnected(),
                lengthStrategy: _chart.lengthStrategy(),
                baseLength: _chart.baseLength(),
                flowLayout: _chart.flowLayout(),
                tickSize: _chart.tickSize()
            });
            break;
        case 'dagre':
            Object.assign(args, {
                rankdir: _chart.rankdir()
            });
        }
        _worker.postMessage({
            command: 'init',
            args: args
        });
    }

    _chart._enterNode = function(nodeEnter) {
        if(_chart.nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(infer_shape(_chart));
        nodeEnter.append(shape_element(_chart))
            .attr('class', 'node-shape');
        nodeEnter.append('text')
            .attr('class', 'node-label');
        return _chart;
    };

    _chart._updateNode = function(node) {
        var changedShape = node.filter(shape_changed(_chart));
        changedShape.select('.node-shape').remove();
        changedShape.each(infer_shape(_chart));
        changedShape.insert(shape_element(_chart), ':first-child')
            .attr('class', 'node-shape');
        node.select('title')
            .text(_chart.nodeTitle.eval);
        var text = node.select('text.node-label');
        var tspan = text.selectAll('tspan').data(function(n) {
            var lines = _chart.nodeLabel.eval(n);
            if(!lines)
                return [];
            else if(typeof lines === 'string')
                lines = [lines];
            var first = lines.length%2 ? 0.3 - (lines.length-1)/2 : 1-lines.length/2;
            return lines.map(function(line, i) { return {line: line, ofs: (i==0 ? first : 1) + 'em'}; });
        });
        tspan.enter().append('tspan')
            .attr('x', 0)
            .attr('dy', function(d) { return d.ofs; });
        tspan.text(function(d) { return d.line; });
        tspan.exit().remove();
        text
            .attr('fill', _chart.nodeLabelFill.eval)
            .each(fit_shape(_chart));
        node.select('.node-shape')
            .each(shape_attrs(_chart))
            .attr({
                stroke: _chart.nodeStroke.eval,
                'stroke-width': _chart.nodeStrokeWidth.eval,
                fill: compose(_chart.nodeFillScale() || identity, _chart.nodeFill.eval)
            });
        return _chart;
    };

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    // three stages: delete before layout, and modify & insert split the transitionDuration
    function transition_duration() {
        return (_chart.stageTransitions() !== 'none') ?
            _chart.transitionDuration() / 2 :
            _chart.transitionDuration();
    }

    function transition_delay(is_enter) {
        return _chart.stageTransitions() === 'none' ||
            _chart.stageTransitions() === 'modins' === !is_enter ?
            0 :
            _chart.transitionDuration() / 2;
    }

    _chart.isRunning = function() {
        return _running;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Computes a new layout based on the nodes and edges in the edge groups, and
     * displays the diagram.  To the extent possible, the diagram will minimize changes in
     * positions from the previous layout.  `.render()` must be called the first time, and
     * `.redraw()` can be called after that.

     * `.redraw()` will be triggered by changes to the filters in any other charts in the same
     * dc.js chart group.

     * Unlike in dc.js, `redraw` executes asynchronously, because drawing can be computationally
     * intensive, and the diagram will be drawn multiple times if
     * {@link #dc_graph.diagram+showLayoutSteps showLayoutSteps}
     * is enabled. Watch the {@link #dc_graph.diagram+on 'end'} event to know when layout is
     * complete.
     **/
    var _needsRedraw = false;
    _chart.redraw = function () {
        // since dc.js can receive UI events and trigger redraws whenever it wants,
        // and cola absolutely will not tolerate being poked while it's doing layout,
        // we need to guard the startLayout call.
        if(_running) {
            _needsRedraw = true;
            return this;
        }
        else return _chart.startLayout();
    };

    _chart.startLayout = function () {
        var nodes = _chart.nodeGroup().all();
        var edges = _chart.edgeGroup().all();
        if(_running) {
            throw new Error('dc_graph.diagram.redraw already running!');
        }
        _running = true;

        if(_worker)
            _worker.postMessage({command: 'stop'});

        if(_chart.initLayoutOnRedraw())
            initLayout();

        // ordering shouldn't matter, but we support ordering in case it does
        if(_chart.nodeOrdering()) {
            nodes = crossfilter.quicksort.by(_chart.nodeOrdering())(nodes.slice(0), 0, nodes.length);
        }
        if(_chart.edgeOrdering()) {
            edges = crossfilter.quicksort.by(_chart.edgeOrdering())(edges.slice(0), 0, edges.length);
        }

        var wnodes = regenerate_objects(_nodes, nodes, function(v) {
            return _chart.nodeKey()(v);
        }, function(v1, v) {
            v1.orig = v;
            v1.cola = v1.cola || {};
            v1.cola.dcg_nodeKey = _chart.nodeKey.eval(v1);
            if(_chart.nodeFixed())
                v1.cola.dcg_nodeFixed = _chart.nodeFixed.eval(v1);
        });
        var wedges = regenerate_objects(_edges, edges, function(e) {
            return _chart.edgeKey()(e);
        }, function(e1, e) {
            e1.orig = e;
            e1.cola = e1.cola || {};
            e1.cola.dcg_edgeKey = _chart.edgeKey.eval(e1);
            e1.cola.dcg_edgeSource = _chart.edgeSource.eval(e1);
            e1.cola.dcg_edgeTarget = _chart.edgeTarget.eval(e1);
            e1.source = _nodes[e1.cola.dcg_edgeSource];
            e1.target = _nodes[e1.cola.dcg_edgeTarget];
            e1.cola.dcg_edgeLength = _chart.edgeLength.eval(e1);
        });

        // remove edges that don't have both end nodes
        wedges = wedges.filter(has_source_and_target);

        // remove self-edges (since we can't draw them - will be option later)
        wedges = wedges.filter(function(e) { return e.source !== e.target; });

        wedges = wedges.filter(_chart.edgeIsShown.eval);

        // and optionally, nodes that have no edges
        if(_chart.induceNodes()) {
            var keeps = {};
            wedges.forEach(function(e) {
                keeps[e.cola.dcg_edgeSource] = true;
                keeps[e.cola.dcg_edgeTarget] = true;
            });
            wnodes = wnodes.filter(function(n) { return keeps[n.cola.dcg_nodeKey]; });
            for(var k in _nodes)
                if(!keeps[k])
                    delete _nodes[k];
        }

        wnodes.forEach(function(v, i) {
            v.index = i;
        });

        _stats = {nnodes: wnodes.length, nedges: wedges.length};

        // annotate parallel edges so we can draw them specially
        if(_chart.parallelEdgeOffset()) {
            var em = new Array(wnodes.length);
            for(var i = 0; i < em.length; ++i) {
                em[i] = new Array(em.length); // technically could be diagonal array
                for(var j = 0; j < em.length; ++j)
                    em[i][j] = {
                        n: 0,
                        ports: {
                            rev: []
                        }
                    };
            }
            wedges.forEach(function(e) {
                var min = Math.min(e.source.index, e.target.index),
                    max = Math.max(e.source.index, e.target.index);
                e.parallel = em[min][max].n++;
                e.ports = em[min][max].ports;
                e.ports.rev.push(min !== e.source.index);
            });
            for(i = 0; i < em.length; ++i)
                for(j = 0; j < em.length; ++j)
                    if(em[i][j].n)
                        em[i][j].ports.n = em[i][j].n;
        }

        // create edge SVG elements
        var edge = _edgeLayer.selectAll('.edge')
                .data(wedges, _chart.edgeKey.eval);
        var edgeEnter = edge.enter().append('svg:path')
                .attr({
                    class: 'edge',
                    id: _chart.edgeId,
                    opacity: 0
                });

        edge.exit().transition()
            .duration(transition_duration())
            .delay(_chart.deleteDelay())
            .attr('opacity', 0)
            .each(function(d) {
                edgeArrow(d, 'head', null);
                edgeArrow(d, 'head', null);
            })
            .remove();

        // another wider copy of the edge just for hover events
        var edgeHover = _edgeLayer.selectAll('.edge-hover')
                .data(wedges, _chart.edgeKey.eval);
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover', function(d) {
                d3.select('#' + _chart.edgeId(d) + '-label')
                    .attr('visibility', 'visible');
            })
            .on('mouseout', function(d) {
                d3.select('#' + _chart.edgeId(d) + '-label')
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();

        var edgeLabels = _edgeLayer.selectAll('.edge-label')
                .data(wedges, _chart.edgeKey.eval);
        var edgeLabelsEnter = edgeLabels.enter()
              .append('text')
                .attr('id', function(d) {
                    return _chart.edgeId(d) + '-label';
                })
                .attr('visibility', 'hidden')
                .attr({'class':'edge-label',
                       'text-anchor': 'middle',
                       dy:-2})
              .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', function(d) {
                    var id = _chart.textpathId(d);
                    return '#' + id;
                });
        var textPaths = _defs.selectAll('path.edge-label-path')
                .data(wedges, _chart.textpathId);
        var textPathsEnter = textPaths.enter()
                .append('svg:path').attr({
                    class: 'edge-label-path',
                    id: _chart.textpathId
                });
        edgeLabels.each(function(d) {
            d.dcg_bbox = null;
        })
          .selectAll('textPath')
            .text(function(d){
                return _chart.edgeLabel.eval(d);
            });
        edgeLabels.exit().transition()
            .duration(transition_duration())
            .delay(_chart.deleteDelay())
            .attr('opacity', 0).remove();

        // create node SVG elements
        var node = _nodeLayer.selectAll('.node')
                .data(wnodes, _chart.nodeKey.eval);
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('opacity', '0'); // don't show until has layout
        // .call(_d3cola.drag);

        _chart._enterNode(nodeEnter);

        node.exit().transition()
            .duration(transition_duration())
            .delay(_chart.deleteDelay())
            .attr('opacity', 0)
            .remove();

        _dispatch.drawn(node, edge, edgeHover);

        _refresh(node, edge);

        // really we should have layout chaining like in the good old Dynagraph days
        // the ordering of this and the previous 4 statements is somewhat questionable
        if(_chart.initialLayout())
            _chart.initialLayout()(_chart, wnodes, wedges);

        // no layout if the topology hasn't changed
        var skip_layout = false;
        if(!_chart.layoutUnchanged()) {
            var nodes_snapshot = JSON.stringify(wnodes.map(get_original)),
                edges_snapshot = JSON.stringify(wedges.map(get_original));
            if(nodes_snapshot === _nodes_snapshot && edges_snapshot === _edges_snapshot)
                skip_layout = true;
            _nodes_snapshot = nodes_snapshot;
            _edges_snapshot = edges_snapshot;
        }

        // cola constraints always use indices, but node references
        // are more friendly, so translate those

        // i am not satisfied with this constraint generation api...
        // https://github.com/dc-js/dc.graph.js/issues/10
        var constraints = _chart.constrain()(_chart, wnodes, wedges);
        // translate references from names to indices (ugly)
        constraints.forEach(function(c) {
            if(c.type) {
                switch(c.type) {
                case 'alignment':
                    c.offsets.forEach(function(o) {
                        o.node = _nodes[o.node].index;
                    });
                    break;
                case 'circle':
                    c.nodes.forEach(function(n) {
                        n.node = _nodes[n.node].index;
                    });
                    break;
                }
            } else if(c.axis) {
                c.left = _nodes[c.left].index;
                c.right = _nodes[c.right].index;
            }
        });

        // pseudo-cola.js features

        // 1. non-layout edges are drawn but not told to cola.js
        var layout_edges = wedges.filter(_chart.edgeIsLayout.eval);
        var nonlayout_edges = wedges.filter(function(x) {
            return !_chart.edgeIsLayout.eval(x);
        });

        // 2. type=circle constraints
        var circle_constraints = constraints.filter(function(c) {
            return c.type === 'circle';
        });
        constraints = constraints.filter(function(c) {
            return c.type !== 'circle';
        });
        circle_constraints.forEach(function(c) {
            var R = (c.distance || _chart.baseLength()*4) / (2*Math.sin(Math.PI/c.nodes.length));
            var nindices = c.nodes.map(function(x) { return x.node; });
            var namef = function(i) {
                return _chart.nodeKey.eval(wnodes[i]);
            };
            var wheel = dc_graph.wheel_edges(namef, nindices, R)
                    .map(function(e) {
                        var e1 = {internal: e};
                        e1.source = _nodes[e.sourcename];
                        e1.target = _nodes[e.targetname];
                        return e1;
                    });
            layout_edges = layout_edges.concat(wheel);
        });

        // 3. ordered alignment
        var ordered_constraints = constraints.filter(function(c) {
            return c.type === 'ordering';
        });
        constraints = constraints.filter(function(c) {
            return c.type !== 'ordering';
        });
        ordered_constraints.forEach(function(c) {
            var sorted = c.nodes.map(function(n) { return _nodes[n]; });
            if(c.ordering) {
                var sort = crossfilter.quicksort.by(param(c.ordering));
                sorted = sort(sorted, 0, sorted.length);
            }
            var left;
            sorted.forEach(function(n, i) {
                if(i===0)
                    left = n;
                else {
                    constraints.push({
                        left: left.index,
                        right: (left = n).index,
                        axis: c.axis,
                        gap: c.gap
                    });
                }
            });
        });
        if(_chart.legend())
            _chart.legend().redraw();
        if(skip_layout) {
            _running = false;
            _dispatch.end(false);
            return this;
        }
        var startTime = Date.now();

        function populate_cola(rnodes, redges) {
            rnodes.forEach(function(rn) {
                var n = _nodes[rn.dcg_nodeKey];
                n.cola.x = rn.x;
                n.cola.y = rn.y;
            });
            redges.forEach(function(re) {
                var e = _edges[re.dcg_edgeKey];
            });
        }
        _worker.onmessage = function(e) {
            var args = e.data.args;
            switch(e.data.response) {
            case 'tick':
                var elapsed = Date.now() - startTime;
                populate_cola(args.nodes, args.edges);
                if(_chart.showLayoutSteps())
                    draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter, textPaths, textPathsEnter);
                if(_needsRedraw || _chart.timeLimit() && elapsed > _chart.timeLimit()) {
                    console.log('cancelled');
                    _worker.postMessage({
                        command: 'stop'
                    });
                }
                break;
            case 'end':
                if(!_chart.showLayoutSteps()) {
                    populate_cola(args.nodes, args.edges);
                    draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter, textPaths, textPathsEnter);
                }
                else layout_done(true);
                var do_zoom;
                switch(_chart.autoZoom()) {
                case 'always':
                    do_zoom = true;
                    break;
                case 'once':
                    do_zoom = true;
                    _chart.autoZoom(null);
                    break;
                default:
                    do_zoom = false;
                }
                calc_bounds(node, edge);
                if(do_zoom)
                    auto_zoom();
                break;
            case 'start':
                console.log('algo ' + _chart.layoutAlgorithm() + ' started.');
                _dispatch.start();
            }
        };
        _dispatch.start(); // cola doesn't seem to fire this itself?
        _worker.postMessage({
            command: 'data',
            args: {
                nodes: wnodes.map(function(v) { return v.cola; }),
                edges: layout_edges.map(function(v) { return v.cola; }),
                constraints: constraints,
                opts: {groupConnected: _chart.groupConnected()}
            }
        });
        _worker.postMessage({
            command: 'start',
            args: {
                initialUnconstrainedIterations: 10,
                initialUserConstraintIterations: 20,
                initialAllConstraintsIterations: 20,
                initialOnly: _chart.initialOnly(),
                showLayoutSteps: _chart.showLayoutSteps()
            }
        });
        return this;
    };

    function _refresh(node, edge) {
        edge
            .attr('stroke', _chart.edgeStroke.eval)
            .attr('stroke-width', _chart.edgeStrokeWidth.eval)
            .attr('marker-end', function(d) {
                var name = _chart.edgeArrowhead.eval(d),
                    id = edgeArrow(d, 'head', name);
                return id ? 'url(#' + id + ')' : null;
            })
            .attr('marker-start', function(d) {
                var name = _chart.edgeArrowtail.eval(d),
                    arrow_id = edgeArrow(d, 'tail', name);
                return name ? 'url(#' + arrow_id + ')' : null;
            })
            .each(function(e) {
                d3.selectAll('#' + _chart.arrowId(e, 'head') + ',#' + _chart.arrowId(e, 'tail'))
                    .attr('fill', _chart.edgeStroke.eval(e));
            });

        _chart._updateNode(node);
    }

    _chart.refresh = function(node, edge, edgeHover, edgeLabels, textPaths) {
        node = node || _nodeLayer.selectAll('.node');
        edge = edge || _edgeLayer.selectAll('.edge');
        _refresh(node, edge);

        edgeHover = edgeHover || _edgeLayer.selectAll('.edge-hover');
        edgeLabels = edgeLabels || _edgeLayer.selectAll('.edge-label');
        textPaths = textPaths || _defs.selectAll('path.edge-label-path');
        var nullSel = d3.select(null); // no enters
        draw(node, nullSel, edge, nullSel, edgeHover, nullSel, edgeLabels, nullSel, textPaths, nullSel);
    };


    function layout_done(happens) {
        _dispatch.end(happens);
        _running = false;
        if(_needsRedraw) {
            _needsRedraw = false;
            window.setTimeout(function() {
                if(!_chart.isRunning()) // someone else may already have started
                    _chart.redraw();
            }, 0);
        }
    }

    function calc_edge_path(d, age, sx, sy, tx, ty) {
        if(!d.ports[age]) {
            var source_padding = d.source.dcg_ry +
                    _chart.nodeStrokeWidth.eval(d.source) / 2,
                target_padding = d.target.dcg_ry +
                    _chart.nodeStrokeWidth.eval(d.target) / 2;
            d.ports[age] = new Array(d.ports.n);
            var reversedness = d.ports.rev[d.parallel];
            for(var p = 0; p < d.ports.n; ++p) {
                // alternate parallel edges over, then under
                var dir = (!!(p%2) === (sx < tx)) ? -1 : 1,
                    port = Math.floor((p+1)/2),
                    last = port ? d.ports[age][p > 2 ? p - 2 : 0].path : null;
                var path = draw_edge_to_shapes(_chart, d.source, d.target, sx, sy, tx, ty,
                                              last, dir, _chart.parallelEdgeOffset(),
                                              source_padding, target_padding
                                              );
                if(d.ports.rev[p] !== reversedness)
                    path.points.reverse();
                var spos = path.points[0], tpos = path.points[path.points.length-1];
                var near = bezier_point(path.points, 0.75);
                d.ports[age][p] = {
                    path: path,
                    orient: Math.atan2(tpos.y - near.y, tpos.x - near.x) + 'rad'
                };
            }
        }
        return d.ports[age][d.parallel].path;
    }

    function calc_old_edge_path(d) {
        calc_edge_path(d, 'old', d.source.prevX || d.source.cola.x, d.source.prevY || d.source.cola.y,
                         d.target.prevX || d.target.cola.x, d.target.prevY || d.target.cola.y);
    }

    function calc_new_edge_path(d) {
        var path = calc_edge_path(d, 'new', d.source.cola.x, d.source.cola.y, d.target.cola.x, d.target.cola.y);
        var spos = path.points[0], tpos = path.points[path.points.length-1];
        d.length = Math.hypot(tpos.x-spos.x, tpos.y-spos.y);
    }

    function render_edge_path(age) {
        return function(d) {
            var path = d.ports[age][d.parallel].path;
            return generate_path(path.points, path.bezDegree);
        };
    }

    function render_edge_label_path(age) {
        return function(d) {
            var path = d.ports[age][d.parallel].path;
            var points = d.target.cola.x < d.source.cola.x ?
                    path.points.slice(0).reverse() : path.points;
            return generate_path(points, path.bezDegree);
        };
    }

    // wait on multiple transitions, adapted from
    // http://stackoverflow.com/questions/10692100/invoke-a-callback-at-the-end-of-a-transition
    function endall(transitions, callback) {
        if (transitions.every(function(transition) { return transition.size() === 0; }))
            callback();
        var n = 0;
        transitions.forEach(function(transition) {
            transition
                .each(function() { ++n; })
                .each('end.all', function() { if (!--n) callback(); });
        });
    }

    function node_bounds(n) {
        return {left: n.cola.x - n.dcg_rx, top: n.cola.y - n.dcg_ry,
                right: n.cola.x + n.dcg_rx, bottom: n.cola.y + n.dcg_ry};
    }

    function union_bounds(b1, b2) {
        return {
            left: Math.min(b1.left, b2.left),
            top: Math.min(b1.top, b2.top),
            right: Math.max(b1.right, b2.right),
            bottom: Math.max(b1.bottom, b2.bottom)
        };
    }

    function point_to_bounds(p) {
        return {
            left: p.x,
            top: p.y,
            right: p.x,
            bottom: p.y
        };
    }

    function edge_bounds(e) {
        // assumption: edge must have some points
        var points = e.ports.new[e.parallel].path.points;
        return points.map(point_to_bounds).reduce(union_bounds);
    }

    function debug_bounds(bounds) {
        var brect = _g.selectAll('rect.bounds').data([0]);
        brect.enter()
            .insert('rect', ':first-child').attr({
                class: 'bounds',
                fill: 'rgba(128,255,128,0.1)',
                stroke: '#000'
            });
        brect
            .attr({
                x: bounds.left,
                y: bounds.top,
                width: bounds.right - bounds.left,
                height: bounds.bottom - bounds.top
            });
    }

    var _bounds;
    function calc_bounds(node, edge) {
        if((_chart.fitStrategy() || _chart.restrictPan()) && node.size()) {
            // assumption: there can be no edges without nodes
            _bounds = node.data().map(node_bounds).reduce(union_bounds);
            _bounds = edge.data().map(edge_bounds).reduce(union_bounds, _bounds);
        }
    }

    function auto_zoom() {
        if(_chart.fitStrategy()) {
            if(!_bounds)
                return;
            var vwidth = _bounds.right - _bounds.left, vheight = _bounds.bottom - _bounds.top,
                swidth =  _chart.width(), sheight = _chart.height(), viewBox;
            if(_chart.DEBUG_BOUNDS)
                debug_bounds(_bounds);
            var fitS = _chart.fitStrategy(), pAR, translate = [0,0], scale = 1,
                amv; // align margins vertically
            if(['default', 'vertical', 'horizontal'].indexOf(fitS) >= 0) {
                var sAR = sheight / swidth, vAR = vheight / vwidth,
                    vrl = vAR<sAR; // view aspect ratio is less (wider)
                if(fitS === 'default') {
                    amv = !vrl;
                    pAR = null;
                }
                else {
                    amv = fitS==='vertical';
                    pAR = 'xMidYMid ' + (vrl ^ amv ? 'meet' : 'slice');
                }
                translate = [_chart.margins().left, _chart.margins().top];
                scale = amv ?
                    (sheight - _chart.margins().top - _chart.margins().bottom) / sheight :
                    (swidth - _chart.margins().left - _chart.margins().right) / swidth;
            }
            else if(typeof fitS === 'string' && fitS.match(/^align_/)) {
                var sides = fitS.split('_')[1].toLowerCase().split('');
                if(sides.length > 2)
                    throw new Error("align_ expecting 0-2 sides, not " + sides.length);
                var bounds = margined_bounds();
                translate = _zoom.translate();
                scale = _zoom.scale();
                sides.forEach(function(s) {
                    switch(s) {
                    case 'l':
                        translate[0] = align_left(translate, bounds.left);
                        break;
                    case 't':
                        translate[1] = align_top(translate, bounds.top);
                        break;
                    case 'r':
                        translate[0] = align_right(translate, bounds.right);
                        break;
                    case 'b':
                        translate[1] = align_bottom(translate, bounds.bottom);
                        break;
                    default:
                        throw new Error("align_ expecting l t r or b, not '" + s + "'");
                    }
                });
            }
            else if(typeof fitS === 'function') {
                var fit = fitS(vwidth, vheight, swidth, sheight);
                pAR = fit.pAR;
                translate = fit.translate;
                scale = fit.scale;
                viewBox = fit.viewBox;
            }
            else if(typeof fitS === 'string')
                pAR = _chart.fitStrategy();
            else
                throw new Error('unknown fitStrategy type ' + typeof fitS);

            if(pAR !== undefined) {
                if(!viewBox)
                    viewBox = [_bounds.left, _bounds.top, vwidth, vheight].join(' ');
                _svg.attr({
                    viewBox: viewBox,
                    preserveAspectRatio: pAR
                });
            }
            _zoom.translate(translate).scale(scale).event(_svg);
        }
    }

    function draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter, textPaths, textPathsEnter) {
        console.assert(edge.data().every(has_source_and_target));

        var nodeEntered = {};
        nodeEnter
            .each(function(n) {
                nodeEntered[_chart.nodeKey.eval(n)] = true;
            })
            .attr('transform', function (d) {
                // start new nodes at their final position
                return 'translate(' + d.cola.x + ',' + d.cola.y + ')';
            });
        var ntrans = node
                .transition()
                .duration(transition_duration())
                .delay(function(n) {
                    return transition_delay(nodeEntered[_chart.nodeKey.eval(n)]);
                })
                .attr('opacity', _chart.nodeOpacity.eval)
                .attr('transform', function (d) {
                    return 'translate(' + d.cola.x + ',' + d.cola.y + ')';
                })
                .each('end.record', function(d) {
                    d.prevX = d.cola.x;
                    d.prevY = d.cola.y;
                });

        // reset edge ports
        edge.each(function(d) {
            d.ports.new = null;
            d.ports.old = null;
        });

        var edgeEntered = {};
        edgeEnter
            .each(function(e) {
                edgeEntered[_chart.edgeKey.eval(e)] = true;
            })
            .each(function(e) {
                // if staging transitions, just fade new edges in at new position
                // else start new edges at old positions of nodes, if any, else new positions
                var age;
                if(_chart.stageTransitions() === 'modins') {
                    calc_new_edge_path(e);
                    age = 'new';
                }
                else {
                    calc_old_edge_path(e);
                    age = 'old';
                }
                if(_chart.edgeArrowhead.eval(e))
                    d3.select('#' + _chart.arrowId(e, 'head'))
                    .attr('orient', function() {
                        return e.ports[age][e.parallel].orient;
                    });
            })
            .attr('d', render_edge_path(_chart.stageTransitions() === 'modins' ? 'new' : 'old'));

        var etrans = edge.each(calc_new_edge_path)
                .each(function(e) {
                    if(_chart.edgeArrowhead.eval(e)) {
                        d3.select('#' + _chart.arrowId(e, 'head'))
                            .transition().duration(transition_duration())
                            .delay(transition_delay(false))
                            .attr('orient', function() {
                                return e.ports.new[e.parallel].orient;
                            });
                    }
                })
              .transition()
                .duration(transition_duration())
                .delay(function(e) {
                    return transition_delay(edgeEntered[_chart.edgeKey.eval(e)]);
                })
                .attr('opacity', _chart.edgeOpacity.eval)
                .attr('d', function(e) {
                    var when = _chart.stageTransitions() === 'insmod' &&
                            edgeEntered[_chart.edgeKey.eval(e)] ? 'old' : 'new';
                    return render_edge_path(when)(e);
                });
        textPathsEnter
            .attr('d', render_edge_label_path(_chart.stageTransitions() === 'modins' ? 'new' : 'old'));
        var textTrans = textPaths.transition()
            .duration(transition_duration())
            .delay(function(e) {
                return transition_delay(edgeEntered[_chart.edgeKey.eval(e)]);
            })
            .attr('opacity', _chart.edgeOpacity.eval)
            .attr('d', function(e) {
                var when = _chart.stageTransitions() === 'insmod' &&
                        edgeEntered[_chart.edgeKey.eval(e)] ? 'old' : 'new';
                return render_edge_label_path(when)(e);
            });
        if(_chart.stageTransitions() === 'insmod') {
            // inserted edges transition twice in insmod mode
            if(transition_duration() >= 50) {
                etrans = etrans.transition()
                    .duration(transition_duration())
                    .attr('d', render_edge_path('new'));
                textTrans = textTrans.transition()
                    .duration(transition_duration())
                    .attr('d', render_edge_label_path('new'));
            } else {
                // if transitions are too short, we run into various problems,
                // from transitions not completing to objects not found
                // so don't try to chain in that case
                // this also helped once: d3.timer.flush();
                etrans
                    .attr('d', render_edge_path('new'));
                textTrans
                    .attr('d', render_edge_path('new'));
            }
        }

        // signal layout done when all transitions complete
        // because otherwise client might start another layout and lock the processor
        if(!_chart.showLayoutSteps())
            endall([ntrans, etrans, textTrans], function() { layout_done(true); });

        edgeHover.attr('d', render_edge_path('new'));
    }

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Erases any existing SVG elements and draws the diagram from scratch. `.render()`
     * must be called the first time, and `.redraw()` can be called after that.
     * @name render
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _chart.render = function () {
        if(!_chart.initLayoutOnRedraw())
            initLayout();
        _chart.resetSvg();
        _g = _svg.append('g');
        _edgeLayer = _g.append('g');
        _nodeLayer = _g.append('g');

        if(_chart.legend())
            _chart.legend().render();
        return _chart.redraw();
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Attaches an event handler to the diagram. The currently supported events are
     * * `start()` - layout is starting
     * * `drawn(nodes, edges)` - the node and edge elements have been rendered to the screen
     * and can be modified through the passed d3 selections.
     * * `end()` - diagram layout has completed.
     * @name on
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [event] - the event to subscribe to
     * @param {Function} [f] - the event handler
     * @return {dc_graph.diagram}
     **/
    _chart.on = function(event, f) {
        _dispatch.on(event, f);
        return this;
    };

    /**
     * Returns an object with current statistics on graph layout.
     * * `nnodes` - number of nodes displayed
     * * `nedges` - number of edges displayed
     * @name getStats
     * @memberof dc_graph.diagram
     * @instance
     * @return {}
     * @return {dc_graph.diagram}
     **/
    _chart.getStats = function() {
        return _stats;
    };


    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Execute a d3 single selection in the diagram's scope using the given selector
     * and return the d3 selection. Roughly the same as
     * ```js
     * d3.select('#diagram-id').select(selector)
     * ```
     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @name select
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     **/
    _chart.select = function (s) {
        return _chart.root().select(s);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Selects all elements that match the d3 single selector in the diagram's scope,
     * and return the d3 selection. Roughly the same as

     * ```js
     * d3.select('#diagram-id').selectAll(selector)
     * ```

     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @name selectAll
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     **/
    _chart.selectAll = function (s) {
        return _chart.root() ? _chart.root().selectAll(s) : null;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Returns the top svg element for this specific chart. You can also pass in a new
     * svg element, but setting the svg element on a diagram may have unexpected consequences.
     * @name svg
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}

     **/
    _chart.svg = function (_) {
        if (!arguments.length) {
            return _svg;
        }
        _svg = _;
        return _chart;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Remove the diagram's SVG elements from the dom and recreate the container SVG
     * element.
     * @name resetSvg
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _chart.resetSvg = function () {
        _chart.select('svg').remove();
        return generateSvg();
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be redrawn.
     * @name redrawGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _chart.redrawGroup = function () {
        dc.redrawAll(chartGroup);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be rendered.
     * @name renderGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _chart.renderGroup = function () {
        dc.renderAll(chartGroup);
    };

    /**
     * Creates an svg marker definition for drawing edge arrow tails or heads. The `viewBox` of
     * the marker is `0 -5 10 10`, so the arrow should be drawn from (0, -5) to (10, 5); it
     * will be moved and sized based on the other parameters, and rotated based on the
     * orientation of the edge.

     * (If further customization is required, it is possible to append other `svg:defs` to
     * `chart.svg()` and use refer to them by `id`.)
     * @name defineArrow
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} name - the identifier to give the marker, to be used with
     * {@link #dc_graph.diagram+edgeArrowhead edgeArrowhead} or
     * {@link #dc_graph.diagram+edgeArrowtail edgeArrowtail}
     * @param {Number} width - the width, in pixels, to draw the marker
     * @param {Number} height - the height, in pixels, to draw the marker
     * @param {Number} refX - the X reference position, in marker coordinates, which will be
     * aligned to the endpoint of the edge
     * @param {Number} refY - the Y reference position
     * @param {Function} drawf - a function to draw the marker using d3 SVG primitives, which
     * takes the marker object as its parameter.
     * @example
     * // the built-in `vee` arrow is defined like so:
     * _chart.defineArrow('vee', 12, 12, 10, 0, function(marker) {
     *   marker.append('svg:path')
     *     .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
     *     .attr('stroke-width', '0px');
     * });
     * @return {dc_graph.diagram}
     **/
    _chart.defineArrow = function(name, width, height, refX, refY, drawf) {
        _arrows[name] = {
            name: name,
            width: width,
            height: height,
            refX: refX,
            refY: refY,
            drawFunction: drawf
        };
        return _chart;
    };

    _chart.addOrRemoveDef = function(id, whether, tag) {
        var data = whether ? [0] : [];
        var sel = _defs.selectAll('#' + id).data(data);

        var selEnter = sel
            .enter().append(tag)
                .attr('id', id);
        sel.exit().remove();
        return selEnter;
    };

    function edgeArrow(d, kind, name) {
        var id = _chart.arrowId(d, kind),
            markerEnter = _chart.addOrRemoveDef(id, !!name, 'svg:marker');

        if(name) {
            markerEnter
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', _arrows[name].refX)
                .attr('refY', _arrows[name].refY)
                .attr('markerUnits', 'userSpaceOnUse')
                .attr('markerWidth', _arrows[name].width*_chart.edgeArrowSize.eval(d))
                .attr('markerHeight', _arrows[name].height*_chart.edgeArrowSize.eval(d))
                .attr('stroke', _chart.edgeStroke.eval(d))
                .attr('fill', _chart.edgeStroke.eval(d))
                .call(_arrows[name].drawFunction);
        }
        return name ? id : null;
    }

    function globalTransform(pos, scale) {
        _translate = pos;
        _scale = scale;
        _g.attr('transform', 'translate(' + pos + ')' + ' scale(' + scale + ')');
    }

    function margined_bounds() {
        return {
            left: _bounds.left - _chart.margins().left,
            top: _bounds.top - _chart.margins().top,
            right: _bounds.right + _chart.margins().right,
            bottom: _bounds.bottom + _chart.margins().bottom
        };
    }

    // with thanks to comments in https://github.com/d3/d3/issues/1084
    function align_left(translate, x) {
        return translate[0] - _xScale(x) + _xScale.range()[0];
    }
    function align_top(translate, y) {
        return translate[1] - _yScale(y) + _yScale.range()[0];
    }
    function align_right(translate, x) {
        return translate[0] - _xScale(x) + _xScale.range()[1];
    }
    function align_bottom(translate, y) {
        return translate[1] - _yScale(y) + _yScale.range()[1];;
    }

    function doZoom() {
        var translate = d3.event.translate;
        if(_chart.restrictPan()) {
            var xDomain = _xScale.domain(), yDomain = _yScale.domain();
            var bounds = margined_bounds();
            var less1 = bounds.left < xDomain[0], less2 = bounds.right < xDomain[1],
                lessExt = (bounds.right - bounds.left) < (xDomain[1] - xDomain[0]);
            var align, nothing = 0;
            if(less1 && less2)
                if(lessExt)
                    align = 'left';
                else
                    align = 'right';
            else if(!less1 && !less2)
                if(lessExt)
                    align = 'right';
                else
                    align = 'left';
            switch(align) {
            case 'left':
                translate[0] = align_left(translate, bounds.left);
                break;
            case 'right':
                translate[0] = align_right(translate, bounds.right);
                break;
            default:
                ++nothing;
            }
            less1 = bounds.top < yDomain[0]; less2 = bounds.bottom < yDomain[1];
            lessExt = (bounds.bottom - bounds.top) < (yDomain[1] - yDomain[0]);
            if(less1 && less2)
                if(lessExt)
                    align = 'top';
                else
                    align = 'bottom';
            else if(!less1 && !less2)
                if(lessExt)
                    align = 'bottom';
                else
                    align = 'top';
            switch(align) {
            case 'top':
                translate[1] = align_top(translate, bounds.top);
                break;
            case 'bottom':
                translate[1] = align_bottom(translate, bounds.bottom);
                break;
            default:
                ++nothing;
            }

            if(nothing<2)
                _zoom.translate(translate);
        }
        globalTransform(translate, d3.event.scale);
    }

    function resizeSvg(w, h) {
        if(_svg) {
            _svg.attr('width', w || _chart.width())
                .attr('height', h || _chart.height());
        }
    }

    function generateSvg() {
        _svg = _chart.root().append('svg');
        resizeSvg();

        _defs = _svg.append('svg:defs');

        if(_chart.mouseZoomable()) {
            // start out with 1:1 zoom
            _xScale = d3.scale.linear()
                .domain([0, _chart.width()])
                .range([0, _chart.width()]);
            _yScale = d3.scale.linear()
                .domain([0, _chart.height()])
                .range([0, _chart.height()]);
            _zoom = d3.behavior.zoom()
                .on('zoom', doZoom)
                .x(_xScale).y(_yScale);
            _svg.call(_zoom);
            _svg.on('dblclick.zoom', null);
        }

        return _svg;
    }

    _chart.invertCoord = function(clientCoord) {
        return [
            _xScale.invert(clientCoord[0]),
            _yScale.invert(clientCoord[1])
        ];
    };

    _chart.defineArrow('vee', 12, 12, 10, 0, function(marker) {
        marker.append('svg:path')
            .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
            .attr('stroke-width', '0px');
    });
    _chart.defineArrow('dot', 7, 7, 0, 0, function(marker) {
        marker.append('svg:circle')
            .attr('r', 5)
            .attr('cx', 5)
            .attr('cy', 0)
            .attr('stroke-width', '0px');
    });

    /**
     * Set the root SVGElement to either be any valid [d3 single
     * selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom
     * block element such as a div; or a dom element or d3 selection. This class is called
     * internally on chart initialization, but be called again to relocate the chart. However, it
     * will orphan any previously created SVGElements.
     * @method anchor
     * @memberof dc_graph.diagram
     * @instance
     * @param {anchorSelector|anchorNode|d3.selection} [parent]
     * @param {String} [chartGroup]
     * @return {String|node|d3.selection}
     * @return {dc_graph.diagram}
     */
    _chart.anchor = function(parent, chartGroup) {
        if (!arguments.length) {
            return _anchor;
        }
        if (parent) {
            if (parent.select && parent.classed) { // detect d3 selection
                _anchor = parent.node();
            } else {
                _anchor = parent;
            }
            _chart.root(d3.select(_anchor));
            _chart.root().classed(dc_graph.constants.CHART_CLASS, true);
            dc.registerChart(_chart, chartGroup);
        } else {
            throw new dc.errors.BadArgumentException('parent must be defined');
        }
        _chartGroup = chartGroup;
        return _chart;
    };

    /**
     * Returns the DOM id for the chart's anchored location.
     * @method anchorName
     * @memberof dc_graph.diagram
     * @instance
     * @return {String}
     */
    _chart.anchorName = function () {
        var a = _chart.anchor();
        if (a && a.id) {
            return a.id;
        }
        if (a && a.replace) {
            return a.replace('#', '');
        }
        return 'dc-graph' + _chart.chartID();
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## Legend

The dc_graph.legend will show labeled examples of nodes (and someday edges), within the frame of a dc_graph.diagram.
**/
dc_graph.legend = function() {
    var _legend = {}, _items;

    /**
     #### .x([value])
     Set or get x coordinate for legend widget. Default: 0.
     **/
    _legend.x = property(0);

    /**
     #### .y([value])
     Set or get y coordinate for legend widget. Default: 0.
     **/
    _legend.y = property(0);

    /**
     #### .gap([value])
     Set or get gap between legend items. Default: 5.
     **/
    _legend.gap = property(5);

    /**
     #### .nodeWidth([value])
     Set or get legend node width. Default: 30.
     **/
    _legend.nodeWidth = property(40);

    /**
     #### .nodeHeight([value])
     Set or get legend node height. Default: 30.
     **/
    _legend.nodeHeight = property(40);


    /**
     #### .exemplars([object])
     Specifies an object where the keys are the names of items to add to the legend, and the values are
     objects which will be passed to the accessors of the attached diagram in order to determine the
     drawing attributes. Alternately, if the key needs to be specified separately from the name, the
     function can take an array of {name, key, value} objects.
     **/
    _legend.exemplars = property({});

    _legend.parent = property(null);

    _legend.redraw = function() {
        var legend = _legend.parent().svg()
                .selectAll('g.dc-graph-legend')
                .data([0]);
        legend.enter().append('g')
            .attr('class', 'dc-graph-legend')
            .attr('transform', 'translate(' + _legend.x() + ',' + _legend.y() + ')');

        var node = legend.selectAll('.node')
                .data(_items, function(d) { return d.name; });
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node');
        nodeEnter.append('text')
            .attr('dy', '0.3em')
            .attr('class', 'legend-label');
        node
            .attr('transform', function(d, i) {
                return 'translate(' + _legend.nodeWidth()/2 + ',' + (_legend.nodeHeight() + _legend.gap())*(i+0.5) + ')';
            });
        node.select('text.legend-label')
            .attr('transform', 'translate(' + (_legend.nodeWidth()/2+_legend.gap()) + ',0)')
            .text(function(d) {
                return d.name;
            });
        _legend.parent()
            ._enterNode(nodeEnter)
            ._updateNode(node);
    };

    _legend.render = function() {
        var exemplars = _legend.exemplars();
        if(exemplars instanceof Array) {
            _items = exemplars.map(function(v) { return {name: v.name, orig: {key: v.key, value: v.value}, cola: {}}; });
        }
        else {
            _items = [];
            for(var item in exemplars)
                _items.push({name: item, orig: {key: item, value: exemplars[item]}, cola: {}});
        }
        _legend.redraw();
    };

    return _legend;
};

/**
 * In cola.js there are three factors which influence the positions of nodes:
 * * *edge length* suggestions, controlled by the
 * {@link #dc_graph.diagram+lengthStrategy lengthStrategy},
 * {@link #dc_graph.diagram+baseLength baseLength}, and
 * {@link #dc_graph.diagram+edgeLength edgeLength} parameters in dc.graph.js
 * * *automatic constraints* based on the global edge flow direction (`cola.flowLayout`) and overlap
 * avoidance parameters (`cola.avoidOverlaps`)
 * * *manual constraints* such as alignment, inequality and equality constraints in a dimension/axis.
 *
 * Generally when the
 * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints cola.js documentation mentions constraints},
 * it means the manual constraints.
 *
 * dc.graph.js allows generation of manual constraints using
 * {@link #dc_graph.diagram+constrain diagram.constrain} but it can be tedious to write these
 * functions because it usually means looping over the nodes and edges multiple times to
 * determine what classes or types of nodes to apply constraints to, and which edges should
 * take additional constraints.
 *
 * This utility creates a constraint generator function from a *pattern*, a graph where:
 *  1. Nodes represent *types* or classes of layout nodes, annotated with a specification
 * of how to match the nodes belonging each type.
 *  2. Edges represent *rules* to generate constraints. There are two kinds of rules:
 * <ol type='a'>
 *    <li>To generate additional constraints on edges besides the built-in ones, create a rules
 * between two different types. The rule will apply to any edges in the layout which match the
 * source and target types, and generate simple "left/right" constraints. (Note that "left" and
 * "right" in this context refer to sides of an inequality constraint `left + gap <= right`)
 *    <li>To generate constraints on a set of nodes, such as alignment, ordering, or circle
 * constraints, create a rule from a type to itself, a self edge.
 * </ol>
 * (It is also conceivable to want constraints between individual nodes which don't
 * have edges between them. This is not directly supported at this time; right now the workaround
 * is to create the edge but not draw it, e.g. by setting its {@link #dc_graph.diagram+edgeOpacity}
 * to zero. If you have a use-case for this, please
 * {@link https://github.com/dc-js/dc.graph.js/issues/new file an issue}.
 *
 * The pattern syntax is an embedded domain specific language designed to be terse without
 * restricting its power. As such, there are complicated rules for defaulting and inferring
 * parameters from other parameters. Since most users will want the simplest form, this document
 * will start from the highest level and then show how to use more complicated forms in order to
 * gain more control.
 *
 * Then we'll build back up from the ground up and show how inference works.
 * @name constraint_pattern
 * @memberof dc_graph
 * @param {dc_graph.diagram} diagram - the diagram to pull attributes from, mostly to determine
 * the keys of nodes and edge sources and targets
 * @param {Object} pattern - a graph which defines the constraints to be generated
 * @return {Function}
 */
dc_graph.constraint_pattern = function(pattern) {
    var types = {}, rules = [];

    pattern.nodes.forEach(function(n) {
        var id = n.id;
        var type = types[id] || (types[id] = {});
        // partitions could be done more efficiently; this is POC
        if(n.partition) {
            var partition = n.partition;
            var value = n.value || n.id;
            if(n.all || n.typename) {
                type.match = n.extract ?
                    function(n2) { return n.extract(n2.value[partition]); } :
                    function(n2) { return n2.value[partition]; };
                type.typename = n.typename || function(n2) { return partition + '=' + n2.value[partition]; };
            }
            else
                type.match = function(n2) { return n2.value[partition] === value; };
        }
        else if(n.match)
            type.match = n.match;
        else throw new Error("couldn't determine matcher for type " + JSON.stringify(n));
    });
    pattern.edges.forEach(function(e) {
        if(e.disable)
            return;
        var rule = {source: e.source, target: e.target};
        rule.produce = typeof e.produce === 'function' ? e.produce : function() {
            return clone(e.produce);
        };
        ['listname', 'wrap', 'reverse'].forEach(function(k) {
            if(e[k] !== undefined) rule[k] = e[k];
        });
        rules.push(rule);
    });

    return function(diagram, nodes, edges) {
        var constraints = [];
        var members = {};
        nodes.forEach(function(n) {
            var key = diagram.nodeKey.eval(n);
            for(var t in types) {
                var type = types[t], value = type.match(n.orig);
                if(value) {
                    var tname = type.typename ? type.typename(t, value) : t;
                    if(!members[tname])
                        members[tname] = {
                            nodes: [], // original ordering
                            whether: {} // boolean
                        };
                    members[tname].nodes.push(key);
                    members[tname].whether[key] = true;
                }
            }
        });
        // traversal of rules could be more efficient, again POC
        var edge_rules = rules.filter(function(r) {
            return r.source !== r.target;
        });
        var type_rules = rules.filter(function(r) {
            return r.source === r.target;
        });
        edges.forEach(function(e) {
            var source = diagram.edgeSource.eval(e),
                target = diagram.edgeTarget.eval(e);
            edge_rules.forEach(function(r) {
                if(members[r.source] && members[r.source].whether[source] &&
                   members[r.target] && members[r.target].whether[target]) {
                    var constraint = r.produce(members, nodes, edges);
                    if(r.reverse) {
                        constraint.left = target;
                        constraint.right = source;
                    }
                    else {
                        constraint.left = source;
                        constraint.right = target;
                    }
                    constraints.push(constraint);
                }
            });
        });
        type_rules.forEach(function(r) {
            if(!members[r.source])
                return;
            var constraint = r.produce(),
                listname = r.listname || r.produce.listname || 'nodes',
                wrap = r.wrap || r.produce.wrap || function(x) { return x; };
            constraint[listname] = members[r.source].nodes.map(wrap);
            constraints.push(constraint);
        });
        return constraints;
    };
};

// constraint generation convenience functions
dc_graph.gap_y = function(gap, equality) {
    return {
        axis: 'y',
        gap: gap,
        equality: !!equality
    };
};
dc_graph.gap_x = function(gap, equality) {
    return {
        axis: 'x',
        gap: gap,
        equality: !!equality
    };
};

function align_f(axis) {
    var ret = function() {
        return {
            type: 'alignment',
            axis: axis
        };
    };
    ret.listname = 'offsets';
    ret.wrap = function(x) { return {node: x, offset: 0}; };
    return ret;
}

dc_graph.align_y = function() {
    return align_f('y');
};
dc_graph.align_x = function() {
    return align_f('x');
};

dc_graph.order_x = function(gap, ordering) {
    return {
        type: 'ordering',
        axis: 'x',
        gap: 60,
        ordering: ordering
    };
};
dc_graph.order_y = function(gap, ordering) {
    return {
        type: 'ordering',
        axis: 'y',
        gap: 60,
        ordering: ordering
    };
};

// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_constraints = function(rootf, treef, xgap, ygap) {
    return function(diagram, nodes, edges) {
        var constraints = [];
        var x = 0;
        var dfs = dc_graph.depth_first_traversal({
            root: rootf,
            tree: treef,
            place: function(n, r, row) {
                if(row.length) {
                    var last = row[row.length-1];
                    constraints.push({
                        left: diagram.nodeKey.eval(last),
                        right: diagram.nodeKey.eval(n),
                        axis: 'x',
                        gap: x-last.foo_x,
                        equality: true
                    });
                }
                n.foo_x = x;
                // n.cola.x = x;
                // n.cola.y = r*ygap;
            },
            sib: function() {
                x += xgap;
            }
        });
        dfs(diagram, nodes, edges);
        return constraints;
    };
};

// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_positions = function(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    var x;
    nwidth = d3.functor(nwidth);
    function best_dist(left, right) {
        return (nwidth(left) + nwidth(right)) / 2;
    }
    var dfs = dc_graph.depth_first_traversal({
        init: function() {
            x = ofsx;
        },
        root: rootf,
        row: rowf,
        tree: treef,
        place: function(n, r, row) {
            if(row.length) {
                var left = row[row.length-1];
                var g = (nwidth(left) + nwidth(n)) / 2;
                x = Math.max(x, left.left_x + g);
            }
            n.left_x = x;
            n.hit_ins = 1;
            n.cola.y = r*ygap + ofsy;
        },
        sib: function(isroot, left, right) {
            var g = best_dist(left, right);
            if(isroot) g = g*1.5;
            x += g;
        },
        pop: function(n) {
            n.cola.x = (n.left_x + x)/2;
        },
        skip: function(n, indegree) {
            // rolling average of in-neighbor x positions
            n.cola.x = (n.hit_ins*n.cola.x + x)/++n.hit_ins;
            if(n.hit_ins === indegree)
                delete n.hit_ins;
        },
        finish: function(rows) {
            // this is disgusting. patch up any places where nodes overlap by scanning
            // right far enough to find the space, then fill from left to right at the
            // minimum gap
            rows.forEach(function(row) {
                var sort = row.sort(function(a, b) { return a.cola.x - b.cola.x; });
                var badi = null, badl = null, want;
                for(var i=0; i<sort.length-1; ++i) {
                    var left = sort[i], right = sort[i+1];
                    if(!badi) {
                        if(right.cola.x - left.cola.x < best_dist(left, right)) {
                            badi = i;
                            badl = left.cola.x;
                            want = best_dist(left, right);
                        } // else still not bad
                    } else {
                        want += best_dist(left, right);
                        if(i < sort.length - 2 && right.cola.x < badl + want)
                            continue; // still bad
                        else {
                            if(badi>0)
                                --badi; // might want to use more left
                            var l, limit;
                            if(i < sort.length - 2) { // found space before right
                                var extra = right.cola.x - (badl + want);
                                l = sort[badi].cola.x + extra/2;
                                limit = i+1;
                            } else {
                                l = Math.max(sort[badi].cola.x, badl - best_dist(sort[badi], sort[badi+1]) - (want - right.cola.x + badl)/2);
                                limit = sort.length;
                            }
                            for(var j = badi+1; j<limit; ++j) {
                                l += best_dist(sort[j-1], sort[j]);
                                sort[j].cola.x = l;
                            }
                            badi = badl = want = null;
                        }
                    }
                }
            });
        }
    });

    return dfs;
};


dc_graph.behavior = function(event_namespace, handlers) {
    var _behavior = {};

    /**
     #### .parent([object])
     Assigns this behavior to a diagram.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var chart;
            if(p) {
                var first = true;
                chart = p;
                p.on('drawn.' + event_namespace, function(node, edge, ehover) {
                    handlers.add_behavior(chart, node, edge, ehover);
                    if(first && handlers.first) {
                        handlers.first(chart, node, edge, ehover);
                        first = false;
                    }
                    else if(handlers.rest)
                        handlers.rest(chart, node, edge, ehover);
                });
            }
            else if(_behavior.parent()) {
                chart = _behavior.parent();
                chart.on('drawn.' + event_namespace, function(node, edge, ehover) {
                    handlers.remove_behavior(chart, node, edge, ehover);
                    chart.on('drawn.' + event_namespace, null);
                });
            }
            handlers.parent && handlers.parent(p);
        });
    return _behavior;
};

/**
 * Asynchronous [d3.tip](https://github.com/Caged/d3-tip) support for dc.graph.js
 *
 * Add tooltips to the nodes and edges of a graph using an asynchronous callback to get
 * the html to show.
 *
 * Optional - requires separately loading the d3.tip script and CSS (which are included in
 * dc.graph.js in `web/js/d3-tip/index.js` and `web/css/d3-tip/example-styles.css`)
 *
 * @name tip
 * @memberof dc_graph
 * @return {Object}
 **/
dc_graph.tip = function() {
    var _tip = {}, _d3tip = null;
    var _timeout;

    /**
     * Assigns this tip object to a diagram. It will show tips for nodes in that diagram.
     * Usually you will not call this function directly. Instead, attach the tip object
     * using `diagram.child('tip', dc_graph.tip())`
     * @name parent
     * @memberof dc_graph.tip
     * @instance
     * @param {dc_graph.diagram} [parent]
     * @return {dc_graph.diagram}
     **/
    _tip.parent = property(null)
        .react(function(p) {
            if(p)
                p.on('drawn.tip', function(node, edge, ehover) {
                    annotate(node, ehover);
                });
            else if(_tip.parent())
                _tip.parent().on('drawn.tip', null);
        });

    function fetch_and_show_content(fetcher) {
         return function(d) {
             var target = d3.event.target,
                 next = function() {
                     _tip[fetcher]()(d, function(content) {
                         _d3tip.show(content, target);
                     });
                 };

             if(_tip.delay()) {
                 clearTimeout(_timeout);
                 _timeout = setTimeout(next, _tip.delay());
             }
             else next();
         };
    }

    function hide_tip() {
        if(_timeout) {
            clearTimeout(_timeout);
            _timeout = null;
        }
        _d3tip.hide();
    }

    function annotate(node, ehover) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; })
                .direction(_tip.direction());
            _tip.parent().svg().call(_d3tip);
        }
        node
            .on('mouseover.tip', fetch_and_show_content('content'))
            .on('mouseout.tip', hide_tip);
        ehover
            .on('mouseover.tip', fetch_and_show_content('content'))
            .on('mouseout.tip', hide_tip);
    }

    /**
     * Specify the direction for tooltips. Currently supports the
     * [cardinal and intercardinaldirections](https://en.wikipedia.org/wiki/Points_of_the_compass) supported by
     * [d3.tip.direction](https://github.com/Caged/d3-tip/blob/master/docs/positioning-tooltips.md#tipdirection):
     * `'n'`, `'ne'`, `'e'`, etc.
     * @name direction
     * @memberof dc_graph.tip
     * @instance
     * @param {String} [direction='n']
     * @return {String}
     * @return {dc_graph.tip}
     * @example
     * // show all the attributes and values in the node and edge objects
     * var tip = dc_graph.tip();
     * tip.content(tip.table());
     **/
    _tip.direction = property('n');

    /**
     * Specifies the function to generate content for the tooltip. This function has the
     * signature `function(d, k)`, where `d` is the datum of the node being hovered over,
     * and `k` is a continuation. The function should fetch the content, asynchronously if
     * needed, and then pass html forward to `k`.
     * @name content
     * @memberof dc_graph.tip
     * @instance
     * @param {Function} [content]
     * @return {Function}
     * @example
     * // Default behavior: show title
     * var tip = dc_graph.tip().content(function(d, k) {
     *     k(_tip.parent() ? _tip.parent().nodeTitle.eval(d) : '');
     * });
     **/
    _tip.content = property(function(d, k) {
        k(_tip.parent() ? _tip.parent().nodeTitle.eval(d) : '');
    });

    _tip.delay = property(0);

    return _tip;
};

/**
 * Generates a handler which can be passed to `tip.content` to produce a table of the
 * attributes and values of the hovered object.
 *
 * Note: this interface is not great and is subject to change in the near term.
 * @name table
 * @memberof dc_graph.tip
 * @instance
 * @return {Function}
 * @example
 * // show all the attributes and values in the node and edge objects
 * var tip = dc_graph.tip();
 * tip.content(tip.table());
 **/
dc_graph.tip.table = function() {
    var gen = function(d, k) {
        d = d.orig.value;
        var keys = Object.keys(d).filter(d3.functor(gen.filter()))
                .filter(function(k) {
                    return d[k];
                });
        var table = d3.select(document.createElement('table'));
        var rows = table.selectAll('tr').data(keys);
        var rowsEnter = rows.enter().append('tr');
        rowsEnter.append('td').text(function(k) { return k; });
        rowsEnter.append('td').text(function(k) { return d[k]; });
        k(table.node().outerHTML); // optimizing for clarity over speed (?)
    };
    gen.filter = property(true);
    return gen;
};

// this currently only supports single selection with a click
// but it can be expanded with modifier-key clicks and rectangular selection etc.
dc_graph.select_nodes = function(props) {
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');
    var _selected = [];

    function add_behavior(chart, node, edge) {
        chart.cascade(50, true, conditional_properties(function(n) {
            return _selected.indexOf(n.orig.key) >= 0;
        }, null, props));
        node.on('click.select-nodes', function(d) {
            _selected = [chart.nodeKey.eval(d)];
            chart.refresh(node, edge);
            select_nodes_group.node_set_changed(_selected);
            d3.event.stopPropagation();
        });
        chart.svg().on('click.select-nodes', function(d) {
            _selected = [];
            chart.refresh(node, edge);
            select_nodes_group.node_set_changed(_selected);
        });
        // drop any selected which no longer exist in the diagram
        var present = node.data().map(function(d) { return d.orig.key; });
        var nselect = _selected.length;
        _selected = _selected.filter(function(k) { return present.indexOf(k) >= 0; });
        if(_selected.length !== nselect)
            select_nodes_group.node_set_changed(_selected);
    }

    function remove_behavior(chart, node, edge) {
        node.on('click.select-nodes', null);
        chart.svg().on('click.select-nodes', null);
        chart.cascade(50, false, props);
    }

    return dc_graph.behavior('select-nodes', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
        }
    });
};

dc_graph.select_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('select-nodes', function() {
        return d3.dispatch('node_set_changed');
    });

    return window.chart_registry.create_group('select-nodes', brushgroup);
};

dc_graph.highlight_neighbors = function(props) {
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_highlighted = false;
        });
    }

    function add_behavior(chart, node, edge) {
        chart.cascade(100, true, conditional_properties(null, function(e) {
            return e.dcg_highlighted;
        }, props));
        node
            .on('mouseover.highlight-neighbors', function(d) {
                edge.each(function(e) {
                    e.dcg_highlighted = e.source === d || e.target === d;
                });
                chart.refresh(node, edge);
            })
            .on('mouseout.highlight-neighbors', function(d) {
                clear_all_highlights(edge);
                chart.refresh(node, edge);
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        clear_all_highlights(edge);
        chart.cascade(100, false, props);
    }

    return dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
        }
    });
};


dc_graph.register_highlight_paths_group = function(pathsgroup) {
    window.chart_registry.create_type('highlight-paths', function() {
        return d3.dispatch('paths_changed', 'hover_changed', 'select_changed');
    });

    return window.chart_registry.create_group('highlight-paths', pathsgroup);
};

dc_graph.highlight_paths = function(pathprops, hoverprops, selectprops, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    selectprops = selectprops || {};
    var node_on_paths = {}, edge_on_paths = {}, selected = null, hoverpaths = null;

    function refresh() {
        if(_behavior.doRedraw())
            _behavior.parent().relayout().redraw();
        else
            _behavior.parent().refresh();
    }

    function paths_changed(nop, eop) {
        node_on_paths = nop;
        edge_on_paths = eop;
        selected = hoverpaths = null;
        refresh();
    }

    function hover_changed(hp) {
        if(hp !== hoverpaths) {
            hoverpaths = hp;
            refresh();
        }
    }

    function select_changed(sp) {
        if(sp !== selected) {
            selected = sp;
            refresh();
        }
    }

    function clear_all_highlights() {
        node_on_paths = {};
        edge_on_paths = {};
    }

    function contains_path(paths) {
        return function(path) {
            return paths.indexOf(path)>=0;
        };
    }

    // sigh
    function doesnt_contain_path(paths) {
        var cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function intersect_paths(pathsA, pathsB) {
        if(!pathsA || !pathsB)
            return false;
        return pathsA.some(contains_path(pathsB));
    }

    function toggle_paths(pathsA, pathsB) {
        if(!pathsA)
            return pathsB;
        else if(!pathsB)
            return pathsA;
        if(pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    function add_behavior(chart, node, edge, ehover) {
        chart
            .cascade(200, true, conditional_properties(function(n) {
                return !!node_on_paths[chart.nodeKey.eval(n)];
            }, function(e) {
                return !!edge_on_paths[chart.edgeKey.eval(e)];
            }, pathprops))
            .cascade(300, true, conditional_properties(function(n) {
                return intersect_paths(node_on_paths[chart.nodeKey.eval(n)], selected);
            }, function(e) {
                return intersect_paths(edge_on_paths[chart.edgeKey.eval(e)], selected);
            }, selectprops))
            .cascade(400, true, conditional_properties(function(n) {
                return intersect_paths(node_on_paths[chart.nodeKey.eval(n)], hoverpaths);
            }, function(e) {
                return intersect_paths(edge_on_paths[chart.edgeKey.eval(e)], hoverpaths);
            }, hoverprops));

        node
            .on('mouseover.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(node_on_paths[chart.nodeKey.eval(n)] || null);
            })
            .on('mouseout.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, node_on_paths[chart.nodeKey.eval(n)]));
            });


        ehover
            .on('mouseover.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(edge_on_paths[chart.edgeKey.eval(e)] || null);
            })
            .on('mouseout.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, edge_on_paths[chart.nodeKey.eval(n)]));
            });
    }

    function remove_behavior(chart, node, edge, ehover) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        ehover
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        clear_all_highlights();
        chart
            .cascade(200, false, pathprops)
            .cascade(300, false, selectprops)
            .cascade(400, false, hoverprops);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge, ehover) {
            remove_behavior(chart, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            var anchor = p.anchorName();
            highlight_paths_group.on('paths_changed.' + anchor, p ? paths_changed : null);
            highlight_paths_group.on('hover_changed.' + anchor, p ? hover_changed : null);
            highlight_paths_group.on('select_changed.' + anchor, p ? select_changed : null);
        }
    });

        // whether to do relayout & redraw (true) or just refresh (false)
        _behavior.doRedraw = property(false);

    return _behavior;
};


dc_graph.expand_collapse = function(get_degree, expand, collapse, dirs) {
    dirs = dirs || ['both'];
    if(dirs.length > 2)
        throw new Error('there are only two directions to expand in');

    function add_gradient_def(chart) {
        var gradient = chart.addOrRemoveDef('spike-gradient', true, 'linearGradient');
        gradient.attr({
            x1: '0%',
            y1: '0%',
            x2: '100%',
            y2: '0%',
            spreadMethod: 'pad'
        });
        gradient.selectAll('stop').data([[0,'black',1], [100, 'black', '0']])
            .enter().append('stop').attr({
                offset: function(d) {
                    return d[0] + '%';
                },
                'stop-color': function(d) {
                    return d[1];
                },
                'stop-opacity': function(d) {
                    return d[2];
                }
            });
    }

    function view_degree(chart, edge, dir, key) {
        var fil;
        switch(dir) {
        case 'out':
            fil = function(e) {
                return chart.edgeSource.eval(e) === key;
            };
            break;
        case 'in':
            fil = function(e) {
                return chart.edgeTarget.eval(e) === key;
            };
            break;
        case 'both':
            fil = function(e) {
                return chart.edgeSource.eval(e) === key || chart.edgeTarget.eval(e) === key;
            };
            break;
        }
        return edge.filter(fil).size();
    }

    function spike_directioner(rankdir, dir, n) {
        if(dir==='both')
            return function(i) {
                return Math.PI * (2 * i / n - 0.5);
            };
        else {
            var sweep = (n-1)*Math.PI/n, ofs;
            switch(rankdir) {
            case 'LR':
                ofs = 0;
                break;
            case 'TB':
                ofs = Math.PI/2;
                break;
            case 'RL':
                ofs = Math.PI;
                break;
            case 'BT':
                ofs = -Math.PI/2;
                break;
            }
            if(dir === 'in')
                ofs += Math.PI;
            return function(i) {
                return ofs + sweep * (-.5 + (n > 1 ? i / (n-1) : 0)); // avoid 0/0
            };
        }
    }

    function draw_selected(chart, node, edge) {
        var spike = node
            .selectAll('g.spikes')
            .data(function(d) {
                return (d.dcg_expand_selected &&
                        (!d.dcg_expanded || !d.dcg_expanded[d.dcg_expand_selected.dir])) ?
                    [d] : [];
            });
        spike.exit().remove();
        spike
          .enter().insert('g', ':first-child')
            .classed('spikes', true);
        var rect = spike
          .selectAll('rect.spike')
            .data(function(d) {
                var key = chart.nodeKey.eval(d);
                var dir = d.dcg_expand_selected.dir,
                    n = d.dcg_expand_selected.n,
                    af = spike_directioner(chart.rankdir(), dir, n),
                    ret = Array(n);
                for(var i = 0; i<n; ++i) {
                    var a = af(i);
                    ret[i] = {
                        a: a * 180 / Math.PI,
                        x: Math.cos(a) * d.dcg_rx*.9,
                        y: Math.sin(a) * d.dcg_ry*.9
                    };
                }
                return ret;
            });
        rect
          .enter().append('rect')
            .classed('spike', true)
            .attr({
                width: 25,
                height: 3,
                fill: 'url(#spike-gradient)',
                rx: 1,
                ry: 1,
                x: 0,
                y: 0
            });
        rect.attr('transform', function(d) {
            return 'translate(' + d.x + ',' + d.y + ') rotate(' + d.a + ')';
        });
        rect.exit().remove();
    }

    function clear_selected(chart, node, edge) {
        node.each(function(n) {
            n.dcg_expand_selected = null;
        });
        draw_selected(chart, node, edge);
    }

    function collapsible(chart, edge, key, dir) {
        return view_degree(chart, edge, dir, key) === 1;
    }

    function zonedir(chart, event, dirs, d) {
        if(dirs.length === 1) // we assume it's ['out', 'in']
            return dirs[0];
        var bound = chart.root().node().getBoundingClientRect();
        var invert = chart.invertCoord([event.clientX - bound.left,event.clientY - bound.top]),
            x = invert[0],
            y = invert[1];
        switch(chart.rankdir()) {
        case 'TB':
            return y > d.cola.y ? 'out' : 'in';
        case 'BT':
            return y < d.cola.y ? 'out' : 'in';
        case 'LR':
            return x > d.cola.x ? 'out' : 'in';
        case 'RL':
            return x < d.cola.x ? 'out' : 'in';
        }
        throw new Error('unknown rankdir ' + chart.rankdir());
    }


    function add_behavior(chart, node, edge) {
        function mousemove(d) {
            var dir = zonedir(chart, d3.event, dirs, d);
            var nk = chart.nodeKey.eval(d);
            Promise.resolve(get_degree(nk, dir)).then(function(degree) {
                var spikes = {
                    dir: dir,
                    n: Math.max(0, degree - view_degree(chart, edge, dir, nk)) // be tolerant of inconsistencies
                };
                node.each(function(n) {
                    n.dcg_expand_selected = n === d ? spikes : null;
                });
                draw_selected(chart, node, edge);
            });
        }

        function click(d) {
            var event = d3.event;
            console.log(event.type);
            function action() {
                var dir = zonedir(chart, event, dirs, d);
                d.dcg_expanded = d.dcg_expanded || {};
                if(!d.dcg_expanded[dir]) {
                    expand(chart.nodeKey.eval(d), dir, event.type === 'dblclick');
                    d.dcg_expanded[dir] = true;
                }
                else {
                    collapse(chart.nodeKey.eval(d), collapsible.bind(null, chart, edge, dir), dir);
                    d.dcg_expanded[dir] = false;
                }
                draw_selected(chart, node, edge);
                d.dcg_dblclk_timeout = null;
            }
            return action();
            // distinguish click and double click - kind of fishy but seems to work
            // basically, wait to see if a click becomes a dblclick - but it's even worse
            // because you'll receive a second click before the dblclick on most browsers
            if(d.dcg_dblclk_timeout) {
                window.clearTimeout(d.dcg_dblclk_timeout);
                if(event.type === 'dblclick')
                    action();
                d.dcg_dblclk_timeout = null;
            }
            else d.dcg_dblclk_timeout = window.setTimeout(action, 200);
        }

        node
            .on('mouseover.expand-collapse', mousemove)
            .on('mousemove.expand-collapse', mousemove)
            .on('mouseout.expand-collapse', function(d) {
                clear_selected(chart, node, edge);
            })
            .on('click', click)
            .on('dblclick', click);
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.expand-collapse', null)
            .on('mouseout.expand-collapse', null);
        clear_selected(chart, node);
    }

    return dc_graph.behavior('expand-collapse', {
        add_behavior: add_behavior,
        first: add_gradient_def,
        remove_behavior: remove_behavior
    });
};

// load a graph from various formats and return the data in consistent {nodes, links} format
dc_graph.load_graph = function() {
    // ignore any query parameters for checking extension
    function ignore_query(file) {
        if(!file)
            return null;
        return file.replace(/\?.*/, '');
    }
    var file1, file2, callback;
    file1 = arguments[0];
    if(arguments.length===3) {
        file2 = arguments[1];
        callback = arguments[2];
    }
    else if(arguments.length===2) {
        callback = arguments[1];
    }
    else throw new Error('need two or three arguments');

    if(file2) {
        // this is not general - really titan-specific
        queue()
            .defer(d3.json, file1)
            .defer(d3.json, file2)
            .await(function(error, nodes, edges) {
                if(error)
                    callback(error, null);
                else
                    callback(null, {nodes: nodes.results, edges: edges.results});
            });
    }
    else if(/\.json$/.test(ignore_query(file1)))
        d3.json(file1, callback);
    else if(/\.gv|\.dot$/.test(ignore_query(file1)))
        d3.text(file1, function (error, f) {
            if(error) {
                callback(error, null);
                return;
            }
            var digraph = graphlibDot.parse(f);

            var nodeNames = digraph.nodes();
            var nodes = new Array(nodeNames.length);
            nodeNames.forEach(function (name, i) {
                var node = nodes[i] = digraph._nodes[nodeNames[i]];
                node.id = i;
                node.name = name;
            });

            var edgeNames = digraph.edges();
            var edges = [];
            edgeNames.forEach(function(e) {
                var edge = digraph._edges[e];
                edges.push({
                    source: digraph._nodes[edge.u].id,
                    target: digraph._nodes[edge.v].id,
                    sourcename: edge.u,
                    targetname: edge.v
                });
            });
            var graph = {nodes: nodes, links: edges};
            callback(null, graph);
        });
};

function can_get_graph_from_this(data) {
    return (data.nodes || data.vertices) &&  (data.edges || data.links);
}

// general-purpose reader of various json-based graph formats
// (esp but not limited to titan graph database-like formats)
// this could be generalized a lot
dc_graph.munge_graph = function(data, nodekeyattr, sourceattr, targetattr) {
    // we want data = {nodes, edges} and the field names for keys; find those in common json formats
    var nodes, edges, nka = nodekeyattr || "name",
        sa = sourceattr || "sourcename", ta = targetattr || "targetname";

    if(!can_get_graph_from_this(data)) {
        var wrappers = ['database', 'response'];
        var wi = wrappers.findIndex(function(f) { return data[f] && can_get_graph_from_this(data[f]); });
        if(wi<0)
            throw new Error("couldn't find the data!");
        data = data[wrappers[wi]];
    }
    edges = data.edges || data.links;
    nodes = data.nodes || data.vertices;

    function find_attr(o, attrs) {
        return attrs.filter(function(a) { return !!o[a]; });
    }

    //var edgekeyattr = "id";
    var edge0 = edges[0];
    if(edge0[sa] === undefined) {
        var sourceattrs = sourceattr ? [sourceattr] : ['source_ecomp_uid', "node1", "source", "tail"],
            targetattrs = targetattr ? [targetattr] : ['target_ecomp_uid', "node2", "target", "head"];
        //var edgekeyattrs = ['id', '_id', 'ecomp_uid'];
        var edgewrappers = ['edge'];
        if(edge0.node0 && edge0.node1) { // specific conflict here
            sa = 'node0';
            ta = 'node1';
        }
        else {
            var candidates = find_attr(edge0, sourceattrs);
            if(!candidates.length) {
                wi = edgewrappers.findIndex(function(w) {
                    return edge0[w] && find_attr(edge0[w], sourceattrs).length;
                });
                if(wi<0) {
                    if(sourceattr)
                        throw new Error('sourceattr ' + sa + " didn't work");
                    else
                        throw new Error("didn't find any source attr");
                }
                edges = edges.map(function(e) { return e[edgewrappers[wi]]; });
                edge0 = edges[0];
                candidates = find_attr(edge0, sourceattrs);
            }
            if(candidates.length > 1)
                console.warn('found more than one possible source attr', candidates);
            sa = candidates[0];

            candidates = find_attr(edge0, targetattrs);
            if(!candidates.length) {
                if(targetattr && !edge0[targetattr])
                    throw new Error('targetattr ' + ta + " didn't work");
                else
                    throw new Error("didn't find any target attr");
            }
            if(candidates.length > 1)
                console.warn('found more than one possible target attr', candidates);
            ta = candidates[0];

            /*
             // we're currently assembling our own edgeid
            candidates = find_attr(edge0, edgekeyattrs);
            if(!candidates.length)
                throw new Error("didn't find any edge key");
            if(candidates.length > 1)
                console.warn('found more than one edge key attr', candidates);
            edgekeyattr = candidates[0];
             */
        }
    }
    var node0 = nodes[0];
    if(node0[nka] === undefined) {
        var nodekeyattrs = nodekeyattr ? [nodekeyattr] : ['ecomp_uid', 'id', '_id'];
        var nodewrappers = ['vertex'];
        candidates = find_attr(node0, nodekeyattrs);
        if(!candidates.length) {
            wi = nodewrappers.findIndex(function(w) {
                return node0[w] && find_attr(node0[w], nodekeyattrs).length;
            });
            if(wi<0) {
                if(nodekeyattr)
                    throw new Error('nodekeyattr ' + nka + " didn't work");
                else
                    throw new Error("couldn't find the node data");
            }
            nodes = nodes.map(function(n) { return n[nodewrappers[wi]]; });
            node0 = nodes[0];
            candidates = find_attr(node0, nodekeyattrs);
        }
        if(candidates.length > 1)
            console.warn('found more than one possible node key attr', candidates);
        nka = candidates[0];
    }

    return {
        nodes: nodes,
        edges: edges,
        nodekeyattr: nka,
        sourceattr: sa,
        targetattr: ta
    };
}

/* for the special case where there will be exactly one or zero items in a group,
 a reasonable reduction is just to use the row or null.
 this could be useful outside dc.graph (esp e.g bubble charts, scatter plots where each
 observation is either shown or not) but it would have to be cleaned up a bit */

dc_graph.flat_group = (function() {
    var reduce_01 = {
        add: function(p, v) { return v; },
        remove: function() { return null; },
        init: function() { return null; }
    };
    // now we only really want to see the non-null values, so make a fake group
    function non_null(group) {
        return {
            all: function() {
                return group.all().filter(function(kv) {
                    return kv.value !== null;
                });
            }
        };
    }

    function dim_group(ndx, id_accessor) {
        var dimension = ndx.dimension(id_accessor);
        return {
            crossfilter: ndx,
            dimension: dimension,
            group: non_null(dimension.group().reduce(reduce_01.add,
                                                     reduce_01.remove,
                                                     reduce_01.init))
        };
    }

    return {
        make: function(vec, id_accessor) {
            var ndx = crossfilter(vec);
            return dim_group(ndx, id_accessor);
        },
        another: function(ndx, id_accessor) { // wretched name
            return dim_group(ndx, id_accessor);
        }
    };
})();



// make crossfilter-suitable data from d3.nest {key, values} format
dc_graph.convert_nest = function(nest, attrs, nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    inherit = inherit || {};
    var level = Object.keys(inherit).length;
    if(attrs.length) {
        var attr = attrs.shift();
        var nodes = [], edges = [];
        var children = nest.map(function(v) {
            inherit[attr] = v.key;
            var child = uuid();
            var node = clone(inherit);
            node[nodeKeyAttr] = child;
            node.name = attr + ':' + v.key;
            node._level = level+1;
            nodes.push(node);
            if(parent) {
                var edge = {};
                edge[edgeSourceAttr] = parent;
                edge[edgeTargetAttr] = child;
                edges.push(edge);
            }
            var recurse = dc_graph.convert_nest(v.values, attrs.slice(0), nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, child, clone(inherit));
            return recurse;
        });
        return {nodes: Array.prototype.concat.apply(nodes, children.map(dc.pluck('nodes'))),
                edges: Array.prototype.concat.apply(edges, children.map(dc.pluck('edges')))};
    }
    else return {nodes: nest.map(function(v) {
        v._level = level+1;
        return v;
    }), edges: nest.map(function(v) {
        var edge = {};
        edge[edgeSourceAttr] = parent;
        edge[edgeTargetAttr] = v[nodeKeyAttr];
        return edge;
    })};
};

dc_graph.convert_adjacency_list = function(nodes, namesIn, namesOut) {
    // adjacenciesAttr, edgeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    var edges = Array.prototype.concat.apply([], nodes.map(function(n) {
        return n[namesIn.adjacencies].map(function(adj) {
            var e = {};
            if(namesOut.edgeKey)
                e[namesOut.edgeKey] = uuid();
            e[namesOut.edgeSource] = n[namesIn.nodeKey];
            e[namesOut.edgeTarget] = namesIn.targetKey ? adj[namesIn.targetKey] : adj;
            if(namesOut.adjacency)
                e[namesOut.adjacency] = adj;
            return e;
        });
    }));
    return {
        nodes: nodes,
        edges: edges
    };
};


dc_graph.path_reader = function(pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    var _intervals, _intervalTree, _time;

    function register_path_objs(path, nop, eop) {
        reader.elementList.eval(path).forEach(function(element) {
            var key, paths;
            switch(reader.elementType.eval(element)) {
            case 'node':
                key = reader.nodeKey.eval(element);
                paths = nop[key] = nop[key] || [];
                break;
            case 'edge':
                key = reader.edgeSource.eval(element) + '-' + reader.edgeTarget.eval(element);
                paths = eop[key] = eop[key] || [];
                break;
            }
            paths.push(path);
        });
    }

    var reader = {
        pathList: property(identity, false),
        timeRange: property(null, false),
        elementList: property(identity, false),
        elementType: property(null, false),
        nodeKey: property(null, false),
        edgeSource: property(null, false),
        edgeTarget: property(null, false),
        clear: function() {
            highlight_paths_group.paths_changed({}, {}, []);
        },
        data: function(data) {
            var nop = {}, eop = {}, allpaths = [], has_ranges;
            reader.pathList.eval(data).forEach(function(path) {
                if((path._range = reader.timeRange.eval(path))) { // ugh modifying user data
                    if(has_ranges===false)
                        throw new Error("can't have a mix of ranged and non-ranged paths");
                    has_ranges = true;
                } else {
                    if(has_ranges===true)
                        throw new Error("can't have a mix of ranged and non-ranged paths");
                    has_ranges = false;
                    register_path_objs(path, nop, eop);
                }
                allpaths.push(path);
            });
            if(has_ranges) {
                _intervals = allpaths.map(function(path) {
                    var interval = [path._range[0].getTime(), path._range[1].getTime()];
                    interval.path = path;
                    return interval;
                });
                // currently must include lysenko-interval-tree separately
                _intervalTree = lysenkoIntervalTree(_intervals);
                if(_time)
                    this.setTime(_time);
            } else {
                _intervals = null;
                _intervalTree = null;
                highlight_paths_group.paths_changed(nop, eop, allpaths);
            }
        },
        getIntervals: function() {
            return _intervals;
        },
        setTime: function(t) {
            if(t && _intervalTree) {
                var paths = [], nop = {}, eop = {};
                _intervalTree.queryPoint(t.getTime(), function(interval) {
                    paths.push(interval.path);
                    register_path_objs(interval.path, nop, eop);
                });
                highlight_paths_group.paths_changed(nop, eop, paths);
            }
            _time = t;
        }
    };

    return reader;
};


dc_graph.path_selector = function(parent, reader, pathsgroup, chartgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    var root = d3.select(parent);
    var paths_ = [];
    var hovered = null, selected = null;

    // unfortunately these functions are copied from dc_graph.highlight_paths
    function contains_path(paths) {
        return function(path) {
            return paths ? paths.indexOf(path)>=0 : false;
        };
    }

    function doesnt_contain_path(paths) {
        var cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function toggle_paths(pathsA, pathsB) {
        if(!pathsA)
            return pathsB;
        else if(!pathsB)
            return pathsA;
        if(pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    // this should use the whole cascading architecture
    // and allow customization rather than hardcoding everything
    // in fact, you can't even reliably overlap attributes without that (so we don't)

    function draw_paths(paths) {
        var p2 = root.selectAll('span.path-selector').data(paths);
        p2.enter()
            .append('span')
            .attr('class', 'path-selector')
            .style({
                'border-width': '1px',
                'border-style': 'solid',
                'border-color': 'grey',
                'border-radius': '4px',
                'display': 'inline-block',
                padding: '4px',
                cursor: 'pointer',
                margin: '5px'
            });
        p2.exit().transition(1000).attr('opacity', 0).remove();
        p2.text(function(d, i) {
            return 'path ' + (i+1) + ' (' + reader.elementList.eval(d).length + ')';
        })
            .on('mouseover', function(d) {
                highlight_paths_group.hover_changed([d]);
            })
            .on('mouseout', function(d) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click', function(d) {
                highlight_paths_group.select_changed(toggle_paths(selected, [d]));
            });
        var no_paths = root.selectAll('span.no-paths').data(paths.length === 0 ? [0] : []);
        no_paths.exit().remove();
        no_paths.enter()
          .append('span')
            .attr('class', 'no-paths');
        no_paths
            .classed('error', !!selector.error_text())
            .text(selector.error_text() || (selector.queried() ? selector.zero_text() : selector.default_text()));
    }

    function draw_hovered() {
        var is_hovered = contains_path(hovered);
        root.selectAll('span.path-selector')
            .style({
                'border-color': function(d, i) { return is_hovered(d) ? '#e41a1c' : 'grey'; },
                'border-width': function(d, i) { return (is_hovered(d) ? 2 : 1) + 'px'; },
                padding: function(d, i) { return (is_hovered(d) ? 3 : 4) + 'px'; }
            });
    }

    function draw_selected() {
        var is_selected = contains_path(selected);
        root.selectAll('span.path-selector')
            .style({
                'background-color': function(d, i) { return is_selected(d) ? '#1c1ae6' : 'white'; },
                'color': function(d, i) { return is_selected(d) ? 'white' : 'black'; }
            });
    }

    highlight_paths_group
        .on('paths_changed.selector', function(nop, eop, paths) {
            hovered = selected = null;
            paths_ = paths;
            selector.redraw();
        })
        .on('hover_changed.selector', function(hpaths) {
            hovered = hpaths;
            draw_hovered();
        })
        .on('select_changed.selector', function(spaths) {
            selected = spaths;
            draw_selected();
        });
    var selector = {
        default_text: property('Nothing here'),
        zero_text: property('No paths'),
        error_text: property(null),
        queried: property(false),
        redraw: function() {
            draw_paths(paths_);
            draw_hovered();
            draw_selected();
        },
        render: function() {
            this.redraw();
            return this;
        }
    };
    dc.registerChart(selector, chartgroup);
    return selector;
}

dc_graph.node_name = function(i) {
    // a-z, A-Z, aa-Zz, then quit
    if(i<26)
        return String.fromCharCode(97+i);
    else if(i<52)
        return String.fromCharCode(65+i-26);
    else if(i<52*52)
        return dc_graph.node_name(Math.floor(i/52)) + dc_graph.node_name(i%52);
    else throw new Error("no, that's too large");
};
dc_graph.node_object = function(i, attrs) {
    attrs = attrs || {};
    return _.extend({
        id: i,
        name: dc_graph.node_name(i)
    }, attrs);
};

dc_graph.edge_object = function(namef, i, j, attrs) {
    attrs = attrs || {};
    return _.extend({
        source: i,
        target: j,
        sourcename: namef(i),
        targetname: namef(j)
    }, attrs);
};

dc_graph.generate = function(type, args, env, callback) {
    var nodes, edges, i, j;
    var nodePrefix = env.nodePrefix || '';
    var namef = function(i) {
        return nodes[i].name;
    };
    var N = args[0];
    var linkLength = env.linkLength || 30;
    switch(type) {
    case 'clique':
    case 'cliquestf':
        nodes = new Array(N);
        edges = [];
        for(i = 0; i<N; ++i) {
            nodes[i] = dc_graph.node_object(i, {circle: "A", name: nodePrefix+dc_graph.node_name(i)});
            for(j=0; j<i; ++j)
                edges.push(dc_graph.edge_object(namef, i, j, {notLayout: true, undirected: true}));
        }
        if(type==='cliquestf')
            for(i = 0; i<N; ++i) {
                nodes[i+N] = dc_graph.node_object(i+N);
                nodes[i+2*N] = dc_graph.node_object(i+2*N);
                edges.push(dc_graph.edge_object(namef, i, i+N, {undirected: true}));
                edges.push(dc_graph.edge_object(namef, i, i+2*N, {undirected: true}));
            }
        break;
    case 'wheel':
        nodes = new Array(N);
        for(i = 0; i < N; ++i)
            nodes[i] = dc_graph.node_object(i, {name: nodePrefix+dc_graph.node_name(i)});
        edges = dc_graph.wheel_edges(namef, _.range(N), N*linkLength/2);
        var rimLength = edges[0].distance;
        for(i = 0; i < args[1]; ++i)
            for(j = 0; j < N; ++j)
                edges.push(dc_graph.edge_object(namef, j, (j+1)%N, {distance: rimLength, par: i+2}));
        break;
    default:
        throw new Error("unknown generation type "+type);
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
};

dc_graph.wheel_edges = function(namef, nindices, R) {
    var N = nindices.length;
    var edges = [];
    var strutSkip = Math.floor(N/2),
        rimLength = 2 * R * Math.sin(Math.PI / N),
        strutLength = 2 * R * Math.sin(strutSkip * Math.PI / N);
    for(var i = 0; i < N; ++i)
        edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+1)%N], {distance: rimLength}));
    for(i = 0; i < N/2; ++i) {
        edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+strutSkip)%N], {distance: strutLength}));
        if(N%2 && i != Math.floor(N/2))
            edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+N-strutSkip)%N], {distance: strutLength}));
    }
    return edges;
};

dc_graph.line_breaks = function(charexp, max_line_length) {
    var regexp = new RegExp(charexp, 'g');
    return function(n) {
        var s = n.key;
        var result;
        var line = '', lines = [], part, i = 0;
        do {
            result = regexp.exec(s);
            if(result)
                part = s.slice(i, regexp.lastIndex);
            else
                part = s.slice(i);
            if(line.length + part.length > max_line_length && line.length > 0) {
                lines.push(line);
                line = '';
            }
            line += part;
            i = regexp.lastIndex;
        }
        while(result !== null);
        lines.push(line);
        return lines;
    };
};

dc_graph.build_type_graph = function(nodes, edges, nkey, ntype, esource, etarget) {
    var nmap = {}, tnodes = {}, tedges = {};
    nodes.forEach(function(n) {
        nmap[nkey(n)] = n;
        var t = ntype(n);
        if(!tnodes[t])
            tnodes[t] = {type: t};
    });
    edges.forEach(function(e) {
        var source = esource(e), target = etarget(e), sn, tn;
        if(!(sn = nmap[source]))
            throw new Error('source key ' + source + ' not found!');
        if(!(tn = nmap[target]))
            throw new Error('target key ' + target + ' not found!');
        var etype = ntype(sn) + '/' + ntype(tn);
        if(!tedges[etype])
            tedges[etype] = {
                type: etype,
                source: ntype(sn),
                target: ntype(tn)
            };
    });
    return {
        nodes: Object.keys(tnodes).map(function(k) { return tnodes[k]; }),
        edges: Object.keys(tedges).map(function(k) { return tedges[k]; })
    };
}

dc_graph.d3 = d3;
dc_graph.crossfilter = crossfilter;
dc_graph.dc = dc;

return dc_graph;
}
    if (typeof define === 'function' && define.amd) {
        define(["d3", "crossfilter", "dc"], _dc_graph);
    } else if (typeof module == "object" && module.exports) {
        var _d3 = require('d3');
        var _crossfilter = require('crossfilter');
        if (typeof _crossfilter !== "function") {
            _crossfilter = _crossfilter.crossfilter;
        }
        var _dc = require('dc');
        module.exports = _dc_graph(_d3, _crossfilter, _dc);
    } else {
        this.dc_graph = _dc_graph(d3, crossfilter, dc);
    }
}
)();

//# sourceMappingURL=dc.graph.js.map