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
importScripts('d3.js', 'dagre.js');
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
   * Dagre.js layout adaptor for dc.graph.js
   * @module dagre_layout
   */

  // External dependencies loaded as globals
  const d3 = globalThis.d3;
  const dagre = globalThis.dagre;

  /**
   * `dagreLayout` is an adaptor for dagre.js layouts in dc.graph.js
   *
   * In addition to the below layout attributes, `dagreLayout` also implements the attributes from
   * {@link graphvizAttrs graphviz_attrs}
   * @param {String} [id=uuid()] - Unique identifier
   * @return {Object} dagre layout engine
   **/
  function dagreLayout(id) {
      var _layoutId = id || uuid();
      var _dagreGraph = null, _done;
      var _dispatch = d3.dispatch('tick', 'start', 'end');
      // node and edge objects preserved from one iteration
      // to the next (as long as the object is still in the layout)
      var _nodes = {}, _edges = {};

      function init(options) {
          // Create a new directed graph
          _dagreGraph = new dagre.graphlib.Graph({multigraph: true, compound: true});

          // Set an object for the graph label
          _dagreGraph.setGraph({rankdir: options.rankdir, nodesep: options.nodesep, ranksep: options.ranksep});

          // Default to assigning a new object as a label for each new edge.
          _dagreGraph.setDefaultEdgeLabel(function() { return {}; });
      }

      function data(nodes, edges, clusters) {
          var wnodes = regenerateObjects(_nodes, nodes, null, function(v) {
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
          var wedges = regenerateObjects(_edges, edges, null, function(e) {
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
          clusters = clusters.filter(function(c) {
              return /^cluster/.test(c.dcg_clusterKey);
          });
          clusters.forEach(function(c) {
              _dagreGraph.setNode(c.dcg_clusterKey, c);
          });
          clusters.forEach(function(c) {
              if(c.dcg_clusterParent)
                  _dagreGraph.setParent(c.dcg_clusterKey, c.dcg_clusterParent);
          });
          nodes.forEach(function(n) {
              if(n.dcg_nodeParentCluster)
                  _dagreGraph.setParent(n.dcg_nodeKey, n.dcg_nodeParentCluster);
          });

          function dispatchState(event) {
              _dispatch[event](
                  wnodes,
                  wedges.map(function(e) {
                      return {dcg_edgeKey: e.dcg_edgeKey};
                  }),
                  clusters.map(function(c) {
                      var c = Object.assign({}, _dagreGraph.node(c.dcg_clusterKey));
                      c.bounds = {
                          left: c.x - c.width/2,
                          top: c.y - c.height/2,
                          right: c.x + c.width/2,
                          bottom: c.y + c.height/2
                      };
                      return c;
                  })
              );
          }
          _done = function() {
              dispatchState('end');
          };
      }

      function start(options) {
          _dispatch.start();
          dagre.layout(_dagreGraph);
          _done();
      }

      var graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
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
          data: function(graph, nodes, edges, clusters) {
              data(nodes, edges, clusters);
          },
          start: function() {
              start();
          },
          stop: function() {
          },
          optionNames: function() {
              return graphviz_keys;
          },
          populateLayoutNode: function() {},
          populateLayoutEdge: function() {}
      });
  }
  // Scripts needed for web worker
  dagreLayout.scripts = ['d3.js', 'dagre.js'];

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

  // Dagre layout web worker entry point

  onmessage = createWorkerHandler(dagreLayout);

})();
//# sourceMappingURL=dc.graph.dagre.worker.js.map
