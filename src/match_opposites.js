dc_graph.match_opposites = function(diagram, deleteProps, options) {
    options = Object.assign({
        multiplier: 2,
        ease: d3.ease('cubic')
    }, options);
    var _ports, _wports, _wedges, _validTargets;

    diagram.cascade(100, true, multiply_properties(function(e) {
        return options.ease(e.deleting || 0);
    }, deleteProps, property_interpolate));
    diagram.on('data.match-opposites', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _ports = ports;
        _wports = wports;
        _wedges = wedges;
    });
    function port_pos(p) {
        return { x: p.node.cola.x + p.pos.x, y: p.node.cola.y + p.pos.y };
    }
    function is_valid(sourcePort, targetPort) {
        return (_strategy.allowParallel() || !_wedges.some(function(e) {
            return sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0;
        })) && _strategy.isValid()(sourcePort, targetPort);
    }
    function reset_deletables(source, targets) {
        targets.forEach(function(p) {
            p.edges.forEach(function(e) {
                e.deleting = 0;
            });
        });
        if(source)
            source.port.edges.forEach(function(e) {
                e.deleting = 0;
            });
    }
    var _strategy = {
        isValid: property(function(sourcePort, targetPort) {
            // draw_graphs is already enforcing this, but this makes more sense and i use xor any chance i get
            return (diagram.portName.eval(sourcePort) === 'in') ^ (diagram.portName.eval(targetPort) === 'in');
        }),
        allowParallel: property(false),
        hoverPort: function(port) {
            // could be called by draw_graphs when node is hovered, isn't
        },
        startDragEdge: function(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            console.log('valid targets', _validTargets.map(diagram.portNodeKey.eval));
            return _validTargets.length !== 0;
        },
        dragCanvas: function(source, coords) {
            var closest = _validTargets.map(function(p) {
                var ppos = port_pos(p);
                return {
                    distance: Math.hypot(coords[0] - ppos.x, coords[1] - ppos.y),
                    port: p
                };
            }).sort(function(a, b) {
                return a.distance - b.distance;
            });
            var cpos = port_pos(closest[0].port), spos = port_pos(source.port);
            closest.forEach(function(c) {
                c.port.edges.forEach(function(e) {
                    e.deleting = 1 - options.multiplier * c.distance / Math.hypot(cpos.x - spos.x, cpos.y - spos.y);
                });
            });
            source.port.edges.forEach(function(e) {
                e.deleting = 1 - options.multiplier * closest[0].distance / Math.hypot(cpos.x - spos.x, cpos.y - spos.y);
            });
            diagram.requestRefresh(0);
        },
        changeDragTarget: function(source, target) {
            var valid = target && is_valid(source.port, target.port);
            if(valid) {
                target.port.edges.forEach(function(e) {
                    e.deleting = 1;
                });
                source.port.edges.forEach(function(e) {
                    e.deleting = 1;
                });
                reset_deletables(null, _validTargets.filter(function(p) {
                    return p !== target.port;
                }));
                diagram.requestRefresh(0);
            }
            return valid;
        },
        finishDragEdge: function(source, target) {
            if(is_valid(source.port, target.port)) {
                reset_deletables(null, _validTargets.filter(function(p) {
                    return p !== target.port;
                }));
                if(options.delete_edges) {
                    var edgeKeys = source.port.edges.map(diagram.edgeKey.eval).concat(target.port.edges.map(diagram.edgeKey.eval));
                    return options.delete_edges.deleteSelection(edgeKeys);
                }
                return Promise.resolve(true);
            }
            reset_deletables(source, _validTargets || []);
            return Promise.resolve(false);
        },
        cancelDragEdge: function(source) {
            reset_deletables(source, _validTargets || []);
            return true;
        },
        detectReversedEdge: function(edge, sourcePort, targetPort) {
            return diagram.portName.eval(sourcePort) === 'in';
        }
    };
    return _strategy;
};
