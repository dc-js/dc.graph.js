## 0.9.8
* keyboard mode tracks the modifier keys pressed:
  * `modKeysPressed` returns the keys
  * `modKeysMatch` checks if the current keys match zero or more desired keys
  * `modkeyschanged` event fires when mod keys change
* `select_things` (and therefore `select_nodes` etc.) supports `modKeys` and only enables the brush when the keys match. Caveats:
  * selection is still enabled for clicking on nodes and edges even when keys don't match (debatable)
  * since dc.graph.js still uses d3@3, there are built-in brush modifier keys which are impossible to remove, which may cause the brush to behave weirdly when modkeyed
* `move_nodes` supports `modKeys`
* built-in zoom uses keyboard mode modkey support, which means that `modKeyZoom` keys must exactly match for zoom to be enabled. previously it was *any* match, and zoom was still enabled if `modKeyZoom` was null/empty and a modkey was pressed.
* change detection is customizable and defaults to "basic" if the layout algorithm does not support moving - only adding/deleting nodes/edges will register as a change
* when moving nodes, only connected edges will have their edges redrawn (and desplined if graphviz). splines are completely removed so that they stay that way if relayout is disabled.
* arrow paths are also recalculated when moving nodes, so that arrowheads/tails are not stranded
* nodes are allowed to be skinny
* keyboard mode now listens on the window for greater reliability (no focus needed); mod keys are cleared when window loses focus
* `edit_text` stops propagation of keyboard events, since its focus no longer isolates it from keyboard mode

## 0.9.7
* layout change includes all node and edge .cola fields that start with `dcg_`

## 0.9.6
* be more choosy about what counts as a layout change: only `e.cola` fields that start with `dcg_`
* open up `animateZoom` for those who set translate/zoom themselves and want the animated transition

## 0.9.5
* add one more internal parameter which should be ignored by flexbox layout ('order')
* CSS for match-game example in order to reenable dragging from/to nodes and not just ports

## 0.9.4
* `flexbox_layout` now supports Yoga layout for flexbox support. since the license doesn't have the questionable patents exception that css-layout has, this is now the default, but one can select css-layout by passing `{algo: 'css-layout'}` as the second parameter.

## 0.9.3
* options to deparallelize in both directions and reduce the edges

## 0.9.2
* `draw_clusters` was crashing when encountering an unknown cluster
* do not reject null modes, try 2
* options tracker for multiple charts. ability to update the UI when changing a sync-url value.
* start compare-layouts example
* upgrade to font-awesome 5

## 0.9.1
* clusters are another dimension of data, similar to ports and paths. clusters are drawn with `draw_clusters` mode. cola, dagre, dot, and fdp layouts support clusters.
* eliminate unqualilified `d3.select` that could accidentally snag objects from another diagram ([#114](https://github.com/dc-js/dc.graph.js/issues/114))
* adding a null mode should remove any mode with that name (not crash ;)

## 0.9.0
(dead version)

## 0.8.11
* added event namespacing to document keyboard event handlers for `modKeyZoom` because it didn't work with two diagrams on the same page

## 0.8.10
(botched release)

## 0.8.9
* more robustness when interacting with graphviz
  * ignore and flag NaN positions
  * default port vector when edge source and target positions are the same
  * check for errors returned by graphviz

## 0.8.8
* flexbox layout tolerant of missing parent nodes and empty data

## 0.8.7
* setcola is optional for `cola_layout`
* flexbox is listed in the catalog of layout engines
* `render_webgl` deals with re-renders better (by treating them as redraws - will need to revisit when it supports animations)
* `annotate_layers` updates the planes on redraw

## 0.8.6
* `annotate_layers` draws lines between setcola layers, and planes in 3d layered layout
* `dc_graph.mode` passes through draw arguments rather than assuming it's an SVG event
* webworker allows passing data back from layout thread to client engine via `processExtraWorkerResults`
* `cola_layout` exposes the extra layout nodes via `setcolaNodes`
* `diagram.select()` was missing
* webgl edge tubes use `edgeStrokeWidth` for circumference

## 0.8.5
* filtering works with the WebGL renderer. (still no animations)
* webgl edges are extruded as tubes and colored

## 0.8.4
* many caveats, but this has the first working WebGL renderer and a layered layout (no animations, can't re-render, can't filter etc etc)

## 0.8.3
* increase the maximum tooltip width to 500px
* continued refactoring of renderer code. the previous renderer-related warnings are now informational messages.
* remove obsolete bounds debugger - `dc_graph.troubleshoot` does this better
* document `flexbox_layout`

## 0.8.2
* smaller text in tooltips & formatting for tooltip tables which makes normal latex-like html work better
* htmltip and jsontip suppress tooltip in graphviz attr formatting. curiously, this wasn't necessary on macOS.

## 0.8.1
* `symbol_legend` for legend items represented with some text which may be a symbol, e.g. when nodes/edges have a set of tags
* legend supports [tag dimensions](https://github.com/crossfilter/crossfilter/wiki/API-Reference#dimension_with_arrays)
* ability to change vertical offset of legend text
* edge arrows properly transitioned and removed on exit instead of disappearing abruptly before the edge is gone
* node and edge labels are rendered as html instead of text, allowing character entities and (presumably) `tspan` formatting
* `propagateOptions` also invoked when layout is not in a webworker (this was a crashing bug... layout engine interface is not properly documented so see [c358ff3](https://github.com/dc-js/dc.graph.js/commit/c358ff3522d817) / [efdca3d](https://github.com/dc-js/dc.graph.js/commit/efdca3d7b4c) for details)

## 0.8.0
* [setcola](https://github.com/uwdata/setcola) constraints for cola layout - thanks Zhe Wang! ([#86](https://github.com/dc-js/dc.graph.js/pull/86))
* start validating (some) constraints for cola layout
* abstract out the concept of an "SVG renderer" to possibly enable other renderers. note: you will see some warnings about the SVG renderer which are diagnostics to identify which components are SVG-specific. in time, components will either be adapted to work across renderers, or they will disable themselves when they won't work with the renderer.

## 0.7.11
* `htmltip` attribute for ultimate control over tooltip formatting in simple-viewer.html and explore.html
* `querystring.update` takes a second parameter, whether to encode, for keeping URLs friendly (still defaults true)
* deprecate `diagram.legend` in favor of the more general `diagram.child`

## 0.7.10
* control the size of table tooltips so they don't take over the screen
* smaller tooltip text in explore.html
* update dependencies and get rid of some unused ones to make GitHub and NPM happy about vulnerabilities (which were never exposed to end users)

## 0.7.9
* simple-viewer and explore accept new attribute "jsontip" which attempts to format JSON in a compact way. only annoyance is that neither json nor graphviz accepts single quote marks, so there are a lot of "\"escaped quotes\""
* `dc_graph.tip.table` deals gracefully with any JSON-like data, displaying as key&value columns if an object, or as one column otherwise. values are JSON-stringified for a compact display
* `tip.table` was dropping rows for object when the value was zero, `null`, or an empty strings from object. it only drops `undefined` now.
* `apply_graphviz_accessors` supports standard graphviz `tooltip` attribute, which defaults to the label (not necessarily the key as before)
* use the `dy="0.3em"` hack for vertically centering text in safari as well as IE, Edge
* `sync_url_options`: ability to extract what-if url with some params changed
* **experimental** data urls: explore and simple-viewer can read the graph from a [data: URI](https://en.wikipedia.org/wiki/Data_URI_scheme) and that allows them to create **DATA LINKS** to the same page with the "uploaded" user data.

## 0.7.8
* IE hates a null `console`

## 0.7.7
* remove ES6 syntax and add some polyfills for IE11. notes:
  * SVG implementation is slow and may not work over 100 nodes
  * label editing does not work
  * edge drawing does not work in drag&drop composition demo (does work in basic network-building)
  * arrowheads may not update correctly when edge stroke width changes, and may pile up if arrows change
* `expand_collapse` hovers can change while moving from top to bottom of node
* workaround [#104](https://github.com/dc-js/dc.js/issues/104) in simple-viewer with `durationOverride(0)`
* expose and deprecate `legend.render` and `legend.redraw` instead of removing them outright
* various fixes to unadvertised original-test-page and vizgems demos

## 0.7.6
* `expand_collapse.urlOpener` to open links using a callback instead of `window.open`

## 0.7.5
* space is made for edge arrow heads/tails by cutting the spline at the correct distance, instead of using `stroke-dasharray` ([#95](https://github.com/dc-js/dc.graph.js/issues/95)). this requires an extra, unclipped and unshown copy of each edge to host the arrows.
* formal support for converting to and reading from [graphviz attributes](https://graphviz.org/doc/info/attrs.html): `dc_graph.apply_graphviz_accessors` applies the supported accessors to a diagram, and `dc_graph.snapshot_graphviz` produces `{nodes: [...], edges: [...], bounds: {...}}` from a diagram.
* `expand_collapse` supports `urlTargetWindow` and `nodeURL` for determining target and URL of links in nodes.
* `manual_layout` included in list of available layouts
* `simple-viewer` example uses `munge_graph` and `apply_graphviz_accessors` (optionally)
* `munge_graph` accepts `key` for node key
* event handlers are always namespaced
* default some padding to tooltip tables in CSS

## 0.7.4
* edge labels were lost when the page URL changed, because we are using absolute URLs
* edge opacity was not properly applied to edge labels, again
* when editing node & edge labels, the editor is closer to the actual font size
* better vertical centering for node text
* allow specifying `linkDistance` for d3-force layout; `"auto"` means individual; `edgeLength` is computed and set after node sizes are calculated
* redraw arrows if edge stroke (color) changed
* `load_graph` file extensions are extensible; can also read string instead of URL
* `flat_group.another` deprecated; `flat_group.make` includes the same functionality
* `behavior` renamed to `mode` with a deprecation warning. likewise `add_behavior` -> `draw`, `remove_behavior` -> `remove` ([#59](https://github.com/dc-js/dc.graph.js/issues/59))
* many updates to the examples, including a common banner with title/source link/version, and the start of an index page. where it makes sense, they have engine switching, automatic sizing & restrictPan.
* loading of user data in explore and simple viewer
* examples renamed: `rectangular-selection` -> `brushing-filtering`, `single-file` -> `simple-viewer`, `index` -> `original-test-page`
* reset the scales when resetting the SVG, so that re-`render`ing works
* remove unused `needsStage` method from layout engines
* bigger non-bold default font for nodes & edges

## 0.7.3
* fix crash related to nodes without ports

## 0.7.2
* detect resize also at end of layout (via `check_zoom`) - we have to `detect_size_change` on every entry point, since there is no resize event yet. auto-resize now seems to work in all known situations.
* ports contribute to the bounds of the canvas
* tween edge dashes and recalculate them on reposition so that dragging and animations don't have parts of edges missing
* fix crash in edge delete - do not attempt to determine `nodeStrokeWidth` when removing arrowheads
* fix caching of arrow markers

## 0.7.1
* left and right clipped edge arrowheads for all arrow shapes
* arrow shapes are now shape families with some open/left/right code shared
* stem width === edge stroke width / edge arrow size is considered for arrowheads (not perfectly but smaller arrows should work)
* `defineArrow` syntax has changed - now takes an object (documentation to follow soon, consult `src/arrows.js` for now)
* fix undefined symbol introduced in 0.7 (`diagram`) & fix examples so this kind of problem is easier to detect
* fix `draw_graphs` mode for the default, uncustomized case (edges were never valid and never connecting)
* fix undefined symbol `selectContent` for non-iconed nodes (bug introduced in 0.6.4)
* fix undefined members `tail` and `head` => `source` and `target` introduced in 0.7

## 0.7.0
* multiple arrowheads and arrowtails - all [graphviz arrow shapes](https://www.graphviz.org/doc/info/arrows.html) are supported, except for the `l`/`r` modifiers; `o` modifier is supported for all the same shapes and also `normal` and `inv`

## 0.6.7
* shapes are better communicated with graphviz layout (but still imperfect)
* abstract shape had inconsistent format if it was specified as a string; now it always becomes an object
* explore.html supports `&directional=true&expand_strategy=shown_hidden` again, for directional (up/down) exploration of graphs
* new "elaborated-rect" class of [shapes](https://www.graphviz.org/doc/info/shapes.html#html), including house, invhouse, rarrow, larrow, rpromoter, lpromote, and cds
* graphviz subgraphs no longer break the explorer

## 0.6.6
* `legend.omitEmpty` allows removing items for which no instances are shown, unless they were filtered out using the legend
* ability to align vertical-center or horizontal-center. [`fitStrategy` documentation](http://dc-js.github.io/dc.graph.js/docs/html/dc_graph.diagram.html#fitStrategy__anchor) brought up to date (yes there is a lot else that needs updating...)
* explore demo will show an edge legend if `edgeCat` (name of field to use) and optionally `egeExpn` (regex for extracting category from field)
* multi-line edge labels. each edge's labels are in a `g.edge-label-wrapper`; the first line is positioned as before; the next lines have `dy` set to the line number times the new `edgeLabelSpacing` (default 12) minus 2.

## 0.6.5
* fix typo

## 0.6.4
* in width/height auto mode, check for size change on zoom event (as well as redraw)
* do not detect size changes unless in width/height auto mode. restore old `resizeSvg` behavior to redraw, so that `.width(null).height(null)` still works (although not recommended
* don't hide the icon when editing node text
* `symbol_port_style` obey null symbol and don't display a little dot
* remove any previous `<svg>` when rendering, since client may not have cleaned up old one
* `match_opposites` displays deletion hints instantly - they were not reliable before hints because refreshes don't interrupt each other any more
* stop drag-drop-composition demo sidebar from getting too big
* explore demo keeps expanded nodes in URL, to facillitate sharing (but not hidden nodes/edges yet)
* arrow head/tail orientation is much closer (looks for point 25px out along edge)
* first draft of odot arrowhead/tail.. needs work though

## 0.6.3
* edge hiding in `expand_collapse` - uses a dimension on the edge crossfilter
* if the edges that would appear are colored, the spikes are too

## 0.6.2
* `linkKey` hack in `expand_collapse` - definitely not the right way to do this but we can call it motivation for breaking up into smaller, more cooperative modes

## 0.6.1
* expand/collapse now has different "strategies" for dealing with in-memory graphs - the (poorly named) `dc_graph.expand_collapse.shown_hidden` statefully expands and collapses (and hides) with the old behavior, while the (also poorly named) `dc_graph.expand_collapse.expanded_hidden` declaratively defines expansion as "one hop from a selected set of nodes".
* in addition to the prior `expand_collapse` highlight groups "collapse-highlight-group" and "hide-highlight-group", it also supports "expanded-highlight-group" showing the expanded/selected nodes
* `expand_collapse` no longer annotates nodes to keep track of its state; it politely uses a key->boolean mapping object

## 0.6.0
* new "explore" demo which refines a feature previously hidden in "main" demo
* various improvements to "main" demo (index.html)
* collapse feedback, showing what will be removed
* ability to hide nodes in explore mode
* resizing of the canvas seems finally to work right
* width/height "auto" for SVG at 100% width/height
* node moving and edge drawing cancel if they see movement with no buttons down, since button up messages can get lost
* more refinements to port-to-port edge drawing hints: positive feedback when a match is made, ports crossed out when invalid
* ability to read the `portPosition` from the `symbol_port_style`
* `refresh` no longer interrupts animated transitions from `redraw` or earlier refreshes
* `requestRefresh` to ask for refresh after code is finished executing - esp when there are multiple things that might be redrawing, but is this is a good practice anyway.
* box and rect are synonyms for rectangle shape
* opacity of edge is applied correctly to edge labels
* edge attributes are kept when reading dot format

## 0.6.0 beta 12
* edge legend
* legend is an ordinary mode/behavior/child like any other
* hints to tell the user why an edge can't be drawn due to mismatched ports
* dropdown menus in legend for choosing individual nodes, with various click/hide behaviors; dropdown menus as a general utility using html overlays
* improved support for programmatic tooltips: callback when tooltip displayed, purely programmatic tips, different styles for different tips, immediate/delayed tip hiding, disabling of tooltips, etc
* `select_things` could cause brush to appear when `multipleSelect` was disabled
* port selection was throwing exceptions when brush was enabled
* nodes and edges were sometimes drawn wrong if removed and then inserted again
* improved compatibility with IE10+
* `spawn_engine` won't try to use a WebWorker if the browser (IE) doesn't support it
* `reset` event for diagrams, when rendering on existing canvas; behaviors uninstall themselves on reset so that their elements don't become stale
* `dc_graph.line_breaks` deprecates the old behavior of taking an object with field `key` - instead clients should pass a string
* removing listeners from a cascade resulted in empty spots (use `splice` not `delete`)

## 0.6.0 beta 11
* `highlight_things` separates the display of highlights out from `highlight_neighbors`. (`highlight_paths` is not yet compliant though)
* `highlight_radius` highlights nodes/edges up to a certain radius from the current node selection
* `move_nodes` only changes the selection after drag has started, not on mouse down. still ugly but the right behavior this case.
* `with_icon_contents` positioning was broken, icon was overlapping the text
* drag-drop-composition demo has icons now

## 0.6.0 beta 10
* draw self-loops in paths, by Zhe Wang
* `highlight_neighbors` can highlight nodes and also lowlight (fade) everything else. it can be invoked programmatically through the corresponding event group. it can transition quicker using `durationOverride`
* programmatic tip fires event telling which item was tipped. `hideTip` method.
* arrowheads and arrowtails don't spin around when crossing &#960; (#49)
* previous label hidden while editing node/edge labels
* `spawn_engine` / `engines.instantiate` no longer think `undefined` is a match if there are entries with multiple names
* updates to `signle-file.html`: supports move-nodes, d3v4force, can disable tips and highlight-neighbors

## 0.6.0 beta 9
* depend on external [att/d3-force-straighten-paths](https://github.com/att/d3-force-straighten-paths) module

## 0.6.0 beta 8
* new graphical path selector shows paths as little straight-line node-link diagrams, by Zhe Wang
* displace center node for path straightening forces; bugs fixed and path straightening works
* path straightening is proportional to the square of the angle
* generate angle force report for debugging using [force-debugger](https://github.com/gordonwoodhull/force-debugger)
* path spliner is more tolerant of changes to the graph ([#81](https://github.com/dc-js/dc.graph.js/issues/81) mostly fixed but not entirely)
* path splines animate to new position
* paths can be selected via their splines in `draw_spline_paths`
* selected path can be straightened more with `selectedStrength`
* Zhe Wang's `avoidSharpTurns` exposed as option; it consistently loops instead of sometimes double-crossing, and the loop is wider
* eliminate poorly-performing comma selector used to update arrowhead/tail marker fills

## 0.6 beta 7
* deparallelize transform
* detect sharp turns in path splines, and modify the control points to make the spline smooth, by Zhe Wang
* path splining fixes: don't attempt to draw the same node twice in a row (it NaNs the layout and puts weird loopty loops on the nodes)
* better path hovering behavior: opacity, return to original color, wider hover detection, keep hover detectors on top.
* `edgeSort` for bringing particular edges to front
* fixed node position support for d3v4force. (also implemented for d3force but does not appear to work.)
* ability to show count/total in legend
* ability to display a tip for the Nth item that matches a filter
* increase memory allotment for graphviz
* warn user when layout engine not found
* resizing of window in drag&drop composition demo
* probably time to stop calling these betas, even though i have a huge backlog of issues to fix

## 0.6 beta 6
* ability to filter using the legend
* `legend.noLabel` because you usually don't want legend items to have internal labels

## 0.6 beta 5
* nodeLineHeight
* nodeLabelPadding can be either number or `{x,y}` object. Document it.

## 0.6 beta 4
* put css change in the source not the artifact
* another `dc_graph.engines.register` fix, by Lefteris Koutsofios

## 0.6 beta 3
* somewhat more sensible baseline for node text
* missing symbol from refactor

## 0.6 beta 2
* set linked wildcard ports to empty if `wildcard_ports` initialized without `diagram`

## 0.6 beta 1
* if `diagram.refresh()` was called while layout was still happening, `draw_edge_to_shapes` would assert because it didn't have port positions. instead, just fall back to (0,0) ports in this case
* ability to "link" wildcard ports so that when one gets assigned a type, they all get the same type (and when *all* linked ports are disconnected, the ports revert to wild/blank)
* use `dominant-baseline` not `alignment-baseline` for `text` elements (the latter is for `tspan`)

## 0.6 alpha 7
* treat mouse pressedness as a boolean, not an integer. zoom mode was getting stuck deactivated.
* `?mkzoom` for testing modKeyZoom in drag-drop-composition demo. (This enables multiple selection, which may not work completely with draw-graphs and move-nodes.)

## 0.6 alpha 6
* letter or other symbols in symbol port style
* firefox was crashing on flexbox layout due to nodes with no caption
* graphviz fdp layout
* improvements to random generation example
* workers for d3*force (but stop doesn't work)
* resizing example
* `.on()` returns the current handler if none given ([#32](https://github.com/dc-js/dc.graph.js/issues/32))

## 0.6 alpha 5
* fix node shape changing, old shapes were not being deleted
* build lysenko-interval-tree.js properly using rollup
* fix d3*force parameters for rectangular selection demo

## 0.6 alpha 4
* support for switching between available layout engines
* register/unregister layout engines
* some layout engines support `savePositions` and `restorePositions` ([#74](https://github.com/dc-js/dc.graph.js/issues/74))
* `sync_url_options` separate library
* drop `examples` directory and move those directly into `web`

## 0.6 alpha 3
* `d3_force_layout` and `d3v4_force_layout` engines
* we build and distribute a custom `d3v4-force.js` using rollup (since we're still in the d3v3 universe)
* `draw_spline_paths` mode will draw splined paths (chains of edges) on top of the existing graph

## 0.6 alpha 2
* use specific n, e, p parameter names for datum, instead of d
* stop using the word chart, these are diagrams
* brush and modkey-zoom are mutually exclusive instead of both happening at once ([#56](https://github.com/dc-js/dc.graph.js/issues/56))

## 0.6 alpha 1
* generalize `altKeyZoom` to `modKeyZoom`, by Lefteris Koutsofios ([#65](https://github.com/dc-js/dc.graph.js/pull/65))
* reverse orientation of arrow tails, so that the same arrow spec can be used for both (Ibid)

# 0.6
* ports are specific positions on nodes where edges can connect, placed manually or automatically, and they can have shapes and symbols in them. named ports allow multiple edges to connect to the same spot; anonymous ports are specific to one edge but can still be styled
* selection of edges, ports
* `delete_nodes`, `delete_edges` modes
* `move_nodes` mode, and `fix_nodes` to fix (nail) the position of N previously-moved nodes
* `flexbox_layout` allows positioning of nodes according to the flexbox algorithm
* `label_nodes` and `label_edges` modes allow double clicking or selecting and typing on label to change it
* `match_ports` allows an edge to be drawn only if ports have the same type (string); `wildcard_ports` infer their type from the port at the other end of the edge
* `match_opposites` allows an edge to be drawn only if the polarity is opposite, and removes any other edges to the same port
* rounded rectangle nodes
* icons inside of nodes
* `brush`, `keyboard` modes support modes that need these behaviors
* `validate` mode checks the consistency of node, edge, port data
* `troubleshoot` mode draws marks & ticks for debugging and understanding layout problems

## 0.5.6
* avoid cola crash with `initLayoutOnRedraw`

## 0.5.5
* hacks to allow passing clustered gv-format data to graphviz, and get the clusters back out
* support graphlib-dot 0.6 for reading graphs. looks like this is older than the version we are distributing but it's the one available on npm.

## 0.5.4
* fix apparent chrome optimization bug - the result of `Math.floor` should never be undefined

## 0.5.3
* `select_nodes` mode also disable modifier keys when `multipleSelect` is disabled

## 0.5.2
* graphviz edge routing
* warn, don't die, if deprecated engine parameter called on diagram and engine doesn't support it
* most examples now support all layout engines
* wheel example generates half of parallel edges in opposite direction
* cola was overinterpreting rankdir - now only LR and TB are valid & handled
* parallel edge code somewhat more comprehensible
* graphviz y coord output properly inverted w.r.t. bounding box
* graph `nodesep`, `ranksep`, `rankdir` attributes work for graphviz. node `width`, `height` are set from shapes, and `fixedsize` is specified. `arrowhead` and `arrowtail` are set to `none` because dc.graph draws those. however, edges still don't quite meet the nodes.
* set position "hints" for graphviz (doesn't seem to work - probably coordinate systems problems)
* graphviz via http

## 0.5.1
* graphviz layout don't crash on empty graph
* support for graphviz in [network-building.html](http://dc-js.github.io/dc.graph.js/network-building.html)

## 0.5.0
* basic support for graphviz layouts via [viz.js](https://github.com/mdaines/viz.js/). so far this
  only does node positions because dc.graph.js doesn't support bent edges yet. dot, neato, osage, twopi
  layouts all work. webworkers are not supported yet (but it's fast!).

## 0.4.10
* improved table sorting in network-building.html

## 0.4.9
* `?layout=...` in [network-building.html](http://dc-js.github.io/dc.graph.js/network-building.html)

## 0.4.8
* support for .psv and .csv files in `load_graph` and thus `single-file.html`
* `single-file.html` is less silly. it displays the data in a table and does not randomize the
  colors. (would be nice to be able to assign attributes programmatically, but how to squeeze
  expressions into a query string?) highlights neighboring edges too.
* <kbd>alt</kbd> hint in `rectangular-selection.html`

## 0.4.7
* `highlight_paths` behavior would crash when removed from the diagram
* `highlight_paths` now won't force a redraw if the paths changed event is from empty to empty
* `edgeIsShown` was mistakenly overwriting the `edgeIsLayoutAccessor`

## 0.4.6
* improved network building example with dataTables showing the data created
* drawing behaviors call `redrawGroup` instead of just `redraw`
* `draw_graphs` behavior has callbacks to modify the created data (e.g. to add timestamp sorting, as
  we're doing here

## 0.4.5
* `nodesep` and `ranksep` for dagre.
* restore new polygon text fitting calculation, fix some very obvious bugs there. width and height
  of polygonal nodes are still pretty far off, but conservative.

## 0.4.4
* revert new polygon text fitting algorithm. it only fit the text better in some cases, and caused
  collisions between nodes, sometimes completely obscuring nodes. will have to revisit this in the
  future - this is truly a black art.

## 0.4.3
* tweaks to the timeline widget - ticks are shown full height, and the region is adjusted to include
  the tick width

## 0.4.2
* fix a crash when filtering a graph externally and it already has an internal filter
* `select_nodes.autoCropSelection` option - when using a dc.graph like a dc.js chart, filtering it
  among other charts, it makes sense to preserve the current selection even when some of the nodes
  have disappeared (false). by default (true), the selection will be cropped when the data changes.

## 0.4.1
* `select_nodes` behavior now supports multiple selection with rectangular brush and modifier
  keys. check out
  [the example](http://dc-js.github.io/dc.graph.js/examples/rectangular-selection.html?layout=dagre).
* build graphs in the browser with simple `draw_graphs`
  behavior. [example](http://dc-js.github.io/dc.graph.js/examples/network-building.html).
* `random_graph` utility abstracted from the example - it's not particularly sophisticated but it's
  helpful for writing examples.
* arrow and textPath id's could get cross-linked when there were multiple dc.graphs in a page. (SVG
  IDs need to be unique across the whole page.)
* option to enable zoom only when alt-key pressed. (hopefully in the near future zoom will be a
  mode/behavior and we'll activate modes based on modifier keys.)

## 0.4.0
* new `convert_tree` data import function is slightly more general than the old `convert_nest`
* layout engines are proper objects. all layout parameters are moved to the layout objects and
  deprecated on the diagram object
* `cola`, `dagre`, `tree` `_layout` are the current layout engines, and it should be possible to
  plug in others without modifying dc.graph.js
* [graphviz_attrs](http://dc-js.github.io/dc.graph.js/docs/html/dc_graph.graphviz_attrs.html) is the "base
  class" for layout engines that want to support the
  [common attributes of graphviz](http://www.graphviz.org/doc/info/attrs.html). currently these are
  just `rankdir` and `ranksep`.
* using a webworker is optional for layout engines - wrap an engine in `webworker_layout` to use it
  with a webworker. the only restriction is that all layout parameters must be serializable - so for
  example the tree layout is not currently webworkable because it takes a bunch of functions.
* there is spiffy [HTML documentation](http://dc-js.github.io/dc.graph.js/docs/html/), although not
  everything in the API is documented yet.

## 0.3.16
* line breaking `dc.line_breaks` function, for `nodeLabel` (which has supported returning an array
  of lines for some time).
* improvements to fitting polygonal shapes around multiline text
* the layout height of nodes was not affected by the text height, even though the shapes were
* querystring sublibrary now supports `{boolean: true}` mode, where any parameters without values
  are interpreted as `true` instead of `""`
* a list of available shape names is available from `dc_graph.available_shapes()`
* shapes and text [test page](http://dc-js.github.io/dc.graph.js/shapes-and-text.html)


## Previous versions
Sorry, no changelogs available before v0.3.16.

## Start dc.graph.js Changelog
**dc.graph.js** is under rapid development, so every change may not be reported here. Also,
development tends to be driven by applications and demos I'm working on, rather than issues and pull
requests, so there will be little attempt to link to the GitHub issue tracker.
