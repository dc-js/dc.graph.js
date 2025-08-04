/**
 * Dagre.js layout adaptor for dc.graph.js
 * @module dagre_layout
 */

// External dependencies
import * as dagre from '@dagrejs/dagre';
import { dispatch } from 'd3-dispatch';
import { uuid } from './core.js';
import { regenerateObjects } from './generate_objects.js';
import { graphvizAttrs } from './graphviz_attrs.js';

/**
 * `dagreLayout` is an adaptor for dagre.js layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `dagreLayout` also implements the attributes from
 * {@link graphvizAttrs graphviz_attrs}
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} dagre layout engine
 */
export function dagreLayout(id) {
    const _layoutId = id || uuid();
    let _dagreGraph = null, _tick, _done;
    const _dispatch = dispatch('tick', 'start', 'end');
    // node and edge objects preserved from one iteration
    // to the next (as long as the object is still in the layout)
    const _nodes = {}, _edges = {};

    function init(options) {
        // Create a new directed graph
        _dagreGraph = new dagre.graphlib.Graph({multigraph: true, compound: true});

        // Set an object for the graph label
        _dagreGraph.setGraph({
            rankdir: options.rankdir,
            nodesep: options.nodesep,
            ranksep: options.ranksep,
        });

        // Default to assigning a new object as a label for each new edge.
        _dagreGraph.setDefaultEdgeLabel(() => ({}));
    }

    function data(nodes, edges, clusters) {
        const wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            /*
              dagre does not seem to accept input positions
              if(v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
              }
             */
        }, (k, o) => {
            _dagreGraph.setNode(k, o);
        }, k => {
            _dagreGraph.removeNode(k);
        });
        const wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, (k, o, e) => {
            _dagreGraph.setEdge(e.dcg_edgeSource, e.dcg_edgeTarget, o);
        }, (k, e) => {
            _dagreGraph.removeEdge(e.dcg_edgeSource, e.dcg_edgeTarget, e.dcg_edgeKey);
        });
        clusters = clusters.filter(c => /^cluster/.test(c.dcg_clusterKey));
        clusters.forEach(c => {
            _dagreGraph.setNode(c.dcg_clusterKey, c);
        });
        clusters.forEach(c => {
            if (c.dcg_clusterParent)
                _dagreGraph.setParent(c.dcg_clusterKey, c.dcg_clusterParent);
        });
        nodes.forEach(n => {
            if (n.dcg_nodeParentCluster)
                _dagreGraph.setParent(n.dcg_nodeKey, n.dcg_nodeParentCluster);
        });

        function dispatchState(event) {
            _dispatch.call(
                event,
                null,
                wnodes,
                wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})),
                clusters.map(c => {
                    const cluster = Object.assign({}, _dagreGraph.node(c.dcg_clusterKey));
                    cluster.bounds = {
                        left: cluster.x-cluster.width/2,
                        top: cluster.y-cluster.height/2,
                        right: cluster.x+cluster.width/2,
                        bottom: cluster.y+cluster.height/2,
                    };
                    return cluster;
                }),
            );
        }
        _tick = function() {
            dispatchState('tick');
        };
        _done = function() {
            dispatchState('end');
        };
    }

    function start(_options) {
        _dispatch.call('start');
        dagre.layout(_dagreGraph);
        _done();
    }

    function stop() {
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'dagre';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges, clusters) {
            data(nodes, edges, clusters);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return graphviz_keys;
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
    });
}
