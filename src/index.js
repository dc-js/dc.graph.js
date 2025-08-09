/**
 * dc.graph.js - Graph visualization library for dc.js
 * Main entry point for ES6 module exports
 * @module dc-graph
 */

// Core utilities
export {
    constants,
    deprecatedProperty,
    deprecateFunction,
    deprecationWarning,
    functorWrap,
    getBBoxNoThrow,
    identity,
    isIe,
    isSafari,
    namedChildren,
    property,
    uuid,
    version,
} from './core.js';

// Main diagram component
export { diagram } from './diagram/index.js';

// Layout engines
export { colaLayout } from './cola_layout.js';
export { d3v4ForceLayout } from './d3v4_force_layout.js';
export { dagreLayout } from './dagre_layout.js';
export { dynagraphLayout } from './dynagraph_layout.js';
export { flexboxLayout } from './flexbox_layout.js';
export { graphvizLayout } from './graphviz_layout.js';
export { layeredLayout } from './layered_layout.js';
export { manualLayout } from './manual_layout.js';
export { treeLayout } from './tree_layout.js';

// Layout engine management
export { engines, spawnEngine } from './engine.js';
export { webworkerLayout } from './webworker_layout.js';

// Utilities
export { annotateLayers } from './annotate_layers.js';
export { annotateNodes } from './annotate_nodes.js';
export { builtinArrows } from './arrows.js';
export { addPoints, arrowOffsets, arrowParts, multPoint } from './arrows.js';
export { brush } from './brush.js';
export {
    alignX,
    alignY,
    constraintPattern,
    gapX,
    gapY,
    orderX,
    orderY,
} from './constraint_pattern.js';
export { convertAdjacencyList, convertNest, convertTree } from './convert.js';
export { deleteNodes } from './delete_nodes.js';
export { deleteThings } from './delete_things.js';
export { depthFirstTraversal } from './depth_first_traversal.js';
export { drawClusters } from './draw_clusters.js';
export { drawGraphs } from './draw_graphs.js';
export { dropdown } from './dropdown.js';
export { editText } from './edit_text.js';
export { defaultUrlOpener, expandCollapse } from './expand_collapse.js';
export { expandedHidden } from './expanded_hidden.js';
export { filterSelection } from './filter_selection.js';
export { fixNodes, fixNodesGroup } from './fix_nodes.js';
export { flatGroup } from './flat_group.js';
export { edgeObject, generate, nodeName, nodeObject, randomGraph, wheelEdges } from './generate.js';
export { regenerateObjects } from './generate_objects.js';
export { applyGraphvizAccessors, graphvizAttrs, snapshotGraphviz } from './graphviz_attrs.js';
export { grid } from './grid.js';
export { highlightNeighbors } from './highlight_neighbors.js';
export { registerHighlightNeighborsGroup } from './highlight_neighbors_group.js';
export { highlightPaths } from './highlight_paths.js';
export { registerHighlightPathsGroup } from './highlight_paths_group.js';
export { highlightRadius } from './highlight_radius.js';
export { highlightThings } from './highlight_things.js';
export { registerHighlightThingsGroup } from './highlight_things_group.js';
export { keyboard } from './keyboard.js';
export { labelEdges } from './label_edges.js';
export { labelNodes } from './label_nodes.js';
export { labelThings, labelThingsGroup } from './label_things.js';
export { edgeLegend, legend, nodeLegend, symbolLegend } from './legend.js';
export { lineBreaks } from './line_breaks.js';
export {
    dataUrl,
    fileFormats,
    loadGraph,
    loadGraphText,
    matchFileFormat,
    matchMimeType,
} from './load_graph.js';
export { matchOpposites } from './match_opposites.js';
export { matchPorts } from './match_ports.js';
export { behavior, mode } from './mode.js';
export { moveNodes } from './move_nodes.js';
export { mungeGraph } from './munge_graph.js';
export { textContents, withIconContents } from './node_contents.js';
export { pathReader } from './path_reader.js';
export { pathSelector } from './path_selector.js';
export { placePorts } from './place_ports.js';
export { renderSvg } from './render_svg.js';
export { selectEdges } from './select_edges.js';
export { selectNodes } from './select_nodes.js';
export { selectPorts } from './select_ports.js';
export { selectThings, selectThingsGroup } from './select_things.js';
export {
    availableShapes,
    defaultShape,
    elaboratedRectangleShape,
    ellipseShape,
    noShape,
    polygonShape,
    roundedRectangleShape,
    shapePresets,
} from './shape.js';
export { nodeLabelPadding } from './shape.js';
export { drawSplinePaths, splinePaths } from './spline_paths.js';
export { supergraph } from './supergraph.js';
export { symbolPortStyle } from './symbol_port_style.js';
export {
    selectEdge,
    selectNode,
    selectNodeAndEdge,
    selectPort,
    tip,
    tipHtmlOrJsonTable,
    tipJsonTable,
    tipTable,
} from './tip.js';
export { deparallelize } from './transform.js';
export { treeConstraints } from './tree_constraints.js';
export { treePositions } from './tree_positions.js';
export { troubleshoot } from './troubleshoot.js';
export { buildTypeGraph } from './type_graph.js';
export { cascade, eventCoords, scriptPath } from './utils.js';
export {
    ancestorHasClass,
    clone,
    conditionalProperties,
    multiplyProperties,
    nodeEdgeConditions,
    param,
    uniq,
} from './utils.js';
export { validate } from './validate.js';
export { wildcardPorts } from './wildcard_ports.js';

// Example usage:
// import { diagram, colaLayout, dagreLayout } from 'dc-graph';
// const myDiagram = diagram('#chart')
//   .width(800)
//   .height(600)
//   .layoutEngine(colaLayout());
