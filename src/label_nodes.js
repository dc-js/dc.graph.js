dc_graph.label_nodes = function(options) {
    options = options || {};
    var _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-nodes-group';
    options.select_type = options.select_type || 'select-nodes';
    options.label_group = options.label_group || 'label-nodes-group';
    options.label_type = options.label_type || 'label-nodes';
    options.default_label = "node name";

    options.find_thing = function(key, node, edge) {
        return node.filter(function(n) {
            return _behavior.parent().nodeKey.eval(n) === key;
        });
    };
    options.thing_box = function(node, eventOptions) {
        var contents = _behavior.parent().content(_behavior.parent().nodeContent.eval(node.datum())),
            box = contents.textbox(node);
        box.x += node.datum().cola.x;
        box.y += node.datum().cola.y;
        return box;
    };
    options.thing_label = function(node) {
        return _behavior.parent().nodeLabel.eval(node.datum());
    };
    options.accept = function(node, text) {
        var callback = _behavior.changeNodeLabel() ?
                _behavior.changeNodeLabel()(_behavior.parent().nodeKey.eval(node.datum()), text) :
                Promise.resolve(text);
        return callback.then(function(text2) {
            var n = node.datum();
            n.orig.value[_labelTag] = text2;
            _behavior.parent().redrawGroup();
        });
    };

    var _behavior = dc_graph.label_things(options);
    _behavior.changeNodeLabel = property(null);
    return _behavior;
};
