dc_graph.wildcard_ports = function(diagram, options) {
    var get_type = options.get_type || function(p) { return p.name; },
        set_type = options.set_type || function(p, type) { p.name = type; }, // harmful? feature may only work with type in data
        is_wild = options.is_wild || function(p) { return p.orig.value.wild; },
        update_ports = options.update_ports || function() {};
    return {
        isValid: function(p1, p2) {
            return get_type(p1) === null ^ get_type(p2) === null ||
                get_type(p1) !== null && get_type(p1) === get_type(p2);
        },
        copyType: function(e, sport, tport) {
            if(get_type(sport) === null) {
                set_type(sport, get_type(tport));
                update_ports();
            } else if(get_type(tport) === null) {
                set_type(tport, get_type(sport));
                update_ports();
            }
            return Promise.resolve(e);
        },
        resetTypes: function(edges)  {
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
