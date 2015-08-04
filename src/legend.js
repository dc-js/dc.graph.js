/**
## Legend

The dc_graph.legend will show labeled examples of nodes (and someday edges), within the frame of a dc_graph.diagram.
**/
dc_graph.legend = function() {
    var _legend = {};
    var _g = null;

    /**
     #### .x([value])
     Set or get x coordinate for legend widget. Default: 0.
     **/
    _legend.x = property(0);

    /**
     #### .y([value])
     Set or get y coordinate for legend widget. Default: 0.
     **/
    _legend.y = property(0);

    /**
     #### .gap([value])
     Set or get gap between legend items. Default: 5.
     **/
    _legend.gap = property(5);

    /**
     #### .nodeWidth([value])
     Set or get legend node width. Default: 30.
     **/
    _legend.nodeWidth = property(40);

    /**
     #### .nodeHeight([value])
     Set or get legend node height. Default: 30.
     **/
    _legend.nodeHeight = property(40);


    /**
     #### .exemplars([object])
     Specifies an object where the keys are the names of items to add to the legend, and the values are
     objects which will be passed to the accessors of the attached diagram in order to determine the
     drawing attributes.
     **/
    _legend.exemplars = property({});

    _legend.parent = property(null);

    _legend.render = function() {
        var enter = _legend.parent().svg()
                .selectAll('g.dc-graph-legend')
                .data([0]).enter();
        _g = enter.append('g')
            .attr('class', 'dc-graph-legend')
            .attr('transform', 'translate(' + _legend.x() + ',' + _legend.y() + ')');

        var items = [], exemplars = _legend.exemplars();
        for(var item in exemplars)
            items.push({orig: {key: item, value: exemplars[item]}});

        var node = _g.selectAll('.node')
                .data(items, function(d) { return d.orig.key; });
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('transform', function(d, i) {
                    return 'translate(' + _legend.nodeWidth()/2 + ',' + (_legend.nodeHeight() + _legend.gap())*(i+0.5) + ')';
                });
        nodeEnter.append('text')
            .attr('class', 'legend-label')
            .attr('transform', 'translate(' + (_legend.nodeWidth()/2+_legend.gap()) + ',0)')
            //.attr('dominant-baseline', 'middle')
            .text(function(d) {
                return d.orig.key;
            });
        _legend.parent()._buildNode(node, nodeEnter);
    };

    return _legend;
};
