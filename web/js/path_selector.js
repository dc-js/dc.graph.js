function path_selector(parent, reader, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    var root = d3.select(parent);
    var hovered = null, selected = null;

    // unfortunately these functions are copied from dc_graph.highlight_paths
    function contains_path(paths) {
        return function(path) {
            return paths ? paths.indexOf(path)>=0 : false;
        };
    }

    function doesnt_contain_path(paths) {
        var cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function toggle_paths(pathsA, pathsB) {
        if(!pathsA)
            return pathsB;
        else if(!pathsB)
            return pathsA;
        if(pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    // this should use the whole cascading architecture
    // and allow customization rather than hardcoding everything
    // in fact, you can't even reliably overlap attributes without that (so we don't)
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
            })
                .on('mouseover', function(d) {
                    highlight_paths_group.hover_changed([d]);
                })
                .on('mouseout', function(d) {
                    highlight_paths_group.hover_changed(null);
                })
                .on('click', function(d) {
                    highlight_paths_group.select_changed(toggle_paths(selected, [d]));
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
