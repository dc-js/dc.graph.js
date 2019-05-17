var params = new URLSearchParams(window.location.search);

var parentNodes = [
    {
        id: 'flex+',
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10
    },
    {
        id: 'flex+a',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        flex: 1
    },
    {
        id: 'flex+b',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        flex: 1
    }
];

var data = d3.range(7).map(function(i) {
    return {
        id: 'flex+a,' + i,
        label: 'node a' + i,
        alignSelf: 'stretch',
        flex: 0
    };
}).concat(d3.range(9).map(function(i) {
    return {
        id: 'flex+b,' + i,
        label: 'node b' + i,
        alignSelf: 'stretch',
        flex: 0
    };
}));

var node_flat = dc_graph.flat_group.make(parentNodes.concat(data), function (n) {
    return n.id;
}),
    edge_flat = dc_graph.flat_group.make([], function (e) {
    return e.id;
});

var flexboxDiagram = dc_graph.diagram('#graph')
        .layoutEngine(dc_graph.flexbox_layout(null, {algo: params.get('algo') || 'yoga-layout'})
                      .addressToKey(function (ad) {
                          return 'flex+' + ad.join(',');
                      })
                      .keyToAddress(function(key) {
                          var ads = key.split('flex+')[1];
                          return ads ? ads.split(',') : [];
                      }))
        .width(1000).height(1000)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group);

dc.renderAll();

