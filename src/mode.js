dc_graph.mode = function(event_namespace, options) {
    var _mode = {};
    var _eventName = options.laterDraw ? 'transitionsStarted' : 'drawn';
    var draw = options.draw, remove = options.remove;
    var supported_renderers = options.renderers || ['svg'];

    if(!draw) {
        console.warn('behavior.add_behavior has been replaced by mode.draw');
        draw = options.add_behavior;
    }
    if(!remove) {
        console.warn('behavior.remove_behavior has been replaced by mode.remove');
        remove = options.remove_behavior;
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
                p.on(_eventName + '.' + event_namespace, function() {
                    var args2 = [diagram].concat(Array.prototype.slice.call(arguments));
                    draw.apply(null, args2);
                    if(first && options.first) {
                        options.first.apply(null, args2);
                        first = false;
                    }
                    else if(options.rest)
                        options.rest.apply(null, args2);
                });
                p.on('reset.' + event_namespace, function() {
                    var rend = diagram.renderer(),
                        node = rend.selectAllNodes ? rend.selectAllNodes() : null,
                        edge = rend.selectAllEdges ? rend.selectAllEdges() : null,
                        edgeHover = rend.selectAllEdges ? rend.selectAllEdges('.edge-hover') : null;
                    remove(diagram, node, edge, edgeHover);
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

    _mode.supportsRenderer = function(rendererType) {
        return supported_renderers.includes(rendererType);
    };

    return _mode;
};

dc_graph.behavior = deprecate_function('dc_graph.behavior has been renamed dc_graph.mode', dc_graph.mode);
