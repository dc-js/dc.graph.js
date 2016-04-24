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

function diagram_common(diagram, sourceattr, targetattr) {
    diagram
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .parallelEdgeOffset(1)
        .timeLimit(timeLimit)
        .transitionDuration(transition)
        .stageTransitions(stage)
        .showLayoutSteps(showSteps)
        .edgeOpacity(0.2)
        .edgeLabel(null)
        .induceNodes(true)
        .nodeLabel(null)
        .nodeTitle(function(n) { return n.value.name; })
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

    var edge_flat = flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    var highlight_paths = dc_graph.highlight_paths(
        { // path props
            edgeStroke: function(kv) {
                this.scale = this.scale ||
                    d3.scale.linear()
                    .domain([2268,3348])
                    .range([d3.hsl(0,0.8,0.5), d3.hsl(220,0.8,0.6)]);
                return this.scale(kv.value.inV);
            },
            edgeStrokeWidth: 2,
            edgeOpacity: 1,
            nodeFill: 'blue'
        }, { // hover props
            nodeStroke: 'red',
            nodeStrokeWidth: 3,
            nodeRadius: 10,
            nodeFill: 'green',
            edgeStrokeWidth: 5,
            edgeStroke: 'red'
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
    diagram_common(diagram, sourceattr, targetattr);
    diagram
        .width($('#hierarchy').width())
        .height($('#hierarchy').height())
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeArrowhead(null)
        .nodeRadius(1)
        .child('highlight-paths', highlight_paths)
    ;
    function rank(label) {
        return label.split(':')[2];
    }

    function is_tree_edge(diagram, e) {
        return rank(diagram.getNode(diagram.edgeSource()(e)).value.label_) !==
            rank(diagram.getNode(diagram.edgeTarget()(e)).value.label_);
    }

    function is_root_node(n) {
        return rank(n.value.label_) === 'VNF';
    }

    var _rowmap = {
        VNF: 0,
        VFC: 1,
        VM: 2,
        Host: 3
    };
    function node_row(n) {
        return _rowmap[rank(n.value.label_)];
    }

    diagram
        .initialLayout(dc_graph.tree_positions(null, node_row, is_tree_edge.bind(null, diagram), 50, 50, 10, 100))
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
