dc_graph.behavior = function(event_namespace, handlers) {
    var _behavior = {};

    /**
     #### .parent([object])
     Assigns this behavior to a diagram.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var chart;
            if(p) {
                var first = true;
                chart = p;
                p.on('drawn.' + event_namespace, function(node, edge, ehover) {
                    handlers.add_behavior(chart, node, edge, ehover);
                    if(first && handlers.first) {
                        handlers.first(chart, node, edge, ehover);
                        first = false;
                    }
                    else if(handlers.rest)
                        handlers.rest(chart, node, edge, ehover);
                });
            }
            else if(_behavior.parent()) {
                chart = _behavior.parent();
                chart.on('drawn.' + event_namespace, function(node, edge, ehover) {
                    handlers.remove_behavior(chart, node, edge, ehover);
                    chart.on('drawn.' + event_namespace, null);
                });
            }
            handlers.parent && handlers.parent(p);
        });
    return _behavior;
};
