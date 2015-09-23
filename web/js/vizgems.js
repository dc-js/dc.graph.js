var qs = querystring.parse();

function show_stats(data_stats, layout_stats) {
    $('#shown-nodes').html('' + layout_stats.nnodes + '/' + data_stats.totnodes + ' nodes');
    $('#shown-edges').html('' + layout_stats.nedges + '/' + data_stats.totedges + ' edges');
}
function next_tick(f) {
    // when there is heavy computation, 0 is not enough?
    window.setTimeout(f, 20);
}
function show_start() {
    $('#run-indicator').show();
    //console.log('start layout');
}
function show_stop() {
    $('#run-indicator').hide();
    //console.log('stop layout');
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
var options = {
    server: {
        default: ''
    },
    statserv: {
        default: ''
    },
    interval: {
        default: 5000
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
        needs_redraw: true,
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
    var query = opt.query || key;
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
            opt.set = function(val) {
                $(opt.selector)
                    .prop('checked', val);
            };
            opt.watch = function(k) {
                $(opt.selector)
                    .change(function() {
                        var val = $(this).is(':checked');
                        k(val);
                    });
            };
            break;
        case 'string':
            opt.set = function(val) {
                $(opt.selector)
                    .val(val);
            };
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

var url = settings.server, vertices_url = url + '/nodes.psv', edges_url = url + '/edges.psv';
var filters = {};
var diagram = dc_graph.diagram('#graph', 'network');
var node_inv = {}, edge_inv = {};

function nocache_query() {
    return '?nocache=' + Date.now();
}

function load(get_inv, callback) {
    var psv = d3.dsv("|", "text/plain");
    var Q = queue()
            .defer(psv, vertices_url + nocache_query())
            .defer(psv, edges_url + nocache_query());
    if(get_inv) {
        var inv_nodes_url = url + '/inv-nodes.psv', inv_edges_url = url + '/inv-edges.psv';
        Q.defer(psv, inv_nodes_url + nocache_query())
            .defer(psv, inv_edges_url + nocache_query());
    }
    Q.await(function(error, vertices, edges, inv_vertices, inv_edges) {
        if(error)
            throw new Error(error);
        if(inv_vertices) {
            node_inv = {};
            inv_vertices.forEach(function(n) {
                var nn = node_inv[n.id] = node_inv[n.id] || {};
                nn[n.key] = n.val;
            });
            for(var id in node_inv) {
                var n = node_inv[id];
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

        // in cache, edges seems to be a superset of vertices, use that instead
        vertices = edges.filter(function(e) {
            return !e.id2;
        });
        edges = edges.filter(function(e) {
            return !!e.id2;
        });

        // populate vertex/edge properties from inventory, but warn about any problems
        var warnings = [];
        vertices.forEach(function(n) {
            var invn = node_inv[n.id1];
            if(!invn) {
                warnings.push('node ' + n.id1 + ' not found in inventory');
                return;
            }
            for(var a in n)
                if(a in invn && n[a] !== invn[a])
                    warnings.push('attr ' + a + ' of node ' + n.id1 + ': ' + n[a] + ' is not ' + invn[a]);
            _.extend(n, invn);
        });
        // make sure all vertices have ostype
        vertices.forEach(function(n) {
            n.ostype = n.ostype || 'OTHER';
        });
        edges.forEach(function(e) {
            var id = e.id1 + '|' + e.id2;
            var inve = edge_inv[id];
            if(!inve) {
                warnings.push('edge ' + id + ' not found in inventory');
                return;
            }
            for(var a in e)
                if(a in inve && e[a] !== inve[a])
                    warnings.push('attr ' + a + ' of edge ' + id + ': ' + e[a] + ' is not ' + inve[a]);
            _.extend(e, inve);
        });
        /*
        if(warnings.length)
            console.log('inventory/cache warnings', warnings);
         */
        callback(vertices, edges);
    });
}

function crossfilters(nodes, edges) {
    if(settings.node_limit)
        nodes = nodes.slice(0, settings.node_limit);
    var node_stuff = flat_group.make(nodes, function(d) { return d.id1; }),
        edge_stuff = flat_group.make(edges, function(d) { return d.id1 + '-' + d.id2; });
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
            runner.then(function() {
                do_redraw();
            });
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
            .showLayoutSteps(false)
            .lengthStrategy('jaccard')
            .baseLength(40)
        //.nodeFitLabelAccessor(false)
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
                return bad_name(kv.value.name) ? bad_name(kv.key) ? '' :
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
            dc_graph.legend().nodeWidth(70).nodeHeight(70).exemplars(exs));

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

var runner = make_runner(init, step, settings.interval);
runner.start();

