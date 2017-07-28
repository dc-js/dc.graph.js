dc_graph.draw_graphs = function(options) {
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group'),
        label_nodes_group = dc_graph.label_nodes_group('label-nodes-group');
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

    function create_node(chart, pos, data) {
        var node;
        if(data)
            node = data;
        else {
            node = {};
            node[_idTag] = uuid();
            node[_labelTag] = '';
        }
        if(pos)
            node[_fixedPosTag] = {x: pos[0], y: pos[1]};
        if(_behavior.addNode())
            _behavior.addNode()(node);
        if(!_behavior.nodeCrossfilter())
            throw new Error('need nodeCrossfilter');
        _behavior.nodeCrossfilter().add([node]);
        chart.redrawGroup();
        select_nodes_group.node_set_changed([node[_idTag]]);
    }

    function create_edge(chart, source, target) {
        var edge = {};
        edge[_idTag] = uuid();
        edge[_sourceTag] = source.node.orig.key;
        edge[_targetTag] = target.node.orig.key;
        if(_behavior.addEdge())
            _behavior.addEdge()(edge, source.port, target.port);
        // changing this data inside crossfilter is okay because it is not indexed data
        source.node.orig.value[_fixedPosTag] = null;
        target.node.orig.value[_fixedPosTag] = null;
        if(!_behavior.edgeCrossfilter())
            throw new Error('need edgeCrossfilter');
        _behavior.edgeCrossfilter().add([edge]);
        select_nodes_group.node_set_changed([], false);
        chart.redrawGroup();
    }

    function add_behavior(chart, node, edge, ehover) {
        var select_nodes = chart.child('select-nodes');
        if(select_nodes) {
            select_nodes.clickBackgroundClears(false);
            select_nodes.secondClickEvent(function(node) {
                label_nodes_group.edit_node_label(node, {selectText: true});
            });
        }
        node
            .on('mousedown.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(!_behavior.dragCreatesEdges())
                    return;
                if(_behavior.usePorts()) {
                    var activePort = _behavior.usePorts().eventPort();
                    if(!activePort)
                        return;
                    _sourceDown = {node: d, port: activePort};
                    _hintData = [{source: {x: d.cola.x + activePort.pos.x, y: d.cola.y + activePort.pos.y}}];
                } else {
                    _sourceDown = {node: d};
                    _hintData = [{source: {x: _sourceDown.cola.x, y: _sourceDown.cola.y}}];
                }
                if(_behavior.conduct().startDragEdge) {
                    if(!_behavior.conduct().startDragEdge(_sourceDown))
                        erase_hint();
                }
            })
            .on('mousemove.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(_sourceDown) {
                    var oldTarget = _targetMove;
                    if(d === _sourceDown.node) {
                        _targetMove = null;
                        _hintData[0].target = null;
                    }
                    else if(_behavior.usePorts()) {
                        var activePort =  _behavior.usePorts().eventPort();
                        if(activePort)
                            _targetMove = {node: d, port: activePort};
                        else
                            _targetMove = null;
                    } else if(!_targetMove || d !== _targetMove.node) {
                        _targetMove = {node: d};
                    }
                    if(_behavior.conduct().changeDragTarget &&
                       (!!oldTarget ^ !!_targetMove ||
                        (oldTarget && _targetMove &&
                         (oldTarget.node !== _targetMove.node ||
                          oldTarget.port !== _targetMove.port)))) {
                        if(!_behavior.conduct().changeDragTarget(_sourceDown, _targetMove))
                            _targetMove = null;
                    }
                    if(_targetMove) {
                        if(_targetMove.port)
                            _hintData[0].target = {x: d.cola.x + activePort.pos.x, y: d.cola.y + activePort.pos.y};
                        else
                            _hintData[0].target = {x: d.cola.x, y: d.cola.y};
                    }
                    else {
                        var coords = event_coords(chart);
                        _hintData[0].target = {x: coords[0], y: coords[1]};
                    }
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function(d) {
                d3.event.stopPropagation();
                if(_sourceDown && _targetMove) {
                    if(_behavior.conduct().finishDragEdge)
                        if(!_behavior.conduct().finishDragEdge(_sourceDown, _targetMove))
                            return;
                    create_edge(chart, _sourceDown, _targetMove);
                }
                else if(_sourceDown) {
                    if(_behavior.conduct().cancelDragEdge)
                        _behavior.conduct().cancelDragEdge();
                }
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
                if(_sourceDown) { // drag-edge
                    if(_behavior.conduct().cancelDragEdge)
                        _behavior.conduct().cancelDragEdge();
                    erase_hint();
                } else { // click-node
                    if(_behavior.clickCreatesNodes())
                        create_node(chart, event_coords(chart));
                }
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

    // update the data source/destination
    _behavior.nodeCrossfilter = property(options.nodeCrossfilter);
    _behavior.edgeCrossfilter = property(options.edgeCrossfilter);

    // behavioral options
    _behavior.usePorts = property(null);
    _behavior.clickCreatesNodes = property(true);
    _behavior.dragCreatesEdges = property(true);

    // really this is a behavior, and what we've been calling behaviors are modes
    // but i'm on a deadline
    _behavior.conduct = property({});

    // callbacks to modify data as it's being added
    _behavior.addNode = property(null);
    _behavior.addEdge = property(null);
    _behavior.createNode = function(pos, data) {
        create_node(_behavior.parent(), pos, data);
    };

    return _behavior;
};

