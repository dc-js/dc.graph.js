/*!
 *  dc.graph 0.9.8
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
 * @version 0.9.8
 * @example
 * // Example chaining
 * diagram.width(600)
 *      .height(400)
 *      .nodeDimension(nodeDim)
 *      .nodeGroup(nodeGroup);
 */

var dc_graph = {
    version: '0.9.8',
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
            console.groupCollapsed(message);
            console.trace();
            console.groupEnd();
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
        if(options.linkDistance) {
            if(typeof options.linkDistance === 'number')
                _simulation.linkDistance(options.linkDistance);
            else if(options.linkDistance === 'auto')
                _simulation.linkDistance(function(e) {
                    return e.dcg_edgeLength;
                });
        }

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
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.y};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.y};

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
        supportsMoving: function() {
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
                    'initialCharge', 'linkDistance', 'fixOffPathNodes']
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.02),
        chargeForce: property(-500),
        gravityStrength: property(1.0),
        initialCharge: property(-400),
        linkDistance: property(20),
        fixOffPathNodes: property(false),
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
    return engine;
};

dc_graph.d3_force_layout.scripts = ['d3.js'];

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


//# sourceMappingURL=dc.graph.d3-force.worker.js.map