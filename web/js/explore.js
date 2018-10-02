var qs = querystring.parse();

var options = Object.assign({
    tickSize: 1,
    transition: 1000,
    stage: 'insmod',
    linkLength: 30,
    layout: 'cola',
    timeLimit: 10000
}, qs);

if(!options.file) {
    d3.select('#message')
        .style('display', null)
        .html('<h1>Need <code>?file=</code> in URL!</h1>');
}

var diagram = dc_graph.diagram('#graph');
dc_graph.load_graph(options.file, function(error, data) {
    if(error) {
        console.log(error);
        return;
    }
    var graph_data = dc_graph.munge_graph(data),
        nodes = graph_data.nodes,
        edges = graph_data.edges,
        sourceattr = graph_data.sourceattr,
        targetattr = graph_data.targetattr,
        nodekeyattr = graph_data.nodekeyattr;

    var edge_flat = dc_graph.flat_group.make(edges, function(d) {
        return d[sourceattr] + '-' + d[targetattr] + (d.par ? ':' + d.par : '');
    }),
        node_flat = dc_graph.flat_group.make(nodes, function(d) { return d[nodekeyattr]; });

    var engine = dc_graph.spawn_engine(options.layout, qs, options.worker != 'false');
    diagram
        .width(null)
        .height(null)
        .layoutEngine(engine)
        .timeLimit(+options.timeLimit)
        .transitionDuration(+options.transition)
        .stageTransitions(options.stage)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .edgeSource(function(e) { return e.value[sourceattr]; })
        .edgeTarget(function(e) { return e.value[targetattr]; })
        .nodeLabel(function(n) { return n.value.value.label.split('\n'); })
        .nodeShape(function(n) { return n.value.value.shape; })
        .nodeFill(function(n) { return n.value.value.fillcolor || 'white'; })
        .edgeLabel(function(e) { return e.value.label; })
        .edgeArrowhead('vee')
        .edgeStroke(function(e) { return e.value.color || 'black'; })
        .edgeStrokeDashArray(function(e) {
            switch(e.value.style) {
            case 'dotted':
                return [1,5];
            }
            return null;
        });
//        .child('highlight-neighbors', dc_graph.highlight_neighbors({edgeStroke: 'orangered', edgeStrokeWidth: 3}));
    if(engine.layoutAlgorithm() === 'cola') {
        engine
            .tickSize(+options.tickSize);
        engine.baseLength(+options.linkLength);
    }

    var expander = null, expanded = {};

    // second dimension on keys so that first will observe it
    expander = node_flat.crossfilter.dimension(function(d) { return d.name; });
    function apply_expander_filter() {
        expander.filterFunction(function(key) {
            return expanded[key];
        });
    }
    function adjacent_edges(key) {
        return edge_flat.group.all().filter(function(kv) {
            return kv.value[sourceattr] === key || kv.value[targetattr] === key;
        });
    }
    function out_edges(key) {
        return edge_flat.group.all().filter(function(kv) {
            return kv.value[sourceattr] === key;
        });
    }
    function in_edges(key) {
        return edge_flat.group.all().filter(function(kv) {
            return kv.value[targetattr] === key;
        });
    }
    function adjacent_nodes(key) {
        return adjacent_edges(key).map(function(kv) {
            return kv.value[sourceattr] === key ? kv.value[targetattr] : kv.value[sourceattr];
        });
    }
    var nodelist = diagram.nodeGroup().all().map(function(n) {
        return {
            value: n.key,
            label: diagram.nodeLabel()(n)
        };
    });
    nodelist.sort((a,b) => a.label < b.label ? -1 : 1);
    apply_expander_filter();
    dc.renderAll();

    if(qs.directional) {
        diagram.child('expand-collapse',
                      dc_graph.expand_collapse(function(key, dir) { // get_degree
                          switch(dir) {
                          case 'out': return out_edges(key).length;
                          case 'in': return in_edges(key).length;
                          default: throw new Error('unknown direction ' + dir);
                          }
                      }, function(key, dir) { // expand
                          switch(dir) {
                          case 'out':
                              out_edges(key).forEach(function(e) {
                                  expanded[e.value[targetattr]] = true;
                              });
                              break;
                          case 'in':
                              in_edges(key).forEach(function(e) {
                                  expanded[e.value[sourceattr]] = true;
                              });
                              break;
                          default: throw new Error('unknown direction ' + dir);
                          }
                          apply_expander_filter();
                          dc.redrawAll();
                      }, function(key, collapsible, dir) { // collapse
                          switch(dir) {
                          case 'out':
                              out_edges(key).forEach(function(e) {
                                  if(collapsible(e.value[targetattr]))
                                      expanded[e.value[targetattr]] = false;
                              });
                              break;
                          case 'in':
                              in_edges(key).forEach(function(e) {
                                  if(collapsible(e.value[sourceattr]))
                                      expanded[e.value[sourceattr]] = false;
                              });
                              break;
                          default: throw new Error('unknown direction ' + dir);
                          }
                          apply_expander_filter();
                          dc.redrawAll();
                      }, ['out', 'in']));
    } else {
        diagram.child('expand-collapse',
                      dc_graph.expand_collapse(function(key) { // get_degree
                          return adjacent_edges(key).length;
                      }, function(key) { // expand
                          adjacent_nodes(key).forEach(function(nk) {
                              expanded[nk] = true;
                          });
                          apply_expander_filter();
                          dc.redrawAll();
                      }, function(key, collapsible) { // collapse
                          adjacent_nodes(key).filter(collapsible).forEach(function(nk) {
                              expanded[nk] = false;
                          });
                          apply_expander_filter();
                          dc.redrawAll();
                      }));
    }
    var starter = d3.select('#start-from');
    var option = starter.selectAll('option').data([{label: 'select one'}].concat(nodelist));
    option.enter().append('option')
        .attr('value', function(d) { return d.value; })
        .text(function(d) { return d.label; });

    starter.on('change', function() {
        expanded = {};
        expanded[this.value] = true;
        apply_expander_filter();
        dc.redrawAll();
    });
    // respond to browser resize (not necessary if width/height is static)
    // $(window).resize(function() {
    //     diagram
    //         .width($(window).width())
    //         .height($(window).height());
    // });
});

