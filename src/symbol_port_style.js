dc_graph.symbol_port_style = function() {
    var _style = {};

    _style.symbolScale = property(d3.shuffle(d3.scale.ordinal().range(d3.svg.symbolTypes)));
    _style.colorScale = property(d3.scale.ordinal().range(
        d3.shuffle(['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
                    '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928']))); // colorbrewer

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.portSymbol = property(name_or_edge);
    _style.portColor = property(name_or_edge);
    _style.portRadius = property(d3.functor(10));
    _style.portDisplacement = property(d3.functor(2));
    _style.portBackground = property(d3.functor(true));
    _style.portPadding = property(d3.functor(2));

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
    // yuk but correct
    function node_fill() {
        var scale = _style.parent().nodeFillScale() || identity;
        return scale(_style.parent().nodeFill.eval(d3.select(this.parentNode.parentNode).datum()));
    }
    _style.drawPorts = function(nodePorts, node) {
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
        return _style;
    };

    _style.parent = property(null);
    return _style;
};
