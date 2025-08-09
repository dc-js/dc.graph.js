import { compose, graph_detect, graph_pattern, subgraph_pattern } from 'metagraph';

export function supergraph(data, options) {
    if (!supergraph.pattern) {
        const graph_and_subgraph = {
            nodes: {
                graph: graph_pattern(options),
                sg: subgraph_pattern(options),
                subgraph: graph_pattern(options),
            },
            edges: {
                to_sg: {
                    source: 'graph',
                    target: 'sg',
                    input: 'parent',
                },
                from_sg: {
                    source: 'subgraph',
                    target: 'sg',
                    input: 'child',
                },
            },
        };
        supergraph.pattern = compose(graph_detect(graph_and_subgraph));
    }
    return supergraph.pattern.node('graph.Graph').value().create(data);
}
