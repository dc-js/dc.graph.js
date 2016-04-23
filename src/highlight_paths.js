dc_graph.highlight_paths = function(pathprops, hoverprops) {
    var node_on_path = {}, edge_on_path = {};
    var hoverpath;
    function clear_all_highlights(edge) {
        edge.each(function(e) {
            e.dcg_lightpath = null;
        });
    }

    function add_behavior(chart, node, edge) {
        chart
            .cascade(200, conditional_properties(function(e) {
                return e.dcg_lightpath;
            }, pathprops))
            .cascade(300, conditional_properties(function(e) {
                return hoverpath && e.dcg_lightpath === hoverpath;
            }, hoverprops));

        node.each(function(n) {
            n.dcg_lightpath = node_on_path[chart.nodeKey.eval(n)];
        });
        edge.each(function(e) {
            e.dcg_lightpath = edge_on_path[chart.edgeKey.eval(e)];
        });
        node
            .on('mouseover.highlight-paths', function(d) {
                hoverpath = node_on_path[chart.nodeKey.eval(d)];
                chart.refresh(node, edge);
            })
            .on('mouseout.highlight-paths', function(d) {
                hoverpath = null;
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
        _behavior.pathList.eval(data).forEach(function(path) {
            _behavior.elementList.eval(path).forEach(function(element) {
                switch(_behavior.elementType.eval(element)) {
                case 'node':
                    node_on_path[_behavior.nodeKey.eval(element)] = path;
                    break;
                case 'edge':
                    edge_on_path[_behavior.edgeSource.eval(element) + '-' + _behavior.edgeTarget.eval(element)] = path;
                    break;
                }
            });
        });
    };
    return _behavior;
};

