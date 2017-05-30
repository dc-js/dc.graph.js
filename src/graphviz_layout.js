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
    var _dotString;

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
    function data(nodes, edges, constraints, options) {
        var lines = [];
        var directed = layout !== 'neato';
        lines.push((directed ? 'digraph' : 'graph') + ' g {');
        lines.push('graph ' + stringize_properties([
            stringize_property('nodesep', graphviz.nodesep()/72),
            stringize_property('ranksep', graphviz.ranksep()/72),
            stringize_property('rankdir', graphviz.rankdir())
        ]));
        lines = lines.concat(nodes.map(function(v) {
            var props = [];
            if(v.dcg_nodeFixed)
                props.push(stringize_property('pos', [
                    v.dcg_nodeFixed.x,
                    1000-v.dcg_nodeFixed.y
                ].join(',')));
            props.push(stringize_property('width', v.width/72));
            props.push(stringize_property('height', v.height/72));
            return '  "' + encode_name(v.dcg_nodeKey) + '" ' + stringize_properties(props);
        }));
        lines = lines.concat(edges.map(function(e) {
            return '  "' + encode_name(e.dcg_edgeSource) + (directed ? '" -> "' : '" -- "') +
                encode_name(e.dcg_edgeTarget) + '" ' + stringize_properties([
                    stringize_property('id', encode_name(e.dcg_edgeKey))
                ]);
        }));
        lines.push('}');
        lines.push('');
        _dotString = lines.join('\n');
    }

    function process_response(error, result) {
        _dispatch.start();
        var bb = result.bb.split(',').map(function(x) { return +x; });
        var nodes = (result.objects || []).map(function(n) {
            var pos = n.pos.split(',');
            return {
                dcg_nodeKey: decode_name(n.name),
                x: +pos[0],
                y: bb[3] - pos[1]
            };
        });
        var edges = (result.edges || []).map(function(e) {
            return {
                dcg_edgeKey: decode_name(e.id)
            };
        });
        _dispatch.end(nodes, edges);
    }

    function start(options) {
        if(server) {
            d3.json(server)
                .header("Content-type", "application/x-www-form-urlencoded")
                .post('layouttool=' + layout + '&' + encodeURIComponent(_dotString), process_response);
        }
        else {
            var result = Viz(_dotString, {format: 'json', engine: layout});
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
        on: function(event, f) {
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
        data: function(nodes, edges, constraints, options) {
            data(nodes, edges, constraints, options);
        },
        start: function(options) {
            start(options);
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

