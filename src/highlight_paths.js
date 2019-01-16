dc_graph.highlight_paths = function(pathprops, hoverprops, selectprops, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    selectprops = selectprops || {};
    var node_on_paths = {}, edge_on_paths = {}, selected = null, hoverpaths = null;
    var _anchor;

    function refresh() {
        if(_mode.doRedraw())
            _mode.parent().relayout().redraw();
        else
            _mode.parent().refresh();
    }

    function paths_changed(nop, eop) {
        selected = hoverpaths = null;
        // it would be difficult to check if no change, but at least check if changing from empty to empty
        if(Object.keys(node_on_paths).length === 0 && Object.keys(nop).length === 0 &&
           Object.keys(edge_on_paths).length === 0 && Object.keys(eop).length === 0)
            return;
        node_on_paths = nop;
        edge_on_paths = eop;
        refresh();
    }

    function hover_changed(hp) {
        if(hp !== hoverpaths) {
            hoverpaths = hp;
            refresh();
        }
    }

    function select_changed(sp) {
        if(sp !== selected) {
            selected = sp;
            refresh();
        }
    }

    function clear_all_highlights() {
        node_on_paths = {};
        edge_on_paths = {};
    }

    function contains_path(paths) {
        return function(path) {
            return paths.indexOf(path)>=0;
        };
    }

    // sigh
    function doesnt_contain_path(paths) {
        var cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function intersect_paths(pathsA, pathsB) {
        if(!pathsA || !pathsB)
            return false;
        return pathsA.some(contains_path(pathsB));
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

    function draw(diagram, node, edge, ehover) {
        diagram
            .cascade(200, true, node_edge_conditions(function(n) {
                return !!node_on_paths[diagram.nodeKey.eval(n)];
            }, function(e) {
                return !!edge_on_paths[diagram.edgeKey.eval(e)];
            }, pathprops))
            .cascade(300, true, node_edge_conditions(function(n) {
                return intersect_paths(node_on_paths[diagram.nodeKey.eval(n)], selected);
            }, function(e) {
                return intersect_paths(edge_on_paths[diagram.edgeKey.eval(e)], selected);
            }, selectprops))
            .cascade(400, true, node_edge_conditions(function(n) {
                return intersect_paths(node_on_paths[diagram.nodeKey.eval(n)], hoverpaths);
            }, function(e) {
                return intersect_paths(edge_on_paths[diagram.edgeKey.eval(e)], hoverpaths);
            }, hoverprops));

        node
            .on('mouseover.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(node_on_paths[diagram.nodeKey.eval(n)] || null);
            })
            .on('mouseout.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, node_on_paths[diagram.nodeKey.eval(n)]));
            });


        ehover
            .on('mouseover.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(edge_on_paths[diagram.edgeKey.eval(e)] || null);
            })
            .on('mouseout.highlight-paths', function(e) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, edge_on_paths[diagram.nodeKey.eval(n)]));
            });
    }

    function remove(diagram, node, edge, ehover) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        ehover
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        clear_all_highlights();
        diagram
            .cascade(200, false, pathprops)
            .cascade(300, false, selectprops)
            .cascade(400, false, hoverprops);
    }

    var _mode = dc_graph.mode('highlight-paths', {
        draw: draw,
        remove: function(diagram, node, edge, ehover) {
            remove(diagram, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            if(p)
                _anchor = p.anchorName();
            // else we should have received anchor earlier
            highlight_paths_group.on('paths_changed.highlight-paths-' + _anchor, p ? paths_changed : null);
            highlight_paths_group.on('hover_changed.highlight-paths-' + _anchor, p ? hover_changed : null);
            highlight_paths_group.on('select_changed.highlight-paths-' + _anchor, p ? select_changed : null);
        }
    });

    // whether to do relayout & redraw (true) or just refresh (false)
    _mode.doRedraw = property(false);

    return _mode;
};

