dc_graph.label_nodes = function(options) {
    if(!options.nodeCrossfilter)
        throw new Error('need nodeCrossfilter');
    var _idTag = options.idTag || 'id',
        _labelTag = options.labelTag || 'label';
    var select_nodes_group = dc_graph.select_nodes_group('select-nodes-group'),
        label_nodes_group = dc_graph.label_nodes_group('label-nodes-group');
    var _selected = [];
    var _input_anchor;

    function selection_changed_listener(chart) {
        return function(selection) {
            _selected = selection;
            if(_selected.length)
                _input_anchor.node().focus();
        };
    }

    function edit_node_label_listener(chart) {
        return function(node, options) {
            dc_graph.edit_text(
                chart.svg(),
                node,
                {
                    text: options.text || chart.nodeLabel.eval(node.datum()),
                    position: {x: node.datum().cola.x, y: node.datum().cola.y},
                    selectText: options.selectText,
                    accept: function(text) {
                        var d = node.datum();
                        d.orig.value[_labelTag] = text;
                        chart.redrawGroup();
                    }
                });
        };
    }

    function add_behavior(chart, node, edge) {
        _input_anchor = chart.svg().selectAll('a#label-nodes-input').data([1]);
        _input_anchor.enter()
            .append('a').attr({
                id: 'label-nodes-input',
                href: '#'
            });
        _input_anchor.on('keyup.label-nodes', function() {
            if(_selected.length) {
                // printable characters should start edit
                if(d3.event.key.length !== 1)
                    return;
                var n2 = node.filter(function(d) {
                    return chart.nodeKey.eval(d) === _selected[0];
                });
                if(n2.empty()) {
                    console.error("couldn't find node '" + _selected[0] + "'!");
                    return;
                }
                if(n2.size()>1) {
                    console.error("found too many nodes for '" + _selected[0] + "' (" + n2.size() + ")!");
                    return;
                }
                label_nodes_group.edit_node_label(n2, {text: d3.event.key, selectText: false});
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
            label_nodes_group.on('edit_node_label.label-nodes', p ? edit_node_label_listener(p) : null);
        }
    });
    return _behavior;
};

dc_graph.label_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('label-nodes', function() {
        return d3.dispatch('edit_node_label');
    });

    return window.chart_registry.create_group('label-nodes', brushgroup);
};
