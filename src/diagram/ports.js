/**
 * Port management and selection functionality
 * @module diagram/ports
 */

import { namedChildren, property } from '../core.js';

export function applyPorts(diagram) {
    // Port properties
    diagram.portDimension = property(null);
    diagram.portGroup = property(null);
    diagram.portNodeKey = property(null);
    diagram.portEdgeKey = property(null);
    diagram.portName = property(null);
    diagram.portStyleName = property(null);
    diagram.portElastic = property(true);
    diagram.portStyle = namedChildren();
    diagram.portBounds = property(null); // position limits, in radians

    // Port source/target naming for edges
    diagram.edgeSourcePortName = property(null);
    diagram.edgeTargetPortName = property(null);

    // Port selection functionality
    diagram.selectPorts = function() {
        // This would be implemented by specific port selection modes
        // For now, return null to indicate no port selection is active
        return null;
    };

    return diagram;
}
