dc_graph.annotate_layers = function() {
    // svg-specific
    var _drawLayer;
    // wegl-specific
    var _planes = [];
    var _planeGeometry;
    var _mode = dc_graph.mode('annotate-layers', {
        laterDraw: true,
        renderers: ['svg', 'webgl'],
        draw: draw,
        remove: remove
    });
    function draw(diagram) {
        var rendererType = _mode.parent().renderer().rendererType();
        var engine = _mode.parent().layoutEngine();
        if(rendererType === 'svg') {
            if(engine.layoutAlgorithm() === 'cola' &&
               engine.setcolaSpec() && engine.setcolaNodes()) {
                _drawLayer = _mode.parent().select('g.draw').selectAll('g.divider-layer').data([0]);
                _drawLayer.enter().append('g').attr('class', 'divider-layer');
                var boundary_nodes = engine.setcolaNodes().filter(function(n) {
                    return /^sort_order_boundary/.test(n.name);
                });
                var lines = _drawLayer.selectAll('line.divider').data(boundary_nodes);
                lines.exit().remove();
                lines.enter().append('line')
                    .attr('class', 'divider');
                lines.attr({
                    stroke: _mode.stroke(),
                    'stroke-width': _mode.strokeWidth(),
                    'stroke-dasharray': _mode.strokeDashArray(),
                    x1: -5000,
                    y1: function(n) {
                        return n.y;
                    },
                    x2: 5000,
                    y2:  function(n) {
                        return n.y;
                    }
                });
            }
        } else if(rendererType === 'webgl') {
            var MULT = _mode.parent().renderer().multiplier();
            var scene = arguments[1], drawState = arguments[2];
            if(engine.layoutAlgorithm() === 'layered' && engine.layers()) {
                var width = drawState.extents[0][1] - drawState.extents[0][0] + _mode.planePadding()*MULT*2,
                    height = drawState.extents[1][1] - drawState.extents[1][0] + _mode.planePadding()*MULT*2;
                var delGeom;
                var shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(0, height);
                shape.lineTo(width, height);
                shape.lineTo(width, 0);
                shape.lineTo(0, 0);
                if(_planeGeometry)
                    delGeom = _planeGeometry;
                _planeGeometry = new THREE.ShapeBufferGeometry(shape);

                var layers = engine.layers();
                if(layers.length < _planes.length) {
                    for(var i = layers.length; i < _planes.length; ++i)
                        scene.remove(_planes[i].mesh);
                    _planes = _planes.slice(0, layers.length);
                }
                layers.forEach(function(layer, i) {
                    if(!_planes[i])
                        _planes[i] = Object.assign({}, layer);
                    if(_planes[i].mesh)
                        scene.remove(_planes[i].mesh);
                    var mesh = _planes[i].mesh = new THREE.Mesh(_planeGeometry, new THREE.MeshStandardMaterial({
                        opacity: _mode.planeOpacity(),
                        transparent: true,
                        color: _mode.parent().renderer().color_to_int(_mode.planeColor()),
                        side: THREE.DoubleSide
                    }));
                    mesh.position.set(drawState.extents[0][0] - _mode.planePadding()*MULT,
                                      drawState.extents[1][0] - _mode.planePadding()*MULT,
                                      layer.z * MULT);
                    scene.add(mesh);
                });
                if(delGeom)
                    delGeom.dispose();
            }
        } else throw new Error("annotate_layers doesn't know how to work with renderer " + rendererType);
    }
    function remove() {
        if(_drawLayer)
            _drawLayer.remove();
    }

    // line properties for svg
    _mode.stroke = property('black');
    _mode.strokeWidth = property(2);
    _mode.strokeDashArray = property([5,5]);

    // plane properties
    _mode.planePadding = property(5);
    _mode.planeOpacity = property(0.2);
    _mode.planeColor = property('#ffffdd');
    return _mode;
};
