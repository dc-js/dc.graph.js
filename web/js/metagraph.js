/*!
 *  metagraph.js 0.0.7
 *  http://gordonwoodhull.github.io/metagraph.js/
 *  Copyright 2019 AT&T Intellectual Property
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
    version: '0.0.7'
};
var mg = metagraph;

function as_array(a) {
    return !a && [] || (Array.isArray(a) ? a : [a]);
}

function as_keyvalue(o) {
    return !o && [] || (Array.isArray(o) ? o : Object.keys(o).map(function(key) {
        return {key: key, value: o[key]};
    }));
}

function build_map(vals, keyf, wrap) {
    return vals.reduce(function(o, val) {
        o[keyf(val)] = wrap(val);
        return o;
    }, {});
}

function graph_options(opts) {
    return Object.assign({
        nodeKey: function(kv) { return kv.key; },
        edgeKey: function(kv) { return kv.key; },
        nodeValue: function(kv) { return kv.value; },
        edgeValue: function(kv) { return kv.value; },
        edgeSource: function(kv) { return kv.value.source; },
        edgeTarget: function(kv) { return kv.value.target; }
    }, opts || {});
}
metagraph.graph = function(nodes, edges, opts) {
    nodes = as_keyvalue(nodes);
    edges = as_keyvalue(edges);
    var options = graph_options(opts);

    var _nodeMap, _edgeMap, _nodesList, _edgesList, _outsList, _insList;

    function build_node_map() {
        if(_nodeMap)
            return;
        _nodeMap = build_map(nodes, options.nodeKey, node_wrapper);
    }
    function build_edge_map() {
        if(_edgeMap)
            return;
        _edgeMap = build_map(edges, options.edgeKey, edge_wrapper);
    }
    function build_nodes_list() {
        if(_nodesList)
            return;
        build_node_map();
        _nodesList = nodes.map(function(v) { return _graph.node(options.nodeKey(v)); });
    }
    function build_edges_list() {
        if(_edgesList)
            return;
        build_edge_map();
        _edgesList = edges.map(function(v) { return _graph.edge(options.edgeKey(v)); });
    }
    function build_directional_edge_lists(acc) {
        build_edge_map();
        return edges.reduce(function(o, v) {
            var l = o[acc(v)] = o[acc(v)] || [];
            l.push(_graph.edge(options.edgeKey(v)));
            return o;
        }, {});
    }
    function build_outs_map() {
        if(_outsList)
            return;
        _outsList = build_directional_edge_lists(options.edgeSource);
    }
    function build_ins_map() {
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
                build_outs_map();
                return _outsList[options.nodeKey(n)] || [];
            },
            ins: function() {
                build_ins_map();
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
            build_node_map();
            return _nodeMap[key];
        },
        edge: function(key) {
            build_edge_map();
            return _edgeMap[key];
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
};

metagraph.graph_adjacency = metagraph.graph;
function incidence_options(opts) {
    var gropts = graph_options(opts);
    return Object.assign({
        nodeIncidences: n => n && (n.edges || n.ins || n.outs) || [],
        incidencesOutward: n => {
            var v = gropts.nodeValue(n);
            return !v /* doesn't matter */ || !!(v.edges || v.outs);
        }
    }, gropts);
}
metagraph.graph_incidence = function(nodes, opts) {
    nodes = as_keyvalue(nodes);
    var options = incidence_options(opts);
    var edges = [];
    function edge_value(outward, nk, ik) {
        return outward ? {
            source: nk,
            target: ik
        } : {
            source: ik,
            target: nk
        };
    }
    function edge_key(outward, nk, ik) {
        return outward ? nk + '-' + ik : ik + '-' + nk;
    }
    nodes.forEach(function(n) {
        var nk = options.nodeKey(n),
            outward = options.incidencesOutward(n);
        as_array(options.nodeIncidences(options.nodeValue(n)))
            .forEach(function(ik) {
                edges.push({
                    key: edge_key(outward, nk, ik),
                    value: edge_value(outward, nk, ik)
                });
            });
    });
    return mg.graph_adjacency(nodes, edges, opts);
};
metagraph.graph_detect = function(spec, opts) {
    if(spec.incidences)
        return mg.graph_incidence(spec.incidences, opts);
    else if(spec.nodes)
        return mg.graph_adjacency(spec.nodes, spec.edges, opts);
    throw new Error('did not recognize graph format');
};

metagraph.dataflow = function(spec, options) {
    var flowgraph = mg.graph_detect(spec, options);
    var _flow = {
        instantiate: function(instance, inputs) {
            var _inst = {
                _yes_i_am_really_dataflow: true,
                calc: function(id) {
                    if(!instance[id]) {
                        var n = flowgraph.node(id);
                        instance[id] = n.value().calc(_inst).apply(null, n.ins().map(function(e) {
                            return _inst.calc(e.source().key());
                        }));
                        console.assert(instance[id]);
                    }
                    return instance[id];
                },
                input: function(namespace, field) {
                    var input = inputs[namespace];
                    if(input._yes_i_am_really_dataflow)
                        return input.calc(field);
                    else return input[field];
                }
            };
            return _inst;
        }
    };
    return _flow;
};

/**
 * The reason there are so many higher-order functions is that there are five
 * stages of a pattern's life:
 * - specification - the pattern author specifies a pattern in terms of its dataflow and
 *   interface. the pattern is parameterized on user-supplied data accessors
 * - definition (compilation) - the pattern walks the resulting graph and
 *   defines the functions that will respond to data
 * - instantiation - data is provided to the pattern to create objects
 * - binding - if the action needs other indices built, they are built on demand
 *   and provided to the action before it's run
 * - action - responding to user code
 **/
metagraph.pattern = function(spec, flowspecs) {
    var flowspec = spec.dataflow && mg.graph_detect(spec.dataflow),
        interf = mg.graph_detect(spec.interface);
    var defn = {node: {}, edge: {}};

    interf.nodes().forEach(function(inode) {
        defn.node[inode.key()] = {
            members: {},
            class_members: {}
        };
    });
    function resolve(deps, funfun) {
        return function(defn, flow, val) {
            var action = funfun(defn, flow, val);
            return function() {
                return action.apply(null, deps.map(function(dep) {
                    var parts = dep.split('.');
                    if(parts.length > 1)
                        return flow.input(parts[0], parts[1]);
                    else
                        return flow.calc(dep);
                })).apply(null, arguments);
            };
        };
    }
    interf.edges().forEach(function(iedge) {
        var ekey = iedge.key(), evalue = iedge.value();
        var fs = flowspec || flowspecs[ekey.split('.')[0]];
        var action = evalue.member;
        if(action && action.funfun) {
            var funfun = action.funfun(fs, iedge, flowspecs);
            var deps = as_array(evalue.deps);
            funfun = resolve(deps, funfun);
            defn.node[iedge.source().key()].members[evalue.name] = {defn: funfun};
        }
    });
    interf.nodes().forEach(function(inode) {
        var nkey = inode.key(), nvalue = inode.value();
        var fs = flowspec || flowspecs[nkey.split('.')[0]];
        as_array(inode.value()).forEach(function(spec) {
            as_keyvalue(spec.class_members).forEach(function(cmemspec) {
                defn.node[nkey].class_members[cmemspec.key] = cmemspec.value(fs, inode);
            });
            as_keyvalue(spec.members).forEach(function(memspec) {
                var mem = memspec.value(fs, inode);
                defn.node[nkey].members[memspec.key] = {
                    accessor: mem.accessor,
                    defn: mem.defn
                };
            });
        });
        defn.node[nkey].wrap = function(flow, val) {
            var wrapper = {}, members = defn.node[nkey].members;
            Object.keys(members).forEach(function(name) {
                wrapper[name] = members[name].defn(defn, flow, val);
            });
            return wrapper;
        };
    });

    var inodes2 = interf.nodes().map(function(n) {
        var n2 = {key: n.key(), value: {}}, class_members = defn.node[n.key()].class_members;
        Object.keys(class_members).forEach(function(name) {
            n2.value[name] = class_members[name].defn(defn);
        });
        return n2;
    });
    var iedges2 = interf.edges().map(function(e) {
        var e2 = {
            key: e.key(),
            value: {
                source: e.source().key(),
                target: e.target().key()
            }
        };
    });
    return mg.graph(inodes2, iedges2);
};

function define_dataflow(flowspec, defn) {
    var flownodes = flowspec.nodes().map(function(fsn) {
        return {
            key: fsn.key(),
            value: {
                calc: fsn.value().node.calc(fsn)(defn)
            }
        };
    });
    return mg.dataflow({
        nodes: flownodes,
        edges: flowspec.edges().map(e => ({key: e.key(), value: e.value()}))
    });
}

metagraph.input = function(path) {
    return {
        calc: function(fnode) {
            path = path || fnode.key();
            var parts = path.split('.');
            var [namespace, name] = parts.length > 1 ? parts : ['data', path];
            return function(defn) {
                return function(flow) {
                    return function() {
                        return flow.input(namespace, name);
                    };
                };
            };
        }
    };
};
// pass-through
metagraph.output = function(name, namespace) {
    return {
        calc: function(fnode) {
            return function(defn) {
                return function(flow) {
                    return function(x) {
                        return x;
                    };
                };
            };
        }
    };
};
metagraph.map = function() {
    return {
        calc: function(fnode) {
            var iref = as_array(fnode.value().refs)[0];
            return function(defn) {
                return function(flow) {
                    return function(data) {
                        return build_map(data,
                                         defn.node[iref].members.key.accessor,
                                         defn.node[iref].wrap.bind(null, flow));
                    };
                };
            };
        }
    };
};
metagraph.singleton = function() {
    return {
        calc: function(fnode) {
            return function(defn) {
                return function(flow) {
                    return function() {
                        throw new Error('singleton not initialized');
                    };
                };
            };
        }
    };
};
metagraph.list = function() {
    return {
        calc: function(fnode) {
            var iref = as_array(fnode.value().refs)[0];
            return function(defn) {
                return function(flow) {
                    return function(data, map) {
                        return data.map(function(val) {
                            return map[defn.node[iref].members.key.accessor(val)];
                        });
                    };
                };
            };
        }
    };
};
metagraph.map_of_lists = function(accessor) {
    return {
        calc: function(fnode) {
            return function(defn) {
                return function(flow) {
                    return function(data, map) {
                        var iref = as_array(fnode.value().refs)[0];
                        return data.reduce(function(o, v) {
                            var key = accessor(v);
                            var list = o[key] = o[key] || [];
                            list.push(map[defn.node[iref].members.key.accessor(v)]);
                            return o;
                        }, {});
                    };
                };
            };
        }
    };
};
metagraph.subset = function() {
    return {
        calc: function(fnode) {
            var iref = as_array(fnode.value().refs)[0];
            return function(defn) {
                return function(flow) {
                    return function(items, keys) {
                        var set = new Set(keys);
                        return items.filter(function(r) {
                            return set.has(defn.node[iref].members.key.accessor(r));
                        });
                    };
                };
            };
        }
    };
};

metagraph.createable = function(flowkey) {
    return {
        class_members: {
            create: function(flowspec, inode) {
                return {
                    defn: function(defn) {
                        var flowg = define_dataflow(flowspec, defn);
                        return function(data) {
                            var env = {};
                            var flow = flowg.instantiate(env, {data: data});
                            env[flowkey] = defn.node[inode.key()].wrap(flow, data[inode.key()]);
                            return env[flowkey];
                        };
                    }
                };
            }
        }
    };
};
metagraph.call = function(methodname) {
    return function(f) {
        return {
            members: [{
                key: methodname,
                value: function(flowspec, inode) {
                    return {
                        accessor: f,
                        defn: function(defn, flow, val) {
                            return function() {
                                return f(val);
                            };
                        }
                    };
                }
            }]
        };
    };
};
metagraph.key = mg.call('key');
metagraph.value = mg.call('value');

// interface edges
metagraph.reference = function(inode) {
    return {
        reference: inode
    };
};
metagraph.fetch = function() {
    return {
        funfun: function(flowspec, iedge) {
            return function(defn, flow) {
                return function(x) {
                    return function() {
                        return x;
                    };
                };
            };
        }
    };
};
metagraph.lookupArg = function(access) {
    return {
        funfun: function(flowspec, iedge) {
            access = access || (x => x);
            return function(defn, flow, val) {
                return function(map) {
                    return function(key) {
                        return map[access(key)];
                    };
                };
            };
        }
    };
};
metagraph.lookupFVal = function(access) {
    return {
        funfun: function(flowspec, iedge) {
            return function(defn, flow, val) {
                return function(map) {
                    return function() {
                        return map[access(val)];
                    };
                };
            };
        }
    };
};
metagraph.lookupKVal = function() {
    return {
        funfun: function(flowspec, iedge) {
            return function(defn, flow, val) {
                return function(map) {
                    return function() {
                        return map[defn.node[iedge.source().key()].members.key.accessor(val)] || [];
                    };
                };
            };
        }
    };
};
metagraph.subgraph = function() {
    return {
        funfun: function(flowspec, iedge, flowspecs) {
            return function(defn, flow, val) {
                var subflow = define_dataflow(flowspec, defn), graflow = subflow;
                var parts = iedge.target().key().split('.');
                if(parts.length > 1) {
                    var dest = parts[0];
                    graflow = define_dataflow(flowspecs[dest], defn);
                }
                return function() {
                    return function(nodeKeys, edgeKeys, gdata) {
                        // two environments, one for the sub-pattern and one for the graph pattern
                        var sgflow = subflow.instantiate({}, {
                            data: {
                                nodeKeys: nodeKeys,
                                edgeKeys: edgeKeys
                            },
                            parent: flow});
                        var genv = {};
                        var gflow = graflow.instantiate(genv, {
                            data: sgflow
                        });
                        genv.graph = defn.node[iedge.target().key()].wrap(gflow, gdata);
                        return genv.graph;
                    };
                };
            };
        }
    };
};


metagraph.graph_pattern = function(opts) {
    var options = graph_options(opts);
    return {
        dataflow: {
            incidences: {
                nodes: {node: mg.input()},
                edges: {node: mg.input()},
                node_by_key: {
                    node: mg.map(),
                    refs: 'Node',
                    ins: 'nodes'
                },
                edge_by_key: {
                    node: mg.map(),
                    refs: 'Edge',
                    ins: 'edges'
                },
                graph: {node: mg.singleton()},
                node_list: {
                    node: mg.list(),
                    refs: 'Node',
                    ins: ['nodes', 'node_by_key']
                },
                edge_list: {
                    node: mg.list(),
                    refs: 'Edge',
                    ins: ['edges', 'edge_by_key']
                },
                node_outs: {
                    node: mg.map_of_lists(options.edgeSource),
                    refs: 'Node',
                    ins: ['edges', 'edge_by_key']
                },
                node_ins: {
                    node: mg.map_of_lists(options.edgeTarget),
                    refs: 'Node',
                    ins: ['edges', 'edge_by_key']
                }
            }
        },
        interface: {
            nodes: {
                Graph: mg.createable('graph'),
                Node: [mg.key(options.nodeKey), mg.value(options.nodeValue)],
                Edge: [mg.key(options.edgeKey), mg.value(options.edgeValue)]
            },
            edges: {
                graph_node: {
                    name: 'node',
                    source: 'Graph', target: 'Node',
                    deps: 'node_by_key',
                    member: mg.lookupArg()
                },
                node_graph: {
                    name: 'graph',
                    source: 'Node', target: 'Graph',
                    deps: 'graph',
                    member: mg.fetch()
                },
                graph_nodes: {
                    name: 'nodes',
                    source: 'Graph', target: 'Node',
                    deps: 'node_list',
                    member: mg.fetch()
                },
                graph_edge: {
                    name: 'edge',
                    source: 'Graph', target: 'Edge',
                    deps: 'edge_by_key',
                    member: mg.lookupArg()
                },
                edge_graph: {
                    name: 'graph',
                    source: 'Edge', target: 'Graph',
                    deps: 'graph',
                    member: mg.fetch()
                },
                graph_edges: {
                    name: 'edges',
                    source: 'Graph', target: 'Edge',
                    deps: 'edge_list',
                    member: mg.fetch()
                },
                edge_source: {
                    name: 'source',
                    source: 'Edge', target: 'Node',
                    deps: 'node_by_key',
                    member: mg.lookupFVal(options.edgeSource)
                },
                edge_target: {
                    name: 'target',
                    source: 'Edge', target: 'Node',
                    deps: 'node_by_key',
                    member: mg.lookupFVal(options.edgeTarget)
                },
                node_outs: {
                    name: 'outs',
                    source: 'Node', target: 'Edge',
                    deps: 'node_outs',
                    member: mg.lookupKVal()
                },
                node_ins: {
                    name: 'ins',
                    source: 'Node', target: 'Edge',
                    deps: 'node_ins',
                    member: mg.lookupKVal()
                }
            }
        }
    };
};

metagraph.subgraph_pattern = function(opts) {
    var options = graph_options(opts);
    return {
        dataflow: {
            incidences: {
                parent_nodes: {node: mg.input('parent.nodes')},
                parent_edges: {node: mg.input('parent.edges')},
                node_keys: {node: mg.input('nodeKeys')},
                edge_keys: {node: mg.input('edgeKeys')},
                subset_nodes: {
                    node: mg.subset(),
                    refs: 'child.Node',
                    ins: ['parent_nodes', 'node_keys']
                },
                subset_edges: {
                    node: mg.subset(),
                    refs: 'child.Edge',
                    ins: ['parent_edges', 'edge_keys']
                },
                nodes: {
                    node: mg.output(),
                    ins: 'subset_nodes'
                },
                edges: {
                    node: mg.output(),
                    ins: 'subset_edges'
                }
            }
        },
        interface: {
            nodes: {
                ParentGraph: 'parent.Graph',
                ChildGraph: 'child.Graph'
            },
            edges: {
                subgraph: {
                    name: 'subgraph',
                    source: 'ParentGraph', target: 'ChildGraph',
                    member: mg.subgraph()
                },
                subnode: {
                    name: 'subnode',
                    source: 'ParentGraph', target: 'ChildGraph',
                    deps: 'parent.node_by_key',
                    member: mg.lookupArg()
                },
                subedge: {
                    name: 'subedge',
                    source: 'ParentGraph', target: 'ChildGraph',
                    deps: 'parent.edge_by_key',
                    flow: mg.lookupArg()
                },
                subgraphS: {
                    name: 'subgraph',
                    source: 'ChildGraph', target: 'ParentGraph',
                    member: mg.subgraph()
                },
                subnodeS: {
                    name: 'subnode',
                    source: 'ChildGraph', target: 'ParentGraph',
                    deps: 'node_by_key', // should be child:
                    member: mg.lookupArg(x => x.key())
                },
                subedgeS: {
                    name: 'subedge',
                    source: 'ChildGraph', target: 'ParentGraph',
                    deps: 'edge_by_key', // should be child:
                    flow: mg.lookupArg(x => x.key())
                }
            }
        }
    };
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


metagraph.compose = function(composition) {
    var sorted = mg.topological_sort(composition);
    var built = {}, flowspecs = {};
    function input_edge(patnode, name) {
        return patnode.ins().find(pe => pe.value().input === name);
    }
    // resolve dependencies and build patterns
    sorted.forEach(function(patnode) {
        var flowspec = mg.graph_detect(patnode.value().dataflow);
        var fnodes = flowspec.nodes().map(function(fn) {
            var v2 = Object.assign({}, fn.value());
            v2.refs = as_array(v2.refs).map(function(ref) {
                var parts = ref.split('.');
                if(parts.length > 1) {
                    var patedge = input_edge(patnode, parts[0]);
                    return patedge.source().key() + '.' + parts[1];
                }
                else return patnode.key() + '.' + parts[0];
            });
            return {
                key: fn.key(),
                value: v2
            };
        });
        var fedges = flowspec.edges().map(e => ({key: e.key(), value: e.value()}));
        flowspecs[patnode.key()] = mg.graph(fnodes, fedges);
        var interf = patnode.value().interface;
        built[patnode.key()] = mg.graph_detect({
            nodes: interf.nodes,
            edges: interf.edges
        });
    });
    // unite patterns
    var nodes = [], edges = [], mappings = {};
    function lookup(key) {
        return mappings[key] || key;
    }
    sorted.forEach(function(patnode) {
        var pattern = built[patnode.key()];
        pattern.nodes().forEach(function(inode) {
            var key = patnode.key() + '.' + inode.key();
            var ref = as_array(inode.value()).find(spec => typeof spec === 'string');
            if(ref) {
                var parts = ref.split('.');
                var patedge = input_edge(patnode, parts[0]);
                var key2 = lookup(patedge.source().key() + '.' + parts[1]);
                mappings[key] = key2;
            }
            else nodes.push({
                key: key,
                value: inode.value()
            });
        });
        pattern.edges().forEach(function(iedge) {
            var val2 = Object.assign({}, iedge.value());
            val2.source = lookup(patnode.key() + '.' + iedge.source().key());
            val2.target = lookup(patnode.key() + '.' + iedge.target().key());
            edges.push({
                key: patnode.key() + '.' + iedge.key(),
                value: val2
            });
        });
    });
    return mg.pattern({
        interface: {
            nodes,
            edges
        }
    }, flowspecs);
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