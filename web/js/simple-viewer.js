var options = {
    layout: {
        default: 'cola',
        values: dc_graph.engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: function(val, diagram) {
            var engine = dc_graph.spawn_engine(val);
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
                dc_graph.apply_graphviz_accessors(simpleDiagram);
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
    arrows: false,
    tips: true,
    neighbors: true
};

var simpleDiagram = dc_graph.diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(simpleDiagram), simpleDiagram);

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
    d3.select('#message')
        .style('display', null)
        .html('<div><h1>' + heading + '</h1>' +
              (message ? '<code>' + message + '</code></div>' : ''));
    throw new Error(message);
}

function hide_error() {
    d3.select('#message')
        .style('display', 'none');
}

d3.select('#user-file').on('change', function() {
    var filename = this.value;
    if(filename) {
        var reader = new FileReader();
        reader.onload = function(e) {
            hide_error();
            dc_graph.load_graph_text(e.target.result, filename, on_load.bind(null, filename));
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

    var graph_data = dc_graph.munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    function update_data_link() {
        d3.select('#data-link')
            .attr('href', sync_url.what_if_url({file: dc_graph.data_url({nodes: nodes, edges: edges})}));
    }
    more_output = update_data_link;
    update_data_link();

    var edge_key = function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    };
    var edge_flat = dc_graph.flat_group.make(edges, edge_key),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    var engine = dc_graph.spawn_engine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
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
    // aesthetics
        .nodeTitle(null); // deactivate basic tooltips

    sync_url.exert();

    var move_nodes = dc_graph.move_nodes();
    simpleDiagram.child('move-nodes', move_nodes);

    var fix_nodes = dc_graph.fix_nodes()
        .strategy(dc_graph.fix_nodes.strategy.last_N_per_component(Infinity));
    simpleDiagram.child('fix-nodes', fix_nodes);

    if(sync_url.vals.tips) {
        var tip = dc_graph.tip();
        var json_table = dc_graph.tip.html_or_json_table()
            .json(function(d) {
                return (d.orig.value.value || d.orig.value).jsontip || JSON.stringify(d.orig.value);
            });
        tip
            .showDelay(250)
            .content(json_table);
        simpleDiagram.child('tip', tip);
    }
    if(sync_url.vals.neighbors) {
        var highlight_neighbors = dc_graph.highlight_neighbors({
            edgeStroke: 'orangered',
            edgeStrokeWidth: 3
        }).durationOverride(0);
        simpleDiagram
            .child('highlight-neighbors', highlight_neighbors);
    }

    simpleDiagram.render();
}

dc_graph.load_graph(sync_url.vals.file, on_load.bind(null, sync_url.vals.file));
