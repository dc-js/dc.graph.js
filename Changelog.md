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
