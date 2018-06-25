/*!
 *  metagraph.js 0.0.6
 *  http://gordonwoodhull.github.io/metagraph.js/
 *  Copyright 2017 AT&T Intellectual Property
 *
 *  Licensed under the MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a
 *  copy of this software and associated documentation files (the "Software"),
 *  to deal in the Software without restriction, including without limitation
 *  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *  and/or sell copies of the Software, and to permit persons to whom the
 *  Software is furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 *  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *  DEALINGS IN THE SOFTWARE.
 */

(function() { function _metagraph() {
'use strict';

var metagraph = {
    version: '0.0.6'
};
var mg = metagraph;

function object_to_keyvalue(o) {
    return Object.keys(o).map(function(key) {
        return {key: key, value: o[key]};
    });
}

function build_index(vals, keyf, wrap) {
    return vals.reduce(function(o, val) {
        o[keyf(val)] = wrap(val);
        return o;
    }, {});
}

metagraph.graph = function(nodes, edges, options) {
    if(!Array.isArray(nodes))
        nodes = object_to_keyvalue(nodes);
    if(!Array.isArray(edges))
        edges = object_to_keyvalue(edges);
    options = Object.assign({
        nodeKey: function(kv) { return kv.key; },
        edgeKey: function(kv) { return kv.key; },
        nodeValue: function(kv) { return kv.value; },
        edgeValue: function(kv) { return kv.value; },
        edgeSource: function(kv) { return kv.value.source; },
        edgeTarget: function(kv) { return kv.value.target; }
    }, options || {});

    var _nodeIndex, _edgeIndex, _nodesList, _edgesList, _outsList, _insList;

    function build_node_index() {
        if(_nodeIndex)
            return;
        _nodeIndex = build_index(nodes, options.nodeKey, node_wrapper);
    }
    function build_edge_index() {
        if(_edgeIndex)
            return;
        _edgeIndex = build_index(edges, options.edgeKey, edge_wrapper);
    }
    function build_nodes_list() {
        if(_nodesList)
            return;
        build_node_index();
        _nodesList = nodes.map(function(v) { return _graph.node(options.nodeKey(v)); });
    }
    function build_edges_list() {
        if(_edgesList)
            return;
        build_edge_index();
        _edgesList = edges.map(function(v) { return _graph.edge(options.edgeKey(v)); });
    }
    function build_directional_edge_lists(acc) {
        build_edge_index();
        return edges.reduce(function(o, v) {
            var l = o[acc(v)] = o[acc(v)] || [];
            l.push(_graph.edge(options.edgeKey(v)));
            return o;
        }, {});
    }
    function build_outs_index() {
        if(_outsList)
            return;
        _outsList = build_directional_edge_lists(options.edgeSource);
    }
    function build_ins_index() {
        if(_insList)
            return;
        _insList = build_directional_edge_lists(options.edgeTarget);
    }
    function node_wrapper(n) {
        return {
            value: function() {
                return options.nodeValue(n);
            },
            key: function() {
                return options.nodeKey(n);
            },
            graph: function() {
                return _graph;
            },
            outs: function() {
                build_outs_index();
                return _outsList[options.nodeKey(n)] || [];
            },
            ins: function() {
                build_ins_index();
                return _insList[options.nodeKey(n)] || [];
            }
        };
    }
    function edge_wrapper(e) {
        return {
            value: function() {
                return options.edgeValue(e);
            },
            key: function() {
                return options.edgeKey(e);
            },
            graph: function() {
                return _graph;
            },
            source: function() {
                return _graph.node(options.edgeSource(e));
            },
            target: function() {
                return _graph.node(options.edgeTarget(e));
            }
        };
    }
    var _graph = {
        node: function(key) {
            build_node_index();
            return _nodeIndex[key];
        },
        edge: function(key) {
            build_edge_index();
            return _edgeIndex[key];
        },
        nodes: function() {
            build_nodes_list();
            return _nodesList;
        },
        edges: function() {
            build_edges_list();
            return _edgesList;
        }
    };
    return _graph;
}


metagraph.dataflow = function(spec, options) {
    var flow = mg.graph(spec.nodes, spec.edges, options);
    return {
        calc: function(id) {
            var that = this;
            var n = flow.node(id);
            if(!n.value().result)
                n.value().result = n.value().calc.apply(null, n.ins().map(function(e) {
                    return that.calc(e.source().key());
                }));
            return n.value().result;
        }
    };
};

/**
 * The reason there are so many higher-order functions is that there are five
 * stages of a pattern's life:
 * - specification - the pattern author specifies a pattern by calling lookup and
 *   friends. the pattern make take options with accessors for reading raw array data
 * - definition (compilation) - the pattern walks the resulting graph and
 *   defines the functions that will respond to data
 * - instantiation - data is provided to the pattern to create objects
 * - binding - if the action needs other indices built, they are built on demand
 *   and provided to the action before it's run (*)
 * - action - responding to user code
 * (*) for buildIndex, the binding and action happen in one step. members first
 * bind to the indices and return the function and responds to the user, in
 * order not to pollute the signature.
 **/
metagraph.pattern = function(spec) {
    var graph = mg.graph(spec.nodes, spec.edges);
    var defn = {node: {}, edge: {}, indices: {}};
    graph.nodes().forEach(function(node) {
        defn.node[node.key()] = {
            members: {}
        };
    });
    function resolve(deps, funfun) {
        return function(defn, impl, val) {
            var action = funfun(defn, impl, val);
            return function() {
                return action.apply(null, deps.map(function(dep) {
                    return defn.indices[dep](defn, impl);
                })).apply(null, arguments);
            };
        };
    }

    graph.edges().forEach(function(edge) {
        var ekey = edge.key(), evalue = edge.value();
        if(evalue.member.data) {
            var buind = evalue.member.data(edge);
            defn.indices[ekey] = function(defn, impl) {
                if(!impl.indices[ekey]) {
                    var args = [defn, impl], index;
                    if(evalue.deps) {
                        var deps = Array.isArray(evalue.deps) ? evalue.deps : [evalue.deps];
                        args = args.concat(deps.map(function(dep) {
                            return defn.indices[dep](defn, impl);
                        }));
                        index = buind.apply(null, args);
                    }
                    else index = buind(defn, impl);
                    impl.indices[ekey] = index;
                }
                return impl.indices[ekey];
            };
        }
        if(evalue.member.funfun) {
            var funfun = evalue.member.funfun(edge);
            var deps;
            if(evalue.member.data)
                deps = [ekey];
            else if(evalue.deps)
                deps = Array.isArray(evalue.deps) ? evalue.deps : [evalue.deps];
            funfun = deps ? resolve(deps, funfun) : funfun;
            defn.node[edge.source().key()].members[evalue.name] = funfun;
        }
    });
    graph.nodes().forEach(function(node) {
        var nkey = node.key(), nvalue = node.value();
        if(nvalue.data)
            defn.indices['node.' + nkey] = nvalue.data(node);
        defn.node[nkey].wrap = function(impl, val) {
            var wrapper = {};
            Object.keys(defn.node[nkey].members).forEach(function(member) {
                wrapper[member] = defn.node[nkey].members[member](defn, impl, val);
            });
            // these two seem somewhat specific; should *_type also contribute to interface?
            if(nvalue.keyFunction)
                wrapper.key = function() {
                    return nvalue.keyFunction(val);
                };
            if(nvalue.valueFunction)
                wrapper.value = function() {
                    return nvalue.valueFunction(val);
                };
            return wrapper;
        };
    });

    return function(data) {
        var impl = {
            indices: {},
            objects: {},
            source_data: data
        };
        return {
            root: function(key) {
                var node = graph.node(key);
                if(!node)
                    throw new Error("'" + key + "' is not a type in this pattern");
                if(!graph.node(key).value().single)
                    throw new Error("the type '" + key + "' is not a root");
                if(!impl.objects[key])
                    impl.objects[key] = defn.node[node.key()].wrap(impl, data[node.key()]);
                return impl.objects[key];
            }
        };
    };
};

metagraph.basic_type = function() {
    return {
        single: false
    };
};
metagraph.single_type = function() {
    return Object.assign(mg.basic_type(), {
        single: true
    });
};
metagraph.table_type = function(keyf, valuef) {
    return Object.assign(mg.basic_type(), {
        keyFunction: keyf,
        valueFunction: valuef,
        data: function(node) {
            return function(defn, impl) {
                return impl.source_data[node.key()];
            };
        }
    });
};

metagraph.lookup = function() {
    return {
        data: function(edge) {
            return function(defn, impl, data) {
                return build_index(data,
                                   edge.target().value().keyFunction,
                                   defn.node[edge.target().key()].wrap.bind(null, impl));
            };
        },
        funfun: function(edge) {
            return function(defn, impl, val) {
                return function(index) {
                    return function(key) {
                        return index[key];
                    };
                };
            };
        }
    };
};
metagraph.one = function() {
    return {
        funfun: function(edge) {
            return function(defn, impl, val) {
                return function() {
                    return impl.objects[edge.target().key()];
                };
            };
        }
    };
};
metagraph.list = function() {
    return {
        data: function(edge) {
            return function(defn, impl, data, index) {
                return data.map(function(val) {
                    return index[edge.target().value().keyFunction(val)];
                });
            };
        },
        funfun: function(edge) {
            return function(defn, impl, val) {
                return function(list) {
                    return function() {
                        return list;
                    };
                };
            };
        }
    };
};
metagraph.lookupFrom = function(access) {
    return {
        funfun: function(edge) {
            return function(defn, impl, val) {
                return function(index) {
                    return function() {
                        return index[access(val)];
                    };
                };
            };
        }
    };
};
metagraph.listFrom = function(access) {
    return {
        data: function(edge) {
            return function(defn, impl, data, index) {
                return data.reduce(function(o, v) {
                    var key = access(v);
                    var list = o[key] = o[key] || [];
                    list.push(index[edge.target().value().keyFunction(v)]);
                    return o;
                }, {});
            };
        },
        funfun: function(edge) {
            return function(defn, impl, val) {
                return function(index) {
                    return function() {
                        return index[edge.source().value().keyFunction(val)] || [];
                    };
                };
            };
        }
    };
}

metagraph.graph_pattern = function(options) {
    options = Object.assign({
        nodeKey: function(kv) { return kv.key; },
        edgeKey: function(kv) { return kv.key; },
        nodeValue: function(kv) { return kv.value; },
        edgeValue: function(kv) { return kv.value; },
        edgeSource: function(kv) { return kv.value.source; },
        edgeTarget: function(kv) { return kv.value.target; }
    }, options || {});

    return {
        nodes: {
            Graph: mg.single_type(),
            Node: mg.table_type(options.nodeKey, options.nodeValue),
            Edge: mg.table_type(options.edgeKey, options.edgeValue)
        },
        edges: {
            graph_node: {
                name: 'node',
                source: 'Graph', target: 'Node',
                deps: 'node.Node',
                member: mg.lookup()
            },
            node_graph: {
                name: 'graph',
                source: 'Node', target: 'Graph',
                member: mg.one()
            },
            graph_nodes: {
                name: 'nodes',
                source: 'Graph', target: 'Node',
                deps: ['node.Node', 'graph_node'],
                member: mg.list()
            },
            graph_edge: {
                name: 'edge',
                source: 'Graph', target: 'Edge',
                deps: 'node.Edge',
                member: mg.lookup()
            },
            edge_graph: {
                name: 'graph',
                source: 'Edge', target: 'Graph',
                member: mg.one()
            },
            graph_edges: {
                name: 'edges',
                source: 'Graph', target: 'Edge',
                deps: ['node.Edge', 'graph_edge'],
                member: mg.list()
            },
            edge_source: {
                name: 'source',
                source: 'Edge', target: 'Node',
                deps: 'graph_node',
                member: mg.lookupFrom(options.edgeSource)
            },
            node_outs: {
                name: 'outs',
                source: 'Node', target: 'Edge',
                deps: ['node.Edge', 'graph_edge'],
                member: mg.listFrom(options.edgeSource)
            },
            edge_target: {
                name: 'target',
                source: 'Edge', target: 'Node',
                deps: 'graph_node',
                member: mg.lookupFrom(options.edgeTarget)
            },
            node_ins: {
                name: 'ins',
                source: 'Node', target: 'Edge',
                deps: ['node.Edge', 'graph_edge'],
                member: mg.listFrom(options.edgeTarget)
            }
        }};
};

metagraph.topological_sort = function(graph) {
    // https://en.wikipedia.org/wiki/Topological_sorting#Depth-first_search
    var stacked = {}, marked = {}, sorted = [];
    function visit(n) {
        if(stacked[n.key()])
            throw new Error('not a DAG');
        if(!marked[n.key()]) {
            stacked[n.key()] = true;
            n.outs().forEach(function(e) {
                visit(e.target());
            });
            marked[n.key()] = true;
            stacked[n.key()] = false;
            sorted.unshift(n);
        }
    }
    var i = 0;
    while(Object.keys(marked).length < graph.nodes().length) {
        while(marked[graph.nodes()[i].key()]) ++i;
        visit(graph.nodes()[i]);
    }
    return sorted;
};


return metagraph;
}
    if (typeof define === 'function' && define.amd) {
        define([], _metagraph);
    } else if (typeof module == "object" && module.exports) {
        module.exports = _metagraph();
    } else {
        this.metagraph = _metagraph();
    }
}
)();

//# sourceMappingURL=metagraph.js.map