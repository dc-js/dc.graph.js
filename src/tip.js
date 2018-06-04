/**
 * Asynchronous [d3.tip](https://github.com/Caged/d3-tip) support for dc.graph.js
 *
 * Add tooltips to the nodes and edges of a graph using an asynchronous callback to get
 * the html to show.
 *
 * Optional - requires separately loading the d3.tip script and CSS (which are included in
 * dc.graph.js in `web/js/d3-tip/index.js` and `web/css/d3-tip/example-styles.css`)
 *
 * @class tip
 * @memberof dc_graph
 * @return {Object}
 **/
dc_graph.tip = function(options) {
    options = options || {};
    var _namespace = options.namespace || 'tip';
    var _d3tip = null;
    var _showTimeout, _hideTimeout;

    function init(parent) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; })
                .direction(_behavior.direction());
            if(_behavior.offset())
                _d3tip.offset(_behavior.offset());
            parent.svg().call(_d3tip);
        }
    }
    function fetch_and_show_content(fetcher) {
        return function(d) {
             var target = this,
                 next = function() {
                     _behavior[fetcher]()(d, function(content) {
                         _d3tip.show.call(target, content, target);
                         d3.select('div.d3-tip')
                             .selectAll('a.tip-link')
                             .on('click', function() {
                                 d3.event.preventDefault();
                                 if(_behavior.linkCallback())
                                     _behavior.linkCallback()(this.id);
                             });
                     });
                 };
             if(_behavior.selection().exclude && _behavior.selection().exclude(d3.event.target)) {
                 hide_tip.call(this);
                 return;
             }
             if(_hideTimeout)
                 window.clearTimeout(_hideTimeout);
             if(_behavior.delay()) {
                 window.clearTimeout(_showTimeout);
                 _showTimeout = window.setTimeout(next, _behavior.delay());
             }
             else next();
         };
    }

    function hide_tip() {
        if(d3.event.relatedTarget &&
           (!_behavior.selection().exclude || !_behavior.selection().exclude(d3.event.target)) &&
           (this.contains(d3.event.relatedTarget) || // do not hide when mouse is still over a child
            _behavior.clickable() && d3.event.relatedTarget.classList.contains('d3-tip')))
            return;
        if(_showTimeout) {
            window.clearTimeout(_showTimeout);
            _showTimeout = null;
        }
        if(_behavior.clickable())
            _hideTimeout = window.setTimeout(function () {
                _d3tip.hide();
            }, _behavior.hideDelay());
        else
            _d3tip.hide();
    }

    function add_behavior(diagram, node, edge, ehover) {
        init(diagram);
        _behavior.selection().select(diagram, node, edge, ehover)
            .on('mouseover.' + _namespace, fetch_and_show_content('content'))
            .on('mouseout.' + _namespace, hide_tip);
        if(_behavior.clickable()) {
            d3.select('div.d3-tip')
                .on('mouseover.' + _namespace, function() {
                    if(_hideTimeout)
                        window.clearTimeout(_hideTimeout);
                })
                .on('mouseout.' + _namespace, hide_tip);
        }
    }
    function remove_behavior(diagram, node, edge, ehover) {
        _behavior.selection().select(diagram, node, edge, ehover)
            .on('mouseover.' + _namespace, null)
            .on('mouseout.' + _namespace, null);
    }

    var _behavior = dc_graph.behavior(_namespace, {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        laterDraw: true
    });
    /**
     * Specify the direction for tooltips. Currently supports the
     * [cardinal and intercardinal directions](https://en.wikipedia.org/wiki/Points_of_the_compass) supported by
     * [d3.tip.direction](https://github.com/Caged/d3-tip/blob/master/docs/positioning-tooltips.md#tipdirection):
     * `'n'`, `'ne'`, `'e'`, etc.
     * @name direction
     * @memberof dc_graph.tip
     * @instance
     * @param {String} [direction='n']
     * @return {String}
     * @return {dc_graph.tip}
     * @example
     * // show all the attributes and values in the node and edge objects
     * var tip = dc_graph.tip();
     * tip.content(tip.table());
     **/
    _behavior.direction = property('n');

    /**
     * Specifies the function to generate content for the tooltip. This function has the
     * signature `function(d, k)`, where `d` is the datum of the thing being hovered over,
     * and `k` is a continuation. The function should fetch the content, asynchronously if
     * needed, and then pass html forward to `k`.
     * @name content
     * @memberof dc_graph.tip
     * @instance
     * @param {Function} [content]
     * @return {Function}
     * @example
     * // Default behavior: assume it's a node, show node title
     * var tip = dc_graph.tip().content(function(n, k) {
     *     k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(n) : '');
     * });
     **/
    _behavior.content = property(function(n, k) {
        k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(n) : '');
    });

    _behavior.displayTip = function(filter, n) {
        var found = _behavior.selection().select(_behavior.parent(), _behavior.parent().selectAllNodes(), _behavior.parent().selectAllEdges(), null)
            .filter(filter);
        if(found.size() > 0) {
            var action = fetch_and_show_content('content');
            var which = (n || 0) % found.size();
            action.call(found[0][which], d3.select(found[0][which]).datum());
        }
    };
    _behavior.selection = property(dc_graph.tip.select_node_and_edge());
    _behavior.showDelay = _behavior.delay = property(0);
    _behavior.hideDelay = property(200);
    _behavior.offset = property(null);
    _behavior.clickable = property(false);
    _behavior.linkCallback = property(null);

    return _behavior;
};

/**
 * Generates a handler which can be passed to `tip.content` to produce a table of the
 * attributes and values of the hovered object.
 *
 * Note: this interface is not great and is subject to change in the near term.
 * @name table
 * @memberof dc_graph.tip
 * @instance
 * @return {Function}
 * @example
 * // show all the attributes and values in the node and edge objects
 * var tip = dc_graph.tip();
 * tip.content(dc_graph.tip.table());
 **/
dc_graph.tip.table = function() {
    var gen = function(d, k) {
        d = d.orig.value;
        var keys = Object.keys(d).filter(d3.functor(gen.filter()))
                .filter(function(k) {
                    return d[k];
                });
        var table = d3.select(document.createElement('table'));
        var rows = table.selectAll('tr').data(keys);
        var rowsEnter = rows.enter().append('tr');
        rowsEnter.append('td').text(function(k) { return k; });
        rowsEnter.append('td').text(function(k) { return d[k]; });
        k(table.node().outerHTML); // optimizing for clarity over speed (?)
    };
    gen.filter = property(true);
    return gen;
};

dc_graph.tip.select_node_and_edge = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            // hack to merge selections, not supported d3v3
            var selection = diagram.selectAll('.foo-this-does-not-exist');
            selection[0] = node[0].concat(ehover ? ehover[0] : []);
            return selection;
        },
        exclude: function(element) {
            return ancestor_has_class(element, 'port');
        }
    };
};

dc_graph.tip.select_node = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            return node;
        },
        exclude: function(element) {
            return ancestor_has_class(element, 'port');
        }
    };
};

dc_graph.tip.select_edge = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            return edge;
        }
    };
};

dc_graph.tip.select_port = function() {
    return {
        select: function(diagram, node, edge, ehover) {
            return node.selectAll('g.port');
        }
    };
};
