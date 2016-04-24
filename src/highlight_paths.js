dc_graph.highlight_paths = function(pathprops, hoverprops, pathsgroup) {
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
    function add_behavior(chart, node, edge) {
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
            .on('mouseover.highlight-paths', function(d) {
                highlight_paths_group.hover_changed(node_on_paths[chart.nodeKey.eval(d)]);
            })
            .on('mouseout.highlight-paths', function(d) {
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
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
            return this;
        },
        parent: function(p) {
            var anchor = p.anchorName();
            highlight_paths_group.on('paths_changed.' + anchor, p ? paths_changed : null);
            highlight_paths_group.on('hover_changed.' + anchor, p ? hover_changed : null);
        }
    });
    _behavior.pathList =  property(identity, false);
    _behavior.elementList = property(identity, false);
    _behavior.elementType = property(null, false);
    _behavior.nodeKey = property(null, false);
    _behavior.edgeSource = property(null, false);
    _behavior.edgeTarget = property(null, false);
    _behavior.data = function(data) {
        var nop = {}, eop = {};
        _behavior.pathList.eval(data).forEach(function(path) {
            _behavior.elementList.eval(path).forEach(function(element) {
                var key, paths;
                switch(_behavior.elementType.eval(element)) {
                case 'node':
                    key = _behavior.nodeKey.eval(element);
                    paths = nop[key] = nop[key] || [];
                    break;
                case 'edge':
                    key = _behavior.edgeSource.eval(element) + '-' + _behavior.edgeTarget.eval(element);
                    paths = eop[key] = eop[key] || [];
                    break;
                }
                paths.push(path);
            });
        });
        highlight_paths_group.paths_changed(nop, eop);
    };

    window.chart_registry.create_type('highlight-paths', function() {
        return d3.dispatch('paths_changed', 'hover_changed');
    });
    pathsgroup = pathsgroup || 'highlight-paths-group';
    var highlight_paths_group = window.chart_registry.create_group('highlight-paths', pathsgroup);

    return _behavior;
};

