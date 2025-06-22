// Shared worker message handling code
var _layouts = {};

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

export function createWorkerHandler(layoutFactory) {
    return function(e) {
        var args = e.data.args;
        switch(e.data.command) {
        case 'init':
            _layouts[args.layoutId] = layoutFactory()
                .on('tick', postResponse('tick', args.layoutId))
                .on('start', postResponse('start', args.layoutId))
                .on('end', postResponse('end', args.layoutId))
                .init(args.options);
            break;
        case 'data':
            if(_layouts)
                _layouts[args.layoutId].data(args.graph, args.nodes, args.edges, args.clusters, args.constraints);
            break;
        case 'start':
            _layouts[args.layoutId].start();
            break;
        case 'stop':
            if(_layouts)
                _layouts[args.layoutId].stop();
            break;
        }
    };
}