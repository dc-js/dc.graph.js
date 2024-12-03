/**
 * `dc_graph.dynadag_layout` connects to dynagraph-wasm and does dynamic directed graph layout.
 * @class dynadag_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.dynadag_layout}
 **/
dc_graph.dynadag_layout = function(id) {
    var _layoutId = id || uuid();
    const _Gname = 'G';
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _tick, _done;
    var _nodes = {}, _edges = {};
    var _linesOut = [], _incrIn = [];
    var _lock = 0;

    function runCommands(cmds) {
        for(const cmd of cmds) {
            const {action, kind} = cmd;
            switch(`${action}_${kind}`) {
                case 'open_graph':
                    break;
                case 'modify_graph':
                    break;
                case 'close_graph':
                    break;
                case 'insert_node': {
                    const {node, attrs} = cmd;
                    break;
                }
                case 'modify_node': {
                    const {node, attrs} = cmd;
                    break;
                }
                case 'delete_node': {
                    const {node} = cmd;
                    break;
                }
                case 'insert_edge': {
                    const {edge, attrs} = cmd;
                    break;
                }
                case 'modify_edge': {
                    const {edge, attrs} = cmd;
                    break;
                }
                case 'delete_edge': {
                    const {edge} = cmd;
                    break;
                }
            }
        }
    }
    function receiveIncr(text) {
        const cmds = window.parseIncrface();
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
    }

    function init(options) {
        window.Module.print = receiveIncr;
    }

    function mquote(x) {
        return dc.utils.isNumber(x) ? x : '"' + x + '"';
    }

    function node_attrs(n) {
        const attr_pairs = [];
        if(n.x !== undefined && n.y !== undefined)
            attr_pairs.push(['pos', [n.x, n.y].map(String).join(',')]);
        return attr_pairs
    }

    function print_incr_attrs(attr_pairs) {
        return '[' + attr_pairs.map(([a,b]) => `${a}=${mquote(b)}`).join(', ') + ']';
    }

    function data(nodes, edges, clusters) {
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
            const na = node_attrs(v1);
            if(na.length)
                _linesOut.push(`modify node ${_Gname} ${v1.dcg_nodeKey} ${print_incr_attrs(node_attrs(v1))}`);
        }, function create(k, o) {
            _linesOut.push(`insert node ${_Gname} ${k} ${print_incr_attrs(node_attrs(v1))}`);
        }, function destroy(k) {
            _linesOut.push(`delete node ${_Gname} ${k}`);
        });
        var wedges = regenerate_objects(_edges, edges, null, function key(e) {
            return e.dcg_edgeKey;
        }, function assign(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, function create(k, o, e) {
            _linesOut.push(`insert edge ${_Gname} ${k} ${e.dcg_edgeSource} ${e.dcg_edgeTarget} ${print_incr_attrs(edge_attrs(e))}`);
        }, function destroy(k, e) {
            _linesOut.push(`delete edge ${_Gname} ${k}`);
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

    function start() {
        if(_linesOut.length) {
            if(_linesOut.length > 1)
                _linesOut = [
                    `lock graph ${_Gname}`,
                    ..._linesOut,
                    `unlock graph ${_Gname}`
                ];
            window.incrface_input = _linesOut.join('\n');
            _linesOut = [];
        }
        _dispatch.end(_nodes, _edges);
    }

    function stop() {
    }

    var layout = {
        layoutAlgorithm: function() {
            return 'dynadag';
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
        populateLayoutNode: function(layout, node) {
            if(this.rowFunction())
                layout.dcg_rank = this.rowFunction.eval(node);
        },
        populateLayoutEdge: function() {}
    };
    return layout;
};

dc_graph.tree_layout.scripts = [];
