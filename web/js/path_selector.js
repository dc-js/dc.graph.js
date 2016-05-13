function path_selector(parent, reader, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    var root = d3.select(parent);
    var hovered = null, selected = null;

    function contains_path(paths) {
        return function(path) {
            return paths ? paths.indexOf(path)>=0 : false;
        };
    }

    // this should use the whole cascading architecture
    // and allow customization rather than hardcoding everything
    highlight_paths_group
        .on('paths_changed.selector', function(nop, eop, paths) {
            var p2 = root.selectAll('p').data(paths);
            p2.enter().append('p')
                .append('span').style({
                    'border-width': '1px',
                    'border-style': 'solid',
                    'border-color': 'grey',
                    'border-radius': '4px',
                    'padding': '3px',
                    'cursor': 'pointer'
                });
            p2.exit().transition(1000).attr('opacity', 0).remove();
            p2.select('span').text(function(d, i) {
                return 'path ' + (i+1) + ' (' + reader.elementList.eval(d).length + ')';
            });
        })
        .on('hover_changed.selector', function(hpaths) {
            hovered = hpaths;
            var is_hovered = contains_path(hovered);
            root.selectAll('p').select('span')
                .style({
                    'border-color': function(d, i) { return is_hovered(d) ? '#e41a1c' : 'grey'; },
                    'border-width': function(d, i) { return (is_hovered(d) ? 2 : 1) + 'px'; }
                });
        })
        .on('select_changed.selector', function(spaths) {
            selected = spaths;
            var is_selected = contains_path(selected);
            root.selectAll('p').select('span')
                .style({
                    'background-color': function(d, i) { return is_selected(d) ? '#1c1ae6' : 'white'; },
                    'color': function(d, i) { return is_selected(d) ? 'white' : 'black'; }
                });
        });
}
