/*!
 *  dc.graph 0.1.0
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright (c) 2015 AT&T Intellectual Property
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
 * @version 0.1.0
 * @example
 * // Example chaining
 * chart.width(600)
 *      .height(400)
 *      .nodeDimension(nodeDim)
 *      .nodeGroup(nodeGroup);
 */

var dc_graph = {
    version: '0.1.0'
};

var property = function (defaultValue) {
    var value = defaultValue, react = null;
    var ret = function (_) {
        if (!arguments.length) {
            return value;
        }
        if(react)
            react(_);
        value = _;
        return this;
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

// we want to allow either values or functions to be passed to specify parameters.
// if a function, the function needs a preprocessor to extract the original key/value
// pair from the wrapper object we put it in.
function param(v) {
    return dc_graph.functor_wrap(v, function(x) {
        return x.orig;
    });
}

// because i don't think we need to bind edge point data (yet!)
var bez_cmds = {
    1: 'L', 2: 'Q', 3: 'C'
};

function generate_path(pts, bezness, close) {
    var cats = ['M', pts[0], ',', pts[1]], remain = bezness;
    var hasNaN = false;
    for(var i = 2; i < pts.length; i += 2) {
        if(isNaN(pts[i]) || isNaN(pts[i+1]))
            hasNaN = true;
        cats.push(remain===bezness ? bez_cmds[bezness] : ' ', pts[i], ',', pts[i+1]);
        if(--remain===0)
            remain = bezness;
    }
    if(remain!=bezness)
        console.log("warning: pts.length didn't match bezness", pts, bezness);
    if(close)
        cats.push('Z');
    return cats.join('');
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
    var _chart = {};
    var _svg = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _d3cola = null;
    var _dispatch = d3.dispatch('end', 'start', 'drawn');
    var _stats = {};
    var _nodes_snapshot, _edges_snapshot;
    var _children = {};
    var _running = false; // for detecting concurrency issues

    /**
     * Set or get the width attribute of the diagram. See `.height` below.
     * @name width
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [width=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.width = property(200).react(resizeSvg);

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
    _chart.height = property(200).react(resizeSvg);

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
     * node. This determines the height of nodes, and the width, if `nodeFitLabel` is
     * false.
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
     * Set or get the padding or minimum distance, in pixels, between nodes in the diagram.
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
     * `shape`: ellipse, polygon

     * If `shape = polygon`:
     * * `sides`: number of sides for a polygon
     * @name nodeShape
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Object} [nodeShape={shape: 'ellipse'}]
     * @return {Function|Object}
     * @return {dc_graph.diagram}
     **/
    _chart.nodeShape = property({shape: 'ellipse'});

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
     * Whether to highlight neighboring edges when hovering over a node. Not completely working
     * yet.
     * @name highlightNeighbors
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [highlightNeighbors]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _chart.highlightNeighbors = property(false);

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
     * edge length, flow, and overlap prevention. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints the cola.js wiki}
     * for more details.

     * For convenience, dc.graph.js implements a other constraints on top of those implemented
     * by cola.js:
     * * 'ordering' - the nodes will be ordered on the specified `axis` according to the keys
     * returned by the `ordering` function, by creating separation constraints using the
     * specified `gap`.
     * * 'circle' - (experimental) the nodes will be placed in a circle using "wheel"
     * constraints as described in
     * {@link http://www.csse.monash.edu.au/~tdwyer/Dwyer2009FastConstraints.pdf Scalable, Versatile, and Simple Constrained Graph Layout}
     * *Although this is not as performant or stable as might be desired, it may work for
     * simple cases.*

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
     * @param {Number} [parallelEdgeOffset=5]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _chart.parallelEdgeOffset = property(5);

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
     * When `layoutUnchanged` is false, call this when changing a parameter in order to force
     * layout to happen again. (Yes, probably should not be necessary.)
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
     * If it is necessary to modify the cola layout object after it is created, this function
     * can be called to add a modifier function which takes the layout object and sets
     * additional parameters on it.
     * @name modLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [modLayout]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _chart.modLayout = property(function(layout) {});

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
     * @example
     * // Display tooltips on node hover, via the d3-tip library
     * var tip = dc_graph.tip()
     * tip.content(function(d, k) {
     *   // you can do an asynchronous call here, e.g. d3.json, if you need
     *   // to fetch data to show the tooltip - just call k() with the content
     *   k("This is <em>" + d.orig.value.name + "</em>");
     * });
     * diagram.child('tip', tip);
     * @return {Object} [object] - the child object to add
     * @return {dc_graph.diagram}
     **/
    _chart.child = function(id, object) {
        if(_children[id])
            _children[id].parent(null);
        _children[id] = object;
        object.parent(_chart);
        return _chart;
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
        _d3cola = cola.d3adaptor()
            .avoidOverlaps(true)
            .size([_chart.width(), _chart.height()])
            .handleDisconnected(_chart.handleDisconnected());

        switch(_chart.lengthStrategy()) {
        case 'symmetric':
            _d3cola.symmetricDiffLinkLengths(_chart.baseLength());
            break;
        case 'jaccard':
            _d3cola.jaccardLinkLengths(_chart.baseLength());
            break;
        case 'individual':
            _d3cola.linkDistance(function(e) {
                var d = e.orig ? param(_chart.edgeLength())(e) :
                        e.internal && e.internal.distance;
                return d || _chart.baseLength();
            });
            break;
        case 'none':
        default:
        }

        if(_chart.modLayout())
            _chart.modLayout()(_d3cola);
    }

    function edge_id(d) {
        return 'edge-' + param(_chart.edgeKey())(d).replace(/[^\w-_]/g, '-');
    }

    // node and edge objects shared with cola.js, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};

    _chart._buildNode = function(node, nodeEnter) {
        if(_chart.nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(infer_shape(_chart));
        var changedShape = node.filter(shape_changed(_chart));
        changedShape.select('.node-shape').remove();
        changedShape.each(infer_shape(_chart));
        changedShape.insert(shape_element(_chart), ':first-child')
            .attr('class', 'node-shape');
        nodeEnter.append(shape_element(_chart))
            .attr('class', 'node-shape');
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('fill', param(_chart.nodeLabelFill()));
        node.select('title')
            .text(param(_chart.nodeTitle()));
        node.select('text.node-label')
            .text(param(_chart.nodeLabel()))
            .each(fit_shape(_chart));
        node.select('.node-shape')
            .each(shape_attrs(_chart))
            .attr({
                stroke: param(_chart.nodeStroke()),
                'stroke-width': param(_chart.nodeStrokeWidth()),
                fill: compose(_chart.nodeFillScale() || identity, param(_chart.nodeFill()))
            });
    };

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
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

        if(_d3cola)
            _d3cola.stop();
        if(_chart.initLayoutOnRedraw())
            initLayout();

        // ordering shouldn't matter, but we support ordering in case it does
        if(_chart.nodeOrdering()) {
            nodes = crossfilter.quicksort.by(_chart.nodeOrdering())(nodes.slice(0), 0, nodes.length);
        }
        if(_chart.edgeOrdering()) {
            edges = crossfilter.quicksort.by(_chart.edgeOrdering())(edges.slice(0), 0, edges.length);
        }

        // create or re-use the objects cola.js will manipulate
        function wrap_node(v, i) {
            var key = _chart.nodeKey()(v);
            if(!_nodes[key]) _nodes[key] = {};
            var v1 = _nodes[key];
            v1.orig = v;
            var fixed;
            if(_chart.nodeFixed())
                fixed = param(_chart.nodeFixed())(v1);
            if(fixed) {
                v1.x = v.x;
                v1.y = v.y;
                v1.fixed = true;
            }
            else
                v1.fixed = false;
            keep_node[key] = true;
            return v1;
        }
        function wrap_edge(e) {
            var key = _chart.edgeKey()(e);
            if(!_edges[key]) _edges[key] = {};
            var e1 = _edges[key];
            e1.orig =  e;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[_chart.edgeSource()(e)];
            e1.target = _nodes[_chart.edgeTarget()(e)];
            keep_edge[key] = true;
            return e1;
        }
        // delete any objects from last round that are no longer used
        // this is mostly so cola.js won't get confused by old attributes
        var keep_node = {}, keep_edge = {};
        var wnodes = nodes.map(wrap_node);
        for(var vk in _nodes)
            if(!keep_node[vk])
                delete _nodes[vk];
        var wedges = edges.map(wrap_edge);
        for(var ek in _edges)
            if(!keep_edge[ek])
                delete _edges[ek];

        // remove edges that don't have both end nodes
        wedges = wedges.filter(has_source_and_target);

        // remove self-edges (since we can't draw them - will be option later)
        wedges = wedges.filter(function(e) { return e.source !== e.target; });

        // and optionally, nodes that have no edges
        if(_chart.induceNodes()) {
            var keeps = {};
            wedges.forEach(function(e) {
                keeps[param(_chart.edgeSource())(e)] = true;
                keeps[param(_chart.edgeTarget())(e)] = true;
            });
            wnodes = wnodes.filter(function(n) { return keeps[param(_chart.nodeKey())(n)]; });
        }

        // cola needs each node object to have an index property
        wnodes.forEach(function(v, i) {
            v.index = i;
        });

        _stats = {nnodes: wnodes.length, nedges: wedges.length};

        // optionally do nothing if the topology hasn't changed
        var skip_layout = false;
        if(!_chart.layoutUnchanged()) {
            function original(x) {
                return x.orig;
            }
            var nodes_snapshot = JSON.stringify(wnodes.map(original)), edges_snapshot = JSON.stringify(wedges.map(original));
            if(nodes_snapshot === _nodes_snapshot && edges_snapshot === _edges_snapshot)
                skip_layout = true;
            _nodes_snapshot = nodes_snapshot;
            _edges_snapshot = edges_snapshot;
        }

        // annotate parallel edges so we can draw them specially
        if(_chart.parallelEdgeOffset()) {
            var em = new Array(wnodes.length);
            for(var i = 0; i < em.length; ++i) {
                em[i] = new Array(em.length); // technically could be diagonal array
                for(var j = 0; j < em.length; ++j)
                    em[i][j] = 0;
            }
            wedges.forEach(function(e) {
                var min = Math.min(e.source.index, e.target.index), max = Math.max(e.source.index, e.target.index);
                e.parallel = em[min][max]++;
            });
        }

        // create edge SVG elements
        var edge = _edgeLayer.selectAll('.edge')
                .data(wedges, param(_chart.edgeKey()));
        var edgeEnter = edge.enter().append('svg:path')
                .attr({
                    class: 'edge',
                    id: edge_id,
                    opacity: 0
                });
        edge
            .attr('stroke', param(_chart.edgeStroke()))
            .attr('stroke-width', param(_chart.edgeStrokeWidth()))
            .attr('marker-end', function(d) {
                var id = param(_chart.edgeArrowhead())(d);
                return id ? 'url(#' + id + ')' : null;
            })
            .attr('marker-start', function(d) {
                var id = param(_chart.edgeArrowtail())(d);
                return id ? 'url(#' + id + ')' : null;
            });
        edge.exit().transition()
            .duration(_chart.transitionDuration())
            .attr('opacity', 0)
            .remove();

        // another wider copy of the edge just for hover events
        var edgeHover = _edgeLayer.selectAll('.edge-hover')
                .data(wedges, param(_chart.edgeKey()));
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover', function(d) {
                d3.select('#' + edge_id(d) + '-label')
                    .attr('visibility', 'visible');
            })
            .on('mouseout', function(d) {
                d3.select('#' + edge_id(d) + '-label')
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();

        var edgeLabels = _edgeLayer.selectAll(".edge-label")
                .data(wedges, param(_chart.edgeKey()));
        var edgeLabelsEnter = edgeLabels.enter()
              .append('text')
                .attr('id', function(d) {
                    return edge_id(d) + '-label';
                })
                .attr('visibility', 'hidden')
                .attr({'class':'edge-label',
                       'text-anchor': 'middle',
                       dy:-2})
              .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', function(d) {
                    return '#' + edge_id(d);
                })
                .text(function(d){
                    return param(_chart.edgeLabel())(d);
                });
        edgeLabels.exit().transition()
            .duration(_chart.transitionDuration())
            .attr('opacity', 0).remove();

        // create node SVG elements
        var node = _nodeLayer.selectAll('.node')
                .data(wnodes, param(_chart.nodeKey()));
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('opacity', '0') // don't show until has layout
                .call(_d3cola.drag);
        if(_chart.highlightNeighbors()) {
            nodeEnter
                .on('mouseover', function(d) {
                    edge.attr('stroke-width', function(e) {
                        return (e.source === d || e.target === d ? 2 : 1) * param(_chart.edgeStrokeWidth())(e);
                    });
                })
                .on('mouseout', function(d) {
                    edge.attr('stroke-width', param(_chart.edgeStrokeWidth()));
                });
        }

        _chart._buildNode(node, nodeEnter);
        node.exit().transition()
            .duration(_chart.transitionDuration())
            .attr('opacity', 0)
            .remove();

        _dispatch.drawn(node, edge);

        // cola constraints always use indices, but node references
        // are more friendly, so translate those

        // i am not satisfied with this constraint generation api...
        // https://github.com/dc-js/dc.graph.js/issues/10
        var constraints = _chart.constrain()(wnodes, wedges);
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

        _d3cola.on('tick', function() {
            var elapsed = Date.now() - startTime;
            if(_chart.showLayoutSteps())
                draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter);
            if(_needsRedraw || _chart.timeLimit() && elapsed > _chart.timeLimit()) {
                console.log('cancelled');
                _d3cola.stop();
            }
        });

        // pseudo-cola.js features

        // 1. non-layout edges are drawn but not told to cola.js
        var layout_edges = wedges.filter(param(_chart.edgeIsLayout()));
        var nonlayout_edges = wedges.filter(function(x) {
            return !param(_chart.edgeIsLayout())(x);
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
                return param(_chart.nodeKey())(wnodes[i]);
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
        _d3cola.nodes(wnodes)
            .links(layout_edges)
            .constraints(constraints);
        _dispatch.start(); // cola doesn't seem to fire this itself?
        window.setTimeout(function() {
            _d3cola
                .start(10,20,20)
                .on('end', function() {
                    if(!_chart.showLayoutSteps())
                        draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter);
                    else layout_done(true);
                })
                .on('start', function() {
                    console.log('COLA START'); // doesn't seem to fire
                    _dispatch.start();
                });
        });
        return this;
    };

    function layout_done(happens) {
        _dispatch.end(happens);
        _running = false;
        if(_needsRedraw) {
            _needsRedraw = false;
            window.setTimeout(function() {
                _chart.startLayout();
            }, 0);
        }
    }

    function edge_path(d, sx, sy, tx, ty) {
        var deltaX = tx - sx,
            deltaY = ty - sy,
            sourcePadding = d.source.dcg_ry +
                param(_chart.nodeStrokeWidth())(d.source) / 2,
            targetPadding = d.target.dcg_ry +
                param(_chart.nodeStrokeWidth())(d.target) / 2;

        var sourceX, sourceY, targetX, targetY, sp, tp;
        if(!d.parallel) {
            sp = point_on_shape(_chart, d.source, deltaX, deltaY);
            tp = point_on_shape(_chart, d.target, -deltaX, -deltaY);
            if(!sp) sp = {x: 0, y: 0};
            if(!tp) tp = {x: 0, y: 0};
            sourceX = sx + sp.x;
            sourceY = sy + sp.y;
            targetX = tx + tp.x;
            targetY = ty + tp.y;
            d.length = Math.hypot(targetX-sourceX, targetY-sourceY);
            return generate_path([sourceX, sourceY, targetX, targetY], 1);
        }
        else {
            // alternate parallel edges over, then under
            var dir = (!!(d.parallel%2) === (sx < tx)) ? -1 : 1,
                port = Math.floor((d.parallel+1)/2) * dir,
                srcang = Math.atan2(deltaY, deltaX),
                sportang = srcang + port * _chart.parallelEdgeOffset() / sourcePadding,
                tportang = srcang - Math.PI - port * _chart.parallelEdgeOffset() / targetPadding,
                cos_sport = Math.cos(sportang),
                sin_sport = Math.sin(sportang),
                cos_tport = Math.cos(tportang),
                sin_tport = Math.sin(tportang),
                dist = Math.hypot(tx - sx, ty - sy);
            sp = point_on_ellipse(d.source.dcg_rx, d.source.dcg_ry, cos_sport, sin_sport);
            tp = point_on_ellipse(d.target.dcg_rx, d.target.dcg_ry, cos_tport, sin_tport);
            var sdist = Math.hypot(sp.x, sp.y),
                tdist = Math.hypot(tp.x, tp.y),
                c1dist = Math.max(sdist+sourcePadding/4, Math.min(sdist*2, dist/2)),
                c2dist = Math.min(tdist+targetPadding/4, Math.min(tdist*2, dist/2));
            sourceX = sx + sp.x;
            sourceY = sy + sp.y;
            var c1X = sx + c1dist * cos_sport,
                c1Y = sy + c1dist * sin_sport,
                c2X = tx + c2dist * cos_tport,
                c2Y = ty + c2dist * sin_tport;
            targetX = tx + tp.x;
            targetY = ty + tp.y;
            d.length = Math.hypot(targetX-sourceX, targetY-sourceY);
            return generate_path([sourceX, sourceY, c1X, c1Y, c2X, c2Y, targetX, targetY], 3);
        }
    }

    function old_edge_path(d) {
        return edge_path(d, d.source.prevX || d.source.x, d.source.prevY || d.source.y,
                         d.target.prevX || d.target.x, d.target.prevY || d.target.y);
    }

    function new_edge_path(d) {
        return edge_path(d, d.source.x, d.source.y, d.target.x, d.target.y);
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
                .each("end.all", function() { if (!--n) callback(); });
        });
    }
    function draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter) {
        console.assert(_running);
        console.assert(edge.data().every(has_source_and_target));

        // start new nodes at their final position
        nodeEnter.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
        var ntrans = node.transition()
                .duration(_chart.transitionDuration())
                .attr('opacity', '1')
                .attr("transform", function (d) {
                    return "translate(" + d.x + "," + d.y + ")";
                });
        ntrans.each("end.record", function(d) {
            d.prevX = d.x;
            d.prevY = d.y;
        });

        // start new edges at old positions of nodes, if any, else new positions
        edgeEnter.attr('d', old_edge_path);
        var etrans = edge.transition()
                .duration(_chart.transitionDuration())
                .attr('opacity', param(_chart.edgeOpacity()))
                .attr("d", new_edge_path);

        // signal layout done when all transitions complete
        // because otherwise client might start another layout and lock the processor
        if(!_chart.showLayoutSteps())
            endall([ntrans, etrans], function() { layout_done(true); });

        edgeHover.attr('d', new_edge_path);
        edgeLabels.transition()
            .duration(_chart.transitionDuration())
            .attr('transform', function(d,i) {
                if (d.target.x < d.source.x) {
                    var bbox = this.getBBox(),
                        rx = bbox.x + bbox.width/2,
                        ry = bbox.y + bbox.height/2;
                    return 'rotate(180 ' + rx + ' ' + ry + ')';
                }
                else {
                    return 'rotate(0)';
                }
            });
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
        _g = _svg.append('g').attr('class', 'dc-graph');
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
        _svg.append('svg:defs').append('svg:marker')
            .attr('id', name)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', refX)
            .attr('refY', refY)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', width)
            .attr('markerHeight', height)
            .attr('orient', 'auto')
            .call(drawf);
        return _chart;
    };

    function doZoom() {
        _g.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
    }

    function resizeSvg() {
        if(_svg) {
            _svg.attr('width', _chart.width())
                .attr('height', _chart.height());
        }
    }

    function generateSvg() {
        _svg = _chart.root().append('svg');
        resizeSvg();

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
        if(_chart.mouseZoomable())
            _svg.call(d3.behavior.zoom().on("zoom", doZoom));

        return _svg;
    }

    _chart.root(d3.select(parent));

    dc.registerChart(_chart, chartGroup);
    return _chart;
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
        _legend.parent()._buildNode(node, nodeEnter);
    };

    _legend.render = function() {
        var exemplars = _legend.exemplars();
        if(exemplars instanceof Array) {
            _items = exemplars.map(function(v) { return {name: v.name, orig: {key: v.key, value: v.value}}; });
        }
        else {
            _items = [];
            for(var item in exemplars)
                _items.push({name: item, orig: {key: item, value: exemplars[item]}});
        }
        _legend.redraw();
    };

    return _legend;
};

/**
 * It can be tedious to write functions for
 * {@link #dc_graph.diagram+constrain diagram.constrain} to apply constraints to the current
 * view of the graph. This utility creates a constraint generator function from a *pattern*,
 * a graph where
 *  1. the nodes represent *types* of layout nodes, specifying how to match nodes on which
 * constraints should be applied
 *  2. the edges represent *rules* to generate constraints.
 *
 * There are two kinds of rules:
 *  1. rules between two types apply to any edges in the layout which match the source and
 * target types and generate simple left/right constraints
 *  2. rules from a type to itself (self edges) generate a single constraint on all the nodes
 * which match the type
 * @name constraint_pattern
 * @memberof dc_graph
 * @param {dc_graph.diagram} diagram - the diagram to pull attributes from, mostly to determine
 * the keys of nodes and edge sources and targets
 * @param {Object} pattern - a graph which defines the constraints to be generated
 * @return {Function}
 */
dc_graph.constraint_pattern = function(diagram, pattern) {
    var types = {}, rules = [];

    pattern.nodes.forEach(function(n) {
        var id = n.id;
        var type = types[id] || (types[id] = {});
        // partitions could be done more efficiently; this is POC
        if(n.partition) {
            var partition = n.partition;
            var value = n.value || n.id;
            if(n.all || n.typename) {
                type.match = function(n2) { return n2.value[partition]; };
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
            return Object.create(e.produce);
        };
        ['listname', 'wrap', 'reverse'].forEach(function(k) {
            if(e[k] !== undefined) rule[k] = e[k];
        });
        rules.push(rule);
    });

    return function(nodes, edges, constraints) {
        var members = {};
        nodes.forEach(function(n) {
            var key = param(diagram.nodeKey())(n);
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
            var source = param(diagram.edgeSource())(e),
                target = param(diagram.edgeTarget())(e);
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

/* asynchronous d3.tip support for dc.graph.js (optional) */
dc_graph.tip = function() {
    var _tip = {}, _d3tip = null;

    /**
     #### .parent([object])
     Assigns this tip object to a diagram. It will show tips for nodes in that diagram.
     **/
    _tip.parent = property(null)
        .react(function(p) {
            if(p)
                p.on('drawn.tip', function(node, edge) {
                    annotate(node);
                });
            else if(_tip.parent())
                _tip.parent().on('drawn.tip', null);
        });

    function annotate(node) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; });
            _tip.parent().svg().call(_d3tip);
        }
        node
            .on('mouseover.tip', function(d) {
                var target = d3.event.target;
                _tip.content()(d, function(content) {
                    _d3tip.show(content, target);
                });
            })
	    .on('mouseout.foo', function(d) {
		_d3tip.hide();
	    });
    }

    /**
     #### .content([function])
     Specifies the function to generate content for the tooltip. This function has
     the signature `function(d, k)`, where `d` is the datum of the node being hovered over,
     and `k` is a continuation. The function should fetch the content, asynchronously
     if needed, and then pass it forward to `k`.
     **/
    _tip.content = property(function(d, k) {
        k(_tip.parent() ? param(_tip.parent().nodeTitle())(d) : '');
    });

    return _tip;
};

// load a graph from various formats and return the data in consistent {nodes, links} format
dc_graph.load_graph = function(file, callback) {
    // ignore any query parameters for checking extension
    var file2 = file.replace(/\?.*/, '');
    if(/\.json$/.test(file2))
        d3.json(file, callback);
    else if(/\.gv|\.dot$/.test(file2))
        d3.text(file, function (error, f) {
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

dc_graph.generate = function(name, args, env, callback) {
    var nodes, edges, i, j;
    var nodePrefix = env.nodePrefix || '';
    var namef = function(i) {
        return nodes[i].name;
    };
    var N = args[0];
    var linkLength = env.linkLength || 30;
    switch(name) {
    case 'clique':
    case 'cliquestf':
        nodes = new Array(N);
        edges = [];
        for(i = 0; i<N; ++i) {
            nodes[i] = dc_graph.node_object(i, {circle: "A", name: nodePrefix+dc_graph.node_name(i)});
            for(j=0; j<i; ++j)
                edges.push(dc_graph.edge_object(namef, i, j, {notLayout: true, undirected: true}));
        }
        if(name==='cliquestf')
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
        throw new Error("unknown generation type "+name);
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