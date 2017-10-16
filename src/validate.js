dc_graph.validate = function() {
    function falsy(objects, accessor, what, who) {
        var f = objects.filter(function(o) {
            return !accessor(o);
        });
        return f.length ?
            [what + ' is empty for ' + f.length + ' of ' + objects.length + ' ' + who, f] :
            null;
    }
    function build_index(objects, accessor) {
        return objects.reduce(function(m, o) {
            m[accessor(o)] = o;
            return m;
        }, {});
    }
    function not_found(index, objects, accessor, what, where, who) {
        var nf = objects.filter(function(o) {
            return !index[accessor(o)];
        }).map(function(o) {
            return {key: accessor(o), value: o};
        });
        return nf.length ?
            [what + ' was not found in ' + where + ' for ' + nf.length + ' of ' + objects.length + ' ' + who, nf] :
            null;
    }
    function validate() {
        var diagram = _behavior.parent();
        var nodes = diagram.nodeGroup().all(),
            edges = diagram.edgeGroup().all(),
            ports = diagram.portGroup() ? diagram.portGroup().all() : [];
        var errors = [];

        function check(error) {
            if(error)
                errors.push(error);
        }

        check(falsy(nodes, diagram.nodeKey(), 'nodeKey', 'nodes'));
        check(falsy(edges, diagram.edgeSource(), 'edgeSource', 'edges'));
        check(falsy(edges, diagram.edgeTarget(), 'edgeTarget', 'edges'));

        var nindex = build_index(nodes, diagram.nodeKey()),
            eindex = build_index(edges, diagram.edgeKey());
        check(not_found(nindex, edges, diagram.edgeSource(), 'edgeSource', 'nodes', 'edges'));
        check(not_found(nindex, edges, diagram.edgeTarget(), 'edgeTarget', 'nodes', 'edges'));

        check(falsy(ports, function(p) {
            return diagram.portNodeKey() && diagram.portNodeKey()(p) ||
                diagram.portEdgeKey() && diagram.portEdgeKey()(p);
        }, 'portNodeKey||portEdgeKey', 'ports'));

        var named_ports = !diagram.portNodeKey() && [] || ports.filter(function(p) {
            return diagram.portNodeKey()(p);
        });
        var anonymous_ports = !diagram.portEdgeKey() && [] || ports.filter(function(p) {
            return diagram.portEdgeKey()(p);
        });
        check(not_found(nindex, named_ports, diagram.portNodeKey(), 'portNodeKey', 'nodes', 'ports'));
        check(not_found(eindex, anonymous_ports, diagram.portEdgeKey(), 'portEdgeKey', 'edges', 'ports'));

        function count_text() {
            return nodes.length + ' nodes, ' + edges.length + ' edges, ' + ports.length + ' ports';
        }
        if(errors.length) {
            console.warn('validation failed with ' + count_text() + ':');
            errors.forEach(function(err) {
                console.warn.apply(null, err);
            });
        }
        console.log('validation succeeded with ' + count_text() + '.');
    }
    var _behavior = {
        parent: property(null).react(function(p) {
            p.on('preDraw', validate);
        })
    };

    return _behavior;
};
