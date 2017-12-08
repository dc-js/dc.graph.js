dc_graph.label_edges = function(options) {
    options = options || {};
    var _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-edges-group';
    options.select_type = options.select_type || 'select-edges';
    options.label_group = options.label_group || 'label-edges-group';
    options.label_type = options.label_type || 'label-edges';
    options.default_label = "edge name";

    options.find_thing = function(key, node, edge) {
        return edge.filter(function(d) {
            return _behavior.parent().edgeKey.eval(d) === key;
        });
    };
    options.thing_box = function(edge, eventOptions) {
        var points = edge.datum().pos.new.path.points,
            x = (points[0].x + points[1].x)/2,
            y = (points[0].y + points[1].y)/2;
        return {x: x, y: y-10, width:0, height: 20};
    };
    options.thing_label = function(edge) {
        return _behavior.parent().edgeLabel.eval(edge.datum());
    };
    options.accept = function(edge, text) {
        var callback = _behavior.changeEdgeLabel() ?
                _behavior.changeEdgeLabel()(_behavior.parent().edgeKey.eval(edge.datum()), text) :
                Promise.resolve(text);
        return callback.then(function(text2) {
            var d = edge.datum();
            d.orig.value[_labelTag] = text2;
            _behavior.parent().redrawGroup();
        });
    };

    var _behavior = dc_graph.label_things(options);
    _behavior.changeEdgeLabel = property(null);
    return _behavior;
};
