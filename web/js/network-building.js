var qs = querystring.parse();

var node_flat = dc_graph.flat_group.make([], function(d) { return d.id; }),
    edge_flat = dc_graph.flat_group.make([], function(d) { return d.source + '-' + d.target; });

var diagram = dc_graph.diagram('#graph');

diagram
    .width(window.innerWidth)
    .height(window.innerHeight)
    .layoutAlgorithm('cola')
    .transitionDuration(500)
    .stageTransitions('insmod')
    .showLayoutSteps(false)
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .edgeSource(function(e) { return e.value.source; })
    .edgeTarget(function(e) { return e.value.target; })
    .nodeLabel(function(n) { return n.value.label; })
    .nodeFixed(function(n) { return n.value.fixedPos; })
    .edgeArrowhead('vee');

diagram.timeLimit(1000);


var draw_graphs = dc_graph.draw_graphs({
    nodeCrossfilter: node_flat.crossfilter,
    edgeCrossfilter: edge_flat.crossfilter
});

diagram.child('draw-graphs', draw_graphs);

dc.renderAll();
