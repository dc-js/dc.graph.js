dc_graph.wildcard_ports = function(options) {
    var get_type = options.get_type || function(p) { return p.orig.value.type; },
        set_type = options.set_type || function(p, src) { p.orig.value.type = src.orig.value.type; },
        get_name = options.get_name || function(p) { return p.orig.value.name; },
        is_wild = options.is_wild || function(p) { return p.orig.value.wild; },
        update_ports = options.update_ports || function() {},
        get_linked = options.get_linked || function() { return []; };
    return {
        isValid: function(p1, p2) {
            return get_type(p1) === null ^ get_type(p2) === null ||
                get_type(p1) !== null && get_type(p1) === get_type(p2);
        },
        copyLinked: function(n, port) {
            var name = get_name(port);
            var links = get_linked(n) || [];
            var found = links.find(function(set) {
                return set.includes(name);
            });
            if(found) {
                found.forEach(function(link) {
                    if(link != name)
                        set_type(diagram.getPort(diagram.nodeKey.eval(n), null, link), port);
                });
            }
        },
        copyType: function(e, sport, tport) {
            if(get_type(sport) === null) {
                set_type(sport, tport);
                this.copyLinked(sport.node, sport);
                update_ports();
            } else if(get_type(tport) === null) {
                set_type(tport, sport);
                this.copyLinked(tport.node, tport);
                update_ports();
            }
            return Promise.resolve(e);
        },
        resetTypes: function(diagram, edges)  {
            edges.forEach(function(eid) {
                var e = diagram.getWholeEdge(eid);
                var p = diagram.getPort(diagram.nodeKey.eval(e.source), null,
                                        diagram.edgeSourcePortName.eval(e));
                if(is_wild(p) && p.edges.length === 1)
                    set_type(p, null);
                var p = diagram.getPort(diagram.nodeKey.eval(e.target), null,
                                        diagram.edgeTargetPortName.eval(e));
                if(is_wild(p) && p.edges.length === 1)
                    set_type(p, null);
            });
            return Promise.resolve(edges);
        }
    };
};
