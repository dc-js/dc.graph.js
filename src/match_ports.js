dc_graph.match_ports = function(diagram, symbolPorts) {
    var _ports, _wports;
    diagram.on('data', function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _ports = ports;
        _wports = wports;
    });
    function reset_all_ports() {
        var shimmering = _wports.filter(function(p) {
            return p.state === 'shimmer';
        });
        if(!shimmering.length)
            return;
        var nids = [];
        shimmering.forEach(function(p) {
            p.state = 'inactive';
            nids.push(diagram.portNodeKey.eval(p));
        });
        symbolPorts.animateNodes(nids);
    }
    var _behavior = {
        isValid: property(function(sourcePort, targetPort) {
            return targetPort !== sourcePort && targetPort.name === sourcePort.name;
        }),
        startDragEdge: function(source) {
            var validTargets = _wports.filter(_behavior.isValid().bind(null, source.port));
            var nids = [];
            validTargets.forEach(function(p) {
                p.state = 'shimmer';
                nids.push(diagram.portNodeKey.eval(p));
            });
            if(validTargets.length)
                symbolPorts.animateNodes(nids);
            console.log('valid targets', nids);
            return validTargets.length !== 0;
        },
        changeDragTarget: function(source, target) {
            return true;
        },
        finishDragEdge: function(source, target) {
            reset_all_ports();
            return true;
        },
        cancelDragEdge: function() {
            reset_all_ports();
            return true;
        }
    };
    return _behavior;
};
