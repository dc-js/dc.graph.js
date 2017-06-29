dc_graph.highlight_paths_spline = function(pathprops, hoverprops, selectprops, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    selectprops = selectprops || {};
    var node_on_paths = {}, edge_on_paths = {}, pathsAll = null, selected = null, hoverpaths = null;
    var _anchor;

    function refresh() {
        if(_behavior.doRedraw())
            _behavior.parent().relayout().redraw();
        else
            _behavior.parent().refresh();
    }

    function relayoutPath(paths) {
        _behavior.parent().relayoutPath(paths);
    }

    function paths_changed(nop, eop, paths) {
        selected = hoverpaths = null;
        // it would be difficult to check if no change, but at least check if changing from empty to empty
        if(Object.keys(node_on_paths).length === 0 && Object.keys(nop).length === 0 &&
           Object.keys(edge_on_paths).length === 0 && Object.keys(eop).length === 0)
            return;
        node_on_paths = nop;
        edge_on_paths = eop;
        pathsAll = paths;

        // check if path exits on current chart
        if(pathExists(paths) > 0) {
            console.log('path exits');
            relayoutPath(paths);
            drawSpline(paths, pathprops);
        }
    }

    function pathExists(paths) {
        var nodesCount = 0;
        paths.forEach(function(d) {
            nodesCount += getNodePosition(d).length;
        });
        return nodesCount > 0;
    }

    function getNodePosition(path) {
        var _chart = _behavior.parent();
        var plist = [];
        for(var i = 0; i < path.element_list.length; i ++) {
            var uid = path.element_list[i].property_map.ecomp_uid;
            var node = _chart.getNodeAllInfo(uid);
            if(node !== null) {
                plist.push({'x': node.cola.x, 'y': node.cola.y});
            }
        }
        return plist;
    };

    // convert original path data into <d>
    function parsePath(p, lineTension) {
        lineTension = lineTension || 0.6;

        function _distance(node1, node2) {
            return Math.sqrt(Math.pow((node1.x-node2.x),2) + Math.pow((node1.y-node2.y),2));
        }

        var path_coord = getNodePosition(p);

        // insert fake nodes to avoid sharp turns
        var new_path_coord = [];
        for(var i = 0; i < path_coord.length; i ++) {
            if (i-1 >= 0 && i+1 < path_coord.length) {
                if (path_coord[i-1].x === path_coord[i+1].x &&
                    path_coord[i-1].y === path_coord[i+1].y ) {
                    // insert node when the previous and next nodes are the same
                    var x1 = path_coord[i-1].x, y1 = path_coord[i-1].y;
                    var x2 = path_coord[i].x, y2 = path_coord[i].y;
                    var dx = x1 - x2, dy = y1 - y2;

                    var v1 = dy / Math.sqrt(dx*dx + dy*dy);
                    var v2 = - dx / Math.sqrt(dx*dx + dy*dy);

                    var insert_p1 = {'x': null, 'y': null};
                    var insert_p2 = {'x': null, 'y': null};

                    var offset = 10;

                    insert_p1.x = (x1+x2)/2.0 + offset*v1;
                    insert_p1.y = (y1+y2)/2.0 + offset*v2;

                    insert_p2.x = (x1+x2)/2.0 - offset*v1;
                    insert_p2.y = (y1+y2)/2.0 - offset*v2;

                    new_path_coord.push(insert_p1);
                    new_path_coord.push(path_coord[i]);
                    new_path_coord.push(insert_p2);
                } else if (_distance(path_coord[i-1], path_coord[i+1]) < 20){
                    // insert node when the previous and next nodes are very close
                    // first node
                    var x1 = path_coord[i-1].x, y1 = path_coord[i-1].y;
                    var x2 = path_coord[i].x, y2 = path_coord[i].y;
                    var dx = x1 - x2, dy = y1 - y2;

                    var v1 = dy / Math.sqrt(dx*dx + dy*dy);
                    var v2 = - dx / Math.sqrt(dx*dx + dy*dy);

                    var insert_p1 = {'x': null, 'y': null};

                    var offset = 10;

                    insert_p1.x = (x1+x2)/2.0 + offset*v1;
                    insert_p1.y = (y1+y2)/2.0 + offset*v2;

                    // second node
                    x1 = path_coord[i].x
                    y1 = path_coord[i].y;
                    x2 = path_coord[i+1].x
                    y2 = path_coord[i+1].y;
                    dx = x1 - x2;
                    dy = y1 - y2;

                    v1 = dy / Math.sqrt(dx*dx + dy*dy);
                    v2 = - dx / Math.sqrt(dx*dx + dy*dy);

                    var insert_p2 = {'x': null, 'y': null};

                    insert_p2.x = (x1+x2)/2.0 + offset*v1;
                    insert_p2.y = (y1+y2)/2.0 + offset*v2;

                    new_path_coord.push(insert_p1);
                    new_path_coord.push(path_coord[i]);
                    new_path_coord.push(insert_p2);

                }
                else {
                    new_path_coord.push(path_coord[i]);
                }
            } else {
                new_path_coord.push(path_coord[i]);
            }
        }

        var line = d3.svg.line()
            .interpolate("cardinal")
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
            .tension(lineTension);

        return line(new_path_coord);
    }

    // draw the spline for paths
    function drawSpline(paths, pathprops) {
        var _chart = _behavior.parent();

        // draw spline edge
        var _splineLayer = _chart.select(".spline-layer");

        var edge = _splineLayer.selectAll(".spline-edge").data(paths);
        var edgeEnter = edge.enter().append("svg:path")
            .attr('class', 'spline-edge')
            .attr('id', function(d, i) { return "spline-path-"+i; })
            .attr('d', function(d) { return parsePath(d, pathprops.lineTension); })
            .attr('stroke', _chart.edgeStroke() || 'black')
            .attr('stroke-width', _chart.edgeStrokeWidth() || 1)
            .attr('opacity', pathprops.edgeOpacity || 1)
            .attr('fill', 'none');
        edge.exit().remove();


        // another wider copy of the edge just for hover events
        var edgeHover = _splineLayer.selectAll('.spline-edge-hover')
            .data(paths);
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'spline-edge-hover')
            .attr('d', function(d) { return parsePath(d); })
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', 5)
            .attr('fill', 'none')
            .on('mouseover', function(d, i) {
                highlight_paths_group.hover_changed([paths[i]]);
             })
            .on('mouseout', function(d, i) {
                highlight_paths_group.hover_changed(null);
             })
            .on('click', function(d, i) {
                highlight_paths_group.select_changed([paths[i]]);
             });
        edgeHover.exit().remove();
    };

    d3.selection.prototype.moveToFront = function() {
        return this.each(function() {
            this.parentNode.appendChild(this);
        });
    };

    function draw_hovered() {
        if(hoverpaths === null) {
            d3.selectAll('.spline-edge').attr('stroke', 'black');
        } else {
            for(var i = 0; i < hoverpaths.length; i ++) {
                var path_id = pathsAll.indexOf(hoverpaths[i])
                var sel_path = d3.select("#spline-path-"+path_id).attr('stroke', hoverprops.edgeStroke);
                sel_path.moveToFront();
            }
        }
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

    function add_behavior(chart, node, edge, ehover) {
        chart
            .cascade(300, true, conditional_properties(function(n) {
                return intersect_paths(node_on_paths[chart.nodeKey.eval(n)], selected);
            }, function(e) {
                return intersect_paths(edge_on_paths[chart.edgeKey.eval(e)], selected);
            }, selectprops));

        node
            .on('mouseover.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(node_on_paths[chart.nodeKey.eval(n)] || null);
            })
            .on('mouseout.highlight-paths', function(n) {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', function(n) {
                highlight_paths_group.select_changed(toggle_paths(selected, node_on_paths[chart.nodeKey.eval(n)]));
            });

    }

    function remove_behavior(chart, node, edge, ehover) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        clear_all_highlights();
        chart
            .cascade(300, false, selectprops)
            .cascade(400, false, hoverprops);
    }

    highlight_paths_group
        .on('hover_changed.highlight-paths-spline', function(hpaths) {
            if(hoverpaths !== hpaths) {
                hoverpaths = hpaths;
                draw_hovered();
            }
        });

    var _behavior = dc_graph.behavior('highlight-paths-spline', {
        add_behavior: add_behavior,
        remove_behavior: function(chart, node, edge, ehover) {
            remove_behavior(chart, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            if(p)
                _anchor = p.anchorName();
            // else we should have received anchor earlier
            highlight_paths_group.on('paths_changed.' + _anchor, p ? paths_changed : null);
            highlight_paths_group.on('select_changed.' + _anchor, p ? select_changed : null);
        }
    });

    // whether to do relayout & redraw (true) or just refresh (false)
    _behavior.doRedraw = property(false);

    return _behavior;
};
