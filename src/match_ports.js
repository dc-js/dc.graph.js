dc_graph.match_ports = function(diagram, symbolPorts) {
    var _ports, _wports, _wedges, _validTargets;
    diagram.on('data', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _ports = ports;
        _wports = wports;
        _wedges = wedges;
    });
    function change_state(ports, state) {
        return ports.map(function(p) {
            p.state = state;
            return diagram.portNodeKey.eval(p);
        });
    }
    function reset_ports(source) {
        var nids = change_state(_validTargets, 'small');
        source.port.state = 'small';
        nids.push(diagram.portNodeKey.eval(source.port));
        symbolPorts.animateNodes(nids);
    }
    function is_valid(sourcePort, targetPort) {
        return (_behavior.allowParallel() || !_wedges.some(function(e) {
            return sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0;
        })) && _behavior.isValid()(sourcePort, targetPort);
    }
    var _behavior = {
        isValid: property(function(sourcePort, targetPort) {
            return targetPort !== sourcePort && targetPort.name === sourcePort.name;
        }),
        allowParallel: property(false),
        hoverPort: function(port) {
            if(port) {
                _validTargets = _wports.filter(is_valid.bind(null, port));
                if(_validTargets.length)
                    return change_state(_validTargets, 'shimmer-medium');
            } else if(_validTargets)
                return change_state(_validTargets, 'small');
            return null;
        },
        startDragEdge: function(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            var nids = change_state(_validTargets, 'shimmer');
            if(_validTargets.length) {
                symbolPorts.enableHover(false);
                source.port.state = 'large';
                nids.push(diagram.portNodeKey.eval(source.port));
                symbolPorts.animateNodes(nids);
            }
            console.log('valid targets', nids);
            return _validTargets.length !== 0;
        },
        changeDragTarget: function(source, target) {
            var nids, valid = target && is_valid(source.port, target.port), before;
            if(valid) {
                nids = change_state(_validTargets, 'small');
                target.port.state = 'large'; // it's one of the valid
            }
            else {
                nids = change_state(_validTargets, 'small');
                before = symbolPorts.animateNodes(nids);
                nids = change_state(_validTargets, 'shimmer');
            }
            symbolPorts.animateNodes(nids, before);
            return valid;
        },
        finishDragEdge: function(source, target) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return is_valid(source.port, target.port);
        },
        cancelDragEdge: function(source) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return true;
        }
    };
    return _behavior;
};
