var qs = querystring.parse();

function raw_node_type(n) {
    return n.label_.split(':')[2];
}

function node_type(n) {
    return raw_node_type(n.value);
}

function is_tree_edge(diagram, e) {
    return node_type(diagram.getNode(diagram.edgeSource()(e))) !==
        node_type(diagram.getNode(diagram.edgeTarget()(e)));
}

function is_root_node(n) {
    return node_type(n) === 'VNF';
}

function node_rank(n) {
    return _rankmap[node_type(n)];
}

var _rankmap = {
    VNF: 0,
    VFC: 1,
    VM: 2,
    Host: 3
};

var _colormap = {
    VNF: '#ff7f00',
    VFC: '#377eb8',
    VFC_A: '#f0027f',
    VM: '#4daf4a',
    Host: '#984ea3',
    Network: '#ffff33'
};

var lr_layout = {
    direction: 'row',
    divs: [{
        id: 'left',
        flex: 4,
        direction: 'column',
        divs: [{
            id: 'hierarchy',
            flex: 3
        }, {
            id: 'query',
            flex: 1,
            direction: 'column',
            divs: [{
                id: 'selections'
            }, {
                id: 'query_paths',
                flex: 1,
                direction: 'row',
                divs: [{
                    id: 'qedit',
                    flex: 2
                }, {
                    id: 'paths',
                    flex: 1
                }]
            }]
        }]
    }, {
        id: 'right',
        flex: 1,
        direction: 'column',
        deflex: 1,
        divs: [{
            id: 'vnf'
        }, {
            id: 'vfc'
        }, {
            id: 'vm'
        }, {
            id: 'host'
        }]
    }]
};

var zoom_layout = {
    direction: 'row',
    divs: [{
        id: 'left',
        flex: 4,
        direction: 'column',
        divs: [{
            flex: 3,
            direction: 'row',
            deflex: 1,
            divs: [{
                id: 'hierarchy'
            }, {
                id: 'vm'
            }]
        }, {
            id: 'query',
            flex: 1,
            direction: 'column',
            divs: [{
                id: 'selections'
            }, {
                id: 'query_paths',
                flex: 1,
                direction: 'row',
                divs: [{
                    id: 'qedit',
                    flex: 2
                }, {
                    id: 'paths',
                    flex: 1
                }]
            }]
        }]
    }, {
        id: 'right',
        flex: 1,
        direction: 'column',
        deflex: 1,
        divs: [{
            id: 'vnf'
        }, {
            id: 'vfc'
        }, {
            id: 'host'
        }]
    }]
};

flex_divs('#main', lr_layout);

var zoomed = false;

if(qs.switchLayout) {
    d3.select('#switch-layout')
        .style('display', 'inline')
        .on('click', function() {
            zoomed = !zoomed;
            flex_divs('#main', zoomed ? zoom_layout : lr_layout);
        });
}

var treeOnly = qs.treeOnly !== 'false',
    file = qs.file || null,
    file2 = qs.file2 || null,
    paths = qs.paths || null;

if(!file)
    throw new Error('need a file');

var source = function(callback) {
    if(file2)
        dc_graph.load_graph(file, file2, callback);
    else
        dc_graph.load_graph(file, callback);
};

function create_diagram(sel) {
    return dc_graph.diagram(sel)
        .width($(sel).innerWidth())
        .height($(sel).innerHeight())
        .margins({left: 10, top: 10, right: 10, bottom: 10});
}

function diagram_common(diagram, nodes, edges, nodekeyattr, sourceattr, targetattr) {
    var edge_flat = flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = flat_group.make(nodes, function(d) {
            return d[nodekeyattr];
        });

    diagram
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .parallelEdgeOffset(3)
        .timeLimit(10000)
        .transitionDuration(qs.tdur || 250)
        .stageTransitions('none')
        .showLayoutSteps(false)
        .edgeOpacity(0.2)
        .nodeOpacity(0.4)
        .edgeLabel(null)
        .induceNodes(true)
        .nodeLabel(null)
        .nodeTitle(function(n) { return n.value.name; })
        .nodeStrokeWidth(0)
        .nodeFill(function(n) {
            return _colormap[node_type(n)];
        })
    ;

    var tip = dc_graph.tip();
    tip.content(tip.table());

    diagram.child('tip', tip);
    //diagram.DEBUG_BOUNDS = true;
}

var read_paths = dc_graph.path_reader()
        .pathList(function(data) {
            return data.results;
        }).elementList(function(path) {
            return path.element_list;
        }).elementType(function(element) {
            return element.element_type;
        }).nodeKey(function(element) {
            return element.property_map.ecomp_uid;
        }).edgeSource(function(element) {
            return element.property_map.source_ecomp_uid;
        }).edgeTarget(function(element) {
            return element.property_map.target_ecomp_uid;
        });


function init_queries(nodes, edges) {
    function populate_select(select, vals, def) {
        var opts = select.selectAll('option').data(vals);
        opts.enter().append('option');
        opts.exit().remove();
        opts
            .attr('value', function(d) { return d; })
            .text(function(d) { return d; });
        var i = 0;
        if(def) {
            var j = vals.indexOf(def);
            if(j>=0)
                i = j;
        }
        select.node().selectedIndex = i;
        return vals[i];
    }
    function populate_qedit(text, p1) {
        text = text.replace(/\$\$1\$\$/, p1);
        qedit.getSession().setValue(text);
    }
    function do_selects(index) {
        nquery = nepal_queries[index];
        var s1 = nquery.select1, p1;
        select1.style('display', s1 ? null : 'none');
        if(s1) {
            select1.select('.desc').text(s1.name);
            p1 = populate_select(select1.select('select'), values1 = s1.init(nodes, edges), s1.default);
        }
        populate_qedit(nquery.query, p1);
    }
    var squery = d3.select('#squery'), select1 = d3.select('#select1');
    var nquery, values1;
    var qopts = squery.selectAll('option').data(nepal_queries);
    qopts.enter().append('option')
        .attr('value', function(d) { return d.name; })
        .text(function(d) { return d.description; });
    qopts.exit().remove();
    squery.on('change', function() {
        var val = this.selectedIndex;
        do_selects(val);
    });
    select1.select('select').on('change', function() {
        var val = this.selectedIndex;
        populate_qedit(nquery.query, values1[val]);
    });
    do_selects(0);
}

var qedit = ace.edit("qedit");
qedit.setTheme("ace/theme/tomorrow");
qedit.getSession().setMode("ace/mode/sql");
qedit.getSession().setUseWrapMode(true);

var nepal = d3.xhr(qs.nepal).header("Content-type", "application/x-www-form-urlencoded");

function execute_query() {
    nepal.post("url=" + encodeURIComponent(qs.nurl) + "&query=" + encodeURIComponent(qedit.getSession().getValue()), function(error, result) {
        if(error)
            throw new Error(error);
        read_paths.data(JSON.parse(result.responseText));
    });
}

d3.select('#submit').on('click', execute_query);
d3.select('#selections').on('keypress', function(e) {
    if(d3.event.keyCode === $.ui.keyCode.ENTER)
        execute_query();
});
qedit.commands.addCommands([{
    name: 'executeQuery',
    bindKey: {
        win: 'Alt-Return',
        mac: 'Alt-Return',
        sender: 'editor'
    },
    exec: function() {
        execute_query();
    }
}]);

var pathsel = path_selector('#paths', read_paths);
var diagram, levels = {};

source(function(error, data) {
    if(error) {
        console.log(error);
        return;
    }
    var graph_data = munge_graph(data, 'ecomp_uid'),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    init_queries(nodes, edges);

    var highlight_paths_hier = dc_graph.highlight_paths({ // path props
        nodeRadius: 8,
        edgeOpacity: 1,
        nodeOpacity: 0.5
    }, { // hover props
        nodeOpacity: 0.7,
        edgeStrokeWidth: 2,
        edgeStroke: '#e41a1c'
    }, { // selected props
        nodeOpacity: 1,
        nodeLabel: function(n) {
            return n.value.name;
        },
        nodeStroke: '#e41a1c'
    });

    var hnodes = nodes.filter(function(n) {
        var type = raw_node_type(n);
        return ['Network', 'VFC_A'].indexOf(type)===-1;
    });

    if(!qs.skipDiagrams) {
        diagram = create_diagram('#hierarchy');
        diagram_common(diagram, hnodes, edges, nodekeyattr, sourceattr, targetattr);
        diagram
            .fitStrategy('vertical')
            .edgeArrowhead(null)
            .nodeRadius(3)
            .nodePadding(1)
            .child('highlight-paths', highlight_paths_hier)
        ;
        diagram
            .initialLayout(dc_graph.tree_positions(null, node_rank, is_tree_edge.bind(null, diagram),
                                                   25, 25, function(n) {
                                                       return n.dcg_rx*2 + diagram.nodePadding();
                                                   }, 100))
            .initialOnly(true)
        ;
    }

    var bylayer = nodes.reduce(function(m, n) {
        var t = raw_node_type(n);
        (m[t] = m[t] || []).push(n);
        return m;
    }, {});

    if(bylayer.Network) {
        bylayer.VM = bylayer.VM.concat(bylayer.Network);
        bylayer.Host = bylayer.Host.concat(bylayer.Network);
        delete bylayer.Network;
    }

    if(bylayer.VFC_A) {
        bylayer.VFC = bylayer.VFC.concat(bylayer.VFC_A);
        delete bylayer.VFC_A;
    }

    for(var type in bylayer) {
        var highlight_paths_level = dc_graph.highlight_paths({ // path props
            edgeOpacity: 1,
            nodeOpacity: 0.5,
            nodeRadius: 8,
            nodePadding: 10,
            edgeArrowhead: 'vee'
        }, { // hover props
            nodeOpacity: 0.7,
            edgeStrokeWidth: 2,
            edgeStroke: '#e41a1c'
        }, { // selected props
            nodeOpacity: 1,
            nodeLabel: function(n) {
                return n.value.name;
            },
            nodeStroke: '#e41a1c',
            nodeStrokeWidth: 2,
            nodeRadius: 10
        });

        var sel = '#' + type.toLowerCase();
        if(!qs.skipDiagrams) {
            var dialev = create_diagram(sel);
            diagram_common(dialev, bylayer[type], edges, nodekeyattr, sourceattr, targetattr);
            levels[type] = dialev
                .edgeArrowSize(0.5)
                .nodeRadius(5)
                .parallelEdgeOffset(5)
                .edgeArrowhead(null)
                .baseLength(20)
                .lengthStrategy('symmetric')
                .child('highlight-paths', highlight_paths_level)
            ;
        }
    }

    dc.renderAll();

    if(paths) {
        d3.json(paths, function(error, data) {
            if(error)
                throw new Error(error);
            read_paths.data(data);
        });
    }
});
