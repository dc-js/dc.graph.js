var qs = querystring.parse();
var options = Object.assign({
}, qs);

var vertical = options.rankdir === 'TB';
// intentionally using a dumb identifier scheme: 'top, 'col-a', .. 'a1 .. 'b3' for generality's sake
// it would be smarter irl to use key = prefix + addr.join(delimiter)
var parentNodes = [
    {
        id: 'top',
        flexDirection: vertical ? 'column' : 'row',
        justifyContent: 'space-around',
        padding: 10
    },
    {
        id: 'col-a',
        flexDirection: vertical ? 'row' : 'column',
        justifyContent: 'flex-start',
        flex: 0
    },
    {
        id: 'col-b',
        flexDirection: vertical ? 'row' : 'column',
        justifyContent: 'flex-start',
        flex: 0
    }
];

var data = d3.range(3 + Math.random()*7).map(function(i) {
    return {
        id: 'a' + i,
        label: String.fromCharCode(97+i),
        flex: 0
    };
}).concat(d3.range(3 + Math.random()*7).map(function(i) {
    return {
        id: 'b' + i,
        label: String.fromCharCode(48+i),
        flex: 0
    };
}));

var lbounds = [Math.PI-1, Math.PI+1], rbounds = [-1,1], ubounds = [-Math.PI/2-1, -Math.PI/2+1], dbounds = [Math.PI/2-1, Math.PI/2+1];
var inbounds, outbounds;
if(vertical) {
    inbounds = ubounds;
    outbounds = dbounds;
} else  {
    inbounds = lbounds;
    outbounds = rbounds;
}
var ports = data.map(n => ({
    nodeId: n.id,
    side: n.id[0] === 'a' ? 'out' : 'in',
    bounds: n.id[0] === 'a' ? outbounds : inbounds
}));

var node_flat = dc_graph.flat_group.make(parentNodes.concat(data), n => n.id),
    edge_flat = dc_graph.flat_group.make([], e => e.id),
    port_flat = dc_graph.flat_group.make(ports, p => p.nodeId + '/' + p.side);

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
        .width(500).height(500)
        .mouseZoomable(false)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .portDimension(port_flat.dimension).portGroup(port_flat.group)
        .nodeShape(n => layout.keyToAddress()(diagram.nodeKey()(n)).length < 2 ? 'nothing' : 'rectangle')
        .nodeStrokeWidth(0)
        .nodeTitle(null)
        .edgeSourcePortName('out')
        .edgeTargetPortName('in')
        .edgeLabel(null)
        .portNodeKey(p => p.value.nodeId)
        .portName(p => p.value.side)
        .portBounds(p => p.value.bounds)
        .portElastic(false);

diagram.child('validate', dc_graph.validate());
diagram.child('place-ports', dc_graph.place_ports());

var oppositeMatcher = dc_graph.match_opposites(diagram, {
    edgeStroke: 'orangered'
});

var drawGraphs = dc_graph.draw_graphs({
    idTag: 'id',
    sourceTag: 'sourcename',
    targetTag: 'targetname'
})
        .usePorts(true)
        .clickCreatesNodes(false)
        .edgeCrossfilter(edge_flat.crossfilter)
        .conduct(oppositeMatcher);

diagram.child('draw-graphs', drawGraphs);

var select_edges = dc_graph.select_edges({
    edgeStroke: 'lightblue',
    edgeStrokeWidth: 3
}).multipleSelect(false);
diagram.child('select-edges', select_edges);

var select_edges_group = dc_graph.select_things_group('select-edges-group', 'select-edges');
var delete_edges = dc_graph.delete_things(select_edges_group, 'delete-edges', 'id')
        .crossfilterAccessor(function(chart) {
            return edge_flat.crossfilter;
        })
        .dimensionAccessor(function(chart) {
            return diagram.edgeDimension();
        });
diagram.child('delete-edges', delete_edges);


dc.renderAll();

