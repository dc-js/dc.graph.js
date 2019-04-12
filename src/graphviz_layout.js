/**
 * `dc_graph.graphviz_layout` is an adaptor for viz.js (graphviz) layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `graphviz_layout` also implements the attributes from
 * {@link dc_graph.graphviz_attrs graphviz_attrs}
 * @class graphviz_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.graphviz_layout}
 **/
dc_graph.graphviz_layout = function(id, layout, server) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');
    var _dotInput, _dotString;

    function init(options) {
    }

    function encode_name(name) {
        return name.replace(/^%/, '&#37;');
    }
    function decode_name(name) {
        return name.replace(/^&#37;/, '%');
    }
    function stringize_property(prop, value) {
        return [prop, '"' + value + '"'].join('=');
    }
    function stringize_properties(props) {
        return '[' + props.join(', ') + ']';
    }
    function data(nodes, edges, clusters) {
        if(_dotInput) {
            _dotString = _dotInput;
            return;
        }
        var lines = [];
        var directed = layout !== 'neato';
        lines.push((directed ? 'digraph' : 'graph') + ' g {');
        lines.push('graph ' + stringize_properties([
            stringize_property('nodesep', graphviz.nodesep()/72),
            stringize_property('ranksep', graphviz.ranksep()/72),
            stringize_property('rankdir', graphviz.rankdir())
        ]));
        var cluster_nodes = {};
        nodes.forEach(function(n) {
            var cl = n.dcg_nodeParentCluster;
            if(cl) {
                cluster_nodes[cl] = cluster_nodes[cl] || [];
                cluster_nodes[cl].push(n.dcg_nodeKey);
            }
        });
        var cluster_children = {}, tops = [];
        clusters.forEach(function(c) {
            var p = c.dcg_clusterParent;
            if(p) {
                cluster_children[p] = cluster_children[p] || [];
                cluster_children[p].push(c.dcg_clusterKey);
            } else tops.push(c.dcg_clusterKey);
        });

        function print_subgraph(i, c) {
            var indent = ' '.repeat(i*2);
            lines.push(indent + 'subgraph "' + c + '" {');
            if(cluster_children[c])
                cluster_children[c].forEach(print_subgraph.bind(null, i+1));
            lines.push(indent + '  ' + cluster_nodes[c].join(' '));
            lines.push(indent + '}');
        }
        tops.forEach(print_subgraph.bind(null, 1));

        lines = lines.concat(nodes.map(function(v) {
            var props = [
                stringize_property('width', v.width/72),
                stringize_property('height', v.height/72),
                stringize_property('fixedsize', 'shape'),
                stringize_property('shape', v.abstract.shape)
            ];
            if(v.dcg_nodeFixed)
                props.push(stringize_property('pos', [
                    v.dcg_nodeFixed.x,
                    1000-v.dcg_nodeFixed.y
                ].join(',')));
            return '  "' + encode_name(v.dcg_nodeKey) + '" ' + stringize_properties(props);
        }));
        lines = lines.concat(edges.map(function(e) {
            return '  "' + encode_name(e.dcg_edgeSource) + (directed ? '" -> "' : '" -- "') +
                encode_name(e.dcg_edgeTarget) + '" ' + stringize_properties([
                    stringize_property('id', encode_name(e.dcg_edgeKey)),
                stringize_property('arrowhead', 'none'),
                stringize_property('arrowtail', 'none')
                ]);
        }));
        lines.push('}');
        lines.push('');
        _dotString = lines.join('\n');
    }

    function process_response(error, result) {
        if(error) {
            console.warn("graphviz layout failed: ", error);
            return;
        }
        _dispatch.start();
        var bb = result.bb.split(',').map(function(x) { return +x; });
        var nodes = (result.objects || []).filter(function(n) {
            return n.pos; // remove non-nodes like clusters
        }).map(function(n) {
            var pos = n.pos.split(',');
            if(isNaN(pos[0]) || isNaN(pos[1])) {
                console.warn('got a NaN position from graphviz');
                pos[0] = pos[1] = 0;
            }
            return {
                dcg_nodeKey: decode_name(n.name),
                x: +pos[0],
                y: bb[3] - pos[1]
            };
        });
        var clusters = (result.objects || []).filter(function(n) {
            return /^cluster/.test(n.name);
        });
        clusters.forEach(function(c) {
            c.dcg_clusterKey = c.name;

            // gv: llx, lly, urx, ury, up-positive
            var cbb = c.bb.split(',').map(function(s) { return +s; });
            c.bounds = {left: cbb[0], top: bb[3] - cbb[3],
                        right: cbb[2], bottom: bb[3] - cbb[1]};
        });
        var edges = (result.edges || []).map(function(e) {
            var e2 = {
                dcg_edgeKey: decode_name(e.id || 'n' + e._gvid)
            };
            if(e._draw_) {
                var directive = e._draw_.find(function(d) { return d.op && d.points; });
                e2.points = directive.points.map(function(p) { return {x: p[0], y: bb[3] - p[1]}; });
            }
            return e2;
        });
        _dispatch.end(nodes, edges, clusters);
    }

    function start() {
        if(server) {
            d3.json(server)
                .header("Content-type", "application/x-www-form-urlencoded")
                .post('layouttool=' + layout + '&' + encodeURIComponent(_dotString), process_response);
        }
        else {
            var result = Viz(_dotString, {format: 'json', engine: layout, totalMemory: 1 << 25});
            result = JSON.parse(result);
            process_response(null, result);
        }
    }

    function stop() {
    }

    var graphviz = dc_graph.graphviz_attrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm: function() {
            return layout;
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
        data: function(graph, nodes, edges, clusters) {
            data(nodes, edges, clusters);
        },
        dotInput: function(text) {
            _dotInput = text;
            return this;
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return graphviz_keys;
        },
        populateLayoutNode: function() {},
        populateLayoutEdge: function() {}
    });
}

