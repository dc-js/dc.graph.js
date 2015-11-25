// terminology: the nodes and edges of a constraint pattern are "types" and "rules"
// nodes in the layout are matched against the types; constraints are generated from the rules
// there are two general kinds of rules:
//  - rules between two types apply to any edges in the layout which match the source and target types
// and generate simple left/right constraints
//  - rules from a type to itself (self edges) generate a single constraint on all the nodes which
// match the type
dc_graph.constraint_pattern = function(diagram, pattern) {
    var types = {}, rules = [];

    pattern.nodes.forEach(function(n) {
        var id = n.id;
        var type = types[id] || (types[id] = {});
        // partitions could be done more efficiently; this is POC
        if(n.partition) {
            var partition = n.partition;
            var value = n.value || n.id;
            type.match = function(n) { return n.orig.value[partition] === value; }; // generalize orig.value?
        }
        else if(n.match)
            type.match = n.match;
        else throw new Error("couldn't determine matcher for type " + JSON.stringify(n));
    });
    pattern.edges.forEach(function(e) {
        var rule = {source: e.source, target: e.target};
        rule.produce = typeof e.produce === 'function' ? e.produce : function() {
            return Object.create(e.produce);
        };
        ['listname', 'wrap', 'reverse'].forEach(function(k) {
            if(e[k] !== undefined) rule[k] = e[k];
        });
        rules.push(rule);
    });

    return function(nodes, edges, constraints) {
        var members = {};
        for(var id in types)
            members[id] = {};
        nodes.forEach(function(n) {
            var key = param(diagram.nodeKey())(n);
            for(var t in types) {
                var type = types[t];
                if(type.match(n))
                    members[t][key] = true;
            }
        });
        // traversal of rules could be more efficient, again POC
        var edge_rules = rules.filter(function(r) {
            return r.source !== r.target;
        });
        var type_rules = rules.filter(function(r) {
            return r.source === r.target;
        });
        edges.forEach(function(e) {
            var source = param(diagram.edgeSource())(e),
                target = param(diagram.edgeTarget())(e);
            edge_rules.forEach(function(r) {
                if(members[r.source][source] && members[r.target][target]) {
                    var constraint = r.produce();
                    if(r.reverse) {
                        constraint.left = target;
                        constraint.right = source;
                    }
                    else {
                        constraint.left = source;
                        constraint.right = target;
                    }
                    constraints.push(constraint);
                }
            });
        });
        type_rules.forEach(function(r) {
            var constraint = r.produce(),
                listname = r.listname || 'nodes',
                wrap = r.wrap || function(x) { return x; };
            constraint[listname] = Object.keys(members[r.source]).map(wrap);
            constraints.push(constraint);
        });
        return constraints;
    };
};

