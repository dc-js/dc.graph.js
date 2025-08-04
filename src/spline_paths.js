import { event } from 'd3-selection';
import { deprecateFunction, property } from './core.js';
import { registerHighlightPathsGroup } from './highlight_paths_group.js';
import { mode } from './mode.js';
import { uniq } from './utils.js';

export function splinePaths(pathreader, pathprops, hoverprops, selectprops, pathsgroup) {
    const highlight_paths_group = registerHighlightPathsGroup(
        pathsgroup || 'highlight-paths-group',
    );
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    let _paths = null, _hoverpaths = null, _selected = null;
    let _anchor;
    let _layer = null;
    let _savedPositions = null;

    function paths_changed(nop, eop, paths) {
        _paths = paths;

        const engine = _mode.parent().layoutEngine(),
            localPaths = paths.filter(pathIsPresent);
        if (localPaths.length) {
            const nidpaths = localPaths.map(lpath => {
                let strength = pathreader.pathStrength.eval(lpath);
                if (typeof strength !== 'number')
                    strength = 1;
                if (_selected && _selected.indexOf(lpath) !== -1)
                    strength *= _mode.selectedStrength();
                return {
                    nodes: path_keys(lpath),
                    strength,
                };
            });
            engine.paths(nidpaths);
        } else {
            engine.paths(null);
            if (_savedPositions)
                engine.restorePositions(_savedPositions);
        }
        if (_selected)
            _selected = _selected.filter(p => localPaths.indexOf(p) !== -1);
        _mode.parent().redraw();
    }

    function select_changed(sp) {
        if (sp !== _selected) {
            _selected = sp;
            paths_changed(null, null, _paths);
        }
    }

    function path_keys(path, unique) {
        unique = unique !== false;
        const keys = pathreader.elementList.eval(path).filter(elem =>
            pathreader.elementType.eval(elem) === 'node'
        ).map(elem => pathreader.nodeKey.eval(elem));
        return unique ? uniq(keys) : keys;
    }

    // check if entire path is present in this view
    function pathIsPresent(path) {
        return pathreader.elementList.eval(path).every(element =>
            pathreader.elementType.eval(element) !== 'node'
            || _mode.parent().getWholeNode(pathreader.nodeKey.eval(element))
        );
    }

    // get the positions of nodes on path
    function getNodePositions(path, old) {
        return path_keys(path, false).map(key => {
            const node = _mode.parent().getWholeNode(key);
            return {
                x: old && node.prevX !== undefined ? node.prevX : node.cola.x,
                y: old && node.prevY !== undefined ? node.prevY : node.cola.y,
            };
        });
    }

    // insert fake nodes to avoid sharp turns
    function _insertDummyNodes(path_coord) {
        function _distance(node1, node2) {
            return Math.sqrt((node1.x-node2.x) ** 2+(node1.y-node2.y) ** 2);
        }

        const new_path_coord = [];

        for (let i = 0; i < path_coord.length; i++) {
            if (i-1 >= 0 && i+1 < path_coord.length) {
                if (
                    path_coord[i-1].x === path_coord[i+1].x
                    && path_coord[i-1].y === path_coord[i+1].y
                ) {
                    // insert node when the previous and next nodes are the same
                    const x1 = path_coord[i-1].x, y1 = path_coord[i-1].y;
                    const x2 = path_coord[i].x, y2 = path_coord[i].y;
                    const dx = x1-x2, dy = y1-y2;

                    const v1 = dy/Math.sqrt(dx*dx+dy*dy);
                    const v2 = -dx/Math.sqrt(dx*dx+dy*dy);

                    const insert_p1 = {'x': null, 'y': null};
                    const insert_p2 = {'x': null, 'y': null};

                    const offset = 10;

                    insert_p1.x = (x1+x2)/2.0+offset*v1;
                    insert_p1.y = (y1+y2)/2.0+offset*v2;

                    insert_p2.x = (x1+x2)/2.0-offset*v1;
                    insert_p2.y = (y1+y2)/2.0-offset*v2;

                    new_path_coord.push(insert_p1);
                    new_path_coord.push(path_coord[i]);
                    new_path_coord.push(insert_p2);
                } else if (
                    _distance(path_coord[i-1], path_coord[i+1]) < pathprops.nearNodesDistance
                ) {
                    // insert node when the previous and next nodes are very close
                    // first node
                    let x1 = path_coord[i-1].x, y1 = path_coord[i-1].y;
                    let x2 = path_coord[i].x, y2 = path_coord[i].y;
                    let dx = x1-x2, dy = y1-y2;

                    let v1 = dy/Math.sqrt(dx*dx+dy*dy);
                    let v2 = -dx/Math.sqrt(dx*dx+dy*dy);

                    const insert_p1 = {'x': null, 'y': null};

                    const offset = 10;

                    insert_p1.x = (x1+x2)/2.0+offset*v1;
                    insert_p1.y = (y1+y2)/2.0+offset*v2;

                    // second node
                    x1 = path_coord[i].x;
                    y1 = path_coord[i].y;
                    x2 = path_coord[i+1].x;
                    y2 = path_coord[i+1].y;
                    dx = x1-x2;
                    dy = y1-y2;

                    v1 = dy/Math.sqrt(dx*dx+dy*dy);
                    v2 = -dx/Math.sqrt(dx*dx+dy*dy);

                    const insert_p2 = {'x': null, 'y': null};

                    insert_p2.x = (x1+x2)/2.0+offset*v1;
                    insert_p2.y = (y1+y2)/2.0+offset*v2;

                    new_path_coord.push(insert_p1);
                    new_path_coord.push(path_coord[i]);
                    new_path_coord.push(insert_p2);
                } else {
                    new_path_coord.push(path_coord[i]);
                }
            } else {
                new_path_coord.push(path_coord[i]);
            }
        }
        return new_path_coord;
    }

    // helper functions
    const vecDot = function(v0, v1) {
        return v0.x*v1.x+v0.y*v1.y;
    };
    const vecMag = function(v) {
        return Math.sqrt(v.x*v.x+v.y*v.y);
    };
    const l2Dist = function(p1, p2) {
        return Math.sqrt((p1.x-p2.x)*(p1.x-p2.x)+(p1.y-p2.y)*(p1.y-p2.y));
    };

    function drawCardinalSpline(points, lineTension, avoidSharpTurn, angleThreshold) {
        const c = lineTension || 0;
        avoidSharpTurn = avoidSharpTurn !== false;
        angleThreshold = angleThreshold || 0.02;

        // get the path without self loops
        const path_list = [points[0]];
        for (let i = 1; i < points.length; i++) {
            if (l2Dist(points[i], path_list[path_list.length-1]) > 1e-6) {
                path_list.push(points[i]);
            }
        }

        // repeat first and last node
        points = [path_list[0]];
        points = points.concat(path_list);
        points.push(path_list[path_list.length-1]);

        // a segment is a list of three points: [c0, c1, p1],
        // representing the coordinates in "C x0,y0,x1,y1,x,y" in svg:path
        const segments = []; // control points
        for (let i = 1; i < points.length-2; i++) {
            // generate svg:path
            const m_0_x = (1-c)*(points[i+1].x-points[i-1].x)/2;
            const m_0_y = (1-c)*(points[i+1].y-points[i-1].y)/2;

            const m_1_x = (1-c)*(points[i+2].x-points[i].x)/2;
            const m_1_y = (1-c)*(points[i+2].y-points[i].y)/2;

            const p0 = points[i];
            const p1 = points[i+1];
            let c0 = p0;
            if (i !== 1) {
                c0 = {x: p0.x+(m_0_x/3), y: p0.y+(m_0_y/3)};
            }
            let c1 = p1;
            if (i !== points.length-3) {
                c1 = {x: p1.x-(m_1_x/3), y: p1.y-(m_1_y/3)};
            }

            // detect special case by calculating the angle
            if (avoidSharpTurn) {
                const v0 = {x: points[i-1].x-points[i].x, y: points[i-1].y-points[i].y};
                const v1 = {x: points[i+1].x-points[i].x, y: points[i+1].y-points[i].y};
                let acosValue = vecDot(v0, v1)/(vecMag(v0)*vecMag(v1));
                acosValue = Math.max(-1, Math.min(1, acosValue));
                const angle = Math.acos(acosValue);

                if (angle <= angleThreshold) {
                    const m_x = (1-c)*(points[i].x-points[i-1].x)/2;
                    const m_y = (1-c)*(points[i].y-points[i-1].y)/2;
                    const k = 2;

                    const cp1 = {x: p0.x+k*(-m_y/3), y: p0.y+k*(m_x/3)};
                    const cp2 = {x: p0.x-k*(-m_y/3), y: p0.y-k*(m_x/3)};
                    // CP_1CP_2
                    const vCP = {x: cp1.x-cp2.x, y: cp1.y-cp2.y}; // vector cp1->cp2
                    const vPN = {x: points[i-2].x-points[i+2].x, y: points[i-2].y-points[i+2].y}; // vector Previous->Next
                    if (vecDot(vCP, vPN) > 0) {
                        c0 = cp1;
                        segments[segments.length-1][1] = cp2;
                    } else {
                        c0 = cp2;
                        segments[segments.length-1][1] = cp1;
                    }
                }
            }

            segments.push([c0, c1, p1]);
        }

        let path_d = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < segments.length; i++) {
            const s = segments[i];
            path_d += `C${s[0].x},${s[0].y}`;
            path_d += `,${s[1].x},${s[1].y}`;
            path_d += `,${s[2].x},${s[2].y}`;
        }
        return path_d;
    }

    function drawDedicatedLoops(points, _lineTension, _avoidSharpTurn, _angleThreshold) {
        // get loops as segments
        let p1 = 0, p2 = 1;
        const seg_list = []; // (start, end)
        while (p1 < points.length-1 && p2 < points.length) {
            if (l2Dist(points[p1], points[p2]) < 1e-6) {
                const repeated = points[p2];
                while (p2 < points.length && l2Dist(points[p2], repeated) < 1e-6) p2++;
                seg_list.push({'start': Math.max(0, p1-1), 'end': Math.min(points.length-1, p2)});
                p1 = p2;
                p2 = p1+1;
            } else {
                p1++;
                p2++;
            }
        }

        let loopCurves = '';
        for (let i = 0; i < seg_list.length; i++) {
            const segment = seg_list[i];
            const loopCount = segment.end-segment.start-2;
            const anchorPoint = points[segment.start+1];

            // the vector from previous node to next node
            let vec_pre_next = {
                x: points[segment.end].x-points[segment.start].x,
                y: points[segment.end].y-points[segment.start].y,
            };

            // when previous node and next node are the same node, we need to handle
            // them differently.
            // e.g. for a loop segment A->B->B->A, we use the perpendicular vector perp_AB
            // instead of vector AA(which is vec_pre_next in this case).
            if (vecMag(vec_pre_next) == 0) {
                vec_pre_next = {
                    x: -(points[segment.end].y-anchorPoint.y),
                    y: points[segment.end].x-anchorPoint.x,
                };
            }

            // unit length vector
            const vec_pre_next_unit = {
                x: vec_pre_next.x/vecMag(vec_pre_next),
                y: vec_pre_next.y/vecMag(vec_pre_next),
            };
            const vec_pre_next_perp = {
                x: -vec_pre_next.y/vecMag(vec_pre_next),
                y: vec_pre_next.x/vecMag(vec_pre_next),
            };

            let insertP;
            for (let j = 0; j < loopCount; j++) {
                // change the control points every time this loop appears
                const cp_k = 15+2*j;

                // calculate c1 and c4, their tangent match the tangent at anchorPoint
                const c1 = {
                    x: anchorPoint.x+cp_k*vec_pre_next_unit.x,
                    y: anchorPoint.y+cp_k*vec_pre_next_unit.y,
                };

                const c4 = {
                    x: anchorPoint.x-cp_k*vec_pre_next_unit.x,
                    y: anchorPoint.y-cp_k*vec_pre_next_unit.y,
                };

                // change the location of inserted virtual point every time this loop appears
                const control_k = 25+5*j;
                const insertP1 = {
                    x: anchorPoint.x+vec_pre_next_perp.x*control_k,
                    y: anchorPoint.y+vec_pre_next_perp.y*control_k,
                };
                const insertP2 = {
                    x: anchorPoint.x-vec_pre_next_perp.x*control_k,
                    y: anchorPoint.y-vec_pre_next_perp.y*control_k,
                };
                const vec_i_to_next = {
                    x: points[segment.end].x-anchorPoint.x,
                    y: points[segment.end].y-anchorPoint.y,
                };
                const vec_i_to_insert = {
                    x: insertP1.x-anchorPoint.x,
                    y: insertP1.y-anchorPoint.y,
                };
                insertP = insertP1;
                if (vecDot(vec_i_to_insert, vec_i_to_next) > 0) {
                    insertP = insertP2;
                }

                // calculate c2 and c3 based on insertP
                const c2 = {
                    x: insertP.x+cp_k*vec_pre_next_unit.x,
                    y: insertP.y+cp_k*vec_pre_next_unit.y,
                };

                const c3 = {
                    x: insertP.x-cp_k*vec_pre_next_unit.x,
                    y: insertP.y-cp_k*vec_pre_next_unit.y,
                };

                let curve = `M${anchorPoint.x},${anchorPoint.y}`;
                curve += `C${c1.x},${c1.y},${c2.x},${c2.y},${insertP.x},${insertP.y}`;
                curve += `C${c3.x},${c3.y},${c4.x},${c4.y},${anchorPoint.x},${anchorPoint.y}`;

                loopCurves += curve;
            }
        }
        return loopCurves;
    }

    // convert original path data into <d>
    function genPath(originalPoints, old, lineTension, avoidSharpTurn, angleThreshold) {
        // get coordinates
        const path_coord = getNodePositions(originalPoints, old);
        if (path_coord.length < 2) return '';

        let result = '';
        // process the points and treat them differently:
        // 1. sub-path without self loop
        result += drawCardinalSpline(path_coord, lineTension, avoidSharpTurn, angleThreshold);

        // 2. a list of loop segments
        result += drawDedicatedLoops(path_coord, lineTension, avoidSharpTurn, angleThreshold);

        return result;
    }

    // draw the spline for paths
    function drawSpline(paths) {
        if (paths === null) {
            _savedPositions = _mode.parent().layoutEngine().savePositions();
            return;
        }

        paths = paths.filter(pathIsPresent);
        const hoverpaths = _hoverpaths || [],
            selected = _selected || [];

        // edge spline
        let edge = _layer.selectAll('.spline-edge').data(paths, path => path_keys(path).join(','));
        edge.exit().remove();
        const edgeEnter = edge.enter().append('svg:path')
            .attr('class', 'spline-edge')
            .attr('id', (d, i) => `spline-path-${i}`)
            .attr('stroke-width', pathprops.edgeStrokeWidth || 1)
            .attr('fill', 'none')
            .attr('d', d => genPath(d, true, pathprops.lineTension, _mode.avoidSharpTurns()));
        edge = edge.merge(edgeEnter);
        edge
            .attr('stroke', p =>
                selected.indexOf(p) !== -1 && selectprops.edgeStroke
                || hoverpaths.indexOf(p) !== -1 && hoverprops.edgeStroke
                || pathprops.edgeStroke || 'black')
            .attr('opacity', p =>
                selected.indexOf(p) !== -1 && selectprops.edgeOpacity
                || hoverpaths.indexOf(p) !== -1 && hoverprops.edgeOpacity
                || pathprops.edgeOpacity || 1);
        function path_order(p) {
            return hoverpaths.indexOf(p) !== -1
                ? 2
                : selected.indexOf(p) !== -1
                ? 1
                : 0;
        }
        edge.sort((a, b) => path_order(a)-path_order(b));
        _layer.selectAll('.spline-edge-hover')
            .each(function() {
                this.parentNode.appendChild(this);
            });
        edge.transition().duration(_mode.parent().transitionDuration())
            .attr('d', d => genPath(d, false, pathprops.lineTension, _mode.avoidSharpTurns()));

        // another wider copy of the edge just for hover events
        let edgeHover = _layer.selectAll('.spline-edge-hover')
            .data(paths, path => path_keys(path).join(','));
        edgeHover.exit().remove();
        const edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'spline-edge-hover')
            .attr('d', d => genPath(d, true, pathprops.lineTension, _mode.avoidSharpTurns()))
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', (pathprops.edgeStrokeWidth || 1)+4)
            .attr('fill', 'none')
            .on('mouseover.spline-paths', d => {
                highlight_paths_group.hover_changed([d]);
            })
            .on('mouseout.spline-paths', _d => {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.spline-paths', d => {
                let selected = _selected && _selected.slice(0) || [];
                const i = selected.indexOf(d);
                if (i !== -1)
                    selected.splice(i, 1);
                else if (event.shiftKey)
                    selected.push(d);
                else
                    selected = [d];
                highlight_paths_group.select_changed(selected);
            });
        edgeHover = edgeHover.merge(edgeHoverEnter);
        edgeHover.transition().duration(_mode.parent().transitionDuration())
            .attr('d', d => genPath(d, false, pathprops.lineTension, _mode.avoidSharpTurns()));
    }

    function draw(_diagram, _node, _edge, _ehover) {
        _layer = _mode.parent().select('g.draw').selectAll('g.spline-layer').data([0]);
        _layer.enter().append('g').attr('class', 'spline-layer');

        drawSpline(_paths);
    }

    function remove(_diagram, _node, _edge, _ehover) {
    }

    const _mode = mode('draw-spline-paths', {
        laterDraw: true,
        draw,
        remove(diagram, node, edge, ehover) {
            remove(diagram, node, edge, ehover);
            return this;
        },
        parent(p) {
            if (p)
                _anchor = p.anchorName();
            highlight_paths_group
                .on(`paths_changed.draw-spline-paths-${_anchor}`, p ? paths_changed : null)
                .on(`select_changed.draw-spline-paths-${_anchor}`, p ? select_changed : null)
                .on(
                    `hover_changed.draw-spline-paths-${_anchor}`,
                    p
                        ? hpaths => {
                            _hoverpaths = hpaths;
                            drawSpline(_paths);
                        }
                        : null,
                );
        },
    });
    _mode.selectedStrength = property(1);
    _mode.avoidSharpTurns = property(true);

    return _mode;
}

export const drawSplinePaths = deprecateFunction(
    'draw_spline_paths has been renamed spline_paths, please update',
    splinePaths,
);
