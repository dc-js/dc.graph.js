import { select, selectAll } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { edgeArrow, placeArrowsOnSpline, unsurprisingOrient } from './arrows.js';
import { identity, property } from './core.js';
import { keyboard as keyboardMode } from './keyboard.js';
import {
    asBezier3,
    fitShape,
    inferShape,
    isOneSegment,
    shapeChanged,
    splitBezierN,
} from './shape.js';
import { compose, generatePath } from './utils.js';

export function renderSvg() {
    let _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    let _animating = false; // do not refresh during animations
    let _zoom;
    const _renderer = {};

    _renderer.rendererType = function() {
        return 'svg';
    };

    _renderer.parent = property(null);

    _renderer.renderNode = _renderer._enterNode = function(nodeEnter) {
        if (_renderer.parent().nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(inferShape(_renderer.parent()));
        _renderer.parent().forEachShape(nodeEnter, (shape, node) => {
            node.call(shape.create);
        });
        return _renderer;
    };
    _renderer.redrawNode = _renderer._updateNode = function(node) {
        const changedShape = node.filter(shapeChanged(_renderer.parent()));
        changedShape.selectAll('.node-outline,.node-fill').remove();
        changedShape.each(inferShape(_renderer.parent()));
        _renderer.parent().forEachShape(changedShape, (shape, node) => {
            node.call(shape.create);
        });
        node.select('title')
            .text(_renderer.parent().nodeTitle.eval);
        _renderer.parent().forEachContent(node, (contentType, node) => {
            node.call(contentType.update);
            _renderer.parent().forEachShape(contentType.selectContent(node), (shape, content) => {
                content
                    .call(fitShape(shape, _renderer.parent()));
            });
        });
        // Ensure nodes without content also get their dimensions calculated
        const nodesWithoutContent = node.filter(n => !_renderer.parent().nodeContent.eval(n));
        _renderer.parent().forEachShape(nodesWithoutContent, (shape, node) => {
            node.call(fitShape(shape, _renderer.parent()));
        });
        _renderer.parent().forEachShape(node, (shape, node) => {
            node.call(shape.update);
        });
        node.select('.node-fill')
            .attr(
                'fill',
                compose(
                    _renderer.parent().nodeFillScale() || identity,
                    _renderer.parent().nodeFill.eval,
                ),
            );
        node.select('.node-outline')
            .attr('stroke', _renderer.parent().nodeStroke.eval)
            .attr('stroke-width', _renderer.parent().nodeStrokeWidth.eval)
            .attr('stroke-dasharray', _renderer.parent().nodeStrokeDashArray.eval);
        return _renderer;
    };
    _renderer.redrawEdge = _renderer._updateEdge = function(edge, edgeArrows) {
        edge
            .attr('stroke', _renderer.parent().edgeStroke.eval)
            .attr('stroke-width', _renderer.parent().edgeStrokeWidth.eval)
            .attr('stroke-dasharray', _renderer.parent().edgeStrokeDashArray.eval);
        edgeArrows
            .attr('marker-end', e => {
                const name = _renderer.parent().edgeArrowhead.eval(e),
                    id = edgeArrow(
                        _renderer.parent(),
                        _renderer.parent().arrows(),
                        e,
                        'head',
                        name,
                    );
                return id ? `url(#${id})` : null;
            })
            .attr('marker-start', e => {
                const name = _renderer.parent().edgeArrowtail.eval(e),
                    arrow_id = edgeArrow(
                        _renderer.parent(),
                        _renderer.parent().arrows(),
                        e,
                        'tail',
                        name,
                    );
                return name ? `url(#${arrow_id})` : null;
            })
            .each(e => {
                const _fillEdgeStroke = _renderer.parent().edgeStroke.eval(e);
                _renderer.selectAll(`#${_renderer.parent().arrowId(e, 'head')}`)
                    .attr('fill', _renderer.parent().edgeStroke.eval(e));
                _renderer.selectAll(`#${_renderer.parent().arrowId(e, 'tail')}`)
                    .attr('fill', _renderer.parent().edgeStroke.eval(e));
            });
    };

    _renderer.selectAllNodes = function(selector) {
        selector = selector || '.node';
        return _nodeLayer && _nodeLayer.selectAll(selector).filter(n => !n.deleted)
            || selectAll('.foo-this-does-not-exist');
    };

    _renderer.selectAllEdges = function(selector) {
        selector = selector || '.edge';
        return _edgeLayer && _edgeLayer.selectAll(selector).filter(e => !e.deleted)
            || selectAll('.foo-this-does-not-exist');
    };

    _renderer.selectAllDefs = function(selector) {
        return _defs && _defs.selectAll(selector).filter(def => !def.deleted)
            || selectAll('.foo-this-does-not-exist');
    };

    _renderer.resize = function(w, h) {
        if (_svg) {
            _svg.attr(
                'width',
                w
                    || (_renderer.parent().width_is_automatic()
                        ? '100%'
                        : _renderer.parent().width()),
            )
                .attr(
                    'height',
                    h || (_renderer.parent().height_is_automatic()
                        ? '100%'
                        : _renderer.parent().height()),
                );
        }
        return _renderer;
    };

    _renderer.rezoom = function(oldWidth, oldHeight, newWidth, newHeight) {
        const currentTransform = zoomTransform(_svg.node());
        const scale = currentTransform.k, translate = [currentTransform.x, currentTransform.y];
        _svg.call(_zoom.transform, zoomIdentity);
        const xDomain = _renderer.parent().x().domain(), yDomain = _renderer.parent().y().domain();
        _renderer.parent().x()
            .domain([xDomain[0], xDomain[0]+(xDomain[1]-xDomain[0])*newWidth/oldWidth])
            .range([0, newWidth]);
        _renderer.parent().y()
            .domain([yDomain[0], yDomain[0]+(yDomain[1]-yDomain[0])*newHeight/oldHeight])
            .range([0, newHeight]);
        // D3 v5: apply the transform directly instead of using .x()/.y() methods
        _svg.call(_zoom.transform, zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    };

    _renderer.globalTransform = function(pos, scale, animate) {
        // _translate = pos;
        // _scale = scale;
        let obj = _g;
        if (animate)
            obj = _g.transition().duration(_renderer.parent().zoomDuration());
        obj.attr('transform', `translate(${pos})`+` scale(${scale})`);
    };

    _renderer.translate = function(_) {
        if (!arguments.length) {
            const transform = zoomTransform(_svg.node());
            return [transform.x, transform.y];
        }
        const currentTransform = zoomTransform(_svg.node());
        _svg.call(_zoom.transform, zoomIdentity.translate(_[0], _[1]).scale(currentTransform.k));
        return this;
    };

    _renderer.scale = function(_) {
        if (!arguments.length) {
            if (!_zoom) return 1;
            const transform = zoomTransform(_svg.node());
            return transform.k;
        }
        const currentTransform = zoomTransform(_svg.node());
        _svg.call(
            _zoom.transform,
            zoomIdentity.translate(currentTransform.x, currentTransform.y).scale(_),
        );
        return this;
    };

    _renderer.commitTranslateScale = function() {
        return this;
    };

    _renderer.zoom = function(_) {
        if (!arguments.length)
            return _zoom;
        _zoom = _; // is this a good idea?
        return _renderer;
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        // create edge SVG elements
        let edge = _edgeLayer.selectAll('.edge')
            .data(wedges, _renderer.parent().edgeKey.eval);

        const edgeExit = edge.exit();
        edgeExit.each(e => {
            e.deleted = true;
        });
        const duration = _renderer.parent().stagedDuration();
        if (duration === 0) {
            edgeExit.remove();
        } else {
            edgeExit.transition()
                .duration(duration)
                .delay(_renderer.parent().deleteDelay())
                .attr('opacity', 0)
                .on('end', function() {
                    console.log('render_svg: transition end, removing edge element');
                    select(this).remove();
                });
        }

        // Handle enter selection
        const edgeEnter = edge.enter().append('svg:path')
            .attr('class', 'edge')
            .attr('id', _renderer.parent().edgeId)
            .attr('opacity', 0)
            .each(e => {
                e.deleted = false;
            });

        edge = edge.merge(edgeEnter);

        let edgeArrows = _edgeLayer.selectAll('.edge-arrows')
            .data(wedges, _renderer.parent().edgeKey.eval);
        const edgeArrowsEnter = edgeArrows.enter().append('svg:path')
            .attr('class', 'edge-arrows')
            .attr('id', d => `${_renderer.parent().edgeId(d)}-arrows`)
            .attr('fill', 'none')
            .attr('opacity', 0);
        const edgeArrowsExit = edgeArrows.exit();
        edgeArrowsExit.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .on('end', function(e) {
                edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'head', null);
                edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'tail', null);
                select(this).remove();
            });
        if (_renderer.parent().stagedDuration() === 0) {
            edgeArrowsExit.remove();
        }
        edgeArrows = edgeArrows.merge(edgeArrowsEnter);

        if (_renderer.parent().edgeSort()) {
            edge.sort((a, b) => {
                const as = _renderer.parent().edgeSort.eval(a),
                    bs = _renderer.parent().edgeSort.eval(b);
                return as < bs ? -1 : bs < as ? 1 : 0;
            });
        }

        // another wider copy of the edge just for hover events
        let edgeHover = _edgeLayer.selectAll('.edge-hover')
            .data(wedges, _renderer.parent().edgeKey.eval);
        const edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('fill', 'none')
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover.diagram', e => {
                _renderer.select(`#${_renderer.parent().edgeId(e)}-label`)
                    .attr('visibility', 'visible');
            })
            .on('mouseout.diagram', e => {
                _renderer.select(`#${_renderer.parent().edgeId(e)}-label`)
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();
        edgeHover = edgeHover.merge(edgeHoverEnter);

        let edgeLabels = _edgeLayer.selectAll('g.edge-label-wrapper')
            .data(wedges, _renderer.parent().edgeKey.eval);
        const edgeLabelsEnter = edgeLabels.enter()
            .append('g')
            .attr('class', 'edge-label-wrapper')
            .attr('visibility', 'hidden')
            .attr('id', e => `${_renderer.parent().edgeId(e)}-label`);
        const edgeLabelsExit = edgeLabels.exit();
        edgeLabelsExit.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .on('end', function() {
                select(this).remove();
            });
        if (_renderer.parent().stagedDuration() === 0) {
            edgeLabelsExit.remove();
        }
        edgeLabels = edgeLabels.merge(edgeLabelsEnter);

        let textPaths = _defs.selectAll('path.edge-label-path')
            .data(wedges, _renderer.parent().textpathId);
        const textPathsEnter = textPaths.enter()
            .append('svg:path')
            .attr('class', 'edge-label-path')
            .attr('id', _renderer.parent().textpathId);
        textPaths.exit().remove();
        textPaths = textPaths.merge(textPathsEnter);

        // create node SVG elements
        let node = _nodeLayer.selectAll('.node')
            .data(wnodes, _renderer.parent().nodeKey.eval);
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('opacity', '0') // don't show until has layout
            .each(n => {
                n.deleted = false;
            });
        const nodeExit = node.exit().each(n => {
            n.deleted = true;
        });
        nodeExit.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .on('end', function() {
                select(this).remove();
            });
        if (_renderer.parent().stagedDuration() === 0) {
            nodeExit.remove();
        }
        node = node.merge(nodeEnter);
        // .call(_d3cola.drag);

        _renderer.renderNode(nodeEnter);

        dispatch.call('drawn', null, node, edge, edgeHover);

        const drawState = {
            node,
            nodeEnter,
            edge,
            edgeEnter,
            edgeHover,
            edgeHoverEnter,
            edgeLabels,
            edgeLabelsEnter,
            edgeArrows,
            edgeArrowsEnter,
            textPaths,
            textPathsEnter,
        };

        _refresh(drawState);

        return drawState;
    };

    function _refresh(drawState) {
        _renderer.redrawEdge(drawState.edge, drawState.edgeArrows);
        _renderer.redrawNode(drawState.node);
        _renderer.drawPorts(drawState);
    }

    _renderer.refresh = function(node, edge, edgeHover, edgeLabels, textPaths) {
        if (_animating)
            return this; // but what about changed attributes?
        node = node || _renderer.selectAllNodes();
        edge = edge || _renderer.selectAllEdges();
        const edgeArrows = _renderer.selectAllEdges('.edge-arrows');
        _refresh({node, edge, edgeArrows});

        edgeHover = edgeHover || _renderer.selectAllEdges('.edge-hover');
        edgeLabels = edgeLabels || _renderer.selectAllEdges('.edge-label-wrapper');
        textPaths = textPaths || _renderer.selectAllDefs('path.edge-label-path');
        const nullSel = select(null); // no enters
        draw(
            node,
            nullSel,
            edge,
            nullSel,
            edgeHover,
            nullSel,
            edgeLabels,
            nullSel,
            edgeArrows,
            nullSel,
            textPaths,
            nullSel,
            false,
        );
        return this;
    };

    _renderer.reposition = function(node, edge) {
        node
            .attr('transform', n => `translate(${n.cola.x},${n.cola.y})`);
        // reset edge ports
        edge.each(e => {
            e.pos.new = null;
            e.pos.old = null;
            e.cola.points = null;
            _renderer.parent().calcEdgePath(
                e,
                'new',
                e.source.cola.x,
                e.source.cola.y,
                e.target.cola.x,
                e.target.cola.y,
            );
            if (_renderer.parent().edgeArrowhead.eval(e))
                _renderer.select(`#${_renderer.parent().arrowId(e, 'head')}`)
                    .attr('orient', () => e.pos.new.orienthead);
            if (_renderer.parent().edgeArrowtail.eval(e))
                _renderer.select(`#${_renderer.parent().arrowId(e, 'tail')}`)
                    .attr('orient', () => e.pos.new.orienttail);
            _renderer.select(`#${_renderer.parent().edgeId(e)}-arrows`)
                .attr('d', generate_edge_path('new', true));
        })
            .attr('d', generate_edge_path('new'));
        return this;
    };

    function generate_edge_path(age, full) {
        const field = full ? 'full' : 'path';
        return function(e) {
            const path = e.pos?.[age]?.[field];
            if (!path) return '';
            return generatePath(path.points, path.bezDegree);
        };
    }

    function generate_edge_label_path(age) {
        return function(e) {
            const path = e.pos?.[age]?.path;
            if (!path) return '';
            const points = path.points[path.points.length-1].x < path.points[0].x
                ? path.points.slice(0).reverse()
                : path.points;
            return generatePath(points, path.bezDegree);
        };
    }

    function with_rad(f) {
        return function() {
            return `${f.apply(this, arguments)}rad`;
        };
    }

    function unsurprising_orient_rad(oldorient, neworient) {
        return with_rad(unsurprisingOrient)(oldorient, neworient);
    }

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    _renderer.draw = function(drawState, animatePositions) {
        draw(
            drawState.node,
            drawState.nodeEnter,
            drawState.edge,
            drawState.edgeEnter,
            drawState.edgeHover,
            drawState.edgeHoverEnter,
            drawState.edgeLabels,
            drawState.edgeLabelsEnter,
            drawState.edgeArrows,
            drawState.edgeArrowsEnter,
            drawState.textPaths,
            drawState.textPathsEnter,
            animatePositions,
        );
    };

    function draw(
        node,
        nodeEnter,
        edge,
        edgeEnter,
        edgeHover,
        edgeHoverEnter,
        edgeLabels,
        edgeLabelsEnter,
        edgeArrows,
        edgeArrowsEnter,
        textPaths,
        textPathsEnter,
        animatePositions,
    ) {
        console.assert(edge.data().every(has_source_and_target));

        const nodeEntered = {};
        nodeEnter
            .each(n => {
                nodeEntered[_renderer.parent().nodeKey.eval(n)] = true;
            })
            .attr('transform', n =>
                // start new nodes at their final position
                `translate(${n.cola.x},${n.cola.y})`);
        const ntrans = node
            .transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(n =>
                _renderer.parent().stagedDelay(nodeEntered[_renderer.parent().nodeKey.eval(n)])
            )
            .attr('opacity', _renderer.parent().nodeOpacity.eval);
        if (animatePositions)
            ntrans
                .attr('transform', n => `translate(${n.cola.x},${n.cola.y})`)
                .on('end.record', n => {
                    n.prevX = n.cola.x;
                    n.prevY = n.cola.y;
                });

        // recalculate edge positions
        edge.each(e => {
            e.pos.new = null;
        });
        edge.each(e => {
            if (e.cola.points) {
                e.pos.new = placeArrowsOnSpline(_renderer.parent(), e, e.cola.points);
            } else {
                if (!e.pos.old)
                    _renderer.parent().calcEdgePath(
                        e,
                        'old',
                        e.source.prevX || e.source.cola.x,
                        e.source.prevY || e.source.cola.y,
                        e.target.prevX || e.target.cola.x,
                        e.target.prevY || e.target.cola.y,
                    );
                if (!e.pos.new)
                    _renderer.parent().calcEdgePath(
                        e,
                        'new',
                        e.source.cola.x,
                        e.source.cola.y,
                        e.target.cola.x,
                        e.target.cola.y,
                    );
            }
            if (e.pos.old) {
                if (
                    e.pos.old.path.bezDegree !== e.pos.new.path.bezDegree
                    || e.pos.old.path.points.length !== e.pos.new.path.points.length
                ) {
                    // console.log('old', e.pos.old.path.points.length, 'new', e.pos.new.path.points.length);
                    if (isOneSegment(e.pos.old.path)) {
                        e.pos.new.path.points = asBezier3(e.pos.new.path);
                        e.pos.old.path.points = splitBezierN(
                            asBezier3(e.pos.old.path),
                            (e.pos.new.path.points.length-1)/3,
                        );
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    } else if (isOneSegment(e.pos.new.path)) {
                        e.pos.old.path.points = asBezier3(e.pos.old.path);
                        e.pos.new.path.points = splitBezierN(
                            asBezier3(e.pos.new.path),
                            (e.pos.old.path.points.length-1)/3,
                        );
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    } else console.warn("don't know how to interpolate two multi-segments");
                }
            } else
                e.pos.old = e.pos.new;
        });

        const edgeEntered = {};
        edgeEnter
            .each(e => {
                edgeEntered[_renderer.parent().edgeKey.eval(e)] = true;
            })
            .attr(
                'd',
                generate_edge_path(
                    _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old',
                ),
            );

        edgeArrowsEnter
            .each(e => {
                // if staging transitions, just fade new edges in at new position
                // else start new edges at old positions of nodes, if any, else new positions
                const age = _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old';
                if (_renderer.parent().edgeArrowhead.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'head')}`)
                        .attr('orient', () => e.pos[age].orienthead);
                if (_renderer.parent().edgeArrowtail.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'tail')}`)
                        .attr('orient', () => e.pos[age].orienttail);
            })
            .attr(
                'd',
                generate_edge_path(
                    _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old',
                    true,
                ),
            );

        edgeArrows
            .each(e => {
                if (_renderer.parent().edgeArrowhead.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'head')}`)
                        .attr(
                            'orient',
                            unsurprising_orient_rad(e.pos.old.orienthead, e.pos.new.orienthead),
                        )
                        .transition().duration(_renderer.parent().stagedDuration())
                        .delay(_renderer.parent().stagedDelay(false))
                        .attr('orient', () => e.pos.new.orienthead);
                if (_renderer.parent().edgeArrowtail.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'tail')}`)
                        .attr(
                            'orient',
                            unsurprising_orient_rad(e.pos.old.orienttail, e.pos.new.orienttail),
                        )
                        .transition().duration(_renderer.parent().stagedDuration())
                        .delay(_renderer.parent().stagedDelay(false))
                        .attr('orient', () => e.pos.new.orienttail);
            });

        let etrans = edge
            .transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(e =>
                _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)])
            )
            .attr('opacity', _renderer.parent().edgeOpacity.eval);
        const arrowtrans = edgeArrows
            .transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(e =>
                _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)])
            )
            .attr('opacity', _renderer.parent().edgeOpacity.eval);
        (animatePositions ? etrans : edge)
            .attr('d', e => {
                const when = _renderer.parent().stageTransitions() === 'insmod'
                        && edgeEntered[_renderer.parent().edgeKey.eval(e)]
                    ? 'old'
                    : 'new';
                return generate_edge_path(when)(e);
            });
        (animatePositions ? arrowtrans : edgeArrows)
            .attr('d', e => {
                const when = _renderer.parent().stageTransitions() === 'insmod'
                        && edgeEntered[_renderer.parent().edgeKey.eval(e)]
                    ? 'old'
                    : 'new';
                return generate_edge_path(when, true)(e);
            });
        const elabels = edgeLabels
            .selectAll('text').data(e => {
                const labels = _renderer.parent().edgeLabel.eval(e);
                if (!labels)
                    return [];
                else if (typeof labels === 'string')
                    return [labels];
                else return labels;
            });
        elabels.enter()
            .append('text')
            .attr('class', 'edge-label')
            .attr('text-anchor', 'middle')
            .attr('dy', function(_, i) {
                return i*_renderer.parent().edgeLabelSpacing.eval(this.parentNode)-2;
            })
            .append('textPath')
            .attr('startOffset', '50%');
        elabels
            .select('textPath')
            .html(t => t)
            .attr('opacity', function() {
                return _renderer.parent().edgeOpacity.eval(
                    select(this.parentNode.parentNode).datum(),
                );
            })
            .attr('xlink:href', function(_e) {
                const id = _renderer.parent().textpathId(
                    select(this.parentNode.parentNode).datum(),
                );
                // angular on firefox needs absolute paths for fragments
                return `${window.location.href.split('#')[0]}#${id}`;
            });
        textPathsEnter
            .attr(
                'd',
                generate_edge_label_path(
                    _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old',
                ),
            );
        let textTrans = textPaths.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(e =>
                _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)])
            );
        if (animatePositions)
            textTrans
                .attr('d', e => {
                    const when = _renderer.parent().stageTransitions() === 'insmod'
                            && edgeEntered[_renderer.parent().edgeKey.eval(e)]
                        ? 'old'
                        : 'new';
                    return generate_edge_label_path(when)(e);
                });
        if (_renderer.parent().stageTransitions() === 'insmod' && animatePositions) {
            // inserted edges transition twice in insmod mode
            if (_renderer.parent().stagedDuration() >= 50) {
                etrans = etrans.transition()
                    .duration(_renderer.parent().stagedDuration())
                    .attr('d', generate_edge_path('new'));
                textTrans = textTrans.transition()
                    .duration(_renderer.parent().stagedDuration())
                    .attr('d', generate_edge_label_path('new'));
                arrowtrans.transition()
                    .duration(_renderer.parent().stagedDuration())
                    .attr('d', generate_edge_path('new', true));
            } else {
                // if transitions are too short, we run into various problems,
                // from transitions not completing to objects not found
                // so don't try to chain in that case
                // this also helped once: d3.timer.flush();
                etrans
                    .attr('d', generate_edge_path('new'));
                textTrans
                    .attr('d', generate_edge_path('new'));
                arrowtrans
                    .attr('d', generate_edge_path('new', true));
            }
        }

        // signal layout done when all transitions complete
        // because otherwise client might start another layout and lock the processor
        _animating = true;
        if (!_renderer.parent().showLayoutSteps())
            endall([ntrans, etrans, textTrans], () => {
                _animating = false;
                _renderer.parent().layoutDone(true);
            });

        if (animatePositions)
            edgeHover.attr('d', generate_edge_path('new'));

        edge.each(e => {
            e.pos.old = e.pos.new;
        });
    }

    // wait on multiple transitions, adapted from
    // http://stackoverflow.com/questions/10692100/invoke-a-callback-at-the-end-of-a-transition
    function endall(transitions, callback) {
        if (transitions.every(transition => transition.size() === 0))
            callback();
        let n = 0;
        transitions.forEach(transition => {
            transition
                .each(() => {
                    ++n;
                })
                .on('end.all', () => {
                    if (!--n) callback();
                });
        });
    }

    _renderer.isRendered = function() {
        return !!_svg;
    };

    _renderer.initializeDrawing = function() {
        _renderer.resetSvg();
        _g = _svg.selectAll('g.draw')
            .data([1])
            .enter().append('g')
            .attr('class', 'draw');

        const layers = ['edge-layer', 'node-layer'];
        if (_renderer.parent().edgesInFront())
            layers.reverse();
        _g.selectAll('g').data(layers)
            .enter().append('g')
            .attr('class', l => l);
        _edgeLayer = _g.selectAll('g.edge-layer');
        _nodeLayer = _g.selectAll('g.node-layer');
        return this;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Execute a d3 single selection in the diagram's scope using the given selector
     * and return the d3 selection. Roughly the same as
     * ```js
     * d3.select('#diagram-id').select(selector)
     * ```
     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @method select
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     */
    _renderer.select = function(s) {
        return _renderer.parent().root().select(s);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Selects all elements that match the d3 single selector in the diagram's scope,
     * and return the d3 selection. Roughly the same as
     *
     * ```js
     * d3.select('#diagram-id').selectAll(selector)
     * ```
     *
     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @method selectAll
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     */
    _renderer.selectAll = function(s) {
        return _renderer.parent().root() ? _renderer.parent().root().selectAll(s) : null;
    };

    _renderer.selectNodePortsOfStyle = function(node, style) {
        return node.selectAll('g.port').filter(p =>
            _renderer.parent().portStyleName.eval(p) === style
        );
    };

    _renderer.drawPorts = function(drawState) {
        const nodePorts = _renderer.parent().nodePorts();
        if (!nodePorts)
            return;
        _renderer.parent().portStyle.enum().forEach(style => {
            const nodePorts2 = {};
            for (const nid in nodePorts)
                nodePorts2[nid] = nodePorts[nid].filter(p =>
                    _renderer.parent().portStyleName.eval(p) === style
                );
            const port = _renderer.selectNodePortsOfStyle(drawState.node, style);
            _renderer.parent().portStyle(style).drawPorts(port, nodePorts2, drawState.node);
        });
    };

    _renderer.fireTSEvent = function(dispatch, drawState) {
        dispatch.call(
            'transitionsStarted',
            null,
            drawState.node,
            drawState.edge,
            drawState.edgeHover,
        );
    };

    _renderer.calculateBounds = function(drawState) {
        if (!drawState.node.size())
            return null;
        return _renderer.parent().calculateBounds(drawState.node.data(), drawState.edge.data());
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Returns the top `svg` element for this specific diagram. You can also pass in a new
     * svg element, but setting the svg element on a diagram may have unexpected consequences.
     * @method svg
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     */
    _renderer.svg = function(_) {
        if (!arguments.length) {
            return _svg;
        }
        _svg = _;
        return _renderer;
    };

    /**
     * Returns the top `g` element for this specific diagram. This method is usually used to
     * retrieve the g element in order to overlay custom svg drawing
     * programatically. **Caution**: The root g element is usually generated internally, and
     * resetting it might produce unpredictable results.
     * @method g
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}

     **/
    _renderer.g = function(_) {
        if (!arguments.length) {
            return _g;
        }
        _g = _;
        return _renderer;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Remove the diagram's SVG elements from the dom and recreate the container SVG
     * element.
     * @method resetSvg
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _renderer.resetSvg = function() {
        // we might be re-initialized in a div, in which case
        // we already have an <svg> element to delete
        const svg = _svg || _renderer.select('svg');
        svg.remove();
        _svg = null;
        // _renderer.parent().x(null).y(null);
        return generateSvg();
    };

    _renderer.addOrRemoveDef = function(id, whether, tag, onEnter) {
        const data = whether ? [0] : [];
        const sel = _defs.selectAll(`#${id}`).data(data);

        const selEnter = sel
            .enter().append(tag)
            .attr('id', id);
        if (selEnter.size() && onEnter)
            selEnter.call(onEnter);
        sel.exit().remove();
        return sel.merge(selEnter);
    };

    function generateSvg() {
        const root = _renderer.parent().root();
        _svg = root.selectAll('svg')
            .data([1])
            .enter().append('svg');
        _renderer.resize();

        _defs = _svg.selectAll('defs')
            .data([1])
            .enter().append('svg:defs');

        // for lack of a better place
        _renderer.addOrRemoveDef('node-clip-top', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1000)
                .attr('y', -1000)
                .attr('width', 2000)
                .attr('height', 1000);
        });
        _renderer.addOrRemoveDef('node-clip-bottom', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1000)
                .attr('y', 0)
                .attr('width', 2000)
                .attr('height', 1000);
        });
        _renderer.addOrRemoveDef('node-clip-left', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1000)
                .attr('y', -1000)
                .attr('width', 1000)
                .attr('height', 2000);
        });
        _renderer.addOrRemoveDef('node-clip-right', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', 0)
                .attr('y', -1000)
                .attr('width', 1000)
                .attr('height', 2000);
        });
        _renderer.addOrRemoveDef('node-clip-none', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0);
        });

        _zoom = zoom()
            .on('zoom.diagram', _renderer.parent().doZoom)
            .scaleExtent(_renderer.parent().zoomExtent());

        if (_renderer.parent().mouseZoomable()) {
            const _brush = _renderer.parent().child('brush');
            let keyboard = _renderer.parent().child('keyboard');
            if (!keyboard)
                _renderer.parent().child('keyboard', keyboard = keyboardMode());

            _zoom.filter(() => keyboard.modKeysMatch(_renderer.parent().modKeyZoom()));

            _svg.call(_zoom);
            _svg.on('dblclick.zoom', null);
        } else {
            _zoom.filter(() => false);
            _svg.call(_zoom);
        }

        return _svg;
    }

    _renderer.animating = function() {
        return _animating;
    };

    return _renderer;
}
