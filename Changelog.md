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
