dc_graph.keyboard = function() {
    var _input_anchor, _dispatch = d3.dispatch('keydown', 'keyup');

    function keydown() {
        _dispatch.keydown();
    }
    function keyup() {
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

    return _mode;
};
