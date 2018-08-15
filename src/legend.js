/**
## Legend

The dc_graph.legend shows labeled examples of nodes & edges, within the frame of a dc_graph.diagram.
**/
dc_graph.legend = function(legend_namespace) {
    legend_namespace = legend_namespace || 'node-legend';
    var _items, _included = [];
    var _dispatch = d3.dispatch('filtered');
    var _totals, _counts;

    function apply_filter() {
        if(_legend.dimension()) {
            _legend.dimension().filterFunction(function(k) {
                return !_included.length || _included.includes(k);
            });
            _legend.parent().redraw();
        }
    }

    var _legend = dc_graph.behavior(legend_namespace, {
        add_behavior: redraw,
        remove_behavior: function() {},
        parent: function(p) {
            if(p) {
                p
                    .on('render.' + legend_namespace, render)
                    .on('data.' + legend_namespace, on_data);
            }
            else {
                _legend.parent()
                    .on('render.' + legend_namespace, null)
                    .on('data.' + legend_namespace, null);
            }
        }
    });

    /**
     #### .type([value])
     Set or get the handler for the specific type of item to be displayed. Default: dc_graph.legend.node_legend()
     **/
    _legend.type = property(dc_graph.legend.node_legend());

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
     #### .itemWidth([value])
     Set or get width to reserve for legend item. Default: 30.
     **/
    _legend.itemWidth = _legend.nodeWidth = property(40);

    /**
     #### .itemHeight([value])
     Set or get height to reserve for legend item. Default: 30.
    **/
    _legend.itemHeight = _legend.nodeHeight = property(40);

    /**
     #### .noLabel([value])
     Remove item labels, since legend labels are displayed outside of the items. Default: true
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

    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        if(_legend.counter())
            _counts = _legend.counter()(wnodes.map(get_original), wedges.map(get_original), wports.map(get_original));
    }

    function redraw() {
        var legend = _legend.parent().svg()
                .selectAll('g.dc-graph-legend.' + legend_namespace)
                .data([0]);
        legend.enter().append('g')
            .attr('class', 'dc-graph-legend ' + legend_namespace)
            .attr('transform', 'translate(' + _legend.x() + ',' + _legend.y() + ')');

        var item = legend.selectAll(_legend.type().itemSelector())
                .data(_items, function(n) { return n.name; });
        var itemEnter = _legend.type().create(item.enter(), _legend.itemWidth(), _legend.itemHeight());
        itemEnter.append('text')
            .attr('dy', '0.3em')
            .attr('class', 'legend-label');
        item
            .attr('transform', function(n, i) {
                return 'translate(' + _legend.itemWidth()/2 + ',' + (_legend.itemHeight() + _legend.gap())*(i+0.5) + ')';
            });
        item.select('text.legend-label')
            .attr('transform', 'translate(' + (_legend.itemWidth()/2+_legend.gap()) + ',0)')
            .attr('pointer-events', _legend.dimension() ? 'auto' : 'none')
            .text(function(n) {
                return n.name + (_legend.counter() && _counts ? (' (' + (_counts[n.name] || 0) + (_counts[n.name] !== _totals[n.name] ? '/' + (_totals[n.name] || 0) : '') + ')') : '');
            });
        _legend.type().draw(_legend.parent(), itemEnter, item);
        if(_legend.noLabel())
            item.selectAll(_legend.type().labelSelector()).remove();

        if(_legend.dropdown()) {
            var caret = item.selectAll('text.dropdown-caret').data(function(x) { return [x]; });
            caret
              .enter().append('text')
                .attr('dy', '0.3em')
                .attr('font-size', '75%')
                .attr('fill', 'blue')
                .attr('class', 'dropdown-caret')
                .style('visibility', 'hidden')
                .html('&emsp;&#x25BC;');
            caret
                .attr('dx', function(d) {
                    return (_legend.itemWidth()/2+_legend.gap()) + getBBoxNoThrow(d3.select(this.parentNode).select('text.legend-label').node()).width;
                })
                .on('mouseenter', function(n) {
                    var rect = this.getBoundingClientRect();
                    var key = _legend.parent().nodeKey.eval(n);
                    _legend.dropdown()
                        .show(key, rect.x, rect.y);
                });
            item
                .on('mouseenter', function(n) {
                    if(_counts && _counts[n.name]) {
                        d3.select(this).selectAll('.dropdown-caret')
                            .style('visibility', 'visible');
                    }
                })
                .on('mouseleave', function(n) {
                    d3.select(this).selectAll('.dropdown-caret')
                        .style('visibility', 'hidden');
                });
        }

        if(_legend.dimension()) {
            item.attr('cursor', 'pointer')
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
            item.attr('cursor', 'auto')
                .on('click.legend', null);
        }
        item.transition().duration(1000)
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

    function render() {
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
        redraw();
    };

    _legend.dropdown = property(null).react(function(v) {
        if(!!v !== !!_legend.dropdown() && _legend.parent() && _legend.parent().svg())
            window.setTimeout(_legend.redraw, 0);
    });

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


dc_graph.legend.node_legend = function() {
    return {
        itemSelector: function() {
            return '.node';
        },
        labelSelector: function() {
            return '.node-label';
        },
        create: function(selection) {
            return selection.append('g')
                .attr('class', 'node');
        },
        draw: function(diagram, itemEnter, item) {
            diagram
                ._enterNode(itemEnter)
                ._updateNode(item);
        }
    };
};

dc_graph.legend.edge_legend = function() {
    var _type = {
        itemSelector: function() {
            return '.edge-container';
        },
        labelSelector: function() {
            return '.edge-label';
        },
        create: function(selection) {
            var edgeEnter = selection.append('g')
                .attr('class', 'edge-container');
            edgeEnter
                .selectAll('circle')
                .data([-1, 1])
              .enter()
                .append('circle')
                .attr({
                    r: _type.fakeNodeRadius(),
                    fill: 'none',
                    stroke: 'black',
                    opacity: 0.25,
                    transform: function(d) {
                        return 'translate(' + [d * _type.length() / 2, 0].join(',') + ')';
                    }
                });
            edgeEnter = edgeEnter.append('svg:path')
                .attr({
                    class: 'edge',
                    id: function(d) { return d.name; },
                    opacity: 0
                })
            .each(function(e) {
                e.deleted = false;
            });

            return edgeEnter;
        },
        fakeNodeRadius: property(10),
        length: property(50),
        draw: function(diagram, itemEnter, item) {
            diagram._enterEdge(itemEnter);
        }
    };
    return _type;
};
