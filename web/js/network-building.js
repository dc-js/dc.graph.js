import { DataTable, renderAll } from 'dc';
import {
    deleteNodes,
    deleteThings,
    diagram,
    drawGraphs,
    engines,
    flatGroup,
    labelEdges,
    labelNodes,
    selectEdges,
    selectNodes,
    selectThingsGroup,
    spawnEngine,
} from './dc-graph.js';
import dcgraph_domain from './dc.graph.tracker.domain.js';
import sync_url_options from './sync-url-options.js';

const options = {
    rankdir: 'TB',
    layout: {
        default: 'dagre',
        values: engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: (val, diagram) => {
            const engine = spawnEngine(val);
            apply_engine_parameters(engine);
            diagram.layoutEngine(engine);
        },
    },
    shape: 'ellipse',
    worker: false,
};

const drawDiagram = diagram('#graph');
const sync_url = sync_url_options(options, dcgraph_domain(drawDiagram), drawDiagram);

const node_flat = flatGroup.make([], d => d.id),
    edge_flat = flatGroup.make([], d => d.id);

const engine = spawnEngine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
apply_engine_parameters(engine);

drawDiagram
    .width('auto')
    .height('auto')
    .restrictPan(true)
    .layoutEngine(engine)
    .transitionDuration(500)
    .stageTransitions('insmod')
    .modKeyZoom('Alt')
    .showLayoutSteps(false)
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .edgeSource(e => e.value.source)
    .edgeTarget(e => e.value.target)
    .nodeShape(sync_url.vals.shape || 'ellipse')
    .nodeLabel(n => n.value.label)
    .nodeStrokeWidth(0)
    .nodeFill('#001')
    .nodeLabelFill('#eee')
    .nodeLabelPadding({x: 4, y: 4})
    .nodeFixed(n => n.value.fixedPos)
    .edgeLabel(e => e.value.label || '')
    .edgeLength(e => {
        const e2 = drawDiagram.getWholeEdge(e.key);
        return 10+Math.hypot(e2.source.dcg_rx+e2.target.dcg_rx, e2.source.dcg_ry+e2.target.dcg_ry);
    })
    .edgeArrowhead('vee');

function apply_engine_parameters(engine) {
    switch (engine.layoutAlgorithm()) {
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

const select_nodes = selectNodes({
    nodeStroke: '#16b',
    nodeStrokeWidth: 5,
    nodeRadius: 22.5,
}).multipleSelect(false);

const select_edges = selectEdges({
    edgeStroke: 'darkgreen',
    edgeStrokeWidth: 2,
}).multipleSelect(false);

const label_nodes = labelNodes({class: 'node-label'}),
    label_edges = labelEdges({class: 'edge-label'});

const delete_nodes = deleteNodes()
    .crossfilterAccessor(_diagram => node_flat.crossfilter)
    .dimensionAccessor(_diagram => node_flat.dimension);

const delete_edges = deleteThings(
    selectThingsGroup('select-edges-group', 'select-edges'),
    'delete-edges',
)
    .crossfilterAccessor(_diagram => edge_flat.crossfilter)
    .dimensionAccessor(_diagram => edge_flat.dimension);

let timestamp = 0;
const add_object = d => {
    d.timestamp = timestamp++;
    return Promise.resolve(d);
};

const draw_graphs = drawGraphs({
    nodeCrossfilter: node_flat.crossfilter,
    edgeCrossfilter: edge_flat.crossfilter,
})
    .addNode(add_object)
    .addEdge(add_object)
    .hintStroke('#007acc');

drawDiagram
    .child('select-nodes', select_nodes)
    .child('select-edges', select_edges)
    .child('label-nodes', label_nodes)
    .child('label-edges', label_edges)
    .child('draw-graphs', draw_graphs)
    .child('delete-nodes', delete_nodes)
    .child('delete-edges', delete_edges);

// make node selection and edge selection mutually exclusive
const select_nodes_group = selectThingsGroup('select-nodes-group', 'select-nodes');
const select_edges_group = selectThingsGroup('select-edges-group', 'select-edges');
select_nodes_group.on('set_changed.show-info', nodes => {
    if (nodes.length)
        select_edges_group.call('set_changed', null, []); // selecting node clears selected edge
});
select_edges_group.on('set_changed.show-info', edges => {
    if (edges.length)
        select_nodes_group.call('set_changed', null, []); // selecting edge clears selected node
});

const nodeDim = node_flat.crossfilter.dimension(d => d.timestamp);
const _outnodes = new DataTable('#output-nodes-table')
    .dimension(nodeDim)
    .size(Infinity)
    .group(() => '')
    .sortBy(v => v.timestamp)
    .showGroups(false)
    .columns(['label']);

let node_labels = {};
const update_node_labels = () => {
    node_labels = node_flat.dimension.top(Infinity).reduce((p, v) => {
        p[v.id] = v.label;
        return p;
    }, {});
};

const edgeDim = edge_flat.crossfilter.dimension(d => d.timestamp);
const _outedges = new DataTable('#output-edges-table')
    .dimension(edgeDim)
    .size(Infinity)
    .group(() => '')
    .sortBy(e => `${node_labels[e.source]},${node_labels[e.target]}`)
    .showGroups(false)
    .on('preRender', update_node_labels)
    .on('preRedraw', update_node_labels)
    .columns([
        {
            label: 'Source',
            format: d => node_labels[d.source],
        },
        {
            label: 'Target',
            format: d => node_labels[d.target],
        },
        {
            label: 'Label',
            format: d => d.label,
        },
    ]);

renderAll();

// Trigger initial diagram render
await drawDiagram.render();
