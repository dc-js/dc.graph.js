# dc.graph.js API
  * [Diagram](#diagram)

## Diagram

The dc_graph.diagram is a dc.js-compatible network visualization component. It registers in
the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
logically derives from
[the dc.js Base Mixin](https://github.com/dc-js/dc.js/blob/master/web/docs/api-latest.md#base-mixin),
but it does not physically derive from it since so much is different about network visualization
versus conventional charting.