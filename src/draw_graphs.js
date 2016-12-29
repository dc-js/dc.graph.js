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
        var data = hintData.filter(function(h) {
            return h.source && h.target;
        });
        var line = edgeLayer.selectAll('line.hint-edge').data(data);
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
            .on('mousedown.draw-graphs', function(d) {
                d3.event.stopPropagation();
                source = d;
                hintData = [{source: {x: source.cola.x, y: source.cola.y}}];
            })
            .on('mousemove.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(source) {
                    if(d === source) {
                        target = null;
                        hintData[0].target = null;
                    }
                    else if(d !== target) {
                        target = d;
                        hintData[0].target = {x: target.cola.x, y: target.cola.y};
                    }
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(source && target)
                    create_edge(chart, source, target);
                else
                    erase_hint();
            });
        chart.svg()
            .on('mousedown.draw-graphs', function() {
                source = null;
            })
            .on('mousemove.draw-graphs', function() {
                var data = [];
                if(source) { // drawing edge
                    var coords = event_coords(chart);
                    target = null;
                    hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function() {
                if(source)
                    erase_hint(); // this was a drag-edge
                else
                    create_node(chart, event_coords(chart));
            });
        if(!edgeLayer)
            edgeLayer = chart.g().append('g').attr('class', 'draw-graphs');
    }

    function remove_behavior(chart, node, edge, ehover) {
        node
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
        chart.svg()
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
    }

    var _behavior = dc_graph.behavior('highlight-paths', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });

    // whether to do relayout & redraw (true) or just refresh (false)
    _behavior.doRedraw = property(false);

    return _behavior;
};

