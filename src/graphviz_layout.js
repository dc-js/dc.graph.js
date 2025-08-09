/**
 * Graphviz layout for dc.graph.js
 * @module graphviz_layout
 */

// External dependencies
import * as Viz from '@viz-js/viz';
import { dispatch } from 'd3-dispatch';
import { json } from 'd3-fetch';
import { uuid } from './core.js';
import { graphvizAttrs } from './graphviz_attrs.js';

/**
 * `graphvizLayout` is an adaptor for viz.js (graphviz) layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `graphvizLayout` also implements the attributes from
 * {@link graphvizAttrs graphviz_attrs}
 * @param {String} [id=uuid()] - Unique identifier
 * @param {String} [layout] - Layout algorithm
 * @param {String} [server] - Server URL
 * @return {Object} graphviz layout engine
 */
export function graphvizLayout(id, layout, server) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');
    let _dotInput, _dotString;

    function init(_options) {
    }

    function encode_name(name) {
        return name.replace(/^%/, '&#37;');
    }
    function decode_name(name) {
        return name.replace(/^&#37;/, '%');
    }
    function stringize_property(prop, value) {
        return [prop, `"${value}"`].join('=');
    }
    function stringize_properties(props) {
        return `[${props.join(', ')}]`;
    }
    function data(nodes, edges, clusters) {
        if (_dotInput) {
            _dotString = _dotInput;
            return;
        }
        let lines = [];
        const directed = layout !== 'neato';
        lines.push(`${directed ? 'digraph' : 'graph'} g {`);
        lines.push(`graph ${
            stringize_properties([
                stringize_property('nodesep', graphviz.nodesep()/72),
                stringize_property('ranksep', graphviz.ranksep()/72),
                stringize_property('rankdir', graphviz.rankdir()),
            ])
        }`);
        const cluster_nodes = {};
        nodes.forEach(n => {
            const cl = n.dcg_nodeParentCluster;
            if (cl) {
                cluster_nodes[cl] = cluster_nodes[cl] || [];
                cluster_nodes[cl].push(n.dcg_nodeKey);
            }
        });
        const cluster_children = {}, tops = [];
        clusters.forEach(c => {
            const p = c.dcg_clusterParent;
            if (p) {
                cluster_children[p] = cluster_children[p] || [];
                cluster_children[p].push(c.dcg_clusterKey);
            } else tops.push(c.dcg_clusterKey);
        });

        function print_subgraph(i, c) {
            const indent = ' '.repeat(i*2);
            lines.push(`${indent}subgraph "${c}" {`);
            if (cluster_children[c])
                cluster_children[c].forEach(print_subgraph.bind(null, i+1));
            if (cluster_nodes[c])
                lines.push(`${indent}  ${cluster_nodes[c].map(s => JSON.stringify(s)).join(' ')}`);
            lines.push(`${indent}}`);
        }
        tops.forEach(print_subgraph.bind(null, 1));

        lines = lines.concat(nodes.map(v => {
            const props = [
                stringize_property('width', v.width/72),
                stringize_property('height', v.height/72),
                stringize_property('fixedsize', 'shape'),
                stringize_property('shape', v.abstract.shape),
            ];
            if (v.dcg_nodeFixed)
                props.push(stringize_property(
                    'pos',
                    [
                        v.dcg_nodeFixed.x,
                        1000-v.dcg_nodeFixed.y,
                    ].join(','),
                ));
            return `  "${encode_name(v.dcg_nodeKey)}" ${stringize_properties(props)}`;
        }));
        lines = lines.concat(
            edges.map(e =>
                `  "${encode_name(e.dcg_edgeSource)}${directed ? '" -> "' : '" -- "'}${
                    encode_name(e.dcg_edgeTarget)
                }" ${
                    stringize_properties([
                        stringize_property('id', encode_name(e.dcg_edgeKey)),
                        stringize_property('arrowhead', 'none'),
                        stringize_property('arrowtail', 'none'),
                    ])
                }`
            ),
        );
        lines.push('}');
        lines.push('');
        _dotString = lines.join('\n');
    }

    function process_layout_result(result) {
        _dispatch.call('start');
        const bb = result.bb.split(',').map(x => +x);
        const nodes = (result.objects || []).filter(n => n.pos // remove non-nodes like clusters
        ).map(n => {
            const pos = n.pos.split(',');
            if (isNaN(pos[0]) || isNaN(pos[1])) {
                console.warn('got a NaN position from graphviz');
                pos[0] = pos[1] = 0;
            }
            return {
                dcg_nodeKey: decode_name(n.name),
                x: +pos[0],
                y: bb[3]-pos[1],
            };
        });
        const clusters = (result.objects || []).filter(n => /^cluster/.test(n.name) && n.bb);
        clusters.forEach(c => {
            c.dcg_clusterKey = c.name;

            // gv: llx, lly, urx, ury, up-positive
            const cbb = c.bb.split(',').map(s => +s);
            c.bounds = {left: cbb[0], top: bb[3]-cbb[3], right: cbb[2], bottom: bb[3]-cbb[1]};
        });
        const edges = (result.edges || []).map(e => {
            const e2 = {
                dcg_edgeKey: decode_name(e.id || `n${e._gvid}`),
            };
            if (e._draw_) {
                const directive = e._draw_.find(d => d.op && d.points);
                e2.points = directive.points.map(p => ({x: p[0], y: bb[3]-p[1]}));
            }
            return e2;
        });
        _dispatch.call('end', null, nodes, edges, clusters);
        return {nodes, edges, clusters};
    }

    async function start() {
        try {
            let result;
            if (server) {
                result = await json(server)
                    .header('Content-type', 'application/x-www-form-urlencoded')
                    .post(`layouttool=${layout}&${encodeURIComponent(_dotString)}`);
            } else {
                const viz = await Viz.instance();
                result = viz.renderJSON(_dotString, {engine: layout});
            }
            return process_layout_result(result);
        } catch (error) {
            console.warn('graphviz layout failed: ', error);
            throw error;
        }
    }

    function stop() {
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm() {
            return layout;
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
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
        dotInput(text) {
            _dotInput = text;
            return this;
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
