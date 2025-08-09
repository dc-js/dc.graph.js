/**
 * SVG rendering functionality for diagram
 * @module diagram/rendering
 */

import { select, selectAll } from 'd3-selection';
import { transition } from 'd3-transition';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { edgeArrow, placeArrowsOnSpline, unsurprisingOrient } from '../arrows.js';
import { identity, property } from '../core.js';
import { keyboard as keyboardMode } from '../keyboard.js';
import { textContents } from '../node_contents.js';
import {
    asBezier3,
    defaultShape,
    elaboratedRectangleShape,
    ellipseShape,
    fitShape,
    inferShape,
    isOneSegment,
    noShape,
    polygonShape,
    roundedRectangleShape,
    shapeChanged,
    splitBezierN,
} from '../shape.js';
import { compose, generatePath } from '../utils.js';

export function applyRendering(diagram) {
    // SVG rendering state
    let _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    let _animating = false; // do not refresh during animations
    let _zoom;

    // Standard shapes and content types are registered in core.js

    function rendererType() {
        return 'svg';
    }

    function renderNode(nodeEnter) {
        if (diagram.nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(inferShape(diagram));
        diagram.forEachShape(nodeEnter, (shape, node) => {
            node.call(shape.create);
        });
        return diagram;
    }

    function redrawNode(node) {
        const changedShape = node.filter(shapeChanged(diagram));
        changedShape.selectAll('.node-outline,.node-fill').remove();
        changedShape.each(inferShape(diagram));
        diagram.forEachShape(changedShape, (shape, node) => {
            node.call(shape.create);
        });
        node.select('title')
            .text(diagram.nodeTitle.eval);
        diagram.forEachContent(node, (contentType, node) => {
            // Fallback: if contentType is invalid, try to get text content directly
            if (!contentType || !contentType.update) {
                console.warn('contentType invalid, using fallback:', contentType);
                contentType = textContents();
                if (contentType && contentType.parent)
                    contentType.parent(diagram);
            }

            if (contentType && contentType.update) {
                node.call(contentType.update);
                if (contentType.selectContent) {
                    diagram.forEachShape(contentType.selectContent(node), (shape, content) => {
                        content.call(fitShape(shape, diagram));
                    });
                }
            }
        });
        // Ensure nodes without content also get their dimensions calculated
        const nodesWithoutContent = node.filter(n => !diagram.nodeContent.eval(n));
        diagram.forEachShape(nodesWithoutContent, (shape, node) => {
            node.call(fitShape(shape, diagram));
        });
        diagram.forEachShape(node, (shape, node) => {
            node.call(shape.update);
        });
        node.select('.node-fill')
            .attr(
                'fill',
                compose(
                    diagram.nodeFillScale() || identity,
                    diagram.nodeFill.eval,
                ),
            );
        node.select('.node-outline')
            .attr('stroke', diagram.nodeStroke.eval)
            .attr('stroke-width', diagram.nodeStrokeWidth.eval)
            .attr('stroke-dasharray', diagram.nodeStrokeDashArray.eval);
        return diagram;
    }

    function redrawEdge(edge, edgeArrows) {
        edge
            .attr('stroke', diagram.edgeStroke.eval)
            .attr('stroke-width', diagram.edgeStrokeWidth.eval)
            .attr('stroke-dasharray', diagram.edgeStrokeDashArray.eval);
        edgeArrows
            .attr('marker-end', e => {
                const name = diagram.edgeArrowhead.eval(e),
                    id = edgeArrow(
                        diagram,
                        diagram.arrows(),
                        e,
                        'head',
                        name,
                    );
                return id ? `url(#${id})` : null;
            })
            .attr('marker-start', e => {
                const name = diagram.edgeArrowtail.eval(e),
                    arrow_id = edgeArrow(
                        diagram,
                        diagram.arrows(),
                        e,
                        'tail',
                        name,
                    );
                return arrow_id ? `url(#${arrow_id})` : null;
            });
        return diagram;
    }

    function selectAllNodes(selector) {
        return _nodeLayer ? _nodeLayer.selectAll(selector || '.node') : selectAll(null);
    }

    function selectAllEdges(selector) {
        return _edgeLayer ? _edgeLayer.selectAll(selector || '.edge') : selectAll(null);
    }

    function selectAllDefs(selector) {
        return _defs ? _defs.selectAll(selector) : selectAll(null);
    }

    function resize(w, h) {
        if (_svg) {
            const ro = diagram.root();
            if (diagram.width() !== 'auto')
                _svg.attr('width', w || diagram.width());
            if (diagram.height() !== 'auto')
                _svg.attr('height', h || diagram.height());
            // apply margins
            if (ro) {
                const margin = diagram.margins();
                _svg.style('margin-left', `${margin.left}px`)
                    .style('margin-right', `${margin.right}px`)
                    .style('margin-top', `${margin.top}px`)
                    .style('margin-bottom', `${margin.bottom}px`);
            }
        }
        return diagram;
    }

    function rezoom(oldWidth, oldHeight, newWidth, newHeight) {
        if (!_svg || !_svg.node()) {
            return diagram;
        }
        const scale = Math.min(newWidth/oldWidth, newHeight/oldHeight);
        const dx = (newWidth-oldWidth*scale)/2;
        const dy = (newHeight-oldHeight*scale)/2;
        const transform = zoomTransform(_svg.node());
        const newTransform = zoomIdentity
            .translate(dx+transform.x*scale, dy+transform.y*scale)
            .scale(transform.k*scale);

        // Temporarily disable zoom event to prevent recursion
        const originalZoomHandler = _zoom.on('zoom.diagram');
        _zoom.on('zoom.diagram', null);
        _svg.call(_zoom.transform, newTransform);
        _zoom.on('zoom.diagram', originalZoomHandler);

        return diagram;
    }

    function globalTransform(pos, scale, animate) {
        if (!_g)
            return diagram;
        if (animate) {
            _g.transition().duration(diagram.zoomDuration())
                .attr('transform', `translate(${pos}) scale(${scale})`);
        } else {
            _g.attr('transform', `translate(${pos}) scale(${scale})`);
        }
        return diagram;
    }

    function translate(_) {
        if (!arguments.length) {
            const transform = zoomTransform(_g.node());
            return [transform.x, transform.y];
        }
        if (_g)
            _svg.call(_zoom.translateBy, _[0], _[1]);
        return diagram;
    }

    function scale(_) {
        if (!arguments.length) {
            const transform = zoomTransform(_g.node());
            return transform.k;
        }
        if (_g)
            _svg.call(_zoom.scaleBy, _);
        return diagram;
    }

    function commitTranslateScale() {
        return diagram;
    }

    function zoomBehavior(_) {
        if (!arguments.length)
            return _zoom;
        _zoom = _;
        return diagram;
    }

    function startRedraw(dispatch, wnodes, wedges) {
        // Ensure layers are initialized
        if (!_edgeLayer || !_nodeLayer) {
            diagram.initializeDrawing();
        }

        // create edge SVG elements
        let edge = _edgeLayer.selectAll('.edge')
            .data(wedges, diagram.edgeKey.eval);

        const edgeExit = edge.exit();
        edgeExit.each(e => {
            e.deleted = true;
        });
        const duration = diagram.stagedDuration ? diagram.stagedDuration() : 0;
        if (duration === 0) {
            edgeExit.remove();
        } else {
            edgeExit.transition()
                .duration(duration)
                .delay(diagram.deleteDelay ? diagram.deleteDelay() : 0)
                .attr('opacity', 0)
                .on('end', function() {
                    console.log('render_svg: transition end, removing edge element');
                    select(this).remove();
                });
        }

        // Handle enter selection
        const edgeEnter = edge.enter().append('svg:path')
            .attr('class', 'edge')
            .attr('id', diagram.edgeId || ((d, i) => `edge-${i}`))
            .attr('opacity', 0)
            .each(e => {
                e.deleted = false;
                e.pos = {};
            });

        edge = edge.merge(edgeEnter);

        let edgeArrows = _edgeLayer.selectAll('.edge-arrows')
            .data(wedges, diagram.edgeKey.eval);
        const edgeArrowsEnter = edgeArrows.enter().append('svg:path')
            .attr('class', 'edge-arrows')
            .attr('id', d => `${diagram.edgeId ? diagram.edgeId(d) : `edge-${d.key}`}-arrows`)
            .attr('fill', 'none')
            .attr('opacity', 0);
        const edgeArrowsExit = edgeArrows.exit();
        edgeArrowsExit.transition()
            .duration(duration)
            .delay(diagram.deleteDelay ? diagram.deleteDelay() : 0)
            .attr('opacity', 0)
            .on('end', function(e) {
                edgeArrow(diagram, diagram.arrows(), e, 'head', null);
                edgeArrow(diagram, diagram.arrows(), e, 'tail', null);
                select(this).remove();
            });
        if (duration === 0) {
            edgeArrowsExit.remove();
        }
        edgeArrows = edgeArrows.merge(edgeArrowsEnter);

        if (diagram.edgeSort && diagram.edgeSort()) {
            edge.sort((a, b) => {
                const as = diagram.edgeSort.eval(a),
                    bs = diagram.edgeSort.eval(b);
                return as < bs ? -1 : bs < as ? 1 : 0;
            });
        }

        // another wider copy of the edge just for hover events
        let edgeHover = _edgeLayer.selectAll('.edge-hover')
            .data(wedges, diagram.edgeKey.eval);
        const edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('fill', 'none')
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover.diagram', e => {
                selectElement(`#${diagram.edgeId ? diagram.edgeId(e) : `edge-${e.key}`}-label`)
                    .attr('visibility', 'visible');
            })
            .on('mouseout.diagram', e => {
                selectElement(`#${diagram.edgeId ? diagram.edgeId(e) : `edge-${e.key}`}-label`)
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();
        edgeHover = edgeHover.merge(edgeHoverEnter);

        let edgeLabels = _edgeLayer.selectAll('g.edge-label-wrapper')
            .data(wedges, diagram.edgeKey.eval);
        const edgeLabelsEnter = edgeLabels.enter()
            .append('g')
            .attr('class', 'edge-label-wrapper')
            .attr('visibility', 'hidden')
            .attr('id', e => `${diagram.edgeId ? diagram.edgeId(e) : `edge-${e.key}`}-label`);
        const edgeLabelsExit = edgeLabels.exit();
        edgeLabelsExit.transition()
            .duration(duration)
            .delay(diagram.deleteDelay ? diagram.deleteDelay() : 0)
            .attr('opacity', 0)
            .on('end', function() {
                select(this).remove();
            });
        if (duration === 0) {
            edgeLabelsExit.remove();
        }
        edgeLabels = edgeLabels.merge(edgeLabelsEnter);

        let textPaths = _defs.selectAll('path.edge-label-path')
            .data(wedges, diagram.textpathId || diagram.edgeKey.eval);
        const textPathsEnter = textPaths.enter()
            .append('svg:path')
            .attr('class', 'edge-label-path')
            .attr('id', diagram.textpathId || diagram.edgeKey.eval);
        textPaths.exit().remove();
        textPaths = textPaths.merge(textPathsEnter);

        // create node SVG elements
        let node = _nodeLayer.selectAll('.node')
            .data(wnodes, diagram.nodeKey.eval);
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
            .duration(duration)
            .delay(diagram.deleteDelay ? diagram.deleteDelay() : 0)
            .attr('opacity', 0)
            .on('end', function() {
                select(this).remove();
            });
        if (duration === 0) {
            nodeExit.remove();
        }
        node = node.merge(nodeEnter);

        renderNode(nodeEnter);

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

        refresh(drawState);
        return drawState;
    }

    function refresh(drawState) {
        redrawEdge(drawState.edge, drawState.edgeArrows);
        redrawNode(drawState.node);
        drawPorts(drawState);
    }

    function refreshPublic(node, edge, edgeHover, edgeLabels, textPaths) {
        if (_animating)
            return diagram; // but what about changed attributes?
        node = node || selectAllNodes();
        edge = edge || selectAllEdges();
        const edgeArrows = selectAllEdges('.edge-arrows');
        refresh({node, edge, edgeArrows});

        edgeHover = edgeHover || selectAllEdges('.edge-hover');
        edgeLabels = edgeLabels || selectAllEdges('.edge-label-wrapper');
        textPaths = textPaths || selectAllDefs('path.edge-label-path');
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
        return diagram;
    }

    function reposition(node, edge) {
        node
            .attr('transform', n => `translate(${n.cola.x},${n.cola.y})`);
        // reset edge ports
        edge.each(e => {
            e.pos.new = null;
            e.pos.old = null;
            e.cola.points = null;
            diagram.calcEdgePath(
                e,
                'new',
                e.source.cola.x,
                e.source.cola.y,
                e.target.cola.x,
                e.target.cola.y,
            );
            if (diagram.edgeArrowhead.eval(e))
                selectElement(`#${diagram.arrowId(e, 'head')}`)
                    .attr('orient', () => e.pos.new.orienthead);
            if (diagram.edgeArrowtail.eval(e))
                selectElement(`#${diagram.arrowId(e, 'tail')}`)
                    .attr('orient', () => e.pos.new.orienttail);
            selectElement(`#${diagram.edgeId(e)}-arrows`)
                .attr('d', generateEdgePath('new', true));
        })
            .attr('d', generateEdgePath('new'));
        return diagram;
    }

    function generateEdgePath(age, full) {
        const field = full ? 'full' : 'path';
        return function(e) {
            const path = e.pos?.[age]?.[field];
            if (!path) return '';
            return generatePath(path.points, path.bezDegree);
        };
    }

    function generateEdgeLabelPath(age) {
        return function(e) {
            const path = e.pos?.[age]?.path;
            if (!path) return '';
            const points = path.points[path.points.length-1].x < path.points[0].x
                ? path.points.slice(0).reverse()
                : path.points;
            return generatePath(points, path.bezDegree);
        };
    }

    function withRad(f) {
        return function() {
            return `${f.apply(this, arguments)}rad`;
        };
    }

    function unsurprisingOrientRad(oldorient, neworient) {
        return withRad(unsurprisingOrient)(oldorient, neworient);
    }

    function hasSourceAndTarget(e) {
        return !!e.source && !!e.target;
    }

    function drawMain(drawState, animatePositions) {
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
    }

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
        console.assert(edge.data().every(hasSourceAndTarget));

        const nodeEntered = {};
        nodeEnter
            .each(n => {
                nodeEntered[diagram.nodeKey.eval(n)] = true;
            })
            .attr('transform', n =>
                // start new nodes at their final position
                `translate(${n.cola.x},${n.cola.y})`);
        const ntrans = node
            .transition()
            .duration(diagram.stagedDuration ? diagram.stagedDuration() : 0)
            .delay(n =>
                diagram.stagedDelay ? diagram.stagedDelay(nodeEntered[diagram.nodeKey.eval(n)]) : 0
            )
            .attr('opacity', diagram.nodeOpacity.eval);
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
                e.pos.new = placeArrowsOnSpline(diagram, e, e.cola.points);
            } else {
                if (!e.pos.old)
                    diagram.calcEdgePath(
                        e,
                        'old',
                        e.source.prevX || e.source.cola.x,
                        e.source.prevY || e.source.cola.y,
                        e.target.prevX || e.target.cola.x,
                        e.target.prevY || e.target.cola.y,
                    );
                if (!e.pos.new)
                    diagram.calcEdgePath(
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
                edgeEntered[diagram.edgeKey.eval(e)] = true;
            })
            .attr(
                'd',
                generateEdgePath(
                    diagram.stageTransitions && diagram.stageTransitions() === 'modins'
                        ? 'new'
                        : 'old',
                ),
            );

        edgeArrowsEnter
            .each(e => {
                // if staging transitions, just fade new edges in at new position
                // else start new edges at old positions of nodes, if any, else new positions
                const age = diagram.stageTransitions && diagram.stageTransitions() === 'modins'
                    ? 'new'
                    : 'old';
                if (diagram.edgeArrowhead.eval(e))
                    selectElement(`#${diagram.arrowId(e, 'head')}`)
                        .attr('orient', () => e.pos[age].orienthead);
                if (diagram.edgeArrowtail.eval(e))
                    selectElement(`#${diagram.arrowId(e, 'tail')}`)
                        .attr('orient', () => e.pos[age].orienttail);
            })
            .attr(
                'd',
                generateEdgePath(
                    diagram.stageTransitions && diagram.stageTransitions() === 'modins'
                        ? 'new'
                        : 'old',
                    true,
                ),
            );

        edgeArrows
            .each(e => {
                if (diagram.edgeArrowhead.eval(e))
                    selectElement(`#${diagram.arrowId(e, 'head')}`)
                        .attr(
                            'orient',
                            unsurprisingOrientRad(e.pos.old.orienthead, e.pos.new.orienthead),
                        )
                        .transition().duration(
                            diagram.stagedDuration ? diagram.stagedDuration() : 0,
                        )
                        .delay(diagram.stagedDelay ? diagram.stagedDelay(false) : 0)
                        .attr('orient', () => e.pos.new.orienthead);
                if (diagram.edgeArrowtail.eval(e))
                    selectElement(`#${diagram.arrowId(e, 'tail')}`)
                        .attr(
                            'orient',
                            unsurprisingOrientRad(e.pos.old.orienttail, e.pos.new.orienttail),
                        )
                        .transition().duration(
                            diagram.stagedDuration ? diagram.stagedDuration() : 0,
                        )
                        .delay(diagram.stagedDelay ? diagram.stagedDelay(false) : 0)
                        .attr('orient', () => e.pos.new.orienttail);
            });

        let etrans = edge
            .transition()
            .duration(diagram.stagedDuration ? diagram.stagedDuration() : 0)
            .delay(e =>
                diagram.stagedDelay ? diagram.stagedDelay(edgeEntered[diagram.edgeKey.eval(e)]) : 0
            )
            .attr('opacity', diagram.edgeOpacity.eval);
        const arrowtrans = edgeArrows
            .transition()
            .duration(diagram.stagedDuration ? diagram.stagedDuration() : 0)
            .delay(e =>
                diagram.stagedDelay ? diagram.stagedDelay(edgeEntered[diagram.edgeKey.eval(e)]) : 0
            )
            .attr('opacity', diagram.edgeOpacity.eval);
        (animatePositions ? etrans : edge)
            .attr('d', e => {
                const when = diagram.stageTransitions && diagram.stageTransitions() === 'insmod'
                        && edgeEntered[diagram.edgeKey.eval(e)]
                    ? 'old'
                    : 'new';
                return generateEdgePath(when)(e);
            });
        (animatePositions ? arrowtrans : edgeArrows)
            .attr('d', e => {
                const when = diagram.stageTransitions && diagram.stageTransitions() === 'insmod'
                        && edgeEntered[diagram.edgeKey.eval(e)]
                    ? 'old'
                    : 'new';
                return generateEdgePath(when, true)(e);
            });
        const elabels = edgeLabels
            .selectAll('text').data(e => {
                const labels = diagram.edgeLabel.eval(e);
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
                return i*diagram.edgeLabelSpacing.eval(this.parentNode)-2;
            })
            .append('textPath')
            .attr('startOffset', '50%');
        elabels
            .select('textPath')
            .html(t => t)
            .attr('opacity', function() {
                return diagram.edgeOpacity.eval(
                    select(this.parentNode.parentNode).datum(),
                );
            })
            .attr('xlink:href', function(_e) {
                const id = diagram.textpathId
                    ? diagram.textpathId(
                        select(this.parentNode.parentNode).datum(),
                    )
                    : `textpath-${_e.key}`;
                // angular on firefox needs absolute paths for fragments
                return `${window.location.href.split('#')[0]}#${id}`;
            });
        textPathsEnter
            .attr(
                'd',
                generateEdgeLabelPath(
                    diagram.stageTransitions && diagram.stageTransitions() === 'modins'
                        ? 'new'
                        : 'old',
                ),
            );
        let textTrans = textPaths.transition()
            .duration(diagram.stagedDuration ? diagram.stagedDuration() : 0)
            .delay(e =>
                diagram.stagedDelay ? diagram.stagedDelay(edgeEntered[diagram.edgeKey.eval(e)]) : 0
            );
        if (animatePositions)
            textTrans
                .attr('d', e => {
                    const when = diagram.stageTransitions && diagram.stageTransitions() === 'insmod'
                            && edgeEntered[diagram.edgeKey.eval(e)]
                        ? 'old'
                        : 'new';
                    return generateEdgeLabelPath(when)(e);
                });
        if (
            diagram.stageTransitions && diagram.stageTransitions() === 'insmod' && animatePositions
        ) {
            // inserted edges transition twice in insmod mode
            const stageDuration = diagram.stagedDuration ? diagram.stagedDuration() : 0;
            if (stageDuration >= 50) {
                etrans = etrans.transition()
                    .duration(stageDuration)
                    .attr('d', generateEdgePath('new'));
                textTrans = textTrans.transition()
                    .duration(stageDuration)
                    .attr('d', generateEdgeLabelPath('new'));
                arrowtrans.transition()
                    .duration(stageDuration)
                    .attr('d', generateEdgePath('new', true));
            } else {
                etrans
                    .attr('d', generateEdgePath('new'));
                textTrans
                    .attr('d', generateEdgeLabelPath('new'));
                arrowtrans
                    .attr('d', generateEdgePath('new', true));
            }
        }

        // signal layout done when all transitions complete
        // because otherwise client might start another layout and lock the processor
        _animating = true;
        if (!diagram.showLayoutSteps || !diagram.showLayoutSteps())
            endall([ntrans, etrans, textTrans], () => {
                _animating = false;
                if (diagram.layoutDone)
                    diagram.layoutDone(true);
            });

        if (animatePositions)
            edgeHover.attr('d', generateEdgePath('new'));

        edge.each(e => {
            e.pos.old = e.pos.new;
        });
    }

    // wait on multiple transitions
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

    function isRendered() {
        return !!_svg;
    }

    function initializeDrawing() {
        resetSvg();
        _g = _svg.selectAll('g.draw')
            .data([1])
            .enter().append('g')
            .attr('class', 'draw');

        const layers = ['edge-layer', 'node-layer'];
        if (diagram.edgesInFront())
            layers.reverse();
        _g.selectAll('g').data(layers)
            .enter().append('g')
            .attr('class', l => l);
        _edgeLayer = _g.selectAll('g.edge-layer');
        _nodeLayer = _g.selectAll('g.node-layer');
        return diagram;
    }

    function selectElement(s) {
        return diagram.root().select(s);
    }

    function selectAllElements(s) {
        return diagram.root() ? diagram.root().selectAll(s) : null;
    }

    function selectNodePortsOfStyle(node, style) {
        return node.selectAll('g.port').filter(p => diagram.portStyleName.eval(p) === style);
    }

    function drawPorts(drawState) {
        const nodePorts = diagram.nodePorts ? diagram.nodePorts() : null;
        if (!nodePorts)
            return;
        const portStyles = diagram.portStyle && diagram.portStyle.enum
            ? diagram.portStyle.enum()
            : [];
        portStyles.forEach(style => {
            const nodePorts2 = {};
            for (const nid in nodePorts)
                nodePorts2[nid] = nodePorts[nid].filter(p =>
                    diagram.portStyleName.eval(p) === style
                );
            const port = selectNodePortsOfStyle(drawState.node, style);
            if (diagram.portStyle(style).drawPorts)
                diagram.portStyle(style).drawPorts(port, nodePorts2, drawState.node);
        });
    }

    function fireTSEvent(dispatch, drawState) {
        dispatch.call(
            'transitionsStarted',
            null,
            drawState.node,
            drawState.edge,
            drawState.edgeHover,
        );
    }

    function calculateBounds(drawState) {
        if (!drawState.node.size())
            return null;
        return diagram.calculateBounds(drawState.node.data(), drawState.edge.data());
    }

    function svg(_) {
        if (!arguments.length) {
            return _svg;
        }
        _svg = _;
        return diagram;
    }

    function g(_) {
        if (!arguments.length) {
            return _g;
        }
        _g = _;
        return diagram;
    }

    function resetSvg() {
        // we might be re-initialized in a div, in which case
        // we already have an <svg> element to delete
        const svg = _svg || selectElement('svg');
        svg.remove();
        _svg = null;
        return generateSvg();
    }

    function addOrRemoveDef(id, whether, tag, onEnter) {
        const data = whether ? [0] : [];
        const sel = _defs.selectAll(`#${id}`).data(data);

        const selEnter = sel
            .enter().append(tag)
            .attr('id', id);
        if (selEnter.size() && onEnter)
            selEnter.call(onEnter);
        sel.exit().remove();
        return sel.merge(selEnter);
    }

    function generateSvg() {
        const root = diagram.root();
        _svg = root.selectAll('svg')
            .data([1])
            .enter().append('svg');
        resize();

        _defs = _svg.selectAll('defs')
            .data([1])
            .enter().append('svg:defs');

        // for lack of a better place
        addOrRemoveDef('node-clip-top', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1000)
                .attr('y', -1000)
                .attr('width', 2000)
                .attr('height', 1000);
        });
        addOrRemoveDef('node-clip-bottom', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1000)
                .attr('y', 0)
                .attr('width', 2000)
                .attr('height', 1000);
        });
        addOrRemoveDef('node-clip-left', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1000)
                .attr('y', -1000)
                .attr('width', 1000)
                .attr('height', 2000);
        });
        addOrRemoveDef('node-clip-right', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', 0)
                .attr('y', -1000)
                .attr('width', 1000)
                .attr('height', 2000);
        });
        addOrRemoveDef('node-clip-none', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0);
        });

        _zoom = zoom()
            .on('zoom.diagram', diagram.doZoom)
            .scaleExtent(diagram.zoomExtent());

        if (diagram.mouseZoomable()) {
            const _brush = diagram.child ? diagram.child('brush') : null;
            let keyboard = diagram.child ? diagram.child('keyboard') : null;
            if (!keyboard && diagram.child)
                diagram.child('keyboard', keyboard = keyboardMode());

            if (keyboard && keyboard.modKeysMatch)
                _zoom.filter(() => keyboard.modKeysMatch(diagram.modKeyZoom()));

            _svg.call(_zoom);
            _svg.on('dblclick.zoom', null);
        } else {
            _zoom.filter(() => false);
            _svg.call(_zoom);
        }

        return _svg;
    }

    function animating() {
        return _animating;
    }

    // SVG element accessors (needed by layout engines)
    diagram.nodeParent = () => _nodeLayer;
    diagram.edgeParent = () => _edgeLayer;
    diagram.nodeTag = () => '.node';
    diagram.edgeTag = () => '.edge';
    diagram.nodeIdTag = () => '.node';
    diagram.edgeIdTag = () => '.edge';

    // Expose all SVG rendering methods on diagram
    diagram.rendererType = rendererType;
    diagram.renderNode = diagram._enterNode = renderNode;
    diagram.redrawNode = diagram._updateNode = redrawNode;
    diagram.redrawEdge = diagram._updateEdge = redrawEdge;
    diagram.selectAllNodes = selectAllNodes;
    diagram.selectAllEdges = selectAllEdges;
    diagram.selectAllDefs = selectAllDefs;
    diagram.resize = resize;
    diagram.rezoom = rezoom;
    diagram.globalTransform = globalTransform;
    diagram.translate = translate;
    diagram.scale = scale;
    diagram.commitTranslateScale = commitTranslateScale;
    diagram.zoom = zoomBehavior;
    diagram.startRedraw = startRedraw;
    diagram.refresh = refreshPublic;
    diagram.reposition = reposition;
    diagram.draw = drawMain;
    diagram.drawPorts = drawPorts;
    diagram.isRendered = isRendered;
    diagram.initializeDrawing = initializeDrawing;
    diagram.select = selectElement;
    diagram.selectAll = selectAllElements;
    diagram.selectNodePortsOfStyle = selectNodePortsOfStyle;
    diagram.svg = svg;
    diagram.g = g;
    diagram.resetSvg = resetSvg;
    diagram.addOrRemoveDef = addOrRemoveDef;
    diagram.animating = animating;
    diagram.calculateBounds = calculateBounds;
    diagram.fireTSEvent = fireTSEvent;

    return diagram;
}
