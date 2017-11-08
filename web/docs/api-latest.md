<a name="dc_graph"></a>

## dc_graph : <code>object</code>
The entire dc.graph.js library is scoped under the **dc_graph** name space. It does not introduce
anything else into the global name space.

Like in dc.js and most libraries built on d3, most `dc_graph` functions are designed to allow function chaining, meaning they return the current chart
instance whenever it is appropriate.  The getter forms of functions do not participate in function
chaining because they return values that are not the chart.

**Kind**: global namespace  
**Version**: 0.6.0  
**Example**  
```js
// Example chaining
chart.width(600)
     .height(400)
     .nodeDimension(nodeDim)
     .nodeGroup(nodeGroup);
```

* [dc_graph](#dc_graph) : <code>object</code>
    * [.diagram](#dc_graph.diagram)
        * [new diagram(parent, [chartGroup])](#new_dc_graph.diagram_new)
        * [.width([width])](#dc_graph.diagram+width) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.height([height])](#dc_graph.diagram+height) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.root([root])](#dc_graph.diagram+root) ⇒ <code>node</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.mouseZoomable([mouseZoomable])](#dc_graph.diagram+mouseZoomable) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.altKeyZoom([altKeyZoom])](#dc_graph.diagram+altKeyZoom) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.fitStrategy([fitStrategy])](#dc_graph.diagram+fitStrategy) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.autoZoom([autoZoom])](#dc_graph.diagram+autoZoom) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeDimension([nodeDimension])](#dc_graph.diagram+nodeDimension) ⇒ <code>crossfilter.dimension</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeGroup([nodeGroup])](#dc_graph.diagram+nodeGroup) ⇒ <code>crossfilter.group</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeDimension([edgeDimension])](#dc_graph.diagram+edgeDimension) ⇒ <code>crossfilter.dimension</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeGroup([edgeGroup])](#dc_graph.diagram+edgeGroup) ⇒ <code>crossfilter.group</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeKey([nodeKey])](#dc_graph.diagram+nodeKey) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeKey([edgeKey])](#dc_graph.diagram+edgeKey) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeSource([edgeSource])](#dc_graph.diagram+edgeSource) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeTarget([edgeTarget])](#dc_graph.diagram+edgeTarget) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeRadius([nodeRadius])](#dc_graph.diagram+nodeRadius) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeStrokeWidth([nodeStrokeWidth])](#dc_graph.diagram+nodeStrokeWidth) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeStroke([nodeStroke])](#dc_graph.diagram+nodeStroke) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeFillScale([nodeFillScale])](#dc_graph.diagram+nodeFillScale) ⇒ <code>function</code> &#124; <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeFill([nodeFill])](#dc_graph.diagram+nodeFill) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeOpacity([nodeOpacity])](#dc_graph.diagram+nodeOpacity) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodePadding([nodePadding])](#dc_graph.diagram+nodePadding) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeLabel([nodeLabel])](#dc_graph.diagram+nodeLabel) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeLabelFill([nodeLabelFill])](#dc_graph.diagram+nodeLabelFill) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeFitLabel([nodeFitLabel])](#dc_graph.diagram+nodeFitLabel) ⇒ <code>function</code> &#124; <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeShape([nodeShape])](#dc_graph.diagram+nodeShape) ⇒ <code>function</code> &#124; <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeTitle([nodeTitle])](#dc_graph.diagram+nodeTitle) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeOrdering([nodeOrdering])](#dc_graph.diagram+nodeOrdering) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.nodeFixed([nodeFixed])](#dc_graph.diagram+nodeFixed) ⇒ <code>function</code> &#124; <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeStroke([edgeStroke])](#dc_graph.diagram+edgeStroke) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeStrokeWidth([edgeStrokeWidth])](#dc_graph.diagram+edgeStrokeWidth) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeOpacity([edgeOpacity])](#dc_graph.diagram+edgeOpacity) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeLabel([edgeLabel])](#dc_graph.diagram+edgeLabel) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeArrowhead([edgeArrowhead])](#dc_graph.diagram+edgeArrowhead) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeArrowtail([edgeArrowtail])](#dc_graph.diagram+edgeArrowtail) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeArrowSize([edgeArrowSize])](#dc_graph.diagram+edgeArrowSize) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeIsLayout([edgeIsLayout])](#dc_graph.diagram+edgeIsLayout) ⇒ <code>function</code> &#124; <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.lengthStrategy([lengthStrategy])](#dc_graph.diagram+lengthStrategy) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeLength([edgeLength])](#dc_graph.diagram+edgeLength) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.flowLayout([flowLayout])](#dc_graph.diagram+flowLayout)
        * [.rankdir([rankdir])](#dc_graph.diagram+rankdir)
        * [.baseLength([baseLength])](#dc_graph.diagram+baseLength) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.transitionDuration([transitionDuration])](#dc_graph.diagram+transitionDuration) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.stageTransitions([stageTransitions])](#dc_graph.diagram+stageTransitions) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.deleteDelay([deleteDelay])](#dc_graph.diagram+deleteDelay) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.groupConnected([stageTransitions])](#dc_graph.diagram+groupConnected) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.timeLimit([timeLimit])](#dc_graph.diagram+timeLimit) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.constrain([constrain])](#dc_graph.diagram+constrain) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.parallelEdgeOffset([parallelEdgeOffset])](#dc_graph.diagram+parallelEdgeOffset) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.edgeOrdering([edgeOrdering])](#dc_graph.diagram+edgeOrdering) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.initLayoutOnRedraw([initLayoutOnRedraw])](#dc_graph.diagram+initLayoutOnRedraw) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.layoutUnchanged([layoutUnchanged])](#dc_graph.diagram+layoutUnchanged) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.relayout()](#dc_graph.diagram+relayout) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.initialLayout([initialLayout])](#dc_graph.diagram+initialLayout) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.induceNodes([induceNodes])](#dc_graph.diagram+induceNodes) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.showLayoutSteps([showLayoutSteps])](#dc_graph.diagram+showLayoutSteps) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.legend([legend])](#dc_graph.diagram+legend) ⇒ <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.child([id], [object])](#dc_graph.diagram+child) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.layoutAlgorithm([algo])](#dc_graph.diagram+layoutAlgorithm) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.layoutEngine([engine])](#dc_graph.diagram+layoutEngine)
        * [.handleDisconnected([handleDisconnected])](#dc_graph.diagram+handleDisconnected) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.render()](#dc_graph.diagram+render) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.on([event], [f])](#dc_graph.diagram+on) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.getStats()](#dc_graph.diagram+getStats) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.select([selector])](#dc_graph.diagram+select) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.selectAll([selector])](#dc_graph.diagram+selectAll) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.x([scale])](#dc_graph.diagram+x) ⇒ <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.x([scale])](#dc_graph.diagram+x) ⇒ <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.svg([selection])](#dc_graph.diagram+svg) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.g([selection])](#dc_graph.diagram+g) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.resetSvg()](#dc_graph.diagram+resetSvg) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.redrawGroup()](#dc_graph.diagram+redrawGroup) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.renderGroup()](#dc_graph.diagram+renderGroup) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.defineArrow(name, width, height, refX, refY, drawf)](#dc_graph.diagram+defineArrow) ⇒ <code>[diagram](#dc_graph.diagram)</code>
        * [.anchor([parent], [chartGroup])](#dc_graph.diagram+anchor) ⇒ <code>String</code> &#124; <code>node</code> &#124; <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
        * [.anchorName()](#dc_graph.diagram+anchorName) ⇒ <code>String</code>
    * [.graphviz_attrs](#dc_graph.graphviz_attrs)
        * [new graphviz_attrs()](#new_dc_graph.graphviz_attrs_new)
        * [.rankdir([rankdir])](#dc_graph.graphviz_attrs+rankdir)
        * [.nodesep([nodesep])](#dc_graph.graphviz_attrs+nodesep)
        * [.ranksep([ranksep])](#dc_graph.graphviz_attrs+ranksep)
    * [.cola_layout](#dc_graph.cola_layout)
        * [new cola_layout([id])](#new_dc_graph.cola_layout_new)
        * [.handleDisconnected([handleDisconnected])](#dc_graph.cola_layout+handleDisconnected) ⇒ <code>Boolean</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
        * [.lengthStrategy([lengthStrategy])](#dc_graph.cola_layout+lengthStrategy) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
        * [.baseLength([baseLength])](#dc_graph.cola_layout+baseLength) ⇒ <code>Number</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
        * [.flowLayout([flowLayout])](#dc_graph.cola_layout+flowLayout)
    * [.dagre_layout](#dc_graph.dagre_layout)
        * [new dagre_layout([id])](#new_dc_graph.dagre_layout_new)
    * [.tree_layout](#dc_graph.tree_layout)
        * [new tree_layout([id])](#new_dc_graph.tree_layout_new)
    * [.graphviz_layout](#dc_graph.graphviz_layout)
        * [new graphviz_layout([id])](#new_dc_graph.graphviz_layout_new)
    * [.constraint_pattern](#dc_graph.constraint_pattern)
        * [new constraint_pattern(diagram, pattern)](#new_dc_graph.constraint_pattern_new)
    * [.tip](#dc_graph.tip)
        * [new tip()](#new_dc_graph.tip_new)
        * [.direction](#dc_graph.tip+direction) ⇒ <code>String</code> &#124; <code>[tip](#dc_graph.tip)</code>
        * [.content](#dc_graph.tip+content) ⇒ <code>function</code>
        * [.table](#dc_graph.tip+table) ⇒ <code>function</code>
    * [.flat_group](#dc_graph.flat_group) : <code>object</code>
        * [.make(vec, id_accessor)](#dc_graph.flat_group.make) ⇒ <code>Object</code>
        * [.another(ndx, id_accessor)](#dc_graph.flat_group.another) ⇒ <code>Object</code>

<a name="dc_graph.diagram"></a>

### dc_graph.diagram
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  

* [.diagram](#dc_graph.diagram)
    * [new diagram(parent, [chartGroup])](#new_dc_graph.diagram_new)
    * [.width([width])](#dc_graph.diagram+width) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.height([height])](#dc_graph.diagram+height) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.root([root])](#dc_graph.diagram+root) ⇒ <code>node</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.mouseZoomable([mouseZoomable])](#dc_graph.diagram+mouseZoomable) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.altKeyZoom([altKeyZoom])](#dc_graph.diagram+altKeyZoom) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.fitStrategy([fitStrategy])](#dc_graph.diagram+fitStrategy) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.autoZoom([autoZoom])](#dc_graph.diagram+autoZoom) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeDimension([nodeDimension])](#dc_graph.diagram+nodeDimension) ⇒ <code>crossfilter.dimension</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeGroup([nodeGroup])](#dc_graph.diagram+nodeGroup) ⇒ <code>crossfilter.group</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeDimension([edgeDimension])](#dc_graph.diagram+edgeDimension) ⇒ <code>crossfilter.dimension</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeGroup([edgeGroup])](#dc_graph.diagram+edgeGroup) ⇒ <code>crossfilter.group</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeKey([nodeKey])](#dc_graph.diagram+nodeKey) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeKey([edgeKey])](#dc_graph.diagram+edgeKey) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeSource([edgeSource])](#dc_graph.diagram+edgeSource) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeTarget([edgeTarget])](#dc_graph.diagram+edgeTarget) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeRadius([nodeRadius])](#dc_graph.diagram+nodeRadius) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeStrokeWidth([nodeStrokeWidth])](#dc_graph.diagram+nodeStrokeWidth) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeStroke([nodeStroke])](#dc_graph.diagram+nodeStroke) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeFillScale([nodeFillScale])](#dc_graph.diagram+nodeFillScale) ⇒ <code>function</code> &#124; <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeFill([nodeFill])](#dc_graph.diagram+nodeFill) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeOpacity([nodeOpacity])](#dc_graph.diagram+nodeOpacity) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodePadding([nodePadding])](#dc_graph.diagram+nodePadding) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeLabel([nodeLabel])](#dc_graph.diagram+nodeLabel) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeLabelFill([nodeLabelFill])](#dc_graph.diagram+nodeLabelFill) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeFitLabel([nodeFitLabel])](#dc_graph.diagram+nodeFitLabel) ⇒ <code>function</code> &#124; <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeShape([nodeShape])](#dc_graph.diagram+nodeShape) ⇒ <code>function</code> &#124; <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeTitle([nodeTitle])](#dc_graph.diagram+nodeTitle) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeOrdering([nodeOrdering])](#dc_graph.diagram+nodeOrdering) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.nodeFixed([nodeFixed])](#dc_graph.diagram+nodeFixed) ⇒ <code>function</code> &#124; <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeStroke([edgeStroke])](#dc_graph.diagram+edgeStroke) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeStrokeWidth([edgeStrokeWidth])](#dc_graph.diagram+edgeStrokeWidth) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeOpacity([edgeOpacity])](#dc_graph.diagram+edgeOpacity) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeLabel([edgeLabel])](#dc_graph.diagram+edgeLabel) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeArrowhead([edgeArrowhead])](#dc_graph.diagram+edgeArrowhead) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeArrowtail([edgeArrowtail])](#dc_graph.diagram+edgeArrowtail) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeArrowSize([edgeArrowSize])](#dc_graph.diagram+edgeArrowSize) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeIsLayout([edgeIsLayout])](#dc_graph.diagram+edgeIsLayout) ⇒ <code>function</code> &#124; <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.lengthStrategy([lengthStrategy])](#dc_graph.diagram+lengthStrategy) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeLength([edgeLength])](#dc_graph.diagram+edgeLength) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.flowLayout([flowLayout])](#dc_graph.diagram+flowLayout)
    * [.rankdir([rankdir])](#dc_graph.diagram+rankdir)
    * [.baseLength([baseLength])](#dc_graph.diagram+baseLength) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.transitionDuration([transitionDuration])](#dc_graph.diagram+transitionDuration) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.stageTransitions([stageTransitions])](#dc_graph.diagram+stageTransitions) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.deleteDelay([deleteDelay])](#dc_graph.diagram+deleteDelay) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.groupConnected([stageTransitions])](#dc_graph.diagram+groupConnected) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.timeLimit([timeLimit])](#dc_graph.diagram+timeLimit) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.constrain([constrain])](#dc_graph.diagram+constrain) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.parallelEdgeOffset([parallelEdgeOffset])](#dc_graph.diagram+parallelEdgeOffset) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.edgeOrdering([edgeOrdering])](#dc_graph.diagram+edgeOrdering) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.initLayoutOnRedraw([initLayoutOnRedraw])](#dc_graph.diagram+initLayoutOnRedraw) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.layoutUnchanged([layoutUnchanged])](#dc_graph.diagram+layoutUnchanged) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.relayout()](#dc_graph.diagram+relayout) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.initialLayout([initialLayout])](#dc_graph.diagram+initialLayout) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.induceNodes([induceNodes])](#dc_graph.diagram+induceNodes) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.showLayoutSteps([showLayoutSteps])](#dc_graph.diagram+showLayoutSteps) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.legend([legend])](#dc_graph.diagram+legend) ⇒ <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.child([id], [object])](#dc_graph.diagram+child) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.layoutAlgorithm([algo])](#dc_graph.diagram+layoutAlgorithm) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.layoutEngine([engine])](#dc_graph.diagram+layoutEngine)
    * [.handleDisconnected([handleDisconnected])](#dc_graph.diagram+handleDisconnected) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.render()](#dc_graph.diagram+render) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.on([event], [f])](#dc_graph.diagram+on) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.getStats()](#dc_graph.diagram+getStats) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.select([selector])](#dc_graph.diagram+select) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.selectAll([selector])](#dc_graph.diagram+selectAll) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.x([scale])](#dc_graph.diagram+x) ⇒ <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.x([scale])](#dc_graph.diagram+x) ⇒ <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.svg([selection])](#dc_graph.diagram+svg) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.g([selection])](#dc_graph.diagram+g) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.resetSvg()](#dc_graph.diagram+resetSvg) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.redrawGroup()](#dc_graph.diagram+redrawGroup) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.renderGroup()](#dc_graph.diagram+renderGroup) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.defineArrow(name, width, height, refX, refY, drawf)](#dc_graph.diagram+defineArrow) ⇒ <code>[diagram](#dc_graph.diagram)</code>
    * [.anchor([parent], [chartGroup])](#dc_graph.diagram+anchor) ⇒ <code>String</code> &#124; <code>node</code> &#124; <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
    * [.anchorName()](#dc_graph.diagram+anchorName) ⇒ <code>String</code>

<a name="new_dc_graph.diagram_new"></a>

#### new diagram(parent, [chartGroup])
`dc_graph.diagram` is a dc.js-compatible network visualization component. It registers in
the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
logically derives from the dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin),
but it does not physically derive from it since so much is different about network
visualization versus conventional charts.


| Param | Type | Description |
| --- | --- | --- |
| parent | <code>String</code> &#124; <code>node</code> | Any valid [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom block element such as a div; or a dom element. |
| [chartGroup] | <code>String</code> | The name of the chart group this chart instance should be placed in. Filter interaction with a chart will only trigger events and redraws within the chart's group. |

<a name="dc_graph.diagram+width"></a>

#### diagram.width([width]) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the width attribute of the diagram. See `.height` below.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [width] | <code>Number</code> | <code>200</code> | 

<a name="dc_graph.diagram+height"></a>

#### diagram.height([height]) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the height attribute of the diagram. The width and height are applied to the
SVG element generated by the diagram when rendered. If a value is given, then the
diagram is returned for method chaining. If no value is given, then the current value of
the height attribute will be returned. If the value is a function, it will get called with
the root element. Default: 200

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [height] | <code>Number</code> | <code>200</code> | 

<a name="dc_graph.diagram+root"></a>

#### diagram.root([root]) ⇒ <code>node</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Get or set the root element, which is usually the parent div. Normally the root is set
when the diagram is constructed; setting it later may have unexpected consequences.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [root] | <code>node</code> | <code></code> | 

<a name="dc_graph.diagram+mouseZoomable"></a>

#### diagram.mouseZoomable([mouseZoomable]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Get or set whether mouse wheel rotation or touchpad gestures will zoom the diagram, and
whether dragging on the background pans the diagram.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [mouseZoomable] | <code>Boolean</code> | <code>true</code> | 

<a name="dc_graph.diagram+altKeyZoom"></a>

#### diagram.altKeyZoom([altKeyZoom]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Whether zooming should only be enabled when the alt key is pressed.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [altKeyZoom] | <code>Boolean</code> | <code>true</code> | 

<a name="dc_graph.diagram+fitStrategy"></a>

#### diagram.fitStrategy([fitStrategy]) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the fitting strategy for the canvas, which affects how the
[viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox) and
[preserveAspectRatio](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/preserveAspectRatio)
attributes get set. All options except `null` set the `viewBox` attribute.

These options set the `viewBox` and adjust the scale and translate to implement the margins.
* `'default'` - uses the default behavior of `xMidYMid meet` (but with margins)
* `'vertical'` - fits the canvas vertically (with vertical margins) and centers it
horizontally. If the canvas is taller than the viewport, it will meet vertically and
there will be blank areas to the left and right. If the canvas is wider than the
viewport, it will be sliced.
* `'horizontal'` - fitst the canvas horizontally (with horizontal margins) and centers
it vertically. If the canvas is wider than the viewport, it will meet horizontally and
there will be blank areas above and below. If the canvas is taller than the viewport, it
will be sliced.

Other options
* `null` - no attempt is made to fit the canvas to the svg element, `viewBox` is unset.
* another string - sets the `viewBox` and uses the string for `preserveAspectRatio`.
* function - will be called with (viewport width, viewport height, canvas width, canvas
height) and result will be used to set `preserveAspectRatio`.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [fitStrategy] | <code>String</code> | <code>&#x27;default&#x27;</code> | 

<a name="dc_graph.diagram+autoZoom"></a>

#### diagram.autoZoom([autoZoom]) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Auto-zoom behavior.
* `'always'` - zoom every time layout happens
* `'once'` - zoom the first time layout happens
* `null` - manual, call `zoomToFit` to fit

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [autoZoom] | <code>String</code> | <code></code> | 

<a name="dc_graph.diagram+nodeDimension"></a>

#### diagram.nodeDimension([nodeDimension]) ⇒ <code>crossfilter.dimension</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the crossfilter dimension which represents the nodes (vertices) in the
diagram. Typically there will be a crossfilter instance for the nodes, and another for
the edges.
*The node dimension currently does nothing, but once selection is supported, it will be
used for filtering other charts on the same crossfilter instance based on the nodes
selected.*

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [nodeDimension] | <code>crossfilter.dimension</code> | 

<a name="dc_graph.diagram+nodeGroup"></a>

#### diagram.nodeGroup([nodeGroup]) ⇒ <code>crossfilter.group</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the crossfilter group which is the data source for the nodes in the
diagram. The diagram will use the group's `.all()` method to get an array of `{key,
value}` pairs, where the key is a unique identifier, and the value is usually an object
containing the node's attributes. All accessors work with these key/value pairs.
If the group is changed or returns different values, the next call to `.redraw()` will
reflect the changes incrementally.
It is possible to pass another object with the same `.all()` interface instead of a
crossfilter group.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [nodeGroup] | <code>crossfilter.group</code> | 

<a name="dc_graph.diagram+edgeDimension"></a>

#### diagram.edgeDimension([edgeDimension]) ⇒ <code>crossfilter.dimension</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the crossfilter dimension which represents the edges in the
diagram. Typically there will be a crossfilter instance for the nodes, and another for
the edges.
*The edge dimension currently does nothing, but once selection is supported, it will be
used for filtering other charts on the same crossfilter instance based on the edges
selected.*

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [edgeDimension] | <code>crossfilter.dimension</code> | 

<a name="dc_graph.diagram+edgeGroup"></a>

#### diagram.edgeGroup([edgeGroup]) ⇒ <code>crossfilter.group</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the crossfilter group which is the data source for the edges in the
diagram. See `.nodeGroup` above for the way data is loaded from a crossfilter group.
The values in the key/value pairs returned by `diagram.edgeGroup().all()` need to
support, at a minimum, the [nodeSource](dc_graph.diagram#nodeSource) and
[nodeTarget](dc_graph.diagram#nodeTarget), which should return the same
keys as the [nodeKey](#dc_graph.diagram+nodeKey)

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [edgeGroup] | <code>crossfilter.group</code> | 

<a name="dc_graph.diagram+nodeKey"></a>

#### diagram.nodeKey([nodeKey]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the unique key for each node. By
default, this accesses the `key` field of the object passed to it. The keys should match
the keys returned by the [edgeSource](#dc_graph.diagram+edgeSource) and
[edgeTarget](#dc_graph.diagram+edgeTarget).

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeKey] | <code>function</code> | <code>function(kv) { return kv.key }</code> | 

<a name="dc_graph.diagram+edgeKey"></a>

#### diagram.edgeKey([edgeKey]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the unique key for each edge. By
default, this accesses the `key` field of the object passed to it.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeKey] | <code>function</code> | <code>function(kv) { return kv.key }</code> | 

<a name="dc_graph.diagram+edgeSource"></a>

#### diagram.edgeSource([edgeSource]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the source (origin/tail) key of
the edge objects.  The key must equal the key returned by the `.nodeKey` for one of the
nodes; if it does not, or if the node is currently filtered out, the edge will not be
displayed. By default, looks for `.value.sourcename`.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeSource] | <code>function</code> | <code>function(kv) { return kv.value.sourcename; }</code> | 

<a name="dc_graph.diagram+edgeTarget"></a>

#### diagram.edgeTarget([edgeTarget]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the target (destination/head) key
of the edge objects.  The key must equal the key returned by the
[nodeKey](#dc_graph.diagram+nodeKey) for one of the nodes; if it does not, or if the node
is currently filtered out, the edge will not be displayed. By default, looks for
`.value.targetname`.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeTarget] | <code>function</code> | <code>function(kv) { return kv.value.targetname; }</code> | 

<a name="dc_graph.diagram+nodeRadius"></a>

#### diagram.nodeRadius([nodeRadius]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the radius, in pixels, for each
node. This determines the height of nodes,and if `nodeFitLabel` is false, the width too.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeRadius] | <code>function</code> &#124; <code>Number</code> | <code>25</code> | 

<a name="dc_graph.diagram+nodeStrokeWidth"></a>

#### diagram.nodeStrokeWidth([nodeStrokeWidth]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the stroke width, in pixels, for
drawing the outline of each node. According to the SVG specification, the outline will
be drawn half on top of the fill, and half outside. Default: 1

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeStrokeWidth] | <code>function</code> &#124; <code>Number</code> | <code>1</code> | 

<a name="dc_graph.diagram+nodeStroke"></a>

#### diagram.nodeStroke([nodeStroke]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the stroke color for the outline
of each node.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeStroke] | <code>function</code> &#124; <code>String</code> | <code>&#x27;black&#x27;</code> | 

<a name="dc_graph.diagram+nodeFillScale"></a>

#### diagram.nodeFillScale([nodeFillScale]) ⇒ <code>function</code> &#124; <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
If set, the value returned from `nodeFill` will be processed through this
[d3.scale](https://github.com/mbostock/d3/wiki/Scales)
to return the fill color. If falsy, uses the identity function (no scale).

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [nodeFillScale] | <code>function</code> &#124; <code>d3.scale</code> | 

<a name="dc_graph.diagram+nodeFill"></a>

#### diagram.nodeFill([nodeFill]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the fill color for the body of each
node.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeFill] | <code>function</code> &#124; <code>String</code> | <code>&#x27;white&#x27;</code> | 

<a name="dc_graph.diagram+nodeOpacity"></a>

#### diagram.nodeOpacity([nodeOpacity]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the opacity of each node.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeOpacity] | <code>function</code> &#124; <code>Number</code> | <code>1</code> | 

<a name="dc_graph.diagram+nodePadding"></a>

#### diagram.nodePadding([nodePadding]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the padding or minimum distance, in pixels, for a node. (Will be distributed
to both sides of the node.)

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodePadding] | <code>function</code> &#124; <code>Number</code> | <code>6</code> | 

<a name="dc_graph.diagram+nodeLabel"></a>

#### diagram.nodeLabel([nodeLabel]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the label text to display in each
node. By default, looks for a field `label` or `name` inside the `value` field.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [nodeLabel] | <code>function</code> &#124; <code>String</code> | 

**Example**  
```js
// Default behavior
diagram.nodeLabel(function(kv) {
  return kv.value.label || kv.value.name;
});
```
<a name="dc_graph.diagram+nodeLabelFill"></a>

#### diagram.nodeLabelFill([nodeLabelFill]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the label fill color. Default: null

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeLabelFill] | <code>function</code> &#124; <code>String</code> | <code></code> | 

<a name="dc_graph.diagram+nodeFitLabel"></a>

#### diagram.nodeFitLabel([nodeFitLabel]) ⇒ <code>function</code> &#124; <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Whether to fit the node shape around the label

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeFitLabel] | <code>function</code> &#124; <code>Boolean</code> | <code>true</code> | 

<a name="dc_graph.diagram+nodeShape"></a>

#### diagram.nodeShape([nodeShape]) ⇒ <code>function</code> &#124; <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
The shape to use for drawing each node, specified as an object with at least the field
`shape`. The names of shapes are mostly taken
[from graphviz](http://www.graphviz.org/doc/info/shapes.html); currently ellipse, egg,
triangle, rectangle, diamond, trapezium, parallelogram, pentagon, hexagon, septagon, octagon,
invtriangle, invtrapezium, square, polygon are supported.

If `shape = polygon`:
* `sides`: number of sides for a polygon

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeShape] | <code>function</code> &#124; <code>Object</code> | <code>{shape: &#x27;ellipse&#x27;}</code> | 

**Example**  
```js
// set shape to diamond or parallelogram based on flag
diagram.nodeShape(function(kv) {
  return {shape: kv.value.flag ? 'diamond' : 'parallelogram'};
});
```
<a name="dc_graph.diagram+nodeTitle"></a>

#### diagram.nodeTitle([nodeTitle]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the node title, usually rendered
as a tooltip. By default, uses the key of the node.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [nodeTitle] | <code>function</code> &#124; <code>String</code> | 

**Example**  
```js
// Default behavior
chart.nodeTitle(function(kv) {
  return _chart.nodeKey()(kv);
});
```
<a name="dc_graph.diagram+nodeOrdering"></a>

#### diagram.nodeOrdering([nodeOrdering]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
By default, nodes are added to the layout in the order that `.nodeGroup().all()` returns
them. If specified, `.nodeOrdering` provides an accessor that returns a key to sort the
nodes on.  *It would be better not to rely on ordering to affect layout, but it may
affect the layout in some cases.*

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeOrdering] | <code>function</code> | <code></code> | 

<a name="dc_graph.diagram+nodeFixed"></a>

#### diagram.nodeFixed([nodeFixed]) ⇒ <code>function</code> &#124; <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Specify an accessor that returns an {x,y} coordinate for a node that should be
[fixed in place](https://github.com/tgdwyer/WebCola/wiki/Fixed-Node-Positions),
and returns falsy for other nodes.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodeFixed] | <code>function</code> &#124; <code>Object</code> | <code></code> | 

<a name="dc_graph.diagram+edgeStroke"></a>

#### diagram.edgeStroke([edgeStroke]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the stroke color for the edges.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeStroke] | <code>function</code> &#124; <code>String</code> | <code>&#x27;black&#x27;</code> | 

<a name="dc_graph.diagram+edgeStrokeWidth"></a>

#### diagram.edgeStrokeWidth([edgeStrokeWidth]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the stroke width for the edges.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeStrokeWidth] | <code>function</code> &#124; <code>Number</code> | <code>1</code> | 

<a name="dc_graph.diagram+edgeOpacity"></a>

#### diagram.edgeOpacity([edgeOpacity]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the edge opacity, a number from 0
to 1.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeOpacity] | <code>function</code> &#124; <code>Number</code> | <code>1</code> | 

<a name="dc_graph.diagram+edgeLabel"></a>

#### diagram.edgeLabel([edgeLabel]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the edge label text. The label is
displayed when an edge is hovered over. By default, uses the `edgeKey`.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [edgeLabel] | <code>function</code> &#124; <code>String</code> | 

**Example**  
```js
// Default behavior
chart.edgeLabel(function(d) {
  return _chart.edgeKey()(d);
});
```
<a name="dc_graph.diagram+edgeArrowhead"></a>

#### diagram.edgeArrowhead([edgeArrowhead]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the name of the arrowhead to use
for the target/ head/destination of the edge. Arrow symbols can be specified with
`.defineArrow()`. Return null to display no arrowhead.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeArrowhead] | <code>function</code> &#124; <code>String</code> | <code>&#x27;vee&#x27;</code> | 

<a name="dc_graph.diagram+edgeArrowtail"></a>

#### diagram.edgeArrowtail([edgeArrowtail]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set or get the function which will be used to retrieve the name of the arrow tail to use
for the tail/source of the edge. Arrow symbols can be specified with
`.defineArrow()`. Return null to display no arrowtail.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeArrowtail] | <code>function</code> &#124; <code>String</code> | <code></code> | 

<a name="dc_graph.diagram+edgeArrowSize"></a>

#### diagram.edgeArrowSize([edgeArrowSize]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Multiplier for arrow size.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeArrowSize] | <code>function</code> &#124; <code>Number</code> | <code>1</code> | 

<a name="dc_graph.diagram+edgeIsLayout"></a>

#### diagram.edgeIsLayout([edgeIsLayout]) ⇒ <code>function</code> &#124; <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
To draw an edge but not have it affect the layout, specify a function which returns
false for that edge.  By default, will return false if the `notLayout` field of the edge
value is truthy, true otherwise.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [edgeIsLayout] | <code>function</code> &#124; <code>Boolean</code> | 

**Example**  
```js
// Default behavior
chart.edgeIsLayout(function(kv) {
  return !kv.value.notLayout;
});
```
<a name="dc_graph.diagram+lengthStrategy"></a>

#### diagram.lengthStrategy([lengthStrategy]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Currently, three strategies are supported for specifying the lengths of edges:
* 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
`baseLength`
* 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
the edge. See
[the cola.js wiki](https://github.com/tgdwyer/WebCola/wiki/link-lengths)
for more details.
'none' - no edge lengths will be specified

**Deprecated**: Use [cola_layout.lengthStrategy](#dc_graph.cola_layout+lengthStrategy) instead.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [lengthStrategy] | <code>function</code> &#124; <code>String</code> | <code>&#x27;symmetric&#x27;</code> | 

<a name="dc_graph.diagram+edgeLength"></a>

#### diagram.edgeLength([edgeLength]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
When the `.lengthStrategy` is 'individual', this accessor will be used to read the
length of each edge.  By default, reads the `distance` field of the edge. If the
distance is falsy, uses the `baseLength`.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [edgeLength] | <code>function</code> &#124; <code>Number</code> | 

**Example**  
```js
// Default behavior
chart.edgeLength(function(kv) {
  return kv.value.distance;
});
```
<a name="dc_graph.diagram+flowLayout"></a>

#### diagram.flowLayout([flowLayout])
This should be equivalent to rankdir and ranksep in the dagre/graphviz nomenclature, but for
now it is separate.

**Deprecated**: use [cola_layout.flowLayout](#dc_graph.cola_layout+flowLayout) instead.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [flowLayout] | <code>Object</code> | 

**Example**  
```js
// No flow (default)
chart.flowLayout(null)
// flow in x with min separation 200
chart.flowLayout({axis: 'x', minSeparation: 200})
```
<a name="dc_graph.diagram+rankdir"></a>

#### diagram.rankdir([rankdir])
Direction to draw ranks. Currently for dagre and expand_collapse, but I think cola could be
generated from graphviz-style since it is more general.

**Deprecated**: use [dagre_layout.rankdir](dc_graph.dagre_layout#rankdir) instead.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [rankdir] | <code>String</code> | 

<a name="dc_graph.diagram+baseLength"></a>

#### diagram.baseLength([baseLength]) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
lengths.

**Deprecated**: use [cola_layout.baseLength](#dc_graph.cola_layout+baseLength) instead.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [baseLength] | <code>Number</code> | 

<a name="dc_graph.diagram+transitionDuration"></a>

#### diagram.transitionDuration([transitionDuration]) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Gets or sets the transition duration, the length of time each change to the diagram will
be animated.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [transitionDuration] | <code>Number</code> | <code>500</code> | 

<a name="dc_graph.diagram+stageTransitions"></a>

#### diagram.stageTransitions([stageTransitions]) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
How transitions should be split into separate animations to emphasize
the delete, modify, and insert operations:
* `none`: modify and insert operations animate at the same time
* `modins`: modify operations happen before inserts
* `insmod`: insert operations happen before modifies

Deletions always happen before/during layout computation.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [stageTransitions] | <code>String</code> | <code>&#x27;none&#x27;</code> | 

<a name="dc_graph.diagram+deleteDelay"></a>

#### diagram.deleteDelay([deleteDelay]) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
The delete transition happens simultaneously with layout, which can take longer
than the transition duration. Delaying it can bring it closer to the other
staged transitions.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [deleteDelay] | <code>Number</code> | <code>0</code> | 

<a name="dc_graph.diagram+groupConnected"></a>

#### diagram.groupConnected([stageTransitions]) ⇒ <code>String</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Whether to put connected components each in their own group, to stabilize layout.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [stageTransitions] | <code>String</code> | <code>false</code> | 

<a name="dc_graph.diagram+timeLimit"></a>

#### diagram.timeLimit([timeLimit]) ⇒ <code>function</code> &#124; <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Gets or sets the maximum time spent doing layout for a render or redraw. Set to 0 for no
limit.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [timeLimit] | <code>function</code> &#124; <code>Number</code> | <code>0</code> | 

<a name="dc_graph.diagram+constrain"></a>

#### diagram.constrain([constrain]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Gets or sets a function which will be called with the current nodes and edges on each
redraw in order to derive new layout constraints. The constraints are built from scratch
on each redraw.
This can be used to generate alignment (rank) or axis constraints. By default, no
constraints will be added, although cola.js uses constraints internally to implement
flow and overlap prevention. See
[the cola.js wiki](https://github.com/tgdwyer/WebCola/wiki/Constraints)
for more details.
For convenience, dc.graph.js implements a other constraints on top of those implemented
by cola.js:
* 'ordering' - the nodes will be ordered on the specified `axis` according to the keys
returned by the `ordering` function, by creating separation constraints using the
specified `gap`.
* 'circle' - (experimental) the nodes will be placed in a circle using "wheel"
edge lengths similar to those described in
[Scalable, Versatile, and Simple Constrained Graph Layout](http://www.csse.monash.edu.au/~tdwyer/Dwyer2009FastConstraints.pdf)
*Although this is not as performant or stable as might be desired, it may work for
simple cases. In particular, it should use edge length *constraints*, which don't yet
exist in cola.js.*

Because it is tedious to write code to generate constraints for a graph, **dc.graph.js**
also includes a [constraint generator](#dc_graph+constraint_pattern) to produce
this constrain function, specifying the constraints themselves in a graph.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [constrain] | <code>function</code> | 

<a name="dc_graph.diagram+parallelEdgeOffset"></a>

#### diagram.parallelEdgeOffset([parallelEdgeOffset]) ⇒ <code>Number</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
If there are multiple edges between the same two nodes, start them this many pixels away
from the original so they don't overlap.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [parallelEdgeOffset] | <code>Number</code> | <code>10</code> | 

<a name="dc_graph.diagram+edgeOrdering"></a>

#### diagram.edgeOrdering([edgeOrdering]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
By default, edges are added to the layout in the order that `.edgeGroup().all()` returns
them. If specified, `.edgeOrdering` provides an accessor that returns a key to sort the
edges on.
*It would be better not to rely on ordering to affect layout, but it may affect the
layout in some cases. (Probably less than node ordering, but it does affect which
parallel edge is which.)*

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [edgeOrdering] | <code>function</code> | <code></code> | 

<a name="dc_graph.diagram+initLayoutOnRedraw"></a>

#### diagram.initLayoutOnRedraw([initLayoutOnRedraw]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Currently there are some bugs when the same instance of cola.js is used multiple
times. (In particular, overlaps between nodes may not be eliminated
[if cola is not reinitialized](https://github.com/tgdwyer/WebCola/issues/118)
This flag can be set true to construct a new cola layout object on each redraw. However,
layout seems to be more stable if this is set false, so hopefully this will be fixed
soon.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [initLayoutOnRedraw] | <code>Boolean</code> | <code>false</code> | 

<a name="dc_graph.diagram+layoutUnchanged"></a>

#### diagram.layoutUnchanged([layoutUnchanged]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Whether to perform layout when the data is unchanged from the last redraw.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [layoutUnchanged] | <code>Boolean</code> | <code>false</code> | 

<a name="dc_graph.diagram+relayout"></a>

#### diagram.relayout() ⇒ <code>[diagram](#dc_graph.diagram)</code>
When `layoutUnchanged` is false, this will force layout to happen again. This may be needed
when changing a parameter but not changing the topology of the graph. (Yes, probably should
not be necessary.)

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.diagram+initialLayout"></a>

#### diagram.initialLayout([initialLayout]) ⇒ <code>function</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Function to call to generate an initial layout. Takes (diagram, nodes, edges)

**Deprecated**: The only layout that was using this was `tree_positions` and it never
worked as an initialization step for cola, as was originally intended. Now that
`tree_layout` is a layout algorithm, this should go away.

In the future, there will be support for chaining layout algorithms. But that will be a
matter of composing them into a super-algorithm, not a special step like this was.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [initialLayout] | <code>function</code> | <code></code> | 

<a name="dc_graph.diagram+induceNodes"></a>

#### diagram.induceNodes([induceNodes]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
By default, all nodes are included, and edges are only included if both end-nodes are
visible.  If `.induceNodes` is set, then only nodes which have at least one edge will be
shown.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [induceNodes] | <code>Boolean</code> | <code>false</code> | 

<a name="dc_graph.diagram+showLayoutSteps"></a>

#### diagram.showLayoutSteps([showLayoutSteps]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
If this flag is true, the positions of nodes and will be updated while layout is
iterating. If false, the positions will only be updated once layout has
stabilized. Note: this may not be compatible with transitionDuration.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [showLayoutSteps] | <code>Boolean</code> | <code>false</code> | 

<a name="dc_graph.diagram+legend"></a>

#### diagram.legend([legend]) ⇒ <code>Object</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Assigns a legend object which will be displayed within the same SVG element and
according to the visual encoding of this diagram.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [legend] | <code>Object</code> | <code></code> | 

<a name="dc_graph.diagram+child"></a>

#### diagram.child([id], [object]) ⇒ <code>[diagram](#dc_graph.diagram)</code>
Specifies another kind of child layer or interface. For example, this can
be used to display tooltips on nodes using `dc_graph.tip`.
The child needs to support a `parent` method, the diagram to modify.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Description |
| --- | --- | --- |
| [id] | <code>String</code> | the name of the child to modify or add |
| [object] | <code>Object</code> | the child object to add, or null to remove |

**Example**  
```js
// Display tooltips on node hover, via the d3-tip library
var tip = dc_graph.tip()
tip.content(function(d, k) {
  // you can do an asynchronous call here, e.g. d3.json, if you need
  // to fetch data to show the tooltip - just call k() with the content
  k("This is <em>" + d.orig.value.name + "</em>");
});
diagram.child('tip', tip);
```
<a name="dc_graph.diagram+layoutAlgorithm"></a>

#### diagram.layoutAlgorithm([algo]) ⇒ <code>[diagram](#dc_graph.diagram)</code>
Specify 'cola' (the default) or 'dagre' as the Layout Algorithm and it will replace the
back-end.

**Deprecated**: use [diagram.layoutEngine](#dc_graph.diagram+layoutEngine) with the engine
object instead

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [algo] | <code>String</code> | <code>&#x27;cola&#x27;</code> | the name of the layout algorithm to use |

**Example**  
```js
// use dagre for layout
diagram.layoutAlgorithm('dagre');
```
<a name="dc_graph.diagram+layoutEngine"></a>

#### diagram.layoutEngine([engine])
The layout engine determines how to draw things!

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [engine] | <code>Object</code> | <code></code> | the layout engine to use |

**Example**  
```js
// use cola with no webworker
diagram.layoutEngine(dc_graph.cola_layout());
// use dagre with a webworker
diagram.layoutEngine(dc_graph.webworker_layout(dc_graph.dagre_layout()));
```
<a name="dc_graph.diagram+handleDisconnected"></a>

#### diagram.handleDisconnected([handleDisconnected]) ⇒ <code>Boolean</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Instructs cola.js to fit the connected components.

**Deprecated**: Use
[cola_layout.handleDisconnected](#dc_graph.cola_layout+handleDisconnected) instead.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [handleDisconnected] | <code>Boolean</code> | <code>true</code> | 

<a name="dc_graph.diagram+render"></a>

#### diagram.render() ⇒ <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Erases any existing SVG elements and draws the diagram from scratch. `.render()`
must be called the first time, and `.redraw()` can be called after that.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.diagram+on"></a>

#### diagram.on([event], [f]) ⇒ <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Attaches an event handler to the diagram. The currently supported events are
* `start()` - layout is starting
* `drawn(nodes, edges)` - the node and edge elements have been rendered to the screen
and can be modified through the passed d3 selections.
* `end()` - diagram layout has completed.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Description |
| --- | --- | --- |
| [event] | <code>String</code> | the event to subscribe to |
| [f] | <code>function</code> | the event handler |

<a name="dc_graph.diagram+getStats"></a>

#### diagram.getStats() ⇒ <code>[diagram](#dc_graph.diagram)</code>
Returns an object with current statistics on graph layout.
* `nnodes` - number of nodes displayed
* `nedges` - number of edges displayed

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.diagram+select"></a>

#### diagram.select([selector]) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Execute a d3 single selection in the diagram's scope using the given selector
and return the d3 selection. Roughly the same as
```js
d3.select('#diagram-id').select(selector)
```
Since this function returns a d3 selection, it is not chainable. (However, d3 selection
calls can be chained after it.)

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [selector] | <code>String</code> | 

<a name="dc_graph.diagram+selectAll"></a>

#### diagram.selectAll([selector]) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Selects all elements that match the d3 single selector in the diagram's scope,
and return the d3 selection. Roughly the same as
```js
d3.select('#diagram-id').selectAll(selector)
```
Since this function returns a d3 selection, it is not chainable. (However, d3 selection
calls can be chained after it.)

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [selector] | <code>String</code> | 

<a name="dc_graph.diagram+x"></a>

#### diagram.x([scale]) ⇒ <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Gets or sets the x scale.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [scale] | <code>d3.scale</code> | 

<a name="dc_graph.diagram+x"></a>

#### diagram.x([scale]) ⇒ <code>d3.scale</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Gets or sets the y scale.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [scale] | <code>d3.scale</code> | 

<a name="dc_graph.diagram+svg"></a>

#### diagram.svg([selection]) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Returns the top `svg` element for this specific chart. You can also pass in a new
svg element, but setting the svg element on a diagram may have unexpected consequences.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [selection] | <code>d3.selection</code> | 

<a name="dc_graph.diagram+g"></a>

#### diagram.g([selection]) ⇒ <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Returns the top `g` element for this specific chart. This method is usually used to
retrieve the g element in order to overlay custom svg drawing
programatically. **Caution**: The root g element is usually generated internally, and
resetting it might produce unpredictable results.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [selection] | <code>d3.selection</code> | 

<a name="dc_graph.diagram+resetSvg"></a>

#### diagram.resetSvg() ⇒ <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Remove the diagram's SVG elements from the dom and recreate the container SVG
element.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.diagram+redrawGroup"></a>

#### diagram.redrawGroup() ⇒ <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Causes all charts in the chart group to be redrawn.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.diagram+renderGroup"></a>

#### diagram.renderGroup() ⇒ <code>[diagram](#dc_graph.diagram)</code>
Standard dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin)
method. Causes all charts in the chart group to be rendered.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.diagram+defineArrow"></a>

#### diagram.defineArrow(name, width, height, refX, refY, drawf) ⇒ <code>[diagram](#dc_graph.diagram)</code>
Creates an svg marker definition for drawing edge arrow tails or heads. The `viewBox` of
the marker is `0 -5 10 10`, so the arrow should be drawn from (0, -5) to (10, 5); it
will be moved and sized based on the other parameters, and rotated based on the
orientation of the edge.
(If further customization is required, it is possible to append other `svg:defs` to
`chart.svg()` and use refer to them by `id`.)

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>Number</code> | the identifier to give the marker, to be used with [edgeArrowhead](#dc_graph.diagram+edgeArrowhead) or [edgeArrowtail](#dc_graph.diagram+edgeArrowtail) |
| width | <code>Number</code> | the width, in pixels, to draw the marker |
| height | <code>Number</code> | the height, in pixels, to draw the marker |
| refX | <code>Number</code> | the X reference position, in marker coordinates, which will be aligned to the endpoint of the edge |
| refY | <code>Number</code> | the Y reference position |
| drawf | <code>function</code> | a function to draw the marker using d3 SVG primitives, which takes the marker object as its parameter. |

**Example**  
```js
// the built-in `vee` arrow is defined like so:
_chart.defineArrow('vee', 12, 12, 10, 0, function(marker) {
  marker.append('svg:path')
    .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
    .attr('stroke-width', '0px');
});
```
<a name="dc_graph.diagram+anchor"></a>

#### diagram.anchor([parent], [chartGroup]) ⇒ <code>String</code> &#124; <code>node</code> &#124; <code>d3.selection</code> &#124; <code>[diagram](#dc_graph.diagram)</code>
Set the root SVGElement to either be any valid [d3 single
selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom
block element such as a div; or a dom element or d3 selection. This class is called
internally on chart initialization, but be called again to relocate the chart. However, it
will orphan any previously created SVGElements.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  

| Param | Type |
| --- | --- |
| [parent] | <code>anchorSelector</code> &#124; <code>anchorNode</code> &#124; <code>d3.selection</code> | 
| [chartGroup] | <code>String</code> | 

<a name="dc_graph.diagram+anchorName"></a>

#### diagram.anchorName() ⇒ <code>String</code>
Returns the DOM id for the chart's anchored location.

**Kind**: instance method of <code>[diagram](#dc_graph.diagram)</code>  
<a name="dc_graph.graphviz_attrs"></a>

### dc_graph.graphviz_attrs
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  

* [.graphviz_attrs](#dc_graph.graphviz_attrs)
    * [new graphviz_attrs()](#new_dc_graph.graphviz_attrs_new)
    * [.rankdir([rankdir])](#dc_graph.graphviz_attrs+rankdir)
    * [.nodesep([nodesep])](#dc_graph.graphviz_attrs+nodesep)
    * [.ranksep([ranksep])](#dc_graph.graphviz_attrs+ranksep)

<a name="new_dc_graph.graphviz_attrs_new"></a>

#### new graphviz_attrs()
`dc_graph.graphviz_attrs defines a basic set of attributes which layout engines should
implement - although these are not required, they make it easier for clients and
behaviors (like expand_collapse) to work with multiple layout engines.

these attributes are [from graphviz](http://www.graphviz.org/doc/info/attrs.html)

<a name="dc_graph.graphviz_attrs+rankdir"></a>

#### graphviz_attrs.rankdir([rankdir])
Direction to draw ranks.

**Kind**: instance method of <code>[graphviz_attrs](#dc_graph.graphviz_attrs)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [rankdir] | <code>String</code> | <code>&#x27;TB&#x27;</code> | 'TB', 'LR', 'BT', or 'RL' |

<a name="dc_graph.graphviz_attrs+nodesep"></a>

#### graphviz_attrs.nodesep([nodesep])
Spacing in between nodes in the same rank.

**Kind**: instance method of <code>[graphviz_attrs](#dc_graph.graphviz_attrs)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [nodesep] | <code>String</code> | <code>40</code> | 

<a name="dc_graph.graphviz_attrs+ranksep"></a>

#### graphviz_attrs.ranksep([ranksep])
Spacing in between ranks.

**Kind**: instance method of <code>[graphviz_attrs](#dc_graph.graphviz_attrs)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [ranksep] | <code>String</code> | <code>40</code> | 

<a name="dc_graph.cola_layout"></a>

### dc_graph.cola_layout
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  

* [.cola_layout](#dc_graph.cola_layout)
    * [new cola_layout([id])](#new_dc_graph.cola_layout_new)
    * [.handleDisconnected([handleDisconnected])](#dc_graph.cola_layout+handleDisconnected) ⇒ <code>Boolean</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
    * [.lengthStrategy([lengthStrategy])](#dc_graph.cola_layout+lengthStrategy) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
    * [.baseLength([baseLength])](#dc_graph.cola_layout+baseLength) ⇒ <code>Number</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
    * [.flowLayout([flowLayout])](#dc_graph.cola_layout+flowLayout)

<a name="new_dc_graph.cola_layout_new"></a>

#### new cola_layout([id])
`dc_graph.cola_layout` is an adaptor for cola.js layouts in dc.graph.js


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="dc_graph.cola_layout+handleDisconnected"></a>

#### cola_layout.handleDisconnected([handleDisconnected]) ⇒ <code>Boolean</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
Instructs cola.js to fit the connected components.

**Kind**: instance method of <code>[cola_layout](#dc_graph.cola_layout)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [handleDisconnected] | <code>Boolean</code> | <code>true</code> | 

<a name="dc_graph.cola_layout+lengthStrategy"></a>

#### cola_layout.lengthStrategy([lengthStrategy]) ⇒ <code>function</code> &#124; <code>String</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
Currently, three strategies are supported for specifying the lengths of edges:
* 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
`baseLength`
* 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
the edge. See
[the cola.js wiki](https://github.com/tgdwyer/WebCola/wiki/link-lengths)
for more details.
'none' - no edge lengths will be specified

**Kind**: instance method of <code>[cola_layout](#dc_graph.cola_layout)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [lengthStrategy] | <code>function</code> &#124; <code>String</code> | <code>&#x27;symmetric&#x27;</code> | 

<a name="dc_graph.cola_layout+baseLength"></a>

#### cola_layout.baseLength([baseLength]) ⇒ <code>Number</code> &#124; <code>[cola_layout](#dc_graph.cola_layout)</code>
Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
lengths.

**Kind**: instance method of <code>[cola_layout](#dc_graph.cola_layout)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [baseLength] | <code>Number</code> | <code>30</code> | 

<a name="dc_graph.cola_layout+flowLayout"></a>

#### cola_layout.flowLayout([flowLayout])
If `flowLayout` is set, it determines the axis and separation for
[cola flow layout](http://marvl.infotech.monash.edu/webcola/doc/classes/cola.layout.html#flowlayout).
If it is not set, `flowLayout` will be calculated from the [rankdir](#dc_graph.graphviz_attrs+rankdir)
and [ranksep](#dc_graph.graphviz_attrs+ranksep); if `rankdir` is also null (the
default for cola layout), then there will be no flow.

**Kind**: instance method of <code>[cola_layout](#dc_graph.cola_layout)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [flowLayout] | <code>Object</code> | <code></code> | 

**Example**  
```js
// No flow (default)
chart.flowLayout(null)
// flow in x with min separation 200
chart.flowLayout({axis: 'x', minSeparation: 200})
```
<a name="dc_graph.dagre_layout"></a>

### dc_graph.dagre_layout
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  
<a name="new_dc_graph.dagre_layout_new"></a>

#### new dagre_layout([id])
`dc_graph.dagre_layout` is an adaptor for dagre.js layouts in dc.graph.js

In addition to the below layout attributes, `dagre_layout` also implements the attributes from
[graphviz_attrs](#dc_graph.graphviz_attrs)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="dc_graph.tree_layout"></a>

### dc_graph.tree_layout
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  
<a name="new_dc_graph.tree_layout_new"></a>

#### new tree_layout([id])
`dc_graph.tree_layout` is a very simple and not very bright tree layout. It can draw any DAG, but
tries to position the nodes as a tree.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="dc_graph.graphviz_layout"></a>

### dc_graph.graphviz_layout
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  
<a name="new_dc_graph.graphviz_layout_new"></a>

#### new graphviz_layout([id])
`dc_graph.graphviz_layout` is an adaptor for viz.js (graphviz) layouts in dc.graph.js

In addition to the below layout attributes, `graphviz_layout` also implements the attributes from
[graphviz_attrs](#dc_graph.graphviz_attrs)


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="dc_graph.constraint_pattern"></a>

### dc_graph.constraint_pattern
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  
<a name="new_dc_graph.constraint_pattern_new"></a>

#### new constraint_pattern(diagram, pattern)
In cola.js there are three factors which influence the positions of nodes:
* *edge length* suggestions, controlled by the
[lengthStrategy](#dc_graph.diagram+lengthStrategy),
[baseLength](#dc_graph.diagram+baseLength), and
[edgeLength](#dc_graph.diagram+edgeLength) parameters in dc.graph.js
* *automatic constraints* based on the global edge flow direction (`cola.flowLayout`) and overlap
avoidance parameters (`cola.avoidOverlaps`)
* *manual constraints* such as alignment, inequality and equality constraints in a dimension/axis.

Generally when the
[cola.js documentation mentions constraints](https://github.com/tgdwyer/WebCola/wiki/Constraints),
it means the manual constraints.

dc.graph.js allows generation of manual constraints using
[diagram.constrain](#dc_graph.diagram+constrain) but it can be tedious to write these
functions because it usually means looping over the nodes and edges multiple times to
determine what classes or types of nodes to apply constraints to, and which edges should
take additional constraints.

This utility creates a constraint generator function from a *pattern*, a graph where:
 1. Nodes represent *types* or classes of layout nodes, annotated with a specification
of how to match the nodes belonging each type.
 2. Edges represent *rules* to generate constraints. There are two kinds of rules:
<ol type='a'>
   <li>To generate additional constraints on edges besides the built-in ones, create a rules
between two different types. The rule will apply to any edges in the layout which match the
source and target types, and generate simple "left/right" constraints. (Note that "left" and
"right" in this context refer to sides of an inequality constraint `left + gap <= right`)
   <li>To generate constraints on a set of nodes, such as alignment, ordering, or circle
constraints, create a rule from a type to itself, a self edge.
</ol>
(It is also conceivable to want constraints between individual nodes which don't
have edges between them. This is not directly supported at this time; right now the workaround
is to create the edge but not draw it, e.g. by setting its [#dc_graph.diagram+edgeOpacity](#dc_graph.diagram+edgeOpacity)
to zero. If you have a use-case for this, please
[file an issue](https://github.com/dc-js/dc.graph.js/issues/new).

The pattern syntax is an embedded domain specific language designed to be terse without
restricting its power. As such, there are complicated rules for defaulting and inferring
parameters from other parameters. Since most users will want the simplest form, this document
will start from the highest level and then show how to use more complicated forms in order to
gain more control.

Then we'll build back up from the ground up and show how inference works.


| Param | Type | Description |
| --- | --- | --- |
| diagram | <code>[diagram](#dc_graph.diagram)</code> | the diagram to pull attributes from, mostly to determine the keys of nodes and edge sources and targets |
| pattern | <code>Object</code> | a graph which defines the constraints to be generated |

<a name="dc_graph.tip"></a>

### dc_graph.tip
**Kind**: static class of <code>[dc_graph](#dc_graph)</code>  

* [.tip](#dc_graph.tip)
    * [new tip()](#new_dc_graph.tip_new)
    * [.direction](#dc_graph.tip+direction) ⇒ <code>String</code> &#124; <code>[tip](#dc_graph.tip)</code>
    * [.content](#dc_graph.tip+content) ⇒ <code>function</code>
    * [.table](#dc_graph.tip+table) ⇒ <code>function</code>

<a name="new_dc_graph.tip_new"></a>

#### new tip()
Asynchronous [d3.tip](https://github.com/Caged/d3-tip) support for dc.graph.js

Add tooltips to the nodes and edges of a graph using an asynchronous callback to get
the html to show.

Optional - requires separately loading the d3.tip script and CSS (which are included in
dc.graph.js in `web/js/d3-tip/index.js` and `web/css/d3-tip/example-styles.css`)

<a name="dc_graph.tip+direction"></a>

#### tip.direction ⇒ <code>String</code> &#124; <code>[tip](#dc_graph.tip)</code>
Specify the direction for tooltips. Currently supports the
[cardinal and intercardinal directions](https://en.wikipedia.org/wiki/Points_of_the_compass) supported by
[d3.tip.direction](https://github.com/Caged/d3-tip/blob/master/docs/positioning-tooltips.md#tipdirection):
`'n'`, `'ne'`, `'e'`, etc.

**Kind**: instance property of <code>[tip](#dc_graph.tip)</code>  

| Param | Type | Default |
| --- | --- | --- |
| [direction] | <code>String</code> | <code>&#x27;n&#x27;</code> | 

**Example**  
```js
// show all the attributes and values in the node and edge objects
var tip = dc_graph.tip();
tip.content(tip.table());
```
<a name="dc_graph.tip+content"></a>

#### tip.content ⇒ <code>function</code>
Specifies the function to generate content for the tooltip. This function has the
signature `function(d, k)`, where `d` is the datum of the node being hovered over,
and `k` is a continuation. The function should fetch the content, asynchronously if
needed, and then pass html forward to `k`.

**Kind**: instance property of <code>[tip](#dc_graph.tip)</code>  

| Param | Type |
| --- | --- |
| [content] | <code>function</code> | 

**Example**  
```js
// Default behavior: show title
var tip = dc_graph.tip().content(function(d, k) {
    k(_behavior.parent() ? _behavior.parent().nodeTitle.eval(d) : '');
});
```
<a name="dc_graph.tip+table"></a>

#### tip.table ⇒ <code>function</code>
Generates a handler which can be passed to `tip.content` to produce a table of the
attributes and values of the hovered object.

Note: this interface is not great and is subject to change in the near term.

**Kind**: instance property of <code>[tip](#dc_graph.tip)</code>  
**Example**  
```js
// show all the attributes and values in the node and edge objects
var tip = dc_graph.tip();
tip.content(dc_graph.tip.table());
```
<a name="dc_graph.flat_group"></a>

### dc_graph.flat_group : <code>object</code>
`dc_graph.flat_group` implements a special ["fake group"](https://github.com/dc-js/dc.js/wiki/FAQ#fake-groups)
for the special case where you want a group that represents the filtered rows of the crossfilter.

Although `dc_graph` can be used with reduced data, typically the nodes and edges are just rows of
the corresponding data arrays, and each array has a column which contains the unique identifier
for the node or edge. In this setup, there are other dimensions and groups which are aggregated
for the use of dc.js charts, but the graph just shows or does not show the nodes and edges from
the rows.

This simple class supports that use case in three steps:
 1. It creates a dimension keyed on the unique identifier (specified to `flat_group.make`)
 2. It creates a group from the dimension with a reduction function that returns the row when the
 row is filtered in, and `null` when the row is filtered out.
 3. It wraps the group in a fake group which filters out the resulting nulls.

The result is a fake group whose `.all()` method returns an array of the currently filtered-in
`{key, value}` pairs, where the key is that returned by the ID accessor, and the value is the raw
row object from the data.

This could be a useful crossfilter utility outside of dc.graph. For example, bubble charts and
scatter plots often use similar functionality because each observation is either shown or not,
and it is helpful to have the entire row available as reduced data.

But it would need to be generalized and cleaned up. (For example, the way it has to create the
crossfilter and dimension is kinda dumb.) And there is currently no such crossfilter utility
library to put it in.

**Kind**: static namespace of <code>[dc_graph](#dc_graph)</code>  

* [.flat_group](#dc_graph.flat_group) : <code>object</code>
    * [.make(vec, id_accessor)](#dc_graph.flat_group.make) ⇒ <code>Object</code>
    * [.another(ndx, id_accessor)](#dc_graph.flat_group.another) ⇒ <code>Object</code>

<a name="dc_graph.flat_group.make"></a>

#### flat_group.make(vec, id_accessor) ⇒ <code>Object</code>
Create a crossfilter, dimension, and flat group, as described in [flat_group](#dc_graph.flat_group).
Returns an object containing all three.

**Kind**: static method of <code>[flat_group](#dc_graph.flat_group)</code>  
**Returns**: <code>Object</code> - `{crossfilter, dimension, group}`  

| Param | Type | Description |
| --- | --- | --- |
| vec | <code>Array</code> | the data array for crossfilter |
| id_accessor | <code>function</code> | accessor function taking a row object and returning its unique identifier |

<a name="dc_graph.flat_group.another"></a>

#### flat_group.another(ndx, id_accessor) ⇒ <code>Object</code>
Create a flat dimension and group from an existing crossfilter.

This is a wretched name for this function.

**Kind**: static method of <code>[flat_group](#dc_graph.flat_group)</code>  
**Returns**: <code>Object</code> - `{crossfilter, dimension, group}`  

| Param | Type | Description |
| --- | --- | --- |
| ndx | <code>Object</code> | crossfilter instance |
| id_accessor | <code>function</code> | accessor function taking a row object and returning its unique identifier |

