# dc.graph.js

Dynamic, interactive graph visualization using D3.

* smooth D3 animated transitions
* support for many graph layout libraries, including [WebCola](http://marvl.infotech.monash.edu/webcola/), [dagre](https://github.com/cpettitt/dagre), graphviz via [viz.js](https://github.com/mdaines/viz.js/) (wasm), flexbox via [Yoga](https://yogalayout.com/) 
* integrates with [dc.js](http://dc-js.github.io/dc.js/) and [crossfilter](http://crossfilter.github.io/crossfilter/) for brushing and filtering
* many modes of interaction, including drawing, editing, exploring, selection, brushing...
* experimental 3D mode using WebGL, with a novel 2.5D layered force directed layout

Many [examples are on github.io](http://dc-js.github.io/dc.graph.js), some of which allow you to display or explore your own graph data. No data is uploaded to any server - this is a pure JS client library.

dc.graph.js is mostly by Gordon Woodhull (although contributions are welcome if they make sense and don't break things). I also maintain [dc.js](https://github.com/dc-js/dc.js) and [RCloud](https://github.com/att/rcloud).
