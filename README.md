# dc.graph.js

Dynamic, interactive graph visualization using D3.

This repo is not actively maintained, but I still dabble with it occasionally. Note that it is based on D3 v3.

Many of [the examples](http://dc-js.github.io/dc.graph.js) allow you to display or explore your own graph data. No data is uploaded to any server - this is a pure JS client library.

Features:
* smooth D3 animated transitions
* support for many graph layout libraries, including
  * [WebCola](http://marvl.infotech.monash.edu/webcola/) (and [SetCoLa](https://github.com/uwdata/setcola))
  * [dagre](https://github.com/cpettitt/dagre)
  * [d3-force](https://github.com/d3/d3-force)
  * graphviz via [viz.js](https://github.com/mdaines/viz.js/) (wasm)
  * flexbox via [Yoga](https://yogalayout.com/) 
* many modes of interaction, including drawing, editing, exploring, selection, brushing and filtering
* integrates with [dc.js](http://dc-js.github.io/dc.js/) and [crossfilter](http://crossfilter.github.io/crossfilter/)
* experimental 3D mode using WebGL, with a novel 2.5D layered force directed layout


dc.graph.js is mostly by Gordon Woodhull (although contributions are welcome if they make sense and don't break things). I also maintain [dc.js](https://github.com/dc-js/dc.js) and [RCloud](https://github.com/att/rcloud).
