import { property } from './core.js';
import { labelThings } from './label_things.js';

export function labelNodes(options) {
    options = options || {};
    const _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-nodes-group';
    options.select_type = options.select_type || 'select-nodes';
    options.label_group = options.label_group || 'label-nodes-group';
    options.label_type = options.label_type || 'label-nodes';
    options.default_label = 'node name';

    options.find_thing = function(key, node, _edge) {
        return node.filter(n => _mode.parent().nodeKey.eval(n) === key);
    };
    options.hide_thing_label = function(node, whether) {
        const contents = _mode.parent().content(_mode.parent().nodeContent.eval(node.datum()));
        contents.selectText(node).attr('visibility', whether ? 'hidden' : 'visible');
    };
    options.thing_box = function(node, _eventOptions) {
        const contents = _mode.parent().content(_mode.parent().nodeContent.eval(node.datum())),
            box = contents.textbox(node);
        box.x += node.datum().cola.x;
        box.y += node.datum().cola.y;
        return box;
    };
    options.thing_label = function(node) {
        return _mode.parent().nodeLabel.eval(node.datum());
    };
    options.accept = function(node, text) {
        const callback = _mode.changeNodeLabel()
            ? _mode.changeNodeLabel()(_mode.parent().nodeKey.eval(node.datum()), text)
            : Promise.resolve(text);
        return callback.then(async text2 => {
            const n = node.datum();
            n.orig.value[_labelTag] = text2;
            await _mode.parent().redrawGroup();
        });
    };

    const _mode = labelThings(options);
    _mode.changeNodeLabel = property(null);
    return _mode;
}
