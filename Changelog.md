## 0.4.0
* layout engines are proper objects. all layout parameters are moved to the layout objects and
  deprecated on the diagram object
* `cola`, `dagre`, `tree` `_layout` are the current layout engines, and it should be possible to
  plug in others without modifying dc.graph.js
* using a webworker is optional for layout engines - wrap an engine in `webworker_layout` to use it
  with a webworker. the only restriction is that all layout parameters must be serializable - so for
  example the tree layout is not currently webworkable because it takes a bunch of functions.
* [HTML documentation](http://dc-js.github.io/dc.graph.js/docs/html/)

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
