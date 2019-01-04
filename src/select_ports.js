dc_graph.select_ports = function(props, options) {
    options = options || {};
    var port_style = options.portStyle || 'symbols';
    var select_ports_group = dc_graph.select_things_group(options.select_ports_group || 'select-ports-group', 'select-ports');
    var thinginess = {
        laterDraw: true,
        intersectRect: null, // multiple selection not supported for now
        clickables: function() {
            return _mode.parent().selectAllNodes('g.port');
        },
        key: function(p) {
            // this scheme also won't work with multiselect
            return p.named ?
                {node: _mode.parent().nodeKey.eval(p.node), name: p.name} :
            {edge: _mode.parent().edgeKey.eval(p.edges[0]), name: p.name};
        },
        applyStyles: function(pred) {
            _mode.parent().portStyle(port_style).cascade(50, true, conditional_properties(pred, props));
        },
        removeStyles: function() {
            _mode.parent().portStyle(port_style).cascade(50, false, props);
        },
        keysEqual: function(k1, k2) {
            return k1.name === k2.name && (k1.node ? k1.node === k2.node : k1.edge === k2.edge);
        }
    };
    var _mode = dc_graph.select_things(select_ports_group, 'select-ports', thinginess);
    return _mode;
};
