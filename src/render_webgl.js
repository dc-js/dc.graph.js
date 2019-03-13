dc_graph.render_webgl = function() {
    //var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _camera, _scene, _webgl_renderer;
    var _directionalLight, _ambientLight;
    var _controls;
    var _sphereGeometry;
    var _nodes = {}, _edges = {};
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
        if(_scene) // just treat it as a redraw
            return _renderer;

        _camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
        _camera.up = new THREE.Vector3(0, 0, 1);

        _scene = new THREE.Scene();

        _sphereGeometry = new THREE.SphereBufferGeometry(10, 32, 32);

        _directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        _directionalLight.position.set(-1, -1, 1).normalize();
        _scene.add(_directionalLight);

        _ambientLight = new THREE.AmbientLight(0xaaaaaa);
        _scene.add(_ambientLight);

        _webgl_renderer = new THREE.WebGLRenderer({ antialias: true });
        _webgl_renderer.setPixelRatio(window.devicePixelRatio);
        var boundRect = _renderer.parent().root().node().getBoundingClientRect();
        _webgl_renderer.setSize(boundRect.width, boundRect.height);
        _renderer.parent().root().node().appendChild(_webgl_renderer.domElement);

        _controls = new THREE.OrbitControls(_camera, _webgl_renderer.domElement);
        _controls.minDistance = 300;
        _controls.maxDistance = 1000;
        return _renderer;
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        wnodes.forEach(infer_shape(_renderer.parent()));
        var rnodes = regenerate_objects(_nodes, wnodes, null, function(n) {
            return _renderer.parent().nodeKey.eval(n);
        }, function(rn, n) {
            rn.wnode = n;
        }, null, function(wnode, rnode) {
            _scene.remove(rnode.mesh);
            //rnode.mesh.dispose();
            rnode.material.dispose();
        });
        var redges = regenerate_objects(_edges, wedges, null, function(e) {
            return _renderer.parent().edgeKey.eval(e);
        }, function(re, e) {
            re.wedge = e;
        }, null, function(wedge, redge) {
            _scene.remove(redge.mesh);
            //redge.mesh.dispose();
            redge.geometry.dispose();
            redge.material.dispose();
        });
        animate();
        return {wnodes: wnodes, wedges: wedges, rnodes: rnodes, redges: redges};
    };

    function color_to_int(color) {
        // it better be 6 byte hex RGB
        if(color.length !== 7 || color[0] !== '#') {
            console.warn("don't know how to use color " + color);
            color = '#888888';
        }
        return parseInt(color.slice(1), 16);
    }
    _renderer.color_to_int = color_to_int;

    _renderer.draw = function(drawState, animatePositions) {
        drawState.wedges.forEach(function(e) {
            if(!e.pos.old)
                _renderer.parent().calcEdgePath(e, 'old', e.source.prevX || e.source.cola.x, e.source.prevY || e.source.cola.y,
                                                e.target.prevX || e.target.cola.x, e.target.prevY || e.target.cola.y);
            if(!e.pos.new)
                _renderer.parent().calcEdgePath(e, 'new', e.source.cola.x, e.source.cola.y, e.target.cola.x, e.target.cola.y);
        });

        var MULT = _renderer.multiplier();
        drawState.rnodes.forEach(function(rn) {
            var color = _renderer.parent().nodeFill.eval(rn.wnode);
            var add = false;
            if(!rn.mesh) {
                add = true;
                if(_renderer.parent().nodeFillScale())
                    color = _renderer.parent().nodeFillScale()(color);
                var cint = color_to_int(color);
                rn.material = new THREE.MeshLambertMaterial({color: cint});
                rn.mesh = new THREE.Mesh(_sphereGeometry, rn.material);
                rn.mesh.name = _renderer.parent().nodeKey.eval(rn.wnode);
            }
            rn.mesh.position.x = rn.wnode.cola.x * MULT;
            rn.mesh.position.y = -rn.wnode.cola.y * MULT;
            rn.mesh.position.z = rn.wnode.cola.z * MULT || 0;
            if(add)
                _scene.add(rn.mesh);
        });

        var xext = d3.extent(drawState.wnodes, function(n) { return n.cola.x * MULT; }),
            yext = d3.extent(drawState.wnodes, function(n) { return -n.cola.y * MULT; }),
            zext = d3.extent(drawState.wnodes, function(n) { return n.cola.z * MULT || 0; });
        var cx = (xext[0] + xext[1])/2,
            cy = (yext[0] + yext[1])/2,
            cz = (zext[0] + zext[1])/2;

        drawState.center = [cx, cy, cz];
        drawState.extents = [xext, yext, zext];
        _controls.target.set(cx, cy, cz);
        _controls.update();

        var vertices = [];
        drawState.redges.forEach(function(re) {
            if(!re.wedge.source || !re.wedge.target)
                return;
            var a = re.wedge.source.cola, b = re.wedge.target.cola;
            var add = false;
            var width = _renderer.parent().edgeStrokeWidth.eval(re.wedge);
            if(!re.mesh) {
                add = true;
                var color = _renderer.parent().edgeStroke.eval(re.wedge);
                var cint = color_to_int(color);
                re.material = new THREE.MeshLambertMaterial({ color: cint });
                re.curve = new THREE.LineCurve3(
                    new THREE.Vector3(a.x*MULT, -a.y*MULT, a.z*MULT || 0),
                    new THREE.Vector3(b.x*MULT, -b.y*MULT, b.z*MULT || 0));
                re.geometry = new THREE.TubeBufferGeometry(re.curve, 20, width/2, 8, false);
                re.mesh = new THREE.Mesh(re.geometry, re.material);
                re.mesh.name = _renderer.parent().edgeKey.eval(re.wedge);
            } else {
                re.curve = new THREE.LineCurve3(
                    new THREE.Vector3(a.x*MULT, -a.y*MULT, a.z*MULT || 0),
                    new THREE.Vector3(b.x*MULT, -b.y*MULT, b.z*MULT || 0));
                re.geometry.dispose();
                re.geometry = new THREE.TubeBufferGeometry(re.curve, 20, width/2, 8, false);
                re.mesh.geometry = re.geometry;
            }
            if(add)
                _scene.add(re.mesh);
        });
        _animating = false;
        _renderer.parent().layoutDone(true);
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
        dispatch.transitionsStarted(_scene, drawState);
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

    _renderer.multiplier = property(3);

    return _renderer;
};

