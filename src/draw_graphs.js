dc_graph.draw_graphs = function(options) {
    if(!options.nodeCrossfilter)
        throw new Error('need nodeCrossfilter');
    if(!options.edgeCrossfilter)
        throw new Error('need edgeCrossfilter');
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');
    var _idTag = options.idTag || 'id',
        _sourceTag = options.sourceTag || 'source',
        _targetTag = options.targetTag || 'target',
        _labelTag = options.labelTag || 'label',
        _fixedPosTag = options.fixedPosTag || 'fixedPos';

    var _sourceDown = null, _targetMove = null, _edgeLayer = null, _hintData = [];

    function event_coords(chart) {
        var bound = chart.root().node().getBoundingClientRect();
        return chart.invertCoord([d3.event.clientX - bound.left,
                                  d3.event.clientY - bound.top]);
    }

    function update_hint() {
        var data = _hintData.filter(function(h) {
            return h.source && h.target;
        });
        var line = _edgeLayer.selectAll('line.hint-edge').data(data);
        line.exit().remove();
        line.enter().append('line')
            .attr('class', 'hint-edge')
            .style({
                fill: 'none',
                stroke: 'black',
                'pointer-events': 'none'
            });

        line.attr({
            x1: function(d) { return d.source.x; },
            y1: function(d) { return d.source.y; },
            x2: function(d) { return d.target.x; },
            y2: function(d) { return d.target.y; }
        });
    }

    function erase_hint() {
        _hintData = [];
        _sourceDown = _targetMove = null;
        update_hint();
    }

    function create_node(chart, pos) {
        var node = {};
        node[_idTag] = uuid();
        node[_labelTag] = '';
        node[_fixedPosTag] = {x: pos[0], y: pos[1]};
        options.nodeCrossfilter.add([node]);
        chart.redraw();
        select_nodes_group.node_set_changed([node[_idTag]]);
    }

    function create_edge(chart, source, target) {
        erase_hint();
        var edge = {};
        edge[_idTag] = uuid();
        edge[_sourceTag] = source.orig.key;
        edge[_targetTag] = target.orig.key;
        // changing this data inside crossfilter is okay because it is not indexed data
        source.orig.value[_fixedPosTag] = null;
        target.orig.value[_fixedPosTag] = null;
        options.edgeCrossfilter.add([edge]);
        chart.redraw();
        select_nodes_group.node_set_changed([]);
    }

    function add_behavior(chart, node, edge, ehover) {
        var select_nodes = chart.child('select-nodes');
        if(select_nodes)
            select_nodes.clickBackgroundClears(false);
        node
            .on('mousedown.draw-graphs', function(d) {
                d3.event.stopPropagation();
                _sourceDown = d;
                _hintData = [{source: {x: _sourceDown.cola.x, y: _sourceDown.cola.y}}];
            })
            .on('mousemove.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(_sourceDown) {
                    if(d === _sourceDown) {
                        _targetMove = null;
                        _hintData[0].target = null;
                    }
                    else if(d !== _targetMove) {
                        _targetMove = d;
                        _hintData[0].target = {x: _targetMove.cola.x, y: _targetMove.cola.y};
                    }
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(_sourceDown && _targetMove)
                    create_edge(chart, _sourceDown, _targetMove);
                else
                    erase_hint();
            });
        chart.svg()
            .on('mousedown.draw-graphs', function() {
                _sourceDown = null;
            })
            .on('mousemove.draw-graphs', function() {
                var data = [];
                if(_sourceDown) { // drawing edge
                    var coords = event_coords(chart);
                    _targetMove = null;
                    _hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function() {
                if(_sourceDown) // drag-edge
                    erase_hint();
                else // click-node
                    create_node(chart, event_coords(chart));
            });
        if(!_edgeLayer)
            _edgeLayer = chart.g().append('g').attr('class', 'draw-graphs');
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

