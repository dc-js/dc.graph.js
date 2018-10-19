dc_graph.expand_collapse = function(options) {
    if(typeof options === 'function') {
        options = {
            get_degree: arguments[0],
            expand: arguments[1],
            collapse: arguments[2],
            dirs: arguments[3]
        };
    }
    var _keyboard, _overNode, _overDir, _overEdge, _expanded = {};
    var expanded_highlight_group = dc_graph.register_highlight_things_group(options.expanded_highlight_group || 'expanded-highlight-group');
    var collapse_highlight_group = dc_graph.register_highlight_things_group(options.collapse_highlight_group || 'collapse-highlight-group');
    var hide_highlight_group = dc_graph.register_highlight_things_group(options.hide_highlight_group || 'hide-highlight-group');
    options.dirs = options.dirs || ['both'];
    options.dirs.forEach(function(dir) {
        _expanded[dir] = {};
    });
    options.hideKey = options.hideKey || 'Alt';
    options.linkKey = options.linkKey || (is_a_mac ? 'Meta' : 'Control');
    if(options.dirs.length > 2)
        throw new Error('there are only two directions to expand in');

    var _gradients_added = {};
    function add_gradient_def(color, diagram) {
        if(_gradients_added[color])
            return;
        _gradients_added[color] = true;
        var gradient = diagram.addOrRemoveDef('spike-gradient-' + color, true, 'linearGradient');
        gradient.attr({
            x1: '0%',
            y1: '0%',
            x2: '100%',
            y2: '0%',
            spreadMethod: 'pad'
        });
        gradient.selectAll('stop').data([[0, color, 1], [100, color, '0']])
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

    function visible_edges(diagram, edge, dir, key) {
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
        return edge.filter(fil).data();
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

    function draw_stubs(diagram, node, edge, n, spikes) {
        if(n && _expanded[spikes.dir][diagram.nodeKey.eval(n)])
            spikes = null;
        var spike = node
            .selectAll('g.spikes')
            .data(function(n2) {
                return spikes && n === n2 ?
                    [n2] : [];
            });
        spike.exit().remove();
        spike
          .enter().insert('g', ':first-child')
            .classed('spikes', true);
        var rect = spike
          .selectAll('rect.spike')
            .data(function(n) {
                var key = diagram.nodeKey.eval(n);
                var dir = spikes.dir,
                    N = spikes.n,
                    af = spike_directioner(diagram.layoutEngine().rankdir(), dir, N),
                    ret = Array(N);
                for(var i = 0; i<N; ++i) {
                    var a = af(i);
                    ret[i] = {
                        a: a * 180 / Math.PI,
                        x: Math.cos(a) * n.dcg_rx*.9,
                        y: Math.sin(a) * n.dcg_ry*.9,
                        edge: spikes.invisible ? spikes.invisible[i] : null
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
                fill: function(s) {
                    var color = s.edge ? s.edge.value.color : 'black';
                    add_gradient_def(color, diagram);
                    return 'url(#spike-gradient-' + color + ')';
                },
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

    function clear_stubs(diagram, node, edge) {
        draw_stubs(diagram, node, edge, null, null);
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

    function highlight_hiding_node(diagram, n, edge) {
        var nk = diagram.nodeKey.eval(n);
        var hide_nodes_set = {}, hide_edges_set = {};
        hide_nodes_set[nk] = true;
        edge.each(function(e) {
            if(diagram.edgeSource.eval(e) === nk || diagram.edgeTarget.eval(e) === nk)
                hide_edges_set[diagram.edgeKey.eval(e)] = true;
        });
        hide_highlight_group.highlight(hide_nodes_set, hide_edges_set);
    }
    function highlight_hiding_edge(diagram, e) {
        var hide_edges_set = {};
        hide_edges_set[diagram.edgeKey.eval(e)] = true;
        hide_highlight_group.highlight({}, hide_edges_set);
    }

    function highlight_collapse(diagram, n, node, edge, dir) {
        var nk = diagram.nodeKey.eval(n);
        var p;
        if(options.get_edges)
            p = Promise.resolve(options.get_edges(nk, dir));
        else
            p = Promise.resolve(options.get_degree(nk, dir));
        p.then(function(de) {
            var degree, edges;
            if(typeof de === 'number')
                degree = de;
            else {
                edges = de;
                degree = edges.length;
            }
            var spikes = {
                dir: dir,
                visible: visible_edges(diagram, edge, dir, nk)
            };
            spikes.n = Math.max(0, degree - spikes.visible.length); // be tolerant of inconsistencies
            if(edges) {
                var shown = spikes.visible.reduce(function(p, e) {
                    p[diagram.edgeKey.eval(e)] = true;
                    return p;
                }, {});
                spikes.invisible = edges.filter(function(e) { return !shown[diagram.edgeKey()(e)]; });
            }
            draw_stubs(diagram, node, edge, n, spikes);
            var collapse_nodes_set = {}, collapse_edges_set = {};
            if(_expanded[dir][nk] && options.collapsibles) {
                var clps = options.collapsibles(nk, dir);
                collapse_nodes_set = clps.nodes;
                collapse_edges_set = clps.edges;
            }
            collapse_highlight_group.highlight(collapse_nodes_set, collapse_edges_set);
        });
    }

    function add_behavior(diagram, node, edge, ehover) {
        function enter_node(n) {
            var dir = zonedir(diagram, d3.event, options.dirs, n);
            _overNode = n;
            _overDir = dir;
            if(options.hideNode && detect_key(options.hideKey))
                highlight_hiding_node(diagram, n, edge);
            else if(_overNode.orig.value.value.URL && detect_key(options.linkKey)) {
                diagram.selectAllNodes()
                    .filter(function(n) {
                        return n === _overNode;
                    }).attr('cursor', 'pointer');
                diagram.requestRefresh(0);
            }
            else
                highlight_collapse(diagram, n, node, edge, dir);
        }
        function leave_node(n)  {
            diagram.selectAllNodes()
                .filter(function(n) {
                    return n === _overNode;
                }).attr('cursor', null);
            _overNode = null;
            clear_stubs(diagram, node, edge);
            collapse_highlight_group.highlight({}, {});
            hide_highlight_group.highlight({}, {});
        }
        function click_node(n) {
            var nk = diagram.nodeKey.eval(n);
            if(options.hideNode && detect_key(options.hideKey))
                options.hideNode(nk);
            else if(detect_key(options.linkKey)) {
                if(n.orig.value.value.URL)
                    window.open(n.orig.value.value.URL, 'dcgraphlink');
            } else {
                clear_stubs(diagram, node, edge);
                var dir = zonedir(diagram, d3.event, options.dirs, n);
                expand(dir, nk, !_expanded[dir][nk]);
            }
        }

        function enter_edge(e) {
            _overEdge = e;
            if(options.hideEdge && detect_key(options.hideKey))
                highlight_hiding_edge(diagram, e);
        }
        function leave_edge(e) {
            _overEdge = null;
            hide_highlight_group.highlight({}, {});
        }
        function click_edge(e) {
            if(options.hideEdge && detect_key(options.hideKey))
                options.hideEdge(diagram.edgeKey.eval(e));
        }

        node
            .on('mouseenter.expand-collapse', enter_node)
            .on('mouseout.expand-collapse', leave_node)
            .on('click', click_node)
            .on('dblclick', click_node);

        ehover
            .on('mouseenter.expand-collapse', enter_edge)
            .on('mouseout.expand-collapse', leave_edge)
            .on('click.expand-collapse', click_edge);

        _keyboard
            .on('keydown.expand-collapse', function() {
                if(d3.event.key === options.hideKey && (_overNode || _overEdge)) {
                    if(_overNode)
                        highlight_hiding_node(diagram, _overNode, edge);
                    if(_overEdge)
                        highlight_hiding_edge(diagram, _overEdge);
                    clear_stubs(diagram, node, edge);
                    collapse_highlight_group.highlight({}, {});
                }
                else if(d3.event.key === options.linkKey && _overNode) {
                    if(_overNode && _overNode.orig.value.value.URL) {
                        diagram.selectAllNodes()
                            .filter(function(n) {
                                return n === _overNode;
                            }).attr('cursor', 'pointer');
                    }
                    hide_highlight_group.highlight({}, {});
                    clear_stubs(diagram, node, edge);
                    collapse_highlight_group.highlight({}, {});
                }
            })
            .on('keyup.expand_collapse', function() {
                if((d3.event.key === options.hideKey || d3.event.key === options.linkKey) && (_overNode || _overEdge)) {
                    hide_highlight_group.highlight({}, {});
                    if(_overNode) {
                        highlight_collapse(diagram, _overNode, node, edge, _overDir);
                        if(_overNode.orig.value.value.URL) {
                            diagram.selectAllNodes()
                                .filter(function(n) {
                                    return n === _overNode;
                                }).attr('cursor', null);
                        }
                    }
                }
            });
        diagram.cascade(97, true, conditional_properties(
            function(n) {
                return n === _overNode && n.orig.value.value.URL;
            },
            {
                nodeLabelDecoration: 'underline'
            }
        ));
    }

    function remove_behavior(diagram, node, edge) {
        node
            .on('mouseover.expand-collapse', null)
            .on('mouseout.expand-collapse', null);
        clear_stubs(diagram, node, edge);
    }

    function expand(dir, nk, whether) {
        var exec;
        _expanded[dir][nk] = whether;
        expanded_highlight_group.highlight(_expanded.both, {});
        if(whether)
            options.expand(nk, dir);
        else
            options.collapse(nk, dir);
    }

    var _behavior = dc_graph.behavior('expand-collapse', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
            }
        }
    });

    _behavior.expand = expand;
    _behavior.clickableLinks = deprecated_property("warning - clickableLinks doesn't belong in collapse_expand and will be moved", false);
    return _behavior;
};
