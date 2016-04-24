function node_type(label) {
    return label.split(':')[2];
}

function is_tree_edge(diagram, e) {
    return node_type(diagram.getNode(diagram.edgeSource()(e)).value.label_) !==
        node_type(diagram.getNode(diagram.edgeTarget()(e)).value.label_);
}

function is_root_node(n) {
    return node_type(n.value.label_) === 'VNF';
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
    return _rankmap[node_type(n.value.label_)];
}

var qs = querystring.parse();

var stage = 'none',
    appLayout = 'vfc',
    useAppLayout = true,
    treeOnly = qs.treeOnly !== 'false',
    transition = 1000,
    showSteps = false,
    timeLimit = 10000,
    file = qs.file || null,
    paths = qs.paths || null;

if(!file)
    throw new Error('need a file');

var diagram = dc_graph.diagram('#hierarchy'), runner;

var source = function(callback) {
    dc_graph.load_graph(file, callback);
};

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
        .parallelEdgeOffset(1)
        .timeLimit(timeLimit)
        .transitionDuration(transition)
        .stageTransitions(stage)
        .showLayoutSteps(showSteps)
        .edgeOpacity(0.2)
        .nodeOpacity(0.2)
        .edgeLabel(null)
        .induceNodes(true)
        .nodeLabel(null)
        .nodeTitle(function(n) { return n.value.name; })
        .nodeStrokeWidth(0)
        .nodeFill(function(n) {
            return _colormap[node_type(n.value.label_)];
        })
    ;
}

function level_diagram(sel, sourceattr, targetattr) {
    var dialev = dc_graph.diagram(sel);
    diagram_common(dialev, sourceattr, targetattr);
    dialev
        .edgeArrowhead(function(kv) {
            return kv.value.undirected ? null : 'vee';
        })
        .edgeArrowSize(0.5)
        .linkLength(50)
        .lengthStrategy('symmetric')
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

    var highlight_paths = dc_graph.highlight_paths(
        { // path props
            edgeOpacity: 1,
            nodeOpacity: 1
        }, { // hover props
            nodeStroke: '#e41a1c',
            nodeStrokeWidth: 2,
            nodeRadius: 6,
            edgeStrokeWidth: 2,
            edgeStroke: '#e41a1c'
        }).pathList(function(data) { // this api is a bit excessive?
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
        })
    ;
    diagram_common(diagram, nodes, edges, nodekeyattr, sourceattr, targetattr);
    diagram
        .width($('#hierarchy').width())
        .height($('#hierarchy').height())
        .edgeArrowhead(null)
        .nodeRadius(2)
        .child('highlight-paths', highlight_paths)
    ;
    diagram
        .initialLayout(dc_graph.tree_positions(null, node_rank, is_tree_edge.bind(null, diagram), 25, 25, 10, 100))
        .initialOnly(true)
    ;

    diagram.initLayoutOnRedraw(appLayout && useAppLayout);

    dc.renderAll();

    if(paths)
        d3.json(paths, function(error, data) {
            if(error)
                throw new Error(error);
            var i = 0;
            var highlight_paths = diagram.child('highlight-paths');
            highlight_paths.data(data);
            diagram.relayout().redraw();
        });
});
