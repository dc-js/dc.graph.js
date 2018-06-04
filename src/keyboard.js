dc_graph.keyboard = function() {
    var _input_anchor, _dispatch = d3.dispatch('keydown', 'keyup');

    function keydown() {
        _dispatch.keydown();
    }
    function keyup() {
        _dispatch.keyup();
    }
    function add_behavior(diagram) {
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
            _behavior.focus();
        });
    }
    function remove_behavior(diagram) {
        _input_anchor.remove();
    }
    var _behavior = dc_graph.behavior('brush', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior
    });

    _behavior.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };

    _behavior.focus = function() {
        if(!_behavior.disableFocus())
            _input_anchor.node().focus();
    };

    _behavior.disableFocus = property(false);

    return _behavior;
};
