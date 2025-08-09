/**
 * Main diagram factory - combines all mixins
 * @module diagram
 */

import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import {
    BadArgumentException,
    pluck,
    registerChart,
    utils,
} from 'dc';
import { builtinArrows, clipPathToArrows, scaledArrowLengths } from '../arrows.js';
import { redrawAllAsync, renderAllAsync } from '../async-chart-registry.js';
import { colaLayout } from '../cola_layout.js';
import {
    constants,
    deprecateFunction,
    getOriginal,
    identity,
    onetimeTrace,
    property,
    traceFunction,
} from '../core.js';
import { dagreLayout } from '../dagre_layout.js';
import { webworkerLayout } from '../webworker_layout.js';
// renderSvg functionality is now in rendering.js mixin

import { applyCore } from './core.js';
import { applyInteraction } from './interaction.js';
import { applyLayout } from './layout.js';
import { applyPorts } from './ports.js';
import { applyRendering } from './rendering.js';

/**
 * dc.graph.diagram is a dc.js-compatible interactive graph visualization.
 *
 * Examples:
 * - {@link https://dc-js.github.io/dc.graph.js/ | the dc.graph.js home page}
 * - {@link https://dc-js.github.io/dc.graph.js/examples/| | examples}
 * - {@link https://github.com/dc-js/dc.graph.js/tree/develop/web/js | the source code}
 *
 * @class diagram
 * @memberof dc_graph
 * @param {String|node|d3.selection|CompositeChart} parent - the parent object or id or selector
 * @param {String} [chartGroup] - the name of the chart group for this chart to be coordinated with.
 * Most dc.js charts that belong to the same group will be redrawn whenever any of them filter.
 * @return {dc_graph.diagram}
 */
export function diagram(parent, chartGroup) {
    let _needsRedraw = false;
    let _anchor, _chartGroup;
    const _arrows = {};

    // Create base diagram object with dc.js compatibility
    const _diagram = {};

    // Apply all mixins
    applyCore(_diagram, parent, chartGroup);
    applyRendering(_diagram);
    applyLayout(_diagram);
    applyInteraction(_diagram);
    applyPorts(_diagram);

    const _internal = _diagram._internal;
    const _dispatch = _internal.dispatch;

    // Layout algorithm parameter deprecation helper
    function deprecate_layout_algo_parameter(name) {
        return function(value) {
            if (!_diagram.layoutEngine())
                _diagram.layoutAlgorithm('cola', true);
            let engine = _diagram.layoutEngine();
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

    // Layout algorithm management (deprecated but needed for compatibility)
    _diagram.layoutAlgorithm = function(value, skipWarning) {
        if (!arguments.length)
            return _diagram.layoutEngine() ? _diagram.layoutEngine().layoutAlgorithm() : 'cola';
        if (!skipWarning)
            console.warn(
                'dc.graph.diagram.layoutAlgorithm is deprecated - pass the layout engine object to dc_graph.diagram.layoutEngine instead',
            );

        let engine;
        switch (value) {
            case 'cola':
                engine = colaLayout();
                break;
            case 'dagre':
                engine = dagreLayout();
        }
        engine = webworkerLayout(engine);
        _diagram.layoutEngine(engine);
        return this;
    };

    // No renderer object - all rendering functionality is integrated directly into diagram

    // Layout properties
    _diagram.enforceEdgeDirection = property(null);
    _diagram.initialLayout = property(null);
    _diagram.layoutUnchanged = property(false);
    _diagram.nodeChangeSelect = property(() => topology_node);
    _diagram.edgeChangeSelect = property(() => topology_edge);
    _diagram.constrain = property(() => []);
    _diagram.parallelEdgeOffset = property(null);
    _diagram.timeLimit = property(null);
    _diagram.initialOnly = property(false);
    _diagram.showLayoutSteps = property(false);
    _diagram.transitionDuration = property(500);
    _diagram.induceNodes = property(false);
    _diagram.nodeOrdering = property(null);
    _diagram.edgeOrdering = property(null);

    // Layout algorithm parameter deprecations
    _diagram.tickSize = deprecate_layout_algo_parameter('tickSize');
    _diagram.handleDisconnected = deprecate_layout_algo_parameter('handleDisconnected');

    // Topology extraction functions
    function dcg_fields(cola) {
        const entries = Object.entries(cola)
            .filter(entry => /^dcg_/.test(entry[0]));
        return entries.reduce((p, entry) => {
            p[entry[0]] = entry[1];
            return p;
        }, {});
    }
    function topology_node(n) {
        return {orig: getOriginal(n), cola: dcg_fields(n.cola)};
    }
    function topology_edge(e) {
        return {orig: getOriginal(e), cola: dcg_fields(e.cola)};
    }
    function basic_node(n) {
        const n0 = getOriginal(n);
        return {
            orig: {
                key: n0.key,
                value: Object.fromEntries(
                    Object.entries(n0.value)
                        .filter(kv => kv[0] !== 'fixedPos'),
                ),
            },
        };
    }
    function basic_edge(e) {
        return {orig: getOriginal(e)};
    }

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Computes a new layout based on the nodes and edges in the edge groups, and
     * displays the diagram.  To the extent possible, the diagram will minimize changes in
     * positions from the previous layout.  `.render()` must be called the first time, and
     * `.redraw()` can be called after that.
     *
     * `.redraw()` will be triggered by changes to the filters in any other charts in the same
     * dc.js chart group.
     *
     * Unlike in dc.js, `redraw` executes asynchronously, because drawing can be computationally
     * intensive, and the diagram will be drawn multiple times if
     * {@link #dc_graph.diagram+showLayoutSteps showLayoutSteps}
     * is enabled. Watch the {@link #dc_graph.diagram+on 'end'} event to know when layout is
     * complete.
     * @method redraw
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.redraw = async function() {
        // since dc.js can receive UI events and trigger redraws whenever it wants,
        // and cola absolutely will not tolerate being poked while it's doing layout,
        // we need to guard the startLayout call.
        if (_internal.isRunning()) {
            _needsRedraw = true;
            return this;
        } else return await _diagram.startLayout();
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Erases any existing SVG elements and draws the diagram from scratch. `.render()`
     * must be called the first time, and `.redraw()` can be called after that.
     * @method render
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.render = async function() {
        if (_diagram.isRendered())
            _dispatch.call('reset');
        if (!_diagram.initLayoutOnRedraw())
            await _diagram.initLayout();

        _internal.setNodes({});
        _internal.setEdges({});
        _internal.setPorts({});
        // Reset clusters - need to access via getClusters() method
        const clusters = _internal.getClusters();
        Object.keys(clusters).forEach(key => delete clusters[key]);

        // start out with 1:1 zoom
        _diagram.x(
            scaleLinear()
                .domain([0, _diagram.width()])
                .range([0, _diagram.width()]),
        );
        _diagram.y(
            scaleLinear()
                .domain([0, _diagram.height()])
                .range([_diagram.height(), 0]),
        );

        _diagram.initializeDrawing();
        _dispatch.call('render');
        await _diagram.redraw();
        return this;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be redrawn.
     * @method redrawGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.redrawGroup = async function() {
        await redrawAllAsync(_chartGroup);
        return _diagram;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be rendered.
     * @method renderGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.renderGroup = async function() {
        await renderAllAsync(_chartGroup);
        return _diagram;
    };

    /**
     * Creates an svg marker definition for drawing edge arrow tails or heads.
     *
     * Sorry, this is not currently documented - please see
     * [arrows.js](https://github.com/dc-js/dc.graph.js/blob/develop/src/arrows.js)
     * for examples
     * @return {dc_graph.diagram}
     */
    _diagram.defineArrow = function(name, defn) {
        if (typeof defn !== 'function')
            throw new BadArgumentException(
                'sorry, defineArrow no longer takes specific shape parameters, and the parameters have changed too much to convert them. it takes a name and a function returning a definition - please look at arrows.js for new format',
            );
        const arrows = _internal.arrows();
        arrows[name] = defn;
        return _diagram;
    };

    _diagram.arrows = function() {
        return Object.assign({}, builtinArrows, _internal.arrows());
    };

    // Register builtin arrows
    Object.keys(builtinArrows).forEach(aname => {
        const defn = builtinArrows[aname];
        _diagram.defineArrow(aname, defn);
    });

    /**
     * Set the root SVGElement to either be any valid [d3 single
     * selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom
     * block element such as a div; or a dom element or d3 selection. This class is called
     * internally on diagram initialization, but be called again to relocate the diagram. However, it
     * will orphan any previously created SVGElements.
     * @method anchor
     * @memberof dc_graph.diagram
     * @instance
     * @param {anchorSelector|anchorNode|d3.selection} [parent]
     * @param {String} [chartGroup]
     * @return {String|node|d3.selection}
     * @return {dc_graph.diagram}
     */
    _diagram.anchor = function(parent, chartGroup) {
        if (!arguments.length) {
            return _anchor;
        }
        if (parent) {
            if (parent.select && parent.classed) { // detect d3 selection
                _anchor = parent.node();
            } else {
                _anchor = parent;
            }
            _diagram.root(select(_anchor));
            _diagram.root().classed(constants.CHART_CLASS, true);
            registerChart(_diagram, chartGroup);
        } else {
            throw new BadArgumentException('parent must be defined');
        }
        _chartGroup = chartGroup;
        return _diagram;
    };

    /**
     * Returns the internal numeric ID of the chart.
     * @method chartID
     * @memberof dc.baseMixin
     * @instance
     * @returns {String}
     */
    _diagram.chartID = function() {
        return _diagram.__dcFlag__;
    };

    /**
     * Returns the DOM id for the chart's anchored location.
     * @method anchorName
     * @memberof dc_graph.diagram
     * @instance
     * @return {String}
     */
    _diagram.anchorName = function() {
        const a = _diagram.anchor();
        if (a && a.id) {
            return a.id;
        }
        if (a && a.replace) {
            return a.replace('#', '');
        }
        return `dc-graph${_diagram.chartID()}`;
    };

    return _diagram.anchor(parent, chartGroup);
}
