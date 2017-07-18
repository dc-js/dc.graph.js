dc_graph.symbol_port_style = function() {
    var _style = {};
    var _nodePorts, _node;

    _style.symbolScale = property(d3.shuffle(d3.scale.ordinal().range(d3.svg.symbolTypes)));
    _style.colorScale = property(d3.scale.ordinal().range(
        d3.shuffle(['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
                    '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928']))); // colorbrewer

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.portSymbol = property(name_or_edge);
    _style.portColor = property(name_or_edge);
    _style.portRadius = property(d3.functor(7));
    _style.portHoverNodeRadius = property(d3.functor(10));
    _style.portHoverPortRadius = property(d3.functor(14));
    _style.portDisplacement = property(d3.functor(2));
    _style.portBackground = property(d3.functor(true));
    _style.portPadding = property(d3.functor(2));
    _style.portText = property(function(p) {
        return p.name;
    });

    function port_fill(d) {
        return _style.colorScale()(_style.portColor()(d));
    }
    function port_transform(d) {
        var l = Math.hypot(d.pos.x, d.pos.y),
            u = {x: d.pos.x / l, y: d.pos.y / l},
            disp = _style.portDisplacement()(d),
            pos = {x: d.pos.x + disp * u.x, y: d.pos.y + disp * u.y};
        return 'translate(' + pos.x + ',' + pos.y + ')';
    }
    function port_symbol(d, size) {
        return d3.svg.symbol()
            .type(_style.symbolScale()(_style.portSymbol()(d))) // why no eval here (does that system make sense?)
            .size(size*size)
        ();
    }
    function is_left(d) {
        return Math.abs(d.theta) > Math.PI/2;
    }
    function hover_radius(d) {
        switch(d.state) {
        case 'hovered':
            return _style.portHoverPortRadius()(d);
        case 'node-hovered':
            return _style.portHoverNodeRadius()(d);
        case 'sibling-hovered':
        case 'inactive':
        default:
            return _style.portRadius()(d);
        }
    }
    // yuk but correct
    function node_fill() {
        var scale = _style.parent().nodeFillScale() || identity;
        return scale(_style.parent().nodeFill.eval(d3.select(this.parentNode.parentNode).datum()));
    }
    _style.animateNodes = function(nids) {
        var setn = d3.set(nids);
        var node = _node
                .filter(function(d) {
                    return setn.has(_style.parent().nodeKey.eval(d));
                });
        node.selectAll('circle.port')
            .transition()
            .duration(250)
            .attr({
                r: function(d) {
                    return hover_radius(d) + _style.portPadding()(d);
                }
            });
        var symbol = node.selectAll('path.port');
        var shimmer = symbol.filter(function(p) { return p.state === 'shimmer'; });
        repeat();

        function repeat() {
            shimmer
              .transition()
                .duration(1000)
                .ease("bounce")
                .attr('r',  _style.portHoverPortRadius())
              .transition()
                .duration(1000)
                .ease("bounce")
                .attr('r',  _style.portRadius())
                .each("end", repeat);
        }

        symbol.filter(function(p) { return p.state !== 'shimmer'; })
            .transition()
            .duration(250)
            .attr({
                d: function(d) {
                    return port_symbol(d, hover_radius(d));
                }
            });
        node.selectAll('text.port')
            .transition()
            .duration(250)
            .attr({
                opacity: function(d) {
                    return d.state === 'hovered' || d.state === 'node-hovered' ? 1 : 0;
                },
                'pointer-events': function(d) {
                    return d.state === 'hovered' || d.state === 'node-hovered' ? 'auto' : 'none';
                }
            });
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
        port.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                transform: port_transform
            });

        var background = port.selectAll('circle.port').data(function(p) {
            return _style.portBackground()(p) ? [p] : [];
        });
        background.exit().remove();
        background.enter().append('circle')
            .attr({
                class: 'port',
                r: 0,
                fill: node_fill,
                nodeStrokeWidth: 0
            });
        background.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                r: function(d) {
                    return _style.portRadius()(d) + _style.portPadding()(d);
                },
                fill: node_fill
            });

        var symbolEnter = portEnter.append('path')
                .attr({
                    class: 'port',
                    fill: port_fill,
                    d: function(d) {
                        return port_symbol(d, 0);
                    }
                });
        var symbol = port.select('path.port');
        symbol.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                fill: port_fill,
                d: function(d) {
                    return port_symbol(d, _style.portRadius()(d));
                }
            });

        var label = port.selectAll('text.port').data(function(p) {
            return _style.portText()(p) ? [p] : [];
        });
        label.exit().remove();
        label.enter().append('text')
            .attr({
                class: 'port',
                'alignment-baseline': 'middle',
                'pointer-events': 'none',
                cursor: 'default',
                opacity: 0
            });
        label
            .attr({
                'text-anchor': function(d) {
                    return is_left(d) ? 'end' : 'start';
                },
                transform: function(d) {
                    return 'translate(' + (is_left(d) ? -1 : 1) * (_style.portHoverPortRadius()(d) + _style.portPadding()(d)) + ',0)';
                }
            })
            .text(_style.portText());

        node.on('mouseover.grow-ports', function(d) {
            var nid = _style.parent().nodeKey.eval(d);
            var activePort = _style.eventPort();
            nodePorts[nid].forEach(function(p) {
                p.state = p === activePort ? 'hovered' : activePort ? 'sibling-hovered' : 'node-hovered';
            });
            _style.animateNodes([nid]);
        });
        node.on('mouseout.grow-ports', function(d) {
            var nid = _style.parent().nodeKey.eval(d);
            nodePorts[nid].forEach(function(p) {
                p.state = 'inactive';
            });
            _style.animateNodes([nid]);
        });
        return _style;
    };

    _style.parent = property(null);
    return _style;
};
