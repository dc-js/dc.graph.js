/**
## Legend

The dc_graph.legend shows labeled examples of nodes & edges, within the frame of a dc_graph.diagram.
**/
dc_graph.legend = function(legend_namespace) {
    legend_namespace = legend_namespace || 'node-legend';
    var _items, _included = [];
    var _dispatch = d3.dispatch('filtered');
    var _totals, _counts;

    var _svg_renderer;

    function apply_filter() {
        if(_legend.customFilter())
            _legend.customFilter()(_included);
        else if(_legend.dimension()) {
            if(_legend.isTagDimension()) {
                _legend.dimension().filterFunction(function(ks) {
                    return !_included.length || ks.filter(function(k) {
                        return _included.includes(k);
                    }).length;
                });
            } else {
                _legend.dimension().filterFunction(function(k) {
                    return !_included.length || _included.includes(k);
                });
            }
            _legend.parent().redraw();
        }
    }

    var _legend = dc_graph.mode(legend_namespace, {
        renderers: ['svg', 'webgl'],
        draw: redraw,
        remove: function() {},
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

    _legend.dyLabel = property('0.3em');

    _legend.omitEmpty = property(false);

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

    _legend.redraw = deprecate_function("dc_graph.legend is an ordinary mode now; redraw will go away soon", redraw);
    function redraw() {
        var legend = (_svg_renderer || _legend.parent()).svg()
                .selectAll('g.dc-graph-legend.' + legend_namespace)
                .data([0]);
        legend.enter().append('g')
            .attr('class', 'dc-graph-legend ' + legend_namespace)
            .attr('transform', 'translate(' + _legend.x() + ',' + _legend.y() + ')');

        var items = !_legend.omitEmpty() || !_counts ? _items : _items.filter(function(i) {
            return _included.length && !_included.includes(i.orig.key) || _counts[i.orig.key];
        });
        var item = legend.selectAll(_legend.type().itemSelector())
                .data(items, function(n) { return n.name; });
        item.exit().remove();
        var itemEnter = _legend.type().create(_legend.parent(), item.enter(), _legend.itemWidth(), _legend.itemHeight());
        itemEnter.append('text')
            .attr('dy', _legend.dyLabel())
            .attr('class', 'legend-label');
        item
            .attr('transform', function(n, i) {
                return 'translate(' + _legend.itemWidth()/2 + ',' + (_legend.itemHeight() + _legend.gap())*(i+0.5) + ')';
            });
        item.select('text.legend-label')
            .attr('transform', 'translate(' + (_legend.itemWidth()/2+_legend.gap()) + ',0)')
            .attr('pointer-events', _legend.dimension() ? 'auto' : 'none')
            .text(function(d) {
                return d.name + (_legend.counter() && _counts ? (' (' + (_counts[d.orig.key] || 0) + (_counts[d.orig.key] !== _totals[d.orig.key] ? '/' + (_totals[d.orig.key] || 0) : '') + ')') : '');
            });
        _legend.type().draw(_svg_renderer || _legend.parent(), itemEnter, item);
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
                .on('mouseenter.' + legend_namespace, function(n) {
                    var rect = this.getBoundingClientRect();
                    var key = _legend.parent().nodeKey.eval(n);
                    _legend.dropdown()
                        .show(key, rect.x, rect.y);
                });
            item
                .on('mouseenter.' + legend_namespace, function(d) {
                    if(_counts && _counts[d.orig.key]) {
                        d3.select(this).selectAll('.dropdown-caret')
                            .style('visibility', 'visible');
                    }
                })
                .on('mouseleave.' + legend_namespace, function(d) {
                    d3.select(this).selectAll('.dropdown-caret')
                        .style('visibility', 'hidden');
                });
        }

        if(_legend.dimension()) {
            item.attr('cursor', 'pointer')
                .on('click.' + legend_namespace, function(d) {
                    var key = _legend.parent().nodeKey.eval(d);
                    if(!_included.length && !_legend.isInclusiveDimension())
                        _included = _items.map(_legend.parent().nodeKey.eval);
                    if(_included.includes(key))
                        _included = _included.filter(function(x) { return x !== key; });
                    else
                        _included.push(key);
                    apply_filter();
                    _dispatch.filtered(_legend, key);
                    if(_svg_renderer)
                        window.setTimeout(redraw, 250);
                });
        } else {
            item.attr('cursor', 'auto')
                .on('click.' + legend_namespace, null);
        }
        item.transition().duration(1000)
            .attr('opacity', function(d) {
                return (!_included.length || _included.includes(_legend.parent().nodeKey.eval(d))) ? 1 : 0.25;
            });
    };

    _legend.countBaseline = function() {
        if(_legend.counter())
            _totals = _legend.counter()(
                _legend.parent().nodeGroup().all(),
                _legend.parent().edgeGroup().all(),
                _legend.parent().portGroup() && _legend.parent().portGroup().all());
    };

    _legend.render = deprecate_function("dc_graph.legend is an ordinary mode now; render will go away soon", render);
    function render() {
        if(_legend.parent().renderer().rendererType() !== 'svg') {
            _svg_renderer = dc_graph.render_svg();
            _svg_renderer.parent(_legend.parent())
                .svg(_legend.parent().root().append('svg')
                     .style({
                         position: 'absolute',
                         left: 0, top: 0,
                         width: '100%', height: '100%',
                         fill: 'wheat',
                         'pointer-events': 'none'
                     }));
        }


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
        if(!!v !== !!_legend.dropdown() && _legend.parent() && (_svg_renderer || _legend.parent()).svg())
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
    _legend.isInclusiveDimension = property(false);
    _legend.isTagDimension = property(false);
    _legend.customFilter = property(null);

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
        create: function(diagram, selection) {
            return selection.append('g')
                .attr('class', 'node');
        },
        draw: function(renderer, itemEnter, item) {
            renderer
                .renderNode(itemEnter)
                .redrawNode(item);
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
        create: function(diagram, selection, w, h) {
            var edgeEnter = selection.append('g')
                .attr('class', 'edge-container')
                .attr('opacity', 0);
            edgeEnter
                .append('rect')
                .attr({
                    x: -w/2,
                    y: -h/2,
                    width: w,
                    height: h,
                    fill: 'green',
                    opacity: 0
                });
            edgeEnter
                .selectAll('circle')
                .data([-1, 1])
              .enter()
                .append('circle')
                .attr({
                    r: _type.fakeNodeRadius(),
                    fill: 'none',
                    stroke: 'black',
                    "stroke-dasharray": "4,4",
                    opacity: 0.15,
                    transform: function(d) {
                        return 'translate(' + [d * _type.length() / 2, 0].join(',') + ')';
                    }
                });
            var edgex = _type.length()/2 - _type.fakeNodeRadius();
            edgeEnter.append('svg:path')
                .attr({
                    class: 'edge',
                    id: function(d) { return d.name; },
                    d: 'M' + -edgex + ',0 L' + edgex + ',0',
                    opacity: diagram.edgeOpacity.eval
                });

            return edgeEnter;
        },
        fakeNodeRadius: property(10),
        length: property(50),
        draw: function(renderer, itemEnter, item) {
            renderer.redrawEdge(itemEnter.select('path.edge'), renderer.selectAllEdges('.edge-arrows'));
        }
    };
    return _type;
};

dc_graph.legend.symbol_legend = function(symbolScale) {
    return {
        itemSelector: function() {
            return '.symbol';
        },
        labelSelector: function() {
            return '.symbol-label';
        },
        create: function(diagram, selection, w, h) {
            var symbolEnter = selection.append('g')
                .attr('class', 'symbol');
            return symbolEnter;
        },
        draw: function(renderer, symbolEnter, symbol) {
            symbolEnter.append('text')
                .html(function(d) {
                    return symbolScale(d.orig.key);
                });
            return symbolEnter;
        }
    };
};
