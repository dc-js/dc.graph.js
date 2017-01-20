dc_graph.label_nodes = function(options) {
    if(!options.nodeCrossfilter)
        throw new Error('need nodeCrossfilter');
    var _idTag = options.idTag || 'id',
        _labelTag = options.labelTag || 'label';
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group');
    var _selected = [];

    function selection_changed_listener(chart) {
        return function(selection) {
            _selected = selection;
        };
    }

    function add_behavior(chart, node, edge) {
        var input_anchor = chart.svg().selectAll('a#label-nodes-input').data([1]);
        input_anchor.enter()
            .append('a').attr({
                id: 'label-nodes-input',
                href: '#'
            });
        input_anchor.node().focus();
        input_anchor.on('keyup.label-nodes', function() {
            console.log('got input!!!');
            if(_selected.length) {
                // ok we need a data api
                var all = options.nodeCrossfilter.all();
                var n = all.find(function(r) {
                    return r[_idTag] === _selected[0];
                });
                if(!n) {
                    console.error("couldn't find node '" + _selected[0] + "'!");
                    return;
                }
                n[_labelTag] = d3.event.key;
                chart.refresh();
            }
        });
    }

    function remove_behavior(chart, node, edge) {
        chart.root().select('a#label-nodes-input').remove();
    }

    var _behavior = dc_graph.behavior('label-nodes', {
        add_behavior: add_behavior,
        remove_behavior: remove_behavior,
        parent: function(p) {
            select_nodes_group.on('node_set_changed.label-nodes', p ? selection_changed_listener(p) : null);
        }
    });
    return _behavior;
};
