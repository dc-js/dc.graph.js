/*!
 *  dc.graph 0.9.94
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
importScripts('d3.js');
(function () {
  'use strict';

  /**
   * Core utilities and functions for dc.graph.js
   * @module core
   */


  function getOriginal(x) {
      return x.orig;
  }

  function identity(x) {
      return x;
  }

  const property = function (defaultValue, unwrap) {
      if(unwrap === undefined)
          unwrap = getOriginal;
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
              return functorWrap(ret(), unwrap)(o);
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

  // version of d3.functor that optionally wraps the function with another
  // one, if the parameter is a function
  function functorWrap(v, wrap) {
      if(typeof v === "function") {
          return wrap ? function(x) {
              return v(wrap(x));
          } : v;
      }
      else return function() {
          return v;
      };
  }

  /**
   * Object generation and management utilities
   * @module generate_objects
   */

  // create or re-use objects in a map, delete the ones that were not reused
  function regenerateObjects(preserved, list, need, key, assign, create, destroy) {
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

  /**
   * Graphviz attributes for layout engines
   * @module graphviz_attrs
   */


  /**
   * `graphvizAttrs` defines a basic set of attributes which layout engines should
   * implement - although these are not required, they make it easier for clients and
   * modes (like expand_collapse) to work with multiple layout engines.
   *
   * these attributes are {@link http://www.graphviz.org/doc/info/attrs.html from graphviz}
   * @return {Object}
   **/
  function graphvizAttrs() {
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
  }

  /**
   * D3 force layout adaptor for dc.graph.js
   * @module d3_force_layout
   */

  // External dependency loaded as global
  const d3 = globalThis.d3;

  /**
   * `d3ForceLayout` is an adaptor for d3-force layouts in dc.graph.js
   * @param {String} [id=uuid()] - Unique identifier
   * @return {Object} d3 force layout engine
   **/
  function d3ForceLayout(id) {
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

          _wnodes = regenerateObjects(_nodes, nodes, null, function(v) {
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

          _wedges = regenerateObjects(_edges, edges, null, function(e) {
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
      }
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
          function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; }        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); }        function _angle(v1, v2) {
              var a = _dot(v1, v2) / (_len(v1)*_len(v2));
              a = Math.min(a, 1);
              a = Math.max(a, -1);
              return Math.acos(a);
          }        // perpendicular unit length vector
          function _pVec(v) {
              var xx = -v.y/v.x, yy = 1;
              var length = _len({x: xx, y: yy});
              return {x: xx/length, y: yy/length};
          }
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

      var graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);

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
              data(nodes, edges);
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
  }
  // Scripts needed for web worker
  d3ForceLayout.scripts = ['d3.js'];

  // Shared worker message handling code
  var _layouts = {};

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

  function createWorkerHandler(layoutFactory) {
      return function(e) {
          var args = e.data.args;
          switch(e.data.command) {
          case 'init':
              _layouts[args.layoutId] = layoutFactory()
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
              _layouts[args.layoutId].start();
              break;
          case 'stop':
              if(_layouts)
                  _layouts[args.layoutId].stop();
              break;
          }
      };
  }

  // D3 Force layout web worker entry point

  onmessage = createWorkerHandler(d3ForceLayout);

})();
//# sourceMappingURL=dc.graph.d3-force.worker.js.map
