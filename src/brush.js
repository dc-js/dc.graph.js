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
                .on('brushstart', brushstart)
                .on('brush', brushmove)
                .on('brushend', brushend);
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

    _mode.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    _mode.activate = function() {
        install_brush(_mode.parent());
        return this;
    };
    _mode.deactivate = function() {
        remove_brush();
        return this;
    };
    _mode.isActive = function () {
        return !!_gBrush;
    };

    return _mode;
};
