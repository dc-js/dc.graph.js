var qs = querystring.parse();

var options = Object.assign({
    tickSize: 1,
    transition: 1000,
    stage: 'insmod',
    linkLength: 30,
    layout: 'cola',
    timeLimit: 10000,
    start: null
}, qs);

function display_error(message) {
    d3.select('#message')
        .style('display', null)
        .html('<h1>' + message + '</h1>');
    throw new Error(message);
}
if(!options.file)
    display_error('Need <code>?file=</code> in URL!');


var diagram = dc_graph.diagram('#graph');
dc_graph.load_graph(options.file, function(error, data) {
    if(error) {
        var message = '';
        if(error.status)
            message = 'Error ' + error.status + ': ';
        message += 'Could not load file ' + options.file;
        display_error(message);
    }
    var graph_data = dc_graph.munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    var edge_flat = dc_graph.flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    var engine = dc_graph.spawn_engine(options.layout, qs, options.worker != 'false');
    diagram
        .width(null)
        .height(null)
        .layoutEngine(engine)
        .timeLimit(+options.timeLimit)
        .transitionDuration(+options.transition)
        .stageTransitions(options.stage)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .nodeLabel(function(n) { return n.value.value.label.split(/\n|\\n/); })
        .nodeShape(function(n) { return n.value.value.shape; })
        .nodeFill(function(n) { return n.value.value.fillcolor || 'white'; })
        .edgeLabel(function(e) { return e.value.label; })
        .edgeArrowhead('vee')
        .edgeStroke(function(e) { return e.value.color || 'black'; })
        .edgeStrokeDashArray(function(e) {
            switch(e.value.style) {
            case 'dotted':
                return [1,5];
            }
            return null;
        });
//        .child('highlight-neighbors', dc_graph.highlight_neighbors({edgeStroke: 'orangered', edgeStrokeWidth: 3}));
    if(engine.layoutAlgorithm() === 'cola') {
        engine
            .tickSize(+options.tickSize);
        engine.baseLength(+options.linkLength);
    }

    var nodelist = diagram.nodeGroup().all().map(function(n) {
        return {
            value: n.key,
            label: diagram.nodeLabel()(n)
        };
    });
    nodelist.sort((a,b) => a.label < b.label ? -1 : 1);

    var expand_strategy = options.expand_strategy || 'expanded_hidden';
    var ec_strategy = dc_graph.expand_collapse[expand_strategy]({
        nodeCrossfilter: node_flat.crossfilter,
        edgeGroup: edge_flat.group,
        nodeKey: n => n.name,
        edgeSource: e => e.value[sourceattr],
        edgeTarget: e => e.value[targetattr],
        directional: qs.directional
    });

    if(options.start) {
        if(!nodes.find(n => n.name === options.start)) {
            let found = nodes.find(n => n.value.label.includes(options.start));
            if(found)
                options.start = found.name;
            else {
                console.log("didn't find '" + options.start + "' by nodeKey or nodeLabel");
                options.start = null;
            }
        }
    }

    var expand_collapse = dc_graph.expand_collapse(ec_strategy);
    if(options.start)
        expand_collapse.expand('both', options.start, true);
    diagram.child('expand-collapse', expand_collapse);
    diagram.child('highlight-expanded', dc_graph.highlight_things(
        {
            nodeStrokeWidth: 5,
            nodeStroke: 'steelblue',
        },
        {},
        'expanded-highlight', 'expanded-highlight-group', 147
    ).durationOverride(0));
    diagram.child('highlight-collapse', dc_graph.highlight_things(
        {
            nodeOpacity: 0.2,
            nodeStroke: 'darkred',
            edgeOpacity: 0.2,
            edgeStroke: 'darkred'
        },
        {},
        'collapse-highlight', 'collapse-highlight-group', 150
    ).durationOverride(0));
    diagram.child('highlight-hide', dc_graph.highlight_things(
        {
            nodeOpacity: 0.2,
            nodeStroke: 'darkred',
            edgeOpacity: 0.2,
            edgeStroke: 'darkred'
        },
        {},
        'hide-highlight', 'hide-highlight-group', 155
    ).durationOverride(0));
    dc.renderAll();
    var starter = d3.select('#start-from');
    var option = starter.selectAll('option').data([{label: 'select one'}].concat(nodelist));
    option.enter().append('option')
        .attr('value', function(d) { return d.value; })
        .attr('selected', function(d) { return d.value === options.start ? 'selected' : null; })
        .text(function(d) { return d.label; });

    starter.on('change', function() {
        expand_collapse.expand('both', this.value, true);
        dc.redrawAll();
    });
    // respond to browser resize (not necessary if width/height is static)
    // $(window).resize(function() {
    //     diagram
    //         .width($(window).width())
    //         .height($(window).height());
    // });
});

