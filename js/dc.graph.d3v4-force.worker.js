/*!
 *  dc.graph 0.9.95
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
import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';
import { set } from 'https://cdn.jsdelivr.net/npm/d3-collection@1.0.7/+esm';
import { forceSimulation, forceLink, forceCenter, forceX, forceY, forceCollide, forceManyBody } from 'https://cdn.jsdelivr.net/npm/d3-force@3.0.0/+esm';
import { forceStraightenPaths } from 'https://cdn.jsdelivr.net/npm/d3-force-straighten-paths@1.0.2/+esm';

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

const property = function(defaultValue, unwrap) {
    if (unwrap === undefined)
        unwrap = getOriginal;
    else if (unwrap === false)
        unwrap = identity;
    let value = defaultValue, react = null;
    const cascade = [];
    const ret = function(_) {
        if (!arguments.length) {
            return value;
        }
        if (react)
            react(_);
        value = _;
        return this;
    };
    ret.cascade = function(n, f) {
        for (let i = 0; i < cascade.length; ++i) {
            if (cascade[i].n === n) {
                if (f)
                    cascade[i].f = f;
                else cascade.splice(i, 1);
                return ret;
            } else if (cascade[i].n > n) {
                cascade.splice(i, 0, {n, f});
                return ret;
            }
        }
        cascade.push({n, f});
        return ret;
    };
    ret._eval = function(o, n) {
        if (n === 0 || !cascade.length)
            return functorWrap(ret(), unwrap)(o);
        else {
            const last = cascade[n-1];
            return last.f(o, () => ret._eval(o, n-1));
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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

// polyfill Object.assign for IE
// it's just too useful to do without
if (typeof Object.assign != 'function') {
    // Must be writable: true, enumerable: false, configurable: true
    Object.defineProperty(Object, 'assign', {
        value: function assign(target, _varArgs) { // .length of function is 2
            if (target == null) { // TypeError if undefined or null
                throw new TypeError('Cannot convert undefined or null to object');
            }

            const to = Object(target);

            for (let index = 1; index < arguments.length; index++) {
                const nextSource = arguments[index];

                if (nextSource != null) { // Skip over if undefined or null
                    for (const nextKey in nextSource) {
                        // Avoid bugs when hasOwnProperty is shadowed
                        if (Object.hasOwn(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        },
        writable: true,
        configurable: true,
    });
}

// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
        value(valueToFind, fromIndex) {
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            // 1. Let O be ? ToObject(this value).
            const o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            const len = o.length>>>0;

            // 3. If len is 0, return false.
            if (len === 0) {
                return false;
            }

            // 4. Let n be ? ToInteger(fromIndex).
            //    (If fromIndex is undefined, this step produces the value 0.)
            const n = fromIndex|0;

            // 5. If n >= 0, then
            //  a. Let k be n.
            // 6. Else n < 0,
            //  a. Let k be len + n.
            //  b. If k < 0, let k be 0.
            let k = Math.max(n >= 0 ? n : len-Math.abs(n), 0);

            function sameValueZero(x, y) {
                return x === y
                    || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
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
        },
    });
}

if (!Object.entries) {
    Object.entries = function(obj) {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i); // preallocate the Array
        while (i--)
            resArray[i] = [ownProps[i], obj[ownProps[i]]];
        return resArray;
    };
}

// https://github.com/KhaledElAnsari/Object.values
Object.values = Object.values ? Object.values : function(obj) {
    const allowedTypes = [
        '[object String]',
        '[object Object]',
        '[object Array]',
        '[object Function]',
    ];
    const objType = Object.prototype.toString.call(obj);

    if (obj === null || typeof obj === 'undefined') {
        throw new TypeError('Cannot convert undefined or null to object');
    } else if (!~allowedTypes.indexOf(objType)) {
        return [];
    } else {
        // if ES6 is supported
        if (Object.keys) {
            return Object.keys(obj).map(key => obj[key]);
        }

        const result = [];
        for (const prop in obj) {
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
    if (typeof v === 'function') {
        return wrap
            ? function(x) {
                return v(wrap(x));
            }
            : v;
    } else return function() {
            return v;
        };
}

/**
 * Object generation and management utilities
 * @module generate_objects
 */

// create or re-use objects in a map, delete the ones that were not reused
function regenerateObjects(preserved, list, need, key, assign, create, destroy) {
    if (!create) create = function(_k, _o) {};
    if (!destroy) destroy = function(_k) {};
    const keep = {};
    function wrap(o) {
        const k = key(o);
        if (!preserved[k])
            create(k, preserved[k] = {}, o);
        const o1 = preserved[k];
        assign(o1, o);
        keep[k] = true;
        return o1;
    }
    const wlist = list.map(wrap);
    // delete any objects from last round that are no longer used
    for (const k in preserved)
        if (!keep[k]) {
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
 */
function graphvizAttrs() {
    return {
        /**
         * Direction to draw ranks.
         * @method rankdir
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [rankdir='TB'] 'TB', 'LR', 'BT', or 'RL'
         */
        rankdir: property('TB'),
        /**
         * Spacing in between nodes in the same rank.
         * @method nodesep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [nodesep=40]
         */
        nodesep: property(40),
        /**
         * Spacing in between ranks.
         * @method ranksep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [ranksep=40]
         */
        ranksep: property(40),
    };
}

/**
 * D3 v4 force layout adaptor for dc.graph.js
 * @module d3v4_force_layout
 */


/**
 * `d3v4ForceLayout` is an adaptor for d3-force version 4 layouts in dc.graph.js
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} d3v4 force layout engine
 */
function d3v4ForceLayout(id) {
    const _layoutId = id || uuid();
    let _simulation = null; // d3-force simulation
    const _dispatch = globalThis.d3.dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    const _nodes = {}, _edges = {};
    let _wnodes = [], _wedges = [];
    let _options = null;
    let _paths = null;

    function init(options) {
        _options = options;

        _simulation = forceSimulation()
            .force('link', forceLink())
            .force('center', forceCenter(options.width/2, options.height/2))
            .force('gravityX', forceX(options.width/2).strength(_options.gravityStrength))
            .force('gravityY', forceY(options.height/2).strength(_options.gravityStrength))
            .force('collision', forceCollide(_options.collisionRadius))
            .force('charge', forceManyBody())
            .stop();
    }

    function dispatchState(event) {
        _dispatch.call(
            event,
            null,
            _wnodes,
            (_wedges || []).map(e => ({dcg_edgeKey: e.dcg_edgeKey})),
        );
    }

    function data(nodes, edges) {
        const nodeIDs = {};
        nodes.forEach((d, i) => {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.id = v.dcg_nodeKey;
            if (v.dcg_nodeFixed) {
                v1.fx = v.dcg_nodeFixed.x;
                v1.fy = v.dcg_nodeFixed.y;
            } else v1.fx = v1.fy = null;
        });

        _wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.source = nodeIDs[_nodes[e.dcg_edgeSource].dcg_nodeKey];
            e1.target = nodeIDs[_nodes[e.dcg_edgeTarget].dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.force('straighten', null);
        _simulation.nodes(_wnodes);
        _simulation.force('link').links(_wedges);
    }

    function start() {
        _dispatch.call('start');
        installForces(_paths);
        runSimulation(_options.iterations);
    }

    function savePositions() {
        const data = {};
        Object.keys(_nodes).forEach(key => {
            data[key] = {x: _nodes[key].x, y: _nodes[key].y};
        });
        return data;
    }
    function restorePositions(data) {
        Object.keys(data).forEach(key => {
            if (_nodes[key]) {
                _nodes[key].fx = data[key].x;
                _nodes[key].fy = data[key].y;
            }
        });
    }
    function installForces(paths) {
        if (paths)
            paths = paths.filter(path => path.nodes.every(nk => _nodes[nk]));
        if (paths === null || !paths.length) {
            _simulation.force('charge').strength(_options.initialCharge);
        } else {
            let nodesOnPath;
            if (_options.fixOffPathNodes) {
                nodesOnPath = set();
                paths.forEach(path => {
                    path.nodes.forEach(nid => {
                        nodesOnPath.add(nid);
                    });
                });
            }

            // fix nodes not on paths
            Object.keys(_nodes).forEach(key => {
                if (_options.fixOffPathNodes && !nodesOnPath.has(key)) {
                    _nodes[key].fx = _nodes[key].x;
                    _nodes[key].fy = _nodes[key].y;
                } else {
                    _nodes[key].fx = null;
                    _nodes[key].fy = null;
                }
            });

            _simulation.force('charge').strength(_options.chargeForce);
            _simulation.force(
                'straighten',
                forceStraightenPaths()
                    .id(n => n.dcg_nodeKey)
                    .angleForce(_options.angleForce)
                    .pathNodes(p => p.nodes)
                    .pathStrength(p => p.strength)
                    .paths(paths),
            );
        }
    }

    function runSimulation(iterations) {
        _simulation.alpha(1);
        for (let i = 0; i < iterations; ++i) {
            _simulation.tick();
            dispatchState('tick');
        }
        dispatchState('end');
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);

    const engine = Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'd3v4-force';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        supportsMoving() {
            return true;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges, constraints) {
            data(nodes, edges);
        },
        start() {
            start();
        },
        stop() {
        },
        paths(paths) {
            _paths = paths;
        },
        savePositions,
        restorePositions,
        optionNames() {
            return [
                'iterations',
                'angleForce',
                'chargeForce',
                'gravityStrength',
                'collisionRadius',
                'initialCharge',
                'fixOffPathNodes',
            ]
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.01),
        chargeForce: property(-600),
        gravityStrength: property(0.3),
        collisionRadius: property(8),
        initialCharge: property(-100),
        fixOffPathNodes: property(false),
        populateLayoutNode() {},
        populateLayoutEdge() {},
    });
    engine.pathStraightenForce = engine.angleForce;
    return engine;
}

// Scripts needed for web worker
d3v4ForceLayout.scripts = ['d3.js', 'd3v4-force.js'];

// Shared worker message handling code
const _layouts = {};

function postResponse(event, layoutId) {
    return function() {
        const message = {
            response: event,
            layoutId,
        };
        message.args = Array.prototype.slice.call(arguments);
        postMessage(message);
    };
}

function createWorkerHandler(layoutFactory) {
    return async function(e) {
        const args = e.data.args;
        const layoutId = args.layoutId;

        switch (e.data.command) {
            case 'init': {
                const layout = layoutFactory()
                    .on('tick', postResponse('tick', layoutId))
                    .on('start', postResponse('start', layoutId))
                    .on('end', postResponse('end', layoutId));

                const initResult = layout.init(args.options);

                // Handle both sync and async init methods
                if (initResult && typeof initResult.then === 'function') {
                    await initResult;
                    _layouts[layoutId] = layout;
                } else {
                    _layouts[layoutId] = initResult || layout;
                }

                // Send init completion response
                postMessage({
                    response: 'init',
                    layoutId,
                    args: [],
                });
                break;
            }
            case 'data':
                if (_layouts[layoutId])
                    _layouts[layoutId].data(
                        args.graph,
                        args.nodes,
                        args.edges,
                        args.clusters,
                        args.constraints,
                    );
                break;
            case 'start':
                if (_layouts[layoutId])
                    await _layouts[layoutId].start();
                break;
            case 'stop':
                if (_layouts[layoutId])
                    _layouts[layoutId].stop();
                break;
        }
    };
}

globalThis.d3 = {
    dispatch: d3Dispatch.dispatch,
};

onmessage = createWorkerHandler(d3v4ForceLayout);
//# sourceMappingURL=dc.graph.d3v4-force.worker.js.map
