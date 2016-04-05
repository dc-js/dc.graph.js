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
/*
            {source: 'VFC', target: 'VFC', produce: dc_graph.align_y()},
            {source: 'VM', target: 'VM', produce: dc_graph.align_y()},
            {source: 'Host', target: 'Host', produce: dc_graph.align_y()}*/
        ]
    },
    initDiagram: function(diagram) {
        diagram
            .nodeLabel(null)
            .nodeRadius(3)
            .parallelEdgeOffset(1)
            .edgeArrowSize(0.5)
            .nodeTitle(function(n) { return n.value.name; })
        ;
    }
};

