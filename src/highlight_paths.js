dc_graph.highlight_paths = function(pathprops, hoverprops, selectprops, pathsgroup) {
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    selectprops = selectprops || {};
    pathsgroup = pathsgroup || 'highlight-paths-group';
    var node_on_paths = {}, edge_on_paths = {}, selected = null, hoverpaths = null;

    function refresh() {
        _behavior.parent().relayout().redraw();
    }

    function paths_changed(nop, eop) {
        node_on_paths = nop;
        edge_on_paths = eop;
        refresh();
    }

    function hover_changed(hp) {
        if(hp !== hoverpaths) {
            hoverpaths = hp;
            refresh();
        }
    }

    function select_changed(sp) {
        if(sp !== selected) {
            selected = sp;
            refresh();
        }
    }

    function clear_all_highlights() {
        node_on_paths = {};
        edge_on_paths = {};
    }

    function contains_path(paths) {
        return function(path) {
            return paths.indexOf(path)>=0;
        };
    }

    // sigh
    function doesnt_contain_path(paths) {
        var cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function intersect_paths(pathsA, pathsB) {
        if(!pathsA || !pathsB)
            return false;
        return pathsA.some(contains_path(pathsB));
    }

    function toggle_paths(pathsA, pathsB) {
        if(!pathsA)
            return pathsB;
        else if(!pathsB)
            return pathsA;
        if(pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    function add_behavior(chart, node, edge, ehover) {
        chart
            .cascade(200, conditional_properties(function(n) {
                return !!node_on_paths[chart.nodeKey.eval(n)];
            }, function(e) {
                return !!edge_on_paths[chart.edgeKey.eval(e)];
            }, pathprops))
            .cascade(300, conditional_properties(function(n) {
                return intersect_paths(node_on_paths[chart.nodeKey.eval(n)], selected);
            }, function(e) {
                return intersect_paths(edge_on_paths[chart.edgeKey.eval(e)], selected);
            }, selectprops))
            .cascade(400, conditional_properties(function(n) {
                return intersect_paths(node_on_paths[chart.nodeKey.eval(n)], hoverpaths);
            }, function(e) {
                return intersect_paths(edge_on_paths[chart.edgeKey.eval(e)], hoverpaths);
            }, hoverprops));

        node
            .on('mouseover.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(node_on_paths[chart.nodeKey.eval(n)] || null);
            })
            .on('mouseout.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, node_on_paths[chart.nodeKey.eval(n)]));
            });


        ehover
            .on('mouseover.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(edge_on_paths[chart.edgeKey.eval(e)] || null);
            })
            .on('mouseout.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, edge_on_paths[chart.nodeKey.eval(n)]));
            });
    }

    function remove_behavior(chart, node, edge, ehover) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        ehover
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        clear_all_highlights();
        chart.edgeStrokeWidth.cascade(100, null);
        chart.edgeStroke.cascade(100, null);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge, ehover) {
            remove_behavior(chart, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            var anchor = p.anchorName();
            highlight_paths_group.on('paths_changed.' + anchor, p ? paths_changed : null);
            highlight_paths_group.on('hover_changed.' + anchor, p ? hover_changed : null);
            highlight_paths_group.on('select_changed.' + anchor, p ? select_changed : null);
        }
    });

    // reuse this
    window.chart_registry.create_type('highlight-paths', function() {
        return d3.dispatch('paths_changed', 'hover_changed', 'select_changed');
    });
    var highlight_paths_group = window.chart_registry.create_group('highlight-paths', pathsgroup);

    return _behavior;
};

