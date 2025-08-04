/**
 * Dynagraph-wasm layout adaptor for dc.graph.js
 * @module dynagraph_layout
 */

import { dispatch } from 'd3-dispatch';
import { uuid, property } from './core.js';
import { regenerateObjects } from './generate_objects.js';
import { graphvizAttrs } from './graphviz_attrs.js';

/**
 * `dynagraphLayout` connects to dynagraph WebAssembly module and does dynamic directed graph layout.
 * @param {String} [id=uuid()] - Unique identifier
 * @param {String} [layout] - Layout algorithm name
 * @return {Object} dynagraph layout engine
 **/
export function dynagraphLayout(id, layout) {
    const _layoutId = id || uuid();
    const _Gname = _layoutId;
    let _layout = null;
    const _dispatch = (globalThis.d3?.dispatch || dispatch)('tick', 'start', 'end');
    let _tick, _done;
    const _nodes = {}, _edges = {};
    let _linesOut = [], _incrIn = [], _opened = false, _open_graph;
    let _lock = 0;



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

    function dg2incr_edge_attrs(_e) {
        return [];
    }

    function mq(x) { // maybe quote
        if(x === +x) // isNumber
            return x;
        else if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(x))
            return x;
        else return `"${  x  }"`;
    }

    function print_incr_attrs(attr_pairs) {
        return `[${  attr_pairs.map(([a,b]) => `${mq(a)}=${mq(b)}`).join(', ')  }]`;
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
                    if(_layout.verbose()) {
                        console.log('open graph', attrs);
                        console.log('open graph bb', bb)
                    }
                    bb = incr2dg_bb(attrs.bb)
                    if(_layout.verbose()) {
                        console.log('open graph bb', bb)
                    }
                    break;
                }
                case 'modify_graph': {
                    const {attrs} = cmd;
                    if(_layout.verbose()) {
                        console.log('modify graph', attrs);
                        console.log('modify graph bb', bb)
                    }
                    bb = incr2dg_bb(attrs.bb)
                    if(_layout.verbose()) {
                        console.log('modify graph bb', bb)
                    }
                    break;
                }
                case 'close_graph': {
                    if(_layout.verbose()) {
                        console.log('close graph');
                    }
                    break;
                }
                case 'insert_node': {
                    const {node, attrs} = cmd;
                    if(_layout.verbose()) {
                        console.log('insert node', node, attrs);
                        console.log('insert node2', _nodes[node])
                    }
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    if(_layout.verbose()) {
                        console.log('insert node3', _nodes[node])
                    }
                    break;
                }
                case 'modify_node': {
                    const {node, attrs} = cmd;
                    if(_layout.verbose()) {
                        console.log('modify node', node, attrs);
                        console.log('modify node2', _nodes[node])
                    }
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    if(_layout.verbose()) {
                        console.log('modify node3', _nodes[node])
                    }
                    break;
                }
                case 'delete_node': {
                    const {node} = cmd;
                    if(_layout.verbose()) {
                        console.log('delete node', node);
                    }
                    break;
                }
                case 'insert_edge': {
                    const {edge, source, target, attrs} = cmd;
                    if(_layout.verbose()) {
                        console.log('insert edge', edge, source, target, attrs);
                        console.log('insert edge2', _edges[edge])
                    }
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    if(_layout.verbose()) {
                        console.log('insert edge3', _edges[edge])
                    }
                    break;
                }
                case 'modify_edge': {
                    const {edge, attrs} = cmd;
                    if(_layout.verbose()) {
                        console.log('modify edge', edge, attrs);
                        console.log('modify edge2', _edges[edge])
                    }
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    if(_layout.verbose()) {
                        console.log('modify edge3', _edges[edge])
                    }
                    break;
                }
                case 'delete_edge': {
                    const {edge} = cmd;
                    if(_layout.verbose()) {
                        console.log('delete edge', edge);
                    }
                    break;
                }
            }
        }
    }
    function receiveIncr(text) {
        if(_layout.verbose()) {
            console.log(text);
        }
        let cmds = null;
        try {
            const parseIncrface = globalThis.parseIncrface || self.parseIncrface || (self.incrface && self.incrface.parse);
            if(!parseIncrface) {
                console.log('[DYNAGRAPH] parseIncrface not available, skipping');
                return;
            }
            cmds = parseIncrface(text);
        } catch(xep) {
            console.log('[DYNAGRAPH] incrface parse failed', xep);
        }
        if (!cmds) {
            return;
        }
        for(const cmd of cmds) {
            const {action, kind, graph} = cmd;
            if(action === 'message') {
                console.warn('[DYNAGRAPH] dynagraph message', cmd.message);
                continue;
            }
            if(graph !== _Gname) {
                console.warn('[DYNAGRAPH] graph name mismatch', _Gname, 'vs', graph);
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
                    if(_lock > 0) {
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
        _open_graph = `open graph ${mq(_Gname)} ${print_incr_attrs(dg2incr_graph_attrs())}`
    }

    function data(nodes, edges, _clusters) {
        const linesOutDeleteNode = [];
        const wnodes = regenerateObjects(_nodes, nodes, null,
        (v) => v.dcg_nodeKey, (v1, v) => {
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
        }, (k, o) => {
            _linesOut.push(`insert node ${mq(_Gname)} ${mq(k)} ${print_incr_attrs(dg2incr_node_attrs(o))}`);
        }, (k) => {
            linesOutDeleteNode.push(`delete node ${mq(_Gname)} ${mq(k)}`);
        });
        const wedges = regenerateObjects(_edges, edges, null, (e) => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, (k, o, e) => {
            _linesOut.push(`insert edge ${mq(_Gname)} ${mq(k)} ${mq(e.dcg_edgeSource)} ${mq(e.dcg_edgeTarget)} ${print_incr_attrs(dg2incr_edge_attrs(e))}`);
        }, (k, _e) => {
            _linesOut.push(`delete edge ${mq(_Gname)} ${k}`);
        });
        _linesOut.push(...linesOutDeleteNode);

        function dispatchState(event) {
            _dispatch.call(event, null,
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
        
        if(_linesOut.length) {
            const open = _opened ? [] : [_open_graph];
            _opened = true;
            const actions = _linesOut.length > 1 ? [
                `lock graph ${mq(_Gname)}`,
                ... _linesOut,
                `unlock graph ${mq(_Gname)}`
            ] : _linesOut;
            const input = [...open, ...actions].join('\n');
            if(_layout.verbose()) {
                console.log('dynagraph input:', input);
            }
            self.incrface_input = input;
            _linesOut = [];
        }
        else {
            _done();
        }
    }

    function stop() {
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
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach((option) => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges) {
            data(nodes, edges);
        },
        async start() {
            await start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return ['resolution', 'defaultsize', 'separation', 'verbose'];
        },
        populateLayoutNode(_layout, _node) {},
        populateLayoutEdge() {}
    };
    return _layout;
};

