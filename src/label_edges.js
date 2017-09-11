dc_graph.label_edges = function(options) {
    options = options || {};
    var _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-edges-group';
    options.select_type = options.select_type || 'select-edges';
    options.label_type = options.label_type || 'label-edges';

    options.find_thing = function(key, node, edge) {
        return edge.filter(function(d) {
            return _behavior.parent().edgeKey.eval(d) === key;
        });
    };
    options.thing_box = function(edge, eventOptions) {
        return {x: 400, y: 400, width:0, height: 20};
        var contents = _behavior.parent().content(_behavior.parent().edgeContent.eval(edge.datum())),
            box = contents.textbox(edge);
        box.x += edge.datum().cola.x;
        box.y += edge.datum().cola.y;
        return box;
    };
    options.thing_label = function(edge) {
        return _behavior.parent().edgeLabel.eval(edge.datum());
    };
    options.accept = function(edge, text) {
        var callback = _behavior.changeEdgeLabel() ?
                _behavior.changeEdgeLabel()(options.thing_key(_behavior.parent().edgeKey.eval(edge.datum())), text) :
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
