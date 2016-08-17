dc_graph.expand_collapse = function(get_degree, expand, collapse, dirs) {
    dirs = dirs || ['both'];
    if(dirs.length > 2)
        throw new Error('there are only two directions to expand in');

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

    function view_degree(chart, edge, dir, key) {
        var fil;
        switch(dir) {
        case 'out':
            fil = function(e) {
                return chart.edgeSource.eval(e) === key;
            };
            break;
        case 'in':
            fil = function(e) {
                return chart.edgeTarget.eval(e) === key;
            };
            break;
        case 'both':
            fil = function(e) {
                return chart.edgeSource.eval(e) === key || chart.edgeTarget.eval(e) === key;
            };
            break;
        }
        return edge.filter(fil).size();
    }

    function spike_directioner(rankdir, dir, n) {
        if(dir==='both')
            return function(i) {
                return Math.PI * (2 * i / n - 0.5);
            };
        else {
            var sweep = (n-1)*Math.PI/n, ofs;
            switch(rankdir) {
            case 'LR':
                ofs = 0;
                break;
            case 'TB':
                ofs = Math.PI/2;
                break;
            case 'RL':
                ofs = Math.PI;
                break;
            case 'BT':
                ofs = -Math.PI;
                break;
            }
            if(dir === 'in')
                ofs += Math.PI;
            return function(i) {
                return ofs + sweep * (-.5 + (n > 1 ? i / (n-1) : 0)); // avoid 0/0
            };
        }
    }

    function draw_selected(chart, node, edge) {
        var spike = node
            .selectAll('g.spikes')
            .data(function(d) {
                return (d.dcg_expand_selected &&
                        (!d.dcg_expanded || !d.dcg_expanded[d.dcg_expand_selected.dir])) ?
                    [d] : [];
            });
        spike.exit().remove();
        spike
          .enter().insert('g', ':first-child')
            .classed('spikes', true)
            .selectAll('rect.spike')
            .data(function(d) {
                var key = chart.nodeKey.eval(d);
                var dir = d.dcg_expand_selected.dir,
                    n = d.dcg_expand_selected.n,
                    af = spike_directioner(chart.rankdir(), dir, n),
                    ret = Array(n);
                for(var i = 0; i<n; ++i) {
                    var a = af(i);
                    ret[i] = {
                        a: a * 180 / Math.PI,
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

    function clear_selected(chart, node, edge) {
        node.each(function(n) {
            n.dcg_expand_selected = null;
        });
        draw_selected(chart, node, edge);
    }

    function collapsible(chart, edge, key, dir) {
        return view_degree(chart, edge, dir, key) === 1;
    }

    function zonedir(chart, event, d) {
        var bound = chart.root().node().getBoundingClientRect();
        var x = event.clientX - bound.left,
            y = event.clientY - bound.top;
        switch(chart.rankdir()) {
        case 'TB':
            return y > d.cola.y ? 'out' : 'in';
        case 'BT':
            return y < d.cola.y ? 'out' : 'in';
        case 'LR':
            return x > d.cola.x ? 'out' : 'in';
        case 'RL':
            return x < d.cola.x ? 'out' : 'in';
        }
        throw new Error('unknown rankdir ' + chart.rankdir());
    }

    function add_behavior(chart, node, edge) {
        node
            .on('mouseover.expand-collapse', function(d) {
                var dir;
                if(dirs.length === 2) // we assume it's ['out', 'in']
                    dir = zonedir(chart, d3.event, d);
                else dir = dirs[0];
                var nk = chart.nodeKey.eval(d);
                Promise.resolve(get_degree(nk, dir)).then(function(degree) {
                    var spikes = {
                        dir: dir,
                        n: degree - view_degree(chart, edge, dir, nk)
                    };
                    node.each(function(n) {
                        n.dcg_expand_selected = n === d ? spikes : null;
                    });
                    draw_selected(chart, node, edge);
                });
            })
            .on('mouseout.expand-collapse', function(d) {
                clear_selected(chart, node, edge);
            })
            .on('click', function(d) {
                var dir;
                if(dirs.length === 2)
                    dir = zonedir(chart, d3.event, d);
                else dir = dirs[0];
                d.dcg_expanded = d.dcg_expanded || {};
                if(!d.dcg_expanded[dir]) {
                    expand(chart.nodeKey.eval(d), dir);
                    d.dcg_expanded[dir] = true;
                }
                else {
                    collapse(chart.nodeKey.eval(d), collapsible.bind(null, chart, edge, dir), dir);
                    d.dcg_expanded[dir] = false;
                }
                draw_selected(chart, node, edge);
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.expand-collapse', null)
            .on('mouseout.expand-collapse', null);
        clear_selected(chart, node);
    }

    return dc_graph.behavior('expand-collapse', {
        add_behavior: add_behavior,
        first: add_gradient_def,
        remove_behavior: remove_behavior
    });
};
