dc_graph.render_webgl = function() {
    //var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _animating = false; // do not refresh during animations
    //var _zoom;
    var _renderer = {};

    _renderer.parent = property(null);

    _renderer.resize = function(w, h) {
        return _renderer;
    };

    _renderer.rezoom = function(oldWidth, oldHeight, newWidth, newHeight) {
        return _renderer;
    };

    _renderer.globalTransform = function(pos, scale, animate) {
        return _renderer;
    };

    _renderer.translate = function(_) {
        if(!arguments.length)
            return [0,0];
        return _renderer;
    };

    _renderer.scale = function(_) {
        if(!arguments.length)
            return 1;
        return _renderer;
    };

    // argh
    _renderer.commitTranslateScale = function() {
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        return drawState;
    };

    _renderer.refresh = function(node, edge, edgeHover, edgeLabels, textPaths) {
        if(_animating)
            return _renderer; // but what about changed attributes?
        return _renderer;
    };

    _renderer.reposition = function(node, edge) {
        return _renderer;
    };

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    _renderer.draw = function(drawState, animatePositions) {
        return _renderer;
    };

    _renderer.isRendered = function() {
        return !!_svg;
    };

    _renderer.initializeDrawing = function () {
        return _renderer;
    };

    _renderer.drawPorts = function(drawState) {
        var nodePorts = _renderer.parent().nodePorts();
        if(!nodePorts)
            return;
        _renderer.parent().portStyle.enum().forEach(function(style) {
            var nodePorts2 = {};
            for(var nid in nodePorts)
                nodePorts2[nid] = nodePorts[nid].filter(function(p) {
                    return _renderer.parent().portStyleName.eval(p) === style;
                });
            // not implemented
            var port = _renderer.selectNodePortsOfStyle(drawState.node, style);
            //_renderer.parent().portStyle(style).drawPorts(port, nodePorts2, drawState.node);
        });
    };

    _renderer.fireTSEvent = function(dispatch, drawState) {
        dispatch.transitionsStarted(drawState.node, drawState.edge, drawState.edgeHover);
    };

    _renderer.calculateBounds = function(drawState) {
        if(!drawState.node.size())
            return null;
        return _renderer.parent().calculateBounds(drawState.node.data(), drawState.edge.data());
    };

    _renderer.animating = function() {
        return _animating;
    };

    return _renderer;
};

