var options = {
    layout: {
        default: 'cola',
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
    worker: true,
    expandall: false,
    file: null,
    gvattr: {
        default: true,
        selector: '#graphviz-attrs',
        needs_redraw: 'refresh',
        exert: function(val, diagram) {
            if(val)
                dc_graph.apply_graphviz_accessors(collapseDiagram);
            else {
                collapseDiagram
                    .nodeFixed(function (n) {
                        return n.value.fixedPos;
                    })
                    .nodeStrokeWidth(0) // turn off outlines
                    .nodeFill(function(kv) {
                        return '#2E54A2';
                    })
                    .nodeLabelPadding({x: 2, y: 0})
                    .nodeLabelFill('white')
                    .edgeArrowhead(sync_url.vals.arrows ? 'vee' : null);
            }
        }
    },
    cutoff: null,
    limit: {
        default: 0.5,
        selector: '#cutoff',
        needs_redraw: true,
        exert: function(val, _, filters) {
            if(filters.cutoff) {
                d3.select('#cutoff-display').text(val);
                filters.cutoff.set(val);
            }
        }
    },
    datalink: false,
    arrows: false,
    tips: true,
    neighbors: true
};

var collapseDiagram = dc_graph.diagram('#graph');
var filters = {};
var sync_url = sync_url_options(options, dcgraph_domain(collapseDiagram), collapseDiagram, filters);

function apply_engine_parameters(engine) {
    switch(engine.layoutAlgorithm()) {
    case 'd3v4-force':
        engine
            .collisionRadius(125)
            .gravityStrength(0.05)
            .initialCharge(-500);
        break;
    case 'd3-force':
        engine
            .gravityStrength(0.1)
            .linkDistance('auto')
            .initialCharge(-5000);
        break;
    }
    return engine;
}

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

var url_output = sync_url.output(), more_output;
sync_url.output(function(params) {
    url_output(params);
    if(more_output)
        more_output(params);
});

function color_dfs(node, eq) {
    if(node.value().equiv === undefined)
        node.value().equiv = 0;
    const all_sources_same_eq = node.ins()
          .map(e => e.source().value().subeq)
          .every((sk,_,a) => sk === a[0]);
    if(node.value().equiv != 0 || !all_sources_same_eq)
        eq = node.value().subeq = node.value().equiv;
    else
        node.value().subeq = eq;
    for(var e of node.outs())
        color_dfs(e.target(), eq);
}

function copy_and_count_nonexpanded_dfs(node, expanded, seen, deduped, nodes, edges, dry) {
    if(seen[node.key()])
        return;
    seen[node.key()] = true;
    if(!dry)
        nodes.push(node.value());
    for(var e of node.outs()) {
        let tdry = dry;
        var target = e.target(), dt, teq = target.value().subeq;
        if(teq != 0 && teq != node.value().subeq) {
            if(!expanded.includes(teq)) {
                if((dt = deduped[teq])) {
                    ++dt.value().ceq;
                    edges.push({
                        key: e.key(),
                        sourcename: node.key(),
                        targetname: dt.key()
                    });
                    tdry = true;
                } else {
                    deduped[teq] = target;
                    ++target.value().ceq;
                }
            }
        }
        if(!tdry)
            edges.push(e.value());
        copy_and_count_nonexpanded_dfs(target, expanded, seen, deduped, nodes, edges, tdry);
    }
}

function propagate_expanded_counts_dfs(node, seen, count) {
    if(seen[node.key()])
        return;
    seen[node.key()] = true;
    for(var e of node.outs()) {
        let target = e.target(), dt, teq = target.value().subeq,
            tcount = count;
        if(teq != 0 && teq != node.value().subeq) {
            if(target.value().ceq)
                tcount = target.value().ceq;
            else if(teq)
                target.value().ceq = count;
        }
        propagate_expanded_counts_dfs(target, seen, tcount);
    }
}

var selection = sync_url.vals.expandall ? d3.range(1,13).map(x => x.toString()) : [];
function filter_data({nodes, edges, clusters, sourceattr, targetattr, nodekeyattr}) {
    const graph_spec =  {
        nodeKey: n => n[nodekeyattr],
        edgeKey: e => `${e[sourceattr]}->${e[targetattr]}`,
        nodeValue: n => n,
        edgeValue: e => e,
        edgeSource: e => e[sourceattr],
        edgeTarget: e => e[targetattr]
    };
    const graph = metagraph.graph(nodes, edges, graph_spec);
    console.log('size of input graph', graph.nodes().length, graph.edges().length);
    const n1 = graph.node('1') || graph.node('n1'); // assumed root
    color_dfs(n1, 0);
    const fnodes = [], fedges = [];
    for(const n of graph.nodes()) n.value().ceq = 0;
    copy_and_count_nonexpanded_dfs(n1, selection, {}, {}, fnodes, fedges);
    const graph2 = metagraph.graph(fnodes, fedges, graph_spec);
    propagate_expanded_counts_dfs(graph2.node('1') || graph2.node('n1'), {}, 1);
    console.log('size after filtering', fnodes.length, fedges.length);
    return {
        nodes: fnodes,
        edges: fedges,
        clusters, sourceattr, targetattr, nodekeyattr
    };
}

function apply_data({nodes, edges, clusters, sourceattr, targetattr, nodekeyattr}) {
    function update_data_link() {
        d3.select('#data-link')
            .style('visibility', sync_url.vals.datalink ? 'visible' : 'hidden')
            .attr('href', sync_url.what_if_url({file: dc_graph.data_url({nodes: nodes, edges: edges})}));
    }
    more_output = update_data_link;
    update_data_link();

    var edge_key = function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    };
    var edge_flat = dc_graph.flat_group.make(edges, edge_key),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; }),
        cluster_flat = dc_graph.flat_group.make(clusters || [], function(d) { return d.key; });
    collapseDiagram
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .clusterDimension(cluster_flat.dimension).clusterGroup(cluster_flat.group);
}

function on_load(filename, error, data) {
    if(error) {
        var heading = '';
        if(error.status)
            heading = 'Error ' + error.status + ': ';
        heading += 'Could not load file ' + filename;
        display_error(heading, error.message);
    }

    var graph_data;
    try {
        graph_data = dc_graph.munge_graph(data);
    }
    catch(munge_xep) {
        // specific to current application
        // convert and munge could be combined in some better thing
        // that tries many possibilities
        graph_data = dc_graph.convert_adjacency_list(data, {
            multipleGraphs: true,
            revAdjacencies: 'parent',
            nodeKey: 'key'
        }, {
            edgeKey: 'key',
            edgeSource: 'sourcename',
            edgeTarget: 'targetname',
        });
    }

    var engine = dc_graph.spawn_engine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
    collapseDiagram
        .layoutEngine(engine)
        .timeLimit(5000)
        .width('auto')
        .height('auto')
        .autoZoom('once')
        .restrictPan(true)
        .nodeParentCluster(data.node_cluster ? function(n) { return data.node_cluster[n.key]; } : null)
        .clusterParent(function(c) { return c.parent; })
    // aesthetics
        .nodeTitle(null); // deactivate basic tooltips

    if(sync_url.vals.cutoff) {
        d3.select('#cutoff-stuff').style('display', 'inline-block');
        var dim = edge_flat.crossfilter.dimension(function(d) {
            return +d[sync_url.vals.cutoff];
        });
        filters.cutoff = {
            set: function(v) {
                dim.filterRange([v, Infinity]);
            }
        };
    }

    var draw_clusters = dc_graph.draw_clusters();
    collapseDiagram.child('draw-clusters', draw_clusters);

    sync_url.exert();

    const cat20 = d3.scale.category20().domain([]);
    collapseDiagram
        .nodeFill(n => n.value.subeq)
        .nodeFillScale(v => v == 0 ?
                       'white' :
                       cat20(v - 1));
    const maxclass = d3.max(graph_data.nodes, n => +n.equiv);
    const exs = d3.range(0, maxclass+1).map(i => ({key: i.toString(), name: i ? `class ${i}` : 'unique', value: {subeq: i}}));
    var legend = dc_graph.legend('legend')
        .nodeWidth(70).nodeHeight(60)
        .exemplars(exs)
        .dimension(true)
        .isInclusiveDimension(true)
        .filterable(d => collapseDiagram.nodeKey.eval(d) !== "0")
        .customFilter(items => {
            selection = [...items];
            const filtered_data = filter_data(graph_data);
            apply_data(filtered_data);
            collapseDiagram.redraw();
        })
        .replaceFilter([selection]);
    legend.counter((_n, _e, _p, is_total) => graph_data.nodes.reduce((p, v) => {
        const eq = v.equiv;
        p[eq] = (p[eq] || 0) + 1;
        return p;
    }, {}));
    collapseDiagram.child('node-legend', legend);

    const annotate_nodes = dc_graph.annotate_nodes();
    collapseDiagram.child('annotate-nodes', annotate_nodes);

    var move_nodes = dc_graph.move_nodes();
    collapseDiagram.child('move-nodes', move_nodes);

    var fix_nodes = dc_graph.fix_nodes()
        .strategy(dc_graph.fix_nodes.strategy.last_N_per_component(Infinity));
    collapseDiagram.child('fix-nodes', fix_nodes);

    if(sync_url.vals.tips) {
        var tip = dc_graph.tip();
        var json_table = dc_graph.tip.html_or_json_table()
            .json(function(d) {
                return (d.orig.value.value || d.orig.value).jsontip || JSON.stringify(d.orig.value);
            });
        tip
            .showDelay(250)
            .content(json_table);
        collapseDiagram.child('tip', tip);
    }
    if(sync_url.vals.neighbors) {
        var highlight_neighbors = dc_graph.highlight_neighbors({
            edgeStroke: 'orangered',
            edgeStrokeWidth: 3
        }).durationOverride(0);
        collapseDiagram
            .child('highlight-neighbors', highlight_neighbors);
    }

    const filtered_data = filter_data(graph_data);
    apply_data(filtered_data);
    collapseDiagram.render();
}

if(!sync_url.vals.file)
    display_error('Need <code>?file=</code> in URL</br><small>or browse local file above right</small>');

dc_graph.load_graph(sync_url.vals.file, on_load.bind(null, sync_url.vals.file));
