dc_graph.label_edges = function(options) {
    options = options || {};
    var _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-edges-group';
    options.select_type = options.select_type || 'select-edges';
    options.label_group = options.label_group || 'label-edges-group';
    options.label_type = options.label_type || 'label-edges';
    options.default_label = "edge name";

    options.find_thing = function(key, node, edge) {
        return edge.filter(function(e) {
            return _mode.parent().edgeKey.eval(e) === key;
        });
    };
    options.hide_thing_label = function(edge, whether) {
        var label = _mode.parent().selectAll('#' + _mode.parent().edgeId(edge.datum()) + '-label textPath');
        label.attr('visibility', whether ? 'hidden' : 'visible');
    };
    options.thing_box = function(edge, eventOptions) {
        var points = edge.datum().pos.new.path.points,
            x = (points[0].x + points[1].x)/2,
            y = (points[0].y + points[1].y)/2;
        return {x: x, y: y-10, width:0, height: 20};
    };
    options.thing_label = function(edge) {
        return _mode.parent().edgeLabel.eval(edge.datum());
    };
    options.accept = function(edge, text) {
        var callback = _mode.changeEdgeLabel() ?
                _mode.changeEdgeLabel()(_mode.parent().edgeKey.eval(edge.datum()), text) :
                Promise.resolve(text);
        return callback.then(function(text2) {
            var e = edge.datum();
            e.orig.value[_labelTag] = text2;
            _mode.parent().redrawGroup();
        });
    };

    var _mode = dc_graph.label_things(options);
    _mode.changeEdgeLabel = property(null);
    return _mode;
};
