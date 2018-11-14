var options = {
    arrowhead: {
        default: 'vee',
        selector: '#arrowhead',
        needs_redraw: true
    },
    arrowtail: {
        default: null,
        selector: '#arrowtail',
        needs_redraw: true
    },
    zoom: {
        default: 4,
        selector: '#zoom',
        exert: function(val, diagram) {
            diagram.zoom().scale(+val).event(diagram.svg());
        }
    },
    debug: false
};
var diagram = dc_graph.diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(diagram), diagram);

var nodes = [
    {
        key: 'tail',
        x: 15,
        y: 15
    },
    {
        key: 'head',
        x: 85,
        y: 15
    }
];

var edges = [
    {
        key: 'e',
        sourcename: 'tail',
        targetname: 'head'
    }
];

var edge_flat = dc_graph.flat_group.make(edges, e => e.key),
    node_flat = dc_graph.flat_group.make(nodes, n => n.key);

var engine = dc_graph.manual_layout();

diagram
    .width('auto')
    .height('auto')
    .layoutEngine(engine)
    .zoomExtent([1, 256])
    .fitStrategy('align_tl')
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .nodeRadius(10)
    .nodeLabel(null)
    .edgeLabel(null)
    .edgeArrowhead(() => sync_url.vals.arrowhead)
    .edgeArrowtail(() => sync_url.vals.arrowtail);

diagram.child('grid', dc_graph.grid());

if(sync_url.vals.debug) {
    var troubleshoot = dc_graph.troubleshoot()
            .boundsWidth(5)
            .boundsHeight(5)
            .arrowLength(0);
    diagram.child('troubleshoot', troubleshoot);
}

diagram.render();
sync_url.exert();
