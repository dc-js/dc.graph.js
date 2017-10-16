function port_name(nodeId, edgeId, portName) {
    if(!(nodeId || edgeId))
        return null; // must have one key or the other
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

    function norm(v) {
        var len = Math.hypot(v[0], v[1]);
        return [v[0]/len, v[1]/len];
    }
    function edge_vec(n, e) {
        var dy = e.target.cola.y - e.source.cola.y,
            dx = e.target.cola.x - e.source.cola.x;
        if(e.source !== n)
            dy = -dy, dx = -dx;
        return norm([dx, dy]);
    }
    function is_ccw(u, v) {
        return u[0]*v[1] - u[1]*v[0] > 0;
    }
    function in_bounds(v, bounds) {
        // assume bounds are ccw
        return is_ccw(bounds[0], v) && is_ccw(v, bounds[1]);
    }
    function clip(v, bounds) {
        if(is_ccw(v, bounds[0]))
            return bounds[0];
        else if(is_ccw(bounds[1], v))
            return bounds[1];
        else return v;
    }
    function a_to_v(a) {
        return [Math.cos(a), Math.sin(a)];
    }
    function v_to_a(v) {
        return Math.atan2(v[1], v[0]);
    }
    function project(n, p) {
        p.pos = diagram.shape(n.dcg_shape.shape).intersect_vec(n, p.vec[0]*1000, p.vec[1]*1000);
    }
    function misses(p, p2) {
        return Math.hypot(p2.pos.x - p.pos.x, p2.pos.y - p.pos.y) > dc_graph.place_ports.MIN_DISTANCE;
    }
    function rand_within(a, b) {
        return a + Math.random()*(b-a);
    }
    // calculate port positions
    for(var nid in node_ports) {
        var n = nodes[nid],
            nports = node_ports[nid];

        // initial positions: use average of edge vectors, if any, or existing position
        // make sure that we have vector and angle bounds for any ports with specification
        nports.forEach(function(p) {
            if(p.edges.length) {
                var vecs = p.edges.map(edge_vec.bind(null, n));
                p.vec = [
                    d3.sum(vecs, function(v) { return v[0]; })/vecs.length,
                    d3.sum(vecs, function(v) { return v[1]; })/vecs.length
                ];
            } else p.vec = p.vec || undefined;
            var bounds = p.orig && diagram.portBounds.eval(p) || [0, 2*Math.PI];
            if(Array.isArray(bounds[0])) {
                p.vbounds = bounds;
                p.abounds = bounds.map(v_to_a);
            }
            else {
                p.vbounds = bounds.map(a_to_v);
                p.abounds = bounds;
            }
            if(p.abounds[0] > p.abounds[1])
                p.abounds[1] += 2*Math.PI;
            console.assert(p.orig || p.vec, 'unplaced unspecified port');
        });

        // determine which ports satisfy bounds or are unplaced
        var inside = [], outside = [], unplaced = [];
        nports.forEach(function(p) {
            if(!p.vec)
                unplaced.push(p);
            else if(p.vbounds && !in_bounds(p.vec, p.vbounds))
               outside.push(p);
            else
                inside.push(p);
        });

        // shunt outside ports into their bounds
        outside.forEach(function(p) {
            p.vec = clip(p.vec, p.vbounds);
            inside.push(p);
        });

        // for all unplaced ports that share a bounds, evenly distribute them within those bounds.
        // assume that bounds are disjoint.
        var boundses = {}, boundports = {};
        unplaced.forEach(function(p) {
            var boundskey = p.abounds.map(function(x) { return x.toFixed(3); }).join(',');
            boundses[boundskey] = p.abounds;
            boundports[boundskey] = boundports[boundskey] || [];
            boundports[boundskey].push(p);
        });
        for(var b in boundports) {
            var bounds = boundses[b], bports = boundports[b];
            if(bports.length === 1)
                bports[0].vec = a_to_v((bounds[0] + bounds[1])/2);
            else {
                var slice = (bounds[1] - bounds[0]) / (boundports[b].length - 1);
                boundports[b].forEach(function(p, i) {
                    p.vec = a_to_v(bounds[0] + i*slice);
                });
            }
        }
        inside = inside.concat(unplaced);
        unplaced = [];

        // determine positions of all satisfied
        inside.forEach(function(p) {
            project(n, p);
        });

        // detect any existing collisions, unplace the unedged or second one
        for(var i = 0; i < inside.length; ++i)
            for(var j = i+1; j < inside.length; ++j)
                if(!misses(inside[i], inside[j])) {
                    if(inside[j].edges.length && !inside[i].edges.length) {
                        var t = inside[i];
                        inside[i] = inside[j];
                        inside[j] = t;
                        // start over again on this i
                        --i;
                        break;
                    }
                    unplaced.push(inside[j]);
                    inside.splice(j, 1);
                }

        // place any remaining by trying random spots within the range until it misses all or we give up
        var patience = dc_graph.place_ports.NFAILS;
        while(unplaced.length) {
            var p = unplaced[0];
            p.vec = a_to_v(rand_within(p.abounds[0], p.abounds[1]));
            project(n, p);
            if(!patience-- || inside.every(misses.bind(null, p))) {
                inside.push(p);
                unplaced.shift();
                if(!patience)
                    console.warn('ran out of patience placing a port');
                patience = dc_graph.place_ports.NFAILS;
            }
        }
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
dc_graph.place_ports.MIN_DISTANCE = 20;
dc_graph.place_ports.NFAILS = 5;
