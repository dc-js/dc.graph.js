import { mode } from './mode.js';
import { property } from './core.js';

export function annotateLayers() {
    // svg-specific
    let _drawLayer;
    // wegl-specific
    let _planes = [];
    let _planeGeometry;
    const _mode = mode('annotate-layers', {
        laterDraw: true,
        renderers: ['svg', 'webgl'],
        draw,
        remove
    });
    function draw(_diagram) {
        const rendererType = _mode.parent().renderer().rendererType();
        const engine = _mode.parent().layoutEngine();
        if(rendererType === 'svg') {
            if(engine.layoutAlgorithm() === 'cola' &&
               engine.setcolaSpec() && engine.setcolaNodes()) {
                _drawLayer = _mode.parent().select('g.draw').selectAll('g.divider-layer').data([0]);
                _drawLayer.enter().append('g').attr('class', 'divider-layer');
                const boundary_nodes = engine.setcolaNodes().filter((n) => /^sort_order_boundary/.test(n.name));
                const lines = _drawLayer.selectAll('line.divider').data(boundary_nodes);
                lines.exit().remove();
                lines.enter().append('line')
                    .attr('class', 'divider');
                lines.attr('stroke', _mode.stroke())
                    .attr('stroke-width', _mode.strokeWidth())
                    .attr('stroke-dasharray', _mode.strokeDashArray())
                    .attr('x1', -5000)
                    .attr('y1', n => n.y)
                    .attr('x2', 5000)
                    .attr('y2', n => n.y);
            }
        } else if(rendererType === 'webgl') {
            const MULT = _mode.parent().renderer().multiplier();
            const scene = arguments[1], drawState = arguments[2];
            if(engine.layoutAlgorithm() === 'layered' && engine.layers()) {
                const width = drawState.extents[0][1] - drawState.extents[0][0] + _mode.planePadding()*MULT*2,
                    height = drawState.extents[1][1] - drawState.extents[1][0] + _mode.planePadding()*MULT*2;
                let delGeom;
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(0, height);
                shape.lineTo(width, height);
                shape.lineTo(width, 0);
                shape.lineTo(0, 0);
                if(_planeGeometry)
                    delGeom = _planeGeometry;
                _planeGeometry = new THREE.ShapeBufferGeometry(shape);

                const layers = engine.layers();
                if(layers.length < _planes.length) {
                    for(let i = layers.length; i < _planes.length; ++i)
                        scene.remove(_planes[i].mesh);
                    _planes = _planes.slice(0, layers.length);
                }
                layers.forEach((layer, i) => {
                    if(!_planes[i])
                        _planes[i] = Object.assign({}, layer);
                    if(_planes[i].mesh)
                        scene.remove(_planes[i].mesh);
                    const mesh = _planes[i].mesh = new THREE.Mesh(_planeGeometry, new THREE.MeshStandardMaterial({
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
        } else throw new Error(`annotate_layers doesn't know how to work with renderer ${  rendererType}`);
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
