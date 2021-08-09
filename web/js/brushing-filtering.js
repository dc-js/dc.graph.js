var selectionDiagram = dc_graph.diagram('#graph'), pie, row;

var options = {
    layout: {
        default: 'dagre',
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
    worker: {
        default: false
    },
    file: null,
    n: {
        default: 100,
        values: [1, 5, 10, 20, 50, 100, 200],
        selector: '#number',
        needs_redraw: true,
        exert: function(val, diagram) {
            populate(val);
            diagram.autoZoom('once');
        }
    },
    transition_duration: {
        query: 'tdur',
        default: 1000
    },
    arrows: {
        default: 'none'
    }
};
var sync_url = sync_url_options(options, dcgraph_domain(selectionDiagram), selectionDiagram);

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

function apply_engine_parameters(engine) {
    switch(engine.layoutAlgorithm()) {
    case 'd3v4-force':
        engine
            .collisionRadius(25)
            .gravityStrength(0.05)
            .initialCharge(-500);
        break;
    case 'd3-force':
        engine
            .gravityStrength(0.1)
            .initialCharge(-1000);
        break;
    }
    selectionDiagram.initLayoutOnRedraw(engine.layoutAlgorithm() === 'cola');
    return engine;
}
function build_data(nodes, edges) {
    // build crossfilters from scratch
    return {
        edgef: dc_graph.flat_group.make(edges, function(d) {
            return d.key;
        }),
        nodef: dc_graph.flat_group.make(nodes, function(d) {
            return d.key;
        })
    };
}

var load_graph = function(nodes, edges) {
    var data = build_data(nodes, edges),
        colorDimension = data.nodef.crossfilter.dimension(function(n) {
            return n.color;
        }),
        colorGroup = colorDimension.group(),
        dashDimension = data.edgef.crossfilter.dimension(function(e) {
            return e.dash;
        }),
        dashGroup = dashDimension.group();
    selectionDiagram
        .nodeDimension(data.nodef.dimension).nodeGroup(data.nodef.group)
        .edgeDimension(data.edgef.dimension).edgeGroup(data.edgef.group);
    pie
        .dimension(colorDimension)
        .group(colorGroup);
    row
        .dimension(dashDimension)
        .group(dashGroup);
};

var populate = function(n) {
    var random = dc_graph.random_graph({
        ncolors: 3
    });

    random.generate(n);
    load_graph(random.nodes(), random.edges());
};

var on_load = function(filename, error, data) {
    if(error) {
        var heading = '';
        if(error.status)
            heading = 'Error ' + error.status + ': ';
        heading += 'Could not load file ' + filename;
        display_error(heading, error.message);
    }
    var graph_data = dc_graph.munge_graph(data);
    load_graph(graph_data.nodes, graph_data.edges);
    selectionDiagram.autoZoom('once');
    dc.redrawAll();
};

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

var engine = dc_graph.spawn_engine(sync_url.vals.layout, querystring.parse(), sync_url.vals.worker);
apply_engine_parameters(engine);
var colors = ['#1b9e77', '#d95f02', '#7570b3'];
var dasheses = [
    {name: 'solid', ray: null},
    {name: 'dash', ray: [5,5]},
    {name: 'dot', ray: [1,5]},
    {name: 'dot-dash', ray: [15,10,5,10]}
];
selectionDiagram
    .layoutEngine(engine)
    .timeLimit(5000)
    .transitionDuration(sync_url.vals.transition_duration)
    .fitStrategy('horizontal')
    .restrictPan(true)
    .margins({top: 5, left: 5, right: 5, bottom: 5})
    .autoZoom('once-noanim')
    .zoomDuration(sync_url.vals.transition_duration)
    .altKeyZoom(true)
    .width('auto')
    .height('auto')
    .nodeFixed(function(n) { return n.value.fixed; })
    .nodeStrokeWidth(0) // turn off outlines
    .nodeLabel('')
    .nodeLabelFill(function(n) {
        var rgb = d3.rgb(selectionDiagram.nodeFillScale()(selectionDiagram.nodeFill()(n))),
            // https://www.w3.org/TR/AERT#color-contrast
            brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 127 ? 'black' : 'ghostwhite';
    })
    .nodeFill(function(kv) {
        return kv.value.color;
    })
    .nodeOpacity(0.25)
    .edgeOpacity(0.25)
    .timeLimit(1000)
    .nodeFillScale(d3.scale.ordinal().domain([0,1,2]).range(colors))
    .nodeTitle(dc.pluck('key'))
    .edgeStrokeDashArray(function(e) {
        return dasheses[e.value.dash].ray;
    })
    .edgeArrowhead(sync_url.vals.arrows === 'head' || sync_url.vals.arrows === 'both' ? 'vee' : null)
    .edgeArrowtail(sync_url.vals.arrows === 'tail' || sync_url.vals.arrows === 'both' ? 'crow' : null);

selectionDiagram.child('select-nodes', dc_graph.select_nodes(
    {
        nodeOpacity: 1
    }).noneIsAll(true)
              .autoCropSelection(false));
selectionDiagram.child('filter-selection-nodes', dc_graph.filter_selection('select-nodes-group', 'select-nodes'));

selectionDiagram.child('move-nodes', dc_graph.move_nodes());

selectionDiagram.child('fix-nodes', dc_graph.fix_nodes({
    fixedPosTag: 'fixed'
}));

selectionDiagram.child('select-edges', dc_graph.select_edges(
    {
        edgeStrokeWidth: 2,
        edgeOpacity: 1
    }).noneIsAll(true)
              .autoCropSelection(false));
selectionDiagram.child('filter-selection-edges',
              dc_graph.filter_selection('select-edges-group', 'select-edges')
              .dimensionAccessor(function(c) { return c.edgeDimension(); }));

pie = dc.pieChart('#pie')
    .width(150).height(150)
    .radius(75)
    .colors(d3.scale.ordinal().domain([0,1,2]).range(colors))
    .label(function() { return ''; })
    .title(function(kv) {
        return colors[kv.key] + ' nodes (' + kv.value + ')';
    });

row = dc.rowChart('#row')
    .width(300).height(150)
    .label(function(kv) {
        return dasheses[kv.key].name;
    });

if(sync_url.vals.file)
    dc_graph.load_graph(sync_url.vals.file, on_load.bind(null, sync_url.vals.file));
else {
    populate(sync_url.vals.n);
    dc.renderAll();
}
