app_layouts.vfc = {
    rules: {
        nodes: [
            {id: 'layer', partition: 'label_', extract: function(v) { return v.split(':')[2]; },
             typename: function(id, value) { return value; }}
        ],
        edges: [
            {source: 'VNF', target: 'VFC', produce: dc_graph.gap_y(100, true)},
            {source: 'VFC', target: 'VM', produce: dc_graph.gap_y(100, true)},
            {source: 'VM', target: 'Host', produce: dc_graph.gap_y(100, true)},

            {source: 'VNF', target: 'VNF', produce: dc_graph.align_y()},
            {source: 'VFC', target: 'VFC', produce: dc_graph.align_y()},
            {source: 'VM', target: 'VM', produce: dc_graph.align_y()},
            {source: 'Host', target: 'Host', produce: dc_graph.align_y()}
        ]
    }
};

