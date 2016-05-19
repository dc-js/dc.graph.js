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

var hierarchy_big_layout = {
    direction: 'row',
    divs: [{
        id: 'left',
        flex: 4,
        direction: 'column',
        divs: [{
            id: 'hierarchy',
            class: 'thin-border',
            bring: true,
            flex: 3
        }, {
            id: 'query',
            class: 'thin-border',
            flex: 1,
            direction: 'column',
            bring: true
        }]
    }, {
        id: 'right',
        flex: 1,
        direction: 'column',
        deflex: 1,
        divs: [{
            id: 'vnf',
            class: 'thin-border',
            bring: true
        }, {
            id: 'vfc',
            class: 'thin-border',
            bring: true
        }, {
            id: 'vm',
            class: 'thin-border',
            bring: true
        }, {
            id: 'host',
            class: 'thin-border',
            bring: true
        }]
    }]
};

var split_layout = {
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
                id: 'hierarchy',
                class: 'thin-border',
                bring: true
            }, {
                class: 'thin-border',
                bring: true
            }]
        }, {
            id: 'query',
            class: 'thin-border',
            flex: 1,
            direction: 'column',
            bring: true
        }]
    }, {
        id: 'right',
        flex: 1,
        direction: 'column',
        deflex: 1,
        divs: [{
            class: 'thin-border',
            bring: true
        }, {
            class: 'thin-border',
            bring: true
        }, {
            class: 'thin-border',
            bring: true
        }]
    }]
};

function place_diagram(id) {
    if(id==='hierarchy' && diagram)
        size_diagram(diagram, '#wrap-hierarchy');
    else if(levels[id])
        size_diagram(levels[id], '#wrap-' + id);
}

flex_divs('#main', hierarchy_big_layout);

var expanded = 'hierarchy';

function expanded_layout(id) {
    if(id === 'hierarchy')
        return hierarchy_big_layout;
    else {
        var layout = split_layout;
        layout.divs[0].divs[0].divs[1].id = id;
        var remaining = ['vnf', 'vfc', 'vm', 'host'].filter(function(n) { return n !== id; });
        layout.divs[1].divs.forEach(function(d, i) {
            d.id = remaining[i];
        });
        return layout;
    }
}

function expand_view(id) {
    if(id === expanded)
        id = 'hierarchy';
    flex_divs('#main', expanded_layout(id), place_diagram);
    expanded = id;
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

function size_diagram(diagram, sel) {
    diagram
        .width($(sel).innerWidth())
        .height($(sel).innerHeight())
        .zoomToFit();
    return diagram;
}

function create_diagram(id) {
    d3.select('#' + id)
        .append('span')
        .attr('class', 'graph-title')
        .text(id)
        .on('click', function() {
            expand_view(id);
        });
    return size_diagram(dc_graph.diagram('#' + id)
                        .margins({left: 10, top: 10, right: 10, bottom: 10}),
                        '#wrap-' + id);
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
        .nodeTitle(null)
        .autoZoom('once')
        .nodeStrokeWidth(0)
        .nodeFill(function(n) {
            return _colormap[node_type(n)];
        })
    ;

    var tip = dc_graph.tip();
    var table = dc_graph.tip.table();
    table
        .filter(function(k) {
            return k==='label_' || !(/^_/.test(k) || /_$/.test(k));
        });
    tip
        .direction('e')
        .content(table)
        .delay(500);

    diagram.child('tip', tip);
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

    highlight_paths_hier.doRedraw(true);

    var hnodes = nodes.filter(function(n) {
        var type = raw_node_type(n);
        return ['Network', 'VFC_A', 'CCE_Logical', 'CCE_Physical', 'Switch'].indexOf(type)===-1;
    });

    if(!qs.skipDiagrams) {
        diagram = create_diagram('hierarchy');
        diagram_common(diagram, hnodes, edges, nodekeyattr, sourceattr, targetattr);
        diagram
            .fitStrategy('vertical')
            .edgeArrowhead(null)
            .nodeRadius(3)
            .nodePadding(1)
            .child('highlight-paths', highlight_paths_hier)
            .edgeIsShown(function(e) {
                return is_tree_edge(diagram, e);
            })
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

    if(bylayer.VFC_A) {
        bylayer.VFC = bylayer.VFC.concat(bylayer.VFC_A);
        delete bylayer.VFC_A;
    }

    if(bylayer.Network) {
        bylayer.VM = bylayer.VM.concat(bylayer.Network);
        delete bylayer.Network;
    }

    if(bylayer.CCE_Logical) {
        bylayer.VM = bylayer.VM.concat(bylayer.CCE_Logical);
        delete bylayer.CCE_Logical;
    }

    if(bylayer.CCE_Physical) {
        bylayer.Host = bylayer.Host.concat(bylayer.CCE_Physical);
        delete bylayer.CCE_Physical;
    }

    if(bylayer.Switch) {
        bylayer.Host = bylayer.Host.concat(bylayer.Switch);
        delete bylayer.Switch;
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

        var id = type.toLowerCase();
        if(!qs.skipDiagrams) {
            var dialev = create_diagram(id);
            diagram_common(dialev, bylayer[type], edges, nodekeyattr, sourceattr, targetattr);
            levels[type.toLowerCase()] = dialev
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