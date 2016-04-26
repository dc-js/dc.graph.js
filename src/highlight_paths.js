dc_graph.highlight_paths = function(pathprops, hoverprops, pathsgroup) {
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    pathsgroup = pathsgroup || 'highlight-paths-group';
    var node_on_paths = {}, edge_on_paths = {}, hoverpaths;

    function refresh() {
        _behavior.parent().relayout().redraw();
    }

    function paths_changed(nop, eop) {
        node_on_paths = nop;
        edge_on_paths = eop;
        refresh();
    }

    function hover_changed(hp) {
        hoverpaths = hp;
        refresh();
    }

    function clear_all_highlights(edge) {
        node_on_paths = {};
        edge_on_paths = {};
    }

    function intersect_hoverpaths(paths) {
        if(!paths || !hoverpaths)
            return false;
        return hoverpaths.some(function(hpath) {
                    return paths.indexOf(hpath)>=0;
        });
    }
    function add_behavior(chart, node, edge, ehover) {
        chart
            .cascade(200, conditional_properties(function(n) {
                return !!node_on_paths[chart.nodeKey.eval(n)];
            }, function(e) {
                return !!edge_on_paths[chart.edgeKey.eval(e)];
            }, pathprops))
            .cascade(300, conditional_properties(function(n) {
                return intersect_hoverpaths(node_on_paths[chart.nodeKey.eval(n)]);
            }, function(e) {
                return intersect_hoverpaths(edge_on_paths[chart.edgeKey.eval(e)]);
            }, hoverprops));

        node
            .on('mouseover.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(node_on_paths[chart.nodeKey.eval(n)]);
            })
            .on('mouseout.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(null);
            });

        /*
        edge.each(function(e) {
            var dirs = edge_on_paths[chart.edgeKey.eval(e)].reduce(function(ds, p) 
        });
         */

        ehover
            .on('mouseover.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(edge_on_paths[chart.edgeKey.eval(e)]);
            })
            .on('mouseout.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(null);
            });
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null);
        clear_all_highlights(edge);
        chart.edgeStrokeWidth.cascade(100, null);
        chart.edgeStroke.cascade(100, null);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge, ehover) {
            remove_behavior(chart, node, edge);
            return this;
        },
        parent: function(p) {
            var anchor = p.anchorName();
            highlight_paths_group.on('paths_changed.' + anchor, p ? paths_changed : null);
            highlight_paths_group.on('hover_changed.' + anchor, p ? hover_changed : null);
        }
    });

    // reuse this
    window.chart_registry.create_type('highlight-paths', function() {
        return d3.dispatch('paths_changed', 'hover_changed');
    });
    var highlight_paths_group = window.chart_registry.create_group('highlight-paths', pathsgroup);

    return _behavior;
};

