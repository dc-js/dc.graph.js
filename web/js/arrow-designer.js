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
    zoom: 16
};
var diagram = dc_graph.diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(diagram), diagram);

var nodes = [
    {
        key: 'tail',
        x: 35,
        y: 35
    },
    {
        key: 'head',
        x: 135,
        y: 35
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
    .fitStrategy('align_tl')
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .nodeLabel(null)
    .edgeLabel(null)
    .edgeArrowhead(() => sync_url.vals.arrowhead)
    .edgeArrowtail(() => sync_url.vals.arrowtail);

diagram.render();

