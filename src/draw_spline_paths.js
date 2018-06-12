dc_graph.draw_spline_paths = function(pathreader, pathprops, hoverprops, selectprops, pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    var _paths = null, _hoverpaths = null, _selected = null;
    var _anchor;
    var _layer = null;
    var _savedPositions = null;

    function paths_changed(nop, eop, paths) {
        _paths = paths;

        var engine = _behavior.parent().layoutEngine(),
            localPaths = paths.filter(pathIsPresent);
        if(localPaths.length) {
            var nidpaths = localPaths.map(function(lpath) {
                var strength = pathreader.pathStrength.eval(lpath);
                if(typeof strength !== 'number')
                    strength = 1;
                if(_selected && _selected.indexOf(lpath) !== -1)
                    strength *= _behavior.selectedStrength();
                return {
                    nodes: path_keys(lpath),
                    strength: strength
                };
            });
            engine.paths(nidpaths);
        } else {
            engine.paths(null);
            if(_savedPositions)
                engine.restorePositions(_savedPositions);
        }
        if(_selected)
            _selected = _selected.filter(function(p) { return localPaths.indexOf(p) !== -1; });
        _behavior.parent().redraw();
    }

    function select_changed(sp) {
        if(sp !== _selected) {
            _selected = sp;
            paths_changed(null, null, _paths);
        }
    }

    function path_keys(path, unique) {
        unique = unique !== false;
        var keys = pathreader.elementList.eval(path).filter(function(elem) {
            return pathreader.elementType.eval(elem) === 'node';
        }).map(function(elem) {
            return pathreader.nodeKey.eval(elem);
        });
        return unique ? uniq(keys) : keys;
    }

    // check if entire path is present in this view
    function pathIsPresent(path) {
        return pathreader.elementList.eval(path).every(function(element) {
            return pathreader.elementType.eval(element) !== 'node' ||
                _behavior.parent().getWholeNode(pathreader.nodeKey.eval(element));
        });
    }

    // get the positions of nodes on path
    function getNodePositions(path, old) {
        return path_keys(path, false).map(function(key) {
            var node = _behavior.parent().getWholeNode(key);
            return {x: old && node.prevX !== undefined ? node.prevX : node.cola.x,
                    y: old && node.prevY !== undefined ? node.prevY : node.cola.y};
        });
    };

    // insert fake nodes to avoid sharp turns
    function insertDummyNodes(path_coord) {
        function _distance(node1, node2) {
            return Math.sqrt(Math.pow((node1.x-node2.x),2) + Math.pow((node1.y-node2.y),2));
        }

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
                } else if (_distance(path_coord[i-1], path_coord[i+1]) < pathprops.nearNodesDistance){
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
                    x1 = path_coord[i].x;
                    y1 = path_coord[i].y;
                    x2 = path_coord[i+1].x;
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
        return new_path_coord;
    }

    function drawCardinalSpline(points, lineTension, avoidSharpTurn, angleThreshold) {
      var c = lineTension || 0;
      var avoidSharpTurn = avoidSharpTurn !== false;
      var angleThreshold = angleThreshold || 0.02;

      // helper functions
      var vecDot = function(v0, v1) { return v0.x*v1.x+v0.y*v1.y };
      var vecMag = function(v) { return Math.sqrt(v.x*v.x + v.y*v.y) };
      var l2Dist = function(p1, p2) {
        return Math.sqrt((p1.x-p2.x)*(p1.x-p2.x)+(p1.y-p2.y)*(p1.y-p2.y));
      };

      // get the path without self loops
      var path_list = [points[0]];
      for(var i = 1; i < points.length; i ++) {
        if(l2Dist(points[i], path_list[path_list.length-1]) > 1e-6) {
          path_list.push(points[i]);
        }
      }

      // repeat first and last node
      var points = [path_list[0]];
      points = points.concat(path_list);
      points.push(path_list[path_list.length-1]);

      // a segment is a list of three points: [c0, c1, p1],
      // representing the coordinates in "C x0,y0,x1,y1,x,y" in svg:path
      var segments = []; // control points
      for(var i = 1; i < points.length-2; i ++) {
        // generate svg:path
        var m_0_x = (1-c)*(points[i+1].x - points[i-1].x)/2;
        var m_0_y = (1-c)*(points[i+1].y - points[i-1].y)/2;

        var m_1_x = (1-c)*(points[i+2].x - points[i].x)/2;
        var m_1_y = (1-c)*(points[i+2].y - points[i].y)/2;

        var p0 = points[i];
        var p1 = points[i+1];
        var c0 = p0;
        if(i !== 1) {
          c0 = {x: p0.x+(m_0_x/3), y:p0.y+(m_0_y/3)};
        }
        var c1 = p1;
        if(i !== points.length-3) {
          c1 = {x: p1.x-(m_1_x/3), y:p1.y-(m_1_y/3)};
        }

        // detect special case by calculating the angle
        if(avoidSharpTurn) {
          var v0 = {x:points[i-1].x - points[i].x, y:points[i-1].y - points[i].y};
          var v1 = {x:points[i+1].x - points[i].x, y:points[i+1].y - points[i].y};
          var acosValue = vecDot(v0,v1) / (vecMag(v0)*vecMag(v1));
          acosValue = Math.max(-1, Math.min(1, acosValue));
          var angle = Math.acos( acosValue );

          if(angle <= angleThreshold ){
            var m_x = (1-c)*(points[i].x - points[i-1].x)/2;
            var m_y = (1-c)*(points[i].y - points[i-1].y)/2;
            var k = 2;

            var cp1 = {x: p0.x+k*(-m_y/3), y:p0.y+k*(m_x/3)};
            var cp2 = {x: p0.x-k*(-m_y/3), y:p0.y-k*(m_x/3)};
            // CP_1CP_2
            var vCP = {x: cp1.x-cp2.x, y:cp1.y-cp2.y}; // vector cp1->cp2
            var vPN = {x: points[i-2].x - points[i+2].x, y:points[i-2].y-points[i+2].y} // vector Previous->Next
            if(vecDot(vCP, vPN) > 0) {
              c0 = cp1;
              segments[segments.length-1][1] = cp2;
            } else {
              c0 = cp2;
              segments[segments.length-1][1] = cp1;
            }
          }
        }

        segments.push([c0,c1,p1]);
      }

      var path_d = "M"+points[0].x+","+points[0].y;
      for(var i = 0; i < segments.length; i ++) {
        var s = segments[i];
        path_d += "C"+s[0].x+","+s[0].y;
        path_d += ","+s[1].x+","+s[1].y;
        path_d += ","+s[2].x+","+s[2].y;
      }
      return path_d;
    }

    function drawDedicatedLoops(points, lineTension, avoidSharpTurn, angleThreshold) {
      // helper functions
      var vecDot = function(v0, v1) { return v0.x*v1.x+v0.y*v1.y };
      var vecMag = function(v) { return Math.sqrt(v.x*v.x + v.y*v.y) };
      var l2Dist = function(p1, p2) {
        return Math.sqrt((p1.x-p2.x)*(p1.x-p2.x)+(p1.y-p2.y)*(p1.y-p2.y));
      };

      // get loops as segments
      var p1 = 0, p2 = 1;
      var seg_list = []; // (start, end)
      while(p1 < points.length-1 && p2 < points.length) {
        if(l2Dist(points[p1], points[p2]) < 1e-6) {
          var repeated = points[p2];
          while(p2 < points.length && l2Dist(points[p2], repeated) < 1e-6) p2++;
          seg_list.push({'start': Math.max(0, p1-1), 'end': Math.min(points.length-1, p2)});
          p1 = p2;
          p2 = p1+1;
        } else {
          p1++;
          p2++;
        }
      }

      var loopCurves = "";
      for(var i = 0; i < seg_list.length; i ++) {
        var segment = seg_list[i];
        var loopCount = segment.end - segment.start - 2;
        var anchorPoint = points[segment.start+1];

        var vec_pre_next = {
          x: points[segment.end].x-points[segment.start].x,
          y: points[segment.end].y-points[segment.start].y
        };
        var vec_pre_next_perp = {
          x: -vec_pre_next.y / vecMag(vec_pre_next),
          y: vec_pre_next.x / vecMag(vec_pre_next)
        };

        var insertP;
        for(var j = 0; j < loopCount; j ++) {

          // change the location of inserted virtual point every time this loop appears
          var control_k = 35+5*j;
          var insertP1 = {
            x: anchorPoint.x+vec_pre_next_perp.x*control_k,
            y: anchorPoint.y+vec_pre_next_perp.y*control_k
          };
          var insertP2 = {
            x: anchorPoint.x-vec_pre_next_perp.x*control_k,
            y: anchorPoint.y-vec_pre_next_perp.y*control_k
          };
          var vec_i_to_next = {
            x: points[segment.end].x - anchorPoint.x,
            y: points[segment.end].y - anchorPoint.y
          };
          var vec_i_to_insert = {
            x: insertP1.x - anchorPoint.x,
            y: insertP1.y - anchorPoint.y
          };
          insertP = insertP1;
          if(vecDot(vec_i_to_insert, vec_i_to_next) > 0) {
            insertP = insertP2;
          }

          // change the sharp turn parameter every time this loop appears
          var sharpTurnK = 2+j;

          loopCurves += drawCardinalSpline([anchorPoint, insertP, anchorPoint], lineTension, avoidSharpTurn, angleThreshold, sharpTurnK);
        }
      }
      return loopCurves;
    }

    // convert original path data into <d>
    function genPath(originalPoints, old, drawOverallPath, drawLoops, lineTension, avoidSharpTurn, angleThreshold) {
      // get coordinates
      var path_coord = getNodePositions(originalPoints, old);
      if(path_coord.length < 2) return "";

      var result = "";
      // process the points and treat them differently:
      // 1. sub-path without self loop
      if(drawOverallPath) {
        result += drawCardinalSpline(path_coord, lineTension, avoidSharpTurn, angleThreshold);
      }

      // 2. a list of loop segments
      if(drawLoops) {
        result += drawDedicatedLoops(path_coord, lineTension, avoidSharpTurn, angleThreshold);
      }

      return result;
    }

    // draw the spline for paths
    function drawSpline(paths) {
        if(paths === null) {
            _savedPositions = _behavior.parent().layoutEngine().savePositions();
            return;
        }

        paths = paths.filter(pathIsPresent);
        var hoverpaths = _hoverpaths || [],
            selected = _selected || [];

        // edge spline
        var edge = _layer.selectAll(".spline-edge").data(paths, function(path) { return path_keys(path).join(','); });
        edge.exit().remove();
        var edgeEnter = edge.enter().append("svg:path")
            .attr('class', 'spline-edge')
            .attr('id', function(d, i) { return "spline-path-"+i; })
            .attr('stroke-width', pathprops.edgeStrokeWidth || 1)
            .attr('fill', 'none')
            .attr('d', function(d) { return genPath(d, true, true, false, pathprops.lineTension, _behavior.avoidSharpTurns()); });
        edge
            .attr('stroke', function(p) {
                return selected.indexOf(p) !== -1 && selectprops.edgeStroke ||
                    hoverpaths.indexOf(p) !== -1 && hoverprops.edgeStroke ||
                    pathprops.edgeStroke || 'black';
            })
            .attr('opacity', function(p) {
                return selected.indexOf(p) !== -1 && selectprops.edgeOpacity ||
                    hoverpaths.indexOf(p) !== -1 && hoverprops.edgeOpacity ||
                    pathprops.edgeOpacity || 1;
            });
        function path_order(p) {
            return hoverpaths.indexOf(p) !== -1 ? 2 :
                selected.indexOf(p) !== -1 ? 1 :
                0;
        }
        edge.sort(function(a, b) {
            return path_order(a) - path_order(b);
        });
        _layer.selectAll('.spline-edge-hover')
            .each(function() {this.parentNode.appendChild(this);});
        edge.transition().duration(_behavior.parent().transitionDuration())
            .attr('d', function(d) { return genPath(d, false, true, false, pathprops.lineTension, _behavior.avoidSharpTurns()); });

       // self loops
        var loops = _layer.selectAll(".spline-loop").data(paths, function(path) { return path_keys(path, false).join(','); });
        loops.exit().remove();
        var edgeEnter = edge.enter().append("svg:path")
            .attr('class', 'spline-loop')
            .attr('id', function(d, i) { return "spline-loop-"+i; })
            .attr('stroke-width', pathprops.edgeStrokeWidth || 1)
            .attr('fill', 'none')
            .attr('d', function(d) { return genPath(d, true, false, true, pathprops.lineTension, _behavior.avoidSharpTurns()); });
       loops
            .attr('stroke', function(p) {
                return pathprops.edgeStroke || 'black';
            })
            .attr('opacity', function(p) {
                return pathprops.edgeOpacity || 1;
            });
        loops.transition().duration(_behavior.parent().transitionDuration())
            .attr('d', function(d) { return genPath(d, false, false, true, pathprops.lineTension, _behavior.avoidSharpTurns()); });


        // another wider copy of the edge just for hover events
        var edgeHover = _layer.selectAll('.spline-edge-hover')
            .data(paths, function(path) { return path_keys(path).join(','); });
        edgeHover.exit().remove();
        var edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'spline-edge-hover')
            .attr('d', function(d) { return genPath(d, true, true, false, pathprops.lineTension, _behavior.avoidSharpTurns()); })
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', (pathprops.edgeStrokeWidth || 1) + 4)
            .attr('fill', 'none')
            .on('mouseover', function(d) {
                highlight_paths_group.hover_changed([d]);
             })
            .on('mouseout', function(d) {
                highlight_paths_group.hover_changed(null);
             })
            .on('click', function(d) {
                var selected = _selected && _selected.slice(0) || [],
                    i = selected.indexOf(d);
                if(i !== -1)
                    selected.splice(i, 1);
                else if(d3.event.shiftKey)
                    selected.push(d);
                else
                    selected = [d];
                highlight_paths_group.select_changed(selected);
             });
        edgeHover.transition().duration(_behavior.parent().transitionDuration())
            .attr('d', function(d) { return genPath(d, false, true, false, pathprops.lineTension, _behavior.avoidSharpTurns()); });
    };

    function add_behavior(diagram, node, edge, ehover) {
        _layer = _behavior.parent().select('g.draw').selectAll('g.spline-layer').data([0]);
        _layer.enter().append('g').attr('class', 'spline-layer');

        drawSpline(_paths);
    }

    function remove_behavior(diagram, node, edge, ehover) {
    }

    var _behavior = dc_graph.behavior('draw-spline-paths', {
        laterDraw: true,
        add_behavior: add_behavior,
        remove_behavior: function(diagram, node, edge, ehover) {
            remove_behavior(diagram, node, edge, ehover);
            return this;
        },
        parent: function(p) {
            if(p)
                _anchor = p.anchorName();
            highlight_paths_group
                .on('paths_changed.draw-spline-paths-' + _anchor, p ? paths_changed : null)
                .on('select_changed.draw-spline-paths-' + _anchor, p ? select_changed : null)
                .on('hover_changed.draw-spline-paths-' + _anchor, p ? function(hpaths) {
                    _hoverpaths = hpaths;
                    drawSpline(_paths);
                } : null);
        }
    });
    _behavior.selectedStrength = property(1);
    _behavior.avoidSharpTurns = property(true);

    return _behavior;
};
