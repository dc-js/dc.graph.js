var qs = querystring.parse();
var data_stats;

function show_stats(data_stats, layout_stats) {
    $('#shown-nodes').html('' + (layout_stats.nnodes || 0) + '/' + (data_stats.totnodes || 0));
    $('#shown-edges').html('' + (layout_stats.nedges || 0) + '/' + (data_stats.totedges || 0));
    $('#time-last').html('' + ((runner.lastTime() || 0)/1000).toFixed(3));
    $('#time-avg').html('' + ((runner.avgTime() || 0)/1000).toFixed(3));
}
function next_tick(f) {
    // when there is heavy computation, 0 is not enough?
    window.setTimeout(f, 20);
}
function show_start() {
    $('#run-indicator').show();
}
function show_stop() {
    $('#run-indicator').hide();
}
function do_redraw() {
    if(!$('#run-indicator').is(':hidden'))
        return;
    show_start();
    next_tick(function() {
        diagram.redrawGroup();
        show_stats(data_stats, diagram.getStats());
    });
}
function toggle_stats() {
    var val = !settings.stats;
    toggle_stats.callback(val);
}
function toggle_options() {
    var val = !settings.options;
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
    case 'user':
        types = ['HYP','NET','OTHER','PRT','RTR','U','VM'];
        break;
    case 'image':
        types = ['HYP','IMG','NET','OTHER','PRT','RTR','VM'];
        break;
    }
    osTypeSelect.replaceFilter([types]);
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
    stats: {
        default: false,
        watch: function(k) {
            toggle_stats.callback = k;
        },
        apply: apply_heading('#show-stats', '#graph-stats')
    },
    options: {
        default: false,
        watch: function(k) {
            toggle_options.callback = k;
        },
        apply: apply_heading('#show-options', '#options')
    },
    timeLimit: {
        default: 750,
        query: 'limit',
        apply: function(val, diagram, filters) {
            diagram.timeLimit(val);
        }
    },
    ostype_select: {
        default: [],
        query: 'ostype',
        set: function(val) {
            osTypeSelect.filter(val);
        },
        watch: function(k) {
            osTypeSelect.on('filtered', function() {
                var filters = osTypeSelect.filters();
                k(filters);
            });
        },
        dont_apply_after_watch: true,
        apply: function(val, diagram, filters) {
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
        apply: function(val, diagram, filters) {
            diagram.showLayoutSteps(val);
        }
    },
    show_arrows: {
        default: false,
        query: 'arrows',
        selector: '#show-arrows',
        needs_redraw: true,
        apply: function(val, diagram, filters) {
            diagram.edgeArrowheadAccessor(val ? 'vee' : null);
        }
    },
    layout_unchanged: {
        default: false,
        query: 'unchanged',
        selector: '#layout-unchanged',
        needs_redraw: false,
        apply: function(val, diagram, filters) {
            diagram.layoutUnchanged(val);
        }
    },
    flow_direction: {
        default: "x",
        query: 'flow',
        selector: '#flow-direction',
        needs_redraw: true,
        needs_relayout: true,
        apply: function(val, diagram, filters) {
            var modf;
            switch(val) {
            case 'x':
                modf = function(cola) { cola.flowLayout('x', 200); };
                break;
            case 'y':
                modf = function(cola) { cola.flowLayout('y', 200); };
                break;
            case 'none':
                modf = null;
                break;
            default:
                throw new Error('unknown flow direction ' + val);
            }
            diagram.modLayout(modf);
        }
    },
    node_limit: {
        default: 0,
        query: 'nlimit'
    },
    fit_labels: {
        default: true,
        selector: '#fit-labels',
        needs_redraw: true,
        needs_relayout: true,
        query: 'fit'
    }
};

/* this general options stuff will be moved into querystring.js
 just needs a little more refactoring */

function apply_options() {
    for(var key in options)
        if(options[key].apply)
            options[key].apply(settings[key], diagram, filters);
}

function read_query(type, val) {
    switch(type) {
    case 'boolean':
        return val === 'true';
    case 'number':
        return +val;
    case 'string':
        return val;
    case 'array':
        return val.split('|');
    default: throw new Error('unsupported query type ' + type);
    }
}

function write_query(type, val) {
    switch(type) {
    case 'array':
        return val.join('|');
    case 'boolean':
    case 'number':
    case 'string':
        return '' + val;
    default: throw new Error('unsupported query type ' + type);
    }
}

function query_type(val) {
    return _.isArray(val) ? 'array' : typeof val;
}

function update_interesting() {
    var interesting = _.keys(options)
            .filter(function(k) {
                return qs[options[k].query] !== write_query(query_type(options[k].default), options[k].default);
            }).map(function(k) {
                return options[k].query || k;
            });
    querystring.update(_.pick(qs, interesting));
}

var settings = {};
function do_option(key, opt) {
    settings[key] = opt.default;
    var query = opt.query = opt.query || key;
    var type = query_type(opt.default);
    if(query in qs)
        settings[key] = read_query(type, qs[query]);

    function update_setting(opt, val) {
        settings[key] = val;
        if(opt.query) {
            qs[opt.query] = write_query(type, val);
            update_interesting();
        }
        if(opt.apply && !opt.dont_apply_after_watch)
            opt.apply(val, diagram, filters);
        if(opt.needs_relayout)
            diagram.relayout();
        if(opt.needs_redraw)
            do_redraw();
    }
    if(opt.selector) {
        switch(type) {
        case 'boolean':
            if(!opt.set && opt.selector)
                opt.set = function(val) {
                    $(opt.selector)
                        .prop('checked', val);
            };
            if(!opt.watch && opt.selector)
                opt.watch = function(k) {
                    $(opt.selector)
                        .change(function() {
                            var val = $(this).is(':checked');
                            k(val);
                        });
                };
            break;
        case 'string':
            if(!opt.set && opt.selector)
                opt.set = function(val) {
                    $(opt.selector)
                        .val(val);
                };
            if(!opt.watch && opt.selector)
                opt.watch = function(k) {
                    $(opt.selector)
                        .change(function() {
                            var val = $(this).val();
                            k(val);
                        });
                };
            break;
        default: throw new Error('unsupported selector type ' + type);
        }
    }
    if(opt.set)
        opt.set(settings[key]);
    if(opt.watch)
        opt.watch(function(val) {
            next_tick(function() {
                update_setting(opt, val);
            });
        });
}

var osTypeSelect = dc.selectMenu('#ostype-select', 'network');

for(var key in options)
    do_option(key, options[key]);

/* end general options stuff */

var filters = {};
var diagram = dc_graph.diagram('#graph', 'network');
var timeline = timeline('#timeline');
var node_inv = {}, edge_inv = {};

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
    vertices.forEach(function(n) {
        console.assert(!n.ostype || !sttype[n.id1] || n.ostype === sttype[n.id1]);
        if(sttype[n.id1])
            n.ostype = sttype[n.id1];
    });
    // make sure all vertices have ostype
    vertices.forEach(function(n) {
        n.ostype = n.ostype || 'OTHER';
    });

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

    if(Object.keys(warnings).length)
        console.log('graph read warnings', warnings);
    callback(vertices, edges);
}
var psv = d3.dsv("|", "text/plain");

function queue_inv(Q) {
    var inv_nodes_url = settings.server + '/inv-nodes.psv', inv_edges_url = settings.server + '/inv-edges.psv';
    Q.defer(psv, inv_nodes_url + nocache_query())
        .defer(psv, inv_edges_url + nocache_query());
}

function load_live(get_inv, callback) {
    var vertices_url = settings.server + '/nodes.psv', edges_url = settings.server + '/edges.psv';

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

var edge_header = "object|level1|id1|level2|id2|metatype|type|extra",
    node_header = "object|level1|id1|key|value|extra";
var ndicts = [], edicts = [];
function load_hist(file, get_inv, callback) {
    var Q = queue()
            .defer(d3.text, settings.histserv + '/' + file);
    if(get_inv && settings.server)
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
            ndicts[curr_hist] = nodes.map(function(n) { return n.id1; });
            edicts[curr_hist] = edges.map(function(e) { return e.id1 + '-' + e.id2; });
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
    if(settings.node_limit)
        nodes = nodes.slice(0, settings.node_limit);
    var node_stuff = flat_group.make(nodes, function(d) { return d.id1; }),
        edge_stuff = flat_group.make(edges, function(d) { return d.id1 + '-' + d.id2; }),
        filterIds = node_stuff.crossfilter.dimension(function(d) { return d.id1; }),
        filterOSTypes = node_stuff.crossfilter.dimension(function(d) { return d.ostype; });

    return {nodeDimension: node_stuff.Dimension, nodeGroup: node_stuff.group,
            edgeDimension: edge_stuff.Dimension, edgeGroup: edge_stuff.group,
            filterIds: filterIds, filterOSTypes: filterOSTypes};
}

var selected_node = null;
function clickiness() {
    diagram.selectAll('g.node')
        .on('click.vizgems', function(d) {
            selected_node = d.orig.key;
            do_redraw();
            if(qs.statserv) {
                var req = qs.statserv + "/rest/dataquery/stat/json/level_o=" + d.orig.key;
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
        filters = crossfilters(vertices, edges);
        // basic diagram setup
        diagram
            .width($(window).width())
            .height($(window).height())
            .transitionDuration(settings.transition)
            .showLayoutSteps(false)
            .lengthStrategy('jaccard')
            .baseLength(200)
            .nodeTitleAccessor(function(kv) {
                return kv.value.ostype==='PRT' ? kv.value.name : kv.key;
            })
            .nodeDimension(filters.nodeDimension).nodeGroup(filters.nodeGroup)
            .edgeDimension(filters.edgeDimension).edgeGroup(filters.edgeGroup)
            .sourceAccessor(function(e) { return e.value.id1; })
            .targetAccessor(function(e) { return e.value.id2; })
            .on('end', function() {
                show_stop();
                runner.endStep();
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
            .size(11);
        apply_options();

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
            .nodeStrokeWidthAccessor(function(kv) {
                return kv.key === selected_node ? 5 : 0;
            })
            .nodeFitLabelAccessor(settings.fit_labels)
            .nodeRadiusAccessor(30)
            .induceNodes(true) // drop zero-degree nodes for now
            .nodeLabelAccessor(function(kv) {
                return kv.value.ostype==='PRT' ? '' :
                    bad_name(kv.value.name) ? bad_name(kv.key) ? '' :
                    kv.key : kv.value.name;
            })
            .nodeFillScale(d3.scale.ordinal().domain(_.keys(ostypes)).range(colorbrewer.Paired[12]))
            .nodeFillAccessor(function(kv) {
                return kv.value.ostype;
            });

        var exs = [];
        for(var ost in ostypes)
            exs.push({key: '', name: ostypes[ost], value: {ostype: ost}});
        diagram.legend(
            dc_graph.legend().nodeWidth(70).nodeHeight(60).exemplars(exs));

        show_start();
        diagram.render();
        osTypeSelect.render();
        clickiness();
        show_stats({totnodes: vertices.length, totedges: edges.length}, diagram.getStats());
    });
}
function step() {
    load(false, function(vertices, edges) {
        if(!vertices.length || !edges.length) {
            runner.endStep();
            return; // cola sometimes dies on empty input; hope that next iteration will succeed
        }
        data_stats = {totnodes: vertices.length, totedges: edges.length};
        filters = crossfilters(vertices, edges);
        apply_options();
        diagram
            .nodeDimension(filters.nodeDimension).nodeGroup(filters.nodeGroup)
            .edgeDimension(filters.edgeDimension).edgeGroup(filters.edgeGroup);
        do_redraw();
        clickiness();
    });
}

var preload, snapshots, hist_files, hist_events, curr_hist, runner;

function load_history(tenant, k) {
    hist_files = snapshots.filter(function(r) { return new RegExp("auto-shagrat-" + tenant).test(r); });
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
    timeline.width(280).height(20).events(hist_events).render();
    timeline.on('jump', function(t) {
        var i = hist_events.findIndex(function(e) { return e.key > t; });
        if(i === 0)
            curr_hist = 0;
        else if(i === -1)
            curr_hist = hist_events.length-1;
        else curr_hist = i;
    });
    curr_hist = 0;
    k();
}
function populate_tenant_select(tenants, curr) {
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
        runner.start();
    });
}
if(settings.histserv) {
    preload = function(k) {
        var Q = queue()
            .defer(d3.text, settings.histserv + '/list.txt' + nocache_query())
            .defer(d3.text, settings.histserv + '/customer.txt' + nocache_query());
        Q.await(function(error, list, tenants) {
            snapshots = list.split('\n'); tenants = tenants.split('\n');
            tenants = tenants.filter(function(t) { return !!t; })
                .map(function(c) { return c.split('|'); });
            var tenant = settings.tenant || tenants[0][0];
            populate_tenant_select(tenants, tenant);
            load_history(tenant, k);
        });
    };
}
else preload = function(k) { k(); };

preload(function() {
    runner = make_runner(init, step, settings.interval);
    runner.start();
});


