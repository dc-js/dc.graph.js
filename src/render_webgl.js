dc_graph.render_webgl = function() {
    //var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _animating = false; // do not refresh during animations
    //var _zoom;
    var _renderer = {};

    _renderer.parent = property(null);

    _renderer.resize = function(w, h) {
        return _renderer;
    };

    _renderer.rezoom = function(oldWidth, oldHeight, newWidth, newHeight) {
        return _renderer;
    };

    _renderer.globalTransform = function(pos, scale, animate) {
        return _renderer;
    };

    _renderer.translate = function(_) {
        if(!arguments.length)
            return [0,0];
        return this;
    };

    _renderer.scale = function(_) {
        if(!arguments.length)
            return 1;
        return this;
    };

    // argh
    _renderer.commitTranslateScale = function() {
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        return drawState;
    };

    _renderer.refresh = function(node, edge, edgeHover, edgeLabels, textPaths) {
        if(_animating)
            return this; // but what about changed attributes?
        return this;
    };

    _renderer.reposition = function(node, edge) {
        return this;
    };

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    _renderer.draw = function(drawState, animatePositions) {
        return _renderer;
    };

    _renderer.isRendered = function() {
        return !!_svg;
    };

    _renderer.initializeDrawing = function () {
        return this;
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
            // not implemented
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
                    .on('keydown.modkey-zoom', function() {
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
                    .on('keyup.modkey-zoom', function() {
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

