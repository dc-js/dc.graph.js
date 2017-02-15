var _layouts;

function postResponse(event, layoutId) {
    return function() {
        var message = {
            response: event,
            layoutId: layoutId
        };
        message.args = Array.prototype.slice.call(arguments);
        postMessage(message);
    };
}

onmessage = function(e) {
    var args = e.data.args;
    switch(e.data.command) {
    case 'init':
        if(!_layouts) {
            _layouts = {};
            importScripts.apply(null, dc_graph.cola_layout.scripts);
        }

        _layouts[args.layoutId] = dc_graph.cola_layout()
            .on('tick', postResponse('tick', args.layoutId))
            .on('start', postResponse('start', args.layoutId))
            .on('end', postResponse('end', args.layoutId))
            .init(args.options);
        // init_d3cola(args.width, args.height, args.handleDisconnected,
        //             args.lengthStrategy, args.baseLength, args.flowLayout,
        //             args.tickSize);
        break;
    case 'data':
        _layouts[args.layoutId].data(args.nodes, args.edges, args.constraints, args.options);
        // data_d3cola(args.nodes, args.edges, args.constraints, args.opts);
        break;
    case 'start':
        // if(args.initialOnly) {
        //     if(args.showLayoutSteps)
        //         _tick();
        //     _done();
        // }
        // else
        _layouts[args.layoutId].start(args.options);
        break;
    case 'stop':
        _layouts[args.layoutId].stop();
        break;
    }
};

