var qs = querystring.parse();
var options = Object.assign({
    min: 3,
    max: 10,
    algo: 'yoga-layout',
    log: false
}, qs);

var vertical = options.rankdir === 'TB';
// intentionally using a dumb identifier scheme: 'top, 'col-a', .. 'a1 .. 'b3' for generality's sake
// it would be smarter irl to use key = prefix + addr.join(delimiter)
var parentNodes = [
    {
        id: 'top',
        flexDirection: vertical ? 'column' : 'row',
        justifyContent: 'space-between',
        padding: 10
    },
    {
        id: 'col-a',
        flexDirection: vertical ? 'row' : 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        flex: 0
    },
    {
        id: 'col-b',
        flexDirection: vertical ? 'row' : 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        flex: 0
    }
];

var adjectives = ['strong', 'happy', 'libelious', 'rainy', 'effulgent', 'bookish'],
    nouns = ['steel', 'book', 'cat', 'talk', 'road', 'umbrella', 'nimwit'];

function rndsel(a) {
    return a[Math.floor(Math.random()*a.length)];
}

function phrase() {
    return rndsel(adjectives) + ' ' + rndsel(nouns);
}

var data = d3.range(Math.round(+options.min + Math.random()*(options.max-options.min))).map(function(i) {
    return {
        id: 'a' + i,
        label: [String.fromCharCode(97+i) + '.', phrase()],
        flex: 1
    };
}).concat(d3.range(Math.round(+options.min + Math.random()*(options.max-options.min))).map(function(i) {
    return {
        id: 'b' + i,
        label: [String.fromCharCode(48+i) + '.', phrase()],
        flex: 1
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
var ports = data.map(function (n) {
    return {
        nodeId: n.id,
        side: n.id[0] === 'a' ? 'out' : 'in',
        bounds: n.id[0] === 'a' ? outbounds : inbounds
    };
});

var node_flat = dc_graph.flat_group.make(parentNodes.concat(data), function (n) {
    return n.id;
}),
    edge_flat = dc_graph.flat_group.make([], function (e) {
    return e.id;
}),
    port_flat = dc_graph.flat_group.make(ports, function (p) {
    return p.nodeId + '/' + p.side;
});

var layout = dc_graph.flexbox_layout(null, {algo: options.algo})
    .logStuff(qs.log && qs.log !== 'false')
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

var matchDiagram = dc_graph.diagram('#graph')
        .layoutEngine(layout)
        .width('auto').height('auto')
        .transitionDuration(250)
        .layoutUnchanged(true)
        .mouseZoomable(false)
        .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
        .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
        .portDimension(port_flat.dimension).portGroup(port_flat.group)
        .nodeShape(function (n) {
            return layout.keyToAddress()(matchDiagram.nodeKey()(n)).length < 2 ? 'nothing' : 'rounded-rect';
        })
        .nodeLabelPadding({x: 20, y: 0})
        .nodeLabelAlignment(function (n) {
            return (/^a/.test(n.key) ? 'right' : 'left');
        })
        .nodeStrokeWidth(0)
        .nodeTitle(null)
        .nodeFill('none')
        .edgesInFront(true)
        .edgeSourcePortName('out')
        .edgeTargetPortName('in')
        .edgeLabel(null)
        .portNodeKey(function (p) {
            return p.value.nodeId;
        }).portName(function (p) {
            return p.value.side;
        }).portBounds(function (p) {
            return p.value.bounds;
        })
        .portElastic(false);

matchDiagram.child('validate', dc_graph.validate());
if(options.trouble)
    matchDiagram.child('troubleshoot', dc_graph.troubleshoot());
matchDiagram.child('place-ports', dc_graph.place_ports());

var circlePorts = dc_graph.symbol_port_style()
        .portSymbol(null)
        .displacement(0)
        .smallRadius(2).mediumRadius(4).largeRadius(6)
        .outlineFill('white')
        .outlineStroke('black').outlineStrokeWidth(1);
matchDiagram.portStyle('circle-ports', circlePorts)
    .portStyleName('circle-ports');

var drawGraphs = dc_graph.draw_graphs({
    idTag: 'id',
    sourceTag: 'sourcename',
    targetTag: 'targetname'
})
        .usePorts(true)
        .clickCreatesNodes(false)
        .edgeCrossfilter(edge_flat.crossfilter);

matchDiagram.child('draw-graphs', drawGraphs);

var select_edges = dc_graph.select_edges({
    edgeStroke: 'lightblue',
    edgeStrokeWidth: 3
}).multipleSelect(false);
matchDiagram.child('select-edges', select_edges);

var select_edges_group = dc_graph.select_things_group('select-edges-group', 'select-edges');
var delete_edges = dc_graph.delete_things(select_edges_group, 'delete-edges', 'id')
        .crossfilterAccessor(function(matchDiagram) {
            return edge_flat.crossfilter;
        })
        .dimensionAccessor(function(matchDiagram) {
            return matchDiagram.edgeDimension();
        });
matchDiagram.child('delete-edges', delete_edges);

var oppositeMatcher = dc_graph.match_opposites(matchDiagram, {
    edgeStroke: 'orangered'
}, {
    delete_edges: delete_edges
});
drawGraphs.conduct(oppositeMatcher);

if(qs.selports) {
    var select_ports = dc_graph.select_ports({
        portBackgroundFill: 'lightgreen',
        outlineStroke: 'orange',
        outlineStrokeWidth: 2,
        smallRadius: 5,
        mediumRadius: 7,
        largeRadius: 10
    }, {
        portStyle: 'circle-ports'
    }).multipleSelect(false);
    matchDiagram.child('select-ports', select_ports);
    var select_ports_group = dc_graph.select_things_group('select-ports-group', 'select-ports');
    select_ports_group.on('set_changed.show-info', function(ports) {
        if(ports.length>0) {
            select_edges_group.set_changed([]);
        }
    });
}


dc.renderAll();

$('#resize').resizable({
    resize: function(event, ui) {
        matchDiagram
            .redraw();
    }
});
