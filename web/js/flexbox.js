var parentNodes = [
    {
        id: 'flex+',
        flexDirection: 'row',
        alignSelf: 'stretch',
        justifyContent: 'space-around',
        padding: 10
    },
    {
        id: 'flex+a',
        flexDirection: 'column',
        justifyContent: 'flex-start'
    },
    {
        id: 'flex+b',
        flexDirection: 'column',
        justifyContent: 'flex-start'
    }
];

var data = d3.range(7).map(function(i) {
    return {
        id: 'flex+a,' + i,
        label: 'node a' + i
    };
}).concat(d3.range(9).map(function(i) {
    return {
        id: 'flex+b,' + i,
        label: 'node b' + i
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

