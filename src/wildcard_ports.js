dc_graph.wildcard_ports = function(diagram, options) {
    var get_type = options.get_type || function(p) { return p.name; },
        set_type = options.set_type || function(p, type) { p.name = type; }, // harmful? feature may only work with type in data
        get_wild = options.get_wild || function(p) { return p.orig.value.wild; },
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
                var p = diagram.getPort(e.source.orig.key, null, e.orig.value.sourceport);
                if(p.orig.value.wild && p.edges.length === 1)
                    p.orig.value.type = null;
                p = diagram.getPort(e.target.orig.key, null, e.orig.value.targetport);
                if(p.orig.value.wild && p.edges.length === 1)
                    p.orig.value.type = null;
            });
            return Promise.resolve(edges);
        }
    };
};
