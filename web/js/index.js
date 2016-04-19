
// http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
var querystring = (function(a) {
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; ++i)
    {
        var p=a[i].split('=', 2);
        if (p.length == 1)
            b[p[0]] = "";
        else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
})(window.location.search.substr(1).split('&'));

var steptime = +querystring.interval || 1000, // ms per step
    pause = +querystring.pause || 2500, // pause at end of loop
    showSteps = !(querystring.showsteps === 'false'),
    transition = querystring.transition || 0,
    stage = querystring.stage || 'insmod',
    file = querystring.file || null,
    paths = querystring.paths || null,
    generate = querystring.gen || null,
    shape = querystring.shape || null,
    radius = +querystring.radius || 25,
    fill = querystring.fill || 'white',
    nodeStroke = querystring.nodestroke || 'black',
    nodeStrokeWidth = querystring.nodestrokewidth || 1,
    randomize = querystring.randomize === 'true',
    doReinit = !(querystring.reinit==="false"),
    doDisplacement = !(querystring.displace==="false"),
    doAlignment = !(querystring.align==="false"),
    doOrdering = !(querystring.order==="false"),
    linkLength = +querystring.linklength || 30,
    edgeStroke = querystring.edgestroke || 'black',
    edgeStrokeWidth = querystring.edgestrokewidth || 1,
    edgeOpacity = +querystring.opacity || 1,
    appLayout = null,
    useAppLayout = false,
    nodePrefix = querystring.prefix || '',
    timeLimit = querystring.limit !== undefined ? +querystring.limit : 10000,
    explore = querystring.explore;

if(edgeStroke && /[0-9A-Fa-f]{6}/.test(edgeStroke) || /[0-9A-Fa-f]{3}/.test(edgeStroke))
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
appLayout = querystring.applayout || file === 'qfs.json' && 'qfs';
if(appLayout === 'none' || !app_layouts[appLayout])
    appLayout = null;
if(appLayout) {
    useAppLayout = true;
    if('useapplayout' in querystring) {
        useAppLayout = !!+querystring.useapplayout;
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
}
else shape = {shape: 'ellipse'};

function show_type_graph(nodes, edges, sourceattr, targetattr) {
    $('#overview').show();
    if(!overview)
        overview = dc_graph.diagram('#overview', 'overview');
    var typegraph = dc_graph.build_type_graph(nodes, edges,
                                              function(n) { return n.name; },
                                              function(n) { return n.type; },
                                              function(e) { return e[sourceattr]; },
                                              function(e) { return e[targetattr]; });
    var tedges = flat_group.make(typegraph.edges, function(d) { return d.type; }),
        tnodes = flat_group.make(typegraph.nodes, function(d) { return d.type; });

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

function can_get_graph_from_this(data) {
    return (data.nodes || data.vertices) &&  (data.edges || data.links);
}

source(function(error, data) {
    if(error) {
        console.log(error);
        return;
    }
    // we want data = {nodes, edges}; find those in common other formats
    if(!can_get_graph_from_this(data)) {
        var wrappers = ['database', 'response'];
        var wi = wrappers.findIndex(function(f) { return data[f] && can_get_graph_from_this(data[f]); });
        if(wi<0)
            throw new Error("couldn't find the data!");
        data = data[wrappers[wi]];
    }
    if(!data.edges && data.links)
        data.edges = data.links;
    if(!data.nodes && data.vertices)
        data.nodes = data.vertices;

    function find_attr(o, attrs) {
        return attrs.filter(function(a) { return !!o[a]; });
    }

    //var edgekeyattr = "id";
    var sourceattr = "sourcename", targetattr = "targetname";
    var edge0 = data.edges[0];
    if(edge0[sourceattr] === undefined) {
        var sourceattrs = ['source_ecomp_uid', "node1", "source", "tail"], targetattrs = ['target_ecomp_uid', "node2", "target", "head"];
        //var edgekeyattrs = ['id', '_id', 'ecomp_uid'];
        var edgewrappers = ['edge'];
        if(edge0.node0 && edge0.node1) { // specific conflict here
            sourceattr = 'node0';
            targetattr = 'node1';
        }
        else {
            var candidates = find_attr(edge0, sourceattrs);
            if(!candidates.length) {
                wi = edgewrappers.findIndex(function(w) { return edge0[w] && find_attr(edge0[w], sourceattrs).length; });
                if(wi<0)
                    throw new Error("didn't find any source attr");
                // I don't like to coerce data but it would be pretty annoying to add this everywhere
                data.edges = data.edges.map(function(e) { return e[edgewrappers[wi]]; });
                edge0 = data.edges[0];
                candidates = find_attr(edge0, sourceattrs);
            }
            if(candidates.length > 1)
                console.warn('found more than one possible source attr', candidates);
            sourceattr = candidates[0];

            candidates = find_attr(edge0, targetattrs);
            if(!candidates.length)
                throw new Error("didn't find any target attr");
            if(candidates.length > 1)
                console.warn('found more than one possible target attr', candidates);
            targetattr = candidates[0];

            /*
             // we're currently assembling our own edgeid
            candidates = find_attr(edge0, edgekeyattrs);
            if(!candidates.length)
                throw new Error("didn't find any edge key");
            if(candidates.length > 1)
                console.warn('found more than one edge key attr', candidates);
            edgekeyattr = candidates[0];
             */
        }
    }
    var nodekeyattr = "name";
    var node0 = data.nodes[0];
    if(node0[nodekeyattr] === undefined) {
        var nodekeyattrs = ['ecomp_uid', 'id', '_id'];
        var nodewrappers = ['vertex'];
        candidates = find_attr(node0, nodekeyattrs);
        if(!candidates.length) {
            wi = nodewrappers.findIndex(function(w) { return node0[w] && find_attr(node0[w], nodekeyattrs).length; });
            if(wi<0)
                throw new Error("couldn't find the node data");
            // again, coersion here
            data.nodes = data.nodes.map(function(n) { return n[nodewrappers[wi]]; });
            node0 = data.nodes[0];
            candidates = find_attr(node0, nodekeyattrs);
        }
        if(candidates.length > 1)
            console.warn('found more than one possible node key attr', candidates);
        nodekeyattr = candidates[0];
    }
    if(randomize) {
        data.edges.forEach(function(e) { e.order = Math.random()*1000; });
        data.nodes.forEach(function(n) { n.order = Math.random()*1000; });
    }

    if(false) // appLayout)
        show_type_graph(data.nodes, data.edges, sourceattr, targetattr);

    var edges = flat_group.make(data.edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        nodes = flat_group.make(data.nodes, function(d) { return d[nodekeyattr]; });

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
    if(appLayout) {
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

    diagram
        .width($(window).width())
        .height($(window).height())
        .timeLimit(timeLimit)
        .transitionDuration(transition)
        .stageTransitions(stage)
        .showLayoutSteps(showSteps)
        .nodeDimension(nodes.dimension).nodeGroup(nodes.group)
        .edgeDimension(edges.dimension).edgeGroup(edges.group)
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
        .lengthStrategy(generate ? 'individual' :
                        useAppLayout ? app_layouts[appLayout].lengthStrategy || 'none' :
                        'symmetric')
        .edgeArrowhead(function(kv) {
            return kv.value.undirected ? null : 'vee';
        })
        .edgeOpacity(edgeOpacity)
        .edgeStroke(edgeStroke)
        .edgeStrokeWidth(edgeStrokeWidth)
        .on('end', function() {
            $('#run-indicator').hide();
            runner.endStep();
            show_stats({totnodes: data.nodes.length, totedges: data.edges.length}, diagram.getStats());
        })
        .child('highlight-neighbors', dc_graph.highlight_neighbors('orange', 3));

    appLayout && app_layouts[appLayout].initDiagram && app_layouts[appLayout].initDiagram(diagram);
    if(linkLength)
        diagram.baseLength(linkLength);
    if(randomize) {
        diagram.nodeOrdering(function(kv) { return kv.value.order; })
            .edgeOrdering(function(kv) { return kv.value.order; });
    }

    var expander = null, expanded;
    if(explore) {
        expanded = [explore];
        // second group on keys so that first will observe it
        expander = flat_group.another(nodes.crossfilter, function(d) { return d.name; });
        function apply_expander_filter() {
            expander.dimension.filterFunction(function(key) {
                return expanded.indexOf(key) >= 0;
            });
        }
        function adjacent_edges(key) {
            return edges.group.all().filter(function(kv) {
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
                          expanded = _.union(expanded, adjacent_nodes(key));
                          apply_expander_filter();
                          run();
                      }, function(key, collapsible) { // collapse
                          expanded = _.difference(expanded, adjacent_nodes(key).filter(collapsible));
                          apply_expander_filter();
                          run();
                      }));
    }

    if(paths) {
        // make sure it draws first (?)
        setTimeout(function() {
            d3.json(paths, function(error, pathv) {
                if(error)
                    throw new Error(error);
                var i = 0;
                setInterval(function() {
                    // i continue not to understand the horrible concurrency issues
                    // i'm running into - double-draws can peg the CPU
                    if(diagram.isRunning())
                        return;
                    var path = pathv.results[i].element_list;
                    var pnodes = {}, pedges = {};
                    path.forEach(function(el) {
                        switch(el.element_type) {
                        case 'node':
                            pnodes[el.property_map.ecomp_uid] = true;
                            break;
                        case 'edge':
                            pedges[el.property_map.source_ecomp_uid + '-' + el.property_map.target_ecomp_uid] = true;
                            break;
                        }
                    });
                    diagram
                        .edgeStrokeWidth(function(e) {
                            return pedges[diagram.edgeKey()(e)] ? 4 : 1;
                        })
                        .edgeStroke(function(e) {
                            return pedges[diagram.edgeKey()(e)] ? 'red' : 'black';
                        })
                        .nodeStrokeWidth(function(n) {
                            return pnodes[diagram.nodeKey()(n)] ? 3 : 1;
                        })
                        .nodeStroke(function(n) {
                            return pnodes[diagram.nodeKey()(n)] ? 'red' : 'black';
                        })
                        .redraw();
                    i = (i+1) % pathv.results.length;
                }, 2000);
            });
        }, 1000);
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
    var startDim = nodes.crossfilter.dimension(function(d) { return d.start || 0; }),
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
});

