function dcgraph_domain(diagram, chartgroup) {
    return {
        on_exert: function(opt) {
            if(opt.needs_relayout)
                diagram.relayout();
            if(opt.needs_relayout || opt.needs_redraw)
                dc.redrawAll(chartgroup);
        }
    };
}

