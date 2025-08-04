import { mode } from './mode.js';
import { property, uuid } from './core.js';
import { eventCoords, promiseIdentity } from './utils.js';
import { selectThingsGroup } from './select_things.js';
import { labelThingsGroup } from './label_things.js';
import { fixNodesGroup } from './fix_nodes.js';
import { event as d3Event } from 'd3-selection';

export function drawGraphs(options) {
    const select_nodes_group = selectThingsGroup(options.select_nodes_group || 'select-nodes-group', 'select-nodes'),
        select_edges_group = selectThingsGroup(options.select_edges_group || 'select-edges-group', 'select-edges'),
        _label_nodes_group = labelThingsGroup('label-nodes-group', 'label-nodes'),
        _label_edges_group = labelThingsGroup('label-edges-group', 'label-edges'),
        fix_nodes_group = fixNodesGroup('fix-nodes-group');
    const _nodeIdTag = options.idTag || 'id',
        _edgeIdTag = options.edgeIdTag || _nodeIdTag,
        _sourceTag = options.sourceTag || 'source',
        _targetTag = options.targetTag || 'target',
        _nodeLabelTag = options.labelTag || 'label',
        _edgeLabelTag = options.edgeLabelTag || _nodeLabelTag;

    let _sourceDown = null, _targetMove = null, _targetValid = false, _edgeLayer = null, _hintData = [], _crossout;

    function update_hint() {
        const data = _hintData.filter((h) => h.source && h.target);
        let line = _edgeLayer.selectAll('line.hint-edge').data(data);
        line.exit().remove();
        const lineEnter = line.enter().append('line')
            .attr('class', 'hint-edge')
            .attr('stroke', _mode.hintStroke())
            .style('fill', 'none')
            .style('pointer-events', 'none');
        
        line = lineEnter.merge(line);

        line.attr('x1', n => n.source.x)
            .attr('y1', n => n.source.y)
            .attr('x2', n => n.target.x)
            .attr('y2', n => n.target.y);
    }

    function port_pos(p) {
        const style = _mode.parent().portStyle(_mode.parent().portStyleName.eval(p));
        const pos = style.portPosition(p);
        pos.x += p.node.cola.x;
        pos.y += p.node.cola.y;
        return pos;
    }

    function update_crossout() {
        let data;
        if(_crossout) {
            if(_mode.usePorts())
                data = [port_pos(_crossout)];
            else
                data = [{x: _crossout.node.cola.x, y: _crossout.node.cola.y}];
        }
        else data = [];

        const size = _mode.crossSize(), wid = _mode.crossWidth();
        let cross = _edgeLayer.selectAll('polygon.graph-draw-crossout').data(data);
        cross.exit().remove();
        const crossEnter = cross.enter().append('polygon')
            .attr('class', 'graph-draw-crossout');
        cross = cross.merge(crossEnter);
        cross
            .attr('points', (d) => {
                const x = d.x, y = d.y;
                return [
                    [x-size/2, y+size/2], [x-size/2+wid, y+size/2], [x, y+wid/2],
                    [x+size/2-wid, y+size/2], [x+size/2, y+size/2], [x+wid/2, y],
                    [x+size/2, y-size/2], [x+size/2-wid, y-size/2], [x, y-wid/2],
                    [x-size/2+wid, y-size/2], [x-size/2, y-size/2], [x-wid/2, y]
                ]
                    .map((p) => p.join(','))
                    .join(' ');
            });
    }
    function erase_hint() {
        _hintData = [];
        _targetValid = false;
        _sourceDown = _targetMove = null;
        update_hint();
    }

    function create_node(diagram, pos, data) {
        if(!_mode.nodeCrossfilter())
            throw new Error('need nodeCrossfilter');
        let node;
        const callback = _mode.addNode() || promiseIdentity;
        if(data)
            node = data;
        else {
            node = {};
            node[_nodeIdTag] = uuid();
            node[_nodeLabelTag] = '';
        }
        if(pos)
            fix_nodes_group.call('new_node', null, node[_nodeIdTag], node, {x: pos[0], y: pos[1]});
        callback(node).then((node2) => {
            if(!node2)
                return;
            _mode.nodeCrossfilter().add([node2]);
            diagram.redrawGroup();
            select_nodes_group.call('set_changed', null, [node2[_nodeIdTag]]);
        });
    }

    function create_edge(diagram, source, target) {
        if(!_mode.edgeCrossfilter())
            throw new Error('need edgeCrossfilter');
        const edge = {}, callback = _mode.addEdge() || promiseIdentity;
        edge[_edgeIdTag] = uuid();
        edge[_edgeLabelTag] = '';
        if(_mode.conduct().detectReversedEdge && _mode.conduct().detectReversedEdge(edge, source.port, target.port)) {
            edge[_sourceTag] = target.node.orig.key;
            edge[_targetTag] = source.node.orig.key;
            const t = source;
            source = target; target = t;
        } else {
            edge[_sourceTag] = source.node.orig.key;
            edge[_targetTag] = target.node.orig.key;
        }
        callback(edge, source.port, target.port).then((edge2) => {
            if(!edge2)
                return;
            fix_nodes_group.call('new_edge', null, edge[_edgeIdTag], edge2[_sourceTag], edge2[_targetTag]);
            _mode.edgeCrossfilter().add([edge2]);
            select_nodes_group.call('set_changed', null, [], false);
            select_edges_group.call('set_changed', null, [edge2[_edgeIdTag]], false);
            diagram.redrawGroup();
        });
    }

    function check_invalid_drag(coords, event) {
        let msg;
        if(!(event.buttons & 1)) {
            // mouse button was released but we missed it
            _crossout = null;
            if(_mode.conduct().cancelDragEdge)
                _mode.conduct().cancelDragEdge(_sourceDown);
            erase_hint();
            update_crossout();
            return true;
        }
        if(!_sourceDown.started && Math.hypot(coords[0] - _hintData[0].source.x, coords[1] - _hintData[0].source.y) > _mode.dragSize()) {
            if(_mode.conduct().startDragEdge) {
                if(_mode.conduct().startDragEdge(_sourceDown)) {
                    _sourceDown.started = true;
                } else {
                    if(_mode.conduct().invalidSourceMessage) {
                        msg = _mode.conduct().invalidSourceMessage(_sourceDown);
                        if(options.negativeTip) {
                            options.negativeTip
                                .content(() => msg)
                                .displayTip(_mode.usePorts() ? _sourceDown.port : _sourceDown.node);
                        }
                    }
                    erase_hint();
                    return true;
                }
            }
        }
        return false;
    }

    function draw(diagram, node, _edge, _ehover) {
        const select_nodes = diagram.child('select-nodes');
        if(select_nodes) {
            if(_mode.clickCreatesNodes())
                select_nodes.clickBackgroundClears(false);
        }
        node
            .on('mousedown.draw-graphs', (n) => {
                d3Event.stopPropagation();
                if(!_mode.dragCreatesEdges())
                    return;
                if(options.tipsDisable)
                    options.tipsDisable.forEach((tip) => {
                        tip
                            .hideTip()
                            .disabled(true);
                    });
                if(_mode.usePorts()) {
                    let activePort;
                    if(typeof _mode.usePorts() === 'object' && _mode.usePorts().eventPort)
                        activePort = _mode.usePorts().eventPort(d3Event);
                    else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'out')
                        || diagram.getPort(diagram.nodeKey.eval(n), null, 'in');
                    if(!activePort)
                        return;
                    _sourceDown = {node: n, port: activePort};
                    _hintData = [{source: port_pos(activePort)}];
                } else {
                    _sourceDown = {node: n};
                    _hintData = [{source: {x: _sourceDown.node.cola.x, y: _sourceDown.node.cola.y}}];
                }
            })
            .on('mousemove.draw-graphs', (n) => {
                let msg;
                d3Event.stopPropagation();
                if(_sourceDown) {
                    const coords = eventCoords(diagram, d3Event);
                    if(check_invalid_drag(coords, d3Event))
                        return;
                    const oldTarget = _targetMove;
                    if(n === _sourceDown.node) {
                        _mode.conduct().invalidTargetMessage &&
                            console.log(_mode.conduct().invalidTargetMessage(_sourceDown, _sourceDown));
                        _targetMove = null;
                        _hintData[0].target = null;
                    }
                    else if(_mode.usePorts()) {
                        let activePort;
                        if(typeof _mode.usePorts() === 'object' && _mode.usePorts().eventPort)
                            activePort = _mode.usePorts().eventPort(d3Event);
                        else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'in')
                            || diagram.getPort(diagram.nodeKey.eval(n), null, 'out');
                        if(activePort)
                            _targetMove = {node: n, port: activePort};
                        else
                            _targetMove = null;
                    } else if(!_targetMove || n !== _targetMove.node) {
                        _targetMove = {node: n};
                    }
                    if(_mode.conduct().changeDragTarget) {
                        let change;
                        if(_mode.usePorts()) {
                            const oldPort = oldTarget && oldTarget.port,
                                newPort = _targetMove && _targetMove.port;
                            change = oldPort !== newPort;
                        } else {
                            const oldNode = oldTarget && oldTarget.node,
                                newNode = _targetMove && _targetMove.node;
                             change = oldNode !== newNode;
                        }
                        if(change)
                            if(_mode.conduct().changeDragTarget(_sourceDown, _targetMove)) {
                                _crossout = null;
                                if(options.negativeTip)
                                    options.negativeTip.hideTip();
                                msg = _mode.conduct().validTargetMessage && _mode.conduct().validTargetMessage() ||
                                    'matches';
                                if(options.positiveTip) {
                                    options.positiveTip
                                        .content(() => msg)
                                        .displayTip(_mode.usePorts() ? _targetMove.port : _targetMove.node);
                                }
                                _targetValid = true;
                            } else {
                                _crossout = _mode.usePorts() ?
                                    _targetMove && _targetMove.port :
                                    _targetMove && _targetMove.node;
                                if(_targetMove && _mode.conduct().invalidTargetMessage) {
                                    if(options.positiveTip)
                                        options.positiveTip.hideTip();
                                    msg = _mode.conduct().invalidTargetMessage(_sourceDown, _targetMove);
                                                if(options.negativeTip) {
                                        options.negativeTip
                                            .content(() => msg)
                                            .displayTip(_mode.usePorts() ? _targetMove.port : _targetMove.node);
                                    }
                                }
                                _targetValid = false;
                            }
                    } else _targetValid = true;
                    if(_targetMove) {
                        if(_targetMove.port)
                            _hintData[0].target = port_pos(_targetMove.port);
                        else
                            _hintData[0].target = {x: n.cola.x, y: n.cola.y};
                    }
                    else {
                        _hintData[0].target = {x: coords[0], y: coords[1]};
                    }
                    update_hint();
                    update_crossout();
                }
            })
            .on('mouseup.draw-graphs', (_n) => {
                _crossout = null;
                if(options.negativeTip)
                    options.negativeTip.hideTip(true);
                if(options.positiveTip)
                    options.positiveTip.hideTip(true);
                if(options.tipsDisable)
                    options.tipsDisable.forEach((tip) => {
                        tip.disabled(false);
                    });
                if(_sourceDown && _targetValid) {
                    let finishPromise;
                    if(_mode.conduct().finishDragEdge)
                        finishPromise = _mode.conduct().finishDragEdge(_sourceDown, _targetMove);
                    else finishPromise = Promise.resolve(true);
                    const source = _sourceDown, target = _targetMove;
                    finishPromise.then((ok) => {
                        if(ok)
                            create_edge(diagram, source, target);
                    });
                }
                else if(_sourceDown) {
                    if(_mode.conduct().cancelDragEdge)
                        _mode.conduct().cancelDragEdge(_sourceDown);
                }
                erase_hint();
                update_crossout();
            });
        
        diagram.svg()
            .on('mousedown.draw-graphs', () => {
                _sourceDown = null;
            })
            .on('mousemove.draw-graphs', () => {
                const _data = [];
                if(_sourceDown) { // drawing edge
                    const coords = eventCoords(diagram, d3Event);
                    _crossout = null;
                    if(check_invalid_drag(coords, d3Event))
                        return;
                    if(_mode.conduct().dragCanvas)
                        _mode.conduct().dragCanvas(_sourceDown, coords);
                    if(_mode.conduct().changeDragTarget && _targetMove)
                        _mode.conduct().changeDragTarget(_sourceDown, null);
                    _targetMove = null;
                    _hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                    update_crossout();
                }
            })
            .on('mouseup.draw-graphs', () => {
                _crossout = null;
                if(options.negativeTip)
                    options.negativeTip.hideTip(true);
                if(options.positiveTip)
                    options.positiveTip.hideTip(true);
                if(options.tipsDisable)
                    options.tipsDisable.forEach((tip) => {
                        tip.disabled(false);
                    });
                if(_sourceDown) { // drag-edge
                    if(_mode.conduct().cancelDragEdge)
                        _mode.conduct().cancelDragEdge(_sourceDown);
                    erase_hint();
                } else { // click-node
                    if(d3Event.target === d3Event.currentTarget && _mode.clickCreatesNodes())
                        create_node(diagram, eventCoords(diagram, d3Event));
                }
                update_crossout();
            });
        const diagramG = diagram.g();
        
        const edgeLayerSelection = diagramG.selectAll('g.draw-graphs')
            .data([1]);
        _edgeLayer = edgeLayerSelection.enter().append('g')
            .attr('class', 'draw-graphs')
            .merge(edgeLayerSelection);
    }

    function remove(diagram, node, _edge, _ehover) {
        node
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
        diagram.svg()
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
    }

    const _mode = mode('highlight-paths', {
        draw,
        remove
    });

    // update the data source/destination
    _mode.nodeCrossfilter = property(options.nodeCrossfilter);
    _mode.edgeCrossfilter = property(options.edgeCrossfilter);

    // modeal options
    _mode.usePorts = property(null);
    _mode.clickCreatesNodes = property(true);
    _mode.dragCreatesEdges = property(true);
    _mode.dragSize = property(5);

    // draw attributes of indicator for failed edge
    _mode.crossSize = property(15);
    _mode.crossWidth = property(5);
    
    // hint line stroke color
    _mode.hintStroke = property('black');

    // really this is a behavior or strategy
    _mode.conduct = property({});

    // callbacks to modify data as it's being added
    // as of 0.6, function returns a promise of the new data
    _mode.addNode = property(null); // node -> promise(node2)
    _mode.addEdge = property(null); // edge, sourceport, targetport -> promise(edge2)

    // or, if you want to drive..
    _mode.createNode = function(pos, data) {
        create_node(_mode.parent(), pos, data);
    };

    return _mode;
};

