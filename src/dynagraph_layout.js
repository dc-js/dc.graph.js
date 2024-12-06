/**
 * `dc_graph.dynagraph_layout` connects to dynagraph-wasm and does dynamic directed graph layout.
 * @class dynagraph_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.dynagraph_layout}
 **/
dc_graph.dynagraph_layout = function(id, layout) {
    var _layoutId = id || uuid();
    const _Gname = 'G';
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _tick, _done;
    var _nodes = {}, _edges = {};
    var _linesOut = [], _incrIn = [], _opened = false;
    var _lock = 0;



    // dg2incr
    function dg2incr_node_attrs(n) {
        const attr_pairs = [];
        if(n.x !== undefined && n.y !== undefined)
            attr_pairs.push(['pos', [n.x, n.y].map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_edge_attrs(e) {
        return [];
    }

    function mquote(x) {
        return dc.utils.isNumber(x) ? x : '"' + x + '"';
    }

    function print_incr_attrs(attr_pairs) {
        return '[' + attr_pairs.map(([a,b]) => `${a}=${mquote(b)}`).join(', ') + ']';
    }

    // incr2dg
    function incr2dg_coord(c) {
        const [x, y] = c.map(n => 15*n);
        return [x, -y];
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
            attrs.cola = {
                points: e.pos.split(' ')
                .map(coord => coord.split(',').map(Number))
                .map(incr2dg_coord)
                .map(([x,y]) => ({x,y}))
            };
        return attrs;
    }

    function runCommands(cmds) {
        for(const cmd of cmds) {
            const {action, kind} = cmd;
            switch(`${action}_${kind}`) {
                case 'open_graph': {
                    const {attrs} = cmd;
                    console.log('open graph', attrs);
                    break;
                }
                case 'modify_graph': {
                    const {attrs} = cmd;
                    console.log('modify graph', attrs);
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
        const cmds = window.parseIncrface(text);
        for(const cmd of cmds) {
            const {action, kind, graph} = cmd;
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
                        _done();
                    }
                    break;
                default:
                    if(_lock > 0)
                        _incrIn.push(cmd);
                    else
                        runCommands([cmd]);
            }
        }
    }

    function init(options) {
        window.receiveIncr = receiveIncr;    
        _opened = false;
    }

    function data(nodes, edges, clusters) {
        const linesOutDeleteNode = [];
        var wnodes = regenerate_objects(_nodes, nodes, null,
        function key(v) {
            return v.dcg_nodeKey;
        }, function assign(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            // v1.width = v.width;
            // v1.height = v.height;
            if(v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            }
            const na = dg2incr_node_attrs(v1);
            if(na.length)
                _linesOut.push(`modify node ${_Gname} ${v1.dcg_nodeKey} ${print_incr_attrs(na)}`);
        }, function create(k, o) {
            _linesOut.push(`insert node ${_Gname} ${k} ${print_incr_attrs(dg2incr_node_attrs(o))}`);
        }, function destroy(k) {
            linesOutDeleteNode.push(`delete node ${_Gname} ${k}`);
        });
        var wedges = regenerate_objects(_edges, edges, null, function key(e) {
            return e.dcg_edgeKey;
        }, function assign(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, function create(k, o, e) {
            _linesOut.push(`insert edge ${_Gname} ${k} ${e.dcg_edgeSource} ${e.dcg_edgeTarget} ${print_incr_attrs(dg2incr_edge_attrs(e))}`);
        }, function destroy(k, e) {
            _linesOut.push(`delete edge ${_Gname} ${k}`);
        });
        _linesOut.push(...linesOutDeleteNode);

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

    function start() {
        if(_linesOut.length) {
            const open = _opened ? [] : ['open graph G'];
            _opened = true;
            if(_linesOut.length > 1)
                _linesOut = [
                    ...open,
                    `lock graph ${_Gname}`,
                    ..._linesOut,
                    `unlock graph ${_Gname}`
                ];
            console.log(window.incrface_input = _linesOut.join('\n'));
            _linesOut = [];
        }
        _done();
    }

    function stop() {
    }

    var layout = {
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
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return [];
        },
        populateLayoutNode: function(layout, node) {},
        populateLayoutEdge: function() {}
    };
    return layout;
};

dc_graph.tree_layout.scripts = [];
