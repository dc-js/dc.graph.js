/*!
 *  dc.graph 0.6.0-beta.7
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
 * Like in dc.js and most libraries built on d3, most `dc_graph` functions are designed to allow function chaining, meaning they return the current diagram
 * instance whenever it is appropriate.  The getter forms of functions do not participate in function
 * chaining because they return values that are not the diagram.
 * @namespace dc_graph
 * @version 0.6.0-beta.7
 * @example
 * // Example chaining
 * diagram.width(600)
 *      .height(400)
 *      .nodeDimension(nodeDim)
 *      .nodeGroup(nodeGroup);
 */

var dc_graph = {
    version: '0.6.0-beta.7',
    constants: {
        CHART_CLASS: 'dc-graph'
    }
};

function get_original(x) {
    return x.orig;
}

function identity(x) {
    return x;
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

function named_children() {
    var _children = {};
    var f = function(id, object) {
        if(arguments.length === 1)
            return _children[id];
        // do not notify unnecessarily
        if(_children[id] === object)
            return this;
        if(_children[id])
            _children[id].parent(null);
        _children[id] = object;
        if(object)
            object.parent(this);
        return this;
    };
    f.enum = function() {
        return Object.keys(_children);
    };
    f.nameOf = function(o) {
        var found = Object.entries(_children).find(function(kv) {
            return kv[1] == o;
        });
        return found ? found[0] : null;
    };
    return f;
}

function deprecated_property(message, defaultValue) {
    var prop = property(defaultValue);
    var ret = function() {
        if(arguments.length) {
            console.warn(message);
            prop.apply(property, arguments);
            return this;
        }
        return prop();
    };
    ['cascade', '_eval', 'eval', 'react'].forEach(function(method) {
        ret[method] = prop[method];
    });
    return ret;
}

// http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

// polyfill Object.assign for IE
// it's just too useful to do without
if (typeof Object.assign != 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

function getBBoxNoThrow(elem) {
    // firefox seems to have issues with some of my texts
    // just catch for now
    try {
        return elem.getBBox();
    } catch(xep) {
        return {x: 0, y: 0, width:0, height: 0};
    }
}

function property_if(pred, curr) {
    return function(o, last) {
        return pred(o) ? curr(o) : last();
    };
}

function property_interpolate(value, curr) {
    return function(o, last) {
        return d3.interpolate(last(o), curr(o))(value(o));
    };
}

function multiply_properties(pred, props, blend) {
    var props2 = {};
    for(var p in props)
        props2[p] = blend(pred, param(props[p]));
    return props2;
}

function conditional_properties(pred, props) {
    return multiply_properties(pred, props, property_if);
}

function node_edge_conditions(npred, epred, props) {
    var nprops = {}, eprops = {}, badprops = [];
    for(var p in props) {
        if(/^node/.test(p))
            nprops[p] = props[p];
        else if(/^edge/.test(p))
            eprops[p] = props[p];
        else badprops.push(p);
    }
    if(badprops.length)
        console.error('only know how to deal with properties that start with "node" or "edge"', badprops);
    var props2 = npred ? conditional_properties(npred, nprops) : {};
    if(epred)
        Object.assign(props2, conditional_properties(epred, eprops));
    return props2;
}

function cascade(parent) {
    return function(level, add, props) {
        for(var p in props) {
            if(!parent[p])
                throw new Error('unknown attribute ' + p);
            parent[p].cascade(level, add ? props[p] : null);
        }
        return parent;
    };
}

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

// outputs the array with adjacent identical lines collapsed to one
function uniq(a) {
    var ret = [];
    a.forEach(function(x, i) {
        if(i === 0 || x !== a[i-1])
            ret.push(x);
    });
    return ret;
}

// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
     // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      var thisArg = arguments[1];

      // 5. Let k be 0.
      var k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, � kValue, k, O �)).
        // d. If testResult is true, return kValue.
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return kValue;
        }
        // e. Increase k by 1.
        k++;
      }

      // 7. Return undefined.
      return undefined;
    }
  });
}

var script_path = function() {
    var _path;
    return function() {
        if(_path === undefined) {
            // adapted from http://stackoverflow.com/a/18283141/676195
            _path = null; // only try once
            var filename = 'dc.graph.js';
            var scripts = document.getElementsByTagName('script');
            if (scripts && scripts.length > 0) {
                for (var i in scripts) {
                    if (scripts[i].src && scripts[i].src.match(new RegExp(filename+'$'))) {
                        _path = scripts[i].src.replace(new RegExp('(.*)'+filename+'$'), '$1');
                        break;
                    }
                }
            }
        }
        return _path;
    };
}();

dc_graph.event_coords = function(diagram) {
    var bound = diagram.root().node().getBoundingClientRect();
    return diagram.invertCoord([d3.event.clientX - bound.left,
                              d3.event.clientY - bound.top]);
};

function promise_identity(x) {
    return Promise.resolve(x);
}

// http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

// https://stackoverflow.com/questions/16863917/check-if-class-exists-somewhere-in-parent-vanilla-js
function ancestor_has_class(element, classname) {
    if(d3.select(element).classed(classname))
        return true;
    return element.parentElement && ancestor_has_class(element.parentElement, classname);
}

// arguably depth first search is a stupid algorithm to modularize -
// there are many, many interesting moments to insert a behavior
// and those end up being almost bigger than the function itself

// this is an argument for providing a graph API which could make it
// easy to just write a recursive function instead of using this
dc_graph.depth_first_traversal = function(callbacks) { // {[init, root, row, tree, place, sib, push, pop, skip,] finish, nodeid, sourceid, targetid}
    return function(nodes, edges) {
        callbacks.init && callbacks.init();
        if(callbacks.tree)
            edges = edges.filter(function(e) { return callbacks.tree(e); });
        var indegree = {};
        var outmap = edges.reduce(function(m, e) {
            var tail = callbacks.sourceid(e),
                head = callbacks.targetid(e);
            if(!m[tail]) m[tail] = [];
            m[tail].push(e);
            indegree[head] = (indegree[head] || 0) + 1;
            return m;
        }, {});
        var nmap = nodes.reduce(function(m, n) {
            var key = callbacks.nodeid(n);
            m[key] = n;
            return m;
        }, {});

        var rows = [];
        var placed = {};
        function place_tree(n, r) {
            var key = callbacks.nodeid(n);
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
                    var target = nmap[callbacks.targetid(e)];
                    if(ei && callbacks.sib)
                        callbacks.sib(false, nmap[callbacks.targetid(outmap[key][ei-1])], target);
                    callbacks.push && callbacks.push();
                    place_tree(target, r+1);
                });
            callbacks.pop && callbacks.pop(n);
        }

        var roots;
        if(callbacks.root)
            roots = nodes.filter(function(n) { return callbacks.root(n); });
        else {
            roots = nodes.filter(function(n) { return !indegree[callbacks.nodeid(n)]; });
            if(nodes.length && !roots.length) // all nodes are in a cycle
                roots = [nodes[0]];
        }
        roots.forEach(function(n, ni) {
            if(ni && callbacks.sib)
                callbacks.sib(true, roots[ni-1], n);
            callbacks.push && callbacks.push();
            place_tree(n, callbacks.row && callbacks.row(n) || 0);
        });
        callbacks.finish(rows);
    };
};

// basically, see if it's any simpler if we start from scratch
// (well, of course it's simpler because we have less callbacks)
// same caveats as above
dc_graph.undirected_dfs = function(callbacks) { // {[comp, node], nodeid, sourceid, targetid}
    return function(nodes, edges) {
        var adjacencies = edges.reduce(function(m, e) {
            var tail = callbacks.sourceid(e),
                head = callbacks.targetid(e);
            if(!m[tail]) m[tail] = [];
            if(!m[head]) m[head] = [];
            m[tail].push(head);
            m[head].push(tail);
            return m;
        }, {});
        var nmap = nodes.reduce(function(m, n) {
            var key = callbacks.nodeid(n);
            m[key] = n;
            return m;
        }, {});
        var found = {};
        function recurse(n) {
            var nid = callbacks.nodeid(n);
            callbacks.node(compid, n);
            found[nid] = true;
            if(adjacencies[nid])
                adjacencies[nid].forEach(function(adj) {
                    if(!found[adj])
                        recurse(nmap[adj]);
                });
        }
        var compid = 0;
        nodes.forEach(function(n) {
            if(!found[callbacks.nodeid(n)]) {
                callbacks.comp && callbacks.comp(compid);
                recurse(n);
                ++compid;
            }
        });
    };
};

// create or re-use objects in a map, delete the ones that were not reused
function regenerate_objects(preserved, list, need, key, assign, create, destroy) {
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
    if(need)
        need.forEach(function(k) {
            if(!preserved[k]) { // hasn't been created, needs to be
                create(k, preserved[k] = {}, null);
                assign(preserved[k], null);
            }
            if(!keep[k]) { // wasn't in list, should be
                wlist.push(preserved[k]);
                keep[k] = true;
            }
        });
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


dc_graph.text_contents = function() {
    var _contents = {
        parent: property(null),
        update: function(container) {
            var text = container.selectAll('text.node-label')
                    .data(function(n) { return [n]; });
            text.enter().append('text')
                .attr('class', 'node-label');
            var tspan = text.selectAll('tspan').data(function(n) {
                var lines = _contents.parent().nodeLabel.eval(n);
                if(!lines)
                    return [];
                else if(typeof lines === 'string')
                    lines = [lines];
                var lineHeight = _contents.parent().nodeLineHeight();
                var first = 1 - ((lines.length - 1) * lineHeight + 1)/2;
                return lines.map(function(line, i) { return {node: n, line: line, yofs: (i==0 ? first : lineHeight) + 'em'}; });
            });
            tspan.enter().append('tspan');
            tspan.attr({
                'text-anchor': 'start',
                x: 0
            }).text(function(s) { return s.line; });
            text
                .each(function(n) {
                    n.xofs = 0;
                })
                .filter(function(n) {
                    return _contents.parent().nodeLabelAlignment.eval(n) !== 'center';
                })
                .each(function(n) {
                    var bbox = getBBoxNoThrow(this);
                    n.bbox = {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
                    switch(_contents.parent().nodeLabelAlignment.eval(n)) {
                    case 'left': n.xofs = -n.bbox.width/2;
                        break;
                    case 'right': n.xofs = n.bbox.width/2;
                        break;
                    }
                })
                .selectAll('tspan');
            tspan.attr({
                'text-anchor': function(s) {
                    switch(_contents.parent().nodeLabelAlignment.eval(s.node)) {
                    case 'left': return 'start';
                    case 'center': return 'middle';
                    case 'right': return 'end';
                    }
                    return null;
                },
                x: function(s) {
                    return s.node.xofs;
                },
                dy: function(d) { return d.yofs; }
            });

            tspan.exit().remove();
            text
                .attr('fill', _contents.parent().nodeLabelFill.eval);
        },
        textbox: function(container) {
            var bbox = getBBoxNoThrow(this.selectContent(container).node());
            return {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
        },
        selectContent: function(container) {
            return container.select('text.node-label');
        }
    };
    return _contents;
};

dc_graph.with_icon_contents = function(contents, width, height) {
    var _contents = {
        parent: property(null).react(function(parent) {
            contents.parent(parent);
        }),
        padding: function(n) {
            var padding = node_label_padding(_contents.parent(), n);
            return {
                x: padding.x * 3,
                y: padding.y * 3
            };
        },
        update: function(container) {
            var g = container.selectAll('g.with-icon')
                    .data(function(n) { return [n]; });
            var gEnter = g.enter();
            gEnter.append('g')
                .attr('class', 'with-icon')
              .append('image').attr({
                class: 'icon',
                width: width + 'px',
                height: height + 'px'
            });
            g.call(contents.update);
            contents.selectContent(g)
                .attr('transform',  'translate(' + width/2 + ')');
            g.selectAll('image.icon').attr({
                href: _contents.parent().nodeIcon.eval,
                x: function(n) {
                    var totwid = width + contents.textbox(d3.select(this.parentNode)).width;
                    return -totwid/2 - node_label_padding(_contents.parent(), n);
                },
                y: -height/2
            });
        },
        textbox: function(container) {
            var box = contents.textbox(container);
            box.x += width/2;
            return box;
        },
        selectContent: function(container) {
            return container.select('g.with-icon');
        }
    };
    return _contents;
};


/**
 * `dc_graph.diagram` is a dc.js-compatible network visualization component. It registers in
 * the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
 * logically derives from the dc.js
 * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin},
 * but it does not physically derive from it since so much is different about network
 * visualization versus conventional charts.
 * @class diagram
 * @memberof dc_graph
 * @param {String|node} parent - Any valid
 * {@link https://github.com/mbostock/d3/wiki/Selections#selecting-elements d3 single selector}
 * specifying a dom block element such as a div; or a dom element.
 * @param {String} [chartGroup] - The name of the dc.js chart group this diagram instance
 * should be placed in. Filter interaction with a diagram will only trigger events and redraws
 * within the diagram's group.
 * @return {dc_graph.diagram}
 **/
dc_graph.diagram = function (parent, chartGroup) {
    // different enough from regular dc charts that we don't use dc.baseMixin
    // but attempt to implement most of that interface, copying some of the most basic stuff
    var _diagram = dc.marginMixin({});
    _diagram.__dcFlag__ = dc.utils.uniqueId();
    _diagram.margins({left: 10, top: 10, right: 10, bottom: 10});
    var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _dispatch = d3.dispatch('preDraw', 'data', 'end', 'start', 'drawn', 'receivedLayout', 'transitionsStarted', 'zoomed');
    var _nodes = {}, _edges = {}; // hold state between runs
    var _ports = {}; // id = node|edge/id/name
    var _nodePorts; // ports sorted by node id
    var _stats = {};
    var _nodes_snapshot, _edges_snapshot;
    var _arrows = {};
    var _running = false; // for detecting concurrency issues
    var _translate = [0,0], _scale = 1;
    var _zoom, _animateZoom;
    var _anchor, _chartGroup;

    var _minWidth = 200;
    var _defaultWidthCalc = function (element) {
        var width = element && element.getBoundingClientRect && element.getBoundingClientRect().width;
        return (width && width > _minWidth) ? width : _minWidth;
    };
    var _widthCalc = _defaultWidthCalc;

    var _minHeight = 200;
    var _defaultHeightCalc = function (element) {
        var height = element && element.getBoundingClientRect && element.getBoundingClientRect().height;
        return (height && height > _minHeight) ? height : _minHeight;
    };
    var _heightCalc = _defaultHeightCalc;
    var _width, _height;

    function deprecate_layout_algo_parameter(name) {
        return function(value) {
            if(!_diagram.layoutEngine())
                _diagram.layoutAlgorithm('cola', true);
            var engine = _diagram.layoutEngine();
            if(engine.getEngine)
                engine = engine.getEngine();
            if(engine[name]) {
                console.warn('property is deprecated, call on layout engine instead: dc_graph.diagram.%c' + name,
                             'font-weight: bold');
                if(!arguments.length)
                    return engine[name]();
                engine[name](value);
            } else {
                console.warn('property is deprecated, and is not supported for Warning: dc_graph.diagram.<b>' + name + '</b> is deprecated, and it is not supported for the "' + engine.layoutAlgorithm() + '" layout algorithm: ignored.');
                if(!arguments.length)
                    return null;
            }
            return this;
        };
    }

    /**
     * Set or get the width attribute of the diagram. See `.height` below.
     * @method width
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [width=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.height = function (height) {
        if (!arguments.length) {
            if (!dc.utils.isNumber(_height)) {
                // only calculate once
                _height = _heightCalc(_diagram.root().node());
            }
            return _height;
        }
        _heightCalc = d3.functor(height || _defaultHeightCalc);
        _height = undefined;
        return _diagram;
    };
    _diagram.minHeight = function(height) {
        if(!arguments.length)
            return _minHeight;
        _minHeight = height;
        return _diagram;
    };
    /**
     * Set or get the height attribute of the diagram. The width and height are applied to the
     * SVG element generated by the diagram when rendered. If a value is given, then the
     * diagram is returned for method chaining. If no value is given, then the current value of
     * the height attribute will be returned. If the value is a function, it will get called with
     * the root element. Default: 200
     * @method height
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [height=200]
     * @return {Number}
     * @return {dc_graph.diagram}
      **/
    _diagram.width = function (width) {
        if (!arguments.length) {
            if (!dc.utils.isNumber(_width)) {
                // only calculate once
                _width = _widthCalc(_diagram.root().node());
            }
            return _width;
        }
        _widthCalc = d3.functor(width || _defaultWidthCalc);
        _width = undefined;
        return _diagram;
    };
    _diagram.minWidth = function(width) {
        if(!arguments.length)
            return _minWidth;
        _minWidth = width;
        return _diagram;
    };

    /**
     * Get or set the root element, which is usually the parent div. Normally the root is set
     * when the diagram is constructed; setting it later may have unexpected consequences.
     * @method root
     * @memberof dc_graph.diagram
     * @instance
     * @param {node} [root=null]
     * @return {node}
     * @return {dc_graph.diagram}
     **/
    _diagram.root = property(null).react(function(e) {
        if(e.empty())
            console.log('Warning: parent selector ' + parent + " doesn't seem to exist");
    });

    /**
     * Get or set whether mouse wheel rotation or touchpad gestures will zoom the diagram, and
     * whether dragging on the background pans the diagram.
     * @method mouseZoomable
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [mouseZoomable=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.mouseZoomable = property(true);

    _diagram.zoomExtent = property([.1, 2]);

    /**
     * Whether zooming should only be enabled when the alt key is pressed.
     * @method altKeyZoom
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [altKeyZoom=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.modKeyZoom = _diagram.altKeyZoom = property(false);

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
     * @method fitStrategy
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [fitStrategy='default']
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _diagram.fitStrategy = property('default');

    /**
     * Do not allow panning (scrolling) to push the diagram out of the viewable area, if there
     * is space for it to be shown. */
    _diagram.restrictPan = property(false);

    /**
     * Auto-zoom behavior.
     * * `'always'` - zoom every time layout happens
     * * `'once'` - zoom the next time layout happens
     * * `null` - manual, call `zoomToFit` to fit
     * @method autoZoom
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [autoZoom=null]
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _diagram.autoZoom = property(null);
    _diagram.zoomToFit = function(animate) {
        if(!(_nodeLayer && _edgeLayer))
            return;
        var node = _diagram.selectAllNodes(),
            edge = _diagram.selectAllEdges();
        auto_zoom(node, edge, animate);
    };
    _diagram.zoomDuration = property(500);

    /**
     * Set or get the crossfilter dimension which represents the nodes (vertices) in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.
     *
     * *Dimensions are included on the diagram for similarity to dc.js, however the diagram
     * itself does not use them - but {@link dc_graph.filter_selection filter_selection} will.*
     * @method nodeDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [nodeDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeDimension = property();

    /**
     * Set or get the crossfilter group which is the data source for the nodes in the
     * diagram. The diagram will use the group's `.all()` method to get an array of `{key,
     * value}` pairs, where the key is a unique identifier, and the value is usually an object
     * containing the node's attributes. All accessors work with these key/value pairs.
     *
     * If the group is changed or returns different values, the next call to `.redraw()` will
     * reflect the changes incrementally.
     *
     * It is possible to pass another object with the same `.all()` interface instead of a
     * crossfilter group.
     * @method nodeGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [nodeGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeGroup = property();

    /**
     * Set or get the crossfilter dimension which represents the edges in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.
     *
     * *Dimensions are included on the diagram for similarity to dc.js, however the diagram
     * itself does not use them - but {@link dc_graph.filter_selection filter_selection} will.*
     * @method edgeDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [edgeDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeDimension = property();

    /**
     * Set or get the crossfilter group which is the data source for the edges in the
     * diagram. See `.nodeGroup` above for the way data is loaded from a crossfilter group.
     *
     * The values in the key/value pairs returned by `diagram.edgeGroup().all()` need to
     * support, at a minimum, the {@link dc_graph.diagram#nodeSource nodeSource} and
     * {@link dc_graph.diagram#nodeTarget nodeTarget}, which should return the same
     * keys as the {@link dc_graph.diagram#nodeKey nodeKey}
     *
     * @method edgeGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [edgeGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeGroup = property();

    _diagram.edgesInFront = property(false);

    /**
     * Set or get the function which will be used to retrieve the unique key for each node. By
     * default, this accesses the `key` field of the object passed to it. The keys should match
     * the keys returned by the {@link dc_graph.diagram#edgeSource edgeSource} and
     * {@link dc_graph.diagram#edgeTarget edgeTarget}.
     *
     * @method nodeKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeKey=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeKey = _diagram.nodeKeyAccessor = property(function(kv) {
        return kv.key;
    });

    /**
     * Set or get the function which will be used to retrieve the unique key for each edge. By
     * default, this accesses the `key` field of the object passed to it.
     *
     * @method edgeKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeKey=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeKey = _diagram.edgeKeyAccessor = property(function(kv) {
        return kv.key;
    });

    /**
     * Set or get the function which will be used to retrieve the source (origin/tail) key of
     * the edge objects.  The key must equal the key returned by the `.nodeKey` for one of the
     * nodes; if it does not, or if the node is currently filtered out, the edge will not be
     * displayed. By default, looks for `.value.sourcename`.
     *
     * @method edgeSource
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeSource=function(kv) { return kv.value.sourcename; }]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeSource = _diagram.sourceAccessor = property(function(kv) {
        return kv.value.sourcename;
    });

    /**
     * Set or get the function which will be used to retrieve the target (destination/head) key
     * of the edge objects.  The key must equal the key returned by the
     * {@link dc_graph.diagram#nodeKey nodeKey} for one of the nodes; if it does not, or if the node
     * is currently filtered out, the edge will not be displayed. By default, looks for
     * `.value.targetname`.
     * @method edgeTarget
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeTarget=function(kv) { return kv.value.targetname; }]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeTarget = _diagram.targetAccessor = property(function(kv) {
        return kv.value.targetname;
    });

    _diagram.portDimension = property(null);
    _diagram.portGroup = property(null);
    _diagram.portNodeKey = property(null);
    _diagram.portEdgeKey = property(null);
    _diagram.portName = property(null);
    _diagram.portStyleName = property(null);
    _diagram.portElastic = property(true);

    _diagram.portStyle = named_children();

    _diagram.portBounds = property(null); // position limits, in radians

    _diagram.edgeSourcePortName = property(null);
    _diagram.edgeTargetPortName = property(null);

    /**
     * Set or get the function which will be used to retrieve the radius, in pixels, for each
     * node. This determines the height of nodes,and if `nodeFitLabel` is false, the width too.
     * @method nodeRadius
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeRadius=25]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeRadius = _diagram.nodeRadiusAccessor = property(25);

    /**
     * Set or get the function which will be used to retrieve the stroke width, in pixels, for
     * drawing the outline of each node. According to the SVG specification, the outline will
     * be drawn half on top of the fill, and half outside. Default: 1
     * @method nodeStrokeWidth
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeStrokeWidth=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeStrokeWidth = _diagram.nodeStrokeWidthAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the stroke color for the outline
     * of each node.
     * @method nodeStroke
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeStroke='black']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeStroke = _diagram.nodeStrokeAccessor = property('black');

    _diagram.nodeStrokeDashArray = property(null);

    /**
     * If set, the value returned from `nodeFill` will be processed through this
     * {@link https://github.com/mbostock/d3/wiki/Scales d3.scale}
     * to return the fill color. If falsy, uses the identity function (no scale).
     * @method nodeFillScale
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|d3.scale} [nodeFillScale]
     * @return {Function|d3.scale}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeFillScale = property(null);

    /**
     * Set or get the function which will be used to retrieve the fill color for the body of each
     * node.
     * @method nodeFill
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeFill='white']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeFill = _diagram.nodeFillAccessor = property('white');

    /**
     * Set or get the function which will be used to retrieve the opacity of each node.
     * @method nodeOpacity
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeOpacity=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeOpacity = property(1);

    /**
     * Set or get the padding or minimum distance, in pixels, for a node. (Will be distributed
     * to both sides of the node.)
     * @method nodePadding
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodePadding=6]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodePadding = property(6);


    /**
     * Set or get the padding, in pixels, for a node's label. If an object, should contain fields
     * `x` and `y`. If a number, will be applied to both x and y.
     * @method nodeLabelPadding
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number|Object} [nodeLabelPadding=0]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeLabelPadding = property(0);

    /**
     * Set or get the line height for nodes with multiple lines of text, in ems.
     * @method nodeLineHeight
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeLineHeight=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeLineHeight = property(1);

    /**
     * Set or get the function which will be used to retrieve the label text to display in each
     * node. By default, looks for a field `label` or `name` inside the `value` field.
     * @method nodeLabel
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
    _diagram.nodeLabel = _diagram.nodeLabelAccessor = property(function(kv) {
        return kv.value.label || kv.value.name;
    });

    _diagram.nodeLabelAlignment = property('center');

    /**
     * Set or get the function which will be used to retrieve the label fill color. Default: null
     * @method nodeLabelFill
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeLabelFill=null]
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeLabelFill = _diagram.nodeLabelFillAccessor = property(null);

    /**
     * Whether to fit the node shape around the label
     * @method nodeFitLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Boolean} [nodeFitLabel=true]
     * @return {Function|Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeFitLabel = _diagram.nodeFitLabelAccessor = property(true);

    /**
     * The shape to use for drawing each node, specified as an object with at least the field
     * `shape`. The names of shapes are mostly taken
     * [from graphviz](http://www.graphviz.org/doc/info/shapes.html); currently ellipse, egg,
     * triangle, rectangle, diamond, trapezium, parallelogram, pentagon, hexagon, septagon, octagon,
     * invtriangle, invtrapezium, square, polygon are supported.
     *
     * If `shape = polygon`:
     * * `sides`: number of sides for a polygon
     * @method nodeShape
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
    _diagram.nodeShape = property(default_shape);

    // for defining custom (and standard) shapes
    _diagram.shape = named_children();

    _diagram.shape('nothing', dc_graph.no_shape());
    _diagram.shape('ellipse', dc_graph.ellipse_shape());
    _diagram.shape('polygon', dc_graph.polygon_shape());
    _diagram.shape('rounded-rect', dc_graph.rounded_rectangle_shape());

    _diagram.nodeContent = property('text');
    _diagram.content = named_children();
    _diagram.content('text', dc_graph.text_contents());

    // really looks like these should reside in an open namespace - this used only by an extension
    // but it's no less real than any other computed property
    _diagram.nodeIcon = property(null);

    /**
     * Set or get the function which will be used to retrieve the node title, usually rendered
     * as a tooltip. By default, uses the key of the node.
     * @method nodeTitle
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeTitle]
     * @return {Function|String}
     * @example
     * // Default behavior
     * diagram.nodeTitle(function(kv) {
     *   return _diagram.nodeKey()(kv);
     * });
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeTitle = _diagram.nodeTitleAccessor = property(function(kv) {
        return _diagram.nodeKey()(kv);
    });

    /**
     * By default, nodes are added to the layout in the order that `.nodeGroup().all()` returns
     * them. If specified, `.nodeOrdering` provides an accessor that returns a key to sort the
     * nodes on.  *It would be better not to rely on ordering to affect layout, but it may
     * affect the layout in some cases.*
     * @method nodeOrdering
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeOrdering=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeOrdering = property(null);

    /**
     * Specify an accessor that returns an {x,y} coordinate for a node that should be
     * {@link https://github.com/tgdwyer/WebCola/wiki/Fixed-Node-Positions fixed in place},
     * and returns falsy for other nodes.
     * @method nodeFixed
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Object} [nodeFixed=null]
     * @return {Function|Object}
     * @return {dc_graph.diagram}
     **/
    _diagram.nodeFixed = _diagram.nodeFixedAccessor = property(null);


    /**
     * Set or get the function which will be used to retrieve the stroke color for the edges.
     * @method edgeStroke
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeStroke='black']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeStroke = _diagram.edgeStrokeAccessor = property('black');

    /**
     * Set or get the function which will be used to retrieve the stroke width for the edges.
     * @method edgeStrokeWidth
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeStrokeWidth=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeStrokeWidth = _diagram.edgeStrokeWidthAccessor = property(1);

    _diagram.edgeStrokeDashArray = property(null);

    /**
     * Set or get the function which will be used to retrieve the edge opacity, a number from 0
     * to 1.
     * @method edgeOpacity
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeOpacity=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeOpacity = _diagram.edgeOpacityAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the edge label text. The label is
     * displayed when an edge is hovered over. By default, uses the `edgeKey`.
     * @method edgeLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeLabel]
     * @example
     * // Default behavior
     * diagram.edgeLabel(function(e) {
     *   return _diagram.edgeKey()(e);
     * });
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeLabel = _diagram.edgeLabelAccessor = property(function(e) {
        return _diagram.edgeKey()(e);
    });

    /**
     * Set or get the function which will be used to retrieve the name of the arrowhead to use
     * for the target/ head/destination of the edge. Arrow symbols can be specified with
     * `.defineArrow()`. Return null to display no arrowhead.
     * @method edgeArrowhead
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeArrowhead='vee']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeArrowhead = _diagram.edgeArrowheadAccessor = property('vee');

    /**
     * Set or get the function which will be used to retrieve the name of the arrow tail to use
     * for the tail/source of the edge. Arrow symbols can be specified with
     * `.defineArrow()`. Return null to display no arrowtail.
     * @method edgeArrowtail
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeArrowtail=null]
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeArrowtail = _diagram.edgeArrowtailAccessor = property(null);

    /**
     * Multiplier for arrow size.
     * @method edgeArrowSize
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeArrowSize=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeArrowSize = property(1);

    /**
     * To draw an edge but not have it affect the layout, specify a function which returns
     * false for that edge.  By default, will return false if the `notLayout` field of the edge
     * value is truthy, true otherwise.
     * @method edgeIsLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Boolean} [edgeIsLayout]
     * @example
     * // Default behavior
     * diagram.edgeIsLayout(function(kv) {
     *   return !kv.value.notLayout;
     * });
     * @return {Function|Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeIsLayout = _diagram.edgeIsLayoutAccessor = property(function(kv) {
        return !kv.value.notLayout;
    });

    // if false, don't draw or layout the edge. this is not documented because it seems like
    // the interface could be better and this combined with edgeIsLayout. (currently there is
    // no way to layout but not draw an edge.)
    _diagram.edgeIsShown = property(true);

    /**
     * Currently, three strategies are supported for specifying the lengths of edges:
     * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
     * `baseLength`
     * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
     * the edge. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
     * for more details.
     * 'none' - no edge lengths will be specified
     *
     * **Deprecated**: Use {@link dc_graph.cola_layout#lengthStrategy cola_layout.lengthStrategy} instead.
     * @method lengthStrategy
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [lengthStrategy='symmetric']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     **/
    _diagram.lengthStrategy = deprecate_layout_algo_parameter('lengthStrategy');

    /**
     * When the `.lengthStrategy` is 'individual', this accessor will be used to read the
     * length of each edge.  By default, reads the `distance` field of the edge. If the
     * distance is falsy, uses the `baseLength`.
     * @method edgeLength
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeLength]
     * @example
     * // Default behavior
     * diagram.edgeLength(function(kv) {
     *   return kv.value.distance;
     * });
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeLength = _diagram.edgeDistanceAccessor = property(function(kv) {
        return kv.value.distance;
    });

    /**
     * This should be equivalent to rankdir and ranksep in the dagre/graphviz nomenclature, but for
     * now it is separate.
     *
     * **Deprecated**: use {@link dc_graph.cola_layout#flowLayout cola_layout.flowLayout} instead.
     * @method flowLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [flowLayout]
     * @example
     * // No flow (default)
     * diagram.flowLayout(null)
     * // flow in x with min separation 200
     * diagram.flowLayout({axis: 'x', minSeparation: 200})
     **/
    _diagram.flowLayout = deprecate_layout_algo_parameter('flowLayout');

    /**
     * Direction to draw ranks. Currently for dagre and expand_collapse, but I think cola could be
     * generated from graphviz-style since it is more general.
     *
     * **Deprecated**: use {@link dc_graph.dagre_layout#rankdir dagre_layout.rankdir} instead.
     * @method rankdir
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [rankdir]
     **/
    _diagram.rankdir = deprecate_layout_algo_parameter('rankdir');

    /**
     * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
     * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
     * lengths.
     *
     * **Deprecated**: use {@link dc_graph.cola_layout#baseLength cola_layout.baseLength} instead.
     * @method baseLength
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [baseLength]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.baseLength = deprecate_layout_algo_parameter('baseLength');

    /**
     * Gets or sets the transition duration, the length of time each change to the diagram will
     * be animated.
     * @method transitionDuration
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [transitionDuration=500]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.transitionDuration = property(500);

    /**
     * How transitions should be split into separate animations to emphasize
     * the delete, modify, and insert operations:
     * * `none`: modify and insert operations animate at the same time
     * * `modins`: modify operations happen before inserts
     * * `insmod`: insert operations happen before modifies
     *
     * Deletions always happen before/during layout computation.
     * @method stageTransitions
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [stageTransitions='none']
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _diagram.stageTransitions = property('none');

    /**
     * The delete transition happens simultaneously with layout, which can take longer
     * than the transition duration. Delaying it can bring it closer to the other
     * staged transitions.
     * @method deleteDelay
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [deleteDelay=0]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.deleteDelay = property(0);

    /**
     * Whether to put connected components each in their own group, to stabilize layout.
     * @method groupConnected
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [stageTransitions=false]
     * @return {String}
     * @return {dc_graph.diagram}
     **/
    _diagram.groupConnected = deprecate_layout_algo_parameter('groupConnected');

    /**
     * Gets or sets the maximum time spent doing layout for a render or redraw. Set to 0 for no
     * limit.
     * @method timeLimit
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [timeLimit=0]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.timeLimit = property(0);

    /**
     * Gets or sets a function which will be called with the current nodes and edges on each
     * redraw in order to derive new layout constraints. The constraints are built from scratch
     * on each redraw.
     *
     * This can be used to generate alignment (rank) or axis constraints. By default, no
     * constraints will be added, although cola.js uses constraints internally to implement
     * flow and overlap prevention. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints the cola.js wiki}
     * for more details.
     *
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
     * @method constrain
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [constrain]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.constrain = property(function(nodes, edges) {
        return [];
    });

    /**
     * If there are multiple edges between the same two nodes, start them this many pixels away
     * from the original so they don't overlap.
     * @method parallelEdgeOffset
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [parallelEdgeOffset=10]
     * @return {Number}
     * @return {dc_graph.diagram}
     **/
    _diagram.parallelEdgeOffset = property(10);

    /**
     * By default, edges are added to the layout in the order that `.edgeGroup().all()` returns
     * them. If specified, `.edgeOrdering` provides an accessor that returns a key to sort the
     * edges on.
     *
     * *It would be better not to rely on ordering to affect layout, but it may affect the
     * layout in some cases. (Probably less than node ordering, but it does affect which
     * parallel edge is which.)*
     * @method edgeOrdering
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeOrdering=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.edgeOrdering = property(null);

    _diagram.edgeSort = property(null);

    _diagram.cascade = cascade(_diagram);

    /**
     * Currently there are some bugs when the same instance of cola.js is used multiple
     * times. (In particular, overlaps between nodes may not be eliminated
     * {@link https://github.com/tgdwyer/WebCola/issues/118 if cola is not reinitialized}
     * This flag can be set true to construct a new cola layout object on each redraw. However,
     * layout seems to be more stable if this is set false, so hopefully this will be fixed
     * soon.
     * @method initLayoutOnRedraw
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [initLayoutOnRedraw=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.initLayoutOnRedraw = property(false);

    /**
     * Whether to perform layout when the data is unchanged from the last redraw.
     * @method layoutUnchanged
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [layoutUnchanged=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.layoutUnchanged = property(false);

    /**
     * When `layoutUnchanged` is false, this will force layout to happen again. This may be needed
     * when changing a parameter but not changing the topology of the graph. (Yes, probably should
     * not be necessary.)
     * @method relayout
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _diagram.relayout = function() {
        _nodes_snapshot = _edges_snapshot = null;
        return this;
    };

    /**
     * Function to call to generate an initial layout. Takes (diagram, nodes, edges)
     *
     * **Deprecated**: The only layout that was using this was `tree_positions` and it never
     * worked as an initialization step for cola, as was originally intended. Now that
     * `tree_layout` is a layout algorithm, this should go away.
     *
     * In the future, there will be support for chaining layout algorithms. But that will be a
     * matter of composing them into a super-algorithm, not a special step like this was.
     * @method initialLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [initialLayout=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     **/
    _diagram.initialLayout = deprecated_property('initialLayout is deprecated - use layout algorithms instead', null);

    _diagram.initialOnly = deprecated_property('initialOnly is deprecated - see the initialLayout deprecation notice in the documentation', false);

    /**
     * By default, all nodes are included, and edges are only included if both end-nodes are
     * visible.  If `.induceNodes` is set, then only nodes which have at least one edge will be
     * shown.
     * @method induceNodes
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [induceNodes=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.induceNodes = property(false);

    /**
     * If this flag is true, the positions of nodes and will be updated while layout is
     * iterating. If false, the positions will only be updated once layout has
     * stabilized. Note: this may not be compatible with transitionDuration.
     * @method showLayoutSteps
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [showLayoutSteps=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.showLayoutSteps = property(false);

    /**
     * Assigns a legend object which will be displayed within the same SVG element and
     * according to the visual encoding of this diagram.
     * @method legend
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [legend=null]
     * @return {Object}
     * @return {dc_graph.diagram}
     **/
    _diagram.legend = property(null).react(function(l) {
        l.parent(_diagram);
    });

    /**
     * Specifies another kind of child layer or interface. For example, this can
     * be used to display tooltips on nodes using `dc_graph.tip`.

     * The child needs to support a `parent` method, the diagram to modify.
     * @method child
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [id] - the name of the child to modify or add
     * @param {Object} [object] - the child object to add, or null to remove
     * @example
     * // Display tooltips on node hover, via the d3-tip library
     * var tip = dc_graph.tip()
     * tip.content(function(n, k) {
     *   // you can do an asynchronous call here, e.g. d3.json, if you need
     *   // to fetch data to show the tooltip - just call k() with the content
     *   k("This is <em>" + n.orig.value.name + "</em>");
     * });
     * diagram.child('tip', tip);
     * @return {dc_graph.diagram}
     **/
    _diagram.mode = _diagram.child = named_children();

    /**
     * Specify 'cola' (the default) or 'dagre' as the Layout Algorithm and it will replace the
     * back-end.
     *
     * **Deprecated**: use {@link dc_graph.diagram#layoutEngine diagram.layoutEngine} with the engine
     * object instead
     * @method layoutAlgorithm
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [algo='cola'] - the name of the layout algorithm to use
     * @example
     * // use dagre for layout
     * diagram.layoutAlgorithm('dagre');
     * @return {dc_graph.diagram}
     **/
    _diagram.layoutAlgorithm = function(value, skipWarning) {
        if(!arguments.length)
            return _diagram.layoutEngine() ? _diagram.layoutEngine().layoutAlgorithm() : 'cola';
        if(!skipWarning)
            console.warn('dc.graph.diagram.layoutAlgorithm is depecrated - pass the layout engine object to dc_graph.diagram.layoutEngine instead');

        var engine;
        switch(value) {
        case 'cola':
            engine = dc_graph.cola_layout();
            break;
        case 'dagre':
            engine = dc_graph.dagre_layout();
        }
        engine = dc_graph.webworker_layout(engine);
        _diagram.layoutEngine(engine);
        return this;
    };

    /**
     * The layout engine determines how to draw things!
     * @method layoutEngine
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [engine=null] - the layout engine to use
     * @example
     * // use cola with no webworker
     * diagram.layoutEngine(dc_graph.cola_layout());
     * // use dagre with a webworker
     * diagram.layoutEngine(dc_graph.webworker_layout(dc_graph.dagre_layout()));
     **/
    _diagram.layoutEngine = property(null).react(function(val) {
        if(val && val.parent)
            val.parent(_diagram);
        if(_g) { // already rendered
            // remove any calculated points, if engine did that
            Object.keys(_edges).forEach(function(k) {
                _edges[k].cola.points = null;
            });
            // initialize engine
            initLayout(val);
        }
    });

    // S-spline any edges that are not going in this direction
    _diagram.enforceEdgeDirection = property(null);

    _diagram.tickSize = deprecate_layout_algo_parameter('tickSize');


    _diagram.uniqueId = function() {
        return _diagram.anchorName().replace(/[ .#=\[\]"]/g, '-');
    };

    _diagram.edgeId = function(e) {
        return 'edge-' + _diagram.edgeKey.eval(e).replace(/[^\w-_]/g, '-');
    };

    _diagram.arrowId = function(e, kind) {
        return 'arrow-' + kind + '-' + _diagram.uniqueId() + '-'  + _diagram.edgeId(e);
    };
    _diagram.textpathId = function(e) {
        return 'textpath-' + _diagram.uniqueId() + '-' + _diagram.edgeId(e);
    };

    // this kind of begs a (meta)graph ADT
    // instead of munging this into the diagram
    _diagram.getNode = function(id) {
        return _nodes[id] ? _nodes[id].orig : null;
    };

    _diagram.getWholeNode = function(id) {
        return _nodes[id] ? _nodes[id] : null;
    };

    _diagram.getEdge = function(id) {
        return _edges[id] ? _edges[id].orig : null;
    };

    _diagram.getWholeEdge = function(id) {
        return _edges[id] ? _edges[id] : null;
    };

    // again, awful, we need an ADT
    _diagram.getPort = function(nid, eid, name) {
        return _ports[port_name(nid, eid, name)];
    };

    _diagram.nodePorts = function() {
        return _nodePorts;
    };

    /**
     * Instructs cola.js to fit the connected components.
     *
     * **Deprecated**: Use
     * {@link dc_graph.cola_layout#handleDisconnected cola_layout.handleDisconnected} instead.
     * @method handleDisconnected
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [handleDisconnected=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     **/
    _diagram.handleDisconnected = deprecate_layout_algo_parameter('handleDisconnected');

    function initLayout(engine) {
        if(!_diagram.layoutEngine())
            _diagram.layoutAlgorithm('cola', true);
        (engine || _diagram.layoutEngine()).init({
            width: _diagram.width(),
            height: _diagram.height()
        });
    }

    _diagram.forEachChild = function(node, children, idf, f) {
        children.enum().forEach(function(key) {
            f(children(key),
              node.filter(function(n) { return idf(n) === key; }));
        });
    };
    _diagram.forEachShape = function(node, f) {
        _diagram.forEachChild(node, _diagram.shape, function(n) { return n.dcg_shape.shape; }, f);
    };
    _diagram.forEachContent = function(node, f) {
        _diagram.forEachChild(node, _diagram.content, _diagram.nodeContent.eval, f);
    };
    _diagram.renderNode = _diagram._enterNode = function(nodeEnter) {
        if(_diagram.nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(infer_shape(_diagram));
        _diagram.forEachShape(nodeEnter, function(shape, node) {
            node.call(shape.create);
        });
        return _diagram;
    };
    _diagram.redrawNode = _diagram._updateNode = function(node) {
        var changedShape = node.filter(shape_changed(_diagram));
        changedShape.selectAll('.node-shape').remove();
        changedShape.each(infer_shape(_diagram));
        _diagram.forEachShape(changedShape, function(shape, node) {
            node.call(shape.create);
        });
        node.select('title')
            .text(_diagram.nodeTitle.eval);
        _diagram.forEachContent(node, function(contentType, node) {
            node.call(contentType.update);
            _diagram.forEachShape(contentType.selectContent(node), function(shape, content) {
                content
                    .call(fit_shape(shape, _diagram));
            });
        });
        _diagram.forEachShape(node, function(shape, node) {
            node.call(shape.update);
        });
        node.select('.node-shape')
            .attr({
                stroke: _diagram.nodeStroke.eval,
                'stroke-width': _diagram.nodeStrokeWidth.eval,
                'stroke-dasharray': _diagram.nodeStrokeDashArray.eval,
                fill: compose(_diagram.nodeFillScale() || identity, _diagram.nodeFill.eval)
            });
        return _diagram;
    };

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    // three stages: delete before layout, and modify & insert split the transitionDuration
    _diagram.stagedDuration = function() {
        return (_diagram.stageTransitions() !== 'none') ?
            _diagram.transitionDuration() / 2 :
            _diagram.transitionDuration();
    };

    _diagram.stagedDelay = function(is_enter) {
        return _diagram.stageTransitions() === 'none' ||
            _diagram.stageTransitions() === 'modins' === !is_enter ?
            0 :
            _diagram.transitionDuration() / 2;
    };

    _diagram.selectAllNodes = function(selector) {
        selector = selector || '.node';
        return _nodeLayer.selectAll(selector).filter(function(n) {
            return !n.deleted;
        });
    };

    _diagram.selectAllEdges = function(selector) {
        selector = selector || '.edge';
        return _edgeLayer.selectAll(selector).filter(function(e) {
            return !e.deleted;
        });
    };

    _diagram.selectAllDefs = function(selector) {
        return _defs.selectAll(selector).filter(function(def) {
            return !def.deleted;
        });
    };

    _diagram.isRunning = function() {
        return _running;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Computes a new layout based on the nodes and edges in the edge groups, and
     * displays the diagram.  To the extent possible, the diagram will minimize changes in
     * positions from the previous layout.  `.render()` must be called the first time, and
     * `.redraw()` can be called after that.
     *
     * `.redraw()` will be triggered by changes to the filters in any other charts in the same
     * dc.js chart group.
     *
     * Unlike in dc.js, `redraw` executes asynchronously, because drawing can be computationally
     * intensive, and the diagram will be drawn multiple times if
     * {@link #dc_graph.diagram+showLayoutSteps showLayoutSteps}
     * is enabled. Watch the {@link #dc_graph.diagram+on 'end'} event to know when layout is
     * complete.
     **/
    var _needsRedraw = false;
    _diagram.redraw = function () {
        // since dc.js can receive UI events and trigger redraws whenever it wants,
        // and cola absolutely will not tolerate being poked while it's doing layout,
        // we need to guard the startLayout call.
        if(_running) {
            _needsRedraw = true;
            return this;
        }
        else return _diagram.startLayout();
    };

    _diagram.startLayout = function () {
        var nodes = _diagram.nodeGroup().all();
        var edges = _diagram.edgeGroup().all();
        var ports = _diagram.portGroup() ? _diagram.portGroup().all() : [];
        if(_running) {
            throw new Error('dc_graph.diagram.redraw already running!');
        }
        _running = true;

        _diagram.resizeSvg();
        if(_diagram.initLayoutOnRedraw())
            initLayout();
        _diagram.layoutEngine().stop();
        _dispatch.preDraw();

        // ordering shouldn't matter, but we support ordering in case it does
        if(_diagram.nodeOrdering()) {
            nodes = crossfilter.quicksort.by(_diagram.nodeOrdering())(nodes.slice(0), 0, nodes.length);
        }
        if(_diagram.edgeOrdering()) {
            edges = crossfilter.quicksort.by(_diagram.edgeOrdering())(edges.slice(0), 0, edges.length);
        }

        var wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return _diagram.nodeKey()(v);
        }, function(v1, v) {
            v1.orig = v;
            v1.cola = v1.cola || {};
            v1.cola.dcg_nodeKey = _diagram.nodeKey.eval(v1);
            _diagram.layoutEngine().populateLayoutNode(v1.cola, v1);
        });
        var wedges = regenerate_objects(_edges, edges, null, function(e) {
            return _diagram.edgeKey()(e);
        }, function(e1, e) {
            e1.orig = e;
            e1.cola = e1.cola || {};
            e1.cola.dcg_edgeKey = _diagram.edgeKey.eval(e1);
            e1.cola.dcg_edgeSource = _diagram.edgeSource.eval(e1);
            e1.cola.dcg_edgeTarget = _diagram.edgeTarget.eval(e1);
            e1.source = _nodes[e1.cola.dcg_edgeSource];
            e1.target = _nodes[e1.cola.dcg_edgeTarget];
            e1.cola.dcg_edgeLength = _diagram.edgeLength.eval(e1);
            e1.sourcePort = e1.sourcePort || {};
            e1.targetPort = e1.targetPort || {};
            _diagram.layoutEngine().populateLayoutEdge(e1.cola, e1);
        });

        // remove edges that don't have both end nodes
        wedges = wedges.filter(has_source_and_target);

        // remove self-edges (since we can't draw them - will be option later)
        wedges = wedges.filter(function(e) { return e.source !== e.target; });

        wedges = wedges.filter(_diagram.edgeIsShown.eval);

        // now we know which ports should exist
        var needports = wedges.map(function(e) {
            if(_diagram.edgeSourcePortName.eval(e))
                return port_name(_diagram.edgeSource.eval(e), null, _diagram.edgeSourcePortName.eval(e));
            else return port_name(null, _diagram.edgeKey.eval(e), 'source');
        });
        needports = needports.concat(wedges.map(function(e) {
            if(_diagram.edgeTargetPortName.eval(e))
                return port_name(_diagram.edgeTarget.eval(e), null, _diagram.edgeTargetPortName.eval(e));
            else return port_name(null, _diagram.edgeKey.eval(e), 'target');
        }));
        // remove any invalid ports so they don't crash in confusing ways later
        ports = ports.filter(function(p) {
            return _diagram.portNodeKey() && _diagram.portNodeKey()(p) ||
                _diagram.portEdgeKey() && _diagram.portEdgeKey()(p);
        });
        var wports = regenerate_objects(_ports, ports, needports, function(p) {
            return port_name(_diagram.portNodeKey() && _diagram.portNodeKey()(p),
                             _diagram.portEdgeKey() && _diagram.portEdgeKey()(p),
                             _diagram.portName()(p));
        }, function(p1, p) {
            p1.orig = p;
            if(p1.named)
                p1.edges = [];
        }, function(k, p) {
            console.assert(k, 'should have screened out invalid ports');
            // it's dumb to parse the id we just created. as usual, i blame the lack of metagraphs
            var parse = split_port_name(k);
            if(parse.nodeKey) {
                p.node = _nodes[parse.nodeKey];
                p.named = true;
            }
            else {
                var e = _edges[parse.edgeKey];
                p.node = e[parse.name];
                p.edges = [e];
                p.named = false;
            }
            p.name = parse.name;
        });
        // remove any ports where the end-node was not found, to avoid crashing elsewhere
        wports = wports.filter(function(p) { return p.node; });

        // find all edges for named ports
        wedges.forEach(function(e) {
            var name = _diagram.edgeSourcePortName.eval(e);
            if(name)
                _ports[port_name(_diagram.nodeKey.eval(e.source), null, name)].edges.push(e);
            name = _diagram.edgeTargetPortName.eval(e);
            if(name)
                _ports[port_name(_diagram.nodeKey.eval(e.target), null, name)].edges.push(e);
        });

        // optionally, delete nodes that have no edges
        if(_diagram.induceNodes()) {
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

        // announce new data
        _dispatch.data(_diagram, _nodes, wnodes, _edges, wedges, _ports, wports);
        _stats = {nnodes: wnodes.length, nedges: wedges.length};

        // fixed nodes may have been affected by .data() so calculate now
        wnodes.forEach(function(v) {
            if(_diagram.nodeFixed())
                v.cola.dcg_nodeFixed = _diagram.nodeFixed.eval(v);
        });

        // annotate parallel edges so we can draw them specially
        if(_diagram.parallelEdgeOffset()) {
            var em = new Array(wnodes.length);
            for(var i = 0; i < wnodes.length; ++i)
                em[i] = new Array(i);
            wedges.forEach(function(e) {
                e.pos = e.pos || {};
                var min, max, minattr, maxattr;
                if(e.source.index < e.target.index) {
                    min = e.source.index; max = e.target.index;
                    minattr = 'edgeSourcePortName'; maxattr = 'edgeTargetPortName';
                } else {
                    max = e.source.index; min = e.target.index;
                    maxattr = 'edgeSourcePortName'; minattr = 'edgeTargetPortName';
                }
                var minport = _diagram[minattr].eval(e) || 'no port',
                    maxport = _diagram[maxattr].eval(e) || 'no port';
                em[max][min] = em[max][min] || {};
                em[max][min][maxport] = em[max][min][maxport] || {};
                e.parallel = em[max][min][maxport][minport] = em[max][min][maxport][minport] || {
                    rev: [],
                    edges: []
                };
                e.parallel.edges.push(e);
                e.parallel.rev.push(min !== e.source.index);
            });
        }

        // create edge SVG elements
        var edge = _edgeLayer.selectAll('.edge')
                .data(wedges, _diagram.edgeKey.eval);
        var edgeEnter = edge.enter().append('svg:path')
                .attr({
                    class: 'edge',
                    id: _diagram.edgeId,
                    opacity: 0
                });

        edge.exit().each(function(e) {
            e.deleted = true;
        }).transition()
            .duration(_diagram.stagedDuration())
            .delay(_diagram.deleteDelay())
            .attr('opacity', 0)
            .each(function(e) {
                edgeArrow(e, 'head', null);
                edgeArrow(e, 'head', null);
            })
            .remove();

        if(_diagram.edgeSort()) {
            edge.sort(function(a, b) {
                var as = _diagram.edgeSort.eval(a), bs = _diagram.edgeSort.eval(b);
                return as < bs ? -1 : bs < as ? 1 : 0;
            });
        }

        // another wider copy of the edge just for hover events
        var edgeHover = _edgeLayer.selectAll('.edge-hover')
                .data(wedges, _diagram.edgeKey.eval);
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('fill', 'none')
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover', function(e) {
                d3.select('#' + _diagram.edgeId(e) + '-label')
                    .attr('visibility', 'visible');
            })
            .on('mouseout', function(e) {
                d3.select('#' + _diagram.edgeId(e) + '-label')
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();

        var edgeLabels = _edgeLayer.selectAll('.edge-label')
                .data(wedges, _diagram.edgeKey.eval);
        var edgeLabelsEnter = edgeLabels.enter()
              .append('text')
                .attr('id', function(e) {
                    return _diagram.edgeId(e) + '-label';
                })
                .attr('visibility', 'hidden')
                .attr({'class':'edge-label',
                       'text-anchor': 'middle',
                       dy:-2})
              .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', function(e) {
                    var id = _diagram.textpathId(e);
                    // angular on firefox needs absolute paths for fragments
                    return window.location.href.split('#')[0] + '#' + id;
                });
        var textPaths = _defs.selectAll('path.edge-label-path')
                .data(wedges, _diagram.textpathId);
        var textPathsEnter = textPaths.enter()
                .append('svg:path').attr({
                    class: 'edge-label-path',
                    id: _diagram.textpathId
                });
        edgeLabels.exit().transition()
            .duration(_diagram.stagedDuration())
            .delay(_diagram.deleteDelay())
            .attr('opacity', 0).remove();

        // create node SVG elements
        var node = _nodeLayer.selectAll('.node')
                .data(wnodes, _diagram.nodeKey.eval);
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('opacity', '0'); // don't show until has layout
        // .call(_d3cola.drag);

        _diagram._enterNode(nodeEnter);

        node.exit().each(function(n) {
            n.deleted = true;
        }).transition()
            .duration(_diagram.stagedDuration())
            .delay(_diagram.deleteDelay())
            .attr('opacity', 0)
            .remove();

        _dispatch.drawn(node, edge, edgeHover);

        _refresh(node, edge);

        // really we should have layout chaining like in the good old Dynagraph days
        // the ordering of this and the previous 4 statements is somewhat questionable
        if(_diagram.initialLayout())
            _diagram.initialLayout()(_diagram, wnodes, wedges);

        // no layout if the topology and layout parameters haven't changed
        var skip_layout = false;
        if(!_diagram.layoutUnchanged()) {
            var nodes_snapshot = JSON.stringify(wnodes.map(function(n) {
                return {orig: get_original(n), cola: {dcg_nodeFixed: n.cola.dcg_nodeFixed}};
            }));
            var edges_snapshot = JSON.stringify(wedges.map(function(e) {
                return {orig: get_original(e), cola: e.cola};
            }));
            if(nodes_snapshot === _nodes_snapshot && edges_snapshot === _edges_snapshot)
                skip_layout = true;
            _nodes_snapshot = nodes_snapshot;
            _edges_snapshot = edges_snapshot;
        }

        // cola constraints always use indices, but node references
        // are more friendly, so translate those

        // i am not satisfied with this constraint generation api...
        // https://github.com/dc-js/dc.graph.js/issues/10
        var constraints = _diagram.constrain()(_diagram, wnodes, wedges);
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
        var layout_edges = wedges.filter(_diagram.edgeIsLayout.eval);
        var nonlayout_edges = wedges.filter(function(x) {
            return !_diagram.edgeIsLayout.eval(x);
        });

        // 2. type=circle constraints
        var circle_constraints = constraints.filter(function(c) {
            return c.type === 'circle';
        });
        constraints = constraints.filter(function(c) {
            return c.type !== 'circle';
        });
        circle_constraints.forEach(function(c) {
            var R = (c.distance || _diagram.baseLength()*4) / (2*Math.sin(Math.PI/c.nodes.length));
            var nindices = c.nodes.map(function(x) { return x.node; });
            var namef = function(i) {
                return _diagram.nodeKey.eval(wnodes[i]);
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
        if(_diagram.legend())
            _diagram.legend().redraw();
        if(skip_layout) {
            _running = false;
            _dispatch.end(false);
            return this;
        }
        var startTime = Date.now();

        function populate_cola(rnodes, redges) {
            rnodes.forEach(function(rn) {
                var n = _nodes[rn.dcg_nodeKey];
                if(!n) {
                    console.warn('received node "' + rn.dcg_nodeKey + '" that we did not send');
                    return;
                }
                n.cola.x = rn.x;
                n.cola.y = rn.y;
            });
            redges.forEach(function(re) {
                var e = _edges[re.dcg_edgeKey];
                if(!e) {
                    console.warn('received edge "' + re.dcg_edgeKey + '" that we did not send');
                    return;
                }
                if(re.points)
                    e.cola.points = re.points;
            });
        }
        _diagram.layoutEngine()
            .on('tick', function(nodes, edges) {
                var elapsed = Date.now() - startTime;
                if(!_diagram.initialOnly())
                    populate_cola(nodes, edges);
                if(_diagram.showLayoutSteps()) {
                    init_node_ports(_nodes, wports);
                    _dispatch.receivedLayout(_diagram, _nodes, wnodes, _edges, wedges, _ports, wports);
                    propagate_port_positions(_nodes, wedges, _ports);
                    draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter, textPaths, textPathsEnter, true);
                    draw_ports(node);
                    // should do this only once
                    _dispatch.transitionsStarted(node, edge, edgeHover);
                }
                if(_needsRedraw || _diagram.timeLimit() && elapsed > _diagram.timeLimit()) {
                    console.log('cancelled');
                    _diagram.layoutEngine().stop();
                }
            })
            .on('end', function(nodes, edges) {
                if(!_diagram.showLayoutSteps()) {
                    if(!_diagram.initialOnly())
                        populate_cola(nodes, edges);
                    init_node_ports(_nodes, wports);
                    _dispatch.receivedLayout(_diagram, _nodes, wnodes, _edges, wedges, _ports, wports);
                    propagate_port_positions(_nodes, wedges, _ports);
                    draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter, textPaths, textPathsEnter, true);
                    draw_ports(node);
                    _dispatch.transitionsStarted(node, edge, edgeHover);
                }
                else layout_done(true);
                var do_zoom, animate = true;
                switch(_diagram.autoZoom()) {
                case 'always-skipanimonce':
                    animate = false;
                    _diagram.autoZoom('always');
                case 'always':
                    do_zoom = true;
                    break;
                case 'once-noanim':
                    animate = false;
                case 'once':
                    do_zoom = true;
                    _diagram.autoZoom(null);
                    break;
                default:
                    do_zoom = false;
                }
                calc_bounds(node, edge);
                if(do_zoom)
                    auto_zoom(animate);
            })
            .on('start', function() {
                console.log('algo ' + _diagram.layoutEngine().layoutAlgorithm() + ' started.');
                _dispatch.start();
            });

        if(_diagram.initialOnly())
            _diagram.layoutEngine().dispatch().end(wnodes, wedges);
        else {
            _dispatch.start(); // cola doesn't seem to fire this itself?
            _diagram.layoutEngine().data(
                { width: _diagram.width(), height: _diagram.height() },
                wnodes.map(function(v) { return v.cola; }),
                layout_edges.map(function(v) { return v.cola; }),
                constraints
            );
            _diagram.layoutEngine().start();
        }
        return this;
    };

    function norm(v) {
        var len = Math.hypot(v[0], v[1]);
        return [v[0]/len, v[1]/len];
    }
    function edge_vec(n, e) {
        var dy = e.target.cola.y - e.source.cola.y,
            dx = e.target.cola.x - e.source.cola.x;
        if(e.source !== n)
            dy = -dy, dx = -dx;
        if(e.parallel && e.parallel.edges.length > 1 && e.source.index > e.target.index)
            dy = -dy, dx = -dx;
        return norm([dx, dy]);
    }
    function init_node_ports(nodes, wports) {
        _nodePorts = {};
        // assemble port-lists for nodes, again because we don't have a metagraph.
        wports.forEach(function(p) {
            var nid = _diagram.nodeKey.eval(p.node);
            var np = _nodePorts[nid] = _nodePorts[nid] || [];
            np.push(p);
        });
        for(var nid in _nodePorts) {
            var n = nodes[nid],
                nports = _nodePorts[nid];
            // initial positions: use average of edge vectors, if any, or existing position
            nports.forEach(function(p) {
                if(_diagram.portElastic.eval(p) && p.edges.length) {
                    var vecs = p.edges.map(edge_vec.bind(null, n));
                    p.vec = [
                        d3.sum(vecs, function(v) { return v[0]; })/vecs.length,
                        d3.sum(vecs, function(v) { return v[1]; })/vecs.length
                    ];
                } else p.vec = p.vec || undefined;
                p.pos = null;
            });
        }
    }
    function propagate_port_positions(nodes, wedges, ports) {
        // make sure we have projected vectors to positions
        for(var nid in _nodePorts) {
            var n = nodes[nid];
            _nodePorts[nid].forEach(function(p) {
                if(!p.pos)
                    project_port(_diagram, n, p);
            });
        }

        // propagate port positions to edge endpoints
        wedges.forEach(function(e) {
            var name = _diagram.edgeSourcePortName.eval(e);
            e.sourcePort.pos = name ? ports[port_name(_diagram.nodeKey.eval(e.source), null, name)].pos :
                ports[port_name(null, _diagram.edgeKey.eval(e), 'source')].pos;
            name = _diagram.edgeTargetPortName.eval(e);
            e.targetPort.pos = name ? ports[port_name(_diagram.nodeKey.eval(e.target), null, name)].pos :
                ports[port_name(null, _diagram.edgeKey.eval(e), 'target')].pos;
            console.assert(e.sourcePort.pos && e.targetPort.pos);
        });
    }

    function _refresh(node, edge) {
        edge
            .attr('stroke', _diagram.edgeStroke.eval)
            .attr('stroke-width', _diagram.edgeStrokeWidth.eval)
            .attr('stroke-dasharray', _diagram.edgeStrokeDashArray.eval)
            .attr('marker-end', function(e) {
                var name = _diagram.edgeArrowhead.eval(e),
                    id = edgeArrow(e, 'head', name);
                return id ? 'url(#' + id + ')' : null;
            })
            .attr('marker-start', function(e) {
                var name = _diagram.edgeArrowtail.eval(e),
                    arrow_id = edgeArrow(e, 'tail', name);
                return name ? 'url(#' + arrow_id + ')' : null;
            })
            .each(function(e) {
                d3.selectAll('#' + _diagram.arrowId(e, 'head') + ',#' + _diagram.arrowId(e, 'tail'))
                    .attr('fill', _diagram.edgeStroke.eval(e));
            });

        _diagram._updateNode(node);
        draw_ports(node);
    }

    _diagram.refresh = function(node, edge, edgeHover, edgeLabels, textPaths) {
        node = node || _diagram.selectAllNodes();
        edge = edge || _diagram.selectAllEdges();
        _refresh(node, edge);

        edgeHover = edgeHover || _diagram.selectAllEdges('.edge-hover');
        edgeLabels = edgeLabels || _diagram.selectAllEdges('.edge-label');
        textPaths = textPaths || _diagram.selectAllDefs('path.edge-label-path');
        var nullSel = d3.select(null); // no enters
        draw(node, nullSel, edge, nullSel, edgeHover, nullSel, edgeLabels, nullSel, textPaths, nullSel, false);
        return this;
    };

    _diagram.reposition = function(node, edge) {
        node
            .attr('transform', function (n) {
                return 'translate(' + n.cola.x + ',' + n.cola.y + ')';
            });
        // reset edge ports
        edge.each(function(e) {
            e.pos.new = null;
            e.pos.old = null;
            calc_edge_path(e, 'new', e.source.cola.x, e.source.cola.y, e.target.cola.x, e.target.cola.y);
            if(_diagram.edgeArrowhead.eval(e))
                d3.select('#' + _diagram.arrowId(e, 'head'))
                .attr('orient', function() {
                    return e.pos.new.orienthead;
                });
            if(_diagram.edgeArrowtail.eval(e))
                d3.select('#' + _diagram.arrowId(e, 'tail'))
                .attr('orient', function() {
                    return e.pos.new.orienttail;
                });
        })
            .attr('d', render_edge_path('new'));
        return this;
    };

    function layout_done(happens) {
        _dispatch.end(happens);
        _running = false;
        if(_needsRedraw) {
            _needsRedraw = false;
            window.setTimeout(function() {
                if(!_diagram.isRunning()) // someone else may already have started
                    _diagram.redraw();
            }, 0);
        }
    }

    function calculate_arrowhead_orientation(points, end) {
        var spos = points[0], tpos = points[points.length-1];
        var partial = bezier_point(points, end === 'tail' ? 0.25 : 0.75);
        return (end === 'head' ?
                Math.atan2(tpos.y - partial.y, tpos.x - partial.x) :
                Math.atan2(spos.y - partial.y, spos.x - partial.x)) + 'rad';
    }

    function enforce_path_direction(path, spos, tpos) {
        var points = path.points, first = points[0], last = points[points.length-1];
        switch(_diagram.enforceEdgeDirection()) {
        case 'LR':
            if(spos.x >= tpos.x) {
                var dx = first.x - last.x;
                return {
                    points: [
                        first,
                        {x: first.x + dx, y: first.y - dx/2},
                        {x: last.x - dx, y: last.y - dx/2},
                        last
                    ],
                    bezDegree: 3,
                    sourcePort: path.sourcePort,
                    targetPort: path.targetPort
                };
            }
            break;
        case 'TB':
            if(spos.y >= tpos.y) {
                var dy = first.y - last.y;
                return {
                    points: [
                        first,
                        {x: first.x + dy/2, y: first.y + dy},
                        {x: last.x + dy/2, y: last.y - dy},
                        last
                    ],
                    bezDegree: 3,
                    sourcePort: path.sourcePort,
                    targetPort: path.targetPort
                };
            }
            break;
        }
        return path;
    }
    function calc_edge_path(e, age, sx, sy, tx, ty) {
        var parallel = e.parallel;
        var source = e.source, target = e.target;
        if(parallel.edges.length > 1 && e.source.index > e.target.index) {
            var t;
            t = target; target = source; source = t;
            t = tx; tx = sx; sx = t;
            t = ty; ty = sy; sy = t;
        }
        var source_padding = source.dcg_ry +
            _diagram.nodeStrokeWidth.eval(source) / 2,
            target_padding = target.dcg_ry +
            _diagram.nodeStrokeWidth.eval(target) / 2;
        for(var p = 0; p < parallel.edges.length; ++p) {
            // alternate parallel edges over, then under
            var dir = (!!(p%2) === (sx < tx)) ? -1 : 1,
                port = Math.floor((p+1)/2),
                last = port > 0 ? parallel.edges[p > 2 ? p - 2 : 0].pos[age].path : null;
            var path = draw_edge_to_shapes(_diagram, e, sx, sy, tx, ty,
                                           last, dir, _diagram.parallelEdgeOffset(),
                                           source_padding, target_padding
                                          );
            if(parallel.edges.length > 1 && parallel.rev[p])
                path.points.reverse();
            if(_diagram.enforceEdgeDirection())
                path = enforce_path_direction(path, source.cola, target.cola);
            parallel.edges[p].pos[age] = {
                path: path,
                orienthead: calculate_arrowhead_orientation(path.points, 'head'),
                orienttail: calculate_arrowhead_orientation(path.points, 'tail')
            };
        }
    }

    function render_edge_path(age) {
        return function(e) {
            var path = e.pos[age].path;
            return generate_path(path.points, path.bezDegree);
        };
    }

    function render_edge_label_path(age) {
        return function(e) {
            var path = e.pos[age].path;
            var points = path.points[path.points.length-1].x < path.points[0].x ?
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
        var points = e.pos.new.path.points;
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
        if((_diagram.fitStrategy() || _diagram.restrictPan()) && node.size()) {
            // assumption: there can be no edges without nodes
            _bounds = node.data().map(node_bounds).reduce(union_bounds);
            _bounds = edge.data().map(edge_bounds).reduce(union_bounds, _bounds);
        }
    }

    function auto_zoom(animate) {
        if(_diagram.fitStrategy()) {
            if(!_bounds)
                return;
            var vwidth = _bounds.right - _bounds.left, vheight = _bounds.bottom - _bounds.top,
                swidth =  _diagram.width() - _diagram.margins().left - _diagram.margins().right,
                sheight = _diagram.height() - _diagram.margins().top - _diagram.margins().bottom;
            if(_diagram.DEBUG_BOUNDS)
                debug_bounds(_bounds);
            var fitS = _diagram.fitStrategy(), translate = [0,0], scale = 1;
            if(['default', 'vertical', 'horizontal'].indexOf(fitS) >= 0) {
                var sAR = sheight / swidth, vAR = vheight / vwidth,
                    vrl = vAR<sAR, // view aspect ratio is less (wider)
                    amv = (fitS === 'default') ? !vrl : (fitS === 'vertical'); // align margins vertically
                scale = amv ? sheight / vheight : swidth / vwidth;
                scale = Math.max(_diagram.zoomExtent()[0], Math.min(_diagram.zoomExtent()[1], scale));
                translate = [_diagram.margins().left - _bounds.left*scale + (swidth - vwidth*scale) / 2,
                             _diagram.margins().top - _bounds.top*scale + (sheight - vheight*scale) / 2];
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
            else if(fitS === 'zoom')
                translate = bring_in_bounds(_zoom.translate());
            else
                throw new Error('unknown fitStrategy type ' + typeof fitS);

            _animateZoom = animate;
            _zoom.translate(translate).scale(scale).event(_svg);
            _animateZoom = false;
        }
    }

    function draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter, edgeLabels, edgeLabelsEnter, textPaths, textPathsEnter, animatePositions) {
        console.assert(edge.data().every(has_source_and_target));

        var nodeEntered = {};
        nodeEnter
            .each(function(n) {
                nodeEntered[_diagram.nodeKey.eval(n)] = true;
            })
            .attr('transform', function (n) {
                // start new nodes at their final position
                return 'translate(' + n.cola.x + ',' + n.cola.y + ')';
            });
        var ntrans = node
                .transition()
                .duration(_diagram.stagedDuration())
                .delay(function(n) {
                    return _diagram.stagedDelay(nodeEntered[_diagram.nodeKey.eval(n)]);
                })
                .attr('opacity', _diagram.nodeOpacity.eval);
        if(animatePositions)
            ntrans
                .attr('transform', function (n) {
                    return 'translate(' + n.cola.x + ',' + n.cola.y + ')';
                })
                .each('end.record', function(n) {
                    n.prevX = n.cola.x;
                    n.prevY = n.cola.y;
                });

        // recalculate edge positions
        edge.each(function(e) {
            e.pos.new = null;
        });
        edge.each(function(e) {
            if(e.cola.points) {
                e.pos.new = {
                    path: {
                        points: e.cola.points,
                        bezDegree: 3
                    },
                    orienthead: calculate_arrowhead_orientation(e.cola.points, 'head'),
                    orienttail: calculate_arrowhead_orientation(e.cola.points, 'tail')
                };
            }
            else {
                if(!e.pos.old)
                    calc_edge_path(e, 'old', e.source.prevX || e.source.cola.x, e.source.prevY || e.source.cola.y,
                                   e.target.prevX || e.target.cola.x, e.target.prevY || e.target.cola.y);
                if(!e.pos.new)
                    calc_edge_path(e, 'new', e.source.cola.x, e.source.cola.y, e.target.cola.x, e.target.cola.y);
            }
            if(e.pos.old) {
                if(e.pos.old.path.bezDegree !== e.pos.new.path.bezDegree ||
                   e.pos.old.path.points.length !== e.pos.new.path.points.length) {
                    console.log('old', e.pos.old.path.points.length, 'new', e.pos.new.path.points.length);
                    if(is_one_segment(e.pos.old.path)) {
                        e.pos.new.path.points = as_bezier3(e.pos.new.path);
                        e.pos.old.path.points = split_bezier_n(as_bezier3(e.pos.old.path),
                                                               (e.pos.new.path.points.length-1)/3);
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    }
                    else if(is_one_segment(e.pos.new.path)) {
                        e.pos.old.path.points = as_bezier3(e.pos.old.path);
                        e.pos.new.path.points = split_bezier_n(as_bezier3(e.pos.new.path),
                                                               (e.pos.old.path.points.length-1)/3);
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    }
                    else console.warn("don't know how to interpolate two multi-segments");
                }
            }
            else
                e.pos.old = e.pos.new;
        });

        var edgeEntered = {};
        edgeEnter
            .each(function(e) {
                edgeEntered[_diagram.edgeKey.eval(e)] = true;
            })
            .each(function(e) {
                // if staging transitions, just fade new edges in at new position
                // else start new edges at old positions of nodes, if any, else new positions
                var age = _diagram.stageTransitions() === 'modins' ? 'new' : 'old';
                if(_diagram.edgeArrowhead.eval(e))
                    d3.select('#' + _diagram.arrowId(e, 'head'))
                    .attr('orient', function() {
                        return e.pos[age].orienthead;
                    });
                if(_diagram.edgeArrowtail.eval(e))
                    d3.select('#' + _diagram.arrowId(e, 'tail'))
                    .attr('orient', function() {
                        return e.pos[age].orienttail;
                    });
            })
            .attr('d', render_edge_path(_diagram.stageTransitions() === 'modins' ? 'new' : 'old'));

        var etrans = edge
                .each(function(e) {
                    if(_diagram.edgeArrowhead.eval(e))
                        d3.select('#' + _diagram.arrowId(e, 'head'))
                            .transition().duration(_diagram.stagedDuration())
                            .delay(_diagram.stagedDelay(false))
                            .attr('orient', function() {
                                return e.pos.new.orienthead;
                            });
                    if(_diagram.edgeArrowtail.eval(e))
                        d3.select('#' + _diagram.arrowId(e, 'tail'))
                            .transition().duration(_diagram.stagedDuration())
                            .delay(_diagram.stagedDelay(false))
                            .attr('orient', function() {
                                return e.pos.new.orienttail;
                            });
                })
              .transition()
                .duration(_diagram.stagedDuration())
                .delay(function(e) {
                    return _diagram.stagedDelay(edgeEntered[_diagram.edgeKey.eval(e)]);
                })
                .attr('opacity', _diagram.edgeOpacity.eval);
        if(animatePositions)
            etrans
                .attr('d', function(e) {
                    var when = _diagram.stageTransitions() === 'insmod' &&
                            edgeEntered[_diagram.edgeKey.eval(e)] ? 'old' : 'new';
                    return render_edge_path(when)(e);
                });
        edgeLabels
          .selectAll('textPath')
            .text(function(e){
                return _diagram.edgeLabel.eval(e);
            });
        textPathsEnter
            .attr('d', render_edge_label_path(_diagram.stageTransitions() === 'modins' ? 'new' : 'old'));
        var textTrans = textPaths.transition()
            .duration(_diagram.stagedDuration())
            .delay(function(e) {
                return _diagram.stagedDelay(edgeEntered[_diagram.edgeKey.eval(e)]);
            })
            .attr('opacity', _diagram.edgeOpacity.eval);
        if(animatePositions)
            textTrans
            .attr('d', function(e) {
                var when = _diagram.stageTransitions() === 'insmod' &&
                        edgeEntered[_diagram.edgeKey.eval(e)] ? 'old' : 'new';
                return render_edge_label_path(when)(e);
            });
        if(_diagram.stageTransitions() === 'insmod' && animatePositions) {
            // inserted edges transition twice in insmod mode
            if(_diagram.stagedDuration() >= 50) {
                etrans = etrans.transition()
                    .duration(_diagram.stagedDuration())
                    .attr('d', render_edge_path('new'));
                textTrans = textTrans.transition()
                    .duration(_diagram.stagedDuration())
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
        if(!_diagram.showLayoutSteps())
            endall([ntrans, etrans, textTrans], function() { layout_done(true); });

        if(animatePositions)
            edgeHover.attr('d', render_edge_path('new'));

        edge.each(function(e) {
            e.pos.old = e.pos.new;
        });
    }

    _diagram.selectNodePortsOfStyle = function(node, style) {
        return node.selectAll('g.port').filter(function(p) {
            return _diagram.portStyleName.eval(p) === style;
        });
    };

    function draw_ports(node) {
        if(!_nodePorts)
            return;
        _diagram.portStyle.enum().forEach(function(style) {
            var nodePorts2 = {};
            for(var nid in _nodePorts)
                nodePorts2[nid] = _nodePorts[nid].filter(function(p) {
                    return _diagram.portStyleName.eval(p) === style;
                });
            var port = _diagram.selectNodePortsOfStyle(node, style);
            _diagram.portStyle(style).drawPorts(port, nodePorts2, node);
        });
    }

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Erases any existing SVG elements and draws the diagram from scratch. `.render()`
     * must be called the first time, and `.redraw()` can be called after that.
     * @method render
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _diagram.render = function () {
        if(!_diagram.initLayoutOnRedraw())
            initLayout();
        _diagram.resetSvg();
        _g = _svg.append('g')
            .attr('class', 'draw');

        var layers = ['edge-layer', 'node-layer'];
        if(_diagram.edgesInFront())
            layers.reverse();
        _g.selectAll('g').data(layers)
          .enter().append('g')
            .attr('class', function(l) { return l; });
        _edgeLayer = _g.selectAll('g.edge-layer');
        _nodeLayer = _g.selectAll('g.node-layer');

        if(_diagram.legend())
            _diagram.legend().render();
        _diagram.redraw();
        return this;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Attaches an event handler to the diagram. The currently supported events are
     * * `start()` - layout is starting
     * * `drawn(nodes, edges)` - the node and edge elements have been rendered to the screen
     * and can be modified through the passed d3 selections.
     * * `end()` - diagram layout has completed.
     * @method on
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [event] - the event to subscribe to
     * @param {Function} [f] - the event handler
     * @return {dc_graph.diagram}
     **/
    _diagram.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };

    /**
     * Returns an object with current statistics on graph layout.
     * * `nnodes` - number of nodes displayed
     * * `nedges` - number of edges displayed
     * @method getStats
     * @memberof dc_graph.diagram
     * @instance
     * @return {}
     * @return {dc_graph.diagram}
     **/
    _diagram.getStats = function() {
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
     * @method select
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     **/
    _diagram.select = function (s) {
        return _diagram.root().select(s);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Selects all elements that match the d3 single selector in the diagram's scope,
     * and return the d3 selection. Roughly the same as
     *
     * ```js
     * d3.select('#diagram-id').selectAll(selector)
     * ```
     *
     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @method selectAll
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     **/
    _diagram.selectAll = function (s) {
        return _diagram.root() ? _diagram.root().selectAll(s) : null;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Gets or sets the x scale.
     * @method x
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.scale} [scale]
     * @return {d3.scale}
     * @return {dc_graph.diagram}

     **/
    _diagram.x = property(null);

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Gets or sets the y scale.
     * @method x
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.scale} [scale]
     * @return {d3.scale}
     * @return {dc_graph.diagram}

     **/
    _diagram.y = property(null);

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Returns the top `svg` element for this specific diagram. You can also pass in a new
     * svg element, but setting the svg element on a diagram may have unexpected consequences.
     * @method svg
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     **/
    _diagram.svg = function (_) {
        if (!arguments.length) {
            return _svg;
        }
        _svg = _;
        return _diagram;
    };

    /**
     * Returns the top `g` element for this specific diagram. This method is usually used to
     * retrieve the g element in order to overlay custom svg drawing
     * programatically. **Caution**: The root g element is usually generated internally, and
     * resetting it might produce unpredictable results.
     * @method g
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}

     **/
    _diagram.g = function (_) {
        if (!arguments.length) {
            return _g;
        }
        _g = _;
        return _diagram;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Remove the diagram's SVG elements from the dom and recreate the container SVG
     * element.
     * @method resetSvg
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _diagram.resetSvg = function () {
        _diagram.select('svg').remove();
        return generateSvg();
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be redrawn.
     * @method redrawGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _diagram.redrawGroup = function () {
        dc.redrawAll(_chartGroup);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be rendered.
     * @method renderGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     **/
    _diagram.renderGroup = function () {
        dc.renderAll(_chartGroup);
    };

    /**
     * Creates an svg marker definition for drawing edge arrow tails or heads. The `viewBox` of
     * the marker is `0 -5 10 10`, so the arrow should be drawn from (0, -5) to (10, 5); it
     * will be moved and sized based on the other parameters, and rotated based on the
     * orientation of the edge.
     *
     * (If further customization is required, it is possible to append other `svg:defs` to
     * `diagram.svg()` and use refer to them by `id`.)
     * @method defineArrow
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
     * _diagram.defineArrow('vee', 12, 12, 10, 0, function(marker) {
     *   marker.append('svg:path')
     *     .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
     *     .attr('stroke-width', '0px');
     * });
     * @return {dc_graph.diagram}
     **/
    _diagram.defineArrow = function(name, width, height, refX, refY, drawf) {
        _arrows[name] = {
            name: name,
            width: width,
            height: height,
            refX: refX,
            refY: refY,
            drawFunction: drawf
        };
        return _diagram;
    };

    _diagram.addOrRemoveDef = function(id, whether, tag) {
        var data = whether ? [0] : [];
        var sel = _defs.selectAll('#' + id).data(data);

        var selEnter = sel
            .enter().append(tag)
                .attr('id', id);
        sel.exit().remove();
        return selEnter;
    };

    function edgeArrow(e, kind, name) {
        var id = _diagram.arrowId(e, kind),
            markerEnter = _diagram.addOrRemoveDef(id, !!name, 'svg:marker');

        if(name) {
            markerEnter
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', _arrows[name].refX)
                .attr('refY', _arrows[name].refY)
                .attr('markerUnits', 'userSpaceOnUse')
                .attr('markerWidth', _arrows[name].width*_diagram.edgeArrowSize.eval(e))
                .attr('markerHeight', _arrows[name].height*_diagram.edgeArrowSize.eval(e))
                .attr('stroke', _diagram.edgeStroke.eval(e))
                .attr('fill', _diagram.edgeStroke.eval(e))
                .call(_arrows[name].drawFunction);
        }
        return name ? id : null;
    }

    function globalTransform(pos, scale, animate) {
        _translate = pos;
        _scale = scale;
        var obj = _g;
        if(animate)
            obj = _g.transition().duration(_diagram.zoomDuration());
        obj.attr('transform', 'translate(' + pos + ')' + ' scale(' + scale + ')');
    }

    function margined_bounds() {
        var bounds = _bounds || {left: 0, top: 0, right: 0, bottom: 0};
        var scale = _zoom ? _zoom.scale() : 1;
        return {
            left: bounds.left - _diagram.margins().left/scale,
            top: bounds.top - _diagram.margins().top/scale,
            right: bounds.right + _diagram.margins().right/scale,
            bottom: bounds.bottom + _diagram.margins().bottom/scale
        };
    }

    // with thanks to comments in https://github.com/d3/d3/issues/1084
    function align_left(translate, x) {
        return translate[0] - _diagram.x()(x) + _diagram.x().range()[0];
    }
    function align_top(translate, y) {
        return translate[1] - _diagram.y()(y) + _diagram.y().range()[0];
    }
    function align_right(translate, x) {
        return translate[0] - _diagram.x()(x) + _diagram.x().range()[1];
    }
    function align_bottom(translate, y) {
        return translate[1] - _diagram.y()(y) + _diagram.y().range()[1];;
    }

    function bring_in_bounds(translate) {
        var xDomain = _diagram.x().domain(), yDomain = _diagram.y().domain();
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
        return translate;

    }
    function doZoom() {
        var translate, scale = d3.event.scale;
        if(_diagram.restrictPan())
            _zoom.translate(translate = bring_in_bounds(d3.event.translate));
        else translate = d3.event.translate;
        globalTransform(translate, scale, _animateZoom);
        _dispatch.zoomed(translate, scale);
    }

    _diagram.resizeSvg = function(w, h) {
        if(_svg) {
            _svg.attr('width', w || _diagram.width())
                .attr('height', h || _diagram.height());
        }
        return _diagram;
    };

    function enableZoom() {
        _svg.call(_zoom);
        _svg.on('dblclick.zoom', null);
    }
    function disableZoom() {
        _svg.on('.zoom', null);
    }

    function generateSvg() {
        _svg = _diagram.root().append('svg');
        _diagram.resizeSvg();

        _defs = _svg.append('svg:defs');

        // start out with 1:1 zoom
        if(!_diagram.x())
            _diagram.x(d3.scale.linear()
                     .domain([0, _diagram.width()])
                     .range([0, _diagram.width()]));
        if(!_diagram.y())
            _diagram.y(d3.scale.linear()
                     .domain([0, _diagram.height()])
                     .range([0, _diagram.height()]));
        _zoom = d3.behavior.zoom()
            .on('zoom', doZoom)
            .x(_diagram.x()).y(_diagram.y())
            .scaleExtent(_diagram.zoomExtent());
        if(_diagram.mouseZoomable()) {
            var mod, mods;
            var brush = _diagram.child('brush');
            if((mod = _diagram.modKeyZoom())) {
                if (Array.isArray (mod))
                    mods = mod.slice ();
                else if (typeof mod === "string")
                    mods = [mod];
                else
                    mods = ['Alt'];
                var mouseDown = false, modDown = false, zoomEnabled = false;
                _svg.on('mousedown.modkey-zoom', function() {
                    mouseDown = true;
                }).on('mouseup.modkey-zoom', function() {
                    mouseDown = false;
                    if(!mouseDown && !modDown && zoomEnabled) {
                        zoomEnabled = false;
                        disableZoom();
                        if(brush)
                            brush.activate();
                    }
                });
                d3.select(document)
                    .on('keydown.modkey-zoom', function() {
                        if(mods.indexOf (d3.event.key) > -1) {
                            modDown = true;
                            if(!mouseDown) {
                                zoomEnabled = true;
                                enableZoom();
                                if(brush)
                                    brush.deactivate();
                            }
                        }
                    })
                    .on('keyup.modkey-zoom', function() {
                        if(mods.indexOf (d3.event.key) > -1) {
                            modDown = false;
                            if(!mouseDown) {
                                zoomEnabled = false;
                                disableZoom();
                                if(brush)
                                    brush.activate();
                            }
                        }
                    });
            }
            else enableZoom();
        }

        return _svg;
    }

    _diagram.invertCoord = function(clientCoord) {
        return [
            _diagram.x().invert(clientCoord[0]),
            _diagram.y().invert(clientCoord[1])
        ];
    };

    _diagram.defineArrow('vee', 12, 12, 10, 0, function(marker) {
        marker.append('svg:path')
            .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
            .attr('stroke-width', '0px');
    });
    _diagram.defineArrow('crow', 12, 12, 0, 0, function(marker) {
        marker.append('svg:path')
            .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
            .attr('stroke-width', '0px');
    });
    _diagram.defineArrow('dot', 7, 7, 0, 0, function(marker) {
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
     * internally on diagram initialization, but be called again to relocate the diagram. However, it
     * will orphan any previously created SVGElements.
     * @method anchor
     * @memberof dc_graph.diagram
     * @instance
     * @param {anchorSelector|anchorNode|d3.selection} [parent]
     * @param {String} [chartGroup]
     * @return {String|node|d3.selection}
     * @return {dc_graph.diagram}
     */
    _diagram.anchor = function(parent, chartGroup) {
        if (!arguments.length) {
            return _anchor;
        }
        if (parent) {
            if (parent.select && parent.classed) { // detect d3 selection
                _anchor = parent.node();
            } else {
                _anchor = parent;
            }
            _diagram.root(d3.select(_anchor));
            _diagram.root().classed(dc_graph.constants.CHART_CLASS, true);
            dc.registerChart(_diagram, chartGroup);
        } else {
            throw new dc.errors.BadArgumentException('parent must be defined');
        }
        _chartGroup = chartGroup;
        return _diagram;
    };

    /**
     * Returns the internal numeric ID of the chart.
     * @method chartID
     * @memberof dc.baseMixin
     * @instance
     * @returns {String}
     */
    _diagram.chartID = function () {
        return _diagram.__dcFlag__;
    };

    /**
     * Returns the DOM id for the chart's anchored location.
     * @method anchorName
     * @memberof dc_graph.diagram
     * @instance
     * @return {String}
     */
    _diagram.anchorName = function () {
        var a = _diagram.anchor();
        if (a && a.id) {
            return a.id;
        }
        if (a && a.replace) {
            return a.replace('#', '');
        }
        return 'dc-graph' + _diagram.chartID();
    };

    return _diagram.anchor(parent, chartGroup);
};

dc_graph.spawn_engine = function(layout, args, worker) {
    args = args || {};
    var engine = dc_graph.engines.instantiate(layout, args, worker);
    if(!engine) {
        console.warn('layout engine ' + layout + ' not found; using default ' + dc_graph._default_engine);
        engine = dc_graph.engines.instantiate(dc_graph._default_engine, args, worker);
    }
    return engine;
};

dc_graph._engines = [
    {
        name: 'dagre',
        params: ['rankdir'],
        instantiate: function() {
            return dc_graph.dagre_layout();
        }
    },
    {
        name: 'd3force',
        instantiate: function() {
            return dc_graph.d3_force_layout();
        }
    },
    {
        name: 'd3v4force',
        instantiate: function() {
            return dc_graph.d3v4_force_layout();
        }
    },
    {
        name: 'tree',
        instantiate: function() {
            return dc_graph.tree_layout();
        }
    },
    {
        names: ['circo', 'dot', 'neato', 'osage', 'twopi', 'fdp'],
        instantiate: function(layout, args) {
            return dc_graph.graphviz_layout(null, layout, args.server);
        }
    },
    {
        name: 'cola',
        params: ['lengthStrategy'],
        instantiate: function() {
            return dc_graph.cola_layout();
        }
    }
];
dc_graph._default_engine = 'cola';

dc_graph.engines = {
    entry_pred: function(layoutName) {
        return function(e) {
            return e.name === layoutName || e.names && e.names.includes(layoutName);
        };
    },
    get: function(layoutName) {
        return dc_graph._engines.find(this.entry_pred(layoutName));
    },
    instantiate: function(layout, args, worker) {
        var entry = this.get(layout);
        if(!entry)
            return null;
        var engine = entry.instantiate(layout, args),
            params = entry.params || [];
        params.forEach(function(p) {
            if(args[p])
                engine[p](args[p]);
        });
        if(engine.supportsWebworker && engine.supportsWebworker() && worker)
            engine = dc_graph.webworker_layout(engine);
        return engine;
    },
    available: function() {
        return dc_graph._engines.reduce(function(avail, entry) {
            return avail.concat(entry.name ? [entry.name] : entry.names);
        }, []);
    },
    unregister: function(layoutName) {
        // meh. this is a bit much. there is such a thing as making the api too "easy".
        var i = dc_graph._engines.findIndex(this.entry_pred(layoutName));
        var remove = false;
        if(i < 0)
            return false;
        var entry = dc_graph._engines[i];
        if(entry.name === layoutName)
            remove = true;
        else {
            var j = entry.names.indexOf(layoutName);
            if(j >= 0)
                entry.names.splice(j, 1);
            else
                console.warn('search for engine failed', layoutName);
            if(entry.names.length === 0)
                remove = true;
        }
        if(remove)
            dc_graph._engines.splice(i, 1);
        return true;
    },
    register: function(entry) {
        var that = this;
        if(!entry.instantiate) {
            console.error('engine definition needs instantiate: function(layout, args) { ... }');
            return this;
        }
        if(entry.name)
            this.unregister(entry.name);
        else if(entry.names)
            entry.names.forEach(function(layoutName) {
                that.unregister(layoutName);
            });
        else {
            console.error('engine definition needs name or names[]');
            return this;
        }
        dc_graph._engines.push(entry);
        return this;
    }
};

var _workers = {};
function create_worker(layoutAlgorithm) {
    if(!_workers[layoutAlgorithm]) {
        var worker = _workers[layoutAlgorithm] = {
            worker: new Worker(script_path() + 'dc.graph.' + layoutAlgorithm + '.worker.js'),
            layouts: {}
        };
        worker.worker.onmessage = function(e) {
            var layoutId = e.data.layoutId;
            if(!worker.layouts[layoutId])
                throw new Error('layoutId "' + layoutId + '" unknown!');
            worker.layouts[layoutId].dispatch()[e.data.response].apply(null, e.data.args);
        };
    }
    return _workers[layoutAlgorithm];
}

dc_graph.webworker_layout = function(layoutEngine) {
    var _tick, _done, _dispatch = d3.dispatch('init', 'start', 'tick', 'end');
    var _worker = create_worker(layoutEngine.layoutAlgorithm());
    var engine = {};
    _worker.layouts[layoutEngine.layoutId()] = engine;

    engine.parent = function(parent) {
        if(layoutEngine.parent)
            layoutEngine.parent(parent);
    };
    engine.init = function(options) {
        options = layoutEngine.optionNames().reduce(
            function(options, option) {
                options[option] = layoutEngine[option]();
                return options;
            }, options);
        _worker.worker.postMessage({
            command: 'init',
            args: {
                layoutId: layoutEngine.layoutId(),
                options: options
            }
        });
        return this;
    };
    engine.data = function(graph, nodes, edges, constraints) {
        _worker.worker.postMessage({
            command: 'data',
            args: {
                layoutId: layoutEngine.layoutId(),
                graph: graph,
                nodes: nodes,
                edges: edges,
                constraints: constraints
            }
        });
    };
    engine.start = function() {
        _worker.worker.postMessage({
            command: 'start',
            args: {
                layoutId: layoutEngine.layoutId()
            }
        });
    };
    engine.stop = function() {
        _worker.worker.postMessage({
            command: 'stop',
            args: {
                layoutId: layoutEngine.layoutId()
            }
        });
        return this;
    };
    // stopgap while layout options are still on diagram
    engine.getEngine = function() {
        return layoutEngine;
    };
    // somewhat sketchy - do we want this object to be transparent or not?
    var passthroughs = ['layoutAlgorithm', 'needsStage',
                        'populateLayoutNode', 'populateLayoutEdge', 'rankdir', 'ranksep'];
    passthroughs.concat(layoutEngine.optionNames()).forEach(function(name) {
        engine[name] = function() {
            var ret = layoutEngine[name].apply(layoutEngine, arguments);
            return arguments.length ? this : ret;
        };
    });
    engine.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    engine.dispatch = function() {
        return _dispatch;
    };
    return engine;
};

/**
 * `dc_graph.graphviz_attrs defines a basic set of attributes which layout engines should
 * implement - although these are not required, they make it easier for clients and
 * behaviors (like expand_collapse) to work with multiple layout engines.
 *
 * these attributes are {@link http://www.graphviz.org/doc/info/attrs.html from graphviz}
 * @class graphviz_attrs
 * @memberof dc_graph
 * @return {Object}
 **/
dc_graph.graphviz_attrs = function() {
    return {
        /**
         * Direction to draw ranks.
         * @method rankdir
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [rankdir='TB'] 'TB', 'LR', 'BT', or 'RL'
         **/
        rankdir: property('TB'),
        /**
         * Spacing in between nodes in the same rank.
         * @method nodesep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [nodesep=40]
         **/
        nodesep: property(40),
        /**
         * Spacing in between ranks.
         * @method ranksep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [ranksep=40]
         **/
        ranksep: property(40)
    };
};

/**
 * `dc_graph.cola_layout` is an adaptor for cola.js layouts in dc.graph.js
 * @class cola_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.cola_layout}
 **/
dc_graph.cola_layout = function(id) {
    var _layoutId = id || uuid();
    var _d3cola = null;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _flowLayout;
    // node and edge objects shared with cola.js, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};

    function init(options) {
        // width, height, handleDisconnected, lengthStrategy, baseLength, flowLayout, tickSize
        _d3cola = cola.d3adaptor()
            .avoidOverlaps(true)
            .size([options.width, options.height])
            .handleDisconnected(options.handleDisconnected);
        if(_d3cola.tickSize) // non-standard
            _d3cola.tickSize(options.tickSize);

        switch(options.lengthStrategy) {
        case 'symmetric':
            _d3cola.symmetricDiffLinkLengths(options.baseLength);
            break;
        case 'jaccard':
            _d3cola.jaccardLinkLengths(options.baseLength);
            break;
        case 'individual':
            _d3cola.linkDistance(function(e) {
                return e.dcg_edgeLength || options.baseLength;
            });
            break;
        case 'none':
        default:
        }
        if(options.flowLayout) {
            _d3cola.flowLayout(options.flowLayout.axis, options.flowLayout.minSeparation);
        }
    }

    function data(nodes, edges, constraints) {
        var wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.fixed = !!v.dcg_nodeFixed;

            if(v1.fixed && typeof v.dcg_nodeFixed === 'object') {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            }
            else {
                // should we support e.g. null to unset x,y?
                if(v.x !== undefined)
                    v1.x = v.x;
                if(v.y !== undefined)
                    v1.y = v.y;
            }
        });
        var wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[e.dcg_edgeSource];
            e1.target = _nodes[e.dcg_edgeTarget];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        // cola needs each node object to have an index property
        wnodes.forEach(function(v, i) {
            v.index = i;
        });

        var groups = null;
        if(engine.groupConnected()) {
            var components = cola.separateGraphs(wnodes, wedges);
            groups = components.map(function(g) {
                return {leaves: g.array.map(function(n) { return n.index; })};
            });
        }

        function dispatchState(event) {
            _dispatch[event](
                wnodes,
                wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                })
            );
        }
        _d3cola.on('tick', /* _tick = */ function() {
            dispatchState('tick');
        }).on('start', function() {
            _dispatch.start();
        }).on('end', /* _done = */ function() {
            dispatchState('end');
        });
        _d3cola.nodes(wnodes)
            .links(wedges)
            .constraints(constraints)
            .groups(groups);
    }

    function start() {
        _d3cola.start(engine.unconstrainedIterations(),
                      engine.userConstraintIterations(),
                      engine.allConstraintsIterations(),
                      engine.gridSnapIterations());
    }

    function stop() {
        if(_d3cola)
            _d3cola.stop();
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    graphviz.rankdir(null);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'cola';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        needsStage: function(stage) { // stopgap until we have engine chaining
            return stage === 'ports' || stage === 'edgepos';
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges, constraints) {
            data(nodes, edges, constraints);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return ['handleDisconnected', 'lengthStrategy', 'baseLength', 'flowLayout', 'tickSize', 'groupConnected']
                .concat(graphviz_keys);
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {},
        /**
         * Instructs cola.js to fit the connected components.
         * @method handleDisconnected
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Boolean} [handleDisconnected=true]
         * @return {Boolean}
         * @return {dc_graph.cola_layout}
         **/
        handleDisconnected: property(true),
        /**
         * Currently, three strategies are supported for specifying the lengths of edges:
         * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
         * `baseLength`
         * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
         * the edge. See
         * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
         * for more details.
         * 'none' - no edge lengths will be specified
         * @method lengthStrategy
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Function|String} [lengthStrategy='symmetric']
         * @return {Function|String}
         * @return {dc_graph.cola_layout}
         **/
        lengthStrategy: property('symmetric'),
        /**
         * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
         * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
         * lengths.
         * @method baseLength
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Number} [baseLength=30]
         * @return {Number}
         * @return {dc_graph.cola_layout}
         **/
        baseLength: property(30),
        /**
         * If `flowLayout` is set, it determines the axis and separation for
         * {@link http://marvl.infotech.monash.edu/webcola/doc/classes/cola.layout.html#flowlayout cola flow layout}.
         * If it is not set, `flowLayout` will be calculated from the {@link dc_graph.graphviz_attrs#rankdir rankdir}
         * and {@link dc_graph.graphviz_attrs#ranksep ranksep}; if `rankdir` is also null (the
         * default for cola layout), then there will be no flow.
         * @method flowLayout
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Object} [flowLayout=null]
         * @example
         * // No flow (default)
         * diagram.flowLayout(null)
         * // flow in x with min separation 200
         * diagram.flowLayout({axis: 'x', minSeparation: 200})
         **/
        flowLayout: function(flow) {
            if(!arguments.length) {
                if(_flowLayout)
                    return _flowLayout;
                var dir = engine.rankdir();
                switch(dir) {
                case 'LR': return {axis: 'x', minSeparation: engine.ranksep() + engine.parent().nodeRadius()*2};
                case 'TB': return {axis: 'y', minSeparation: engine.ranksep() + engine.parent().nodeRadius()*2};
                default: return null; // RL, BT do not appear to be possible (negative separation) (?)
                }
            }
            _flowLayout = flow;
            return this;
        },
        unconstrainedIterations: property(10),
        userConstraintIterations: property(20),
        allConstraintsIterations: property(20),
        gridSnapIterations: property(0),
        tickSize: property(1),
        groupConnected: property(false)
    });
    return engine;
};

dc_graph.cola_layout.scripts = ['d3.js', 'cola.js'];

/**
 * `dc_graph.dagre_layout` is an adaptor for dagre.js layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `dagre_layout` also implements the attributes from
 * {@link dc_graph.graphviz_attrs graphviz_attrs}
 * @class dagre_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.dagre_layout}
 **/
dc_graph.dagre_layout = function(id) {
    var _layoutId = id || uuid();
    var _dagreGraph = null, _tick, _done;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};

    function init(options) {
        // Create a new directed graph
        _dagreGraph = new dagre.graphlib.Graph({multigraph: true});

        // Set an object for the graph label
        _dagreGraph.setGraph({rankdir: options.rankdir, nodesep: options.nodesep, ranksep: options.ranksep});

        // Default to assigning a new object as a label for each new edge.
        _dagreGraph.setDefaultEdgeLabel(function() { return {}; });
    }

    function data(nodes, edges) {
        var wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            /*
              dagre does not seem to accept input positions
              if(v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
              }
             */
        }, function(k, o) {
            _dagreGraph.setNode(k, o);
        }, function(k) {
            _dagreGraph.removeNode(k);
        });
        var wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, function(k, o, e) {
            _dagreGraph.setEdge(e.dcg_edgeSource, e.dcg_edgeTarget, o);
        }, function(k, e) {
            _dagreGraph.removeEdge(e.dcg_edgeSource, e.dcg_edgeTarget, e.dcg_edgeKey);
        });

        function dispatchState(event) {
            _dispatch[event](
                wnodes,
                wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                })
            );
        }
        _tick = function() {
            dispatchState('tick');
        };
        _done = function() {
            dispatchState('end');
        };
    }

    function start(options) {
        _dispatch.start();
        dagre.layout(_dagreGraph);
        _done();
    }

    function stop() {
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'dagre';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        needsStage: function(stage) { // stopgap until we have engine chaining
            return stage === 'ports' || stage === 'edgepos';
        },
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges) {
            data(nodes, edges);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return graphviz_keys;
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
};

dc_graph.dagre_layout.scripts = ['d3.js', 'dagre.js'];

/**
 * `dc_graph.tree_layout` is a very simple and not very bright tree layout. It can draw any DAG, but
 * tries to position the nodes as a tree.
 * @class tree_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.tree_layout}
 **/
dc_graph.tree_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _dfs;

    function init(options) {
        var x;
        var nodeWidth = d3.functor(options.nodeWidth);
        function best_dist(left, right) {
            return (nodeWidth(left) + nodeWidth(right)) / 2;
        }
        _dfs = dc_graph.depth_first_traversal({
            nodeid: function(n) {
                return n.dcg_nodeKey;
            },
            sourceid: function(n) {
                return n.dcg_edgeSource;
            },
            targetid: function(n) {
                return n.dcg_edgeTarget;
            },
            init: function() {
                x = options.offsetX;
            },
            row: function(n) {
                return n.dcg_rank;
            },
            place: function(n, r, row) {
                if(row.length) {
                    var left = row[row.length-1];
                    var g = (nodeWidth(left) + nodeWidth(n)) / 2;
                    x = Math.max(x, left.left_x + g);
                }
                n.left_x = x;
                n.hit_ins = 1;
                n.y = r*options.gapY + options.offsetY;
            },
            sib: function(isroot, left, right) {
                var g = best_dist(left, right);
                if(isroot) g = g*1.5;
                x += g;
            },
            pop: function(n) {
                n.x = (n.left_x + x)/2;
            },
            skip: function(n, indegree) {
                // rolling average of in-neighbor x positions
                n.x = (n.hit_ins*n.x + x)/++n.hit_ins;
                if(n.hit_ins === indegree)
                    delete n.hit_ins;
            },
            finish: function(rows) {
                // this is disgusting. patch up any places where nodes overlap by scanning
                // right far enough to find the space, then fill from left to right at the
                // minimum gap
                rows.forEach(function(row) {
                    var sort = row.sort(function(a, b) { return a.x - b.x; });
                    var badi = null, badl = null, want;
                    for(var i=0; i<sort.length-1; ++i) {
                        var left = sort[i], right = sort[i+1];
                        if(!badi) {
                            if(right.x - left.x < best_dist(left, right)) {
                                badi = i;
                                badl = left.x;
                                want = best_dist(left, right);
                            } // else still not bad
                        } else {
                            want += best_dist(left, right);
                            if(i < sort.length - 2 && right.x < badl + want)
                                continue; // still bad
                            else {
                                if(badi>0)
                                    --badi; // might want to use more left
                                var l, limit;
                                if(i < sort.length - 2) { // found space before right
                                    var extra = right.x - (badl + want);
                                    l = sort[badi].x + extra/2;
                                    limit = i+1;
                                } else {
                                    l = Math.max(sort[badi].x, badl - best_dist(sort[badi], sort[badi+1]) - (want - right.x + badl)/2);
                                    limit = sort.length;
                                }
                                for(var j = badi+1; j<limit; ++j) {
                                    l += best_dist(sort[j-1], sort[j]);
                                    sort[j].x = l;
                                }
                                badi = badl = want = null;
                            }
                        }
                    }
                });
            }
        });
    }

    var _nodes, _edges;
    function data(nodes, edges) {
        _nodes = nodes;
        _edges = edges;
    }

    function start() {
        _dfs(_nodes, _edges);
        _dispatch.end(_nodes, _edges);
    }

    function stop() {
    }

    var layout = {
        layoutAlgorithm: function() {
            return 'tree';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return false;
        },
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges) {
            data(nodes, edges);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return ['nodeWidth', 'offsetX', 'offsetY', 'rowFunction', 'gapY'];
        },
        populateLayoutNode: function(layout, node) {
            if(this.rowFunction())
                layout.dcg_rank = this.rowFunction.eval(node);
        },
        populateLayoutEdge: function() {},
        nodeWidth: property(function(n) { return n.width; }),
        offsetX: property(30),
        offsetY: property(30),
        rowFunction: property(null),
        gapY: property(100)
    };
    return layout;
};

dc_graph.tree_layout.scripts = [];

/**
 * `dc_graph.graphviz_layout` is an adaptor for viz.js (graphviz) layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `graphviz_layout` also implements the attributes from
 * {@link dc_graph.graphviz_attrs graphviz_attrs}
 * @class graphviz_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.graphviz_layout}
 **/
dc_graph.graphviz_layout = function(id, layout, server) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _dotInput, _dotString;
    var _clusters; // hack to get cluster data out

    function init(options) {
    }

    function encode_name(name) {
        return name.replace(/^%/, '&#37;');
    }
    function decode_name(name) {
        return name.replace(/^&#37;/, '%');
    }
    function stringize_property(prop, value) {
        return [prop, '"' + value + '"'].join('=');
    }
    function stringize_properties(props) {
        return '[' + props.join(', ') + ']';
    }
    function data(nodes, edges) {
        if(_dotInput) {
            _dotString = _dotInput;
            return;
        }
        var lines = [];
        var directed = layout !== 'neato';
        lines.push((directed ? 'digraph' : 'graph') + ' g {');
        lines.push('graph ' + stringize_properties([
            stringize_property('nodesep', graphviz.nodesep()/72),
            stringize_property('ranksep', graphviz.ranksep()/72),
            stringize_property('rankdir', graphviz.rankdir())
        ]));
        lines = lines.concat(nodes.map(function(v) {
            var props = [
                stringize_property('width', v.width/72),
                stringize_property('height', v.height/72),
                stringize_property('fixedsize', 'true')
            ];
            if(v.dcg_nodeFixed)
                props.push(stringize_property('pos', [
                    v.dcg_nodeFixed.x,
                    1000-v.dcg_nodeFixed.y
                ].join(',')));
            return '  "' + encode_name(v.dcg_nodeKey) + '" ' + stringize_properties(props);
        }));
        lines = lines.concat(edges.map(function(e) {
            return '  "' + encode_name(e.dcg_edgeSource) + (directed ? '" -> "' : '" -- "') +
                encode_name(e.dcg_edgeTarget) + '" ' + stringize_properties([
                    stringize_property('id', encode_name(e.dcg_edgeKey)),
                stringize_property('arrowhead', 'none'),
                stringize_property('arrowtail', 'none')
                ]);
        }));
        lines.push('}');
        lines.push('');
        _dotString = lines.join('\n');
    }

    function process_response(error, result) {
        _dispatch.start();
        var bb = result.bb.split(',').map(function(x) { return +x; });
        var nodes = (result.objects || []).filter(function(n) {
            return n.pos; // remove non-nodes like clusters
        }).map(function(n) {
            var pos = n.pos.split(',');
            return {
                dcg_nodeKey: decode_name(n.name),
                x: +pos[0],
                y: bb[3] - pos[1]
            };
        });
        _clusters = (result.objects || []).filter(function(n) {
            return /^cluster/.test(n.name);
        });
        _clusters.forEach(function(c) {
            // annotate with flipped cluster coords for convenience
            c.bbflip = c.bb.split(',').map(function(s) { return +s; });
            var t = bb[3] - c.bbflip[1];
            c.bbflip[1] = bb[3] - c.bbflip[3];
            c.bbflip[3] = t;
        });
        var edges = (result.edges || []).map(function(e) {
            var e2 = {
                dcg_edgeKey: decode_name(e.id || 'n' + e._gvid)
            };
            if(e._draw_) {
                var directive = e._draw_.find(function(d) { return d.op && d.points; });
                e2.points = directive.points.map(function(p) { return {x: p[0], y: bb[3] - p[1]}; });
            }
            return e2;
        });
        _dispatch.end(nodes, edges);
    }

    function start() {
        if(server) {
            d3.json(server)
                .header("Content-type", "application/x-www-form-urlencoded")
                .post('layouttool=' + layout + '&' + encodeURIComponent(_dotString), process_response);
        }
        else {
            var result = Viz(_dotString, {format: 'json', engine: layout, totalMemory: 1 << 25});
            result = JSON.parse(result);
            process_response(null, result);
        }
    }

    function stop() {
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return layout;
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return false;
        },
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges) {
            data(nodes, edges);
        },
        dotInput: function(text) {
            _dotInput = text;
            return this;
        },
        clusters: function() {
            // filter out clusters and return them separately, because dc.graph doesn't know how to draw them
            return _clusters;
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return graphviz_keys;
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
}


/**
 * `dc_graph.d3_force_layout` is an adaptor for d3-force layouts in dc.graph.js
 * @class d3_force_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.d3_force_layout}
 **/
dc_graph.d3_force_layout = function(id) {
    var _layoutId = id || uuid();
    var _simulation = null; // d3-force simulation
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};
    var _wnodes = [], _wedges = [];
    var _options = null;
    var _paths = null;

    function init(options) {
        _options = options;

        _simulation = d3.layout.force()
            .size([options.width, options.height]);

        _simulation.on('tick', /* _tick = */ function() {
            dispatchState('tick');
        }).on('start', function() {
            _dispatch.start();
        }).on('end', /* _done = */ function() {
            dispatchState('end');
        });
    }

    function dispatchState(event) {
        _dispatch[event](
            _wnodes,
            _wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }

    function data(nodes, edges, constraints) {
        var nodeIDs = {};
        nodes.forEach(function(d, i) {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.id = v.dcg_nodeKey;
            if(v.dcg_nodeFixed) {
                v1.fixed = true;
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            } else v1.fixed = false;
        });

        _wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[e.dcg_edgeSource];
            e1.source.id = nodeIDs[e1.source.dcg_nodeKey];
            e1.target = _nodes[e.dcg_edgeTarget];
            e1.target.id = nodeIDs[e1.target.dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.nodes(_wnodes);
        _simulation.links(_wedges);
    }

    function start() {
        installForces();
        runSimulation(_options.iterations);
    }

    function stop() {
        if(_simulation)
            _simulation.stop();
    }

    function savePositions() {
        var data = {};
        Object.keys(_nodes).forEach(function(key) {
            data[key] = {x: _nodes[key].x, y: _nodes[key].y};
        });
        return data;
    }

    function restorePositions(data) {
        Object.keys(data).forEach(function(key) {
            if(_nodes[key]) {
                _nodes[key].fixed = false;
                _nodes[key].x = data[key].x;
                _nodes[key].y = data[key].y;
            }
        });
    }

    function installForces() {
        if(_paths === null)
            _simulation.gravity(_options.gravityStrength)
                .charge(_options.initialCharge);
        else {
            if(_options.fixOffPathNodes) {
                var nodesOnPath = d3.set(); // nodes on path
                _paths.forEach(function(path) {
                    path.forEach(function(nid) {
                        nodesOnPath.add(nid);
                    });
                });

                // fix nodes not on paths
                Object.keys(_nodes).forEach(function(key) {
                    if(!nodesOnPath.has(key)) {
                        _nodes[key].fixed = true;
                    } else {
                        _nodes[key].fixed = false;
                    }
                });
            }

            // enlarge charge force to separate nodes on paths
            _simulation.charge(_options.chargeForce);
        }
    };

    function runSimulation(iterations) {
        if(!iterations) {
            dispatchState('end');
            return;
        }
        _simulation.start();
        for (var i = 0; i < 300; ++i) {
            _simulation.tick();
            if(_paths)
                applyPathAngleForces();
        }
        _simulation.stop();
    }

    function applyPathAngleForces() {
        function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; };
        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); };
        function _angle(v1, v2) {
            var a = _dot(v1, v2) / (_len(v1)*_len(v2));
            a = Math.min(a, 1);
            a = Math.max(a, -1);
            return Math.acos(a);
        };
        // perpendicular unit length vector
        function _pVec(v) {
            var xx = -v.y/v.x, yy = 1;
            var length = _len({x: xx, y: yy});
            return {x: xx/length, y: yy/length};
        };

        function updateNode(node, angle, pVec, alpha) {
            node.x += pVec.x*(Math.PI-angle)*alpha;
            node.y += pVec.y*(Math.PI-angle)*alpha;
        }

        _paths.forEach(function(path) {
            if(path.length < 3) return; // at least 3 nodes (and 2 edges):  A->B->C
            for(var i = 1; i < path.length-1; ++i) {
                var current = _nodes[path[i]];
                var prev = _nodes[path[i-1]];
                var next = _nodes[path[i+1]];

                // calculate the angle
                var vPrev = {x: prev.x - current.x, y: prev.y - current.y};
                var vNext = {x: next.x - current.x, y: next.y - current.y};

                var angle = _angle(vPrev, vNext); // angle in [0, PI]

                var pvecPrev = _pVec(vPrev);
                var pvecNext = _pVec(vNext);

                // make sure the perpendicular vector is in the
                // direction that makes the angle more towards 180 degree
                // 1. calculate the middle point of node 'prev' and 'next'
                var mid = {x: (prev.x+next.x)/2.0, y: (prev.y+next.y)/2.0};
                // 2. calculate the vectors: 'prev' pointing to 'mid', 'next' pointing to 'mid'
                var prev_mid = {x: mid.x-prev.x, y: mid.y-prev.y};
                var next_mid = {x: mid.x-next.x, y: mid.y-next.y};
                // 3. the 'correct' vector: the angle between pvec and prev_mid(next_mid) should
                //    be an obtuse angle
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.x};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.x};

                // modify positions of prev and next
                updateNode(prev, angle, pvecPrev, _options.angleForce);
                updateNode(next, angle, pvecNext, _options.angleForce);
            }

        });
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'd3-force';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges, constraints) {
            data(nodes, edges, constraints);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        paths: function(paths) {
            _paths = paths;
        },
        savePositions: savePositions,
        restorePositions: restorePositions,
        optionNames: function() {
            return ['iterations', 'angleForce', 'chargeForce', 'gravityStrength',
                    'initialCharge', 'fixOffPathNodes']
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.02),
        chargeForce: property(-500),
        gravityStrength: property(1.0),
        initialCharge: property(-400),
        fixOffPathNodes: property(false),
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    return engine;
};

dc_graph.d3_force_layout.scripts = ['d3.js'];

/**
 * `dc_graph.d3v4_force_layout` is an adaptor for d3-force version 4 layouts in dc.graph.js
 * @class d3v4_force_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.d3v4_force_layout}
 **/
dc_graph.d3v4_force_layout = function(id) {
    var _layoutId = id || uuid();
    var _simulation = null; // d3-force simulation
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};
    var _wnodes = [], _wedges = [];
    var _options = null;
    var _paths = null;

    function init(options) {
        _options = options;

        _simulation = d3v4.forceSimulation()
            .force('link', d3v4.forceLink())
            .force('center', d3v4.forceCenter(options.width / 2, options.height / 2))
            .force('gravityX', d3v4.forceX(options.width / 2).strength(_options.gravityStrength))
            .force('gravityY', d3v4.forceY(options.height / 2).strength(_options.gravityStrength))
            .force('collision', d3v4.forceCollide(_options.collisionRadius))
            .force('charge', d3v4.forceManyBody())
            .stop();
    }

    function dispatchState(event) {
        _dispatch[event](
            _wnodes,
            _wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }

    function data(nodes, edges, constraints) {
        var nodeIDs = {};
        nodes.forEach(function(d, i) {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerate_objects(_nodes, nodes, null, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.id = v.dcg_nodeKey;
            if(v.dcg_nodeFixed) {
                v1.fx = v.dcg_nodeFixed.x;
                v1.fy = v.dcg_nodeFixed.y;
            } else v1.fx = v1.fy = null;
        });

        _wedges = regenerate_objects(_edges, edges, null, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.source = nodeIDs[_nodes[e.dcg_edgeSource].dcg_nodeKey];
            e1.target = nodeIDs[_nodes[e.dcg_edgeTarget].dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.nodes(_wnodes);
        _simulation.force('link').links(_wedges);
    }

    function start() {
        _dispatch.start();
        installForces(_paths);
        runSimulation(_options.iterations);
    }

    function stop() {
        // not running asynchronously, no _simulation.stop();
    }

    function savePositions() {
        var data = {};
        Object.keys(_nodes).forEach(function(key) {
            data[key] = {x: _nodes[key].x, y: _nodes[key].y};
        });
        return data;
    }
    function restorePositions(data) {
        Object.keys(data).forEach(function(key) {
            if(_nodes[key]) {
                _nodes[key].fx = data[key].x;
                _nodes[key].fy = data[key].y;
            }
        });
    }
    function installForces(paths) {
        if(paths === null) {
            _simulation.force('charge').strength(_options.initialCharge);
            _simulation.force('angle', null);
        } else {
            var nodesOnPath;
            if(_options.fixOffPathNodes) {
                nodesOnPath = d3.set();
                paths.forEach(function(path) {
                    path.forEach(function(nid) {
                        nodesOnPath.add(nid);
                    });
                });
            }

            // fix nodes not on paths
            Object.keys(_nodes).forEach(function(key) {
                if(_options.fixOffPathNodes && !nodesOnPath.has(key)) {
                    _nodes[key].fx = _nodes[key].x;
                    _nodes[key].fy = _nodes[key].y;
                } else {
                    _nodes[key].fx = null;
                    _nodes[key].fy = null;
                }
            });

            _simulation.force('charge').strength(_options.chargeForce);
            _simulation.force('angle', function(alpha) {
                angleForces(alpha, paths, _options.angleForce);
            });
        }
    };

    function runSimulation(iterations) {
        _simulation.alpha(1);
        for (var i = 0; i < iterations; ++i) {
            _simulation.tick();
            dispatchState('tick');
        }
        dispatchState('end');
    }

    function angleForces(alpha, paths, k) {
        function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; };
        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); };
        function _angle(v1, v2) {
            var a = _dot(v1, v2) / (_len(v1)*_len(v2));
            a = Math.min(a, 1);
            a = Math.max(a, -1);
            return Math.acos(a);
        };
        // perpendicular unit length vector
        function _pVec(v) {
            var xx = -v.y/v.x, yy = 1;
            var length = _len({x: xx, y: yy});
            return {x: xx/length, y: yy/length};
        };

        function updateNode(node, angle, pVec, k) {
            node.x += pVec.x*(Math.PI-angle)*k;
            node.y += pVec.y*(Math.PI-angle)*k;
        }

        paths.forEach(function(path) {
            if(path.length < 3) return; // at least 3 nodes (and 2 edges):  A->B->C
            for(var i = 1; i < path.length-1; ++i) {
                var current = _nodes[path[i]];
                var prev = _nodes[path[i-1]];
                var next = _nodes[path[i+1]];

                // calculate the angle
                var vPrev = {x: prev.x - current.x, y: prev.y - current.y};
                var vNext = {x: next.x - current.x, y: next.y - current.y};

                var angle = _angle(vPrev, vNext); // angle in [0, PI]

                var pvecPrev = _pVec(vPrev);
                var pvecNext = _pVec(vNext);

                // make sure the perpendicular vector is in the
                // direction that makes the angle more towards 180 degree
                // 1. calculate the middle point of node 'prev' and 'next'
                var mid = {x: (prev.x+next.x)/2.0, y: (prev.y+next.y)/2.0};
                // 2. calculate the vectors: 'prev' pointing to 'mid', 'next' pointing to 'mid'
                var prev_mid = {x: mid.x-prev.x, y: mid.y-prev.y};
                var next_mid = {x: mid.x-next.x, y: mid.y-next.y};
                // 3. the 'correct' vector: the angle between pvec and prev_mid(next_mid) should
                //    be an obtuse angle
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.x};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.x};

                // modify positions of prev and next
                updateNode(prev, angle, pvecPrev, k);
                updateNode(next, angle, pvecNext, k);
            }

        });
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'd3v4-force';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges, constraints) {
            data(nodes, edges, constraints);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        paths: function(paths) {
            _paths = paths;
        },
        savePositions: savePositions,
        restorePositions: restorePositions,
        optionNames: function() {
            return ['iterations', 'angleForce', 'chargeForce', 'gravityStrength', 'collisionRadius',
                    'initialCharge', 'fixOffPathNodes']
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.01),
        chargeForce: property(-600),
        gravityStrength: property(0.3),
        collisionRadius: property(8),
        initialCharge: property(-100),
        fixOffPathNodes: property(false),
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    return engine;
};

dc_graph.d3v4_force_layout.scripts = ['d3.js', 'd3v4-force.js'];

dc_graph.flexbox_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');

    var _graph, _tree, _nodes = {}, _wnodes;

    function init(options) {
    }
    // like d3.nest but address can be of arbitrary (and different) length
    // probably less efficient too
    function add_node(adhead, adtail, n, tree) {
        tree.address = adhead.slice();
        tree.children = tree.children || {};
        if(!adtail.length) {
            tree.node = n;
            return;
        }
        var t = tree.children[adtail[0]] = tree.children[adtail[0]] || {};
        adhead.push(adtail.shift());
        add_node(adhead, adtail, n, t);
    }
    function all_keys(tree) {
        var key = _engine.addressToKey()(tree.address);
        return Array.prototype.concat.apply([key], Object.keys(tree.children).map(function(k) {
            return all_keys(tree.children[k]);
        }));
    }
    function data(graph, nodes) {
        _graph = graph;
        _tree = {};
        nodes.forEach(function(n) {
            var ad = _engine.keyToAddress()(n.dcg_nodeKey);
            add_node([], ad, n, _tree);
        });
        var need = all_keys(_tree);
        _wnodes = nodes;
    }
    var internal_attrs = ['sort', 'dcg_nodeKey', 'x', 'y'],
        skip_on_parents = ['width', 'height'];
    function create_flextree(attrs, tree) {
        var flexnode = {name: _engine.addressToKey()(tree.address), style: {}};
        var attrs2 = Object.assign({}, attrs);
        var isParent = Object.keys(tree.children).length;
        if(tree.node)
            Object.assign(attrs, tree.node);
        for(var attr in attrs) {
            if(internal_attrs.includes(attr))
                continue;
            if(isParent && skip_on_parents.includes(attr))
                continue;
            var value = attrs[attr];
            if(typeof value === 'function')
                value = value(tree.node);
            flexnode.style[attr] = value;
        }
        if(isParent) {
            flexnode.children = Object.values(tree.children)
                .sort(attrs.sort)
                .map(function(c) { return c.address[c.address.length-1]; })
                .map(function(key) {
                    return create_flextree(Object.assign({}, attrs2), tree.children[key]);
                });
        }
        tree.flexnode = flexnode;
        return flexnode;
    }
    function apply_layout(offset, tree) {
        if(_engine.logStuff())
            console.log(tree.node.dcg_nodeKey + ': '+ JSON.stringify(tree.flexnode.layout));
        tree.node.x = offset.x + tree.flexnode.layout.left + tree.flexnode.layout.width/2;
        tree.node.y = offset.y + tree.flexnode.layout.top + tree.flexnode.layout.height/2;
        Object.keys(tree.children)
            .map(function(key) { return tree.children[key]; })
            .forEach(function(child) {
                apply_layout({x: offset.x + tree.flexnode.layout.left, y: offset.y + tree.flexnode.layout.top}, child);
            });
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch[event](
            wnodes,
            wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }
    function start() {
        var defaults = {
            sort: function(a, b) {
                return d3.ascending(a.node.dcg_nodeKey, b.node.dcg_nodeKey);
            }
        };
        var flexTree = create_flextree(defaults, _tree);
        flexTree.style.width = _graph.width;
        flexTree.style.height = _graph.height;
        if(_engine.logStuff())
            console.log(JSON.stringify(flexTree, null, 2));
        computeLayout(flexTree);
        apply_layout({x: 0, y: 0}, _tree);
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    // currently dc.graph populates the "cola" (really "layout") member with the attributes
    // needed for layout and does not pass in the original data. flexbox has a huge number of attributes
    // and it might be more appropriate for it to look at the original data.
    // (Especially because it also computes some attributes based on data.)
    var supportedAttributes = [
        'width', 'height', // positive number
        'minWidth', 'minHeight', // positive number
        'maxWidth', 'maxHeight', // positive number
        'left', 'right', 'top', 'bottom', // number
        'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom', // number
        'padding', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', // positive number
        'borderWidth', 'borderLeftWidth', 'borderRightWidth', 'borderTopWidth', 'borderBottomWidth', // positive number
        'flexDirection', // 'column', 'row'
        'justifyContent', // 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'
        'alignItems', 'alignSelf', // 'flex-start', 'center', 'flex-end', 'stretch'
        'flex', // positive number
        'flexWrap', // 'wrap', 'nowrap'
        'position' // 'relative', 'absolute'
    ];

    var _engine = {
        layoutAlgorithm: function() {
            return 'cola';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        needsStage: function(stage) { // stopgap until we have engine chaining
            return stage === 'ports' || stage === 'edgepos';
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes) {
            data(graph, nodes);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return [];
        },
        populateLayoutNode: function(n1, n) {
            ['sort', 'order'].concat(supportedAttributes).forEach(function(attr) {
                if(n.orig.value[attr])
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge: function() {},
        addressToKey: property(function(ad) { return ad.join(','); }),
        keyToAddress: property(function(nid) { return nid.split(','); }),
        logStuff: property(false)
    };
    return _engine;
};

dc_graph.flexbox_layout.scripts = ['css-layout.js'];

dc_graph.manual_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');

    var _wnodes;

    function init(options) {
    }
    function data(nodes) {
        _wnodes = nodes;
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch[event](
            wnodes,
            wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }
    function start() {
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    var _engine = {
        layoutAlgorithm: function() {
            return 'cola';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        needsStage: function(stage) { // stopgap until we have engine chaining
            return stage === 'ports' || stage === 'edgepos';
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges) {
            data(nodes);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return [];
        },
        populateLayoutNode: function(n1, n) {
            ['x', 'y'].forEach(function(attr) {
                if(n.orig.value[attr] !== undefined)
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge: function() {},
        addressToKey: property(function(ad) { return ad.join(','); }),
        keyToAddress: property(function(nid) { return nid.split(','); })
    };
    return _engine;
};

dc_graph.manual_layout.scripts = ['css-layout.js'];

function port_name(nodeId, edgeId, portName) {
    if(!(nodeId || edgeId))
        return null; // must have one key or the other
    if(nodeId) nodeId = nodeId.replace(/\//g, '%2F');
    if(edgeId) edgeId = edgeId.replace(/\//g, '%2F');
    return (nodeId ? 'node/' + nodeId : 'edge/' + edgeId) + '/' + portName;
};
function split_port_name(portname) {
    var parts = portname.split('/');
    console.assert(parts.length === 3);
    parts = parts.map(function(p) {
        return p.replace(/%2F/g, '/');
    });
    if(parts[0] === 'node')
        return {
            nodeKey: parts[1],
            name: parts[2]
        };
    else return {
        edgeKey: parts[1],
        name: parts[2]
    };
}
function project_port(diagram, n, p) {
    if(!p.vec) {
        console.assert(!p.edges.length);
        throw new Error("port has not been placed, maybe install place_ports? " + p.name);
    }
    p.pos = diagram.shape(n.dcg_shape.shape).intersect_vec(n, p.vec[0]*1000, p.vec[1]*1000);
}

dc_graph.place_ports = function() {
    function received_layout(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        var node_ports = diagram.nodePorts();

        function is_ccw(u, v) {
            return u[0]*v[1] - u[1]*v[0] > 0;
        }
        function in_bounds(v, bounds) {
            // assume bounds are ccw
            return is_ccw(bounds[0], v) && is_ccw(v, bounds[1]);
        }
        function clip(v, bounds) {
            if(is_ccw(v, bounds[0]))
                return bounds[0];
            else if(is_ccw(bounds[1], v))
                return bounds[1];
            else return v;
        }
        function a_to_v(a) {
            return [Math.cos(a), Math.sin(a)];
        }
        function v_to_a(v) {
            return Math.atan2(v[1], v[0]);
        }
        function distance(p, p2) {
            return Math.hypot(p2.pos.x - p.pos.x, p2.pos.y - p.pos.y);
        }
        function misses(p, p2) {
            var dist = distance(p, p2);
            var misses = dist > _behavior.minDistance();
            return misses;
        }
        function rand_within(a, b) {
            return a + Math.random()*(b-a);
        }
        // calculate port positions
        for(var nid in node_ports) {
            var n = nodes[nid],
                nports = node_ports[nid];

            // make sure that we have vector and angle bounds for any ports with specification
            nports.forEach(function(p) {
                var bounds = p.orig && diagram.portBounds.eval(p) || [0, 2*Math.PI];
                if(Array.isArray(bounds[0])) {
                    p.vbounds = bounds;
                    p.abounds = bounds.map(v_to_a);
                }
                else {
                    p.vbounds = bounds.map(a_to_v);
                    p.abounds = bounds;
                }
                if(p.abounds[0] > p.abounds[1])
                    p.abounds[1] += 2*Math.PI;
                console.assert(p.orig || p.vec, 'unplaced unspecified port');
            });

            // determine which ports satisfy bounds or are unplaced
            var inside = [], outside = [], unplaced = [];
            nports.forEach(function(p) {
                if(!p.vec)
                    unplaced.push(p);
                else if(p.vbounds && !in_bounds(p.vec, p.vbounds))
                    outside.push(p);
                else
                    inside.push(p);
            });

            // shunt outside ports into their bounds
            outside.forEach(function(p) {
                p.vec = clip(p.vec, p.vbounds);
                inside.push(p);
            });

            // for all unplaced ports that share a bounds, evenly distribute them within those bounds.
            // assume that bounds are disjoint.
            var boundses = {}, boundports = {};
            unplaced.forEach(function(p) {
                var boundskey = p.abounds.map(function(x) { return x.toFixed(3); }).join(',');
                boundses[boundskey] = p.abounds;
                boundports[boundskey] = boundports[boundskey] || [];
                boundports[boundskey].push(p);
            });
            for(var b in boundports) {
                var bounds = boundses[b], bports = boundports[b];
                if(bports.length === 1)
                    bports[0].vec = a_to_v((bounds[0] + bounds[1])/2);
                else {
                    var slice = (bounds[1] - bounds[0]) / (boundports[b].length - 1);
                    boundports[b].forEach(function(p, i) {
                        p.vec = a_to_v(bounds[0] + i*slice);
                    });
                }
            }
            inside = inside.concat(unplaced);
            unplaced = [];

            // determine positions of all satisfied
            inside.forEach(function(p) {
                project_port(diagram, n, p);
            });

            // detect any existing collisions, unplace the one without edges or second one
            for(var i = 0; i < inside.length; ++i) {
                var x = inside[i];
                if(unplaced.includes(x))
                    continue;
                for(var j = i+1; j < inside.length; ++j) {
                    var y = inside[j];
                    if(unplaced.includes(y))
                        continue;
                    if(!misses(x, y)) {
                        if(!x.edges.length) {
                            unplaced.push(x);
                            continue;
                        }
                        else
                            unplaced.push(y);
                    }
                }
            }
            inside = inside.filter(function(p) { return !unplaced.includes(p); });

            // place any remaining by trying random spots within the range until it misses all or we give up
            var patience = _behavior.patience(), maxdist = 0, maxvec;
            while(unplaced.length) {
                var p = unplaced[0];
                p.vec = a_to_v(rand_within(p.abounds[0], p.abounds[1]));
                project_port(diagram, n, p);
                var mindist = d3.min(inside, function(p2) { return distance(p, p2); });
                if(mindist > maxdist) {
                    maxdist = mindist;
                    maxvec = p.vec;
                }
                if(!patience-- || mindist > _behavior.minDistance()) {
                    if(patience<0) {
                        console.warn('ran out of patience placing a port');
                        p.vec = maxvec;
                        project_port(diagram, n, p);
                    }
                    inside.push(p);
                    unplaced.shift();
                    patience = _behavior.patience();
                    maxdist = 0;
                }
            }
        }
    };
    var _behavior = {
        parent: property(null).react(function(p) {
            if(p) {
                p.on('receivedLayout.place-ports', received_layout);
            } else if(_behavior.parent())
                _behavior.parent().on('receivedLayout.place-ports', null);
        }),
        // minimum distance between ports
        minDistance: property(20),
        // number of random places to try when resolving collision
        patience: property(20)
    };

    return _behavior;
};

dc_graph.troubleshoot = function() {
    var _debugLayer = null;

    function add_behavior(diagram, node, edge, ehover) {
        if(!_debugLayer)
            _debugLayer = diagram.g().append('g').attr({
                class: 'draw-graphs',
                'pointer-events': 'none'
            });
        var centers = node.data().map(function(n) {
            return {
                x: n.cola.x,
                y: n.cola.y
            };
        });
        var crosshairs = _debugLayer.selectAll('path.nodecenter').data(centers);
        crosshairs.exit().remove();
        crosshairs.enter().append('path').attr('class', 'nodecenter');
        crosshairs.attr({
            d: function(c) {
                return 'M' + (c.x - _behavior.xhairWidth()/2) + ',' + c.y + ' h' + _behavior.xhairWidth() +
                    ' M' + c.x + ',' + (c.y - _behavior.xhairHeight()/2) + ' v' + _behavior.xhairHeight();
            },
            opacity: _behavior.xhairOpacity() !== null ? _behavior.xhairOpacity() : _behavior.opacity(),
            stroke: _behavior.xhairColor()
        });
        function cola_point(n) {
            return {x: n.cola.x, y: n.cola.y};
        }
        var colabounds = node.data().map(function(n) {
            return boundary(cola_point(n), n.cola.width, n.cola.height);
        });
        var colaboundary = _debugLayer.selectAll('path.colaboundary').data(colabounds);
        draw_corners(colaboundary, 'colaboundary');

        var textbounds = node.data().map(function(n) {
            if(!n.bbox)
                return null;
            return boundary(cola_point(n), n.bbox.width, n.bbox.height);
        }).filter(function(n) { return !!n; });
        var textboundary = _debugLayer.selectAll('path.textboundary').data(textbounds);
        draw_corners(textboundary, 'textboundary');

        var radiibounds = node.data().map(function(n) {
            if(!typeof n.dcg_rx === 'number')
                return null;
            return boundary(cola_point(n), n.dcg_rx*2, n.dcg_ry*2);
        }).filter(function(n) { return !!n; });
        var radiiboundary = _debugLayer.selectAll('path.radiiboundary').data(radiibounds);
        draw_corners(radiiboundary, 'radiiboundary');
    }
    function boundary(point, wid, hei) {
        return {
            left: point.x - wid/2,
            top: point.y - hei/2,
            right: point.x + wid/2,
            bottom: point.y + hei/2
        };
    };
    function bound_tick(x, y, dx, dy) {
        return 'M' + x + ',' + (y + dy) + ' v' + -dy + ' h' + dx;
    }
    function corners(bounds) {
        return [
            bound_tick(bounds.left, bounds.top, _behavior.boundsWidth(), _behavior.boundsHeight()),
            bound_tick(bounds.right, bounds.top, -_behavior.boundsWidth(), _behavior.boundsHeight()),
            bound_tick(bounds.right, bounds.bottom, -_behavior.boundsWidth(), -_behavior.boundsHeight()),
            bound_tick(bounds.left, bounds.bottom, _behavior.boundsWidth(), -_behavior.boundsHeight()),
        ].join(' ');
    }
    function draw_corners(binding, classname) {
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr({
            d: corners,
            opacity: _behavior.boundsOpacity() !== null ? _behavior.boundsOpacity() : _behavior.opacity(),
            stroke: _behavior.boundsColor(),
            fill: 'none'
        });
    }

    function remove_behavior(diagram, node, edge, ehover) {
        if(_debugLayer)
            _debugLayer.remove();
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        laterDraw: true,
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });
    _behavior.opacity = property(0.75);

    _behavior.xhairOpacity = property(null);
    _behavior.xhairWidth = property(10);
    _behavior.xhairHeight = property(10);
    _behavior.xhairColor = property('blue');

    _behavior.boundsOpacity = property(null);
    _behavior.boundsWidth = property(10);
    _behavior.boundsHeight = property(10);
    _behavior.boundsColor = property('green');

    return _behavior;
};


 dc_graph.validate = function(title) {
    function falsy(objects, accessor, what, who) {
        var f = objects.filter(function(o) {
            return !accessor(o);
        });
        return f.length ?
            [what + ' is empty for ' + f.length + ' of ' + objects.length + ' ' + who, f] :
            null;
    }
    function build_index(objects, accessor) {
        return objects.reduce(function(m, o) {
            m[accessor(o)] = o;
            return m;
        }, {});
    }
    function not_found(index, objects, accessor, what, where, who) {
        var nf = objects.filter(function(o) {
            return !index[accessor(o)];
        }).map(function(o) {
            return {key: accessor(o), value: o};
        });
        return nf.length ?
            [what + ' was not found in ' + where, Object.keys(index), 'for ' + nf.length + ' of ' + objects.length + ' ' + who, nf] :
            null;
    }
    function validate() {
        var diagram = _behavior.parent();
        var nodes = diagram.nodeGroup().all(),
            edges = diagram.edgeGroup().all(),
            ports = diagram.portGroup() ? diagram.portGroup().all() : [];
        var errors = [];

        function check(error) {
            if(error)
                errors.push(error);
        }

        check(falsy(nodes, diagram.nodeKey(), 'nodeKey', 'nodes'));
        check(falsy(edges, diagram.edgeSource(), 'edgeSource', 'edges'));
        check(falsy(edges, diagram.edgeTarget(), 'edgeTarget', 'edges'));

        var contentTypes = d3.set(diagram.content.enum());
        var ct = dc_graph.functor_wrap(diagram.nodeContent());
        var noContentNodes = nodes.filter(function(kv) {
            return !contentTypes.has(ct(kv));
        });
        if(noContentNodes.length)
            errors.push(['there are ' + noContentNodes.length + ' nodes with nodeContent not matching any content', noContentNodes]);

        var nindex = build_index(nodes, diagram.nodeKey()),
            eindex = build_index(edges, diagram.edgeKey());
        check(not_found(nindex, edges, diagram.edgeSource(), 'edgeSource', 'nodes', 'edges'));
        check(not_found(nindex, edges, diagram.edgeTarget(), 'edgeTarget', 'nodes', 'edges'));

        check(falsy(ports, function(p) {
            return diagram.portNodeKey() && diagram.portNodeKey()(p) ||
                diagram.portEdgeKey() && diagram.portEdgeKey()(p);
        }, 'portNodeKey||portEdgeKey', 'ports'));

        var named_ports = !diagram.portNodeKey() && [] || ports.filter(function(p) {
            return diagram.portNodeKey()(p);
        });
        var anonymous_ports = !diagram.portEdgeKey() && [] || ports.filter(function(p) {
            return diagram.portEdgeKey()(p);
        });
        check(not_found(nindex, named_ports, diagram.portNodeKey(), 'portNodeKey', 'nodes', 'ports'));
        check(not_found(eindex, anonymous_ports, diagram.portEdgeKey(), 'portEdgeKey', 'edges', 'ports'));

        if(diagram.portName()) {
            var pindex = build_index(named_ports, function(p) {
                return diagram.portNodeKey()(p) + ' - ' + diagram.portName()(p);
            });
            if(diagram.edgeSourcePortName())
                check(not_found(pindex, edges, function(e) {
                    return diagram.edgeSource()(e) + ' - ' + d3.functor(diagram.edgeSourcePortName())(e);
                }, 'edgeSourcePortName', 'ports', 'edges'));
            if(diagram.edgeTargetPortName())
                check(not_found(pindex, edges,  function(e) {
                    return diagram.edgeTarget()(e) + ' - ' + d3.functor(diagram.edgeTargetPortName())(e);
                }, 'edgeTargetPortName', 'ports', 'edges'));
        }

        function count_text() {
            return nodes.length + ' nodes, ' + edges.length + ' edges, ' + ports.length + ' ports';
        }
        if(errors.length) {
            console.warn('validation of ' + title + ' failed with ' + count_text() + ':');
            errors.forEach(function(err) {
                console.warn.apply(null, err);
            });
        }
        else
            console.log('validation of ' + title + ' succeeded with ' + count_text() + '.');
    }
    var _behavior = {
        parent: property(null).react(function(p) {
            if(p)
                p.on('data.validate', validate);
            else
                _behavior.parent().on('data.validate', null);
        })
    };

    return _behavior;
};

/**
## Legend

The dc_graph.legend will show labeled examples of nodes (and someday edges), within the frame of a dc_graph.diagram.
**/
dc_graph.legend = function() {
    var _legend = {}, _items, _included = [];
    var _dispatch = d3.dispatch('filtered');
    var _totals, _counts;

    function apply_filter() {
        if(_legend.dimension()) {
            _legend.dimension().filterFunction(function(k) {
                return !_included.length || _included.includes(k);
            });
            _legend.redraw();
            _legend.parent().redraw();
        }
    }

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
     #### .noLabel([value])
     Remove node labels, since legend labels are displayed outside of nodes instead. Default: true
    **/
    _legend.noLabel = property(true);

    _legend.counter = property(null);

    _legend.replaceFilter = function(filter) {
        if(filter && filter.length === 1)
            _included = filter[0];
        else
            _included = [];
        return _legend;
    };

    _legend.filters = function() {
        return _included;
    };

    _legend.on = function(type, f) {
        _dispatch.on(type, f);
        return _legend;
    };

    /**
     #### .exemplars([object])
     Specifies an object where the keys are the names of items to add to the legend, and the values are
     objects which will be passed to the accessors of the attached diagram in order to determine the
     drawing attributes. Alternately, if the key needs to be specified separately from the name, the
     function can take an array of {name, key, value} objects.
     **/
    _legend.exemplars = property({});

    _legend.parent = property(null).react(function(p) {
        if(p)
            p.on('data.legend', on_data);
        else _legend.parent().on('data.legend', null);
    });

    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        if(_legend.counter())
            _counts = _legend.counter()(wnodes.map(get_original), wedges.map(get_original), wports.map(get_original));
    }

    _legend.redraw = function() {
        var legend = _legend.parent().svg()
                .selectAll('g.dc-graph-legend')
                .data([0]);
        legend.enter().append('g')
            .attr('class', 'dc-graph-legend')
            .attr('transform', 'translate(' + _legend.x() + ',' + _legend.y() + ')');

        var node = legend.selectAll('.node')
                .data(_items, function(n) { return n.name; });
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node');
        nodeEnter.append('text')
            .attr('dy', '0.3em')
            .attr('class', 'legend-label');
        node
            .attr('transform', function(n, i) {
                return 'translate(' + _legend.nodeWidth()/2 + ',' + (_legend.nodeHeight() + _legend.gap())*(i+0.5) + ')';
            });
        node.select('text.legend-label')
            .attr('transform', 'translate(' + (_legend.nodeWidth()/2+_legend.gap()) + ',0)')
            .attr('pointer-events', _legend.dimension() ? 'auto' : 'none')
            .text(function(n) {
                return n.name + (_legend.counter() && _counts ? (' (' + (_counts[n.name] || 0) + (_counts[n.name] !== _totals[n.name] ? '/' + (_totals[n.name] || 0) : '') + ')') : '');
            });
        _legend.parent()
            ._enterNode(nodeEnter)
            ._updateNode(node);
        if(_legend.noLabel())
            node.selectAll('.node-label').remove();

        if(_legend.dimension()) {
            node.attr('cursor', 'pointer')
                .on('click.legend', function(d) {
                    var key = _legend.parent().nodeKey.eval(d);
                    if(!_included.length)
                        _included = _items.map(_legend.parent().nodeKey.eval);
                    if(_included.includes(key))
                        _included = _included.filter(function(x) { return x !== key; });
                    else
                        _included.push(key);
                    apply_filter();
                    _dispatch.filtered(_legend, key);
                });
        } else {
            node.attr('cursor', 'auto')
                .on('click.legend', null);
        }
        node.transition().duration(1000)
            .attr('opacity', function(d) {
                return (!_included.length || _included.includes(_legend.parent().nodeKey.eval(d))) ? 1 : 0.25;
            });
    };

    _legend.countBaseline = function() {
        if(_legend.counter)
            _totals = _legend.counter()(
                _legend.parent().nodeGroup().all(),
                _legend.parent().edgeGroup().all(),
                _legend.parent().portGroup() && _legend.parent().portGroup().all());
    };

    _legend.render = function() {
        var exemplars = _legend.exemplars();
        _legend.countBaseline();
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

    /* enables filtering */
    _legend.dimension = property(null)
        .react(function(v) {
            if(!v) {
                _included = [];
                apply_filter();
            }
        });

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
 * @class constraint_pattern
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
dc_graph.tree_positions = function(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    console.warn('dc_graph.tree_positions is deprecated; use the layout engine tree_layout instead');
    if(rootf || treef) {
        console.warn('dc_graph.tree_positions: rootf and treef are ignored');
    }
    var x;
    nwidth = d3.functor(nwidth);
    function best_dist(left, right) {
        return (nwidth(left) + nwidth(right)) / 2;
    }
    var dfs = dc_graph.depth_first_traversal({
        nodeid: function(n) {
            return n.cola.dcg_nodeKey;
        },
        sourceid: function(n) {
            return n.cola.dcg_edgeSource;
        },
        targetid: function(n) {
            return n.cola.dcg_edgeTarget;
        },
        init: function() {
            x = ofsx;
        },
        row: function(n) {
            return rowf(n.orig);
        },
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

    return function(diagram, nodes, edges) {
        return dfs(nodes, edges);
    };
};


// this naive tree-drawer is paraphrased from memory from dot
dc_graph.tree_constraints = function(rootf, treef, xgap, ygap) {
    console.warn('dc_graph.tree_constraints is deprecated - it never worked right and may not be a good idea');
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

dc_graph.behavior = function(event_namespace, options) {
    var _behavior = {};
    var _eventName = options.laterDraw ? 'transitionsStarted' : 'drawn';

    /**
     #### .parent([object])
     Assigns this behavior to a diagram.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var diagram;
            if(p) {
                var first = true;
                diagram = p;
                p.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    options.add_behavior(diagram, node, edge, ehover);
                    if(first && options.first) {
                        options.first(diagram, node, edge, ehover);
                        first = false;
                    }
                    else if(options.rest)
                        options.rest(diagram, node, edge, ehover);
                });
            }
            else if(_behavior.parent()) {
                diagram = _behavior.parent();
                diagram.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    options.remove_behavior(diagram, node, edge, ehover);
                    diagram.on(_eventName + '.' + event_namespace, null);
                });
            }
            options.parent && options.parent(p);
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
 * @class tip
 * @memberof dc_graph
 * @return {Object}
 **/
dc_graph.tip = function(options) {
    options = options || {};
    var _namespace = options.namespace || 'tip';
    var _d3tip = null;
    var _showTimeout, _hideTimeout;

    function init(parent) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; })
                .direction(_behavior.direction());
            if(_behavior.offset())
                _d3tip.offset(_behavior.offset());
            parent.svg().call(_d3tip);
        }
    }
    function fetch_and_show_content(fetcher) {
        return function(d) {
             var target = this,
                 next = function() {
                     _behavior[fetcher]()(d, function(content) {
                         _d3tip.show.call(target, content, target);
                         d3.select('div.d3-tip')
                             .selectAll('a.tip-link')
                             .on('click', function() {
                                 d3.event.preventDefault();
                                 if(_behavior.linkCallback())
                                     _behavior.linkCallback()(this.id);
                             });
                     });
                 };
             if(_behavior.selection().exclude && _behavior.selection().exclude(d3.event.target)) {
                 hide_tip.call(this);
                 return;
             }
             if(_hideTimeout)
                 window.clearTimeout(_hideTimeout);
             if(_behavior.delay()) {
                 window.clearTimeout(_showTimeout);
                 _showTimeout = window.setTimeout(next, _behavior.delay());
             }
             else next();
         };
    }

    function hide_tip() {
        if(d3.event.relatedTarget &&
           (!_behavior.selection().exclude || !_behavior.selection().exclude(d3.event.target)) &&
           (this.contains(d3.event.relatedTarget) || // do not hide when mouse is still over a child
            _behavior.clickable() && d3.event.relatedTarget.classList.contains('d3-tip')))
            return;
        if(_showTimeout) {
            window.clearTimeout(_showTimeout);
            _showTimeout = null;
        }
        if(_behavior.clickable())
            _hideTimeout = window.setTimeout(function () {
                _d3tip.hide();
            }, _behavior.hideDelay());
        else
            _d3tip.hide();
    }

    function add_behavior(diagram, node, edge, ehover) {
        init(diagram);
        _behavior.selection().select(diagram, node, edge, ehover)
            .on('mouseover.' + _namespace, fetch_and_show_content('content'))
            .on('mouseout.' + _namespace, hide_tip);
        if(_behavior.clickable()) {
            d3.select('div.d3-tip')
                .on('mouseover.' + _namespace, function() {
                    if(_hideTimeout)
                        window.clearTimeout(_hideTimeout);
                })
                .on('mouseout.' + _namespace, hide_tip);
        }
    }
    function remove_behavior(diagram, node, edge, ehover) {
        _behavior.selection().select(diagram, node, edge, ehover)
            .on('mouseover.' + _namespace, null)
            .on('mouseout.' + _namespace, null);
    }

    var _behavior = dc_graph.behavior(_namespace, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        laterDraw: true
    });
    /**
     * Specify the direction for tooltips. Currently supports the
     * [cardinal and intercardinal directions](https://en.wikipedia.org/wiki/Points_of_the_compass) supported by
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
    _behavior.direction = property('n');

    /**
     * Specifies the function to generate content for the tooltip. This function has the
     * signature `function(d, k)`, where `d` is the datum of the thing being hovered over,
     * and `k` is a continuation. The function should fetch the content, asynchronously if
     * needed, and then pass html forward to `k`.
     * @name content
     * @memberof dc_graph.tip
     * @instance
     * @param {Function} [content]
     * @return {Function}
     * @example
     * // Default behavior: assume it's a node, show node title
     * var tip = dc_graph.tip().content(function(n, k) {
     *     k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(n) : '');
     * });
     **/
    _behavior.content = property(function(n, k) {
        k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(n) : '');
    });

    _behavior.displayTip = function(filter, n) {
        var found = _behavior.selection().select(_behavior.parent(), _behavior.parent().selectAllNodes(), _behavior.parent().selectAllEdges(), null)
            .filter(filter);
        if(found.size() > 0) {
            var action = fetch_and_show_content('content');
            var which = (n || 0) % found.size();
            action.call(found[0][which], d3.select(found[0][which]).datum());
        }
    };
    _behavior.selection = property(dc_graph.tip.select_node_and_edge());
    _behavior.showDelay = _behavior.delay = property(0);
    _behavior.hideDelay = property(200);
    _behavior.offset = property(null);
    _behavior.clickable = property(false);
    _behavior.linkCallback = property(null);

    return _behavior;
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
 * tip.content(dc_graph.tip.table());
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

dc_graph.tip.select_node_and_edge = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            // hack to merge selections, not supported d3v3
            var selection = diagram.selectAll('.foo-this-does-not-exist');
            selection[0] = node[0].concat(ehover ? ehover[0] : []);
            return selection;
        },
        exclude: function(element) {
            return ancestor_has_class(element, 'port');
        }
    };
};

dc_graph.tip.select_node = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            return node;
        },
        exclude: function(element) {
            return ancestor_has_class(element, 'port');
        }
    };
};

dc_graph.tip.select_edge = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            return edge;
        }
    };
};

dc_graph.tip.select_port = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            return node.selectAll('g.port');
        }
    };
};

dc_graph.keyboard = function() {
    var _input_anchor, _dispatch = d3.dispatch('keydown', 'keyup');

    function keydown() {
        _dispatch.keydown();
    }
    function keyup() {
        _dispatch.keyup();
    }
    function add_behavior(diagram) {
        _input_anchor = diagram.svg().selectAll('a#dcgraph-keyboard').data([1]);
        _input_anchor.enter()
            .insert('a', ':first-child').attr({
                id: 'dcgraph-keyboard',
                href: '#'
            });
        _input_anchor.on('keydown.keyboard', keydown);
        _input_anchor.on('keyup.keyboard', keyup);

        // grab focus whenever svg is interacted with (?)
        diagram.svg().on('mouseup.keyboard', function() {
            _behavior.focus();
        });
    }
    function remove_behavior(diagram) {
        _input_anchor.remove();
    }
    var _behavior = dc_graph.behavior('brush', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });

    _behavior.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };

    _behavior.focus = function() {
        if(!_behavior.disableFocus())
            _input_anchor.node().focus();
    };

    _behavior.disableFocus = property(false);

    return _behavior;
};

// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

dc_graph.edit_text = function(parent, options) {
    var foreign = parent.append('foreignObject').attr({
        height: '100%',
        width: '100%' // don't wrap
    });
    function reposition() {
        var pos;
        switch(options.align) {
        case 'left':
            pos = [options.box.x, options.box.y];
            break;
        default:
        case 'center':
            pos = [
                options.box.x + (options.box.width - textdiv.node().offsetWidth)/2,
                options.box.y + (options.box.height - textdiv.node().offsetHeight)/2
            ];
            break;
        }
        foreign.attr('transform', 'translate(' + pos.join(' ') + ')');
    }
    var textdiv = foreign.append('xhtml:div');
    var text = options.text || "type on me";
    textdiv.text(text).attr({
        contenteditable: true,
        width: 'auto'
    }).style({
        display: 'inline-block',
        'background-color': 'white',
        padding: '2px'
    });

    function stopProp() {
        d3.event.stopPropagation();
    }
    foreign
        .on('mousedown', stopProp)
        .on('mousemove', stopProp)
        .on('mouseup', stopProp)
        .on('dblclick', stopProp);

    function accept() {
        options.accept && options.accept(textdiv.text());
        textdiv.on('blur.edittext', null);
        foreign.remove();
        options.finally && options.finally();
    }
    function cancel() {
        options.cancel && options.cancel();
        textdiv.on('blur.edittext', null);
        foreign.remove();
        options.finally && options.finally();
    }

    textdiv.on('keydown.edittext', function() {
        if(d3.event.keyCode===13) {
            d3.event.preventDefault();
        }
    }).on('keyup.edittext', function() {
        if(d3.event.keyCode===13) {
            accept();
        } else if(d3.event.keyCode===27) {
            cancel();
        }
        reposition();
    }).on('blur.edittext', cancel);
    reposition();
    textdiv.node().focus();

    var range = document.createRange();
    if(options.selectText) {
        range.selectNodeContents(textdiv.node());
    } else {
        range.setStart(textdiv.node(), 1);
        range.setEnd(textdiv.node(), 1);
    }
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};

dc_graph.brush = function() {
    var _brush = null, _gBrush, _dispatch = d3.dispatch('brushstart', 'brushmove', 'brushend');

    function brushstart() {
        _dispatch.brushstart();
    }
    function brushmove() {
        var ext = _brush.extent();
        _dispatch.brushmove(ext);
    }
    function brushend() {
        _dispatch.brushend();
        _gBrush.call(_brush.clear());
    }
    function install_brush(diagram) {
        if(!_brush) {
            _brush = d3.svg.brush()
                .x(diagram.x()).y(diagram.y())
                .on('brushstart', brushstart)
                .on('brush', brushmove)
                .on('brushend', brushend);
        }
        if(!_gBrush) {
            _gBrush = diagram.svg().insert('g', ':first-child')
                .attr('class', 'brush')
                .call(_brush);
        }
    }
    function remove_brush() {
        if(_gBrush) {
            _gBrush.remove();
            _gBrush = null;
        }
    }
    var _behavior = dc_graph.behavior('brush', {
        add_behavior: function() {},
        remove_behavior: remove_brush
    });

    _behavior.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    _behavior.activate = function() {
        install_brush(_behavior.parent());
        return this;
    };
    _behavior.deactivate = function() {
        remove_brush();
        return this;
    };
    _behavior.isActive = function () {
        return !!_gBrush;
    };

    return _behavior;
};

dc_graph.select_things = function(things_group, things_name, thinginess) {
    var _selected = [], _oldSelected;
    var _mousedownThing = null;

    var contains_predicate = thinginess.keysEqual ?
            function(k1) {
                return function(k2) {
                    return thinginess.keysEqual(k1, k2);
                };
            } :
        function(k1) {
            return function(k2) {
                return k1 === k2;
            };
        };
    function contains(array, key) {
        return !!_selected.find(contains_predicate(key));
    }
    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }
    function add_array(array, key) {
        return contains(array, key) ? array : array.concat([key]);
    }
    function toggle_array(array, key) {
        return contains(array, key) ? array.filter(function(x) { return x != key; }) : array.concat([key]);
    }

    function selection_changed(diagram) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
            if(refresh)
                diagram.refresh();
        };
    }
    var _have_bce = false;
    function background_click_event(diagram, v) {
        // we seem to have nodes-background interrupting edges-background by reinstalling uselessly
        if(_have_bce === v)
            return;
        diagram.svg().on('click.' + things_name, v ? function(t) {
            if(d3.event.target === this)
                things_group.set_changed([]);
        } : null);
        _have_bce = v;
    }
    function brushstart() {
        if(isUnion(d3.event.sourceEvent) || isToggle(d3.event.sourceEvent))
            _oldSelected = _selected.slice();
        else {
            _oldSelected = [];
            things_group.set_changed([]);
        }
    }
    function brushmove(ext) {
        var rectSelect = thinginess.intersectRect(ext);
        var newSelected;
        if(isUnion(d3.event.sourceEvent))
            newSelected = rectSelect.reduce(add_array, _oldSelected);
        else if(isToggle(d3.event.sourceEvent))
            newSelected = rectSelect.reduce(toggle_array, _oldSelected);
        else
            newSelected = rectSelect;
        things_group.set_changed(newSelected);
    }

    function add_behavior(diagram, node, edge) {
        var condition = _behavior.noneIsAll() ? function(t) {
            return !_selected.length || contains(_selected, thinginess.key(t));
        } : function(t) {
            return contains(_selected, thinginess.key(t));
        };
        thinginess.applyStyles(condition);

        thinginess.clickables(diagram, node, edge).on('mousedown.' + things_name, function(t) {
            _mousedownThing = t;
        });

        thinginess.clickables(diagram, node, edge).on('mouseup.' + things_name, function(t) {
            if(thinginess.excludeClick && thinginess.excludeClick(d3.event.target))
                return;
            // it's only a click if the same target was mousedown & mouseup
            // but we can't use click event because things may have been reordered
            if(_mousedownThing !== t)
                return;
            var key = thinginess.key(t), newSelected;
            if(_behavior.multipleSelect()) {
                if(isUnion(d3.event))
                    newSelected = add_array(_selected, key);
                else if(isToggle(d3.event))
                    newSelected = toggle_array(_selected, key);
            }
            if(!newSelected)
                newSelected = [key];
            things_group.set_changed(newSelected);
        });

        if(_behavior.multipleSelect()) {
            var brush_mode = diagram.child('brush');
            brush_mode.activate();
        }
        else
            background_click_event(diagram, _behavior.clickBackgroundClears());

        if(_behavior.autoCropSelection()) {
            // drop any selected which no longer exist in the diagram
            var present = thinginess.clickables(diagram, node, edge).data().map(thinginess.key);
            var now_selected = _selected.filter(function(k) { return contains(present, k); });
            if(_selected.length !== now_selected.length)
                things_group.set_changed(now_selected, false);
        }
    }

    function remove_behavior(diagram, node, edge) {
        thinginess.clickables(diagram, node, edge).on('click.' + things_name, null);
        diagram.svg().on('click.' + things_name, null);
        thinginess.removeStyles();
    }

    var _behavior = dc_graph.behavior(things_name, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            things_group.on('set_changed.' + things_name, p ? selection_changed(p) : null);
            if(p) {
                var brush_mode = p.child('brush');
                if(!brush_mode) {
                    brush_mode = dc_graph.brush();
                    p.child('brush', brush_mode);
                }
                brush_mode
                    .on('brushstart.' + things_name, brushstart)
                    .on('brushmove.' + things_name, brushmove);
            }
        },
        laterDraw: thinginess.laterDraw || false
    });

    _behavior.multipleSelect = property(true);
    _behavior.clickBackgroundClears = property(true, false).react(function(v) {
        if(!_behavior.multipleSelect() && _behavior.parent())
            background_click_event(_behavior.parent(), v);
    });
    _behavior.noneIsAll = property(false);
    // if you're replacing the data, you probably want the selection not to be preserved when a thing
    // with the same key re-appears later (true). however, if you're filtering dc.js-style, you
    // probably want filters to be independent between diagrams (false)
    _behavior.autoCropSelection = property(true);
    // if you want to do the cool things select_things can do
    _behavior.thinginess = function() {
        return thinginess;
    };
    return _behavior;
};

dc_graph.select_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('set_changed');
    });

    return window.chart_registry.create_group(type, brushgroup);
};

dc_graph.select_nodes = function(props, options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');

    var thinginess = {
        intersectRect: function(ext) {
            return _behavior.parent().selectAllNodes().data().filter(function(n) {
                return n && ext[0][0] < n.cola.x && n.cola.x < ext[1][0] &&
                    ext[0][1] < n.cola.y && n.cola.y < ext[1][1];
            }).map(this.key);
        },
        clickables: function(diagram, node, edge) {
            return node;
        },
        excludeClick: function(element) {
            return ancestor_has_class(element, 'port');
        },
        key: function(n) {
            return _behavior.parent().nodeKey.eval(n);
        },
        applyStyles: function(pred) {
            _behavior.parent().cascade(50, true, node_edge_conditions(pred, null, props));
        },
        removeStyles: function() {
            _behavior.parent().cascade(50, false, props);
        }
    };
    var _behavior = dc_graph.select_things(select_nodes_group, 'select-nodes', thinginess);
    return _behavior;
};

dc_graph.select_edges = function(props, options) {
    options = options || {};
    var select_edges_group = dc_graph.select_things_group(options.select_edges_group || 'select-edges-group', 'select-edges');
    var thinginess = {
        intersectRect: function(ext) {
            return this.clickables().data().filter(function(e) {
                // this nonsense because another select_things may have invalidated the edge positions (!!)
                var sp = {
                    x: e.source.cola.x + e.sourcePort.pos.x,
                    y: e.source.cola.y + e.sourcePort.pos.y
                },
                    tp = {
                        x: e.target.cola.x + e.targetPort.pos.x,
                        y: e.target.cola.y + e.targetPort.pos.y
                    };
                return [sp, tp].some(function(p) {
                    return ext[0][0] < p.x && p.x < ext[1][0] &&
                        ext[0][1] < p.y && p.y < ext[1][1];
                });
            }).map(this.key);
        },
        clickables: function() {
            return _behavior.parent().selectAllEdges('.edge-hover');
        },
        key: function(e) {
            return _behavior.parent().edgeKey.eval(e);
        },
        applyStyles: function(pred) {
            _behavior.parent().cascade(50, true, node_edge_conditions(null, pred, props));
        },
        removeStyles: function() {
            _behavior.parent().cascade(50, false, props);
        }
    };
    var _behavior = dc_graph.select_things(select_edges_group, 'select-edges', thinginess);
    return _behavior;
};

dc_graph.select_ports = function(props, options) {
    options = options || {};
    var port_style = options.portStyle || 'symbols';
    var select_ports_group = dc_graph.select_things_group(options.select_ports_group || 'select-ports-group', 'select-ports');
    var thinginess = {
        laterDraw: true,
        intersectRect: null, // multiple selection not supported for now
        clickables: function() {
            return _behavior.parent().selectAllNodes('g.port');
        },
        key: function(p) {
            // this scheme also won't work with multiselect
            return p.named ?
                {node: _behavior.parent().nodeKey.eval(p.node), name: p.name} :
            {edge: _behavior.parent().edgeKey.eval(p.edges[0]), name: p.name};
        },
        applyStyles: function(pred) {
            _behavior.parent().portStyle(port_style).cascade(50, true, conditional_properties(pred, props));
        },
        removeStyles: function() {
            _behavior.parent().portStyle(port_style).cascade(50, false, props);
        },
        keysEqual: function(k1, k2) {
            return k1.name === k2.name && (k1.node ? k1.node === k2.node : k1.edge === k2.edge);
        }
    };
    var _behavior = dc_graph.select_things(select_ports_group, 'select-ports', thinginess);
    return _behavior;
};

dc_graph.move_nodes = function(options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');
    var fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _selected = [], _startPos = null, _downNode, _moveStarted;
    var _brush, _drawGraphs, _selectNodes, _restoreBackgroundClick;

    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }

    function selection_changed(diagram) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
        };
    }
    function for_each_selected(f) {
        _selected.forEach(function(key) {
            var n = _behavior.parent().getWholeNode(key);
            f(n, key);
        });
    }
    function add_behavior(diagram, node, edge) {
        node.on('mousedown.move-nodes', function(n) {
            // Need a more general way for modes to say "I got this"
            if(_drawGraphs && _drawGraphs.usePorts() && _drawGraphs.usePorts().eventPort())
                return;
            _startPos = dc_graph.event_coords(diagram);
            _downNode = d3.select(this);
            // if the node under the mouse is not in the selection, need to
            // make that node selected
            var key = diagram.nodeKey.eval(n);
            if(_selected.indexOf(key)<0)
                select_nodes_group.set_changed([key]);
            for_each_selected(function(n) {
                n.original_position = [n.cola.x, n.cola.y];
            });
            if(_brush)
                _brush.deactivate();
        });
        function mouse_move() {
            if(_startPos) {
                var pos = dc_graph.event_coords(diagram);
                var dx = pos[0] - _startPos[0],
                    dy = pos[1] - _startPos[1];
                if(!_moveStarted && Math.hypot(dx, dy) > _behavior.dragSize()) {
                    _moveStarted = true;
                    // prevent click event for this node setting selection just to this
                    if(_downNode)
                        _downNode.style('pointer-events', 'none');
                }
                if(_moveStarted) {
                    for_each_selected(function(n) {
                        n.cola.x = n.original_position[0] + dx;
                        n.cola.y = n.original_position[1] + dy;
                    });
                    diagram.reposition(node, edge);
                }
            }
        }
        function mouse_up() {
            if(_startPos) {
                if(_moveStarted) {
                    _moveStarted = false;
                    if(_downNode) {
                        _downNode.style('pointer-events', null);
                        _downNode = null;
                    }
                    var fixes = [];
                    for_each_selected(function(n, id) {
                        fixes.push({
                            id: id,
                            pos: {x: n.cola.x, y: n.cola.y}
                        });
                    });
                    fix_nodes_group.request_fixes(fixes);
                }
                if(_brush)
                    _brush.activate();
                _startPos = null;
            }
        }
        node
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
        diagram.svg()
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
    }

    function remove_behavior(diagram, node, edge) {
        node.on('mousedown.move-nodes', null);
        node.on('mousemove.move-nodes', null);
        node.on('mouseup.move-nodes', null);
    }

    var _behavior = dc_graph.behavior('move-nodes', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            select_nodes_group.on('set_changed.move-nodes', p ? selection_changed(p) : null);
            _brush = p.child('brush');
            _drawGraphs = p.child('draw-graphs');
            _selectNodes = p.child('select-nodes');
        }
    });

    // minimum distance that is considered a drag, not a click
    _behavior.dragSize = property(5);

    return _behavior;
};

dc_graph.fix_nodes = function(options) {
    options = options || {};
    var fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var _fixes = [], _nodes, _wnodes, _edges, _wedges;

    var _execute = {
        nodeid: function(n) {
            return _behavior.parent().nodeKey.eval(n);
        },
        sourceid: function(e) {
            return _behavior.parent().edgeSource.eval(e);
        },
        targetid: function(e) {
            return _behavior.parent().edgeTarget.eval(e);
        },
        get_fix: function(n) {
            return _behavior.parent().nodeFixed.eval(n);
        },
        fix_node: function(n, pos) {
            n[_fixedPosTag] = pos;
        },
        unfix_node: function(n) {
            n[_fixedPosTag] = null;
        },
        clear_fixes: function() {
            _fixes = {};
        },
        register_fix: function(id, pos) {
            _fixes[id] = pos;
        }
    };

    function request_fixes(fixes) {
        _behavior.strategy().request_fixes(_execute, fixes);
        tell_then_set(find_changes()).then(function() {
            _behavior.parent().redraw();
        });
    }
    function new_node(nid, n, pos) {
        _behavior.strategy().new_node(_execute, nid, n, pos);
    }
    function new_edge(eid, sourceid, targetid) {
        var source = _nodes[sourceid], target = _nodes[targetid];
        _behavior.strategy().new_edge(_execute, eid, source, target);
    }
    function find_changes() {
        var changes = [];
        _wnodes.forEach(function(n) {
            var key = _behavior.parent().nodeKey.eval(n),
                fixPos = _fixes[key],
                oldFixed = n.orig.value[_fixedPosTag],
                changed = false;
            if(oldFixed) {
                if(!fixPos || fixPos.x !== oldFixed.x || fixPos.y !== oldFixed.y)
                    changed = true;
            }
            else changed = fixPos;
            if(changed)
                changes.push({n: n, fixed: fixPos ? {x: fixPos.x, y: fixPos.y} : null});
        });
        return changes;
    }
    function execute_change(n, fixed) {
        if(fixed)
            _execute.fix_node(n.orig.value, fixed);
        else
            _execute.unfix_node(n.orig.value);
    }
    function tell_then_set(changes) {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = changes.map(function(change) {
            var key = _behavior.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed)
                .then(function(fixed) {
                    execute_change(change.n, fixed);
                });
        });
        return Promise.all(promises);
    }
    function set_changes(changes) {
        changes.forEach(function(change) {
            execute_change(change.n, change.fixed);
        });
    }
    function tell_changes(changes) {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = changes.map(function(change) {
            var key = _behavior.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed);
        });
        return Promise.all(promises);
    }
    function fix_all_nodes(tell) {
        if(tell === undefined)
           tell = true;
        var changes = _wnodes.map(function(n) {
            return {n: n, fixed: {x: n.cola.x, y: n.cola.y}};
        });
        if(tell)
            return tell_then_set(changes);
        else {
            set_changes(changes);
            return Promise.resolve(undefined);
        }
    }
    function clear_fixes() {
        _behavior.strategy().clear_all_fixes && _behavior.strategy().clear_all_fixes();
        _execute.clear_fixes();
    }
    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _nodes = nodes;
        _wnodes = wnodes;
        _edges = edges;
        _wedges = wedges;
        if(_behavior.strategy().on_data) {
            _behavior.strategy().on_data(_execute, nodes, wnodes, edges, wedges, ports, wports); // ghastly
            var changes = find_changes();
            set_changes(changes);
            // can't wait for backend to acknowledge/approve so just set then blast
            if(_behavior.reportOverridesAsynchronously())
                tell_changes(changes); // dangling promise
        }
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            fix_nodes_group
                .on('request_fixes.fix-nodes', p ? request_fixes : null)
                .on('new_node.fix_nodes', p ? new_node : null)
                .on('new_edge.fix_nodes', p ? new_edge : null);
            if(p) {
                p.on('data.fix-nodes', on_data);
            } else if(_behavior.parent())
                _behavior.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null),
        // save/load may want to nail everything / start from scratch
        // (should probably be automatic though)
        fixAllNodes: fix_all_nodes,
        clearFixes: clear_fixes,
        strategy: property(dc_graph.fix_nodes.strategy.fix_last()),
        reportOverridesAsynchronously: property(true)
    };

    return _behavior;
};

dc_graph.fix_nodes.strategy = {};
dc_graph.fix_nodes.strategy.fix_last = function() {
    return {
        request_fixes: function(exec, fixes) {
            exec.clear_fixes();
            fixes.forEach(function(fix) {
                exec.register_fix(fix.id, fix.pos);
            });
        },
        new_node: function(exec, nid, n, pos) {
            exec.fix_node(n, pos);
        },
        new_edge: function(exec, eid, source, target) {
            exec.unfix_node(source.orig.value);
            exec.unfix_node(target.orig.value);
        }
    };
};
dc_graph.fix_nodes.strategy.last_N_per_component = function(maxf) {
    maxf = maxf || 1;
    var _age = 0;
    var _allFixes = {};
    return {
        clear_all_fixes: function() {
            _allFixes = {};
        },
        request_fixes: function(exec, fixes) {
            ++_age;
            fixes.forEach(function(fix) {
                _allFixes[fix.id] = {id: fix.id, age: _age, pos: fix.pos};
            });
        },
        new_node: function(exec, nid, n, pos) {
            ++_age;
            _allFixes[nid] = {id: nid, age: _age, pos: pos};
            exec.fix_node(n, pos);
        },
        new_edge: function() {},
        on_data: function(exec, nodes, wnodes, edges, wedges, ports, wports) {
            ++_age;
            // add any existing fixes as requests
            wnodes.forEach(function(n) {
                var nid = exec.nodeid(n), pos = exec.get_fix(n);
                if(pos && !_allFixes[nid])
                    _allFixes[nid] = {id: nid, age: _age, pos: pos};
            });
            // determine components
            var components = [];
            var dfs = dc_graph.undirected_dfs({
                nodeid: exec.nodeid,
                sourceid: exec.sourceid,
                targetid: exec.targetid,
                comp: function() {
                    components.push([]);
                },
                node: function(compid, n) {
                    components[compid].push(n);
                }
            });
            dfs(wnodes, wedges);
            // start from scratch
            exec.clear_fixes();
            // keep or produce enough fixed nodes per component
            components.forEach(function(comp, i) {
                var oldcomps = comp.reduce(function(cc, n) {
                    if(n.last_component) {
                        var counts = cc[n.last_component] = cc[n.last_component] || {
                            total: 0,
                            fixed: 0
                        };
                        counts.total++;
                        if(_allFixes[exec.nodeid(n)])
                            counts.fixed++;
                    }
                    return cc;
                }, {});
                var fixed_by_size = Object.keys(oldcomps).reduce(function(ff, compid) {
                    if(oldcomps[compid].fixed)
                        ff.push({compid: +compid, total: oldcomps[compid].total, fixed: oldcomps[compid].fixed});
                    return ff;
                }, []).sort(function(coa, cob) {
                    return cob.total - coa.total;
                });
                var largest_fixed = fixed_by_size.length && fixed_by_size[0].compid;
                var fixes = comp.filter(function(n) {
                    return !n.last_component || n.last_component === largest_fixed;
                }).map(function(n) {
                    return _allFixes[exec.nodeid(n)];
                }).filter(function(fix) {
                    return fix;
                });
                if(fixes.length > maxf) {
                    fixes.sort(function(f1, f2) {
                        return f2.age - f1.age;
                    });
                    fixes = fixes.slice(0, maxf);
                }
                fixes.forEach(function(fix) {
                    exec.register_fix(fix.id, fix.pos);
                });
                var kept = fixes.reduce(function(m, fix) {
                    m[fix.id] = true;
                    return m;
                }, {});
                comp.forEach(function(n) {
                    var nid = exec.nodeid(n);
                    if(!kept[nid])
                        _allFixes[nid] = null;
                    n.last_component = i+1;
                });
            });
        }
    };
};

dc_graph.fix_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('fix-nodes', function() {
        return d3.dispatch('request_fixes', 'new_node', 'new_edge');
    });

    return window.chart_registry.create_group('fix-nodes', brushgroup);
};

dc_graph.filter_selection = function(things_group, things_name) {
    things_name = things_name || 'select-nodes';
    var select_nodes_group = dc_graph.select_things_group(things_group || 'select-nodes-group', things_name);

    function selection_changed(diagram) {
        return function(selection) {
            if(selection.length) {
                var set = d3.set(selection);
                _behavior.dimensionAccessor()(diagram).filterFunction(function(k) {
                    return set.has(k);
                });
            } else _behavior.dimensionAccessor()(diagram).filter(null);
            diagram.redrawGroup();
        };
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            select_nodes_group.on('set_changed.filter-selection-' + things_name, p ? selection_changed(p) : null);
        })
    };
    _behavior.dimensionAccessor = property(function(diagram) {
        return diagram.nodeDimension();
    });
    return _behavior;
};

dc_graph.delete_things = function(things_group, mode_name, id_tag) {
    id_tag = id_tag || 'id';
    var _deleteKey = is_a_mac ? 'Backspace' : 'Delete';
    var _keyboard, _selected = [];
    function selection_changed(selection) {
        _selected = selection;
    }
    function row_id(r) {
        return r[id_tag];
    }
    function delete_selection(selection) {
        if(!_behavior.crossfilterAccessor())
            throw new Error('need crossfilterAccessor');
        if(!_behavior.dimensionAccessor())
            throw new Error('need dimensionAccessor');
        selection = selection || _selected;
        if(selection.length === 0)
            return Promise.resolve([]);
        var promise = _behavior.preDelete() ? _behavior.preDelete()(selection) : Promise.resolve(selection);
        if(_behavior.onDelete())
            promise = promise.then(_behavior.onDelete());
        return promise.then(function(selection) {
            if(selection && selection.length) {
                var crossfilter = _behavior.crossfilterAccessor()(_behavior.parent()),
                    dimension = _behavior.dimensionAccessor()(_behavior.parent());
                var all = crossfilter.all().slice(), n = all.length;
                dimension.filter(null);
                crossfilter.remove();
                var filtered = all.filter(function(r) {
                    return selection.indexOf(row_id(r)) === -1;
                });
                if(all.length !== filtered.length + selection.length)
                    console.warn('size after deletion is not previous size minus selection size',
                                 filtered.map(row_id), all.map(row_id), selection);
                crossfilter.add(filtered);

                _behavior.parent().redrawGroup();
            }
            return true;
        });
    }
    function add_behavior(diagram) {
        _keyboard.on('keyup.' + mode_name, function() {
            if(d3.event.code === _deleteKey)
                delete_selection();
        });
    }
    function remove_behavior(diagram) {
    }
    var _behavior = dc_graph.behavior(mode_name, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            things_group.on('set_changed.' + mode_name, selection_changed);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
            }
        }
    });
    _behavior.preDelete = property(null);
    _behavior.onDelete = property(null);
    _behavior.crossfilterAccessor = property(null);
    _behavior.dimensionAccessor = property(null);
    _behavior.deleteSelection = delete_selection;
    return _behavior;
};

dc_graph.delete_nodes = function(id_tag, options) {
    options = options || {};
    var select_nodes_group = dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes');
    var select_edges_group = dc_graph.select_things_group(options.select_edges_group || 'select-edges-group', 'select-edges');
    var _behavior = dc_graph.delete_things(select_nodes_group, 'delete-nodes', id_tag);

    _behavior.preDelete(function(nodes) {
        // request a delete of all attached edges, using the delete edges mode
        // kind of horrible
        var diagram = _behavior.parent();
        var deleteEdgesMode = diagram.child('delete-edges');
        if(!deleteEdgesMode)
            return null; // reject if we can't delete the edges
        // it is likely that the delete_edges mode is listening to the same keyup event we
        // are. introduce a pause to let it process the delete key now, deleting any selected edges.
        // then select any remaining edges connected to the selected nodes and delete those.
        //
        // more evidence that modes need to be able to say "i got this", or that we should have
        // batch deletion. otoh, given the current behavior, delete_nodes deferring to delete_edges
        // makes about as much sense as anything
        return Promise.resolve(undefined).then(function() {
            var deleteEdges = diagram.edgeGroup().all().filter(function(e) {
                return nodes.indexOf(diagram.edgeSource()(e)) !== -1 ||
                    nodes.indexOf(diagram.edgeTarget()(e)) !== -1;
            }).map(diagram.edgeKey());
            select_edges_group.set_changed(deleteEdges);
            return deleteEdgesMode.deleteSelection().then(function() {
                return nodes;
            });
        });
    });
    return _behavior;
};

dc_graph.label_things = function(options) {
    options = options || {};
    var select_things_group = dc_graph.select_things_group(options.select_group, options.select_type),
        label_things_group = dc_graph.label_things_group(options.label_group, options.label_type);
    var _selected = [];
    var _keyboard, _selectThings;

    function selection_changed_listener(diagram) {
        return function(selection) {
            _selected = selection;
        };
    }

    function grab_focus() {
        _keyboard.focus();
    }

    function edit_label_listener(diagram) {
        return function(thing, eventOptions) {
            var box = options.thing_box(thing);
            dc_graph.edit_text(
                diagram.g(),
                {
                    text: eventOptions.text || options.thing_label(thing) || options.default_label,
                    align: options.align,
                    box: box,
                    selectText: eventOptions.selectText,
                    accept: function(text) {
                        return options.accept(thing, text);
                    },
                    finally: grab_focus
                });
        };
    }

    function edit_selection(node, edge, eventOptions) {
        // less than ideal interface.
        // what if there are other things? can i blame the missing metagraph?
        var thing = options.find_thing(_selected[0], node, edge);
        if(thing.empty()) {
            console.error("couldn't find thing '" + _selected[0] + "'!");
            return;
        }
        if(thing.size()>1) {
            console.error("found too many things for '" + _selected[0] + "' (" + thing.size() + ")!");
            return;
        }
        label_things_group.edit_label(thing, eventOptions);
    }
    function add_behavior(diagram, node, edge) {
        _keyboard.on('keyup.' + options.label_type, function() {
            if(_selected.length) {
                // printable characters should start edit
                if(d3.event.key.length !== 1)
                    return;
                edit_selection(node, edge, {text: d3.event.key, selectText: false});
            }
        });
        if(_selectThings)
            _selectThings.thinginess().clickables(diagram, node, edge).on('dblclick.' + options.label_type, function() {
                edit_selection(node, edge, {selectText: true});
            });
    }

    function remove_behavior(diagram, node, edge) {
    }

    var _behavior = dc_graph.behavior(options.label_type, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            select_things_group.on('set_changed.' + options.label_type, p ? selection_changed_listener(p) : null);
            label_things_group.on('edit_label.' + options.label_type, p ? edit_label_listener(p) : null);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
                _selectThings = p.child(options.select_type);
            }
        }
    });
    _behavior.editSelection = function(eventOptions) {
        edit_selection(_behavior.parent().selectAllNodes(), _behavior.parent().selectAllEdges(), eventOptions);
    };
    return _behavior;
};

dc_graph.label_things_group = function(brushgroup, type) {
    window.chart_registry.create_type(type, function() {
        return d3.dispatch('edit_label');
    });

    return window.chart_registry.create_group(type, brushgroup);
};

dc_graph.label_nodes = function(options) {
    options = options || {};
    var _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-nodes-group';
    options.select_type = options.select_type || 'select-nodes';
    options.label_group = options.label_group || 'label-nodes-group';
    options.label_type = options.label_type || 'label-nodes';
    options.default_label = "node name";

    options.find_thing = function(key, node, edge) {
        return node.filter(function(n) {
            return _behavior.parent().nodeKey.eval(n) === key;
        });
    };
    options.thing_box = function(node, eventOptions) {
        var contents = _behavior.parent().content(_behavior.parent().nodeContent.eval(node.datum())),
            box = contents.textbox(node);
        box.x += node.datum().cola.x;
        box.y += node.datum().cola.y;
        return box;
    };
    options.thing_label = function(node) {
        return _behavior.parent().nodeLabel.eval(node.datum());
    };
    options.accept = function(node, text) {
        var callback = _behavior.changeNodeLabel() ?
                _behavior.changeNodeLabel()(_behavior.parent().nodeKey.eval(node.datum()), text) :
                Promise.resolve(text);
        return callback.then(function(text2) {
            var n = node.datum();
            n.orig.value[_labelTag] = text2;
            _behavior.parent().redrawGroup();
        });
    };

    var _behavior = dc_graph.label_things(options);
    _behavior.changeNodeLabel = property(null);
    return _behavior;
};

dc_graph.label_edges = function(options) {
    options = options || {};
    var _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-edges-group';
    options.select_type = options.select_type || 'select-edges';
    options.label_group = options.label_group || 'label-edges-group';
    options.label_type = options.label_type || 'label-edges';
    options.default_label = "edge name";

    options.find_thing = function(key, node, edge) {
        return edge.filter(function(e) {
            return _behavior.parent().edgeKey.eval(e) === key;
        });
    };
    options.thing_box = function(edge, eventOptions) {
        var points = edge.datum().pos.new.path.points,
            x = (points[0].x + points[1].x)/2,
            y = (points[0].y + points[1].y)/2;
        return {x: x, y: y-10, width:0, height: 20};
    };
    options.thing_label = function(edge) {
        return _behavior.parent().edgeLabel.eval(edge.datum());
    };
    options.accept = function(edge, text) {
        var callback = _behavior.changeEdgeLabel() ?
                _behavior.changeEdgeLabel()(_behavior.parent().edgeKey.eval(edge.datum()), text) :
                Promise.resolve(text);
        return callback.then(function(text2) {
            var e = edge.datum();
            e.orig.value[_labelTag] = text2;
            _behavior.parent().redrawGroup();
        });
    };

    var _behavior = dc_graph.label_things(options);
    _behavior.changeEdgeLabel = property(null);
    return _behavior;
};

dc_graph.highlight_neighbors = function(props) {
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_highlighted = false;
        });
    }

    function add_behavior(diagram, node, edge) {
        diagram.cascade(100, true, node_edge_conditions(null, function(e) {
            return e.dcg_highlighted;
        }, props));
        node
            .on('mouseover.highlight-neighbors', function(n) {
                edge.each(function(e) {
                    e.dcg_highlighted = e.source === n || e.target === n;
                });
                diagram.refresh(node, edge);
            })
            .on('mouseout.highlight-neighbors', function(n) {
                clear_all_highlights(edge);
                diagram.refresh(node, edge);
            });
    }

    function remove_behavior(diagram, node, edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        clear_all_highlights(edge);
        diagram.cascade(100, false, props);
    }

    return dc_graph.behavior('highlight-neighbors', {
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge) {
            remove_behavior(diagram, node, edge);
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
    var _anchor;

    function refresh() {
        if(_behavior.doRedraw())
            _behavior.parent().relayout().redraw();
        else
            _behavior.parent().refresh();
    }

    function paths_changed(nop, eop) {
        selected = hoverpaths = null;
        // it would be difficult to check if no change, but at least check if changing from empty to empty
        if(Object.keys(node_on_paths).length === 0 && Object.keys(nop).length === 0 &&
           Object.keys(edge_on_paths).length === 0 && Object.keys(eop).length === 0)
            return;
        node_on_paths = nop;
        edge_on_paths = eop;
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

    function add_behavior(diagram, node, edge, ehover) {
        diagram
            .cascade(200, true, node_edge_conditions(function(n) {
                return !!node_on_paths[diagram.nodeKey.eval(n)];
            }, function(e) {
                return !!edge_on_paths[diagram.edgeKey.eval(e)];
            }, pathprops))
            .cascade(300, true, node_edge_conditions(function(n) {
                return intersect_paths(node_on_paths[diagram.nodeKey.eval(n)], selected);
            }, function(e) {
                return intersect_paths(edge_on_paths[diagram.edgeKey.eval(e)], selected);
            }, selectprops))
            .cascade(400, true, node_edge_conditions(function(n) {
                return intersect_paths(node_on_paths[diagram.nodeKey.eval(n)], hoverpaths);
            }, function(e) {
                return intersect_paths(edge_on_paths[diagram.edgeKey.eval(e)], hoverpaths);
            }, hoverprops));

        node
            .on('mouseover.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(node_on_paths[diagram.nodeKey.eval(n)] || null);
            })
            .on('mouseout.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, node_on_paths[diagram.nodeKey.eval(n)]));
            });


        ehover
            .on('mouseover.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(edge_on_paths[diagram.edgeKey.eval(e)] || null);
            })
            .on('mouseout.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, edge_on_paths[diagram.nodeKey.eval(n)]));
            });
    }

    function remove_behavior(diagram, node, edge, ehover) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        ehover
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        clear_all_highlights();
        diagram
            .cascade(200, false, pathprops)
            .cascade(300, false, selectprops)
            .cascade(400, false, hoverprops);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge, ehover) {
            remove_behavior(diagram, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            if(p)
                _anchor = p.anchorName();
            // else we should have received anchor earlier
            highlight_paths_group.on('paths_changed.highlight' + _anchor, p ? paths_changed : null);
            highlight_paths_group.on('hover_changed.highlight' + _anchor, p ? hover_changed : null);
            highlight_paths_group.on('select_changed.highlight' + _anchor, p ? select_changed : null);
        }
    });

    // whether to do relayout & redraw (true) or just refresh (false)
    _behavior.doRedraw = property(false);

    return _behavior;
};


dc_graph.draw_spline_paths = function(pathreader, pathprops, hoverprops, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    var _paths = null;
    var _anchor;
    var _layer = null;
    var _savedPositions = null;

    function paths_changed(nop, eop, paths) {
        // clear old paths
        _layer.selectAll('.spline-edge').remove();
        _layer.selectAll('.spline-edge-hover').remove();

        _paths = paths;

        var engine = _behavior.parent().layoutEngine(),
            localPaths = paths.filter(pathIsPresent);
        if(localPaths.length) {
            var nidpaths = localPaths.map(path_keys);
            engine.paths(nidpaths);
        } else {
            engine.paths(null);
            if(_savedPositions)
                engine.restorePositions(_savedPositions);
        }
        _behavior.parent().redraw();
    }

    function path_keys(path) {
        return uniq(pathreader.elementList.eval(path).filter(function(elem) {
            return pathreader.elementType.eval(elem) === 'node';
        }).map(function(elem) {
            return pathreader.nodeKey.eval(elem);
        }));
    }

    // check if entire path is present in this view
    function pathIsPresent(path) {
        return pathreader.elementList.eval(path).every(function(element) {
            return pathreader.elementType.eval(element) !== 'node' ||
                _behavior.parent().getWholeNode(pathreader.nodeKey.eval(element));
        });
    }

    // get the positions of nodes on path
    function getNodePositions(path) {
        return path_keys(path).map(function(key) {
            var node = _behavior.parent().getWholeNode(key);
            return {'x': node.cola.x, 'y': node.cola.y};
        });
    };

    // insert fake nodes to avoid sharp turns
    function insertDummyNodes(path_coord) {
        function _distance(node1, node2) {
            return Math.sqrt(Math.pow((node1.x-node2.x),2) + Math.pow((node1.y-node2.y),2));
        }

        var new_path_coord = [];

        for(var i = 0; i < path_coord.length; i ++) {
            if (i-1 >= 0 && i+1 < path_coord.length) {
                if (path_coord[i-1].x === path_coord[i+1].x &&
                    path_coord[i-1].y === path_coord[i+1].y ) {
                    // insert node when the previous and next nodes are the same
                    var x1 = path_coord[i-1].x, y1 = path_coord[i-1].y;
                    var x2 = path_coord[i].x, y2 = path_coord[i].y;
                    var dx = x1 - x2, dy = y1 - y2;

                    var v1 = dy / Math.sqrt(dx*dx + dy*dy);
                    var v2 = - dx / Math.sqrt(dx*dx + dy*dy);

                    var insert_p1 = {'x': null, 'y': null};
                    var insert_p2 = {'x': null, 'y': null};

                    var offset = 10;

                    insert_p1.x = (x1+x2)/2.0 + offset*v1;
                    insert_p1.y = (y1+y2)/2.0 + offset*v2;

                    insert_p2.x = (x1+x2)/2.0 - offset*v1;
                    insert_p2.y = (y1+y2)/2.0 - offset*v2;

                    new_path_coord.push(insert_p1);
                    new_path_coord.push(path_coord[i]);
                    new_path_coord.push(insert_p2);
                } else if (_distance(path_coord[i-1], path_coord[i+1]) < pathprops.nearNodesDistance){
                    // insert node when the previous and next nodes are very close
                    // first node
                    var x1 = path_coord[i-1].x, y1 = path_coord[i-1].y;
                    var x2 = path_coord[i].x, y2 = path_coord[i].y;
                    var dx = x1 - x2, dy = y1 - y2;

                    var v1 = dy / Math.sqrt(dx*dx + dy*dy);
                    var v2 = - dx / Math.sqrt(dx*dx + dy*dy);

                    var insert_p1 = {'x': null, 'y': null};

                    var offset = 10;

                    insert_p1.x = (x1+x2)/2.0 + offset*v1;
                    insert_p1.y = (y1+y2)/2.0 + offset*v2;

                    // second node
                    x1 = path_coord[i].x;
                    y1 = path_coord[i].y;
                    x2 = path_coord[i+1].x;
                    y2 = path_coord[i+1].y;
                    dx = x1 - x2;
                    dy = y1 - y2;

                    v1 = dy / Math.sqrt(dx*dx + dy*dy);
                    v2 = - dx / Math.sqrt(dx*dx + dy*dy);

                    var insert_p2 = {'x': null, 'y': null};

                    insert_p2.x = (x1+x2)/2.0 + offset*v1;
                    insert_p2.y = (y1+y2)/2.0 + offset*v2;

                    new_path_coord.push(insert_p1);
                    new_path_coord.push(path_coord[i]);
                    new_path_coord.push(insert_p2);

                }
                else {
                    new_path_coord.push(path_coord[i]);
                }
            } else {
                new_path_coord.push(path_coord[i]);
            }
        }
        return new_path_coord;
    }

    // convert original path data into <d>
    function genPath(path, lineTension, avoidSharpTurn, angleThreshold) {
      var c = lineTension || 0;
      avoidSharpTurn = avoidSharpTurn !== false;
      angleThreshold = angleThreshold || 0.02;

      // helper functions
      var vecDot = function(v0, v1) { return v0.x*v1.x+v0.y*v1.y; };
      var vecMag = function(v) { return Math.sqrt(v.x*v.x + v.y*v.y); };

      // get coordinates
      var path_coord = getNodePositions(path);
      if(path_coord.length < 2) return "";

      // repeat first and last node
      var points = [path_coord[0]];
      points = points.concat(path_coord);
      points.push(path_coord[path_coord.length-1]);

      // a segment is a list of three points: [c0, c1, p1],
      // representing the coordinates in "C x0,y0,x1,y1,x,y" in svg:path
      var segments = []; // control points
      for(var i = 1; i < points.length-2; i ++) {
        // generate svg:path
        var m_0_x = (1-c)*(points[i+1].x - points[i-1].x)/2;
        var m_0_y = (1-c)*(points[i+1].y - points[i-1].y)/2;

        var m_1_x = (1-c)*(points[i+2].x - points[i].x)/2;
        var m_1_y = (1-c)*(points[i+2].y - points[i].y)/2;

        var p0 = points[i];
        var p1 = points[i+1];
        var c0 = p0;
        if(i !== 1) {
          c0 = {x: p0.x+(m_0_x/3), y:p0.y+(m_0_y/3)};
        }
        var c1 = p1;
        if(i !== points.length-3) {
          c1 = {x: p1.x-(m_1_x/3), y:p1.y-(m_1_y/3)};
        }

        // detect special case by calculating the angle
        if(avoidSharpTurn) {
          var v0 = {x:points[i-1].x - points[i].x, y:points[i-1].y - points[i].y};
          var v1 = {x:points[i+1].x - points[i].x, y:points[i+1].y - points[i].y};
          var angle = Math.acos( vecDot(v0,v1) / (vecMag(v0)*vecMag(v1)) );

          if(angle <= angleThreshold ){
            var m_x = (1-c)*(points[i].x - points[i-1].x)/2;
            var m_y = (1-c)*(points[i].y - points[i-1].y)/2;
            c0 = {x: p0.x+(-m_y/3), y:p0.y+(m_x/3)};
            segments[segments.length-1][1] = {x: p0.x-(-m_y/3), y:p0.y-(m_x/3)};
          }
        }

        segments.push([c0,c1,p1]);
      }

      var path_d = "M"+points[0].x+","+points[0].y;
      for(var i = 0; i < segments.length; i ++) {
        var s = segments[i];
        path_d += "C"+s[0].x+","+s[0].y;
        path_d += ","+s[1].x+","+s[1].y;
        path_d += ","+s[2].x+","+s[2].y;
      }
      return path_d;
    }

    // draw the spline for paths
    function drawSpline(paths, pathprops) {
        if(paths === null) {
            _savedPositions = _behavior.parent().layoutEngine().savePositions();
            return;
        }

        // edge spline
        var edge = _layer.selectAll(".spline-edge").data(paths);
        var edgeEnter = edge.enter().append("svg:path")
            .attr('class', 'spline-edge')
            .attr('id', function(d, i) { return "spline-path-"+i; })
            .attr('d', function(d) { return genPath(d, pathprops.lineTension); })
            .attr('stroke', pathprops.edgeStroke || 'black')
            .attr('stroke-width', pathprops.edgeStrokeWidth || 1)
            .attr('opacity', pathprops.edgeOpacity || 1)
            .attr('fill', 'none');

        // another wider copy of the edge just for hover events
        var edgeHover = _layer.selectAll('.spline-edge-hover')
            .data(paths);
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'spline-edge-hover')
            .attr('d', function(d) { return genPath(d); })
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', (pathprops.edgeStrokeWidth || 1) + 4)
            .attr('fill', 'none')
            .on('mouseover', function(d, i) {
                highlight_paths_group.hover_changed([paths[i]]);
             })
            .on('mouseout', function(d, i) {
                highlight_paths_group.hover_changed(null);
             })
            .on('click', function(d, i) {
                highlight_paths_group.select_changed([paths[i]]);
             });
    };

    function draw_hovered(hoversplines) {
        if(hoversplines === null) {
            d3.selectAll('.spline-edge')
                .attr('stroke', pathprops.edgeStroke || 'black')
                .attr('opacity', pathprops.edgeOpacity || 1);
        } else {
            for(var i = 0; i < hoversplines.length; i ++) {
                var path_id = _paths.indexOf(hoversplines[i]);
                var sel_path = d3.select("#spline-path-"+path_id)
                    .attr('stroke', hoverprops.edgeStroke || pathprops.edgeStroke || 'black')
                    .attr('opacity', hoverprops.edgeOpacity || pathprops.edgeOpacity || 1);
                sel_path.each(function() {this.parentNode.appendChild(this);});
            }
            // bring all hovers to front
            _layer.selectAll('.spline-edge-hover')
                .each(function() {this.parentNode.appendChild(this);});
        }
    }

    function add_behavior(diagram, node, edge, ehover) {
        // create the layer if it's null
        if(_layer === null) {
            _layer = _behavior.parent().select('g.draw').selectAll('g.spline-layer').data([0]);
            _layer.enter().append('g').attr('class', 'spline-layer');
        }

        drawSpline(_paths, pathprops);

    }

    function remove_behavior(diagram, node, edge, ehover) {
    }

    highlight_paths_group
        .on('hover_changed.draw-spline-paths', function(hpaths) {
            draw_hovered(hpaths);
        });

    var _behavior = dc_graph.behavior('draw-spline-paths', {
        laterDraw: true,
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge, ehover) {
            remove_behavior(diagram, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            if(p)
                _anchor = p.anchorName();
            highlight_paths_group.on('paths_changed.spline-' + _anchor, p ? paths_changed : null);
        }
    });

    return _behavior;
};

dc_graph.expand_collapse = function(get_degree, expand, collapse, dirs) {
    dirs = dirs || ['both'];
    if(dirs.length > 2)
        throw new Error('there are only two directions to expand in');

    function add_gradient_def(diagram) {
        var gradient = diagram.addOrRemoveDef('spike-gradient', true, 'linearGradient');
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

    function view_degree(diagram, edge, dir, key) {
        var fil;
        switch(dir) {
        case 'out':
            fil = function(e) {
                return diagram.edgeSource.eval(e) === key;
            };
            break;
        case 'in':
            fil = function(e) {
                return diagram.edgeTarget.eval(e) === key;
            };
            break;
        case 'both':
            fil = function(e) {
                return diagram.edgeSource.eval(e) === key || diagram.edgeTarget.eval(e) === key;
            };
            break;
        }
        return edge.filter(fil).size();
    }

    function spike_directioner(rankdir, dir, N) {
        if(dir==='both')
            return function(i) {
                return Math.PI * (2 * i / N - 0.5);
            };
        else {
            var sweep = (N-1)*Math.PI/N, ofs;
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
                return ofs + sweep * (-.5 + (N > 1 ? i / (N-1) : 0)); // avoid 0/0
            };
        }
    }

    function draw_selected(diagram, node, edge) {
        var spike = node
            .selectAll('g.spikes')
            .data(function(n) {
                return (n.dcg_expand_selected &&
                        (!n.dcg_expanded || !n.dcg_expanded[n.dcg_expand_selected.dir])) ?
                    [n] : [];
            });
        spike.exit().remove();
        spike
          .enter().insert('g', ':first-child')
            .classed('spikes', true);
        var rect = spike
          .selectAll('rect.spike')
            .data(function(n) {
                var key = diagram.nodeKey.eval(n);
                var dir = n.dcg_expand_selected.dir,
                    N = n.dcg_expand_selected.n,
                    af = spike_directioner(diagram.layoutEngine().rankdir(), dir, N),
                    ret = Array(N);
                for(var i = 0; i<N; ++i) {
                    var a = af(i);
                    ret[i] = {
                        a: a * 180 / Math.PI,
                        x: Math.cos(a) * n.dcg_rx*.9,
                        y: Math.sin(a) * n.dcg_ry*.9
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

    function clear_selected(diagram, node, edge) {
        node.each(function(n) {
            n.dcg_expand_selected = null;
        });
        draw_selected(diagram, node, edge);
    }

    function collapsible(diagram, edge, key, dir) {
        return view_degree(diagram, edge, dir, key) === 1;
    }

    function zonedir(diagram, event, dirs, n) {
        if(dirs.length === 1) // we assume it's ['out', 'in']
            return dirs[0];
        var bound = diagram.root().node().getBoundingClientRect();
        var invert = diagram.invertCoord([event.clientX - bound.left,event.clientY - bound.top]),
            x = invert[0],
            y = invert[1];
        switch(diagram.layoutEngine().rankdir()) {
        case 'TB':
            return y > n.cola.y ? 'out' : 'in';
        case 'BT':
            return y < n.cola.y ? 'out' : 'in';
        case 'LR':
            return x > n.cola.x ? 'out' : 'in';
        case 'RL':
            return x < n.cola.x ? 'out' : 'in';
        }
        throw new Error('unknown rankdir ' + diagram.layoutEngine().rankdir());
    }


    function add_behavior(diagram, node, edge) {
        function mousemove(n) {
            var dir = zonedir(diagram, d3.event, dirs, n);
            var nk = diagram.nodeKey.eval(n);
            Promise.resolve(get_degree(nk, dir)).then(function(degree) {
                var spikes = {
                    dir: dir,
                    n: Math.max(0, degree - view_degree(diagram, edge, dir, nk)) // be tolerant of inconsistencies
                };
                node.each(function(n2) {
                    n2.dcg_expand_selected = n2 === n ? spikes : null;
                });
                draw_selected(diagram, node, edge);
            });
        }

        function click(n) {
            var event = d3.event;
            console.log(event.type);
            function action() {
                var dir = zonedir(diagram, event, dirs, n);
                n.dcg_expanded = n.dcg_expanded || {};
                if(!n.dcg_expanded[dir]) {
                    expand(diagram.nodeKey.eval(n), dir, event.type === 'dblclick');
                    n.dcg_expanded[dir] = true;
                }
                else {
                    collapse(diagram.nodeKey.eval(n), collapsible.bind(null, diagram, edge, dir), dir);
                    n.dcg_expanded[dir] = false;
                }
                draw_selected(diagram, node, edge);
                n.dcg_dblclk_timeout = null;
            }
            return action();
            // distinguish click and double click - kind of fishy but seems to work
            // basically, wait to see if a click becomes a dblclick - but it's even worse
            // because you'll receive a second click before the dblclick on most browsers
            if(n.dcg_dblclk_timeout) {
                window.clearTimeout(n.dcg_dblclk_timeout);
                if(event.type === 'dblclick')
                    action();
                n.dcg_dblclk_timeout = null;
            }
            else n.dcg_dblclk_timeout = window.setTimeout(action, 200);
        }

        node
            .on('mouseover.expand-collapse', mousemove)
            .on('mousemove.expand-collapse', mousemove)
            .on('mouseout.expand-collapse', function(n) {
                clear_selected(diagram, node, edge);
            })
            .on('click', click)
            .on('dblclick', click);
    }

    function remove_behavior(diagram, node, edge) {
        node
            .on('mouseover.expand-collapse', null)
            .on('mouseout.expand-collapse', null);
        clear_selected(diagram, node);
    }

    return dc_graph.behavior('expand-collapse', {
        add_behavior: add_behavior,
        first: add_gradient_def,
        remove_behavior: remove_behavior
    });
};

dc_graph.draw_graphs = function(options) {
    var select_nodes_group =  dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes'),
        select_edges_group = dc_graph.select_things_group(options.select_edges_group || 'select-edges-group', 'select-edges'),
        label_nodes_group = dc_graph.label_things_group('label-nodes-group', 'label-nodes'),
        label_edges_group = dc_graph.label_things_group('label-edges-group', 'label-edges'),
        fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _nodeIdTag = options.idTag || 'id',
        _edgeIdTag = options.edgeIdTag || _nodeIdTag,
        _sourceTag = options.sourceTag || 'source',
        _targetTag = options.targetTag || 'target',
        _nodeLabelTag = options.labelTag || 'label',
        _edgeLabelTag = options.edgeLabelTag || _nodeLabelTag;

    var _sourceDown = null, _targetMove = null, _edgeLayer = null, _hintData = [];

    function update_hint() {
        var data = _hintData.filter(function(h) {
            return h.source && h.target;
        });
        var line = _edgeLayer.selectAll('line.hint-edge').data(data);
        line.exit().remove();
        line.enter().append('line')
            .attr('class', 'hint-edge')
            .style({
                fill: 'none',
                stroke: 'black',
                'pointer-events': 'none'
            });

        line.attr({
            x1: function(n) { return n.source.x; },
            y1: function(n) { return n.source.y; },
            x2: function(n) { return n.target.x; },
            y2: function(n) { return n.target.y; }
        });
    }

    function erase_hint() {
        _hintData = [];
        _sourceDown = _targetMove = null;
        update_hint();
    }

    function create_node(diagram, pos, data) {
        if(!_behavior.nodeCrossfilter())
            throw new Error('need nodeCrossfilter');
        var node, callback = _behavior.addNode() || promise_identity;
        if(data)
            node = data;
        else {
            node = {};
            node[_nodeIdTag] = uuid();
            node[_nodeLabelTag] = '';
        }
        if(pos)
            fix_nodes_group.new_node(node[_nodeIdTag], node, {x: pos[0], y: pos[1]});
        callback(node).then(function(node2) {
            if(!node2)
                return;
            _behavior.nodeCrossfilter().add([node2]);
            diagram.redrawGroup();
            select_nodes_group.set_changed([node2[_nodeIdTag]]);
        });
    }

    function create_edge(diagram, source, target) {
        if(!_behavior.edgeCrossfilter())
            throw new Error('need edgeCrossfilter');
        var edge = {}, callback = _behavior.addEdge() || promise_identity;
        edge[_edgeIdTag] = uuid();
        edge[_edgeLabelTag] = '';
        if(_behavior.conduct().detectReversedEdge && _behavior.conduct().detectReversedEdge(edge, source.port, target.port)) {
            edge[_sourceTag] = target.node.orig.key;
            edge[_targetTag] = source.node.orig.key;
            var t;
            t = source; source = target; target = t;
        } else {
            edge[_sourceTag] = source.node.orig.key;
            edge[_targetTag] = target.node.orig.key;
        }
        callback(edge, source.port, target.port).then(function(edge2) {
            if(!edge2)
                return;
            fix_nodes_group.new_edge(edge[_edgeIdTag], edge2[_sourceTag], edge2[_targetTag]);
            _behavior.edgeCrossfilter().add([edge2]);
            select_nodes_group.set_changed([], false);
            select_edges_group.set_changed([edge2[_edgeIdTag]], false);
            diagram.redrawGroup();
        });
    }

    function add_behavior(diagram, node, edge, ehover) {
        var select_nodes = diagram.child('select-nodes');
        if(select_nodes) {
            if(_behavior.clickCreatesNodes())
                select_nodes.clickBackgroundClears(false);
        }
        node
            .on('mousedown.draw-graphs', function(n) {
                d3.event.stopPropagation();
                if(!_behavior.dragCreatesEdges())
                    return;
                if(_behavior.usePorts()) {
                    var activePort;
                    if(typeof _behavior.usePorts() === 'object' && _behavior.usePorts().eventPort)
                        activePort = _behavior.usePorts().eventPort();
                    else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'out')
                        || diagram.getPort(diagram.nodeKey.eval(n), null, 'in');
                    if(!activePort)
                        return;
                    _sourceDown = {node: n, port: activePort};
                    _hintData = [{source: {x: n.cola.x + activePort.pos.x, y: n.cola.y + activePort.pos.y}}];
                } else {
                    _sourceDown = {node: n};
                    _hintData = [{source: {x: _sourceDown.node.cola.x, y: _sourceDown.node.cola.y}}];
                }
                if(_behavior.conduct().startDragEdge) {
                    if(!_behavior.conduct().startDragEdge(_sourceDown))
                        erase_hint();
                }
            })
            .on('mousemove.draw-graphs', function(n) {
                d3.event.stopPropagation();
                if(_sourceDown) {
                    var oldTarget = _targetMove;
                    if(n === _sourceDown.node) {
                        _targetMove = null;
                        _hintData[0].target = null;
                    }
                    else if(_behavior.usePorts()) {
                        var activePort;
                        if(typeof _behavior.usePorts() === 'object' && _behavior.usePorts().eventPort)
                            activePort = _behavior.usePorts().eventPort();
                        else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'in')
                            || diagram.getPort(diagram.nodeKey.eval(n), null, 'out');
                        if(activePort)
                            _targetMove = {node: n, port: activePort};
                        else
                            _targetMove = null;
                    } else if(!_targetMove || n !== _targetMove.node) {
                        _targetMove = {node: n};
                    }
                    if(_behavior.conduct().changeDragTarget) {
                        var change;
                        if(_behavior.usePorts()) {
                            var oldPort = oldTarget && oldTarget.port,
                                newPort = _targetMove && _targetMove.port;
                            change = oldPort !== newPort;
                        } else {
                            var oldNode = oldTarget && oldTarget.node,
                                newNode = _targetMove && _targetMove.node;
                             change = oldNode !== newNode;
                        }
                        if(change && !_behavior.conduct().changeDragTarget(_sourceDown, _targetMove))
                            _targetMove = null;
                    }
                    if(_targetMove) {
                        if(_targetMove.port)
                            _hintData[0].target = {x: n.cola.x + activePort.pos.x, y: n.cola.y + activePort.pos.y};
                        else
                            _hintData[0].target = {x: n.cola.x, y: n.cola.y};
                    }
                    else {
                        var coords = dc_graph.event_coords(diagram);
                        _hintData[0].target = {x: coords[0], y: coords[1]};
                    }
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function(n) {
                // allow keyboard mode to hear this one (again, we need better cooperation)
                // d3.event.stopPropagation();
                if(_sourceDown && _targetMove) {
                    var finishPromise;
                    if(_behavior.conduct().finishDragEdge)
                        finishPromise = _behavior.conduct().finishDragEdge(_sourceDown, _targetMove);
                    else finishPromise = Promise.resolve(true);
                    var source = _sourceDown, target = _targetMove;
                    finishPromise.then(function(ok) {
                        if(ok)
                            create_edge(diagram, source, target);
                    });
                }
                else if(_sourceDown) {
                    if(_behavior.conduct().cancelDragEdge)
                        _behavior.conduct().cancelDragEdge(_sourceDown);
                }
                erase_hint();
            });
        diagram.svg()
            .on('mousedown.draw-graphs', function() {
                _sourceDown = null;
            })
            .on('mousemove.draw-graphs', function() {
                var data = [];
                if(_sourceDown) { // drawing edge
                    var coords = dc_graph.event_coords(diagram);
                    if(_behavior.conduct().dragCanvas)
                        _behavior.conduct().dragCanvas(_sourceDown, coords);
                    if(_behavior.conduct().changeDragTarget && _targetMove)
                        _behavior.conduct().changeDragTarget(_sourceDown, null);
                    _targetMove = null;
                    _hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function() {
                if(_sourceDown) { // drag-edge
                    if(_behavior.conduct().cancelDragEdge)
                        _behavior.conduct().cancelDragEdge(_sourceDown);
                    erase_hint();
                } else { // click-node
                    if(d3.event.target === this && _behavior.clickCreatesNodes())
                        create_node(diagram, dc_graph.event_coords(diagram));
                }
            });
        if(!_edgeLayer)
            _edgeLayer = diagram.g().append('g').attr('class', 'draw-graphs');
    }

    function remove_behavior(diagram, node, edge, ehover) {
        node
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
        diagram.svg()
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });

    // update the data source/destination
    _behavior.nodeCrossfilter = property(options.nodeCrossfilter);
    _behavior.edgeCrossfilter = property(options.edgeCrossfilter);

    // behavioral options
    _behavior.usePorts = property(null);
    _behavior.clickCreatesNodes = property(true);
    _behavior.dragCreatesEdges = property(true);

    // really this is a behavior, and what we've been calling behaviors are modes
    // but i'm on a deadline
    _behavior.conduct = property({});

    // callbacks to modify data as it's being added
    // as of 0.6, function returns a promise of the new data
    _behavior.addNode = property(null); // node -> promise(node2)
    _behavior.addEdge = property(null); // edge, sourceport, targetport -> promise(edge2)

    // or, if you want to drive..
    _behavior.createNode = function(pos, data) {
        create_node(_behavior.parent(), pos, data);
    };

    return _behavior;
};


dc_graph.match_ports = function(diagram, symbolPorts) {
    var _ports, _wports, _wedges, _validTargets;
    diagram.on('data.match-ports', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _ports = ports;
        _wports = wports;
        _wedges = wedges;
    });
    function change_state(ports, state) {
        return ports.map(function(p) {
            p.state = state;
            return diagram.portNodeKey.eval(p);
        });
    }
    function reset_ports(source) {
        var nids = change_state(_validTargets, 'small');
        source.port.state = 'small';
        nids.push(diagram.portNodeKey.eval(source.port));
        symbolPorts.animateNodes(nids);
    }
    function is_valid(sourcePort, targetPort) {
        return (_behavior.allowParallel() || !_wedges.some(function(e) {
            return sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0;
        })) && _behavior.isValid()(sourcePort, targetPort);
    }
    var _behavior = {
        isValid: property(function(sourcePort, targetPort) {
            return targetPort !== sourcePort && targetPort.name === sourcePort.name;
        }),
        allowParallel: property(false),
        hoverPort: function(port) {
            if(port) {
                _validTargets = _wports.filter(is_valid.bind(null, port));
                if(_validTargets.length)
                    return change_state(_validTargets, 'shimmer-medium');
            } else if(_validTargets)
                return change_state(_validTargets, 'small');
            return null;
        },
        startDragEdge: function(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            var nids = change_state(_validTargets, 'shimmer');
            if(_validTargets.length) {
                symbolPorts.enableHover(false);
                source.port.state = 'large';
                nids.push(diagram.portNodeKey.eval(source.port));
                symbolPorts.animateNodes(nids);
            }
            console.log('valid targets', nids);
            return _validTargets.length !== 0;
        },
        changeDragTarget: function(source, target) {
            var nids, valid = target && is_valid(source.port, target.port), before;
            if(valid) {
                nids = change_state(_validTargets, 'small');
                target.port.state = 'large'; // it's one of the valid
            }
            else {
                nids = change_state(_validTargets, 'small');
                before = symbolPorts.animateNodes(nids);
                nids = change_state(_validTargets, 'shimmer');
            }
            symbolPorts.animateNodes(nids, before);
            return valid;
        },
        finishDragEdge: function(source, target) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return Promise.resolve(is_valid(source.port, target.port));
        },
        cancelDragEdge: function(source) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return true;
        }
    };
    return _behavior;
};

dc_graph.match_opposites = function(diagram, deleteProps, options) {
    options = Object.assign({
        multiplier: 2,
        ease: d3.ease('cubic')
    }, options);
    var _ports, _wports, _wedges, _validTargets;

    diagram.cascade(100, true, multiply_properties(function(e) {
        return options.ease(e.deleting || 0);
    }, deleteProps, property_interpolate));
    diagram.on('data.match-opposites', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _ports = ports;
        _wports = wports;
        _wedges = wedges;
    });
    function port_pos(p) {
        return { x: p.node.cola.x + p.pos.x, y: p.node.cola.y + p.pos.y };
    }
    function is_valid(sourcePort, targetPort) {
        return (_behavior.allowParallel() || !_wedges.some(function(e) {
            return sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0;
        })) && _behavior.isValid()(sourcePort, targetPort);
    }
    function reset_deletables(source, targets) {
        targets.forEach(function(p) {
            p.edges.forEach(function(e) {
                e.deleting = 0;
            });
        });
        if(source)
            source.port.edges.forEach(function(e) {
                e.deleting = 0;
            });
    }
    var _behavior = {
        isValid: property(function(sourcePort, targetPort) {
            // draw_graphs is already enforcing this, but this makes more sense and i use xor any chance i get
            return (diagram.portName.eval(sourcePort) === 'in') ^ (diagram.portName.eval(targetPort) === 'in');
        }),
        allowParallel: property(false),
        hoverPort: function(port) {
            // could be called by draw_graphs when node is hovered, isn't
        },
        startDragEdge: function(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            console.log('valid targets', _validTargets.map(diagram.portNodeKey.eval));
            return _validTargets.length !== 0;
        },
        dragCanvas: function(source, coords) {
            var closest = _validTargets.map(function(p) {
                var ppos = port_pos(p);
                return {
                    distance: Math.hypot(coords[0] - ppos.x, coords[1] - ppos.y),
                    port: p
                };
            }).sort(function(a, b) {
                return a.distance - b.distance;
            });
            var cpos = port_pos(closest[0].port), spos = port_pos(source.port);
            closest.forEach(function(c) {
                c.port.edges.forEach(function(e) {
                    e.deleting = 1 - options.multiplier * c.distance / Math.hypot(cpos.x - spos.x, cpos.y - spos.y);
                });
            });
            source.port.edges.forEach(function(e) {
                e.deleting = 1 - options.multiplier * closest[0].distance / Math.hypot(cpos.x - spos.x, cpos.y - spos.y);
            });
            diagram.refresh();
        },
        changeDragTarget: function(source, target) {
            var valid = target && is_valid(source.port, target.port);
            if(valid) {
                target.port.edges.forEach(function(e) {
                    e.deleting = 1;
                });
                source.port.edges.forEach(function(e) {
                    e.deleting = 1;
                });
                reset_deletables(null, _validTargets.filter(function(p) {
                    return p !== target.port;
                }));
                diagram.refresh();
            }
            return valid;
        },
        finishDragEdge: function(source, target) {
            if(is_valid(source.port, target.port)) {
                reset_deletables(null, _validTargets.filter(function(p) {
                    return p !== target.port;
                }));
                if(options.delete_edges) {
                    var edgeKeys = source.port.edges.map(diagram.edgeKey.eval).concat(target.port.edges.map(diagram.edgeKey.eval));
                    return options.delete_edges.deleteSelection(edgeKeys);
                }
                return Promise.resolve(true);
            }
            reset_deletables(source, _validTargets);
            return Promise.resolve(false);
        },
        cancelDragEdge: function(source) {
            reset_deletables(source, _validTargets);
            return true;
        },
        detectReversedEdge: function(edge, sourcePort, targetPort) {
            return diagram.portName.eval(sourcePort) === 'in';
        }
    };
    return _behavior;
};

dc_graph.wildcard_ports = function(options) {
    var diagram = options.diagram,
        get_type = options.get_type || function(p) { return p.orig.value.type; },
        set_type = options.set_type || function(p, src) { p.orig.value.type = src.orig.value.type; },
        get_name = options.get_name || function(p) { return p.orig.value.name; },
        is_wild = options.is_wild || function(p) { return p.orig.value.wild; },
        update_ports = options.update_ports || function() {},
        get_linked = options.get_linked || function() { return []; };
    function linked_ports(n, port) {
        if(!diagram)
            return [];
        var nid = diagram.nodeKey.eval(n);
        var name = get_name(port);
        var links = get_linked(n) || [];
        var found = links.find(function(set) {
            return set.includes(name);
        });
        if(!found) return [];
        return found.filter(function(link) { return link !== name; }).map(function(link) {
            return diagram.getPort(nid, null, link);
        });
    }
    function no_edges(ports) {
        return ports.every(function(lp) {
            return lp.edges.length === 0;
        });
    }
    return {
        isValid: function(p1, p2) {
            return get_type(p1) === null ^ get_type(p2) === null ||
                get_type(p1) !== null && get_type(p1) === get_type(p2);
        },
        copyLinked: function(n, port) {
            linked_ports(n, port).forEach(function(lp) {
                set_type(lp, port);
            });
        },
        copyType: function(e, sport, tport) {
            if(get_type(sport) === null) {
                set_type(sport, tport);
                this.copyLinked(sport.node, sport);
                update_ports();
            } else if(get_type(tport) === null) {
                set_type(tport, sport);
                this.copyLinked(tport.node, tport);
                update_ports();
            }
            return Promise.resolve(e);
        },
        resetTypes: function(edges)  {
            // backward compatibility: this used to take diagram as
            // first arg, which was wrong
            var dia = diagram;
            if(arguments.length === 2) {
                dia = arguments[0];
                edges = arguments[1];
            }
            edges.forEach(function(eid) {
                var e = dia.getWholeEdge(eid),
                    spname = dia.edgeSourcePortName.eval(e),
                    tpname = dia.edgeTargetPortName.eval(e);
                var update = false;
                var p = dia.getPort(dia.nodeKey.eval(e.source), null, spname);
                var linked = linked_ports(e.source, p);
                if(is_wild(p) && p.edges.length === 1 && no_edges(linked)) {
                    set_type(p, null);
                    linked.forEach(function(lp) {
                        set_type(lp, null);
                        update = true;
                    });
                }
                p = dia.getPort(dia.nodeKey.eval(e.target), null, tpname);
                linked = linked_ports(e.target, p);
                if(is_wild(p) && p.edges.length === 1 && no_edges(linked)) {
                    set_type(p, null);
                    linked.forEach(function(lp) {
                        set_type(lp, null);
                        update = true;
                    });
                }
                if(update)
                    update_ports();
            });
            return Promise.resolve(edges);
        }
    };
};

dc_graph.symbol_port_style = function() {
    var _style = {};
    var _nodePorts, _node;
    var _drawConduct;

    _style.symbolScale = property(null);
    _style.colorScale = property(d3.scale.ordinal().range(
         // colorbrewer light qualitative scale
        d3.shuffle(['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
                    '#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'])));

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.symbol = _style.portSymbol = property(name_or_edge, false); // non standard properties taking "outer datum"
    _style.color = _style.portColor = property(name_or_edge, false);
    _style.outline = property(dc_graph.symbol_port_style.outline.circle());
    _style.content = property(dc_graph.symbol_port_style.content.d3symbol());
    _style.smallRadius = _style.portRadius = property(7);
    _style.mediumRadius = _style.portHoverNodeRadius = property(10);
    _style.largeRadius = _style.portHoverPortRadius = property(14);
    _style.displacement = _style.portDisplacement = property(2);
    _style.outlineFillScale = _style.portBackgroundScale = property(null);
    _style.outlineFill = _style.portBackgroundFill = property(null);
    _style.outlineStroke = _style.portBackgroundStroke = property(null);
    _style.outlineStrokeWidth = _style.portBackgroundStrokeWidth = property(null);
    _style.padding = _style.portPadding = property(2);
    _style.label = _style.portLabel = _style.portText = property(function(p) {
        return p.name;
    });
    _style.portLabelPadding = property({x: 5, y: 5});
    _style.cascade = cascade(_style);

    function symbol_fill(p) {
        var symcolor = _style.color.eval(p);
        return symcolor ?
            (_style.colorScale() ? _style.colorScale()(symcolor) : symcolor) :
        'none';
    }
    function port_transform(p) {
        var l = Math.hypot(p.pos.x, p.pos.y),
            u = {x: p.pos.x / l, y: p.pos.y / l},
            disp = _style.displacement.eval(p),
            pos = {x: p.pos.x + disp * u.x, y: p.pos.y + disp * u.y};
        return 'translate(' + pos.x + ',' + pos.y + ')';
    }
    function port_symbol(p) {
        if(!_style.symbolScale())
            _style.symbolScale(d3.scale.ordinal().range(d3.shuffle(_style.content().enum())));
        var symname = _style.symbol.eval(p);
        return symname && (_style.symbolScale() ? _style.symbolScale()(symname) : symname);
    }
    function is_left(p) {
        return p.vec[0] < 0;
    }
    function hover_radius(p) {
        switch(p.state) {
        case 'large':
            return _style.largeRadius.eval(p);
        case 'medium':
            return _style.mediumRadius.eval(p);
        case 'small':
        default:
            return _style.smallRadius.eval(p);
        }
    }
    function shimmer_radius(p) {
        return /-medium$/.test(p.state) ?
            _style.mediumRadius.eval(p) :
            _style.largeRadius.eval(p);
    }
    // fall back to node aesthetics if not defined for port
    function outline_fill(p) {
        var scale, fill;
        if(_style.outlineFill.eval(p)) {
            scale = _style.outlineFillScale() || identity;
            fill = _style.outlineFill.eval(p);
        }
        else {
            scale = _style.parent().nodeFillScale() || identity;
            fill = _style.parent().nodeFill.eval(p.node);
        }
        return fill === 'none' ? 'none' : scale(fill);
    }
    function outline_stroke(p) {
        return _style.outlineStroke.eval(p) || _style.parent().nodeStroke.eval(p.node);
    }
    function outline_stroke_width(p) {
        var sw = _style.outlineStrokeWidth.eval(p);
        return typeof sw === 'number' ? sw : _style.parent().nodeStrokeWidth.eval(p.node);
    }
    _style.animateNodes = function(nids, before) {
        var setn = d3.set(nids);
        var node = _node
                .filter(function(n) {
                    return setn.has(_style.parent().nodeKey.eval(n));
                });
        var symbol = _style.parent().selectNodePortsOfStyle(node, _style.parent().portStyle.nameOf(this));
        var shimmer = symbol.filter(function(p) { return /^shimmer/.test(p.state); }),
            nonshimmer = symbol.filter(function(p) { return !/^shimmer/.test(p.state); });
        if(shimmer.size()) {
            if(before)
                before.each('end', repeat);
            else repeat();
        }

        function repeat() {
            var shimin = shimmer.transition()
                    .duration(1000)
                    .ease("bounce");
            shimin.selectAll('.port-outline')
                .call(_style.outline().draw(function(p) {
                    return shimmer_radius(p) + _style.portPadding.eval(p);
                }));
            shimin.selectAll('.port-symbol')
                .call(_style.content().draw(port_symbol, shimmer_radius));
            var shimout = shimin.transition()
                    .duration(1000)
                    .ease('sin');
            shimout.selectAll('.port-outline')
                .call(_style.outline().draw(function(p) {
                    return _style.smallRadius.eval(p) + _style.portPadding.eval(p);
                }));
            shimout.selectAll('.port-symbol')
                .call(_style.content().draw(port_symbol, _style.smallRadius.eval));
            shimout.each("end", repeat);
        }

        var trans = nonshimmer.transition()
                .duration(250);
        trans.selectAll('.port-outline')
            .call(_style.outline().draw(function(p) {
                return hover_radius(p) + _style.portPadding.eval(p);
            }));
        trans.selectAll('.port-symbol')
            .call(_style.content().draw(port_symbol, hover_radius));

        function text_showing(p) {
            return p.state === 'large' || p.state === 'medium';
        }
        trans.selectAll('text.port-label')
            .attr({
                opacity: function(p) {
                    return text_showing(p) ? 1 : 0;
                },
                'pointer-events': function(p) {
                    return text_showing(p) ? 'auto' : 'none';
                }
            });
        trans.selectAll('rect.port-label-background')
            .attr('opacity', function(p) {
                return text_showing(p) ? 1 : 0;
            });
        // bring all nodes which have labels showing to the front
        _node.filter(function(n) {
            var ports = _nodePorts[_style.parent().nodeKey.eval(n)];
            return ports && ports.some(text_showing);
        }).each(function() {
            this.parentNode.appendChild(this);
        });
        // bring all active ports to the front
        symbol.filter(function(p) {
            return p.state !== 'small';
        }).each(function() {
            this.parentNode.appendChild(this);
        });
        return trans;
    };
    _style.eventPort = function() {
        var parent = d3.select(d3.event.target.parentNode);
        if(d3.event.target.parentNode.tagName === 'g' && parent.classed('port'))
            return parent.datum();
        return null;
    };
    _style.drawPorts = function(ports, nodePorts, node) {
        _nodePorts = nodePorts; _node = node;
        var port = ports.data(function(n) {
            return nodePorts[_style.parent().nodeKey.eval(n)] || [];
        }, name_or_edge);
        port.exit().remove();
        var portEnter = port.enter().append('g')
            .attr({
                class: 'port',
                transform: port_transform
            });
        port.transition('port-position')
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                transform: port_transform
            });

        var outline = port.selectAll('.port-outline').data(function(p) {
            return outline_fill(p) !== 'none' ? [p] : [];
        });
        outline.exit().remove();
        var outlineEnter = outline.enter().append(_style.outline().tag())
            .attr({
                class: 'port-outline',
                fill: outline_fill,
                'stroke-width': outline_stroke_width,
                stroke: outline_stroke
            });
        if(_style.outline().init)
            outlineEnter.call(_style.outline().init);
        outlineEnter
            .call(_style.outline().draw(function(p) {
                return _style.smallRadius.eval(p) + _style.portPadding.eval(p);
            }));
        // only position and size are animated (?) - anyway these are not on the node
        // and they are typically used to indicate selection which should be fast
        outline
            .attr({
                fill: outline_fill,
                'stroke-width': outline_stroke_width,
                stroke: outline_stroke
            });
        outline.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .call(_style.outline().draw(function(p) {
                return _style.smallRadius.eval(p) + _style.portPadding.eval(p);
            }));

        var symbolEnter = portEnter.append(_style.content().tag())
            .attr('class', 'port-symbol')
            .call(_style.content().draw(port_symbol, _style.smallRadius.eval));

        var symbol = port.select('.port-symbol');
        symbol.attr('fill', symbol_fill);
        symbol.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .call(_style.content().draw(port_symbol, _style.smallRadius.eval));

        var label = port.selectAll('text.port-label').data(function(p) {
            return _style.portLabel.eval(p) ? [p] : [];
        });
        label.exit().remove();
        var labelEnter = label.enter();
        labelEnter.append('rect')
            .attr({
                class: 'port-label-background',
                'pointer-events': 'none'
            });
        labelEnter.append('text')
            .attr({
                class: 'port-label',
                'dominant-baseline': 'middle',
                'pointer-events': 'none',
                cursor: 'default',
                opacity: 0
            });
        label
            .each(function(p) {
                p.offset = (is_left(p) ? -1 : 1) * (_style.largeRadius.eval(p) + _style.portPadding.eval(p));
            })
            .attr({
                'text-anchor': function(p) {
                    return is_left(p) ? 'end' : 'start';
                },
                transform: function(p) {
                    return 'translate(' + p.offset + ',0)';
                }
            })
            .text(_style.portLabel.eval)
            .each(function(p) {
                p.bbox = getBBoxNoThrow(this);
            });
        port.selectAll('rect.port-label-background')
            .attr({
                x: function(p) {
                    return (p.offset < 0 ? p.offset - p.bbox.width : p.offset) - _style.portLabelPadding.eval(p).x;
                },
                y: function(p) {
                    return -p.bbox.height/2 - _style.portLabelPadding.eval(p).y;
                },
                width: function(p) {
                    return p.bbox.width + 2*_style.portLabelPadding.eval(p).x;
                },
                height: function(p) {
                    return p.bbox.height + 2*_style.portLabelPadding.eval(p).y;
                },
                fill: 'white',
                opacity: 0
            });
        _style.enableHover(true);
        return _style;
    };

    _style.enableHover = function(whether) {
        if(!_drawConduct) {
            if(_style.parent()) {
                var draw = _style.parent().child('draw-graphs');
                if(draw)
                    _drawConduct = draw.conduct();
            }
        }
        var namespace = 'grow-ports-' + _style.parent().portStyle.nameOf(this);
        if(whether) {
            _node.on('mouseover.' + namespace, function(n) {
                var nid = _style.parent().nodeKey.eval(n);
                var activePort = _style.eventPort();
                if(_nodePorts[nid])
                    _nodePorts[nid].forEach(function(p) {
                        p.state = p === activePort ? 'large' : activePort ? 'small' : 'medium';
                    });
                var nids = _drawConduct && _drawConduct.hoverPort(activePort) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
            _node.on('mouseout.' + namespace, function(n) {
                var nid = _style.parent().nodeKey.eval(n);
                if(_nodePorts[nid])
                    _nodePorts[nid].forEach(function(p) {
                        p.state = 'small';
                    });
                var nids = _drawConduct && _drawConduct.hoverPort(null) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
        } else {
            _node.on('mouseover.' + namespace, null);
            _node.on('mouseout.' + namespace, null);
        }
        return _style;
    };

    _style.parent = property(null);
    return _style;
};

dc_graph.symbol_port_style.outline = {};
dc_graph.symbol_port_style.outline.circle = function() {
    return {
        tag: function() {
            return 'circle';
        },
        draw: function(rf) {
            return function(outlines) {
                outlines.attr('r', function(p) { return rf(p); });
            };
        }
    };
};
dc_graph.symbol_port_style.outline.square = function() {
    return {
        tag: function() {
            return 'rect';
        },
        init: function(outlines) {
            // crispEdges can make outline off-center from symbols
            // outlines.attr('shape-rendering', 'crispEdges');
        },
        draw: function(rf) {
            return function(outlines) {
                outlines.attr({
                    x: function(p) { return -rf(p); },
                    y: function(p) { return -rf(p); },
                    width: function(p) { return 2*rf(p); },
                    height: function(p) { return 2*rf(p); }
                });
            };
        }
    };
};
dc_graph.symbol_port_style.outline.arrow = function() {
    // offset needed for body in order to keep centroid at 0,0
    var left_portion = 3/4 - Math.PI/8;
    var _outline = {
        tag: function() {
            return 'path';
        },
        init: function(outlines) {
            //outlines.attr('shape-rendering', 'crispEdges');
        },
        draw: function(rf) {
            return function(outlines) {
                outlines.attr('d', function(p) {
                    var r = rf(p);
                    if(!_outline.outie() || _outline.outie()(p.orig))
                        return 'M' + -left_portion*r + ',' + -r + ' h' + r +
                        ' l' + r + ',' + r + ' l' + -r + ',' + r +
                        ' h' + -r +
                        ' a' + r + ',' + r + ' 0 1,1 0,' + -2*r;
                    else
                        return 'M' + -(2-left_portion)*r + ',' + -r + ' h' + 2*r +
                        ' a' + r + ',' + r + ' 0 1,1 0,' + 2*r +
                        ' h' + -2*r +
                        ' l' + r + ',' + -r + ' l' + -r + ',' + -r;
                });
            };
        },
        outie: property(null)
    };
    return _outline;
};

dc_graph.symbol_port_style.content = {};
dc_graph.symbol_port_style.content.d3symbol = function() {
    var _symbol = {
        tag: function() {
            return 'path';
        },
        enum: function() {
            return d3.svg.symbolTypes;
        },
        draw: function(symf, rf) {
            return function(symbols) {
                symbols.attr('d', function(p) {
                    var sym = symf(p), r = rf(p);
                    return d3.svg.symbol()
                        .type(sym)
                        .size(r*r)
                    ();
                });
                symbols.attr('transform', function(p) {
                    switch(symf(p)) {
                    case 'triangle-up':
                        return 'translate(0, -1)';
                    case 'triangle-down':
                        return 'translate(0, 1)';
                    default: return null;
                    }
                });
            };
        }
    };
    return _symbol;
};
dc_graph.symbol_port_style.content.letter = function() {
    var _symbol = {
        tag: function() {
            return 'text';
        },
        enum: function() {
            return d3.range(65, 91).map(String.fromCharCode);
        },
        draw: function(symf, rf) {
            return function(symbols) {
                symbols.text(symf)
                    .attr({
                        'dominant-baseline': 'middle',
                        'text-anchor': 'middle'
                    });
                symbols.each(function(p) {
                    if(!p.symbol_size)
                        p.symbol_size = getBBoxNoThrow(this);
                });
                symbols.attr('transform', function(p) {
                    return 'scale(' + (2*rf(p)/p.symbol_size.height) +
                        ') translate(' + [0,2].join(',') + ')';
                });
            };
        }
    };
    return _symbol;
};

function process_dot(callback, error, text) {
    if(error) {
        callback(error, null);
        return;
    }
    var nodes, edges;
    if(graphlibDot.parse) { // graphlib-dot 1.1.0 (where did i get it from?)
        var digraph = graphlibDot.parse(text);

        var nodeNames = digraph.nodes();
        nodes = new Array(nodeNames.length);
        nodeNames.forEach(function (name, i) {
            var node = nodes[i] = digraph._nodes[nodeNames[i]];
            node.id = i;
            node.name = name;
        });

        var edgeNames = digraph.edges();
        edges = [];
        edgeNames.forEach(function(e) {
            var edge = digraph._edges[e];
            edges.push({
                source: digraph._nodes[edge.u].id,
                target: digraph._nodes[edge.v].id,
                sourcename: edge.u,
                targetname: edge.v
            });
        });
    } else { // graphlib-dot 0.6
        digraph = graphlibDot.read(text);

        nodeNames = digraph.nodes();
        nodes = new Array(nodeNames.length);
        nodeNames.forEach(function (name, i) {
            var node = nodes[i] = digraph._nodes[nodeNames[i]];
            node.id = i;
            node.name = name;
        });

        edges = [];
        digraph.edges().forEach(function(e) {
            edges.push({
                source: digraph._nodes[e.v].id,
                target: digraph._nodes[e.w].id,
                sourcename: e.v,
                targetname: e.w
            });
        });
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
}

function process_dsv(callback, error, data) {
    if(error) {
        callback(error, null);
        return;
    }
    var keys = Object.keys(data[0]);
    var source = keys[0], target = keys[1];
    var nodes = d3.set(data.map(function(r) { return r[source]; }));
    data.forEach(function(r) {
        nodes.add(r[target]);
    });
    nodes = nodes.values().map(function(k) { return {name: k}; });
    callback(null, {
        nodes: nodes,
        links: data.map(function(r, i) {
            return {
                key: i,
                sourcename: r[source],
                targetname: r[target]
            };
        })
    });
}

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
        d3.text(file1, process_dot.bind(null, callback));
    else if(/\.psv$/.test(ignore_query(file1)))
        d3.dsv('|', 'text/plain')(file1, process_dsv.bind(null, callback));
    else if(/\.csv$/.test(ignore_query(file1)))
        d3.csv(file1, process_dsv.bind(null, callback));
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

/**
 * `dc_graph.flat_group` implements a special ["fake group"](https://github.com/dc-js/dc.js/wiki/FAQ#fake-groups)
 * for the special case where you want a group that represents the filtered rows of the crossfilter.
 *
 * Although `dc_graph` can be used with reduced data, typically the nodes and edges are just rows of
 * the corresponding data arrays, and each array has a column which contains the unique identifier
 * for the node or edge. In this setup, there are other dimensions and groups which are aggregated
 * for the use of dc.js charts, but the graph just shows or does not show the nodes and edges from
 * the rows.
 *
 * This simple class supports that use case in three steps:
 *  1. It creates a dimension keyed on the unique identifier (specified to `flat_group.make`)
 *  2. It creates a group from the dimension with a reduction function that returns the row when the
 *  row is filtered in, and `null` when the row is filtered out.
 *  3. It wraps the group in a fake group which filters out the resulting nulls.
 *
 * The result is a fake group whose `.all()` method returns an array of the currently filtered-in
 * `{key, value}` pairs, where the key is that returned by the ID accessor, and the value is the raw
 * row object from the data.
 *
 * This could be a useful crossfilter utility outside of dc.graph. For example, bubble charts and
 * scatter plots often use similar functionality because each observation is either shown or not,
 * and it is helpful to have the entire row available as reduced data.
 *
 * But it would need to be generalized and cleaned up. (For example, the way it has to create the
 * crossfilter and dimension is kinda dumb.) And there is currently no such crossfilter utility
 * library to put it in.
 *
 * @namespace flat_group
 * @memberof dc_graph
 * @type {{}}
**/

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
        /**
         * Create a crossfilter, dimension, and flat group, as described in {@link dc_graph.flat_group flat_group}.
         * Returns an object containing all three.

         * @method make
         * @memberof dc_graph.flat_group
         * @param {Array} vec - the data array for crossfilter
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         **/
        make: function(vec, id_accessor) {
            var ndx = crossfilter(vec);
            return dim_group(ndx, id_accessor);
        },
        /**
         * Create a flat dimension and group from an existing crossfilter.
         *
         * This is a wretched name for this function.

         * @method another
         * @memberof dc_graph.flat_group
         * @param {Object} ndx - crossfilter instance
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         **/
        another: function(ndx, id_accessor) {
            return dim_group(ndx, id_accessor);
        }
    };
})();



var convert_tree_helper = function(data, attrs, options, parent, level, inherit) {
    level = level || 0;
    if(attrs.length > (options.valuesByAttr ? 1 : 0)) {
        var attr = attrs.shift();
        var nodes = [], edges = [];
        var children = data.map(function(v) {
            var key = v[options.nestKey];
            var childKey = options.nestKeysUnique ? key : uuid();
            if(childKey) {
                var node;
                if(options.ancestorKeys) {
                    inherit = inherit || {};
                    if(attr)
                        inherit[attr] = key;
                    node = Object.assign({}, inherit);
                } else node = {};
                node[options.nodeKey] = childKey;
                if(options.label && options.labelFun)
                    node[options.label] = options.labelFun(key, attr, v);
                if(options.level)
                    node[options.level] = level+1;
                nodes.push(node);
                if(parent) {
                    var edge = {};
                    edge[options.edgeSource] = parent;
                    edge[options.edgeTarget] = childKey;
                    edges.push(edge);
                }
            }
            var children = options.valuesByAttr ? v[attrs[0]] : v.values;
            var recurse = convert_tree_helper(children, attrs.slice(0), options,
                                              childKey, level+1, Object.assign({}, inherit));
            return recurse;
        });
        return {nodes: Array.prototype.concat.apply(nodes, children.map(dc.pluck('nodes'))),
                edges: Array.prototype.concat.apply(edges, children.map(dc.pluck('edges')))};
    }
    else return {nodes: data.map(function(v) {
        v = Object.assign({}, v);
        if(options.level)
            v[options.level] = level+1;
        return v;
    }), edges: data.map(function(v) {
        var edge = {};
        edge[options.edgeSource] = parent;
        edge[options.edgeTarget] = v[options.nodeKey];
        return edge;
    })};
};

dc_graph.convert_tree = function(data, attrs, options) {
    options = Object.assign({
        nodeKey: 'key',
        edgeKey: 'key',
        edgeSource: 'sourcename',
        edgeTarget: 'targetname',
        nestKey: 'key'
    }, options);
    if(Array.isArray(data))
        return convert_tree_helper(data, attrs, options, options.root, 0, options.inherit);
    else {
        attrs = [''].concat(attrs);
        return convert_tree_helper([data], attrs, options, options.root, 0, options.inherit);
    }
};

dc_graph.convert_nest = function(nest, attrs, nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    return dc_graph.convert_tree(nest, attrs, {
        nodeKey: nodeKeyAttr,
        edgeSource: edgeSourceAttr,
        edgeTarget: edgeTargetAttr,
        root: parent,
        inherit: inherit,
        ancestorKeys: true,
        label: 'name',
        labelFun: function(key, attr, v) { return attr + ':' + key; },
        level: '_level'
    });
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


// collapse edges between same source and target
dc_graph.deparallelize = function(group, sourceTag, targetTag) {
    return {
        all: function() {
            var ST = {};
            group.all().forEach(function(kv) {
                var source = kv.value[sourceTag],
                    target = kv.value[targetTag];
                var dir = source < target;
                var min = dir ? source : target, max = dir ? target : source;
                ST[min] = ST[min] || {};
                var entry = ST[min][max] = ST[min][max] || {in: 0, out: 0, original: kv};
                if(dir)
                    ++entry.in;
                else
                    ++entry.out;
            });
            var ret = [];
            Object.keys(ST).forEach(function(source) {
                Object.keys(ST[source]).forEach(function(target) {
                    var entry = ST[source][target];
                    entry[sourceTag] = source;
                    entry[targetTag] = target;
                    ret.push({key: entry.original.key, value: entry});
                });
            });
            return ret;
        }
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
        p2.text(function(p, i) {
            return 'path ' + (i+1) + ' (' + reader.elementList.eval(p).length + ')';
        })
            .on('mouseover', function(p) {
                highlight_paths_group.hover_changed([p]);
            })
            .on('mouseout', function(p) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click', function(p) {
                highlight_paths_group.select_changed(toggle_paths(selected, [p]));
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
                'border-color': function(p, i) { return is_hovered(p) ? '#e41a1c' : 'grey'; },
                'border-width': function(p, i) { return (is_hovered(p) ? 2 : 1) + 'px'; },
                padding: function(p, i) { return (is_hovered(p) ? 3 : 4) + 'px'; }
            });
    }

    function draw_selected() {
        var is_selected = contains_path(selected);
        root.selectAll('span.path-selector')
            .style({
                'background-color': function(p, i) { return is_selected(p) ? '#1c1ae6' : 'white'; },
                'color': function(p, i) { return is_selected(p) ? 'white' : 'black'; }
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
            for(j = 0; j < N; ++j) {
                var a = j, b = (j+1)%N, t;
                if(i%2 === 1) {
                    t = a;
                    a = b;
                    b = t;
                }
                edges.push(dc_graph.edge_object(namef, a, b, {distance: rimLength, par: i+2}));
            }
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

dc_graph.random_graph = function(options) {
    options = Object.assign({
        ncolors: 5,
        ndashes: 4,
        nodeKey: 'key',
        edgeKey: 'key',
        sourceKey: 'sourcename',
        targetKey: 'targetname',
        colorTag: 'color',
        dashTag: 'dash',
        nodeKeyGen: function(i) { return 'n' + i; },
        edgeKeyGen: function(i) { return 'e' + i; },
        newComponentProb: 0.1,
        newNodeProb: 0.9,
        removeEdgeProb: 0.75,
        log: false
    }, options);
    if(isNaN(options.newNodeProb))
        options.newNodeProb = 0.9;
    if(options.newNodProb <= 0)
        options.newNodeProb = 0.1;
    var _nodes = [], _edges = [];
    function new_node() {
        var n = {};
        n[options.nodeKey] = options.nodeKeyGen(_nodes.length);
        n[options.colorTag] = Math.floor(Math.random()*options.ncolors);
        _nodes.push(n);
        return n;
    }
    function random_node() {
        return _nodes[Math.floor(Math.random()*_nodes.length)];
    }
    return {
        nodes: function() {
            return _nodes;
        },
        edges: function() {
            return _edges;
        },
        generate: function(N) {
            while(N-- > 0) {
                var choice = Math.random();
                var n1, n2;
                if(!_nodes.length || choice < options.newComponentProb)
                    n1 = new_node();
                else
                    n1 = random_node();
                if(choice < options.newNodeProb)
                    n2 = new_node();
                else
                    n2 = random_node();
                if(n1 && n2) {
                    var edge = {};
                    edge[options.edgeKey] = options.edgeKeyGen(_edges.length);
                    edge[options.sourceKey] = n1[options.nodeKey];
                    edge[options.targetKey] = n2[options.nodeKey];
                    edge[options.dashTag] = Math.floor(Math.random()*options.ndashes);
                    if(options.log)
                        console.log(n1[options.nodeKey] + ' -> ' + n2[options.nodeKey]);
                    _edges.push(edge);
                }
            }
        },
        remove: function(N) {
            while(N-- > 0) {
                var choice = Math.random();
                if(choice < options.removeEdgeProb)
                    _edges.splice(Math.floor(Math.random()*_edges.length), 1);
                else {
                    var n = _nodes[Math.floor(Math.random()*_nodes.length)];
                    var eis = [];
                    _edges.forEach(function(e, ei) {
                        if(e[options.sourceKey] === n[options.nodeKey] ||
                           e[options.targetKey] === n[options.nodeKey])
                            eis.push(ei);
                    });
                    eis.reverse().forEach(function(ei) {
                        _edges.splice(ei, 1);
                    });
                }
            }
        }
    };
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