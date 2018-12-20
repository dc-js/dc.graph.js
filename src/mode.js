dc_graph.mode = function(event_namespace, options) {
    var _mode = {};
    var _eventName = options.laterDraw ? 'transitionsStarted' : 'drawn';
    var draw = options.draw, remove = options.remove;

    if(!draw) {
        console.warn('behavior.draw has been replaced by mode.draw');
        draw = options.draw;
    }
    if(!remove) {
        console.warn('behavior.remove has been replaced by mode.remove');
        remove = options.remove;
    }

    /**
     #### .parent([object])
     Assigns this mode to a diagram.
     **/
    _mode.parent = property(null)
        .react(function(p) {
            var diagram;
            if(p) {
                var first = true;
                diagram = p;
                p.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    draw(diagram, node, edge, ehover);
                    if(first && options.first) {
                        options.first(diagram, node, edge, ehover);
                        first = false;
                    }
                    else if(options.rest)
                        options.rest(diagram, node, edge, ehover);
                });
                p.on('reset.' + event_namespace, function() {
                    remove(diagram, diagram.selectAllNodes(), diagram.selectAllEdges(), diagram.selectAllEdges('.edge-hover'));
                });
            }
            else if(_mode.parent()) {
                diagram = _mode.parent();
                diagram.on(_eventName + '.' + event_namespace, function(node, edge, ehover) {
                    remove(diagram, node, edge, ehover);
                    diagram.on(_eventName + '.' + event_namespace, null);
                });
            }
            options.parent && options.parent(p);
        });
    return _mode;
};

dc_graph.behavior = deprecate_function('dc_graph.behavior has been renamed dc_graph.mode', dc_graph.mode);
