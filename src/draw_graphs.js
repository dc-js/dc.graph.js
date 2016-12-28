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

    var source = null, target = null, edgeLayer = null, hintData = [];

    function event_coords(chart) {
        var bound = chart.root().node().getBoundingClientRect();
        return chart.invertCoord([d3.event.clientX - bound.left,
                                  d3.event.clientY - bound.top]);
    }

    function update_hint() {
        var line = edgeLayer.selectAll('line.hint-edge').data(hintData);
        line.exit().remove();
        line.enter().append('line')
            .attr('class', 'hint-edge')
            .style({
                fill: 'none',
                stroke: 'black'
            });

        line.attr({
            x1: function(d) { return d.source.x; },
            y1: function(d) { return d.source.y; },
            x2: function(d) { return d.target.x; },
            y2: function(d) { return d.target.y; }
        });
    }

    function erase_hint() {
        hintData = [];
        source = target = null;
        update_hint();
    }

    function create_node(chart, pos) {
        var node = {};
        node[idTag] = uuid();
        node[labelTag] = '';
        node[fixedPosTag] = {x: pos[0], y: pos[1]};
        options.nodeCrossfilter.add([node]);
        chart.redraw();
    }

    function create_edge(chart, source, target) {
        erase_hint();
        var edge = {};
        edge[idTag] = uuid();
        edge[sourceTag] = source.orig.key;
        edge[targetTag] = target.orig.key;
        source.orig.value[fixedPosTag] = null;
        options.edgeCrossfilter.add([edge]);
        chart.redraw();
    }

    function add_behavior(chart, node, edge, ehover) {
        node
            .on('mousedown.draw-edge', function(d) {
                source = d;
                hintData = [{source: {x: source.cola.x, y: source.cola.y}}];
                d3.event.stopPropagation();
            })
            .on('mousemove.draw-edge', function(d) {
                if(source) {
                    if(d !== source && d !== target) {
                        target = d;
                        hintData[0].target = {x: target.cola.x, y: target.cola.y};
                        update_hint();
                    }
                    d3.event.stopPropagation();
                }
            })
            .on('mouseup.draw-edge', function(d) {
                if(source) {
                    console.assert(target);
                    create_edge(chart, source, target);
                    d3.event.preventDefault();
                }
            })
            .on('click.draw-edge', function(d) {
                d3.event.stopPropagation();
            });
        chart.svg()
            .on('mousedown.draw-node', function() {
                source = null;
            })
            .on('click.draw-node', function() {
                if(source)
                    return; // this was a drag-edge instead
                create_node(chart, event_coords(chart));
            })
            .on('mousemove.draw-edge', function() {
                var data = [];
                if(source) { // drawing edge
                    var coords = event_coords(chart);
                    target = null;
                    hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                }
            })
            .on('mouseup.draw-edge', function() {
                erase_hint();
            });
        if(!edgeLayer)
            edgeLayer = chart.g().append('g').attr('class', 'draw-edge');
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

