var parentNodes = [
    {
        id: 'top',
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10
    },
    {
        id: 'col-a',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        flex: 1
    },
    {
        id: 'col-b',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        flex: 1
    }
];

var data = d3.range(7).map(function(i) {
    return {
        id: 'a' + i,
        label: String.fromCharCode(97+i),
        flex: 0
    };
}).concat(d3.range(9).map(function(i) {
    return {
        id: 'b' + i,
        label: String.fromCharCode(48+i),
        flex: 0
    };
}));

var node_flat = dc_graph.flat_group.make(parentNodes.concat(data), n => n.id),
    edge_flat = dc_graph.flat_group.make([], e => e.id);

var layout = dc_graph.flexbox_layout()
    .addressToKey(function(ad) {
        switch(ad.length) {
        case 0: return 'top';
        case 1: return 'col-' + ad[0];
        case 2: return ad[0] + ad[1];
        default: throw new Error('not expecting more than depth 2');
        }
    })
    .keyToAddress(function(key) {
        if(key==='top') return [];
        else if(/^col-/.test(key)) return [key.split('col-')[1]];
        else if(/^(a|b)/.test(key)) return [key[0], +key.slice(1)];
        else throw new Error('couldn\'t parse key: ' + key);
    });

var diagram = dc_graph.diagram('#graph')
        .layoutEngine(layout)
        .width(1000).height(1000)
        .mouseZoomable(false)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .nodeShape(n => layout.keyToAddress()(diagram.nodeKey()(n)).length < 2 ? 'nothing' : 'rectangle')
        .edgeLabel(null);

var drawGraphs = dc_graph.draw_graphs({
    idTag: 'id',
    sourceTag: 'sourcename',
    targetTag: 'targetname'
})
        .clickCreatesNodes(false)
        .edgeCrossfilter(edge_flat.crossfilter);

diagram.child('draw-graphs', drawGraphs);


dc.renderAll();

