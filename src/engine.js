dc_graph.spawn_engine = function(layout, args, worker) {
    var engine, params;
    switch(layout) {
    case 'dagre':
        engine = dc_graph.dagre_layout();
        params = ['rankdir'];
        break;
    case 'tree':
        engine = dc_graph.tree_layout();
        params = [];
        break;
    case "circo":
    case "dot":
    case "neato":
    case "osage":
    case "twopi":
        engine = dc_graph.graphviz_layout(null, layout, args.server);
        params = [];
        break;
    case 'cola':
    default:
        engine = dc_graph.cola_layout()
            .groupConnected(true)
            .handleDisconnected(false);
        params = ['lengthStrategy'];
        break;
    }
    params.forEach(function(p) {
        if(args[p])
            engine[p](args[p]);
    });
    if(engine.supportsWebworker() && worker)
        engine = dc_graph.webworker_layout(engine);
    return engine;
};
