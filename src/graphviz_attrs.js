/**
 * Graphviz attributes for layout engines
 * @module graphviz_attrs
 */

import { property } from './core.js';

/**
 * `graphvizAttrs` defines a basic set of attributes which layout engines should
 * implement - although these are not required, they make it easier for clients and
 * modes (like expand_collapse) to work with multiple layout engines.
 *
 * these attributes are {@link http://www.graphviz.org/doc/info/attrs.html from graphviz}
 * @return {Object}
 **/
export function graphvizAttrs() {
    return {
        /**
         * Direction to draw ranks.
         * @method rankdir
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [rankdir='TB'] 'TB', 'LR', 'BT', or 'RL'
         **/
        rankdir: property('TB'),
        /**
         * Spacing in between nodes in the same rank.
         * @method nodesep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [nodesep=40]
         **/
        nodesep: property(40),
        /**
         * Spacing in between ranks.
         * @method ranksep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [ranksep=40]
         **/
        ranksep: property(40)
    };
};

// graphlib-dot seems to wrap nodes in an extra {value}
// actually this is quite a common problem with generic libs
function nvalue(n) {
    return n.value.value ? n.value.value : n.value;
}

// apply standard accessors to a diagram in order to style it as graphviz would
// this is a work in progress
export function applyGraphvizAccessors(diagram) {
    diagram
        .nodeLabel((n) => {
            let label = nvalue(n).label;
            if(label === undefined)
                label = n.key;
            return label && label.split(/\n|\\n/);
        })
        .nodeRadius((n) => 
            // should do width & height instead, #25
             nvalue(n).radius || 25
        )
        .nodeShape((n) => nvalue(n).shape)
        .nodeFill((n) => nvalue(n).fillcolor || 'white')
        .nodeOpacity((n) => 
            // not standard gv
             nvalue(n).opacity || 1
        )
        .nodeLabelFill((n) => nvalue(n).fontcolor || 'black')
        .nodeTitle((n) => (nvalue(n).htmltip || nvalue(n).jsontip) ? null :
                nvalue(n).tooltip !== undefined ?
                nvalue(n).tooltip :
                diagram.nodeLabel()(n))
        .nodeStrokeWidth((n) => {
            // it is debatable whether a point === a pixel but they are close
            // https://graphicdesign.stackexchange.com/questions/199/point-vs-pixel-what-is-the-difference
            const penwidth = nvalue(n).penwidth;
            return penwidth !== undefined ? +penwidth : 1;
        })
        .edgeLabel((e) => e.value.label ? e.value.label.split(/\n|\\n/) : '')
        .edgeStroke((e) => e.value.color || 'black')
        .edgeOpacity((e) => 
            // not standard gv
             e.value.opacity || 1
        )
        .edgeArrowSize((e) => e.value.arrowsize || 1)
        // need directedness to default these correctly, see #106
        .edgeArrowhead((e) => {
            const head = e.value.arrowhead;
            return head !== undefined ? head : 'vee';
        })
        .edgeArrowtail((e) => {
            const tail = e.value.arrowtail;
            return tail !== undefined ? tail : null;
        })
        .edgeStrokeDashArray((e) => {
            switch(e.value.style) {
            case 'dotted':
                return [1,5];
            }
            return null;
        });
    const draw_clusters = diagram.child('draw-clusters');
    if(draw_clusters) {
        draw_clusters
            .clusterStroke((c) => c.value.color || 'black')
            .clusterFill((c) => c.value.style === 'filled' ? c.value.fillcolor || c.value.color || c.value.bgcolor : null)
            .clusterLabel((c) => c.value.label);
    }
};

export function snapshotGraphviz(diagram) {
    const xDomain = diagram.x().domain(), yDomain = diagram.y().domain();
    return {
        nodes: diagram.nodeGroup().all().map((n) => diagram.getWholeNode(n.key))
            .filter((x) => x)
            .map((n) => ({
                    key: diagram.nodeKey.eval(n),
                    label: diagram.nodeLabel.eval(n),
                    fillcolor: diagram.nodeFillScale()(diagram.nodeFill.eval(n)),
                    penwidth: diagram.nodeStrokeWidth.eval(n),
                    // not supported as input, see dc.graph.js#25
                    // width: n.cola.dcg_rx*2,
                    // height: n.cola.dcg_ry*2,

                    // not graphviz attributes
                    // until we have w/h
                    radius: diagram.nodeRadius.eval(n),
                    // does not seem to exist in gv
                    opacity: diagram.nodeOpacity.eval(n),
                    // should be pos
                    x: n.cola.x,
                    y: n.cola.y
                })),
        edges: diagram.edgeGroup().all().map((e) => diagram.getWholeEdge(e.key)).map((e) => ({
                key: diagram.edgeKey.eval(e),
                source: diagram.edgeSource.eval(e),
                target: diagram.edgeTarget.eval(e),
                color: diagram.edgeStroke.eval(e),
                arrowsize: diagram.edgeArrowSize.eval(e),
                opacity: diagram.edgeOpacity.eval(e),
                // should support dir, see dc.graph.js#106
                arrowhead: diagram.edgeArrowhead.eval(e),
                arrowtail: diagram.edgeArrowtail.eval(e)
            })),
        bounds: {
            left: xDomain[0],
            top: yDomain[0],
            right: xDomain[1],
            bottom: yDomain[1]
        }
    };
};
