import { engines, spawnEngine, applyGraphvizAccessors, diagram, loadGraphText, mungeGraph, dataUrl, flatGroup, drawClusters, moveNodes, fixNodes, tip, tipHtmlOrJsonTable, highlightNeighbors, loadGraph } from './dc-graph.js';
import sync_url_options from './sync-url-options.js';
import dcgraph_domain from './dc.graph.tracker.domain.js';
import { select } from 'd3-selection';
import { display_error, hide_error } from './graph-error.js';

const options = {
    layout: {
        default: 'cola',
        values: engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: (val, diagram) => {
            const engine = spawnEngine(val);
            apply_engine_parameters(engine);
            diagram
                .layoutEngine(engine)
                .autoZoom('once');
        }
    },
    worker: true,
    file: 'data/process.json',
    gvattr: {
        default: true,
        selector: '#graphviz-attrs',
        needs_redraw: 'refresh',
        exert: (val, diagram) => {
            if(val)
                applyGraphvizAccessors(simpleDiagram);
            else {
                simpleDiagram
                    .nodeFixed(n => n.value.fixedPos)
                    .nodeStrokeWidth(0)
                    .nodeFill(kv => '#2E54A2')
                    .nodeLabelPadding({x: 2, y: 0})
                    .nodeLabelFill('white')
                    .edgeArrowhead(sync_url.vals.arrows ? 'vee' : null);
            }
        }
    },
    cutoff: null,
    limit: {
        default: 0.5,
        selector: '#cutoff',
        needs_redraw: true,
        exert: (val, _, filters) => {
            if(filters.cutoff) {
                select('#cutoff-display').text(val);
                filters.cutoff.set(val);
            }
        }
    },
    datalink: false,
    arrows: false,
    tips: true,
    neighbors: true
};

const simpleDiagram = diagram('#graph');
const filters = {};
const sync_url = sync_url_options(options, dcgraph_domain(simpleDiagram), simpleDiagram, filters);

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
    }
    return engine;
}

select('#user-file').on('change', function() {
    const filename = this.value;
    if(filename) {
        const reader = new FileReader();
        reader.onload = e => {
            hide_error();
            loadGraphText(e.target.result, filename)
                .then(data => on_load(filename, null, data))
                .catch(error => on_load(filename, error, null));
        };
        reader.readAsText(this.files[0]);
    }
});

const url_output = sync_url.output();
let more_output;
sync_url.output(params => {
    url_output(params);
    if(more_output)
        more_output(params);
});

async function on_load(filename, error, data) {
    if(error) {
        let heading = '';
        if(error.status)
            heading = 'Error ' + error.status + ': ';
        heading += 'Could not load file ' + filename;
        display_error(heading, error.message);
        return;
    }

    let graph_data;
    try {
        graph_data = mungeGraph(data);
    }
    catch(xep) {
        console.log(xep);
        display_error(`Error munging ${filename}`, xep.message);
    }
    const nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    const update_data_link = () => {
        select('#data-link')
            .style('visibility', sync_url.vals.datalink ? 'visible' : 'hidden')
            .attr('href', sync_url.what_if_url({file: dataUrl({nodes: nodes, edges: edges})}));
    };
    more_output = update_data_link;
    update_data_link();

    const edge_key = d => d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    const edge_flat = flatGroup.make(edges, edge_key),
        node_flat = flatGroup.make(nodes, d => d[nodekeyattr]),
        cluster_flat = flatGroup.make(data.clusters || [], d => d.key);

    const engine = spawnEngine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
    simpleDiagram
        .layoutEngine(engine)
        .timeLimit(5000)
        .width('auto')
        .height('auto')
        .autoZoom('once')
        .restrictPan(true)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(e => e.value[sourceattr])
        .edgeTarget(e => e.value[targetattr])
        .clusterDimension(cluster_flat.dimension).clusterGroup(cluster_flat.group)
        .nodeParentCluster(data.node_cluster ? n => data.node_cluster[n.key] : null)
        .clusterParent(c => c.parent)
    // aesthetics
        .nodeTitle(null); // deactivate basic tooltips

    if(sync_url.vals.cutoff) {
        select('#cutoff-stuff').style('display', 'inline-block');
        const dim = edge_flat.crossfilter.dimension(d => +d[sync_url.vals.cutoff]);
        filters.cutoff = {
            set: v => dim.filterRange([v, Infinity])
        };
    }

    const drawClustersMode = drawClusters();
    simpleDiagram.child('draw-clusters', drawClustersMode);

    sync_url.exert();

    const moveNodesMode = moveNodes();
    simpleDiagram.child('move-nodes', moveNodesMode);

    const fixNodesMode = fixNodes()
        .strategy(fixNodes.strategy.lastNPerComponent(Infinity));
    simpleDiagram.child('fix-nodes', fixNodesMode);

    if(sync_url.vals.tips) {
        const tipMode = tip();
        const json_table = tipHtmlOrJsonTable()
            .json(d => (d.orig.value.value || d.orig.value).jsontip || JSON.stringify(d.orig.value));
        tipMode
            .showDelay(250)
            .content(json_table);
        simpleDiagram.child('tip', tipMode);
    }
    if(sync_url.vals.neighbors) {
        const highlightNeighborsMode = highlightNeighbors({
            edgeStroke: 'orangered',
            edgeStrokeWidth: 3
        }).durationOverride(0);
        simpleDiagram
            .child('highlight-neighbors', highlightNeighborsMode);
    }

    await simpleDiagram.render();
}

loadGraph(sync_url.vals.file)
    .then(data => on_load(sync_url.vals.file, null, data))
    .catch(error => on_load(sync_url.vals.file, error, null));
