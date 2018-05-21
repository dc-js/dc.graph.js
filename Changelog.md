## 0.6 beta 7
* deparallelize transform
* path splining fixes: don't attempt to draw the same node twice in a row (it goes NaN). better hovering behavior: opacity, return to original color, wider hover detection, keep hover detectors on top.
* `edgeSort` for bringing particular edges to front
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
