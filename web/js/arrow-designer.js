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
    debug: {
        default: false,
        selector: '#debug',
        needs_redraw: true,
        exert: function(val, diagram) {
            var troubleshoot = val ? dc_graph.troubleshoot()
                .boundsWidth(5)
                .boundsHeight(5)
                .arrowLength(0) : null;
            diagram.child('troubleshoot', troubleshoot)
                .redraw();
        }
    },
    grid: {
        default: true,
        selector: '#grid',
        needs_redraw: true,
        exert: function(val, diagram) {
            var grid = val ? dc_graph.grid() : null;
            diagram.child('grid', grid)
                .redraw();
        }
    }
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
        key: 'head1',
        x: 85,
        y: 15
    },
    {
        key: 'head2',
        x: 15,
        y: 85
    },
    {
        key: 'head3',
        x: 85,
        y: 85
    }
];

var edges = [
    {
        key: 'e',
        sourcename: 'tail',
        targetname: 'head1'
    },
    {
        key: 'f',
        sourcename: 'tail',
        targetname: 'head2'
    },
    {
        key: 'g',
        sourcename: 'tail',
        targetname: 'head3'
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

diagram.render();
sync_url.exert();
