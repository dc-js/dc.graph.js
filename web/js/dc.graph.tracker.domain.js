export function dcgraph_domain(diagram, chartgroup) {
    return {
        on_exert(opt) {
            if (opt.needs_relayout)
                diagram.relayout();
            if (opt.needs_relayout || opt.needs_redraw) {
                if (opt.needs_redraw === 'refresh')
                    diagram.refresh();
                else
                    dc.redrawAll(chartgroup);
            }
        },
    };
}

export function dcgraph_multi_domain(diagrams, chartgroup) {
    return {
        on_exert(opt) {
            const diagram = diagrams[opt.diagram];
            if (opt.needs_relayout)
                diagram.relayout();
            if (opt.needs_relayout || opt.needs_redraw) {
                if (opt.needs_redraw === 'refresh')
                    diagram.refresh();
                else
                    dc.redrawAll(chartgroup);
            }
        },
    };
}

export default dcgraph_domain;
