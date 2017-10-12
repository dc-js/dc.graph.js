dc_graph.symbol_port_style = function() {
    var _style = {};
    var _nodePorts, _node;
    var _drawConduct;

    _style.symbolScale = property(d3.shuffle(d3.scale.ordinal().range(d3.svg.symbolTypes)));
    _style.colorScale = property(d3.scale.ordinal().range(
         // colorbrewer light qualitative scale
        d3.shuffle(['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
                    '#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'])));

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.symbol = _style.portSymbol = property(name_or_edge, false); // non standard properties taking "outer datum"
    _style.color = _style.portColor = property(name_or_edge, false);
    _style.outline = property(dc_graph.symbol_port_style.outline.circle());
    _style.smallRadius = _style.portRadius = property(7);
    _style.mediumRadius = _style.portHoverNodeRadius = property(10);
    _style.largeRadius = _style.portHoverPortRadius = property(14);
    _style.displacement = _style.portDisplacement = property(2);
    _style.outlineFillScale = _style.portBackgroundScale = property(null);
    _style.outlineFill = _style.portBackgroundFill = property(null);
    _style.outlineStroke = _style.portBackgroundStroke = property(null);
    _style.outlineStrokeWidth = _style.portBackgroundStrokeWidth = property(null);
    _style.padding = _style.portPadding = property(2);
    _style.label = _style.portLabel = _style.portText = property(function(p) {
        return p.name;
    });
    _style.portLabelPadding = property({x: 5, y: 5});
    _style.cascade = cascade(_style);

    function symbol_fill(d) {
        return _style.colorScale()(_style.color.eval(d));
    }
    function port_transform(d) {
        var l = Math.hypot(d.pos.x, d.pos.y),
            u = {x: d.pos.x / l, y: d.pos.y / l},
            disp = _style.displacement.eval(d),
            pos = {x: d.pos.x + disp * u.x, y: d.pos.y + disp * u.y};
        return 'translate(' + pos.x + ',' + pos.y + ')';
    }
    function port_symbol(d, size) {
        return d3.svg.symbol()
            .type(_style.symbolScale()(_style.symbol.eval(d)))
            .size(size*size)
        ();
    }
    function is_left(p) {
        return p.vec[0] < 0;
    }
    function hover_radius(d) {
        switch(d.state) {
        case 'large':
            return _style.largeRadius.eval(d);
        case 'medium':
            return _style.mediumRadius.eval(d);
        case 'small':
        default:
            return _style.smallRadius.eval(d);
        }
    }
    function shimmer_radius(d) {
        return /-medium$/.test(d.state) ?
            _style.mediumRadius.eval(d) :
            _style.largeRadius.eval(d);
    }
    // fall back to node aesthetics if not defined for port
    function outline_fill(p) {
        var scale, fill;
        if(_style.outlineFill.eval(p)) {
            scale = _style.outlineFillScale() || identity;
            fill = _style.outlineFill.eval(p);
        }
        else {
            scale = _style.parent().nodeFillScale() || identity;
            fill = _style.parent().nodeFill.eval(p.node);
        }
        return fill === 'none' ? 'none' : scale(fill);
    }
    function outline_stroke(p) {
        return _style.outlineStroke.eval(p) || _style.parent().nodeStroke.eval(p.node);
    }
    function outline_stroke_width(p) {
        var sw = _style.outlineStrokeWidth.eval(p);
        return typeof sw === 'number' ? sw : _style.parent().nodeStrokeWidth.eval(p.node);
    }
    _style.animateNodes = function(nids, before) {
        var setn = d3.set(nids);
        var node = _node
                .filter(function(d) {
                    return setn.has(_style.parent().nodeKey.eval(d));
                });
        var symbol = node.selectAll('g.port');
        var shimmer = symbol.filter(function(p) { return /^shimmer/.test(p.state); }),
            nonshimmer = symbol.filter(function(p) { return !/^shimmer/.test(p.state); });
        if(shimmer.size()) {
            if(before)
                before.each('end', repeat);
            else repeat();
        }

        function repeat() {
            var shimin = shimmer.transition()
                    .duration(1000)
                    .ease("bounce");
            shimin.selectAll('.port-outline')
                .call(_style.outline().draw(function(d) {
                    return shimmer_radius(d) + _style.portPadding.eval(d);
                }));
            shimin.selectAll('path.port-symbol')
                .attr({
                    d: function(d) {
                        return port_symbol(d, shimmer_radius(d));
                    }
                });
            var shimout = shimin.transition()
                    .duration(1000)
                    .ease('sin');
            shimout.selectAll('.port-outline')
                .call(_style.outline().draw(function(d) {
                    return _style.smallRadius.eval(d) + _style.portPadding.eval(d);
                }));
            shimout.selectAll('path.port-symbol')
                .attr({
                    d: function(d) {
                        return port_symbol(d, _style.smallRadius.eval(d));
                    }
                });
            shimout.each("end", repeat);
        }

        var trans = nonshimmer.transition()
                .duration(250);
        trans.selectAll('.port-outline')
            .call(_style.outline().draw(function(d) {
                return hover_radius(d) + _style.portPadding.eval(d);
            }));
        trans.selectAll('path.port-symbol')
            .attr({
                d: function(d) {
                    return port_symbol(d, hover_radius(d));
                }
            });

        function text_showing(d) {
            return d.state === 'large' || d.state === 'medium';
        }
        trans.selectAll('text.port-label')
            .attr({
                opacity: function(d) {
                    return text_showing(d) ? 1 : 0;
                },
                'pointer-events': function(d) {
                    return text_showing(d) ? 'auto' : 'none';
                }
            });
        trans.selectAll('rect.port-label-background')
            .attr('opacity', function(p) {
                return text_showing(p) ? 1 : 0;
            });
        // bring all nodes which have labels showing to the front
        _node.filter(function(n) {
            return _nodePorts[_style.parent().nodeKey.eval(n)].some(text_showing);
        }).each(function() {
            this.parentNode.appendChild(this);
        });
        // bring all active ports to the front
        symbol.filter(function(p) {
            return p.state !== 'small';
        }).each(function() {
            this.parentNode.appendChild(this);
        });
        return trans;
    };
    _style.eventPort = function() {
        var parent = d3.select(d3.event.target.parentNode);
        if(d3.event.target.parentNode.tagName === 'g' && parent.classed('port'))
            return parent.datum();
        return null;
    };
    _style.drawPorts = function(nodePorts, node) {
        _nodePorts = nodePorts; _node = node;
        var port = node.selectAll('g.port').data(function(n) {
            return nodePorts[_style.parent().nodeKey.eval(n)] || [];
        }, name_or_edge);
        port.exit().remove();
        var portEnter = port.enter().append('g')
            .attr({
                class: 'port',
                transform: port_transform
            });
        port.transition('port-position')
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                transform: port_transform
            });

        var outline = port.selectAll('.port-outline').data(function(p) {
            return outline_fill(p) !== 'none' ? [p] : [];
        });
        outline.exit().remove();
        var outlineEnter = outline.enter().append(_style.outline().tag())
            .attr({
                class: 'port-outline',
                fill: outline_fill,
                'stroke-width': outline_stroke_width,
                stroke: outline_stroke
            });
        if(_style.outline().init)
            outlineEnter.call(_style.outline().init);
        outlineEnter
            .call(_style.outline().draw(function(d) {
                return _style.smallRadius.eval(d) + _style.portPadding.eval(d);
            }));
        outline.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                fill: outline_fill,
                'stroke-width': outline_stroke_width,
                stroke: outline_stroke
            })
            .call(_style.outline().draw(function(d) {
                return _style.smallRadius.eval(d) + _style.portPadding.eval(d);
            }));

        var symbolEnter = portEnter.append('path')
                .attr({
                    class: 'port-symbol',
                    fill: symbol_fill,
                    d: function(d) {
                        return port_symbol(d,  _style.smallRadius.eval(d));
                    }
                });
        var symbol = port.select('path.port-symbol');
        symbol.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                fill: symbol_fill,
                d: function(d) {
                    return port_symbol(d, _style.smallRadius.eval(d));
                }
            });

        var label = port.selectAll('text.port-label').data(function(p) {
            return _style.portLabel.eval(p) ? [p] : [];
        });
        label.exit().remove();
        var labelEnter = label.enter();
        labelEnter.append('rect')
            .attr({
                class: 'port-label-background',
                'pointer-events': 'none'
            });
        labelEnter.append('text')
            .attr({
                class: 'port-label',
                'alignment-baseline': 'middle',
                'pointer-events': 'none',
                cursor: 'default',
                opacity: 0
            });
        label
            .each(function(p) {
                p.offset = (is_left(p) ? -1 : 1) * (_style.largeRadius.eval(p) + _style.portPadding.eval(p));
            })
            .attr({
                'text-anchor': function(d) {
                    return is_left(d) ? 'end' : 'start';
                },
                transform: function(p) {
                    return 'translate(' + p.offset + ',0)';
                }
            })
            .text(_style.portLabel.eval)
            .each(function(p) {
                p.bbox = this.getBBox();
            });
        port.selectAll('rect.port-label-background')
            .attr({
                x: function(p) {
                    return (p.offset < 0 ? p.offset - p.bbox.width : p.offset) - _style.portLabelPadding.eval(p).x;
                },
                y: function(p) {
                    return -p.bbox.height/2 - _style.portLabelPadding.eval(p).y;
                },
                width: function(p) {
                    return p.bbox.width + 2*_style.portLabelPadding.eval(p).x;
                },
                height: function(p) {
                    return p.bbox.height + 2*_style.portLabelPadding.eval(p).y;
                },
                fill: 'white',
                opacity: 0
            });
        _style.enableHover(true);
        return _style;
    };

    _style.enableHover = function(whether) {
        if(!_drawConduct) {
            if(_style.parent()) {
                var draw = _style.parent().child('draw-graphs');
                if(draw)
                    _drawConduct = draw.conduct();
            }
        }
        if(whether) {
            _node.on('mouseover.grow-ports', function(d) {
                var nid = _style.parent().nodeKey.eval(d);
                var activePort = _style.eventPort();
                _nodePorts[nid].forEach(function(p) {
                    p.state = p === activePort ? 'large' : activePort ? 'small' : 'medium';
                });
                var nids = _drawConduct && _drawConduct.hoverPort(activePort) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
            _node.on('mouseout.grow-ports', function(d) {
                var nid = _style.parent().nodeKey.eval(d);
                _nodePorts[nid].forEach(function(p) {
                    p.state = 'small';
                });
                var nids = _drawConduct && _drawConduct.hoverPort(null) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
        } else {
            _node.on('mouseover.grow-ports', null);
            _node.on('mouseout.grow-ports', null);
        }
        return _style;
    };

    _style.parent = property(null);
    return _style;
};

dc_graph.symbol_port_style.outline = {};
dc_graph.symbol_port_style.outline.circle = function() {
    return {
        tag: function() {
            return 'circle';
        },
        draw: function(rf) {
            return function(outlines) {
                outlines.attr('r', function(p) { return rf(p); });
            };
        }
    };
};
dc_graph.symbol_port_style.outline.square = function() {
    return {
        tag: function() {
            return 'rect';
        },
        init: function(outlines) {
            // crispEdges can make outline off-center from symbols
            // outlines.attr('shape-rendering', 'crispEdges');
        },
        draw: function(rf) {
            return function(outlines) {
                outlines.attr({
                    x: function(p) { return -rf(p); },
                    y: function(p) { return -rf(p); },
                    width: function(p) { return 2*rf(p); },
                    height: function(p) { return 2*rf(p); }
                });
            };
        }
    };
};
dc_graph.symbol_port_style.outline.arrow = function() {
    // offset needed for body in order to keep centroid at 0,0
    var left_portion = 3/4 - Math.PI/8;
    return {
        tag: function() {
            return 'path';
        },
        init: function(outlines) {
            //outlines.attr('shape-rendering', 'crispEdges');
        },
        draw: function(rf) {
            return function(outlines) {
                outlines.attr('d', function(p) {
                    var r = rf(p);
                    return 'M' + -left_portion*r + ',' + -r + ' h' + r + ' l' + r + ',' + r + ' l' + -r + ',' + r + ' h' + -r + ' a' + r + ',' + r + ' 0 1,1 0,' + -2*r;
                });
            };
        }
    };
};
