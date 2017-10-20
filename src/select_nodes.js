dc_graph.select_nodes = function(props) {
    var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');

    // https://stackoverflow.com/questions/16863917/check-if-class-exists-somewhere-in-parent-vanilla-js
    function ancestor_has_class(element, classname) {
        if(d3.select(element).classed(classname))
            return true;
        return element.parentElement && ancestor_has_class(element.parentElement, classname);
    }
    var thinginess = {
        intersectRect: function(ext) {
            return _behavior.parent().selectAllNodes().data().filter(function(n) {
                return n && ext[0][0] < n.cola.x && n.cola.x < ext[1][0] &&
                    ext[0][1] < n.cola.y && n.cola.y < ext[1][1];
            }).map(this.key);
        },
        clickables: function(chart, node, edge) {
            return node;
        },
        excludeClick: function(element) {
            return ancestor_has_class(element, 'port');
        },
        key: function(d) {
            return _behavior.parent().nodeKey.eval(d);
        },
        applyStyles: function(pred) {
            _behavior.parent().cascade(50, true, node_edge_conditions(pred, null, props));
        },
        removeStyles: function() {
            _behavior.parent().cascade(50, false, props);
        }
    };
    var _behavior = dc_graph.select_things(select_nodes_group, 'select-nodes', thinginess);
    return _behavior;
};
