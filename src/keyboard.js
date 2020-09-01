dc_graph.keyboard = function() {
    var _input_anchor, _dispatch = d3.dispatch('keydown', 'keyup', 'modkeyschanged');
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
    function draw(diagram) {
        _input_anchor = diagram.svg().selectAll('a#dcgraph-keyboard').data([1]);
        _input_anchor.enter()
            .insert('a', ':first-child').attr({
                id: 'dcgraph-keyboard',
                href: '#'
            });
        _input_anchor.on('keydown.keyboard', keydown);
        _input_anchor.on('keyup.keyboard', keyup);

        // grab focus whenever svg is interacted with (?)
        diagram.svg().on('mouseup.keyboard', function() {
            _mode.focus();
        });
    }
    function remove(diagram) {
        _input_anchor.remove();
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

    _mode.focus = function() {
        if(!_mode.disableFocus()) {
            _input_anchor.node().focus && _input_anchor.node().focus();
        }
    };

    _mode.disableFocus = property(false);
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
