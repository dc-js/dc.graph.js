/*!
 *  dc.graph 0.1.0
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015 Gordon Woodhull
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
(function() { function _dc_graph(d3, crossfilter, dc) {
'use strict';

var dc_graph = {
    version: '0.1.0'
};

var property = function (defaultValue) {
    var value = defaultValue, react = null;
    var ret = function (_) {
        if (!arguments.length) {
            return value;
        }
        value = _;
        if(react)
            react();
        return this;
    };
    ret.react = function(_) {
        if (!arguments.length) {
            return react;
        }
        react = _;
        return this;
    };
    return ret;
};


dc_graph.diagram = function (parent, chartGroup) {
    // different enough from regular dc charts that we don't use bases
    var _chart = {};
    var _svg = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    var _d3cola = null;
    var DEFAULT_NODE_RADIUS = 25;
    var _dispatch = d3.dispatch('end');

    _chart.root = property(null);
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
    _chart.nodeRadiusAccessor = property(function() { return DEFAULT_NODE_RADIUS; });
    _chart.nodeColorAccessor = property(function() { return 'white'; });
    _chart.nodePadding = property(6);
    _chart.nodeLabelAccessor = property(function(kv) { return kv.value.label; });
    _chart.transitionDuration = property(500);
    _chart.constrain = property(function(nodes, edges) { return []; });
    _chart.initLayoutOnRedraw = property(false);
    _chart.modLayout = property(function(layout) {});
    _chart.showTicks = property(true);

    function initLayout() {
        _d3cola = cola.d3adaptor()
            .avoidOverlaps(true)
            .size([_chart.width(), _chart.height()]);
        if(_chart.modLayout())
            _chart.modLayout()(_d3cola);
    }

    function original(accessor) {
        return function(x) {
            return accessor(x.orig);
        };
    }

    _chart.redraw = function () {
        var nodes = _chart.nodeGroup().all();
        var edges = _chart.edgeGroup().all();
        if(_d3cola)
            _d3cola.stop();

        var key_index_map = nodes.reduce(function(result, value, index) {
            result[_chart.nodeKeyAccessor()(value)] = index;
            return result;
        }, {});
        var nodes1 = nodes.map(function(v) {
            return {orig: v,
                    width: _chart.nodeRadiusAccessor()(v)*2 + _chart.nodePadding(),
                    height: _chart.nodeRadiusAccessor()(v)*2 + _chart.nodePadding()};
        });
        var edges1 = edges.map(function(e) {
            return {orig: e,
                    source: key_index_map[_chart.sourceAccessor()(e)],
                    target: key_index_map[_chart.targetAccessor()(e)]};
        }).filter(function(e) {
            return e.source!==undefined && e.target!==undefined;
        });

        // console.log("diagram.redraw " + nodes1.length + ',' + edges1.length);

        var edge = _edgeLayer.selectAll('.edge')
                .data(edges1, original(_chart.edgeKeyAccessor()));
        var edgeEnter = edge.enter().append('svg:path')
                .attr('class', 'edge');
        var edgeExit = edge.exit();

        edgeExit.remove();

        var node = _nodeLayer.selectAll('.node')
                .data(nodes1, original(_chart.nodeKeyAccessor()));
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node');
        nodeEnter.append('circle');
        nodeEnter.append('text')
            .attr('class', 'nodelabel');
        node.select('circle')
            .attr('r', original(_chart.nodeRadiusAccessor()))
            .attr('fill', original(_chart.nodeColorAccessor()));
        node.select('text')
            .text(original(_chart.nodeLabelAccessor()));
        var nodeExit = node.exit();
        var constraints = _chart.constrain()(nodes1, edges1);
        nodeExit.remove();

        _d3cola.on('tick', _chart.showTicks() ? function() {
            draw(node, edge);
        } : null);

        if(_chart.initLayoutOnRedraw())
            initLayout();
        _d3cola.nodes(nodes1)
            .links(edges1)
            .constraints(constraints)
            .start(10,20,20)
            .on('end', function() {
                if(!_chart.showTicks())
                    draw(node,edge);
                _dispatch.end();
            });
        return this;
    };

    function draw(node, edge) {
        edge.attr("d", function (d) {
            var deltaX = d.target.x - d.source.x,
                deltaY = d.target.y - d.source.y,
                dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                normX = deltaX / dist,
                normY = deltaY / dist,
                sourcePadding = _chart.nodeRadiusAccessor()(d.source.orig)-1,
                targetPadding = _chart.nodeRadiusAccessor()(d.target.orig)-1,
                sourceX = d.source.x + (sourcePadding * normX),
                sourceY = d.source.y + (sourcePadding * normY),
                targetX = d.target.x - (targetPadding * normX),
                targetY = d.target.y - (targetPadding * normY);
            return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
        }).attr("width", function (d) {
            var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
            return Math.sqrt(dx * dx + dy * dy);
        });

        node.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
    }

    _chart.render = function () {
        if(!_chart.initLayoutOnRedraw())
            initLayout();
        _chart.resetSvg();
        _g = _svg.append('g');
        _edgeLayer = _g.append('g');
        _nodeLayer = _g.append('g');
        return _chart.redraw();
    };

    _chart.on = function(event, f) {
        _dispatch.on(event, f);
        return this;
    };

    // copied from dc's baseMixin because there is a lot of stuff we don't
    // want from there (like dimension, group)
    _chart.select = function (s) {
        return _chart.root().select(s);
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

    _chart.root(d3.select(parent));

    dc.registerChart(_chart, chartGroup);
    return _chart;
};


dc_graph.d3 = d3;
dc_graph.crossfilter = crossfilter;
dc_graph.dc = dc;

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

//# sourceMappingURL=dc.graph.js.map