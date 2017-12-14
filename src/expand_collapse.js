dc_graph.expand_collapse = function(get_degree, expand, collapse, dirs) {
    dirs = dirs || ['both'];
    if(dirs.length > 2)
        throw new Error('there are only two directions to expand in');

    function add_gradient_def(diagram) {
        var gradient = diagram.addOrRemoveDef('spike-gradient', true, 'linearGradient');
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

    function view_degree(diagram, edge, dir, key) {
        var fil;
        switch(dir) {
        case 'out':
            fil = function(e) {
                return diagram.edgeSource.eval(e) === key;
            };
            break;
        case 'in':
            fil = function(e) {
                return diagram.edgeTarget.eval(e) === key;
            };
            break;
        case 'both':
            fil = function(e) {
                return diagram.edgeSource.eval(e) === key || diagram.edgeTarget.eval(e) === key;
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
                ofs = -Math.PI/2;
                break;
            }
            if(dir === 'in')
                ofs += Math.PI;
            return function(i) {
                return ofs + sweep * (-.5 + (n > 1 ? i / (n-1) : 0)); // avoid 0/0
            };
        }
    }

    function draw_selected(diagram, node, edge) {
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
            .classed('spikes', true);
        var rect = spike
          .selectAll('rect.spike')
            .data(function(d) {
                var key = diagram.nodeKey.eval(d);
                var dir = d.dcg_expand_selected.dir,
                    n = d.dcg_expand_selected.n,
                    af = spike_directioner(diagram.layoutEngine().rankdir(), dir, n),
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
            });
        rect
          .enter().append('rect')
            .classed('spike', true)
            .attr({
                width: 25,
                height: 3,
                fill: 'url(#spike-gradient)',
                rx: 1,
                ry: 1,
                x: 0,
                y: 0
            });
        rect.attr('transform', function(d) {
            return 'translate(' + d.x + ',' + d.y + ') rotate(' + d.a + ')';
        });
        rect.exit().remove();
    }

    function clear_selected(diagram, node, edge) {
        node.each(function(n) {
            n.dcg_expand_selected = null;
        });
        draw_selected(diagram, node, edge);
    }

    function collapsible(diagram, edge, key, dir) {
        return view_degree(diagram, edge, dir, key) === 1;
    }

    function zonedir(diagram, event, dirs, d) {
        if(dirs.length === 1) // we assume it's ['out', 'in']
            return dirs[0];
        var bound = diagram.root().node().getBoundingClientRect();
        var invert = diagram.invertCoord([event.clientX - bound.left,event.clientY - bound.top]),
            x = invert[0],
            y = invert[1];
        switch(diagram.layoutEngine().rankdir()) {
        case 'TB':
            return y > d.cola.y ? 'out' : 'in';
        case 'BT':
            return y < d.cola.y ? 'out' : 'in';
        case 'LR':
            return x > d.cola.x ? 'out' : 'in';
        case 'RL':
            return x < d.cola.x ? 'out' : 'in';
        }
        throw new Error('unknown rankdir ' + diagram.layoutEngine().rankdir());
    }


    function add_behavior(diagram, node, edge) {
        function mousemove(d) {
            var dir = zonedir(diagram, d3.event, dirs, d);
            var nk = diagram.nodeKey.eval(d);
            Promise.resolve(get_degree(nk, dir)).then(function(degree) {
                var spikes = {
                    dir: dir,
                    n: Math.max(0, degree - view_degree(diagram, edge, dir, nk)) // be tolerant of inconsistencies
                };
                node.each(function(n) {
                    n.dcg_expand_selected = n === d ? spikes : null;
                });
                draw_selected(diagram, node, edge);
            });
        }

        function click(d) {
            var event = d3.event;
            console.log(event.type);
            function action() {
                var dir = zonedir(diagram, event, dirs, d);
                d.dcg_expanded = d.dcg_expanded || {};
                if(!d.dcg_expanded[dir]) {
                    expand(diagram.nodeKey.eval(d), dir, event.type === 'dblclick');
                    d.dcg_expanded[dir] = true;
                }
                else {
                    collapse(diagram.nodeKey.eval(d), collapsible.bind(null, diagram, edge, dir), dir);
                    d.dcg_expanded[dir] = false;
                }
                draw_selected(diagram, node, edge);
                d.dcg_dblclk_timeout = null;
            }
            return action();
            // distinguish click and double click - kind of fishy but seems to work
            // basically, wait to see if a click becomes a dblclick - but it's even worse
            // because you'll receive a second click before the dblclick on most browsers
            if(d.dcg_dblclk_timeout) {
                window.clearTimeout(d.dcg_dblclk_timeout);
                if(event.type === 'dblclick')
                    action();
                d.dcg_dblclk_timeout = null;
            }
            else d.dcg_dblclk_timeout = window.setTimeout(action, 200);
        }

        node
            .on('mouseover.expand-collapse', mousemove)
            .on('mousemove.expand-collapse', mousemove)
            .on('mouseout.expand-collapse', function(d) {
                clear_selected(diagram, node, edge);
            })
            .on('click', click)
            .on('dblclick', click);
    }

    function remove_behavior(diagram, node, edge) {
        node
            .on('mouseover.expand-collapse', null)
            .on('mouseout.expand-collapse', null);
        clear_selected(diagram, node);
    }

    return dc_graph.behavior('expand-collapse', {
        add_behavior: add_behavior,
        first: add_gradient_def,
        remove_behavior: remove_behavior
    });
};
