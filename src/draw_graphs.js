dc_graph.draw_graphs = function(options) {
    if(!options.nodeCrossfilter)
        throw new Error('need nodeCrossfilter');
    if(!options.edgeCrossfilter)
        throw new Error('need edgeCrossfilter');
    var idTag = options.idTag || 'id',
        sourceTag = options.sourceTag || 'source',
        targetTag = options.targetTag || 'target',
        labelTag = options.labelTag || 'label',
        fixedPosTag = options.fixedPosTag || 'fixedPos';

    var source = null;

    function add_behavior(chart, node, edge, ehover) {
        node
            .on('mousedown.draw-edge', function(d) {
                source = d;
            });
        chart.svg().on('click.draw-node', function() {
            var node = {};
            node[idTag] = uuid();
            node[labelTag] = '';
            var bound = chart.root().node().getBoundingClientRect();
            var coords = chart.invertCoord([d3.event.clientX - bound.left,
                                            d3.event.clientY - bound.top]);
            node[fixedPosTag] = {x: coords[0], y: coords[1]};
            options.nodeCrossfilter.add([node]);
            chart.redraw();
        }).on('mousemove.draw-edge', function() {
            if(source) { // drawing edge
            }
        });
    }

    function remove_behavior(chart, node, edge, ehover) {
        node
            .on('mousedown.draw-edge', null);
        chart.svg()
            .on('click.draw-node', null)
            .on('mousemove.draw-edge', null);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });

    // whether to do relayout & redraw (true) or just refresh (false)
    _behavior.doRedraw = property(false);

    return _behavior;
};

