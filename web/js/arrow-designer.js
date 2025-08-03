import { selectAll } from 'd3-selection';
import { diagram, troubleshoot, grid, flatGroup, manualLayout } from './dc-graph.js';
import dcgraph_domain from './dc.graph.tracker.domain.js';
import sync_url_options from './sync-url-options.js';

var options = {
    arrowhead: {
        default: 'vee',
        selector: '#arrowhead',
        needs_redraw: 'refresh'
    },
    arrowtail: {
        default: null,
        selector: '#arrowtail',
        needs_redraw: 'refresh'
    },
    zoom: {
        default: 4,
        selector: '#zoom',
        exert: function(val, diagram) {
            diagram.renderer().scale(+val);
        }
    },
    debug: {
        default: false,
        selector: '#debug',
        needs_redraw: true,
        exert: function(val, diagram) {
            var troubleshootMode = val ? troubleshoot()
                .boundsWidth(5)
                .boundsHeight(5)
                .arrowLength(0) : null;
            diagram.child('troubleshoot', troubleshootMode)
                .redraw();
        }
    },
    shape: 'ellipse',
    color: 'black',
    opacity: 1,
    strokewidth: 1,
    arrowsize: 1,
    grid: {
        default: true,
        selector: '#grid',
        needs_redraw: true,
        exert: function(val, diagram) {
            var gridMode = val ? grid() : null;
            diagram.child('grid', gridMode)
                .redraw();
        }
    }
};
var arrowDiagram = diagram('#graph');
var sync_url = sync_url_options(options, dcgraph_domain(arrowDiagram), arrowDiagram);

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

var edge_flat = flatGroup.make(edges, function (e) {
    return e.key;
}),
    node_flat = flatGroup.make(nodes, function (n) {
    return n.key;
});

var engine = manualLayout();

arrowDiagram
    .width('auto')
    .height('auto')
    .restrictPan(true)
    .layoutEngine(engine)
    .zoomExtent([1, 256])
    .fitStrategy('align_tl')
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .nodeRadius(10)
    .nodeLabel(null)
    .nodeStrokeWidth(sync_url.vals.strokewidth)
    .nodeShape(sync_url.vals.shape)
    .edgeLabel(null)
    .edgeOpacity(sync_url.vals.opacity)
    .edgeStroke(sync_url.vals.color)
    .edgeArrowSize(sync_url.vals.arrowsize)
    .edgeArrowhead(function () {
        return sync_url.vals.arrowhead;
    }).edgeArrowtail(function () {
        return sync_url.vals.arrowtail;
    });

var syntax = "concatenate up to four: optional 'o' then optional 'l' or 'r' then one of " + Object.keys(arrowDiagram.arrows()).join(' ');

selectAll('label[for*="arrow"]').attr('title', syntax);

await arrowDiagram.render();
sync_url.exert();
