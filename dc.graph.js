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


/**
## Diagram

The dc_graph.diagram is a dc.js-compatible network visualization component. It registers in
the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
logically derives from
[the dc.js Base Mixin](https://github.com/dc-js/dc.js/blob/master/web/docs/api-latest.md#base-mixin),
but it does not physically derive from it since so much is different about network visualization
versus conventional charting.
**/
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
    _chart.zoomable = property(true);

    _chart.nodeDimension = property();
    _chart.nodeGroup = property();
    _chart.edgeDimension = property();
    _chart.edgeGroup = property();
    _chart.nodeKeyAccessor = property(function(kv) {
        return kv.key;
    });
    _chart.edgeKeyAccessor = property(function(kv) {
        return kv.key;
    });
    _chart.sourceAccessor = property();
    _chart.targetAccessor = property();

    _chart.nodeRadiusAccessor = property(function() {
        return DEFAULT_NODE_RADIUS;
    });
    _chart.nodeStrokeWidthAccessor = property(function() {
        return '1';
    });
    _chart.nodeStrokeAccessor = property(function() {
        return 'black';
    });
    _chart.nodeFillAccessor = property(function() {
        return 'white';
    });
    _chart.nodePadding = property(6);
    _chart.nodeLabelAccessor = property(function(kv) {
        return kv.value.label || kv.value.name;
    });

    _chart.edgeStrokeAccessor = property(function() {
        return 'black';
    });
    _chart.edgeStrokeWidthAccessor = property(function() {
        return '1';
    });
    _chart.edgeOpacityAccessor = property(function() {
        return '1';
    });
    _chart.edgeLabelAccessor = property(function(d) {
        return _chart.edgeKeyAccessor()(d);
    });
    _chart.edgeArrowhead = property(function() {
        return 'vee';
    });
    _chart.edgeArrowtail = property(function() {
        return null;
    });
    _chart.edgeIsLayoutAccessor = property(function(kv) {
        return !kv.value.notLayout;
    });
    _chart.edgeDistanceAccessor = property(function(kv) {
        return kv.value.distance;
    });
    _chart.baseLength = property(40);
    _chart.lengthStrategy = property('symmetric');

    _chart.transitionDuration = property(500);
    _chart.constrain = property(function(nodes, edges) {
        return [];
    });
    _chart.initLayoutOnRedraw = property(false);
    _chart.modLayout = property(function(layout) {});
    _chart.showLayoutSteps = property(true);

    function initLayout() {
        _d3cola = cola.d3adaptor()
            .avoidOverlaps(true)
            .size([_chart.width(), _chart.height()]);

        switch(_chart.lengthStrategy()) {
        case 'symmetric':
            _d3cola.symmetricDiffLinkLengths(_chart.baseLength());
            break;
        case 'jaccard':
            _d3cola.symmetricDiffLinkLengths(_chart.baseLength());
            break;
        case 'individual':
            _d3cola.linkDistance(function(e) {
                var d = e.orig ? original(_chart.edgeDistanceAccessor())(e) :
                        e.internal && e.internal.distance;
                return d || _chart.baseLength();
            });
            break;
        }

        if(_chart.modLayout())
            _chart.modLayout()(_d3cola);
    }

    function original(accessor) {
        return function(x) {
            return accessor(x.orig);
        };
    }
    function edge_id(d) {
        return 'edge-' + original(_chart.edgeKeyAccessor())(d).replace(/[^\w-_]/g, '-');
    }

    var _nodes = {}, _edges = {};

    _chart.redraw = function () {
        if(_chart.initLayoutOnRedraw())
            initLayout();

        var nodes = _chart.nodeGroup().all();
        var edges = _chart.edgeGroup().all();
        if(_d3cola)
            _d3cola.stop();

        var key_index_map = nodes.reduce(function(result, value, index) {
            result[_chart.nodeKeyAccessor()(value)] = index;
            return result;
        }, {});
        function wrap_node(v) {
            if(!_nodes[v.key]) _nodes[_chart.nodeKeyAccessor()(v)] = {};
            var v1 = _nodes[_chart.nodeKeyAccessor()(v)];
            v1.orig = v;
            v1.width = _chart.nodeRadiusAccessor()(v)*2 + _chart.nodePadding();
            v1.height = _chart.nodeRadiusAccessor()(v)*2 + _chart.nodePadding();
            return v1;
        }
        function wrap_edge(e) {
            if(!_edges[e.key]) _edges[_chart.edgeKeyAccessor()(e)] = {};
            var e1 = _edges[_chart.edgeKeyAccessor()(e)];
            e1.orig =  e;
            e1.source = key_index_map[_chart.sourceAccessor()(e)];
            e1.target = key_index_map[_chart.targetAccessor()(e)];
            return e1;
        }
        var nodes1 = nodes.map(wrap_node);
        var edges1 = edges.map(wrap_edge).filter(function(e) {
            return e.source!==undefined && e.target!==undefined;
        });

        // console.log("diagram.redraw " + nodes1.length + ',' + edges1.length);

        var edge = _edgeLayer.selectAll('.edge')
                .data(edges1, original(_chart.edgeKeyAccessor()));
        var edgeEnter = edge.enter().append('svg:path')
                .attr('class', 'edge')
                .attr('id', edge_id)
                .attr('stroke', original(_chart.edgeStrokeAccessor()))
                .attr('stroke-width', original(_chart.edgeStrokeWidthAccessor()))
                .attr('opacity', original(_chart.edgeOpacityAccessor()))
                .attr('marker-end', function(d) {
                    return 'url(#' + original(_chart.edgeArrowhead())(d) + ')';
                })
                .attr('marker-start', function(d) {
                    return 'url(#' + original(_chart.edgeArrowtail())(d) + ')';
                });
        var edgeExit = edge.exit();
        edgeExit.remove();

        // another wider copy of the edge just for hover events
        var edgeHover = _edgeLayer.selectAll('.edge-hover')
                .data(edges1, original(_chart.edgeKeyAccessor()));
        edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover', function(d) {
                d3.select('#' + edge_id(d) + '-label')
                    .attr('visibility', 'visible');
            })
            .on('mouseout', function(d) {
                d3.select('#' + edge_id(d) + '-label')
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();

        var edgeLabels = _edgeLayer.selectAll(".edge-label")
                .data(edges1, original(_chart.edgeKeyAccessor()));
        var edgeLabelsEnter = edgeLabels.enter()
              .append('text')
                .attr('id', function(d) {
                    return edge_id(d) + '-label';
                })
                .attr('visibility', 'hidden')
                .attr({'class':'edge-label',
                       'text-anchor': 'middle',
                       dy:-2})
              .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', function(d) {
                    return '#' + edge_id(d);
                })
                .text(function(d){
                    return original(_chart.edgeLabelAccessor())(d);
                });
        edgeLabels.exit().remove();

        var node = _nodeLayer.selectAll('.node')
                .data(nodes1, original(_chart.nodeKeyAccessor()));
        var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .call(_d3cola.drag);
        nodeEnter.append('circle');
        nodeEnter.append('text')
            .attr('class', 'nodelabel');
        node.select('circle')
            .attr('r', original(_chart.nodeRadiusAccessor()))
            .attr('stroke', original(_chart.nodeStrokeAccessor()))
            .attr('stroke-width', original(_chart.nodeStrokeWidthAccessor()))
            .attr('fill', original(_chart.nodeFillAccessor()));
        node.select('text')
            .attr('class', 'node-label')
            .text(original(_chart.nodeLabelAccessor()));
        var nodeExit = node.exit();
        var constraints = _chart.constrain()(nodes1, edges1);
        nodeExit.remove();

        _d3cola.on('tick', _chart.showLayoutSteps() ? function() {
            draw(node, edge, edgeHover, edgeLabels);
        } : null);

        // pseudo-cola.js features

        // 1. non-layout edges are drawn but not told to cola.js
        var layout_edges = edges1.filter(original(_chart.edgeIsLayoutAccessor()));
        var nonlayout_edges = edges1.filter(function(x) {
            return !original(_chart.edgeIsLayoutAccessor())(x);
        });
        nonlayout_edges.forEach(function(e) {
            e.source = nodes1[e.source];
            e.target = nodes1[e.target];
        });

        // 2. type=circle constraints
        var circle_constraints = constraints.filter(function(c) {
            return c.type === 'circle';
        });
        var noncircle_constraints = constraints.filter(function(c) {
            return c.type !== 'circle';
        });
        circle_constraints.forEach(function(c) {
            var R = 300; // c.distance / 2*Math.sin(Math.PI/c.nodes.length);
            var nindices = c.nodes.map(function(x) { return x.node; });
            var namef = function(i) {
                return original(_chart.nodeKeyAccessor())(nodes1[i]);
            };
            var wheel = dc_graph.wheel_edges(namef, nindices, R)
                    .map(function(e) {
                        var e1 = {internal: e};
                        e1.source = key_index_map[e.sourcename];
                        e1.target = key_index_map[e.targetname];
                        return e1;
                    });
            layout_edges = layout_edges.concat(wheel);
        });
        _d3cola.nodes(nodes1)
            .links(layout_edges)
            .constraints(noncircle_constraints)
            .start(10,20,20)
            .on('end', function() {
                if(!_chart.showLayoutSteps())
                    draw(node, edge, edgeHover, edgeLabels);
                _dispatch.end();
            });
        return this;
    };

    function edge_path(d) {
        var deltaX = d.target.x - d.source.x,
            deltaY = d.target.y - d.source.y,
            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
            normX = deltaX / dist,
            normY = deltaY / dist,
            sourcePadding = original(_chart.nodeRadiusAccessor())(d.source) +
                original(_chart.nodeStrokeWidthAccessor())(d.source) / 2,
            targetPadding = original(_chart.nodeRadiusAccessor())(d.target) +
                original(_chart.nodeStrokeWidthAccessor())(d.target) / 2,
            sourceX = d.source.x + (sourcePadding * normX),
            sourceY = d.source.y + (sourcePadding * normY),
            targetX = d.target.x - (targetPadding * normX),
            targetY = d.target.y - (targetPadding * normY);
        d.length = Math.hypot(targetX-sourceX, targetY-sourceY);
        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
    }
    function draw(node, edge, edgeHover, edgeLabels) {
        node.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

        edge.attr("d", edge_path);
        edgeHover.attr('d', edge_path);

        edgeLabels
            .attr('transform', function(d,i) {
            if (d.target.x < d.source.x) {
                var bbox = this.getBBox(),
                    rx = bbox.x + bbox.width/2,
                    ry = bbox.y + bbox.height/2;
                return 'rotate(180 ' + rx + ' ' + ry + ')';
            }
            else {
                return 'rotate(0)';
            }
        })
            .attr('dy', function(d, i) {
                if (d.target.x < d.source.x)
                    return 11;
                else
                    return -2;
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

    _chart.defineArrow = function(name, width, height, refX, refY, drawf) {
        _svg.append('svg:defs').append('svg:marker')
            .attr('id', name)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', refX)
            .attr('refY', refY)
            .attr('markerWidth', width)
            .attr('markerHeight', height)
            .attr('orient', 'auto')
            .call(drawf);
    };

    function doZoom() {
        _g.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
    }


    function generateSvg() {
        _svg = _chart.root().append('svg')
            .attr('width', _chart.width())
            .attr('height', _chart.height());

        _chart.defineArrow('vee', 12, 12, 10, 0, function(marker) {
            marker.append('svg:path')
                .attr('d', 'M0,-5 L10,0 L0,5 L3,0')
                .attr('stroke-width', '0px');
        });
        _chart.defineArrow('dot', 7, 7, 0, 0, function(marker) {
            marker.append('svg:circle')
                .attr('r', 5)
                .attr('cx', 5)
                .attr('cy', 0)
                .attr('stroke-width', '0px');
        });
        if(_chart.zoomable())
            _svg.call(d3.behavior.zoom().on("zoom", doZoom));

        return _svg;
    }

    _chart.root(d3.select(parent));

    dc.registerChart(_chart, chartGroup);
    return _chart;
};


// load a graph from various formats and return the data in consistent {nodes, links} format
dc_graph.load_graph = function(file, callback) {
    if(/\.json$/.test(file))
        d3.json(file, callback);
    else if(/\.gv|\.dot$/.test(file))
        d3.text(file, function (error, f) {
            if(error) {
                callback(error, null);
                return;
            }
            var digraph = graphlibDot.parse(f);

            var nodeNames = digraph.nodes();
            var nodes = new Array(nodeNames.length);
            nodeNames.forEach(function (name, i) {
                var node = nodes[i] = digraph._nodes[nodeNames[i]];
                node.id = i;
                node.name = name;
            });

            var edgeNames = digraph.edges();
            var edges = [];
            edgeNames.forEach(function(e) {
                var edge = digraph._edges[e];
                edges.push({
                    source: digraph._nodes[edge.u].id,
                    target: digraph._nodes[edge.v].id,
                    sourcename: edge.u,
                    targetname: edge.v
                });
            });
            var graph = {nodes: nodes, links: edges};
            callback(null, graph);
        });
};

dc_graph.node_name = function(i) {
    // a-z, A-Z, aa-Zz, then quit
    if(i<26)
        return String.fromCharCode(97+i);
    else if(i<52)
        return String.fromCharCode(65+i-26);
    else if(i<52*52)
        return dc_graph.node_name(Math.floor(i/52)) + dc_graph.node_name(i%52);
    else throw new Error("no, that's too large");
};
dc_graph.node_object = function(i, attrs) {
    attrs = attrs || {};
    return _.extend({
        id: i,
        name: dc_graph.node_name(i)
    }, attrs);
};

dc_graph.edge_object = function(namef, i, j, attrs) {
    attrs = attrs || {};
    return _.extend({
        source: i,
        target: j,
        sourcename: namef(i),
        targetname: namef(j)
    }, attrs);
};

dc_graph.generate = function(name, N, callback) {
    var nodes, edges, i, j;
    var namef = function(i) {
        return nodes[i].name;
    };
    switch(name) {
    case 'clique':
        nodes = new Array(N);
        edges = [];
        for(i = 0; i<N; ++i) {
            nodes[i] = dc_graph.node_object(i, {circle: "A"});
            for(j=0; j<i; ++j)
                edges.push(dc_graph.edge_object(namef, i, j, {notLayout: true }));
        }
        break;
    case 'wheel':
        nodes = new Array(N);
        for(i = 0; i < N; ++i)
            nodes[i] = dc_graph.node_object(i);
        edges = dc_graph.wheel_edges(namef, _.range(N), N*15);
        break;
    default:
        throw new Error("unknown generation type "+name);
    }
    var graph = {nodes: nodes, links: edges};
    callback(null, graph);
};

dc_graph.wheel_edges = function(namef, nindices, R) {
    var N = nindices.length;
    var edges = [];
    var strutSkip = Math.floor(N/2),
        rimLength = 2 * R * Math.sin(Math.PI / N),
        strutLength = 2 * R * Math.sin(strutSkip * Math.PI / N);
    for(var i = 0; i < N; ++i)
        edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+1)%N], {distance: rimLength}));
    for(i = 0; i < N/2; ++i) {
        edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+strutSkip)%N], {distance: strutLength}));
        if(N%2 && i != Math.floor(N/2))
            edges.push(dc_graph.edge_object(namef, nindices[i], nindices[(i+N-strutSkip)%N], {distance: strutLength}));
    }
    return edges;
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