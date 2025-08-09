/**
 * Layout orchestration and management for diagram
 * @module diagram/layout
 */

import { ascending, sum } from 'd3-array';
import { set } from 'd3-collection';
import { zoomTransform } from 'd3-zoom';
import { builtinArrows, clipPathToArrows, scaledArrowLengths } from '../arrows.js';
import { colaLayout } from '../cola_layout.js';
import {
    getOriginal,
    identity,
    onetimeTrace,
    property,
    traceFunction,
} from '../core.js';
import { dagreLayout } from '../dagre_layout.js';
import { wheelEdges } from '../generate.js';
import { regenerateObjects } from '../generate_objects.js';
import { portName, projectPort, splitPortName } from '../place_ports.js';
import { angleBetweenPoints, drawEdgeToShapes } from '../shape.js';
import { param } from '../utils.js';
import { webworkerLayout } from '../webworker_layout.js';

export function applyLayout(diagram) {
    const _internal = diagram._internal;
    const _dispatch = _internal.dispatch;

    let _needsRedraw = false;

    // Helper function to check if edge has both source and target
    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    // Layout engine initialization
    async function initLayout(engine) {
        if (!diagram.layoutEngine())
            diagram.layoutAlgorithm('cola', true);
        await (engine || diagram.layoutEngine()).init({
            objects: objects(),
            data: graphData(),
            selectById,
            doRedraw,
            watcher,
        });

        function objects() {
            const ret = {
                nodeParent: diagram.nodeParent(),
                edgeParent: diagram.edgeParent(),
                nodeIdTag: diagram.nodeIdTag(),
                edgeIdTag: diagram.edgeIdTag(),
                nodeTag: diagram.nodeTag(),
                edgeTag: diagram.edgeTag(),
                content: diagram.content.enum().map(name => diagram.content(name)),
                shape: diagram.shape.enum().map(name => diagram.shape(name)),
                nodeStyle: diagram.nodeStyle.enum().map(name => diagram.nodeStyle(name)),
            };

            const portSelector = diagram.selectPorts();
            ret.portId = portSelector && portSelector.id;
            ret.portTag = portSelector && portSelector.tag;
            ret.portParent = portSelector && portSelector.parent;
            ret.portStyle = portSelector && portSelector.style
                && portSelector.style.enum().map(portSelector.style);
            return ret;
        }

        function graphData() {
            return {
                nodes: _internal.getNodesSnapshot(),
                edges: _internal.getEdgesSnapshot(),
            };
        }

        function watcher(type) {
            switch (type) {
                case 'start':
                    return _internal.setStats({nnodes: 0, nedges: 0});
                default:
                    return function() {};
            }
        }

        function selectById(type) {
            switch (type) {
                case 'port':
                    return diagram.selectPorts() && diagram.selectPorts().idSelect;
                default:
                    return function() {};
            }
        }

        function doRedraw() {
            if (_internal.isRunning())
                _needsRedraw = true;
            else
                diagram.redraw();
        }
    }

    // Core layout startup function
    diagram.startLayout = async function() {
        let nodes = diagram.nodeGroup().all();
        let edges = diagram.edgeGroup().all();
        let ports = diagram.portGroup() ? diagram.portGroup().all() : [];
        const clusters = diagram.clusterGroup() ? diagram.clusterGroup().all() : [];
        if (_internal.isRunning()) {
            throw new Error('diagram.redraw already running!');
        }
        _internal.setRunning(true);

        if (diagram.width_is_automatic() || diagram.height_is_automatic())
            detect_size_change();
        else
            diagram.resize();

        if (diagram.initLayoutOnRedraw())
            await initLayout();
        diagram.layoutEngine().stop();
        _dispatch.call('preDraw');

        // ordering shouldn't matter, but we support ordering in case it does
        if (diagram.nodeOrdering()) {
            nodes = nodes.slice(0).sort((a, b) =>
                ascending(diagram.nodeOrdering()(a), diagram.nodeOrdering()(b))
            );
        }
        if (diagram.edgeOrdering()) {
            edges = edges.slice(0).sort((a, b) =>
                ascending(diagram.edgeOrdering()(a), diagram.edgeOrdering()(b))
            );
        }

        let wnodes = regenerateObjects(
            _internal.nodes(),
            nodes,
            null,
            v => diagram.nodeKey()(v),
            (v1, v) => {
                v1.orig = v;
                v1.cola = v1.cola || {};
                v1.cola.dcg_nodeKey = diagram.nodeKey.eval(v1);
                v1.cola.dcg_nodeParentCluster = diagram.nodeParentCluster.eval(v1);
                diagram.layoutEngine().populateLayoutNode(v1.cola, v1);
            },
        );
        let wedges = regenerateObjects(
            _internal.edges(),
            edges,
            null,
            e => diagram.edgeKey()(e),
            (e1, e) => {
                e1.orig = e;
                e1.cola = e1.cola || {};
                e1.cola.dcg_edgeKey = diagram.edgeKey.eval(e1);
                e1.cola.dcg_edgeSource = diagram.edgeSource.eval(e1);
                e1.cola.dcg_edgeTarget = diagram.edgeTarget.eval(e1);
                e1.source = _internal.nodes()[e1.cola.dcg_edgeSource];
                e1.target = _internal.nodes()[e1.cola.dcg_edgeTarget];
                e1.sourcePort = e1.sourcePort || {};
                e1.targetPort = e1.targetPort || {};
                diagram.layoutEngine().populateLayoutEdge(e1.cola, e1);
            },
        );

        // remove edges that don't have both end nodes
        wedges = wedges.filter(has_source_and_target);

        // remove self-edges (since we can't draw them - will be option later)
        wedges = wedges.filter(e => e.source !== e.target);

        wedges = wedges.filter(diagram.edgeIsShown.eval);

        // now we know which ports should exist
        let needports = wedges.map(e => {
            if (diagram.edgeSourcePortName.eval(e))
                return portName(
                    diagram.edgeSource.eval(e),
                    null,
                    diagram.edgeSourcePortName.eval(e),
                );
            else return portName(null, diagram.edgeKey.eval(e), 'source');
        });
        needports = needports.concat(wedges.map(e => {
            if (diagram.edgeTargetPortName.eval(e))
                return portName(
                    diagram.edgeTarget.eval(e),
                    null,
                    diagram.edgeTargetPortName.eval(e),
                );
            else return portName(null, diagram.edgeKey.eval(e), 'target');
        }));
        // remove any invalid ports so they don't crash in confusing ways later
        ports = ports.filter(p =>
            diagram.portNodeKey() && diagram.portNodeKey()(p)
            || diagram.portEdgeKey() && diagram.portEdgeKey()(p)
        );
        let wports = regenerateObjects(
            _internal.ports(),
            ports,
            needports,
            p => portName(
                diagram.portNodeKey() && diagram.portNodeKey()(p),
                diagram.portEdgeKey() && diagram.portEdgeKey()(p),
                diagram.portName()(p),
            ),
            (p1, p) => {
                p1.orig = p;
                if (p1.named)
                    p1.edges = [];
            },
            (k, p) => {
                console.assert(k, 'should have screened out invalid ports');
                // it's dumb to parse the id we just created. as usual, i blame the lack of metagraphs
                const parse = splitPortName(k);
                if (parse.nodeKey) {
                    p.node = _internal.nodes()[parse.nodeKey];
                    p.named = true;
                } else {
                    const e = _internal.edges()[parse.edgeKey];
                    p.node = e[parse.name];
                    p.edges = [e];
                    p.named = false;
                }
                p.name = parse.name;
            },
        );
        // remove any ports where the end-node was not found, to avoid crashing elsewhere
        wports = wports.filter(p => p.node);

        // find all edges for named ports
        wedges.forEach(e => {
            let name = diagram.edgeSourcePortName.eval(e);
            if (name)
                _internal.ports()[portName(diagram.nodeKey.eval(e.source), null, name)].edges.push(
                    e,
                );
            name = diagram.edgeTargetPortName.eval(e);
            if (name)
                _internal.ports()[portName(diagram.nodeKey.eval(e.target), null, name)].edges.push(
                    e,
                );
        });

        // optionally, delete nodes that have no edges
        if (diagram.induceNodes()) {
            const keeps = {};
            wedges.forEach(e => {
                keeps[e.cola.dcg_edgeSource] = true;
                keeps[e.cola.dcg_edgeTarget] = true;
            });
            wnodes = wnodes.filter(n => keeps[n.cola.dcg_nodeKey]);
            for (const k in _internal.nodes())
                if (!keeps[k])
                    delete _internal.nodes()[k];
        }

        const needclusters = set(
            wnodes.map(n => diagram.nodeParentCluster.eval(n)).filter(identity),
        ).values();

        const wclusters = regenerateObjects(
            _internal.clusters(),
            clusters,
            needclusters,
            c => diagram.clusterKey()(c),
            (c1, c) => { // assign
                c1.orig = c;
                c1.cola = c1.cola || {
                    dcg_clusterKey: diagram.clusterKey.eval(c1),
                    dcg_clusterParent: diagram.clusterParent.eval(c1),
                };
            },
            (_k, _c) => { // create
            },
        );

        wnodes.forEach((v, i) => {
            v.index = i;
        });

        // announce new data
        _dispatch.call(
            'data',
            null,
            diagram,
            _internal.nodes(),
            wnodes,
            _internal.edges(),
            wedges,
            _internal.ports(),
            wports,
        );
        _internal.setStats({nnodes: wnodes.length, nedges: wedges.length});

        // fixed nodes may have been affected by .data() so calculate now
        wnodes.forEach(v => {
            if (diagram.nodeFixed())
                v.cola.dcg_nodeFixed = diagram.nodeFixed.eval(v);
        });

        // annotate parallel edges so we can draw them specially
        const em = new Array(wnodes.length);
        for (let i = 0; i < wnodes.length; ++i)
            em[i] = new Array(i);
        wedges.forEach(e => {
            e.pos = e.pos || {};
            let min, max, minattr, maxattr;
            if (e.source.index < e.target.index) {
                min = e.source.index;
                max = e.target.index;
                minattr = 'edgeSourcePortName';
                maxattr = 'edgeTargetPortName';
            } else {
                max = e.source.index;
                min = e.target.index;
                maxattr = 'edgeSourcePortName';
                minattr = 'edgeTargetPortName';
            }
            const minport = diagram[minattr] ? (diagram[minattr].eval(e) || 'no port') : 'no port',
                maxport = diagram[maxattr] ? (diagram[maxattr].eval(e) || 'no port') : 'no port';
            em[max][min] = em[max][min] || {};
            em[max][min][maxport] = em[max][min][maxport] || {};
            e.parallel = em[max][min][maxport][minport] = em[max][min][maxport][minport] || {
                rev: [],
                edges: [],
            };
            e.parallel.edges.push(e);
            e.parallel.rev.push(min !== e.source.index);
        });

        const drawState = diagram.startRedraw(_dispatch, wnodes, wedges);

        // really we should have layout chaining like in the good old Dynagraph days
        // the ordering of this and the previous 4 statements is somewhat questionable
        if (diagram.initialLayout())
            diagram.initialLayout()(diagram, wnodes, wedges);

        // no layout if the topology and layout parameters haven't changed
        let skip_layout = false;
        if (!diagram.layoutUnchanged()) {
            const node_fields = diagram.nodeChangeSelect()(),
                edge_fields = diagram.edgeChangeSelect()();
            const nodes_snapshot = JSON.stringify(wnodes.map(node_fields));
            const edges_snapshot = JSON.stringify(wedges.map(edge_fields));
            if (
                nodes_snapshot === _internal.getNodesSnapshot()
                && edges_snapshot === _internal.getEdgesSnapshot()
            )
                skip_layout = true;
            _internal.setNodesSnapshot(nodes_snapshot);
            _internal.setEdgesSnapshot(edges_snapshot);
        }

        // edge lengths may be affected by node sizes
        wedges.forEach(e => {
            e.cola.dcg_edgeLength = diagram.edgeLength.eval(e);
        });

        // cola constraints always use indices, but node references
        // are more friendly, so translate those

        // i am not satisfied with this constraint generation api...
        // https://github.com/dc-js/dc.graph.js/issues/10
        let constraints = diagram.constrain()(diagram, wnodes, wedges);

        // warn if there are any loops (before changing names to indices)
        // it would be better to do this in webcola
        // (for one thing, this duplicates logic in rectangle.ts)
        // but by that time it has lost the names of things,
        // so the output would be difficult to use
        const constraints_by_left = constraints.reduce((p, c) => {
            if (c.type) {
                switch (c.type) {
                    case 'alignment': {
                        const left = c.offsets[0].node;
                        p[left] = p[left] || [];
                        c.offsets.slice(1).forEach(o => {
                            p[left].push({node: o.node, in_constraint: c});
                        });
                        break;
                    }
                }
            } else if (c.axis) {
                p[c.left] = p[c.left] || [];
                p[c.left].push({node: c.right, in_constraint: c});
            }
            return p;
        }, {});
        const touched = {};
        function find_constraint_loops(con, stack) {
            const left = con.node;
            stack = stack || [];
            const loop = stack.find(con => con.node === left);
            stack = stack.concat([con]);
            if (loop)
                console.warn('found a loop in constraints', stack);
            if (touched[left])
                return;
            touched[left] = true;
            if (!constraints_by_left[left])
                return;
            constraints_by_left[left].forEach(right => {
                find_constraint_loops(right, stack);
            });
        }
        Object.keys(constraints_by_left).forEach(left => {
            if (!touched[left])
                find_constraint_loops({node: left, in_constraint: null});
        });

        // translate references from names to indices (ugly)
        const invalid_constraints = [];
        constraints.forEach(c => {
            if (c.type) {
                switch (c.type) {
                    case 'alignment':
                        c.offsets.forEach(o => {
                            o.node = _internal.nodes()[o.node].index;
                        });
                        break;
                    case 'circle':
                        c.nodes.forEach(n => {
                            n.node = _internal.nodes()[n.node].index;
                        });
                        break;
                }
            } else if (c.axis && c.left && c.right) {
                c.left = _internal.nodes()[c.left].index;
                c.right = _internal.nodes()[c.right].index;
            } else invalid_constraints.push(c);
        });

        if (invalid_constraints.length)
            console.warn(`${invalid_constraints.length} invalid constraints`, invalid_constraints);

        // pseudo-cola.js features

        // 1. non-layout edges are drawn but not told to cola.js
        let layout_edges = wedges.filter(diagram.edgeIsLayout.eval);
        const _nonlayout_edges = wedges.filter(x => !diagram.edgeIsLayout.eval(x));

        // 2. type=circle constraints
        const circle_constraints = constraints.filter(c => c.type === 'circle');
        constraints = constraints.filter(c => c.type !== 'circle');
        circle_constraints.forEach(c => {
            const R = (c.distance || diagram.baseLength()*4)/(2*Math.sin(Math.PI/c.nodes.length));
            const nindices = c.nodes.map(x => x.node);
            const namef = function(i) {
                return diagram.nodeKey.eval(wnodes[i]);
            };
            const wheel = wheelEdges(namef, nindices, R)
                .map(e => {
                    const e1 = {internal: e};
                    e1.source = _internal.nodes()[e.sourcename];
                    e1.target = _internal.nodes()[e.targetname];
                    return e1;
                });
            layout_edges = layout_edges.concat(wheel);
        });

        // 3. ordered alignment
        const ordered_constraints = constraints.filter(c => c.type === 'ordering');
        constraints = constraints.filter(c => c.type !== 'ordering');
        ordered_constraints.forEach(c => {
            let sorted = c.nodes.map(n => _internal.nodes()[n]);
            if (c.ordering) {
                const orderingFn = param(c.ordering);
                sorted = sorted.sort((a, b) => ascending(orderingFn(a), orderingFn(b)));
            }
            let left;
            sorted.forEach((n, i) => {
                if (i === 0)
                    left = n;
                else {
                    constraints.push({
                        left: left.index,
                        right: (left = n).index,
                        axis: c.axis,
                        gap: c.gap,
                    });
                }
            });
        });
        if (skip_layout) {
            _internal.setRunning(false);
            // init_node_ports?
            diagram.draw(drawState, true);
            diagram.drawPorts(drawState);
            diagram.fireTSEvent(_dispatch, drawState);
            check_zoom(drawState);
            return this;
        }
        const startTime = Date.now();

        function populate_cola(rnodes, redges, rclusters) {
            rnodes.forEach(rn => {
                const n = _internal.nodes()[rn.dcg_nodeKey];
                if (!n) {
                    console.warn(`received node "${rn.dcg_nodeKey}" that we did not send, ignored`);
                    return;
                }
                n.cola.x = rn.x;
                n.cola.y = rn.y;
                n.cola.z = rn.z;
            });
            (redges || []).forEach(re => {
                const e = _internal.edges()[re.dcg_edgeKey];
                if (!e) {
                    console.warn(`received edge "${re.dcg_edgeKey}" that we did not send, ignored`);
                    return;
                }
                if (re.points)
                    e.cola.points = re.points;
            });
            (wclusters || []).forEach(c => {
                c.cola.bounds = null;
            });
            if (rclusters)
                rclusters.forEach(rc => {
                    const c = _internal.clusters()[rc.dcg_clusterKey];
                    if (!c) {
                        console.warn(
                            `received cluster "${rc.dcg_clusterKey}" that we did not send, ignored`,
                        );
                        return;
                    }
                    if (rc.bounds)
                        c.cola.bounds = rc.bounds;
                });
        }
        diagram.layoutEngine()
            .on('tick.diagram', (nodes, edges, clusters) => {
                const elapsed = Date.now()-startTime;
                if (!diagram.initialOnly())
                    populate_cola(nodes, edges, clusters);
                if (diagram.showLayoutSteps()) {
                    init_node_ports(_internal.nodes(), wports);
                    _dispatch.call(
                        'receivedLayout',
                        null,
                        diagram,
                        _internal.nodes(),
                        wnodes,
                        _internal.edges(),
                        wedges,
                        _internal.ports(),
                        wports,
                    );
                    propagate_port_positions(_internal.nodes(), wedges, _internal.ports());
                    diagram.draw(drawState, true);
                    diagram.drawPorts(drawState);
                    // should do this only once
                    diagram.fireTSEvent(_dispatch, drawState);
                }
                if (_needsRedraw || diagram.timeLimit() && elapsed > diagram.timeLimit()) {
                    console.log('cancelled');
                    diagram.layoutEngine().stop();
                }
            })
            .on('end.diagram', (nodes, edges, clusters) => {
                if (!diagram.showLayoutSteps()) {
                    if (!diagram.initialOnly())
                        populate_cola(nodes, edges, clusters);
                    init_node_ports(_internal.nodes(), wports);
                    _dispatch.call(
                        'receivedLayout',
                        null,
                        diagram,
                        _internal.nodes(),
                        wnodes,
                        _internal.edges(),
                        wedges,
                        _internal.ports(),
                        wports,
                    );
                    propagate_port_positions(_internal.nodes(), wedges, _internal.ports());
                    diagram.draw(drawState, true);
                    diagram.drawPorts(drawState);
                    diagram.fireTSEvent(_dispatch, drawState);
                } else diagram.layoutDone(true);
                check_zoom(drawState);
            })
            .on('start.diagram', () => {
                console.log(`algo ${diagram.layoutEngine().layoutAlgorithm()} started.`);
                _dispatch.call('start');
            });

        if (diagram.initialOnly())
            diagram.layoutEngine().dispatch().end(wnodes, wedges);
        else {
            _dispatch.call('start'); // cola doesn't seem to fire this itself?
            const engine = diagram.layoutEngine();
            engine.data(
                {width: diagram.width(), height: diagram.height()},
                wnodes.map(v => {
                    const lv = Object.assign({}, v.dcg_shape, v.cola);
                    if (engine.annotateNode)
                        engine.annotateNode(lv, v);
                    else if (engine.extractNodeAttrs)
                        Object.keys(engine.extractNodeAttrs()).forEach(key => {
                            lv[key] = engine.extractNodeAttrs()[key](v.orig);
                        });
                    return lv;
                }),
                layout_edges.map(e => {
                    const le = e.cola;
                    if (engine.annotateEdge)
                        engine.annotateEdge(le, e);
                    else if (engine.extractEdgeAttrs)
                        Object.keys(engine.extractEdgeAttrs()).forEach(key => {
                            le[key] = engine.extractEdgeAttrs()[key](e.orig);
                        });
                    return le;
                }),
                wclusters.map(c => c.cola),
                constraints,
            );
            engine.start();
        }
        return this;
    };

    // Size change detection
    function detect_size_change() {
        const oldWidth = diagram._internal.lastWidth, oldHeight = diagram._internal.lastHeight;
        const newWidth = diagram.width(), newHeight = diagram.height();
        if (oldWidth !== newWidth || oldHeight !== newHeight)
            diagram.rezoom(oldWidth, oldHeight, newWidth, newHeight);
    }

    // Layout completion handler
    diagram.layoutDone = function(happens) {
        _dispatch.call('end', null, happens);
        _internal.setRunning(false);
        if (_needsRedraw) {
            _needsRedraw = false;
            window.setTimeout(() => {
                if (!_internal.isRunning()) // someone else may already have started
                    diagram.redraw();
            }, 0);
        }
    };

    // Port positioning functions
    function norm(v) {
        const len = Math.hypot(v[0], v[1]);
        return [v[0]/len, v[1]/len];
    }

    function edge_vec(n, e) {
        let dy = e.target.cola.y-e.source.cola.y,
            dx = e.target.cola.x-e.source.cola.x;
        if (dy === 0 && dx === 0)
            return [1, 0];
        if (e.source !== n)
            dy = -dy, dx = -dx;
        if (e.parallel && e.parallel.edges.length > 1 && e.source.index > e.target.index)
            dy = -dy, dx = -dx;
        return norm([dx, dy]);
    }

    function init_node_ports(nodes, wports) {
        _internal.setNodePorts({});
        // assemble port-lists for nodes, again because we don't have a metagraph.
        wports.forEach(p => {
            const nid = diagram.nodeKey.eval(p.node);
            const np = _internal.getNodePorts()[nid] = _internal.getNodePorts()[nid] || [];
            np.push(p);
        });
        for (const nid in _internal.getNodePorts()) {
            const n = nodes[nid],
                nports = _internal.getNodePorts()[nid];
            // initial positions: use average of edge vectors, if any, or existing position
            nports.forEach(p => {
                if (diagram.portElastic.eval(p) && p.edges.length) {
                    const vecs = p.edges.map(edge_vec.bind(null, n));
                    p.vec = [
                        sum(vecs, v => v[0])/vecs.length,
                        sum(vecs, v => v[1])/vecs.length,
                    ];
                } else p.vec = p.vec || undefined;
                p.pos = null;
            });
        }
    }

    function propagate_port_positions(nodes, wedges, ports) {
        // make sure we have projected vectors to positions
        for (const nid in _internal.getNodePorts()) {
            const n = nodes[nid];
            _internal.getNodePorts()[nid].forEach(p => {
                if (!p.pos)
                    projectPort(diagram, n, p);
            });
        }

        // propagate port positions to edge endpoints
        wedges.forEach(e => {
            let name = diagram.edgeSourcePortName.eval(e);
            e.sourcePort.pos = name
                ? ports[portName(diagram.nodeKey.eval(e.source), null, name)].pos
                : ports[portName(null, diagram.edgeKey.eval(e), 'source')].pos;
            name = diagram.edgeTargetPortName.eval(e);
            e.targetPort.pos = name
                ? ports[portName(diagram.nodeKey.eval(e.target), null, name)].pos
                : ports[portName(null, diagram.edgeKey.eval(e), 'target')].pos;
            console.assert(e.sourcePort.pos && e.targetPort.pos);
        });
    }

    // Edge path calculation
    function enforce_path_direction(path, spos, tpos) {
        const points = path.points, first = points[0], last = points[points.length-1];
        switch (diagram.enforceEdgeDirection()) {
            case 'LR':
                if (spos.x >= tpos.x) {
                    const dx = first.x-last.x;
                    return {
                        points: [
                            first,
                            {x: first.x+dx, y: first.y-dx/2},
                            {x: last.x-dx, y: last.y-dx/2},
                            last,
                        ],
                        bezDegree: 3,
                        sourcePort: path.sourcePort,
                        targetPort: path.targetPort,
                    };
                }
                break;
            case 'TB':
                if (spos.y >= tpos.y) {
                    const dy = first.y-last.y;
                    return {
                        points: [
                            first,
                            {x: first.x+dy/2, y: first.y+dy},
                            {x: last.x+dy/2, y: last.y-dy},
                            last,
                        ],
                        bezDegree: 3,
                        sourcePort: path.sourcePort,
                        targetPort: path.targetPort,
                    };
                }
                break;
        }
        return path;
    }

    diagram.calcEdgePath = function(e, age, sx, sy, tx, ty) {
        let parallel = e.parallel;
        if (!parallel || !parallel.edges) {
            console.warn('Edge missing parallel annotation, creating default:', e);
            parallel = e.parallel = {edges: [e], rev: [false]};
        }
        let source = e.source, target = e.target;
        if (parallel.edges.length > 1 && e.source.index > e.target.index) {
            let t;
            t = target;
            target = source;
            source = t;
            t = tx;
            tx = sx;
            sx = t;
            t = ty;
            ty = sy;
            sy = t;
        }
        const source_padding = source.dcg_ry
                +diagram.nodeStrokeWidth.eval(source)/2,
            target_padding = target.dcg_ry
                +diagram.nodeStrokeWidth.eval(target)/2;
        for (let p = 0; p < parallel.edges.length; ++p) {
            // alternate parallel edges over, then under
            const dir = (!!(p%2) === (sx < tx)) ? -1 : 1,
                port = Math.floor((p+1)/2),
                last = port > 0 ? parallel.edges[p > 2 ? p-2 : 0].pos[age].path : null;
            let path = drawEdgeToShapes(
                diagram,
                e,
                sx,
                sy,
                tx,
                ty,
                last,
                dir,
                diagram.parallelEdgeOffset(),
                source_padding,
                target_padding,
            );
            if (parallel.edges.length > 1 && parallel.rev[p])
                path.points.reverse();
            if (diagram.enforceEdgeDirection())
                path = enforce_path_direction(path, source.cola, target.cola);
            const path0 = {
                points: path.points,
                bezDegree: path.bezDegree,
            };
            const alengths = scaledArrowLengths(diagram, parallel.edges[p]);
            path = clipPathToArrows(alengths.headLength, alengths.tailLength, path);
            const points = path.points, points0 = path0.points;
            parallel.edges[p].pos[age] = {
                path,
                full: path0,
                orienthead: `${
                    angleBetweenPoints(points[points.length-1], points0[points0.length-1])
                }rad`,
                orienttail: `${angleBetweenPoints(points[0], points0[0])}rad`,
            };
        }
    };

    // Bounds calculation functions
    function node_bounds(n) {
        let bounds = {
            left: n.cola.x-n.dcg_rx,
            top: n.cola.y-n.dcg_ry,
            right: n.cola.x+n.dcg_rx,
            bottom: n.cola.y+n.dcg_ry,
        };
        if (diagram.portStyle.enum().length) {
            const ports = _internal.getNodePorts()[diagram.nodeKey.eval(n)];
            if (ports)
                ports.forEach(p => {
                    const portStyle = diagram.portStyleName.eval(p);
                    if (!portStyle || !diagram.portStyle(portStyle))
                        return;
                    const pb = diagram.portStyle(portStyle).portBounds(p);
                    pb.left += n.cola.x;
                    pb.top += n.cola.y;
                    pb.right += n.cola.x;
                    pb.bottom += n.cola.y;
                    bounds = union_bounds(bounds, pb);
                });
        }
        return bounds;
    }

    function union_bounds(b1, b2) {
        return {
            left: Math.min(b1.left, b2.left),
            top: Math.min(b1.top, b2.top),
            right: Math.max(b1.right, b2.right),
            bottom: Math.max(b1.bottom, b2.bottom),
        };
    }

    function point_to_bounds(p) {
        return {
            left: p.x,
            top: p.y,
            right: p.x,
            bottom: p.y,
        };
    }

    function edge_bounds(e) {
        // assumption: edge must have some points
        const points = e.pos.new.path.points;
        return points.map(point_to_bounds).reduce(union_bounds);
    }

    diagram.calculateBounds = function(ndata, edata) {
        // assumption: there can be no edges without nodes
        if (!Array.isArray(ndata)) {
            console.error('calculateBounds: ndata is not an array:', ndata);
            return null;
        }
        if (!Array.isArray(edata)) {
            console.error('calculateBounds: edata is not an array:', edata);
            return null;
        }
        if (ndata.length === 0) {
            return null;
        }
        const bounds = ndata.map(node_bounds).reduce(union_bounds);
        return edata.length > 0 ? edata.map(edge_bounds).reduce(union_bounds, bounds) : bounds;
    };

    let _bounds;
    function calc_bounds(drawState) {
        if ((diagram.fitStrategy() || diagram.restrictPan())) {
            if (!drawState.node.size())
                _bounds = null;
            else {
                const nodeData = drawState.node.data();
                const edgeData = drawState.edge.data();
                console.log(
                    'calc_bounds: nodeData type:',
                    typeof nodeData,
                    'isArray:',
                    Array.isArray(nodeData),
                    'value:',
                    nodeData,
                );
                console.log(
                    'calc_bounds: edgeData type:',
                    typeof edgeData,
                    'isArray:',
                    Array.isArray(edgeData),
                    'value:',
                    edgeData,
                );
                _bounds = diagram.calculateBounds(nodeData, edgeData);
            }
        }
    }

    // Auto-zoom functionality
    function auto_zoom(animate) {
        if (diagram.fitStrategy()) {
            if (!_bounds)
                return;
            const vwidth = _bounds.right-_bounds.left,
                vheight = _bounds.bottom-_bounds.top,
                swidth = diagram.width()-diagram.margins().left-diagram.margins().right,
                sheight = diagram.height()-diagram.margins().top-diagram.margins().bottom;
            const fitS = diagram.fitStrategy();
            let translate = [0, 0], scale = 1;
            if (['default', 'vertical', 'horizontal'].indexOf(fitS) >= 0) {
                const sAR = sheight/swidth,
                    vAR = vheight/vwidth,
                    vrl = vAR < sAR, // view aspect ratio is less (wider)
                    amv = (fitS === 'default') ? !vrl : (fitS === 'vertical'); // align margins vertically
                scale = amv ? sheight/vheight : swidth/vwidth;
                scale = Math.max(
                    diagram.zoomExtent()[0],
                    Math.min(diagram.zoomExtent()[1], scale),
                );
                translate = [
                    diagram.margins().left-_bounds.left*scale+(swidth-vwidth*scale)/2,
                    diagram.margins().top-_bounds.top*scale+(sheight-vheight*scale)/2,
                ];
            } else if (typeof fitS === 'string' && fitS.match(/^align_/)) {
                const sides = fitS.split('_')[1].toLowerCase().split('');
                if (sides.length > 2)
                    throw new Error(`align_ expecting 0-2 sides, not ${sides.length}`);
                const bounds = margined_bounds();
                translate = diagram.translate();
                scale = diagram.scale();
                let vertalign = false, horzalign = false;
                sides.forEach(s => {
                    switch (s) {
                        case 'l':
                            translate[0] = align_left(translate, bounds.left);
                            horzalign = true;
                            break;
                        case 't':
                            translate[1] = align_top(translate, bounds.top);
                            vertalign = true;
                            break;
                        case 'r':
                            translate[0] = align_right(translate, bounds.right);
                            horzalign = true;
                            break;
                        case 'b':
                            translate[1] = align_bottom(translate, bounds.bottom);
                            vertalign = true;
                            break;
                        case 'c': // handled below
                            break;
                        default:
                            throw new Error(`align_ expecting l t r b or c, not '${s}'`);
                    }
                });
                if (sides.includes('c')) {
                    if (!horzalign)
                        translate[0] = center_horizontally(translate, bounds);
                    if (!vertalign)
                        translate[1] = center_vertically(translate, bounds);
                }
            } else if (fitS === 'zoom') {
                scale = diagram.scale();
                translate = bring_in_bounds(diagram.translate());
            } else
                throw new Error(`unknown fitStrategy type ${typeof fitS}`);

            _internal.setAnimateZoom(animate);
            diagram.translate(translate).scale(scale).commitTranslateScale();
            _internal.setAnimateZoom(false);
        }
    }

    function check_zoom(drawState) {
        let do_zoom, animate = true;
        if (diagram.width_is_automatic() || diagram.height_is_automatic())
            detect_size_change();
        switch (diagram.autoZoom()) {
            case 'always-skipanimonce':
                animate = false;
                diagram.autoZoom('always');
                // falls through
            case 'always':
                do_zoom = true;
                break;
            case 'once-noanim':
                animate = false;
                // falls through
            case 'once':
                do_zoom = true;
                diagram.autoZoom(null);
                break;
            default:
                do_zoom = false;
        }
        calc_bounds(drawState);
        if (do_zoom)
            auto_zoom(animate);
    }

    function margined_bounds() {
        const bounds = _bounds || {left: 0, top: 0, right: 0, bottom: 0};
        const scale = diagram.scale();
        return {
            left: bounds.left-diagram.margins().left/scale,
            top: bounds.top-diagram.margins().top/scale,
            right: bounds.right+diagram.margins().right/scale,
            bottom: bounds.bottom+diagram.margins().bottom/scale,
        };
    }

    // with thanks to comments in https://github.com/d3/d3/issues/1084
    function align_left(translate, x) {
        return translate[0]-diagram.x()(x)+diagram.x().range()[0];
    }
    function align_top(translate, y) {
        return translate[1]-diagram.y()(y)+diagram.y().range()[0];
    }
    function align_right(translate, x) {
        return translate[0]-diagram.x()(x)+diagram.x().range()[1];
    }
    function align_bottom(translate, y) {
        return translate[1]-diagram.y()(y)+diagram.y().range()[1];
    }
    function center_horizontally(translate, bounds) {
        return (align_left(translate, bounds.left)+align_right(translate, bounds.right))/2;
    }
    function center_vertically(translate, bounds) {
        return (align_top(translate, bounds.top)+align_bottom(translate, bounds.bottom))/2;
    }

    function bring_in_bounds(translate) {
        const xDomain = diagram.x().domain(), yDomain = diagram.y().domain();
        const bounds = margined_bounds();
        let less1 = bounds.left < xDomain[0],
            less2 = bounds.right < xDomain[1],
            lessExt = (bounds.right-bounds.left) < (xDomain[1]-xDomain[0]);
        let align, _nothing = 0;
        if (less1 && less2) {
            if (lessExt)
                align = 'left';
            else
                align = 'right';
        } else if (!less1 && !less2) {
            if (lessExt)
                align = 'right';
            else
                align = 'left';
        }
        switch (align) {
            case 'left':
                translate[0] = align_left(translate, bounds.left);
                break;
            case 'right':
                translate[0] = align_right(translate, bounds.right);
                break;
            default:
                ++_nothing;
        }
        less1 = bounds.top < yDomain[0];
        less2 = bounds.bottom < yDomain[1];
        lessExt = (bounds.bottom-bounds.top) < (yDomain[1]-yDomain[0]);
        if (less1 && less2) {
            if (lessExt)
                align = 'top';
            else
                align = 'bottom';
        } else if (!less1 && !less2) {
            if (lessExt)
                align = 'bottom';
            else
                align = 'top';
        }
        switch (align) {
            case 'top':
                translate[1] = align_top(translate, bounds.top);
                break;
            case 'bottom':
                translate[1] = align_bottom(translate, bounds.bottom);
                break;
            default:
                ++_nothing;
        }
        return translate;
    }

    // Zoom handling
    diagram.doZoom = function() {
        if (diagram.width_is_automatic() || diagram.height_is_automatic())
            detect_size_change();

        const transform = zoomTransform(diagram.svg().node());
        const scale = transform.k;
        let translate;
        if (diagram.restrictPan())
            translate = bring_in_bounds([transform.x, transform.y]);
        else translate = [transform.x, transform.y];

        // Manually rescale x and y scales for D3 v5
        const newX = transform.rescaleX(diagram.x());
        const newY = transform.rescaleY(diagram.y());

        diagram.globalTransform(translate, scale, _internal.getAnimateZoom());
        _dispatch.call('zoomed', null, translate, scale, newX.domain(), newY.domain());
    };

    diagram.invertCoord = function(clientCoord) {
        return [
            diagram.x().invert(clientCoord[0]),
            diagram.y().invert(clientCoord[1]),
        ];
    };

    diagram.requestRefresh = function(durationOverride) {
        window.requestAnimationFrame(() => {
            let transdur;
            if (durationOverride !== undefined) {
                transdur = diagram.transitionDuration();
                diagram.transitionDuration(durationOverride);
            }
            diagram.refresh();
            if (durationOverride !== undefined)
                diagram.transitionDuration(transdur);
        });
    };

    // Zoom to fit the diagram bounds
    diagram.zoomToFit = function(animate) {
        auto_zoom(animate);
        return diagram;
    };

    // Force relayout by clearing cached snapshots
    diagram.relayout = function() {
        _internal.setNodesSnapshot(null);
        _internal.setEdgesSnapshot(null);
        return diagram;
    };

    // Override layoutEngine property with reactive version
    diagram.layoutEngine = property(null).react(async val => {
        if (val && val.parent)
            val.parent(diagram);
        if (diagram.isRendered()) {
            // remove any calculated points, if engine did that
            Object.keys(_internal.edges()).forEach(k => {
                _internal.edges()[k].cola.points = null;
            });
            // initialize engine
            await initLayout(val);
        }
    });

    // Expose initLayout for use by render function
    diagram.initLayout = initLayout;

    return diagram;
}
