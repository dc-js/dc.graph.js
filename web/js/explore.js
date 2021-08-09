var options = {
    file: null,
    tickSize: 1,
    transition: 1000,
    stage: 'insmod',
    linkLength: 30,
    layout: {
        default: 'cola',
        values: dc_graph.engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: function(val, diagram) {
            var engine = dc_graph.spawn_engine(val);
            apply_engine_parameters(engine);
            diagram
                .layoutEngine(engine);
        }
    },
    worker: true,
    timeLimit: 10000,
    start: null,
    directional: false,
    bigzoom: false,
    rndarrow: null,
    edgeCat: null,
    edgeExpn: null,
    expand_strategy: null,
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
var exploreDiagram = dc_graph.diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(exploreDiagram), exploreDiagram);

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
    case 'cola':
        engine.lengthStrategy('individual');
        break;
    }
    exploreDiagram.initLayoutOnRedraw(engine.layoutAlgorithm() === 'cola');
    return engine;
}

// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript#47593316
function xfnv1a(k) {
    for(var i = 0, h = 2166136261 >>> 0; i < k.length; i++)
        h = Math.imul(h ^ k.charCodeAt(i), 16777619);
    return function() {
        h += h << 13; h ^= h >>> 7;
        h += h << 3;  h ^= h >>> 17;
        return (h += h << 5) >>> 0;
    };
}
function sfc32(a, b, c, d) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
}
function rand(s) {
    var seed = xfnv1a(s);
    return sfc32(seed(), seed(), seed(), seed());
}

d3.select('#user-file').on('change', function() {
    var filename = this.value;
    if(filename) {
        var reader = new FileReader();
        reader.onload = function(e) {
            hide_error();
            dc_graph.load_graph_text(e.target.result, filename, on_load.bind(null, filename));
            sync_url.update('expanded', []);
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

// graphlib-dot seems to wrap nodes in an extra {value}
// actually this is quite a common problem with generic libs
function nvalue(n) {
    return n.value.value ? n.value.value : n.value;
}


var expand_collapse;
function on_load(filename, error, data) {
    if(error) {
        var heading = '';
        if(error.status)
            heading = 'Error ' + error.status + ': ';
        heading += 'Could not load file ' + filename;
        display_error(heading, error.message);
    }
    var graph_data = dc_graph.munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    function update_data_link() {
        d3.select('#data-link')
            .attr('href', sync_url.what_if_url({file: dc_graph.data_url({nodes: nodes, edges: edges})}));
    }
    more_output = update_data_link;
    update_data_link();

    var edge_key = function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    };
    var edge_flat = dc_graph.flat_group.make(edges, edge_key),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    var engine = dc_graph.spawn_engine(sync_url.vals.layout, sync_url.vals, sync_url.vals.worker);
    apply_engine_parameters(engine);

    exploreDiagram
        .width('auto')
        .height('auto')
        .restrictPan(true)
        .layoutEngine(engine)
        .fitStrategy('align_tc')
        .timeLimit(sync_url.vals.timeLimit)
        .transitionDuration(sync_url.vals.transition)
        .stageTransitions(sync_url.vals.stage)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .nodeLabelPadding(5)
        .edgeArrowhead('vee')
        .edgeLength(function(e) {
            var e2 = exploreDiagram.getWholeEdge(e.key);
            return 40 + Math.hypot(e2.source.dcg_rx + e2.target.dcg_rx, e2.source.dcg_ry + e2.target.dcg_ry);
        });
    dc_graph.apply_graphviz_accessors(exploreDiagram);
    exploreDiagram.child('tip', dc_graph.tip().content(dc_graph.tip.html_or_json_table()));
    if(sync_url.vals.bigzoom)
        exploreDiagram.zoomExtent([0.001, 200]);
    if(sync_url.vals.rndarrow) {
        var arrowheadscale, arrowtailscale;
        var anames = Object.keys(dc_graph.builtin_arrows);

        function arrowgen(rnd) {
            return d3.range(Math.floor(rnd() * 5))
                .map(function (i) {
                    return (rnd() > 0.5 ? 'o' : '') + anames[Math.floor(rnd() * anames.length)];
                }).join('');
        };
        var now = String(new Date());
        switch(sync_url.vals.rndarrow) {
        case 'one':
            arrowheadscale = d3.scale.ordinal().range(d3.shuffle(Object.keys(dc_graph.builtin_arrows)));
            arrowtailscale = d3.scale.ordinal().range(d3.shuffle(Object.keys(dc_graph.builtin_arrows)));
            break;
        case 'lots':
            arrowheadscale = arrowtailscale = function(label) {
                return arrowgen(rand((label || '') + now));
            };
            break;
        case 'changing':
            var seed = 1;
            // will change only when rendering not active
            window.setInterval(function() {
                console.log('change arrows');
                ++seed;
            }, 500);
            arrowheadscale = arrowtailscale = function(label) {
                return arrowgen(rand((label || '') + now + seed));
            };
            break;
        default:
            throw new Error('unknown rndarrow "' + sync_url.vals.rndarrow + '"');
        }
        exploreDiagram.edgeArrowhead(function (e) {
            return arrowheadscale(e.value.label);
        }).edgeArrowtail(function (e) {
            return arrowtailscale(e.value.label);
        });
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
        exploreDiagram.child('edge-legend', edge_legend);
    }

    var nodelist = exploreDiagram.nodeGroup().all().map(function(n) {
        return {
            value: n.key,
            label: exploreDiagram.nodeLabel()(n)
        };
    });
    nodelist.sort(function (a, b) {
        return a.label < b.label ? -1 : 1;
    });

    var expand_strategy = sync_url.vals.expand_strategy || 'expanded_hidden';
    var ec_strategy = dc_graph.expand_collapse[expand_strategy]({
        nodeCrossfilter: node_flat.crossfilter,
        edgeCrossfilter: edge_flat.crossfilter,
        edgeGroup: edge_flat.group,
        nodeKey: function(n) {
            return n.name;
        },
        edgeRawKey: function(e) {
            return edge_key(e);
        },
        edgeSource: function(e) {
            return e.value[sourceattr];
        },
        edgeTarget: function(e) {
            return e.value[targetattr];
        },
        directional: sync_url.vals.directional
    });

    if(sync_url.vals.start) {
        if(!nodes.find(function (n) {
            return n.name === sync_url.vals.start;
        })) {
            var found = nodes.find(function (n) {
                return n.value.label.includes(sync_url.vals.start);
            });
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
        exploreDiagram.child('troubleshoot', troubleshoot);
    }

    expand_collapse = dc_graph.expand_collapse(ec_strategy);
    exploreDiagram.child('expand-collapse', expand_collapse);
    exploreDiagram.child('highlight-expanded', dc_graph.highlight_things(
        {
            nodeStrokeWidth: 5,
            nodeStroke: 'steelblue'
        },
        {},
        'expanded-highlight', 'expanded-highlight-group', 147
    ).durationOverride(0));
    exploreDiagram.child('highlight-collapse', dc_graph.highlight_things(
        {
            nodeOpacity: 0.2,
            nodeStroke: 'darkred',
            edgeOpacity: 0.2,
            edgeStroke: 'darkred'
        },
        {},
        'collapse-highlight', 'collapse-highlight-group', 150
    ).durationOverride(0));
    exploreDiagram.child('highlight-hide', dc_graph.highlight_things(
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
    exploreDiagram.autoZoom('once-noanim');
    var starter = d3.select('#add-node');
    var option = starter.selectAll('option').data([{label: 'select one'}].concat(nodelist));
    option.enter().append('option');
    option.exit().remove();
    option
        .attr('value', function(d) { return d.value; })
        .attr('selected', function(d) { return d.value === sync_url.vals.start ? 'selected' : null; })
        .text(function(d) { return d.label; });

    starter.on('change', function() {
        expand_collapse.expand('both', this.value, true);
        exploreDiagram.autoZoom('once-noanim');
        dc.redrawAll();
    });

    d3.select('#reset').on('click', function() {
        sync_url.update('expanded', []);
    });

    if(sync_url.vals.start)
        expand_collapse.expand('both', sync_url.vals.start, true);
    else sync_url.exert();
}

if(!sync_url.vals.file)
    display_error('Need <code>?file=</code> in URL!');

dc_graph.load_graph(sync_url.vals.file, on_load.bind(null, sync_url.vals.file));
