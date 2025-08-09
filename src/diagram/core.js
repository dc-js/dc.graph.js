/**
 * Core diagram properties and initialization
 * @module diagram/core
 */

import { set } from 'd3-collection';
import { dispatch } from 'd3-dispatch';
import { scaleLinear } from 'd3-scale';
import {
    BadArgumentException,
    pluck,
    redrawAll,
    registerChart,
    renderAll,
    utils,
} from 'dc';
import { builtinArrows, clipPathToArrows, scaledArrowLengths } from '../arrows.js';
import { colaLayout } from '../cola_layout.js';
import {
    constants,
    deprecatedProperty,
    deprecateFunction,
    getOriginal,
    identity,
    namedChildren,
    onetimeTrace,
    property,
    traceFunction,
} from '../core.js';
import { dagreLayout } from '../dagre_layout.js';
import { textContents } from '../node_contents.js';
import {
    elaboratedRectangleShape,
    ellipseShape,
    noShape,
    polygonShape,
    roundedRectangleShape,
} from '../shape.js';
import { cascade } from '../utils.js';
import { webworkerLayout } from '../webworker_layout.js';

export function applyCore(diagram, parent, chartGroup) {
    // Initialize basic dc.js compatibility
    diagram.__dcFlag__ = utils.uniqueId();

    // Define margins property (dc.js baseMixin functionality)
    diagram.margins = property({left: 10, top: 10, right: 10, bottom: 10});

    // Event dispatcher
    const _dispatch = dispatch(
        'preDraw',
        'data',
        'end',
        'start',
        'render',
        'drawn',
        'receivedLayout',
        'transitionsStarted',
        'zoomed',
        'reset',
    );

    // Shared state variables
    let _nodes = {}, _edges = {}; // hold state between runs
    let _ports = {}; // id = node|edge/id/name
    const _clusters = {};
    let _nodePorts; // ports sorted by node id
    let _stats = {};
    let _nodes_snapshot, _edges_snapshot;
    const _arrows = {};
    let _running = false; // for detecting concurrency issues
    let _anchor, _chartGroup;
    let _animateZoom;

    // Size calculation
    let _minWidth = 200;
    const _defaultWidthCalc = function(element) {
        const width = element && element.getBoundingClientRect
            && element.getBoundingClientRect().width;
        return (width && width > _minWidth) ? width : _minWidth;
    };
    let _widthCalc = _defaultWidthCalc;

    let _minHeight = 200;
    const _defaultHeightCalc = function(element) {
        const height = element && element.getBoundingClientRect
            && element.getBoundingClientRect().height;
        return (height && height > _minHeight) ? height : _minHeight;
    };
    let _heightCalc = _defaultHeightCalc;
    let _width, _height, _lastWidth, _lastHeight;

    // Store references to shared state for other modules
    diagram._internal = {
        dispatch: _dispatch,
        nodes: () => _nodes,
        edges: () => _edges,
        ports: () => _ports,
        clusters: () => _clusters,
        arrows: () => _arrows,
        setNodes: nodes => _nodes = nodes,
        setEdges: edges => _edges = edges,
        setPorts: ports => _ports = ports,
        getClusters: () => _clusters,
        getNodePorts: () => _nodePorts,
        setNodePorts: ports => _nodePorts = ports,
        getStats: () => _stats,
        setStats: stats => _stats = stats,
        getNodesSnapshot: () => _nodes_snapshot,
        setNodesSnapshot: snapshot => _nodes_snapshot = snapshot,
        getEdgesSnapshot: () => _edges_snapshot,
        setEdgesSnapshot: snapshot => _edges_snapshot = snapshot,
        isRunning: () => _running,
        setRunning: running => _running = running,
        getAnimateZoom: () => _animateZoom,
        setAnimateZoom: animate => _animateZoom = animate,
    };

    function deprecate_layout_algo_parameter(name) {
        return function(value) {
            if (!diagram.layoutEngine())
                diagram.layoutAlgorithm('cola', true);
            let engine = diagram.layoutEngine();
            if (engine.getEngine)
                engine = engine.getEngine();
            if (engine[name]) {
                console.warn(
                    `property is deprecated, call on layout engine instead: dc_graph.diagram.%c${name}`,
                    'font-weight: bold',
                );
                if (!arguments.length)
                    return engine[name]();
                engine[name](value);
            } else {
                console.warn(
                    `property is deprecated, and is not supported for Warning: dc_graph.diagram.<b>${name}</b> is deprecated, and it is not supported for the "${engine.layoutAlgorithm()}" layout algorithm: ignored.`,
                );
                if (!arguments.length)
                    return null;
            }
            return this;
        };
    }

    /**
     * Set or get the height attribute of the diagram.
     * @method height
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [height=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    diagram.height = function(height) {
        if (!arguments.length) {
            if (!utils.isNumber(_height)) {
                _lastHeight = _heightCalc(diagram.root().node());
                if (_height === 'auto') // 'auto' => calculate every time
                    return _lastHeight;
                // null/undefined => calculate once only
                _height = _lastHeight;
            }
            return _height;
        }
        if (utils.isNumber(height) || !height || height === 'auto')
            _height = height;
        else if (typeof height === 'function') {
            _heightCalc = height;
            _height = undefined;
        } else throw new Error(
                `don't know what to do with height type ${typeof height} value ${height}`,
            );
        return diagram;
    };

    diagram.minHeight = function(height) {
        if (!arguments.length)
            return _minHeight;
        _minHeight = height;
        return diagram;
    };

    diagram.width_is_automatic = function() {
        return typeof _width !== 'number' || _width === 'auto';
    };

    diagram.height_is_automatic = function() {
        return typeof _height !== 'number' || _height === 'auto';
    };

    /**
     * Set or get the width attribute of the diagram.
     * @method width
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [width=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    diagram.width = function(width) {
        if (!arguments.length) {
            if (!utils.isNumber(_width)) {
                _lastWidth = _widthCalc(diagram.root().node());
                if (_width === 'auto') // 'auto' => calculate every time
                    return _lastWidth;
                // null/undefined => calculate once only
                _width = _lastWidth;
            }
            return _width;
        }
        if (utils.isNumber(width) || !width || width === 'auto')
            _width = width;
        else if (typeof width === 'function') {
            _widthCalc = width;
            _width = undefined;
        } else throw new Error(
                `don't know what to do with width type ${typeof width} value ${width}`,
            );
        return diagram;
    };

    diagram.minWidth = function(width) {
        if (!arguments.length)
            return _minWidth;
        _minWidth = width;
        return diagram;
    };

    /**
     * Get or set the root element, which is usually the parent div.
     */
    diagram.root = property(null).react(e => {
        if (e.empty())
            console.log(`Warning: parent selector ${parent} doesn't seem to exist`);
    });

    // Zoom and interaction properties
    diagram.mouseZoomable = property(true);
    diagram.zoomExtent = property([.1, 2]);
    diagram.modKeyZoom = property('Alt');
    diagram.fitStrategy = property('default');
    diagram.restrictPan = property(false);
    diagram.autoZoom = property(null);
    diagram.zoomDuration = property(500);

    // Crossfilter integration
    diagram.nodeDimension = property();
    diagram.nodeGroup = property();
    diagram.edgeDimension = property();
    diagram.edgeGroup = property();
    diagram.edgesInFront = property(false);

    // Accessor functions
    diagram.nodeKey = diagram.nodeKeyAccessor = property(kv => kv.key);
    diagram.edgeKey = diagram.edgeKeyAccessor = property(kv => kv.key);
    diagram.edgeSource = diagram.sourceAccessor = property(kv => kv.value.sourcename);
    diagram.edgeTarget = diagram.targetAccessor = property(kv => kv.value.targetname);

    // Port properties
    diagram.portDimension = property(null);
    diagram.portGroup = property(null);
    diagram.portNodeKey = property(null);
    diagram.portEdgeKey = property(null);
    diagram.portName = property(null);
    diagram.portStyleName = property(null);
    diagram.portElastic = property(true);
    diagram.portStyle = namedChildren();
    diagram.portBounds = property(null);
    diagram.edgeSourcePortName = property(null);
    diagram.edgeTargetPortName = property(null);

    // Cluster properties
    diagram.clusterDimension = property(null);
    diagram.clusterGroup = property(null);
    diagram.clusterKey = property(pluck('key'));
    diagram.clusterParent = property(null);
    diagram.clusterPadding = property(8);

    // Node properties
    diagram.nodeParentCluster = property(null);
    diagram.nodeRadius = diagram.nodeRadiusAccessor = property(25);
    diagram.nodeStrokeWidth = diagram.nodeStrokeWidthAccessor = property(1);
    diagram.nodeStroke = diagram.nodeStrokeAccessor = property('black');
    diagram.nodeStrokeDashArray = property(null);
    diagram.nodeFillScale = property(null);
    diagram.nodeFill = diagram.nodeFillAccessor = property('white');
    diagram.nodeOpacity = property(1);
    diagram.nodePadding = property(6);
    diagram.nodeLabelPadding = property(0);
    diagram.nodeLineHeight = property(1);
    diagram.nodeLabel = diagram.nodeLabelAccessor = property(kv => kv.value.label || kv.value.name);
    diagram.nodeLabelAlignment = property('center');
    diagram.nodeLabelDecoration = property(null);
    diagram.nodeLabelFill = diagram.nodeLabelFillAccessor = property(null);
    diagram.nodeFitLabel = diagram.nodeFitLabelAccessor = property(true);
    diagram.nodeShape = property(null);
    diagram.nodeOutlineClip = property(null);
    diagram.nodeContent = property('text');
    diagram.nodeIcon = property(null);
    diagram.nodeTitle = diagram.nodeTitleAccessor = property(kv => kv.key);
    diagram.nodeOrdering = property(null);
    diagram.nodeFixed = diagram.nodeFixedAccessor = property(null);

    // Edge properties
    diagram.edgeStroke = diagram.edgeStrokeAccessor = property('black');
    diagram.edgeStrokeWidth = diagram.edgeStrokeWidthAccessor = property(1);
    diagram.edgeStrokeDashArray = property(null);
    diagram.edgeOpacity = diagram.edgeOpacityAccessor = property(1);
    diagram.edgeLabel = diagram.edgeLabelAccessor = property(e => diagram.edgeKey()(e));
    diagram.edgeLabelSpacing = property(12);
    diagram.edgeArrowhead = diagram.edgeArrowheadAccessor = property('vee');
    diagram.edgeArrowtail = diagram.edgeArrowtailAccessor = property(null);
    diagram.edgeArrowSize = property(1);
    diagram.edgeIsLayout = diagram.edgeIsLayoutAccessor = property(kv => !kv.value.notLayout);
    diagram.edgeIsShown = property(true);

    // Layout properties
    diagram.lengthStrategy = property('symmetric');
    diagram.edgeLength = property(null);
    diagram.baseLength = property(40);

    // Named children for styles and behaviors
    diagram.nodeStyle = namedChildren();
    diagram.shape = namedChildren();
    diagram.content = namedChildren();
    diagram.mode = diagram.child = namedChildren();

    // Register built-in shapes
    diagram.shape('nothing', noShape());
    diagram.shape('ellipse', ellipseShape());
    diagram.shape('polygon', polygonShape());
    diagram.shape('rounded-rect', roundedRectangleShape());
    diagram.shape('elaborated-rect', elaboratedRectangleShape());

    // Register built-in content
    diagram.content('text', textContents());

    // Layout engines
    diagram.layoutAlgorithm = property(null);
    diagram.initLayoutOnRedraw = property(true);
    diagram.layoutOnRedraw = property(true);
    diagram.showLayoutSteps = property(false);
    diagram.stageTransitions = property(
        'nodeStroke nodeStrokeWidth nodeFill edgeStroke edgeStrokeWidth edgeOpacity',
    );

    // Internal coordinate system
    diagram.x = property(null);
    diagram.y = property(null);

    // DC.js integration methods
    diagram.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return diagram;
    };

    diagram.getStats = function() {
        return _stats;
    };

    // Expose internal access for other modules
    diagram._internal = {
        dispatch: _dispatch,
        nodes: () => _nodes,
        edges: () => _edges,
        ports: () => _ports,
        clusters: () => _clusters,
        arrows: () => _arrows,
        setNodes: nodes => _nodes = nodes,
        setEdges: edges => _edges = edges,
        setPorts: ports => _ports = ports,
        getClusters: () => _clusters,
        getNodePorts: () => _nodePorts,
        setNodePorts: ports => _nodePorts = ports,
        getStats: () => _stats,
        setStats: stats => _stats = stats,
        getNodesSnapshot: () => _nodes_snapshot,
        setNodesSnapshot: snapshot => _nodes_snapshot = snapshot,
        getEdgesSnapshot: () => _edges_snapshot,
        setEdgesSnapshot: snapshot => _edges_snapshot = snapshot,
        isRunning: () => _running,
        setRunning: running => _running = running,
        getAnimateZoom: () => _animateZoom,
        setAnimateZoom: animate => _animateZoom = animate,
    };

    // Property cascade system for styling modes
    diagram.cascade = cascade(diagram);

    return diagram;
}
