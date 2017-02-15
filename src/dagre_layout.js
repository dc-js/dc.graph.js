dc_graph.dagre_layout = function(id) {
    var _layoutId = id || uuid();
    var _dagreGraph = null, _tick, _done;
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    // node and edge objects preserved from one iteration
    // to the next (as long as the object is still in the layout)
    var _nodes = {}, _edges = {};

    function init_dagre(options) {
        // Create a new directed graph
        _dagreGraph = new dagre.graphlib.Graph({multigraph: true});

        // Set an object for the graph label
        _dagreGraph.setGraph({rankdir: options.rankdir});

        // Default to assigning a new object as a label for each new edge.
        _dagreGraph.setDefaultEdgeLabel(function() { return {}; });
    }

    function data_dagre(nodes, edges, constraints, opts) {
        var wnodes = regenerate_objects(_nodes, nodes, function(v) {
            return v.dcg_nodeKey;
        }, function(v1, v) {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
        }, function(k, o) {
            _dagreGraph.setNode(k, o);
        }, function(k) {
            _dagreGraph.removeNode(k);
        });
        var wedges = regenerate_objects(_edges, edges, function(e) {
            return e.dcg_edgeKey;
        }, function(e1, e) {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, function(k, o, e) {
            _dagreGraph.setEdge(e.dcg_edgeSource, e.dcg_edgeTarget, o);
        }, function(k, e) {
            _dagreGraph.removeEdge(e.dcg_edgeSource, e.dcg_edgeTarget, e.dcg_edgeKey);
        });

        function dispatchState(event) {
            _dispatch[event](
                wnodes,
                wedges.map(function(e) {
                    return {dcg_edgeKey: e.dcg_edgeKey};
                })
            );
        }
        _tick = function() {
            dispatchState('tick');
        };
        _done = function() {
            dispatchState('end');
        };
    }

    function start_dagre(initialUnconstrainedIterations,
                         initialUserConstraintIterations,
                         initialAllConstraintsIterations,
                         gridSnapIterations) {
        _dispatch.start();
        dagre.layout(_dagreGraph);
        _done();
    }

    function stop_dagre() {
    }

    return {
        layoutAlgorithm: function() {
            return 'dagre';
        },
        layoutId: function() {
            return _layoutId;
        },
        on: function(event, f) {
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init_dagre(options);
            return this;
        },
        data: function(nodes, edges, constraints, opts) {
            data_dagre(nodes, edges, constraints, opts);
        },
        start: function(options) {
            if(options.initialOnly) {
                if(options.showLayoutSteps)
                    _tick();
                _done();
            }
            else
                start_dagre(options);
        },
        stop: function() {
            stop_dagre();
        },
        optionNames: function() {
            return ['rankdir'];
        },
        /**
         * Direction to draw ranks. Currently for dagre and expand_collapse, but I think cola could be
         * generated from graphviz-style since it is more general.
         * @name rankdir
         * @memberof dc_graph.diagram
         * @instance
         * @param {String} [rankdir]
         **/
        rankdir: property('TB')
    };
}

// onmessage = function(e) {
//     var args = e.data.args;
//     switch(e.data.command) {
//     case 'init':
//         init_dagre(args.width, args.height, args.rankdir);
//         break;
//     case 'data':
//         data_dagre(args.nodes, args.edges, args.constraints, args.opts);
//         break;
//     case 'start':
//         if(args.initialOnly) {
//             if(args.showLayoutSteps)
//                 _tick();
//             _done();
//         }
//         else
//             start_dagre(args.initialUnconstrainedIterations,
//                          args.initialUserConstraintIterations,
//                          args.initialAllConstraintsIterations);
//         break;
//     case 'stop':
//         stop_dagre();
//         break;
//     }
// };

dc_graph.dagre_layout.scripts = ['d3.js', 'dagre.js'];
