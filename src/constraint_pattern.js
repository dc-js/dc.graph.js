/**
 * The bubble overlay chart is quite different from the typical bubble chart. With the bubble overlay
 * chart you can arbitrarily place bubbles on an existing svg or bitmap image, thus changing the
 * typical x and y positioning while retaining the capability to visualize data using bubble radius
 * and coloring.
 * Examples:
 * - {@link http://dc-js.github.com/dc.js/crime/index.html Canadian City Crime Stats}
 * @name bubbleOverlay
 * @memberof dc
 * @mixes dc.bubbleMixin
 * @mixes dc.baseMixin
 * @example
 * // create a bubble overlay chart on top of the '#chart-container1 svg' element using the default global chart group
 * var bubbleChart1 = dc.bubbleOverlayChart('#chart-container1').svg(d3.select('#chart-container1 svg'));
 * // create a bubble overlay chart on top of the '#chart-container2 svg' element using chart group A
 * var bubbleChart2 = dc.compositeChart('#chart-container2', 'chartGroupA').svg(d3.select('#chart-container2 svg'));
 * @param {String|node|d3.selection} parent - Any valid
 * {@link https://github.com/mbostock/d3/wiki/Selections#selecting-elements d3 single selector} specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @return {dc.bubbleOverlay}
 */
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
            if(n.all || n.typename) {
                type.match = function(n2) { return n2.value[partition]; };
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
            return Object.create(e.produce);
        };
        ['listname', 'wrap', 'reverse'].forEach(function(k) {
            if(e[k] !== undefined) rule[k] = e[k];
        });
        rules.push(rule);
    });

    return function(nodes, edges, constraints) {
        var members = {};
        nodes.forEach(function(n) {
            var key = param(diagram.nodeKey())(n);
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
            var source = param(diagram.edgeSource())(e),
                target = param(diagram.edgeTarget())(e);
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
