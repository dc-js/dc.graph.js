/**
## Legend

The dc_graph.legend will show labeled examples of nodes (and someday edges), within the frame of a dc_graph.diagram.
**/
dc_graph.legend = function() {
    var _legend = {}, _items, _included = [];
    var _dispatch = d3.dispatch('filtered');
    var _totals, _counts;

    function apply_filter() {
        if(_legend.dimension()) {
            _legend.dimension().filterFunction(function(k) {
                return !_included.length || _included.includes(k);
            });
            _legend.redraw();
            _legend.parent().redraw();
        }
    }

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
     #### .noLabel([value])
     Remove node labels, since legend labels are displayed outside of nodes instead. Default: true
    **/
    _legend.noLabel = property(true);

    _legend.counter = property(null);

    _legend.replaceFilter = function(filter) {
        if(filter && filter.length === 1)
            _included = filter[0];
        else
            _included = [];
        return _legend;
    };

    _legend.filters = function() {
        return _included;
    };

    _legend.on = function(type, f) {
        _dispatch.on(type, f);
        return _legend;
    };

    /**
     #### .exemplars([object])
     Specifies an object where the keys are the names of items to add to the legend, and the values are
     objects which will be passed to the accessors of the attached diagram in order to determine the
     drawing attributes. Alternately, if the key needs to be specified separately from the name, the
     function can take an array of {name, key, value} objects.
     **/
    _legend.exemplars = property({});

    _legend.parent = property(null).react(function(p) {
        if(p)
            p.on('data.legend', on_data);
        else _legend.parent().on('data.legend', null);
    });

    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        if(_legend.counter())
            _counts = _legend.counter()(wnodes.map(get_original), wedges.map(get_original), wports.map(get_original));
    }

    _legend.redraw = function() {
        var legend = _legend.parent().svg()
                .selectAll('g.dc-graph-legend')
                .data([0]);
        legend.enter().append('g')
            .attr('class', 'dc-graph-legend')
            .attr('transform', 'translate(' + _legend.x() + ',' + _legend.y() + ')');

        var node = legend.selectAll('.node')
                .data(_items, function(n) { return n.name; });
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node');
        nodeEnter.append('text')
            .attr('dy', '0.3em')
            .attr('class', 'legend-label');
        node
            .attr('transform', function(n, i) {
                return 'translate(' + _legend.nodeWidth()/2 + ',' + (_legend.nodeHeight() + _legend.gap())*(i+0.5) + ')';
            });
        node.select('text.legend-label')
            .attr('transform', 'translate(' + (_legend.nodeWidth()/2+_legend.gap()) + ',0)')
            .attr('pointer-events', _legend.dimension() ? 'auto' : 'none')
            .text(function(n) {
                return n.name + (_legend.counter() && _counts ? (' (' + (_counts[n.name] || 0) + (_counts[n.name] !== _totals[n.name] ? '/' + (_totals[n.name] || 0) : '') + ')') : '');
            });
        _legend.parent()
            ._enterNode(nodeEnter)
            ._updateNode(node);
        if(_legend.noLabel())
            node.selectAll('.node-label').remove();

        if(_legend.dimension()) {
            node.attr('cursor', 'pointer')
                .on('click.legend', function(d) {
                    var key = _legend.parent().nodeKey.eval(d);
                    if(!_included.length)
                        _included = _items.map(_legend.parent().nodeKey.eval);
                    if(_included.includes(key))
                        _included = _included.filter(function(x) { return x !== key; });
                    else
                        _included.push(key);
                    apply_filter();
                    _dispatch.filtered(_legend, key);
                });
        } else {
            node.attr('cursor', 'auto')
                .on('click.legend', null);
        }
        node.transition().duration(1000)
            .attr('opacity', function(d) {
                return (!_included.length || _included.includes(_legend.parent().nodeKey.eval(d))) ? 1 : 0.25;
            });
    };

    _legend.countBaseline = function() {
        if(_legend.counter)
            _totals = _legend.counter()(
                _legend.parent().nodeGroup().all(),
                _legend.parent().edgeGroup().all(),
                _legend.parent().portGroup() && _legend.parent().portGroup().all());
    };

    _legend.render = function() {
        var exemplars = _legend.exemplars();
        _legend.countBaseline();
        if(exemplars instanceof Array) {
            _items = exemplars.map(function(v) { return {name: v.name, orig: {key: v.key, value: v.value}, cola: {}}; });
        }
        else {
            _items = [];
            for(var item in exemplars)
                _items.push({name: item, orig: {key: item, value: exemplars[item]}, cola: {}});
        }
        _legend.redraw();
    };

    /* enables filtering */
    _legend.dimension = property(null)
        .react(function(v) {
            if(!v) {
                _included = [];
                apply_filter();
            }
        });

    return _legend;
};
