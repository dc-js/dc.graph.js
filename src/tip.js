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
    var _timeout;

    function init(parent) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; })
                .direction(_behavior.direction());
            parent.svg().call(_d3tip);
        }
    }
    function fetch_and_show_content(fetcher) {
        return function(d) {
             var target = this,
                 next = function() {
                     _behavior[fetcher]()(d, function(content) {
                         _d3tip.show(content, target);
                     });
                 };

             if(_behavior.delay()) {
                 window.clearTimeout(_timeout);
                 _timeout = window.setTimeout(next, _behavior.delay());
             }
             else next();
         };
    }

    function hide_tip() {
        if(this.contains(d3.event.relatedTarget)) // do not hide when mouse is still over a child
            return;
        if(_timeout) {
            window.clearTimeout(_timeout);
            _timeout = null;
        }
        _d3tip.hide();
    }

    function add_behavior(chart, node, edge, ehover) {
        init(chart);
        _behavior.selection().select(chart, node, edge, ehover)
            .on('mouseover.' + options.namespace, fetch_and_show_content('content'))
            .on('mouseout.' + options.namespace, hide_tip);
    }
    function remove_behavior(chart, node, edge, ehover) {
        _behavior.selection().select(chart, node, edge, ehover)
            .on('mouseover.' + options.namespace, null)
            .on('mouseout.' + options.namespace, null);
    }

    var _behavior = dc_graph.behavior(options.namespace, {
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
     * signature `function(d, k)`, where `d` is the datum of the node being hovered over,
     * and `k` is a continuation. The function should fetch the content, asynchronously if
     * needed, and then pass html forward to `k`.
     * @name content
     * @memberof dc_graph.tip
     * @instance
     * @param {Function} [content]
     * @return {Function}
     * @example
     * // Default behavior: show title
     * var tip = dc_graph.tip().content(function(d, k) {
     *     k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(d) : '');
     * });
     **/
    _behavior.content = property(function(d, k) {
        k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(d) : '');
    });

    _behavior.selection = property(dc_graph.tip.select_node_and_edge());

    _behavior.delay = property(0);

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
        select: function(chart, node, edge, ehover) {
            // hack to merge selections, not supported d3v3
            var selection = chart.selectAll('.foo-this-does-not-exist');
            selection[0] = node[0].concat(ehover[0]);
            return selection;
        }
    };
};

dc_graph.tip.select_port = function() {
    return {
        select: function(chart, node, edge, ehover) {
            return node.selectAll('g.port');
        }
    };
};
