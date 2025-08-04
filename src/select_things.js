import { mode } from './mode.js';
import { property } from './core.js';
import { brush } from './brush.js';
import { keyboard } from './keyboard.js';
import { is_a_mac } from './utils.js';
import { dispatch } from 'd3-dispatch';
import { event } from 'd3-selection';

export function selectThings(things_group, things_name, thinginess) {
    let _selected = [], _oldSelected;
    let _mousedownThing = null;
    let _keyboard;

    const contains_predicate = thinginess.keysEqual ?
            function(k1) {
                return function(k2) {
                    return thinginess.keysEqual(k1, k2);
                };
            } :
        function(k1) {
            return function(k2) {
                return k1 === k2;
            };
        };
    function contains(array, key) {
        return !!_selected.find(contains_predicate(key));
    }
    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }
    function add_array(array, key) {
        return contains(array, key) ? array : array.concat([key]);
    }
    function toggle_array(array, key) {
        return contains(array, key) ? array.filter((x) => x != key) : array.concat([key]);
    }

    function selection_changed(diagram) {
        return function(selection, refresh) {
            if(refresh === undefined)
                refresh = true;
            _selected = selection;
            if(refresh)
                diagram.requestRefresh();
        };
    }
    let _have_bce = false;
    function background_click_event(diagram, v) {
        // we seem to have nodes-background interrupting edges-background by reinstalling uselessly
        if(_have_bce === v)
            return;
        diagram.svg().on(`click.${  things_name}`, v ? function(_t) {
            if(event.target === this)
                things_group.call('set_changed', null, []);
        } : null);
        _have_bce = v;
    }
    function modkeyschanged() {
        if(_mode.multipleSelect()) {
            const brush_mode = _mode.parent().child('brush');
            if(_keyboard.modKeysMatch(_mode.modKeys(), is_a_mac ? 'Meta' : 'Control'))
                brush_mode.activate();
            else
                brush_mode.deactivate();
        }
    }
    function brushstart() {
        if(isUnion(event.sourceEvent) || isToggle(event.sourceEvent))
            _oldSelected = _selected.slice();
        else {
            _oldSelected = [];
            things_group.call('set_changed', null, []);
        }
    }
    function brushmove(ext) {
        if(!thinginess.intersectRect)
            return;
        const rectSelect = ext ? thinginess.intersectRect(ext) : [];
        let newSelected;
        if(isUnion(event.sourceEvent))
            newSelected = rectSelect.reduce(add_array, _oldSelected);
        else if(isToggle(event.sourceEvent))
            newSelected = rectSelect.reduce(toggle_array, _oldSelected);
        else
            newSelected = rectSelect;
        things_group.call('set_changed', null, newSelected);
    }

    function draw(diagram, node, edge) {
        const condition = _mode.noneIsAll() ? function(t) {
            return !_selected.length || contains(_selected, thinginess.key(t));
        } : function(t) {
            return contains(_selected, thinginess.key(t));
        };
        thinginess.applyStyles(condition);

        thinginess.clickables(diagram, node, edge).on(`mousedown.${  things_name}`, (t) => {
            _mousedownThing = t;
        });

        thinginess.clickables(diagram, node, edge).on(`mouseup.${  things_name}`, (t) => {
            if(thinginess.excludeClick && thinginess.excludeClick(event.target))
                return;
            // it's only a click if the same target was mousedown & mouseup
            // but we can't use click event because things may have been reordered
            if(_mousedownThing !== t)
                return;
            const key = thinginess.key(t);
            let newSelected;
            if(_mode.multipleSelect()) {
                if(isUnion(event))
                    newSelected = add_array(_selected, key);
                else if(isToggle(event))
                    newSelected = toggle_array(_selected, key);
            }
            if(!newSelected)
                newSelected = [key];
            things_group.call('set_changed', null, newSelected);
        });

        if(_mode.multipleSelect()) {
            if(_keyboard.modKeysMatch(_mode.modKeys()))
                diagram.child('brush').activate();
        }
        else
            background_click_event(diagram, _mode.clickBackgroundClears());

        if(_mode.autoCropSelection()) {
            // drop any selected which no longer exist in the diagram
            const present = thinginess.clickables(diagram, node, edge).data().map(thinginess.key);
            const now_selected = _selected.filter((k) => contains(present, k));
            if(_selected.length !== now_selected.length)
                things_group.call('set_changed', null, now_selected, false);
        }
    }

    function remove(diagram, node, edge) {
        thinginess.clickables(diagram, node, edge).on(`click.${  things_name}`, null);
        diagram.svg().on(`click.${  things_name}`, null);
        thinginess.removeStyles();
    }

    const _mode = mode(things_name, {
        draw,
        remove,
        parent(p) {
            things_group.on(`set_changed.${  things_name}`, p ? selection_changed(p) : null);
            if(p && _mode.multipleSelect()) {
                let brush_mode = p.child('brush');
                if(!brush_mode) {
                    brush_mode = brush();
                    p.child('brush', brush_mode);
                }
                brush_mode
                    .on(`brushstart.${  things_name}`, brushstart)
                    .on(`brushmove.${  things_name}`, brushmove);
            }
            _keyboard = p.child('keyboard');
            if(!_keyboard)
                p.child('keyboard', _keyboard = keyboard());
            _keyboard.on(`modkeyschanged.${  things_name}`, modkeyschanged);
        },
        laterDraw: thinginess.laterDraw || false
    });

    _mode.multipleSelect = property(true);
    _mode.modKeys = property(null);
    _mode.clickBackgroundClears = property(true, false).react((v) => {
        if(!_mode.multipleSelect() && _mode.parent())
            background_click_event(_mode.parent(), v);
    });
    _mode.noneIsAll = property(false);
    // if you're replacing the data, you probably want the selection not to be preserved when a thing
    // with the same key re-appears later (true). however, if you're filtering dc.js-style, you
    // probably want filters to be independent between diagrams (false)
    _mode.autoCropSelection = property(true);
    // if you want to do the cool things select_things can do
    _mode.thinginess = function() {
        return thinginess;
    };
    return _mode;
};

export function selectThingsGroup(brushgroup, type) {
    window.chart_registry.create_type(type, () => dispatch('set_changed'));

    return window.chart_registry.create_group(type, brushgroup);
}
