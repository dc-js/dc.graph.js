/**
 * dc.graph.js - Graph visualization library for dc.js
 * Main entry point for ES6 module exports
 * @module dc-graph
 */

// Core utilities
export { 
  version, 
  constants, 
  property, 
  namedChildren, 
  deprecatedProperty, 
  uuid, 
  isIe, 
  isSafari, 
  getBBoxNoThrow, 
  functorWrap, 
  deprecationWarning, 
  deprecateFunction,
  identity
} from './core.js';

// Main diagram component
export { diagram } from './diagram.js';

// Layout engines
export { colaLayout } from './cola_layout.js';
export { dagreLayout } from './dagre_layout.js';
export { dynagraphLayout } from './dynagraph_layout.js';
export { d3ForceLayout } from './d3_force_layout.js';
export { d3v4ForceLayout } from './d3v4_force_layout.js';
export { treeLayout } from './tree_layout.js';
export { manualLayout } from './manual_layout.js';
export { flexboxLayout } from './flexbox_layout.js';
export { layeredLayout } from './layered_layout.js';
export { graphvizLayout } from './graphviz_layout.js';

// Layout engine management
export { spawnEngine, engines } from './engine.js';
export { webworkerLayout } from './webworker_layout.js';

// Utilities
export { regenerateObjects } from './generate_objects.js';
export { graphvizAttrs, applyGraphvizAccessors, snapshotGraphviz } from './graphviz_attrs.js';
export { depthFirstTraversal } from './depth_first_traversal.js';
export { scriptPath, cascade, eventCoords } from './utils.js';
export { randomGraph, generate, nodeName, nodeObject, edgeObject, wheelEdges } from './generate.js';
export { flatGroup } from './flat_group.js';
export { symbolPortStyle } from './symbol_port_style.js';
export { fixNodes, fixNodesGroup } from './fix_nodes.js';
export { 
  defaultShape, shapePresets, availableShapes,
  noShape, ellipseShape, polygonShape, roundedRectangleShape, elaboratedRectangleShape
} from './shape.js';
export { textContents, withIconContents } from './node_contents.js';
export { renderSvg } from './render_svg.js';

// Example usage:
// import { diagram, colaLayout, dagreLayout } from 'dc-graph';
// const myDiagram = diagram('#chart')
//   .width(800)
//   .height(600)
//   .layoutEngine(colaLayout());