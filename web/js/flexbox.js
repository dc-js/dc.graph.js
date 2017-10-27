var parentNodes = [
    {
        id: 'flex+',
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 50
    },
    {
        id: 'flex+a',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        flex: 1
    },
    {
        id: 'flex+b',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flex: 1
    }
];

var data = d3.range(7).map(function(i) {
    return {
        id: 'flex+a,' + i,
        label: 'node a' + i,
        alignSelf: 'stretch',
        flex: 1
    };
}).concat(d3.range(9).map(function(i) {
    return {
        id: 'flex+b,' + i,
        label: 'node b' + i,
        alignSelf: 'stretch',
        minHeight: 100,
        flex: 1
    };
}));

var node_flat = dc_graph.flat_group.make(parentNodes.concat(data), n => n.id),
    edge_flat = dc_graph.flat_group.make([], e => e.id);

var diagram = dc_graph.diagram('#graph')
        .layoutEngine(dc_graph.flexbox_layout()
                      .addressToKey(ad => 'flex+' + ad.join(','))
                      .keyToAddress(function(key) {
                          var ads = key.split('flex+')[1];
                          return ads ? ads.split(',') : [];
                      }))
        .width(1000).height(1000)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group);

dc.renderAll();

