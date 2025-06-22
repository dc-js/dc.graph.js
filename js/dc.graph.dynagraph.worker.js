/*!
 *  dc.graph 0.9.93
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2019 AT&T Intellectual Property & the dc.graph.js Developers
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
/**
 * The entire dc.graph.js library is scoped under the **dc_graph** name space. It does not introduce
 * anything else into the global name space.
 *
 * Like in dc.js and most libraries built on d3, most `dc_graph` functions are designed to allow function chaining, meaning they return the current diagram
 * instance whenever it is appropriate.  The getter forms of functions do not participate in function
 * chaining because they return values that are not the diagram.
 * @namespace dc_graph
 * @version 0.9.93
 * @example
 * // Example chaining
 * diagram.width(600)
 *      .height(400)
 *      .nodeDimension(nodeDim)
 *      .nodeGroup(nodeGroup);
 */

var dc_graph = {
    version: '0.9.93',
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
                else cascade.splice(i, 1);
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
        if(f.reject) {
            var reject = f.reject(id, object);
            if(reject) {
                console.groupCollapsed(reject);
                console.trace();
                console.groupEnd();
                return this;
            }
        }
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

function onetime_trace(level, message) {
    var said = false;
    return function() {
        if(said)
            return;
        if(level === 'trace') {
            // todo: implement levels?
            // console.groupCollapsed(message);
            // console.trace();
            // console.groupEnd();
        }
        else
            console[level](message);
        said = true;
    };
}

function deprecation_warning(message) {
    return onetime_trace('warn', message);
}

function trace_function(level, message, f) {
    var dep = onetime_trace(level, message);
    return function() {
        dep();
        return f.apply(this, arguments);
    };
}
function deprecate_function(message, f) {
    return trace_function('warn', message, f);
}

// http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

function is_ie() {
    var ua = window.navigator.userAgent;

    return(ua.indexOf('MSIE ') > 0 ||
           ua.indexOf('Trident/') > 0 ||
           ua.indexOf('Edge/') > 0);
}

function is_safari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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


// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(valueToFind, fromIndex) {

      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      // 1. Let O be ? ToObject(this value).
      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n >= 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(valueToFind, elementK) is true, return true.
        if (sameValueZero(o[k], valueToFind)) {
          return true;
        }
        // c. Increase k by 1.
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}

if (!Object.entries) {
  Object.entries = function( obj ){
    var ownProps = Object.keys( obj ),
        i = ownProps.length,
        resArray = new Array(i); // preallocate the Array
    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]];
    return resArray;
  };
}

// https://github.com/KhaledElAnsari/Object.values
Object.values = Object.values ? Object.values : function(obj) {
    var allowedTypes = ["[object String]", "[object Object]", "[object Array]", "[object Function]"];
    var objType = Object.prototype.toString.call(obj);

    if(obj === null || typeof obj === "undefined") {
	throw new TypeError("Cannot convert undefined or null to object");
    } else if(!~allowedTypes.indexOf(objType)) {
	return [];
    } else {
	// if ES6 is supported
	if (Object.keys) {
	    return Object.keys(obj).map(function (key) {
		return obj[key];
	    });
	}

	var result = [];
	for (var prop in obj) {
	    if (obj.hasOwnProperty(prop)) {
		result.push(obj[prop]);
	    }
	}

	return result;
    }
};

function getBBoxNoThrow(elem) {
    // firefox seems to have issues with some of my texts
    // just catch for now
    try {
        return elem.getBBox();
    } catch(xep) {
        return {x: 0, y: 0, width:0, height: 0};
    }
}

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

/**
 * `dc_graph.graphviz_attrs defines a basic set of attributes which layout engines should
 * implement - although these are not required, they make it easier for clients and
 * modes (like expand_collapse) to work with multiple layout engines.
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

// graphlib-dot seems to wrap nodes in an extra {value}
// actually this is quite a common problem with generic libs
function nvalue(n) {
    return n.value.value ? n.value.value : n.value;
}

// apply standard accessors to a diagram in order to style it as graphviz would
// this is a work in progress
dc_graph.apply_graphviz_accessors = function(diagram) {
    diagram
        .nodeLabel(function(n) {
            var label = nvalue(n).label;
            if(label === undefined)
                label = n.key;
            return label && label.split(/\n|\\n/);
        })
        .nodeRadius(function(n) {
            // should do width & height instead, #25
            return nvalue(n).radius || 25;
        })
        .nodeShape(function(n) { return nvalue(n).shape; })
        .nodeFill(function(n) { return nvalue(n).fillcolor || 'white'; })
        .nodeOpacity(function(n) {
            // not standard gv
            return nvalue(n).opacity || 1;
        })
        .nodeLabelFill(function(n) { return nvalue(n).fontcolor || 'black'; })
        .nodeTitle(function(n) {
            return (nvalue(n).htmltip || nvalue(n).jsontip) ? null :
                nvalue(n).tooltip !== undefined ?
                nvalue(n).tooltip :
                diagram.nodeLabel()(n);
        })
        .nodeStrokeWidth(function(n) {
            // it is debatable whether a point === a pixel but they are close
            // https://graphicdesign.stackexchange.com/questions/199/point-vs-pixel-what-is-the-difference
            var penwidth = nvalue(n).penwidth;
            return penwidth !== undefined ? +penwidth : 1;
        })
        .edgeLabel(function(e) { return e.value.label ? e.value.label.split(/\n|\\n/) : ''; })
        .edgeStroke(function(e) { return e.value.color || 'black'; })
        .edgeOpacity(function(e) {
            // not standard gv
            return e.value.opacity || 1;
        })
        .edgeArrowSize(function(e) {
            return e.value.arrowsize || 1;
        })
        // need directedness to default these correctly, see #106
        .edgeArrowhead(function(e) {
            var head = e.value.arrowhead;
            return head !== undefined ? head : 'vee';
        })
        .edgeArrowtail(function(e) {
            var tail = e.value.arrowtail;
            return tail !== undefined ? tail : null;
        })
        .edgeStrokeDashArray(function(e) {
            switch(e.value.style) {
            case 'dotted':
                return [1,5];
            }
            return null;
        });
    var draw_clusters = diagram.child('draw-clusters');
    if(draw_clusters) {
        draw_clusters
            .clusterStroke(function(c) {
                return c.value.color || 'black';
            })
            .clusterFill(function(c) {
                return c.value.style === 'filled' ? c.value.fillcolor || c.value.color || c.value.bgcolor : null;
            })
            .clusterLabel(function(c) {
                return c.value.label;
            });
    }
};

dc_graph.snapshot_graphviz = function(diagram) {
    var xDomain = diagram.x().domain(), yDomain = diagram.y().domain();
    return {
        nodes: diagram.nodeGroup().all().map(function(n) {
            return diagram.getWholeNode(n.key);
        })
            .filter(function(x) { return x; })
            .map(function(n) {
                return {
                    key: diagram.nodeKey.eval(n),
                    label: diagram.nodeLabel.eval(n),
                    fillcolor: diagram.nodeFillScale()(diagram.nodeFill.eval(n)),
                    penwidth: diagram.nodeStrokeWidth.eval(n),
                    // not supported as input, see dc.graph.js#25
                    // width: n.cola.dcg_rx*2,
                    // height: n.cola.dcg_ry*2,

                    // not graphviz attributes
                    // until we have w/h
                    radius: diagram.nodeRadius.eval(n),
                    // does not seem to exist in gv
                    opacity: diagram.nodeOpacity.eval(n),
                    // should be pos
                    x: n.cola.x,
                    y: n.cola.y
                };
            }),
        edges: diagram.edgeGroup().all().map(function(e) {
            return diagram.getWholeEdge(e.key);
        }).map(function(e) {
            return {
                key: diagram.edgeKey.eval(e),
                source: diagram.edgeSource.eval(e),
                target: diagram.edgeTarget.eval(e),
                color: diagram.edgeStroke.eval(e),
                arrowsize: diagram.edgeArrowSize.eval(e),
                opacity: diagram.edgeOpacity.eval(e),
                // should support dir, see dc.graph.js#106
                arrowhead: diagram.edgeArrowhead.eval(e),
                arrowtail: diagram.edgeArrowtail.eval(e)
            };
        }),
        bounds: {
            left: xDomain[0],
            top: yDomain[0],
            right: xDomain[1],
            bottom: yDomain[1]
        }
    };
};

/**
 * `dc_graph.dynagraph_layout` connects to dynagraph-wasm and does dynamic directed graph layout.
 * @class dynagraph_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.dynagraph_layout}
 **/
dc_graph.dynagraph_layout = function(id, layout) {
    var _layoutId = id || uuid();
    const _Gname = _layoutId;
    var _layout;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _tick, _done;
    var _nodes = {}, _edges = {};
    var _linesOut = [], _incrIn = [], _opened = false, _open_graph;
    var _lock = 0;



    let bb = null;
    // dg2incr
    function dg2incr_coord(c) {
        const [x, y] = c;
        return [x, /*(bb && bb[0][1] || 0)*/ - y];
    }


    function dg2incr_graph_attrs() {
        return [
            ['rankdir', _layout.rankdir()],
            ['resolution', [_layout.resolution().x, _layout.resolution().y]],
            ['defaultsize', [_layout.defaultsize().width, _layout.defaultsize().height]],
            ['separation', [_layout.separation().x, _layout.separation().y]],
        ];
    }

    function dg2incr_node_attrs(n) {
        const attr_pairs = [];
        if(n.x !== undefined && n.y !== undefined)
            attr_pairs.push(['pos', dg2incr_coord([n.x, n.y]).map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_node_attrs_changed(n, n2) {
        const attr_pairs = [];
        if(n2.x !== undefined && n2.y !== undefined && (n2.x !== n.x || n2.y !== n.y))
            attr_pairs.push(['pos', dg2incr_coord([n2.x, n2.y]).map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_edge_attrs(e) {
        return [];
    }

    function mq(x) { // maybe quote
        if(x === +x) // isNumber
            return x;
        else if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(x))
            return x;
        else return '"' + x + '"';
    }

    function print_incr_attrs(attr_pairs) {
        return '[' + attr_pairs.map(([a,b]) => `${mq(a)}=${mq(b)}`).join(', ') + ']';
    }

    // incr2dg
    function incr2dg_coord(c) {
        const [x, y] = c;
        return [+x, /*(bb && bb[0][1] || 0)*/ - y];
    }
    function incr2dg_bb(bb) {
        const [x1,y1,x2,y2] = bb.split(',');
        return [incr2dg_coord([x1,y1]), incr2dg_coord([x2,y2])];
    }
    function incr2dg_node_attrs(n) {
        const attrs = {};
        if(n.pos)
            [attrs.x, attrs.y] = incr2dg_coord(n.pos.split(',').map(Number));
        return attrs;
    }
    function incr2dg_edge_attrs(e) {
        const attrs = {};
        if(e.pos)
            attrs.points = e.pos.split(' ')
                .map(coord => coord.split(',').map(Number))
                .map(incr2dg_coord)
                .map(([x,y]) => ({x,y}));
        return attrs;
    }

    function runCommands(cmds) {
        for(const cmd of cmds) {
            const {action, kind} = cmd;
            switch(`${action}_${kind}`) {
                case 'open_graph': {
                    const {attrs} = cmd;
                    console.log('open graph', attrs);
                    console.log('open graph bb', bb)
                    bb = incr2dg_bb(attrs.bb)
                    console.log('open graph bb', bb)
                    break;
                }
                case 'modify_graph': {
                    const {attrs} = cmd;
                    console.log('modify graph', attrs);
                    console.log('modify graph bb', bb)
                    bb = incr2dg_bb(attrs.bb)
                    console.log('modify graph bb', bb)
                    break;
                }
                case 'close_graph': {
                    console.log('close graph');
                    break;
                }
                case 'insert_node': {
                    const {node, attrs} = cmd;
                    console.log('insert node', node, attrs);
                    console.log('insert node2', _nodes[node])
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    console.log('insert node3', _nodes[node])
                    break;
                }
                case 'modify_node': {
                    const {node, attrs} = cmd;
                    console.log('modify node', node, attrs);
                    console.log('modify node2', _nodes[node])
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    console.log('modify node3', _nodes[node])
                    break;
                }
                case 'delete_node': {
                    const {node} = cmd;
                    console.log('delete node', node);
                    break;
                }
                case 'insert_edge': {
                    const {edge, source, target, attrs} = cmd;
                    console.log('insert edge', edge, source, target, attrs);
                    console.log('insert edge2', _edges[edge])
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    console.log('insert edge3', _edges[edge])
                    break;
                }
                case 'modify_edge': {
                    const {edge, attrs} = cmd;
                    console.log('modify edge', edge, attrs);
                    console.log('modify edge2', _edges[edge])
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    console.log('modify edge3', _edges[edge])
                    break;
                }
                case 'delete_edge': {
                    const {edge} = cmd;
                    console.log('delete edge', edge);
                    break;
                }
            }
        }
    }
    function receiveIncr(text) {
        console.log(text);
        let cmds = null;
        try {
            const parseIncrface = self.parseIncrface || (self.incrface && self.incrface.parse);
            if(!parseIncrface) {
                console.log('parseIncrface not available, skipping');
                return;
            }
            cmds = parseIncrface(text);
        } catch(xep) {
            console.log('incrface parse failed', xep)
        }
        if (!cmds)
            return;
        for(const cmd of cmds) {
            const {action, kind, graph} = cmd;
            if(action === 'message') {
                console.warn('dynagraph message', cmd.message);
                continue;
            }
            if(graph !== _Gname) {
                console.warn('graph name mismatch', _Gname, graph);
                continue;
            }
            switch(`${action}_${kind}`) {
                case 'lock_graph':
                    _lock++;
                    break;
                case 'unlock_graph':
                    // maybe error on negative lock?
                    if(--_lock <= 0) {
                        runCommands(_incrIn);
                        _incrIn = []
                    }
                    break;
                default:
                    if(_lock > 0)
                        _incrIn.push(cmd);
                    else
                        runCommands([cmd]);
            }
        }
        _done();
    }

    function init(options) {
        self.receiveIncr = receiveIncr;
        _opened = false;
        _open_graph = `open graph ${mq(_Gname)} ${print_incr_attrs(dg2incr_graph_attrs())}`
    }

    function data(nodes, edges, clusters) {
        const linesOutDeleteNode = [];
        var wnodes = regenerate_objects(_nodes, nodes, null,
        function key(v) {
            return v.dcg_nodeKey;
        }, function assign(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            if(v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            }
            const na = dg2incr_node_attrs_changed(v1, v);
            if(na.length)
                _linesOut.push(`modify node ${mq(_Gname)} ${mq(v1.dcg_nodeKey)} ${print_incr_attrs(na)}`);
        }, function create(k, o) {
            _linesOut.push(`insert node ${mq(_Gname)} ${mq(k)} ${print_incr_attrs(dg2incr_node_attrs(o))}`);
        }, function destroy(k) {
            linesOutDeleteNode.push(`delete node ${mq(_Gname)} ${mq(k)}`);
        });
        var wedges = regenerate_objects(_edges, edges, null, function key(e) {
            return e.dcg_edgeKey;
        }, function assign(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, function create(k, o, e) {
            _linesOut.push(`insert edge ${mq(_Gname)} ${mq(k)} ${mq(e.dcg_edgeSource)} ${mq(e.dcg_edgeTarget)} ${print_incr_attrs(dg2incr_edge_attrs(e))}`);
        }, function destroy(k, e) {
            _linesOut.push(`delete edge ${mq(_Gname)} ${k}`);
        });
        _linesOut.push(...linesOutDeleteNode);

        function dispatchState(event) {
            _dispatch[event](
                wnodes,
                wedges
            );
        }
        _tick = function() {
            dispatchState('tick');
        };
        _done = function() {
            dispatchState('end');
        };
    }

    function start() {
        if(_linesOut.length) {
            const open = _opened ? [] : [_open_graph];
            _opened = true;
            const actions = _linesOut.length > 1 ? [
                `lock graph ${mq(_Gname)}`,
                ... _linesOut,
                `unlock graph ${mq(_Gname)}`
            ] : _linesOut;
            const input = [...open, ...actions].join('\n');
            console.log('dynagraph input:', input);
            self.incrface_input = input;
            _linesOut = [];
        }
        else _done();
    }

    function stop() {
    }

    _layout = {
        ...dc_graph.graphviz_attrs(),
        layoutAlgorithm: function() {
            return layout;
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        resolution: property({x: 5, y: 5}),
        defaultsize: property({width: 50, height: 50}),
        separation: property({x: 20, y: 20}),
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
            return ['resolution', 'defaultsize', 'separation'];
        },
        populateLayoutNode: function(layout, node) {},
        populateLayoutEdge: function() {}
    };
    return _layout;
};

dc_graph.dynagraph_layout.scripts = ['d3.js', 'dynagraph-wasm.js', 'incrface-umd.js'];

var _layouts;

function postResponse(event, layoutId) {
    return function() {
        var message = {
            response: event,
            layoutId: layoutId
        };
        message.args = Array.prototype.slice.call(arguments);
        postMessage(message);
    };
}

onmessage = function(e) {
    var args = e.data.args;
    switch(e.data.command) {
    case 'init':
        // find a function under dc_graph that has `scripts`
        var layout_name;
        for(var name in dc_graph) {
            if(typeof dc_graph[name] === 'function' && dc_graph[name].scripts)
                layout_name = name;
        }
        if(!_layouts) {
            _layouts = {};
            importScripts.apply(null, dc_graph[layout_name].scripts);
            if(dc_graph[layout_name].optional_scripts) {
                try {
                    importScripts.apply(null, dc_graph[layout_name].optional_scripts);
                }
                catch(xep) {
                    console.log(xep);
                }
            }
        }

        _layouts[args.layoutId] = dc_graph[layout_name]()
            .on('tick', postResponse('tick', args.layoutId))
            .on('start', postResponse('start', args.layoutId))
            .on('end', postResponse('end', args.layoutId))
            .init(args.options);
        break;
    case 'data':
        if(_layouts)
            _layouts[args.layoutId].data(args.graph, args.nodes, args.edges, args.clusters, args.constraints);
        break;
    case 'start':
        // if(args.initialOnly) {
        //     if(args.showLayoutSteps)
        //         _tick();
        //     _done();
        // }
        // else
        _layouts[args.layoutId].start();
        break;
    case 'stop':
        if(_layouts)
            _layouts[args.layoutId].stop();
        break;
    }
};


//# sourceMappingURL=dc.graph.dynagraph.worker.js.map