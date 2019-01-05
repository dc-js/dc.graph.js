/**
 * `dc_graph.brush` is a {@link dc_graph.mode mode} providing a simple wrapper over
 * [d3.svg.brush](https://github.com/d3/d3-3.x-api-reference/blob/master/SVG-Controls.md#brush)
 * @class brush
 * @memberof dc_graph
 * @return {dc_graph.brush}
 **/
dc_graph.brush = function() {
    var _brush = null, _gBrush, _dispatch = d3.dispatch('brushstart', 'brushmove', 'brushend');

    function brushstart() {
        _dispatch.brushstart();
    }
    function brushmove() {
        var ext = _brush.extent();
        _dispatch.brushmove(ext);
    }
    function brushend() {
        _dispatch.brushend();
        _gBrush.call(_brush.clear());
    }
    function install_brush(diagram) {
        if(!_brush) {
            _brush = d3.svg.brush()
                .x(diagram.x()).y(diagram.y())
                .on('brushstart.brush-mode', brushstart)
                .on('brush.brush-mode', brushmove)
                .on('brushend.brush-mode', brushend);
        }
        if(!_gBrush) {
            _gBrush = diagram.svg().insert('g', ':first-child')
                .attr('class', 'brush')
                .call(_brush);
        }
    }
    function remove_brush() {
        if(_gBrush) {
            _gBrush.remove();
            _gBrush = null;
        }
    }
    var _mode = dc_graph.mode('brush', {
        draw: function() {},
        remove: remove_brush
    });

    /**
     * Subscribe to a brush event, currently `brushstart`, `brushmove`, or `brushend`
     * @method on
     * @memberof dc_graph.brush
     * @instance
     * @param {String} event the name of the event; please namespace with `'namespace.event'`
     * @param {Function} [f] the handler function; if omitted, returns the current handler
     * @return {dc_graph.brush}
     * @return {Function}
     **/
    _mode.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    /**
     * Add the brush to the parent diagram's SVG
     * @method activate
     * @memberof dc_graph.brush
     * @instance
     * @return {dc_graph.brush}
     **/
    _mode.activate = function() {
        install_brush(_mode.parent());
        return this;
    };
    /**
     * Remove the brush from the parent diagram's SVG
     * @method deactivate
     * @memberof dc_graph.brush
     * @instance
     * @return {dc_graph.brush}
     **/
    _mode.deactivate = function() {
        remove_brush();
        return this;
    };
    /**
     * Retrieve whether the brush is currently active
     * @method isActive
     * @memberof dc_graph.brush
     * @instance
     * @return {Boolean}
     **/
    _mode.isActive = function () {
        return !!_gBrush;
    };

    return _mode;
};
