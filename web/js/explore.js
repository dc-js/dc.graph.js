var options = {
    file: null,
    tickSize: 1,
    transition: 1000,
    stage: 'insmod',
    linkLength: 30,
    layout: 'cola',
    timeLimit: 10000,
    start: null,
    directional: false,
    rndarrow: false,
    edgeCat: null,
    edgeExpn: null,
    expanded: {
        default: [],
        subscribe: function(k) {
            var expanded_highlight_group = dc_graph.register_highlight_things_group(options.expanded_highlight_group || 'expanded-highlight-group');
            expanded_highlight_group.on('highlight.sync-url', function(nodeset, edgeset) {
                k(Object.keys(nodeset).filter(function(nk) {
                    return nodeset[nk];
                }));
            });
        },
        dont_exert_after_subscribe: true,
        exert: function(val, diagram) {
            expand_collapse
                .expandNodes(val);
        }
    }
};
var diagram = dc_graph.diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(diagram), diagram);

function display_error(message) {
    d3.select('#message')
        .style('display', null)
        .html('<h1>' + message + '</h1>');
    throw new Error(message);
}
if(!sync_url.vals.file)
    display_error('Need <code>?file=</code> in URL!');

var expand_collapse;
dc_graph.load_graph(sync_url.vals.file, function(error, data) {
    if(error) {
        var message = '';
        if(error.status)
            message = 'Error ' + error.status + ': ';
        message += 'Could not load file ' + sync_url.vals.file;
        display_error(message);
    }
    var graph_data = dc_graph.munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    var edge_key = function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    };
    var edge_flat = dc_graph.flat_group.make(edges, edge_key),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    var engine = dc_graph.spawn_engine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker != 'false');

    diagram
        .width('auto')
        .height('auto')
        .layoutEngine(engine)
        .fitStrategy('align_tc')
        .timeLimit(sync_url.vals.timeLimit)
        .transitionDuration(sync_url.vals.transition)
        .stageTransitions(sync_url.vals.stage)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .nodeLabel(function(n) { return n.value.value.label.split(/\n|\\n/); })
        .nodeShape(function(n) { return n.value.value.shape; })
        .nodeFill(function(n) { return n.value.value.fillcolor || 'white'; })
        .edgeLabel(function(e) { return e.value.label ? e.value.label.split(/\n|\\n/) : ''; })
        .edgeArrowhead('vee')
        .edgeStroke(function(e) { return e.value.color || 'black'; })
        .edgeStrokeDashArray(function(e) {
            switch(e.value.style) {
            case 'dotted':
                return [1,5];
            }
            return null;
        });
    if(sync_url.vals.rndarrow) {
        var arrowheadscale = d3.scale.ordinal().range(d3.shuffle(Object.keys(dc_graph.builtin_arrows)));
        var arrowtailscale = d3.scale.ordinal().range(d3.shuffle(Object.keys(dc_graph.builtin_arrows)));
        diagram
            .edgeArrowhead(e => arrowheadscale(e.value.label))
            .edgeArrowtail(e => arrowtailscale(e.value.label));
    }
    if(engine.layoutAlgorithm() === 'cola') {
        engine
            .tickSize(sync_url.vals.tickSize);
        engine.baseLength(sync_url.vals.linkLength);
    }

    if(sync_url.vals.edgeCat) {
        var eregex = sync_url.vals.edgeExpn ? new RegExp(sync_url.vals.edgeExpn) : null;
        var edge_cat = eregex ?
                function(e) {
                    var match = eregex.exec(e[sync_url.vals.edgeCat]);
                    return match ? match[0] : '';
                } :
            function(e) {
                return e[sync_url.vals.edgeCat] || '';
            };
        var edge_dim = edge_flat.crossfilter.dimension(edge_cat),
            edge_group = edge_dim.group().reduce(
                function(p, v) {
                    return v.color;
                },
                function(p, v) {
                    return p;
                },
                function() {
                    return null;
                }
            );
        var edge_legend = dc_graph.legend('edge-legend')
                .x(20).y(20)
                .itemWidth(75).itemHeight(20)
                .type(dc_graph.legend.edge_legend())
                .omitEmpty(true)
                .exemplars(edge_group.all().map(function(kv) {
                    return {name: kv.key, key: kv.key, value: {color: kv.value} };
                }));
        edge_legend.counter(function(wnodes, wedges, wports) {
            var counts = {};
            wedges.forEach(function(e) {
                counts[edge_cat(e.value)] = (counts[edge_cat(e.value)] || 0) + 1;
            });
            return counts;
        });
        edge_legend.dimension(edge_dim);
        diagram.child('edge-legend', edge_legend);
    }

    var nodelist = diagram.nodeGroup().all().map(function(n) {
        return {
            value: n.key,
            label: diagram.nodeLabel()(n)
        };
    });
    nodelist.sort((a,b) => a.label < b.label ? -1 : 1);

    var expand_strategy = sync_url.vals.expand_strategy || 'expanded_hidden';
    var ec_strategy = dc_graph.expand_collapse[expand_strategy]({
        nodeCrossfilter: node_flat.crossfilter,
        edgeCrossfilter: edge_flat.crossfilter,
        edgeGroup: edge_flat.group,
        nodeKey: n => n.name,
        edgeRawKey: e => edge_key(e),
        edgeSource: e => e.value[sourceattr],
        edgeTarget: e => e.value[targetattr],
        directional: sync_url.vals.directional
    });

    if(sync_url.vals.start) {
        if(!nodes.find(n => n.name === sync_url.vals.start)) {
            let found = nodes.find(n => n.value.label.includes(sync_url.vals.start));
            if(found)
                sync_url.vals.start = found.name;
            else {
                console.log("didn't find '" + sync_url.vals.start + "' by nodeKey or nodeLabel");
                sync_url.vals.start = null;
            }
        }
    }

    if(sync_url.vals.debug) {
        var troubleshoot = dc_graph.troubleshoot();
        diagram.child('troubleshoot', troubleshoot);
    }

    expand_collapse = dc_graph.expand_collapse(ec_strategy);
    diagram.child('expand-collapse', expand_collapse);
    diagram.child('highlight-expanded', dc_graph.highlight_things(
        {
            nodeStrokeWidth: 5,
            nodeStroke: 'steelblue'
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
    diagram.autoZoom('once-noanim');
    var starter = d3.select('#start-from');
    var option = starter.selectAll('option').data([{label: 'select one'}].concat(nodelist));
    option.enter().append('option')
        .attr('value', function(d) { return d.value; })
        .attr('selected', function(d) { return d.value === sync_url.vals.start ? 'selected' : null; })
        .text(function(d) { return d.label; });

    starter.on('change', function() {
        expand_collapse.expand('both', this.value, true);
        diagram.autoZoom('once-noanim');
        dc.redrawAll();
    });
    if(sync_url.vals.start)
        expand_collapse.expand('both', sync_url.vals.start, true);
    else sync_url.exert();
});

