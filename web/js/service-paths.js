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

var _rankmap = {
    VNF: 0,
    VFC: 1,
    VM: 2,
    Host: 3
};

var _colormap = {
    VNF: '#ff7f00',
    VFC: '#377eb8',
    VM: '#4daf4a',
    Host: '#984ea3'
};

function node_rank(n) {
    return _rankmap[node_type(n)];
}

var qs = querystring.parse();

var treeOnly = qs.treeOnly !== 'false',
    file = qs.file || null,
    paths = qs.paths || null;

if(!file)
    throw new Error('need a file');

var source = function(callback) {
    dc_graph.load_graph(file, callback);
};

function create_diagram(sel) {
    return dc_graph.diagram(sel)
        .width($(sel)[0].offsetWidth)
        .height($(sel)[0].offsetHeight)
        .margins({left: 5, top: 5, right: 5, bottom: 5});
}

function diagram_common(diagram, nodes, edges, nodekeyattr, sourceattr, targetattr) {
    var edge_flat = flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    diagram
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .fitStrategy('default')
        .parallelEdgeOffset(3)
        .timeLimit(10000)
        .transitionDuration(250)
        .stageTransitions('none')
        .showLayoutSteps(false)
        .edgeOpacity(0.2)
        .nodeOpacity(0.2)
        .edgeLabel(null)
        .induceNodes(true)
        .nodeLabel(null)
        .nodeTitle(function(n) { return n.value.name; })
        .nodeStrokeWidth(0)
        .nodeFill(function(n) {
            return _colormap[node_type(n)];
        })
    ;
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

var diagram, levels = {};

source(function(error, data) {
    if(error) {
        console.log(error);
        return;
    }
    var graph_data = munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    init_queries(nodes, edges);

    var highlight_paths_hier = dc_graph.highlight_paths({ // path props
        nodeRadius: 10,
        edgeOpacity: 1,
        nodeOpacity: 0.7
    }, { // hover props
        nodeOpacity: 1,
        nodeLabel: function(n) {
            return n.value.name;
        },
        nodeStroke: '#e41a1c',
        edgeStrokeWidth: 2,
        edgeStroke: '#e41a1c'
    });

    diagram = create_diagram('#hierarchy');
    diagram_common(diagram, nodes, edges, nodekeyattr, sourceattr, targetattr);
    diagram
        .edgeArrowhead(null)
        .nodeRadius(2)
        .nodePadding(2)
        .child('highlight-paths', highlight_paths_hier)
    ;
    diagram
        .initialLayout(dc_graph.tree_positions(null, node_rank, is_tree_edge.bind(null, diagram),
                                               25, 25, function(n) {
                                                   return n.dcg_rx*2 + diagram.nodePadding();
                                               }, 100))
        .initialOnly(true)
    ;

    var bylayer = nodes.reduce(function(m, n) {
        var t = raw_node_type(n);
        (m[t] = m[t] || []).push(n);
        return m;
    }, {});

    var highlight_paths_level = dc_graph.highlight_paths({ // path props
        edgeOpacity: 1,
        nodeOpacity: 1,
        nodeRadius: 8,
        nodePadding: 10,
        edgeArrowhead: 'vee'
    }, { // hover props
        nodeStroke: '#e41a1c',
        nodeStrokeWidth: 2,
        nodeRadius: 10,
        edgeStrokeWidth: 2,
        edgeStroke: '#e41a1c'
    });

    for(var type in bylayer) {
        var sel = '#' + type.toLowerCase();
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

    dc.renderAll();

    if(paths) {
        d3.json(paths, function(error, data) {
            if(error)
                throw new Error(error);
            read_paths.data(data);
        });
    }
});
