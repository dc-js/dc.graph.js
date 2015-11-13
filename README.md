# dc.graph.js

Dynamic graph visualization with [WebCola](http://marvl.infotech.monash.edu/webcola/),
[dc.js](http://dc-js.github.io/dc.js/), and [crossfilter](http://square.github.io/crossfilter/).

This is a network visualization library compatible with dc.js. It utilizes two crossfilters,
one for the vertices and one for the edges. You can filter over each of these domains in order
to produce different views of the graph, or you can supply new data in order to animate
topologies over time.

(dc.graph.js doesn't need to be used with dc.js or crossfilter, but those provide nice
abstractions for filtering and driving visualizations from data.)

The [main page](http://dc-js.github.io/dc.graph.js) is a testing page. There are a number of
other examples in the web/ and web/examples directories, although you will need a data source
such as a Titan database to try these out. There are still some rough edges to the library,
but please try it out and feel free to make requests in the
[Issue Tracker](https://github.com/dc-js/dc.graph.js/issues). Pull Requests are also welcome, of course!

For support questions, please use the
[dc.js users group](https://groups.google.com/forum/?fromgroups#!forum/dc-js-user-group).

The underlying graph layout is performed by [cola.js](https://github.com/tgdwyer/WebCola)
(a.k.a WebCola), although a goal is to support dagre-d3 and other d3-based graph layout.
cola.js is just the coolest and most powerful, because it supports constraints!

dc.graph.js is by Gordon Woodhull. I also maintain [dc.js](https://github.com/dc-js/dc.js).
