function port_name(nodeId, edgeId, portName) {
    return (nodeId ? 'node/' + nodeId : 'edge/' + edgeId) + '/' + portName;
};
function split_port_name(portname) {
    var parts = portname.split('/');
    if(parts[0] === 'node')
        return {
            nodeKey: parts[1],
            name: parts[2]
        };
    else return {
        edgeKey: parts[1],
        name: parts[2]
    };
}

dc_graph.place_ports = function(diagram, nodes, wnodes, edges, wedges, ports, wports) {
    var node_ports = {};

    // assemble port-lists for nodes, again because we don't have a metagraph.
    wports.forEach(function(p) {
        var nid = diagram.nodeKey.eval(p.node);
        var np = node_ports[nid] = node_ports[nid] || [];
        np.push(p);
    });

    function dpos(n, e) {
        var dy = e.target.cola.y - e.source.cola.y,
            dx = e.target.cola.x - e.source.cola.x;
        if(e.source !== n)
            dy = -dy, dx = -dx;
        return {dy: dy, dx: dx};
    }
    function angle(n, e) {
        var dp = dpos(n, e);
        return Math.atan2(dp.dy, dp.dx);
    }

    // calculate port positions (currently very stupid)
    for(var nid in node_ports) {
        var n = nodes[nid];
        node_ports[nid].forEach(function(p) {
            if(p.edges.length > 1) {
                var angs = p.edges.map(angle.bind(null, n));
                var a = d3.sum(angs)/angs.length;
                p.pos = point_on_shape(diagram, nodes[nid], Math.cos(a)*1000, Math.sin(a)*1000);
            }
            else {
                var dp = dpos(n, p.edges[0]);
                p.pos = point_on_shape(diagram, n, dp.dx, dp.dy);
            }
        });
    }

    // propagate port positions to edge endpoints
    wedges.forEach(function(e) {
        var name = diagram.edgeSourcePortName.eval(e);
        e.sourcePort.pos = name ? ports[port_name(diagram.nodeKey.eval(e.source), null, name)].pos :
            ports[port_name(null, diagram.edgeKey.eval(e), 'source')].pos;
        name = diagram.edgeTargetPortName.eval(e);
        e.targetPort.pos = name ? ports[port_name(diagram.nodeKey.eval(e.target), null, name)].pos :
            ports[port_name(null, diagram.edgeKey.eval(e), 'target')].pos;
    });
    return node_ports;
};
