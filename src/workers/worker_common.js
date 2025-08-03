// Shared worker message handling code
var _layouts = {};
var _initPromises = {};
var _messageQueue = {};

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
    return async function(e) {
        var args = e.data.args;
        const layoutId = args.layoutId;
        
        switch(e.data.command) {
        case 'init':
            _initPromises[layoutId] = (async () => {
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
                
                // Process any queued messages for this layout
                if (_messageQueue[layoutId]) {
                    for (const queuedMessage of _messageQueue[layoutId]) {
                        await processCommand(queuedMessage);
                    }
                    delete _messageQueue[layoutId];
                }
            })();
            
            await _initPromises[layoutId];
            break;
        default:
            // Queue other commands until init is complete
            if (_initPromises[layoutId] && !_layouts[layoutId]) {
                if (!_messageQueue[layoutId]) {
                    _messageQueue[layoutId] = [];
                }
                _messageQueue[layoutId].push(e.data);
                return;
            }
            
            await processCommand(e.data);
            break;
        }
    };
    
    async function processCommand(data) {
        const args = data.args;
        const layoutId = args.layoutId;
        
        switch(data.command) {
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
    }
}