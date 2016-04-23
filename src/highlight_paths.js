dc_graph.highlight_paths = function(pathprops, hoverprops) {
    var node_on_paths = {}, edge_on_paths = {};
    var hoverpaths;
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_paths = null;
        });
    }

    function add_behavior(chart, node, edge) {
        chart
            .cascade(200, conditional_properties(function(o) {
                return !!o.dcg_paths;
            }, pathprops))
            .cascade(300, conditional_properties(function(o) {
                return hoverpaths && o.dcg_paths && hoverpaths.some(function(hpath) {
                    return o.dcg_paths.indexOf(hpath)>=0;
                });
            }, hoverprops));

        node.each(function(n) {
            n.dcg_paths = node_on_paths[chart.nodeKey.eval(n)];
        });
        edge.each(function(e) {
            e.dcg_paths = edge_on_paths[chart.edgeKey.eval(e)];
        });
        node
            .on('mouseover.highlight-paths', function(d) {
                hoverpaths = node_on_paths[chart.nodeKey.eval(d)];
                chart.refresh(node, edge);
            })
            .on('mouseout.highlight-paths', function(d) {
                hoverpaths = null;
                chart.refresh(node, edge);
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
        }
    });
    _behavior.pathList =  property(identity, false);
    _behavior.elementList = property(identity, false);
    _behavior.elementType =  property(null, false);
    _behavior.nodeKey = property(null, false);
    _behavior.edgeSource = property(null, false);
    _behavior.edgeTarget = property(null, false);
    _behavior.data = function(data) {
        node_on_paths = {}; edge_on_paths = {};
        _behavior.pathList.eval(data).forEach(function(path) {
            _behavior.elementList.eval(path).forEach(function(element) {
                var key, paths;
                switch(_behavior.elementType.eval(element)) {
                case 'node':
                    key = _behavior.nodeKey.eval(element);
                    paths = node_on_paths[key] = node_on_paths[key] || [];
                    break;
                case 'edge':
                    key = _behavior.edgeSource.eval(element) + '-' + _behavior.edgeTarget.eval(element);
                    paths = edge_on_paths[key] = edge_on_paths[key] || [];
                    break;
                }
                paths.push(path);
            });
        });
    };
    return _behavior;
};

