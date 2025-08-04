/**
 * Layered layout for dc.graph.js
 * @module layered_layout
 */

import { dispatch } from 'd3-dispatch';
import { uuid, property } from './core.js';
import { graphvizAttrs } from './graphviz_attrs.js';
import { supergraph } from './supergraph.js';

/**
 * `layeredLayout` produces 3D layered layouts, utilizing another layout
 * that supports fixed nodes and position hints for the layers
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} layered layout engine
 **/
export function layeredLayout(id) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');
    let _supergraph, _subgraphs;
    let _layers;
    let _options = null;

    function init(options) {
        _options = options;

    }

    function data(nodes, edges, _constraints) {
        _supergraph = supergraph({nodes, edges}, {
            nodeKey(n) { return n.dcg_nodeKey; },
            edgeKey(n) { return n.dcg_edgeKey; },
            nodeValue(n) { return n; },
            edgeValue(e) { return e; },
            edgeSource(e) { return e.dcg_edgeSource; },
            edgeTarget(e) { return e.dcg_edgeTarget; }
        });

        // every node belongs natively in one rank
        const nranks = _supergraph.nodes().reduce((p, n) => {
            const rank = engine.layerAccessor()(n.value());
            p[rank] = p[rank] || [];
            p[rank].push(n);
            return p;
        }, {});
        const eranks = Object.keys(nranks).reduce((p, r) => {
            p[r] = [];
            return p;
        }, {});

        // nodes are shadowed into any layers to which they are adjacent
        // edges are induced from the native&shadow nodes in each layer
        _supergraph.edges().forEach((e) => {
            const srank = engine.layerAccessor()(e.source().value()),
                trank = engine.layerAccessor()(e.target().value());
            if(srank == trank) {
                eranks[srank].push(e);
                return;
            }
            nranks[trank].push(e.source());
            eranks[trank].push(e);
            nranks[srank].push(e.target());
            eranks[srank].push(e);
        });

        // produce a subgraph for each layer
        _subgraphs = Object.keys(nranks).reduce((p, r) => {
            p[r] = _supergraph.subgraph(
                nranks[r].map((n) => n.key()),
                eranks[r].map((e) => e.key()));
            return p;
        }, {});

        // start from the most populous layer
        let max = null;
        Object.keys(nranks).forEach((r) => {
            if(max === null ||
               _subgraphs[r].nodes().length > _subgraphs[max].nodes().length)
                max = +r;
        });

        // travel up and down from there, each time fixing the nodes from the last layer
        const ranks = Object.keys(nranks).map((r) => +r).sort();
        _layers = ranks.map((r) => ({
                rank: r,
                z: -r * engine.layerSeparationZ()
            }));
        const mi = ranks.indexOf(max);
        const ups = ranks.slice(mi+1), downs = ranks.slice(0, mi).reverse();
        layout_layer(max, -1).then((layout) => {
            Promise.all([
                layout_layers(layout, max, ups),
                layout_layers(layout, max, downs)
            ]).then(() => {
                _dispatch.call("end", null,
                    _supergraph.nodes().map((n) => n.value()),
                    _supergraph.edges().map((e) => e.value()));
            });
        });
    }

    function layout_layers(layout, last, layers) {
        if(layers.length === 0)
            return Promise.resolve(layout);
        const curr = layers.shift();
        return layout_layer(curr, last).then((layout) => layout_layers(layout, curr, layers));
    }

    function layout_layer(r, _last) {
        _subgraphs[r].nodes().forEach((n) => {
            if(engine.layerAccessor()(n.value()) !== r &&
               n.value().x !== undefined &&
               n.value().y !== undefined)
                n.value().dcg_nodeFixed = {
                    x: n.value().x,
                    y: n.value().y
                };
            else n.value().dcg_nodeFixed = null;
        });
        const subengine = engine.engineFactory()();
        subengine.init(_options);
        subengine.data(
            {},
            _subgraphs[r].nodes().map((n) => n.value()),
            _subgraphs[r].edges().map((e) => e.value()));
        return promise_layout(r, subengine);
    }

    function promise_layout(r, subengine) {
        // stopgap - engine.start() should return a promise
        return new Promise((resolve, _reject) => {
            subengine.on('end', (nodes, edges) => {
                resolve({nodes, edges});
            });
            subengine.start();
        }).then((layout) => {
            // copy positions back into the subgraph (and hence supergraph)
            layout.nodes.forEach((ln) => {
                const n = _subgraphs[r].node(ln.dcg_nodeKey);
                // do not copy positions for shadow nodes
                if(engine.layerAccessor()(n.value()) !== r)
                    return;
                n.value().x = ln.x;
                n.value().y = ln.y;
                n.value().z = -r * engine.layerSeparationZ(); // lowest rank at top
            });
            return layout;
        });
    }

    function start() {
        _dispatch.call("start");
    }

    function stop() {
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);

    const engine = Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'layered';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
        },
        parent: property(null),
        on(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach((option) => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges, constraints) {
            data(nodes, edges, constraints);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return []
                .concat(graphviz_keys);
        },
        engineFactory: property(null),
        layerAccessor: property(null),
        layerSeparationZ: property(50),
        layers() {
            return _layers;
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({})
    });
    return engine;
};


