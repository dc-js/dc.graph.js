dc_graph.render_svg = function() {
    var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _animating = false; // do not refresh during animations
    var _zoom;
    var _renderer = {};

    _renderer.rendererType = function() {
        return 'svg';
    };

    _renderer.parent = property(null);

    _renderer.renderNode = _renderer._enterNode = function(nodeEnter) {
        if(_renderer.parent().nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(infer_shape(_renderer.parent()));
        _renderer.parent().forEachShape(nodeEnter, function(shape, node) {
            node.call(shape.create);
        });
        return _renderer;
    };
    _renderer.redrawNode = _renderer._updateNode = function(node) {
        var changedShape = node.filter(shape_changed(_renderer.parent()));
        changedShape.selectAll('.node-shape').remove();
        changedShape.each(infer_shape(_renderer.parent()));
        _renderer.parent().forEachShape(changedShape, function(shape, node) {
            node.call(shape.create);
        });
        node.select('title')
            .text(_renderer.parent().nodeTitle.eval);
        _renderer.parent().forEachContent(node, function(contentType, node) {
            node.call(contentType.update);
            _renderer.parent().forEachShape(contentType.selectContent(node), function(shape, content) {
                content
                    .call(fit_shape(shape, _renderer.parent()));
            });
        });
        _renderer.parent().forEachShape(node, function(shape, node) {
            node.call(shape.update);
        });
        node.select('.node-shape')
            .attr({
                stroke: _renderer.parent().nodeStroke.eval,
                'stroke-width': _renderer.parent().nodeStrokeWidth.eval,
                'stroke-dasharray': _renderer.parent().nodeStrokeDashArray.eval,
                fill: compose(_renderer.parent().nodeFillScale() || identity, _renderer.parent().nodeFill.eval)
            });
        return _renderer;
    };
    _renderer.redrawEdge = _renderer._updateEdge = function(edge, edgeArrows) {
        edge
            .attr('stroke', _renderer.parent().edgeStroke.eval)
            .attr('stroke-width', _renderer.parent().edgeStrokeWidth.eval)
            .attr('stroke-dasharray', _renderer.parent().edgeStrokeDashArray.eval);
        edgeArrows
            .attr('marker-end', function(e) {
                var name = _renderer.parent().edgeArrowhead.eval(e),
                    id = edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'head', name);
                return id ? 'url(#' + id + ')' : null;
            })
            .attr('marker-start', function(e) {
                var name = _renderer.parent().edgeArrowtail.eval(e),
                    arrow_id = edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'tail', name);
                return name ? 'url(#' + arrow_id + ')' : null;
            })
            .each(function(e) {
                var fillEdgeStroke = _renderer.parent().edgeStroke.eval(e);
                _renderer.selectAll('#' + _renderer.parent().arrowId(e, 'head'))
                    .attr('fill', _renderer.parent().edgeStroke.eval(e));
                _renderer.selectAll('#' + _renderer.parent().arrowId(e, 'tail'))
                    .attr('fill', _renderer.parent().edgeStroke.eval(e));
            });
    };

    _renderer.selectAllNodes = function(selector) {
        selector = selector || '.node';
        return _nodeLayer && _nodeLayer.selectAll(selector).filter(function(n) {
            return !n.deleted;
        }) || d3.selectAll('.foo-this-does-not-exist');
    };

    _renderer.selectAllEdges = function(selector) {
        selector = selector || '.edge';
        return _edgeLayer && _edgeLayer.selectAll(selector).filter(function(e) {
            return !e.deleted;
        }) || d3.selectAll('.foo-this-does-not-exist');
    };

    _renderer.selectAllDefs = function(selector) {
        return _defs && _defs.selectAll(selector).filter(function(def) {
            return !def.deleted;
        }) || d3.selectAll('.foo-this-does-not-exist');
    };

    _renderer.resize = function(w, h) {
        if(_svg) {
            _svg.attr('width', w || (_renderer.parent().width_is_automatic() ? '100%' : _renderer.parent().width()))
                .attr('height', h || (_renderer.parent().height_is_automatic() ? '100%' : _renderer.parent().height()));
        }
        return _renderer;
    };

    _renderer.rezoom = function(oldWidth, oldHeight, newWidth, newHeight) {
        var scale = _zoom.scale(), translate = _zoom.translate();
        _zoom.scale(1).translate([0,0]);
        var xDomain = _renderer.parent().x().domain(), yDomain = _renderer.parent().y().domain();
        _renderer.parent().x()
            .domain([xDomain[0], xDomain[0] + (xDomain[1] - xDomain[0])*newWidth/oldWidth])
            .range([0, newWidth]);
        _renderer.parent().y()
            .domain([yDomain[0], yDomain[0] + (yDomain[1] - yDomain[0])*newHeight/oldHeight])
            .range([0, newHeight]);
        _zoom
            .x(_renderer.parent().x()).y(_renderer.parent().y())
            .translate(translate).scale(scale);
    };

    _renderer.globalTransform = function(pos, scale, animate) {
        // _translate = pos;
        // _scale = scale;
        var obj = _g;
        if(animate)
            obj = _g.transition().duration(_renderer.parent().zoomDuration());
        obj.attr('transform', 'translate(' + pos + ')' + ' scale(' + scale + ')');
    };

    _renderer.translate = function(_) {
        if(!arguments.length)
            return _zoom.translate();
        _zoom.translate(_);
        return this;
    };

    _renderer.scale = function(_) {
        if(!arguments.length)
            return _zoom ? _zoom.scale() : 1;
        _zoom.scale(_);
        return this;
    };

    // argh
    _renderer.commitTranslateScale = function() {
        _zoom.event(_svg);
    };

    _renderer.zoom = function(_) {
        if(!arguments.length)
            return _zoom;
        _zoom = _; // is this a good idea?
        return _renderer;
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        // create edge SVG elements
        var edge = _edgeLayer.selectAll('.edge')
                .data(wedges, _renderer.parent().edgeKey.eval);
        var edgeEnter = edge.enter().append('svg:path')
                .attr({
                    class: 'edge',
                    id: _renderer.parent().edgeId,
                    opacity: 0
                })
            .each(function(e) {
                e.deleted = false;
            });
        edge.exit().each(function(e) {
            e.deleted = true;
        }).transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .remove();

        var edgeArrows = _edgeLayer.selectAll('.edge-arrows')
                .data(wedges, _renderer.parent().edgeKey.eval);
        var edgeArrowsEnter = edgeArrows.enter().append('svg:path')
                .attr({
                    class: 'edge-arrows',
                    id: function(d) {
                        return _renderer.parent().edgeId(d) + '-arrows';
                    },
                    fill: 'none',
                    opacity: 0
                });
        edgeArrows.exit().transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .remove()
            .each('end.delarrow', function(e) {
                edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'head', null);
                edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'tail', null);
            });

        if(_renderer.parent().edgeSort()) {
            edge.sort(function(a, b) {
                var as = _renderer.parent().edgeSort.eval(a), bs = _renderer.parent().edgeSort.eval(b);
                return as < bs ? -1 : bs < as ? 1 : 0;
            });
        }

        // another wider copy of the edge just for hover events
        var edgeHover = _edgeLayer.selectAll('.edge-hover')
                .data(wedges, _renderer.parent().edgeKey.eval);
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('fill', 'none')
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover.diagram', function(e) {
                _renderer.select('#' + _renderer.parent().edgeId(e) + '-label')
                    .attr('visibility', 'visible');
            })
            .on('mouseout.diagram', function(e) {
                _renderer.select('#' + _renderer.parent().edgeId(e) + '-label')
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();

        var edgeLabels = _edgeLayer.selectAll('g.edge-label-wrapper')
            .data(wedges, _renderer.parent().edgeKey.eval);
        var edgeLabelsEnter = edgeLabels.enter()
            .append('g')
              .attr('class', 'edge-label-wrapper')
              .attr('visibility', 'hidden')
              .attr('id', function(e) {
                  return _renderer.parent().edgeId(e) + '-label';
              });
        var textPaths = _defs.selectAll('path.edge-label-path')
                .data(wedges, _renderer.parent().textpathId);
        var textPathsEnter = textPaths.enter()
                .append('svg:path').attr({
                    class: 'edge-label-path',
                    id: _renderer.parent().textpathId
                });
        edgeLabels.exit().transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0).remove();

        // create node SVG elements
        var node = _nodeLayer.selectAll('.node')
                .data(wnodes, _renderer.parent().nodeKey.eval);
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('opacity', '0') // don't show until has layout
            .each(function(n) {
                n.deleted = false;
            });
        // .call(_d3cola.drag);

        _renderer.renderNode(nodeEnter);

        node.exit().each(function(n) {
            n.deleted = true;
        }).transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .remove();

        dispatch.drawn(node, edge, edgeHover);

        var drawState = {
            node: node,
            nodeEnter: nodeEnter,
            edge: edge,
            edgeEnter: edgeEnter,
            edgeHover: edgeHover,
            edgeHoverEnter: edgeHoverEnter,
            edgeLabels: edgeLabels,
            edgeLabelsEnter: edgeLabelsEnter,
            edgeArrows: edgeArrows,
            edgeArrowsEnter: edgeArrowsEnter,
            textPaths: textPaths,
            textPathsEnter: textPathsEnter
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
        if(_animating)
            return this; // but what about changed attributes?
        node = node || _renderer.selectAllNodes();
        edge = edge || _renderer.selectAllEdges();
        var edgeArrows = _renderer.selectAllEdges('.edge-arrows');
        _refresh({node: node, edge: edge, edgeArrows: edgeArrows});

        edgeHover = edgeHover || _renderer.selectAllEdges('.edge-hover');
        edgeLabels = edgeLabels || _renderer.selectAllEdges('.edge-label-wrapper');
        textPaths = textPaths || _renderer.selectAllDefs('path.edge-label-path');
        var nullSel = d3.select(null); // no enters
        draw(node, nullSel, edge, nullSel, edgeHover, nullSel, edgeLabels, nullSel, edgeArrows, nullSel, textPaths, nullSel, false);
        return this;
    };

    _renderer.reposition = function(node, edge) {
        node
            .attr('transform', function (n) {
                return 'translate(' + n.cola.x + ',' + n.cola.y + ')';
            });
        // reset edge ports
        edge.each(function(e) {
            e.pos.new = null;
            e.pos.old = null;
            _renderer.parent().calcEdgePath(e, 'new', e.source.cola.x, e.source.cola.y, e.target.cola.x, e.target.cola.y);
            if(_renderer.parent().edgeArrowhead.eval(e))
                _renderer.select('#' + _renderer.parent().arrowId(e, 'head'))
                .attr('orient', function() {
                    return e.pos.new.orienthead;
                });
            if(_renderer.parent().edgeArrowtail.eval(e))
                _renderer.select('#' + _renderer.parent().arrowId(e, 'tail'))
                .attr('orient', function() {
                    return e.pos.new.orienttail;
                });
        })
            .attr('d', generate_edge_path('new'));
        return this;
    };

    function generate_edge_path(age, full) {
        var field = full ? 'full' : 'path';
        return function(e) {
            var path = e.pos[age][field];
            return generate_path(path.points, path.bezDegree);
        };
    };

    function generate_edge_label_path(age) {
        return function(e) {
            var path = e.pos[age].path;
            var points = path.points[path.points.length-1].x < path.points[0].x ?
                    path.points.slice(0).reverse() : path.points;
            return generate_path(points, path.bezDegree);
        };
    };

    function with_rad(f) {
        return function() {
            return f.apply(this, arguments) + 'rad';
        };
    }

    function unsurprising_orient_rad(oldorient, neworient) {
        return with_rad(unsurprising_orient)(oldorient, neworient);
   }

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    _renderer.draw = function(drawState, animatePositions) {
        draw(drawState.node, drawState.nodeEnter,
             drawState.edge, drawState.edgeEnter,
             drawState.edgeHover, drawState.edgeHoverEnter,
             drawState.edgeLabels, drawState.edgeLabelsEnter,
             drawState.edgeArrows, drawState.edgeArrowsEnter,
             drawState.textPaths, drawState.textPathsEnter,
             animatePositions);
    };

    function draw(node, nodeEnter, edge, edgeEnter, edgeHover, edgeHoverEnter,
                  edgeLabels, edgeLabelsEnter, edgeArrows, edgeArrowsEnter,
                  textPaths, textPathsEnter, animatePositions) {
        console.assert(edge.data().every(has_source_and_target));

        var nodeEntered = {};
        nodeEnter
            .each(function(n) {
                nodeEntered[_renderer.parent().nodeKey.eval(n)] = true;
            })
            .attr('transform', function (n) {
                // start new nodes at their final position
                return 'translate(' + n.cola.x + ',' + n.cola.y + ')';
            });
        var ntrans = node
                .transition()
                .duration(_renderer.parent().stagedDuration())
                .delay(function(n) {
                    return _renderer.parent().stagedDelay(nodeEntered[_renderer.parent().nodeKey.eval(n)]);
                })
                .attr('opacity', _renderer.parent().nodeOpacity.eval);
        if(animatePositions)
            ntrans
                .attr('transform', function (n) {
                    return 'translate(' + n.cola.x + ',' + n.cola.y + ')';
                })
                .each('end.record', function(n) {
                    n.prevX = n.cola.x;
                    n.prevY = n.cola.y;
                });

        // recalculate edge positions
        edge.each(function(e) {
            e.pos.new = null;
        });
        edge.each(function(e) {
            if(e.cola.points) {
                e.pos.new = place_arrows_on_spline(_renderer.parent(), e, e.cola.points);
            }
            else {
                if(!e.pos.old)
                    _renderer.parent().calcEdgePath(e, 'old', e.source.prevX || e.source.cola.x, e.source.prevY || e.source.cola.y,
                                   e.target.prevX || e.target.cola.x, e.target.prevY || e.target.cola.y);
                if(!e.pos.new)
                    _renderer.parent().calcEdgePath(e, 'new', e.source.cola.x, e.source.cola.y, e.target.cola.x, e.target.cola.y);
            }
            if(e.pos.old) {
                if(e.pos.old.path.bezDegree !== e.pos.new.path.bezDegree ||
                   e.pos.old.path.points.length !== e.pos.new.path.points.length) {
                    //console.log('old', e.pos.old.path.points.length, 'new', e.pos.new.path.points.length);
                    if(is_one_segment(e.pos.old.path)) {
                        e.pos.new.path.points = as_bezier3(e.pos.new.path);
                        e.pos.old.path.points = split_bezier_n(as_bezier3(e.pos.old.path),
                                                               (e.pos.new.path.points.length-1)/3);
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    }
                    else if(is_one_segment(e.pos.new.path)) {
                        e.pos.old.path.points = as_bezier3(e.pos.old.path);
                        e.pos.new.path.points = split_bezier_n(as_bezier3(e.pos.new.path),
                                                               (e.pos.old.path.points.length-1)/3);
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    }
                    else console.warn("don't know how to interpolate two multi-segments");
                }
            }
            else
                e.pos.old = e.pos.new;
        });

        var edgeEntered = {};
        edgeEnter
            .each(function(e) {
                edgeEntered[_renderer.parent().edgeKey.eval(e)] = true;
            })
            .attr('d', generate_edge_path(_renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old'));

        edgeArrowsEnter
            .each(function(e) {
                // if staging transitions, just fade new edges in at new position
                // else start new edges at old positions of nodes, if any, else new positions
                var age = _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old';
                if(_renderer.parent().edgeArrowhead.eval(e))
                    _renderer.select('#' + _renderer.parent().arrowId(e, 'head'))
                    .attr('orient', function() {
                        return e.pos[age].orienthead;
                    });
                if(_renderer.parent().edgeArrowtail.eval(e))
                    _renderer.select('#' + _renderer.parent().arrowId(e, 'tail'))
                    .attr('orient', function() {
                        return e.pos[age].orienttail;
                    });
            })
            .attr('d', generate_edge_path(_renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old', true));

        edgeArrows
            .each(function(e) {
                if(_renderer.parent().edgeArrowhead.eval(e))
                    _renderer.select('#' + _renderer.parent().arrowId(e, 'head'))
                    .attr('orient', unsurprising_orient_rad(e.pos.old.orienthead, e.pos.new.orienthead))
                    .transition().duration(_renderer.parent().stagedDuration())
                    .delay(_renderer.parent().stagedDelay(false))
                    .attr('orient', function() {
                        return e.pos.new.orienthead;
                    });
                if(_renderer.parent().edgeArrowtail.eval(e))
                    _renderer.select('#' + _renderer.parent().arrowId(e, 'tail'))
                    .attr('orient', unsurprising_orient_rad(e.pos.old.orienttail, e.pos.new.orienttail))
                    .transition().duration(_renderer.parent().stagedDuration())
                    .delay(_renderer.parent().stagedDelay(false))
                    .attr('orient', function() {
                        return e.pos.new.orienttail;
                    });
            });

        var etrans = edge
              .transition()
                .duration(_renderer.parent().stagedDuration())
                .delay(function(e) {
                    return _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)]);
                })
                .attr('opacity', _renderer.parent().edgeOpacity.eval);
        var arrowtrans = edgeArrows
              .transition()
                .duration(_renderer.parent().stagedDuration())
                .delay(function(e) {
                    return _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)]);
                })
                .attr('opacity', _renderer.parent().edgeOpacity.eval);
        (animatePositions ? etrans : edge)
            .attr('d', function(e) {
                var when = _renderer.parent().stageTransitions() === 'insmod' &&
                        edgeEntered[_renderer.parent().edgeKey.eval(e)] ? 'old' : 'new';
                return generate_edge_path(when)(e);
            });
        (animatePositions ? arrowtrans : edgeArrows)
            .attr('d', function(e) {
                var when = _renderer.parent().stageTransitions() === 'insmod' &&
                        edgeEntered[_renderer.parent().edgeKey.eval(e)] ? 'old' : 'new';
                return generate_edge_path(when, true)(e);
            });
        var elabels = edgeLabels
            .selectAll('text').data(function(e) {
                var labels = _renderer.parent().edgeLabel.eval(e);
                if(!labels)
                    return [];
                else if(typeof labels === 'string')
                    return [labels];
                else return labels;
            });
        elabels.enter()
          .append('text')
            .attr({
                'class': 'edge-label',
                'text-anchor': 'middle',
                dy: function(_, i) {
                    return i * _renderer.parent().edgeLabelSpacing.eval(this.parentNode) -2;
                }
            })
          .append('textPath')
            .attr('startOffset', '50%');
        elabels
          .select('textPath')
            .html(function(t) { return t; })
            .attr('opacity', function() {
                return _renderer.parent().edgeOpacity.eval(d3.select(this.parentNode.parentNode).datum());
            })
            .attr('xlink:href', function(e) {
                var id = _renderer.parent().textpathId(d3.select(this.parentNode.parentNode).datum());
                // angular on firefox needs absolute paths for fragments
                return window.location.href.split('#')[0] + '#' + id;
            });
        textPathsEnter
            .attr('d', generate_edge_label_path(_renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old'));
        var textTrans = textPaths.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(function(e) {
                return _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)]);
            });
        if(animatePositions)
            textTrans
            .attr('d', function(e) {
                var when = _renderer.parent().stageTransitions() === 'insmod' &&
                        edgeEntered[_renderer.parent().edgeKey.eval(e)] ? 'old' : 'new';
                return generate_edge_label_path(when)(e);
            });
        if(_renderer.parent().stageTransitions() === 'insmod' && animatePositions) {
            // inserted edges transition twice in insmod mode
            if(_renderer.parent().stagedDuration() >= 50) {
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
        if(!_renderer.parent().showLayoutSteps())
            endall([ntrans, etrans, textTrans],
                   function() {
                       _animating = false;
                       _renderer.parent().layoutDone(true);
                   });

        if(animatePositions)
            edgeHover.attr('d', generate_edge_path('new'));

        edge.each(function(e) {
            e.pos.old = e.pos.new;
        });
    }

    // wait on multiple transitions, adapted from
    // http://stackoverflow.com/questions/10692100/invoke-a-callback-at-the-end-of-a-transition
    function endall(transitions, callback) {
        if (transitions.every(function(transition) { return transition.size() === 0; }))
            callback();
        var n = 0;
        transitions.forEach(function(transition) {
            transition
                .each(function() { ++n; })
                .each('end.all', function() { if (!--n) callback(); });
        });
    }

    _renderer.isRendered = function() {
        return !!_svg;
    };

    _renderer.initializeDrawing = function () {
        _renderer.resetSvg();
        _g = _svg.append('g')
            .attr('class', 'draw');

        var layers = ['edge-layer', 'node-layer'];
        if(_renderer.parent().edgesInFront())
            layers.reverse();
        _g.selectAll('g').data(layers)
          .enter().append('g')
            .attr('class', function(l) { return l; });
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
     **/
    _renderer.select = function (s) {
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
     **/
    _renderer.selectAll = function (s) {
        return _renderer.parent().root() ? _renderer.parent().root().selectAll(s) : null;
    };

    _renderer.selectNodePortsOfStyle = function(node, style) {
        return node.selectAll('g.port').filter(function(p) {
            return _renderer.parent().portStyleName.eval(p) === style;
        });
    };

    _renderer.drawPorts = function(drawState) {
        var nodePorts = _renderer.parent().nodePorts();
        if(!nodePorts)
            return;
        _renderer.parent().portStyle.enum().forEach(function(style) {
            var nodePorts2 = {};
            for(var nid in nodePorts)
                nodePorts2[nid] = nodePorts[nid].filter(function(p) {
                    return _renderer.parent().portStyleName.eval(p) === style;
                });
            var port = _renderer.selectNodePortsOfStyle(drawState.node, style);
            _renderer.parent().portStyle(style).drawPorts(port, nodePorts2, drawState.node);
        });
    };

    _renderer.fireTSEvent = function(dispatch, drawState) {
        dispatch.transitionsStarted(drawState.node, drawState.edge, drawState.edgeHover);
    };

    _renderer.calculateBounds = function(drawState) {
        if(!drawState.node.size())
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
     **/
    _renderer.svg = function (_) {
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
    _renderer.g = function (_) {
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
     **/
    _renderer.resetSvg = function () {
        // we might be re-initialized in a div, in which case
        // we already have an <svg> element to delete
        var svg = _svg || _renderer.select('svg');
        svg.remove();
        _svg = null;
        //_renderer.parent().x(null).y(null);
        return generateSvg();
    };

    _renderer.addOrRemoveDef = function(id, whether, tag, onEnter) {
        var data = whether ? [0] : [];
        var sel = _defs.selectAll('#' + id).data(data);

        var selEnter = sel
            .enter().append(tag)
              .attr('id', id);
        if(selEnter.size() && onEnter)
            selEnter.call(onEnter);
        sel.exit().remove();
        return sel;
    };

    function enableZoom() {
        _svg.call(_zoom);
        _svg.on('dblclick.zoom', null);
    }
    function disableZoom() {
        _svg.on('.zoom', null);
    }

    function generateSvg() {
        _svg = _renderer.parent().root().append('svg');
        _renderer.resize();

        _defs = _svg.append('svg:defs');

        _zoom = d3.behavior.zoom()
            .on('zoom.diagram', _renderer.parent().doZoom)
            .x(_renderer.parent().x()).y(_renderer.parent().y())
            .scaleExtent(_renderer.parent().zoomExtent());
        if(_renderer.parent().mouseZoomable()) {
            var mod, mods;
            var brush = _renderer.parent().child('brush');
            if((mod = _renderer.parent().modKeyZoom())) {
                if (Array.isArray (mod))
                    mods = mod.slice ();
                else if (typeof mod === "string")
                    mods = [mod];
                else
                    mods = ['Alt'];
                var mouseDown = false, modDown = false, zoomEnabled = false;
                _svg.on('mousedown.modkey-zoom', function() {
                    mouseDown = true;
                }).on('mouseup.modkey-zoom', function() {
                    mouseDown = false;
                    if(!mouseDown && !modDown && zoomEnabled) {
                        zoomEnabled = false;
                        disableZoom();
                        if(brush)
                            brush.activate();
                    }
                });
                d3.select(document)
                    .on('keydown.modkey-zoom-' + _renderer.parent().anchorName(), function() {
                        if(mods.indexOf (d3.event.key) > -1) {
                            modDown = true;
                            if(!mouseDown) {
                                zoomEnabled = true;
                                enableZoom();
                                if(brush)
                                    brush.deactivate();
                            }
                        }
                    })
                    .on('keyup.modkey-zoom-' + _renderer.parent().anchorName(), function() {
                        if(mods.indexOf (d3.event.key) > -1) {
                            modDown = false;
                            if(!mouseDown) {
                                zoomEnabled = false;
                                disableZoom();
                                if(brush)
                                    brush.activate();
                            }
                        }
                    });
            }
            else enableZoom();
        }

        return _svg;
    }

    _renderer.animating = function() {
        return _animating;
    };

    return _renderer;
};

