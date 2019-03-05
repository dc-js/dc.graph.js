dc_graph.render_webgl = function() {
    //var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _camera, _scene, _webgl_renderer;
    var _controls;
    var _nodeMaterial, _edgeMaterial;
    var _animating = false; // do not refresh during animations
    var _renderer = {};

    _renderer.rendererType = function() {
        return 'webgl';
    };

    _renderer.parent = property(null);

    _renderer.isRendered = function() {
        return !!_camera;
    };

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

    _renderer.initializeDrawing = function () {
        _camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);

        _scene = new THREE.Scene();

        _nodeMaterial =  new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(parseInt('888888', 16)) }
            },
            vertexShader: document.getElementById( 'vertexshader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader' ).textContent
        });
        _edgeMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 1 } );

        _webgl_renderer = new THREE.WebGLRenderer({ antialias: true });
        _webgl_renderer.setPixelRatio(window.devicePixelRatio);
        _webgl_renderer.setSize(window.innerWidth, window.innerHeight);
        _renderer.parent().root().node().appendChild(_webgl_renderer.domElement);

        _controls = new THREE.OrbitControls(_camera, _webgl_renderer.domElement);
        _controls.minDistance = 0;
        _controls.maxDistance = 2000;
        return _renderer;
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        wnodes.forEach(infer_shape(_renderer.parent()));
        return {wnodes: wnodes, wedges: wedges};
    };

    _renderer.draw = function(drawState, animatePositions) {
        drawState.wedges.forEach(function(e) {
            if(!e.pos.old)
                _renderer.parent().calcEdgePath(e, 'old', e.source.prevX || e.source.cola.x, e.source.prevY || e.source.cola.y,
                                                e.target.prevX || e.target.cola.x, e.target.prevY || e.target.cola.y);
            if(!e.pos.new)
                _renderer.parent().calcEdgePath(e, 'new', e.source.cola.x, e.source.cola.y, e.target.cola.x, e.target.cola.y);
        });

        var MULT = 3;
        var positions = new Float32Array(drawState.wnodes.length * 3);
        var scales = new Float32Array(drawState.wnodes.length * 3);
        var colors = new Float32Array(drawState.wnodes.length * 3);
        drawState.wnodes.forEach(function(n, i) {
            positions[i*3] = n.cola.x * MULT;
            positions[i*3 + 1] = -n.cola.y * MULT;
            positions[i*3 + 2] = n.cola.z * MULT || 0;
            scales[i] = 100;
            var color = _renderer.parent().nodeFill.eval(n);
            if(_renderer.parent().nodeFillScale())
                color = _renderer.parent().nodeFillScale()(color);
            // it better be 6 byte hex RGB
            if(color.length !== 7 || color[0] !== '#') {
                console.warn("don't know how to use color " + color);
                color = '#888888';
            }
            var cint = parseInt(color.slice(1), 16);
            colors[i*3] = cint >> 16;
            colors[i*3 + 1] = (cint >> 8) & 0xff;
            colors[i*3 + 2] = cint & 0xff;
        });

        var xext = d3.extent(drawState.wnodes, function(n) { return n.cola.x * MULT; }),
            yext = d3.extent(drawState.wnodes, function(n) { return n.cola.y * MULT; }),
            zext = d3.extent(drawState.wnodes, function(n) { return n.cola.z * MULT || 0; });
        _camera.position.set(
            (xext[0] + xext[1])/2,
            (yext[0] + yext[1])/2,
            (zext[0] + zext[1])/2);
        _controls.update();

        var nodeGeometry = new THREE.BufferGeometry();
        nodeGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        nodeGeometry.addAttribute('scale', new THREE.BufferAttribute(scales, 1));
        nodeGeometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

        var particles = new THREE.Points(nodeGeometry, _nodeMaterial);
        _scene.add(particles);

        var vertices = [];
        drawState.wedges.forEach(function(e) {
            if(!e.source || !e.target)
                return;
            var a = e.source.cola, b = e.target.cola;
            vertices.push(a.x*MULT, -a.y*MULT, a.z*MULT || 0,
                          b.x*MULT, -b.y*MULT, b.z*MULT || 0);
        });
        var lineGeometry = new THREE.BufferGeometry();
        lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        var line = new THREE.LineSegments(lineGeometry, _edgeMaterial);
        _scene.add(line);

        animate();
        return _renderer;
    };

    function animate() {
        window.requestAnimationFrame(animate);
        render();
    }

    function render() {
        _webgl_renderer.render(_scene, _camera);
    }

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
        dispatch.transitionsStarted(null);
    };

    _renderer.calculateBounds = function(drawState) {
        if(!drawState.wnodes.length)
            return null;
        return _renderer.parent().calculateBounds(drawState.wnodes, drawState.wedges);
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

    _renderer.animating = function() {
        return _animating;
    };

    return _renderer;
};

