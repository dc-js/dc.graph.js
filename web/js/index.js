var qs = querystring.parse();

var steptime = +qs.interval || 1000, // ms per step
    pause = +qs.pause || 2500, // pause at end of loop
    showSteps = !(qs.showsteps === 'false'),
    transition = qs.transition || 0,
    stage = qs.stage || 'insmod',
    tickSize = qs.ticksize || 1,
    file = qs.file || null,
    paths = qs.paths || null,
    generate = qs.gen || null,
    shape = qs.shape || null,
    radius = +qs.radius || 25,
    fill = qs.fill || 'white',
    nodeStroke = qs.nodestroke || 'black',
    nodeStrokeWidth = qs.nodestrokewidth || 1,
    randomize = qs.randomize === 'true',
    doReinit = !(qs.reinit==="false"),
    doDisplacement = !(qs.displace==="false"),
    doAlignment = !(qs.align==="false"),
    doOrdering = !(qs.order==="false"),
    linkLength = +qs.linklength || 30,
    edgeStroke = qs.edgestroke || 'black',
    edgeStrokeWidth = qs.edgestrokewidth || 1,
    edgeOpacity = +qs.opacity || 1,
    layoutAlgorithm = qs.algo || 'cola',
    appLayout = null,
    useAppLayout = false,
    nodePrefix = qs.prefix || '',
    timeLimit = qs.limit !== undefined ? +qs.limit : 10000,
    explore = qs.explore;

if(edgeStroke && (/[0-9A-Fa-f]{6}/.test(edgeStroke) || /[0-9A-Fa-f]{3}/.test(edgeStroke)))
    edgeStroke = '#' + edgeStroke;
var min = 2, max = 12;
var begin = 2, end = 12, curr = begin;
var doRender = true;

var diagram = dc_graph.diagram('#graph'), runner;
var overview;

function do_status() {
    $('#now').css('left', (curr-min)/(max-min)*100 + '%');
    $('#status').text('[' + begin + '..' + end + '] : ' + curr);
}
function show_stats(data_stats, layout_stats) {
    $('#graph-stats').html(['<table>',
                            '<tr><td>Showing</td><td>' + layout_stats.nnodes + '/' + data_stats.totnodes + ' nodes</td></tr>',
                            '<tr><td></td><td>' + layout_stats.nedges + '/' + data_stats.totedges + ' edges</td></tr>',
                            '<tr><td>Last time</td><td>' + (runner.lastTime()/1000).toFixed(3) + 's</td></tr>',
                            '<tr><td>Avg time</td><td>' + (runner.avgTime()/1000).toFixed(3) + 's</td></tr>',
                            '</table>'].join(''));
}
function show_stepper() {
    $('#stepper').show();
    $('#controls').width(300);
}

do_status();

var source;
if(!generate && !file)
    file = "qfs.json";
appLayout = qs.applayout || file === 'qfs.json' && 'qfs';
if(appLayout === 'none' || !app_layouts[appLayout])
    appLayout = null;
if(appLayout) {
    useAppLayout = true;
    if('useapplayout' in qs) {
        useAppLayout = !!+qs.useapplayout;
        $('#use-app-layout').prop('checked', useAppLayout);
    }
    $('#app-options').show();
    app_layouts[appLayout].init && app_layouts[appLayout].init();
}
if(file)
    source = function(callback) {
        dc_graph.load_graph(file, callback);
    };
else if(generate)
    source = function(callback) {
        // name plus at least one number, separated by commas
        var parts = /^([a-zA-Z]+)([0-9]+(?:,[0-9]+)*)$/.exec(generate);
        if(!parts || !parts[0]) throw new Error("couldn't parse generator");
        var name = parts[1], args = parts[2].split(',').map(function(n) { return +n; });
        var env = {
            linkLength: linkLength,
            nodePrefix: nodePrefix
        };
        dc_graph.generate(name, args, env, callback);
    };
if(shape) {
    var parts = shape.split(',');
    shape = {shape: parts[0]};
    switch(parts[0]) {
    case 'polygon':
        shape.sides = +parts[1];
        shape.skew = +parts[2] || 0;
        shape.distortion = +parts[3] || 0;
        shape.rotation = +parts[4] || 0;
        break;
    }
    shape.regular = qs.regular!=='false';
}

function show_type_graph(nodes, edges, sourceattr, targetattr) {
    $('#overview').show();
    if(!overview)
        overview = dc_graph.diagram('#overview', 'overview');
    var typegraph = dc_graph.build_type_graph(nodes, edges,
                                              function(n) { return n.name; },
                                              function(n) { return n.type; },
                                              function(e) { return e[sourceattr]; },
                                              function(e) { return e[targetattr]; });
    var tedges = dc_graph.flat_group.make(typegraph.edges, function(d) { return d.type; }),
        tnodes = dc_graph.flat_group.make(typegraph.nodes, function(d) { return d.type; });

    overview.width(250)
        .height(250)
        .nodeRadius(15)
        .baseLength(25)
        .nodeLabel(function(n) { return n.value.type; })
        .nodeDimension(tnodes.dimension).nodeGroup(tnodes.group)
        .edgeDimension(tedges.dimension).edgeGroup(tedges.group)
        .edgeSource(function(e) { return e.value.source; })
        .edgeTarget(function(e) { return e.value.target; })
        .render();
}

source(function(error, data) {
    if(error) {
        console.log(error);
        return;
    }
    var graph_data = dc_graph.munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    if(randomize) {
        edges.forEach(function(e) { e.order = Math.random()*1000; });
        nodes.forEach(function(n) { n.order = Math.random()*1000; });
    }

    if(false) // appLayout)
        show_type_graph(nodes, edges, sourceattr, targetattr);

    var edge_flat = dc_graph.flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    appLayout && app_layouts[appLayout].data && app_layouts[appLayout].data(nodes, edges);

    runner = make_runner(run, step,
                         function() {
                             return curr < end ? steptime : pause;
                         });

    function run() {
        do_status();
        if(doReinit)
            diagram.initLayoutOnRedraw(explore || appLayout && useAppLayout);
        startDim.filterRange([0, curr]);
        $('#run-indicator').show();
        if(doRender) {
            dc.renderAll();
            doRender = false;
        }
        else
            dc.redrawAll();
        done = false;
    }
    function step() {
        if(++curr>end) curr = begin;
        run();
    }
    window.start_stop = function() {
        runner.toggle();
    };

    var rule_constraints = null;
    var rules = appLayout && app_layouts[appLayout].rules;
    if(rules) {
        rules.edges.forEach(function(c) {
            if(!doDisplacement && c.produce && !c.produce.type)
                c.disable = true;
            if(!doAlignment && c.produce && c.produce.type === 'alignment')
                c.disable = true;
            if(!doOrdering && c.produce && c.produce.type === 'ordering')
                c.disable = true;
        });
        rule_constraints = dc_graph.constraint_pattern(rules);
    }

    function constrain(diagram, nodes, edges) {
        var constraintses = [];
        if(appLayout && useAppLayout && rule_constraints)
            constraintses.push(rule_constraints(diagram, nodes, edges));

        if(appLayout && useAppLayout && app_layouts[appLayout].constraints)
            constraintses.push(app_layouts[appLayout].constraints(diagram, nodes, edges));
        var circles = {};
        nodes.forEach(function(n, i) {
            if(n.orig.value.circle) {
                var circ = n.orig.value.circle;
                if(!circles[circ]) circles[circ] = [];
                circles[circ].push({node: n.orig.key});
            }
        });
        constraintses.push(Object.keys(circles).map(function(circ) {
            return {
                type: 'circle',
                nodes: circles[circ]
            };
        }));
        return Array.prototype.concat.apply([], constraintses);
    }

    var engine = dc_graph.spawn_engine(qs.layout, qs, qs.worker != 'false');
    diagram
        .width($(window).width())
        .height($(window).height())
        .layoutEngine(engine)
        .timeLimit(timeLimit)
        .transitionDuration(transition)
        .stageTransitions(stage)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .nodeLabel(function(n) { return n.value.name.split('/'); })
        .nodeShape(shape)
        .nodeRadius(radius)
        .nodeFill(appLayout && app_layouts[appLayout].colors || fill)
        .nodeStroke(nodeStroke)
        .nodeStrokeWidth(nodeStrokeWidth)
        .nodeFixed(appLayout && app_layouts[appLayout].node_fixed)
        .constrain(constrain)
        .edgeArrowhead(function(kv) {
            return kv.value.undirected ? null : 'vee';
        })
        .edgeOpacity(edgeOpacity)
        .edgeStroke(edgeStroke)
        .edgeStrokeWidth(edgeStrokeWidth)
        .on('end', function() {
            $('#run-indicator').hide();
            runner.endStep();
            show_stats({totnodes: nodes.length, totedges: edges.length}, diagram.getStats());
        })
        .child('highlight-neighbors', dc_graph.highlight_neighbors({edgeStroke: 'orangered', edgeStrokeWidth: 3}));

    if(engine.layoutAlgorithm() === 'cola') {
        diagram
            .showLayoutSteps(showSteps);
        engine
            .tickSize(tickSize)
            .lengthStrategy(generate ? 'individual' :
                            useAppLayout ? app_layouts[appLayout].lengthStrategy || 'none' :
                            'symmetric');
        if(linkLength)
            engine.baseLength(linkLength);
    }
    appLayout && app_layouts[appLayout].initDiagram && app_layouts[appLayout].initDiagram(diagram);
    if(randomize) {
        diagram.nodeOrdering(function(kv) { return kv.value.order; })
            .edgeOrdering(function(kv) { return kv.value.order; });
    }

    var expander = null, expanded = {};
    if(explore) {
        // second dimension on keys so that first will observe it
        expander = node_flat.crossfilter.dimension(function(d) { return d.name; });
        function apply_expander_filter() {
            expander.filterFunction(function(key) {
                return expanded[key];
            });
        }
        function adjacent_edges(key) {
            return edge_flat.group.all().filter(function(kv) {
                return kv.value[sourceattr] === key || kv.value[targetattr] === key;
            });
        }
        function adjacent_nodes(key) {
            return adjacent_edges(key).map(function(kv) {
                return kv.value[sourceattr] === key ? kv.value[targetattr] : kv.value[sourceattr];
            });
        }
        apply_expander_filter();
        diagram.child('expand-collapse',
                      dc_graph.expand_collapse(function(key) { // get_degree
                          return adjacent_edges(key).length;
                      }, function(key) { // expand
                          adjacent_nodes(key).forEach(function(nk) {
                              expanded[nk] = true;
                          });
                          apply_expander_filter();
                          run();
                      }, function(key, collapsible) { // collapse
                          adjacent_nodes(key).filter(collapsible).forEach(function(nk) {
                              expanded[nk] = false;
                          });
                          apply_expander_filter();
                          run();
                      }));
        $('#search-wrapper')
            .show();
        $('#search')
            .autocomplete({
                source: nodes.map(function(n) { return n.name; }),
                select: function(event, ui) {
                    expanded = {};
                    expanded[ui.item.value] = true;
                    apply_expander_filter();
                    run();
                }
            })
            .attr("autocomplete", "on");
    }

    // respond to browser resize (not necessary if width/height is static)
    $(window).resize(function() {
        diagram
            .width($(window).width())
            .height($(window).height());
    });



    // this is kind of a brain-dead way to test transitions
    // i mean, you can cram the concept of adding and deleting stuff over time
    // into crossfilter data, but do you really want to do that?
    var startDim = node_flat.crossfilter.dimension(function(d) { return d.start || 0; }),
        startGroup = startDim.group();


    $("#time-range").slider({
        range: true,
        min: min,
        max: max,
        values: [begin, end],
        slide: function( event, ui ) {
            begin = ui.values[0];
            end = ui.values[1];
            do_status();
        }
    });
    $('#use-app-layout').change(function(val) {
        useAppLayout = $(this).is(':checked');
        diagram.lengthStrategy(useAppLayout ? 'none' : 'symmetric')
            .relayout();
        doRender = true;
        if(!runner.isRunning())
            run();
    });

    // do not brush too fast
    dc.constants.EVENT_DELAY = 100;

    runner.init();

    if(qs.play)
        runner.toggle();
});

