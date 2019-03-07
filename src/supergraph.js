dc_graph.supergraph = function(data, options) {
    if(!dc_graph.supergraph.pattern) {
        var mg = metagraph;
        var graph_and_subgraph = {
            nodes: {
                graph: mg.graph_pattern(options),
                sg: mg.subgraph_pattern(options),
                subgraph: mg.graph_pattern(options)
            },
            edges: {
                to_sg: {
                    source: 'graph',
                    target: 'sg',
                    input: 'parent'
                },
                from_sg: {
                    source: 'subgraph',
                    target: 'sg',
                    input: 'child'
                }
            }
        };
        dc_graph.supergraph.pattern = mg.compose(mg.graph_detect(graph_and_subgraph));
    }
    return dc_graph.supergraph.pattern.node('graph.Graph').value().create(data);
};
