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
    function install_brush(chart) {
        if(!_brush) {
            _brush = d3.svg.brush()
                .x(chart.x()).y(chart.y())
                .on('brushstart', brushstart)
                .on('brush', brushmove)
                .on('brushend', brushend);
        }
        if(!_gBrush) {
            _gBrush = chart.svg().insert('g', ':first-child')
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
    var _behavior = dc_graph.behavior('brush', {
        add_behavior: function() {},
        remove_behavior: remove_brush
    });

    _behavior.on = function(event, f) {
        _dispatch.on(event, f);
        return this;
    };
    _behavior.activate = function() {
        install_brush(_behavior.parent());
        return this;
    };
    _behavior.deactivate = function() {
        remove_brush();
        return this;
    };
    _behavior.isActive = function () {
        return !!_gBrush;
    };

    return _behavior;
};
