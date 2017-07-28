dc_graph.match_ports = function(diagram, symbolPorts) {
    var _ports, _wports, _validTargets;
    diagram.on('data', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _ports = ports;
        _wports = wports;
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
    var _behavior = {
        isValid: property(function(sourcePort, targetPort) {
            return targetPort !== sourcePort && targetPort.name === sourcePort.name;
        }),
        startDragEdge: function(source) {
            symbolPorts.enableHover(false);
            _validTargets = _wports.filter(_behavior.isValid().bind(null, source.port));
            var nids = change_state(_validTargets, 'shimmer');
            if(_validTargets.length) {
                source.port.state = 'large';
                nids.push(diagram.portNodeKey.eval(source.port));
                symbolPorts.animateNodes(nids);
            }
            console.log('valid targets', nids);
            return _validTargets.length !== 0;
        },
        changeDragTarget: function(source, target) {
            var nids, valid = target && _behavior.isValid()(source.port, target.port);
            if(valid) {
                nids = change_state(_validTargets, 'small');
                target.port.state = 'large'; // it's one of the valid
            }
            else nids = change_state(_validTargets, 'shimmer');
            symbolPorts.animateNodes(nids);
            return valid;
        },
        finishDragEdge: function(source, target) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return _behavior.isValid()(source.port, target.port);
        },
        cancelDragEdge: function(source) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return true;
        }
    };
    return _behavior;
};
