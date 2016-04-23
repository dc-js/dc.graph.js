dc_graph.behavior = function(event_namespace, handlers) {
    var _behavior = {};

    /**
     #### .parent([object])
     Assigns this behavior to a diagram. It will highlight edges when their end-nodes
     are hovered.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var chart;
            if(p) {
                var first = true;
                chart = p;
                p.on('drawn.' + event_namespace, function(node, edge) {
                    handlers.add_behavior(chart, node, edge);
                    if(first && handlers.first) {
                        handlers.first(chart, node, edge);
                        first = false;
                    }
                    else if(handlers.rest)
                        handlers.rest(chart, node, edge);
                });
            }
            else if(_behavior.parent()) {
                chart = _behavior.parent();
                chart.on('drawn.' + event_namespace, function(node, edge) {
                    handlers.remove_behavior(chart, node, edge);
                    chart.on('drawn' + event_namespace, null);
                });
            }
        });
    return _behavior;
};
