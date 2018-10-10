dc_graph.expand_collapse = function(options) {
    if(typeof options === 'function') {
        options = {
            get_degree: arguments[0],
            expand: arguments[1],
            collapse: arguments[2],
            dirs: arguments[3]
        };
    }
    var collapse_highlight_group = dc_graph.register_highlight_things_group(options.collapse_highlight_group || 'collapse-highlight-group');
    var hide_highlight_group = options.hide_highlight_group ?
        dc_graph.register_highlight_things_group(options.hide_highlight_group) :
        collapse_highlight_group;
    options.dirs = options.dirs || ['both'];
    options.hideKey = options.hideKey || 'Alt';
    if(options.dirs.length > 2)
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

    function spike_directioner(rankdir, dir, N) {
        if(dir==='both')
            return function(i) {
                return Math.PI * (2 * i / N - 0.5);
            };
        else {
            var sweep = (N-1)*Math.PI/N, ofs;
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
                return ofs + sweep * (-.5 + (N > 1 ? i / (N-1) : 0)); // avoid 0/0
            };
        }
    }

    function draw_stubs(diagram, node, edge) {
        var spike = node
            .selectAll('g.spikes')
            .data(function(n) {
                return (n.dcg_expand_selected &&
                        (!n.dcg_expanded || !n.dcg_expanded[n.dcg_expand_selected.dir])) ?
                    [n] : [];
            });
        spike.exit().remove();
        spike
          .enter().insert('g', ':first-child')
            .classed('spikes', true);
        var rect = spike
          .selectAll('rect.spike')
            .data(function(n) {
                var key = diagram.nodeKey.eval(n);
                var dir = n.dcg_expand_selected.dir,
                    N = n.dcg_expand_selected.n,
                    af = spike_directioner(diagram.layoutEngine().rankdir(), dir, N),
                    ret = Array(N);
                for(var i = 0; i<N; ++i) {
                    var a = af(i);
                    ret[i] = {
                        a: a * 180 / Math.PI,
                        x: Math.cos(a) * n.dcg_rx*.9,
                        y: Math.sin(a) * n.dcg_ry*.9
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
        draw_stubs(diagram, node, edge);
    }

    function collapsible(diagram, edge, dir, key) {
        return view_degree(diagram, edge, dir, key) === 1;
    }

    function zonedir(diagram, event, dirs, n) {
        if(dirs.length === 1) // we assume it's ['out', 'in']
            return dirs[0];
        var bound = diagram.root().node().getBoundingClientRect();
        var invert = diagram.invertCoord([event.clientX - bound.left,event.clientY - bound.top]),
            x = invert[0],
            y = invert[1];
        switch(diagram.layoutEngine().rankdir()) {
        case 'TB':
            return y > n.cola.y ? 'out' : 'in';
        case 'BT':
            return y < n.cola.y ? 'out' : 'in';
        case 'LR':
            return x > n.cola.x ? 'out' : 'in';
        case 'RL':
            return x < n.cola.x ? 'out' : 'in';
        }
        throw new Error('unknown rankdir ' + diagram.layoutEngine().rankdir());
    }

    function detect_key(key) {
        switch(key) {
        case 'Alt':
            return d3.event.altKey;
        case 'Meta':
            return d3.event.metaKey;
        case 'Shift':
            return d3.event.shiftKey;
        case 'Control':
            return d3.event.ctrlKey;
        }
        return false;
    }

    function highlight_hiding(diagram, nk, edge) {
        var hide_nodes_set = {}, hide_edges_set = {};
        hide_nodes_set[nk] = true;
        edge.each(function(e) {
            if(diagram.edgeSource.eval(e) === nk || diagram.edgeTarget.eval(e) === nk)
                hide_edges_set[diagram.edgeKey.eval(e)] = true;
        });
        hide_highlight_group.highlight(hide_nodes_set, hide_edges_set);
    }

    function add_behavior(diagram, node, edge) {
        function mousemove(n) {
            var dir = zonedir(diagram, d3.event, options.dirs, n);
            var nk = diagram.nodeKey.eval(n);
            if(options.hide && detect_key(options.hideKey))
                highlight_hiding(diagram, nk, edge);
            else Promise.resolve(options.get_degree(nk, dir)).then(function(degree) {
                var spikes = {
                    dir: dir,
                    n: Math.max(0, degree - view_degree(diagram, edge, dir, nk)) // be tolerant of inconsistencies
                };
                var collapse_nodes_set = {}, collapse_edges_set = {};
                node.each(function(n2) {
                    n2.dcg_expand_selected = n2 === n ? spikes : null;
                    if(n2 === n && n.dcg_expanded && n.dcg_expanded[dir])
                        edge.each(function(e) {
                            var other;
                            if(diagram.edgeSource.eval(e) === diagram.nodeKey.eval(n))
                                other = diagram.edgeTarget.eval(e);
                            if(diagram.edgeTarget.eval(e) === diagram.nodeKey.eval(n))
                                other = diagram.edgeSource.eval(e);
                            if(other && collapsible(diagram, edge, 'both', other)) {
                                collapse_nodes_set[other] = true;
                                collapse_edges_set[diagram.edgeKey.eval(e)] = true;
                            }
                        });
                });
                draw_stubs(diagram, node, edge);
                collapse_highlight_group.highlight(collapse_nodes_set, collapse_edges_set);
            });
        }

        function click(n) {
            var event = d3.event;
            console.log(event.type);
            function action() {
                if(options.hide && detect_key(options.hideKey))
                    options.hide(diagram.nodeKey.eval(n));
                else {
                    var dir = zonedir(diagram, event, options.dirs, n);
                    n.dcg_expanded = n.dcg_expanded || {};
                    if(!n.dcg_expanded[dir]) {
                        options.expand(diagram.nodeKey.eval(n), dir, event.type === 'dblclick');
                        n.dcg_expanded[dir] = true;
                    }
                    else {
                        options.collapse(diagram.nodeKey.eval(n), collapsible.bind(null, diagram, edge, 'both'), dir);
                        n.dcg_expanded[dir] = false;
                    }
                    draw_stubs(diagram, node, edge);
                    n.dcg_dblclk_timeout = null;
                }
            }
            return action();
            // distinguish click and double click - kind of fishy but seems to work
            // basically, wait to see if a click becomes a dblclick - but it's even worse
            // because you'll receive a second click before the dblclick on most browsers
            if(n.dcg_dblclk_timeout) {
                window.clearTimeout(n.dcg_dblclk_timeout);
                if(event.type === 'dblclick')
                    action();
                n.dcg_dblclk_timeout = null;
            }
            else n.dcg_dblclk_timeout = window.setTimeout(action, 200);
        }

        node
            .on('mouseover.expand-collapse', mousemove)
            .on('mousemove.expand-collapse', mousemove)
            .on('mouseout.expand-collapse', function(n) {
                clear_selected(diagram, node, edge);
                collapse_highlight_group.highlight({}, {});
                hide_highlight_group.highlight({}, {});
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
