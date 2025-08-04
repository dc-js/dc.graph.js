import { mode } from './mode.js';
import { keyboard } from './keyboard.js';
import { editText } from './edit_text.js';
import { selectThingsGroup } from './select_things.js';

// External dependency loaded as global
import { dispatch } from 'd3-dispatch';
import { event } from 'd3-selection';

export function labelThings(options) {
    options = options || {};
    const select_things_group = selectThingsGroup(options.select_group, options.select_type),
        label_things_group = labelThingsGroup(options.label_group, options.label_type);
    let _selected = [];
    let _keyboard, _selectThings;

    function selection_changed_listener(_diagram) {
        return function(selection) {
            _selected = selection;
        };
    }

    function edit_label_listener(diagram) {
        return function(thing, eventOptions) {
            const box = options.thing_box(thing);
            options.hide_thing_label(thing, true);
            editText(
                diagram.g(),
                {
                    text: eventOptions.text || options.thing_label(thing) || options.default_label,
                    align: options.align,
                    class: options.class,
                    box,
                    selectText: eventOptions.selectText,
                    accept(text) {
                        return options.accept(thing, text);
                    },
                    finally() {
                        options.hide_thing_label(thing, false);
                    }
                });
        };
    }

    function edit_selection(node, edge, eventOptions) {
        // less than ideal interface.
        // what if there are other things? can i blame the missing metagraph?
        const thing = options.find_thing(_selected[0], node, edge);
        if(thing.empty()) {
            console.error(`couldn't find thing '${  _selected[0]  }'!`);
            return;
        }
        if(thing.size()>1) {
            console.error(`found too many things for '${  _selected[0]  }' (${  thing.size()  })!`);
            return;
        }
        label_things_group.call('edit_label', null, thing, eventOptions);
    }
    function draw(diagram, node, edge) {
        _keyboard.on(`keyup.${  options.label_type}`, () => {
            if(_selected.length) {
                // printable characters should start edit
                if(event.key.length !== 1)
                    return;
                edit_selection(node, edge, {text: event.key, selectText: false});
            }
        });
        if(_selectThings)
            _selectThings.thinginess().clickables(diagram, node, edge).on(`dblclick.${  options.label_type}`, () => {
                edit_selection(node, edge, {selectText: true});
            });
    }

    function remove(_diagram, _node, _edge) {
    }

    const _mode = mode(options.label_type, {
        draw,
        remove,
        parent(p) {
            select_things_group.on(`set_changed.${  options.label_type}`, p ? selection_changed_listener(p) : null);
            label_things_group.on(`edit_label.${  options.label_type}`, p ? edit_label_listener(p) : null);
            if(p) {
                _keyboard = p.child('keyboard');
                if(!_keyboard)
                    p.child('keyboard', _keyboard = keyboard());
                _selectThings = p.child(options.select_type);
            }
        }
    });
    _mode.editSelection = function(eventOptions) {
        edit_selection(_mode.parent().selectAllNodes(), _mode.parent().selectAllEdges(), eventOptions);
    };
    return _mode;
};

export function labelThingsGroup(brushgroup, type) {
    window.chart_registry.create_type(type, () => dispatch('edit_label'));

    return window.chart_registry.create_group(type, brushgroup);
}
