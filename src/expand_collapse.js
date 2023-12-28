dc_graph.expand_collapse = function(options) {
    if(typeof options === 'function') {
        options = {
            get_degree: arguments[0],
            expand: arguments[1],
            collapse: arguments[2],
            dirs: arguments[3]
        };
    }
    var _keyboard, _overNode, _overDir, _overEdge, _expanded = {}, _changing;
    var changing_highlight_group = dc_graph.register_highlight_things_group(options.changing_highlight_group || 'changing-highlight-group');
    var expanded_highlight_group = dc_graph.register_highlight_things_group(options.expanded_highlight_group || 'expanded-highlight-group');
    var collapse_highlight_group = dc_graph.register_highlight_things_group(options.collapse_highlight_group || 'collapse-highlight-group');
    var hide_highlight_group = dc_graph.register_highlight_things_group(options.hide_highlight_group || 'hide-highlight-group');
    options.dirs = options.dirs || ['both'];
    options.dirs.forEach(function(dir) {
        _expanded[dir] = new Set();
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
        diagram.addOrRemoveDef('spike-gradient-' + color, true, 'linearGradient', function(gradient) {
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

    const sweep_angle = (N, ofs, span = Math.PI) =>
          i => ofs + ((N-1)*span/N) * (-.5 + (N > 1 ? i / (N-1) : 0)); // avoid 0/0

    function spike_directioner(rankdir, dir, N) {
        if(dir==='both')
            return function(i) {
                return Math.PI * (2 * i / N - 0.5);
            };
        else {
            var ofs;
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
            return sweep_angle(N, ofs);
        }
    }

    function produce_spikes_helper(cx, cy, rx, ry, a, spike, span, ret) {
        const dx = Math.cos(a) * rx,
              dy = Math.sin(a) * ry;
        const dash = {
            a: a * 180 / Math.PI,
            x: cx + dx,
            y: cy + dy,
            edge: spike.pe
        };
        ret.push(dash);
        span *= 0.75;
        const sweep = sweep_angle(spike.children.length, a, span);
        for(const i of d3.range(spike.children.length))
            produce_spikes_helper(cx + 1.5*dx, cy + 1.5*dy, rx, ry, sweep(i), spike.children[i], span, ret);
    }

    function produce_spikes(diagram, n, spikes) {
        const dir = spikes.dir,
              sweep = spike_directioner(diagram.layoutEngine().rankdir(), dir, spikes.tree.length),
              ret = [];
        for(const i of d3.range(spikes.tree.length))
            produce_spikes_helper(0, 0, n.dcg_rx * 0.9, n.dcg_ry * 0.9, sweep(i), spikes.tree[i], Math.PI, ret);
        return ret;
    }

    function draw_stubs(diagram, node, edge, n, spikeses) {
        var spike = node
            .selectAll('g.spikes')
            .data(function(n2) {
                return spikeses[diagram.nodeKey.eval(n2)] ?
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
                return produce_spikes(diagram, n, spikeses[key]);
            });
        rect
          .enter().append('rect')
            .classed('spike', true)
            .attr({
                width: 25,
                height: 3,
                fill: function(s) {
                    var color = s.edge ? dc_graph.functor_wrap(diagram.edgeStroke())(s.edge) : 'black';
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
        draw_stubs(diagram, node, edge, null, {});
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

    function partition_among_visible(tree_edges, visible, parts, nk, pe = null) {
        let children = tree_edges[nk].nks.flatMap(
            (nk2, i) => partition_among_visible(tree_edges, visible, parts, nk2, tree_edges[nk].edges[i]))
            .filter(({nk}) => !visible.has(nk));
        if(visible.has(nk)) {
            parts[nk] = children;
            children = [];
        }
        return [{pe, nk, children}];
    }

    function highlight_expand_collapse(diagram, n, node, edge, dir, recurse) {
        var nk = diagram.nodeKey.eval(n);
        let tree_edges = options.get_tree_edges(nk, dir, !recurse);
        let visible_nodes = new Set(node.data().map(n => diagram.nodeKey.eval(n)).filter(nk => tree_edges[nk]));
        const parts = {};
        if(recurse)
            partition_among_visible(tree_edges, visible_nodes, parts, nk);
        const spikeses = {};
        if(!_expanded[dir].has(nk))
            Object.keys(tree_edges).forEach(nk => {
                let spikes = {dir};
                if(recurse)
                    spikes.tree = parts[nk] || [];
                else {
                    const edges = tree_edges[nk].edges;
                    const degree = edges.length;
                    const visible_e = visible_edges(diagram, edge, dir, nk);
                    const shown = new Set(visible_e.map(e => diagram.edgeKey.eval(e)));
                    const invis = edges.filter(function(e) { return !shown.has(diagram.edgeKey()(e)); });
                    spikes.tree = invis.map(e => ({pe: e, children: []}));
                    if(degree - visible_e.length !== spikes.tree.length)
                        console.log('number of stubs', spikes.tree.length, 'does not equal degree - visible edges', degree - visible_e.length);
                }
                spikeses[nk] = spikes;
            });
        draw_stubs(diagram, node, edge, n, spikeses);
        var collapse_nodes_set = {}, collapse_edges_set = {};
        if(_expanded[dir].has(nk)) {
            // collapse
            const will_change = Object.keys(tree_edges).flatMap(nk => _expanded[dir].has(nk) ? [nk] : []);
            _changing = Object.fromEntries(will_change.map(nk => [nk, {dir, whether: false}]));
            if(options.collapsibles) {
                var clps = options.collapsibles(will_change, dir);
                collapse_nodes_set = clps.nodes;
                collapse_edges_set = clps.edges;
            }
            changing_highlight_group.highlight(Object.fromEntries(will_change.map(nk => [nk, true])), {});
        } else {
            _changing = Object.fromEntries(Object.keys(tree_edges).map(nk => [nk, {dir, whether: true}]));
            changing_highlight_group.highlight(Object.fromEntries(Object.keys(tree_edges).map(nk => [nk, true])), {});
        }
        collapse_highlight_group.highlight(collapse_nodes_set, collapse_edges_set);
    }

    function draw(diagram, node, edge, ehover) {
        function over_node(n) {
            var dir = zonedir(diagram, d3.event, options.dirs, n);
            _overNode = n;
            _overDir = dir;
            if(options.hideNode && detect_key(options.hideKey))
                highlight_hiding_node(diagram, n, edge);
            else if(_mode.nodeURL.eval(_overNode) && detect_key(options.linkKey)) {
                diagram.selectAllNodes()
                    .filter(function(n) {
                        return n === _overNode;
                    }).attr('cursor', 'pointer');
                diagram.requestRefresh(0);
            }
            else
                highlight_expand_collapse(diagram, n, node, edge, dir, detect_key('Shift'));
        }
        function leave_node(n)  {
            diagram.selectAllNodes()
                .filter(function(n) {
                    return n === _overNode;
                }).attr('cursor', null);
            _overNode = null;
            clear_stubs(diagram, node, edge);
            _changing = null;
            changing_highlight_group.highlight({}, {});
            collapse_highlight_group.highlight({}, {});
            hide_highlight_group.highlight({}, {});
        }
        function click_node(n) {
            var nk = diagram.nodeKey.eval(n);
            if(options.hideNode && detect_key(options.hideKey))
                options.hideNode(nk);
            else if(detect_key(options.linkKey)) {
                if(_mode.nodeURL.eval(n) && _mode.urlOpener)
                    _mode.urlOpener()(_mode, n, _mode.nodeURL.eval(n));
            } else {
                clear_stubs(diagram, node, edge);
                _changing = null;
                changing_highlight_group.highlight({}, {});
                var dir = zonedir(diagram, d3.event, options.dirs, n);
                let tree_nodes = [nk];
                if(detect_key('Shift') && options.get_tree_edges)
                    tree_nodes = Object.keys(options.get_tree_edges(nk, dir));
                expand(dir, tree_nodes, !_expanded[dir].has(nk));
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
            .on('mouseenter.expand-collapse', over_node)
            .on('mousemove.expand-collapse', over_node)
            .on('mouseout.expand-collapse', leave_node)
            .on('click.expand-collapse', click_node)
            .on('dblclick.expand-collapse', click_node);

        ehover
            .on('mouseenter.expand-collapse', enter_edge)
            .on('mouseout.expand-collapse', leave_edge)
            .on('click.expand-collapse', click_edge);

        _keyboard
            .on('keydown.expand-collapse', function() {
                if(d3.event.key === options.hideKey && (_overNode && options.hideNode || _overEdge && options.hideEdge)) {
                    if(_overNode)
                        highlight_hiding_node(diagram, _overNode, edge);
                    if(_overEdge)
                        highlight_hiding_edge(diagram, _overEdge);
                    clear_stubs(diagram, node, edge);
                    _changing = null;
                    changing_highlight_group.highlight({}, {});
                    collapse_highlight_group.highlight({}, {});
                }
                else if(d3.event.key === options.linkKey && _overNode) {
                    if(_overNode && _mode.nodeURL.eval(_overNode)) {
                        diagram.selectAllNodes()
                            .filter(function(n) {
                                return n === _overNode;
                            }).attr('cursor', 'pointer');
                    }
                    hide_highlight_group.highlight({}, {});
                    clear_stubs(diagram, node, edge);
                    collapse_highlight_group.highlight({}, {});
                }
                else if(d3.event.key === 'Shift' && _overNode) {
                    highlight_expand_collapse(diagram, _overNode, node, edge, _overDir, true);
                }
            })
            .on('keyup.expand_collapse', function() {
                if((d3.event.key === options.hideKey || d3.event.key === options.linkKey || d3.event.key === 'Shift') && (_overNode || _overEdge)) {
                    hide_highlight_group.highlight({}, {});
                    if(_overNode) {
                        highlight_expand_collapse(diagram, _overNode, node, edge, _overDir, detect_key('Shift'));
                        if(_mode.nodeURL.eval(_overNode)) {
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
                return n === _overNode && n.orig.value.value && n.orig.value.value.URL;
            },
            {
                nodeLabelDecoration: 'underline'
            }
        ));
    }

    function remove(diagram, node, edge, ehover) {
        node
            .on('mouseenter.expand-collapse', null)
            .on('mousemove.expand-collapse', null)
            .on('mouseout.expand-collapse', null)
            .on('click.expand-collapse', null)
            .on('dblclick.expand-collapse', null);
        ehover
            .on('mouseenter.expand-collapse', null)
            .on('mouseout.expand-collapse', null)
            .on('click.expand-collapse', null);
        clear_stubs(diagram, node, edge);
    }

    function expand(dir, nks, whether) {
        nks.forEach(nk => {
            if(dir === 'both' && !_expanded.both)
                options.dirs.forEach(function(dir2) {
                    if(whether)
                        _expanded[dir2].add(nk);
                    else
                        _expanded[dir2].delete(nk);
                });
            else if(whether)
                _expanded[dir].add(nk);
            else
                _expanded[dir].delete(nk);
        });
        var bothmap;
        if(_expanded.both)
            bothmap = Object.fromEntries(
                Array.from(_expanded.both, nk => [nk, true]));
        else {
            bothmap = Object.fromEntries(
                [..._expanded.in, ..._expanded.out]
                    .map(nk => [nk, true]));
        }
        expanded_highlight_group.highlight(bothmap, {});
        options.apply_expanded();
    }

    function expandNodes(nks, dir) {
        if(!Array.isArray(nks)) {
            Object.keys(nks).forEach(dir => {
                _expanded[dir] = new Set(nks[dir]);
            });
        } else {
            var expset = new Set(nks);
            const dirs = dir == 'both' ? options.dirs : [dir];
            dirs.forEach(dir => {
                _expanded[dir] = new Set(expset);
            });
        }
        const mm = Object.fromEntries(
            Array.prototype.concat.apply([], Object.keys(_expanded).map(dir => Array.from(_expanded[dir])))
                .map(nk => [nk, true]));
        console.log('mm', mm);
        expanded_highlight_group.highlight(
            mm,
            {});
        options.expandedNodes(_expanded);
    }

    function nodeOutlineClip(n) {
        const dirs = _mode.expandedDirs(n.key);
        if(dirs.length == 0) // changing from expanded to not
            return 'none';
        if(dirs.length == 2 || dirs[0] == 'both')
            return null;
        switch(_mode.parent().layoutEngine().rankdir()) {
        case 'TB':
            return dirs[0] == 'in' ? 'top' : 'bottom';
        case 'BT':
            return dirs[0] == 'in' ? 'bottom' : 'top';
        case 'LR':
            return dirs[0] == 'in' ? 'left' : 'right';
        case 'RL':
            return dirs[0] == 'in' ? 'right' : 'left';
        default:
            throw new Error('unknown rankdir ' + mode.parent().layoutEngine().rankdir());
        }
    }

    var _mode = dc_graph.mode('expand-collapse', {
        draw: draw,
        remove: remove,
        parent: function(p) {
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = dc_graph.keyboard());
                const highlight_changing = p.child(options.highlight_changing || 'highlight-changing');
                highlight_changing.includeProps()['nodeOutlineClip'] = nodeOutlineClip;
                const highlight_expanded = p.child(options.highlight_expanded || 'highlight-expanded');
                highlight_expanded.includeProps()['nodeOutlineClip'] = nodeOutlineClip;
            }
        }
    });
    _mode.getExpanded = function() {
        return _expanded;
    };
    _mode.expandedDirs = function(nk) {
        if(_expanded.both)
            return _expanded.both.has(nk) || _changing && _changing[nk] ? ['both'] : [];
        else {
            const dirs = [];
            let has_in = _expanded.in.has(nk);
            if(_changing && _changing[nk] && _changing[nk].dir === 'in')
                has_in = _changing[nk].whether;
            if(has_in)
                dirs.push('in');
            let has_out = _expanded.out.has(nk);
            if(_changing && _changing[nk] && _changing[nk].dir === 'out')
                has_out = _changing[nk].whether;
            if(has_out)
                dirs.push('out');
            return dirs;
        }
    };

    _mode.expand = expand;
    _mode.expandNodes = expandNodes;
    _mode.clickableLinks = deprecated_property("warning - clickableLinks doesn't belong in collapse_expand and will be moved", false);
    _mode.nodeURL = property(function(n) {
        return n.value && n.value.value && n.value.value.URL;
    });
    _mode.urlTargetWindow = property('dcgraphlink');
    _mode.urlOpener = property(dc_graph.expand_collapse.default_url_opener);
    if(options.expandCollapse)
        options.expandCollapse(_mode);
    return _mode;
};

dc_graph.expand_collapse.default_url_opener = function(mode, node, url) {
    window.open(mode.nodeURL.eval(node), mode.urlTargetWindow());
};
