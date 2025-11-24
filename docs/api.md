## Modules

<dl>
<dt><a href="#module_cola_layout">cola_layout</a></dt>
<dd><p>Cola.js layout adaptor for dc.graph.js</p>
</dd>
<dt><a href="#module_core">core</a></dt>
<dd><p>Core utilities and functions for dc.graph.js</p>
</dd>
<dt><a href="#module_d3v4_force_layout">d3v4_force_layout</a></dt>
<dd><p>D3 v4 force layout adaptor for dc.graph.js</p>
</dd>
<dt><a href="#module_dagre_layout">dagre_layout</a></dt>
<dd><p>Dagre.js layout adaptor for dc.graph.js</p>
</dd>
<dt><a href="#module_depth_first_traversal">depth_first_traversal</a></dt>
<dd><p>Depth first traversal utility</p>
</dd>
<dt><a href="#module_diagram">diagram</a></dt>
<dd><p>Main diagram component for dc.graph.js</p>
</dd>
<dt><a href="#module_dynagraph_layout">dynagraph_layout</a></dt>
<dd><p>Dynagraph-wasm layout adaptor for dc.graph.js</p>
</dd>
<dt><a href="#module_engine">engine</a></dt>
<dd><p>Layout engine registry and management</p>
</dd>
<dt><a href="#module_flexbox_layout">flexbox_layout</a></dt>
<dd><p>Flexbox layout for dc.graph.js</p>
</dd>
<dt><a href="#module_generate_objects">generate_objects</a></dt>
<dd><p>Object generation and management utilities</p>
</dd>
<dt><a href="#module_graphviz_attrs">graphviz_attrs</a></dt>
<dd><p>Graphviz attributes for layout engines</p>
</dd>
<dt><a href="#module_graphviz_layout">graphviz_layout</a></dt>
<dd><p>Graphviz layout for dc.graph.js</p>
</dd>
<dt><a href="#module_dc-graph">dc-graph</a></dt>
<dd><p>dc.graph.js - Graph visualization library for dc.js
Main entry point for ES6 module exports</p>
</dd>
<dt><a href="#module_layered_layout">layered_layout</a></dt>
<dd><p>Layered layout for dc.graph.js</p>
</dd>
<dt><a href="#module_manual_layout">manual_layout</a></dt>
<dd><p>Manual layout for dc.graph.js</p>
</dd>
<dt><a href="#module_tree_layout">tree_layout</a></dt>
<dd><p>Tree layout for dc.graph.js</p>
</dd>
<dt><a href="#module_webworker_layout">webworker_layout</a></dt>
<dd><p>Web worker layout wrapper</p>
</dd>
</dl>

## Classes

<dl>
<dt><a href="#brush">brush</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#constraintPattern">constraintPattern(pattern)</a> ⇒ <code>function</code></dt>
<dd><p>In cola.js there are three factors which influence the positions of nodes:</p>
<ul>
<li><em>edge length</em> suggestions, controlled by the
lengthStrategy, baseLength, and edgeLength parameters</li>
<li><em>automatic constraints</em> based on the global edge flow direction (<code>cola.flowLayout</code>) and overlap
avoidance parameters (<code>cola.avoidOverlaps</code>)</li>
<li><em>manual constraints</em> such as alignment, inequality and equality constraints in a dimension/axis.</li>
</ul>
<p>Generally when the
<a href="https://github.com/tgdwyer/WebCola/wiki/Constraints">cola.js documentation mentions constraints</a>,
it means the manual constraints.</p>
<p>This utility creates a constraint generator function from a <em>pattern</em>, a graph where:</p>
<ol>
<li>Nodes represent <em>types</em> or classes of layout nodes, annotated with a specification
of how to match the nodes belonging each type.</li>
<li>Edges represent <em>rules</em> to generate constraints. There are two kinds of rules:<ol type='a'>
   <li>To generate additional constraints on edges besides the built-in ones, create a rules
between two different types. The rule will apply to any edges in the layout which match the
source and target types, and generate simple "left/right" constraints. (Note that "left" and
"right" in this context refer to sides of an inequality constraint `left + gap <= right`)
   <li>To generate constraints on a set of nodes, such as alignment, ordering, or circle
constraints, create a rule from a type to itself, a self edge.
</ol>
(It is also conceivable to want constraints between individual nodes which don't
have edges between them. This is not directly supported at this time; right now the workaround
is to create the edge but not draw it, e.g. by setting its edgeOpacity
to zero. If you have a use-case for this, please
[file an issue](https://github.com/dc-js/dc.graph.js/issues/new).</li>
</ol>
<p>The pattern syntax is an embedded domain specific language designed to be terse without
restricting its power. As such, there are complicated rules for defaulting and inferring
parameters from other parameters. Since most users will want the simplest form, this document
will start from the highest level and then show how to use more complicated forms in order to
gain more control.</p>
<p>Then we&#39;ll build back up from the ground up and show how inference works.</p>
</dd>
</dl>

<a name="module_cola_layout"></a>

## cola\_layout
Cola.js layout adaptor for dc.graph.js

<a name="module_cola_layout.colaLayout"></a>

### cola_layout.colaLayout([id]) ⇒ <code>Object</code>
`colaLayout` is an adaptor for cola.js layouts in dc.graph.js

**Kind**: static method of [<code>cola\_layout</code>](#module_cola_layout)  
**Returns**: <code>Object</code> - cola layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="module_core"></a>

## core
Core utilities and functions for dc.graph.js

<a name="module_d3v4_force_layout"></a>

## d3v4\_force\_layout
D3 v4 force layout adaptor for dc.graph.js

<a name="module_d3v4_force_layout.d3v4ForceLayout"></a>

### d3v4_force_layout.d3v4ForceLayout([id]) ⇒ <code>Object</code>
`d3v4ForceLayout` is an adaptor for d3-force version 4 layouts in dc.graph.js

**Kind**: static method of [<code>d3v4\_force\_layout</code>](#module_d3v4_force_layout)  
**Returns**: <code>Object</code> - d3v4 force layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="module_dagre_layout"></a>

## dagre\_layout
Dagre.js layout adaptor for dc.graph.js

<a name="module_dagre_layout.dagreLayout"></a>

### dagre_layout.dagreLayout([id]) ⇒ <code>Object</code>
`dagreLayout` is an adaptor for dagre.js layouts in dc.graph.js

In addition to the below layout attributes, `dagreLayout` also implements the attributes from
[graphviz_attrs](graphvizAttrs)

**Kind**: static method of [<code>dagre\_layout</code>](#module_dagre_layout)  
**Returns**: <code>Object</code> - dagre layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="module_depth_first_traversal"></a>

## depth\_first\_traversal
Depth first traversal utility

<a name="module_diagram"></a>

## diagram
Main diagram component for dc.graph.js

<a name="module_diagram.diagram"></a>

### diagram.diagram(parent, [chartGroup]) ⇒ <code>Object</code>
`diagram` is a dc.js-compatible network visualization component. It registers in
the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
logically derives from the dc.js
[baseMixin](https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin),
but it does not physically derive from it since so much is different about network
visualization versus conventional charts.

**Kind**: static method of [<code>diagram</code>](#module_diagram)  
**Returns**: <code>Object</code> - diagram instance  

| Param | Type | Description |
| --- | --- | --- |
| parent | <code>String</code> \| <code>node</code> | Any valid [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom block element such as a div; or a dom element. |
| [chartGroup] | <code>String</code> | The name of the dc.js chart group this diagram instance should be placed in. Filter interaction with a diagram will only trigger events and redraws within the diagram's group. |

<a name="module_dynagraph_layout"></a>

## dynagraph\_layout
Dynagraph-wasm layout adaptor for dc.graph.js

<a name="module_dynagraph_layout.dynagraphLayout"></a>

### dynagraph_layout.dynagraphLayout([id], [layout]) ⇒ <code>Object</code>
`dynagraphLayout` connects to dynagraph WebAssembly module and does dynamic directed graph layout.

**Kind**: static method of [<code>dynagraph\_layout</code>](#module_dynagraph_layout)  
**Returns**: <code>Object</code> - dynagraph layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |
| [layout] | <code>String</code> |  | Layout algorithm name |

<a name="module_engine"></a>

## engine
Layout engine registry and management

<a name="module_flexbox_layout"></a>

## flexbox\_layout
Flexbox layout for dc.graph.js

<a name="module_generate_objects"></a>

## generate\_objects
Object generation and management utilities

<a name="module_graphviz_attrs"></a>

## graphviz\_attrs
Graphviz attributes for layout engines

<a name="module_graphviz_attrs.graphvizAttrs"></a>

### graphviz_attrs.graphvizAttrs() ⇒ <code>Object</code>
`graphvizAttrs` defines a basic set of attributes which layout engines should
implement - although these are not required, they make it easier for clients and
modes (like expand_collapse) to work with multiple layout engines.

these attributes are [from graphviz](http://www.graphviz.org/doc/info/attrs.html)

**Kind**: static method of [<code>graphviz\_attrs</code>](#module_graphviz_attrs)  
<a name="module_graphviz_layout"></a>

## graphviz\_layout
Graphviz layout for dc.graph.js

<a name="module_graphviz_layout.graphvizLayout"></a>

### graphviz_layout.graphvizLayout([id], [layout], [server]) ⇒ <code>Object</code>
`graphvizLayout` is an adaptor for viz.js (graphviz) layouts in dc.graph.js

In addition to the below layout attributes, `graphvizLayout` also implements the attributes from
[graphviz_attrs](graphvizAttrs)

**Kind**: static method of [<code>graphviz\_layout</code>](#module_graphviz_layout)  
**Returns**: <code>Object</code> - graphviz layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |
| [layout] | <code>String</code> |  | Layout algorithm |
| [server] | <code>String</code> |  | Server URL |

<a name="module_dc-graph"></a>

## dc-graph
dc.graph.js - Graph visualization library for dc.js
Main entry point for ES6 module exports

<a name="module_layered_layout"></a>

## layered\_layout
Layered layout for dc.graph.js

<a name="module_layered_layout.layeredLayout"></a>

### layered_layout.layeredLayout([id]) ⇒ <code>Object</code>
`layeredLayout` produces 3D layered layouts, utilizing another layout
that supports fixed nodes and position hints for the layers

**Kind**: static method of [<code>layered\_layout</code>](#module_layered_layout)  
**Returns**: <code>Object</code> - layered layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="module_manual_layout"></a>

## manual\_layout
Manual layout for dc.graph.js

<a name="module_tree_layout"></a>

## tree\_layout
Tree layout for dc.graph.js

<a name="module_tree_layout.treeLayout"></a>

### tree_layout.treeLayout([id]) ⇒ <code>Object</code>
`treeLayout` is a very simple and not very bright tree layout. It can draw any DAG, but
tries to position the nodes as a tree.

**Kind**: static method of [<code>tree\_layout</code>](#module_tree_layout)  
**Returns**: <code>Object</code> - tree layout engine  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [id] | <code>String</code> | <code>uuid()</code> | Unique identifier |

<a name="module_webworker_layout"></a>

## webworker\_layout
Web worker layout wrapper

<a name="brush"></a>

## brush
**Kind**: global class  
<a name="new_brush_new"></a>

### new brush()
`brush` is a [mode](mode) providing a simple wrapper over
[d3.svg.brush](https://github.com/d3/d3-3.x-api-reference/blob/master/SVG-Controls.md#brush)

<a name="constraintPattern"></a>

## constraintPattern(pattern) ⇒ <code>function</code>
In cola.js there are three factors which influence the positions of nodes:
* *edge length* suggestions, controlled by the
lengthStrategy, baseLength, and edgeLength parameters
* *automatic constraints* based on the global edge flow direction (`cola.flowLayout`) and overlap
avoidance parameters (`cola.avoidOverlaps`)
* *manual constraints* such as alignment, inequality and equality constraints in a dimension/axis.

Generally when the
[cola.js documentation mentions constraints](https://github.com/tgdwyer/WebCola/wiki/Constraints),
it means the manual constraints.

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
is to create the edge but not draw it, e.g. by setting its edgeOpacity
to zero. If you have a use-case for this, please
[file an issue](https://github.com/dc-js/dc.graph.js/issues/new).

The pattern syntax is an embedded domain specific language designed to be terse without
restricting its power. As such, there are complicated rules for defaulting and inferring
parameters from other parameters. Since most users will want the simplest form, this document
will start from the highest level and then show how to use more complicated forms in order to
gain more control.

Then we'll build back up from the ground up and show how inference works.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| pattern | <code>Object</code> | a graph which defines the constraints to be generated |

