import { select, event as d3Event } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { shuffle, range } from 'd3-array';
import { set } from 'd3-collection';
import { symbols, symbol } from 'd3-shape';
import { easeBounce, easeSin } from 'd3-ease';
import { property, getBBoxNoThrow, identity } from './core.js';
import { cascade } from './utils.js';

export function symbolPortStyle() {
    var _style = {};
    var _nodePorts, _node;
    var _drawConduct;

    _style.symbolScale = property(null);
    _style.colorScale = property(scaleOrdinal().range(
         // colorbrewer light qualitative scale
        shuffle(['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462',
                    '#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'])));

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.symbol = _style.portSymbol = property(name_or_edge, false); // non standard properties taking "outer datum"
    _style.color = _style.portColor = property(name_or_edge, false);
    _style.outline = property(symbolPortStyle.outline.circle());
    _style.content = property(symbolPortStyle.content.d3symbol());
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

    _style.portPosition = function(p) {
        var l = Math.hypot(p.pos.x, p.pos.y),
            u = {x: p.pos.x / l, y: p.pos.y / l},
            disp = _style.displacement.eval(p);
        return {x: p.pos.x + disp * u.x, y: p.pos.y + disp * u.y};
    };

    _style.portBounds = function(p) {
        var R = _style.largeRadius.eval(p),
            pos = _style.portPosition(p);
        return {
            left: pos.x - R/2,
            top: pos.y - R/2,
            right: pos.x + R/2,
            bottom: pos.y + R/2
        };
    };

    function symbol_fill(p) {
        var symcolor = _style.color.eval(p);
        return symcolor ?
            (_style.colorScale() ? _style.colorScale()(symcolor) : symcolor) :
        'none';
    }
    function port_transform(p) {
        var pos = _style.portPosition(p);
        return 'translate(' + pos.x + ',' + pos.y + ')';
    }
    function port_symbol(p) {
        if(!_style.symbolScale())
            _style.symbolScale(scaleOrdinal().range(shuffle(_style.content().enum())));
        var symname = _style.symbol.eval(p);
        return symname && (_style.symbolScale() ? _style.symbolScale()(symname) : symname);
    }
    function is_left(p) {
        return p.vec[0] < 0;
    }
    function hover_radius(p) {
        switch(p.state) {
        case 'large':
            return _style.largeRadius.eval(p);
        case 'medium':
            return _style.mediumRadius.eval(p);
        case 'small':
        default:
            return _style.smallRadius.eval(p);
        }
    }
    function shimmer_radius(p) {
        return /-medium$/.test(p.state) ?
            _style.mediumRadius.eval(p) :
            _style.largeRadius.eval(p);
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
        var setn = set(nids);
        var node = _node
                .filter(function(n) {
                    return setn.has(_style.parent().nodeKey.eval(n));
                });
        var symbol = _style.parent().selectNodePortsOfStyle(node, _style.parent().portStyle.nameOf(this));
        var shimmer = symbol.filter(function(p) { return /^shimmer/.test(p.state); }),
            nonshimmer = symbol.filter(function(p) { return !/^shimmer/.test(p.state); });
        if(shimmer.size()) {
            if(before)
                before.on('end', repeat);
            else repeat();
        }

        function repeat() {
            var shimin = shimmer.transition()
                    .duration(1000)
                    .ease(easeBounce);
            shimin.selectAll('.port-outline')
                .call(_style.outline().draw(function(p) {
                    return shimmer_radius(p) + _style.portPadding.eval(p);
                }));
            shimin.selectAll('.port-symbol')
                .call(_style.content().draw(port_symbol, shimmer_radius));
            var shimout = shimin.transition()
                    .duration(1000)
                    .ease(easeSin);
            shimout.selectAll('.port-outline')
                .call(_style.outline().draw(function(p) {
                    return _style.smallRadius.eval(p) + _style.portPadding.eval(p);
                }));
            shimout.selectAll('.port-symbol')
                .call(_style.content().draw(port_symbol, _style.smallRadius.eval));
            shimout.on("end", repeat);
        }

        var trans = nonshimmer.transition()
                .duration(250);
        trans.selectAll('.port-outline')
            .call(_style.outline().draw(function(p) {
                return hover_radius(p) + _style.portPadding.eval(p);
            }));
        trans.selectAll('.port-symbol')
            .call(_style.content().draw(port_symbol, hover_radius));

        const text_showing = (p) => {
            return p.state === 'large' || p.state === 'medium';
        }
        trans.selectAll('text.port-label')
            .attr('opacity', (p) => {
                return text_showing(p) ? 1 : 0;
            })
            .attr('pointer-events', (p) => {
                return text_showing(p) ? 'auto' : 'none';
            });
        trans.selectAll('rect.port-label-background')
            .attr('opacity', function(p) {
                return text_showing(p) ? 1 : 0;
            });
        // bring all nodes which have labels showing to the front
        _node.filter(function(n) {
            var ports = _nodePorts[_style.parent().nodeKey.eval(n)];
            return ports && ports.some(text_showing);
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
    _style.eventPort = function(event) {
        // In D3 v5, use the global event if no event passed
        const evt = event || d3Event;
        if(!evt || !evt.target) return null;
        var parent = select(evt.target.parentNode);
        if(evt.target.parentNode.tagName === 'g' && parent.classed('port'))
            return parent.datum();
        return null;
    };
    _style.drawPorts = function(ports, nodePorts, node) {
        _nodePorts = nodePorts; _node = node;
        const port = ports.data(function(n) {
            return nodePorts[_style.parent().nodeKey.eval(n)] || [];
        }, name_or_edge)
        .join('g')
        .attr('class', 'port')
        .attr('transform', port_transform);
        port.transition('port-position')
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr('transform', port_transform);

        const outline = port.selectAll('.port-outline').data(function(p) {
            return outline_fill(p) !== 'none' ? [p] : [];
        })
        .join(
            enter => {
                const outlineEnter = enter.append(_style.outline().tag())
                    .attr('class', 'port-outline')
                    .attr('fill', outline_fill)
                    .attr('stroke-width', outline_stroke_width)
                    .attr('stroke', outline_stroke);
                if(_style.outline().init)
                    outlineEnter.call(_style.outline().init);
                outlineEnter
                    .call(_style.outline().draw(function(p) {
                        return _style.smallRadius.eval(p) + _style.portPadding.eval(p);
                    }));
                return outlineEnter;
            },
            update => update,
            exit => exit.remove()
        );
        // only position and size are animated (?) - anyway these are not on the node
        // and they are typically used to indicate selection which should be fast
        outline
            .attr('fill', outline_fill)
            .attr('stroke-width', outline_stroke_width)
            .attr('stroke', outline_stroke);
        outline.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .call(_style.outline().draw(function(p) {
                return _style.smallRadius.eval(p) + _style.portPadding.eval(p);
            }));

        const symbol = port.selectAll('.port-symbol')
            .data(d => [d])
            .join(_style.content().tag())
            .attr('class', 'port-symbol')
            .call(_style.content().draw(port_symbol, _style.smallRadius.eval));
        symbol.attr('fill', symbol_fill);
        symbol.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .call(_style.content().draw(port_symbol, _style.smallRadius.eval));

        const labelGroup = port.selectAll('g.port-label-group').data(function(p) {
            return _style.portLabel.eval(p) ? [p] : [];
        })
        .join(
            enter => {
                const group = enter.append('g')
                    .attr('class', 'port-label-group');
                group.append('rect')
                    .attr('class', 'port-label-background')
                    .attr('pointer-events', 'none');
                group.append('text')
                    .attr('class', 'port-label')
                    .attr('dominant-baseline', 'middle')
                    .attr('pointer-events', 'none')
                    .attr('cursor', 'default')
                    .attr('opacity', 0);
                return group;
            }
        );
        
        labelGroup.select('text.port-label')
            .each(function(p) {
                p.offset = (is_left(p) ? -1 : 1) * (_style.largeRadius.eval(p) + _style.portPadding.eval(p));
            })
            .attr('text-anchor', p => is_left(p) ? 'end' : 'start')
            .attr('transform', p => 'translate(' + p.offset + ',0)')
            .text(_style.portLabel.eval)
            .each(function(p) {
                p.bbox = getBBoxNoThrow(this);
            });
        labelGroup.select('rect.port-label-background')
            .attr('x', p => (p.offset < 0 ? p.offset - p.bbox.width : p.offset) - _style.portLabelPadding.eval(p).x)
            .attr('y', p => -p.bbox.height/2 - _style.portLabelPadding.eval(p).y)
            .attr('width', p => p.bbox.width + 2*_style.portLabelPadding.eval(p).x)
            .attr('height', p => p.bbox.height + 2*_style.portLabelPadding.eval(p).y)
            .attr('fill', 'white')
            .attr('opacity', 0);
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
        var namespace = 'grow-ports-' + _style.parent().portStyle.nameOf(this);
        if(whether) {
            _node.on('mouseover.' + namespace, function(d) {
                // In D3 v5, use global event and data is first parameter
                var nid = _style.parent().nodeKey.eval(d);
                var activePort = _style.eventPort();
                if(_nodePorts[nid])
                    _nodePorts[nid].forEach(function(p) {
                        p.state = p === activePort ? 'large' : activePort ? 'small' : 'medium';
                    });
                var nids = _drawConduct && _drawConduct.hoverPort(activePort) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
            _node.on('mouseout.' + namespace, function(n) {
                var nid = _style.parent().nodeKey.eval(n);
                if(_nodePorts[nid])
                    _nodePorts[nid].forEach(function(p) {
                        p.state = 'small';
                    });
                var nids = _drawConduct && _drawConduct.hoverPort(null) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
        } else {
            _node.on('mouseover.' + namespace, null);
            _node.on('mouseout.' + namespace, null);
        }
        return _style;
    };

    _style.parent = property(null);
    return _style;
};

symbolPortStyle.outline = {};
symbolPortStyle.outline.circle = function() {
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
symbolPortStyle.outline.square = function() {
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
                outlines.attr('x', p => -rf(p))
                    .attr('y', p => -rf(p))
                    .attr('width', p => 2*rf(p))
                    .attr('height', p => 2*rf(p));
            };
        }
    };
};
symbolPortStyle.outline.arrow = function() {
    // offset needed for body in order to keep centroid at 0,0
    var left_portion = 3/4 - Math.PI/8;
    var _outline = {
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
                    if(!_outline.outie() || _outline.outie()(p.orig))
                        return 'M' + -left_portion*r + ',' + -r + ' h' + r +
                        ' l' + r + ',' + r + ' l' + -r + ',' + r +
                        ' h' + -r +
                        ' a' + r + ',' + r + ' 0 1,1 0,' + -2*r;
                    else
                        return 'M' + -(2-left_portion)*r + ',' + -r + ' h' + 2*r +
                        ' a' + r + ',' + r + ' 0 1,1 0,' + 2*r +
                        ' h' + -2*r +
                        ' l' + r + ',' + -r + ' l' + -r + ',' + -r;
                });
            };
        },
        outie: property(null)
    };
    return _outline;
};

symbolPortStyle.content = {};
symbolPortStyle.content.d3symbol = function() {
    var _symbol = {
        tag: function() {
            return 'path';
        },
        enum: function() {
            return symbols;
        },
        draw: function(symf, rf) {
            return function(symbols) {
                symbols.attr('d', function(p) {
                    var sym = symf(p), r = rf(p);
                    return sym ? symbol()
                        .type(sym)
                        .size(r*r)
                    () : '';
                });
                symbols.attr('transform', function(p) {
                    switch(symf(p)) {
                    case 'triangle-up':
                        return 'translate(0, -1)';
                    case 'triangle-down':
                        return 'translate(0, 1)';
                    default: return null;
                    }
                });
            };
        }
    };
    return _symbol;
};
symbolPortStyle.content.letter = function() {
    var _symbol = {
        tag: function() {
            return 'text';
        },
        enum: function() {
            return range(65, 91).map(String.fromCharCode);
        },
        draw: function(symf, rf) {
            return function(symbols) {
                symbols.text(symf)
                    .attr('dominant-baseline', 'middle')
                    .attr('text-anchor', 'middle');
                symbols.each(function(p) {
                    if(!p.symbol_size)
                        p.symbol_size = getBBoxNoThrow(this);
                });
                symbols.attr('transform', function(p) {
                    return 'scale(' + (2*rf(p)/p.symbol_size.height) +
                        ') translate(' + [0,2].join(',') + ')';
                });
            };
        }
    };
    return _symbol;
};
