dc_graph.behavior = function(event_namespace, options) {
    var _behavior = {};
    var _eventName = options.laterDraw ? 'transitionsStarted' : 'drawn';

    /**
     #### .parent([object])
     Assigns this behavior to a diagram.
     **/
    _behavior.parent = property(null)
        .react(function(p) {
            var diagram;
            if(p) {
                var first = true;
                diagram = p;
                p.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    options.add_behavior(diagram, node, edge, ehover);
                    if(first && options.first) {
                        options.first(diagram, node, edge, ehover);
                        first = false;
                    }
                    else if(options.rest)
                        options.rest(diagram, node, edge, ehover);
                });
            }
            else if(_behavior.parent()) {
                diagram = _behavior.parent();
                diagram.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    options.remove_behavior(diagram, node, edge, ehover);
                    diagram.on(_eventName + '.' + event_namespace, null);
                });
            }
            options.parent && options.parent(p);
        });
    return _behavior;
};
