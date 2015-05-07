(function() { function _dc_graph(d3, crossfilter, dc) {
'use strict';
var dc_graph = {
    version: '0.1'
};

dc_graph.d3 = d3;
dc_graph.crossfilter = crossfilter;
dc_graph.dc = dc;

var property = function (defaultValue) {
    var value = defaultValue;
    return function (_) {
        if (!arguments.length) {
            return value;
        }
        value = _;
        return this;
    };
};


dc_graph.diagram = function (parent, _chart) {
    var _root = null;
    var _svg = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _d3cola = null;
    var _constraints = {};

    _chart.width = property(200);
    _chart.height = property(200);
    _chart.nodeDim = property();
    _chart.nodeGroup = property();
    _chart.edgeDim = property();
    _chart.edgeGroup = property();
    _chart.nodeKeyAccessor = property(function(kv) { return kv.key; });
    _chart.edgeKeyAccessor = property(function(kv) { return kv.key; });
    _chart.sourceAccessor = property();
    _chart.targetAccessor = property();
    _chart.transitionDuration = property(500);
    _chart.constrainer = property({
        edge_enter: function(edge, constraints) { return this; },
        node_enter: function(node, constraints) { return this; },
        edge_update: function(edge, constraints) { return this; },
        node_update: function(node, constraints) { return this; },
        edge_exit: function(edge, constraints) { return this; },
        node_exit: function(node, constraints) { return this; }
    });

    function original(accessor) {
        return function(x) {
            return accessor(x.original);
        };
    }

    _chart.redraw = function () {
        var nodes = _chart.nodeGroup().all();
        var edges = _chart.edgeGroup().all();

        var key_index_map = nodes.reduce(function(result, value, index) {
            result[_chart.nodeKeyAccessor()(value)] = index;
            return result;
        }, {});
        var nodes1 = nodes.map(function(v) {
            return {original: v};
        });
        var edges1 = edges.map(function(v) {
            return {original: v,
                    source: key_index_map[this.sourceAccessor()(v)],
                    target: key_index_map[this.targetAccessor()(v)]};
        });

        _d3cola.nodes(nodes1)
            .links(edges1)
            .start();

        var edge = _edgeLayer.selectAll('.edge')
                .data(edges1, original(_chart.edgeKeyAccessor()));

        var edgeEnter = edge.enter().append('svg:path')
                .attr('class', 'edge');
        var edgeExit = edge.exit();
        _chart.constrainer().edge_enter(edgeEnter, _constraints)
            .edge_update(edge, _constraints)
            .edge_exit(edgeExit, _constraints);
        edgeExit.transition(_chart.transitionDuration()).remove();
        
    };

    _chart.render = function () {
        _chart.resetSvg();
        _g = _svg.append('g');
        _nodeLayer = _g.append('g');
        _edgeLayer = _g.append('g');
        _d3cola = cola.d3adaptor()
            .linkDistance(60)
            .size([_chart.width(), _chart.height()]);
        return _chart.redraw();
    };

    // copied from dc's baseMixin because there is a lot of stuff we don't
    // want from there (like dimension, group)
    _chart.select = function (s) {
        return _root.select(s);
    };

    _chart.resetSvg = function () {
        _chart.select('svg').remove();
        return generateSvg();
    };

    function generateSvg() {
        _svg = _chart.root().append('svg')
            .attr('width', _chart.width())
            .attr('height', _chart.height());
        return _svg;
    }

    _root = d3.select(parent);
    return _chart;
};

return dc_graph;
}
    if (typeof define === 'function' && define.amd) {
        define(["d3", "crossfilter", "dc"], _dc_graph);
    } else if (typeof module == "object" && module.exports) {
        var _d3 = require('d3');
        var _crossfilter = require('crossfilter');
        if (typeof _crossfilter !== "function") {
            _crossfilter = _crossfilter.crossfilter;
        }
        var _dc = require('dc');
        module.exports = _dc_graph(_d3, _crossfilter, _dc);
    } else {
        this.dc_graph = _dc_graph(d3, crossfilter, dc);
    }
}
)();
