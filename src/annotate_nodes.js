dc_graph.annotate_nodes = () => {
    function draw(diagram) {
        const roots = diagram.g().selectAll('g.node-layer g.node')
              .filter(d => d.orig.value.ceq);
        const annots = roots.selectAll('text.node-annotation').data(d => [d]);
        annots.enter().append('text')
            .attr({
                class: 'node-annotation',
                fill: 'black',
                dx: '150px'
            })
            .style({dx: '100px'});
        annots
            .text(d => d.orig.value.ceq);
    }
    function remove() {}
    const _mode = dc_graph.mode('annotate-nodes', {
        draw,
        remove
    });
    return _mode;
};
