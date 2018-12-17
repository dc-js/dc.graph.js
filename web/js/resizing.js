var diagram = dc_graph.diagram('#canvas');
var options = {
    layout: {
        default: 'd3v4force',
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
    n: {
        default: 50,
        values: [1, 5, 10, 20, 50, 100, 200],
        selector: '#number',
        needs_redraw: true,
        exert: function(val, diagram) {
            populate(val);
            diagram.autoZoom('once');
        }
    },
    validate: false,
    minWidth: {
        default: 200,
        query: 'minw'
    },
    minHeight: {
        default: 200,
        query: 'minh'
    },
    fit: {
        default: 'default',
        selector: '#fit',
        values: [
            'default',
            'vertical',
            'horizontal',
            'align_tl',
            'align_tr',
            'align_bl',
            'align_br',
            'zoom'
        ],
        needs_redraw: true,
        exert: function(val, diagram) {
            diagram.fitStrategy(val);
        }
    }
};
var sync_url = sync_url_options(options, dcgraph_domain(diagram), diagram);

function apply_engine_parameters(engine) {
    switch(engine.layoutAlgorithm()) {
    case 'd3v4-force':
        engine
            .collisionRadius(25)
            .gravityStrength(0.05)
            .initialCharge(-500);
        break
    case 'd3-force':
        engine
            .gravityStrength(0.1)
            .initialCharge(-1000);
    }
    return engine;
}

function build_data(nodes, edges) {
    // build crossfilters from scratch
    return {
        edgef: dc_graph.flat_group.make(edges, function(d) {
            return d.id;
        }),
        nodef: dc_graph.flat_group.make(nodes, function(d) {
            return d.id;
        })
    };
}
var populate = function(n) {
    var random = dc_graph.random_graph({
        nodeKey: 'id', edgeKey: 'id',
        ncolors: 12,
        log: sync_url.vals.log && sync_url.vals.log !== 'false'
    });
    random.generate(n);
    var data = build_data(random.nodes(), random.edges());
    diagram
        .nodeDimension(data.nodef.dimension).nodeGroup(data.nodef.group)
        .edgeDimension(data.edgef.dimension).edgeGroup(data.edgef.group);
};


var engine = dc_graph.spawn_engine(sync_url.vals.layout, querystring.parse(), sync_url.vals.worker);
apply_engine_parameters(engine);
// don't do multiple components for cola unless user specified
// layout is that unstable
if(engine.layoutAlgorithm()==='cola')
    if(typeof sync_url.vals.newcomp !== 'string')
        sync_url.vals.newcomp = 0;

diagram
    .layoutEngine(engine)
    .width('auto')
    .height('auto')
    .restrictPan(true)
    .fitStrategy(sync_url.vals.fit || 'default')
    .autoZoom('always')
    .zoomExtent([0.1, 1.5])
    .nodeShape({shape: sync_url.vals.shape})
    .nodeContent('text')
    .nodeIcon(sync_url.vals.icon)
    .nodeStrokeWidth(0) // turn off outlines
    .nodeLabel(function(kv) { return kv.key; })
    .nodeLabelFill(sync_url.vals.shape === 'plain' ? 'black' : function(n) {
        var rgb = d3.rgb(diagram.nodeFillScale()(diagram.nodeFill()(n))),
            // https://www.w3.org/TR/AERT#color-contrast
            brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 127 ? 'black' : 'ghostwhite';
    })
    .nodeFill(function(kv) {
        return kv.value.color;
    })
    .nodeFillScale(d3.scale.ordinal().range(
        ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
         '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928']))
    .nodeOpacity(sync_url.vals.opacity)
    .nodeTitle(null) // deactivate basic tooltips
    .edgeArrowhead(sync_url.vals.arrows ? 'vee' : null)
    .timeLimit(sync_url.vals.interval - 100);

if(sync_url.vals.ports) {
    diagram
        .portStyle('symbols', dc_graph.symbol_port_style())
        .portStyleName('symbols');
}
var fix_nodes = dc_graph.fix_nodes()
    .strategy(dc_graph.fix_nodes.strategy.last_N_per_component(1));
diagram.child('fix-nodes', fix_nodes);

if(sync_url.vals.validate)
    diagram.child('troubleshoot', dc_graph.validate());

populate(sync_url.vals.n);
diagram
    .autoZoom('always-skipanimonce')
    .render();

$('#resize').resizable({
    resize: function(event, ui) {
        diagram.redraw();
    },
    minWidth: sync_url.vals.minWidth,
    minHeight: sync_url.vals.minHeight
});
