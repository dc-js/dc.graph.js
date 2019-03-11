dc_graph.annotate_layers = function() {
    // svg-specific
    var _drawLayer;
    // wegl-specific
    var _planes = [];
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
            var scene = arguments[1], drawState = arguments[2];
            if(engine.layoutAlgorithm() === 'layered' && engine.layers()) {
                var sqLength = 500;
                var squareShape = new THREE.Shape();
                squareShape.moveTo(0, 0);
                squareShape.lineTo(0, sqLength);
                squareShape.lineTo(sqLength, sqLength);
                squareShape.lineTo(sqLength, 0);
                squareShape.lineTo(0, 0);
                var geometry = new THREE.ShapeBufferGeometry(squareShape);

                engine.layers().forEach(function(layer) {
                    var mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
                        opacity: 0.2,
                        transparent: true,
                        color: 0xffffdd,
                        side: THREE.DoubleSide
                    }));
                    mesh.position.set(drawState.center[0] - sqLength/2, drawState.center[1] - sqLength/2, layer.z*3);
                    mesh.rotation.set(0, 0, 0);
                    scene.add(mesh);
                });
            }
        } else throw new Error("annotate_layers doesn't know how to work with renderer " + rendererType);
    }
    function remove() {
        if(_drawLayer)
            _drawLayer.remove();
    }

    _mode.stroke = property('black');
    _mode.strokeWidth = property(2);
    _mode.strokeDashArray = property([5,5]);
    return _mode;
};
