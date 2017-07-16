dc_graph.symbol_port_style = function() {
    var _style = {};

    _style.symbolScale = property(d3.scale.ordinal().range(d3.svg.symbolTypes));
    _style.colorScale = property(d3.scale.ordinal().range(
                ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
                 '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928'])); // colorbrewer

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.portSymbol = property(name_or_edge);
    _style.portColor = property(name_or_edge);
    _style.portSize = property(d3.functor(81));

    function port_fill(d) {
        return _style.colorScale()(_style.portColor()(d));
    }
    function port_transform(d) {
        return 'translate(' + d.pos.x + ',' + d.pos.y + ')';
    }
    _style.drawPorts = function(nodePorts, node) {
        var port = node.selectAll('path.port').data(function(n) {
            return nodePorts[_style.parent().nodeKey.eval(n)] || [];
        });
        port.exit().remove();
        port.enter().append('path')
            .attr({
                class: 'port',
                fill: port_fill,
                transform: port_transform
            });
        port.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr({
                fill: port_fill,
                transform: port_transform,
                d: function(d) {
                    return d3.svg.symbol()
                        .type(_style.symbolScale()(_style.portSymbol()(d))) // why no eval here (does that system make sense?)
                        .size(_style.portSize()(d))
                    ();
                }
            });
        return _style;
    };

    _style.parent = property(null);
    return _style;
};
