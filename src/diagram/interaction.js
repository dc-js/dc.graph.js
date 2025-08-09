/**
 * Event handling, modes, and user interaction management
 * @module diagram/interaction
 */

import {
    deprecateFunction,
    namedChildren,
    onetimeTrace,
    traceFunction,
} from '../core.js';
import { portName } from '../place_ports.js';

export function applyInteraction(diagram) {
    const _internal = diagram._internal;
    const _dispatch = _internal.dispatch;

    // Mode management (behaviors/interactions)
    diagram.mode = diagram.child = namedChildren();

    diagram.mode.reject = function(id, object) {
        const rtype = diagram.rendererType(); // Direct method call instead of renderer().rendererType()
        if (!object)
            return false; // null is always a valid mode for any renderer
        if (!object.supportsRenderer)
            onetimeTrace('trace', `could not check if "${id}" is compatible with ${rtype}`);
        else if (!object.supportsRenderer(rtype))
            return `not installing "${id}" because it is not compatible with renderer ${rtype}`;
        return false;
    };

    // Legacy legend support
    diagram.legend = deprecateFunction(
        '.legend() is deprecated; use .child() for more control & multiple legends',
        function(_) {
            if (!arguments.length)
                return diagram.child('node-legend');
            diagram.child('node-legend', _);
            return diagram;
        },
    );

    // These methods are now integrated directly into the diagram
    // No need for renderer delegation

    // All SVG and rendering methods are now directly available on diagram via mixins
    // No delegation needed

    // Data access methods
    diagram.getNode = function(id) {
        return _internal.nodes()[id] ? _internal.nodes()[id].orig : null;
    };

    diagram.getWholeNode = function(id) {
        return _internal.nodes()[id] ? _internal.nodes()[id] : null;
    };

    diagram.getEdge = function(id) {
        return _internal.edges()[id] ? _internal.edges()[id].orig : null;
    };

    diagram.getWholeEdge = function(id) {
        return _internal.edges()[id] ? _internal.edges()[id] : null;
    };

    // Port access
    diagram.getPort = function(nid, eid, name) {
        return _internal.ports()[portName(nid, eid, name)];
    };

    diagram.nodePorts = function() {
        return _internal.getNodePorts();
    };

    diagram.getWholeCluster = function(id) {
        return _internal.clusters()[id] || null;
    };

    // Utility functions for child iteration
    diagram.forEachChild = function(node, children, idf, f) {
        children.enum().forEach(key => {
            f(children(key), node.filter(n => idf(n) === key));
        });
    };

    diagram.forEachShape = function(node, f) {
        diagram.forEachChild(node, diagram.shape, n => n.dcg_shape.shape, f);
    };

    diagram.forEachContent = function(node, f) {
        diagram.forEachChild(node, diagram.content, diagram.nodeContent.eval, f);
    };

    // Transition timing helpers
    diagram.stagedDuration = function() {
        return (diagram.stageTransitions() !== 'none')
            ? diagram.transitionDuration()/2
            : diagram.transitionDuration();
    };

    diagram.stagedDelay = function(is_enter) {
        return diagram.stageTransitions() === 'none'
                || diagram.stageTransitions() === 'modins' === !is_enter
            ? 0
            : diagram.transitionDuration()/2;
    };

    // ID generation utilities
    diagram.uniqueId = function() {
        return diagram.anchorName().replace(/[ .#=[\]"]/g, '-');
    };

    diagram.edgeId = function(e) {
        return `edge-${diagram.edgeKey.eval(e).replace(/[^\w-_]/g, '-')}`;
    };

    diagram.arrowId = function(e, kind) {
        return `arrow-${kind}-${diagram.uniqueId()}-${diagram.edgeId(e)}`;
    };

    diagram.textpathId = function(e) {
        return `textpath-${diagram.uniqueId()}-${diagram.edgeId(e)}`;
    };

    // Event handling with namespace support
    function namespace_event_reducer(msg_fun) {
        return function(p, ev) {
            const namespace = {};
            p[ev] = function(ns) {
                return namespace[ns] = namespace[ns] || onetimeTrace('trace', msg_fun(ns, ev));
            };
            return p;
        };
    }

    const renderer_specific_events = ['drawn', 'transitionsStarted', 'zoomed']
        .reduce(
            namespace_event_reducer((ns, ev) =>
                `subscribing "${ns}" to event "${ev}" which takes renderer-specific parameters`
            ),
            {},
        );
    const inconsistent_arguments = ['end']
        .reduce(
            namespace_event_reducer((ns, ev) =>
                `subscribing "${ns}" to event "${ev}" which may receive inconsistent arguments`
            ),
            {},
        );

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Attaches an event handler to the diagram. The currently supported events are
     * * `start()` - layout is starting
     * * `drawn(nodes, edges)` - the node and edge elements have been rendered to the screen
     * and can be modified through the passed d3 selections.
     * * `end()` - diagram layout has completed.
     * @method on
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [event] - the event to subscribe to
     * @param {Function} [f] - the event handler
     * @return {dc_graph.diagram}
     */
    diagram.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        const evns = event.split('.'),
            warning = renderer_specific_events[evns[0]] || inconsistent_arguments[evns[0]];
        if (warning)
            warning(evns[1] || '')();
        _dispatch.on(event, f);
        return this;
    };

    return diagram;
}
