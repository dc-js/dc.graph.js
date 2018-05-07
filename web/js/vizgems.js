var data_stats;

var cb_colors = colorbrewer.Paired[12];
cb_colors[5] = cb_colors[11];

// arbitrary assigning of shapes as POC
var shapes = ['invtrapezium', 'ellipse', 'diamond', 'trapezium', 'pentagon', 'hexagon', 'egg',
              'parallelogram', 'septagon', 'square', 'triangle', 'invtriangle'],
    curr_shape = 0, shape_map = {};

function show_stats(data_stats, layout_stats) {
    $('#shown-nodes').html('' + (layout_stats.nnodes || 0) + '/' + (data_stats.totnodes || 0));
    $('#shown-edges').html('' + (layout_stats.nedges || 0) + '/' + (data_stats.totedges || 0));
    $('#time-last').html('' + ((runner.lastTime() || 0)/1000).toFixed(3));
    $('#time-avg').html('' + ((runner.avgTime() || 0)/1000).toFixed(3));
}
function show_start() {
    $('#run-indicator').show();
}
function show_stop() {
    $('#run-indicator').hide();
}
function toggle_stats() {
    var val = !tracker.vals.stats;
    toggle_stats.callback(val);
}
function toggle_options() {
    var val = !tracker.vals.options;
    toggle_options.callback(val);
}
function apply_heading(link, section) {
    return function(val) {
        $(link).text(val ? 'hide' : 'show');
        $(section).toggle(val);
    };
}
function choose_view(view) {
    var types;
    switch(view) {
    case 'all':
        types = null;
        break;
    case 'user':
        types = [['FS', 'HYP', 'NET', 'OTHER', 'PRT', 'RTR', 'U', 'VM']];
        break;
    case 'image':
        types = [['FS', 'HYP', 'IMG', 'NET', 'OTHER', 'PRT', 'RTR', 'VM']];
        break;
    }
    osTypeSelect.replaceFilter(types);
    osTypeSelect.redrawGroup();
}
var options = {
    server: {
        default: ''
    },
    statserv: {
        default: ''
    },
    histserv: {
        default: ''
    },
    tenant: {
        default: '',
        selector: '#tenant-select'
    },
    interval: {
        default: 5000
    },
    transition: {
        default: 2000
    },
    delete_delay: {
        default: 0,
        query: 'ddelay',
        exert: function(val, diagram) {
            diagram.deleteDelay(val);
        }
    },
    date: {
        default: ''
    },
    play: {
        default: false
    },
    slow_transition: {
        default: 15000,
        query: 'slow'
    },
    staged_transitions: {
        default: 'none',
        query: 'stage',
        selector: '#stage-transitions',
        exert: function(val, diagram) {
            diagram.stageTransitions(val);
        }
    },
    stats: {
        default: false,
        subscribe: function(k) {
            toggle_stats.callback = k;
        },
        exert: apply_heading('#show-stats', '#graph-stats')
    },
    options: {
        default: false,
        subscribe: function(k) {
            toggle_options.callback = k;
        },
        exert: apply_heading('#show-options', '#options')
    },
    timeLimit: {
        default: 750,
        query: 'limit',
        exert: function(val, diagram, filters) {
            diagram.timeLimit(val);
        }
    },
    ostype_select: {
        default: [],
        query: 'ostype',
        set: function(val) {
            osTypeSelect.filter(val);
        },
        subscribe: function(k) {
            osTypeSelect.on('filtered', function() {
                var filters = osTypeSelect.filters();
                k(filters);
            });
        },
        dont_exert_after_subscribe: true,
        exert: function(val, diagram, filters) {
            if(filters.filterOSTypes) {
                osTypeSelect
                    .dimension(filters.filterOSTypes)
                    .group(filters.filterOSTypes.group())
                    .replaceFilter([val]);
            }
        }
    },
    show_steps: {
        default: false,
        query: 'steps',
        selector: '#show-steps',
        needs_redraw: false,
        exert: function(val, diagram, filters) {
            diagram.showLayoutSteps(val);
        }
    },
    show_arrows: {
        default: false,
        query: 'arrows',
        selector: '#show-arrows',
        needs_redraw: true,
        exert: function(val, diagram, filters) {
            diagram.edgeArrowhead(val ? 'vee' : null);
        }
    },
    highlight_neighbors: {
        default: false,
        query: 'neighbors',
        selector: '#highlight-neighbors',
        needs_redraw: true,
        exert: function() {
            var highlighter = dc_graph.highlight_neighbors({edgeStroke: 'orangered', edgeStrokeWidth: 3});
            return function(val, diagram) {
                diagram.child('highlight-neighbors', val ? highlighter : null);
            };
        }()
    },
    disconnected: {
        default: true
    },
    use_colors: {
        default: true,
        query: 'usecolor',
        selector: '#use-colors',
        needs_redraw: true,
        exert: function(val, diagram, filters) {
            if(val) {
                diagram
                    .nodeStrokeWidth(function(kv) {
                        return kv.key === selected_node ? 5 : 0;
                    })
                    .nodeFillScale(d3.scale.ordinal().domain(_.keys(ostypes)).range(cb_colors))
                    .nodeFill(function(kv) {
                        return kv.value.ostype;
                    })
                    .nodeLabelFill(function(n) {
                        var rgb = d3.rgb(diagram.nodeFillScale()(diagram.nodeFill()(n))),
                            // https://www.w3.org/TR/AERT#color-contrast
                            brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                        return brightness > 127 ? 'black' : 'ghostwhite';
                    });
            } else {
                diagram
                    .nodeStrokeWidth(1)
                    .nodeFillScale(null)
                    .nodeFill('white')
                    .nodeLabelFill('black');
            }
        }
    },
    use_shapes: {
        default: true,
        query: 'useshape',
        selector: '#use-shapes',
        needs_relayout: true,
        needs_redraw: true,
        exert: function(val, diagram, filters) {
            if(val) {
                diagram
                    .nodeShape(function(kv) {
                        var t = kv.value.ostype;
                        if(!shape_map[t]) {
                            shape_map[t] = shapes[curr_shape];
                            curr_shape = (curr_shape+1)%shapes.length;
                        }
                        return {shape: shape_map[t]};
                    });
            } else {
                diagram
                    .nodeShape({shape: 'ellipse'});
            }
        }
    },
    layout_unchanged: {
        default: false,
        query: 'unchanged',
        selector: '#layout-unchanged',
        needs_redraw: false,
        exert: function(val, diagram, filters) {
            diagram.layoutUnchanged(val);
        }
    },
    direct_vm: {
        default: false,
        query: 'vmlayout',
        selector: '#layout-vms',
        needs_relayout: true,
        exert: function(val, diagram) {
            diagram.constrain(val ? vm_constraints : function() { return []; });
        }
    },
    flow_direction: {
        default: "x",
        query: 'flow',
        selector: '#flow-direction',
        needs_relayout: true,
        exert: function(val, diagram, filters) {
            var modf;
            switch(val) {
            case 'x':
                diagram.flowLayout({axis: 'x', minSeparation: 200});
                break;
            case 'y':
                diagram.flowLayout({axis: 'y', minSeparation: 200});
                break;
            case 'none':
                diagram.flowLayout(null);
                break;
            default:
                throw new Error('unknown flow direction ' + val);
            }
        }
    },
    node_limit: {
        default: 0,
        query: 'nlimit'
    },
    fit_labels: {
        default: true,
        selector: '#fit-labels',
        needs_relayout: true,
        query: 'fit'
    }
};


var osTypeSelect = dc.selectMenu('#ostype-select', 'network');
var filters = {};
var diagram = dc_graph.diagram('#graph', 'network');
var timeline = timeline('#timeline');
var node_inv = null, edge_inv = null;
var tracker = sync_url_options(options, dcgraph_domain(diagram, 'network'), diagram, filters);

var is_running = tracker.vals.play;
function display_running() {
    $('#play-button i').attr('class', is_running ? 'fa fa-pause' : 'fa fa-play');
}
display_running();
$('#play-button').click(function(e) {
    if(e.shiftKey)
        diagram.transitionDuration(tracker.vals.slow_transition);
    else
        diagram.transitionDuration(tracker.vals.transition);
    if(is_running) {
        runner.pause();
        is_running = false;
    }
    else {
        runner.unpause();
        is_running = true;
    }
    display_running();
});

$('#last-button').click(function(e) {
    curr_hist = (curr_hist+hist_files.length-2)%hist_files.length;
    timeline.events(hist_events).current(hist_events[curr_hist].key).redraw();
    if(e.shiftKey)
        diagram.transitionDuration(tracker.vals.slow_transition);
    else
        diagram.transitionDuration(tracker.vals.transition);
    runner.step();
});

$('#next-button').click(function(e) {
    //curr_hist = (curr_hist+1)%hist_files.length;
    timeline.events(hist_events).current(hist_events[curr_hist].key).redraw();
    if(e.shiftKey)
        diagram.transitionDuration(tracker.vals.slow_transition);
    else
        diagram.transitionDuration(tracker.vals.transition);
    runner.step();
});

// demo of constraints applied by pattern
var vm_rules = {
    nodes: [
        {id: 'ostype', partition: 'ostype', typename: function(id, value) { return value; }}
    ],
    edges: [
        {source: 'VM', target: 'PRT', produce: dc_graph.gap_x(200, false)},
        {source: 'VM', target: 'FS', produce: dc_graph.gap_x(200, false)},
        {source: 'PRT', target: 'HYP', produce: dc_graph.gap_x(200, false)},
        {source: 'FS', target: 'HYP', produce: dc_graph.gap_x(200, false)},
        {source: 'VM', target: 'HYP', produce: dc_graph.gap_x(200, false)}
    ]
};
var vm_constraints = dc_graph.constraint_pattern(vm_rules);

function nocache_query() {
    return '?nocache=' + Date.now();
}
function read_data(vertices, edges, inv_vertices, inv_edges, is_hist, callback) {
    var n, id;
    if(inv_vertices) {
        node_inv = {};
        inv_vertices.forEach(function(n) {
            var nn = node_inv[n.id] = node_inv[n.id] || {};
            nn[n.key] = n.val;
        });
        for(id in node_inv) {
            n = node_inv[id];
            // if it has a host field, alias that key
            if('host' in n)
                node_inv[n.host] = n;
            // rename attribute that will collide with cache
            n.itype = n.type;
            delete n.type;
            // remove ostype prefix from name
            n.name = n.name.replace(/^[^:]*:/,'');
        };
    }
    if(inv_edges) {
        edge_inv = {};
        inv_edges.forEach(function(e) {
            var id = e.id1 + '|' + e.id2;
            var ee = edge_inv[e.id] = node_inv[e.id] || {};
            ee[e.key] = e.val;
        });
    }

    // we pass in edges as vertices for live case, seems more complete
    vertices = vertices.filter(function(e) {
        return !e.id2;
    });
    edges = edges.filter(function(e) {
        return !!e.id2;
    });
    var warnings = {};
    var sttype = {};
    var vert_map = {};
    // historical nodes come in multiple key/value rows
    if(is_hist) {
        vertices.forEach(function(n) {
            var v = vert_map[n.id1] = vert_map[n.id1] || {id1: n.id1};
            v[n.key] = n.value;
        });
        for(id in vert_map) {
            n = vert_map[id];
            // remove ostype prefix from name
            if(n.name)
                n.name = n.name.replace(/^[^:]*:/,'');
        }
        edges.forEach(function(e) {
            e.id2 = e.id2.replace(/lvm$/, '');
        });
    } else {
        vertices.forEach(function(n) {
            vert_map[n.id1] = n;
        });
    }
    var added_nodes = [];
    function add_v(id) {
        if(!vert_map[id]) {
            added_nodes.push(id);
            vert_map[id] = {id1: id};
        }
    }
    var conflicting_source_warnings = [], conflicting_target_warnings = [];
    edges.forEach(function(e) {
        add_v(e.id1);
        add_v(e.id2);
        if(e.metatype==='ostype' && e.type) {
            var types = e.type.toUpperCase().split('2');
            if(sttype[e.id1] && sttype[e.id1] != types[0])
                conflicting_source_warnings.push({curr_type: types[0], node: e.id1, prior_type: sttype[e.id1]});
            if(sttype[e.id2] && sttype[e.id2] != types[1])
                conflicting_target_warnings.push({curr_type: types[1], node: e.id2, prior_type: sttype[e.id2]});
            sttype[e.id1] = types[0];
            sttype[e.id2] = types[1];
        }
    });
    if(conflicting_source_warnings.length)
        warnings['conflicting source types'] = conflicting_source_warnings;
    if(conflicting_target_warnings.length)
        warnings['conflicting target types'] = conflicting_target_warnings;
    if(added_nodes.length)
        warnings['added unknown nodes from edges'] = added_nodes;
    vertices = _.values(vert_map);

    if(node_inv) {
        var node_not_found_warnings = [], node_attr_mismatch_warnings = [];
        // populate vertex/edge properties from inventory, but warn about any problems
        vertices.forEach(function(n) {
            var invn = node_inv[n.id1];
            if(!invn) {
                node_not_found_warnings.push(n.id1);
                return;
            }
            for(var a in n)
                if(a in invn && n[a] !== invn[a])
                    node_attr_mismatch_warnings.push({attr: a, node: n.id1, prior_value: n[a], inv_value: invn[a]});

            _.extend(n, invn);
            if(!n.ostype)
                n.ostype = sttype[n.id1];
        });
        if(node_not_found_warnings.length)
            warnings['nodes not found in inventory'] = node_not_found_warnings;
        if(node_attr_mismatch_warnings.length)
            warnings['node attributes mismatched'] = node_attr_mismatch_warnings;
    }
    if(edge_inv) {
        var edge_not_found_warnings = [], edge_attr_mismatch_warnings = [];
        edges.forEach(function(e) {
            var id = e.id1 + '|' + e.id2;
            var inve = edge_inv[id];
            if(!inve) {
                edge_not_found_warnings.push(id);
                return;
            }
            for(var a in e)
                if(a in inve && e[a] !== inve[a])
                    edge_attr_mismatch_warnings.push({attr: a, edge: id, prior_value: e[a], inv_value: inve[a]});
            _.extend(e, inve);
        });
        if(edge_not_found_warnings.length)
            warnings['edges not found in inventory'] = edge_not_found_warnings;
        if(edge_attr_mismatch_warnings.length)
            warnings['edge attributes mismatched'] = edge_attr_mismatch_warnings;
    }
    var mismatched_sttype_warnings = [];
    // infer node ostype from edge, if consistent
    vertices.forEach(function(n) {
        if(n.ostype)
            n.ostype = n.ostype.toUpperCase();
        if(n.ostype && sttype[n.id1] && n.ostype !== sttype[n.id1])
            mismatched_sttype_warnings.push({node: n.id1, ostype: n.ostype, sttype: sttype[n.id1]});
        if(sttype[n.id1])
            n.ostype = sttype[n.id1];
        if(n.ostype === 'HOST')
            n.ostype = 'HYP';
        else // regardless, make sure all vertices have some ostype
            n.ostype = n.ostype || 'OTHER';
    });
    if(mismatched_sttype_warnings.length)
        warnings['nodes ostype did not match edges'] = mismatched_sttype_warnings;

    if(Object.keys(warnings).length)
        console.log('graph read warnings', warnings);
    callback(vertices, edges);
}
var psv = d3.dsv("|", "text/plain");

function queue_inv(Q) {
    var inv_nodes_url = tracker.vals.server + '/inv-nodes.psv', inv_edges_url = tracker.vals.server + '/inv-edges.psv';
    Q.defer(psv, inv_nodes_url + nocache_query())
        .defer(psv, inv_edges_url + nocache_query());
}

function load_live(get_inv, callback) {
    var vertices_url = tracker.vals.server + '/nodes.psv', edges_url = tracker.vals.server + '/edges.psv';

    var Q = queue()
            .defer(psv, vertices_url + nocache_query())
            .defer(psv, edges_url + nocache_query());
    if(get_inv)
        queue_inv(Q);
    Q.await(function(error, vertices, edges, inv_vertices, inv_edges) {
        if(error)
            throw new Error(error);
        // in cache, edges seems to be a superset of vertices, use that instead
        read_data(edges, edges, inv_vertices, inv_edges, false, callback);
    });
}

// from http://stackoverflow.com/questions/4833651/javascript-array-sort-and-unique
function sort_unique(arr) {
    arr = arr.sort(function (a, b) { return a*1 - b*1; });
    var ret = [arr[0]];
    for (var i = 1; i < arr.length; i++) { // start loop at 1 as element 0 can never be a duplicate
        if (arr[i-1] !== arr[i]) {
            ret.push(arr[i]);
        }
    }
    return ret;
}

var edge_header = "object|level1|id1|level2|id2|metatype|type|extra",
    node_header = "object|level1|id1|key|value|extra";
var ndicts = [], edicts = [];
function load_hist(file, get_inv, callback) {
    var Q = queue()
            .defer(d3.text, tracker.vals.histserv + '/' + file);
    if(get_inv && tracker.vals.server)
        queue_inv(Q);
    Q.await(function(error, hist, inv_vertices, inv_edges) {
        if(error)
            throw new Error(error);
        var pdata = hist.split('\n').slice(3,-2);
        var ntext = pdata.filter(function(r) { return /^node/.test(r); }),
            etext = pdata.filter(function(r) { return /^edge/.test(r); });
        ntext.unshift(node_header);
        etext.unshift(edge_header);
        var nodes = psv.parse(ntext.join('\n')),
            edges = psv.parse(etext.join('\n'));
        if(!ndicts[curr_hist]) {
            ndicts[curr_hist] = sort_unique(nodes.map(function(n) { return n.id1; }));
            edicts[curr_hist] = sort_unique(edges.map(function(e) { return e.id1 + '-' + e.id2; }));
            if(curr_hist>0) {
                var adds = _.difference(ndicts[curr_hist], ndicts[curr_hist-1]).length +
                        _.difference(edicts[curr_hist], edicts[curr_hist-1]).length;
                var dels = _.difference(ndicts[curr_hist-1], ndicts[curr_hist]).length +
                        _.difference(edicts[curr_hist-1], edicts[curr_hist]).length;
                hist_events[curr_hist].value = {adds: adds, dels: dels};
            }
        }
        timeline.events(hist_events).current(hist_events[curr_hist].key).redraw();
        read_data(nodes, edges, inv_vertices, inv_edges, true, callback);
        curr_hist = (curr_hist+1)%hist_files.length;
    });
}

function load(get_inv, callback) {
    if(hist_files) {
        var file = hist_files[curr_hist];
        load_hist(file, get_inv, callback);
    }
    else
        load_live(get_inv, callback);
}

function crossfilters(nodes, edges) {
    if(tracker.vals.node_limit)
        nodes = nodes.slice(0, tracker.vals.node_limit);
    var node_stuff = dc_graph.flat_group.make(nodes, function(d) { return d.id1; }),
        edge_stuff = dc_graph.flat_group.make(edges, function(d) { return d.id1 + '-' + d.id2; }),
        filterIds = node_stuff.crossfilter.dimension(function(d) { return d.id1; }),
        filterOSTypes = node_stuff.crossfilter.dimension(function(d) { return d.ostype; });

    return {nodeDimension: node_stuff.Dimension, nodeGroup: node_stuff.group,
            edgeDimension: edge_stuff.Dimension, edgeGroup: edge_stuff.group,
            filterIds: filterIds, filterOSTypes: filterOSTypes};
}

var selected_node = null;
function clickiness() {
    diagram.selectAll('.draw g.node')
        .on('click.vizgems', function(d) {
            selected_node = d.orig.key;
            dc.redrawAll('network');
            if(tracker.vals.statserv) {
                var req = tracker.vals.statserv + "/rest/dataquery/stat/json/level_o=" + d.orig.key;
                //not valid jsond3.json(req, function(error, data) {
                d3.xhr(req, function(error, response) {
                    if(error) {
                        console.log(error);
                        return;
                    }
                    try {
                        var data = JSON.parse('{' + response.responseText + '}');
                    }
                    catch(xep) {
                        console.log(xep);
                        return;
                    }
                    var charts_area = $('#charts-area'), charts_container = $('#charts-container');
                    charts_container.empty();
                    if(data.response.stats.length) {
                        var vars = {};
                        data.response.stats.forEach(function(stat) {
                            vars[stat.vars[0].k] = stat.vars[0];
                        });
                        vars = _.values(vars);
                        var N = Math.min(vars.length, 4);
                        vars = vars.slice(0,4);
                        var ndx = crossfilter(data.response.stats);
                        // index on time-of-day
                        data.response.stats.forEach(function(d) {
                            d.time = new Date(d.ti);
                        });
                        var dim = ndx.dimension(function(r) { return new Date(r.time); });
                        var w = charts_area.width(), h = Math.min(charts_area.height()/N - 15, 150);
                        var charts = [];
                        var tickFormat = formatValue = d3.format(".2s");
                        vars.forEach(function(v,i) {
                            charts_container.append($('<p></p>').append($('<b></b>').append(v.l)));
                            var group = dim.group().reduceSum(function(r) {
                                return r.vars[0].k === v.k ? r.vars[0].n : 0;
                            });
                            var id = 'chart' + (i+1);
                            charts_container.append($('<div></div>', {id: id}));
                            var chart = dc.lineChart('#' + id, d.orig.key)
                                    .width(w).height(h)
                                    .margins({left: 40, top:0, right: 0, bottom:20})
                                    .dimension(dim)
                                    .group(group)
                                    .elasticX(true)
                                    .elasticY(true)
                                    .xUnits(d3.time.minutes)
                                    .x(d3.time.scale())
                                    .yAxisLabel(v.k);
                            chart.yAxis().tickFormat(tickFormat);
                        });
                        dc.renderAll(d.orig.key);
                    }
                });
            }
            $('#chart1').show();
        });
}

var ostypes = {
    RTR: "Router",
    PRT: "Port",
    U: "User",
    CUS: "Tenant", // Customer
    OTHER: 'Other', // perhaps grey
    VM: "Virtual Machine",
    FS: "Volume", // File System
    IMG: "Image",
    HYP: "Host",
    SUB: "Subnet",
    NET: "Network"
};

function init() {
    load(true, function(vertices, edges) {
        data_stats = {totnodes: vertices.length, totedges: edges.length};
        Object.assign(filters, crossfilters(vertices, edges));
        // basic diagram setup
        diagram
            .width($(window).width())
            .height($(window).height())
            .transitionDuration(tracker.vals.transition)
            .showLayoutSteps(false)
            .handleDisconnected(tracker.vals.disconnected)
            .lengthStrategy('jaccard')
            .baseLength(150)
            .nodeTitle(function(kv) {
                return kv.value.ostype==='PRT' ? kv.value.name : kv.key;
            })
            .nodeDimension(filters.nodeDimension).nodeGroup(filters.nodeGroup)
            .edgeDimension(filters.edgeDimension).edgeGroup(filters.edgeGroup)
            .edgeSource(function(e) { return e.value.id1; })
            .edgeTarget(function(e) { return e.value.id2; })
            .on('start', show_start)
            .on('end', function(happens) {
                show_stop();
                if(happens)
                    runner.endStep();
                else runner.skip();
                show_stats(data_stats, diagram.getStats());
            });
        osTypeSelect
            .promptText('Show all types')
            .title(function(d) {
                return ostypes[d.key] + ': ' + d.value;
            })
            .order(function(a,b) {
                return d3.ascending(ostypes[a.key], ostypes[b.key]);
            })
            .multiple(true)
            .numberVisible(12);
        tracker.exert();

        // respond to browser resize (not necessary if width/height is static)
        $(window).resize(function() {
            diagram
                .width($(window).width())
                .height($(window).height());
        });

        function isUUID(s) {
            return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(s);
        }
        function bad_name(s) {
            return !s || isUUID(s);
        }

        // aesthetics: look at kv.value for node/edge attributes and return appropriate values
        diagram
            .initLayoutOnRedraw(true)
            .nodeFitLabel(tracker.vals.fit_labels)
            .nodeRadius(function(n) {
                switch(n.value.ostype) {
                case 'PRT': return 15;
                default: return 30;
                }
            })
            .induceNodes(true) // drop zero-degree nodes for now
            .nodeLabel(function(kv) {
                switch(kv.value.ostype) {
                case 'PRT': return '';
                case 'FS':
                    if(!bad_name(kv.value.name)) {
                        var parts = kv.value.name.split('-');
                        if(parts.length===10 && parts[0]==='ceph')
                            return [parts[0], parts[3], parts[4], parts[9]].join('-');
                    }
                    // fall thru
                default:
                    return bad_name(kv.value.name) ? bad_name(kv.key) ? '' :
                        kv.key : kv.value.name;
                }
            });
        var exs = [];
        for(var ost in ostypes)
            exs.push({key: ost, name: ostypes[ost], value: {ostype: ost}});
        var legend = dc_graph.legend()
            .nodeWidth(70).nodeHeight(60)
            .exemplars(exs)
            .dimension(filters.filterOSTypes);
        diagram.legend(legend);

        osTypeSelect.render();
        diagram.render();
        clickiness();
        data_stats = {totnodes: vertices.length, totedges: edges.length};
    });
}
function step() {
    load(false, function(vertices, edges) {
        if(!vertices.length || !edges.length) {
            runner.endStep();
            return; // cola sometimes dies on empty input; hope that next iteration will succeed
        }
        Object.assign(filters, crossfilters(vertices, edges));
        tracker.exert();
        diagram
            .nodeDimension(filters.nodeDimension).nodeGroup(filters.nodeGroup)
            .edgeDimension(filters.edgeDimension).edgeGroup(filters.edgeGroup);
        dc.redrawAll('network');
        clickiness();
    });
}

var preload, snapshots, hist_files, hist_events, curr_hist, runner, tenant_name;

function history_index(t) {
    // last date that is less than argument
    var i = hist_events.findIndex(function(e) { return e.key > t; });
    return i > 0 ? i-1 : i;
}

function load_history(tenant, k) {
    hist_files = snapshots.filter(function(r) { return new RegExp("auto-shagrat-" + tenant).test(r); });
    console.log('tenant ' + tenant_name[tenant] + ': ' + hist_files.length + ' snapshots');
    ndicts = [];
    edicts = [];
    var dtreg = /^cm\.([0-9]{8}-[0-9]{6})\./;
    var datef = d3.time.format('%Y%m%d-%H%M%S');
    var hist_times = hist_files.map(function(f) {
        var match = dtreg.exec(f);
        if(!match) {
            console.log('filename ' + f + " didn't match datetime regex");
            return null;
        }
        return datef.parse(match[1]);
    }).filter(function(dt) { return !!dt; });
    hist_events = hist_times.map(function(dt) { return {key: dt, value: {}}; });
    timeline.width($('#timeline').innerWidth()).height(20).events(hist_events).render();
    timeline.on('jump', function(t) {
        var i = history_index(t);
        if(i === 0)
            curr_hist = 0;
        else if(i === -1)
            curr_hist = hist_events.length-1;
        else curr_hist = i;
        if(!is_running)
            runner.step();
    });

    curr_hist = -1;
    if(tracker.vals.date) {
        var date = datef.parse(tracker.vals.date);
        if(!date)
            date = d3.time.format('%Y%m%d').parse(tracker.vals.date);
        if(date)
            curr_hist = history_index(date);
    }
    if(curr_hist === -1)
        curr_hist = 0;
    k();
}
function populate_tenant_select(tenants, curr) {
    tenant_name = tenants.reduce(function(m, v) {
        m[v[0]] = v[1];
        return m;
    }, {});
    $('#tenant-option').show();
    var sel = d3.select('#tenant-select');
    sel.selectAll('option')
        .data(tenants)
        .enter().append('option')
        .attr({
            value: function(d) { return d[0]; },
            selected: function(_,i) { return i===0; }
        })
        .text(function(d) { return d[1]; });
    $('#tenant-select').val(curr);
    sel.on('change', function() {
        runner.stop();
        load_history(this.selectedOptions[0].value, function() {});
        runner.start(!is_running);
    });
}
if(tracker.vals.histserv) {
    preload = function(k) {
        var Q = queue()
            .defer(d3.text, tracker.vals.histserv + '/list.txt' + nocache_query())
            .defer(d3.text, tracker.vals.histserv + '/customer.txt' + nocache_query());
        Q.await(function(error, list, tenants) {
            snapshots = list.split('\n'); tenants = tenants.split('\n');
            tenants = tenants.filter(function(t) { return !!t; })
                .map(function(c) { return c.split('|'); });
            var tenant = tracker.vals.tenant || tenants[0][0];
            populate_tenant_select(tenants, tenant);
            load_history(tenant, k);
        });
    };
}
else preload = function(k) { k(); };

preload(function() {
    runner = make_runner(init, step, tracker.vals.interval);
    runner.start(!is_running);
});


