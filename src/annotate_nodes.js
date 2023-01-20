dc_graph.annotate_nodes = () => {
    function draw(diagram) {
        const roots = diagram.g().selectAll('g.node-layer g.node');
        const annots = roots.selectAll('text.node-annotation').data(d =>  d.orig.value.ceq ? [d] : []);
        annots.enter().append('text')
            .attr({
                class: 'node-annotation',
                fill: d => {
                    const nf = diagram.nodeFill.eval(d);
                    return diagram.nodeFillScale()(nf - ((nf%2) ? 0 : 1));
                },
                'font-weight': 750,
                'font-size': '50px',
                'alignment-baseline': 'central',
                dx: d => Math.round(d.dcg_rx + 10) + 'px'
            });
        annots.exit().remove();
        annots
            .text(d => d.orig.value.ceq);
    }
    function remove() {}
    const _mode = dc_graph.mode('annotate-nodes', {
        draw,
        remove,
        laterDraw: true
    });
    return _mode;
};
