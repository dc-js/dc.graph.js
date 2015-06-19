# dc.graph.js

Graph visualization linked with dc.js via crossfilter.

This is an experimental network visualization library compatible with dc.js. (Although
it doesn't need to be used with dc.js or crossfilter, those just provide nice
abstractions for filtering and driving visualizations from data.)

The [main page](http://dc-js.github.io/dc.graph.js) is a testing page. You won't get
perfect layouts with this library yet, but please try it out and feel free to make
requests in the [Issue Tracker](https://github.com/dc-js/dc.graph.js/issues). Pull
Requests are also welcome, of course!

For support questions, please use the
[dc.js users group](https://groups.google.com/forum/?fromgroups#!forum/dc-js-user-group).

The underlying graph layout is performed by [cola.js](https://github.com/tgdwyer/WebCola)
(a.k.a WebCola), although a goal is to support dagre-d3 and other d3-based graph layout.
cola.js is just the coolest and most powerful, because it supports constraints!

dc.graph.js is by Gordon Woodhull. I also maintain [dc.js](https://github.com/dc-js/dc.js).