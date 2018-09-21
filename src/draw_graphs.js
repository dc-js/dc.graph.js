dc_graph.draw_graphs = function(options) {
    var select_nodes_group =  dc_graph.select_things_group(options.select_nodes_group || 'select-nodes-group', 'select-nodes'),
        select_edges_group = dc_graph.select_things_group(options.select_edges_group || 'select-edges-group', 'select-edges'),
        label_nodes_group = dc_graph.label_things_group('label-nodes-group', 'label-nodes'),
        label_edges_group = dc_graph.label_things_group('label-edges-group', 'label-edges'),
        fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _nodeIdTag = options.idTag || 'id',
        _edgeIdTag = options.edgeIdTag || _nodeIdTag,
        _sourceTag = options.sourceTag || 'source',
        _targetTag = options.targetTag || 'target',
        _nodeLabelTag = options.labelTag || 'label',
        _edgeLabelTag = options.edgeLabelTag || _nodeLabelTag;

    var _sourceDown = null, _targetMove = null, _edgeLayer = null, _hintData = [];

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
            x1: function(n) { return n.source.x; },
            y1: function(n) { return n.source.y; },
            x2: function(n) { return n.target.x; },
            y2: function(n) { return n.target.y; }
        });
    }

    function erase_hint() {
        _hintData = [];
        _sourceDown = _targetMove = null;
        update_hint();
    }

    function create_node(diagram, pos, data) {
        if(!_behavior.nodeCrossfilter())
            throw new Error('need nodeCrossfilter');
        var node, callback = _behavior.addNode() || promise_identity;
        if(data)
            node = data;
        else {
            node = {};
            node[_nodeIdTag] = uuid();
            node[_nodeLabelTag] = '';
        }
        if(pos)
            fix_nodes_group.new_node(node[_nodeIdTag], node, {x: pos[0], y: pos[1]});
        callback(node).then(function(node2) {
            if(!node2)
                return;
            _behavior.nodeCrossfilter().add([node2]);
            diagram.redrawGroup();
            select_nodes_group.set_changed([node2[_nodeIdTag]]);
        });
    }

    function create_edge(diagram, source, target) {
        if(!_behavior.edgeCrossfilter())
            throw new Error('need edgeCrossfilter');
        var edge = {}, callback = _behavior.addEdge() || promise_identity;
        edge[_edgeIdTag] = uuid();
        edge[_edgeLabelTag] = '';
        if(_behavior.conduct().detectReversedEdge && _behavior.conduct().detectReversedEdge(edge, source.port, target.port)) {
            edge[_sourceTag] = target.node.orig.key;
            edge[_targetTag] = source.node.orig.key;
            var t;
            t = source; source = target; target = t;
        } else {
            edge[_sourceTag] = source.node.orig.key;
            edge[_targetTag] = target.node.orig.key;
        }
        callback(edge, source.port, target.port).then(function(edge2) {
            if(!edge2)
                return;
            fix_nodes_group.new_edge(edge[_edgeIdTag], edge2[_sourceTag], edge2[_targetTag]);
            _behavior.edgeCrossfilter().add([edge2]);
            select_nodes_group.set_changed([], false);
            select_edges_group.set_changed([edge2[_edgeIdTag]], false);
            diagram.redrawGroup();
        });
    }

    function check_invalid_drag(coords) {
        var msg;
        if(!(d3.event.buttons & 1)) {
            // mouse button was released but we missed it
            if(_behavior.conduct().cancelDragEdge)
                _behavior.conduct().cancelDragEdge(_sourceDown);
            erase_hint();
            return true;
        }
        if(!_sourceDown.started && Math.hypot(coords[0] - _hintData[0].source.x, coords[1] - _hintData[0].source.y) > _behavior.dragSize()) {
            if(_behavior.conduct().startDragEdge) {
                if(_behavior.conduct().startDragEdge(_sourceDown)) {
                    _sourceDown.started = true;
                } else {
                    if(_behavior.conduct().invalidSourceMessage) {
                        msg = _behavior.conduct().invalidSourceMessage(_sourceDown);
                        console.log(msg);
                        if(options.negativeTip) {
                            options.negativeTip
                                .content(function(_, k) { k(msg); })
                                .displayTip(_behavior.usePorts() ? _sourceDown.port : _sourceDown.node);
                        }
                    }
                    erase_hint();
                    return true;
                }
            }
        }
        return false;
    }

    function add_behavior(diagram, node, edge, ehover) {
        var select_nodes = diagram.child('select-nodes');
        if(select_nodes) {
            if(_behavior.clickCreatesNodes())
                select_nodes.clickBackgroundClears(false);
        }
        node
            .on('mousedown.draw-graphs', function(n) {
                d3.event.stopPropagation();
                if(!_behavior.dragCreatesEdges())
                    return;
                if(options.tipsDisable)
                    options.tipsDisable.forEach(function(tip) {
                        tip
                            .hideTip()
                            .disabled(true);
                    });
                if(_behavior.usePorts()) {
                    var activePort;
                    if(typeof _behavior.usePorts() === 'object' && _behavior.usePorts().eventPort)
                        activePort = _behavior.usePorts().eventPort();
                    else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'out')
                        || diagram.getPort(diagram.nodeKey.eval(n), null, 'in');
                    if(!activePort)
                        return;
                    _sourceDown = {node: n, port: activePort};
                    _hintData = [{source: {x: n.cola.x + activePort.pos.x, y: n.cola.y + activePort.pos.y}}];
                } else {
                    _sourceDown = {node: n};
                    _hintData = [{source: {x: _sourceDown.node.cola.x, y: _sourceDown.node.cola.y}}];
                }
            })
            .on('mousemove.draw-graphs', function(n) {
                var msg;
                d3.event.stopPropagation();
                if(_sourceDown) {
                    var coords = dc_graph.event_coords(diagram);
                    if(check_invalid_drag(coords))
                        return;
                    var oldTarget = _targetMove;
                    if(n === _sourceDown.node) {
                        _behavior.conduct().invalidTargetMessage &&
                            console.log(_behavior.conduct().invalidTargetMessage(_sourceDown, _sourceDown));
                        _targetMove = null;
                        _hintData[0].target = null;
                    }
                    else if(_behavior.usePorts()) {
                        var activePort;
                        if(typeof _behavior.usePorts() === 'object' && _behavior.usePorts().eventPort)
                            activePort = _behavior.usePorts().eventPort();
                        else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'in')
                            || diagram.getPort(diagram.nodeKey.eval(n), null, 'out');
                        if(activePort)
                            _targetMove = {node: n, port: activePort};
                        else
                            _targetMove = null;
                    } else if(!_targetMove || n !== _targetMove.node) {
                        _targetMove = {node: n};
                    }
                    if(_behavior.conduct().changeDragTarget) {
                        var change;
                        if(_behavior.usePorts()) {
                            var oldPort = oldTarget && oldTarget.port,
                                newPort = _targetMove && _targetMove.port;
                            change = oldPort !== newPort;
                        } else {
                            var oldNode = oldTarget && oldTarget.node,
                                newNode = _targetMove && _targetMove.node;
                             change = oldNode !== newNode;
                        }
                        if(change)
                            if(_behavior.conduct().changeDragTarget(_sourceDown, _targetMove)) {
                                if(options.negativeTip)
                                    options.negativeTip.hideTip();
                                msg = _behavior.conduct().validTargetMessage && _behavior.conduct().validTargetMessage() ||
                                    'matches';
                                if(options.positiveTip) {
                                    options.positiveTip
                                        .content(function(_, k) { k(msg); })
                                        .displayTip(_behavior.usePorts() ? _targetMove.port : _targetMove.node);
                                }
                            } else {
                                if(_targetMove && _behavior.conduct().invalidTargetMessage) {
                                    if(options.positiveTip)
                                        options.positiveTip.hideTip();
                                    msg = _behavior.conduct().invalidTargetMessage(_sourceDown, _targetMove);
                                    console.log(msg);
                                    if(options.negativeTip) {
                                        options.negativeTip
                                            .content(function(_, k) { k(msg); })
                                            .displayTip(_behavior.usePorts() ? _targetMove.port : _targetMove.node);
                                    }
                                }
                                _targetMove = null;
                            }
                    }
                    if(_targetMove) {
                        if(_targetMove.port)
                            _hintData[0].target = {x: n.cola.x + activePort.pos.x, y: n.cola.y + activePort.pos.y};
                        else
                            _hintData[0].target = {x: n.cola.x, y: n.cola.y};
                    }
                    else {
                        _hintData[0].target = {x: coords[0], y: coords[1]};
                    }
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function(n) {
                if(options.negativeTip)
                    options.negativeTip.hideTip(true);
                if(options.tipsDisable)
                    options.tipsDisable.forEach(function(tip) {
                        tip.disabled(false);
                    });
                // allow keyboard mode to hear this one (again, we need better cooperation)
                // d3.event.stopPropagation();
                if(_sourceDown && _targetMove) {
                    var finishPromise;
                    if(_behavior.conduct().finishDragEdge)
                        finishPromise = _behavior.conduct().finishDragEdge(_sourceDown, _targetMove);
                    else finishPromise = Promise.resolve(true);
                    var source = _sourceDown, target = _targetMove;
                    finishPromise.then(function(ok) {
                        if(ok)
                            create_edge(diagram, source, target);
                    });
                }
                else if(_sourceDown) {
                    if(_behavior.conduct().cancelDragEdge)
                        _behavior.conduct().cancelDragEdge(_sourceDown);
                }
                erase_hint();
            });
        diagram.svg()
            .on('mousedown.draw-graphs', function() {
                _sourceDown = null;
            })
            .on('mousemove.draw-graphs', function() {
                var data = [];
                if(_sourceDown) { // drawing edge
                    var coords = dc_graph.event_coords(diagram);
                    if(check_invalid_drag(coords))
                        return;
                    if(_behavior.conduct().dragCanvas)
                        _behavior.conduct().dragCanvas(_sourceDown, coords);
                    if(_behavior.conduct().changeDragTarget && _targetMove)
                        _behavior.conduct().changeDragTarget(_sourceDown, null);
                    _targetMove = null;
                    _hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                }
            })
            .on('mouseup.draw-graphs', function() {
                if(options.negativeTip)
                    options.negativeTip.hideTip(true);
                if(options.tipsDisable)
                    options.tipsDisable.forEach(function(tip) {
                        tip.disabled(false);
                    });
                if(_sourceDown) { // drag-edge
                    if(_behavior.conduct().cancelDragEdge)
                        _behavior.conduct().cancelDragEdge(_sourceDown);
                    erase_hint();
                } else { // click-node
                    if(d3.event.target === this && _behavior.clickCreatesNodes())
                        create_node(diagram, dc_graph.event_coords(diagram));
                }
            });
        if(!_edgeLayer)
            _edgeLayer = diagram.g().append('g').attr('class', 'draw-graphs');
    }

    function remove_behavior(diagram, node, edge, ehover) {
        node
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
        diagram.svg()
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
    _behavior.dragSize = property(5);

    // really this is a behavior, and what we've been calling behaviors are modes
    // but i'm on a deadline
    _behavior.conduct = property({});

    // callbacks to modify data as it's being added
    // as of 0.6, function returns a promise of the new data
    _behavior.addNode = property(null); // node -> promise(node2)
    _behavior.addEdge = property(null); // edge, sourceport, targetport -> promise(edge2)

    // or, if you want to drive..
    _behavior.createNode = function(pos, data) {
        create_node(_behavior.parent(), pos, data);
    };

    return _behavior;
};

