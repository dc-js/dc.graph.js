dc_graph.keyboard = function() {
    var _dispatch = d3.dispatch('keydown', 'keyup', 'modkeyschanged');
    var _unique_id = 'keyboard' + Math.floor(Math.random() * 100000);
    var _mod_keys = d3.set(['Shift', 'Control', 'Alt', 'Meta']),
        _pressed = d3.set();

    function pressed() {
        return _pressed.values().sort();
    }
    function keydown() {
        if(_mod_keys.has(d3.event.key)) {
            _pressed.add(d3.event.key);
            _dispatch.modkeyschanged(pressed());
        }
        _dispatch.keydown();
    }
    function keyup() {
        if(_mod_keys.has(d3.event.key)) {
            _pressed.remove(d3.event.key);
            _dispatch.modkeyschanged(pressed());
        }
        _dispatch.keyup();
    }
    function clear() {
        if(!_pressed.empty()) {
            _pressed = d3.set();
            _dispatch.modkeyschanged(pressed());
        }
    }
    function draw(diagram) {
        d3.select(window)
            .on('keydown.' + _unique_id, keydown)
            .on('keyup.' + _unique_id, keyup)
            .on('blur.' + _unique_id, clear);
    }
    function remove(diagram) {
        d3.select(window)
            .on('keydown.' + _unique_id, null)
            .on('keyup.' + _unique_id, null)
            .on('blur.' + _unique_id, null);
    }
    var _mode = dc_graph.mode('brush', {
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
    _mode.modKeysMatch = function(keys) {
        if(!keys || keys === [])
            return _pressed.empty();
        if(!Array.isArray(keys))
            keys = [keys];
        var p = pressed();
        if(p.length !== keys.length)
            return false;
        return keys.slice().sort().every(function(k, i) { return k === p[i]; });
    };

    return _mode;
};
