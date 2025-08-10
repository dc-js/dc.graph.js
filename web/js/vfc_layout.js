import { app_layouts } from './app_layout.js';
import { alignY, gapY, tree_constraints, tree_positions } from './dc-graph.js';

app_layouts.vfc = function() {
    function rank(label) {
        return label.split(':')[2];
    }

    function is_tree_edge(diagram, e) {
        return rank(diagram.getNode(diagram.edgeSource()(e)).value.label_)
            !== rank(diagram.getNode(diagram.edgeTarget()(e)).value.label_);
    }

    function is_root_node(n) {
        return rank(n.value.label_) === 'VNF';
    }

    const _rowmap = {
        VNF: 0,
        VFC: 1,
        VM: 2,
        Host: 3,
    };
    function _node_row(n) {
        return _rowmap[rank(n.value.label_)];
    }

    const treeOnly = false;

    return {
        rules: {
            nodes: [
                {
                    id: 'layer',
                    partition: 'label_',
                    extract(v) {
                        return rank(v);
                    },
                    typename(id, value) {
                        return value;
                    },
                },
            ],
            edges: [
                {source: 'VNF', target: 'VFC', produce: gapY(100, true)},
                {source: 'VFC', target: 'VM', produce: gapY(100, true)},
                {source: 'VM', target: 'Host', produce: gapY(100, true)},

                {source: 'VNF', target: 'VNF', produce: alignY()},
                /*
                 {source: 'VFC', target: 'VFC', produce: dc_graph.align_y()},
                 {source: 'VM', target: 'VM', produce: dc_graph.align_y()},
                 {source: 'Host', target: 'Host', produce: dc_graph.align_y()}*/
            ],
        },
        constraints(diagram, nodes, edges) {
            return tree_constraints(
                is_root_node,
                is_tree_edge.bind(null, diagram),
                10,
                100,
            )(diagram, nodes, edges);
        },
        initDiagram(diagram) {
            diagram
                .nodeLabel(null)
                .nodeRadius(3)
                .induceNodes(true)
                .parallelEdgeOffset(1)
                .edgeLabel(null)
                .edgeArrowSize(0.5)
                .edgeIsLayout(e => is_tree_edge(diagram, e))
                .nodeFixed(n => is_root_node(n) ? true : null)
                .nodeTitle(n => n.value.name);
            if (treeOnly) {
                diagram
                    .initialLayout(
                        tree_positions(
                            null,
                            _node_row,
                            is_tree_edge.bind(null, diagram),
                            50,
                            50,
                            10,
                            100,
                        ),
                    )
                    .initialOnly(true);
            }
        },
    };
}();
