import { engines, spawnEngine, applyGraphvizAccessors, diagram, loadGraphText, mungeGraph, dataUrl, flatGroup, drawClusters, moveNodes, fixNodes, tip, tipHtmlOrJsonTable, highlightNeighbors, loadGraph } from './dc-graph.js';

var options = {
    layout: {
        default: 'cola',
        values: engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: function(val, diagram) {
            var engine = spawnEngine(val);
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
        exert: function(val, diagram) {
            if(val)
                applyGraphvizAccessors(simpleDiagram);
            else {
                simpleDiagram
                    .nodeFixed(function (n) {
                        return n.value.fixedPos;
                    })
                    .nodeStrokeWidth(0) // turn off outlines
                    .nodeFill(function(kv) {
                        return '#2E54A2';
                    })
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
        exert: function(val, _, filters) {
            if(filters.cutoff) {
                d3.select('#cutoff-display').text(val);
                filters.cutoff.set(val);
            }
        }
    },
    datalink: false,
    arrows: false,
    tips: true,
    neighbors: true
};

var simpleDiagram = diagram('#graph');
var filters = {};
var sync_url = sync_url_options(options, dcgraph_domain(simpleDiagram), simpleDiagram, filters);

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

d3.select('#user-file').on('change', function() {
    var filename = this.value;
    if(filename) {
        var reader = new FileReader();
        reader.onload = function(e) {
            hide_error();
            loadGraphText(e.target.result, filename, on_load.bind(null, filename));
        };
        reader.readAsText(this.files[0]);
    }
});

var url_output = sync_url.output(), more_output;
sync_url.output(function(params) {
    url_output(params);
    if(more_output)
        more_output(params);
});

function on_load(filename, error, data) {
    if(error) {
        var heading = '';
        if(error.status)
            heading = 'Error ' + error.status + ': ';
        heading += 'Could not load file ' + filename;
        display_error(heading, error.message);
    }

    var graph_data;
    try {
        graph_data = mungeGraph(data);
    }
    catch(xep) {
        console.log(xep);
        display_error(`Error munging ${filename}`, xep.message);
    }
    var nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    function update_data_link() {
        d3.select('#data-link')
            .style('visibility', sync_url.vals.datalink ? 'visible' : 'hidden')
            .attr('href', sync_url.what_if_url({file: dataUrl({nodes: nodes, edges: edges})}));
    }
    more_output = update_data_link;
    update_data_link();

    var edge_key = function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    };
    var edge_flat = flatGroup.make(edges, edge_key),
        node_flat = flatGroup.make(nodes, function(d) { return d[nodekeyattr]; }),
        cluster_flat = flatGroup.make(data.clusters || [], function(d) { return d.key; });

    var engine = spawnEngine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
    simpleDiagram
        .layoutEngine(engine)
        .timeLimit(5000)
        .width('auto')
        .height('auto')
        .autoZoom('once')
        .restrictPan(true)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .clusterDimension(cluster_flat.dimension).clusterGroup(cluster_flat.group)
        .nodeParentCluster(data.node_cluster ? function(n) { return data.node_cluster[n.key]; } : null)
        .clusterParent(function(c) { return c.parent; })
    // aesthetics
        .nodeTitle(null); // deactivate basic tooltips

    if(sync_url.vals.cutoff) {
        d3.select('#cutoff-stuff').style('display', 'inline-block');
        var dim = edge_flat.crossfilter.dimension(function(d) {
            return +d[sync_url.vals.cutoff];
        });
        filters.cutoff = {
            set: function(v) {
                dim.filterRange([v, Infinity]);
            }
        };
    }

    var drawClustersMode = drawClusters();
    simpleDiagram.child('draw-clusters', drawClustersMode);

    sync_url.exert();

    var moveNodesMode = moveNodes();
    simpleDiagram.child('move-nodes', moveNodesMode);

    var fixNodesMode = fixNodes()
        .strategy(fixNodes.strategy.lastNPerComponent(Infinity));
    simpleDiagram.child('fix-nodes', fixNodesMode);

    if(sync_url.vals.tips) {
        var tipMode = tip();
        var json_table = tipHtmlOrJsonTable()
            .json(function(d) {
                return (d.orig.value.value || d.orig.value).jsontip || JSON.stringify(d.orig.value);
            });
        tipMode
            .showDelay(250)
            .content(json_table);
        simpleDiagram.child('tip', tipMode);
    }
    if(sync_url.vals.neighbors) {
        var highlightNeighborsMode = highlightNeighbors({
            edgeStroke: 'orangered',
            edgeStrokeWidth: 3
        }).durationOverride(0);
        simpleDiagram
            .child('highlight-neighbors', highlightNeighborsMode);
    }

    simpleDiagram.render();
}

loadGraph(sync_url.vals.file, on_load.bind(null, sync_url.vals.file));
