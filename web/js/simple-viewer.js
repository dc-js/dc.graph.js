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

dc_graph.load_graph(sync_url.vals.file, function(error, data) {
    if(error) {
        console.log(error);
        return;
    }

    var edges = dc_graph.flat_group.make(data.links, function(d) {
        return d.sourcename + '-' + d.targetname + (d.par ? ':' + d.par : '');
    }),
        nodes = dc_graph.flat_group.make(data.nodes, function(d) { return d.name; });

    var engine = dc_graph.spawn_engine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
    simpleDiagram
        .layoutEngine(engine)
        .timeLimit(5000)
        .width('auto')
        .height('auto')
        .autoZoom('once')
        .restrictPan(true)
        .nodeDimension(nodes.dimension).nodeGroup(nodes.group)
        .edgeDimension(edges.dimension).edgeGroup(edges.group)
    // aesthetics
        .nodeFixed(n => n.value.fixedPos)
        .nodeStrokeWidthAccessor(0) // turn off outlines
        .nodeFillAccessor(function(kv) {
            return '#2E54A2';
        })
        .nodeLabelPadding({x: 2, y: 0})
        .nodeLabelFillAccessor('white')
        .nodeTitleAccessor(null) // deactivate basic tooltips
        .edgeArrowheadAccessor(sync_url.vals.arrows ? 'vee' : null);

    var move_nodes = dc_graph.move_nodes();
    simpleDiagram.child('move-nodes', move_nodes);

    var fix_nodes = dc_graph.fix_nodes()
        .strategy(dc_graph.fix_nodes.strategy.last_N_per_component(Infinity));
    simpleDiagram.child('fix-nodes', fix_nodes);

    if(sync_url.vals.tips) {
        var tip = dc_graph.tip();
        tip
            .showDelay(250)
            .content(dc_graph.tip.table());
        simpleDiagram.child('tip', tip);
    }
    if(sync_url.vals.neighbors) {
        simpleDiagram
            .child('highlight-neighbors', dc_graph.highlight_neighbors({edgeStroke: 'orangered', edgeStrokeWidth: 3}));
    }

    simpleDiagram.render();
});

