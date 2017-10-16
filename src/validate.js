dc_graph.validate = function() {
    function falsy(objects, accessor) {
        var f = objects.filter(function(o) {
            return !accessor(o);
        });
        return f.length ? f : null;
    }
    function validate() {
        var diagram = _behavior.parent();
        var nodes = diagram.nodeGroup().all(),
            edges = diagram.edgeGroup().all(),
            ports = diagram.portGroup() ? diagram.portGroup().all() : [];
        var errors = [];

        var f = falsy(nodes, diagram.nodeKey());
        if(f)
            errors.push(['nodeKey is falsy for ' + f.length + ' of ' + nodes.length + ' nodes:', f]);
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
