app_layouts.ceph = {
    data: function(nodes, edges) {
        var edgetypes = edges.crossfilter.dimension(function(e) {
            return e.class;
        });
        edgetypes.filterFunction(function(c) {
            return c === 'TOR-CHOST' || c === 'CHOST-Backend' || c === 'Backend-Vol';
        });
    },
    lengthStrategy: 'symmetric',
    initDiagram: function(diagram) {
        diagram.induceNodes(true);
    }
};
