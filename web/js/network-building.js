var options = {
    rankdir: 'TB',
    layout: {
        default: 'dagre',
        values: dc_graph.engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: function(val, diagram) {
            var engine = dc_graph.spawn_engine(val);
            apply_engine_parameters(engine);
            diagram
                .layoutEngine(engine);
        }
    },
    shape: 'ellipse',
    worker: true
};

var drawDiagram = dc_graph.diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(drawDiagram), drawDiagram);

var node_flat = dc_graph.flat_group.make([], function(d) { return d.id; }),
    edge_flat = dc_graph.flat_group.make([], function(d) { return d.id; });

var engine = dc_graph.spawn_engine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
apply_engine_parameters(engine);

drawDiagram
    .width('auto')
    .height('auto')
    .restrictPan(true)
    .layoutEngine(engine)
    .transitionDuration(500)
    .stageTransitions('insmod')
    .showLayoutSteps(false)
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .edgeSource(function(e) { return e.value.source; })
    .edgeTarget(function(e) { return e.value.target; })
    .nodeShape(sync_url.vals.shape || 'ellipse')
    .nodeLabel(function(n) { return n.value.label; })
    .nodeStrokeWidth(0)
    .nodeFill('#001')
    .nodeLabelFill('#eee')
    .nodeLabelPadding({x: 4, y: 4})
    .nodeFixed(function(n) { return n.value.fixedPos; })
    .edgeLabel(function(e) { return e.value.label || ''; })
    .edgeLength(function(e) {
        var e2 = drawDiagram.getWholeEdge(e.key);
        return 10 + Math.hypot(e2.source.dcg_rx + e2.target.dcg_rx, e2.source.dcg_ry + e2.target.dcg_ry);
    })
    .edgeArrowhead('vee');

function apply_engine_parameters(engine) {
    switch(engine.layoutAlgorithm()) {
    case 'd3v4-force':
        engine
            .collisionRadius(125)
            .gravityStrength(0.05)
            .initialCharge(-500);
        break;
    case 'd3-force':
        engine
            .gravityStrength(0.1)
            .linkDistance('auto')
            .initialCharge(-5000);
        break;
    case 'cola':
        engine.lengthStrategy('individual');
        break;
    }
    drawDiagram.initLayoutOnRedraw(engine.layoutAlgorithm() === 'cola');
    engine.rankdir(sync_url.vals.rankdir);
    return engine;
}

drawDiagram.timeLimit(1000);

var select_nodes = dc_graph.select_nodes({
    nodeStroke: '#16b',
    nodeStrokeWidth: 5,
    nodeRadius: 22.5
}).multipleSelect(false);

var select_edges = dc_graph.select_edges({
    edgeStroke: 'darkgreen',
    edgeStrokeWidth: 2
}).multipleSelect(false);

var label_nodes = dc_graph.label_nodes({class: 'node-label'}),
    label_edges = dc_graph.label_edges({class: 'edge-label'});

var delete_nodes = dc_graph.delete_nodes()
        .crossfilterAccessor(function(diagram) {
            return node_flat.crossfilter;
        })
        .dimensionAccessor(function(diagram) {
            return node_flat.dimension;
        });

var delete_edges = dc_graph.delete_things(
    dc_graph.select_things_group('select-edges-group', 'select-edges'),
    'delete-edges')
        .crossfilterAccessor(function(diagram) {
            return edge_flat.crossfilter;
        })
        .dimensionAccessor(function(diagram) {
            return edge_flat.dimension;
        });

var timestamp = 0;
function add_object(d) {
    d.timestamp = timestamp++;
    return Promise.resolve(d);
}

var draw_graphs = dc_graph.draw_graphs({
    nodeCrossfilter: node_flat.crossfilter,
    edgeCrossfilter: edge_flat.crossfilter
}).addNode(add_object).addEdge(add_object);

drawDiagram
    .child('select-nodes', select_nodes)
    .child('select-edges', select_edges)
    .child('label-nodes', label_nodes)
    .child('label-edges', label_edges)
    .child('draw-graphs', draw_graphs)
    .child('delete-nodes', delete_nodes)
    .child('delete-edges', delete_edges);

// make node selection and edge selection mutually exclusive
var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');
var select_edges_group = dc_graph.select_things_group('select-edges-group', 'select-edges');
select_nodes_group.on('set_changed.show-info', function(nodes) {
    if(nodes.length)
        select_edges_group.set_changed([]); // selecting node clears selected edge
});
select_edges_group.on('set_changed.show-info', function(edges) {
    if(edges.length)
        select_nodes_group.set_changed([]); // selecting edge clears selected node
});

var nodeDim = node_flat.crossfilter.dimension(function(d) { return d.timestamp; });
var outnodes = dc.dataTable('#output-nodes-table')
    .dimension(nodeDim)
    .size(Infinity)
    .group(function() { return ''; })
    .sortBy(function(v) { return  v.timestamp; })
    .showGroups(false)
    .columns(['label']);

var node_labels = {};
function update_node_labels() {
    node_labels = node_flat.dimension.top(Infinity).reduce(
        function(p, v) {
            p[v.id] = v.label;
            return p;
        }, {});
}

var edgeDim = edge_flat.crossfilter.dimension(function(d) { return d.timestamp; });
var outedges = dc.dataTable('#output-edges-table')
    .dimension(edgeDim)
    .size(Infinity)
    .group(function() { return ''; })
    .sortBy(function(e) {
        return node_labels[e.source] + ',' + node_labels[e.target];
    })
    .showGroups(false)
    .on('preRender', update_node_labels)
    .on('preRedraw', update_node_labels)
    .columns([
        {
            label: 'Source',
            format: function(d) {
                return node_labels[d.source];
            }
        },
        {
            label: 'Target',
            format: function(d) {
                return node_labels[d.target];
            }
        },
        {
            label: 'Label',
            format: function(d) {
                return d.label;
            }
        }
    ]);

dc.renderAll();
