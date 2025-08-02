import { mode } from './mode.js';

// External dependencies
import { dispatch } from 'd3-dispatch';
import { set } from 'd3-collection';
import { select, event } from 'd3-selection';

export function keyboard() {
    var _dispatch = dispatch('keydown', 'keyup', 'modkeyschanged');
    var _unique_id = 'keyboard' + Math.floor(Math.random() * 100000);
    var _mod_keys = set(['Shift', 'Control', 'Alt', 'Meta']),
        _pressed = set();

    function pressed() {
        return _pressed.values().sort();
    }
    function keydown() {
        if(_mod_keys.has(event.key)) {
            _pressed.add(event.key);
            _dispatch.call("modkeyschanged", null, pressed());
        }
        _dispatch.call("keydown", null, event);
    }
    function keyup() {
        if(_mod_keys.has(event.key)) {
            _pressed.remove(event.key);
            _dispatch.call("modkeyschanged", null, pressed());
        }
        _dispatch.call("keyup", null, event);
    }
    function clear() {
        if(!_pressed.empty()) {
            _pressed = set();
            _dispatch.call("modkeyschanged", null, pressed());
        }
    }
    function draw(diagram) {
        select(window)
            .on('keydown.' + _unique_id, keydown)
            .on('keyup.' + _unique_id, keyup)
            .on('blur.' + _unique_id, clear);
    }
    function remove(diagram) {
        select(window)
            .on('keydown.' + _unique_id, null)
            .on('keyup.' + _unique_id, null)
            .on('blur.' + _unique_id, null);
    }
    var _mode = mode('brush', {
        draw: draw,
        remove: remove
    });

    _mode.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };

    _mode.modKeysPressed = function() {
        return pressed();
    };
    _mode.modKeysMatch = function(keys, ignoreKeys) {
        const pressed = set(_pressed.values());
        if(ignoreKeys) {
            if(!Array.isArray(ignoreKeys))
                ignoreKeys = [ignoreKeys];
            ignoreKeys.forEach(key => pressed.remove(key))
        }
        if(!keys || keys === [])
            return pressed.empty();
        if(!Array.isArray(keys))
            keys = [keys];
        const pv = pressed.values();
        if(pv.length !== keys.length)
            return false;
        return keys.slice().sort().every(function(k, i) { return k === pv[i]; });
    };

    return _mode;
};
