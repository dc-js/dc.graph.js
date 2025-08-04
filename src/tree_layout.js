/**
 * Tree layout for dc.graph.js
 * @module tree_layout
 */

// External dependencies
import { dispatch } from 'd3-dispatch';
import { uuid, property } from './core.js';
import { depthFirstTraversal } from './depth_first_traversal.js';

/**
 * `treeLayout` is a very simple and not very bright tree layout. It can draw any DAG, but
 * tries to position the nodes as a tree.
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} tree layout engine
 **/
export function treeLayout(id) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');
    let _dfs;

    function init(options) {
        let x;
        const nodeWidth = typeof options.nodeWidth === 'function' ? options.nodeWidth : function() { return options.nodeWidth; };
        function best_dist(left, right) {
            return (nodeWidth(left) + nodeWidth(right)) / 2;
        }
        _dfs = depthFirstTraversal({
            nodeid(n) {
                return n.dcg_nodeKey;
            },
            sourceid(n) {
                return n.dcg_edgeSource;
            },
            targetid(n) {
                return n.dcg_edgeTarget;
            },
            init() {
                x = options.offsetX;
            },
            row(n) {
                return n.dcg_rank;
            },
            place(n, r, row) {
                if(row.length) {
                    const left = row[row.length-1];
                    const g = (nodeWidth(left) + nodeWidth(n)) / 2;
                    x = Math.max(x, left.left_x + g);
                }
                n.left_x = x;
                n.hit_ins = 1;
                n.y = r*options.gapY + options.offsetY;
            },
            sib(isroot, left, right) {
                let g = best_dist(left, right);
                if(isroot) g = g*1.5;
                x += g;
            },
            pop(n) {
                n.x = (n.left_x + x)/2;
            },
            skip(n, indegree) {
                // rolling average of in-neighbor x positions
                n.x = (n.hit_ins*n.x + x)/++n.hit_ins;
                if(n.hit_ins === indegree)
                    delete n.hit_ins;
            },
            finish(rows) {
                // this is disgusting. patch up any places where nodes overlap by scanning
                // right far enough to find the space, then fill from left to right at the
                // minimum gap
                rows.forEach((row) => {
                    const sort = row.sort((a, b) => a.x - b.x);
                    let badi = null, badl = null, want;
                    for(let i=0; i<sort.length-1; ++i) {
                        const left = sort[i], right = sort[i+1];
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
                                let l, limit;
                                if(i < sort.length - 2) { // found space before right
                                    const extra = right.x - (badl + want);
                                    l = sort[badi].x + extra/2;
                                    limit = i+1;
                                } else {
                                    l = Math.max(sort[badi].x, badl - best_dist(sort[badi], sort[badi+1]) - (want - right.x + badl)/2);
                                    limit = sort.length;
                                }
                                for(let j = badi+1; j<limit; ++j) {
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

    let _nodes, _edges;
    function data(nodes, edges) {
        _nodes = nodes;
        _edges = edges;
    }

    function start() {
        _dfs(_nodes, _edges);
        _dispatch.call("end", null, _nodes, _edges);
    }

    function stop() {
    }

    const layout = {
        layoutAlgorithm() {
            return 'tree';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
        },
        on(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach((option) => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges) {
            data(nodes, edges);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return ['nodeWidth', 'offsetX', 'offsetY', 'rowFunction', 'gapY'];
        },
        populateLayoutNode(layout, node) {
            if(this.rowFunction())
                layout.dcg_rank = this.rowFunction.eval(node);
        },
        populateLayoutEdge() {},
        nodeWidth: property((n) => n.width),
        offsetX: property(30),
        offsetY: property(30),
        rowFunction: property(null),
        gapY: property(100)
    };
    return layout;
};

// Scripts needed for web worker
treeLayout.scripts = [];
