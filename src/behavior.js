dc_graph.behavior = function(event_namespace, options) {
    var _behavior = {};
    var _eventName = options.laterDraw ? 'transitionsStarted' : 'drawn';

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
                p.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    options.add_behavior(chart, node, edge, ehover);
                    if(first && options.first) {
                        options.first(chart, node, edge, ehover);
                        first = false;
                    }
                    else if(options.rest)
                        options.rest(chart, node, edge, ehover);
                });
            }
            else if(_behavior.parent()) {
                chart = _behavior.parent();
                chart.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    options.remove_behavior(chart, node, edge, ehover);
                    chart.on(_eventName + '.' + event_namespace, null);
                });
            }
            options.parent && options.parent(p);
        });
    return _behavior;
};
