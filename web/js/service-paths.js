function raw_node_type(n) {
    return n.label_.split(':')[2];
}

function node_type(n) {
    return raw_node_type(n.value);
}

function is_tree_edge(diagram, e) {
    return node_type(diagram.getNode(diagram.edgeSource()(e))) !==
        node_type(diagram.getNode(diagram.edgeTarget()(e)));
}

function is_root_node(n) {
    return node_type(n) === 'VNF';
}

var _rankmap = {
    VNF: 0,
    VFC: 1,
    VM: 2,
    Host: 3
};

var _colormap = {
    VNF: '#ff7f00',
    VFC: '#377eb8',
    VM: '#4daf4a',
    Host: '#984ea3'
};

function node_rank(n) {
    return _rankmap[node_type(n)];
}

var qs = querystring.parse();

var treeOnly = qs.treeOnly !== 'false',
    file = qs.file || null,
    paths = qs.paths || null;

if(!file)
    throw new Error('need a file');

var source = function(callback) {
    dc_graph.load_graph(file, callback);
};

function create_diagram(sel) {
    return dc_graph.diagram(sel)
        .width($(sel).width())
        .height($(sel).height());
}

function diagram_common(diagram, nodes, edges, nodekeyattr, sourceattr, targetattr) {
    var edge_flat = flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    diagram
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .parallelEdgeOffset(3)
        .timeLimit(10000)
        .transitionDuration(500)
        .stageTransitions('none')
        .showLayoutSteps(false)
        .edgeOpacity(0.2)
        .nodeOpacity(0.2)
        .edgeLabel(null)
        .induceNodes(true)
        .nodeLabel(null)
        .nodeTitle(function(n) { return n.value.name; })
        .nodeStrokeWidth(0)
        .nodeFill(function(n) {
            return _colormap[node_type(n)];
        })
    ;
}

source(function(error, data) {
    if(error) {
        console.log(error);
        return;
    }
    var graph_data = munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    var highlight_paths_hier = dc_graph.highlight_paths({ // path props
        nodeRadius: 25,
        nodeLabel: function(n) {
            return n.value.name;
        },
        edgeOpacity: 1,
        nodeOpacity: 1
    }, { // hover props
        nodeStroke: '#e41a1c',
        edgeStrokeWidth: 2,
        edgeStroke: '#e41a1c'
    });

    var diagram = create_diagram('#hierarchy');
    diagram_common(diagram, nodes, edges, nodekeyattr, sourceattr, targetattr);
    diagram
        .edgeArrowhead(null)
        .nodeRadius(2)
        .child('highlight-paths', highlight_paths_hier)
    ;
    diagram
        .initialLayout(dc_graph.tree_positions(null, node_rank, is_tree_edge.bind(null, diagram),
                                               25, 25, function(n) { return diagram.nodeRadius.eval(n) + diagram.nodePadding(); }, 100))
        .initialOnly(true)
    ;

    var bylayer = nodes.reduce(function(m, n) {
        var t = raw_node_type(n);
        (m[t] = m[t] || []).push(n);
        return m;
    }, {});

    var highlight_paths_level = dc_graph.highlight_paths({ // path props
        edgeOpacity: 1,
        nodeOpacity: 1,
        nodeRadius: 8,
        edgeArrowhead: 'vee'
    }, { // hover props
        nodeStroke: '#e41a1c',
        nodeStrokeWidth: 2,
        nodeRadius: 10,
        edgeStrokeWidth: 2,
        edgeStroke: '#e41a1c'
    });

    for(var type in bylayer) {
        var sel = '#' + type.toLowerCase();
        var dialev = create_diagram(sel);
        diagram_common(dialev, bylayer[type], edges, nodekeyattr, sourceattr, targetattr);
        dialev
            .edgeArrowSize(0.5)
            .nodeRadius(5)
            .parallelEdgeOffset(5)
            .edgeArrowhead(null)
            .baseLength(20)
            .lengthStrategy('symmetric')
            .child('highlight-paths', highlight_paths_level)
        ;
    }

    dc.renderAll();

    if(paths) {
        var read_paths = dc_graph.path_reader()
                .pathList(function(data) {
                    return data.results;
                }).elementList(function(path) {
                    return path.element_list;
                }).elementType(function(element) {
                    return element.element_type;
                }).nodeKey(function(element) {
                    return element.property_map.ecomp_uid;
                }).edgeSource(function(element) {
                    return element.property_map.source_ecomp_uid;
                }).edgeTarget(function(element) {
                    return element.property_map.target_ecomp_uid;
                });

        d3.json(paths, function(error, data) {
            if(error)
                throw new Error(error);
            var i = 0;
            read_paths.data(data);
        });
    }
});
