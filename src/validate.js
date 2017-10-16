dc_graph.validate = function() {
    function falsy(objects, accessor, what, who) {
        var f = objects.filter(function(o) {
            return !accessor(o);
        });
        return f.length ?
            [what + ' is falsy for ' + f.length + ' of ' + objects.length + ' ' + who, f] :
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

        var f = falsy(nodes, diagram.nodeKey(), 'nodeKey', 'nodes');
        if(f)
            errors.push(f);
        f = falsy(edges, diagram.edgeSource(), 'edgeSource', 'edges');
        if(f)
            errors.push(f);
        f = falsy(edges, diagram.edgeTarget(), 'edgeTarget', 'edges');
        if(f)
            errors.push(f);

        var nindex = build_index(nodes, diagram.nodeKey());
        var nf = not_found(nindex, edges, diagram.edgeSource(), 'edgeSource', 'nodes', 'edges');
        if(nf)
            errors.push(nf);
        nf = not_found(nindex, edges, diagram.edgeTarget(), 'edgeTarget', 'nodes', 'edges');
        if(nf)
            errors.push(nf);

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
