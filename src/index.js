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
export { mode, behavior } from './mode.js';
export { 
  tip, tipTable, tipJsonTable, tipHtmlOrJsonTable,
  selectNodeAndEdge, selectNode, selectEdge, selectPort
} from './tip.js';
export { legend, nodeLegend, edgeLegend, symbolLegend } from './legend.js';
export { brush } from './brush.js';
export { keyboard } from './keyboard.js';
export { dropdown } from './dropdown.js';
export { grid } from './grid.js';
export { 
  constraintPattern, gapY, gapX, alignY, alignX, orderX, orderY 
} from './constraint_pattern.js';
export { 
  fileFormats, matchFileFormat, matchMimeType, loadGraph, loadGraphText, dataUrl 
} from './load_graph.js';
export { registerHighlightThingsGroup } from './highlight_things_group.js';
export { expandCollapse, defaultUrlOpener } from './expand_collapse.js';
export { selectThings, selectThingsGroup } from './select_things.js';
export { labelThings, labelThingsGroup } from './label_things.js';
export { moveNodes } from './move_nodes.js';
export { builtinArrows } from './arrows.js';
export { editText } from './edit_text.js';
export { expandedHidden } from './expanded_hidden.js';
export { registerHighlightNeighborsGroup } from './highlight_neighbors_group.js';
export { registerHighlightPathsGroup } from './highlight_paths_group.js';
export { matchOpposites } from './match_opposites.js';
export { matchPorts } from './match_ports.js';
export { mungeGraph } from './munge_graph.js';
export { highlightThings } from './highlight_things.js';
export { highlightNeighbors } from './highlight_neighbors.js';
export { treePositions } from './tree_positions.js';
export { supergraph } from './supergraph.js';
export { drawGraphs } from './draw_graphs.js';
export { splinePaths, drawSplinePaths } from './spline_paths.js';
export { convertTree, convertNest, convertAdjacencyList } from './convert.js';
export { deleteThings } from './delete_things.js';
export { deleteNodes } from './delete_nodes.js';
export { selectNodes } from './select_nodes.js';
export { selectEdges } from './select_edges.js';
export { selectPorts } from './select_ports.js';
export { treeConstraints } from './tree_constraints.js';
export { pathSelector } from './path_selector.js';
export { renderWebgl } from './render_webgl.js';
export { troubleshoot } from './troubleshoot.js';
export { highlightRadius } from './highlight_radius.js';
export { highlightPaths } from './highlight_paths.js';
export { buildTypeGraph } from './type_graph.js';
export { validate } from './validate.js';
export { lineBreaks } from './line_breaks.js';
export { annotateNodes } from './annotate_nodes.js';
export { filterSelection } from './filter_selection.js';
export { pathReader } from './path_reader.js';
export { labelEdges } from './label_edges.js';
export { placePorts } from './place_ports.js';
export { deparallelize } from './transform.js';
export { wildcardPorts } from './wildcard_ports.js';
export { annotateLayers } from './annotate_layers.js';
export { drawClusters } from './draw_clusters.js';
export { labelNodes } from './label_nodes.js';

// Example usage:
// import { diagram, colaLayout, dagreLayout } from 'dc-graph';
// const myDiagram = diagram('#chart')
//   .width(800)
//   .height(600)
//   .layoutEngine(colaLayout());