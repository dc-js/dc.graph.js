dc_graph.nested_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _flowLayout;
    var _nodes = {}, _edges = {};
    var _options = null;
    var _engines_l1 = {}; // level1 engines
    var _engines_l2 = []; // level2 engines
    var _engines_l1_p2 = {}; // level1 engines
    var _engines_l2_p2 = []; // level2 engines
    var _level1 = []; // level1 promises
    var _level2 = []; // level2 promises
    var _level1_p2 = []; // level1 promises
    var _level2_p2 = []; // level2 promises

    function init(options) {
        _options = options;
        console.log('applying nested layout');
    }

    function createEngines(subgroups, constraints) {
        // create layout engine for each subgroups in level1
        for(var type in subgroups) {
          //var _e = dc_graph.d3v4_force_layout();
          var current_engine = engine.nestedSpec.level1.default_engine;
          if(engine.nestedSpec.level1.engines && type in engine.nestedSpec.level1.engines) {
            current_engine = engine.nestedSpec.level1.engines[type];
          }
          var _e = dc_graph.spawn_engine(current_engine.engine, {}, false);
          if(current_engine.engine == 'cola') {
            _e.setcolaSpec = current_engine.setcolaSpec || undefined;
            _e.setcolaGuides = current_engine.setcolaGuides || [];
          }
          _e.init(_options);
          _engines_l1[type] = _e;
          _engines_l1_p2[type] = Object.assign(_e);
        }

        // create layout engine for level2
        var _l2e = dc_graph.spawn_engine(engine.nestedSpec.level2.engine, {}, false);
        if(engine.nestedSpec.level2.engine === 'cola') {
          // TODO generate secolaSpec
          _l2e.setcolaSpec = engine.nestedSpec.level2.setcolaSpec;
          _l2e.setcolaGuides = engine.nestedSpec.level2.setcolaGuides || [];
          _l2e.getNodeType = engine.nestedSpec.level2.getNodeType;
          //_l2e.lengthStrategy = engine.lengthStrategy;
        }
        _engines_l2.push(_l2e);
        _engines_l2_p2.push(Object.assign(_l2e));
    }

    function runLayout(nodes, edges, constraints) {

        var subgroups = {};
        var nodeTypeMap = {};
        var superEdges = [];

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
          } else {
            superEdges.push({
              dcg_edgeKey: edges[i].dcg_edgeKey,
              dcg_edgeSource: sourceType,
              dcg_edgeTarget: targetType,
              dcg_edgeLength: edges[i].dcg_edgeLength,
            });
          }
        }

        var createOnEndPromise = function(_e, _key) {
          var onEnd = new Promise(function(resolve){
            _e.on('end', function(nodes, edges) {
              resolve([nodes, edges, _key]);
            });
          });
          return onEnd;
        };

        for(var type in subgroups) {
          _engines_l1[type].data(null, subgroups[type].nodes, subgroups[type].edges, constraints);
          _level1.push(createOnEndPromise(_engines_l1[type], type));
          _level1_p2.push(createOnEndPromise(_engines_l1_p2[type], type));
        }

        for(var i = 0; i < _engines_l2.length; i ++) {
          _level2.push(createOnEndPromise(_engines_l2[i], 'level2'));
          _level2_p2.push(createOnEndPromise(_engines_l2_p2[i], 'level2'));
        }

        Promise.all(_level1).then(function(results){
          var superNodes = [];
          var maxRadius = 0;
          for(var i = 0; i < results.length; i ++) {
            subgroups[results[i][2]].nodes = results[i][0];
            //subgroups[results[i][2]].edges = results[i][1];
            var sn = calSuperNode(results[i][0]);
            sn.dcg_nodeKey = results[i][2];
            superNodes.push(sn);
            maxRadius = Math.max(maxRadius, sn.r);
          }
          if(engine.nestedSpec.level2.engine === 'd3v4force') {
            // set accessor for each super nodes
            _options.radiusAccessor = function(e){
              return e.r + engine.nestedSpec.level2.collisionMargin || 0;
            };
          }

          _engines_l2[0].init(_options);
          // now we have data for higher level layouts
          _engines_l2[0].data(null, superNodes, superEdges, constraints);

          for(var i = 0; i < _engines_l2.length; i ++) {
            _engines_l2[i].start();
          }

        });

        Promise.all(_level2).then(function(results){
          // add offsets to subgroups
          // only support one higher level
          for(var level = 0; level < results.length; level++) {
            for(var i = 0; i < results[level][0].length; i ++) {
              var sn = results[level][0][i];
              var groupName = sn.dcg_nodeKey;
              var offX = sn.x;
              var offY = sn.y;

              for(var j = 0; j < subgroups[groupName].nodes.length; j ++) {
                subgroups[groupName].nodes[j].x += offX;
                subgroups[groupName].nodes[j].y += offY;
              }
            }
          }

          // assemble all nodes and edges
          var allNodes = [];
          for(var key in subgroups) {
            allNodes = allNodes.concat(subgroups[key].nodes);
          }

          secondPass(allNodes, edges, constraints);

          for(var key in _engines_l1_p2) {
            _engines_l1_p2[key].start();
          }
            //_dispatch['end'](allNodes, edges);
        });

        Promise.all(_level1_p2).then(function(results) {
          console.log('level1 p2 finished');
          console.log(results);
          var superNodes = [];
          var maxRadius = 0;
          for(var i = 0; i < results.length; i ++) {
            subgroups[results[i][2]].nodes = results[i][0];
            //subgroups[results[i][2]].edges = results[i][1];
            var sn = calSuperNode(results[i][0]);
            sn.dcg_nodeKey = results[i][2];
            superNodes.push(sn);
            maxRadius = Math.max(maxRadius, sn.r);
          }
          if(engine.nestedSpec.level2.engine === 'd3v4force') {
            // set accessor for each super nodes
            _options.radiusAccessor = function(e){
              return e.r + engine.nestedSpec.level2.collisionMargin || 0;
            };
          }

          _engines_l2_p2[0].init(_options);
          // now we have data for higher level layouts
          _engines_l2_p2[0].data(null, superNodes, superEdges, constraints);

          for(var i = 0; i < _engines_l2.length; i ++) {
            _engines_l2_p2[i].start();
          }

        });

        Promise.all(_level2_p2).then(function(results){
          console.log('level2 p2 finished');
          for(var level = 0; level < results.length; level++) {
            for(var i = 0; i < results[level][0].length; i ++) {
              var sn = results[level][0][i];
              var groupName = sn.dcg_nodeKey;
              var offX = sn.x;
              var offY = sn.y;

              for(var j = 0; j < subgroups[groupName].nodes.length; j ++) {
                subgroups[groupName].nodes[j].x += offX;
                subgroups[groupName].nodes[j].y += offY;
              }
            }
          }

          // assemble all nodes and edges
          var allNodes = [];
          for(var key in subgroups) {
            allNodes = allNodes.concat(subgroups[key].nodes);
          }

          _dispatch['end'](allNodes, edges);
        });
    }

    function secondPass(nodes, edges, constraints) {
          _level1_p2 = []; // level1 promises
          _level2_p2 = []; // level2 promises

          var subgroups = {};
          var nodeTypeMap = {};
          var nodeMap = {};
          var superEdges = [];

          for(var i = 0; i < nodes.length; i ++) {
            var tp = engine.getNodeType(nodes[i]);
            nodeTypeMap[nodes[i].dcg_nodeKey] = tp;
            nodeMap[nodes[i].dcg_nodeKey] = nodes[i];
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
            } else {
              // insert virtual nodes
              var sourceNode = nodeMap[edges[i].dcg_edgeSource];
              var targetNode = nodeMap[edges[i].dcg_edgeTarget];

              var sourceVirtualNode = Object.assign(
                sourceNode,
                {
                  'virtual': true,
                  'dcg_nodeFixed': {'x': sourceNode.x, 'y': sourceNode.y}
                }
              );

              var targetVirtualNode = Object.assign(
                targetNode,
                {
                  'virtual': true,
                  'dcg_nodeFixed': {'x': targetNode.x, 'y': targetNode.y}
                }
              );

              subgroups[sourceType].nodes.push(targetVirtualNode);
              subgroups[sourceType].edges.push(edges[i]);

              subgroups[targetType].nodes.push(sourceVirtualNode);
              subgroups[targetType].edges.push(edges[i]);

              superEdges.push({
                dcg_edgeKey: edges[i].dcg_edgeKey,
                dcg_edgeSource: sourceType,
                dcg_edgeTarget: targetType,
                dcg_edgeLength: edges[i].dcg_edgeLength,
              });
            }
          }

        for(var type in subgroups) {
          _engines_l1_p2[type].data(null, subgroups[type].nodes, subgroups[type].edges, constraints);
        }
    }

    function data(nodes, edges, constraints) {
        // reset engines
        _engines_l1 = {}; // level1 engines
        _engines_l2 = []; // level2 engines
        _level1 = []; // level1 promises
        _level2 = []; // level2 promises

        var groups = {};
        for(var i = 0; i < nodes.length; i ++) {
          var tp = engine.getNodeType(nodes[i]);
          if( !(tp in groups)) {
            groups[tp] = true;
          }
        }
        createEngines(groups, constraints);
        runLayout(nodes, edges, constraints);
    }

    function calSuperNode(nodes) {
      var minX = Math.min.apply(null, nodes.filter(function(d){return d.virtual !== true}).map(function(e){return e.x}));
      var maxX = Math.max.apply(null, nodes.filter(function(d){return d.virtual !== true}).map(function(e){return e.x}));
      var minY = Math.min.apply(null, nodes.filter(function(d){return d.virtual !== true}).map(function(e){return e.y}));
      var maxY = Math.max.apply(null, nodes.filter(function(d){return d.virtual !== true}).map(function(e){return e.y}));
      // center nodes
      var centerX = (maxX+minX)/2;
      var centerY = (maxY+minY)/2;
      for(var i = 0; i < nodes.length; i ++) {
        nodes[i].x -= centerX;
        nodes[i].y -= centerY;
      }

      var n = {r: Math.max((maxX-minX)/2, (maxY-minY)/2)};
      //var n = {};
      return n;
    }

    function start() {
        // execute the layout algorithms
        for(var key in  _engines_l1) {
          _engines_l1[key].start();
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
        nestedSpec: undefined,
    });
    return engine;
};

dc_graph.nested_layout.scripts = ['d3.js', 'cola.js', 'setcola.js', 'd3v4-force.js'];
