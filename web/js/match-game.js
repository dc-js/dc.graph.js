var data = d3.range(7).map(function(i) {
    return {
        id: 'a' + i,
        label: String.fromCharCode(97+i),
        x: 100,
        y: i*100+50
    };
}).concat(d3.range(9).map(function(i) {
    return {
        id: 'b' + i,
        label: String.fromCharCode(48+i),
        x: 200,
        y: i*100+50
    };
}));

var node_flat = dc_graph.flat_group.make(data, n => n.id),
    edge_flat = dc_graph.flat_group.make([], e => e.id);

var diagram = dc_graph.diagram('#graph')
        .layoutEngine(dc_graph.manual_layout())
        .width(1000).height(1000)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group);

var drawGraphs = dc_graph.draw_graphs({
    idTag: 'id',
    sourceTag: 'sourcename',
    targetTag: 'targetname'
})
        .clickCreatesNodes(false)
        .edgeCrossfilter(edge_flat.crossfilter);

diagram.child('draw-graphs', drawGraphs);


dc.renderAll();

