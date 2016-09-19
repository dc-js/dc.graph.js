dc_graph.select_nodes = function(props) {
    var _selected = [];

    function add_behavior(chart, node, edge) {
        chart.cascade(50, true, conditional_properties(function(n) {
            return _selected.indexOf(n.orig.key) >= 0;
        }, null, props));
        node.on('click.select-nodes', function(d) {
            _selected = [chart.nodeKey.eval(d)];
            chart.refresh(node, edge);
        });
        /*
        chart.svg().on('click.select-nodes', function(d) {
            _selected = [];
            chart.refresh(node, edge);
        });
         */
    }

    function remove_behavior(chart, node, edge) {
        node
            .on('click.select-nodes', null);
        chart.cascade(50, false, props);
    }

    return dc_graph.behavior('select-nodes', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge) {
            remove_behavior(chart, node, edge);
        }
    });
};

