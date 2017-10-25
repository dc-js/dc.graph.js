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
function project_port(diagram, n, p) {
    p.pos = diagram.shape(n.dcg_shape.shape).intersect_vec(n, p.vec[0]*1000, p.vec[1]*1000);
}

dc_graph.place_ports = function() {
    function received_layout(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        var node_ports = diagram.nodePorts();

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
        function distance(p, p2) {
            return Math.hypot(p2.pos.x - p.pos.x, p2.pos.y - p.pos.y);
        }
        function misses(p, p2) {
            var dist = distance(p, p2);
            var misses = dist > _behavior.minDistance();
            return misses;
        }
        function rand_within(a, b) {
            return a + Math.random()*(b-a);
        }
        // calculate port positions
        for(var nid in node_ports) {
            var n = nodes[nid],
                nports = node_ports[nid];

            // make sure that we have vector and angle bounds for any ports with specification
            nports.forEach(function(p) {
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
                project_port(diagram, n, p);
            });

            // detect any existing collisions, unplace the one without edges or second one
            for(var i = 0; i < inside.length; ++i) {
                var x = inside[i];
                if(unplaced.includes(x))
                    continue;
                for(var j = i+1; j < inside.length; ++j) {
                    var y = inside[j];
                    if(unplaced.includes(y))
                        continue;
                    if(!misses(x, y)) {
                        if(!x.edges.length) {
                            unplaced.push(x);
                            continue;
                        }
                        else
                            unplaced.push(y);
                    }
                }
            }
            inside = inside.filter(function(p) { return !unplaced.includes(p); });

            // place any remaining by trying random spots within the range until it misses all or we give up
            var patience = _behavior.patience(), maxdist = 0, maxvec;
            while(unplaced.length) {
                var p = unplaced[0];
                p.vec = a_to_v(rand_within(p.abounds[0], p.abounds[1]));
                project_port(diagram, n, p);
                var mindist = d3.min(inside, function(p2) { return distance(p, p2); });
                if(mindist > maxdist) {
                    maxdist = mindist;
                    maxvec = p.vec;
                }
                if(!patience-- || mindist > _behavior.minDistance()) {
                    if(patience<0) {
                        console.warn('ran out of patience placing a port');
                        p.vec = maxvec;
                        project_port(diagram, n, p);
                    }
                    inside.push(p);
                    unplaced.shift();
                    patience = _behavior.patience();
                    maxdist = 0;
                }
            }
        }
    };
    var _behavior = {
        parent: property(null).react(function(p) {
            if(p) {
                p.on('receivedLayout.place-ports', received_layout);
            } else if(_behavior.parent())
                _behavior.parent().on('receivedLayout.place-ports', null);
        }),
        // minimum distance between ports
        minDistance: property(20),
        // number of random places to try when resolving collision
        patience: property(20)
    };

    return _behavior;
};
