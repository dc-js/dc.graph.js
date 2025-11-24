import { rgb } from 'd3-color';
import { scaleOrdinal } from 'd3-scale';
import { select } from 'd3-selection';
import { PieChart, pluck, redrawAll, renderAll, RowChart } from 'dc';
import querystring from 'querystring';
import {
    diagram,
    engines,
    filterSelection,
    fixNodes,
    flatGroup,
    loadGraph,
    loadGraphText,
    moveNodes,
    mungeGraph,
    randomGraph,
    selectEdges,
    selectNodes,
    spawnEngine,
} from './dc-graph.js';
import dcgraph_domain from './dc.graph.tracker.domain.js';
import { display_error, hide_error } from './graph-error.js';
import sync_url_options from './sync-url-options.js';

const selectionDiagram = diagram('#graph');
// eslint-disable-next-line prefer-const
let pie, row;

const options = {
    layout: {
        default: 'dagre',
        values: engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert(val, diagram) {
            const engine = spawnEngine(val);
            apply_engine_parameters(engine);
            diagram
                .layoutEngine(engine)
                .autoZoom('once');
        },
    },
    worker: {
        default: false,
    },
    file: null,
    n: {
        default: 100,
        values: [1, 5, 10, 20, 50, 100, 200],
        selector: '#number',
        needs_redraw: true,
        exert(val, diagram) {
            populate(val);
            diagram.autoZoom('once');
        },
    },
    transition_duration: {
        query: 'tdur',
        default: 1000,
    },
    arrows: {
        default: 'none',
    },
};
const sync_url = sync_url_options(options, dcgraph_domain(selectionDiagram), selectionDiagram);

function apply_engine_parameters(engine) {
    switch (engine.layoutAlgorithm()) {
        case 'd3v4-force':
            engine
                .collisionRadius(25)
                .gravityStrength(0.05)
                .initialCharge(-500);
            break;
        case 'd3-force':
            engine
                .gravityStrength(0.1)
                .initialCharge(-1000);
            break;
    }
    selectionDiagram.initLayoutOnRedraw(engine.layoutAlgorithm() === 'cola');
    return engine;
}
function build_data(nodes, edges) {
    // build crossfilters from scratch
    return {
        edgef: flatGroup.make(edges, d => d.key),
        nodef: flatGroup.make(nodes, d => d.key),
    };
}

const load_graph = function(nodes, edges) {
    const data = build_data(nodes, edges),
        colorDimension = data.nodef.crossfilter.dimension(n => n.color),
        colorGroup = colorDimension.group(),
        dashDimension = data.edgef.crossfilter.dimension(e => e.dash),
        dashGroup = dashDimension.group();
    selectionDiagram
        .nodeDimension(data.nodef.dimension).nodeGroup(data.nodef.group)
        .edgeDimension(data.edgef.dimension).edgeGroup(data.edgef.group);
    pie
        .dimension(colorDimension)
        .group(colorGroup);
    row
        .dimension(dashDimension)
        .group(dashGroup);
};

const populate = function(n) {
    const random = randomGraph({
        ncolors: 3,
        allowParallelEdges: false,
    });

    random.generate(n);
    load_graph(random.nodes(), random.edges());
};

const on_load = function(filename, error, data) {
    if (error) {
        let heading = '';
        if (error.status)
            heading = `Error ${error.status}: `;
        heading += `Could not load file ${filename}`;
        display_error(heading, error);
    }
    const graph_data = mungeGraph(data);
    load_graph(graph_data.nodes, graph_data.edges);
    selectionDiagram.autoZoom('once');
    redrawAll();
};

select('#user-file').on('change', function() {
    const filename = this.value;
    if (filename) {
        const reader = new FileReader();
        reader.onload = function(e) {
            hide_error();
            loadGraphText(e.target.result, filename, on_load.bind(null, filename));
        };
        reader.readAsText(this.files[0]);
    }
});

const engine = spawnEngine(sync_url.vals.layout, querystring.parse(), sync_url.vals.worker);
apply_engine_parameters(engine);
const colors = ['#1b9e77', '#d95f02', '#7570b3'];
const dasheses = [
    {name: 'solid', ray: null},
    {name: 'dash', ray: [5, 5]},
    {name: 'dot', ray: [1, 5]},
    {name: 'dot-dash', ray: [15, 10, 5, 10]},
];
selectionDiagram
    .layoutEngine(engine)
    .timeLimit(5000)
    .transitionDuration(sync_url.vals.transition_duration)
    .fitStrategy('horizontal')
    .restrictPan(true)
    .margins({top: 5, left: 5, right: 5, bottom: 5})
    .autoZoom('once-noanim')
    .zoomDuration(sync_url.vals.transition_duration)
    .width('auto')
    .height('auto')
    .nodeFixed(n => n.value.fixed)
    .nodeStrokeWidth(0) // turn off outlines
    .nodeLabel('')
    .nodeLabelFill(n => {
        const rgbColor = rgb(selectionDiagram.nodeFillScale()(selectionDiagram.nodeFill()(n))),
            // https://www.w3.org/TR/AERT#color-contrast
            brightness = (rgbColor.r*299+rgbColor.g*587+rgbColor.b*114)/1000;
        return brightness > 127 ? 'black' : 'ghostwhite';
    })
    .nodeFill(kv => kv.value.color)
    .nodeOpacity(0.25)
    .edgeOpacity(0.25)
    .timeLimit(1000)
    .nodeFillScale(scaleOrdinal().domain([0, 1, 2]).range(colors))
    .nodeTitle(pluck('key'))
    .edgeStrokeDashArray(e => dasheses[e.value.dash].ray)
    .edgeArrowhead(
        sync_url.vals.arrows === 'head' || sync_url.vals.arrows === 'both' ? 'vee' : null,
    )
    .edgeArrowtail(
        sync_url.vals.arrows === 'tail' || sync_url.vals.arrows === 'both' ? 'crow' : null,
    );

selectionDiagram.child(
    'select-nodes',
    selectNodes(
        {
            nodeOpacity: 1,
        },
    ).noneIsAll(true)
        .autoCropSelection(false),
);
selectionDiagram.child(
    'filter-selection-nodes',
    filterSelection('select-nodes-group', 'select-nodes'),
);

selectionDiagram.child('move-nodes', moveNodes());

selectionDiagram.child(
    'fix-nodes',
    fixNodes({
        fixedPosTag: 'fixed',
    }),
);

selectionDiagram.child(
    'select-edges',
    selectEdges(
        {
            edgeStrokeWidth: 2,
            edgeOpacity: 1,
        },
    ).noneIsAll(true)
        .autoCropSelection(false),
);
selectionDiagram.child(
    'filter-selection-edges',
    filterSelection('select-edges-group', 'select-edges')
        .dimensionAccessor(c => c.edgeDimension()),
);

pie = new PieChart('#pie')
    .width(150).height(150)
    .radius(75)
    .colors(scaleOrdinal().domain([0, 1, 2]).range(colors))
    .label(() => '')
    .title(kv => `${colors[kv.key]} nodes (${kv.value})`);

row = new RowChart('#row')
    .width(300).height(150)
    .label(kv => dasheses[kv.key].name);

if (sync_url.vals.file)
    loadGraph(sync_url.vals.file, on_load.bind(null, sync_url.vals.file));
else {
    populate(sync_url.vals.n);
    renderAll();
}
