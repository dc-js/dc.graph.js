import { diagram, engines, spawnEngine, flatGroup, randomGraph, symbolPortStyle, fixNodes, validate } from './dc-graph.js';
import { rgb } from 'd3-color';
import { scaleOrdinal } from 'd3-scale';
import sync_url_options from './sync-url-options.js';
import dcgraph_domain from './dc.graph.tracker.domain.js';
import querystring from './querystring.js';

var resizeDiagram = diagram('#canvas');
var options = {
    layout: {
        default: 'd3v4force',
        values: engines.available(),
        selector: '#layout',
        needs_relayout: true,
        exert: function(val, diagram) {
            var engine = spawnEngine(val);
            apply_engine_parameters(engine);
            resizeDiagram
                .layoutEngine(engine);
        }
    },
    n: {
        default: 50,
        values: [1, 5, 10, 20, 50, 100, 200],
        selector: '#number',
        needs_redraw: true,
        exert: function(val, diagram) {
            populate(val);
            resizeDiagram.autoZoom('once');
        }
    },
    validate: false,
    minWidth: {
        default: 200,
        query: 'minw'
    },
    minHeight: {
        default: 200,
        query: 'minh'
    },
    fit: {
        default: 'default',
        selector: '#fit',
        values: [
            'default',
            'vertical',
            'horizontal',
            'align_tl',
            'align_tr',
            'align_bl',
            'align_br',
            'zoom'
        ],
        needs_redraw: true,
        exert: function(val, diagram) {
            resizeDiagram.fitStrategy(val);
        }
    }
};
var sync_url = sync_url_options(options, dcgraph_domain(resizeDiagram), resizeDiagram);

function apply_engine_parameters(engine) {
    switch(engine.layoutAlgorithm()) {
    case 'd3v4-force':
        engine
            .collisionRadius(25)
            .gravityStrength(0.05)
            .initialCharge(-500);
        break
    case 'd3-force':
        engine
            .gravityStrength(0.1)
            .initialCharge(-1000);
    }
    return engine;
}

function build_data(nodes, edges) {
    // build crossfilters from scratch
    return {
        edgef: flatGroup.make(edges, function(d) {
            return d.id;
        }),
        nodef: flatGroup.make(nodes, function(d) {
            return d.id;
        })
    };
}
var populate = function(n) {
    var random = randomGraph({
        nodeKey: 'id', edgeKey: 'id',
        ncolors: 12,
        log: sync_url.vals.log && sync_url.vals.log !== 'false'
    });
    random.generate(n);
    var data = build_data(random.nodes(), random.edges());
    resizeDiagram
        .nodeDimension(data.nodef.dimension).nodeGroup(data.nodef.group)
        .edgeDimension(data.edgef.dimension).edgeGroup(data.edgef.group);
};


var engine = spawnEngine(sync_url.vals.layout, querystring.parse(), sync_url.vals.worker);
apply_engine_parameters(engine);
// don't do multiple components for cola unless user specified
// layout is that unstable
if(engine.layoutAlgorithm()==='cola')
    if(typeof sync_url.vals.newcomp !== 'string')
        sync_url.vals.newcomp = 0;

resizeDiagram
    .layoutEngine(engine)
    .width('auto')
    .height('auto')
    .restrictPan(true)
    .fitStrategy(sync_url.vals.fit || 'default')
    .autoZoom('always')
    .zoomExtent([0.1, 1.5])
    .nodeShape({shape: sync_url.vals.shape || 'ellipse'})
    .nodeContent('text')
    .nodeIcon(sync_url.vals.icon)
    .nodeStrokeWidth(0) // turn off outlines
    .nodeLabel(function(kv) { return kv.key; })
    .nodeLabelFill(sync_url.vals.shape === 'plain' ? 'black' : function(n) {
        var color = rgb(resizeDiagram.nodeFillScale()(resizeDiagram.nodeFill()(n))),
            // https://www.w3.org/TR/AERT#color-contrast
            brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
        return brightness > 127 ? 'black' : 'ghostwhite';
    })
    .nodeFill(function(kv) {
        return kv.value.color;
    })
    .nodeFillScale(scaleOrdinal().range(
        ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
         '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928']))
    .nodeOpacity(sync_url.vals.opacity)
    .nodeTitle(null) // deactivate basic tooltips
    .edgeArrowhead(sync_url.vals.arrows ? 'vee' : null)
    .timeLimit(sync_url.vals.interval - 100);

if(sync_url.vals.ports) {
    resizeDiagram
        .portStyle('symbols', symbolPortStyle())
        .portStyleName('symbols');
}
var fixNodesMode = fixNodes()
    .strategy(fixNodes.strategy.lastNPerComponent(1));
resizeDiagram.child('fix-nodes', fixNodesMode);

if(sync_url.vals.validate)
    resizeDiagram.child('troubleshoot', validate());

populate(sync_url.vals.n);
await resizeDiagram
    .autoZoom('always-skipanimonce')
    .render();

$('#resize').resizable({
    resize: function(event, ui) {
        resizeDiagram.redraw();
    },
    minWidth: sync_url.vals.minWidth,
    minHeight: sync_url.vals.minHeight
});
