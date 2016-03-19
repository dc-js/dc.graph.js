dc_graph.expand_collapse = function(get_degree, expand, collapse) {
    var _behavior = {};

    /**
     #### .parent([object])
     Assigns this behavior to a diagram. It will highlight edges when their end-nodes
     are hovered.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var chart;
            if(p) {
                chart = p;
                p.on('drawn.expand-collapse', function(node, edge) {
                    add_gradient_def(chart);
                    add_behavior(chart, node, edge);
                });
            }
            else if(_behavior.parent()) {
                chart = _behavior.parent();
                chart.on('drawn.expand-collapse', function(node, edge) {
                    remove_behavior(chart, node, edge);
                    chart.on('drawn.expand-collapse', null);
                });
            }
        });

    function add_gradient_def(chart) {
        var gradient = chart.addOrRemoveDef('spike-gradient', true, 'linearGradient');
        gradient.attr({
            x1: '0%',
            y1: '0%',
            x2: '100%',
            y2: '0%',
            spreadMethod: 'pad'
        });
        gradient.selectAll('stop').data([[0,'black',1], [100, 'black', '0']])
            .enter().append('stop').attr({
                offset: function(d) {
                    return d[0] + '%';
                },
                'stop-color': function(d) {
                    return d[1];
                },
                'stop-opacity': function(d) {
                    return d[2];
                }
            });
    }

    function draw_selected(chart, node) {
        var spike = node
            .selectAll('g.spikes')
            .data(function(d) {
                return d.dcg_expand_selected ? [d] : [];
            });
        spike.exit().remove();
        spike
          .enter().insert('g', ':first-child')
            .classed('spikes', true)
            .selectAll('rect.spike')
            .data(function(d) {
                var n = get_degree(param(chart.nodeKey())(d)),
                    ret = Array(d.dcg_expand_degree);
                for(var i = 0; i<n; ++i) {
                    var a = Math.PI * 2 * i / n;
                    ret[i] = {
                        a: 360 * i / n,
                        x: Math.cos(a) * d.dcg_rx*.9,
                        y: Math.sin(a) * d.dcg_ry*.9
                    };
                }
                return ret;
            })
          .enter().append('rect')
            .classed('spike', true)
            .attr({
                width: 25,
                height: 3,
                fill: 'url(#spike-gradient)',
                rx: 1,
                ry: 1,
                x: 0,
                y: 0,
                transform: function(d) {
                    return 'translate(' + d.x + ',' + d.y + ') rotate(' + d.a + ')';
                }
            });
    }

    function clear_selected(chart, node) {
        node.each(function(n) {
            n.dcg_expand_selected = false;
        });
        draw_selected(chart, node);
    }

    function add_behavior(chart, node, edge) {
        node
            .on('mouseover.expand-collapse', function(d) {
                node.each(function(n) {
                    n.dcg_expand_selected = n === d;
                });
                draw_selected(chart, node);
            })
            .on('mouseout.expand-collapse', function(d) {
                clear_selected(chart, node);
            })
            .on('click', function(d) {
                if((d.dcg_expanded = !d.dcg_expanded))
                    expand(param(chart.nodeKey())(d));
                else
                    collapse(param(chart.nodeKey())(d));
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.expand-collapse', null)
            .on('mouseout.expand-collapse', null);
        clear_selected(chart, node);
    }

    return _behavior;
};
