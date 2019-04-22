function dcgraph_domain(diagram, chartgroup) {
    return {
        on_exert: function(opt) {
            if(opt.needs_relayout)
                diagram.relayout();
            if(opt.needs_relayout || opt.needs_redraw)
                if(opt.needs_redraw === 'refresh')
                    diagram.refresh();
                else
                    dc.redrawAll(chartgroup);
        }
    };
}

function dcgraph_multi_domain(diagrams, chartgroup) {
    return {
        on_exert: function(opt) {
            var diagram = diagrams[opt.diagram];
            if(opt.needs_relayout)
                diagram.relayout();
            if(opt.needs_relayout || opt.needs_redraw)
                if(opt.needs_redraw === 'refresh')
                    diagram.refresh();
                else
                    dc.redrawAll(chartgroup);
        }
    };
}
