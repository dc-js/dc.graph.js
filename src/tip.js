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
    var _dispatch = d3.dispatch('tipped');

    function init(parent) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', options.class || 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; })
                .direction(_mode.direction());
            if(_mode.offset())
                _d3tip.offset(_mode.offset());
            parent.svg().call(_d3tip);
        }
    }
    function fetch_and_show_content(d) {
        if(_mode.disabled() || _mode.selection().exclude && _mode.selection().exclude(d3.event.target)) {
            hide_tip.call(this);
            return;
        }
        var target = this,
            next = function() {
                _mode.content()(d, function(content) {
                    _d3tip.show.call(target, content, target);
                    d3.select('div.d3-tip')
                        .selectAll('a.tip-link')
                        .on('click.' + _namespace, function() {
                            d3.event.preventDefault();
                            if(_mode.linkCallback())
                                _mode.linkCallback()(this.id);
                        });
                    _dispatch.tipped(d);
                });
            };
        if(_hideTimeout)
            window.clearTimeout(_hideTimeout);
        if(_mode.delay()) {
            window.clearTimeout(_showTimeout);
            _showTimeout = window.setTimeout(next, _mode.delay());
        }
        else next();
    }

    function check_hide_tip() {
        if(d3.event.relatedTarget &&
           (!_mode.selection().exclude || !_mode.selection().exclude(d3.event.target)) &&
           (this && this.contains(d3.event.relatedTarget) || // do not hide when mouse is still over a child
            _mode.clickable() && d3.event.relatedTarget.classList.contains('d3-tip')))
            return false;
        return true;
    }

    function preempt_tip() {
        if(_showTimeout) {
            window.clearTimeout(_showTimeout);
            _showTimeout = null;
        }
    }

    function hide_tip() {
        if(!check_hide_tip.apply(this))
            return;
        preempt_tip();
        _d3tip.hide();
    }

    function hide_tip_delay() {
        if(!check_hide_tip.apply(this))
            return;
        preempt_tip();
        if(_mode.hideDelay())
            _hideTimeout = window.setTimeout(function () {
                _d3tip.hide();
            }, _mode.hideDelay());
        else
            _d3tip.hide();
    }

    function draw(diagram, node, edge, ehover) {
        init(diagram);
        _mode.programmatic() || _mode.selection().select(diagram, node, edge, ehover)
            .on('mouseover.' + _namespace, fetch_and_show_content)
            .on('mouseout.' + _namespace, hide_tip_delay);
        if(_mode.clickable()) {
            d3.select('div.d3-tip')
                .on('mouseover.' + _namespace, function() {
                    if(_hideTimeout)
                        window.clearTimeout(_hideTimeout);
                })
                .on('mouseout.' + _namespace, hide_tip_delay);
        }
    }
    function remove(diagram, node, edge, ehover) {
        _mode.programmatic() || _mode.selection().select(diagram, node, edge, ehover)
            .on('mouseover.' + _namespace, null)
            .on('mouseout.' + _namespace, null);
    }

    var _mode = dc_graph.mode(_namespace, {
        draw: draw,
        remove: remove,
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
     **/
    _mode.direction = property('n');

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
     * // Default mode: assume it's a node, show node title
     * var tip = dc_graph.tip().content(function(n, k) {
     *     k(_mode.parent() ? _mode.parent().nodeTitle.eval(n) : '');
     * });
     **/
    _mode.content = property(function(n, k) {
        k(_mode.parent() ? _mode.parent().nodeTitle.eval(n) : '');
    });

    _mode.on = function(event, f) {
        return _dispatch.on(event, f);
    };

    _mode.disabled = property(false);
    _mode.programmatic = property(false);

    _mode.displayTip = function(filter, n, cb) {
        if(typeof filter !== 'function') {
            var d = filter;
            filter = function(d2) { return d2 === d; };
        }
        var found = _mode.selection().select(_mode.parent(), _mode.parent().selectAllNodes(), _mode.parent().selectAllEdges(), null)
            .filter(filter);
        if(found.size() > 0) {
            var action = fetch_and_show_content;
            // we need to flatten e.g. for ports, which will have nested selections
            // .nodes() does this better in D3v4
            var flattened = found.reduce(function(p, v) {
                return p.concat(v);
            }, []);
            var which = (n || 0) % flattened.length;
            action.call(flattened[which], d3.select(flattened[which]).datum());
            d = d3.select(flattened[which]).datum();
            if(cb)
                cb(d);
            if(_mode.programmatic())
                found.on('mouseout.' + _namespace, hide_tip_delay);
        }
        return _mode;
    };

    _mode.hideTip = function(delay) {
        if(_d3tip) {
            if(delay)
                hide_tip_delay();
            else
                hide_tip();
        }
        return _mode;
    };
    _mode.selection = property(dc_graph.tip.select_node_and_edge());
    _mode.showDelay = _mode.delay = property(0);
    _mode.hideDelay = property(200);
    _mode.offset = property(null);
    _mode.clickable = property(false);
    _mode.linkCallback = property(null);

    return _mode;
};

/**
 * Generates a handler which can be passed to `tip.content` to produce a table of the
 * attributes and values of the hovered object.
 *
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
        d = gen.fetch()(d);
        if(!d)
            return; // don't display tooltip if no content
        var data, keys;
        if(Array.isArray(d))
            data = d;
        else if(typeof d === 'number' || typeof d === 'string')
            data = [d];
        else { // object
            data = keys = Object.keys(d).filter(d3.functor(gen.filter()))
                .filter(function(k) {
                    return d[k] !== undefined;
                });
        }
        var table = d3.select(document.createElement('table'));
        var rows = table.selectAll('tr').data(data);
        var rowsEnter = rows.enter().append('tr');
        rowsEnter.append('td').text(function(item) {
            if(keys && typeof item === 'string')
                return item;
            return JSON.stringify(item);
        });
        if(keys)
            rowsEnter.append('td').text(function(item) {
                return JSON.stringify(d[item]);
            });
        k(table.node().outerHTML); // optimizing for clarity over speed (?)
    };
    gen.filter = property(true);
    gen.fetch = property(function(d) {
        return d.orig.value;
    });
    return gen;
};

dc_graph.tip.json_table = function() {
    var table = dc_graph.tip.table().fetch(function(d) {
        var jsontip = table.json()(d);
        if(!jsontip) return null;
        try {
            return JSON.parse(jsontip);
        } catch(xep) {
            return [jsontip];
        }
    });
    table.json = property(function(d) {
        return (d.orig.value.value || d.orig.value).jsontip;
    });
    return table;
};

dc_graph.tip.html_or_json_table = function() {
    var json_table = dc_graph.tip.json_table();
    var gen = function(d, k) {
        var html = gen.html()(d);
        if(html)
            k(html);
        else
            json_table(d, k);
    };
    gen.json = json_table.json;
    gen.html = property(function(d) {
        return (d.orig.value.value || d.orig.value).htmltip;
    });
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
