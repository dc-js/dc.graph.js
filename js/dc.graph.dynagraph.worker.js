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
import { parse as parseIncrface } from './incrface.mjs';
import createDynagraphModule from './dynagraph.mjs';

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch
};
globalThis.parseIncrface = parseIncrface;
globalThis.createDynagraphModule = createDynagraphModule;
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
 * Dynagraph-wasm layout adaptor for dc.graph.js
 * @module dynagraph_layout
 */


/**
 * `dynagraphLayout` connects to dynagraph WebAssembly module and does dynamic directed graph layout.
 * @param {String} [id=uuid()] - Unique identifier
 * @param {String} [layout] - Layout algorithm name
 * @return {Object} dynagraph layout engine
 */
function dynagraphLayout(id, layout) {
    const _layoutId = id || uuid();
    const _Gname = _layoutId;
    let _layout = null;
    const _dispatch = (globalThis.d3?.dispatch || dispatch)('tick', 'start', 'end');
    let _done;
    const _nodes = {}, _edges = {};
    let _linesOut = [], _incrIn = [], _opened = false, _open_graph;
    let _lock = 0;

    let bb = null;
    // dg2incr
    function dg2incr_coord(c) {
        const [x, y] = c;
        return [x, /*(bb && bb[0][1] || 0)*/ -y];
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
        if (n.x !== undefined && n.y !== undefined)
            attr_pairs.push(['pos', dg2incr_coord([n.x, n.y]).map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_node_attrs_changed(n, n2) {
        const attr_pairs = [];
        if (n2.x !== undefined && n2.y !== undefined && (n2.x !== n.x || n2.y !== n.y))
            attr_pairs.push(['pos', dg2incr_coord([n2.x, n2.y]).map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_edge_attrs(_e) {
        return [];
    }

    function mq(x) { // maybe quote
        if (x === +x) // isNumber
            return x;
        else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(x))
            return x;
        else return `"${x}"`;
    }

    function print_incr_attrs(attr_pairs) {
        return `[${attr_pairs.map(([a, b]) => `${mq(a)}=${mq(b)}`).join(', ')}]`;
    }

    // incr2dg
    function incr2dg_coord(c) {
        const [x, y] = c;
        return [+x, /*(bb && bb[0][1] || 0)*/ -y];
    }
    function incr2dg_bb(bb) {
        const [x1, y1, x2, y2] = bb.split(',');
        return [incr2dg_coord([x1, y1]), incr2dg_coord([x2, y2])];
    }
    function incr2dg_node_attrs(n) {
        const attrs = {};
        if (n.pos)
            [attrs.x, attrs.y] = incr2dg_coord(n.pos.split(',').map(Number));
        return attrs;
    }
    function incr2dg_edge_attrs(e) {
        const attrs = {};
        if (e.pos)
            attrs.points = e.pos.split(' ')
                .map(coord => coord.split(',').map(Number))
                .map(incr2dg_coord)
                .map(([x, y]) => ({x, y}));
        return attrs;
    }

    function runCommands(cmds) {
        for (const cmd of cmds) {
            const {action, kind} = cmd;
            switch (`${action}_${kind}`) {
                case 'open_graph': {
                    const {attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('open graph', attrs);
                        console.log('open graph bb', bb);
                    }
                    bb = incr2dg_bb(attrs.bb);
                    if (_layout.verbose()) {
                        console.log('open graph bb', bb);
                    }
                    break;
                }
                case 'modify_graph': {
                    const {attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('modify graph', attrs);
                        console.log('modify graph bb', bb);
                    }
                    bb = incr2dg_bb(attrs.bb);
                    if (_layout.verbose()) {
                        console.log('modify graph bb', bb);
                    }
                    break;
                }
                case 'close_graph': {
                    if (_layout.verbose()) {
                        console.log('close graph');
                    }
                    break;
                }
                case 'insert_node': {
                    const {node, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('insert node', node, attrs);
                        console.log('insert node2', _nodes[node]);
                    }
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('insert node3', _nodes[node]);
                    }
                    break;
                }
                case 'modify_node': {
                    const {node, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('modify node', node, attrs);
                        console.log('modify node2', _nodes[node]);
                    }
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('modify node3', _nodes[node]);
                    }
                    break;
                }
                case 'delete_node': {
                    const {node} = cmd;
                    if (_layout.verbose()) {
                        console.log('delete node', node);
                    }
                    break;
                }
                case 'insert_edge': {
                    const {edge, source, target, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('insert edge', edge, source, target, attrs);
                        console.log('insert edge2', _edges[edge]);
                    }
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('insert edge3', _edges[edge]);
                    }
                    break;
                }
                case 'modify_edge': {
                    const {edge, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('modify edge', edge, attrs);
                        console.log('modify edge2', _edges[edge]);
                    }
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('modify edge3', _edges[edge]);
                    }
                    break;
                }
                case 'delete_edge': {
                    const {edge} = cmd;
                    if (_layout.verbose()) {
                        console.log('delete edge', edge);
                    }
                    break;
                }
            }
        }
    }
    function receiveIncr(text) {
        if (_layout.verbose()) {
            console.log(text);
        }
        let cmds = null;
        try {
            const parseIncrface = globalThis.parseIncrface || self.parseIncrface
                || (self.incrface && self.incrface.parse);
            if (!parseIncrface) {
                console.log('[DYNAGRAPH] parseIncrface not available, skipping');
                return;
            }
            cmds = parseIncrface(text);
        } catch (xep) {
            console.log('[DYNAGRAPH] incrface parse failed', xep);
        }
        if (!cmds) {
            return;
        }
        for (const cmd of cmds) {
            const {action, kind, graph} = cmd;
            if (action === 'message') {
                console.warn('[DYNAGRAPH] dynagraph message', cmd.message);
                continue;
            }
            if (graph !== _Gname) {
                console.warn('[DYNAGRAPH] graph name mismatch', _Gname, 'vs', graph);
                continue;
            }
            switch (`${action}_${kind}`) {
                case 'lock_graph':
                    _lock++;
                    break;
                case 'unlock_graph':
                    // maybe error on negative lock?
                    if (--_lock <= 0) {
                        runCommands(_incrIn);
                        _incrIn = [];
                    }
                    break;
                default:
                    if (_lock > 0) {
                        _incrIn.push(cmd);
                    } else {
                        runCommands([cmd]);
                    }
            }
        }
        _done();
    }

    function init(_options) {
        self.receiveIncr = receiveIncr;
        _opened = false;
        _open_graph = `open graph ${mq(_Gname)} ${print_incr_attrs(dg2incr_graph_attrs())}`;
    }

    function data(nodes, edges, _clusters) {
        const linesOutDeleteNode = [];
        const wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            if (v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            }
            const na = dg2incr_node_attrs_changed(v1, v);
            if (na.length)
                _linesOut.push(
                    `modify node ${mq(_Gname)} ${mq(v1.dcg_nodeKey)} ${print_incr_attrs(na)}`,
                );
        }, (k, o) => {
            _linesOut.push(
                `insert node ${mq(_Gname)} ${mq(k)} ${print_incr_attrs(dg2incr_node_attrs(o))}`,
            );
        }, k => {
            linesOutDeleteNode.push(`delete node ${mq(_Gname)} ${mq(k)}`);
        });
        const wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, (k, o, e) => {
            _linesOut.push(
                `insert edge ${mq(_Gname)} ${mq(k)} ${mq(e.dcg_edgeSource)} ${
                    mq(e.dcg_edgeTarget)
                } ${print_incr_attrs(dg2incr_edge_attrs())}`,
            );
        }, (k, _e) => {
            _linesOut.push(`delete edge ${mq(_Gname)} ${k}`);
        });
        _linesOut.push(...linesOutDeleteNode);

        function dispatchState(event) {
            _dispatch.call(event, null, wnodes, wedges);
        }
        _done = function() {
            dispatchState('end');
        };
    }

    async function start() {
        // Ensure dynagraph is initialized for main thread (no-op in worker)
        if (globalThis.ensureDynagraphInitialized && typeof importScripts === 'undefined') {
            try {
                await globalThis.ensureDynagraphInitialized();
            } catch (error) {
                console.error('[DYNAGRAPH] Failed to initialize dynagraph:', error);
                return;
            }
        }

        if (_linesOut.length) {
            const open = _opened ? [] : [_open_graph];
            _opened = true;
            const actions = _linesOut.length > 1
                ? [
                    `lock graph ${mq(_Gname)}`,
                    ..._linesOut,
                    `unlock graph ${mq(_Gname)}`,
                ]
                : _linesOut;
            const input = [...open, ...actions].join('\n');
            if (_layout.verbose()) {
                console.log('dynagraph input:', input);
            }
            self.incrface_input = input;
            _linesOut = [];
        } else {
            _done();
        }
    }

    _layout = {
        ...graphvizAttrs(),
        layoutAlgorithm() {
            return layout;
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        resolution: property({x: 5, y: 5}),
        defaultsize: property({width: 50, height: 50}),
        separation: property({x: 20, y: 20}),
        verbose: property(false),
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
            init();
            return this;
        },
        data(graph, nodes, edges) {
            data(nodes, edges);
        },
        async start() {
            await start();
        },
        stop() {
        },
        optionNames() {
            return ['resolution', 'defaultsize', 'separation', 'verbose'];
        },
        populateLayoutNode(_layout, _node) {},
        populateLayoutEdge() {},
    };
    return _layout;
}

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

// Dynagraph layout web worker entry point

// Initialize WASM once when worker loads
let wasmInitialized = false;

async function initializeWASM() {
    if (!wasmInitialized) {
        try {
            await globalThis.createDynagraphModule();
            wasmInitialized = true;
        } catch (error) {
            console.error('[DYNAGRAPH WORKER] Failed to initialize WASM module:', error);
            throw error;
        }
    }
}

// Create layout factory that ensures WASM is initialized
function dynagraphLayoutWithWASM(id, layout) {
    const baseLayout = dynagraphLayout(id, layout);
    const originalInit = baseLayout.init;

    // Override init to ensure WASM is initialized first
    baseLayout.init = async function(options) {
        await initializeWASM();
        return originalInit.call(this, options);
    };

    return baseLayout;
}

onmessage = createWorkerHandler(dynagraphLayoutWithWASM);
//# sourceMappingURL=dc.graph.dynagraph.worker.js.map
