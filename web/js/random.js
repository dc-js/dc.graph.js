// ES6 Module version of random.js
import { rgb } from 'd3-color';
import { scaleOrdinal } from 'd3-scale';
import { select } from 'd3-selection';
import {
    diagram,
    engines,
    fixNodes,
    flatGroup,
    randomGraph,
    spawnEngine,
    symbolPortStyle,
} from './dc-graph.js';
import dcgraph_domain from './dc.graph.tracker.domain.js';
import querystring from './querystring.js';
import sync_url_options from './sync-url-options.js';

const growingDiagram = diagram('#graph');
const options = {
    layout: {
        default: 'cola',
        values: engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: function(val, diagram) {
            const engine = spawnEngine(val);
            applyEngineParameters(engine);
            diagram.layoutEngine(engine);
        },
    },
    worker: false,
    batch: 1,
    newnode: 0.9,
    newcomp: 0.1,
    remove: 0,
    remedge: 0.75,
    interval: 500,
    opacity: 0.7,
    arrows: false,
    ports: false,
    shape: 'ellipse',
    content: 'text',
    icon: null,
};

// Note: These are still global functions from the legacy scripts

// In a full ES6 conversion, these would also be converted to modules
const sync_url = sync_url_options(options, dcgraph_domain(growingDiagram), growingDiagram);

function applyEngineParameters(engine) {
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
    }
    return engine;
}

function buildData(nodes, edges) {
    // build crossfilters from scratch
    return {
        edgef: flatGroup.make(edges, function(d) {
            return d.id;
        }),
        nodef: flatGroup.make(nodes, function(d) {
            return d.id;
        }),
    };
}

const engine = spawnEngine(sync_url.vals.layout, querystring.parse(), sync_url.vals.worker);
applyEngineParameters(engine);

// don't do multiple components for cola unless user specified
// layout is that unstable
if (engine.layoutAlgorithm() === 'cola') {
    if (typeof sync_url.vals.newcomp !== 'string')
        sync_url.vals.newcomp = 0;
}

const random = randomGraph({
    nodeKey: 'id',
    edgeKey: 'id',
    ncolors: 12,
    newNodeProb: sync_url.vals.newnode,
    newComponentProb: sync_url.vals.newcomp,
    removeEdgeProb: sync_url.vals.remedge,
    log: sync_url.vals.log && sync_url.vals.log !== 'false',
});

let data = buildData(random.nodes(), random.edges());

growingDiagram
    .layoutEngine(engine)
    .width('auto')
    .height('auto')
    .restrictPan(true)
    .mouseZoomable(true)
    .zoomExtent([0.1, 1.5])
    .nodeDimension(data.nodef.dimension).nodeGroup(data.nodef.group)
    .edgeDimension(data.edgef.dimension).edgeGroup(data.edgef.group)
    .nodeShape({shape: sync_url.vals.shape})
    .nodeContent(sync_url.vals.content)
    .nodeIcon(sync_url.vals.icon)
    .nodeStrokeWidth(0) // turn off outlines
    .nodeLabel(function(kv) {
        return kv.key;
    })
    .nodeLabelFill(
        sync_url.vals.shape === 'plain' ? 'black' : function(n) {
            const color = rgb(growingDiagram.nodeFillScale()(growingDiagram.nodeFill()(n)));
            // https://www.w3.org/TR/AERT#color-contrast
            const brightness = (color.r*299+color.g*587+color.b*114)/1000;
            return brightness > 127 ? 'black' : 'ghostwhite';
        },
    )
    .nodeFill(function(kv) {
        return kv.value.color;
    })
    .nodeFillScale(
        scaleOrdinal().range(
            [
                '#a6cee3',
                '#1f78b4',
                '#b2df8a',
                '#33a02c',
                '#fb9a99',
                '#e31a1c',
                '#fdbf6f',
                '#ff7f00',
                '#cab2d6',
                '#6a3d9a',
                '#ffff99',
                '#b15928',
            ],
        ),
    )
    .nodeOpacity(sync_url.vals.opacity)
    .nodeTitle(null) // deactivate basic tooltips
    .edgeArrowhead(sync_url.vals.arrows ? 'vee' : null)
    .timeLimit(sync_url.vals.interval-100);

if (sync_url.vals.ports) {
    growingDiagram
        .portStyle('symbols', symbolPortStyle())
        .portStyleName('symbols');
}

const fixNodesMode = fixNodes()
    .strategy(fixNodes.strategy.lastNPerComponent(1));
growingDiagram.child('fix-nodes', fixNodesMode);

(await growingDiagram.render()).autoZoom('once-noanim');

let randomDemoInterval = null;

function runRandomDemo() {
    if (randomDemoInterval) {
        window.clearInterval(randomDemoInterval);
    }
    randomDemoInterval = window.setInterval(function() {
        for (let i = 0; i < sync_url.vals.batch; ++i) {
            if (Math.random() < sync_url.vals.remove)
                random.remove(1);
            else
                random.generate(1);
        }
        data = buildData(random.nodes(), random.edges());
        growingDiagram
            .nodeDimension(data.nodef.dimension).nodeGroup(data.nodef.group)
            .edgeDimension(data.edgef.dimension).edgeGroup(data.edgef.group)
            .redraw();
    }, sync_url.vals.interval);
}

runRandomDemo();

select('#play-stop').on('click', function() {
    if (randomDemoInterval) {
        select('#play-stop').attr('class', 'fas fa-play');
        window.clearInterval(randomDemoInterval);
        randomDemoInterval = null;
    } else {
        select('#play-stop').attr('class', 'fas fa-pause');
        runRandomDemo();
    }
});
