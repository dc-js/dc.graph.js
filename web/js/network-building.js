var qs = querystring.parse();

var node_flat = dc_graph.flat_group.make([], function(d) { return d.id; }),
    edge_flat = dc_graph.flat_group.make([], function(d) { return d.source + '-' + d.target; });

var diagram = dc_graph.diagram('#graph');
var engine = dc_graph.spawn_engine(qs.layout, qs, qs.worker != 'false');

diagram
    .width(window.innerWidth)
    .height(window.innerHeight)
    .layoutEngine(engine)
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

var select_nodes = dc_graph.select_nodes({
    nodeFill: '#eeffe0',
    nodeStrokeWidth: 2
}).multipleSelect(false);

var label_nodes = dc_graph.label_nodes({
    nodeCrossfilter: node_flat.crossfilter
});

var timestamp = 0;
function add_object(d) {
    d.timestamp = timestamp++;
}

var draw_graphs = dc_graph.draw_graphs({
    nodeCrossfilter: node_flat.crossfilter,
    edgeCrossfilter: edge_flat.crossfilter
}).addNode(add_object).addEdge(add_object);

diagram
    .child('select-nodes', select_nodes)
    .child('label-nodes', label_nodes)
    .child('draw-graphs', draw_graphs);

var nodeDim = node_flat.crossfilter.dimension(function(d) { return d.timestamp; });
var outnodes = dc.dataTable('#output-nodes')
        .dimension(nodeDim)
        .group(function() { return ''; })
        .showGroups(false)
        .columns(['label']);

function find_node_label(id) {
    var n = node_flat.dimension.top(Infinity).find(function(d) {
        return d.id === id;
    });
    return n ? n.label : '';
}

var edgeDim = edge_flat.crossfilter.dimension(function(d) { return d.timestamp; });
var outedges = dc.dataTable('#output-edges')
        .dimension(edgeDim)
        .group(function() { return ''; })
        .showGroups(false)
        .columns([
            {
                label: 'Source',
                format: function(d) {
                    return find_node_label(d.source);
                }
            },
            {
                label: 'Target',
                format: function(d) {
                    return find_node_label(d.target);
                }
            }
        ]);

dc.renderAll();
