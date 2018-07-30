dc_graph.nested_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _flowLayout;
    var _nodes = {}, _edges = {};
    var _options = null;
    var _engines_l1 = []; // level1 engines
    var _engines_l2 = []; // level2 engines
    var _level1 = []; // level1 promises
    var _level2 = []; // level2 promises
    //var _nodes = {}, _edges = {};

    function init(options) {
        console.log(options);
        _options = options;
    }

    function data(nodes, edges, constraints) {

        var subgroups = {};
        var nodeTypeMap = {};

        for(var i = 0; i < nodes.length; i ++) {
          var tp = engine.getNodeType(nodes[i]);
          nodeTypeMap[nodes[i].dcg_nodeKey] = tp;
          if( !(tp in subgroups)) {
            subgroups[tp] = {'nodes':[], 'edges':[]};
          }
          subgroups[tp].nodes.push(nodes[i]);
        }

        for(var i = 0; i < edges.length; i ++) {
          var sourceType = nodeTypeMap[edges[i].dcg_edgeSource];
          var targetType = nodeTypeMap[edges[i].dcg_edgeTarget];
          if( sourceType === targetType ) {
            subgroups[sourceType].edges.push(edges[i]);
          }
        }

        _engines_l1 = [];
        _engines_l2 = [];
        _level1 = [];
        _level2 = [];

        var createOnEndPromise = function(_e, _key) {
          var onEnd = new Promise(function(resolve){
            _e.on('end', function(nodes, edges) {
              resolve([nodes, edges, _key]);
            });
          });
          return onEnd;
        };

        // create layout engine for each subgroups in level1
        for(var type in subgroups) {
          var _e = dc_graph.d3v4_force_layout();
          _e.init(_options);
          _e.data(null, subgroups[type].nodes, subgroups[type].edges, constraints);
          _engines_l1.push(_e);
          _level1.push(createOnEndPromise(_e, type));
        }

        // create layout engine for level2
        var _l2e = dc_graph.d3v4_force_layout();
        _l2e.init(_options);
        _engines_l2.push(_l2e);
        _level2.push(createOnEndPromise(_l2e, 'level2'));

        Promise.all(_level1).then(function(results){
          var superNodes = [];
          for(var i = 0; i < results.length; i ++) {
            subgroups[results[i][2]].nodes = results[i][0];
            subgroups[results[i][2]].edges = results[i][1];
            var sn = calSuperNode(results[i][0]);
            sn.dcg_nodeKey = 'superNode'+i;
            superNodes.push(sn);
          }
          console.log(superNodes);

          // now we have data for higher level layouts
          _engines_l2[0].data(null, superNodes, [], constraints);
          for(var i = 0; i < _engines_l2.length; i ++) {
            _engines_l2[i].start();
          }

        });

        Promise.all(_level2).then(function(results){
          console.log("level2 done");
          console.log(results);
          // TODO add offsets to subgroups
          // TODO assemble all nodes and edges
          //_dispatch['end'](nodes, edges);
        });
    }

    function calSuperNode(nodes) {
      var minX = Math.min.apply(null, nodes.map(function(e){return e.x}));
      var maxX = Math.max.apply(null, nodes.map(function(e){return e.x}));
      var minY = Math.min.apply(null, nodes.map(function(e){return e.y}));
      var maxY = Math.max.apply(null, nodes.map(function(e){return e.y}));
      var n = {x: (maxX+minX)/2, y: (minY+maxY)/2, r: Math.max((maxX-minX)/2, (maxY-minY)/2)};
      return n;
    }

    function start() {
        // execute the layout algorithms
        for(var i = 0; i < _engines_l1.length; i ++) {
          _engines_l1[i].start();
        }
    }

    function stop() {
      var stopEngines = function(_engines) {
        for(var i = 0; i < _engines.length; i ++) {
          if(_engines[i])
              _engines[i].stop();
        }
      }
      stopEngines(_engines_l1);
      stopEngines(_engines_l2);
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    graphviz.rankdir(null);

    var engine = Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return 'multi';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        needsStage: function(stage) { // stopgap until we have engine chaining
            return stage === 'ports' || stage === 'edgepos';
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes, edges, constraints) {
            data(nodes, edges, constraints);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return ['handleDisconnected', 'lengthStrategy', 'baseLength', 'flowLayout', 'tickSize', 'groupConnected']
                .concat(graphviz_keys);
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {},
        /**
         * Instructs cola.js to fit the connected components.
         * @method handleDisconnected
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Boolean} [handleDisconnected=true]
         * @return {Boolean}
         * @return {dc_graph.cola_layout}
         **/
        handleDisconnected: property(true),
        /**
         * Currently, three strategies are supported for specifying the lengths of edges:
         * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
         * `baseLength`
         * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
         * the edge. See
         * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
         * for more details.
         * 'none' - no edge lengths will be specified
         * @method lengthStrategy
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Function|String} [lengthStrategy='symmetric']
         * @return {Function|String}
         * @return {dc_graph.cola_layout}
         **/
        lengthStrategy: property('symmetric'),
        /**
         * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
         * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
         * lengths.
         * @method baseLength
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Number} [baseLength=30]
         * @return {Number}
         * @return {dc_graph.cola_layout}
         **/
        baseLength: property(30),
        /**
         * If `flowLayout` is set, it determines the axis and separation for
         * {@link http://marvl.infotech.monash.edu/webcola/doc/classes/cola.layout.html#flowlayout cola flow layout}.
         * If it is not set, `flowLayout` will be calculated from the {@link dc_graph.graphviz_attrs#rankdir rankdir}
         * and {@link dc_graph.graphviz_attrs#ranksep ranksep}; if `rankdir` is also null (the
         * default for cola layout), then there will be no flow.
         * @method flowLayout
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Object} [flowLayout=null]
         * @example
         * // No flow (default)
         * diagram.flowLayout(null)
         * // flow in x with min separation 200
         * diagram.flowLayout({axis: 'x', minSeparation: 200})
         **/
        flowLayout: function(flow) {
            if(!arguments.length) {
                if(_flowLayout)
                    return _flowLayout;
                var dir = engine.rankdir();
                switch(dir) {
                case 'LR': return {axis: 'x', minSeparation: engine.ranksep() + engine.parent().nodeRadius()*2};
                case 'TB': return {axis: 'y', minSeparation: engine.ranksep() + engine.parent().nodeRadius()*2};
                default: return null; // RL, BT do not appear to be possible (negative separation) (?)
                }
            }
            _flowLayout = flow;
            return this;
        },
        unconstrainedIterations: property(10),
        userConstraintIterations: property(20),
        allConstraintsIterations: property(20),
        gridSnapIterations: property(0),
        tickSize: property(1),
        groupConnected: property(false),
        setcolaSpec: undefined,
        setcolaGuides: undefined,
        extractNodeAttrs: function(_node, _attrs) {}, //add new attributes to _node from _attrs
        extractEdgeAttrs: function(_edge, _attrs) {},
        getNodeType: function(_node) {},
    });
    return engine;
};

dc_graph.nested_layout.scripts = ['d3.js', 'cola.js', 'setcola.js', 'd3v4-force.js'];
