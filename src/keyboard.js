import { mode } from './mode.js';

// External dependencies
import { set } from 'd3-collection';
import { dispatch } from 'd3-dispatch';
import { event, select } from 'd3-selection';

export function keyboard() {
    const _dispatch = dispatch('keydown', 'keyup', 'modkeyschanged');
    const _unique_id = `keyboard${Math.floor(Math.random()*100000)}`;
    const _mod_keys = set(['Shift', 'Control', 'Alt', 'Meta']);
    let _pressed = set();

    function pressed() {
        return _pressed.values().sort();
    }
    function keydown() {
        if (_mod_keys.has(event.key)) {
            _pressed.add(event.key);
            _dispatch.call('modkeyschanged', null, pressed());
        }
        _dispatch.call('keydown', null, event);
    }
    function keyup() {
        if (_mod_keys.has(event.key)) {
            _pressed.remove(event.key);
            _dispatch.call('modkeyschanged', null, pressed());
        }
        _dispatch.call('keyup', null, event);
    }
    function clear() {
        if (!_pressed.empty()) {
            _pressed = set();
            _dispatch.call('modkeyschanged', null, pressed());
        }
    }
    function draw(_diagram) {
        select(window)
            .on(`keydown.${_unique_id}`, keydown)
            .on(`keyup.${_unique_id}`, keyup)
            .on(`blur.${_unique_id}`, clear);
    }
    function remove(_diagram) {
        select(window)
            .on(`keydown.${_unique_id}`, null)
            .on(`keyup.${_unique_id}`, null)
            .on(`blur.${_unique_id}`, null);
    }
    const _mode = mode('brush', {
        draw,
        remove,
    });

    _mode.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };

    _mode.modKeysPressed = function() {
        return pressed();
    };
    _mode.modKeysMatch = function(keys, ignoreKeys) {
        const pressed = set(_pressed.values());
        if (ignoreKeys) {
            if (!Array.isArray(ignoreKeys))
                ignoreKeys = [ignoreKeys];
            ignoreKeys.forEach(_key => pressed.remove(_key));
        }
        if (!keys || keys.length === 0)
            return pressed.empty();
        if (!Array.isArray(keys))
            keys = [keys];
        const pv = pressed.values();
        if (pv.length !== keys.length)
            return false;
        return keys.slice().sort().every((k, i) => k === pv[i]);
    };

    return _mode;
}
