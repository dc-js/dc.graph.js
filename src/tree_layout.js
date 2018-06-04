/**
 * `dc_graph.tree_layout` is a very simple and not very bright tree layout. It can draw any DAG, but
 * tries to position the nodes as a tree.
 * @class tree_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.tree_layout}
 **/
dc_graph.tree_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _dfs;

    function init(options) {
        var x;
        var nodeWidth = d3.functor(options.nodeWidth);
        function best_dist(left, right) {
            return (nodeWidth(left) + nodeWidth(right)) / 2;
        }
        _dfs = dc_graph.depth_first_traversal({
            nodeid: function(n) {
                return n.dcg_nodeKey;
            },
            sourceid: function(n) {
                return n.dcg_edgeSource;
            },
            targetid: function(n) {
                return n.dcg_edgeTarget;
            },
            init: function() {
                x = options.offsetX;
            },
            row: function(n) {
                return n.dcg_rank;
            },
            place: function(n, r, row) {
                if(row.length) {
                    var left = row[row.length-1];
                    var g = (nodeWidth(left) + nodeWidth(n)) / 2;
                    x = Math.max(x, left.left_x + g);
                }
                n.left_x = x;
                n.hit_ins = 1;
                n.y = r*options.gapY + options.offsetY;
            },
            sib: function(isroot, left, right) {
                var g = best_dist(left, right);
                if(isroot) g = g*1.5;
                x += g;
            },
            pop: function(n) {
                n.x = (n.left_x + x)/2;
            },
            skip: function(n, indegree) {
                // rolling average of in-neighbor x positions
                n.x = (n.hit_ins*n.x + x)/++n.hit_ins;
                if(n.hit_ins === indegree)
                    delete n.hit_ins;
            },
            finish: function(rows) {
                // this is disgusting. patch up any places where nodes overlap by scanning
                // right far enough to find the space, then fill from left to right at the
                // minimum gap
                rows.forEach(function(row) {
                    var sort = row.sort(function(a, b) { return a.x - b.x; });
                    var badi = null, badl = null, want;
                    for(var i=0; i<sort.length-1; ++i) {
                        var left = sort[i], right = sort[i+1];
                        if(!badi) {
                            if(right.x - left.x < best_dist(left, right)) {
                                badi = i;
                                badl = left.x;
                                want = best_dist(left, right);
                            } // else still not bad
                        } else {
                            want += best_dist(left, right);
                            if(i < sort.length - 2 && right.x < badl + want)
                                continue; // still bad
                            else {
                                if(badi>0)
                                    --badi; // might want to use more left
                                var l, limit;
                                if(i < sort.length - 2) { // found space before right
                                    var extra = right.x - (badl + want);
                                    l = sort[badi].x + extra/2;
                                    limit = i+1;
                                } else {
                                    l = Math.max(sort[badi].x, badl - best_dist(sort[badi], sort[badi+1]) - (want - right.x + badl)/2);
                                    limit = sort.length;
                                }
                                for(var j = badi+1; j<limit; ++j) {
                                    l += best_dist(sort[j-1], sort[j]);
                                    sort[j].x = l;
                                }
                                badi = badl = want = null;
                            }
                        }
                    }
                });
            }
        });
    }

    var _nodes, _edges;
    function data(nodes, edges) {
        _nodes = nodes;
        _edges = edges;
    }

    function start() {
        _dfs(_nodes, _edges);
        _dispatch.end(_nodes, _edges);
    }

    function stop() {
    }

    var layout = {
        layoutAlgorithm: function() {
            return 'tree';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return false;
        },
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
        data: function(graph, nodes, edges) {
            data(nodes, edges);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return ['nodeWidth', 'offsetX', 'offsetY', 'rowFunction', 'gapY'];
        },
        populateLayoutNode: function(layout, node) {
            if(this.rowFunction())
                layout.dcg_rank = this.rowFunction.eval(node);
        },
        populateLayoutEdge: function() {},
        nodeWidth: property(function(n) { return n.width; }),
        offsetX: property(30),
        offsetY: property(30),
        rowFunction: property(null),
        gapY: property(100)
    };
    return layout;
};

dc_graph.tree_layout.scripts = [];
