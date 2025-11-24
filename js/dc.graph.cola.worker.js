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
import * as d3Selection from 'https://cdn.jsdelivr.net/npm/d3-selection@1.4.2/+esm';
import * as d3Timer from 'https://cdn.jsdelivr.net/npm/d3-timer@1.0.10/+esm';
import * as webcolaModule from 'https://cdn.jsdelivr.net/npm/webcola@3.4.0/+esm';

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch,
    select: d3Selection.select,
    selectAll: d3Selection.selectAll,
    timer: d3Timer.timer
};
globalThis.cola = webcolaModule;
import * as cola from 'webcola';

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
 * Cola.js layout adaptor for dc.graph.js
 * @module cola_layout
 */


/**
 * `colaLayout` is an adaptor for cola.js layouts in dc.graph.js
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} cola layout engine
 */
function colaLayout(id) {
    const _layoutId = id || uuid();
    let _d3cola = null;
    let _setcola_nodes;
    const _dispatch = (globalThis.d3?.dispatch || dispatch)('tick', 'start', 'end');
    let _flowLayout;
    // node and edge objects shared with cola.js, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    const _nodes = {}, _edges = {};
    let _options;

    function init(options) {
        _options = options;
        _d3cola = cola.d3adaptor(globalThis.d3)
            .avoidOverlaps(true)
            .size([options.width, options.height])
            .handleDisconnected(options.handleDisconnected);

        if (_d3cola.tickSize) // non-standard
            _d3cola.tickSize(options.tickSize);

        switch (options.lengthStrategy) {
            case 'symmetric':
                _d3cola.symmetricDiffLinkLengths(options.baseLength);
                break;
            case 'jaccard':
                _d3cola.jaccardLinkLengths(options.baseLength);
                break;
            case 'individual':
                _d3cola.linkDistance(e => e.dcg_edgeLength || options.baseLength);
                break;
        }
        if (options.flowLayout) {
            _d3cola.flowLayout(options.flowLayout.axis, options.flowLayout.minSeparation);
        }
    }

    function data(nodes, edges, clusters, constraints) {
        let wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.dcg_nodeParentCluster = v.dcg_nodeParentCluster;
            v1.width = v.width;
            v1.height = v.height;
            v1.fixed = !!v.dcg_nodeFixed;
            _options.nodeAttrs.forEach(key => {
                v1[key] = v[key];
            });

            if (v1.fixed && typeof v.dcg_nodeFixed === 'object') {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            } else {
                // should we support e.g. null to unset x,y?
                if (v.x !== undefined)
                    v1.x = v.x;
                if (v.y !== undefined)
                    v1.y = v.y;
            }
        });
        const wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[e.dcg_edgeSource];
            e1.target = _nodes[e.dcg_edgeTarget];
            e1.dcg_edgeLength = e.dcg_edgeLength;
            _options.edgeAttrs.forEach(key => {
                e1[key] = e[key];
            });
        });

        // cola needs each node object to have an index property
        wnodes.forEach((v, i) => {
            v.index = i;
        });

        let groups = null;
        if (engine.groupConnected()) {
            const components = cola.separateGraphs(wnodes, wedges);
            groups = components.map(g => ({
                dcg_autoGroup: true,
                leaves: g.array.map(n => n.index),
            }));
        } else if (clusters) {
            const G = {};
            groups = clusters.filter(c => /^cluster/.test(c.dcg_clusterKey)).map((c, i) =>
                G[c.dcg_clusterKey] = {
                    dcg_clusterKey: c.dcg_clusterKey,
                    index: i,
                    groups: [],
                    leaves: [],
                }
            );
            clusters.forEach(c => {
                if (c.dcg_clusterParent && G[c.dcg_clusterParent])
                    G[c.dcg_clusterParent].groups.push(G[c.dcg_clusterKey].index);
            });
            wnodes.forEach((n, i) => {
                if (n.dcg_nodeParentCluster && G[n.dcg_nodeParentCluster])
                    G[n.dcg_nodeParentCluster].leaves.push(i);
            });
        }

        function dispatchState(event) {
            // Get the actual nodes that WebCola is working with and make copies
            const currentNodes = _d3cola.nodes().map(n => {
                const copy = Object.assign({}, n);
                // clean up extra setcola annotations from the copy
                Object.keys(copy).forEach(key => {
                    if (/^get/.test(key) && typeof copy[key] === 'function')
                        delete copy[key];
                });
                return copy;
            });
            _dispatch.call(
                event,
                null,
                currentNodes,
                wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})),
                groups.filter(g => !g.dcg_autoGroup).map(g => {
                    g = Object.assign({}, g);
                    g.bounds = {
                        left: g.bounds.x,
                        top: g.bounds.y,
                        right: g.bounds.X,
                        bottom: g.bounds.Y,
                    };
                    return g;
                }),
                _setcola_nodes,
            );
        }
        _d3cola.on('tick', /* _tick = */ () => {
            dispatchState('tick');
        }).on('start', () => {
            _dispatch.call('start');
        }).on('end', /* _done = */ () => {
            dispatchState('end');
        });

        if (_options.setcolaSpec && typeof setcola !== 'undefined') {
            console.log('generating setcola constrains');
            const setcola_result = setcola
                .nodes(wnodes)
                .links(wedges)
                .constraints(_options.setcolaSpec)
                .gap(10) // default value is 10, can be customized in setcolaSpec
                .layout();

            _setcola_nodes = setcola_result.nodes.filter(n => n._cid);
            wnodes = setcola_result.nodes;
            _d3cola.nodes(setcola_result.nodes)
                .links(setcola_result.links)
                .constraints(setcola_result.constraints)
                .groups(groups);
        } else {
            _d3cola.nodes(wnodes)
                .links(wedges)
                .constraints(constraints)
                .groups(groups);
        }
    }

    function start() {
        _d3cola.start(
            engine.unconstrainedIterations(),
            engine.userConstraintIterations(),
            engine.allConstraintsIterations(),
            engine.gridSnapIterations(),
        );
    }

    function stop() {
        if (_d3cola)
            _d3cola.stop();
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
    graphviz.rankdir(null);

    const engine = Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'cola';
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
            this.propagateOptions(options);
            init(options);
            return this;
        },
        data(graph, nodes, edges, clusters, constraints) {
            data(nodes, edges, clusters, constraints);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return [
                'handleDisconnected',
                'lengthStrategy',
                'baseLength',
                'flowLayout',
                'tickSize',
                'groupConnected',
                'setcolaSpec',
                'setcolaNodes',
                'unconstrainedIterations',
                'userConstraintIterations',
                'allConstraintsIterations',
                'gridSnapIterations',
            ]
                .concat(graphviz_keys);
        },
        passThru() {
            return ['extractNodeAttrs', 'extractEdgeAttrs'];
        },
        propagateOptions(options) {
            if (!options.nodeAttrs)
                options.nodeAttrs = Object.keys(engine.extractNodeAttrs());
            if (!options.edgeAttrs)
                options.edgeAttrs = Object.keys(engine.extractEdgeAttrs());
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
        /**
         * Instructs cola.js to fit the connected components.
         * @method handleDisconnected
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Boolean} [handleDisconnected=true]
         * @return {Boolean}
         * @return {dc_graph.cola_layout}
         */
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
         */
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
         */
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
         */
        flowLayout(flow) {
            if (!arguments.length) {
                if (_flowLayout)
                    return _flowLayout;
                const dir = engine.rankdir();
                switch (dir) {
                    case 'LR':
                        return {
                            axis: 'x',
                            minSeparation: engine.ranksep()+engine.parent().nodeRadius()*2,
                        };
                    case 'TB':
                        return {
                            axis: 'y',
                            minSeparation: engine.ranksep()+engine.parent().nodeRadius()*2,
                        };
                    default:
                        return null; // RL, BT do not appear to be possible (negative separation) (?)
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
        groupConnected: property(false),
        setcolaSpec: property(null),
        setcolaNodes() {
            return _setcola_nodes;
        },
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({}),
        processExtraWorkerResults(setcolaNodes) {
            _setcola_nodes = setcolaNodes;
        },
    });
    return engine;
}

// Scripts needed for web worker
colaLayout.scripts = ['d3.js', 'cola.js'];
colaLayout.optionalScripts = ['setcola.js'];

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

onmessage = createWorkerHandler(colaLayout);
//# sourceMappingURL=dc.graph.cola.worker.js.map
