import { engines, spawnEngine, diagram, mungeGraph, loadGraph, flatGroup, drawClusters, selectNodes, moveNodes, fixNodes, tip, tipHtmlOrJsonTable, highlightNeighbors } from './dc-graph.js';
import { set } from 'd3-collection';
import { select } from 'd3-selection';
import sync_url_options from './sync-url-options.js';
import { dcgraph_multi_domain } from './dc.graph.tracker.domain.js';
import { renderAll } from 'dc';

var excluded_layouts = set(['manual', 'layered', 'd3force', 'flexbox']);
var good_layouts = engines.available().filter(function(a) {
    return !excluded_layouts.has(a);
});
var options = {
    llayout: {
        default: rnd_item(good_layouts),
        values: good_layouts,
        selector: '#left-layout',
        diagram: 'left',
        needs_relayout: true,
        exert: function(val, ldiagram, rdiagram) {
            var engine = spawnEngine(val);
            apply_engine_parameters(engine);
            ldiagram
                .layoutEngine(engine)
                .autoZoom('once');
        }
    },
    rlayout: {
        default: rnd_item(good_layouts),
        values: good_layouts,
        selector: '#right-layout',
        diagram: 'right',
        needs_relayout: true,
        exert: function(val, ldiagram, rdiagram) {
            var engine = spawnEngine(val);
            apply_engine_parameters(engine);
            rdiagram
                .layoutEngine(engine)
                .autoZoom('once');
        }
    },
    worker: true,
    file: 'graphs/directed/world.gv',
};

var ldiagram = diagram('#left-graph'),
    rdiagram = diagram('#right-graph');
var filters = {};
var sync_url = sync_url_options(options, dcgraph_multi_domain({left: ldiagram, right: rdiagram}), ldiagram, rdiagram, filters);

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

function display_error(heading, message) {
    select('#message')
        .style('display', null)
        .html('<div><h1>' + heading + '</h1>' +
              (message ? '<code>' + message + '</code></div>' : ''));
    throw new Error(message);
}

function hide_error() {
    select('#message')
        .style('display', 'none');
}

function rnd_item(a) {
    return a[Math.floor(Math.random()*a.length)];
}

function on_load(filename, error, data) {
    if(error) {
        var heading = '';
        if(error.status)
            heading = 'Error ' + error.status + ': ';
        heading += 'Could not load file ' + filename;
        display_error(heading, error.message);
    }

    var graph_data = mungeGraph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    var edge_key = function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    };
    var edge_flat = flatGroup.make(edges, edge_key),
        node_flat = flatGroup.make(nodes, function(d) { return d[nodekeyattr]; });
    function init_diagram(layout, diagram, side) {
        var engine = spawnEngine(layout, sync_url.vals, sync_url.vals.worker);
        diagram
            .layoutEngine(engine)
            .timeLimit(5000)
            .width('auto')
            .height('auto')
            .autoZoom('once')
            .modKeyZoom('Alt')
            .restrictPan(true)
            .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
            .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
            .edgeSource(function(e) { return e.value[sourceattr]; })
            .edgeTarget(function(e) { return e.value[targetattr]; })
        // aesthetics
            .nodeTitle(null); // deactivate basic tooltips

        if(sync_url.vals.cutoff) {
            select('#cutoff-stuff').style('display', 'inline-block');
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
        diagram.child('draw-clusters', drawClustersMode);

        sync_url.exert();

        const fix_nodes_group = ['fix', side, 'nodes', 'group'].join('-'),
              select_nodes_group = ['select', side, 'nodes', 'group'].join('-');
        diagram.child('select-nodes', selectNodes({
            nodeStrokeWidth: 3,
            nodeFill: '#ddd',
            nodeStroke: side==='left' ? 'darkgreen' : 'darkblue'
        }, {select_nodes_group}));

        var moveNodesMode = moveNodes({select_nodes_group, fix_nodes_group});
        diagram.child('move-nodes', moveNodesMode);

        var fixNodesMode = fixNodes({select_nodes_group, fix_nodes_group})
            .strategy(fixNodes.strategy.lastNPerComponent(Infinity));
        diagram.child('fix-nodes', fixNodesMode);

        if(sync_url.vals.tips) {
            var tipMode = tip();
            var json_table = tipHtmlOrJsonTable()
                .json(function(d) {
                    return (d.orig.value.value || d.orig.value).jsontip || JSON.stringify(d.orig.value);
                });
            tipMode
                .showDelay(250)
                .content(json_table);
            diagram.child('tip', tipMode);
        }
        if(sync_url.vals.neighbors) {
            var highlightNeighborsMode = highlightNeighbors({
                edgeStroke: 'orangered',
                edgeStrokeWidth: 3
            }).durationOverride(0);
            diagram
                .child('highlight-neighbors', highlightNeighborsMode);
        }
    }
    init_diagram(sync_url.vals.llayout, ldiagram, 'left');
    init_diagram(sync_url.vals.rlayout, rdiagram, 'right');

    renderAll();
}

loadGraph(sync_url.vals.file).then(data => on_load(sync_url.vals.file, null, data));

select('#randomize').on('click', function() {
    sync_url.update('llayout', rnd_item(good_layouts), true);
    sync_url.update('rlayout', rnd_item(good_layouts), true);
});
