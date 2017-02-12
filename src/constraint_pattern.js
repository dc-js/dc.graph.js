/**
 * In cola.js there are three factors which influence the positions of nodes:
 * * *edge length* suggestions, controlled by the
 * {@link #dc_graph.diagram+lengthStrategy lengthStrategy},
 * {@link #dc_graph.diagram+baseLength baseLength}, and
 * {@link #dc_graph.diagram+edgeLength edgeLength} parameters in dc.graph.js
 * * *automatic constraints* based on the global edge flow direction (`cola.flowLayout`) and overlap
 * avoidance parameters (`cola.avoidOverlaps`)
 * * *manual constraints* such as alignment, inequality and equality constraints in a dimension/axis.
 *
 * Generally when the
 * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints cola.js documentation mentions constraints},
 * it means the manual constraints.
 *
 * dc.graph.js allows generation of manual constraints using
 * {@link #dc_graph.diagram+constrain diagram.constrain} but it can be tedious to write these
 * functions because it usually means looping over the nodes and edges multiple times to
 * determine what classes or types of nodes to apply constraints to, and which edges should
 * take additional constraints.
 *
 * This utility creates a constraint generator function from a *pattern*, a graph where:
 *  1. Nodes represent *types* or classes of layout nodes, annotated with a specification
 * of how to match the nodes belonging each type.
 *  2. Edges represent *rules* to generate constraints. There are two kinds of rules:
 * <ol type='a'>
 *    <li>To generate additional constraints on edges besides the built-in ones, create a rules
 * between two different types. The rule will apply to any edges in the layout which match the
 * source and target types, and generate simple "left/right" constraints. (Note that "left" and
 * "right" in this context refer to sides of an inequality constraint `left + gap <= right`)
 *    <li>To generate constraints on a set of nodes, such as alignment, ordering, or circle
 * constraints, create a rule from a type to itself, a self edge.
 * </ol>
 * (It is also conceivable to want constraints between individual nodes which don't
 * have edges between them. This is not directly supported at this time; right now the workaround
 * is to create the edge but not draw it, e.g. by setting its {@link #dc_graph.diagram+edgeOpacity}
 * to zero. If you have a use-case for this, please
 * {@link https://github.com/dc-js/dc.graph.js/issues/new file an issue}.
 *
 * The pattern syntax is an embedded domain specific language designed to be terse without
 * restricting its power. As such, there are complicated rules for defaulting and inferring
 * parameters from other parameters. Since most users will want the simplest form, this document
 * will start from the highest level and then show how to use more complicated forms in order to
 * gain more control.
 *
 * Then we'll build back up from the ground up and show how inference works.
 * @class constraint_pattern
 * @memberof dc_graph
 * @param {dc_graph.diagram} diagram - the diagram to pull attributes from, mostly to determine
 * the keys of nodes and edge sources and targets
 * @param {Object} pattern - a graph which defines the constraints to be generated
 * @return {Function}
 */
dc_graph.constraint_pattern = function(pattern) {
    var types = {}, rules = [];

    pattern.nodes.forEach(function(n) {
        var id = n.id;
        var type = types[id] || (types[id] = {});
        // partitions could be done more efficiently; this is POC
        if(n.partition) {
            var partition = n.partition;
            var value = n.value || n.id;
            if(n.all || n.typename) {
                type.match = n.extract ?
                    function(n2) { return n.extract(n2.value[partition]); } :
                    function(n2) { return n2.value[partition]; };
                type.typename = n.typename || function(n2) { return partition + '=' + n2.value[partition]; };
            }
            else
                type.match = function(n2) { return n2.value[partition] === value; };
        }
        else if(n.match)
            type.match = n.match;
        else throw new Error("couldn't determine matcher for type " + JSON.stringify(n));
    });
    pattern.edges.forEach(function(e) {
        if(e.disable)
            return;
        var rule = {source: e.source, target: e.target};
        rule.produce = typeof e.produce === 'function' ? e.produce : function() {
            return clone(e.produce);
        };
        ['listname', 'wrap', 'reverse'].forEach(function(k) {
            if(e[k] !== undefined) rule[k] = e[k];
        });
        rules.push(rule);
    });

    return function(diagram, nodes, edges) {
        var constraints = [];
        var members = {};
        nodes.forEach(function(n) {
            var key = diagram.nodeKey.eval(n);
            for(var t in types) {
                var type = types[t], value = type.match(n.orig);
                if(value) {
                    var tname = type.typename ? type.typename(t, value) : t;
                    if(!members[tname])
                        members[tname] = {
                            nodes: [], // original ordering
                            whether: {} // boolean
                        };
                    members[tname].nodes.push(key);
                    members[tname].whether[key] = true;
                }
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
            var source = diagram.edgeSource.eval(e),
                target = diagram.edgeTarget.eval(e);
            edge_rules.forEach(function(r) {
                if(members[r.source] && members[r.source].whether[source] &&
                   members[r.target] && members[r.target].whether[target]) {
                    var constraint = r.produce(members, nodes, edges);
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
            if(!members[r.source])
                return;
            var constraint = r.produce(),
                listname = r.listname || r.produce.listname || 'nodes',
                wrap = r.wrap || r.produce.wrap || function(x) { return x; };
            constraint[listname] = members[r.source].nodes.map(wrap);
            constraints.push(constraint);
        });
        return constraints;
    };
};

// constraint generation convenience functions
dc_graph.gap_y = function(gap, equality) {
    return {
        axis: 'y',
        gap: gap,
        equality: !!equality
    };
};
dc_graph.gap_x = function(gap, equality) {
    return {
        axis: 'x',
        gap: gap,
        equality: !!equality
    };
};

function align_f(axis) {
    var ret = function() {
        return {
            type: 'alignment',
            axis: axis
        };
    };
    ret.listname = 'offsets';
    ret.wrap = function(x) { return {node: x, offset: 0}; };
    return ret;
}

dc_graph.align_y = function() {
    return align_f('y');
};
dc_graph.align_x = function() {
    return align_f('x');
};

dc_graph.order_x = function(gap, ordering) {
    return {
        type: 'ordering',
        axis: 'x',
        gap: 60,
        ordering: ordering
    };
};
dc_graph.order_y = function(gap, ordering) {
    return {
        type: 'ordering',
        axis: 'y',
        gap: 60,
        ordering: ordering
    };
};
