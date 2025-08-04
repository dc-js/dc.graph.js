// Shared worker message handling code
const _layouts = {};

function postResponse(event, layoutId) {
    return function() {
        const message = {
            response: event,
            layoutId
        };
        message.args = Array.prototype.slice.call(arguments);
        postMessage(message);
    };
}

export function createWorkerHandler(layoutFactory) {
    return async function(e) {
        const args = e.data.args;
        const layoutId = args.layoutId;
        
        switch(e.data.command) {
        case 'init': {
            const layout = layoutFactory()
                .on('tick', postResponse('tick', layoutId))
                .on('start', postResponse('start', layoutId))
                .on('end', postResponse('end', layoutId));
            
            const initResult = layout.init(args.options);
            
            // Handle both sync and async init methods
            if (initResult && typeof initResult.then === 'function') {
                await initResult;
                _layouts[layoutId] = layout;
            } else {
                _layouts[layoutId] = initResult || layout;
            }
            
            // Send init completion response
            postMessage({
                response: 'init',
                layoutId,
                args: []
            });
            break;
        }
        case 'data':
            if(_layouts[layoutId])
                _layouts[layoutId].data(args.graph, args.nodes, args.edges, args.clusters, args.constraints);
            break;
        case 'start':
            if(_layouts[layoutId])
                await _layouts[layoutId].start();
            break;
        case 'stop':
            if(_layouts[layoutId])
                _layouts[layoutId].stop();
            break;
        }
    };
}