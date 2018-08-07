dc_graph.wildcard_ports = function(options) {
    var diagram = options.diagram,
        get_type = options.get_type || function(p) { return p.orig.value.type; },
        set_type = options.set_type || function(p, src) { p.orig.value.type = src.orig.value.type; },
        get_name = options.get_name || function(p) { return p.orig.value.name; },
        is_wild = options.is_wild || function(p) { return p.orig.value.wild; },
        update_ports = options.update_ports || function() {},
        get_linked = options.get_linked || function() { return []; };
    function linked_ports(n, port) {
        if(!diagram)
            return [];
        var nid = diagram.nodeKey.eval(n);
        var name = get_name(port);
        var links = get_linked(n) || [];
        var found = links.find(function(set) {
            return set.includes(name);
        });
        if(!found) return [];
        return found.filter(function(link) { return link !== name; }).map(function(link) {
            return diagram.getPort(nid, null, link);
        });
    }
    function no_edges(ports) {
        return ports.every(function(lp) {
            return lp.edges.length === 0;
        });
    }
    return {
        isValid: function(p1, p2) {
            return get_type(p1) === null ^ get_type(p2) === null ||
                get_type(p1) !== null && get_type(p1) === get_type(p2);
        },
        whyInvalid: function(p1, p2) {
            return get_type(p1) === null && get_type(p2) === null && "can't connect wildcard to wildcard" ||
                get_type(p1) !== get_type(p2) && "the types of ports must match";
        },
        copyLinked: function(n, port) {
            linked_ports(n, port).forEach(function(lp) {
                set_type(lp, port);
            });
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
        resetTypes: function(edges)  {
            // backward compatibility: this used to take diagram as
            // first arg, which was wrong
            var dia = diagram;
            if(arguments.length === 2) {
                dia = arguments[0];
                edges = arguments[1];
            }
            edges.forEach(function(eid) {
                var e = dia.getWholeEdge(eid),
                    spname = dia.edgeSourcePortName.eval(e),
                    tpname = dia.edgeTargetPortName.eval(e);
                var update = false;
                var p = dia.getPort(dia.nodeKey.eval(e.source), null, spname);
                var linked = linked_ports(e.source, p);
                if(is_wild(p) && p.edges.length === 1 && no_edges(linked)) {
                    set_type(p, null);
                    linked.forEach(function(lp) {
                        set_type(lp, null);
                        update = true;
                    });
                }
                p = dia.getPort(dia.nodeKey.eval(e.target), null, tpname);
                linked = linked_ports(e.target, p);
                if(is_wild(p) && p.edges.length === 1 && no_edges(linked)) {
                    set_type(p, null);
                    linked.forEach(function(lp) {
                        set_type(lp, null);
                        update = true;
                    });
                }
                if(update)
                    update_ports();
            });
            return Promise.resolve(edges);
        }
    };
};
