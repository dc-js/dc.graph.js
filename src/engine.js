dc_graph.spawn_engine = function(layout, args, worker) {
    var allow_webworker = true;
    var engine, params;
    switch(layout) {
    case 'dagre':
        engine = dc_graph.dagre_layout();
        params = ['rankdir'];
        break;
    case 'tree':
        engine = dc_graph.tree_layout();
        params = [];
        allow_webworker = false;
        break;
    case 'cola':
    default:
        engine = dc_graph.cola_layout();
        params = ['lengthStrategy'];
        break;
    }
    params.forEach(function(p) {
        if(args[p])
            engine[p](args[p]);
    });
    if(allow_webworker && worker !== 'false')
        engine = dc_graph.webworker_layout(engine);
    return engine;
};
