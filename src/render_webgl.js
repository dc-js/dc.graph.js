dc_graph.render_webgl = function() {
    //var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _camera, _scene, _webgl_renderer;
    var _controls;
    var _sphereGeometry, _edgeMaterial;
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

        _sphereGeometry = new THREE.SphereBufferGeometry(10, 32, 32);
        _edgeMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 1 } );

        _webgl_renderer = new THREE.WebGLRenderer({ antialias: true });
        _webgl_renderer.setPixelRatio(window.devicePixelRatio);
        _webgl_renderer.setSize(window.innerWidth, window.innerHeight);
        _renderer.parent().root().node().appendChild(_webgl_renderer.domElement);

        _controls = new THREE.OrbitControls(_camera, _webgl_renderer.domElement);
        _controls.minDistance = 300;
        _controls.maxDistance = 1000;
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
        drawState.wnodes.forEach(function(n, i) {
            var color = _renderer.parent().nodeFill.eval(n);
            if(_renderer.parent().nodeFillScale())
                color = _renderer.parent().nodeFillScale()(color);
            // it better be 6 byte hex RGB
            if(color.length !== 7 || color[0] !== '#') {
                console.warn("don't know how to use color " + color);
                color = '#888888';
            }
            var cint = parseInt(color.slice(1), 16);
            var material = new THREE.MeshBasicMaterial({color: cint});
            var sphere = new THREE.Mesh(_sphereGeometry, material);
            sphere.position.x = n.cola.x * MULT;
            sphere.position.y = -n.cola.y * MULT;
            sphere.position.z = n.cola.z * MULT || 0;
            _scene.add(sphere);
        });

        var xext = d3.extent(drawState.wnodes, function(n) { return n.cola.x * MULT; }),
            yext = d3.extent(drawState.wnodes, function(n) { return -n.cola.y * MULT; }),
            zext = d3.extent(drawState.wnodes, function(n) { return n.cola.z * MULT || 0; });
        var cx = (xext[0] + xext[1])/2,
            cy = (yext[0] + yext[1])/2,
            cz = (zext[0] + zext[1])/2;

        _controls.target.set(cx, cy, cz);
        _controls.update();

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

