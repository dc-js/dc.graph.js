(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.cola = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./src/adaptor"));
__export(require("./src/d3adaptor"));
__export(require("./src/descent"));
__export(require("./src/geom"));
__export(require("./src/gridrouter"));
__export(require("./src/handledisconnected"));
__export(require("./src/layout"));
__export(require("./src/layout3d"));
__export(require("./src/linklengths"));
__export(require("./src/powergraph"));
__export(require("./src/pqueue"));
__export(require("./src/rbtree"));
__export(require("./src/rectangle"));
__export(require("./src/shortestpaths"));
__export(require("./src/vpsc"));
__export(require("./src/batch"));

},{"./src/adaptor":2,"./src/batch":3,"./src/d3adaptor":4,"./src/descent":7,"./src/geom":8,"./src/gridrouter":9,"./src/handledisconnected":10,"./src/layout":11,"./src/layout3d":12,"./src/linklengths":13,"./src/powergraph":14,"./src/pqueue":15,"./src/rbtree":16,"./src/rectangle":17,"./src/shortestpaths":18,"./src/vpsc":19}],2:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var layout_1 = require("./layout");
var LayoutAdaptor = (function (_super) {
    __extends(LayoutAdaptor, _super);
    function LayoutAdaptor(options) {
        var _this = _super.call(this) || this;
        var self = _this;
        var o = options;
        if (o.trigger) {
            _this.trigger = o.trigger;
        }
        if (o.kick) {
            _this.kick = o.kick;
        }
        if (o.drag) {
            _this.drag = o.drag;
        }
        if (o.on) {
            _this.on = o.on;
        }
        _this.dragstart = _this.dragStart = layout_1.Layout.dragStart;
        _this.dragend = _this.dragEnd = layout_1.Layout.dragEnd;
        return _this;
    }
    LayoutAdaptor.prototype.trigger = function (e) { };
    ;
    LayoutAdaptor.prototype.kick = function () { };
    ;
    LayoutAdaptor.prototype.drag = function () { };
    ;
    LayoutAdaptor.prototype.on = function (eventType, listener) { return this; };
    ;
    return LayoutAdaptor;
}(layout_1.Layout));
exports.LayoutAdaptor = LayoutAdaptor;
function adaptor(options) {
    return new LayoutAdaptor(options);
}
exports.adaptor = adaptor;

},{"./layout":11}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var layout_1 = require("./layout");
var gridrouter_1 = require("./gridrouter");
function gridify(pgLayout, nudgeGap, margin, groupMargin) {
    pgLayout.cola.start(0, 0, 0, 10, false);
    var gridrouter = route(pgLayout.cola.nodes(), pgLayout.cola.groups(), margin, groupMargin);
    return gridrouter.routeEdges(pgLayout.powerGraph.powerEdges, nudgeGap, function (e) { return e.source.routerNode.id; }, function (e) { return e.target.routerNode.id; });
}
exports.gridify = gridify;
function route(nodes, groups, margin, groupMargin) {
    nodes.forEach(function (d) {
        d.routerNode = {
            name: d.name,
            bounds: d.bounds.inflate(-margin)
        };
    });
    groups.forEach(function (d) {
        d.routerNode = {
            bounds: d.bounds.inflate(-groupMargin),
            children: (typeof d.groups !== 'undefined' ? d.groups.map(function (c) { return nodes.length + c.id; }) : [])
                .concat(typeof d.leaves !== 'undefined' ? d.leaves.map(function (c) { return c.index; }) : [])
        };
    });
    var gridRouterNodes = nodes.concat(groups).map(function (d, i) {
        d.routerNode.id = i;
        return d.routerNode;
    });
    return new gridrouter_1.GridRouter(gridRouterNodes, {
        getChildren: function (v) { return v.children; },
        getBounds: function (v) { return v.bounds; }
    }, margin - groupMargin);
}
function powerGraphGridLayout(graph, size, grouppadding) {
    var powerGraph;
    graph.nodes.forEach(function (v, i) { return v.index = i; });
    new layout_1.Layout()
        .avoidOverlaps(false)
        .nodes(graph.nodes)
        .links(graph.links)
        .powerGraphGroups(function (d) {
        powerGraph = d;
        powerGraph.groups.forEach(function (v) { return v.padding = grouppadding; });
    });
    var n = graph.nodes.length;
    var edges = [];
    var vs = graph.nodes.slice(0);
    vs.forEach(function (v, i) { return v.index = i; });
    powerGraph.groups.forEach(function (g) {
        var sourceInd = g.index = g.id + n;
        vs.push(g);
        if (typeof g.leaves !== 'undefined')
            g.leaves.forEach(function (v) { return edges.push({ source: sourceInd, target: v.index }); });
        if (typeof g.groups !== 'undefined')
            g.groups.forEach(function (gg) { return edges.push({ source: sourceInd, target: gg.id + n }); });
    });
    powerGraph.powerEdges.forEach(function (e) {
        edges.push({ source: e.source.index, target: e.target.index });
    });
    new layout_1.Layout()
        .size(size)
        .nodes(vs)
        .links(edges)
        .avoidOverlaps(false)
        .linkDistance(30)
        .symmetricDiffLinkLengths(5)
        .convergenceThreshold(1e-4)
        .start(100, 0, 0, 0, false);
    return {
        cola: new layout_1.Layout()
            .convergenceThreshold(1e-3)
            .size(size)
            .avoidOverlaps(true)
            .nodes(graph.nodes)
            .links(graph.links)
            .groupCompactness(1e-4)
            .linkDistance(30)
            .symmetricDiffLinkLengths(5)
            .powerGraphGroups(function (d) {
            powerGraph = d;
            powerGraph.groups.forEach(function (v) {
                v.padding = grouppadding;
            });
        }).start(50, 0, 100, 0, false),
        powerGraph: powerGraph
    };
}
exports.powerGraphGridLayout = powerGraphGridLayout;

},{"./gridrouter":9,"./layout":11}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var d3v3 = require("./d3v3adaptor");
var d3v4 = require("./d3v4adaptor");
;
function d3adaptor(d3Context) {
    if (!d3Context || isD3V3(d3Context)) {
        return new d3v3.D3StyleLayoutAdaptor();
    }
    return new d3v4.D3StyleLayoutAdaptor(d3Context);
}
exports.d3adaptor = d3adaptor;
function isD3V3(d3Context) {
    var v3exp = /^3\./;
    return d3Context.version && d3Context.version.match(v3exp) !== null;
}

},{"./d3v3adaptor":5,"./d3v4adaptor":6}],5:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var layout_1 = require("./layout");
var D3StyleLayoutAdaptor = (function (_super) {
    __extends(D3StyleLayoutAdaptor, _super);
    function D3StyleLayoutAdaptor() {
        var _this = _super.call(this) || this;
        _this.event = d3.dispatch(layout_1.EventType[layout_1.EventType.start], layout_1.EventType[layout_1.EventType.tick], layout_1.EventType[layout_1.EventType.end]);
        var d3layout = _this;
        var drag;
        _this.drag = function () {
            if (!drag) {
                var drag = d3.behavior.drag()
                    .origin(layout_1.Layout.dragOrigin)
                    .on("dragstart.d3adaptor", layout_1.Layout.dragStart)
                    .on("drag.d3adaptor", function (d) {
                    layout_1.Layout.drag(d, d3.event);
                    d3layout.resume();
                })
                    .on("dragend.d3adaptor", layout_1.Layout.dragEnd);
            }
            if (!arguments.length)
                return drag;
            this
                .call(drag);
        };
        return _this;
    }
    D3StyleLayoutAdaptor.prototype.trigger = function (e) {
        var d3event = { type: layout_1.EventType[e.type], alpha: e.alpha, stress: e.stress };
        this.event[d3event.type](d3event);
    };
    D3StyleLayoutAdaptor.prototype.kick = function () {
        var _this = this;
        d3.timer(function () { return _super.prototype.tick.call(_this); });
    };
    D3StyleLayoutAdaptor.prototype.on = function (eventType, listener) {
        if (typeof eventType === 'string') {
            this.event.on(eventType, listener);
        }
        else {
            this.event.on(layout_1.EventType[eventType], listener);
        }
        return this;
    };
    return D3StyleLayoutAdaptor;
}(layout_1.Layout));
exports.D3StyleLayoutAdaptor = D3StyleLayoutAdaptor;
function d3adaptor() {
    return new D3StyleLayoutAdaptor();
}
exports.d3adaptor = d3adaptor;

},{"./layout":11}],6:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var layout_1 = require("./layout");
var D3StyleLayoutAdaptor = (function (_super) {
    __extends(D3StyleLayoutAdaptor, _super);
    function D3StyleLayoutAdaptor(d3Context) {
        var _this = _super.call(this) || this;
        _this.d3Context = d3Context;
        _this.event = d3Context.dispatch(layout_1.EventType[layout_1.EventType.start], layout_1.EventType[layout_1.EventType.tick], layout_1.EventType[layout_1.EventType.end]);
        var d3layout = _this;
        var drag;
        _this.drag = function () {
            if (!drag) {
                var drag = d3Context.drag()
                    .subject(layout_1.Layout.dragOrigin)
                    .on("start.d3adaptor", layout_1.Layout.dragStart)
                    .on("drag.d3adaptor", function (d) {
                    layout_1.Layout.drag(d, d3Context.event);
                    d3layout.resume();
                })
                    .on("end.d3adaptor", layout_1.Layout.dragEnd);
            }
            if (!arguments.length)
                return drag;
            arguments[0].call(drag);
        };
        return _this;
    }
    D3StyleLayoutAdaptor.prototype.trigger = function (e) {
        var d3event = { type: layout_1.EventType[e.type], alpha: e.alpha, stress: e.stress };
        this.event.call(d3event.type, d3event);
    };
    D3StyleLayoutAdaptor.prototype.kick = function () {
        var _this = this;
        var t = this.d3Context.timer(function () { return _super.prototype.tick.call(_this) && t.stop(); });
    };
    D3StyleLayoutAdaptor.prototype.on = function (eventType, listener) {
        if (typeof eventType === 'string') {
            this.event.on(eventType, listener);
        }
        else {
            this.event.on(layout_1.EventType[eventType], listener);
        }
        return this;
    };
    return D3StyleLayoutAdaptor;
}(layout_1.Layout));
exports.D3StyleLayoutAdaptor = D3StyleLayoutAdaptor;

},{"./layout":11}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Locks = (function () {
    function Locks() {
        this.locks = {};
    }
    Locks.prototype.add = function (id, x) {
        this.locks[id] = x;
    };
    Locks.prototype.clear = function () {
        this.locks = {};
    };
    Locks.prototype.isEmpty = function () {
        for (var l in this.locks)
            return false;
        return true;
    };
    Locks.prototype.apply = function (f) {
        for (var l in this.locks) {
            f(Number(l), this.locks[l]);
        }
    };
    return Locks;
}());
exports.Locks = Locks;
var Descent = (function () {
    function Descent(x, D, G) {
        if (G === void 0) { G = null; }
        this.D = D;
        this.G = G;
        this.threshold = 0.0001;
        this.numGridSnapNodes = 0;
        this.snapGridSize = 100;
        this.snapStrength = 1000;
        this.scaleSnapByMaxH = false;
        this.random = new PseudoRandom();
        this.project = null;
        this.x = x;
        this.k = x.length;
        var n = this.n = x[0].length;
        this.H = new Array(this.k);
        this.g = new Array(this.k);
        this.Hd = new Array(this.k);
        this.a = new Array(this.k);
        this.b = new Array(this.k);
        this.c = new Array(this.k);
        this.d = new Array(this.k);
        this.e = new Array(this.k);
        this.ia = new Array(this.k);
        this.ib = new Array(this.k);
        this.xtmp = new Array(this.k);
        this.locks = new Locks();
        this.minD = Number.MAX_VALUE;
        var i = n, j;
        while (i--) {
            j = n;
            while (--j > i) {
                var d = D[i][j];
                if (d > 0 && d < this.minD) {
                    this.minD = d;
                }
            }
        }
        if (this.minD === Number.MAX_VALUE)
            this.minD = 1;
        i = this.k;
        while (i--) {
            this.g[i] = new Array(n);
            this.H[i] = new Array(n);
            j = n;
            while (j--) {
                this.H[i][j] = new Array(n);
            }
            this.Hd[i] = new Array(n);
            this.a[i] = new Array(n);
            this.b[i] = new Array(n);
            this.c[i] = new Array(n);
            this.d[i] = new Array(n);
            this.e[i] = new Array(n);
            this.ia[i] = new Array(n);
            this.ib[i] = new Array(n);
            this.xtmp[i] = new Array(n);
        }
    }
    Descent.createSquareMatrix = function (n, f) {
        var M = new Array(n);
        for (var i = 0; i < n; ++i) {
            M[i] = new Array(n);
            for (var j = 0; j < n; ++j) {
                M[i][j] = f(i, j);
            }
        }
        return M;
    };
    Descent.prototype.offsetDir = function () {
        var _this = this;
        var u = new Array(this.k);
        var l = 0;
        for (var i = 0; i < this.k; ++i) {
            var x = u[i] = this.random.getNextBetween(0.01, 1) - 0.5;
            l += x * x;
        }
        l = Math.sqrt(l);
        return u.map(function (x) { return x *= _this.minD / l; });
    };
    Descent.prototype.computeDerivatives = function (x) {
        var _this = this;
        var n = this.n;
        if (n < 1)
            return;
        var i;
        var d = new Array(this.k);
        var d2 = new Array(this.k);
        var Huu = new Array(this.k);
        var maxH = 0;
        for (var u = 0; u < n; ++u) {
            for (i = 0; i < this.k; ++i)
                Huu[i] = this.g[i][u] = 0;
            for (var v = 0; v < n; ++v) {
                if (u === v)
                    continue;
                var maxDisplaces = n;
                while (maxDisplaces--) {
                    var sd2 = 0;
                    for (i = 0; i < this.k; ++i) {
                        var dx = d[i] = x[i][u] - x[i][v];
                        sd2 += d2[i] = dx * dx;
                    }
                    if (sd2 > 1e-9)
                        break;
                    var rd = this.offsetDir();
                    for (i = 0; i < this.k; ++i)
                        x[i][v] += rd[i];
                }
                var l = Math.sqrt(sd2);
                var D = this.D[u][v];
                var weight = this.G != null ? this.G[u][v] : 1;
                if (weight > 1 && l > D || !isFinite(D)) {
                    for (i = 0; i < this.k; ++i)
                        this.H[i][u][v] = 0;
                    continue;
                }
                if (weight > 1) {
                    weight = 1;
                }
                var D2 = D * D;
                var gs = 2 * weight * (l - D) / (D2 * l);
                var l3 = l * l * l;
                var hs = 2 * -weight / (D2 * l3);
                if (!isFinite(gs))
                    console.log(gs);
                for (i = 0; i < this.k; ++i) {
                    this.g[i][u] += d[i] * gs;
                    Huu[i] -= this.H[i][u][v] = hs * (l3 + D * (d2[i] - sd2) + l * sd2);
                }
            }
            for (i = 0; i < this.k; ++i)
                maxH = Math.max(maxH, this.H[i][u][u] = Huu[i]);
        }
        var r = this.snapGridSize / 2;
        var g = this.snapGridSize;
        var w = this.snapStrength;
        var k = w / (r * r);
        var numNodes = this.numGridSnapNodes;
        for (var u = 0; u < numNodes; ++u) {
            for (i = 0; i < this.k; ++i) {
                var xiu = this.x[i][u];
                var m = xiu / g;
                var f = m % 1;
                var q = m - f;
                var a = Math.abs(f);
                var dx = (a <= 0.5) ? xiu - q * g :
                    (xiu > 0) ? xiu - (q + 1) * g : xiu - (q - 1) * g;
                if (-r < dx && dx <= r) {
                    if (this.scaleSnapByMaxH) {
                        this.g[i][u] += maxH * k * dx;
                        this.H[i][u][u] += maxH * k;
                    }
                    else {
                        this.g[i][u] += k * dx;
                        this.H[i][u][u] += k;
                    }
                }
            }
        }
        if (!this.locks.isEmpty()) {
            this.locks.apply(function (u, p) {
                for (i = 0; i < _this.k; ++i) {
                    _this.H[i][u][u] += maxH;
                    _this.g[i][u] -= maxH * (p[i] - x[i][u]);
                }
            });
        }
    };
    Descent.dotProd = function (a, b) {
        var x = 0, i = a.length;
        while (i--)
            x += a[i] * b[i];
        return x;
    };
    Descent.rightMultiply = function (m, v, r) {
        var i = m.length;
        while (i--)
            r[i] = Descent.dotProd(m[i], v);
    };
    Descent.prototype.computeStepSize = function (d) {
        var numerator = 0, denominator = 0;
        for (var i = 0; i < this.k; ++i) {
            numerator += Descent.dotProd(this.g[i], d[i]);
            Descent.rightMultiply(this.H[i], d[i], this.Hd[i]);
            denominator += Descent.dotProd(d[i], this.Hd[i]);
        }
        if (denominator === 0 || !isFinite(denominator))
            return 0;
        return 1 * numerator / denominator;
    };
    Descent.prototype.reduceStress = function () {
        this.computeDerivatives(this.x);
        var alpha = this.computeStepSize(this.g);
        for (var i = 0; i < this.k; ++i) {
            this.takeDescentStep(this.x[i], this.g[i], alpha);
        }
        return this.computeStress();
    };
    Descent.copy = function (a, b) {
        var m = a.length, n = b[0].length;
        for (var i = 0; i < m; ++i) {
            for (var j = 0; j < n; ++j) {
                b[i][j] = a[i][j];
            }
        }
    };
    Descent.prototype.stepAndProject = function (x0, r, d, stepSize) {
        Descent.copy(x0, r);
        this.takeDescentStep(r[0], d[0], stepSize);
        if (this.project)
            this.project[0](x0[0], x0[1], r[0]);
        this.takeDescentStep(r[1], d[1], stepSize);
        if (this.project)
            this.project[1](r[0], x0[1], r[1]);
        for (var i = 2; i < this.k; i++)
            this.takeDescentStep(r[i], d[i], stepSize);
    };
    Descent.mApply = function (m, n, f) {
        var i = m;
        while (i-- > 0) {
            var j = n;
            while (j-- > 0)
                f(i, j);
        }
    };
    Descent.prototype.matrixApply = function (f) {
        Descent.mApply(this.k, this.n, f);
    };
    Descent.prototype.computeNextPosition = function (x0, r) {
        var _this = this;
        this.computeDerivatives(x0);
        var alpha = this.computeStepSize(this.g);
        this.stepAndProject(x0, r, this.g, alpha);
        if (this.project) {
            this.matrixApply(function (i, j) { return _this.e[i][j] = x0[i][j] - r[i][j]; });
            var beta = this.computeStepSize(this.e);
            beta = Math.max(0.2, Math.min(beta, 1));
            this.stepAndProject(x0, r, this.e, beta);
        }
    };
    Descent.prototype.run = function (iterations) {
        var stress = Number.MAX_VALUE, converged = false;
        while (!converged && iterations-- > 0) {
            var s = this.rungeKutta();
            converged = Math.abs(stress / s - 1) < this.threshold;
            stress = s;
        }
        return stress;
    };
    Descent.prototype.rungeKutta = function () {
        var _this = this;
        this.computeNextPosition(this.x, this.a);
        Descent.mid(this.x, this.a, this.ia);
        this.computeNextPosition(this.ia, this.b);
        Descent.mid(this.x, this.b, this.ib);
        this.computeNextPosition(this.ib, this.c);
        this.computeNextPosition(this.c, this.d);
        var disp = 0;
        this.matrixApply(function (i, j) {
            var x = (_this.a[i][j] + 2.0 * _this.b[i][j] + 2.0 * _this.c[i][j] + _this.d[i][j]) / 6.0, d = _this.x[i][j] - x;
            disp += d * d;
            _this.x[i][j] = x;
        });
        return disp;
    };
    Descent.mid = function (a, b, m) {
        Descent.mApply(a.length, a[0].length, function (i, j) {
            return m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0;
        });
    };
    Descent.prototype.takeDescentStep = function (x, d, stepSize) {
        for (var i = 0; i < this.n; ++i) {
            x[i] = x[i] - stepSize * d[i];
        }
    };
    Descent.prototype.computeStress = function () {
        var stress = 0;
        for (var u = 0, nMinus1 = this.n - 1; u < nMinus1; ++u) {
            for (var v = u + 1, n = this.n; v < n; ++v) {
                var l = 0;
                for (var i = 0; i < this.k; ++i) {
                    var dx = this.x[i][u] - this.x[i][v];
                    l += dx * dx;
                }
                l = Math.sqrt(l);
                var d = this.D[u][v];
                if (!isFinite(d))
                    continue;
                var rl = d - l;
                var d2 = d * d;
                stress += rl * rl / d2;
            }
        }
        return stress;
    };
    Descent.zeroDistance = 1e-10;
    return Descent;
}());
exports.Descent = Descent;
var PseudoRandom = (function () {
    function PseudoRandom(seed) {
        if (seed === void 0) { seed = 1; }
        this.seed = seed;
        this.a = 214013;
        this.c = 2531011;
        this.m = 2147483648;
        this.range = 32767;
    }
    PseudoRandom.prototype.getNext = function () {
        this.seed = (this.seed * this.a + this.c) % this.m;
        return (this.seed >> 16) / this.range;
    };
    PseudoRandom.prototype.getNextBetween = function (min, max) {
        return min + this.getNext() * (max - min);
    };
    return PseudoRandom;
}());
exports.PseudoRandom = PseudoRandom;

},{}],8:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var rectangle_1 = require("./rectangle");
var Point = (function () {
    function Point() {
    }
    return Point;
}());
exports.Point = Point;
var LineSegment = (function () {
    function LineSegment(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }
    return LineSegment;
}());
exports.LineSegment = LineSegment;
var PolyPoint = (function (_super) {
    __extends(PolyPoint, _super);
    function PolyPoint() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PolyPoint;
}(Point));
exports.PolyPoint = PolyPoint;
function isLeft(P0, P1, P2) {
    return (P1.x - P0.x) * (P2.y - P0.y) - (P2.x - P0.x) * (P1.y - P0.y);
}
exports.isLeft = isLeft;
function above(p, vi, vj) {
    return isLeft(p, vi, vj) > 0;
}
function below(p, vi, vj) {
    return isLeft(p, vi, vj) < 0;
}
function ConvexHull(S) {
    var P = S.slice(0).sort(function (a, b) { return a.x !== b.x ? b.x - a.x : b.y - a.y; });
    var n = S.length, i;
    var minmin = 0;
    var xmin = P[0].x;
    for (i = 1; i < n; ++i) {
        if (P[i].x !== xmin)
            break;
    }
    var minmax = i - 1;
    var H = [];
    H.push(P[minmin]);
    if (minmax === n - 1) {
        if (P[minmax].y !== P[minmin].y)
            H.push(P[minmax]);
    }
    else {
        var maxmin, maxmax = n - 1;
        var xmax = P[n - 1].x;
        for (i = n - 2; i >= 0; i--)
            if (P[i].x !== xmax)
                break;
        maxmin = i + 1;
        i = minmax;
        while (++i <= maxmin) {
            if (isLeft(P[minmin], P[maxmin], P[i]) >= 0 && i < maxmin)
                continue;
            while (H.length > 1) {
                if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                    break;
                else
                    H.length -= 1;
            }
            if (i != minmin)
                H.push(P[i]);
        }
        if (maxmax != maxmin)
            H.push(P[maxmax]);
        var bot = H.length;
        i = maxmin;
        while (--i >= minmax) {
            if (isLeft(P[maxmax], P[minmax], P[i]) >= 0 && i > minmax)
                continue;
            while (H.length > bot) {
                if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                    break;
                else
                    H.length -= 1;
            }
            if (i != minmin)
                H.push(P[i]);
        }
    }
    return H;
}
exports.ConvexHull = ConvexHull;
function clockwiseRadialSweep(p, P, f) {
    P.slice(0).sort(function (a, b) { return Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x); }).forEach(f);
}
exports.clockwiseRadialSweep = clockwiseRadialSweep;
function nextPolyPoint(p, ps) {
    if (p.polyIndex === ps.length - 1)
        return ps[0];
    return ps[p.polyIndex + 1];
}
function prevPolyPoint(p, ps) {
    if (p.polyIndex === 0)
        return ps[ps.length - 1];
    return ps[p.polyIndex - 1];
}
function tangent_PointPolyC(P, V) {
    var Vclosed = V.slice(0);
    Vclosed.push(V[0]);
    return { rtan: Rtangent_PointPolyC(P, Vclosed), ltan: Ltangent_PointPolyC(P, Vclosed) };
}
function Rtangent_PointPolyC(P, V) {
    var n = V.length - 1;
    var a, b, c;
    var upA, dnC;
    if (below(P, V[1], V[0]) && !above(P, V[n - 1], V[0]))
        return 0;
    for (a = 0, b = n;;) {
        if (b - a === 1)
            if (above(P, V[a], V[b]))
                return a;
            else
                return b;
        c = Math.floor((a + b) / 2);
        dnC = below(P, V[c + 1], V[c]);
        if (dnC && !above(P, V[c - 1], V[c]))
            return c;
        upA = above(P, V[a + 1], V[a]);
        if (upA) {
            if (dnC)
                b = c;
            else {
                if (above(P, V[a], V[c]))
                    b = c;
                else
                    a = c;
            }
        }
        else {
            if (!dnC)
                a = c;
            else {
                if (below(P, V[a], V[c]))
                    b = c;
                else
                    a = c;
            }
        }
    }
}
function Ltangent_PointPolyC(P, V) {
    var n = V.length - 1;
    var a, b, c;
    var dnA, dnC;
    if (above(P, V[n - 1], V[0]) && !below(P, V[1], V[0]))
        return 0;
    for (a = 0, b = n;;) {
        if (b - a === 1)
            if (below(P, V[a], V[b]))
                return a;
            else
                return b;
        c = Math.floor((a + b) / 2);
        dnC = below(P, V[c + 1], V[c]);
        if (above(P, V[c - 1], V[c]) && !dnC)
            return c;
        dnA = below(P, V[a + 1], V[a]);
        if (dnA) {
            if (!dnC)
                b = c;
            else {
                if (below(P, V[a], V[c]))
                    b = c;
                else
                    a = c;
            }
        }
        else {
            if (dnC)
                a = c;
            else {
                if (above(P, V[a], V[c]))
                    b = c;
                else
                    a = c;
            }
        }
    }
}
function tangent_PolyPolyC(V, W, t1, t2, cmp1, cmp2) {
    var ix1, ix2;
    ix1 = t1(W[0], V);
    ix2 = t2(V[ix1], W);
    var done = false;
    while (!done) {
        done = true;
        while (true) {
            if (ix1 === V.length - 1)
                ix1 = 0;
            if (cmp1(W[ix2], V[ix1], V[ix1 + 1]))
                break;
            ++ix1;
        }
        while (true) {
            if (ix2 === 0)
                ix2 = W.length - 1;
            if (cmp2(V[ix1], W[ix2], W[ix2 - 1]))
                break;
            --ix2;
            done = false;
        }
    }
    return { t1: ix1, t2: ix2 };
}
exports.tangent_PolyPolyC = tangent_PolyPolyC;
function LRtangent_PolyPolyC(V, W) {
    var rl = RLtangent_PolyPolyC(W, V);
    return { t1: rl.t2, t2: rl.t1 };
}
exports.LRtangent_PolyPolyC = LRtangent_PolyPolyC;
function RLtangent_PolyPolyC(V, W) {
    return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Ltangent_PointPolyC, above, below);
}
exports.RLtangent_PolyPolyC = RLtangent_PolyPolyC;
function LLtangent_PolyPolyC(V, W) {
    return tangent_PolyPolyC(V, W, Ltangent_PointPolyC, Ltangent_PointPolyC, below, below);
}
exports.LLtangent_PolyPolyC = LLtangent_PolyPolyC;
function RRtangent_PolyPolyC(V, W) {
    return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Rtangent_PointPolyC, above, above);
}
exports.RRtangent_PolyPolyC = RRtangent_PolyPolyC;
var BiTangent = (function () {
    function BiTangent(t1, t2) {
        this.t1 = t1;
        this.t2 = t2;
    }
    return BiTangent;
}());
exports.BiTangent = BiTangent;
var BiTangents = (function () {
    function BiTangents() {
    }
    return BiTangents;
}());
exports.BiTangents = BiTangents;
var TVGPoint = (function (_super) {
    __extends(TVGPoint, _super);
    function TVGPoint() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return TVGPoint;
}(Point));
exports.TVGPoint = TVGPoint;
var VisibilityVertex = (function () {
    function VisibilityVertex(id, polyid, polyvertid, p) {
        this.id = id;
        this.polyid = polyid;
        this.polyvertid = polyvertid;
        this.p = p;
        p.vv = this;
    }
    return VisibilityVertex;
}());
exports.VisibilityVertex = VisibilityVertex;
var VisibilityEdge = (function () {
    function VisibilityEdge(source, target) {
        this.source = source;
        this.target = target;
    }
    VisibilityEdge.prototype.length = function () {
        var dx = this.source.p.x - this.target.p.x;
        var dy = this.source.p.y - this.target.p.y;
        return Math.sqrt(dx * dx + dy * dy);
    };
    return VisibilityEdge;
}());
exports.VisibilityEdge = VisibilityEdge;
var TangentVisibilityGraph = (function () {
    function TangentVisibilityGraph(P, g0) {
        this.P = P;
        this.V = [];
        this.E = [];
        if (!g0) {
            var n = P.length;
            for (var i = 0; i < n; i++) {
                var p = P[i];
                for (var j = 0; j < p.length; ++j) {
                    var pj = p[j], vv = new VisibilityVertex(this.V.length, i, j, pj);
                    this.V.push(vv);
                    if (j > 0)
                        this.E.push(new VisibilityEdge(p[j - 1].vv, vv));
                }
                if (p.length > 1)
                    this.E.push(new VisibilityEdge(p[0].vv, p[p.length - 1].vv));
            }
            for (var i = 0; i < n - 1; i++) {
                var Pi = P[i];
                for (var j = i + 1; j < n; j++) {
                    var Pj = P[j], t = tangents(Pi, Pj);
                    for (var q in t) {
                        var c = t[q], source = Pi[c.t1], target = Pj[c.t2];
                        this.addEdgeIfVisible(source, target, i, j);
                    }
                }
            }
        }
        else {
            this.V = g0.V.slice(0);
            this.E = g0.E.slice(0);
        }
    }
    TangentVisibilityGraph.prototype.addEdgeIfVisible = function (u, v, i1, i2) {
        if (!this.intersectsPolys(new LineSegment(u.x, u.y, v.x, v.y), i1, i2)) {
            this.E.push(new VisibilityEdge(u.vv, v.vv));
        }
    };
    TangentVisibilityGraph.prototype.addPoint = function (p, i1) {
        var n = this.P.length;
        this.V.push(new VisibilityVertex(this.V.length, n, 0, p));
        for (var i = 0; i < n; ++i) {
            if (i === i1)
                continue;
            var poly = this.P[i], t = tangent_PointPolyC(p, poly);
            this.addEdgeIfVisible(p, poly[t.ltan], i1, i);
            this.addEdgeIfVisible(p, poly[t.rtan], i1, i);
        }
        return p.vv;
    };
    TangentVisibilityGraph.prototype.intersectsPolys = function (l, i1, i2) {
        for (var i = 0, n = this.P.length; i < n; ++i) {
            if (i != i1 && i != i2 && intersects(l, this.P[i]).length > 0) {
                return true;
            }
        }
        return false;
    };
    return TangentVisibilityGraph;
}());
exports.TangentVisibilityGraph = TangentVisibilityGraph;
function intersects(l, P) {
    var ints = [];
    for (var i = 1, n = P.length; i < n; ++i) {
        var int = rectangle_1.Rectangle.lineIntersection(l.x1, l.y1, l.x2, l.y2, P[i - 1].x, P[i - 1].y, P[i].x, P[i].y);
        if (int)
            ints.push(int);
    }
    return ints;
}
function tangents(V, W) {
    var m = V.length - 1, n = W.length - 1;
    var bt = new BiTangents();
    for (var i = 0; i < m; ++i) {
        for (var j = 0; j < n; ++j) {
            var v1 = V[i == 0 ? m - 1 : i - 1];
            var v2 = V[i];
            var v3 = V[i + 1];
            var w1 = W[j == 0 ? n - 1 : j - 1];
            var w2 = W[j];
            var w3 = W[j + 1];
            var v1v2w2 = isLeft(v1, v2, w2);
            var v2w1w2 = isLeft(v2, w1, w2);
            var v2w2w3 = isLeft(v2, w2, w3);
            var w1w2v2 = isLeft(w1, w2, v2);
            var w2v1v2 = isLeft(w2, v1, v2);
            var w2v2v3 = isLeft(w2, v2, v3);
            if (v1v2w2 >= 0 && v2w1w2 >= 0 && v2w2w3 < 0
                && w1w2v2 >= 0 && w2v1v2 >= 0 && w2v2v3 < 0) {
                bt.ll = new BiTangent(i, j);
            }
            else if (v1v2w2 <= 0 && v2w1w2 <= 0 && v2w2w3 > 0
                && w1w2v2 <= 0 && w2v1v2 <= 0 && w2v2v3 > 0) {
                bt.rr = new BiTangent(i, j);
            }
            else if (v1v2w2 <= 0 && v2w1w2 > 0 && v2w2w3 <= 0
                && w1w2v2 >= 0 && w2v1v2 < 0 && w2v2v3 >= 0) {
                bt.rl = new BiTangent(i, j);
            }
            else if (v1v2w2 >= 0 && v2w1w2 < 0 && v2w2w3 >= 0
                && w1w2v2 <= 0 && w2v1v2 > 0 && w2v2v3 <= 0) {
                bt.lr = new BiTangent(i, j);
            }
        }
    }
    return bt;
}
exports.tangents = tangents;
function isPointInsidePoly(p, poly) {
    for (var i = 1, n = poly.length; i < n; ++i)
        if (below(poly[i - 1], poly[i], p))
            return false;
    return true;
}
function isAnyPInQ(p, q) {
    return !p.every(function (v) { return !isPointInsidePoly(v, q); });
}
function polysOverlap(p, q) {
    if (isAnyPInQ(p, q))
        return true;
    if (isAnyPInQ(q, p))
        return true;
    for (var i = 1, n = p.length; i < n; ++i) {
        var v = p[i], u = p[i - 1];
        if (intersects(new LineSegment(u.x, u.y, v.x, v.y), q).length > 0)
            return true;
    }
    return false;
}
exports.polysOverlap = polysOverlap;

},{"./rectangle":17}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var rectangle_1 = require("./rectangle");
var vpsc_1 = require("./vpsc");
var shortestpaths_1 = require("./shortestpaths");
var NodeWrapper = (function () {
    function NodeWrapper(id, rect, children) {
        this.id = id;
        this.rect = rect;
        this.children = children;
        this.leaf = typeof children === 'undefined' || children.length === 0;
    }
    return NodeWrapper;
}());
exports.NodeWrapper = NodeWrapper;
var Vert = (function () {
    function Vert(id, x, y, node, line) {
        if (node === void 0) { node = null; }
        if (line === void 0) { line = null; }
        this.id = id;
        this.x = x;
        this.y = y;
        this.node = node;
        this.line = line;
    }
    return Vert;
}());
exports.Vert = Vert;
var LongestCommonSubsequence = (function () {
    function LongestCommonSubsequence(s, t) {
        this.s = s;
        this.t = t;
        var mf = LongestCommonSubsequence.findMatch(s, t);
        var tr = t.slice(0).reverse();
        var mr = LongestCommonSubsequence.findMatch(s, tr);
        if (mf.length >= mr.length) {
            this.length = mf.length;
            this.si = mf.si;
            this.ti = mf.ti;
            this.reversed = false;
        }
        else {
            this.length = mr.length;
            this.si = mr.si;
            this.ti = t.length - mr.ti - mr.length;
            this.reversed = true;
        }
    }
    LongestCommonSubsequence.findMatch = function (s, t) {
        var m = s.length;
        var n = t.length;
        var match = { length: 0, si: -1, ti: -1 };
        var l = new Array(m);
        for (var i = 0; i < m; i++) {
            l[i] = new Array(n);
            for (var j = 0; j < n; j++)
                if (s[i] === t[j]) {
                    var v = l[i][j] = (i === 0 || j === 0) ? 1 : l[i - 1][j - 1] + 1;
                    if (v > match.length) {
                        match.length = v;
                        match.si = i - v + 1;
                        match.ti = j - v + 1;
                    }
                    ;
                }
                else
                    l[i][j] = 0;
        }
        return match;
    };
    LongestCommonSubsequence.prototype.getSequence = function () {
        return this.length >= 0 ? this.s.slice(this.si, this.si + this.length) : [];
    };
    return LongestCommonSubsequence;
}());
exports.LongestCommonSubsequence = LongestCommonSubsequence;
var GridRouter = (function () {
    function GridRouter(originalnodes, accessor, groupPadding) {
        if (groupPadding === void 0) { groupPadding = 12; }
        var _this = this;
        this.originalnodes = originalnodes;
        this.groupPadding = groupPadding;
        this.leaves = null;
        this.nodes = originalnodes.map(function (v, i) { return new NodeWrapper(i, accessor.getBounds(v), accessor.getChildren(v)); });
        this.leaves = this.nodes.filter(function (v) { return v.leaf; });
        this.groups = this.nodes.filter(function (g) { return !g.leaf; });
        this.cols = this.getGridLines('x');
        this.rows = this.getGridLines('y');
        this.groups.forEach(function (v) {
            return v.children.forEach(function (c) { return _this.nodes[c].parent = v; });
        });
        this.root = { children: [] };
        this.nodes.forEach(function (v) {
            if (typeof v.parent === 'undefined') {
                v.parent = _this.root;
                _this.root.children.push(v.id);
            }
            v.ports = [];
        });
        this.backToFront = this.nodes.slice(0);
        this.backToFront.sort(function (x, y) { return _this.getDepth(x) - _this.getDepth(y); });
        var frontToBackGroups = this.backToFront.slice(0).reverse().filter(function (g) { return !g.leaf; });
        frontToBackGroups.forEach(function (v) {
            var r = rectangle_1.Rectangle.empty();
            v.children.forEach(function (c) { return r = r.union(_this.nodes[c].rect); });
            v.rect = r.inflate(_this.groupPadding);
        });
        var colMids = this.midPoints(this.cols.map(function (r) { return r.pos; }));
        var rowMids = this.midPoints(this.rows.map(function (r) { return r.pos; }));
        var rowx = colMids[0], rowX = colMids[colMids.length - 1];
        var coly = rowMids[0], colY = rowMids[rowMids.length - 1];
        var hlines = this.rows.map(function (r) { return ({ x1: rowx, x2: rowX, y1: r.pos, y2: r.pos }); })
            .concat(rowMids.map(function (m) { return ({ x1: rowx, x2: rowX, y1: m, y2: m }); }));
        var vlines = this.cols.map(function (c) { return ({ x1: c.pos, x2: c.pos, y1: coly, y2: colY }); })
            .concat(colMids.map(function (m) { return ({ x1: m, x2: m, y1: coly, y2: colY }); }));
        var lines = hlines.concat(vlines);
        lines.forEach(function (l) { return l.verts = []; });
        this.verts = [];
        this.edges = [];
        hlines.forEach(function (h) {
            return vlines.forEach(function (v) {
                var p = new Vert(_this.verts.length, v.x1, h.y1);
                h.verts.push(p);
                v.verts.push(p);
                _this.verts.push(p);
                var i = _this.backToFront.length;
                while (i-- > 0) {
                    var node = _this.backToFront[i], r = node.rect;
                    var dx = Math.abs(p.x - r.cx()), dy = Math.abs(p.y - r.cy());
                    if (dx < r.width() / 2 && dy < r.height() / 2) {
                        p.node = node;
                        break;
                    }
                }
            });
        });
        lines.forEach(function (l, li) {
            _this.nodes.forEach(function (v, i) {
                v.rect.lineIntersections(l.x1, l.y1, l.x2, l.y2).forEach(function (intersect, j) {
                    var p = new Vert(_this.verts.length, intersect.x, intersect.y, v, l);
                    _this.verts.push(p);
                    l.verts.push(p);
                    v.ports.push(p);
                });
            });
            var isHoriz = Math.abs(l.y1 - l.y2) < 0.1;
            var delta = function (a, b) { return isHoriz ? b.x - a.x : b.y - a.y; };
            l.verts.sort(delta);
            for (var i = 1; i < l.verts.length; i++) {
                var u = l.verts[i - 1], v = l.verts[i];
                if (u.node && u.node === v.node && u.node.leaf)
                    continue;
                _this.edges.push({ source: u.id, target: v.id, length: Math.abs(delta(u, v)) });
            }
        });
    }
    GridRouter.prototype.avg = function (a) { return a.reduce(function (x, y) { return x + y; }) / a.length; };
    GridRouter.prototype.getGridLines = function (axis) {
        var columns = [];
        var ls = this.leaves.slice(0, this.leaves.length);
        while (ls.length > 0) {
            var overlapping = ls.filter(function (v) { return v.rect['overlap' + axis.toUpperCase()](ls[0].rect); });
            var col = {
                nodes: overlapping,
                pos: this.avg(overlapping.map(function (v) { return v.rect['c' + axis](); }))
            };
            columns.push(col);
            col.nodes.forEach(function (v) { return ls.splice(ls.indexOf(v), 1); });
        }
        columns.sort(function (a, b) { return a.pos - b.pos; });
        return columns;
    };
    GridRouter.prototype.getDepth = function (v) {
        var depth = 0;
        while (v.parent !== this.root) {
            depth++;
            v = v.parent;
        }
        return depth;
    };
    GridRouter.prototype.midPoints = function (a) {
        var gap = a[1] - a[0];
        var mids = [a[0] - gap / 2];
        for (var i = 1; i < a.length; i++) {
            mids.push((a[i] + a[i - 1]) / 2);
        }
        mids.push(a[a.length - 1] + gap / 2);
        return mids;
    };
    GridRouter.prototype.findLineage = function (v) {
        var lineage = [v];
        do {
            v = v.parent;
            lineage.push(v);
        } while (v !== this.root);
        return lineage.reverse();
    };
    GridRouter.prototype.findAncestorPathBetween = function (a, b) {
        var aa = this.findLineage(a), ba = this.findLineage(b), i = 0;
        while (aa[i] === ba[i])
            i++;
        return { commonAncestor: aa[i - 1], lineages: aa.slice(i).concat(ba.slice(i)) };
    };
    GridRouter.prototype.siblingObstacles = function (a, b) {
        var _this = this;
        var path = this.findAncestorPathBetween(a, b);
        var lineageLookup = {};
        path.lineages.forEach(function (v) { return lineageLookup[v.id] = {}; });
        var obstacles = path.commonAncestor.children.filter(function (v) { return !(v in lineageLookup); });
        path.lineages
            .filter(function (v) { return v.parent !== path.commonAncestor; })
            .forEach(function (v) { return obstacles = obstacles.concat(v.parent.children.filter(function (c) { return c !== v.id; })); });
        return obstacles.map(function (v) { return _this.nodes[v]; });
    };
    GridRouter.getSegmentSets = function (routes, x, y) {
        var vsegments = [];
        for (var ei = 0; ei < routes.length; ei++) {
            var route = routes[ei];
            for (var si = 0; si < route.length; si++) {
                var s = route[si];
                s.edgeid = ei;
                s.i = si;
                var sdx = s[1][x] - s[0][x];
                if (Math.abs(sdx) < 0.1) {
                    vsegments.push(s);
                }
            }
        }
        vsegments.sort(function (a, b) { return a[0][x] - b[0][x]; });
        var vsegmentsets = [];
        var segmentset = null;
        for (var i = 0; i < vsegments.length; i++) {
            var s = vsegments[i];
            if (!segmentset || Math.abs(s[0][x] - segmentset.pos) > 0.1) {
                segmentset = { pos: s[0][x], segments: [] };
                vsegmentsets.push(segmentset);
            }
            segmentset.segments.push(s);
        }
        return vsegmentsets;
    };
    GridRouter.nudgeSegs = function (x, y, routes, segments, leftOf, gap) {
        var n = segments.length;
        if (n <= 1)
            return;
        var vs = segments.map(function (s) { return new vpsc_1.Variable(s[0][x]); });
        var cs = [];
        for (var i = 0; i < n; i++) {
            for (var j = 0; j < n; j++) {
                if (i === j)
                    continue;
                var s1 = segments[i], s2 = segments[j], e1 = s1.edgeid, e2 = s2.edgeid, lind = -1, rind = -1;
                if (x == 'x') {
                    if (leftOf(e1, e2)) {
                        if (s1[0][y] < s1[1][y]) {
                            lind = j, rind = i;
                        }
                        else {
                            lind = i, rind = j;
                        }
                    }
                }
                else {
                    if (leftOf(e1, e2)) {
                        if (s1[0][y] < s1[1][y]) {
                            lind = i, rind = j;
                        }
                        else {
                            lind = j, rind = i;
                        }
                    }
                }
                if (lind >= 0) {
                    cs.push(new vpsc_1.Constraint(vs[lind], vs[rind], gap));
                }
            }
        }
        var solver = new vpsc_1.Solver(vs, cs);
        solver.solve();
        vs.forEach(function (v, i) {
            var s = segments[i];
            var pos = v.position();
            s[0][x] = s[1][x] = pos;
            var route = routes[s.edgeid];
            if (s.i > 0)
                route[s.i - 1][1][x] = pos;
            if (s.i < route.length - 1)
                route[s.i + 1][0][x] = pos;
        });
    };
    GridRouter.nudgeSegments = function (routes, x, y, leftOf, gap) {
        var vsegmentsets = GridRouter.getSegmentSets(routes, x, y);
        for (var i = 0; i < vsegmentsets.length; i++) {
            var ss = vsegmentsets[i];
            var events = [];
            for (var j = 0; j < ss.segments.length; j++) {
                var s = ss.segments[j];
                events.push({ type: 0, s: s, pos: Math.min(s[0][y], s[1][y]) });
                events.push({ type: 1, s: s, pos: Math.max(s[0][y], s[1][y]) });
            }
            events.sort(function (a, b) { return a.pos - b.pos + a.type - b.type; });
            var open = [];
            var openCount = 0;
            events.forEach(function (e) {
                if (e.type === 0) {
                    open.push(e.s);
                    openCount++;
                }
                else {
                    openCount--;
                }
                if (openCount == 0) {
                    GridRouter.nudgeSegs(x, y, routes, open, leftOf, gap);
                    open = [];
                }
            });
        }
    };
    GridRouter.prototype.routeEdges = function (edges, nudgeGap, source, target) {
        var _this = this;
        var routePaths = edges.map(function (e) { return _this.route(source(e), target(e)); });
        var order = GridRouter.orderEdges(routePaths);
        var routes = routePaths.map(function (e) { return GridRouter.makeSegments(e); });
        GridRouter.nudgeSegments(routes, 'x', 'y', order, nudgeGap);
        GridRouter.nudgeSegments(routes, 'y', 'x', order, nudgeGap);
        GridRouter.unreverseEdges(routes, routePaths);
        return routes;
    };
    GridRouter.unreverseEdges = function (routes, routePaths) {
        routes.forEach(function (segments, i) {
            var path = routePaths[i];
            if (path.reversed) {
                segments.reverse();
                segments.forEach(function (segment) {
                    segment.reverse();
                });
            }
        });
    };
    GridRouter.angleBetween2Lines = function (line1, line2) {
        var angle1 = Math.atan2(line1[0].y - line1[1].y, line1[0].x - line1[1].x);
        var angle2 = Math.atan2(line2[0].y - line2[1].y, line2[0].x - line2[1].x);
        var diff = angle1 - angle2;
        if (diff > Math.PI || diff < -Math.PI) {
            diff = angle2 - angle1;
        }
        return diff;
    };
    GridRouter.isLeft = function (a, b, c) {
        return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) <= 0;
    };
    GridRouter.getOrder = function (pairs) {
        var outgoing = {};
        for (var i = 0; i < pairs.length; i++) {
            var p = pairs[i];
            if (typeof outgoing[p.l] === 'undefined')
                outgoing[p.l] = {};
            outgoing[p.l][p.r] = true;
        }
        return function (l, r) { return typeof outgoing[l] !== 'undefined' && outgoing[l][r]; };
    };
    GridRouter.orderEdges = function (edges) {
        var edgeOrder = [];
        for (var i = 0; i < edges.length - 1; i++) {
            for (var j = i + 1; j < edges.length; j++) {
                var e = edges[i], f = edges[j], lcs = new LongestCommonSubsequence(e, f);
                var u, vi, vj;
                if (lcs.length === 0)
                    continue;
                if (lcs.reversed) {
                    f.reverse();
                    f.reversed = true;
                    lcs = new LongestCommonSubsequence(e, f);
                }
                if ((lcs.si <= 0 || lcs.ti <= 0) &&
                    (lcs.si + lcs.length >= e.length || lcs.ti + lcs.length >= f.length)) {
                    edgeOrder.push({ l: i, r: j });
                    continue;
                }
                if (lcs.si + lcs.length >= e.length || lcs.ti + lcs.length >= f.length) {
                    u = e[lcs.si + 1];
                    vj = e[lcs.si - 1];
                    vi = f[lcs.ti - 1];
                }
                else {
                    u = e[lcs.si + lcs.length - 2];
                    vi = e[lcs.si + lcs.length];
                    vj = f[lcs.ti + lcs.length];
                }
                if (GridRouter.isLeft(u, vi, vj)) {
                    edgeOrder.push({ l: j, r: i });
                }
                else {
                    edgeOrder.push({ l: i, r: j });
                }
            }
        }
        return GridRouter.getOrder(edgeOrder);
    };
    GridRouter.makeSegments = function (path) {
        function copyPoint(p) {
            return { x: p.x, y: p.y };
        }
        var isStraight = function (a, b, c) { return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 0.001; };
        var segments = [];
        var a = copyPoint(path[0]);
        for (var i = 1; i < path.length; i++) {
            var b = copyPoint(path[i]), c = i < path.length - 1 ? path[i + 1] : null;
            if (!c || !isStraight(a, b, c)) {
                segments.push([a, b]);
                a = b;
            }
        }
        return segments;
    };
    GridRouter.prototype.route = function (s, t) {
        var _this = this;
        var source = this.nodes[s], target = this.nodes[t];
        this.obstacles = this.siblingObstacles(source, target);
        var obstacleLookup = {};
        this.obstacles.forEach(function (o) { return obstacleLookup[o.id] = o; });
        this.passableEdges = this.edges.filter(function (e) {
            var u = _this.verts[e.source], v = _this.verts[e.target];
            return !(u.node && u.node.id in obstacleLookup
                || v.node && v.node.id in obstacleLookup);
        });
        for (var i = 1; i < source.ports.length; i++) {
            var u = source.ports[0].id;
            var v = source.ports[i].id;
            this.passableEdges.push({
                source: u,
                target: v,
                length: 0
            });
        }
        for (var i = 1; i < target.ports.length; i++) {
            var u = target.ports[0].id;
            var v = target.ports[i].id;
            this.passableEdges.push({
                source: u,
                target: v,
                length: 0
            });
        }
        var getSource = function (e) { return e.source; }, getTarget = function (e) { return e.target; }, getLength = function (e) { return e.length; };
        var shortestPathCalculator = new shortestpaths_1.Calculator(this.verts.length, this.passableEdges, getSource, getTarget, getLength);
        var bendPenalty = function (u, v, w) {
            var a = _this.verts[u], b = _this.verts[v], c = _this.verts[w];
            var dx = Math.abs(c.x - a.x), dy = Math.abs(c.y - a.y);
            if (a.node === source && a.node === b.node || b.node === target && b.node === c.node)
                return 0;
            return dx > 1 && dy > 1 ? 1000 : 0;
        };
        var shortestPath = shortestPathCalculator.PathFromNodeToNodeWithPrevCost(source.ports[0].id, target.ports[0].id, bendPenalty);
        var pathPoints = shortestPath.reverse().map(function (vi) { return _this.verts[vi]; });
        pathPoints.push(this.nodes[target.id].ports[0]);
        return pathPoints.filter(function (v, i) {
            return !(i < pathPoints.length - 1 && pathPoints[i + 1].node === source && v.node === source
                || i > 0 && v.node === target && pathPoints[i - 1].node === target);
        });
    };
    GridRouter.getRoutePath = function (route, cornerradius, arrowwidth, arrowheight) {
        var result = {
            routepath: 'M ' + route[0][0].x + ' ' + route[0][0].y + ' ',
            arrowpath: ''
        };
        if (route.length > 1) {
            for (var i = 0; i < route.length; i++) {
                var li = route[i];
                var x = li[1].x, y = li[1].y;
                var dx = x - li[0].x;
                var dy = y - li[0].y;
                if (i < route.length - 1) {
                    if (Math.abs(dx) > 0) {
                        x -= dx / Math.abs(dx) * cornerradius;
                    }
                    else {
                        y -= dy / Math.abs(dy) * cornerradius;
                    }
                    result.routepath += 'L ' + x + ' ' + y + ' ';
                    var l = route[i + 1];
                    var x0 = l[0].x, y0 = l[0].y;
                    var x1 = l[1].x;
                    var y1 = l[1].y;
                    dx = x1 - x0;
                    dy = y1 - y0;
                    var angle = GridRouter.angleBetween2Lines(li, l) < 0 ? 1 : 0;
                    var x2, y2;
                    if (Math.abs(dx) > 0) {
                        x2 = x0 + dx / Math.abs(dx) * cornerradius;
                        y2 = y0;
                    }
                    else {
                        x2 = x0;
                        y2 = y0 + dy / Math.abs(dy) * cornerradius;
                    }
                    var cx = Math.abs(x2 - x);
                    var cy = Math.abs(y2 - y);
                    result.routepath += 'A ' + cx + ' ' + cy + ' 0 0 ' + angle + ' ' + x2 + ' ' + y2 + ' ';
                }
                else {
                    var arrowtip = [x, y];
                    var arrowcorner1, arrowcorner2;
                    if (Math.abs(dx) > 0) {
                        x -= dx / Math.abs(dx) * arrowheight;
                        arrowcorner1 = [x, y + arrowwidth];
                        arrowcorner2 = [x, y - arrowwidth];
                    }
                    else {
                        y -= dy / Math.abs(dy) * arrowheight;
                        arrowcorner1 = [x + arrowwidth, y];
                        arrowcorner2 = [x - arrowwidth, y];
                    }
                    result.routepath += 'L ' + x + ' ' + y + ' ';
                    if (arrowheight > 0) {
                        result.arrowpath = 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                            + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1];
                    }
                }
            }
        }
        else {
            var li = route[0];
            var x = li[1].x, y = li[1].y;
            var dx = x - li[0].x;
            var dy = y - li[0].y;
            var arrowtip = [x, y];
            var arrowcorner1, arrowcorner2;
            if (Math.abs(dx) > 0) {
                x -= dx / Math.abs(dx) * arrowheight;
                arrowcorner1 = [x, y + arrowwidth];
                arrowcorner2 = [x, y - arrowwidth];
            }
            else {
                y -= dy / Math.abs(dy) * arrowheight;
                arrowcorner1 = [x + arrowwidth, y];
                arrowcorner2 = [x - arrowwidth, y];
            }
            result.routepath += 'L ' + x + ' ' + y + ' ';
            if (arrowheight > 0) {
                result.arrowpath = 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                    + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1];
            }
        }
        return result;
    };
    return GridRouter;
}());
exports.GridRouter = GridRouter;

},{"./rectangle":17,"./shortestpaths":18,"./vpsc":19}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var packingOptions = {
    PADDING: 10,
    GOLDEN_SECTION: (1 + Math.sqrt(5)) / 2,
    FLOAT_EPSILON: 0.0001,
    MAX_INERATIONS: 100
};
function applyPacking(graphs, w, h, node_size, desired_ratio) {
    if (desired_ratio === void 0) { desired_ratio = 1; }
    var init_x = 0, init_y = 0, svg_width = w, svg_height = h, desired_ratio = typeof desired_ratio !== 'undefined' ? desired_ratio : 1, node_size = typeof node_size !== 'undefined' ? node_size : 0, real_width = 0, real_height = 0, min_width = 0, global_bottom = 0, line = [];
    if (graphs.length == 0)
        return;
    calculate_bb(graphs);
    apply(graphs, desired_ratio);
    put_nodes_to_right_positions(graphs);
    function calculate_bb(graphs) {
        graphs.forEach(function (g) {
            calculate_single_bb(g);
        });
        function calculate_single_bb(graph) {
            var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE, max_x = 0, max_y = 0;
            graph.array.forEach(function (v) {
                var w = typeof v.width !== 'undefined' ? v.width : node_size;
                var h = typeof v.height !== 'undefined' ? v.height : node_size;
                w /= 2;
                h /= 2;
                max_x = Math.max(v.x + w, max_x);
                min_x = Math.min(v.x - w, min_x);
                max_y = Math.max(v.y + h, max_y);
                min_y = Math.min(v.y - h, min_y);
            });
            graph.width = max_x - min_x;
            graph.height = max_y - min_y;
        }
    }
    function put_nodes_to_right_positions(graphs) {
        graphs.forEach(function (g) {
            var center = { x: 0, y: 0 };
            g.array.forEach(function (node) {
                center.x += node.x;
                center.y += node.y;
            });
            center.x /= g.array.length;
            center.y /= g.array.length;
            var corner = { x: center.x - g.width / 2, y: center.y - g.height / 2 };
            var offset = { x: g.x - corner.x + svg_width / 2 - real_width / 2, y: g.y - corner.y + svg_height / 2 - real_height / 2 };
            g.array.forEach(function (node) {
                node.x += offset.x;
                node.y += offset.y;
            });
        });
    }
    function apply(data, desired_ratio) {
        var curr_best_f = Number.POSITIVE_INFINITY;
        var curr_best = 0;
        data.sort(function (a, b) { return b.height - a.height; });
        min_width = data.reduce(function (a, b) {
            return a.width < b.width ? a.width : b.width;
        });
        var left = x1 = min_width;
        var right = x2 = get_entire_width(data);
        var iterationCounter = 0;
        var f_x1 = Number.MAX_VALUE;
        var f_x2 = Number.MAX_VALUE;
        var flag = -1;
        var dx = Number.MAX_VALUE;
        var df = Number.MAX_VALUE;
        while ((dx > min_width) || df > packingOptions.FLOAT_EPSILON) {
            if (flag != 1) {
                var x1 = right - (right - left) / packingOptions.GOLDEN_SECTION;
                var f_x1 = step(data, x1);
            }
            if (flag != 0) {
                var x2 = left + (right - left) / packingOptions.GOLDEN_SECTION;
                var f_x2 = step(data, x2);
            }
            dx = Math.abs(x1 - x2);
            df = Math.abs(f_x1 - f_x2);
            if (f_x1 < curr_best_f) {
                curr_best_f = f_x1;
                curr_best = x1;
            }
            if (f_x2 < curr_best_f) {
                curr_best_f = f_x2;
                curr_best = x2;
            }
            if (f_x1 > f_x2) {
                left = x1;
                x1 = x2;
                f_x1 = f_x2;
                flag = 1;
            }
            else {
                right = x2;
                x2 = x1;
                f_x2 = f_x1;
                flag = 0;
            }
            if (iterationCounter++ > 100) {
                break;
            }
        }
        step(data, curr_best);
    }
    function step(data, max_width) {
        line = [];
        real_width = 0;
        real_height = 0;
        global_bottom = init_y;
        for (var i = 0; i < data.length; i++) {
            var o = data[i];
            put_rect(o, max_width);
        }
        return Math.abs(get_real_ratio() - desired_ratio);
    }
    function put_rect(rect, max_width) {
        var parent = undefined;
        for (var i = 0; i < line.length; i++) {
            if ((line[i].space_left >= rect.height) && (line[i].x + line[i].width + rect.width + packingOptions.PADDING - max_width) <= packingOptions.FLOAT_EPSILON) {
                parent = line[i];
                break;
            }
        }
        line.push(rect);
        if (parent !== undefined) {
            rect.x = parent.x + parent.width + packingOptions.PADDING;
            rect.y = parent.bottom;
            rect.space_left = rect.height;
            rect.bottom = rect.y;
            parent.space_left -= rect.height + packingOptions.PADDING;
            parent.bottom += rect.height + packingOptions.PADDING;
        }
        else {
            rect.y = global_bottom;
            global_bottom += rect.height + packingOptions.PADDING;
            rect.x = init_x;
            rect.bottom = rect.y;
            rect.space_left = rect.height;
        }
        if (rect.y + rect.height - real_height > -packingOptions.FLOAT_EPSILON)
            real_height = rect.y + rect.height - init_y;
        if (rect.x + rect.width - real_width > -packingOptions.FLOAT_EPSILON)
            real_width = rect.x + rect.width - init_x;
    }
    ;
    function get_entire_width(data) {
        var width = 0;
        data.forEach(function (d) { return width += d.width + packingOptions.PADDING; });
        return width;
    }
    function get_real_ratio() {
        return (real_width / real_height);
    }
}
exports.applyPacking = applyPacking;
function separateGraphs(nodes, links) {
    var marks = {};
    var ways = {};
    var graphs = [];
    var clusters = 0;
    for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var n1 = link.source;
        var n2 = link.target;
        if (ways[n1.index])
            ways[n1.index].push(n2);
        else
            ways[n1.index] = [n2];
        if (ways[n2.index])
            ways[n2.index].push(n1);
        else
            ways[n2.index] = [n1];
    }
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (marks[node.index])
            continue;
        explore_node(node, true);
    }
    function explore_node(n, is_new) {
        if (marks[n.index] !== undefined)
            return;
        if (is_new) {
            clusters++;
            graphs.push({ array: [] });
        }
        marks[n.index] = clusters;
        graphs[clusters - 1].array.push(n);
        var adjacent = ways[n.index];
        if (!adjacent)
            return;
        for (var j = 0; j < adjacent.length; j++) {
            explore_node(adjacent[j], false);
        }
    }
    return graphs;
}
exports.separateGraphs = separateGraphs;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var powergraph = require("./powergraph");
var linklengths_1 = require("./linklengths");
var descent_1 = require("./descent");
var rectangle_1 = require("./rectangle");
var shortestpaths_1 = require("./shortestpaths");
var geom_1 = require("./geom");
var handledisconnected_1 = require("./handledisconnected");
var EventType;
(function (EventType) {
    EventType[EventType["start"] = 0] = "start";
    EventType[EventType["tick"] = 1] = "tick";
    EventType[EventType["end"] = 2] = "end";
})(EventType = exports.EventType || (exports.EventType = {}));
;
function isGroup(g) {
    return typeof g.leaves !== 'undefined' || typeof g.groups !== 'undefined';
}
var Layout = (function () {
    function Layout() {
        var _this = this;
        this._canvasSize = [1, 1];
        this._linkDistance = 20;
        this._defaultNodeSize = 10;
        this._linkLengthCalculator = null;
        this._linkType = null;
        this._avoidOverlaps = false;
        this._handleDisconnected = true;
        this._running = false;
        this._nodes = [];
        this._groups = [];
        this._rootGroup = null;
        this._links = [];
        this._constraints = [];
        this._distanceMatrix = null;
        this._descent = null;
        this._directedLinkConstraints = null;
        this._threshold = 0.01;
        this._visibilityGraph = null;
        this._groupCompactness = 1e-6;
        this.event = null;
        this.linkAccessor = {
            getSourceIndex: Layout.getSourceIndex,
            getTargetIndex: Layout.getTargetIndex,
            setLength: Layout.setLinkLength,
            getType: function (l) { return typeof _this._linkType === "function" ? _this._linkType(l) : 0; }
        };
    }
    Layout.prototype.on = function (e, listener) {
        if (!this.event)
            this.event = {};
        if (typeof e === 'string') {
            this.event[EventType[e]] = listener;
        }
        else {
            this.event[e] = listener;
        }
        return this;
    };
    Layout.prototype.trigger = function (e) {
        if (this.event && typeof this.event[e.type] !== 'undefined') {
            this.event[e.type](e);
        }
    };
    Layout.prototype.kick = function () {
        while (!this.tick())
            ;
    };
    Layout.prototype.tick = function () {
        if (this._alpha < this._threshold) {
            this._running = false;
            this.trigger({ type: EventType.end, alpha: this._alpha = 0, stress: this._lastStress });
            return true;
        }
        var n = this._nodes.length, m = this._links.length;
        var o, i;
        this._descent.locks.clear();
        for (i = 0; i < n; ++i) {
            o = this._nodes[i];
            if (o.fixed) {
                if (typeof o.px === 'undefined' || typeof o.py === 'undefined') {
                    o.px = o.x;
                    o.py = o.y;
                }
                var p = [o.px, o.py];
                this._descent.locks.add(i, p);
            }
        }
        var s1 = this._descent.rungeKutta();
        if (s1 === 0) {
            this._alpha = 0;
        }
        else if (typeof this._lastStress !== 'undefined') {
            this._alpha = s1;
        }
        this._lastStress = s1;
        this.updateNodePositions();
        this.trigger({ type: EventType.tick, alpha: this._alpha, stress: this._lastStress });
        return false;
    };
    Layout.prototype.updateNodePositions = function () {
        var x = this._descent.x[0], y = this._descent.x[1];
        var o, i = this._nodes.length;
        while (i--) {
            o = this._nodes[i];
            o.x = x[i];
            o.y = y[i];
        }
    };
    Layout.prototype.nodes = function (v) {
        if (!v) {
            if (this._nodes.length === 0 && this._links.length > 0) {
                var n = 0;
                this._links.forEach(function (l) {
                    n = Math.max(n, l.source, l.target);
                });
                this._nodes = new Array(++n);
                for (var i = 0; i < n; ++i) {
                    this._nodes[i] = {};
                }
            }
            return this._nodes;
        }
        this._nodes = v;
        return this;
    };
    Layout.prototype.groups = function (x) {
        var _this = this;
        if (!x)
            return this._groups;
        this._groups = x;
        this._rootGroup = {};
        this._groups.forEach(function (g) {
            if (typeof g.padding === "undefined")
                g.padding = 1;
            if (typeof g.leaves !== "undefined") {
                g.leaves.forEach(function (v, i) {
                    if (typeof v === 'number')
                        (g.leaves[i] = _this._nodes[v]).parent = g;
                });
            }
            if (typeof g.groups !== "undefined") {
                g.groups.forEach(function (gi, i) {
                    if (typeof gi === 'number')
                        (g.groups[i] = _this._groups[gi]).parent = g;
                });
            }
        });
        this._rootGroup.leaves = this._nodes.filter(function (v) { return typeof v.parent === 'undefined'; });
        this._rootGroup.groups = this._groups.filter(function (g) { return typeof g.parent === 'undefined'; });
        return this;
    };
    Layout.prototype.powerGraphGroups = function (f) {
        var g = powergraph.getGroups(this._nodes, this._links, this.linkAccessor, this._rootGroup);
        this.groups(g.groups);
        f(g);
        return this;
    };
    Layout.prototype.avoidOverlaps = function (v) {
        if (!arguments.length)
            return this._avoidOverlaps;
        this._avoidOverlaps = v;
        return this;
    };
    Layout.prototype.handleDisconnected = function (v) {
        if (!arguments.length)
            return this._handleDisconnected;
        this._handleDisconnected = v;
        return this;
    };
    Layout.prototype.flowLayout = function (axis, minSeparation) {
        if (!arguments.length)
            axis = 'y';
        this._directedLinkConstraints = {
            axis: axis,
            getMinSeparation: typeof minSeparation === 'number' ? function () { return minSeparation; } : minSeparation
        };
        return this;
    };
    Layout.prototype.links = function (x) {
        if (!arguments.length)
            return this._links;
        this._links = x;
        return this;
    };
    Layout.prototype.constraints = function (c) {
        if (!arguments.length)
            return this._constraints;
        this._constraints = c;
        return this;
    };
    Layout.prototype.distanceMatrix = function (d) {
        if (!arguments.length)
            return this._distanceMatrix;
        this._distanceMatrix = d;
        return this;
    };
    Layout.prototype.size = function (x) {
        if (!x)
            return this._canvasSize;
        this._canvasSize = x;
        return this;
    };
    Layout.prototype.defaultNodeSize = function (x) {
        if (!x)
            return this._defaultNodeSize;
        this._defaultNodeSize = x;
        return this;
    };
    Layout.prototype.groupCompactness = function (x) {
        if (!x)
            return this._groupCompactness;
        this._groupCompactness = x;
        return this;
    };
    Layout.prototype.linkDistance = function (x) {
        if (!x) {
            return this._linkDistance;
        }
        this._linkDistance = typeof x === "function" ? x : +x;
        this._linkLengthCalculator = null;
        return this;
    };
    Layout.prototype.linkType = function (f) {
        this._linkType = f;
        return this;
    };
    Layout.prototype.convergenceThreshold = function (x) {
        if (!x)
            return this._threshold;
        this._threshold = typeof x === "function" ? x : +x;
        return this;
    };
    Layout.prototype.alpha = function (x) {
        if (!arguments.length)
            return this._alpha;
        else {
            x = +x;
            if (this._alpha) {
                if (x > 0)
                    this._alpha = x;
                else
                    this._alpha = 0;
            }
            else if (x > 0) {
                if (!this._running) {
                    this._running = true;
                    this.trigger({ type: EventType.start, alpha: this._alpha = x });
                    this.kick();
                }
            }
            return this;
        }
    };
    Layout.prototype.getLinkLength = function (link) {
        return typeof this._linkDistance === "function" ? +(this._linkDistance(link)) : this._linkDistance;
    };
    Layout.setLinkLength = function (link, length) {
        link.length = length;
    };
    Layout.prototype.getLinkType = function (link) {
        return typeof this._linkType === "function" ? this._linkType(link) : 0;
    };
    Layout.prototype.symmetricDiffLinkLengths = function (idealLength, w) {
        var _this = this;
        if (w === void 0) { w = 1; }
        this.linkDistance(function (l) { return idealLength * l.length; });
        this._linkLengthCalculator = function () { return linklengths_1.symmetricDiffLinkLengths(_this._links, _this.linkAccessor, w); };
        return this;
    };
    Layout.prototype.jaccardLinkLengths = function (idealLength, w) {
        var _this = this;
        if (w === void 0) { w = 1; }
        this.linkDistance(function (l) { return idealLength * l.length; });
        this._linkLengthCalculator = function () { return linklengths_1.jaccardLinkLengths(_this._links, _this.linkAccessor, w); };
        return this;
    };
    Layout.prototype.start = function (initialUnconstrainedIterations, initialUserConstraintIterations, initialAllConstraintsIterations, gridSnapIterations, keepRunning) {
        var _this = this;
        if (initialUnconstrainedIterations === void 0) { initialUnconstrainedIterations = 0; }
        if (initialUserConstraintIterations === void 0) { initialUserConstraintIterations = 0; }
        if (initialAllConstraintsIterations === void 0) { initialAllConstraintsIterations = 0; }
        if (gridSnapIterations === void 0) { gridSnapIterations = 0; }
        if (keepRunning === void 0) { keepRunning = true; }
        var i, j, n = this.nodes().length, N = n + 2 * this._groups.length, m = this._links.length, w = this._canvasSize[0], h = this._canvasSize[1];
        var x = new Array(N), y = new Array(N);
        var G = null;
        var ao = this._avoidOverlaps;
        this._nodes.forEach(function (v, i) {
            v.index = i;
            if (typeof v.x === 'undefined') {
                v.x = w / 2, v.y = h / 2;
            }
            x[i] = v.x, y[i] = v.y;
        });
        if (this._linkLengthCalculator)
            this._linkLengthCalculator();
        var distances;
        if (this._distanceMatrix) {
            distances = this._distanceMatrix;
        }
        else {
            distances = (new shortestpaths_1.Calculator(N, this._links, Layout.getSourceIndex, Layout.getTargetIndex, function (l) { return _this.getLinkLength(l); })).DistanceMatrix();
            G = descent_1.Descent.createSquareMatrix(N, function () { return 2; });
            this._links.forEach(function (l) {
                if (typeof l.source == "number")
                    l.source = _this._nodes[l.source];
                if (typeof l.target == "number")
                    l.target = _this._nodes[l.target];
            });
            this._links.forEach(function (e) {
                var u = Layout.getSourceIndex(e), v = Layout.getTargetIndex(e);
                G[u][v] = G[v][u] = e.weight || 1;
            });
        }
        var D = descent_1.Descent.createSquareMatrix(N, function (i, j) {
            return distances[i][j];
        });
        if (this._rootGroup && typeof this._rootGroup.groups !== 'undefined') {
            var i = n;
            var addAttraction = function (i, j, strength, idealDistance) {
                G[i][j] = G[j][i] = strength;
                D[i][j] = D[j][i] = idealDistance;
            };
            this._groups.forEach(function (g) {
                addAttraction(i, i + 1, _this._groupCompactness, 0.1);
                x[i] = 0, y[i++] = 0;
                x[i] = 0, y[i++] = 0;
            });
        }
        else
            this._rootGroup = { leaves: this._nodes, groups: [] };
        var curConstraints = this._constraints || [];
        if (this._directedLinkConstraints) {
            this.linkAccessor.getMinSeparation = this._directedLinkConstraints.getMinSeparation;
            curConstraints = curConstraints.concat(linklengths_1.generateDirectedEdgeConstraints(n, this._links, this._directedLinkConstraints.axis, (this.linkAccessor)));
        }
        this.avoidOverlaps(false);
        this._descent = new descent_1.Descent([x, y], D);
        this._descent.locks.clear();
        for (var i = 0; i < n; ++i) {
            var o = this._nodes[i];
            if (o.fixed) {
                o.px = o.x;
                o.py = o.y;
                var p = [o.x, o.y];
                this._descent.locks.add(i, p);
            }
        }
        this._descent.threshold = this._threshold;
        this.initialLayout(initialUnconstrainedIterations, x, y);
        if (curConstraints.length > 0)
            this._descent.project = new rectangle_1.Projection(this._nodes, this._groups, this._rootGroup, curConstraints).projectFunctions();
        this._descent.run(initialUserConstraintIterations);
        this.separateOverlappingComponents(w, h);
        this.avoidOverlaps(ao);
        if (ao) {
            this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
            this._descent.project = new rectangle_1.Projection(this._nodes, this._groups, this._rootGroup, curConstraints, true).projectFunctions();
            this._nodes.forEach(function (v, i) { x[i] = v.x, y[i] = v.y; });
        }
        this._descent.G = G;
        this._descent.run(initialAllConstraintsIterations);
        if (gridSnapIterations) {
            this._descent.snapStrength = 1000;
            this._descent.snapGridSize = this._nodes[0].width;
            this._descent.numGridSnapNodes = n;
            this._descent.scaleSnapByMaxH = n != N;
            var G0 = descent_1.Descent.createSquareMatrix(N, function (i, j) {
                if (i >= n || j >= n)
                    return G[i][j];
                return 0;
            });
            this._descent.G = G0;
            this._descent.run(gridSnapIterations);
        }
        this.updateNodePositions();
        this.separateOverlappingComponents(w, h);
        return keepRunning ? this.resume() : this;
    };
    Layout.prototype.initialLayout = function (iterations, x, y) {
        if (this._groups.length > 0 && iterations > 0) {
            var n = this._nodes.length;
            var edges = this._links.map(function (e) { return ({ source: e.source.index, target: e.target.index }); });
            var vs = this._nodes.map(function (v) { return ({ index: v.index }); });
            this._groups.forEach(function (g, i) {
                vs.push({ index: g.index = n + i });
            });
            this._groups.forEach(function (g, i) {
                if (typeof g.leaves !== 'undefined')
                    g.leaves.forEach(function (v) { return edges.push({ source: g.index, target: v.index }); });
                if (typeof g.groups !== 'undefined')
                    g.groups.forEach(function (gg) { return edges.push({ source: g.index, target: gg.index }); });
            });
            new Layout()
                .size(this.size())
                .nodes(vs)
                .links(edges)
                .avoidOverlaps(false)
                .linkDistance(this.linkDistance())
                .symmetricDiffLinkLengths(5)
                .convergenceThreshold(1e-4)
                .start(iterations, 0, 0, 0, false);
            this._nodes.forEach(function (v) {
                x[v.index] = vs[v.index].x;
                y[v.index] = vs[v.index].y;
            });
        }
        else {
            this._descent.run(iterations);
        }
    };
    Layout.prototype.separateOverlappingComponents = function (width, height) {
        var _this = this;
        if (!this._distanceMatrix && this._handleDisconnected) {
            var x_1 = this._descent.x[0], y_1 = this._descent.x[1];
            this._nodes.forEach(function (v, i) { v.x = x_1[i], v.y = y_1[i]; });
            var graphs = handledisconnected_1.separateGraphs(this._nodes, this._links);
            handledisconnected_1.applyPacking(graphs, width, height, this._defaultNodeSize);
            this._nodes.forEach(function (v, i) {
                _this._descent.x[0][i] = v.x, _this._descent.x[1][i] = v.y;
                if (v.bounds) {
                    v.bounds.setXCentre(v.x);
                    v.bounds.setYCentre(v.y);
                }
            });
        }
    };
    Layout.prototype.resume = function () {
        return this.alpha(0.1);
    };
    Layout.prototype.stop = function () {
        return this.alpha(0);
    };
    Layout.prototype.prepareEdgeRouting = function (nodeMargin) {
        if (nodeMargin === void 0) { nodeMargin = 0; }
        this._visibilityGraph = new geom_1.TangentVisibilityGraph(this._nodes.map(function (v) {
            return v.bounds.inflate(-nodeMargin).vertices();
        }));
    };
    Layout.prototype.routeEdge = function (edge, ah, draw) {
        if (ah === void 0) { ah = 5; }
        var lineData = [];
        var vg2 = new geom_1.TangentVisibilityGraph(this._visibilityGraph.P, { V: this._visibilityGraph.V, E: this._visibilityGraph.E }), port1 = { x: edge.source.x, y: edge.source.y }, port2 = { x: edge.target.x, y: edge.target.y }, start = vg2.addPoint(port1, edge.source.index), end = vg2.addPoint(port2, edge.target.index);
        vg2.addEdgeIfVisible(port1, port2, edge.source.index, edge.target.index);
        if (typeof draw !== 'undefined') {
            draw(vg2);
        }
        var sourceInd = function (e) { return e.source.id; }, targetInd = function (e) { return e.target.id; }, length = function (e) { return e.length(); }, spCalc = new shortestpaths_1.Calculator(vg2.V.length, vg2.E, sourceInd, targetInd, length), shortestPath = spCalc.PathFromNodeToNode(start.id, end.id);
        if (shortestPath.length === 1 || shortestPath.length === vg2.V.length) {
            var route = rectangle_1.makeEdgeBetween(edge.source.innerBounds, edge.target.innerBounds, ah);
            lineData = [route.sourceIntersection, route.arrowStart];
        }
        else {
            var n = shortestPath.length - 2, p = vg2.V[shortestPath[n]].p, q = vg2.V[shortestPath[0]].p, lineData = [edge.source.innerBounds.rayIntersection(p.x, p.y)];
            for (var i = n; i >= 0; --i)
                lineData.push(vg2.V[shortestPath[i]].p);
            lineData.push(rectangle_1.makeEdgeTo(q, edge.target.innerBounds, ah));
        }
        return lineData;
    };
    Layout.getSourceIndex = function (e) {
        return typeof e.source === 'number' ? e.source : e.source.index;
    };
    Layout.getTargetIndex = function (e) {
        return typeof e.target === 'number' ? e.target : e.target.index;
    };
    Layout.linkId = function (e) {
        return Layout.getSourceIndex(e) + "-" + Layout.getTargetIndex(e);
    };
    Layout.dragStart = function (d) {
        if (isGroup(d)) {
            Layout.storeOffset(d, Layout.dragOrigin(d));
        }
        else {
            Layout.stopNode(d);
            d.fixed |= 2;
        }
    };
    Layout.stopNode = function (v) {
        v.px = v.x;
        v.py = v.y;
    };
    Layout.storeOffset = function (d, origin) {
        if (typeof d.leaves !== 'undefined') {
            d.leaves.forEach(function (v) {
                v.fixed |= 2;
                Layout.stopNode(v);
                v._dragGroupOffsetX = v.x - origin.x;
                v._dragGroupOffsetY = v.y - origin.y;
            });
        }
        if (typeof d.groups !== 'undefined') {
            d.groups.forEach(function (g) { return Layout.storeOffset(g, origin); });
        }
    };
    Layout.dragOrigin = function (d) {
        if (isGroup(d)) {
            return {
                x: d.bounds.cx(),
                y: d.bounds.cy()
            };
        }
        else {
            return d;
        }
    };
    Layout.drag = function (d, position) {
        if (isGroup(d)) {
            if (typeof d.leaves !== 'undefined') {
                d.leaves.forEach(function (v) {
                    d.bounds.setXCentre(position.x);
                    d.bounds.setYCentre(position.y);
                    v.px = v._dragGroupOffsetX + position.x;
                    v.py = v._dragGroupOffsetY + position.y;
                });
            }
            if (typeof d.groups !== 'undefined') {
                d.groups.forEach(function (g) { return Layout.drag(g, position); });
            }
        }
        else {
            d.px = position.x;
            d.py = position.y;
        }
    };
    Layout.dragEnd = function (d) {
        if (isGroup(d)) {
            if (typeof d.leaves !== 'undefined') {
                d.leaves.forEach(function (v) {
                    Layout.dragEnd(v);
                    delete v._dragGroupOffsetX;
                    delete v._dragGroupOffsetY;
                });
            }
            if (typeof d.groups !== 'undefined') {
                d.groups.forEach(Layout.dragEnd);
            }
        }
        else {
            d.fixed &= ~6;
        }
    };
    Layout.mouseOver = function (d) {
        d.fixed |= 4;
        d.px = d.x, d.py = d.y;
    };
    Layout.mouseOut = function (d) {
        d.fixed &= ~4;
    };
    return Layout;
}());
exports.Layout = Layout;

},{"./descent":7,"./geom":8,"./handledisconnected":10,"./linklengths":13,"./powergraph":14,"./rectangle":17,"./shortestpaths":18}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shortestpaths_1 = require("./shortestpaths");
var descent_1 = require("./descent");
var rectangle_1 = require("./rectangle");
var linklengths_1 = require("./linklengths");
var Link3D = (function () {
    function Link3D(source, target) {
        this.source = source;
        this.target = target;
    }
    Link3D.prototype.actualLength = function (x) {
        var _this = this;
        return Math.sqrt(x.reduce(function (c, v) {
            var dx = v[_this.target] - v[_this.source];
            return c + dx * dx;
        }, 0));
    };
    return Link3D;
}());
exports.Link3D = Link3D;
var Node3D = (function () {
    function Node3D(x, y, z) {
        if (x === void 0) { x = 0; }
        if (y === void 0) { y = 0; }
        if (z === void 0) { z = 0; }
        this.x = x;
        this.y = y;
        this.z = z;
    }
    return Node3D;
}());
exports.Node3D = Node3D;
var Layout3D = (function () {
    function Layout3D(nodes, links, idealLinkLength) {
        if (idealLinkLength === void 0) { idealLinkLength = 1; }
        var _this = this;
        this.nodes = nodes;
        this.links = links;
        this.idealLinkLength = idealLinkLength;
        this.constraints = null;
        this.useJaccardLinkLengths = true;
        this.result = new Array(Layout3D.k);
        for (var i = 0; i < Layout3D.k; ++i) {
            this.result[i] = new Array(nodes.length);
        }
        nodes.forEach(function (v, i) {
            for (var _i = 0, _a = Layout3D.dims; _i < _a.length; _i++) {
                var dim = _a[_i];
                if (typeof v[dim] == 'undefined')
                    v[dim] = Math.random();
            }
            _this.result[0][i] = v.x;
            _this.result[1][i] = v.y;
            _this.result[2][i] = v.z;
        });
    }
    ;
    Layout3D.prototype.linkLength = function (l) {
        return l.actualLength(this.result);
    };
    Layout3D.prototype.start = function (iterations) {
        var _this = this;
        if (iterations === void 0) { iterations = 100; }
        var n = this.nodes.length;
        var linkAccessor = new LinkAccessor();
        if (this.useJaccardLinkLengths)
            linklengths_1.jaccardLinkLengths(this.links, linkAccessor, 1.5);
        this.links.forEach(function (e) { return e.length *= _this.idealLinkLength; });
        var distanceMatrix = (new shortestpaths_1.Calculator(n, this.links, function (e) { return e.source; }, function (e) { return e.target; }, function (e) { return e.length; })).DistanceMatrix();
        var D = descent_1.Descent.createSquareMatrix(n, function (i, j) { return distanceMatrix[i][j]; });
        var G = descent_1.Descent.createSquareMatrix(n, function () { return 2; });
        this.links.forEach(function (_a) {
            var source = _a.source, target = _a.target;
            return G[source][target] = G[target][source] = 1;
        });
        this.descent = new descent_1.Descent(this.result, D);
        this.descent.threshold = 1e-3;
        this.descent.G = G;
        if (this.constraints)
            this.descent.project = new rectangle_1.Projection(this.nodes, null, null, this.constraints).projectFunctions();
        for (var i = 0; i < this.nodes.length; i++) {
            var v = this.nodes[i];
            if (v.fixed) {
                this.descent.locks.add(i, [v.x, v.y, v.z]);
            }
        }
        this.descent.run(iterations);
        return this;
    };
    Layout3D.prototype.tick = function () {
        this.descent.locks.clear();
        for (var i = 0; i < this.nodes.length; i++) {
            var v = this.nodes[i];
            if (v.fixed) {
                this.descent.locks.add(i, [v.x, v.y, v.z]);
            }
        }
        return this.descent.rungeKutta();
    };
    Layout3D.dims = ['x', 'y', 'z'];
    Layout3D.k = Layout3D.dims.length;
    return Layout3D;
}());
exports.Layout3D = Layout3D;
var LinkAccessor = (function () {
    function LinkAccessor() {
    }
    LinkAccessor.prototype.getSourceIndex = function (e) { return e.source; };
    LinkAccessor.prototype.getTargetIndex = function (e) { return e.target; };
    LinkAccessor.prototype.getLength = function (e) { return e.length; };
    LinkAccessor.prototype.setLength = function (e, l) { e.length = l; };
    return LinkAccessor;
}());

},{"./descent":7,"./linklengths":13,"./rectangle":17,"./shortestpaths":18}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function unionCount(a, b) {
    var u = {};
    for (var i in a)
        u[i] = {};
    for (var i in b)
        u[i] = {};
    return Object.keys(u).length;
}
function intersectionCount(a, b) {
    var n = 0;
    for (var i in a)
        if (typeof b[i] !== 'undefined')
            ++n;
    return n;
}
function getNeighbours(links, la) {
    var neighbours = {};
    var addNeighbours = function (u, v) {
        if (typeof neighbours[u] === 'undefined')
            neighbours[u] = {};
        neighbours[u][v] = {};
    };
    links.forEach(function (e) {
        var u = la.getSourceIndex(e), v = la.getTargetIndex(e);
        addNeighbours(u, v);
        addNeighbours(v, u);
    });
    return neighbours;
}
function computeLinkLengths(links, w, f, la) {
    var neighbours = getNeighbours(links, la);
    links.forEach(function (l) {
        var a = neighbours[la.getSourceIndex(l)];
        var b = neighbours[la.getTargetIndex(l)];
        la.setLength(l, 1 + w * f(a, b));
    });
}
function symmetricDiffLinkLengths(links, la, w) {
    if (w === void 0) { w = 1; }
    computeLinkLengths(links, w, function (a, b) { return Math.sqrt(unionCount(a, b) - intersectionCount(a, b)); }, la);
}
exports.symmetricDiffLinkLengths = symmetricDiffLinkLengths;
function jaccardLinkLengths(links, la, w) {
    if (w === void 0) { w = 1; }
    computeLinkLengths(links, w, function (a, b) {
        return Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b);
    }, la);
}
exports.jaccardLinkLengths = jaccardLinkLengths;
function generateDirectedEdgeConstraints(n, links, axis, la) {
    var components = stronglyConnectedComponents(n, links, la);
    var nodes = {};
    components.forEach(function (c, i) {
        return c.forEach(function (v) { return nodes[v] = i; });
    });
    var constraints = [];
    links.forEach(function (l) {
        var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l), u = nodes[ui], v = nodes[vi];
        if (u !== v) {
            constraints.push({
                axis: axis,
                left: ui,
                right: vi,
                gap: la.getMinSeparation(l)
            });
        }
    });
    return constraints;
}
exports.generateDirectedEdgeConstraints = generateDirectedEdgeConstraints;
function stronglyConnectedComponents(numVertices, edges, la) {
    var nodes = [];
    var index = 0;
    var stack = [];
    var components = [];
    function strongConnect(v) {
        v.index = v.lowlink = index++;
        stack.push(v);
        v.onStack = true;
        for (var _i = 0, _a = v.out; _i < _a.length; _i++) {
            var w = _a[_i];
            if (typeof w.index === 'undefined') {
                strongConnect(w);
                v.lowlink = Math.min(v.lowlink, w.lowlink);
            }
            else if (w.onStack) {
                v.lowlink = Math.min(v.lowlink, w.index);
            }
        }
        if (v.lowlink === v.index) {
            var component = [];
            while (stack.length) {
                w = stack.pop();
                w.onStack = false;
                component.push(w);
                if (w === v)
                    break;
            }
            components.push(component.map(function (v) { return v.id; }));
        }
    }
    for (var i = 0; i < numVertices; i++) {
        nodes.push({ id: i, out: [] });
    }
    for (var _i = 0, edges_1 = edges; _i < edges_1.length; _i++) {
        var e = edges_1[_i];
        var v_1 = nodes[la.getSourceIndex(e)], w = nodes[la.getTargetIndex(e)];
        v_1.out.push(w);
    }
    for (var _a = 0, nodes_1 = nodes; _a < nodes_1.length; _a++) {
        var v = nodes_1[_a];
        if (typeof v.index === 'undefined')
            strongConnect(v);
    }
    return components;
}
exports.stronglyConnectedComponents = stronglyConnectedComponents;

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PowerEdge = (function () {
    function PowerEdge(source, target, type) {
        this.source = source;
        this.target = target;
        this.type = type;
    }
    return PowerEdge;
}());
exports.PowerEdge = PowerEdge;
var Configuration = (function () {
    function Configuration(n, edges, linkAccessor, rootGroup) {
        var _this = this;
        this.linkAccessor = linkAccessor;
        this.modules = new Array(n);
        this.roots = [];
        if (rootGroup) {
            this.initModulesFromGroup(rootGroup);
        }
        else {
            this.roots.push(new ModuleSet());
            for (var i = 0; i < n; ++i)
                this.roots[0].add(this.modules[i] = new Module(i));
        }
        this.R = edges.length;
        edges.forEach(function (e) {
            var s = _this.modules[linkAccessor.getSourceIndex(e)], t = _this.modules[linkAccessor.getTargetIndex(e)], type = linkAccessor.getType(e);
            s.outgoing.add(type, t);
            t.incoming.add(type, s);
        });
    }
    Configuration.prototype.initModulesFromGroup = function (group) {
        var moduleSet = new ModuleSet();
        this.roots.push(moduleSet);
        for (var i = 0; i < group.leaves.length; ++i) {
            var node = group.leaves[i];
            var module = new Module(node.id);
            this.modules[node.id] = module;
            moduleSet.add(module);
        }
        if (group.groups) {
            for (var j = 0; j < group.groups.length; ++j) {
                var child = group.groups[j];
                var definition = {};
                for (var prop in child)
                    if (prop !== "leaves" && prop !== "groups" && child.hasOwnProperty(prop))
                        definition[prop] = child[prop];
                moduleSet.add(new Module(-1 - j, new LinkSets(), new LinkSets(), this.initModulesFromGroup(child), definition));
            }
        }
        return moduleSet;
    };
    Configuration.prototype.merge = function (a, b, k) {
        if (k === void 0) { k = 0; }
        var inInt = a.incoming.intersection(b.incoming), outInt = a.outgoing.intersection(b.outgoing);
        var children = new ModuleSet();
        children.add(a);
        children.add(b);
        var m = new Module(this.modules.length, outInt, inInt, children);
        this.modules.push(m);
        var update = function (s, i, o) {
            s.forAll(function (ms, linktype) {
                ms.forAll(function (n) {
                    var nls = n[i];
                    nls.add(linktype, m);
                    nls.remove(linktype, a);
                    nls.remove(linktype, b);
                    a[o].remove(linktype, n);
                    b[o].remove(linktype, n);
                });
            });
        };
        update(outInt, "incoming", "outgoing");
        update(inInt, "outgoing", "incoming");
        this.R -= inInt.count() + outInt.count();
        this.roots[k].remove(a);
        this.roots[k].remove(b);
        this.roots[k].add(m);
        return m;
    };
    Configuration.prototype.rootMerges = function (k) {
        if (k === void 0) { k = 0; }
        var rs = this.roots[k].modules();
        var n = rs.length;
        var merges = new Array(n * (n - 1));
        var ctr = 0;
        for (var i = 0, i_ = n - 1; i < i_; ++i) {
            for (var j = i + 1; j < n; ++j) {
                var a = rs[i], b = rs[j];
                merges[ctr] = { id: ctr, nEdges: this.nEdges(a, b), a: a, b: b };
                ctr++;
            }
        }
        return merges;
    };
    Configuration.prototype.greedyMerge = function () {
        for (var i = 0; i < this.roots.length; ++i) {
            if (this.roots[i].modules().length < 2)
                continue;
            var ms = this.rootMerges(i).sort(function (a, b) { return a.nEdges == b.nEdges ? a.id - b.id : a.nEdges - b.nEdges; });
            var m = ms[0];
            if (m.nEdges >= this.R)
                continue;
            this.merge(m.a, m.b, i);
            return true;
        }
    };
    Configuration.prototype.nEdges = function (a, b) {
        var inInt = a.incoming.intersection(b.incoming), outInt = a.outgoing.intersection(b.outgoing);
        return this.R - inInt.count() - outInt.count();
    };
    Configuration.prototype.getGroupHierarchy = function (retargetedEdges) {
        var _this = this;
        var groups = [];
        var root = {};
        toGroups(this.roots[0], root, groups);
        var es = this.allEdges();
        es.forEach(function (e) {
            var a = _this.modules[e.source];
            var b = _this.modules[e.target];
            retargetedEdges.push(new PowerEdge(typeof a.gid === "undefined" ? e.source : groups[a.gid], typeof b.gid === "undefined" ? e.target : groups[b.gid], e.type));
        });
        return groups;
    };
    Configuration.prototype.allEdges = function () {
        var es = [];
        Configuration.getEdges(this.roots[0], es);
        return es;
    };
    Configuration.getEdges = function (modules, es) {
        modules.forAll(function (m) {
            m.getEdges(es);
            Configuration.getEdges(m.children, es);
        });
    };
    return Configuration;
}());
exports.Configuration = Configuration;
function toGroups(modules, group, groups) {
    modules.forAll(function (m) {
        if (m.isLeaf()) {
            if (!group.leaves)
                group.leaves = [];
            group.leaves.push(m.id);
        }
        else {
            var g = group;
            m.gid = groups.length;
            if (!m.isIsland() || m.isPredefined()) {
                g = { id: m.gid };
                if (m.isPredefined())
                    for (var prop in m.definition)
                        g[prop] = m.definition[prop];
                if (!group.groups)
                    group.groups = [];
                group.groups.push(m.gid);
                groups.push(g);
            }
            toGroups(m.children, g, groups);
        }
    });
}
var Module = (function () {
    function Module(id, outgoing, incoming, children, definition) {
        if (outgoing === void 0) { outgoing = new LinkSets(); }
        if (incoming === void 0) { incoming = new LinkSets(); }
        if (children === void 0) { children = new ModuleSet(); }
        this.id = id;
        this.outgoing = outgoing;
        this.incoming = incoming;
        this.children = children;
        this.definition = definition;
    }
    Module.prototype.getEdges = function (es) {
        var _this = this;
        this.outgoing.forAll(function (ms, edgetype) {
            ms.forAll(function (target) {
                es.push(new PowerEdge(_this.id, target.id, edgetype));
            });
        });
    };
    Module.prototype.isLeaf = function () {
        return this.children.count() === 0;
    };
    Module.prototype.isIsland = function () {
        return this.outgoing.count() === 0 && this.incoming.count() === 0;
    };
    Module.prototype.isPredefined = function () {
        return typeof this.definition !== "undefined";
    };
    return Module;
}());
exports.Module = Module;
function intersection(m, n) {
    var i = {};
    for (var v in m)
        if (v in n)
            i[v] = m[v];
    return i;
}
var ModuleSet = (function () {
    function ModuleSet() {
        this.table = {};
    }
    ModuleSet.prototype.count = function () {
        return Object.keys(this.table).length;
    };
    ModuleSet.prototype.intersection = function (other) {
        var result = new ModuleSet();
        result.table = intersection(this.table, other.table);
        return result;
    };
    ModuleSet.prototype.intersectionCount = function (other) {
        return this.intersection(other).count();
    };
    ModuleSet.prototype.contains = function (id) {
        return id in this.table;
    };
    ModuleSet.prototype.add = function (m) {
        this.table[m.id] = m;
    };
    ModuleSet.prototype.remove = function (m) {
        delete this.table[m.id];
    };
    ModuleSet.prototype.forAll = function (f) {
        for (var mid in this.table) {
            f(this.table[mid]);
        }
    };
    ModuleSet.prototype.modules = function () {
        var vs = [];
        this.forAll(function (m) {
            if (!m.isPredefined())
                vs.push(m);
        });
        return vs;
    };
    return ModuleSet;
}());
exports.ModuleSet = ModuleSet;
var LinkSets = (function () {
    function LinkSets() {
        this.sets = {};
        this.n = 0;
    }
    LinkSets.prototype.count = function () {
        return this.n;
    };
    LinkSets.prototype.contains = function (id) {
        var result = false;
        this.forAllModules(function (m) {
            if (!result && m.id == id) {
                result = true;
            }
        });
        return result;
    };
    LinkSets.prototype.add = function (linktype, m) {
        var s = linktype in this.sets ? this.sets[linktype] : this.sets[linktype] = new ModuleSet();
        s.add(m);
        ++this.n;
    };
    LinkSets.prototype.remove = function (linktype, m) {
        var ms = this.sets[linktype];
        ms.remove(m);
        if (ms.count() === 0) {
            delete this.sets[linktype];
        }
        --this.n;
    };
    LinkSets.prototype.forAll = function (f) {
        for (var linktype in this.sets) {
            f(this.sets[linktype], Number(linktype));
        }
    };
    LinkSets.prototype.forAllModules = function (f) {
        this.forAll(function (ms, lt) { return ms.forAll(f); });
    };
    LinkSets.prototype.intersection = function (other) {
        var result = new LinkSets();
        this.forAll(function (ms, lt) {
            if (lt in other.sets) {
                var i = ms.intersection(other.sets[lt]), n = i.count();
                if (n > 0) {
                    result.sets[lt] = i;
                    result.n += n;
                }
            }
        });
        return result;
    };
    return LinkSets;
}());
exports.LinkSets = LinkSets;
function intersectionCount(m, n) {
    return Object.keys(intersection(m, n)).length;
}
function getGroups(nodes, links, la, rootGroup) {
    var n = nodes.length, c = new Configuration(n, links, la, rootGroup);
    while (c.greedyMerge())
        ;
    var powerEdges = [];
    var g = c.getGroupHierarchy(powerEdges);
    powerEdges.forEach(function (e) {
        var f = function (end) {
            var g = e[end];
            if (typeof g == "number")
                e[end] = nodes[g];
        };
        f("source");
        f("target");
    });
    return { groups: g, powerEdges: powerEdges };
}
exports.getGroups = getGroups;

},{}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PairingHeap = (function () {
    function PairingHeap(elem) {
        this.elem = elem;
        this.subheaps = [];
    }
    PairingHeap.prototype.toString = function (selector) {
        var str = "", needComma = false;
        for (var i = 0; i < this.subheaps.length; ++i) {
            var subheap = this.subheaps[i];
            if (!subheap.elem) {
                needComma = false;
                continue;
            }
            if (needComma) {
                str = str + ",";
            }
            str = str + subheap.toString(selector);
            needComma = true;
        }
        if (str !== "") {
            str = "(" + str + ")";
        }
        return (this.elem ? selector(this.elem) : "") + str;
    };
    PairingHeap.prototype.forEach = function (f) {
        if (!this.empty()) {
            f(this.elem, this);
            this.subheaps.forEach(function (s) { return s.forEach(f); });
        }
    };
    PairingHeap.prototype.count = function () {
        return this.empty() ? 0 : 1 + this.subheaps.reduce(function (n, h) {
            return n + h.count();
        }, 0);
    };
    PairingHeap.prototype.min = function () {
        return this.elem;
    };
    PairingHeap.prototype.empty = function () {
        return this.elem == null;
    };
    PairingHeap.prototype.contains = function (h) {
        if (this === h)
            return true;
        for (var i = 0; i < this.subheaps.length; i++) {
            if (this.subheaps[i].contains(h))
                return true;
        }
        return false;
    };
    PairingHeap.prototype.isHeap = function (lessThan) {
        var _this = this;
        return this.subheaps.every(function (h) { return lessThan(_this.elem, h.elem) && h.isHeap(lessThan); });
    };
    PairingHeap.prototype.insert = function (obj, lessThan) {
        return this.merge(new PairingHeap(obj), lessThan);
    };
    PairingHeap.prototype.merge = function (heap2, lessThan) {
        if (this.empty())
            return heap2;
        else if (heap2.empty())
            return this;
        else if (lessThan(this.elem, heap2.elem)) {
            this.subheaps.push(heap2);
            return this;
        }
        else {
            heap2.subheaps.push(this);
            return heap2;
        }
    };
    PairingHeap.prototype.removeMin = function (lessThan) {
        if (this.empty())
            return null;
        else
            return this.mergePairs(lessThan);
    };
    PairingHeap.prototype.mergePairs = function (lessThan) {
        if (this.subheaps.length == 0)
            return new PairingHeap(null);
        else if (this.subheaps.length == 1) {
            return this.subheaps[0];
        }
        else {
            var firstPair = this.subheaps.pop().merge(this.subheaps.pop(), lessThan);
            var remaining = this.mergePairs(lessThan);
            return firstPair.merge(remaining, lessThan);
        }
    };
    PairingHeap.prototype.decreaseKey = function (subheap, newValue, setHeapNode, lessThan) {
        var newHeap = subheap.removeMin(lessThan);
        subheap.elem = newHeap.elem;
        subheap.subheaps = newHeap.subheaps;
        if (setHeapNode !== null && newHeap.elem !== null) {
            setHeapNode(subheap.elem, subheap);
        }
        var pairingNode = new PairingHeap(newValue);
        if (setHeapNode !== null) {
            setHeapNode(newValue, pairingNode);
        }
        return this.merge(pairingNode, lessThan);
    };
    return PairingHeap;
}());
exports.PairingHeap = PairingHeap;
var PriorityQueue = (function () {
    function PriorityQueue(lessThan) {
        this.lessThan = lessThan;
    }
    PriorityQueue.prototype.top = function () {
        if (this.empty()) {
            return null;
        }
        return this.root.elem;
    };
    PriorityQueue.prototype.push = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var pairingNode;
        for (var i = 0, arg; arg = args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ?
                pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    };
    PriorityQueue.prototype.empty = function () {
        return !this.root || !this.root.elem;
    };
    PriorityQueue.prototype.isHeap = function () {
        return this.root.isHeap(this.lessThan);
    };
    PriorityQueue.prototype.forEach = function (f) {
        this.root.forEach(f);
    };
    PriorityQueue.prototype.pop = function () {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    };
    PriorityQueue.prototype.reduceKey = function (heapNode, newKey, setHeapNode) {
        if (setHeapNode === void 0) { setHeapNode = null; }
        this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
    };
    PriorityQueue.prototype.toString = function (selector) {
        return this.root.toString(selector);
    };
    PriorityQueue.prototype.count = function () {
        return this.root.count();
    };
    return PriorityQueue;
}());
exports.PriorityQueue = PriorityQueue;

},{}],16:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var TreeBase = (function () {
    function TreeBase() {
        this.findIter = function (data) {
            var res = this._root;
            var iter = this.iterator();
            while (res !== null) {
                var c = this._comparator(data, res.data);
                if (c === 0) {
                    iter._cursor = res;
                    return iter;
                }
                else {
                    iter._ancestors.push(res);
                    res = res.get_child(c > 0);
                }
            }
            return null;
        };
    }
    TreeBase.prototype.clear = function () {
        this._root = null;
        this.size = 0;
    };
    ;
    TreeBase.prototype.find = function (data) {
        var res = this._root;
        while (res !== null) {
            var c = this._comparator(data, res.data);
            if (c === 0) {
                return res.data;
            }
            else {
                res = res.get_child(c > 0);
            }
        }
        return null;
    };
    ;
    TreeBase.prototype.lowerBound = function (data) {
        return this._bound(data, this._comparator);
    };
    ;
    TreeBase.prototype.upperBound = function (data) {
        var cmp = this._comparator;
        function reverse_cmp(a, b) {
            return cmp(b, a);
        }
        return this._bound(data, reverse_cmp);
    };
    ;
    TreeBase.prototype.min = function () {
        var res = this._root;
        if (res === null) {
            return null;
        }
        while (res.left !== null) {
            res = res.left;
        }
        return res.data;
    };
    ;
    TreeBase.prototype.max = function () {
        var res = this._root;
        if (res === null) {
            return null;
        }
        while (res.right !== null) {
            res = res.right;
        }
        return res.data;
    };
    ;
    TreeBase.prototype.iterator = function () {
        return new Iterator(this);
    };
    ;
    TreeBase.prototype.each = function (cb) {
        var it = this.iterator(), data;
        while ((data = it.next()) !== null) {
            cb(data);
        }
    };
    ;
    TreeBase.prototype.reach = function (cb) {
        var it = this.iterator(), data;
        while ((data = it.prev()) !== null) {
            cb(data);
        }
    };
    ;
    TreeBase.prototype._bound = function (data, cmp) {
        var cur = this._root;
        var iter = this.iterator();
        while (cur !== null) {
            var c = this._comparator(data, cur.data);
            if (c === 0) {
                iter._cursor = cur;
                return iter;
            }
            iter._ancestors.push(cur);
            cur = cur.get_child(c > 0);
        }
        for (var i = iter._ancestors.length - 1; i >= 0; --i) {
            cur = iter._ancestors[i];
            if (cmp(data, cur.data) > 0) {
                iter._cursor = cur;
                iter._ancestors.length = i;
                return iter;
            }
        }
        iter._ancestors.length = 0;
        return iter;
    };
    ;
    return TreeBase;
}());
exports.TreeBase = TreeBase;
var Iterator = (function () {
    function Iterator(tree) {
        this._tree = tree;
        this._ancestors = [];
        this._cursor = null;
    }
    Iterator.prototype.data = function () {
        return this._cursor !== null ? this._cursor.data : null;
    };
    ;
    Iterator.prototype.next = function () {
        if (this._cursor === null) {
            var root = this._tree._root;
            if (root !== null) {
                this._minNode(root);
            }
        }
        else {
            if (this._cursor.right === null) {
                var save;
                do {
                    save = this._cursor;
                    if (this._ancestors.length) {
                        this._cursor = this._ancestors.pop();
                    }
                    else {
                        this._cursor = null;
                        break;
                    }
                } while (this._cursor.right === save);
            }
            else {
                this._ancestors.push(this._cursor);
                this._minNode(this._cursor.right);
            }
        }
        return this._cursor !== null ? this._cursor.data : null;
    };
    ;
    Iterator.prototype.prev = function () {
        if (this._cursor === null) {
            var root = this._tree._root;
            if (root !== null) {
                this._maxNode(root);
            }
        }
        else {
            if (this._cursor.left === null) {
                var save;
                do {
                    save = this._cursor;
                    if (this._ancestors.length) {
                        this._cursor = this._ancestors.pop();
                    }
                    else {
                        this._cursor = null;
                        break;
                    }
                } while (this._cursor.left === save);
            }
            else {
                this._ancestors.push(this._cursor);
                this._maxNode(this._cursor.left);
            }
        }
        return this._cursor !== null ? this._cursor.data : null;
    };
    ;
    Iterator.prototype._minNode = function (start) {
        while (start.left !== null) {
            this._ancestors.push(start);
            start = start.left;
        }
        this._cursor = start;
    };
    ;
    Iterator.prototype._maxNode = function (start) {
        while (start.right !== null) {
            this._ancestors.push(start);
            start = start.right;
        }
        this._cursor = start;
    };
    ;
    return Iterator;
}());
exports.Iterator = Iterator;
var Node = (function () {
    function Node(data) {
        this.data = data;
        this.left = null;
        this.right = null;
        this.red = true;
    }
    Node.prototype.get_child = function (dir) {
        return dir ? this.right : this.left;
    };
    ;
    Node.prototype.set_child = function (dir, val) {
        if (dir) {
            this.right = val;
        }
        else {
            this.left = val;
        }
    };
    ;
    return Node;
}());
var RBTree = (function (_super) {
    __extends(RBTree, _super);
    function RBTree(comparator) {
        var _this = _super.call(this) || this;
        _this._root = null;
        _this._comparator = comparator;
        _this.size = 0;
        return _this;
    }
    RBTree.prototype.insert = function (data) {
        var ret = false;
        if (this._root === null) {
            this._root = new Node(data);
            ret = true;
            this.size++;
        }
        else {
            var head = new Node(undefined);
            var dir = false;
            var last = false;
            var gp = null;
            var ggp = head;
            var p = null;
            var node = this._root;
            ggp.right = this._root;
            while (true) {
                if (node === null) {
                    node = new Node(data);
                    p.set_child(dir, node);
                    ret = true;
                    this.size++;
                }
                else if (RBTree.is_red(node.left) && RBTree.is_red(node.right)) {
                    node.red = true;
                    node.left.red = false;
                    node.right.red = false;
                }
                if (RBTree.is_red(node) && RBTree.is_red(p)) {
                    var dir2 = ggp.right === gp;
                    if (node === p.get_child(last)) {
                        ggp.set_child(dir2, RBTree.single_rotate(gp, !last));
                    }
                    else {
                        ggp.set_child(dir2, RBTree.double_rotate(gp, !last));
                    }
                }
                var cmp = this._comparator(node.data, data);
                if (cmp === 0) {
                    break;
                }
                last = dir;
                dir = cmp < 0;
                if (gp !== null) {
                    ggp = gp;
                }
                gp = p;
                p = node;
                node = node.get_child(dir);
            }
            this._root = head.right;
        }
        this._root.red = false;
        return ret;
    };
    ;
    RBTree.prototype.remove = function (data) {
        if (this._root === null) {
            return false;
        }
        var head = new Node(undefined);
        var node = head;
        node.right = this._root;
        var p = null;
        var gp = null;
        var found = null;
        var dir = true;
        while (node.get_child(dir) !== null) {
            var last = dir;
            gp = p;
            p = node;
            node = node.get_child(dir);
            var cmp = this._comparator(data, node.data);
            dir = cmp > 0;
            if (cmp === 0) {
                found = node;
            }
            if (!RBTree.is_red(node) && !RBTree.is_red(node.get_child(dir))) {
                if (RBTree.is_red(node.get_child(!dir))) {
                    var sr = RBTree.single_rotate(node, dir);
                    p.set_child(last, sr);
                    p = sr;
                }
                else if (!RBTree.is_red(node.get_child(!dir))) {
                    var sibling = p.get_child(!last);
                    if (sibling !== null) {
                        if (!RBTree.is_red(sibling.get_child(!last)) && !RBTree.is_red(sibling.get_child(last))) {
                            p.red = false;
                            sibling.red = true;
                            node.red = true;
                        }
                        else {
                            var dir2 = gp.right === p;
                            if (RBTree.is_red(sibling.get_child(last))) {
                                gp.set_child(dir2, RBTree.double_rotate(p, last));
                            }
                            else if (RBTree.is_red(sibling.get_child(!last))) {
                                gp.set_child(dir2, RBTree.single_rotate(p, last));
                            }
                            var gpc = gp.get_child(dir2);
                            gpc.red = true;
                            node.red = true;
                            gpc.left.red = false;
                            gpc.right.red = false;
                        }
                    }
                }
            }
        }
        if (found !== null) {
            found.data = node.data;
            p.set_child(p.right === node, node.get_child(node.left === null));
            this.size--;
        }
        this._root = head.right;
        if (this._root !== null) {
            this._root.red = false;
        }
        return found !== null;
    };
    ;
    RBTree.is_red = function (node) {
        return node !== null && node.red;
    };
    RBTree.single_rotate = function (root, dir) {
        var save = root.get_child(!dir);
        root.set_child(!dir, save.get_child(dir));
        save.set_child(dir, root);
        root.red = true;
        save.red = false;
        return save;
    };
    RBTree.double_rotate = function (root, dir) {
        root.set_child(!dir, RBTree.single_rotate(root.get_child(!dir), !dir));
        return RBTree.single_rotate(root, dir);
    };
    return RBTree;
}(TreeBase));
exports.RBTree = RBTree;

},{}],17:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var vpsc_1 = require("./vpsc");
var rbtree_1 = require("./rbtree");
function computeGroupBounds(g) {
    g.bounds = typeof g.leaves !== "undefined" ?
        g.leaves.reduce(function (r, c) { return c.bounds.union(r); }, Rectangle.empty()) :
        Rectangle.empty();
    if (typeof g.groups !== "undefined")
        g.bounds = g.groups.reduce(function (r, c) { return computeGroupBounds(c).union(r); }, g.bounds);
    g.bounds = g.bounds.inflate(g.padding);
    return g.bounds;
}
exports.computeGroupBounds = computeGroupBounds;
var Rectangle = (function () {
    function Rectangle(x, X, y, Y) {
        this.x = x;
        this.X = X;
        this.y = y;
        this.Y = Y;
    }
    Rectangle.empty = function () { return new Rectangle(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY); };
    Rectangle.prototype.cx = function () { return (this.x + this.X) / 2; };
    Rectangle.prototype.cy = function () { return (this.y + this.Y) / 2; };
    Rectangle.prototype.overlapX = function (r) {
        var ux = this.cx(), vx = r.cx();
        if (ux <= vx && r.x < this.X)
            return this.X - r.x;
        if (vx <= ux && this.x < r.X)
            return r.X - this.x;
        return 0;
    };
    Rectangle.prototype.overlapY = function (r) {
        var uy = this.cy(), vy = r.cy();
        if (uy <= vy && r.y < this.Y)
            return this.Y - r.y;
        if (vy <= uy && this.y < r.Y)
            return r.Y - this.y;
        return 0;
    };
    Rectangle.prototype.setXCentre = function (cx) {
        var dx = cx - this.cx();
        this.x += dx;
        this.X += dx;
    };
    Rectangle.prototype.setYCentre = function (cy) {
        var dy = cy - this.cy();
        this.y += dy;
        this.Y += dy;
    };
    Rectangle.prototype.width = function () {
        return this.X - this.x;
    };
    Rectangle.prototype.height = function () {
        return this.Y - this.y;
    };
    Rectangle.prototype.union = function (r) {
        return new Rectangle(Math.min(this.x, r.x), Math.max(this.X, r.X), Math.min(this.y, r.y), Math.max(this.Y, r.Y));
    };
    Rectangle.prototype.lineIntersections = function (x1, y1, x2, y2) {
        var sides = [[this.x, this.y, this.X, this.y],
            [this.X, this.y, this.X, this.Y],
            [this.X, this.Y, this.x, this.Y],
            [this.x, this.Y, this.x, this.y]];
        var intersections = [];
        for (var i = 0; i < 4; ++i) {
            var r = Rectangle.lineIntersection(x1, y1, x2, y2, sides[i][0], sides[i][1], sides[i][2], sides[i][3]);
            if (r !== null)
                intersections.push({ x: r.x, y: r.y });
        }
        return intersections;
    };
    Rectangle.prototype.rayIntersection = function (x2, y2) {
        var ints = this.lineIntersections(this.cx(), this.cy(), x2, y2);
        return ints.length > 0 ? ints[0] : null;
    };
    Rectangle.prototype.vertices = function () {
        return [
            { x: this.x, y: this.y },
            { x: this.X, y: this.y },
            { x: this.X, y: this.Y },
            { x: this.x, y: this.Y }
        ];
    };
    Rectangle.lineIntersection = function (x1, y1, x2, y2, x3, y3, x4, y4) {
        var dx12 = x2 - x1, dx34 = x4 - x3, dy12 = y2 - y1, dy34 = y4 - y3, denominator = dy34 * dx12 - dx34 * dy12;
        if (denominator == 0)
            return null;
        var dx31 = x1 - x3, dy31 = y1 - y3, numa = dx34 * dy31 - dy34 * dx31, a = numa / denominator, numb = dx12 * dy31 - dy12 * dx31, b = numb / denominator;
        if (a >= 0 && a <= 1 && b >= 0 && b <= 1) {
            return {
                x: x1 + a * dx12,
                y: y1 + a * dy12
            };
        }
        return null;
    };
    Rectangle.prototype.inflate = function (pad) {
        return new Rectangle(this.x - pad, this.X + pad, this.y - pad, this.Y + pad);
    };
    return Rectangle;
}());
exports.Rectangle = Rectangle;
function makeEdgeBetween(source, target, ah) {
    var si = source.rayIntersection(target.cx(), target.cy()) || { x: source.cx(), y: source.cy() }, ti = target.rayIntersection(source.cx(), source.cy()) || { x: target.cx(), y: target.cy() }, dx = ti.x - si.x, dy = ti.y - si.y, l = Math.sqrt(dx * dx + dy * dy), al = l - ah;
    return {
        sourceIntersection: si,
        targetIntersection: ti,
        arrowStart: { x: si.x + al * dx / l, y: si.y + al * dy / l }
    };
}
exports.makeEdgeBetween = makeEdgeBetween;
function makeEdgeTo(s, target, ah) {
    var ti = target.rayIntersection(s.x, s.y);
    if (!ti)
        ti = { x: target.cx(), y: target.cy() };
    var dx = ti.x - s.x, dy = ti.y - s.y, l = Math.sqrt(dx * dx + dy * dy);
    return { x: ti.x - ah * dx / l, y: ti.y - ah * dy / l };
}
exports.makeEdgeTo = makeEdgeTo;
var Node = (function () {
    function Node(v, r, pos) {
        this.v = v;
        this.r = r;
        this.pos = pos;
        this.prev = makeRBTree();
        this.next = makeRBTree();
    }
    return Node;
}());
var Event = (function () {
    function Event(isOpen, v, pos) {
        this.isOpen = isOpen;
        this.v = v;
        this.pos = pos;
    }
    return Event;
}());
function compareEvents(a, b) {
    if (a.pos > b.pos) {
        return 1;
    }
    if (a.pos < b.pos) {
        return -1;
    }
    if (a.isOpen) {
        return -1;
    }
    if (b.isOpen) {
        return 1;
    }
    return 0;
}
function makeRBTree() {
    return new rbtree_1.RBTree(function (a, b) { return a.pos - b.pos; });
}
var xRect = {
    getCentre: function (r) { return r.cx(); },
    getOpen: function (r) { return r.y; },
    getClose: function (r) { return r.Y; },
    getSize: function (r) { return r.width(); },
    makeRect: function (open, close, center, size) { return new Rectangle(center - size / 2, center + size / 2, open, close); },
    findNeighbours: findXNeighbours
};
var yRect = {
    getCentre: function (r) { return r.cy(); },
    getOpen: function (r) { return r.x; },
    getClose: function (r) { return r.X; },
    getSize: function (r) { return r.height(); },
    makeRect: function (open, close, center, size) { return new Rectangle(open, close, center - size / 2, center + size / 2); },
    findNeighbours: findYNeighbours
};
function generateGroupConstraints(root, f, minSep, isContained) {
    if (isContained === void 0) { isContained = false; }
    var padding = root.padding, gn = typeof root.groups !== 'undefined' ? root.groups.length : 0, ln = typeof root.leaves !== 'undefined' ? root.leaves.length : 0, childConstraints = !gn ? []
        : root.groups.reduce(function (ccs, g) { return ccs.concat(generateGroupConstraints(g, f, minSep, true)); }, []), n = (isContained ? 2 : 0) + ln + gn, vs = new Array(n), rs = new Array(n), i = 0, add = function (r, v) { rs[i] = r; vs[i++] = v; };
    if (isContained) {
        var b = root.bounds, c = f.getCentre(b), s = f.getSize(b) / 2, open = f.getOpen(b), close = f.getClose(b), min = c - s + padding / 2, max = c + s - padding / 2;
        root.minVar.desiredPosition = min;
        add(f.makeRect(open, close, min, padding), root.minVar);
        root.maxVar.desiredPosition = max;
        add(f.makeRect(open, close, max, padding), root.maxVar);
    }
    if (ln)
        root.leaves.forEach(function (l) { return add(l.bounds, l.variable); });
    if (gn)
        root.groups.forEach(function (g) {
            var b = g.bounds;
            add(f.makeRect(f.getOpen(b), f.getClose(b), f.getCentre(b), f.getSize(b)), g.minVar);
        });
    var cs = generateConstraints(rs, vs, f, minSep);
    if (gn) {
        vs.forEach(function (v) { v.cOut = [], v.cIn = []; });
        cs.forEach(function (c) { c.left.cOut.push(c), c.right.cIn.push(c); });
        root.groups.forEach(function (g) {
            var gapAdjustment = (g.padding - f.getSize(g.bounds)) / 2;
            g.minVar.cIn.forEach(function (c) { return c.gap += gapAdjustment; });
            g.minVar.cOut.forEach(function (c) { c.left = g.maxVar; c.gap += gapAdjustment; });
        });
    }
    return childConstraints.concat(cs);
}
function generateConstraints(rs, vars, rect, minSep) {
    var i, n = rs.length;
    var N = 2 * n;
    console.assert(vars.length >= n);
    var events = new Array(N);
    for (i = 0; i < n; ++i) {
        var r = rs[i];
        var v = new Node(vars[i], r, rect.getCentre(r));
        events[i] = new Event(true, v, rect.getOpen(r));
        events[i + n] = new Event(false, v, rect.getClose(r));
    }
    events.sort(compareEvents);
    var cs = new Array();
    var scanline = makeRBTree();
    for (i = 0; i < N; ++i) {
        var e = events[i];
        var v = e.v;
        if (e.isOpen) {
            scanline.insert(v);
            rect.findNeighbours(v, scanline);
        }
        else {
            scanline.remove(v);
            var makeConstraint = function (l, r) {
                var sep = (rect.getSize(l.r) + rect.getSize(r.r)) / 2 + minSep;
                cs.push(new vpsc_1.Constraint(l.v, r.v, sep));
            };
            var visitNeighbours = function (forward, reverse, mkcon) {
                var u, it = v[forward].iterator();
                while ((u = it[forward]()) !== null) {
                    mkcon(u, v);
                    u[reverse].remove(v);
                }
            };
            visitNeighbours("prev", "next", function (u, v) { return makeConstraint(u, v); });
            visitNeighbours("next", "prev", function (u, v) { return makeConstraint(v, u); });
        }
    }
    console.assert(scanline.size === 0);
    return cs;
}
function findXNeighbours(v, scanline) {
    var f = function (forward, reverse) {
        var it = scanline.findIter(v);
        var u;
        while ((u = it[forward]()) !== null) {
            var uovervX = u.r.overlapX(v.r);
            if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                v[forward].insert(u);
                u[reverse].insert(v);
            }
            if (uovervX <= 0) {
                break;
            }
        }
    };
    f("next", "prev");
    f("prev", "next");
}
function findYNeighbours(v, scanline) {
    var f = function (forward, reverse) {
        var u = scanline.findIter(v)[forward]();
        if (u !== null && u.r.overlapX(v.r) > 0) {
            v[forward].insert(u);
            u[reverse].insert(v);
        }
    };
    f("next", "prev");
    f("prev", "next");
}
function generateXConstraints(rs, vars) {
    return generateConstraints(rs, vars, xRect, 1e-6);
}
exports.generateXConstraints = generateXConstraints;
function generateYConstraints(rs, vars) {
    return generateConstraints(rs, vars, yRect, 1e-6);
}
exports.generateYConstraints = generateYConstraints;
function generateXGroupConstraints(root) {
    return generateGroupConstraints(root, xRect, 1e-6);
}
exports.generateXGroupConstraints = generateXGroupConstraints;
function generateYGroupConstraints(root) {
    return generateGroupConstraints(root, yRect, 1e-6);
}
exports.generateYGroupConstraints = generateYGroupConstraints;
function removeOverlaps(rs) {
    var vs = rs.map(function (r) { return new vpsc_1.Variable(r.cx()); });
    var cs = generateXConstraints(rs, vs);
    var solver = new vpsc_1.Solver(vs, cs);
    solver.solve();
    vs.forEach(function (v, i) { return rs[i].setXCentre(v.position()); });
    vs = rs.map(function (r) { return new vpsc_1.Variable(r.cy()); });
    cs = generateYConstraints(rs, vs);
    solver = new vpsc_1.Solver(vs, cs);
    solver.solve();
    vs.forEach(function (v, i) { return rs[i].setYCentre(v.position()); });
}
exports.removeOverlaps = removeOverlaps;
var IndexedVariable = (function (_super) {
    __extends(IndexedVariable, _super);
    function IndexedVariable(index, w) {
        var _this = _super.call(this, 0, w) || this;
        _this.index = index;
        return _this;
    }
    return IndexedVariable;
}(vpsc_1.Variable));
exports.IndexedVariable = IndexedVariable;
var Projection = (function () {
    function Projection(nodes, groups, rootGroup, constraints, avoidOverlaps) {
        if (rootGroup === void 0) { rootGroup = null; }
        if (constraints === void 0) { constraints = null; }
        if (avoidOverlaps === void 0) { avoidOverlaps = false; }
        var _this = this;
        this.nodes = nodes;
        this.groups = groups;
        this.rootGroup = rootGroup;
        this.avoidOverlaps = avoidOverlaps;
        this.variables = nodes.map(function (v, i) {
            return v.variable = new IndexedVariable(i, 1);
        });
        if (constraints)
            this.createConstraints(constraints);
        if (avoidOverlaps && rootGroup && typeof rootGroup.groups !== 'undefined') {
            nodes.forEach(function (v) {
                if (!v.width || !v.height) {
                    v.bounds = new Rectangle(v.x, v.x, v.y, v.y);
                    return;
                }
                var w2 = v.width / 2, h2 = v.height / 2;
                v.bounds = new Rectangle(v.x - w2, v.x + w2, v.y - h2, v.y + h2);
            });
            computeGroupBounds(rootGroup);
            var i = nodes.length;
            groups.forEach(function (g) {
                _this.variables[i] = g.minVar = new IndexedVariable(i++, typeof g.stiffness !== "undefined" ? g.stiffness : 0.01);
                _this.variables[i] = g.maxVar = new IndexedVariable(i++, typeof g.stiffness !== "undefined" ? g.stiffness : 0.01);
            });
        }
    }
    Projection.prototype.createSeparation = function (c) {
        return new vpsc_1.Constraint(this.nodes[c.left].variable, this.nodes[c.right].variable, c.gap, typeof c.equality !== "undefined" ? c.equality : false);
    };
    Projection.prototype.makeFeasible = function (c) {
        var _this = this;
        if (!this.avoidOverlaps)
            return;
        var axis = 'x', dim = 'width';
        if (c.axis === 'x')
            axis = 'y', dim = 'height';
        var vs = c.offsets.map(function (o) { return _this.nodes[o.node]; }).sort(function (a, b) { return a[axis] - b[axis]; });
        var p = null;
        vs.forEach(function (v) {
            if (p) {
                var nextPos = p[axis] + p[dim];
                if (nextPos > v[axis]) {
                    v[axis] = nextPos;
                }
            }
            p = v;
        });
    };
    Projection.prototype.createAlignment = function (c) {
        var _this = this;
        var u = this.nodes[c.offsets[0].node].variable;
        this.makeFeasible(c);
        var cs = c.axis === 'x' ? this.xConstraints : this.yConstraints;
        c.offsets.slice(1).forEach(function (o) {
            var v = _this.nodes[o.node].variable;
            cs.push(new vpsc_1.Constraint(u, v, o.offset, true));
        });
    };
    Projection.prototype.createConstraints = function (constraints) {
        var _this = this;
        var isSep = function (c) { return typeof c.type === 'undefined' || c.type === 'separation'; };
        this.xConstraints = constraints
            .filter(function (c) { return c.axis === "x" && isSep(c); })
            .map(function (c) { return _this.createSeparation(c); });
        this.yConstraints = constraints
            .filter(function (c) { return c.axis === "y" && isSep(c); })
            .map(function (c) { return _this.createSeparation(c); });
        constraints
            .filter(function (c) { return c.type === 'alignment'; })
            .forEach(function (c) { return _this.createAlignment(c); });
    };
    Projection.prototype.setupVariablesAndBounds = function (x0, y0, desired, getDesired) {
        this.nodes.forEach(function (v, i) {
            if (v.fixed) {
                v.variable.weight = v.fixedWeight ? v.fixedWeight : 1000;
                desired[i] = getDesired(v);
            }
            else {
                v.variable.weight = 1;
            }
            var w = (v.width || 0) / 2, h = (v.height || 0) / 2;
            var ix = x0[i], iy = y0[i];
            v.bounds = new Rectangle(ix - w, ix + w, iy - h, iy + h);
        });
    };
    Projection.prototype.xProject = function (x0, y0, x) {
        if (!this.rootGroup && !(this.avoidOverlaps || this.xConstraints))
            return;
        this.project(x0, y0, x0, x, function (v) { return v.px; }, this.xConstraints, generateXGroupConstraints, function (v) { return v.bounds.setXCentre(x[v.variable.index] = v.variable.position()); }, function (g) {
            var xmin = x[g.minVar.index] = g.minVar.position();
            var xmax = x[g.maxVar.index] = g.maxVar.position();
            var p2 = g.padding / 2;
            g.bounds.x = xmin - p2;
            g.bounds.X = xmax + p2;
        });
    };
    Projection.prototype.yProject = function (x0, y0, y) {
        if (!this.rootGroup && !this.yConstraints)
            return;
        this.project(x0, y0, y0, y, function (v) { return v.py; }, this.yConstraints, generateYGroupConstraints, function (v) { return v.bounds.setYCentre(y[v.variable.index] = v.variable.position()); }, function (g) {
            var ymin = y[g.minVar.index] = g.minVar.position();
            var ymax = y[g.maxVar.index] = g.maxVar.position();
            var p2 = g.padding / 2;
            g.bounds.y = ymin - p2;
            ;
            g.bounds.Y = ymax + p2;
        });
    };
    Projection.prototype.projectFunctions = function () {
        var _this = this;
        return [
            function (x0, y0, x) { return _this.xProject(x0, y0, x); },
            function (x0, y0, y) { return _this.yProject(x0, y0, y); }
        ];
    };
    Projection.prototype.project = function (x0, y0, start, desired, getDesired, cs, generateConstraints, updateNodeBounds, updateGroupBounds) {
        this.setupVariablesAndBounds(x0, y0, desired, getDesired);
        if (this.rootGroup && this.avoidOverlaps) {
            computeGroupBounds(this.rootGroup);
            cs = cs.concat(generateConstraints(this.rootGroup));
        }
        this.solve(this.variables, cs, start, desired);
        this.nodes.forEach(updateNodeBounds);
        if (this.rootGroup && this.avoidOverlaps) {
            this.groups.forEach(updateGroupBounds);
            computeGroupBounds(this.rootGroup);
        }
    };
    Projection.prototype.solve = function (vs, cs, starting, desired) {
        var solver = new vpsc_1.Solver(vs, cs);
        solver.setStartingPositions(starting);
        solver.setDesiredPositions(desired);
        solver.solve();
    };
    return Projection;
}());
exports.Projection = Projection;

},{"./rbtree":16,"./vpsc":19}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pqueue_1 = require("./pqueue");
var Neighbour = (function () {
    function Neighbour(id, distance) {
        this.id = id;
        this.distance = distance;
    }
    return Neighbour;
}());
var Node = (function () {
    function Node(id) {
        this.id = id;
        this.neighbours = [];
    }
    return Node;
}());
var QueueEntry = (function () {
    function QueueEntry(node, prev, d) {
        this.node = node;
        this.prev = prev;
        this.d = d;
    }
    return QueueEntry;
}());
var Calculator = (function () {
    function Calculator(n, es, getSourceIndex, getTargetIndex, getLength) {
        this.n = n;
        this.es = es;
        this.neighbours = new Array(this.n);
        var i = this.n;
        while (i--)
            this.neighbours[i] = new Node(i);
        i = this.es.length;
        while (i--) {
            var e = this.es[i];
            var u = getSourceIndex(e), v = getTargetIndex(e);
            var d = getLength(e);
            this.neighbours[u].neighbours.push(new Neighbour(v, d));
            this.neighbours[v].neighbours.push(new Neighbour(u, d));
        }
    }
    Calculator.prototype.DistanceMatrix = function () {
        var D = new Array(this.n);
        for (var i = 0; i < this.n; ++i) {
            D[i] = this.dijkstraNeighbours(i);
        }
        return D;
    };
    Calculator.prototype.DistancesFromNode = function (start) {
        return this.dijkstraNeighbours(start);
    };
    Calculator.prototype.PathFromNodeToNode = function (start, end) {
        return this.dijkstraNeighbours(start, end);
    };
    Calculator.prototype.PathFromNodeToNodeWithPrevCost = function (start, end, prevCost) {
        var q = new pqueue_1.PriorityQueue(function (a, b) { return a.d <= b.d; }), u = this.neighbours[start], qu = new QueueEntry(u, null, 0), visitedFrom = {};
        q.push(qu);
        while (!q.empty()) {
            qu = q.pop();
            u = qu.node;
            if (u.id === end) {
                break;
            }
            var i = u.neighbours.length;
            while (i--) {
                var neighbour = u.neighbours[i], v = this.neighbours[neighbour.id];
                if (qu.prev && v.id === qu.prev.node.id)
                    continue;
                var viduid = v.id + ',' + u.id;
                if (viduid in visitedFrom && visitedFrom[viduid] <= qu.d)
                    continue;
                var cc = qu.prev ? prevCost(qu.prev.node.id, u.id, v.id) : 0, t = qu.d + neighbour.distance + cc;
                visitedFrom[viduid] = t;
                q.push(new QueueEntry(v, qu, t));
            }
        }
        var path = [];
        while (qu.prev) {
            qu = qu.prev;
            path.push(qu.node.id);
        }
        return path;
    };
    Calculator.prototype.dijkstraNeighbours = function (start, dest) {
        if (dest === void 0) { dest = -1; }
        var q = new pqueue_1.PriorityQueue(function (a, b) { return a.d <= b.d; }), i = this.neighbours.length, d = new Array(i);
        while (i--) {
            var node = this.neighbours[i];
            node.d = i === start ? 0 : Number.POSITIVE_INFINITY;
            node.q = q.push(node);
        }
        while (!q.empty()) {
            var u = q.pop();
            d[u.id] = u.d;
            if (u.id === dest) {
                var path = [];
                var v = u;
                while (typeof v.prev !== 'undefined') {
                    path.push(v.prev.id);
                    v = v.prev;
                }
                return path;
            }
            i = u.neighbours.length;
            while (i--) {
                var neighbour = u.neighbours[i];
                var v = this.neighbours[neighbour.id];
                var t = u.d + neighbour.distance;
                if (u.d !== Number.MAX_VALUE && v.d > t) {
                    v.d = t;
                    v.prev = u;
                    q.reduceKey(v.q, v, function (e, q) { return e.q = q; });
                }
            }
        }
        return d;
    };
    return Calculator;
}());
exports.Calculator = Calculator;

},{"./pqueue":15}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PositionStats = (function () {
    function PositionStats(scale) {
        this.scale = scale;
        this.AB = 0;
        this.AD = 0;
        this.A2 = 0;
    }
    PositionStats.prototype.addVariable = function (v) {
        var ai = this.scale / v.scale;
        var bi = v.offset / v.scale;
        var wi = v.weight;
        this.AB += wi * ai * bi;
        this.AD += wi * ai * v.desiredPosition;
        this.A2 += wi * ai * ai;
    };
    PositionStats.prototype.getPosn = function () {
        return (this.AD - this.AB) / this.A2;
    };
    return PositionStats;
}());
exports.PositionStats = PositionStats;
var Constraint = (function () {
    function Constraint(left, right, gap, equality) {
        if (equality === void 0) { equality = false; }
        this.left = left;
        this.right = right;
        this.gap = gap;
        this.equality = equality;
        this.active = false;
        this.unsatisfiable = false;
        this.left = left;
        this.right = right;
        this.gap = gap;
        this.equality = equality;
    }
    Constraint.prototype.slack = function () {
        return this.unsatisfiable ? Number.MAX_VALUE
            : this.right.scale * this.right.position() - this.gap
                - this.left.scale * this.left.position();
    };
    return Constraint;
}());
exports.Constraint = Constraint;
var Variable = (function () {
    function Variable(desiredPosition, weight, scale) {
        if (weight === void 0) { weight = 1; }
        if (scale === void 0) { scale = 1; }
        this.desiredPosition = desiredPosition;
        this.weight = weight;
        this.scale = scale;
        this.offset = 0;
    }
    Variable.prototype.dfdv = function () {
        return 2.0 * this.weight * (this.position() - this.desiredPosition);
    };
    Variable.prototype.position = function () {
        return (this.block.ps.scale * this.block.posn + this.offset) / this.scale;
    };
    Variable.prototype.visitNeighbours = function (prev, f) {
        var ff = function (c, next) { return c.active && prev !== next && f(c, next); };
        this.cOut.forEach(function (c) { return ff(c, c.right); });
        this.cIn.forEach(function (c) { return ff(c, c.left); });
    };
    return Variable;
}());
exports.Variable = Variable;
var Block = (function () {
    function Block(v) {
        this.vars = [];
        v.offset = 0;
        this.ps = new PositionStats(v.scale);
        this.addVariable(v);
    }
    Block.prototype.addVariable = function (v) {
        v.block = this;
        this.vars.push(v);
        this.ps.addVariable(v);
        this.posn = this.ps.getPosn();
    };
    Block.prototype.updateWeightedPosition = function () {
        this.ps.AB = this.ps.AD = this.ps.A2 = 0;
        for (var i = 0, n = this.vars.length; i < n; ++i)
            this.ps.addVariable(this.vars[i]);
        this.posn = this.ps.getPosn();
    };
    Block.prototype.compute_lm = function (v, u, postAction) {
        var _this = this;
        var dfdv = v.dfdv();
        v.visitNeighbours(u, function (c, next) {
            var _dfdv = _this.compute_lm(next, v, postAction);
            if (next === c.right) {
                dfdv += _dfdv * c.left.scale;
                c.lm = _dfdv;
            }
            else {
                dfdv += _dfdv * c.right.scale;
                c.lm = -_dfdv;
            }
            postAction(c);
        });
        return dfdv / v.scale;
    };
    Block.prototype.populateSplitBlock = function (v, prev) {
        var _this = this;
        v.visitNeighbours(prev, function (c, next) {
            next.offset = v.offset + (next === c.right ? c.gap : -c.gap);
            _this.addVariable(next);
            _this.populateSplitBlock(next, v);
        });
    };
    Block.prototype.traverse = function (visit, acc, v, prev) {
        var _this = this;
        if (v === void 0) { v = this.vars[0]; }
        if (prev === void 0) { prev = null; }
        v.visitNeighbours(prev, function (c, next) {
            acc.push(visit(c));
            _this.traverse(visit, acc, next, v);
        });
    };
    Block.prototype.findMinLM = function () {
        var m = null;
        this.compute_lm(this.vars[0], null, function (c) {
            if (!c.equality && (m === null || c.lm < m.lm))
                m = c;
        });
        return m;
    };
    Block.prototype.findMinLMBetween = function (lv, rv) {
        this.compute_lm(lv, null, function () { });
        var m = null;
        this.findPath(lv, null, rv, function (c, next) {
            if (!c.equality && c.right === next && (m === null || c.lm < m.lm))
                m = c;
        });
        return m;
    };
    Block.prototype.findPath = function (v, prev, to, visit) {
        var _this = this;
        var endFound = false;
        v.visitNeighbours(prev, function (c, next) {
            if (!endFound && (next === to || _this.findPath(next, v, to, visit))) {
                endFound = true;
                visit(c, next);
            }
        });
        return endFound;
    };
    Block.prototype.isActiveDirectedPathBetween = function (u, v) {
        if (u === v)
            return true;
        var i = u.cOut.length;
        while (i--) {
            var c = u.cOut[i];
            if (c.active && this.isActiveDirectedPathBetween(c.right, v))
                return true;
        }
        return false;
    };
    Block.split = function (c) {
        c.active = false;
        return [Block.createSplitBlock(c.left), Block.createSplitBlock(c.right)];
    };
    Block.createSplitBlock = function (startVar) {
        var b = new Block(startVar);
        b.populateSplitBlock(startVar, null);
        return b;
    };
    Block.prototype.splitBetween = function (vl, vr) {
        var c = this.findMinLMBetween(vl, vr);
        if (c !== null) {
            var bs = Block.split(c);
            return { constraint: c, lb: bs[0], rb: bs[1] };
        }
        return null;
    };
    Block.prototype.mergeAcross = function (b, c, dist) {
        c.active = true;
        for (var i = 0, n = b.vars.length; i < n; ++i) {
            var v = b.vars[i];
            v.offset += dist;
            this.addVariable(v);
        }
        this.posn = this.ps.getPosn();
    };
    Block.prototype.cost = function () {
        var sum = 0, i = this.vars.length;
        while (i--) {
            var v = this.vars[i], d = v.position() - v.desiredPosition;
            sum += d * d * v.weight;
        }
        return sum;
    };
    return Block;
}());
exports.Block = Block;
var Blocks = (function () {
    function Blocks(vs) {
        this.vs = vs;
        var n = vs.length;
        this.list = new Array(n);
        while (n--) {
            var b = new Block(vs[n]);
            this.list[n] = b;
            b.blockInd = n;
        }
    }
    Blocks.prototype.cost = function () {
        var sum = 0, i = this.list.length;
        while (i--)
            sum += this.list[i].cost();
        return sum;
    };
    Blocks.prototype.insert = function (b) {
        b.blockInd = this.list.length;
        this.list.push(b);
    };
    Blocks.prototype.remove = function (b) {
        var last = this.list.length - 1;
        var swapBlock = this.list[last];
        this.list.length = last;
        if (b !== swapBlock) {
            this.list[b.blockInd] = swapBlock;
            swapBlock.blockInd = b.blockInd;
        }
    };
    Blocks.prototype.merge = function (c) {
        var l = c.left.block, r = c.right.block;
        var dist = c.right.offset - c.left.offset - c.gap;
        if (l.vars.length < r.vars.length) {
            r.mergeAcross(l, c, dist);
            this.remove(l);
        }
        else {
            l.mergeAcross(r, c, -dist);
            this.remove(r);
        }
    };
    Blocks.prototype.forEach = function (f) {
        this.list.forEach(f);
    };
    Blocks.prototype.updateBlockPositions = function () {
        this.list.forEach(function (b) { return b.updateWeightedPosition(); });
    };
    Blocks.prototype.split = function (inactive) {
        var _this = this;
        this.updateBlockPositions();
        this.list.forEach(function (b) {
            var v = b.findMinLM();
            if (v !== null && v.lm < Solver.LAGRANGIAN_TOLERANCE) {
                b = v.left.block;
                Block.split(v).forEach(function (nb) { return _this.insert(nb); });
                _this.remove(b);
                inactive.push(v);
            }
        });
    };
    return Blocks;
}());
exports.Blocks = Blocks;
var Solver = (function () {
    function Solver(vs, cs) {
        this.vs = vs;
        this.cs = cs;
        this.vs = vs;
        vs.forEach(function (v) {
            v.cIn = [], v.cOut = [];
        });
        this.cs = cs;
        cs.forEach(function (c) {
            c.left.cOut.push(c);
            c.right.cIn.push(c);
        });
        this.inactive = cs.map(function (c) { c.active = false; return c; });
        this.bs = null;
    }
    Solver.prototype.cost = function () {
        return this.bs.cost();
    };
    Solver.prototype.setStartingPositions = function (ps) {
        this.inactive = this.cs.map(function (c) { c.active = false; return c; });
        this.bs = new Blocks(this.vs);
        this.bs.forEach(function (b, i) { return b.posn = ps[i]; });
    };
    Solver.prototype.setDesiredPositions = function (ps) {
        this.vs.forEach(function (v, i) { return v.desiredPosition = ps[i]; });
    };
    Solver.prototype.mostViolated = function () {
        var minSlack = Number.MAX_VALUE, v = null, l = this.inactive, n = l.length, deletePoint = n;
        for (var i = 0; i < n; ++i) {
            var c = l[i];
            if (c.unsatisfiable)
                continue;
            var slack = c.slack();
            if (c.equality || slack < minSlack) {
                minSlack = slack;
                v = c;
                deletePoint = i;
                if (c.equality)
                    break;
            }
        }
        if (deletePoint !== n &&
            (minSlack < Solver.ZERO_UPPERBOUND && !v.active || v.equality)) {
            l[deletePoint] = l[n - 1];
            l.length = n - 1;
        }
        return v;
    };
    Solver.prototype.satisfy = function () {
        if (this.bs == null) {
            this.bs = new Blocks(this.vs);
        }
        this.bs.split(this.inactive);
        var v = null;
        while ((v = this.mostViolated()) && (v.equality || v.slack() < Solver.ZERO_UPPERBOUND && !v.active)) {
            var lb = v.left.block, rb = v.right.block;
            if (lb !== rb) {
                this.bs.merge(v);
            }
            else {
                if (lb.isActiveDirectedPathBetween(v.right, v.left)) {
                    v.unsatisfiable = true;
                    continue;
                }
                var split = lb.splitBetween(v.left, v.right);
                if (split !== null) {
                    this.bs.insert(split.lb);
                    this.bs.insert(split.rb);
                    this.bs.remove(lb);
                    this.inactive.push(split.constraint);
                }
                else {
                    v.unsatisfiable = true;
                    continue;
                }
                if (v.slack() >= 0) {
                    this.inactive.push(v);
                }
                else {
                    this.bs.merge(v);
                }
            }
        }
    };
    Solver.prototype.solve = function () {
        this.satisfy();
        var lastcost = Number.MAX_VALUE, cost = this.bs.cost();
        while (Math.abs(lastcost - cost) > 0.0001) {
            this.satisfy();
            lastcost = cost;
            cost = this.bs.cost();
        }
        return cost;
    };
    Solver.LAGRANGIAN_TOLERANCE = -1e-4;
    Solver.ZERO_UPPERBOUND = -1e-10;
    return Solver;
}());
exports.Solver = Solver;
function removeOverlapInOneDimension(spans, lowerBound, upperBound) {
    var vs = spans.map(function (s) { return new Variable(s.desiredCenter); });
    var cs = [];
    var n = spans.length;
    for (var i = 0; i < n - 1; i++) {
        var left = spans[i], right = spans[i + 1];
        cs.push(new Constraint(vs[i], vs[i + 1], (left.size + right.size) / 2));
    }
    var leftMost = vs[0], rightMost = vs[n - 1], leftMostSize = spans[0].size / 2, rightMostSize = spans[n - 1].size / 2;
    var vLower = null, vUpper = null;
    if (lowerBound) {
        vLower = new Variable(lowerBound, leftMost.weight * 1000);
        vs.push(vLower);
        cs.push(new Constraint(vLower, leftMost, leftMostSize));
    }
    if (upperBound) {
        vUpper = new Variable(upperBound, rightMost.weight * 1000);
        vs.push(vUpper);
        cs.push(new Constraint(rightMost, vUpper, rightMostSize));
    }
    var solver = new Solver(vs, cs);
    solver.solve();
    return {
        newCenters: vs.slice(0, spans.length).map(function (v) { return v.position(); }),
        lowerBound: vLower ? vLower.position() : leftMost.position() - leftMostSize,
        upperBound: vUpper ? vUpper.position() : rightMost.position() + rightMostSize
    };
}
exports.removeOverlapInOneDimension = removeOverlapInOneDimension;

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkaXN0L2luZGV4LmpzIiwiZGlzdC9zcmMvYWRhcHRvci5qcyIsImRpc3Qvc3JjL2JhdGNoLmpzIiwiZGlzdC9zcmMvZDNhZGFwdG9yLmpzIiwiZGlzdC9zcmMvZDN2M2FkYXB0b3IuanMiLCJkaXN0L3NyYy9kM3Y0YWRhcHRvci5qcyIsImRpc3Qvc3JjL2Rlc2NlbnQuanMiLCJkaXN0L3NyYy9nZW9tLmpzIiwiZGlzdC9zcmMvZ3JpZHJvdXRlci5qcyIsImRpc3Qvc3JjL2hhbmRsZWRpc2Nvbm5lY3RlZC5qcyIsImRpc3Qvc3JjL2xheW91dC5qcyIsImRpc3Qvc3JjL2xheW91dDNkLmpzIiwiZGlzdC9zcmMvbGlua2xlbmd0aHMuanMiLCJkaXN0L3NyYy9wb3dlcmdyYXBoLmpzIiwiZGlzdC9zcmMvcHF1ZXVlLmpzIiwiZGlzdC9zcmMvcmJ0cmVlLmpzIiwiZGlzdC9zcmMvcmVjdGFuZ2xlLmpzIiwiZGlzdC9zcmMvc2hvcnRlc3RwYXRocy5qcyIsImRpc3Qvc3JjL3Zwc2MuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xyXG5mdW5jdGlvbiBfX2V4cG9ydChtKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmICghZXhwb3J0cy5oYXNPd25Qcm9wZXJ0eShwKSkgZXhwb3J0c1twXSA9IG1bcF07XHJcbn1cclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5fX2V4cG9ydChyZXF1aXJlKFwiLi9zcmMvYWRhcHRvclwiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9kM2FkYXB0b3JcIikpO1xyXG5fX2V4cG9ydChyZXF1aXJlKFwiLi9zcmMvZGVzY2VudFwiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9nZW9tXCIpKTtcclxuX19leHBvcnQocmVxdWlyZShcIi4vc3JjL2dyaWRyb3V0ZXJcIikpO1xyXG5fX2V4cG9ydChyZXF1aXJlKFwiLi9zcmMvaGFuZGxlZGlzY29ubmVjdGVkXCIpKTtcclxuX19leHBvcnQocmVxdWlyZShcIi4vc3JjL2xheW91dFwiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9sYXlvdXQzZFwiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9saW5rbGVuZ3Roc1wiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9wb3dlcmdyYXBoXCIpKTtcclxuX19leHBvcnQocmVxdWlyZShcIi4vc3JjL3BxdWV1ZVwiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9yYnRyZWVcIikpO1xyXG5fX2V4cG9ydChyZXF1aXJlKFwiLi9zcmMvcmVjdGFuZ2xlXCIpKTtcclxuX19leHBvcnQocmVxdWlyZShcIi4vc3JjL3Nob3J0ZXN0cGF0aHNcIikpO1xyXG5fX2V4cG9ydChyZXF1aXJlKFwiLi9zcmMvdnBzY1wiKSk7XHJcbl9fZXhwb3J0KHJlcXVpcmUoXCIuL3NyYy9iYXRjaFwiKSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgX19leHRlbmRzID0gKHRoaXMgJiYgdGhpcy5fX2V4dGVuZHMpIHx8IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBmdW5jdGlvbiAoZCwgYikge1xyXG4gICAgICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICAgICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICAgICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG4gICAgfTtcclxufSkoKTtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG52YXIgbGF5b3V0XzEgPSByZXF1aXJlKFwiLi9sYXlvdXRcIik7XHJcbnZhciBMYXlvdXRBZGFwdG9yID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhMYXlvdXRBZGFwdG9yLCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gTGF5b3V0QWRhcHRvcihvcHRpb25zKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gX3N1cGVyLmNhbGwodGhpcykgfHwgdGhpcztcclxuICAgICAgICB2YXIgc2VsZiA9IF90aGlzO1xyXG4gICAgICAgIHZhciBvID0gb3B0aW9ucztcclxuICAgICAgICBpZiAoby50cmlnZ2VyKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnRyaWdnZXIgPSBvLnRyaWdnZXI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvLmtpY2spIHtcclxuICAgICAgICAgICAgX3RoaXMua2ljayA9IG8ua2ljaztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG8uZHJhZykge1xyXG4gICAgICAgICAgICBfdGhpcy5kcmFnID0gby5kcmFnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoby5vbikge1xyXG4gICAgICAgICAgICBfdGhpcy5vbiA9IG8ub247XHJcbiAgICAgICAgfVxyXG4gICAgICAgIF90aGlzLmRyYWdzdGFydCA9IF90aGlzLmRyYWdTdGFydCA9IGxheW91dF8xLkxheW91dC5kcmFnU3RhcnQ7XHJcbiAgICAgICAgX3RoaXMuZHJhZ2VuZCA9IF90aGlzLmRyYWdFbmQgPSBsYXlvdXRfMS5MYXlvdXQuZHJhZ0VuZDtcclxuICAgICAgICByZXR1cm4gX3RoaXM7XHJcbiAgICB9XHJcbiAgICBMYXlvdXRBZGFwdG9yLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24gKGUpIHsgfTtcclxuICAgIDtcclxuICAgIExheW91dEFkYXB0b3IucHJvdG90eXBlLmtpY2sgPSBmdW5jdGlvbiAoKSB7IH07XHJcbiAgICA7XHJcbiAgICBMYXlvdXRBZGFwdG9yLnByb3RvdHlwZS5kcmFnID0gZnVuY3Rpb24gKCkgeyB9O1xyXG4gICAgO1xyXG4gICAgTGF5b3V0QWRhcHRvci5wcm90b3R5cGUub24gPSBmdW5jdGlvbiAoZXZlbnRUeXBlLCBsaXN0ZW5lcikgeyByZXR1cm4gdGhpczsgfTtcclxuICAgIDtcclxuICAgIHJldHVybiBMYXlvdXRBZGFwdG9yO1xyXG59KGxheW91dF8xLkxheW91dCkpO1xyXG5leHBvcnRzLkxheW91dEFkYXB0b3IgPSBMYXlvdXRBZGFwdG9yO1xyXG5mdW5jdGlvbiBhZGFwdG9yKG9wdGlvbnMpIHtcclxuICAgIHJldHVybiBuZXcgTGF5b3V0QWRhcHRvcihvcHRpb25zKTtcclxufVxyXG5leHBvcnRzLmFkYXB0b3IgPSBhZGFwdG9yO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1hZGFwdG9yLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbnZhciBsYXlvdXRfMSA9IHJlcXVpcmUoXCIuL2xheW91dFwiKTtcclxudmFyIGdyaWRyb3V0ZXJfMSA9IHJlcXVpcmUoXCIuL2dyaWRyb3V0ZXJcIik7XHJcbmZ1bmN0aW9uIGdyaWRpZnkocGdMYXlvdXQsIG51ZGdlR2FwLCBtYXJnaW4sIGdyb3VwTWFyZ2luKSB7XHJcbiAgICBwZ0xheW91dC5jb2xhLnN0YXJ0KDAsIDAsIDAsIDEwLCBmYWxzZSk7XHJcbiAgICB2YXIgZ3JpZHJvdXRlciA9IHJvdXRlKHBnTGF5b3V0LmNvbGEubm9kZXMoKSwgcGdMYXlvdXQuY29sYS5ncm91cHMoKSwgbWFyZ2luLCBncm91cE1hcmdpbik7XHJcbiAgICByZXR1cm4gZ3JpZHJvdXRlci5yb3V0ZUVkZ2VzKHBnTGF5b3V0LnBvd2VyR3JhcGgucG93ZXJFZGdlcywgbnVkZ2VHYXAsIGZ1bmN0aW9uIChlKSB7IHJldHVybiBlLnNvdXJjZS5yb3V0ZXJOb2RlLmlkOyB9LCBmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS50YXJnZXQucm91dGVyTm9kZS5pZDsgfSk7XHJcbn1cclxuZXhwb3J0cy5ncmlkaWZ5ID0gZ3JpZGlmeTtcclxuZnVuY3Rpb24gcm91dGUobm9kZXMsIGdyb3VwcywgbWFyZ2luLCBncm91cE1hcmdpbikge1xyXG4gICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgIGQucm91dGVyTm9kZSA9IHtcclxuICAgICAgICAgICAgbmFtZTogZC5uYW1lLFxyXG4gICAgICAgICAgICBib3VuZHM6IGQuYm91bmRzLmluZmxhdGUoLW1hcmdpbilcclxuICAgICAgICB9O1xyXG4gICAgfSk7XHJcbiAgICBncm91cHMuZm9yRWFjaChmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgIGQucm91dGVyTm9kZSA9IHtcclxuICAgICAgICAgICAgYm91bmRzOiBkLmJvdW5kcy5pbmZsYXRlKC1ncm91cE1hcmdpbiksXHJcbiAgICAgICAgICAgIGNoaWxkcmVuOiAodHlwZW9mIGQuZ3JvdXBzICE9PSAndW5kZWZpbmVkJyA/IGQuZ3JvdXBzLm1hcChmdW5jdGlvbiAoYykgeyByZXR1cm4gbm9kZXMubGVuZ3RoICsgYy5pZDsgfSkgOiBbXSlcclxuICAgICAgICAgICAgICAgIC5jb25jYXQodHlwZW9mIGQubGVhdmVzICE9PSAndW5kZWZpbmVkJyA/IGQubGVhdmVzLm1hcChmdW5jdGlvbiAoYykgeyByZXR1cm4gYy5pbmRleDsgfSkgOiBbXSlcclxuICAgICAgICB9O1xyXG4gICAgfSk7XHJcbiAgICB2YXIgZ3JpZFJvdXRlck5vZGVzID0gbm9kZXMuY29uY2F0KGdyb3VwcykubWFwKGZ1bmN0aW9uIChkLCBpKSB7XHJcbiAgICAgICAgZC5yb3V0ZXJOb2RlLmlkID0gaTtcclxuICAgICAgICByZXR1cm4gZC5yb3V0ZXJOb2RlO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbmV3IGdyaWRyb3V0ZXJfMS5HcmlkUm91dGVyKGdyaWRSb3V0ZXJOb2Rlcywge1xyXG4gICAgICAgIGdldENoaWxkcmVuOiBmdW5jdGlvbiAodikgeyByZXR1cm4gdi5jaGlsZHJlbjsgfSxcclxuICAgICAgICBnZXRCb3VuZHM6IGZ1bmN0aW9uICh2KSB7IHJldHVybiB2LmJvdW5kczsgfVxyXG4gICAgfSwgbWFyZ2luIC0gZ3JvdXBNYXJnaW4pO1xyXG59XHJcbmZ1bmN0aW9uIHBvd2VyR3JhcGhHcmlkTGF5b3V0KGdyYXBoLCBzaXplLCBncm91cHBhZGRpbmcpIHtcclxuICAgIHZhciBwb3dlckdyYXBoO1xyXG4gICAgZ3JhcGgubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkgeyByZXR1cm4gdi5pbmRleCA9IGk7IH0pO1xyXG4gICAgbmV3IGxheW91dF8xLkxheW91dCgpXHJcbiAgICAgICAgLmF2b2lkT3ZlcmxhcHMoZmFsc2UpXHJcbiAgICAgICAgLm5vZGVzKGdyYXBoLm5vZGVzKVxyXG4gICAgICAgIC5saW5rcyhncmFwaC5saW5rcylcclxuICAgICAgICAucG93ZXJHcmFwaEdyb3VwcyhmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgIHBvd2VyR3JhcGggPSBkO1xyXG4gICAgICAgIHBvd2VyR3JhcGguZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHYucGFkZGluZyA9IGdyb3VwcGFkZGluZzsgfSk7XHJcbiAgICB9KTtcclxuICAgIHZhciBuID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xyXG4gICAgdmFyIGVkZ2VzID0gW107XHJcbiAgICB2YXIgdnMgPSBncmFwaC5ub2Rlcy5zbGljZSgwKTtcclxuICAgIHZzLmZvckVhY2goZnVuY3Rpb24gKHYsIGkpIHsgcmV0dXJuIHYuaW5kZXggPSBpOyB9KTtcclxuICAgIHBvd2VyR3JhcGguZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGcpIHtcclxuICAgICAgICB2YXIgc291cmNlSW5kID0gZy5pbmRleCA9IGcuaWQgKyBuO1xyXG4gICAgICAgIHZzLnB1c2goZyk7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBnLmxlYXZlcyAhPT0gJ3VuZGVmaW5lZCcpXHJcbiAgICAgICAgICAgIGcubGVhdmVzLmZvckVhY2goZnVuY3Rpb24gKHYpIHsgcmV0dXJuIGVkZ2VzLnB1c2goeyBzb3VyY2U6IHNvdXJjZUluZCwgdGFyZ2V0OiB2LmluZGV4IH0pOyB9KTtcclxuICAgICAgICBpZiAodHlwZW9mIGcuZ3JvdXBzICE9PSAndW5kZWZpbmVkJylcclxuICAgICAgICAgICAgZy5ncm91cHMuZm9yRWFjaChmdW5jdGlvbiAoZ2cpIHsgcmV0dXJuIGVkZ2VzLnB1c2goeyBzb3VyY2U6IHNvdXJjZUluZCwgdGFyZ2V0OiBnZy5pZCArIG4gfSk7IH0pO1xyXG4gICAgfSk7XHJcbiAgICBwb3dlckdyYXBoLnBvd2VyRWRnZXMuZm9yRWFjaChmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGVkZ2VzLnB1c2goeyBzb3VyY2U6IGUuc291cmNlLmluZGV4LCB0YXJnZXQ6IGUudGFyZ2V0LmluZGV4IH0pO1xyXG4gICAgfSk7XHJcbiAgICBuZXcgbGF5b3V0XzEuTGF5b3V0KClcclxuICAgICAgICAuc2l6ZShzaXplKVxyXG4gICAgICAgIC5ub2Rlcyh2cylcclxuICAgICAgICAubGlua3MoZWRnZXMpXHJcbiAgICAgICAgLmF2b2lkT3ZlcmxhcHMoZmFsc2UpXHJcbiAgICAgICAgLmxpbmtEaXN0YW5jZSgzMClcclxuICAgICAgICAuc3ltbWV0cmljRGlmZkxpbmtMZW5ndGhzKDUpXHJcbiAgICAgICAgLmNvbnZlcmdlbmNlVGhyZXNob2xkKDFlLTQpXHJcbiAgICAgICAgLnN0YXJ0KDEwMCwgMCwgMCwgMCwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBjb2xhOiBuZXcgbGF5b3V0XzEuTGF5b3V0KClcclxuICAgICAgICAgICAgLmNvbnZlcmdlbmNlVGhyZXNob2xkKDFlLTMpXHJcbiAgICAgICAgICAgIC5zaXplKHNpemUpXHJcbiAgICAgICAgICAgIC5hdm9pZE92ZXJsYXBzKHRydWUpXHJcbiAgICAgICAgICAgIC5ub2RlcyhncmFwaC5ub2RlcylcclxuICAgICAgICAgICAgLmxpbmtzKGdyYXBoLmxpbmtzKVxyXG4gICAgICAgICAgICAuZ3JvdXBDb21wYWN0bmVzcygxZS00KVxyXG4gICAgICAgICAgICAubGlua0Rpc3RhbmNlKDMwKVxyXG4gICAgICAgICAgICAuc3ltbWV0cmljRGlmZkxpbmtMZW5ndGhzKDUpXHJcbiAgICAgICAgICAgIC5wb3dlckdyYXBoR3JvdXBzKGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgICAgICAgIHBvd2VyR3JhcGggPSBkO1xyXG4gICAgICAgICAgICBwb3dlckdyYXBoLmdyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgICAgICAgICB2LnBhZGRpbmcgPSBncm91cHBhZGRpbmc7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pLnN0YXJ0KDUwLCAwLCAxMDAsIDAsIGZhbHNlKSxcclxuICAgICAgICBwb3dlckdyYXBoOiBwb3dlckdyYXBoXHJcbiAgICB9O1xyXG59XHJcbmV4cG9ydHMucG93ZXJHcmFwaEdyaWRMYXlvdXQgPSBwb3dlckdyYXBoR3JpZExheW91dDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YmF0Y2guanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIGQzdjMgPSByZXF1aXJlKFwiLi9kM3YzYWRhcHRvclwiKTtcclxudmFyIGQzdjQgPSByZXF1aXJlKFwiLi9kM3Y0YWRhcHRvclwiKTtcclxuO1xyXG5mdW5jdGlvbiBkM2FkYXB0b3IoZDNDb250ZXh0KSB7XHJcbiAgICBpZiAoIWQzQ29udGV4dCB8fCBpc0QzVjMoZDNDb250ZXh0KSkge1xyXG4gICAgICAgIHJldHVybiBuZXcgZDN2My5EM1N0eWxlTGF5b3V0QWRhcHRvcigpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyBkM3Y0LkQzU3R5bGVMYXlvdXRBZGFwdG9yKGQzQ29udGV4dCk7XHJcbn1cclxuZXhwb3J0cy5kM2FkYXB0b3IgPSBkM2FkYXB0b3I7XHJcbmZ1bmN0aW9uIGlzRDNWMyhkM0NvbnRleHQpIHtcclxuICAgIHZhciB2M2V4cCA9IC9eM1xcLi87XHJcbiAgICByZXR1cm4gZDNDb250ZXh0LnZlcnNpb24gJiYgZDNDb250ZXh0LnZlcnNpb24ubWF0Y2godjNleHApICE9PSBudWxsO1xyXG59XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWQzYWRhcHRvci5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIF9fZXh0ZW5kcyA9ICh0aGlzICYmIHRoaXMuX19leHRlbmRzKSB8fCAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoYi5oYXNPd25Qcm9wZXJ0eShwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgICAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxuICAgIH07XHJcbn0pKCk7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIGxheW91dF8xID0gcmVxdWlyZShcIi4vbGF5b3V0XCIpO1xyXG52YXIgRDNTdHlsZUxheW91dEFkYXB0b3IgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKEQzU3R5bGVMYXlvdXRBZGFwdG9yLCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gRDNTdHlsZUxheW91dEFkYXB0b3IoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gX3N1cGVyLmNhbGwodGhpcykgfHwgdGhpcztcclxuICAgICAgICBfdGhpcy5ldmVudCA9IGQzLmRpc3BhdGNoKGxheW91dF8xLkV2ZW50VHlwZVtsYXlvdXRfMS5FdmVudFR5cGUuc3RhcnRdLCBsYXlvdXRfMS5FdmVudFR5cGVbbGF5b3V0XzEuRXZlbnRUeXBlLnRpY2tdLCBsYXlvdXRfMS5FdmVudFR5cGVbbGF5b3V0XzEuRXZlbnRUeXBlLmVuZF0pO1xyXG4gICAgICAgIHZhciBkM2xheW91dCA9IF90aGlzO1xyXG4gICAgICAgIHZhciBkcmFnO1xyXG4gICAgICAgIF90aGlzLmRyYWcgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICghZHJhZykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGRyYWcgPSBkMy5iZWhhdmlvci5kcmFnKClcclxuICAgICAgICAgICAgICAgICAgICAub3JpZ2luKGxheW91dF8xLkxheW91dC5kcmFnT3JpZ2luKVxyXG4gICAgICAgICAgICAgICAgICAgIC5vbihcImRyYWdzdGFydC5kM2FkYXB0b3JcIiwgbGF5b3V0XzEuTGF5b3V0LmRyYWdTdGFydClcclxuICAgICAgICAgICAgICAgICAgICAub24oXCJkcmFnLmQzYWRhcHRvclwiLCBmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxheW91dF8xLkxheW91dC5kcmFnKGQsIGQzLmV2ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICBkM2xheW91dC5yZXN1bWUoKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgLm9uKFwiZHJhZ2VuZC5kM2FkYXB0b3JcIiwgbGF5b3V0XzEuTGF5b3V0LmRyYWdFbmQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aClcclxuICAgICAgICAgICAgICAgIHJldHVybiBkcmFnO1xyXG4gICAgICAgICAgICB0aGlzXHJcbiAgICAgICAgICAgICAgICAuY2FsbChkcmFnKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHJldHVybiBfdGhpcztcclxuICAgIH1cclxuICAgIEQzU3R5bGVMYXlvdXRBZGFwdG9yLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICB2YXIgZDNldmVudCA9IHsgdHlwZTogbGF5b3V0XzEuRXZlbnRUeXBlW2UudHlwZV0sIGFscGhhOiBlLmFscGhhLCBzdHJlc3M6IGUuc3RyZXNzIH07XHJcbiAgICAgICAgdGhpcy5ldmVudFtkM2V2ZW50LnR5cGVdKGQzZXZlbnQpO1xyXG4gICAgfTtcclxuICAgIEQzU3R5bGVMYXlvdXRBZGFwdG9yLnByb3RvdHlwZS5raWNrID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgZDMudGltZXIoZnVuY3Rpb24gKCkgeyByZXR1cm4gX3N1cGVyLnByb3RvdHlwZS50aWNrLmNhbGwoX3RoaXMpOyB9KTtcclxuICAgIH07XHJcbiAgICBEM1N0eWxlTGF5b3V0QWRhcHRvci5wcm90b3R5cGUub24gPSBmdW5jdGlvbiAoZXZlbnRUeXBlLCBsaXN0ZW5lcikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgZXZlbnRUeXBlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB0aGlzLmV2ZW50Lm9uKGV2ZW50VHlwZSwgbGlzdGVuZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5ldmVudC5vbihsYXlvdXRfMS5FdmVudFR5cGVbZXZlbnRUeXBlXSwgbGlzdGVuZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICByZXR1cm4gRDNTdHlsZUxheW91dEFkYXB0b3I7XHJcbn0obGF5b3V0XzEuTGF5b3V0KSk7XHJcbmV4cG9ydHMuRDNTdHlsZUxheW91dEFkYXB0b3IgPSBEM1N0eWxlTGF5b3V0QWRhcHRvcjtcclxuZnVuY3Rpb24gZDNhZGFwdG9yKCkge1xyXG4gICAgcmV0dXJuIG5ldyBEM1N0eWxlTGF5b3V0QWRhcHRvcigpO1xyXG59XHJcbmV4cG9ydHMuZDNhZGFwdG9yID0gZDNhZGFwdG9yO1xyXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kM3YzYWRhcHRvci5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIF9fZXh0ZW5kcyA9ICh0aGlzICYmIHRoaXMuX19leHRlbmRzKSB8fCAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoYi5oYXNPd25Qcm9wZXJ0eShwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgICAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxuICAgIH07XHJcbn0pKCk7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIGxheW91dF8xID0gcmVxdWlyZShcIi4vbGF5b3V0XCIpO1xyXG52YXIgRDNTdHlsZUxheW91dEFkYXB0b3IgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKEQzU3R5bGVMYXlvdXRBZGFwdG9yLCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gRDNTdHlsZUxheW91dEFkYXB0b3IoZDNDb250ZXh0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gX3N1cGVyLmNhbGwodGhpcykgfHwgdGhpcztcclxuICAgICAgICBfdGhpcy5kM0NvbnRleHQgPSBkM0NvbnRleHQ7XHJcbiAgICAgICAgX3RoaXMuZXZlbnQgPSBkM0NvbnRleHQuZGlzcGF0Y2gobGF5b3V0XzEuRXZlbnRUeXBlW2xheW91dF8xLkV2ZW50VHlwZS5zdGFydF0sIGxheW91dF8xLkV2ZW50VHlwZVtsYXlvdXRfMS5FdmVudFR5cGUudGlja10sIGxheW91dF8xLkV2ZW50VHlwZVtsYXlvdXRfMS5FdmVudFR5cGUuZW5kXSk7XHJcbiAgICAgICAgdmFyIGQzbGF5b3V0ID0gX3RoaXM7XHJcbiAgICAgICAgdmFyIGRyYWc7XHJcbiAgICAgICAgX3RoaXMuZHJhZyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKCFkcmFnKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZHJhZyA9IGQzQ29udGV4dC5kcmFnKClcclxuICAgICAgICAgICAgICAgICAgICAuc3ViamVjdChsYXlvdXRfMS5MYXlvdXQuZHJhZ09yaWdpbilcclxuICAgICAgICAgICAgICAgICAgICAub24oXCJzdGFydC5kM2FkYXB0b3JcIiwgbGF5b3V0XzEuTGF5b3V0LmRyYWdTdGFydClcclxuICAgICAgICAgICAgICAgICAgICAub24oXCJkcmFnLmQzYWRhcHRvclwiLCBmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxheW91dF8xLkxheW91dC5kcmFnKGQsIGQzQ29udGV4dC5ldmVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZDNsYXlvdXQucmVzdW1lKCk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgIC5vbihcImVuZC5kM2FkYXB0b3JcIiwgbGF5b3V0XzEuTGF5b3V0LmRyYWdFbmQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aClcclxuICAgICAgICAgICAgICAgIHJldHVybiBkcmFnO1xyXG4gICAgICAgICAgICBhcmd1bWVudHNbMF0uY2FsbChkcmFnKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHJldHVybiBfdGhpcztcclxuICAgIH1cclxuICAgIEQzU3R5bGVMYXlvdXRBZGFwdG9yLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICB2YXIgZDNldmVudCA9IHsgdHlwZTogbGF5b3V0XzEuRXZlbnRUeXBlW2UudHlwZV0sIGFscGhhOiBlLmFscGhhLCBzdHJlc3M6IGUuc3RyZXNzIH07XHJcbiAgICAgICAgdGhpcy5ldmVudC5jYWxsKGQzZXZlbnQudHlwZSwgZDNldmVudCk7XHJcbiAgICB9O1xyXG4gICAgRDNTdHlsZUxheW91dEFkYXB0b3IucHJvdG90eXBlLmtpY2sgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgdCA9IHRoaXMuZDNDb250ZXh0LnRpbWVyKGZ1bmN0aW9uICgpIHsgcmV0dXJuIF9zdXBlci5wcm90b3R5cGUudGljay5jYWxsKF90aGlzKSAmJiB0LnN0b3AoKTsgfSk7XHJcbiAgICB9O1xyXG4gICAgRDNTdHlsZUxheW91dEFkYXB0b3IucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2ZW50VHlwZSwgbGlzdGVuZXIpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGV2ZW50VHlwZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgdGhpcy5ldmVudC5vbihldmVudFR5cGUsIGxpc3RlbmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZlbnQub24obGF5b3V0XzEuRXZlbnRUeXBlW2V2ZW50VHlwZV0sIGxpc3RlbmVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEQzU3R5bGVMYXlvdXRBZGFwdG9yO1xyXG59KGxheW91dF8xLkxheW91dCkpO1xyXG5leHBvcnRzLkQzU3R5bGVMYXlvdXRBZGFwdG9yID0gRDNTdHlsZUxheW91dEFkYXB0b3I7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWQzdjRhZGFwdG9yLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbnZhciBMb2NrcyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBMb2NrcygpIHtcclxuICAgICAgICB0aGlzLmxvY2tzID0ge307XHJcbiAgICB9XHJcbiAgICBMb2Nrcy5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGlkLCB4KSB7XHJcbiAgICAgICAgdGhpcy5sb2Nrc1tpZF0gPSB4O1xyXG4gICAgfTtcclxuICAgIExvY2tzLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmxvY2tzID0ge307XHJcbiAgICB9O1xyXG4gICAgTG9ja3MucHJvdG90eXBlLmlzRW1wdHkgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgZm9yICh2YXIgbCBpbiB0aGlzLmxvY2tzKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG4gICAgTG9ja3MucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24gKGYpIHtcclxuICAgICAgICBmb3IgKHZhciBsIGluIHRoaXMubG9ja3MpIHtcclxuICAgICAgICAgICAgZihOdW1iZXIobCksIHRoaXMubG9ja3NbbF0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICByZXR1cm4gTG9ja3M7XHJcbn0oKSk7XHJcbmV4cG9ydHMuTG9ja3MgPSBMb2NrcztcclxudmFyIERlc2NlbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gRGVzY2VudCh4LCBELCBHKSB7XHJcbiAgICAgICAgaWYgKEcgPT09IHZvaWQgMCkgeyBHID0gbnVsbDsgfVxyXG4gICAgICAgIHRoaXMuRCA9IEQ7XHJcbiAgICAgICAgdGhpcy5HID0gRztcclxuICAgICAgICB0aGlzLnRocmVzaG9sZCA9IDAuMDAwMTtcclxuICAgICAgICB0aGlzLm51bUdyaWRTbmFwTm9kZXMgPSAwO1xyXG4gICAgICAgIHRoaXMuc25hcEdyaWRTaXplID0gMTAwO1xyXG4gICAgICAgIHRoaXMuc25hcFN0cmVuZ3RoID0gMTAwMDtcclxuICAgICAgICB0aGlzLnNjYWxlU25hcEJ5TWF4SCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMucmFuZG9tID0gbmV3IFBzZXVkb1JhbmRvbSgpO1xyXG4gICAgICAgIHRoaXMucHJvamVjdCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy54ID0geDtcclxuICAgICAgICB0aGlzLmsgPSB4Lmxlbmd0aDtcclxuICAgICAgICB2YXIgbiA9IHRoaXMubiA9IHhbMF0ubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMuSCA9IG5ldyBBcnJheSh0aGlzLmspO1xyXG4gICAgICAgIHRoaXMuZyA9IG5ldyBBcnJheSh0aGlzLmspO1xyXG4gICAgICAgIHRoaXMuSGQgPSBuZXcgQXJyYXkodGhpcy5rKTtcclxuICAgICAgICB0aGlzLmEgPSBuZXcgQXJyYXkodGhpcy5rKTtcclxuICAgICAgICB0aGlzLmIgPSBuZXcgQXJyYXkodGhpcy5rKTtcclxuICAgICAgICB0aGlzLmMgPSBuZXcgQXJyYXkodGhpcy5rKTtcclxuICAgICAgICB0aGlzLmQgPSBuZXcgQXJyYXkodGhpcy5rKTtcclxuICAgICAgICB0aGlzLmUgPSBuZXcgQXJyYXkodGhpcy5rKTtcclxuICAgICAgICB0aGlzLmlhID0gbmV3IEFycmF5KHRoaXMuayk7XHJcbiAgICAgICAgdGhpcy5pYiA9IG5ldyBBcnJheSh0aGlzLmspO1xyXG4gICAgICAgIHRoaXMueHRtcCA9IG5ldyBBcnJheSh0aGlzLmspO1xyXG4gICAgICAgIHRoaXMubG9ja3MgPSBuZXcgTG9ja3MoKTtcclxuICAgICAgICB0aGlzLm1pbkQgPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgICAgIHZhciBpID0gbiwgajtcclxuICAgICAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgICAgICAgIGogPSBuO1xyXG4gICAgICAgICAgICB3aGlsZSAoLS1qID4gaSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGQgPSBEW2ldW2pdO1xyXG4gICAgICAgICAgICAgICAgaWYgKGQgPiAwICYmIGQgPCB0aGlzLm1pbkQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1pbkQgPSBkO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLm1pbkQgPT09IE51bWJlci5NQVhfVkFMVUUpXHJcbiAgICAgICAgICAgIHRoaXMubWluRCA9IDE7XHJcbiAgICAgICAgaSA9IHRoaXMuaztcclxuICAgICAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZ1tpXSA9IG5ldyBBcnJheShuKTtcclxuICAgICAgICAgICAgdGhpcy5IW2ldID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICBqID0gbjtcclxuICAgICAgICAgICAgd2hpbGUgKGotLSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5IW2ldW2pdID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuSGRbaV0gPSBuZXcgQXJyYXkobik7XHJcbiAgICAgICAgICAgIHRoaXMuYVtpXSA9IG5ldyBBcnJheShuKTtcclxuICAgICAgICAgICAgdGhpcy5iW2ldID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICB0aGlzLmNbaV0gPSBuZXcgQXJyYXkobik7XHJcbiAgICAgICAgICAgIHRoaXMuZFtpXSA9IG5ldyBBcnJheShuKTtcclxuICAgICAgICAgICAgdGhpcy5lW2ldID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICB0aGlzLmlhW2ldID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICB0aGlzLmliW2ldID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICB0aGlzLnh0bXBbaV0gPSBuZXcgQXJyYXkobik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgRGVzY2VudC5jcmVhdGVTcXVhcmVNYXRyaXggPSBmdW5jdGlvbiAobiwgZikge1xyXG4gICAgICAgIHZhciBNID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcbiAgICAgICAgICAgIE1baV0gPSBuZXcgQXJyYXkobik7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbjsgKytqKSB7XHJcbiAgICAgICAgICAgICAgICBNW2ldW2pdID0gZihpLCBqKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gTTtcclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS5vZmZzZXREaXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgdSA9IG5ldyBBcnJheSh0aGlzLmspO1xyXG4gICAgICAgIHZhciBsID0gMDtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuazsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciB4ID0gdVtpXSA9IHRoaXMucmFuZG9tLmdldE5leHRCZXR3ZWVuKDAuMDEsIDEpIC0gMC41O1xyXG4gICAgICAgICAgICBsICs9IHggKiB4O1xyXG4gICAgICAgIH1cclxuICAgICAgICBsID0gTWF0aC5zcXJ0KGwpO1xyXG4gICAgICAgIHJldHVybiB1Lm1hcChmdW5jdGlvbiAoeCkgeyByZXR1cm4geCAqPSBfdGhpcy5taW5EIC8gbDsgfSk7XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5wcm90b3R5cGUuY29tcHV0ZURlcml2YXRpdmVzID0gZnVuY3Rpb24gKHgpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHZhciBuID0gdGhpcy5uO1xyXG4gICAgICAgIGlmIChuIDwgMSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIHZhciBpO1xyXG4gICAgICAgIHZhciBkID0gbmV3IEFycmF5KHRoaXMuayk7XHJcbiAgICAgICAgdmFyIGQyID0gbmV3IEFycmF5KHRoaXMuayk7XHJcbiAgICAgICAgdmFyIEh1dSA9IG5ldyBBcnJheSh0aGlzLmspO1xyXG4gICAgICAgIHZhciBtYXhIID0gMDtcclxuICAgICAgICBmb3IgKHZhciB1ID0gMDsgdSA8IG47ICsrdSkge1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpXHJcbiAgICAgICAgICAgICAgICBIdXVbaV0gPSB0aGlzLmdbaV1bdV0gPSAwO1xyXG4gICAgICAgICAgICBmb3IgKHZhciB2ID0gMDsgdiA8IG47ICsrdikge1xyXG4gICAgICAgICAgICAgICAgaWYgKHUgPT09IHYpXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB2YXIgbWF4RGlzcGxhY2VzID0gbjtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChtYXhEaXNwbGFjZXMtLSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBzZDIgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLms7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZHggPSBkW2ldID0geFtpXVt1XSAtIHhbaV1bdl07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNkMiArPSBkMltpXSA9IGR4ICogZHg7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZDIgPiAxZS05KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmQgPSB0aGlzLm9mZnNldERpcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLms7ICsraSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgeFtpXVt2XSArPSByZFtpXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBsID0gTWF0aC5zcXJ0KHNkMik7XHJcbiAgICAgICAgICAgICAgICB2YXIgRCA9IHRoaXMuRFt1XVt2XTtcclxuICAgICAgICAgICAgICAgIHZhciB3ZWlnaHQgPSB0aGlzLkcgIT0gbnVsbCA/IHRoaXMuR1t1XVt2XSA6IDE7XHJcbiAgICAgICAgICAgICAgICBpZiAod2VpZ2h0ID4gMSAmJiBsID4gRCB8fCAhaXNGaW5pdGUoRCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuSFtpXVt1XVt2XSA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAod2VpZ2h0ID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdlaWdodCA9IDE7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB2YXIgRDIgPSBEICogRDtcclxuICAgICAgICAgICAgICAgIHZhciBncyA9IDIgKiB3ZWlnaHQgKiAobCAtIEQpIC8gKEQyICogbCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgbDMgPSBsICogbCAqIGw7XHJcbiAgICAgICAgICAgICAgICB2YXIgaHMgPSAyICogLXdlaWdodCAvIChEMiAqIGwzKTtcclxuICAgICAgICAgICAgICAgIGlmICghaXNGaW5pdGUoZ3MpKVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGdzKTtcclxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLms7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ1tpXVt1XSArPSBkW2ldICogZ3M7XHJcbiAgICAgICAgICAgICAgICAgICAgSHV1W2ldIC09IHRoaXMuSFtpXVt1XVt2XSA9IGhzICogKGwzICsgRCAqIChkMltpXSAtIHNkMikgKyBsICogc2QyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpXHJcbiAgICAgICAgICAgICAgICBtYXhIID0gTWF0aC5tYXgobWF4SCwgdGhpcy5IW2ldW3VdW3VdID0gSHV1W2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHIgPSB0aGlzLnNuYXBHcmlkU2l6ZSAvIDI7XHJcbiAgICAgICAgdmFyIGcgPSB0aGlzLnNuYXBHcmlkU2l6ZTtcclxuICAgICAgICB2YXIgdyA9IHRoaXMuc25hcFN0cmVuZ3RoO1xyXG4gICAgICAgIHZhciBrID0gdyAvIChyICogcik7XHJcbiAgICAgICAgdmFyIG51bU5vZGVzID0gdGhpcy5udW1HcmlkU25hcE5vZGVzO1xyXG4gICAgICAgIGZvciAodmFyIHUgPSAwOyB1IDwgbnVtTm9kZXM7ICsrdSkge1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIHZhciB4aXUgPSB0aGlzLnhbaV1bdV07XHJcbiAgICAgICAgICAgICAgICB2YXIgbSA9IHhpdSAvIGc7XHJcbiAgICAgICAgICAgICAgICB2YXIgZiA9IG0gJSAxO1xyXG4gICAgICAgICAgICAgICAgdmFyIHEgPSBtIC0gZjtcclxuICAgICAgICAgICAgICAgIHZhciBhID0gTWF0aC5hYnMoZik7XHJcbiAgICAgICAgICAgICAgICB2YXIgZHggPSAoYSA8PSAwLjUpID8geGl1IC0gcSAqIGcgOlxyXG4gICAgICAgICAgICAgICAgICAgICh4aXUgPiAwKSA/IHhpdSAtIChxICsgMSkgKiBnIDogeGl1IC0gKHEgLSAxKSAqIGc7XHJcbiAgICAgICAgICAgICAgICBpZiAoLXIgPCBkeCAmJiBkeCA8PSByKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NhbGVTbmFwQnlNYXhIKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ1tpXVt1XSArPSBtYXhIICogayAqIGR4O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLkhbaV1bdV1bdV0gKz0gbWF4SCAqIGs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdbaV1bdV0gKz0gayAqIGR4O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLkhbaV1bdV1bdV0gKz0gaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLmxvY2tzLmlzRW1wdHkoKSkge1xyXG4gICAgICAgICAgICB0aGlzLmxvY2tzLmFwcGx5KGZ1bmN0aW9uICh1LCBwKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgX3RoaXMuazsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuSFtpXVt1XVt1XSArPSBtYXhIO1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmdbaV1bdV0gLT0gbWF4SCAqIChwW2ldIC0geFtpXVt1XSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBEZXNjZW50LmRvdFByb2QgPSBmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgIHZhciB4ID0gMCwgaSA9IGEubGVuZ3RoO1xyXG4gICAgICAgIHdoaWxlIChpLS0pXHJcbiAgICAgICAgICAgIHggKz0gYVtpXSAqIGJbaV07XHJcbiAgICAgICAgcmV0dXJuIHg7XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5yaWdodE11bHRpcGx5ID0gZnVuY3Rpb24gKG0sIHYsIHIpIHtcclxuICAgICAgICB2YXIgaSA9IG0ubGVuZ3RoO1xyXG4gICAgICAgIHdoaWxlIChpLS0pXHJcbiAgICAgICAgICAgIHJbaV0gPSBEZXNjZW50LmRvdFByb2QobVtpXSwgdik7XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5wcm90b3R5cGUuY29tcHV0ZVN0ZXBTaXplID0gZnVuY3Rpb24gKGQpIHtcclxuICAgICAgICB2YXIgbnVtZXJhdG9yID0gMCwgZGVub21pbmF0b3IgPSAwO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpIHtcclxuICAgICAgICAgICAgbnVtZXJhdG9yICs9IERlc2NlbnQuZG90UHJvZCh0aGlzLmdbaV0sIGRbaV0pO1xyXG4gICAgICAgICAgICBEZXNjZW50LnJpZ2h0TXVsdGlwbHkodGhpcy5IW2ldLCBkW2ldLCB0aGlzLkhkW2ldKTtcclxuICAgICAgICAgICAgZGVub21pbmF0b3IgKz0gRGVzY2VudC5kb3RQcm9kKGRbaV0sIHRoaXMuSGRbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGVub21pbmF0b3IgPT09IDAgfHwgIWlzRmluaXRlKGRlbm9taW5hdG9yKSlcclxuICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgcmV0dXJuIDEgKiBudW1lcmF0b3IgLyBkZW5vbWluYXRvcjtcclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS5yZWR1Y2VTdHJlc3MgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5jb21wdXRlRGVyaXZhdGl2ZXModGhpcy54KTtcclxuICAgICAgICB2YXIgYWxwaGEgPSB0aGlzLmNvbXB1dGVTdGVwU2l6ZSh0aGlzLmcpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpIHtcclxuICAgICAgICAgICAgdGhpcy50YWtlRGVzY2VudFN0ZXAodGhpcy54W2ldLCB0aGlzLmdbaV0sIGFscGhhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY29tcHV0ZVN0cmVzcygpO1xyXG4gICAgfTtcclxuICAgIERlc2NlbnQuY29weSA9IGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgdmFyIG0gPSBhLmxlbmd0aCwgbiA9IGJbMF0ubGVuZ3RoO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbTsgKytpKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbjsgKytqKSB7XHJcbiAgICAgICAgICAgICAgICBiW2ldW2pdID0gYVtpXVtqXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS5zdGVwQW5kUHJvamVjdCA9IGZ1bmN0aW9uICh4MCwgciwgZCwgc3RlcFNpemUpIHtcclxuICAgICAgICBEZXNjZW50LmNvcHkoeDAsIHIpO1xyXG4gICAgICAgIHRoaXMudGFrZURlc2NlbnRTdGVwKHJbMF0sIGRbMF0sIHN0ZXBTaXplKTtcclxuICAgICAgICBpZiAodGhpcy5wcm9qZWN0KVxyXG4gICAgICAgICAgICB0aGlzLnByb2plY3RbMF0oeDBbMF0sIHgwWzFdLCByWzBdKTtcclxuICAgICAgICB0aGlzLnRha2VEZXNjZW50U3RlcChyWzFdLCBkWzFdLCBzdGVwU2l6ZSk7XHJcbiAgICAgICAgaWYgKHRoaXMucHJvamVjdClcclxuICAgICAgICAgICAgdGhpcy5wcm9qZWN0WzFdKHJbMF0sIHgwWzFdLCByWzFdKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMjsgaSA8IHRoaXMuazsgaSsrKVxyXG4gICAgICAgICAgICB0aGlzLnRha2VEZXNjZW50U3RlcChyW2ldLCBkW2ldLCBzdGVwU2l6ZSk7XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5tQXBwbHkgPSBmdW5jdGlvbiAobSwgbiwgZikge1xyXG4gICAgICAgIHZhciBpID0gbTtcclxuICAgICAgICB3aGlsZSAoaS0tID4gMCkge1xyXG4gICAgICAgICAgICB2YXIgaiA9IG47XHJcbiAgICAgICAgICAgIHdoaWxlIChqLS0gPiAwKVxyXG4gICAgICAgICAgICAgICAgZihpLCBqKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5wcm90b3R5cGUubWF0cml4QXBwbHkgPSBmdW5jdGlvbiAoZikge1xyXG4gICAgICAgIERlc2NlbnQubUFwcGx5KHRoaXMuaywgdGhpcy5uLCBmKTtcclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS5jb21wdXRlTmV4dFBvc2l0aW9uID0gZnVuY3Rpb24gKHgwLCByKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB0aGlzLmNvbXB1dGVEZXJpdmF0aXZlcyh4MCk7XHJcbiAgICAgICAgdmFyIGFscGhhID0gdGhpcy5jb21wdXRlU3RlcFNpemUodGhpcy5nKTtcclxuICAgICAgICB0aGlzLnN0ZXBBbmRQcm9qZWN0KHgwLCByLCB0aGlzLmcsIGFscGhhKTtcclxuICAgICAgICBpZiAodGhpcy5wcm9qZWN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMubWF0cml4QXBwbHkoZnVuY3Rpb24gKGksIGopIHsgcmV0dXJuIF90aGlzLmVbaV1bal0gPSB4MFtpXVtqXSAtIHJbaV1bal07IH0pO1xyXG4gICAgICAgICAgICB2YXIgYmV0YSA9IHRoaXMuY29tcHV0ZVN0ZXBTaXplKHRoaXMuZSk7XHJcbiAgICAgICAgICAgIGJldGEgPSBNYXRoLm1heCgwLjIsIE1hdGgubWluKGJldGEsIDEpKTtcclxuICAgICAgICAgICAgdGhpcy5zdGVwQW5kUHJvamVjdCh4MCwgciwgdGhpcy5lLCBiZXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKGl0ZXJhdGlvbnMpIHtcclxuICAgICAgICB2YXIgc3RyZXNzID0gTnVtYmVyLk1BWF9WQUxVRSwgY29udmVyZ2VkID0gZmFsc2U7XHJcbiAgICAgICAgd2hpbGUgKCFjb252ZXJnZWQgJiYgaXRlcmF0aW9ucy0tID4gMCkge1xyXG4gICAgICAgICAgICB2YXIgcyA9IHRoaXMucnVuZ2VLdXR0YSgpO1xyXG4gICAgICAgICAgICBjb252ZXJnZWQgPSBNYXRoLmFicyhzdHJlc3MgLyBzIC0gMSkgPCB0aGlzLnRocmVzaG9sZDtcclxuICAgICAgICAgICAgc3RyZXNzID0gcztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHN0cmVzcztcclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS5ydW5nZUt1dHRhID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdGhpcy5jb21wdXRlTmV4dFBvc2l0aW9uKHRoaXMueCwgdGhpcy5hKTtcclxuICAgICAgICBEZXNjZW50Lm1pZCh0aGlzLngsIHRoaXMuYSwgdGhpcy5pYSk7XHJcbiAgICAgICAgdGhpcy5jb21wdXRlTmV4dFBvc2l0aW9uKHRoaXMuaWEsIHRoaXMuYik7XHJcbiAgICAgICAgRGVzY2VudC5taWQodGhpcy54LCB0aGlzLmIsIHRoaXMuaWIpO1xyXG4gICAgICAgIHRoaXMuY29tcHV0ZU5leHRQb3NpdGlvbih0aGlzLmliLCB0aGlzLmMpO1xyXG4gICAgICAgIHRoaXMuY29tcHV0ZU5leHRQb3NpdGlvbih0aGlzLmMsIHRoaXMuZCk7XHJcbiAgICAgICAgdmFyIGRpc3AgPSAwO1xyXG4gICAgICAgIHRoaXMubWF0cml4QXBwbHkoZnVuY3Rpb24gKGksIGopIHtcclxuICAgICAgICAgICAgdmFyIHggPSAoX3RoaXMuYVtpXVtqXSArIDIuMCAqIF90aGlzLmJbaV1bal0gKyAyLjAgKiBfdGhpcy5jW2ldW2pdICsgX3RoaXMuZFtpXVtqXSkgLyA2LjAsIGQgPSBfdGhpcy54W2ldW2pdIC0geDtcclxuICAgICAgICAgICAgZGlzcCArPSBkICogZDtcclxuICAgICAgICAgICAgX3RoaXMueFtpXVtqXSA9IHg7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIGRpc3A7XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC5taWQgPSBmdW5jdGlvbiAoYSwgYiwgbSkge1xyXG4gICAgICAgIERlc2NlbnQubUFwcGx5KGEubGVuZ3RoLCBhWzBdLmxlbmd0aCwgZnVuY3Rpb24gKGksIGopIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1baV1bal0gPSBhW2ldW2pdICsgKGJbaV1bal0gLSBhW2ldW2pdKSAvIDIuMDtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS50YWtlRGVzY2VudFN0ZXAgPSBmdW5jdGlvbiAoeCwgZCwgc3RlcFNpemUpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubjsgKytpKSB7XHJcbiAgICAgICAgICAgIHhbaV0gPSB4W2ldIC0gc3RlcFNpemUgKiBkW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBEZXNjZW50LnByb3RvdHlwZS5jb21wdXRlU3RyZXNzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBzdHJlc3MgPSAwO1xyXG4gICAgICAgIGZvciAodmFyIHUgPSAwLCBuTWludXMxID0gdGhpcy5uIC0gMTsgdSA8IG5NaW51czE7ICsrdSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciB2ID0gdSArIDEsIG4gPSB0aGlzLm47IHYgPCBuOyArK3YpIHtcclxuICAgICAgICAgICAgICAgIHZhciBsID0gMDtcclxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5rOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZHggPSB0aGlzLnhbaV1bdV0gLSB0aGlzLnhbaV1bdl07XHJcbiAgICAgICAgICAgICAgICAgICAgbCArPSBkeCAqIGR4O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbCA9IE1hdGguc3FydChsKTtcclxuICAgICAgICAgICAgICAgIHZhciBkID0gdGhpcy5EW3VdW3ZdO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShkKSlcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIHZhciBybCA9IGQgLSBsO1xyXG4gICAgICAgICAgICAgICAgdmFyIGQyID0gZCAqIGQ7XHJcbiAgICAgICAgICAgICAgICBzdHJlc3MgKz0gcmwgKiBybCAvIGQyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdHJlc3M7XHJcbiAgICB9O1xyXG4gICAgRGVzY2VudC56ZXJvRGlzdGFuY2UgPSAxZS0xMDtcclxuICAgIHJldHVybiBEZXNjZW50O1xyXG59KCkpO1xyXG5leHBvcnRzLkRlc2NlbnQgPSBEZXNjZW50O1xyXG52YXIgUHNldWRvUmFuZG9tID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIFBzZXVkb1JhbmRvbShzZWVkKSB7XHJcbiAgICAgICAgaWYgKHNlZWQgPT09IHZvaWQgMCkgeyBzZWVkID0gMTsgfVxyXG4gICAgICAgIHRoaXMuc2VlZCA9IHNlZWQ7XHJcbiAgICAgICAgdGhpcy5hID0gMjE0MDEzO1xyXG4gICAgICAgIHRoaXMuYyA9IDI1MzEwMTE7XHJcbiAgICAgICAgdGhpcy5tID0gMjE0NzQ4MzY0ODtcclxuICAgICAgICB0aGlzLnJhbmdlID0gMzI3Njc7XHJcbiAgICB9XHJcbiAgICBQc2V1ZG9SYW5kb20ucHJvdG90eXBlLmdldE5leHQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zZWVkID0gKHRoaXMuc2VlZCAqIHRoaXMuYSArIHRoaXMuYykgJSB0aGlzLm07XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLnNlZWQgPj4gMTYpIC8gdGhpcy5yYW5nZTtcclxuICAgIH07XHJcbiAgICBQc2V1ZG9SYW5kb20ucHJvdG90eXBlLmdldE5leHRCZXR3ZWVuID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgcmV0dXJuIG1pbiArIHRoaXMuZ2V0TmV4dCgpICogKG1heCAtIG1pbik7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFBzZXVkb1JhbmRvbTtcclxufSgpKTtcclxuZXhwb3J0cy5Qc2V1ZG9SYW5kb20gPSBQc2V1ZG9SYW5kb207XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRlc2NlbnQuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKGIuaGFzT3duUHJvcGVydHkocCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChkLCBiKSB7XHJcbiAgICAgICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgICAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgICAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbiAgICB9O1xyXG59KSgpO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbnZhciByZWN0YW5nbGVfMSA9IHJlcXVpcmUoXCIuL3JlY3RhbmdsZVwiKTtcclxudmFyIFBvaW50ID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIFBvaW50KCkge1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFBvaW50O1xyXG59KCkpO1xyXG5leHBvcnRzLlBvaW50ID0gUG9pbnQ7XHJcbnZhciBMaW5lU2VnbWVudCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBMaW5lU2VnbWVudCh4MSwgeTEsIHgyLCB5Mikge1xyXG4gICAgICAgIHRoaXMueDEgPSB4MTtcclxuICAgICAgICB0aGlzLnkxID0geTE7XHJcbiAgICAgICAgdGhpcy54MiA9IHgyO1xyXG4gICAgICAgIHRoaXMueTIgPSB5MjtcclxuICAgIH1cclxuICAgIHJldHVybiBMaW5lU2VnbWVudDtcclxufSgpKTtcclxuZXhwb3J0cy5MaW5lU2VnbWVudCA9IExpbmVTZWdtZW50O1xyXG52YXIgUG9seVBvaW50ID0gKGZ1bmN0aW9uIChfc3VwZXIpIHtcclxuICAgIF9fZXh0ZW5kcyhQb2x5UG9pbnQsIF9zdXBlcik7XHJcbiAgICBmdW5jdGlvbiBQb2x5UG9pbnQoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9zdXBlciAhPT0gbnVsbCAmJiBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKSB8fCB0aGlzO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFBvbHlQb2ludDtcclxufShQb2ludCkpO1xyXG5leHBvcnRzLlBvbHlQb2ludCA9IFBvbHlQb2ludDtcclxuZnVuY3Rpb24gaXNMZWZ0KFAwLCBQMSwgUDIpIHtcclxuICAgIHJldHVybiAoUDEueCAtIFAwLngpICogKFAyLnkgLSBQMC55KSAtIChQMi54IC0gUDAueCkgKiAoUDEueSAtIFAwLnkpO1xyXG59XHJcbmV4cG9ydHMuaXNMZWZ0ID0gaXNMZWZ0O1xyXG5mdW5jdGlvbiBhYm92ZShwLCB2aSwgdmopIHtcclxuICAgIHJldHVybiBpc0xlZnQocCwgdmksIHZqKSA+IDA7XHJcbn1cclxuZnVuY3Rpb24gYmVsb3cocCwgdmksIHZqKSB7XHJcbiAgICByZXR1cm4gaXNMZWZ0KHAsIHZpLCB2aikgPCAwO1xyXG59XHJcbmZ1bmN0aW9uIENvbnZleEh1bGwoUykge1xyXG4gICAgdmFyIFAgPSBTLnNsaWNlKDApLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGEueCAhPT0gYi54ID8gYi54IC0gYS54IDogYi55IC0gYS55OyB9KTtcclxuICAgIHZhciBuID0gUy5sZW5ndGgsIGk7XHJcbiAgICB2YXIgbWlubWluID0gMDtcclxuICAgIHZhciB4bWluID0gUFswXS54O1xyXG4gICAgZm9yIChpID0gMTsgaSA8IG47ICsraSkge1xyXG4gICAgICAgIGlmIChQW2ldLnggIT09IHhtaW4pXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgdmFyIG1pbm1heCA9IGkgLSAxO1xyXG4gICAgdmFyIEggPSBbXTtcclxuICAgIEgucHVzaChQW21pbm1pbl0pO1xyXG4gICAgaWYgKG1pbm1heCA9PT0gbiAtIDEpIHtcclxuICAgICAgICBpZiAoUFttaW5tYXhdLnkgIT09IFBbbWlubWluXS55KVxyXG4gICAgICAgICAgICBILnB1c2goUFttaW5tYXhdKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHZhciBtYXhtaW4sIG1heG1heCA9IG4gLSAxO1xyXG4gICAgICAgIHZhciB4bWF4ID0gUFtuIC0gMV0ueDtcclxuICAgICAgICBmb3IgKGkgPSBuIC0gMjsgaSA+PSAwOyBpLS0pXHJcbiAgICAgICAgICAgIGlmIChQW2ldLnggIT09IHhtYXgpXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICBtYXhtaW4gPSBpICsgMTtcclxuICAgICAgICBpID0gbWlubWF4O1xyXG4gICAgICAgIHdoaWxlICgrK2kgPD0gbWF4bWluKSB7XHJcbiAgICAgICAgICAgIGlmIChpc0xlZnQoUFttaW5taW5dLCBQW21heG1pbl0sIFBbaV0pID49IDAgJiYgaSA8IG1heG1pbilcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB3aGlsZSAoSC5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNMZWZ0KEhbSC5sZW5ndGggLSAyXSwgSFtILmxlbmd0aCAtIDFdLCBQW2ldKSA+IDApXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgSC5sZW5ndGggLT0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaSAhPSBtaW5taW4pXHJcbiAgICAgICAgICAgICAgICBILnB1c2goUFtpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChtYXhtYXggIT0gbWF4bWluKVxyXG4gICAgICAgICAgICBILnB1c2goUFttYXhtYXhdKTtcclxuICAgICAgICB2YXIgYm90ID0gSC5sZW5ndGg7XHJcbiAgICAgICAgaSA9IG1heG1pbjtcclxuICAgICAgICB3aGlsZSAoLS1pID49IG1pbm1heCkge1xyXG4gICAgICAgICAgICBpZiAoaXNMZWZ0KFBbbWF4bWF4XSwgUFttaW5tYXhdLCBQW2ldKSA+PSAwICYmIGkgPiBtaW5tYXgpXHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgd2hpbGUgKEgubGVuZ3RoID4gYm90KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNMZWZ0KEhbSC5sZW5ndGggLSAyXSwgSFtILmxlbmd0aCAtIDFdLCBQW2ldKSA+IDApXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgSC5sZW5ndGggLT0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaSAhPSBtaW5taW4pXHJcbiAgICAgICAgICAgICAgICBILnB1c2goUFtpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIEg7XHJcbn1cclxuZXhwb3J0cy5Db252ZXhIdWxsID0gQ29udmV4SHVsbDtcclxuZnVuY3Rpb24gY2xvY2t3aXNlUmFkaWFsU3dlZXAocCwgUCwgZikge1xyXG4gICAgUC5zbGljZSgwKS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBNYXRoLmF0YW4yKGEueSAtIHAueSwgYS54IC0gcC54KSAtIE1hdGguYXRhbjIoYi55IC0gcC55LCBiLnggLSBwLngpOyB9KS5mb3JFYWNoKGYpO1xyXG59XHJcbmV4cG9ydHMuY2xvY2t3aXNlUmFkaWFsU3dlZXAgPSBjbG9ja3dpc2VSYWRpYWxTd2VlcDtcclxuZnVuY3Rpb24gbmV4dFBvbHlQb2ludChwLCBwcykge1xyXG4gICAgaWYgKHAucG9seUluZGV4ID09PSBwcy5sZW5ndGggLSAxKVxyXG4gICAgICAgIHJldHVybiBwc1swXTtcclxuICAgIHJldHVybiBwc1twLnBvbHlJbmRleCArIDFdO1xyXG59XHJcbmZ1bmN0aW9uIHByZXZQb2x5UG9pbnQocCwgcHMpIHtcclxuICAgIGlmIChwLnBvbHlJbmRleCA9PT0gMClcclxuICAgICAgICByZXR1cm4gcHNbcHMubGVuZ3RoIC0gMV07XHJcbiAgICByZXR1cm4gcHNbcC5wb2x5SW5kZXggLSAxXTtcclxufVxyXG5mdW5jdGlvbiB0YW5nZW50X1BvaW50UG9seUMoUCwgVikge1xyXG4gICAgdmFyIFZjbG9zZWQgPSBWLnNsaWNlKDApO1xyXG4gICAgVmNsb3NlZC5wdXNoKFZbMF0pO1xyXG4gICAgcmV0dXJuIHsgcnRhbjogUnRhbmdlbnRfUG9pbnRQb2x5QyhQLCBWY2xvc2VkKSwgbHRhbjogTHRhbmdlbnRfUG9pbnRQb2x5QyhQLCBWY2xvc2VkKSB9O1xyXG59XHJcbmZ1bmN0aW9uIFJ0YW5nZW50X1BvaW50UG9seUMoUCwgVikge1xyXG4gICAgdmFyIG4gPSBWLmxlbmd0aCAtIDE7XHJcbiAgICB2YXIgYSwgYiwgYztcclxuICAgIHZhciB1cEEsIGRuQztcclxuICAgIGlmIChiZWxvdyhQLCBWWzFdLCBWWzBdKSAmJiAhYWJvdmUoUCwgVltuIC0gMV0sIFZbMF0pKVxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgZm9yIChhID0gMCwgYiA9IG47Oykge1xyXG4gICAgICAgIGlmIChiIC0gYSA9PT0gMSlcclxuICAgICAgICAgICAgaWYgKGFib3ZlKFAsIFZbYV0sIFZbYl0pKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGE7XHJcbiAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgIHJldHVybiBiO1xyXG4gICAgICAgIGMgPSBNYXRoLmZsb29yKChhICsgYikgLyAyKTtcclxuICAgICAgICBkbkMgPSBiZWxvdyhQLCBWW2MgKyAxXSwgVltjXSk7XHJcbiAgICAgICAgaWYgKGRuQyAmJiAhYWJvdmUoUCwgVltjIC0gMV0sIFZbY10pKVxyXG4gICAgICAgICAgICByZXR1cm4gYztcclxuICAgICAgICB1cEEgPSBhYm92ZShQLCBWW2EgKyAxXSwgVlthXSk7XHJcbiAgICAgICAgaWYgKHVwQSkge1xyXG4gICAgICAgICAgICBpZiAoZG5DKVxyXG4gICAgICAgICAgICAgICAgYiA9IGM7XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKGFib3ZlKFAsIFZbYV0sIFZbY10pKVxyXG4gICAgICAgICAgICAgICAgICAgIGIgPSBjO1xyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgIGEgPSBjO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAoIWRuQylcclxuICAgICAgICAgICAgICAgIGEgPSBjO1xyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmIChiZWxvdyhQLCBWW2FdLCBWW2NdKSlcclxuICAgICAgICAgICAgICAgICAgICBiID0gYztcclxuICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICBhID0gYztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiBMdGFuZ2VudF9Qb2ludFBvbHlDKFAsIFYpIHtcclxuICAgIHZhciBuID0gVi5sZW5ndGggLSAxO1xyXG4gICAgdmFyIGEsIGIsIGM7XHJcbiAgICB2YXIgZG5BLCBkbkM7XHJcbiAgICBpZiAoYWJvdmUoUCwgVltuIC0gMV0sIFZbMF0pICYmICFiZWxvdyhQLCBWWzFdLCBWWzBdKSlcclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIGZvciAoYSA9IDAsIGIgPSBuOzspIHtcclxuICAgICAgICBpZiAoYiAtIGEgPT09IDEpXHJcbiAgICAgICAgICAgIGlmIChiZWxvdyhQLCBWW2FdLCBWW2JdKSlcclxuICAgICAgICAgICAgICAgIHJldHVybiBhO1xyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYjtcclxuICAgICAgICBjID0gTWF0aC5mbG9vcigoYSArIGIpIC8gMik7XHJcbiAgICAgICAgZG5DID0gYmVsb3coUCwgVltjICsgMV0sIFZbY10pO1xyXG4gICAgICAgIGlmIChhYm92ZShQLCBWW2MgLSAxXSwgVltjXSkgJiYgIWRuQylcclxuICAgICAgICAgICAgcmV0dXJuIGM7XHJcbiAgICAgICAgZG5BID0gYmVsb3coUCwgVlthICsgMV0sIFZbYV0pO1xyXG4gICAgICAgIGlmIChkbkEpIHtcclxuICAgICAgICAgICAgaWYgKCFkbkMpXHJcbiAgICAgICAgICAgICAgICBiID0gYztcclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYmVsb3coUCwgVlthXSwgVltjXSkpXHJcbiAgICAgICAgICAgICAgICAgICAgYiA9IGM7XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgYSA9IGM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChkbkMpXHJcbiAgICAgICAgICAgICAgICBhID0gYztcclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYWJvdmUoUCwgVlthXSwgVltjXSkpXHJcbiAgICAgICAgICAgICAgICAgICAgYiA9IGM7XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgYSA9IGM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gdGFuZ2VudF9Qb2x5UG9seUMoViwgVywgdDEsIHQyLCBjbXAxLCBjbXAyKSB7XHJcbiAgICB2YXIgaXgxLCBpeDI7XHJcbiAgICBpeDEgPSB0MShXWzBdLCBWKTtcclxuICAgIGl4MiA9IHQyKFZbaXgxXSwgVyk7XHJcbiAgICB2YXIgZG9uZSA9IGZhbHNlO1xyXG4gICAgd2hpbGUgKCFkb25lKSB7XHJcbiAgICAgICAgZG9uZSA9IHRydWU7XHJcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgICAgICAgaWYgKGl4MSA9PT0gVi5sZW5ndGggLSAxKVxyXG4gICAgICAgICAgICAgICAgaXgxID0gMDtcclxuICAgICAgICAgICAgaWYgKGNtcDEoV1tpeDJdLCBWW2l4MV0sIFZbaXgxICsgMV0pKVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICsraXgxO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAgICAgICBpZiAoaXgyID09PSAwKVxyXG4gICAgICAgICAgICAgICAgaXgyID0gVy5sZW5ndGggLSAxO1xyXG4gICAgICAgICAgICBpZiAoY21wMihWW2l4MV0sIFdbaXgyXSwgV1tpeDIgLSAxXSkpXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgLS1peDI7XHJcbiAgICAgICAgICAgIGRvbmUgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyB0MTogaXgxLCB0MjogaXgyIH07XHJcbn1cclxuZXhwb3J0cy50YW5nZW50X1BvbHlQb2x5QyA9IHRhbmdlbnRfUG9seVBvbHlDO1xyXG5mdW5jdGlvbiBMUnRhbmdlbnRfUG9seVBvbHlDKFYsIFcpIHtcclxuICAgIHZhciBybCA9IFJMdGFuZ2VudF9Qb2x5UG9seUMoVywgVik7XHJcbiAgICByZXR1cm4geyB0MTogcmwudDIsIHQyOiBybC50MSB9O1xyXG59XHJcbmV4cG9ydHMuTFJ0YW5nZW50X1BvbHlQb2x5QyA9IExSdGFuZ2VudF9Qb2x5UG9seUM7XHJcbmZ1bmN0aW9uIFJMdGFuZ2VudF9Qb2x5UG9seUMoViwgVykge1xyXG4gICAgcmV0dXJuIHRhbmdlbnRfUG9seVBvbHlDKFYsIFcsIFJ0YW5nZW50X1BvaW50UG9seUMsIEx0YW5nZW50X1BvaW50UG9seUMsIGFib3ZlLCBiZWxvdyk7XHJcbn1cclxuZXhwb3J0cy5STHRhbmdlbnRfUG9seVBvbHlDID0gUkx0YW5nZW50X1BvbHlQb2x5QztcclxuZnVuY3Rpb24gTEx0YW5nZW50X1BvbHlQb2x5QyhWLCBXKSB7XHJcbiAgICByZXR1cm4gdGFuZ2VudF9Qb2x5UG9seUMoViwgVywgTHRhbmdlbnRfUG9pbnRQb2x5QywgTHRhbmdlbnRfUG9pbnRQb2x5QywgYmVsb3csIGJlbG93KTtcclxufVxyXG5leHBvcnRzLkxMdGFuZ2VudF9Qb2x5UG9seUMgPSBMTHRhbmdlbnRfUG9seVBvbHlDO1xyXG5mdW5jdGlvbiBSUnRhbmdlbnRfUG9seVBvbHlDKFYsIFcpIHtcclxuICAgIHJldHVybiB0YW5nZW50X1BvbHlQb2x5QyhWLCBXLCBSdGFuZ2VudF9Qb2ludFBvbHlDLCBSdGFuZ2VudF9Qb2ludFBvbHlDLCBhYm92ZSwgYWJvdmUpO1xyXG59XHJcbmV4cG9ydHMuUlJ0YW5nZW50X1BvbHlQb2x5QyA9IFJSdGFuZ2VudF9Qb2x5UG9seUM7XHJcbnZhciBCaVRhbmdlbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQmlUYW5nZW50KHQxLCB0Mikge1xyXG4gICAgICAgIHRoaXMudDEgPSB0MTtcclxuICAgICAgICB0aGlzLnQyID0gdDI7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gQmlUYW5nZW50O1xyXG59KCkpO1xyXG5leHBvcnRzLkJpVGFuZ2VudCA9IEJpVGFuZ2VudDtcclxudmFyIEJpVGFuZ2VudHMgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQmlUYW5nZW50cygpIHtcclxuICAgIH1cclxuICAgIHJldHVybiBCaVRhbmdlbnRzO1xyXG59KCkpO1xyXG5leHBvcnRzLkJpVGFuZ2VudHMgPSBCaVRhbmdlbnRzO1xyXG52YXIgVFZHUG9pbnQgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKFRWR1BvaW50LCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gVFZHUG9pbnQoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9zdXBlciAhPT0gbnVsbCAmJiBfc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKSB8fCB0aGlzO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFRWR1BvaW50O1xyXG59KFBvaW50KSk7XHJcbmV4cG9ydHMuVFZHUG9pbnQgPSBUVkdQb2ludDtcclxudmFyIFZpc2liaWxpdHlWZXJ0ZXggPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVmlzaWJpbGl0eVZlcnRleChpZCwgcG9seWlkLCBwb2x5dmVydGlkLCBwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGlkO1xyXG4gICAgICAgIHRoaXMucG9seWlkID0gcG9seWlkO1xyXG4gICAgICAgIHRoaXMucG9seXZlcnRpZCA9IHBvbHl2ZXJ0aWQ7XHJcbiAgICAgICAgdGhpcy5wID0gcDtcclxuICAgICAgICBwLnZ2ID0gdGhpcztcclxuICAgIH1cclxuICAgIHJldHVybiBWaXNpYmlsaXR5VmVydGV4O1xyXG59KCkpO1xyXG5leHBvcnRzLlZpc2liaWxpdHlWZXJ0ZXggPSBWaXNpYmlsaXR5VmVydGV4O1xyXG52YXIgVmlzaWJpbGl0eUVkZ2UgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVmlzaWJpbGl0eUVkZ2Uoc291cmNlLCB0YXJnZXQpIHtcclxuICAgICAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZTtcclxuICAgICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcclxuICAgIH1cclxuICAgIFZpc2liaWxpdHlFZGdlLnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGR4ID0gdGhpcy5zb3VyY2UucC54IC0gdGhpcy50YXJnZXQucC54O1xyXG4gICAgICAgIHZhciBkeSA9IHRoaXMuc291cmNlLnAueSAtIHRoaXMudGFyZ2V0LnAueTtcclxuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gVmlzaWJpbGl0eUVkZ2U7XHJcbn0oKSk7XHJcbmV4cG9ydHMuVmlzaWJpbGl0eUVkZ2UgPSBWaXNpYmlsaXR5RWRnZTtcclxudmFyIFRhbmdlbnRWaXNpYmlsaXR5R3JhcGggPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVGFuZ2VudFZpc2liaWxpdHlHcmFwaChQLCBnMCkge1xyXG4gICAgICAgIHRoaXMuUCA9IFA7XHJcbiAgICAgICAgdGhpcy5WID0gW107XHJcbiAgICAgICAgdGhpcy5FID0gW107XHJcbiAgICAgICAgaWYgKCFnMCkge1xyXG4gICAgICAgICAgICB2YXIgbiA9IFAubGVuZ3RoO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHAgPSBQW2ldO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBwLmxlbmd0aDsgKytqKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBqID0gcFtqXSwgdnYgPSBuZXcgVmlzaWJpbGl0eVZlcnRleCh0aGlzLlYubGVuZ3RoLCBpLCBqLCBwaik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5WLnB1c2godnYpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChqID4gMClcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5FLnB1c2gobmV3IFZpc2liaWxpdHlFZGdlKHBbaiAtIDFdLnZ2LCB2dikpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHAubGVuZ3RoID4gMSlcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLkUucHVzaChuZXcgVmlzaWJpbGl0eUVkZ2UocFswXS52diwgcFtwLmxlbmd0aCAtIDFdLnZ2KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuIC0gMTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgUGkgPSBQW2ldO1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IGkgKyAxOyBqIDwgbjsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIFBqID0gUFtqXSwgdCA9IHRhbmdlbnRzKFBpLCBQaik7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgcSBpbiB0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjID0gdFtxXSwgc291cmNlID0gUGlbYy50MV0sIHRhcmdldCA9IFBqW2MudDJdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZEVkZ2VJZlZpc2libGUoc291cmNlLCB0YXJnZXQsIGksIGopO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5WID0gZzAuVi5zbGljZSgwKTtcclxuICAgICAgICAgICAgdGhpcy5FID0gZzAuRS5zbGljZSgwKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBUYW5nZW50VmlzaWJpbGl0eUdyYXBoLnByb3RvdHlwZS5hZGRFZGdlSWZWaXNpYmxlID0gZnVuY3Rpb24gKHUsIHYsIGkxLCBpMikge1xyXG4gICAgICAgIGlmICghdGhpcy5pbnRlcnNlY3RzUG9seXMobmV3IExpbmVTZWdtZW50KHUueCwgdS55LCB2LngsIHYueSksIGkxLCBpMikpIHtcclxuICAgICAgICAgICAgdGhpcy5FLnB1c2gobmV3IFZpc2liaWxpdHlFZGdlKHUudnYsIHYudnYpKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgVGFuZ2VudFZpc2liaWxpdHlHcmFwaC5wcm90b3R5cGUuYWRkUG9pbnQgPSBmdW5jdGlvbiAocCwgaTEpIHtcclxuICAgICAgICB2YXIgbiA9IHRoaXMuUC5sZW5ndGg7XHJcbiAgICAgICAgdGhpcy5WLnB1c2gobmV3IFZpc2liaWxpdHlWZXJ0ZXgodGhpcy5WLmxlbmd0aCwgbiwgMCwgcCkpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcbiAgICAgICAgICAgIGlmIChpID09PSBpMSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB2YXIgcG9seSA9IHRoaXMuUFtpXSwgdCA9IHRhbmdlbnRfUG9pbnRQb2x5QyhwLCBwb2x5KTtcclxuICAgICAgICAgICAgdGhpcy5hZGRFZGdlSWZWaXNpYmxlKHAsIHBvbHlbdC5sdGFuXSwgaTEsIGkpO1xyXG4gICAgICAgICAgICB0aGlzLmFkZEVkZ2VJZlZpc2libGUocCwgcG9seVt0LnJ0YW5dLCBpMSwgaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBwLnZ2O1xyXG4gICAgfTtcclxuICAgIFRhbmdlbnRWaXNpYmlsaXR5R3JhcGgucHJvdG90eXBlLmludGVyc2VjdHNQb2x5cyA9IGZ1bmN0aW9uIChsLCBpMSwgaTIpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHRoaXMuUC5sZW5ndGg7IGkgPCBuOyArK2kpIHtcclxuICAgICAgICAgICAgaWYgKGkgIT0gaTEgJiYgaSAhPSBpMiAmJiBpbnRlcnNlY3RzKGwsIHRoaXMuUFtpXSkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBUYW5nZW50VmlzaWJpbGl0eUdyYXBoO1xyXG59KCkpO1xyXG5leHBvcnRzLlRhbmdlbnRWaXNpYmlsaXR5R3JhcGggPSBUYW5nZW50VmlzaWJpbGl0eUdyYXBoO1xyXG5mdW5jdGlvbiBpbnRlcnNlY3RzKGwsIFApIHtcclxuICAgIHZhciBpbnRzID0gW107XHJcbiAgICBmb3IgKHZhciBpID0gMSwgbiA9IFAubGVuZ3RoOyBpIDwgbjsgKytpKSB7XHJcbiAgICAgICAgdmFyIGludCA9IHJlY3RhbmdsZV8xLlJlY3RhbmdsZS5saW5lSW50ZXJzZWN0aW9uKGwueDEsIGwueTEsIGwueDIsIGwueTIsIFBbaSAtIDFdLngsIFBbaSAtIDFdLnksIFBbaV0ueCwgUFtpXS55KTtcclxuICAgICAgICBpZiAoaW50KVxyXG4gICAgICAgICAgICBpbnRzLnB1c2goaW50KTtcclxuICAgIH1cclxuICAgIHJldHVybiBpbnRzO1xyXG59XHJcbmZ1bmN0aW9uIHRhbmdlbnRzKFYsIFcpIHtcclxuICAgIHZhciBtID0gVi5sZW5ndGggLSAxLCBuID0gVy5sZW5ndGggLSAxO1xyXG4gICAgdmFyIGJ0ID0gbmV3IEJpVGFuZ2VudHMoKTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbTsgKytpKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBuOyArK2opIHtcclxuICAgICAgICAgICAgdmFyIHYxID0gVltpID09IDAgPyBtIC0gMSA6IGkgLSAxXTtcclxuICAgICAgICAgICAgdmFyIHYyID0gVltpXTtcclxuICAgICAgICAgICAgdmFyIHYzID0gVltpICsgMV07XHJcbiAgICAgICAgICAgIHZhciB3MSA9IFdbaiA9PSAwID8gbiAtIDEgOiBqIC0gMV07XHJcbiAgICAgICAgICAgIHZhciB3MiA9IFdbal07XHJcbiAgICAgICAgICAgIHZhciB3MyA9IFdbaiArIDFdO1xyXG4gICAgICAgICAgICB2YXIgdjF2MncyID0gaXNMZWZ0KHYxLCB2MiwgdzIpO1xyXG4gICAgICAgICAgICB2YXIgdjJ3MXcyID0gaXNMZWZ0KHYyLCB3MSwgdzIpO1xyXG4gICAgICAgICAgICB2YXIgdjJ3MnczID0gaXNMZWZ0KHYyLCB3MiwgdzMpO1xyXG4gICAgICAgICAgICB2YXIgdzF3MnYyID0gaXNMZWZ0KHcxLCB3MiwgdjIpO1xyXG4gICAgICAgICAgICB2YXIgdzJ2MXYyID0gaXNMZWZ0KHcyLCB2MSwgdjIpO1xyXG4gICAgICAgICAgICB2YXIgdzJ2MnYzID0gaXNMZWZ0KHcyLCB2MiwgdjMpO1xyXG4gICAgICAgICAgICBpZiAodjF2MncyID49IDAgJiYgdjJ3MXcyID49IDAgJiYgdjJ3MnczIDwgMFxyXG4gICAgICAgICAgICAgICAgJiYgdzF3MnYyID49IDAgJiYgdzJ2MXYyID49IDAgJiYgdzJ2MnYzIDwgMCkge1xyXG4gICAgICAgICAgICAgICAgYnQubGwgPSBuZXcgQmlUYW5nZW50KGksIGopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHYxdjJ3MiA8PSAwICYmIHYydzF3MiA8PSAwICYmIHYydzJ3MyA+IDBcclxuICAgICAgICAgICAgICAgICYmIHcxdzJ2MiA8PSAwICYmIHcydjF2MiA8PSAwICYmIHcydjJ2MyA+IDApIHtcclxuICAgICAgICAgICAgICAgIGJ0LnJyID0gbmV3IEJpVGFuZ2VudChpLCBqKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICh2MXYydzIgPD0gMCAmJiB2MncxdzIgPiAwICYmIHYydzJ3MyA8PSAwXHJcbiAgICAgICAgICAgICAgICAmJiB3MXcydjIgPj0gMCAmJiB3MnYxdjIgPCAwICYmIHcydjJ2MyA+PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBidC5ybCA9IG5ldyBCaVRhbmdlbnQoaSwgaik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAodjF2MncyID49IDAgJiYgdjJ3MXcyIDwgMCAmJiB2MncydzMgPj0gMFxyXG4gICAgICAgICAgICAgICAgJiYgdzF3MnYyIDw9IDAgJiYgdzJ2MXYyID4gMCAmJiB3MnYydjMgPD0gMCkge1xyXG4gICAgICAgICAgICAgICAgYnQubHIgPSBuZXcgQmlUYW5nZW50KGksIGopO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGJ0O1xyXG59XHJcbmV4cG9ydHMudGFuZ2VudHMgPSB0YW5nZW50cztcclxuZnVuY3Rpb24gaXNQb2ludEluc2lkZVBvbHkocCwgcG9seSkge1xyXG4gICAgZm9yICh2YXIgaSA9IDEsIG4gPSBwb2x5Lmxlbmd0aDsgaSA8IG47ICsraSlcclxuICAgICAgICBpZiAoYmVsb3cocG9seVtpIC0gMV0sIHBvbHlbaV0sIHApKVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufVxyXG5mdW5jdGlvbiBpc0FueVBJblEocCwgcSkge1xyXG4gICAgcmV0dXJuICFwLmV2ZXJ5KGZ1bmN0aW9uICh2KSB7IHJldHVybiAhaXNQb2ludEluc2lkZVBvbHkodiwgcSk7IH0pO1xyXG59XHJcbmZ1bmN0aW9uIHBvbHlzT3ZlcmxhcChwLCBxKSB7XHJcbiAgICBpZiAoaXNBbnlQSW5RKHAsIHEpKVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgaWYgKGlzQW55UEluUShxLCBwKSlcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIGZvciAodmFyIGkgPSAxLCBuID0gcC5sZW5ndGg7IGkgPCBuOyArK2kpIHtcclxuICAgICAgICB2YXIgdiA9IHBbaV0sIHUgPSBwW2kgLSAxXTtcclxuICAgICAgICBpZiAoaW50ZXJzZWN0cyhuZXcgTGluZVNlZ21lbnQodS54LCB1LnksIHYueCwgdi55KSwgcSkubGVuZ3RoID4gMClcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbn1cclxuZXhwb3J0cy5wb2x5c092ZXJsYXAgPSBwb2x5c092ZXJsYXA7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdlb20uanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIHJlY3RhbmdsZV8xID0gcmVxdWlyZShcIi4vcmVjdGFuZ2xlXCIpO1xyXG52YXIgdnBzY18xID0gcmVxdWlyZShcIi4vdnBzY1wiKTtcclxudmFyIHNob3J0ZXN0cGF0aHNfMSA9IHJlcXVpcmUoXCIuL3Nob3J0ZXN0cGF0aHNcIik7XHJcbnZhciBOb2RlV3JhcHBlciA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBOb2RlV3JhcHBlcihpZCwgcmVjdCwgY2hpbGRyZW4pIHtcclxuICAgICAgICB0aGlzLmlkID0gaWQ7XHJcbiAgICAgICAgdGhpcy5yZWN0ID0gcmVjdDtcclxuICAgICAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XHJcbiAgICAgICAgdGhpcy5sZWFmID0gdHlwZW9mIGNoaWxkcmVuID09PSAndW5kZWZpbmVkJyB8fCBjaGlsZHJlbi5sZW5ndGggPT09IDA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gTm9kZVdyYXBwZXI7XHJcbn0oKSk7XHJcbmV4cG9ydHMuTm9kZVdyYXBwZXIgPSBOb2RlV3JhcHBlcjtcclxudmFyIFZlcnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVmVydChpZCwgeCwgeSwgbm9kZSwgbGluZSkge1xyXG4gICAgICAgIGlmIChub2RlID09PSB2b2lkIDApIHsgbm9kZSA9IG51bGw7IH1cclxuICAgICAgICBpZiAobGluZSA9PT0gdm9pZCAwKSB7IGxpbmUgPSBudWxsOyB9XHJcbiAgICAgICAgdGhpcy5pZCA9IGlkO1xyXG4gICAgICAgIHRoaXMueCA9IHg7XHJcbiAgICAgICAgdGhpcy55ID0geTtcclxuICAgICAgICB0aGlzLm5vZGUgPSBub2RlO1xyXG4gICAgICAgIHRoaXMubGluZSA9IGxpbmU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gVmVydDtcclxufSgpKTtcclxuZXhwb3J0cy5WZXJ0ID0gVmVydDtcclxudmFyIExvbmdlc3RDb21tb25TdWJzZXF1ZW5jZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBMb25nZXN0Q29tbW9uU3Vic2VxdWVuY2UocywgdCkge1xyXG4gICAgICAgIHRoaXMucyA9IHM7XHJcbiAgICAgICAgdGhpcy50ID0gdDtcclxuICAgICAgICB2YXIgbWYgPSBMb25nZXN0Q29tbW9uU3Vic2VxdWVuY2UuZmluZE1hdGNoKHMsIHQpO1xyXG4gICAgICAgIHZhciB0ciA9IHQuc2xpY2UoMCkucmV2ZXJzZSgpO1xyXG4gICAgICAgIHZhciBtciA9IExvbmdlc3RDb21tb25TdWJzZXF1ZW5jZS5maW5kTWF0Y2gocywgdHIpO1xyXG4gICAgICAgIGlmIChtZi5sZW5ndGggPj0gbXIubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHRoaXMubGVuZ3RoID0gbWYubGVuZ3RoO1xyXG4gICAgICAgICAgICB0aGlzLnNpID0gbWYuc2k7XHJcbiAgICAgICAgICAgIHRoaXMudGkgPSBtZi50aTtcclxuICAgICAgICAgICAgdGhpcy5yZXZlcnNlZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5sZW5ndGggPSBtci5sZW5ndGg7XHJcbiAgICAgICAgICAgIHRoaXMuc2kgPSBtci5zaTtcclxuICAgICAgICAgICAgdGhpcy50aSA9IHQubGVuZ3RoIC0gbXIudGkgLSBtci5sZW5ndGg7XHJcbiAgICAgICAgICAgIHRoaXMucmV2ZXJzZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIExvbmdlc3RDb21tb25TdWJzZXF1ZW5jZS5maW5kTWF0Y2ggPSBmdW5jdGlvbiAocywgdCkge1xyXG4gICAgICAgIHZhciBtID0gcy5sZW5ndGg7XHJcbiAgICAgICAgdmFyIG4gPSB0Lmxlbmd0aDtcclxuICAgICAgICB2YXIgbWF0Y2ggPSB7IGxlbmd0aDogMCwgc2k6IC0xLCB0aTogLTEgfTtcclxuICAgICAgICB2YXIgbCA9IG5ldyBBcnJheShtKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG07IGkrKykge1xyXG4gICAgICAgICAgICBsW2ldID0gbmV3IEFycmF5KG4pO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG47IGorKylcclxuICAgICAgICAgICAgICAgIGlmIChzW2ldID09PSB0W2pdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHYgPSBsW2ldW2pdID0gKGkgPT09IDAgfHwgaiA9PT0gMCkgPyAxIDogbFtpIC0gMV1baiAtIDFdICsgMTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodiA+IG1hdGNoLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaC5sZW5ndGggPSB2O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaC5zaSA9IGkgLSB2ICsgMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2gudGkgPSBqIC0gdiArIDE7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgICBsW2ldW2pdID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG1hdGNoO1xyXG4gICAgfTtcclxuICAgIExvbmdlc3RDb21tb25TdWJzZXF1ZW5jZS5wcm90b3R5cGUuZ2V0U2VxdWVuY2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubGVuZ3RoID49IDAgPyB0aGlzLnMuc2xpY2UodGhpcy5zaSwgdGhpcy5zaSArIHRoaXMubGVuZ3RoKSA6IFtdO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBMb25nZXN0Q29tbW9uU3Vic2VxdWVuY2U7XHJcbn0oKSk7XHJcbmV4cG9ydHMuTG9uZ2VzdENvbW1vblN1YnNlcXVlbmNlID0gTG9uZ2VzdENvbW1vblN1YnNlcXVlbmNlO1xyXG52YXIgR3JpZFJvdXRlciA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBHcmlkUm91dGVyKG9yaWdpbmFsbm9kZXMsIGFjY2Vzc29yLCBncm91cFBhZGRpbmcpIHtcclxuICAgICAgICBpZiAoZ3JvdXBQYWRkaW5nID09PSB2b2lkIDApIHsgZ3JvdXBQYWRkaW5nID0gMTI7IH1cclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMub3JpZ2luYWxub2RlcyA9IG9yaWdpbmFsbm9kZXM7XHJcbiAgICAgICAgdGhpcy5ncm91cFBhZGRpbmcgPSBncm91cFBhZGRpbmc7XHJcbiAgICAgICAgdGhpcy5sZWF2ZXMgPSBudWxsO1xyXG4gICAgICAgIHRoaXMubm9kZXMgPSBvcmlnaW5hbG5vZGVzLm1hcChmdW5jdGlvbiAodiwgaSkgeyByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKGksIGFjY2Vzc29yLmdldEJvdW5kcyh2KSwgYWNjZXNzb3IuZ2V0Q2hpbGRyZW4odikpOyB9KTtcclxuICAgICAgICB0aGlzLmxlYXZlcyA9IHRoaXMubm9kZXMuZmlsdGVyKGZ1bmN0aW9uICh2KSB7IHJldHVybiB2LmxlYWY7IH0pO1xyXG4gICAgICAgIHRoaXMuZ3JvdXBzID0gdGhpcy5ub2Rlcy5maWx0ZXIoZnVuY3Rpb24gKGcpIHsgcmV0dXJuICFnLmxlYWY7IH0pO1xyXG4gICAgICAgIHRoaXMuY29scyA9IHRoaXMuZ2V0R3JpZExpbmVzKCd4Jyk7XHJcbiAgICAgICAgdGhpcy5yb3dzID0gdGhpcy5nZXRHcmlkTGluZXMoJ3knKTtcclxuICAgICAgICB0aGlzLmdyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB2LmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGMpIHsgcmV0dXJuIF90aGlzLm5vZGVzW2NdLnBhcmVudCA9IHY7IH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucm9vdCA9IHsgY2hpbGRyZW46IFtdIH07XHJcbiAgICAgICAgdGhpcy5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygdi5wYXJlbnQgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICB2LnBhcmVudCA9IF90aGlzLnJvb3Q7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5yb290LmNoaWxkcmVuLnB1c2godi5pZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdi5wb3J0cyA9IFtdO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuYmFja1RvRnJvbnQgPSB0aGlzLm5vZGVzLnNsaWNlKDApO1xyXG4gICAgICAgIHRoaXMuYmFja1RvRnJvbnQuc29ydChmdW5jdGlvbiAoeCwgeSkgeyByZXR1cm4gX3RoaXMuZ2V0RGVwdGgoeCkgLSBfdGhpcy5nZXREZXB0aCh5KTsgfSk7XHJcbiAgICAgICAgdmFyIGZyb250VG9CYWNrR3JvdXBzID0gdGhpcy5iYWNrVG9Gcm9udC5zbGljZSgwKS5yZXZlcnNlKCkuZmlsdGVyKGZ1bmN0aW9uIChnKSB7IHJldHVybiAhZy5sZWFmOyB9KTtcclxuICAgICAgICBmcm9udFRvQmFja0dyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgICAgIHZhciByID0gcmVjdGFuZ2xlXzEuUmVjdGFuZ2xlLmVtcHR5KCk7XHJcbiAgICAgICAgICAgIHYuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAoYykgeyByZXR1cm4gciA9IHIudW5pb24oX3RoaXMubm9kZXNbY10ucmVjdCk7IH0pO1xyXG4gICAgICAgICAgICB2LnJlY3QgPSByLmluZmxhdGUoX3RoaXMuZ3JvdXBQYWRkaW5nKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB2YXIgY29sTWlkcyA9IHRoaXMubWlkUG9pbnRzKHRoaXMuY29scy5tYXAoZnVuY3Rpb24gKHIpIHsgcmV0dXJuIHIucG9zOyB9KSk7XHJcbiAgICAgICAgdmFyIHJvd01pZHMgPSB0aGlzLm1pZFBvaW50cyh0aGlzLnJvd3MubWFwKGZ1bmN0aW9uIChyKSB7IHJldHVybiByLnBvczsgfSkpO1xyXG4gICAgICAgIHZhciByb3d4ID0gY29sTWlkc1swXSwgcm93WCA9IGNvbE1pZHNbY29sTWlkcy5sZW5ndGggLSAxXTtcclxuICAgICAgICB2YXIgY29seSA9IHJvd01pZHNbMF0sIGNvbFkgPSByb3dNaWRzW3Jvd01pZHMubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgdmFyIGhsaW5lcyA9IHRoaXMucm93cy5tYXAoZnVuY3Rpb24gKHIpIHsgcmV0dXJuICh7IHgxOiByb3d4LCB4Mjogcm93WCwgeTE6IHIucG9zLCB5Mjogci5wb3MgfSk7IH0pXHJcbiAgICAgICAgICAgIC5jb25jYXQocm93TWlkcy5tYXAoZnVuY3Rpb24gKG0pIHsgcmV0dXJuICh7IHgxOiByb3d4LCB4Mjogcm93WCwgeTE6IG0sIHkyOiBtIH0pOyB9KSk7XHJcbiAgICAgICAgdmFyIHZsaW5lcyA9IHRoaXMuY29scy5tYXAoZnVuY3Rpb24gKGMpIHsgcmV0dXJuICh7IHgxOiBjLnBvcywgeDI6IGMucG9zLCB5MTogY29seSwgeTI6IGNvbFkgfSk7IH0pXHJcbiAgICAgICAgICAgIC5jb25jYXQoY29sTWlkcy5tYXAoZnVuY3Rpb24gKG0pIHsgcmV0dXJuICh7IHgxOiBtLCB4MjogbSwgeTE6IGNvbHksIHkyOiBjb2xZIH0pOyB9KSk7XHJcbiAgICAgICAgdmFyIGxpbmVzID0gaGxpbmVzLmNvbmNhdCh2bGluZXMpO1xyXG4gICAgICAgIGxpbmVzLmZvckVhY2goZnVuY3Rpb24gKGwpIHsgcmV0dXJuIGwudmVydHMgPSBbXTsgfSk7XHJcbiAgICAgICAgdGhpcy52ZXJ0cyA9IFtdO1xyXG4gICAgICAgIHRoaXMuZWRnZXMgPSBbXTtcclxuICAgICAgICBobGluZXMuZm9yRWFjaChmdW5jdGlvbiAoaCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdmxpbmVzLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICAgICAgICAgIHZhciBwID0gbmV3IFZlcnQoX3RoaXMudmVydHMubGVuZ3RoLCB2LngxLCBoLnkxKTtcclxuICAgICAgICAgICAgICAgIGgudmVydHMucHVzaChwKTtcclxuICAgICAgICAgICAgICAgIHYudmVydHMucHVzaChwKTtcclxuICAgICAgICAgICAgICAgIF90aGlzLnZlcnRzLnB1c2gocCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgaSA9IF90aGlzLmJhY2tUb0Zyb250Lmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIHdoaWxlIChpLS0gPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5vZGUgPSBfdGhpcy5iYWNrVG9Gcm9udFtpXSwgciA9IG5vZGUucmVjdDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZHggPSBNYXRoLmFicyhwLnggLSByLmN4KCkpLCBkeSA9IE1hdGguYWJzKHAueSAtIHIuY3koKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGR4IDwgci53aWR0aCgpIC8gMiAmJiBkeSA8IHIuaGVpZ2h0KCkgLyAyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHAubm9kZSA9IG5vZGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbGluZXMuZm9yRWFjaChmdW5jdGlvbiAobCwgbGkpIHtcclxuICAgICAgICAgICAgX3RoaXMubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkge1xyXG4gICAgICAgICAgICAgICAgdi5yZWN0LmxpbmVJbnRlcnNlY3Rpb25zKGwueDEsIGwueTEsIGwueDIsIGwueTIpLmZvckVhY2goZnVuY3Rpb24gKGludGVyc2VjdCwgaikge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBwID0gbmV3IFZlcnQoX3RoaXMudmVydHMubGVuZ3RoLCBpbnRlcnNlY3QueCwgaW50ZXJzZWN0LnksIHYsIGwpO1xyXG4gICAgICAgICAgICAgICAgICAgIF90aGlzLnZlcnRzLnB1c2gocCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbC52ZXJ0cy5wdXNoKHApO1xyXG4gICAgICAgICAgICAgICAgICAgIHYucG9ydHMucHVzaChwKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdmFyIGlzSG9yaXogPSBNYXRoLmFicyhsLnkxIC0gbC55MikgPCAwLjE7XHJcbiAgICAgICAgICAgIHZhciBkZWx0YSA9IGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBpc0hvcml6ID8gYi54IC0gYS54IDogYi55IC0gYS55OyB9O1xyXG4gICAgICAgICAgICBsLnZlcnRzLnNvcnQoZGVsdGEpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGwudmVydHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciB1ID0gbC52ZXJ0c1tpIC0gMV0sIHYgPSBsLnZlcnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKHUubm9kZSAmJiB1Lm5vZGUgPT09IHYubm9kZSAmJiB1Lm5vZGUubGVhZilcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIF90aGlzLmVkZ2VzLnB1c2goeyBzb3VyY2U6IHUuaWQsIHRhcmdldDogdi5pZCwgbGVuZ3RoOiBNYXRoLmFicyhkZWx0YSh1LCB2KSkgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIEdyaWRSb3V0ZXIucHJvdG90eXBlLmF2ZyA9IGZ1bmN0aW9uIChhKSB7IHJldHVybiBhLnJlZHVjZShmdW5jdGlvbiAoeCwgeSkgeyByZXR1cm4geCArIHk7IH0pIC8gYS5sZW5ndGg7IH07XHJcbiAgICBHcmlkUm91dGVyLnByb3RvdHlwZS5nZXRHcmlkTGluZXMgPSBmdW5jdGlvbiAoYXhpcykge1xyXG4gICAgICAgIHZhciBjb2x1bW5zID0gW107XHJcbiAgICAgICAgdmFyIGxzID0gdGhpcy5sZWF2ZXMuc2xpY2UoMCwgdGhpcy5sZWF2ZXMubGVuZ3RoKTtcclxuICAgICAgICB3aGlsZSAobHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB2YXIgb3ZlcmxhcHBpbmcgPSBscy5maWx0ZXIoZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHYucmVjdFsnb3ZlcmxhcCcgKyBheGlzLnRvVXBwZXJDYXNlKCldKGxzWzBdLnJlY3QpOyB9KTtcclxuICAgICAgICAgICAgdmFyIGNvbCA9IHtcclxuICAgICAgICAgICAgICAgIG5vZGVzOiBvdmVybGFwcGluZyxcclxuICAgICAgICAgICAgICAgIHBvczogdGhpcy5hdmcob3ZlcmxhcHBpbmcubWFwKGZ1bmN0aW9uICh2KSB7IHJldHVybiB2LnJlY3RbJ2MnICsgYXhpc10oKTsgfSkpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNvbHVtbnMucHVzaChjb2wpO1xyXG4gICAgICAgICAgICBjb2wubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodikgeyByZXR1cm4gbHMuc3BsaWNlKGxzLmluZGV4T2YodiksIDEpOyB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29sdW1ucy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBhLnBvcyAtIGIucG9zOyB9KTtcclxuICAgICAgICByZXR1cm4gY29sdW1ucztcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLnByb3RvdHlwZS5nZXREZXB0aCA9IGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgdmFyIGRlcHRoID0gMDtcclxuICAgICAgICB3aGlsZSAodi5wYXJlbnQgIT09IHRoaXMucm9vdCkge1xyXG4gICAgICAgICAgICBkZXB0aCsrO1xyXG4gICAgICAgICAgICB2ID0gdi5wYXJlbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBkZXB0aDtcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLnByb3RvdHlwZS5taWRQb2ludHMgPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICAgIHZhciBnYXAgPSBhWzFdIC0gYVswXTtcclxuICAgICAgICB2YXIgbWlkcyA9IFthWzBdIC0gZ2FwIC8gMl07XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG1pZHMucHVzaCgoYVtpXSArIGFbaSAtIDFdKSAvIDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBtaWRzLnB1c2goYVthLmxlbmd0aCAtIDFdICsgZ2FwIC8gMik7XHJcbiAgICAgICAgcmV0dXJuIG1pZHM7XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5wcm90b3R5cGUuZmluZExpbmVhZ2UgPSBmdW5jdGlvbiAodikge1xyXG4gICAgICAgIHZhciBsaW5lYWdlID0gW3ZdO1xyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgdiA9IHYucGFyZW50O1xyXG4gICAgICAgICAgICBsaW5lYWdlLnB1c2godik7XHJcbiAgICAgICAgfSB3aGlsZSAodiAhPT0gdGhpcy5yb290KTtcclxuICAgICAgICByZXR1cm4gbGluZWFnZS5yZXZlcnNlKCk7XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5wcm90b3R5cGUuZmluZEFuY2VzdG9yUGF0aEJldHdlZW4gPSBmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgIHZhciBhYSA9IHRoaXMuZmluZExpbmVhZ2UoYSksIGJhID0gdGhpcy5maW5kTGluZWFnZShiKSwgaSA9IDA7XHJcbiAgICAgICAgd2hpbGUgKGFhW2ldID09PSBiYVtpXSlcclxuICAgICAgICAgICAgaSsrO1xyXG4gICAgICAgIHJldHVybiB7IGNvbW1vbkFuY2VzdG9yOiBhYVtpIC0gMV0sIGxpbmVhZ2VzOiBhYS5zbGljZShpKS5jb25jYXQoYmEuc2xpY2UoaSkpIH07XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5wcm90b3R5cGUuc2libGluZ09ic3RhY2xlcyA9IGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgcGF0aCA9IHRoaXMuZmluZEFuY2VzdG9yUGF0aEJldHdlZW4oYSwgYik7XHJcbiAgICAgICAgdmFyIGxpbmVhZ2VMb29rdXAgPSB7fTtcclxuICAgICAgICBwYXRoLmxpbmVhZ2VzLmZvckVhY2goZnVuY3Rpb24gKHYpIHsgcmV0dXJuIGxpbmVhZ2VMb29rdXBbdi5pZF0gPSB7fTsgfSk7XHJcbiAgICAgICAgdmFyIG9ic3RhY2xlcyA9IHBhdGguY29tbW9uQW5jZXN0b3IuY2hpbGRyZW4uZmlsdGVyKGZ1bmN0aW9uICh2KSB7IHJldHVybiAhKHYgaW4gbGluZWFnZUxvb2t1cCk7IH0pO1xyXG4gICAgICAgIHBhdGgubGluZWFnZXNcclxuICAgICAgICAgICAgLmZpbHRlcihmdW5jdGlvbiAodikgeyByZXR1cm4gdi5wYXJlbnQgIT09IHBhdGguY29tbW9uQW5jZXN0b3I7IH0pXHJcbiAgICAgICAgICAgIC5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7IHJldHVybiBvYnN0YWNsZXMgPSBvYnN0YWNsZXMuY29uY2F0KHYucGFyZW50LmNoaWxkcmVuLmZpbHRlcihmdW5jdGlvbiAoYykgeyByZXR1cm4gYyAhPT0gdi5pZDsgfSkpOyB9KTtcclxuICAgICAgICByZXR1cm4gb2JzdGFjbGVzLm1hcChmdW5jdGlvbiAodikgeyByZXR1cm4gX3RoaXMubm9kZXNbdl07IH0pO1xyXG4gICAgfTtcclxuICAgIEdyaWRSb3V0ZXIuZ2V0U2VnbWVudFNldHMgPSBmdW5jdGlvbiAocm91dGVzLCB4LCB5KSB7XHJcbiAgICAgICAgdmFyIHZzZWdtZW50cyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIGVpID0gMDsgZWkgPCByb3V0ZXMubGVuZ3RoOyBlaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciByb3V0ZSA9IHJvdXRlc1tlaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHNpID0gMDsgc2kgPCByb3V0ZS5sZW5ndGg7IHNpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBzID0gcm91dGVbc2ldO1xyXG4gICAgICAgICAgICAgICAgcy5lZGdlaWQgPSBlaTtcclxuICAgICAgICAgICAgICAgIHMuaSA9IHNpO1xyXG4gICAgICAgICAgICAgICAgdmFyIHNkeCA9IHNbMV1beF0gLSBzWzBdW3hdO1xyXG4gICAgICAgICAgICAgICAgaWYgKE1hdGguYWJzKHNkeCkgPCAwLjEpIHtcclxuICAgICAgICAgICAgICAgICAgICB2c2VnbWVudHMucHVzaChzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB2c2VnbWVudHMuc29ydChmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gYVswXVt4XSAtIGJbMF1beF07IH0pO1xyXG4gICAgICAgIHZhciB2c2VnbWVudHNldHMgPSBbXTtcclxuICAgICAgICB2YXIgc2VnbWVudHNldCA9IG51bGw7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2c2VnbWVudHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHMgPSB2c2VnbWVudHNbaV07XHJcbiAgICAgICAgICAgIGlmICghc2VnbWVudHNldCB8fCBNYXRoLmFicyhzWzBdW3hdIC0gc2VnbWVudHNldC5wb3MpID4gMC4xKSB7XHJcbiAgICAgICAgICAgICAgICBzZWdtZW50c2V0ID0geyBwb3M6IHNbMF1beF0sIHNlZ21lbnRzOiBbXSB9O1xyXG4gICAgICAgICAgICAgICAgdnNlZ21lbnRzZXRzLnB1c2goc2VnbWVudHNldCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2VnbWVudHNldC5zZWdtZW50cy5wdXNoKHMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdnNlZ21lbnRzZXRzO1xyXG4gICAgfTtcclxuICAgIEdyaWRSb3V0ZXIubnVkZ2VTZWdzID0gZnVuY3Rpb24gKHgsIHksIHJvdXRlcywgc2VnbWVudHMsIGxlZnRPZiwgZ2FwKSB7XHJcbiAgICAgICAgdmFyIG4gPSBzZWdtZW50cy5sZW5ndGg7XHJcbiAgICAgICAgaWYgKG4gPD0gMSlcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIHZhciB2cyA9IHNlZ21lbnRzLm1hcChmdW5jdGlvbiAocykgeyByZXR1cm4gbmV3IHZwc2NfMS5WYXJpYWJsZShzWzBdW3hdKTsgfSk7XHJcbiAgICAgICAgdmFyIGNzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBuOyBqKyspIHtcclxuICAgICAgICAgICAgICAgIGlmIChpID09PSBqKVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgdmFyIHMxID0gc2VnbWVudHNbaV0sIHMyID0gc2VnbWVudHNbal0sIGUxID0gczEuZWRnZWlkLCBlMiA9IHMyLmVkZ2VpZCwgbGluZCA9IC0xLCByaW5kID0gLTE7XHJcbiAgICAgICAgICAgICAgICBpZiAoeCA9PSAneCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobGVmdE9mKGUxLCBlMikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMxWzBdW3ldIDwgczFbMV1beV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmQgPSBqLCByaW5kID0gaTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmQgPSBpLCByaW5kID0gajtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChsZWZ0T2YoZTEsIGUyKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczFbMF1beV0gPCBzMVsxXVt5XSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZCA9IGksIHJpbmQgPSBqO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZCA9IGosIHJpbmQgPSBpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGxpbmQgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNzLnB1c2gobmV3IHZwc2NfMS5Db25zdHJhaW50KHZzW2xpbmRdLCB2c1tyaW5kXSwgZ2FwKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHNvbHZlciA9IG5ldyB2cHNjXzEuU29sdmVyKHZzLCBjcyk7XHJcbiAgICAgICAgc29sdmVyLnNvbHZlKCk7XHJcbiAgICAgICAgdnMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkge1xyXG4gICAgICAgICAgICB2YXIgcyA9IHNlZ21lbnRzW2ldO1xyXG4gICAgICAgICAgICB2YXIgcG9zID0gdi5wb3NpdGlvbigpO1xyXG4gICAgICAgICAgICBzWzBdW3hdID0gc1sxXVt4XSA9IHBvcztcclxuICAgICAgICAgICAgdmFyIHJvdXRlID0gcm91dGVzW3MuZWRnZWlkXTtcclxuICAgICAgICAgICAgaWYgKHMuaSA+IDApXHJcbiAgICAgICAgICAgICAgICByb3V0ZVtzLmkgLSAxXVsxXVt4XSA9IHBvcztcclxuICAgICAgICAgICAgaWYgKHMuaSA8IHJvdXRlLmxlbmd0aCAtIDEpXHJcbiAgICAgICAgICAgICAgICByb3V0ZVtzLmkgKyAxXVswXVt4XSA9IHBvcztcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLm51ZGdlU2VnbWVudHMgPSBmdW5jdGlvbiAocm91dGVzLCB4LCB5LCBsZWZ0T2YsIGdhcCkge1xyXG4gICAgICAgIHZhciB2c2VnbWVudHNldHMgPSBHcmlkUm91dGVyLmdldFNlZ21lbnRTZXRzKHJvdXRlcywgeCwgeSk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2c2VnbWVudHNldHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHNzID0gdnNlZ21lbnRzZXRzW2ldO1xyXG4gICAgICAgICAgICB2YXIgZXZlbnRzID0gW107XHJcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgc3Muc2VnbWVudHMubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBzID0gc3Muc2VnbWVudHNbal07XHJcbiAgICAgICAgICAgICAgICBldmVudHMucHVzaCh7IHR5cGU6IDAsIHM6IHMsIHBvczogTWF0aC5taW4oc1swXVt5XSwgc1sxXVt5XSkgfSk7XHJcbiAgICAgICAgICAgICAgICBldmVudHMucHVzaCh7IHR5cGU6IDEsIHM6IHMsIHBvczogTWF0aC5tYXgoc1swXVt5XSwgc1sxXVt5XSkgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZXZlbnRzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGEucG9zIC0gYi5wb3MgKyBhLnR5cGUgLSBiLnR5cGU7IH0pO1xyXG4gICAgICAgICAgICB2YXIgb3BlbiA9IFtdO1xyXG4gICAgICAgICAgICB2YXIgb3BlbkNvdW50ID0gMDtcclxuICAgICAgICAgICAgZXZlbnRzLmZvckVhY2goZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChlLnR5cGUgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBvcGVuLnB1c2goZS5zKTtcclxuICAgICAgICAgICAgICAgICAgICBvcGVuQ291bnQrKztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG9wZW5Db3VudC0tO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKG9wZW5Db3VudCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgR3JpZFJvdXRlci5udWRnZVNlZ3MoeCwgeSwgcm91dGVzLCBvcGVuLCBsZWZ0T2YsIGdhcCk7XHJcbiAgICAgICAgICAgICAgICAgICAgb3BlbiA9IFtdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5wcm90b3R5cGUucm91dGVFZGdlcyA9IGZ1bmN0aW9uIChlZGdlcywgbnVkZ2VHYXAsIHNvdXJjZSwgdGFyZ2V0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgcm91dGVQYXRocyA9IGVkZ2VzLm1hcChmdW5jdGlvbiAoZSkgeyByZXR1cm4gX3RoaXMucm91dGUoc291cmNlKGUpLCB0YXJnZXQoZSkpOyB9KTtcclxuICAgICAgICB2YXIgb3JkZXIgPSBHcmlkUm91dGVyLm9yZGVyRWRnZXMocm91dGVQYXRocyk7XHJcbiAgICAgICAgdmFyIHJvdXRlcyA9IHJvdXRlUGF0aHMubWFwKGZ1bmN0aW9uIChlKSB7IHJldHVybiBHcmlkUm91dGVyLm1ha2VTZWdtZW50cyhlKTsgfSk7XHJcbiAgICAgICAgR3JpZFJvdXRlci5udWRnZVNlZ21lbnRzKHJvdXRlcywgJ3gnLCAneScsIG9yZGVyLCBudWRnZUdhcCk7XHJcbiAgICAgICAgR3JpZFJvdXRlci5udWRnZVNlZ21lbnRzKHJvdXRlcywgJ3knLCAneCcsIG9yZGVyLCBudWRnZUdhcCk7XHJcbiAgICAgICAgR3JpZFJvdXRlci51bnJldmVyc2VFZGdlcyhyb3V0ZXMsIHJvdXRlUGF0aHMpO1xyXG4gICAgICAgIHJldHVybiByb3V0ZXM7XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci51bnJldmVyc2VFZGdlcyA9IGZ1bmN0aW9uIChyb3V0ZXMsIHJvdXRlUGF0aHMpIHtcclxuICAgICAgICByb3V0ZXMuZm9yRWFjaChmdW5jdGlvbiAoc2VnbWVudHMsIGkpIHtcclxuICAgICAgICAgICAgdmFyIHBhdGggPSByb3V0ZVBhdGhzW2ldO1xyXG4gICAgICAgICAgICBpZiAocGF0aC5yZXZlcnNlZCkge1xyXG4gICAgICAgICAgICAgICAgc2VnbWVudHMucmV2ZXJzZSgpO1xyXG4gICAgICAgICAgICAgICAgc2VnbWVudHMuZm9yRWFjaChmdW5jdGlvbiAoc2VnbWVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlZ21lbnQucmV2ZXJzZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLmFuZ2xlQmV0d2VlbjJMaW5lcyA9IGZ1bmN0aW9uIChsaW5lMSwgbGluZTIpIHtcclxuICAgICAgICB2YXIgYW5nbGUxID0gTWF0aC5hdGFuMihsaW5lMVswXS55IC0gbGluZTFbMV0ueSwgbGluZTFbMF0ueCAtIGxpbmUxWzFdLngpO1xyXG4gICAgICAgIHZhciBhbmdsZTIgPSBNYXRoLmF0YW4yKGxpbmUyWzBdLnkgLSBsaW5lMlsxXS55LCBsaW5lMlswXS54IC0gbGluZTJbMV0ueCk7XHJcbiAgICAgICAgdmFyIGRpZmYgPSBhbmdsZTEgLSBhbmdsZTI7XHJcbiAgICAgICAgaWYgKGRpZmYgPiBNYXRoLlBJIHx8IGRpZmYgPCAtTWF0aC5QSSkge1xyXG4gICAgICAgICAgICBkaWZmID0gYW5nbGUyIC0gYW5nbGUxO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZGlmZjtcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLmlzTGVmdCA9IGZ1bmN0aW9uIChhLCBiLCBjKSB7XHJcbiAgICAgICAgcmV0dXJuICgoYi54IC0gYS54KSAqIChjLnkgLSBhLnkpIC0gKGIueSAtIGEueSkgKiAoYy54IC0gYS54KSkgPD0gMDtcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLmdldE9yZGVyID0gZnVuY3Rpb24gKHBhaXJzKSB7XHJcbiAgICAgICAgdmFyIG91dGdvaW5nID0ge307XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYWlycy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgcCA9IHBhaXJzW2ldO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIG91dGdvaW5nW3AubF0gPT09ICd1bmRlZmluZWQnKVxyXG4gICAgICAgICAgICAgICAgb3V0Z29pbmdbcC5sXSA9IHt9O1xyXG4gICAgICAgICAgICBvdXRnb2luZ1twLmxdW3Aucl0gPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGwsIHIpIHsgcmV0dXJuIHR5cGVvZiBvdXRnb2luZ1tsXSAhPT0gJ3VuZGVmaW5lZCcgJiYgb3V0Z29pbmdbbF1bcl07IH07XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5vcmRlckVkZ2VzID0gZnVuY3Rpb24gKGVkZ2VzKSB7XHJcbiAgICAgICAgdmFyIGVkZ2VPcmRlciA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWRnZXMubGVuZ3RoIC0gMTsgaSsrKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGogPSBpICsgMTsgaiA8IGVkZ2VzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgZSA9IGVkZ2VzW2ldLCBmID0gZWRnZXNbal0sIGxjcyA9IG5ldyBMb25nZXN0Q29tbW9uU3Vic2VxdWVuY2UoZSwgZik7XHJcbiAgICAgICAgICAgICAgICB2YXIgdSwgdmksIHZqO1xyXG4gICAgICAgICAgICAgICAgaWYgKGxjcy5sZW5ndGggPT09IDApXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBpZiAobGNzLnJldmVyc2VkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZi5yZXZlcnNlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZi5yZXZlcnNlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgbGNzID0gbmV3IExvbmdlc3RDb21tb25TdWJzZXF1ZW5jZShlLCBmKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICgobGNzLnNpIDw9IDAgfHwgbGNzLnRpIDw9IDApICYmXHJcbiAgICAgICAgICAgICAgICAgICAgKGxjcy5zaSArIGxjcy5sZW5ndGggPj0gZS5sZW5ndGggfHwgbGNzLnRpICsgbGNzLmxlbmd0aCA+PSBmLmxlbmd0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBlZGdlT3JkZXIucHVzaCh7IGw6IGksIHI6IGogfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAobGNzLnNpICsgbGNzLmxlbmd0aCA+PSBlLmxlbmd0aCB8fCBsY3MudGkgKyBsY3MubGVuZ3RoID49IGYubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdSA9IGVbbGNzLnNpICsgMV07XHJcbiAgICAgICAgICAgICAgICAgICAgdmogPSBlW2xjcy5zaSAtIDFdO1xyXG4gICAgICAgICAgICAgICAgICAgIHZpID0gZltsY3MudGkgLSAxXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHUgPSBlW2xjcy5zaSArIGxjcy5sZW5ndGggLSAyXTtcclxuICAgICAgICAgICAgICAgICAgICB2aSA9IGVbbGNzLnNpICsgbGNzLmxlbmd0aF07XHJcbiAgICAgICAgICAgICAgICAgICAgdmogPSBmW2xjcy50aSArIGxjcy5sZW5ndGhdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKEdyaWRSb3V0ZXIuaXNMZWZ0KHUsIHZpLCB2aikpIHtcclxuICAgICAgICAgICAgICAgICAgICBlZGdlT3JkZXIucHVzaCh7IGw6IGosIHI6IGkgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBlZGdlT3JkZXIucHVzaCh7IGw6IGksIHI6IGogfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIEdyaWRSb3V0ZXIuZ2V0T3JkZXIoZWRnZU9yZGVyKTtcclxuICAgIH07XHJcbiAgICBHcmlkUm91dGVyLm1ha2VTZWdtZW50cyA9IGZ1bmN0aW9uIChwYXRoKSB7XHJcbiAgICAgICAgZnVuY3Rpb24gY29weVBvaW50KHApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgeDogcC54LCB5OiBwLnkgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGlzU3RyYWlnaHQgPSBmdW5jdGlvbiAoYSwgYiwgYykgeyByZXR1cm4gTWF0aC5hYnMoKGIueCAtIGEueCkgKiAoYy55IC0gYS55KSAtIChiLnkgLSBhLnkpICogKGMueCAtIGEueCkpIDwgMC4wMDE7IH07XHJcbiAgICAgICAgdmFyIHNlZ21lbnRzID0gW107XHJcbiAgICAgICAgdmFyIGEgPSBjb3B5UG9pbnQocGF0aFswXSk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBwYXRoLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBiID0gY29weVBvaW50KHBhdGhbaV0pLCBjID0gaSA8IHBhdGgubGVuZ3RoIC0gMSA/IHBhdGhbaSArIDFdIDogbnVsbDtcclxuICAgICAgICAgICAgaWYgKCFjIHx8ICFpc1N0cmFpZ2h0KGEsIGIsIGMpKSB7XHJcbiAgICAgICAgICAgICAgICBzZWdtZW50cy5wdXNoKFthLCBiXSk7XHJcbiAgICAgICAgICAgICAgICBhID0gYjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc2VnbWVudHM7XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5wcm90b3R5cGUucm91dGUgPSBmdW5jdGlvbiAocywgdCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdmFyIHNvdXJjZSA9IHRoaXMubm9kZXNbc10sIHRhcmdldCA9IHRoaXMubm9kZXNbdF07XHJcbiAgICAgICAgdGhpcy5vYnN0YWNsZXMgPSB0aGlzLnNpYmxpbmdPYnN0YWNsZXMoc291cmNlLCB0YXJnZXQpO1xyXG4gICAgICAgIHZhciBvYnN0YWNsZUxvb2t1cCA9IHt9O1xyXG4gICAgICAgIHRoaXMub2JzdGFjbGVzLmZvckVhY2goZnVuY3Rpb24gKG8pIHsgcmV0dXJuIG9ic3RhY2xlTG9va3VwW28uaWRdID0gbzsgfSk7XHJcbiAgICAgICAgdGhpcy5wYXNzYWJsZUVkZ2VzID0gdGhpcy5lZGdlcy5maWx0ZXIoZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgdmFyIHUgPSBfdGhpcy52ZXJ0c1tlLnNvdXJjZV0sIHYgPSBfdGhpcy52ZXJ0c1tlLnRhcmdldF07XHJcbiAgICAgICAgICAgIHJldHVybiAhKHUubm9kZSAmJiB1Lm5vZGUuaWQgaW4gb2JzdGFjbGVMb29rdXBcclxuICAgICAgICAgICAgICAgIHx8IHYubm9kZSAmJiB2Lm5vZGUuaWQgaW4gb2JzdGFjbGVMb29rdXApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgc291cmNlLnBvcnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB1ID0gc291cmNlLnBvcnRzWzBdLmlkO1xyXG4gICAgICAgICAgICB2YXIgdiA9IHNvdXJjZS5wb3J0c1tpXS5pZDtcclxuICAgICAgICAgICAgdGhpcy5wYXNzYWJsZUVkZ2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgc291cmNlOiB1LFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiB2LFxyXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiAwXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHRhcmdldC5wb3J0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdSA9IHRhcmdldC5wb3J0c1swXS5pZDtcclxuICAgICAgICAgICAgdmFyIHYgPSB0YXJnZXQucG9ydHNbaV0uaWQ7XHJcbiAgICAgICAgICAgIHRoaXMucGFzc2FibGVFZGdlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHNvdXJjZTogdSxcclxuICAgICAgICAgICAgICAgIHRhcmdldDogdixcclxuICAgICAgICAgICAgICAgIGxlbmd0aDogMFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGdldFNvdXJjZSA9IGZ1bmN0aW9uIChlKSB7IHJldHVybiBlLnNvdXJjZTsgfSwgZ2V0VGFyZ2V0ID0gZnVuY3Rpb24gKGUpIHsgcmV0dXJuIGUudGFyZ2V0OyB9LCBnZXRMZW5ndGggPSBmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS5sZW5ndGg7IH07XHJcbiAgICAgICAgdmFyIHNob3J0ZXN0UGF0aENhbGN1bGF0b3IgPSBuZXcgc2hvcnRlc3RwYXRoc18xLkNhbGN1bGF0b3IodGhpcy52ZXJ0cy5sZW5ndGgsIHRoaXMucGFzc2FibGVFZGdlcywgZ2V0U291cmNlLCBnZXRUYXJnZXQsIGdldExlbmd0aCk7XHJcbiAgICAgICAgdmFyIGJlbmRQZW5hbHR5ID0gZnVuY3Rpb24gKHUsIHYsIHcpIHtcclxuICAgICAgICAgICAgdmFyIGEgPSBfdGhpcy52ZXJ0c1t1XSwgYiA9IF90aGlzLnZlcnRzW3ZdLCBjID0gX3RoaXMudmVydHNbd107XHJcbiAgICAgICAgICAgIHZhciBkeCA9IE1hdGguYWJzKGMueCAtIGEueCksIGR5ID0gTWF0aC5hYnMoYy55IC0gYS55KTtcclxuICAgICAgICAgICAgaWYgKGEubm9kZSA9PT0gc291cmNlICYmIGEubm9kZSA9PT0gYi5ub2RlIHx8IGIubm9kZSA9PT0gdGFyZ2V0ICYmIGIubm9kZSA9PT0gYy5ub2RlKVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgICAgIHJldHVybiBkeCA+IDEgJiYgZHkgPiAxID8gMTAwMCA6IDA7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB2YXIgc2hvcnRlc3RQYXRoID0gc2hvcnRlc3RQYXRoQ2FsY3VsYXRvci5QYXRoRnJvbU5vZGVUb05vZGVXaXRoUHJldkNvc3Qoc291cmNlLnBvcnRzWzBdLmlkLCB0YXJnZXQucG9ydHNbMF0uaWQsIGJlbmRQZW5hbHR5KTtcclxuICAgICAgICB2YXIgcGF0aFBvaW50cyA9IHNob3J0ZXN0UGF0aC5yZXZlcnNlKCkubWFwKGZ1bmN0aW9uICh2aSkgeyByZXR1cm4gX3RoaXMudmVydHNbdmldOyB9KTtcclxuICAgICAgICBwYXRoUG9pbnRzLnB1c2godGhpcy5ub2Rlc1t0YXJnZXQuaWRdLnBvcnRzWzBdKTtcclxuICAgICAgICByZXR1cm4gcGF0aFBvaW50cy5maWx0ZXIoZnVuY3Rpb24gKHYsIGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuICEoaSA8IHBhdGhQb2ludHMubGVuZ3RoIC0gMSAmJiBwYXRoUG9pbnRzW2kgKyAxXS5ub2RlID09PSBzb3VyY2UgJiYgdi5ub2RlID09PSBzb3VyY2VcclxuICAgICAgICAgICAgICAgIHx8IGkgPiAwICYmIHYubm9kZSA9PT0gdGFyZ2V0ICYmIHBhdGhQb2ludHNbaSAtIDFdLm5vZGUgPT09IHRhcmdldCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgR3JpZFJvdXRlci5nZXRSb3V0ZVBhdGggPSBmdW5jdGlvbiAocm91dGUsIGNvcm5lcnJhZGl1cywgYXJyb3d3aWR0aCwgYXJyb3doZWlnaHQpIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICByb3V0ZXBhdGg6ICdNICcgKyByb3V0ZVswXVswXS54ICsgJyAnICsgcm91dGVbMF1bMF0ueSArICcgJyxcclxuICAgICAgICAgICAgYXJyb3dwYXRoOiAnJ1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgaWYgKHJvdXRlLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByb3V0ZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdmFyIGxpID0gcm91dGVbaV07XHJcbiAgICAgICAgICAgICAgICB2YXIgeCA9IGxpWzFdLngsIHkgPSBsaVsxXS55O1xyXG4gICAgICAgICAgICAgICAgdmFyIGR4ID0geCAtIGxpWzBdLng7XHJcbiAgICAgICAgICAgICAgICB2YXIgZHkgPSB5IC0gbGlbMF0ueTtcclxuICAgICAgICAgICAgICAgIGlmIChpIDwgcm91dGUubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhkeCkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHggLT0gZHggLyBNYXRoLmFicyhkeCkgKiBjb3JuZXJyYWRpdXM7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB5IC09IGR5IC8gTWF0aC5hYnMoZHkpICogY29ybmVycmFkaXVzO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucm91dGVwYXRoICs9ICdMICcgKyB4ICsgJyAnICsgeSArICcgJztcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbCA9IHJvdXRlW2kgKyAxXTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgeDAgPSBsWzBdLngsIHkwID0gbFswXS55O1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciB4MSA9IGxbMV0ueDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgeTEgPSBsWzFdLnk7XHJcbiAgICAgICAgICAgICAgICAgICAgZHggPSB4MSAtIHgwO1xyXG4gICAgICAgICAgICAgICAgICAgIGR5ID0geTEgLSB5MDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYW5nbGUgPSBHcmlkUm91dGVyLmFuZ2xlQmV0d2VlbjJMaW5lcyhsaSwgbCkgPCAwID8gMSA6IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHgyLCB5MjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoZHgpID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB4MiA9IHgwICsgZHggLyBNYXRoLmFicyhkeCkgKiBjb3JuZXJyYWRpdXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHkyID0geTA7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB4MiA9IHgwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB5MiA9IHkwICsgZHkgLyBNYXRoLmFicyhkeSkgKiBjb3JuZXJyYWRpdXM7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjeCA9IE1hdGguYWJzKHgyIC0geCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN5ID0gTWF0aC5hYnMoeTIgLSB5KTtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucm91dGVwYXRoICs9ICdBICcgKyBjeCArICcgJyArIGN5ICsgJyAwIDAgJyArIGFuZ2xlICsgJyAnICsgeDIgKyAnICcgKyB5MiArICcgJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBhcnJvd3RpcCA9IFt4LCB5XTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYXJyb3djb3JuZXIxLCBhcnJvd2Nvcm5lcjI7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKE1hdGguYWJzKGR4KSA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgeCAtPSBkeCAvIE1hdGguYWJzKGR4KSAqIGFycm93aGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJvd2Nvcm5lcjEgPSBbeCwgeSArIGFycm93d2lkdGhdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJvd2Nvcm5lcjIgPSBbeCwgeSAtIGFycm93d2lkdGhdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgeSAtPSBkeSAvIE1hdGguYWJzKGR5KSAqIGFycm93aGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJvd2Nvcm5lcjEgPSBbeCArIGFycm93d2lkdGgsIHldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJvd2Nvcm5lcjIgPSBbeCAtIGFycm93d2lkdGgsIHldO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQucm91dGVwYXRoICs9ICdMICcgKyB4ICsgJyAnICsgeSArICcgJztcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXJyb3doZWlnaHQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5hcnJvd3BhdGggPSAnTSAnICsgYXJyb3d0aXBbMF0gKyAnICcgKyBhcnJvd3RpcFsxXSArICcgTCAnICsgYXJyb3djb3JuZXIxWzBdICsgJyAnICsgYXJyb3djb3JuZXIxWzFdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICArICcgTCAnICsgYXJyb3djb3JuZXIyWzBdICsgJyAnICsgYXJyb3djb3JuZXIyWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGxpID0gcm91dGVbMF07XHJcbiAgICAgICAgICAgIHZhciB4ID0gbGlbMV0ueCwgeSA9IGxpWzFdLnk7XHJcbiAgICAgICAgICAgIHZhciBkeCA9IHggLSBsaVswXS54O1xyXG4gICAgICAgICAgICB2YXIgZHkgPSB5IC0gbGlbMF0ueTtcclxuICAgICAgICAgICAgdmFyIGFycm93dGlwID0gW3gsIHldO1xyXG4gICAgICAgICAgICB2YXIgYXJyb3djb3JuZXIxLCBhcnJvd2Nvcm5lcjI7XHJcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhkeCkgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICB4IC09IGR4IC8gTWF0aC5hYnMoZHgpICogYXJyb3doZWlnaHQ7XHJcbiAgICAgICAgICAgICAgICBhcnJvd2Nvcm5lcjEgPSBbeCwgeSArIGFycm93d2lkdGhdO1xyXG4gICAgICAgICAgICAgICAgYXJyb3djb3JuZXIyID0gW3gsIHkgLSBhcnJvd3dpZHRoXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHkgLT0gZHkgLyBNYXRoLmFicyhkeSkgKiBhcnJvd2hlaWdodDtcclxuICAgICAgICAgICAgICAgIGFycm93Y29ybmVyMSA9IFt4ICsgYXJyb3d3aWR0aCwgeV07XHJcbiAgICAgICAgICAgICAgICBhcnJvd2Nvcm5lcjIgPSBbeCAtIGFycm93d2lkdGgsIHldO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlc3VsdC5yb3V0ZXBhdGggKz0gJ0wgJyArIHggKyAnICcgKyB5ICsgJyAnO1xyXG4gICAgICAgICAgICBpZiAoYXJyb3doZWlnaHQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQuYXJyb3dwYXRoID0gJ00gJyArIGFycm93dGlwWzBdICsgJyAnICsgYXJyb3d0aXBbMV0gKyAnIEwgJyArIGFycm93Y29ybmVyMVswXSArICcgJyArIGFycm93Y29ybmVyMVsxXVxyXG4gICAgICAgICAgICAgICAgICAgICsgJyBMICcgKyBhcnJvd2Nvcm5lcjJbMF0gKyAnICcgKyBhcnJvd2Nvcm5lcjJbMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gR3JpZFJvdXRlcjtcclxufSgpKTtcclxuZXhwb3J0cy5HcmlkUm91dGVyID0gR3JpZFJvdXRlcjtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z3JpZHJvdXRlci5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG52YXIgcGFja2luZ09wdGlvbnMgPSB7XHJcbiAgICBQQURESU5HOiAxMCxcclxuICAgIEdPTERFTl9TRUNUSU9OOiAoMSArIE1hdGguc3FydCg1KSkgLyAyLFxyXG4gICAgRkxPQVRfRVBTSUxPTjogMC4wMDAxLFxyXG4gICAgTUFYX0lORVJBVElPTlM6IDEwMFxyXG59O1xyXG5mdW5jdGlvbiBhcHBseVBhY2tpbmcoZ3JhcGhzLCB3LCBoLCBub2RlX3NpemUsIGRlc2lyZWRfcmF0aW8pIHtcclxuICAgIGlmIChkZXNpcmVkX3JhdGlvID09PSB2b2lkIDApIHsgZGVzaXJlZF9yYXRpbyA9IDE7IH1cclxuICAgIHZhciBpbml0X3ggPSAwLCBpbml0X3kgPSAwLCBzdmdfd2lkdGggPSB3LCBzdmdfaGVpZ2h0ID0gaCwgZGVzaXJlZF9yYXRpbyA9IHR5cGVvZiBkZXNpcmVkX3JhdGlvICE9PSAndW5kZWZpbmVkJyA/IGRlc2lyZWRfcmF0aW8gOiAxLCBub2RlX3NpemUgPSB0eXBlb2Ygbm9kZV9zaXplICE9PSAndW5kZWZpbmVkJyA/IG5vZGVfc2l6ZSA6IDAsIHJlYWxfd2lkdGggPSAwLCByZWFsX2hlaWdodCA9IDAsIG1pbl93aWR0aCA9IDAsIGdsb2JhbF9ib3R0b20gPSAwLCBsaW5lID0gW107XHJcbiAgICBpZiAoZ3JhcGhzLmxlbmd0aCA9PSAwKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGNhbGN1bGF0ZV9iYihncmFwaHMpO1xyXG4gICAgYXBwbHkoZ3JhcGhzLCBkZXNpcmVkX3JhdGlvKTtcclxuICAgIHB1dF9ub2Rlc190b19yaWdodF9wb3NpdGlvbnMoZ3JhcGhzKTtcclxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZV9iYihncmFwaHMpIHtcclxuICAgICAgICBncmFwaHMuZm9yRWFjaChmdW5jdGlvbiAoZykge1xyXG4gICAgICAgICAgICBjYWxjdWxhdGVfc2luZ2xlX2JiKGcpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZV9zaW5nbGVfYmIoZ3JhcGgpIHtcclxuICAgICAgICAgICAgdmFyIG1pbl94ID0gTnVtYmVyLk1BWF9WQUxVRSwgbWluX3kgPSBOdW1iZXIuTUFYX1ZBTFVFLCBtYXhfeCA9IDAsIG1heF95ID0gMDtcclxuICAgICAgICAgICAgZ3JhcGguYXJyYXkuZm9yRWFjaChmdW5jdGlvbiAodikge1xyXG4gICAgICAgICAgICAgICAgdmFyIHcgPSB0eXBlb2Ygdi53aWR0aCAhPT0gJ3VuZGVmaW5lZCcgPyB2LndpZHRoIDogbm9kZV9zaXplO1xyXG4gICAgICAgICAgICAgICAgdmFyIGggPSB0eXBlb2Ygdi5oZWlnaHQgIT09ICd1bmRlZmluZWQnID8gdi5oZWlnaHQgOiBub2RlX3NpemU7XHJcbiAgICAgICAgICAgICAgICB3IC89IDI7XHJcbiAgICAgICAgICAgICAgICBoIC89IDI7XHJcbiAgICAgICAgICAgICAgICBtYXhfeCA9IE1hdGgubWF4KHYueCArIHcsIG1heF94KTtcclxuICAgICAgICAgICAgICAgIG1pbl94ID0gTWF0aC5taW4odi54IC0gdywgbWluX3gpO1xyXG4gICAgICAgICAgICAgICAgbWF4X3kgPSBNYXRoLm1heCh2LnkgKyBoLCBtYXhfeSk7XHJcbiAgICAgICAgICAgICAgICBtaW5feSA9IE1hdGgubWluKHYueSAtIGgsIG1pbl95KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGdyYXBoLndpZHRoID0gbWF4X3ggLSBtaW5feDtcclxuICAgICAgICAgICAgZ3JhcGguaGVpZ2h0ID0gbWF4X3kgLSBtaW5feTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBwdXRfbm9kZXNfdG9fcmlnaHRfcG9zaXRpb25zKGdyYXBocykge1xyXG4gICAgICAgIGdyYXBocy5mb3JFYWNoKGZ1bmN0aW9uIChnKSB7XHJcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSB7IHg6IDAsIHk6IDAgfTtcclxuICAgICAgICAgICAgZy5hcnJheS5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XHJcbiAgICAgICAgICAgICAgICBjZW50ZXIueCArPSBub2RlLng7XHJcbiAgICAgICAgICAgICAgICBjZW50ZXIueSArPSBub2RlLnk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBjZW50ZXIueCAvPSBnLmFycmF5Lmxlbmd0aDtcclxuICAgICAgICAgICAgY2VudGVyLnkgLz0gZy5hcnJheS5sZW5ndGg7XHJcbiAgICAgICAgICAgIHZhciBjb3JuZXIgPSB7IHg6IGNlbnRlci54IC0gZy53aWR0aCAvIDIsIHk6IGNlbnRlci55IC0gZy5oZWlnaHQgLyAyIH07XHJcbiAgICAgICAgICAgIHZhciBvZmZzZXQgPSB7IHg6IGcueCAtIGNvcm5lci54ICsgc3ZnX3dpZHRoIC8gMiAtIHJlYWxfd2lkdGggLyAyLCB5OiBnLnkgLSBjb3JuZXIueSArIHN2Z19oZWlnaHQgLyAyIC0gcmVhbF9oZWlnaHQgLyAyIH07XHJcbiAgICAgICAgICAgIGcuYXJyYXkuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgICAgICAgICAgbm9kZS54ICs9IG9mZnNldC54O1xyXG4gICAgICAgICAgICAgICAgbm9kZS55ICs9IG9mZnNldC55O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGFwcGx5KGRhdGEsIGRlc2lyZWRfcmF0aW8pIHtcclxuICAgICAgICB2YXIgY3Vycl9iZXN0X2YgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XHJcbiAgICAgICAgdmFyIGN1cnJfYmVzdCA9IDA7XHJcbiAgICAgICAgZGF0YS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBiLmhlaWdodCAtIGEuaGVpZ2h0OyB9KTtcclxuICAgICAgICBtaW5fd2lkdGggPSBkYXRhLnJlZHVjZShmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgICAgICByZXR1cm4gYS53aWR0aCA8IGIud2lkdGggPyBhLndpZHRoIDogYi53aWR0aDtcclxuICAgICAgICB9KTtcclxuICAgICAgICB2YXIgbGVmdCA9IHgxID0gbWluX3dpZHRoO1xyXG4gICAgICAgIHZhciByaWdodCA9IHgyID0gZ2V0X2VudGlyZV93aWR0aChkYXRhKTtcclxuICAgICAgICB2YXIgaXRlcmF0aW9uQ291bnRlciA9IDA7XHJcbiAgICAgICAgdmFyIGZfeDEgPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgICAgIHZhciBmX3gyID0gTnVtYmVyLk1BWF9WQUxVRTtcclxuICAgICAgICB2YXIgZmxhZyA9IC0xO1xyXG4gICAgICAgIHZhciBkeCA9IE51bWJlci5NQVhfVkFMVUU7XHJcbiAgICAgICAgdmFyIGRmID0gTnVtYmVyLk1BWF9WQUxVRTtcclxuICAgICAgICB3aGlsZSAoKGR4ID4gbWluX3dpZHRoKSB8fCBkZiA+IHBhY2tpbmdPcHRpb25zLkZMT0FUX0VQU0lMT04pIHtcclxuICAgICAgICAgICAgaWYgKGZsYWcgIT0gMSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHgxID0gcmlnaHQgLSAocmlnaHQgLSBsZWZ0KSAvIHBhY2tpbmdPcHRpb25zLkdPTERFTl9TRUNUSU9OO1xyXG4gICAgICAgICAgICAgICAgdmFyIGZfeDEgPSBzdGVwKGRhdGEsIHgxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZmxhZyAhPSAwKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgeDIgPSBsZWZ0ICsgKHJpZ2h0IC0gbGVmdCkgLyBwYWNraW5nT3B0aW9ucy5HT0xERU5fU0VDVElPTjtcclxuICAgICAgICAgICAgICAgIHZhciBmX3gyID0gc3RlcChkYXRhLCB4Mik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZHggPSBNYXRoLmFicyh4MSAtIHgyKTtcclxuICAgICAgICAgICAgZGYgPSBNYXRoLmFicyhmX3gxIC0gZl94Mik7XHJcbiAgICAgICAgICAgIGlmIChmX3gxIDwgY3Vycl9iZXN0X2YpIHtcclxuICAgICAgICAgICAgICAgIGN1cnJfYmVzdF9mID0gZl94MTtcclxuICAgICAgICAgICAgICAgIGN1cnJfYmVzdCA9IHgxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChmX3gyIDwgY3Vycl9iZXN0X2YpIHtcclxuICAgICAgICAgICAgICAgIGN1cnJfYmVzdF9mID0gZl94MjtcclxuICAgICAgICAgICAgICAgIGN1cnJfYmVzdCA9IHgyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChmX3gxID4gZl94Mikge1xyXG4gICAgICAgICAgICAgICAgbGVmdCA9IHgxO1xyXG4gICAgICAgICAgICAgICAgeDEgPSB4MjtcclxuICAgICAgICAgICAgICAgIGZfeDEgPSBmX3gyO1xyXG4gICAgICAgICAgICAgICAgZmxhZyA9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByaWdodCA9IHgyO1xyXG4gICAgICAgICAgICAgICAgeDIgPSB4MTtcclxuICAgICAgICAgICAgICAgIGZfeDIgPSBmX3gxO1xyXG4gICAgICAgICAgICAgICAgZmxhZyA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGl0ZXJhdGlvbkNvdW50ZXIrKyA+IDEwMCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc3RlcChkYXRhLCBjdXJyX2Jlc3QpO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChkYXRhLCBtYXhfd2lkdGgpIHtcclxuICAgICAgICBsaW5lID0gW107XHJcbiAgICAgICAgcmVhbF93aWR0aCA9IDA7XHJcbiAgICAgICAgcmVhbF9oZWlnaHQgPSAwO1xyXG4gICAgICAgIGdsb2JhbF9ib3R0b20gPSBpbml0X3k7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBvID0gZGF0YVtpXTtcclxuICAgICAgICAgICAgcHV0X3JlY3QobywgbWF4X3dpZHRoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIE1hdGguYWJzKGdldF9yZWFsX3JhdGlvKCkgLSBkZXNpcmVkX3JhdGlvKTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHB1dF9yZWN0KHJlY3QsIG1heF93aWR0aCkge1xyXG4gICAgICAgIHZhciBwYXJlbnQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmICgobGluZVtpXS5zcGFjZV9sZWZ0ID49IHJlY3QuaGVpZ2h0KSAmJiAobGluZVtpXS54ICsgbGluZVtpXS53aWR0aCArIHJlY3Qud2lkdGggKyBwYWNraW5nT3B0aW9ucy5QQURESU5HIC0gbWF4X3dpZHRoKSA8PSBwYWNraW5nT3B0aW9ucy5GTE9BVF9FUFNJTE9OKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBsaW5lW2ldO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgbGluZS5wdXNoKHJlY3QpO1xyXG4gICAgICAgIGlmIChwYXJlbnQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZWN0LnggPSBwYXJlbnQueCArIHBhcmVudC53aWR0aCArIHBhY2tpbmdPcHRpb25zLlBBRERJTkc7XHJcbiAgICAgICAgICAgIHJlY3QueSA9IHBhcmVudC5ib3R0b207XHJcbiAgICAgICAgICAgIHJlY3Quc3BhY2VfbGVmdCA9IHJlY3QuaGVpZ2h0O1xyXG4gICAgICAgICAgICByZWN0LmJvdHRvbSA9IHJlY3QueTtcclxuICAgICAgICAgICAgcGFyZW50LnNwYWNlX2xlZnQgLT0gcmVjdC5oZWlnaHQgKyBwYWNraW5nT3B0aW9ucy5QQURESU5HO1xyXG4gICAgICAgICAgICBwYXJlbnQuYm90dG9tICs9IHJlY3QuaGVpZ2h0ICsgcGFja2luZ09wdGlvbnMuUEFERElORztcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHJlY3QueSA9IGdsb2JhbF9ib3R0b207XHJcbiAgICAgICAgICAgIGdsb2JhbF9ib3R0b20gKz0gcmVjdC5oZWlnaHQgKyBwYWNraW5nT3B0aW9ucy5QQURESU5HO1xyXG4gICAgICAgICAgICByZWN0LnggPSBpbml0X3g7XHJcbiAgICAgICAgICAgIHJlY3QuYm90dG9tID0gcmVjdC55O1xyXG4gICAgICAgICAgICByZWN0LnNwYWNlX2xlZnQgPSByZWN0LmhlaWdodDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJlY3QueSArIHJlY3QuaGVpZ2h0IC0gcmVhbF9oZWlnaHQgPiAtcGFja2luZ09wdGlvbnMuRkxPQVRfRVBTSUxPTilcclxuICAgICAgICAgICAgcmVhbF9oZWlnaHQgPSByZWN0LnkgKyByZWN0LmhlaWdodCAtIGluaXRfeTtcclxuICAgICAgICBpZiAocmVjdC54ICsgcmVjdC53aWR0aCAtIHJlYWxfd2lkdGggPiAtcGFja2luZ09wdGlvbnMuRkxPQVRfRVBTSUxPTilcclxuICAgICAgICAgICAgcmVhbF93aWR0aCA9IHJlY3QueCArIHJlY3Qud2lkdGggLSBpbml0X3g7XHJcbiAgICB9XHJcbiAgICA7XHJcbiAgICBmdW5jdGlvbiBnZXRfZW50aXJlX3dpZHRoKGRhdGEpIHtcclxuICAgICAgICB2YXIgd2lkdGggPSAwO1xyXG4gICAgICAgIGRhdGEuZm9yRWFjaChmdW5jdGlvbiAoZCkgeyByZXR1cm4gd2lkdGggKz0gZC53aWR0aCArIHBhY2tpbmdPcHRpb25zLlBBRERJTkc7IH0pO1xyXG4gICAgICAgIHJldHVybiB3aWR0aDtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldF9yZWFsX3JhdGlvKCkge1xyXG4gICAgICAgIHJldHVybiAocmVhbF93aWR0aCAvIHJlYWxfaGVpZ2h0KTtcclxuICAgIH1cclxufVxyXG5leHBvcnRzLmFwcGx5UGFja2luZyA9IGFwcGx5UGFja2luZztcclxuZnVuY3Rpb24gc2VwYXJhdGVHcmFwaHMobm9kZXMsIGxpbmtzKSB7XHJcbiAgICB2YXIgbWFya3MgPSB7fTtcclxuICAgIHZhciB3YXlzID0ge307XHJcbiAgICB2YXIgZ3JhcGhzID0gW107XHJcbiAgICB2YXIgY2x1c3RlcnMgPSAwO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBsaW5rID0gbGlua3NbaV07XHJcbiAgICAgICAgdmFyIG4xID0gbGluay5zb3VyY2U7XHJcbiAgICAgICAgdmFyIG4yID0gbGluay50YXJnZXQ7XHJcbiAgICAgICAgaWYgKHdheXNbbjEuaW5kZXhdKVxyXG4gICAgICAgICAgICB3YXlzW24xLmluZGV4XS5wdXNoKG4yKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHdheXNbbjEuaW5kZXhdID0gW24yXTtcclxuICAgICAgICBpZiAod2F5c1tuMi5pbmRleF0pXHJcbiAgICAgICAgICAgIHdheXNbbjIuaW5kZXhdLnB1c2gobjEpO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgd2F5c1tuMi5pbmRleF0gPSBbbjFdO1xyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBub2RlID0gbm9kZXNbaV07XHJcbiAgICAgICAgaWYgKG1hcmtzW25vZGUuaW5kZXhdKVxyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICBleHBsb3JlX25vZGUobm9kZSwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBleHBsb3JlX25vZGUobiwgaXNfbmV3KSB7XHJcbiAgICAgICAgaWYgKG1hcmtzW24uaW5kZXhdICE9PSB1bmRlZmluZWQpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICBpZiAoaXNfbmV3KSB7XHJcbiAgICAgICAgICAgIGNsdXN0ZXJzKys7XHJcbiAgICAgICAgICAgIGdyYXBocy5wdXNoKHsgYXJyYXk6IFtdIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBtYXJrc1tuLmluZGV4XSA9IGNsdXN0ZXJzO1xyXG4gICAgICAgIGdyYXBoc1tjbHVzdGVycyAtIDFdLmFycmF5LnB1c2gobik7XHJcbiAgICAgICAgdmFyIGFkamFjZW50ID0gd2F5c1tuLmluZGV4XTtcclxuICAgICAgICBpZiAoIWFkamFjZW50KVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBhZGphY2VudC5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICBleHBsb3JlX25vZGUoYWRqYWNlbnRbal0sIGZhbHNlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZ3JhcGhzO1xyXG59XHJcbmV4cG9ydHMuc2VwYXJhdGVHcmFwaHMgPSBzZXBhcmF0ZUdyYXBocztcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aGFuZGxlZGlzY29ubmVjdGVkLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbnZhciBwb3dlcmdyYXBoID0gcmVxdWlyZShcIi4vcG93ZXJncmFwaFwiKTtcclxudmFyIGxpbmtsZW5ndGhzXzEgPSByZXF1aXJlKFwiLi9saW5rbGVuZ3Roc1wiKTtcclxudmFyIGRlc2NlbnRfMSA9IHJlcXVpcmUoXCIuL2Rlc2NlbnRcIik7XHJcbnZhciByZWN0YW5nbGVfMSA9IHJlcXVpcmUoXCIuL3JlY3RhbmdsZVwiKTtcclxudmFyIHNob3J0ZXN0cGF0aHNfMSA9IHJlcXVpcmUoXCIuL3Nob3J0ZXN0cGF0aHNcIik7XHJcbnZhciBnZW9tXzEgPSByZXF1aXJlKFwiLi9nZW9tXCIpO1xyXG52YXIgaGFuZGxlZGlzY29ubmVjdGVkXzEgPSByZXF1aXJlKFwiLi9oYW5kbGVkaXNjb25uZWN0ZWRcIik7XHJcbnZhciBFdmVudFR5cGU7XHJcbihmdW5jdGlvbiAoRXZlbnRUeXBlKSB7XHJcbiAgICBFdmVudFR5cGVbRXZlbnRUeXBlW1wic3RhcnRcIl0gPSAwXSA9IFwic3RhcnRcIjtcclxuICAgIEV2ZW50VHlwZVtFdmVudFR5cGVbXCJ0aWNrXCJdID0gMV0gPSBcInRpY2tcIjtcclxuICAgIEV2ZW50VHlwZVtFdmVudFR5cGVbXCJlbmRcIl0gPSAyXSA9IFwiZW5kXCI7XHJcbn0pKEV2ZW50VHlwZSA9IGV4cG9ydHMuRXZlbnRUeXBlIHx8IChleHBvcnRzLkV2ZW50VHlwZSA9IHt9KSk7XHJcbjtcclxuZnVuY3Rpb24gaXNHcm91cChnKSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIGcubGVhdmVzICE9PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgZy5ncm91cHMgIT09ICd1bmRlZmluZWQnO1xyXG59XHJcbnZhciBMYXlvdXQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gTGF5b3V0KCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdGhpcy5fY2FudmFzU2l6ZSA9IFsxLCAxXTtcclxuICAgICAgICB0aGlzLl9saW5rRGlzdGFuY2UgPSAyMDtcclxuICAgICAgICB0aGlzLl9kZWZhdWx0Tm9kZVNpemUgPSAxMDtcclxuICAgICAgICB0aGlzLl9saW5rTGVuZ3RoQ2FsY3VsYXRvciA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fbGlua1R5cGUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2F2b2lkT3ZlcmxhcHMgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLl9oYW5kbGVEaXNjb25uZWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLl9ub2RlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuX2dyb3VwcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuX3Jvb3RHcm91cCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fbGlua3MgPSBbXTtcclxuICAgICAgICB0aGlzLl9jb25zdHJhaW50cyA9IFtdO1xyXG4gICAgICAgIHRoaXMuX2Rpc3RhbmNlTWF0cml4ID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9kZXNjZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9kaXJlY3RlZExpbmtDb25zdHJhaW50cyA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5fdGhyZXNob2xkID0gMC4wMTtcclxuICAgICAgICB0aGlzLl92aXNpYmlsaXR5R3JhcGggPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX2dyb3VwQ29tcGFjdG5lc3MgPSAxZS02O1xyXG4gICAgICAgIHRoaXMuZXZlbnQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMubGlua0FjY2Vzc29yID0ge1xyXG4gICAgICAgICAgICBnZXRTb3VyY2VJbmRleDogTGF5b3V0LmdldFNvdXJjZUluZGV4LFxyXG4gICAgICAgICAgICBnZXRUYXJnZXRJbmRleDogTGF5b3V0LmdldFRhcmdldEluZGV4LFxyXG4gICAgICAgICAgICBzZXRMZW5ndGg6IExheW91dC5zZXRMaW5rTGVuZ3RoLFxyXG4gICAgICAgICAgICBnZXRUeXBlOiBmdW5jdGlvbiAobCkgeyByZXR1cm4gdHlwZW9mIF90aGlzLl9saW5rVHlwZSA9PT0gXCJmdW5jdGlvblwiID8gX3RoaXMuX2xpbmtUeXBlKGwpIDogMDsgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGUsIGxpc3RlbmVyKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmV2ZW50KVxyXG4gICAgICAgICAgICB0aGlzLmV2ZW50ID0ge307XHJcbiAgICAgICAgaWYgKHR5cGVvZiBlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB0aGlzLmV2ZW50W0V2ZW50VHlwZVtlXV0gPSBsaXN0ZW5lcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZlbnRbZV0gPSBsaXN0ZW5lcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAodGhpcy5ldmVudCAmJiB0eXBlb2YgdGhpcy5ldmVudFtlLnR5cGVdICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICB0aGlzLmV2ZW50W2UudHlwZV0oZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUua2ljayA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB3aGlsZSAoIXRoaXMudGljaygpKVxyXG4gICAgICAgICAgICA7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLl9hbHBoYSA8IHRoaXMuX3RocmVzaG9sZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9ydW5uaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcih7IHR5cGU6IEV2ZW50VHlwZS5lbmQsIGFscGhhOiB0aGlzLl9hbHBoYSA9IDAsIHN0cmVzczogdGhpcy5fbGFzdFN0cmVzcyB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBuID0gdGhpcy5fbm9kZXMubGVuZ3RoLCBtID0gdGhpcy5fbGlua3MubGVuZ3RoO1xyXG4gICAgICAgIHZhciBvLCBpO1xyXG4gICAgICAgIHRoaXMuX2Rlc2NlbnQubG9ja3MuY2xlYXIoKTtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcbiAgICAgICAgICAgIG8gPSB0aGlzLl9ub2Rlc1tpXTtcclxuICAgICAgICAgICAgaWYgKG8uZml4ZWQpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygby5weCA9PT0gJ3VuZGVmaW5lZCcgfHwgdHlwZW9mIG8ucHkgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgby5weCA9IG8ueDtcclxuICAgICAgICAgICAgICAgICAgICBvLnB5ID0gby55O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHAgPSBbby5weCwgby5weV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXNjZW50LmxvY2tzLmFkZChpLCBwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgczEgPSB0aGlzLl9kZXNjZW50LnJ1bmdlS3V0dGEoKTtcclxuICAgICAgICBpZiAoczEgPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy5fYWxwaGEgPSAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgdGhpcy5fbGFzdFN0cmVzcyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgdGhpcy5fYWxwaGEgPSBzMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fbGFzdFN0cmVzcyA9IHMxO1xyXG4gICAgICAgIHRoaXMudXBkYXRlTm9kZVBvc2l0aW9ucygpO1xyXG4gICAgICAgIHRoaXMudHJpZ2dlcih7IHR5cGU6IEV2ZW50VHlwZS50aWNrLCBhbHBoYTogdGhpcy5fYWxwaGEsIHN0cmVzczogdGhpcy5fbGFzdFN0cmVzcyB9KTtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS51cGRhdGVOb2RlUG9zaXRpb25zID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciB4ID0gdGhpcy5fZGVzY2VudC54WzBdLCB5ID0gdGhpcy5fZGVzY2VudC54WzFdO1xyXG4gICAgICAgIHZhciBvLCBpID0gdGhpcy5fbm9kZXMubGVuZ3RoO1xyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcclxuICAgICAgICAgICAgbyA9IHRoaXMuX25vZGVzW2ldO1xyXG4gICAgICAgICAgICBvLnggPSB4W2ldO1xyXG4gICAgICAgICAgICBvLnkgPSB5W2ldO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLm5vZGVzID0gZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICBpZiAoIXYpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX25vZGVzLmxlbmd0aCA9PT0gMCAmJiB0aGlzLl9saW5rcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbiA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9saW5rcy5mb3JFYWNoKGZ1bmN0aW9uIChsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbiA9IE1hdGgubWF4KG4sIGwuc291cmNlLCBsLnRhcmdldCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX25vZGVzID0gbmV3IEFycmF5KCsrbik7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX25vZGVzW2ldID0ge307XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX25vZGVzO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9ub2RlcyA9IHY7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5ncm91cHMgPSBmdW5jdGlvbiAoeCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKCF4KVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZ3JvdXBzO1xyXG4gICAgICAgIHRoaXMuX2dyb3VwcyA9IHg7XHJcbiAgICAgICAgdGhpcy5fcm9vdEdyb3VwID0ge307XHJcbiAgICAgICAgdGhpcy5fZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGcpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBnLnBhZGRpbmcgPT09IFwidW5kZWZpbmVkXCIpXHJcbiAgICAgICAgICAgICAgICBnLnBhZGRpbmcgPSAxO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGcubGVhdmVzICE9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgICAgICBnLmxlYXZlcy5mb3JFYWNoKGZ1bmN0aW9uICh2LCBpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSAnbnVtYmVyJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGcubGVhdmVzW2ldID0gX3RoaXMuX25vZGVzW3ZdKS5wYXJlbnQgPSBnO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBnLmdyb3VwcyAhPT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICAgICAgICAgICAgZy5ncm91cHMuZm9yRWFjaChmdW5jdGlvbiAoZ2ksIGkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGdpID09PSAnbnVtYmVyJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgKGcuZ3JvdXBzW2ldID0gX3RoaXMuX2dyb3Vwc1tnaV0pLnBhcmVudCA9IGc7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuX3Jvb3RHcm91cC5sZWF2ZXMgPSB0aGlzLl9ub2Rlcy5maWx0ZXIoZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHR5cGVvZiB2LnBhcmVudCA9PT0gJ3VuZGVmaW5lZCc7IH0pO1xyXG4gICAgICAgIHRoaXMuX3Jvb3RHcm91cC5ncm91cHMgPSB0aGlzLl9ncm91cHMuZmlsdGVyKGZ1bmN0aW9uIChnKSB7IHJldHVybiB0eXBlb2YgZy5wYXJlbnQgPT09ICd1bmRlZmluZWQnOyB9KTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLnBvd2VyR3JhcGhHcm91cHMgPSBmdW5jdGlvbiAoZikge1xyXG4gICAgICAgIHZhciBnID0gcG93ZXJncmFwaC5nZXRHcm91cHModGhpcy5fbm9kZXMsIHRoaXMuX2xpbmtzLCB0aGlzLmxpbmtBY2Nlc3NvciwgdGhpcy5fcm9vdEdyb3VwKTtcclxuICAgICAgICB0aGlzLmdyb3VwcyhnLmdyb3Vwcyk7XHJcbiAgICAgICAgZihnKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLmF2b2lkT3ZlcmxhcHMgPSBmdW5jdGlvbiAodikge1xyXG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2F2b2lkT3ZlcmxhcHM7XHJcbiAgICAgICAgdGhpcy5fYXZvaWRPdmVybGFwcyA9IHY7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5oYW5kbGVEaXNjb25uZWN0ZWQgPSBmdW5jdGlvbiAodikge1xyXG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2hhbmRsZURpc2Nvbm5lY3RlZDtcclxuICAgICAgICB0aGlzLl9oYW5kbGVEaXNjb25uZWN0ZWQgPSB2O1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuZmxvd0xheW91dCA9IGZ1bmN0aW9uIChheGlzLCBtaW5TZXBhcmF0aW9uKSB7XHJcbiAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKVxyXG4gICAgICAgICAgICBheGlzID0gJ3knO1xyXG4gICAgICAgIHRoaXMuX2RpcmVjdGVkTGlua0NvbnN0cmFpbnRzID0ge1xyXG4gICAgICAgICAgICBheGlzOiBheGlzLFxyXG4gICAgICAgICAgICBnZXRNaW5TZXBhcmF0aW9uOiB0eXBlb2YgbWluU2VwYXJhdGlvbiA9PT0gJ251bWJlcicgPyBmdW5jdGlvbiAoKSB7IHJldHVybiBtaW5TZXBhcmF0aW9uOyB9IDogbWluU2VwYXJhdGlvblxyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5saW5rcyA9IGZ1bmN0aW9uICh4KSB7XHJcbiAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlua3M7XHJcbiAgICAgICAgdGhpcy5fbGlua3MgPSB4O1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuY29uc3RyYWludHMgPSBmdW5jdGlvbiAoYykge1xyXG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnN0cmFpbnRzO1xyXG4gICAgICAgIHRoaXMuX2NvbnN0cmFpbnRzID0gYztcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLmRpc3RhbmNlTWF0cml4ID0gZnVuY3Rpb24gKGQpIHtcclxuICAgICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9kaXN0YW5jZU1hdHJpeDtcclxuICAgICAgICB0aGlzLl9kaXN0YW5jZU1hdHJpeCA9IGQ7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24gKHgpIHtcclxuICAgICAgICBpZiAoIXgpXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jYW52YXNTaXplO1xyXG4gICAgICAgIHRoaXMuX2NhbnZhc1NpemUgPSB4O1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuZGVmYXVsdE5vZGVTaXplID0gZnVuY3Rpb24gKHgpIHtcclxuICAgICAgICBpZiAoIXgpXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0Tm9kZVNpemU7XHJcbiAgICAgICAgdGhpcy5fZGVmYXVsdE5vZGVTaXplID0geDtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLmdyb3VwQ29tcGFjdG5lc3MgPSBmdW5jdGlvbiAoeCkge1xyXG4gICAgICAgIGlmICgheClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dyb3VwQ29tcGFjdG5lc3M7XHJcbiAgICAgICAgdGhpcy5fZ3JvdXBDb21wYWN0bmVzcyA9IHg7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5saW5rRGlzdGFuY2UgPSBmdW5jdGlvbiAoeCkge1xyXG4gICAgICAgIGlmICgheCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlua0Rpc3RhbmNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9saW5rRGlzdGFuY2UgPSB0eXBlb2YgeCA9PT0gXCJmdW5jdGlvblwiID8geCA6ICt4O1xyXG4gICAgICAgIHRoaXMuX2xpbmtMZW5ndGhDYWxjdWxhdG9yID0gbnVsbDtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLmxpbmtUeXBlID0gZnVuY3Rpb24gKGYpIHtcclxuICAgICAgICB0aGlzLl9saW5rVHlwZSA9IGY7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5jb252ZXJnZW5jZVRocmVzaG9sZCA9IGZ1bmN0aW9uICh4KSB7XHJcbiAgICAgICAgaWYgKCF4KVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdGhyZXNob2xkO1xyXG4gICAgICAgIHRoaXMuX3RocmVzaG9sZCA9IHR5cGVvZiB4ID09PSBcImZ1bmN0aW9uXCIgPyB4IDogK3g7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5hbHBoYSA9IGZ1bmN0aW9uICh4KSB7XHJcbiAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxwaGE7XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHggPSAreDtcclxuICAgICAgICAgICAgaWYgKHRoaXMuX2FscGhhKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoeCA+IDApXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWxwaGEgPSB4O1xyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FscGhhID0gMDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICh4ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9ydW5uaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcnVubmluZyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKHsgdHlwZTogRXZlbnRUeXBlLnN0YXJ0LCBhbHBoYTogdGhpcy5fYWxwaGEgPSB4IH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMua2ljaygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLmdldExpbmtMZW5ndGggPSBmdW5jdGlvbiAobGluaykge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2YgdGhpcy5fbGlua0Rpc3RhbmNlID09PSBcImZ1bmN0aW9uXCIgPyArKHRoaXMuX2xpbmtEaXN0YW5jZShsaW5rKSkgOiB0aGlzLl9saW5rRGlzdGFuY2U7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnNldExpbmtMZW5ndGggPSBmdW5jdGlvbiAobGluaywgbGVuZ3RoKSB7XHJcbiAgICAgICAgbGluay5sZW5ndGggPSBsZW5ndGg7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5nZXRMaW5rVHlwZSA9IGZ1bmN0aW9uIChsaW5rKSB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB0aGlzLl9saW5rVHlwZSA9PT0gXCJmdW5jdGlvblwiID8gdGhpcy5fbGlua1R5cGUobGluaykgOiAwO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuc3ltbWV0cmljRGlmZkxpbmtMZW5ndGhzID0gZnVuY3Rpb24gKGlkZWFsTGVuZ3RoLCB3KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAodyA9PT0gdm9pZCAwKSB7IHcgPSAxOyB9XHJcbiAgICAgICAgdGhpcy5saW5rRGlzdGFuY2UoZnVuY3Rpb24gKGwpIHsgcmV0dXJuIGlkZWFsTGVuZ3RoICogbC5sZW5ndGg7IH0pO1xyXG4gICAgICAgIHRoaXMuX2xpbmtMZW5ndGhDYWxjdWxhdG9yID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gbGlua2xlbmd0aHNfMS5zeW1tZXRyaWNEaWZmTGlua0xlbmd0aHMoX3RoaXMuX2xpbmtzLCBfdGhpcy5saW5rQWNjZXNzb3IsIHcpOyB9O1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuamFjY2FyZExpbmtMZW5ndGhzID0gZnVuY3Rpb24gKGlkZWFsTGVuZ3RoLCB3KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAodyA9PT0gdm9pZCAwKSB7IHcgPSAxOyB9XHJcbiAgICAgICAgdGhpcy5saW5rRGlzdGFuY2UoZnVuY3Rpb24gKGwpIHsgcmV0dXJuIGlkZWFsTGVuZ3RoICogbC5sZW5ndGg7IH0pO1xyXG4gICAgICAgIHRoaXMuX2xpbmtMZW5ndGhDYWxjdWxhdG9yID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gbGlua2xlbmd0aHNfMS5qYWNjYXJkTGlua0xlbmd0aHMoX3RoaXMuX2xpbmtzLCBfdGhpcy5saW5rQWNjZXNzb3IsIHcpOyB9O1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiAoaW5pdGlhbFVuY29uc3RyYWluZWRJdGVyYXRpb25zLCBpbml0aWFsVXNlckNvbnN0cmFpbnRJdGVyYXRpb25zLCBpbml0aWFsQWxsQ29uc3RyYWludHNJdGVyYXRpb25zLCBncmlkU25hcEl0ZXJhdGlvbnMsIGtlZXBSdW5uaW5nKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAoaW5pdGlhbFVuY29uc3RyYWluZWRJdGVyYXRpb25zID09PSB2b2lkIDApIHsgaW5pdGlhbFVuY29uc3RyYWluZWRJdGVyYXRpb25zID0gMDsgfVxyXG4gICAgICAgIGlmIChpbml0aWFsVXNlckNvbnN0cmFpbnRJdGVyYXRpb25zID09PSB2b2lkIDApIHsgaW5pdGlhbFVzZXJDb25zdHJhaW50SXRlcmF0aW9ucyA9IDA7IH1cclxuICAgICAgICBpZiAoaW5pdGlhbEFsbENvbnN0cmFpbnRzSXRlcmF0aW9ucyA9PT0gdm9pZCAwKSB7IGluaXRpYWxBbGxDb25zdHJhaW50c0l0ZXJhdGlvbnMgPSAwOyB9XHJcbiAgICAgICAgaWYgKGdyaWRTbmFwSXRlcmF0aW9ucyA9PT0gdm9pZCAwKSB7IGdyaWRTbmFwSXRlcmF0aW9ucyA9IDA7IH1cclxuICAgICAgICBpZiAoa2VlcFJ1bm5pbmcgPT09IHZvaWQgMCkgeyBrZWVwUnVubmluZyA9IHRydWU7IH1cclxuICAgICAgICB2YXIgaSwgaiwgbiA9IHRoaXMubm9kZXMoKS5sZW5ndGgsIE4gPSBuICsgMiAqIHRoaXMuX2dyb3Vwcy5sZW5ndGgsIG0gPSB0aGlzLl9saW5rcy5sZW5ndGgsIHcgPSB0aGlzLl9jYW52YXNTaXplWzBdLCBoID0gdGhpcy5fY2FudmFzU2l6ZVsxXTtcclxuICAgICAgICB2YXIgeCA9IG5ldyBBcnJheShOKSwgeSA9IG5ldyBBcnJheShOKTtcclxuICAgICAgICB2YXIgRyA9IG51bGw7XHJcbiAgICAgICAgdmFyIGFvID0gdGhpcy5fYXZvaWRPdmVybGFwcztcclxuICAgICAgICB0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uICh2LCBpKSB7XHJcbiAgICAgICAgICAgIHYuaW5kZXggPSBpO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHYueCA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICAgIHYueCA9IHcgLyAyLCB2LnkgPSBoIC8gMjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB4W2ldID0gdi54LCB5W2ldID0gdi55O1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmICh0aGlzLl9saW5rTGVuZ3RoQ2FsY3VsYXRvcilcclxuICAgICAgICAgICAgdGhpcy5fbGlua0xlbmd0aENhbGN1bGF0b3IoKTtcclxuICAgICAgICB2YXIgZGlzdGFuY2VzO1xyXG4gICAgICAgIGlmICh0aGlzLl9kaXN0YW5jZU1hdHJpeCkge1xyXG4gICAgICAgICAgICBkaXN0YW5jZXMgPSB0aGlzLl9kaXN0YW5jZU1hdHJpeDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGRpc3RhbmNlcyA9IChuZXcgc2hvcnRlc3RwYXRoc18xLkNhbGN1bGF0b3IoTiwgdGhpcy5fbGlua3MsIExheW91dC5nZXRTb3VyY2VJbmRleCwgTGF5b3V0LmdldFRhcmdldEluZGV4LCBmdW5jdGlvbiAobCkgeyByZXR1cm4gX3RoaXMuZ2V0TGlua0xlbmd0aChsKTsgfSkpLkRpc3RhbmNlTWF0cml4KCk7XHJcbiAgICAgICAgICAgIEcgPSBkZXNjZW50XzEuRGVzY2VudC5jcmVhdGVTcXVhcmVNYXRyaXgoTiwgZnVuY3Rpb24gKCkgeyByZXR1cm4gMjsgfSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2xpbmtzLmZvckVhY2goZnVuY3Rpb24gKGwpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbC5zb3VyY2UgPT0gXCJudW1iZXJcIilcclxuICAgICAgICAgICAgICAgICAgICBsLnNvdXJjZSA9IF90aGlzLl9ub2Rlc1tsLnNvdXJjZV07XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGwudGFyZ2V0ID09IFwibnVtYmVyXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgbC50YXJnZXQgPSBfdGhpcy5fbm9kZXNbbC50YXJnZXRdO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5fbGlua3MuZm9yRWFjaChmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHUgPSBMYXlvdXQuZ2V0U291cmNlSW5kZXgoZSksIHYgPSBMYXlvdXQuZ2V0VGFyZ2V0SW5kZXgoZSk7XHJcbiAgICAgICAgICAgICAgICBHW3VdW3ZdID0gR1t2XVt1XSA9IGUud2VpZ2h0IHx8IDE7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgRCA9IGRlc2NlbnRfMS5EZXNjZW50LmNyZWF0ZVNxdWFyZU1hdHJpeChOLCBmdW5jdGlvbiAoaSwgaikge1xyXG4gICAgICAgICAgICByZXR1cm4gZGlzdGFuY2VzW2ldW2pdO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmICh0aGlzLl9yb290R3JvdXAgJiYgdHlwZW9mIHRoaXMuX3Jvb3RHcm91cC5ncm91cHMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIHZhciBpID0gbjtcclxuICAgICAgICAgICAgdmFyIGFkZEF0dHJhY3Rpb24gPSBmdW5jdGlvbiAoaSwgaiwgc3RyZW5ndGgsIGlkZWFsRGlzdGFuY2UpIHtcclxuICAgICAgICAgICAgICAgIEdbaV1bal0gPSBHW2pdW2ldID0gc3RyZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBEW2ldW2pdID0gRFtqXVtpXSA9IGlkZWFsRGlzdGFuY2U7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoaXMuX2dyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uIChnKSB7XHJcbiAgICAgICAgICAgICAgICBhZGRBdHRyYWN0aW9uKGksIGkgKyAxLCBfdGhpcy5fZ3JvdXBDb21wYWN0bmVzcywgMC4xKTtcclxuICAgICAgICAgICAgICAgIHhbaV0gPSAwLCB5W2krK10gPSAwO1xyXG4gICAgICAgICAgICAgICAgeFtpXSA9IDAsIHlbaSsrXSA9IDA7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHRoaXMuX3Jvb3RHcm91cCA9IHsgbGVhdmVzOiB0aGlzLl9ub2RlcywgZ3JvdXBzOiBbXSB9O1xyXG4gICAgICAgIHZhciBjdXJDb25zdHJhaW50cyA9IHRoaXMuX2NvbnN0cmFpbnRzIHx8IFtdO1xyXG4gICAgICAgIGlmICh0aGlzLl9kaXJlY3RlZExpbmtDb25zdHJhaW50cykge1xyXG4gICAgICAgICAgICB0aGlzLmxpbmtBY2Nlc3Nvci5nZXRNaW5TZXBhcmF0aW9uID0gdGhpcy5fZGlyZWN0ZWRMaW5rQ29uc3RyYWludHMuZ2V0TWluU2VwYXJhdGlvbjtcclxuICAgICAgICAgICAgY3VyQ29uc3RyYWludHMgPSBjdXJDb25zdHJhaW50cy5jb25jYXQobGlua2xlbmd0aHNfMS5nZW5lcmF0ZURpcmVjdGVkRWRnZUNvbnN0cmFpbnRzKG4sIHRoaXMuX2xpbmtzLCB0aGlzLl9kaXJlY3RlZExpbmtDb25zdHJhaW50cy5heGlzLCAodGhpcy5saW5rQWNjZXNzb3IpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYXZvaWRPdmVybGFwcyhmYWxzZSk7XHJcbiAgICAgICAgdGhpcy5fZGVzY2VudCA9IG5ldyBkZXNjZW50XzEuRGVzY2VudChbeCwgeV0sIEQpO1xyXG4gICAgICAgIHRoaXMuX2Rlc2NlbnQubG9ja3MuY2xlYXIoKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgbyA9IHRoaXMuX25vZGVzW2ldO1xyXG4gICAgICAgICAgICBpZiAoby5maXhlZCkge1xyXG4gICAgICAgICAgICAgICAgby5weCA9IG8ueDtcclxuICAgICAgICAgICAgICAgIG8ucHkgPSBvLnk7XHJcbiAgICAgICAgICAgICAgICB2YXIgcCA9IFtvLngsIG8ueV07XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXNjZW50LmxvY2tzLmFkZChpLCBwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kZXNjZW50LnRocmVzaG9sZCA9IHRoaXMuX3RocmVzaG9sZDtcclxuICAgICAgICB0aGlzLmluaXRpYWxMYXlvdXQoaW5pdGlhbFVuY29uc3RyYWluZWRJdGVyYXRpb25zLCB4LCB5KTtcclxuICAgICAgICBpZiAoY3VyQ29uc3RyYWludHMubGVuZ3RoID4gMClcclxuICAgICAgICAgICAgdGhpcy5fZGVzY2VudC5wcm9qZWN0ID0gbmV3IHJlY3RhbmdsZV8xLlByb2plY3Rpb24odGhpcy5fbm9kZXMsIHRoaXMuX2dyb3VwcywgdGhpcy5fcm9vdEdyb3VwLCBjdXJDb25zdHJhaW50cykucHJvamVjdEZ1bmN0aW9ucygpO1xyXG4gICAgICAgIHRoaXMuX2Rlc2NlbnQucnVuKGluaXRpYWxVc2VyQ29uc3RyYWludEl0ZXJhdGlvbnMpO1xyXG4gICAgICAgIHRoaXMuc2VwYXJhdGVPdmVybGFwcGluZ0NvbXBvbmVudHModywgaCk7XHJcbiAgICAgICAgdGhpcy5hdm9pZE92ZXJsYXBzKGFvKTtcclxuICAgICAgICBpZiAoYW8pIHtcclxuICAgICAgICAgICAgdGhpcy5fbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkgeyB2LnggPSB4W2ldLCB2LnkgPSB5W2ldOyB9KTtcclxuICAgICAgICAgICAgdGhpcy5fZGVzY2VudC5wcm9qZWN0ID0gbmV3IHJlY3RhbmdsZV8xLlByb2plY3Rpb24odGhpcy5fbm9kZXMsIHRoaXMuX2dyb3VwcywgdGhpcy5fcm9vdEdyb3VwLCBjdXJDb25zdHJhaW50cywgdHJ1ZSkucHJvamVjdEZ1bmN0aW9ucygpO1xyXG4gICAgICAgICAgICB0aGlzLl9ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uICh2LCBpKSB7IHhbaV0gPSB2LngsIHlbaV0gPSB2Lnk7IH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9kZXNjZW50LkcgPSBHO1xyXG4gICAgICAgIHRoaXMuX2Rlc2NlbnQucnVuKGluaXRpYWxBbGxDb25zdHJhaW50c0l0ZXJhdGlvbnMpO1xyXG4gICAgICAgIGlmIChncmlkU25hcEl0ZXJhdGlvbnMpIHtcclxuICAgICAgICAgICAgdGhpcy5fZGVzY2VudC5zbmFwU3RyZW5ndGggPSAxMDAwO1xyXG4gICAgICAgICAgICB0aGlzLl9kZXNjZW50LnNuYXBHcmlkU2l6ZSA9IHRoaXMuX25vZGVzWzBdLndpZHRoO1xyXG4gICAgICAgICAgICB0aGlzLl9kZXNjZW50Lm51bUdyaWRTbmFwTm9kZXMgPSBuO1xyXG4gICAgICAgICAgICB0aGlzLl9kZXNjZW50LnNjYWxlU25hcEJ5TWF4SCA9IG4gIT0gTjtcclxuICAgICAgICAgICAgdmFyIEcwID0gZGVzY2VudF8xLkRlc2NlbnQuY3JlYXRlU3F1YXJlTWF0cml4KE4sIGZ1bmN0aW9uIChpLCBqKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaSA+PSBuIHx8IGogPj0gbilcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gR1tpXVtqXTtcclxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgdGhpcy5fZGVzY2VudC5HID0gRzA7XHJcbiAgICAgICAgICAgIHRoaXMuX2Rlc2NlbnQucnVuKGdyaWRTbmFwSXRlcmF0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMudXBkYXRlTm9kZVBvc2l0aW9ucygpO1xyXG4gICAgICAgIHRoaXMuc2VwYXJhdGVPdmVybGFwcGluZ0NvbXBvbmVudHModywgaCk7XHJcbiAgICAgICAgcmV0dXJuIGtlZXBSdW5uaW5nID8gdGhpcy5yZXN1bWUoKSA6IHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5pbml0aWFsTGF5b3V0ID0gZnVuY3Rpb24gKGl0ZXJhdGlvbnMsIHgsIHkpIHtcclxuICAgICAgICBpZiAodGhpcy5fZ3JvdXBzLmxlbmd0aCA+IDAgJiYgaXRlcmF0aW9ucyA+IDApIHtcclxuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9ub2Rlcy5sZW5ndGg7XHJcbiAgICAgICAgICAgIHZhciBlZGdlcyA9IHRoaXMuX2xpbmtzLm1hcChmdW5jdGlvbiAoZSkgeyByZXR1cm4gKHsgc291cmNlOiBlLnNvdXJjZS5pbmRleCwgdGFyZ2V0OiBlLnRhcmdldC5pbmRleCB9KTsgfSk7XHJcbiAgICAgICAgICAgIHZhciB2cyA9IHRoaXMuX25vZGVzLm1hcChmdW5jdGlvbiAodikgeyByZXR1cm4gKHsgaW5kZXg6IHYuaW5kZXggfSk7IH0pO1xyXG4gICAgICAgICAgICB0aGlzLl9ncm91cHMuZm9yRWFjaChmdW5jdGlvbiAoZywgaSkge1xyXG4gICAgICAgICAgICAgICAgdnMucHVzaCh7IGluZGV4OiBnLmluZGV4ID0gbiArIGkgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLl9ncm91cHMuZm9yRWFjaChmdW5jdGlvbiAoZywgaSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBnLmxlYXZlcyAhPT0gJ3VuZGVmaW5lZCcpXHJcbiAgICAgICAgICAgICAgICAgICAgZy5sZWF2ZXMuZm9yRWFjaChmdW5jdGlvbiAodikgeyByZXR1cm4gZWRnZXMucHVzaCh7IHNvdXJjZTogZy5pbmRleCwgdGFyZ2V0OiB2LmluZGV4IH0pOyB9KTtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZy5ncm91cHMgIT09ICd1bmRlZmluZWQnKVxyXG4gICAgICAgICAgICAgICAgICAgIGcuZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGdnKSB7IHJldHVybiBlZGdlcy5wdXNoKHsgc291cmNlOiBnLmluZGV4LCB0YXJnZXQ6IGdnLmluZGV4IH0pOyB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIG5ldyBMYXlvdXQoKVxyXG4gICAgICAgICAgICAgICAgLnNpemUodGhpcy5zaXplKCkpXHJcbiAgICAgICAgICAgICAgICAubm9kZXModnMpXHJcbiAgICAgICAgICAgICAgICAubGlua3MoZWRnZXMpXHJcbiAgICAgICAgICAgICAgICAuYXZvaWRPdmVybGFwcyhmYWxzZSlcclxuICAgICAgICAgICAgICAgIC5saW5rRGlzdGFuY2UodGhpcy5saW5rRGlzdGFuY2UoKSlcclxuICAgICAgICAgICAgICAgIC5zeW1tZXRyaWNEaWZmTGlua0xlbmd0aHMoNSlcclxuICAgICAgICAgICAgICAgIC5jb252ZXJnZW5jZVRocmVzaG9sZCgxZS00KVxyXG4gICAgICAgICAgICAgICAgLnN0YXJ0KGl0ZXJhdGlvbnMsIDAsIDAsIDAsIGZhbHNlKTtcclxuICAgICAgICAgICAgdGhpcy5fbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodikge1xyXG4gICAgICAgICAgICAgICAgeFt2LmluZGV4XSA9IHZzW3YuaW5kZXhdLng7XHJcbiAgICAgICAgICAgICAgICB5W3YuaW5kZXhdID0gdnNbdi5pbmRleF0ueTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9kZXNjZW50LnJ1bihpdGVyYXRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LnByb3RvdHlwZS5zZXBhcmF0ZU92ZXJsYXBwaW5nQ29tcG9uZW50cyA9IGZ1bmN0aW9uICh3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICBpZiAoIXRoaXMuX2Rpc3RhbmNlTWF0cml4ICYmIHRoaXMuX2hhbmRsZURpc2Nvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICB2YXIgeF8xID0gdGhpcy5fZGVzY2VudC54WzBdLCB5XzEgPSB0aGlzLl9kZXNjZW50LnhbMV07XHJcbiAgICAgICAgICAgIHRoaXMuX25vZGVzLmZvckVhY2goZnVuY3Rpb24gKHYsIGkpIHsgdi54ID0geF8xW2ldLCB2LnkgPSB5XzFbaV07IH0pO1xyXG4gICAgICAgICAgICB2YXIgZ3JhcGhzID0gaGFuZGxlZGlzY29ubmVjdGVkXzEuc2VwYXJhdGVHcmFwaHModGhpcy5fbm9kZXMsIHRoaXMuX2xpbmtzKTtcclxuICAgICAgICAgICAgaGFuZGxlZGlzY29ubmVjdGVkXzEuYXBwbHlQYWNraW5nKGdyYXBocywgd2lkdGgsIGhlaWdodCwgdGhpcy5fZGVmYXVsdE5vZGVTaXplKTtcclxuICAgICAgICAgICAgdGhpcy5fbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuX2Rlc2NlbnQueFswXVtpXSA9IHYueCwgX3RoaXMuX2Rlc2NlbnQueFsxXVtpXSA9IHYueTtcclxuICAgICAgICAgICAgICAgIGlmICh2LmJvdW5kcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHYuYm91bmRzLnNldFhDZW50cmUodi54KTtcclxuICAgICAgICAgICAgICAgICAgICB2LmJvdW5kcy5zZXRZQ2VudHJlKHYueSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5hbHBoYSgwLjEpO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5hbHBoYSgwKTtcclxuICAgIH07XHJcbiAgICBMYXlvdXQucHJvdG90eXBlLnByZXBhcmVFZGdlUm91dGluZyA9IGZ1bmN0aW9uIChub2RlTWFyZ2luKSB7XHJcbiAgICAgICAgaWYgKG5vZGVNYXJnaW4gPT09IHZvaWQgMCkgeyBub2RlTWFyZ2luID0gMDsgfVxyXG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlHcmFwaCA9IG5ldyBnZW9tXzEuVGFuZ2VudFZpc2liaWxpdHlHcmFwaCh0aGlzLl9ub2Rlcy5tYXAoZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHYuYm91bmRzLmluZmxhdGUoLW5vZGVNYXJnaW4pLnZlcnRpY2VzKCk7XHJcbiAgICAgICAgfSkpO1xyXG4gICAgfTtcclxuICAgIExheW91dC5wcm90b3R5cGUucm91dGVFZGdlID0gZnVuY3Rpb24gKGVkZ2UsIGFoLCBkcmF3KSB7XHJcbiAgICAgICAgaWYgKGFoID09PSB2b2lkIDApIHsgYWggPSA1OyB9XHJcbiAgICAgICAgdmFyIGxpbmVEYXRhID0gW107XHJcbiAgICAgICAgdmFyIHZnMiA9IG5ldyBnZW9tXzEuVGFuZ2VudFZpc2liaWxpdHlHcmFwaCh0aGlzLl92aXNpYmlsaXR5R3JhcGguUCwgeyBWOiB0aGlzLl92aXNpYmlsaXR5R3JhcGguViwgRTogdGhpcy5fdmlzaWJpbGl0eUdyYXBoLkUgfSksIHBvcnQxID0geyB4OiBlZGdlLnNvdXJjZS54LCB5OiBlZGdlLnNvdXJjZS55IH0sIHBvcnQyID0geyB4OiBlZGdlLnRhcmdldC54LCB5OiBlZGdlLnRhcmdldC55IH0sIHN0YXJ0ID0gdmcyLmFkZFBvaW50KHBvcnQxLCBlZGdlLnNvdXJjZS5pbmRleCksIGVuZCA9IHZnMi5hZGRQb2ludChwb3J0MiwgZWRnZS50YXJnZXQuaW5kZXgpO1xyXG4gICAgICAgIHZnMi5hZGRFZGdlSWZWaXNpYmxlKHBvcnQxLCBwb3J0MiwgZWRnZS5zb3VyY2UuaW5kZXgsIGVkZ2UudGFyZ2V0LmluZGV4KTtcclxuICAgICAgICBpZiAodHlwZW9mIGRyYXcgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIGRyYXcodmcyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHNvdXJjZUluZCA9IGZ1bmN0aW9uIChlKSB7IHJldHVybiBlLnNvdXJjZS5pZDsgfSwgdGFyZ2V0SW5kID0gZnVuY3Rpb24gKGUpIHsgcmV0dXJuIGUudGFyZ2V0LmlkOyB9LCBsZW5ndGggPSBmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS5sZW5ndGgoKTsgfSwgc3BDYWxjID0gbmV3IHNob3J0ZXN0cGF0aHNfMS5DYWxjdWxhdG9yKHZnMi5WLmxlbmd0aCwgdmcyLkUsIHNvdXJjZUluZCwgdGFyZ2V0SW5kLCBsZW5ndGgpLCBzaG9ydGVzdFBhdGggPSBzcENhbGMuUGF0aEZyb21Ob2RlVG9Ob2RlKHN0YXJ0LmlkLCBlbmQuaWQpO1xyXG4gICAgICAgIGlmIChzaG9ydGVzdFBhdGgubGVuZ3RoID09PSAxIHx8IHNob3J0ZXN0UGF0aC5sZW5ndGggPT09IHZnMi5WLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB2YXIgcm91dGUgPSByZWN0YW5nbGVfMS5tYWtlRWRnZUJldHdlZW4oZWRnZS5zb3VyY2UuaW5uZXJCb3VuZHMsIGVkZ2UudGFyZ2V0LmlubmVyQm91bmRzLCBhaCk7XHJcbiAgICAgICAgICAgIGxpbmVEYXRhID0gW3JvdXRlLnNvdXJjZUludGVyc2VjdGlvbiwgcm91dGUuYXJyb3dTdGFydF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB2YXIgbiA9IHNob3J0ZXN0UGF0aC5sZW5ndGggLSAyLCBwID0gdmcyLlZbc2hvcnRlc3RQYXRoW25dXS5wLCBxID0gdmcyLlZbc2hvcnRlc3RQYXRoWzBdXS5wLCBsaW5lRGF0YSA9IFtlZGdlLnNvdXJjZS5pbm5lckJvdW5kcy5yYXlJbnRlcnNlY3Rpb24ocC54LCBwLnkpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IG47IGkgPj0gMDsgLS1pKVxyXG4gICAgICAgICAgICAgICAgbGluZURhdGEucHVzaCh2ZzIuVltzaG9ydGVzdFBhdGhbaV1dLnApO1xyXG4gICAgICAgICAgICBsaW5lRGF0YS5wdXNoKHJlY3RhbmdsZV8xLm1ha2VFZGdlVG8ocSwgZWRnZS50YXJnZXQuaW5uZXJCb3VuZHMsIGFoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBsaW5lRGF0YTtcclxuICAgIH07XHJcbiAgICBMYXlvdXQuZ2V0U291cmNlSW5kZXggPSBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2YgZS5zb3VyY2UgPT09ICdudW1iZXInID8gZS5zb3VyY2UgOiBlLnNvdXJjZS5pbmRleDtcclxuICAgIH07XHJcbiAgICBMYXlvdXQuZ2V0VGFyZ2V0SW5kZXggPSBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2YgZS50YXJnZXQgPT09ICdudW1iZXInID8gZS50YXJnZXQgOiBlLnRhcmdldC5pbmRleDtcclxuICAgIH07XHJcbiAgICBMYXlvdXQubGlua0lkID0gZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICByZXR1cm4gTGF5b3V0LmdldFNvdXJjZUluZGV4KGUpICsgXCItXCIgKyBMYXlvdXQuZ2V0VGFyZ2V0SW5kZXgoZSk7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LmRyYWdTdGFydCA9IGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgICAgaWYgKGlzR3JvdXAoZCkpIHtcclxuICAgICAgICAgICAgTGF5b3V0LnN0b3JlT2Zmc2V0KGQsIExheW91dC5kcmFnT3JpZ2luKGQpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIExheW91dC5zdG9wTm9kZShkKTtcclxuICAgICAgICAgICAgZC5maXhlZCB8PSAyO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMYXlvdXQuc3RvcE5vZGUgPSBmdW5jdGlvbiAodikge1xyXG4gICAgICAgIHYucHggPSB2Lng7XHJcbiAgICAgICAgdi5weSA9IHYueTtcclxuICAgIH07XHJcbiAgICBMYXlvdXQuc3RvcmVPZmZzZXQgPSBmdW5jdGlvbiAoZCwgb3JpZ2luKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkLmxlYXZlcyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgZC5sZWF2ZXMuZm9yRWFjaChmdW5jdGlvbiAodikge1xyXG4gICAgICAgICAgICAgICAgdi5maXhlZCB8PSAyO1xyXG4gICAgICAgICAgICAgICAgTGF5b3V0LnN0b3BOb2RlKHYpO1xyXG4gICAgICAgICAgICAgICAgdi5fZHJhZ0dyb3VwT2Zmc2V0WCA9IHYueCAtIG9yaWdpbi54O1xyXG4gICAgICAgICAgICAgICAgdi5fZHJhZ0dyb3VwT2Zmc2V0WSA9IHYueSAtIG9yaWdpbi55O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkLmdyb3VwcyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgZC5ncm91cHMuZm9yRWFjaChmdW5jdGlvbiAoZykgeyByZXR1cm4gTGF5b3V0LnN0b3JlT2Zmc2V0KGcsIG9yaWdpbik7IH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMYXlvdXQuZHJhZ09yaWdpbiA9IGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgICAgaWYgKGlzR3JvdXAoZCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHg6IGQuYm91bmRzLmN4KCksXHJcbiAgICAgICAgICAgICAgICB5OiBkLmJvdW5kcy5jeSgpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LmRyYWcgPSBmdW5jdGlvbiAoZCwgcG9zaXRpb24pIHtcclxuICAgICAgICBpZiAoaXNHcm91cChkKSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGQubGVhdmVzICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgICAgZC5sZWF2ZXMuZm9yRWFjaChmdW5jdGlvbiAodikge1xyXG4gICAgICAgICAgICAgICAgICAgIGQuYm91bmRzLnNldFhDZW50cmUocG9zaXRpb24ueCk7XHJcbiAgICAgICAgICAgICAgICAgICAgZC5ib3VuZHMuc2V0WUNlbnRyZShwb3NpdGlvbi55KTtcclxuICAgICAgICAgICAgICAgICAgICB2LnB4ID0gdi5fZHJhZ0dyb3VwT2Zmc2V0WCArIHBvc2l0aW9uLng7XHJcbiAgICAgICAgICAgICAgICAgICAgdi5weSA9IHYuX2RyYWdHcm91cE9mZnNldFkgKyBwb3NpdGlvbi55O1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBkLmdyb3VwcyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICAgIGQuZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGcpIHsgcmV0dXJuIExheW91dC5kcmFnKGcsIHBvc2l0aW9uKTsgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGQucHggPSBwb3NpdGlvbi54O1xyXG4gICAgICAgICAgICBkLnB5ID0gcG9zaXRpb24ueTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0LmRyYWdFbmQgPSBmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgIGlmIChpc0dyb3VwKGQpKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZC5sZWF2ZXMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICBkLmxlYXZlcy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgTGF5b3V0LmRyYWdFbmQodik7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHYuX2RyYWdHcm91cE9mZnNldFg7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHYuX2RyYWdHcm91cE9mZnNldFk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGQuZ3JvdXBzICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgICAgZC5ncm91cHMuZm9yRWFjaChMYXlvdXQuZHJhZ0VuZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGQuZml4ZWQgJj0gfjY7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIExheW91dC5tb3VzZU92ZXIgPSBmdW5jdGlvbiAoZCkge1xyXG4gICAgICAgIGQuZml4ZWQgfD0gNDtcclxuICAgICAgICBkLnB4ID0gZC54LCBkLnB5ID0gZC55O1xyXG4gICAgfTtcclxuICAgIExheW91dC5tb3VzZU91dCA9IGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgICAgZC5maXhlZCAmPSB+NDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gTGF5b3V0O1xyXG59KCkpO1xyXG5leHBvcnRzLkxheW91dCA9IExheW91dDtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bGF5b3V0LmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbnZhciBzaG9ydGVzdHBhdGhzXzEgPSByZXF1aXJlKFwiLi9zaG9ydGVzdHBhdGhzXCIpO1xyXG52YXIgZGVzY2VudF8xID0gcmVxdWlyZShcIi4vZGVzY2VudFwiKTtcclxudmFyIHJlY3RhbmdsZV8xID0gcmVxdWlyZShcIi4vcmVjdGFuZ2xlXCIpO1xyXG52YXIgbGlua2xlbmd0aHNfMSA9IHJlcXVpcmUoXCIuL2xpbmtsZW5ndGhzXCIpO1xyXG52YXIgTGluazNEID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIExpbmszRChzb3VyY2UsIHRhcmdldCkge1xyXG4gICAgICAgIHRoaXMuc291cmNlID0gc291cmNlO1xyXG4gICAgICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xyXG4gICAgfVxyXG4gICAgTGluazNELnByb3RvdHlwZS5hY3R1YWxMZW5ndGggPSBmdW5jdGlvbiAoeCkge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh4LnJlZHVjZShmdW5jdGlvbiAoYywgdikge1xyXG4gICAgICAgICAgICB2YXIgZHggPSB2W190aGlzLnRhcmdldF0gLSB2W190aGlzLnNvdXJjZV07XHJcbiAgICAgICAgICAgIHJldHVybiBjICsgZHggKiBkeDtcclxuICAgICAgICB9LCAwKSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIExpbmszRDtcclxufSgpKTtcclxuZXhwb3J0cy5MaW5rM0QgPSBMaW5rM0Q7XHJcbnZhciBOb2RlM0QgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gTm9kZTNEKHgsIHksIHopIHtcclxuICAgICAgICBpZiAoeCA9PT0gdm9pZCAwKSB7IHggPSAwOyB9XHJcbiAgICAgICAgaWYgKHkgPT09IHZvaWQgMCkgeyB5ID0gMDsgfVxyXG4gICAgICAgIGlmICh6ID09PSB2b2lkIDApIHsgeiA9IDA7IH1cclxuICAgICAgICB0aGlzLnggPSB4O1xyXG4gICAgICAgIHRoaXMueSA9IHk7XHJcbiAgICAgICAgdGhpcy56ID0gejtcclxuICAgIH1cclxuICAgIHJldHVybiBOb2RlM0Q7XHJcbn0oKSk7XHJcbmV4cG9ydHMuTm9kZTNEID0gTm9kZTNEO1xyXG52YXIgTGF5b3V0M0QgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gTGF5b3V0M0Qobm9kZXMsIGxpbmtzLCBpZGVhbExpbmtMZW5ndGgpIHtcclxuICAgICAgICBpZiAoaWRlYWxMaW5rTGVuZ3RoID09PSB2b2lkIDApIHsgaWRlYWxMaW5rTGVuZ3RoID0gMTsgfVxyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdGhpcy5ub2RlcyA9IG5vZGVzO1xyXG4gICAgICAgIHRoaXMubGlua3MgPSBsaW5rcztcclxuICAgICAgICB0aGlzLmlkZWFsTGlua0xlbmd0aCA9IGlkZWFsTGlua0xlbmd0aDtcclxuICAgICAgICB0aGlzLmNvbnN0cmFpbnRzID0gbnVsbDtcclxuICAgICAgICB0aGlzLnVzZUphY2NhcmRMaW5rTGVuZ3RocyA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5yZXN1bHQgPSBuZXcgQXJyYXkoTGF5b3V0M0Quayk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBMYXlvdXQzRC5rOyArK2kpIHtcclxuICAgICAgICAgICAgdGhpcy5yZXN1bHRbaV0gPSBuZXcgQXJyYXkobm9kZXMubGVuZ3RoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gTGF5b3V0M0QuZGltczsgX2kgPCBfYS5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBkaW0gPSBfYVtfaV07XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZbZGltXSA9PSAndW5kZWZpbmVkJylcclxuICAgICAgICAgICAgICAgICAgICB2W2RpbV0gPSBNYXRoLnJhbmRvbSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF90aGlzLnJlc3VsdFswXVtpXSA9IHYueDtcclxuICAgICAgICAgICAgX3RoaXMucmVzdWx0WzFdW2ldID0gdi55O1xyXG4gICAgICAgICAgICBfdGhpcy5yZXN1bHRbMl1baV0gPSB2Lno7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICA7XHJcbiAgICBMYXlvdXQzRC5wcm90b3R5cGUubGlua0xlbmd0aCA9IGZ1bmN0aW9uIChsKSB7XHJcbiAgICAgICAgcmV0dXJuIGwuYWN0dWFsTGVuZ3RoKHRoaXMucmVzdWx0KTtcclxuICAgIH07XHJcbiAgICBMYXlvdXQzRC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbiAoaXRlcmF0aW9ucykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKGl0ZXJhdGlvbnMgPT09IHZvaWQgMCkgeyBpdGVyYXRpb25zID0gMTAwOyB9XHJcbiAgICAgICAgdmFyIG4gPSB0aGlzLm5vZGVzLmxlbmd0aDtcclxuICAgICAgICB2YXIgbGlua0FjY2Vzc29yID0gbmV3IExpbmtBY2Nlc3NvcigpO1xyXG4gICAgICAgIGlmICh0aGlzLnVzZUphY2NhcmRMaW5rTGVuZ3RocylcclxuICAgICAgICAgICAgbGlua2xlbmd0aHNfMS5qYWNjYXJkTGlua0xlbmd0aHModGhpcy5saW5rcywgbGlua0FjY2Vzc29yLCAxLjUpO1xyXG4gICAgICAgIHRoaXMubGlua3MuZm9yRWFjaChmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS5sZW5ndGggKj0gX3RoaXMuaWRlYWxMaW5rTGVuZ3RoOyB9KTtcclxuICAgICAgICB2YXIgZGlzdGFuY2VNYXRyaXggPSAobmV3IHNob3J0ZXN0cGF0aHNfMS5DYWxjdWxhdG9yKG4sIHRoaXMubGlua3MsIGZ1bmN0aW9uIChlKSB7IHJldHVybiBlLnNvdXJjZTsgfSwgZnVuY3Rpb24gKGUpIHsgcmV0dXJuIGUudGFyZ2V0OyB9LCBmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS5sZW5ndGg7IH0pKS5EaXN0YW5jZU1hdHJpeCgpO1xyXG4gICAgICAgIHZhciBEID0gZGVzY2VudF8xLkRlc2NlbnQuY3JlYXRlU3F1YXJlTWF0cml4KG4sIGZ1bmN0aW9uIChpLCBqKSB7IHJldHVybiBkaXN0YW5jZU1hdHJpeFtpXVtqXTsgfSk7XHJcbiAgICAgICAgdmFyIEcgPSBkZXNjZW50XzEuRGVzY2VudC5jcmVhdGVTcXVhcmVNYXRyaXgobiwgZnVuY3Rpb24gKCkgeyByZXR1cm4gMjsgfSk7XHJcbiAgICAgICAgdGhpcy5saW5rcy5mb3JFYWNoKGZ1bmN0aW9uIChfYSkge1xyXG4gICAgICAgICAgICB2YXIgc291cmNlID0gX2Euc291cmNlLCB0YXJnZXQgPSBfYS50YXJnZXQ7XHJcbiAgICAgICAgICAgIHJldHVybiBHW3NvdXJjZV1bdGFyZ2V0XSA9IEdbdGFyZ2V0XVtzb3VyY2VdID0gMTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmRlc2NlbnQgPSBuZXcgZGVzY2VudF8xLkRlc2NlbnQodGhpcy5yZXN1bHQsIEQpO1xyXG4gICAgICAgIHRoaXMuZGVzY2VudC50aHJlc2hvbGQgPSAxZS0zO1xyXG4gICAgICAgIHRoaXMuZGVzY2VudC5HID0gRztcclxuICAgICAgICBpZiAodGhpcy5jb25zdHJhaW50cylcclxuICAgICAgICAgICAgdGhpcy5kZXNjZW50LnByb2plY3QgPSBuZXcgcmVjdGFuZ2xlXzEuUHJvamVjdGlvbih0aGlzLm5vZGVzLCBudWxsLCBudWxsLCB0aGlzLmNvbnN0cmFpbnRzKS5wcm9qZWN0RnVuY3Rpb25zKCk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB2ID0gdGhpcy5ub2Rlc1tpXTtcclxuICAgICAgICAgICAgaWYgKHYuZml4ZWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZGVzY2VudC5sb2Nrcy5hZGQoaSwgW3YueCwgdi55LCB2LnpdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmRlc2NlbnQucnVuKGl0ZXJhdGlvbnMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExheW91dDNELnByb3RvdHlwZS50aWNrID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZGVzY2VudC5sb2Nrcy5jbGVhcigpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5ub2Rlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdiA9IHRoaXMubm9kZXNbaV07XHJcbiAgICAgICAgICAgIGlmICh2LmZpeGVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRlc2NlbnQubG9ja3MuYWRkKGksIFt2LngsIHYueSwgdi56XSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVzY2VudC5ydW5nZUt1dHRhKCk7XHJcbiAgICB9O1xyXG4gICAgTGF5b3V0M0QuZGltcyA9IFsneCcsICd5JywgJ3onXTtcclxuICAgIExheW91dDNELmsgPSBMYXlvdXQzRC5kaW1zLmxlbmd0aDtcclxuICAgIHJldHVybiBMYXlvdXQzRDtcclxufSgpKTtcclxuZXhwb3J0cy5MYXlvdXQzRCA9IExheW91dDNEO1xyXG52YXIgTGlua0FjY2Vzc29yID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIExpbmtBY2Nlc3NvcigpIHtcclxuICAgIH1cclxuICAgIExpbmtBY2Nlc3Nvci5wcm90b3R5cGUuZ2V0U291cmNlSW5kZXggPSBmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS5zb3VyY2U7IH07XHJcbiAgICBMaW5rQWNjZXNzb3IucHJvdG90eXBlLmdldFRhcmdldEluZGV4ID0gZnVuY3Rpb24gKGUpIHsgcmV0dXJuIGUudGFyZ2V0OyB9O1xyXG4gICAgTGlua0FjY2Vzc29yLnByb3RvdHlwZS5nZXRMZW5ndGggPSBmdW5jdGlvbiAoZSkgeyByZXR1cm4gZS5sZW5ndGg7IH07XHJcbiAgICBMaW5rQWNjZXNzb3IucHJvdG90eXBlLnNldExlbmd0aCA9IGZ1bmN0aW9uIChlLCBsKSB7IGUubGVuZ3RoID0gbDsgfTtcclxuICAgIHJldHVybiBMaW5rQWNjZXNzb3I7XHJcbn0oKSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWxheW91dDNkLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmZ1bmN0aW9uIHVuaW9uQ291bnQoYSwgYikge1xyXG4gICAgdmFyIHUgPSB7fTtcclxuICAgIGZvciAodmFyIGkgaW4gYSlcclxuICAgICAgICB1W2ldID0ge307XHJcbiAgICBmb3IgKHZhciBpIGluIGIpXHJcbiAgICAgICAgdVtpXSA9IHt9O1xyXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHUpLmxlbmd0aDtcclxufVxyXG5mdW5jdGlvbiBpbnRlcnNlY3Rpb25Db3VudChhLCBiKSB7XHJcbiAgICB2YXIgbiA9IDA7XHJcbiAgICBmb3IgKHZhciBpIGluIGEpXHJcbiAgICAgICAgaWYgKHR5cGVvZiBiW2ldICE9PSAndW5kZWZpbmVkJylcclxuICAgICAgICAgICAgKytuO1xyXG4gICAgcmV0dXJuIG47XHJcbn1cclxuZnVuY3Rpb24gZ2V0TmVpZ2hib3VycyhsaW5rcywgbGEpIHtcclxuICAgIHZhciBuZWlnaGJvdXJzID0ge307XHJcbiAgICB2YXIgYWRkTmVpZ2hib3VycyA9IGZ1bmN0aW9uICh1LCB2KSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBuZWlnaGJvdXJzW3VdID09PSAndW5kZWZpbmVkJylcclxuICAgICAgICAgICAgbmVpZ2hib3Vyc1t1XSA9IHt9O1xyXG4gICAgICAgIG5laWdoYm91cnNbdV1bdl0gPSB7fTtcclxuICAgIH07XHJcbiAgICBsaW5rcy5mb3JFYWNoKGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgdmFyIHUgPSBsYS5nZXRTb3VyY2VJbmRleChlKSwgdiA9IGxhLmdldFRhcmdldEluZGV4KGUpO1xyXG4gICAgICAgIGFkZE5laWdoYm91cnModSwgdik7XHJcbiAgICAgICAgYWRkTmVpZ2hib3Vycyh2LCB1KTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG5laWdoYm91cnM7XHJcbn1cclxuZnVuY3Rpb24gY29tcHV0ZUxpbmtMZW5ndGhzKGxpbmtzLCB3LCBmLCBsYSkge1xyXG4gICAgdmFyIG5laWdoYm91cnMgPSBnZXROZWlnaGJvdXJzKGxpbmtzLCBsYSk7XHJcbiAgICBsaW5rcy5mb3JFYWNoKGZ1bmN0aW9uIChsKSB7XHJcbiAgICAgICAgdmFyIGEgPSBuZWlnaGJvdXJzW2xhLmdldFNvdXJjZUluZGV4KGwpXTtcclxuICAgICAgICB2YXIgYiA9IG5laWdoYm91cnNbbGEuZ2V0VGFyZ2V0SW5kZXgobCldO1xyXG4gICAgICAgIGxhLnNldExlbmd0aChsLCAxICsgdyAqIGYoYSwgYikpO1xyXG4gICAgfSk7XHJcbn1cclxuZnVuY3Rpb24gc3ltbWV0cmljRGlmZkxpbmtMZW5ndGhzKGxpbmtzLCBsYSwgdykge1xyXG4gICAgaWYgKHcgPT09IHZvaWQgMCkgeyB3ID0gMTsgfVxyXG4gICAgY29tcHV0ZUxpbmtMZW5ndGhzKGxpbmtzLCB3LCBmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gTWF0aC5zcXJ0KHVuaW9uQ291bnQoYSwgYikgLSBpbnRlcnNlY3Rpb25Db3VudChhLCBiKSk7IH0sIGxhKTtcclxufVxyXG5leHBvcnRzLnN5bW1ldHJpY0RpZmZMaW5rTGVuZ3RocyA9IHN5bW1ldHJpY0RpZmZMaW5rTGVuZ3RocztcclxuZnVuY3Rpb24gamFjY2FyZExpbmtMZW5ndGhzKGxpbmtzLCBsYSwgdykge1xyXG4gICAgaWYgKHcgPT09IHZvaWQgMCkgeyB3ID0gMTsgfVxyXG4gICAgY29tcHV0ZUxpbmtMZW5ndGhzKGxpbmtzLCB3LCBmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgIHJldHVybiBNYXRoLm1pbihPYmplY3Qua2V5cyhhKS5sZW5ndGgsIE9iamVjdC5rZXlzKGIpLmxlbmd0aCkgPCAxLjEgPyAwIDogaW50ZXJzZWN0aW9uQ291bnQoYSwgYikgLyB1bmlvbkNvdW50KGEsIGIpO1xyXG4gICAgfSwgbGEpO1xyXG59XHJcbmV4cG9ydHMuamFjY2FyZExpbmtMZW5ndGhzID0gamFjY2FyZExpbmtMZW5ndGhzO1xyXG5mdW5jdGlvbiBnZW5lcmF0ZURpcmVjdGVkRWRnZUNvbnN0cmFpbnRzKG4sIGxpbmtzLCBheGlzLCBsYSkge1xyXG4gICAgdmFyIGNvbXBvbmVudHMgPSBzdHJvbmdseUNvbm5lY3RlZENvbXBvbmVudHMobiwgbGlua3MsIGxhKTtcclxuICAgIHZhciBub2RlcyA9IHt9O1xyXG4gICAgY29tcG9uZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChjLCBpKSB7XHJcbiAgICAgICAgcmV0dXJuIGMuZm9yRWFjaChmdW5jdGlvbiAodikgeyByZXR1cm4gbm9kZXNbdl0gPSBpOyB9KTtcclxuICAgIH0pO1xyXG4gICAgdmFyIGNvbnN0cmFpbnRzID0gW107XHJcbiAgICBsaW5rcy5mb3JFYWNoKGZ1bmN0aW9uIChsKSB7XHJcbiAgICAgICAgdmFyIHVpID0gbGEuZ2V0U291cmNlSW5kZXgobCksIHZpID0gbGEuZ2V0VGFyZ2V0SW5kZXgobCksIHUgPSBub2Rlc1t1aV0sIHYgPSBub2Rlc1t2aV07XHJcbiAgICAgICAgaWYgKHUgIT09IHYpIHtcclxuICAgICAgICAgICAgY29uc3RyYWludHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBheGlzOiBheGlzLFxyXG4gICAgICAgICAgICAgICAgbGVmdDogdWksXHJcbiAgICAgICAgICAgICAgICByaWdodDogdmksXHJcbiAgICAgICAgICAgICAgICBnYXA6IGxhLmdldE1pblNlcGFyYXRpb24obClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gY29uc3RyYWludHM7XHJcbn1cclxuZXhwb3J0cy5nZW5lcmF0ZURpcmVjdGVkRWRnZUNvbnN0cmFpbnRzID0gZ2VuZXJhdGVEaXJlY3RlZEVkZ2VDb25zdHJhaW50cztcclxuZnVuY3Rpb24gc3Ryb25nbHlDb25uZWN0ZWRDb21wb25lbnRzKG51bVZlcnRpY2VzLCBlZGdlcywgbGEpIHtcclxuICAgIHZhciBub2RlcyA9IFtdO1xyXG4gICAgdmFyIGluZGV4ID0gMDtcclxuICAgIHZhciBzdGFjayA9IFtdO1xyXG4gICAgdmFyIGNvbXBvbmVudHMgPSBbXTtcclxuICAgIGZ1bmN0aW9uIHN0cm9uZ0Nvbm5lY3Qodikge1xyXG4gICAgICAgIHYuaW5kZXggPSB2Lmxvd2xpbmsgPSBpbmRleCsrO1xyXG4gICAgICAgIHN0YWNrLnB1c2godik7XHJcbiAgICAgICAgdi5vblN0YWNrID0gdHJ1ZTtcclxuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gdi5vdXQ7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB3ID0gX2FbX2ldO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHcuaW5kZXggPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgICAgICBzdHJvbmdDb25uZWN0KHcpO1xyXG4gICAgICAgICAgICAgICAgdi5sb3dsaW5rID0gTWF0aC5taW4odi5sb3dsaW5rLCB3Lmxvd2xpbmspO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHcub25TdGFjaykge1xyXG4gICAgICAgICAgICAgICAgdi5sb3dsaW5rID0gTWF0aC5taW4odi5sb3dsaW5rLCB3LmluZGV4KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodi5sb3dsaW5rID09PSB2LmluZGV4KSB7XHJcbiAgICAgICAgICAgIHZhciBjb21wb25lbnQgPSBbXTtcclxuICAgICAgICAgICAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgdyA9IHN0YWNrLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgdy5vblN0YWNrID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBjb21wb25lbnQucHVzaCh3KTtcclxuICAgICAgICAgICAgICAgIGlmICh3ID09PSB2KVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbXBvbmVudHMucHVzaChjb21wb25lbnQubWFwKGZ1bmN0aW9uICh2KSB7IHJldHVybiB2LmlkOyB9KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XHJcbiAgICAgICAgbm9kZXMucHVzaCh7IGlkOiBpLCBvdXQ6IFtdIH0pO1xyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgX2kgPSAwLCBlZGdlc18xID0gZWRnZXM7IF9pIDwgZWRnZXNfMS5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICB2YXIgZSA9IGVkZ2VzXzFbX2ldO1xyXG4gICAgICAgIHZhciB2XzEgPSBub2Rlc1tsYS5nZXRTb3VyY2VJbmRleChlKV0sIHcgPSBub2Rlc1tsYS5nZXRUYXJnZXRJbmRleChlKV07XHJcbiAgICAgICAgdl8xLm91dC5wdXNoKHcpO1xyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgX2EgPSAwLCBub2Rlc18xID0gbm9kZXM7IF9hIDwgbm9kZXNfMS5sZW5ndGg7IF9hKyspIHtcclxuICAgICAgICB2YXIgdiA9IG5vZGVzXzFbX2FdO1xyXG4gICAgICAgIGlmICh0eXBlb2Ygdi5pbmRleCA9PT0gJ3VuZGVmaW5lZCcpXHJcbiAgICAgICAgICAgIHN0cm9uZ0Nvbm5lY3Qodik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29tcG9uZW50cztcclxufVxyXG5leHBvcnRzLnN0cm9uZ2x5Q29ubmVjdGVkQ29tcG9uZW50cyA9IHN0cm9uZ2x5Q29ubmVjdGVkQ29tcG9uZW50cztcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bGlua2xlbmd0aHMuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIFBvd2VyRWRnZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBQb3dlckVkZ2Uoc291cmNlLCB0YXJnZXQsIHR5cGUpIHtcclxuICAgICAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZTtcclxuICAgICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcclxuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFBvd2VyRWRnZTtcclxufSgpKTtcclxuZXhwb3J0cy5Qb3dlckVkZ2UgPSBQb3dlckVkZ2U7XHJcbnZhciBDb25maWd1cmF0aW9uID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIENvbmZpZ3VyYXRpb24obiwgZWRnZXMsIGxpbmtBY2Nlc3Nvciwgcm9vdEdyb3VwKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB0aGlzLmxpbmtBY2Nlc3NvciA9IGxpbmtBY2Nlc3NvcjtcclxuICAgICAgICB0aGlzLm1vZHVsZXMgPSBuZXcgQXJyYXkobik7XHJcbiAgICAgICAgdGhpcy5yb290cyA9IFtdO1xyXG4gICAgICAgIGlmIChyb290R3JvdXApIHtcclxuICAgICAgICAgICAgdGhpcy5pbml0TW9kdWxlc0Zyb21Hcm91cChyb290R3JvdXApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5yb290cy5wdXNoKG5ldyBNb2R1bGVTZXQoKSk7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5yb290c1swXS5hZGQodGhpcy5tb2R1bGVzW2ldID0gbmV3IE1vZHVsZShpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuUiA9IGVkZ2VzLmxlbmd0aDtcclxuICAgICAgICBlZGdlcy5mb3JFYWNoKGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgICAgIHZhciBzID0gX3RoaXMubW9kdWxlc1tsaW5rQWNjZXNzb3IuZ2V0U291cmNlSW5kZXgoZSldLCB0ID0gX3RoaXMubW9kdWxlc1tsaW5rQWNjZXNzb3IuZ2V0VGFyZ2V0SW5kZXgoZSldLCB0eXBlID0gbGlua0FjY2Vzc29yLmdldFR5cGUoZSk7XHJcbiAgICAgICAgICAgIHMub3V0Z29pbmcuYWRkKHR5cGUsIHQpO1xyXG4gICAgICAgICAgICB0LmluY29taW5nLmFkZCh0eXBlLCBzKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIENvbmZpZ3VyYXRpb24ucHJvdG90eXBlLmluaXRNb2R1bGVzRnJvbUdyb3VwID0gZnVuY3Rpb24gKGdyb3VwKSB7XHJcbiAgICAgICAgdmFyIG1vZHVsZVNldCA9IG5ldyBNb2R1bGVTZXQoKTtcclxuICAgICAgICB0aGlzLnJvb3RzLnB1c2gobW9kdWxlU2V0KTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdyb3VwLmxlYXZlcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IGdyb3VwLmxlYXZlc1tpXTtcclxuICAgICAgICAgICAgdmFyIG1vZHVsZSA9IG5ldyBNb2R1bGUobm9kZS5pZCk7XHJcbiAgICAgICAgICAgIHRoaXMubW9kdWxlc1tub2RlLmlkXSA9IG1vZHVsZTtcclxuICAgICAgICAgICAgbW9kdWxlU2V0LmFkZChtb2R1bGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZ3JvdXAuZ3JvdXBzKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZ3JvdXAuZ3JvdXBzLmxlbmd0aDsgKytqKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBncm91cC5ncm91cHNbal07XHJcbiAgICAgICAgICAgICAgICB2YXIgZGVmaW5pdGlvbiA9IHt9O1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBjaGlsZClcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcCAhPT0gXCJsZWF2ZXNcIiAmJiBwcm9wICE9PSBcImdyb3Vwc1wiICYmIGNoaWxkLmhhc093blByb3BlcnR5KHByb3ApKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uW3Byb3BdID0gY2hpbGRbcHJvcF07XHJcbiAgICAgICAgICAgICAgICBtb2R1bGVTZXQuYWRkKG5ldyBNb2R1bGUoLTEgLSBqLCBuZXcgTGlua1NldHMoKSwgbmV3IExpbmtTZXRzKCksIHRoaXMuaW5pdE1vZHVsZXNGcm9tR3JvdXAoY2hpbGQpLCBkZWZpbml0aW9uKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG1vZHVsZVNldDtcclxuICAgIH07XHJcbiAgICBDb25maWd1cmF0aW9uLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChhLCBiLCBrKSB7XHJcbiAgICAgICAgaWYgKGsgPT09IHZvaWQgMCkgeyBrID0gMDsgfVxyXG4gICAgICAgIHZhciBpbkludCA9IGEuaW5jb21pbmcuaW50ZXJzZWN0aW9uKGIuaW5jb21pbmcpLCBvdXRJbnQgPSBhLm91dGdvaW5nLmludGVyc2VjdGlvbihiLm91dGdvaW5nKTtcclxuICAgICAgICB2YXIgY2hpbGRyZW4gPSBuZXcgTW9kdWxlU2V0KCk7XHJcbiAgICAgICAgY2hpbGRyZW4uYWRkKGEpO1xyXG4gICAgICAgIGNoaWxkcmVuLmFkZChiKTtcclxuICAgICAgICB2YXIgbSA9IG5ldyBNb2R1bGUodGhpcy5tb2R1bGVzLmxlbmd0aCwgb3V0SW50LCBpbkludCwgY2hpbGRyZW4pO1xyXG4gICAgICAgIHRoaXMubW9kdWxlcy5wdXNoKG0pO1xyXG4gICAgICAgIHZhciB1cGRhdGUgPSBmdW5jdGlvbiAocywgaSwgbykge1xyXG4gICAgICAgICAgICBzLmZvckFsbChmdW5jdGlvbiAobXMsIGxpbmt0eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBtcy5mb3JBbGwoZnVuY3Rpb24gKG4pIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbmxzID0gbltpXTtcclxuICAgICAgICAgICAgICAgICAgICBubHMuYWRkKGxpbmt0eXBlLCBtKTtcclxuICAgICAgICAgICAgICAgICAgICBubHMucmVtb3ZlKGxpbmt0eXBlLCBhKTtcclxuICAgICAgICAgICAgICAgICAgICBubHMucmVtb3ZlKGxpbmt0eXBlLCBiKTtcclxuICAgICAgICAgICAgICAgICAgICBhW29dLnJlbW92ZShsaW5rdHlwZSwgbik7XHJcbiAgICAgICAgICAgICAgICAgICAgYltvXS5yZW1vdmUobGlua3R5cGUsIG4pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdXBkYXRlKG91dEludCwgXCJpbmNvbWluZ1wiLCBcIm91dGdvaW5nXCIpO1xyXG4gICAgICAgIHVwZGF0ZShpbkludCwgXCJvdXRnb2luZ1wiLCBcImluY29taW5nXCIpO1xyXG4gICAgICAgIHRoaXMuUiAtPSBpbkludC5jb3VudCgpICsgb3V0SW50LmNvdW50KCk7XHJcbiAgICAgICAgdGhpcy5yb290c1trXS5yZW1vdmUoYSk7XHJcbiAgICAgICAgdGhpcy5yb290c1trXS5yZW1vdmUoYik7XHJcbiAgICAgICAgdGhpcy5yb290c1trXS5hZGQobSk7XHJcbiAgICAgICAgcmV0dXJuIG07XHJcbiAgICB9O1xyXG4gICAgQ29uZmlndXJhdGlvbi5wcm90b3R5cGUucm9vdE1lcmdlcyA9IGZ1bmN0aW9uIChrKSB7XHJcbiAgICAgICAgaWYgKGsgPT09IHZvaWQgMCkgeyBrID0gMDsgfVxyXG4gICAgICAgIHZhciBycyA9IHRoaXMucm9vdHNba10ubW9kdWxlcygpO1xyXG4gICAgICAgIHZhciBuID0gcnMubGVuZ3RoO1xyXG4gICAgICAgIHZhciBtZXJnZXMgPSBuZXcgQXJyYXkobiAqIChuIC0gMSkpO1xyXG4gICAgICAgIHZhciBjdHIgPSAwO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBpXyA9IG4gLSAxOyBpIDwgaV87ICsraSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gaSArIDE7IGogPCBuOyArK2opIHtcclxuICAgICAgICAgICAgICAgIHZhciBhID0gcnNbaV0sIGIgPSByc1tqXTtcclxuICAgICAgICAgICAgICAgIG1lcmdlc1tjdHJdID0geyBpZDogY3RyLCBuRWRnZXM6IHRoaXMubkVkZ2VzKGEsIGIpLCBhOiBhLCBiOiBiIH07XHJcbiAgICAgICAgICAgICAgICBjdHIrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbWVyZ2VzO1xyXG4gICAgfTtcclxuICAgIENvbmZpZ3VyYXRpb24ucHJvdG90eXBlLmdyZWVkeU1lcmdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5yb290cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5yb290c1tpXS5tb2R1bGVzKCkubGVuZ3RoIDwgMilcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB2YXIgbXMgPSB0aGlzLnJvb3RNZXJnZXMoaSkuc29ydChmdW5jdGlvbiAoYSwgYikgeyByZXR1cm4gYS5uRWRnZXMgPT0gYi5uRWRnZXMgPyBhLmlkIC0gYi5pZCA6IGEubkVkZ2VzIC0gYi5uRWRnZXM7IH0pO1xyXG4gICAgICAgICAgICB2YXIgbSA9IG1zWzBdO1xyXG4gICAgICAgICAgICBpZiAobS5uRWRnZXMgPj0gdGhpcy5SKVxyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIHRoaXMubWVyZ2UobS5hLCBtLmIsIGkpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgQ29uZmlndXJhdGlvbi5wcm90b3R5cGUubkVkZ2VzID0gZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICB2YXIgaW5JbnQgPSBhLmluY29taW5nLmludGVyc2VjdGlvbihiLmluY29taW5nKSwgb3V0SW50ID0gYS5vdXRnb2luZy5pbnRlcnNlY3Rpb24oYi5vdXRnb2luZyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuUiAtIGluSW50LmNvdW50KCkgLSBvdXRJbnQuY291bnQoKTtcclxuICAgIH07XHJcbiAgICBDb25maWd1cmF0aW9uLnByb3RvdHlwZS5nZXRHcm91cEhpZXJhcmNoeSA9IGZ1bmN0aW9uIChyZXRhcmdldGVkRWRnZXMpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHZhciBncm91cHMgPSBbXTtcclxuICAgICAgICB2YXIgcm9vdCA9IHt9O1xyXG4gICAgICAgIHRvR3JvdXBzKHRoaXMucm9vdHNbMF0sIHJvb3QsIGdyb3Vwcyk7XHJcbiAgICAgICAgdmFyIGVzID0gdGhpcy5hbGxFZGdlcygpO1xyXG4gICAgICAgIGVzLmZvckVhY2goZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgdmFyIGEgPSBfdGhpcy5tb2R1bGVzW2Uuc291cmNlXTtcclxuICAgICAgICAgICAgdmFyIGIgPSBfdGhpcy5tb2R1bGVzW2UudGFyZ2V0XTtcclxuICAgICAgICAgICAgcmV0YXJnZXRlZEVkZ2VzLnB1c2gobmV3IFBvd2VyRWRnZSh0eXBlb2YgYS5naWQgPT09IFwidW5kZWZpbmVkXCIgPyBlLnNvdXJjZSA6IGdyb3Vwc1thLmdpZF0sIHR5cGVvZiBiLmdpZCA9PT0gXCJ1bmRlZmluZWRcIiA/IGUudGFyZ2V0IDogZ3JvdXBzW2IuZ2lkXSwgZS50eXBlKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIGdyb3VwcztcclxuICAgIH07XHJcbiAgICBDb25maWd1cmF0aW9uLnByb3RvdHlwZS5hbGxFZGdlcyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgZXMgPSBbXTtcclxuICAgICAgICBDb25maWd1cmF0aW9uLmdldEVkZ2VzKHRoaXMucm9vdHNbMF0sIGVzKTtcclxuICAgICAgICByZXR1cm4gZXM7XHJcbiAgICB9O1xyXG4gICAgQ29uZmlndXJhdGlvbi5nZXRFZGdlcyA9IGZ1bmN0aW9uIChtb2R1bGVzLCBlcykge1xyXG4gICAgICAgIG1vZHVsZXMuZm9yQWxsKGZ1bmN0aW9uIChtKSB7XHJcbiAgICAgICAgICAgIG0uZ2V0RWRnZXMoZXMpO1xyXG4gICAgICAgICAgICBDb25maWd1cmF0aW9uLmdldEVkZ2VzKG0uY2hpbGRyZW4sIGVzKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gQ29uZmlndXJhdGlvbjtcclxufSgpKTtcclxuZXhwb3J0cy5Db25maWd1cmF0aW9uID0gQ29uZmlndXJhdGlvbjtcclxuZnVuY3Rpb24gdG9Hcm91cHMobW9kdWxlcywgZ3JvdXAsIGdyb3Vwcykge1xyXG4gICAgbW9kdWxlcy5mb3JBbGwoZnVuY3Rpb24gKG0pIHtcclxuICAgICAgICBpZiAobS5pc0xlYWYoKSkge1xyXG4gICAgICAgICAgICBpZiAoIWdyb3VwLmxlYXZlcylcclxuICAgICAgICAgICAgICAgIGdyb3VwLmxlYXZlcyA9IFtdO1xyXG4gICAgICAgICAgICBncm91cC5sZWF2ZXMucHVzaChtLmlkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBnID0gZ3JvdXA7XHJcbiAgICAgICAgICAgIG0uZ2lkID0gZ3JvdXBzLmxlbmd0aDtcclxuICAgICAgICAgICAgaWYgKCFtLmlzSXNsYW5kKCkgfHwgbS5pc1ByZWRlZmluZWQoKSkge1xyXG4gICAgICAgICAgICAgICAgZyA9IHsgaWQ6IG0uZ2lkIH07XHJcbiAgICAgICAgICAgICAgICBpZiAobS5pc1ByZWRlZmluZWQoKSlcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBwcm9wIGluIG0uZGVmaW5pdGlvbilcclxuICAgICAgICAgICAgICAgICAgICAgICAgZ1twcm9wXSA9IG0uZGVmaW5pdGlvbltwcm9wXTtcclxuICAgICAgICAgICAgICAgIGlmICghZ3JvdXAuZ3JvdXBzKVxyXG4gICAgICAgICAgICAgICAgICAgIGdyb3VwLmdyb3VwcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZ3JvdXAuZ3JvdXBzLnB1c2gobS5naWQpO1xyXG4gICAgICAgICAgICAgICAgZ3JvdXBzLnB1c2goZyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdG9Hcm91cHMobS5jaGlsZHJlbiwgZywgZ3JvdXBzKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG52YXIgTW9kdWxlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIE1vZHVsZShpZCwgb3V0Z29pbmcsIGluY29taW5nLCBjaGlsZHJlbiwgZGVmaW5pdGlvbikge1xyXG4gICAgICAgIGlmIChvdXRnb2luZyA9PT0gdm9pZCAwKSB7IG91dGdvaW5nID0gbmV3IExpbmtTZXRzKCk7IH1cclxuICAgICAgICBpZiAoaW5jb21pbmcgPT09IHZvaWQgMCkgeyBpbmNvbWluZyA9IG5ldyBMaW5rU2V0cygpOyB9XHJcbiAgICAgICAgaWYgKGNoaWxkcmVuID09PSB2b2lkIDApIHsgY2hpbGRyZW4gPSBuZXcgTW9kdWxlU2V0KCk7IH1cclxuICAgICAgICB0aGlzLmlkID0gaWQ7XHJcbiAgICAgICAgdGhpcy5vdXRnb2luZyA9IG91dGdvaW5nO1xyXG4gICAgICAgIHRoaXMuaW5jb21pbmcgPSBpbmNvbWluZztcclxuICAgICAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XHJcbiAgICAgICAgdGhpcy5kZWZpbml0aW9uID0gZGVmaW5pdGlvbjtcclxuICAgIH1cclxuICAgIE1vZHVsZS5wcm90b3R5cGUuZ2V0RWRnZXMgPSBmdW5jdGlvbiAoZXMpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMub3V0Z29pbmcuZm9yQWxsKGZ1bmN0aW9uIChtcywgZWRnZXR5cGUpIHtcclxuICAgICAgICAgICAgbXMuZm9yQWxsKGZ1bmN0aW9uICh0YXJnZXQpIHtcclxuICAgICAgICAgICAgICAgIGVzLnB1c2gobmV3IFBvd2VyRWRnZShfdGhpcy5pZCwgdGFyZ2V0LmlkLCBlZGdldHlwZSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBNb2R1bGUucHJvdG90eXBlLmlzTGVhZiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jaGlsZHJlbi5jb3VudCgpID09PSAwO1xyXG4gICAgfTtcclxuICAgIE1vZHVsZS5wcm90b3R5cGUuaXNJc2xhbmQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMub3V0Z29pbmcuY291bnQoKSA9PT0gMCAmJiB0aGlzLmluY29taW5nLmNvdW50KCkgPT09IDA7XHJcbiAgICB9O1xyXG4gICAgTW9kdWxlLnByb3RvdHlwZS5pc1ByZWRlZmluZWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB0aGlzLmRlZmluaXRpb24gIT09IFwidW5kZWZpbmVkXCI7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIE1vZHVsZTtcclxufSgpKTtcclxuZXhwb3J0cy5Nb2R1bGUgPSBNb2R1bGU7XHJcbmZ1bmN0aW9uIGludGVyc2VjdGlvbihtLCBuKSB7XHJcbiAgICB2YXIgaSA9IHt9O1xyXG4gICAgZm9yICh2YXIgdiBpbiBtKVxyXG4gICAgICAgIGlmICh2IGluIG4pXHJcbiAgICAgICAgICAgIGlbdl0gPSBtW3ZdO1xyXG4gICAgcmV0dXJuIGk7XHJcbn1cclxudmFyIE1vZHVsZVNldCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBNb2R1bGVTZXQoKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZSA9IHt9O1xyXG4gICAgfVxyXG4gICAgTW9kdWxlU2V0LnByb3RvdHlwZS5jb3VudCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy50YWJsZSkubGVuZ3RoO1xyXG4gICAgfTtcclxuICAgIE1vZHVsZVNldC5wcm90b3R5cGUuaW50ZXJzZWN0aW9uID0gZnVuY3Rpb24gKG90aGVyKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBNb2R1bGVTZXQoKTtcclxuICAgICAgICByZXN1bHQudGFibGUgPSBpbnRlcnNlY3Rpb24odGhpcy50YWJsZSwgb3RoZXIudGFibGUpO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgTW9kdWxlU2V0LnByb3RvdHlwZS5pbnRlcnNlY3Rpb25Db3VudCA9IGZ1bmN0aW9uIChvdGhlcikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmludGVyc2VjdGlvbihvdGhlcikuY291bnQoKTtcclxuICAgIH07XHJcbiAgICBNb2R1bGVTZXQucHJvdG90eXBlLmNvbnRhaW5zID0gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICAgICAgcmV0dXJuIGlkIGluIHRoaXMudGFibGU7XHJcbiAgICB9O1xyXG4gICAgTW9kdWxlU2V0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAobSkge1xyXG4gICAgICAgIHRoaXMudGFibGVbbS5pZF0gPSBtO1xyXG4gICAgfTtcclxuICAgIE1vZHVsZVNldC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gKG0pIHtcclxuICAgICAgICBkZWxldGUgdGhpcy50YWJsZVttLmlkXTtcclxuICAgIH07XHJcbiAgICBNb2R1bGVTZXQucHJvdG90eXBlLmZvckFsbCA9IGZ1bmN0aW9uIChmKSB7XHJcbiAgICAgICAgZm9yICh2YXIgbWlkIGluIHRoaXMudGFibGUpIHtcclxuICAgICAgICAgICAgZih0aGlzLnRhYmxlW21pZF0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBNb2R1bGVTZXQucHJvdG90eXBlLm1vZHVsZXMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHZzID0gW107XHJcbiAgICAgICAgdGhpcy5mb3JBbGwoZnVuY3Rpb24gKG0pIHtcclxuICAgICAgICAgICAgaWYgKCFtLmlzUHJlZGVmaW5lZCgpKVxyXG4gICAgICAgICAgICAgICAgdnMucHVzaChtKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdnM7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIE1vZHVsZVNldDtcclxufSgpKTtcclxuZXhwb3J0cy5Nb2R1bGVTZXQgPSBNb2R1bGVTZXQ7XHJcbnZhciBMaW5rU2V0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBMaW5rU2V0cygpIHtcclxuICAgICAgICB0aGlzLnNldHMgPSB7fTtcclxuICAgICAgICB0aGlzLm4gPSAwO1xyXG4gICAgfVxyXG4gICAgTGlua1NldHMucHJvdG90eXBlLmNvdW50ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm47XHJcbiAgICB9O1xyXG4gICAgTGlua1NldHMucHJvdG90eXBlLmNvbnRhaW5zID0gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuZm9yQWxsTW9kdWxlcyhmdW5jdGlvbiAobSkge1xyXG4gICAgICAgICAgICBpZiAoIXJlc3VsdCAmJiBtLmlkID09IGlkKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICBMaW5rU2V0cy5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGxpbmt0eXBlLCBtKSB7XHJcbiAgICAgICAgdmFyIHMgPSBsaW5rdHlwZSBpbiB0aGlzLnNldHMgPyB0aGlzLnNldHNbbGlua3R5cGVdIDogdGhpcy5zZXRzW2xpbmt0eXBlXSA9IG5ldyBNb2R1bGVTZXQoKTtcclxuICAgICAgICBzLmFkZChtKTtcclxuICAgICAgICArK3RoaXMubjtcclxuICAgIH07XHJcbiAgICBMaW5rU2V0cy5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gKGxpbmt0eXBlLCBtKSB7XHJcbiAgICAgICAgdmFyIG1zID0gdGhpcy5zZXRzW2xpbmt0eXBlXTtcclxuICAgICAgICBtcy5yZW1vdmUobSk7XHJcbiAgICAgICAgaWYgKG1zLmNvdW50KCkgPT09IDApIHtcclxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuc2V0c1tsaW5rdHlwZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC0tdGhpcy5uO1xyXG4gICAgfTtcclxuICAgIExpbmtTZXRzLnByb3RvdHlwZS5mb3JBbGwgPSBmdW5jdGlvbiAoZikge1xyXG4gICAgICAgIGZvciAodmFyIGxpbmt0eXBlIGluIHRoaXMuc2V0cykge1xyXG4gICAgICAgICAgICBmKHRoaXMuc2V0c1tsaW5rdHlwZV0sIE51bWJlcihsaW5rdHlwZSkpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBMaW5rU2V0cy5wcm90b3R5cGUuZm9yQWxsTW9kdWxlcyA9IGZ1bmN0aW9uIChmKSB7XHJcbiAgICAgICAgdGhpcy5mb3JBbGwoZnVuY3Rpb24gKG1zLCBsdCkgeyByZXR1cm4gbXMuZm9yQWxsKGYpOyB9KTtcclxuICAgIH07XHJcbiAgICBMaW5rU2V0cy5wcm90b3R5cGUuaW50ZXJzZWN0aW9uID0gZnVuY3Rpb24gKG90aGVyKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBMaW5rU2V0cygpO1xyXG4gICAgICAgIHRoaXMuZm9yQWxsKGZ1bmN0aW9uIChtcywgbHQpIHtcclxuICAgICAgICAgICAgaWYgKGx0IGluIG90aGVyLnNldHMpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpID0gbXMuaW50ZXJzZWN0aW9uKG90aGVyLnNldHNbbHRdKSwgbiA9IGkuY291bnQoKTtcclxuICAgICAgICAgICAgICAgIGlmIChuID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zZXRzW2x0XSA9IGk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lm4gKz0gbjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIExpbmtTZXRzO1xyXG59KCkpO1xyXG5leHBvcnRzLkxpbmtTZXRzID0gTGlua1NldHM7XHJcbmZ1bmN0aW9uIGludGVyc2VjdGlvbkNvdW50KG0sIG4pIHtcclxuICAgIHJldHVybiBPYmplY3Qua2V5cyhpbnRlcnNlY3Rpb24obSwgbikpLmxlbmd0aDtcclxufVxyXG5mdW5jdGlvbiBnZXRHcm91cHMobm9kZXMsIGxpbmtzLCBsYSwgcm9vdEdyb3VwKSB7XHJcbiAgICB2YXIgbiA9IG5vZGVzLmxlbmd0aCwgYyA9IG5ldyBDb25maWd1cmF0aW9uKG4sIGxpbmtzLCBsYSwgcm9vdEdyb3VwKTtcclxuICAgIHdoaWxlIChjLmdyZWVkeU1lcmdlKCkpXHJcbiAgICAgICAgO1xyXG4gICAgdmFyIHBvd2VyRWRnZXMgPSBbXTtcclxuICAgIHZhciBnID0gYy5nZXRHcm91cEhpZXJhcmNoeShwb3dlckVkZ2VzKTtcclxuICAgIHBvd2VyRWRnZXMuZm9yRWFjaChmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHZhciBmID0gZnVuY3Rpb24gKGVuZCkge1xyXG4gICAgICAgICAgICB2YXIgZyA9IGVbZW5kXTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBnID09IFwibnVtYmVyXCIpXHJcbiAgICAgICAgICAgICAgICBlW2VuZF0gPSBub2Rlc1tnXTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGYoXCJzb3VyY2VcIik7XHJcbiAgICAgICAgZihcInRhcmdldFwiKTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIHsgZ3JvdXBzOiBnLCBwb3dlckVkZ2VzOiBwb3dlckVkZ2VzIH07XHJcbn1cclxuZXhwb3J0cy5nZXRHcm91cHMgPSBnZXRHcm91cHM7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBvd2VyZ3JhcGguanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIFBhaXJpbmdIZWFwID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIFBhaXJpbmdIZWFwKGVsZW0pIHtcclxuICAgICAgICB0aGlzLmVsZW0gPSBlbGVtO1xyXG4gICAgICAgIHRoaXMuc3ViaGVhcHMgPSBbXTtcclxuICAgIH1cclxuICAgIFBhaXJpbmdIZWFwLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xyXG4gICAgICAgIHZhciBzdHIgPSBcIlwiLCBuZWVkQ29tbWEgPSBmYWxzZTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3ViaGVhcHMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIHN1YmhlYXAgPSB0aGlzLnN1YmhlYXBzW2ldO1xyXG4gICAgICAgICAgICBpZiAoIXN1YmhlYXAuZWxlbSkge1xyXG4gICAgICAgICAgICAgICAgbmVlZENvbW1hID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAobmVlZENvbW1hKSB7XHJcbiAgICAgICAgICAgICAgICBzdHIgPSBzdHIgKyBcIixcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBzdHIgPSBzdHIgKyBzdWJoZWFwLnRvU3RyaW5nKHNlbGVjdG9yKTtcclxuICAgICAgICAgICAgbmVlZENvbW1hID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHN0ciAhPT0gXCJcIikge1xyXG4gICAgICAgICAgICBzdHIgPSBcIihcIiArIHN0ciArIFwiKVwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gKHRoaXMuZWxlbSA/IHNlbGVjdG9yKHRoaXMuZWxlbSkgOiBcIlwiKSArIHN0cjtcclxuICAgIH07XHJcbiAgICBQYWlyaW5nSGVhcC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChmKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmVtcHR5KCkpIHtcclxuICAgICAgICAgICAgZih0aGlzLmVsZW0sIHRoaXMpO1xyXG4gICAgICAgICAgICB0aGlzLnN1YmhlYXBzLmZvckVhY2goZnVuY3Rpb24gKHMpIHsgcmV0dXJuIHMuZm9yRWFjaChmKTsgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFBhaXJpbmdIZWFwLnByb3RvdHlwZS5jb3VudCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5lbXB0eSgpID8gMCA6IDEgKyB0aGlzLnN1YmhlYXBzLnJlZHVjZShmdW5jdGlvbiAobiwgaCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbiArIGguY291bnQoKTtcclxuICAgICAgICB9LCAwKTtcclxuICAgIH07XHJcbiAgICBQYWlyaW5nSGVhcC5wcm90b3R5cGUubWluID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmVsZW07XHJcbiAgICB9O1xyXG4gICAgUGFpcmluZ0hlYXAucHJvdG90eXBlLmVtcHR5ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmVsZW0gPT0gbnVsbDtcclxuICAgIH07XHJcbiAgICBQYWlyaW5nSGVhcC5wcm90b3R5cGUuY29udGFpbnMgPSBmdW5jdGlvbiAoaCkge1xyXG4gICAgICAgIGlmICh0aGlzID09PSBoKVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3ViaGVhcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3ViaGVhcHNbaV0uY29udGFpbnMoaCkpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIFBhaXJpbmdIZWFwLnByb3RvdHlwZS5pc0hlYXAgPSBmdW5jdGlvbiAobGVzc1RoYW4pIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnN1YmhlYXBzLmV2ZXJ5KGZ1bmN0aW9uIChoKSB7IHJldHVybiBsZXNzVGhhbihfdGhpcy5lbGVtLCBoLmVsZW0pICYmIGguaXNIZWFwKGxlc3NUaGFuKTsgfSk7XHJcbiAgICB9O1xyXG4gICAgUGFpcmluZ0hlYXAucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uIChvYmosIGxlc3NUaGFuKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubWVyZ2UobmV3IFBhaXJpbmdIZWFwKG9iaiksIGxlc3NUaGFuKTtcclxuICAgIH07XHJcbiAgICBQYWlyaW5nSGVhcC5wcm90b3R5cGUubWVyZ2UgPSBmdW5jdGlvbiAoaGVhcDIsIGxlc3NUaGFuKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZW1wdHkoKSlcclxuICAgICAgICAgICAgcmV0dXJuIGhlYXAyO1xyXG4gICAgICAgIGVsc2UgaWYgKGhlYXAyLmVtcHR5KCkpXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIGVsc2UgaWYgKGxlc3NUaGFuKHRoaXMuZWxlbSwgaGVhcDIuZWxlbSkpIHtcclxuICAgICAgICAgICAgdGhpcy5zdWJoZWFwcy5wdXNoKGhlYXAyKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBoZWFwMi5zdWJoZWFwcy5wdXNoKHRoaXMpO1xyXG4gICAgICAgICAgICByZXR1cm4gaGVhcDI7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFBhaXJpbmdIZWFwLnByb3RvdHlwZS5yZW1vdmVNaW4gPSBmdW5jdGlvbiAobGVzc1RoYW4pIHtcclxuICAgICAgICBpZiAodGhpcy5lbXB0eSgpKVxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1lcmdlUGFpcnMobGVzc1RoYW4pO1xyXG4gICAgfTtcclxuICAgIFBhaXJpbmdIZWFwLnByb3RvdHlwZS5tZXJnZVBhaXJzID0gZnVuY3Rpb24gKGxlc3NUaGFuKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3ViaGVhcHMubGVuZ3RoID09IDApXHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgUGFpcmluZ0hlYXAobnVsbCk7XHJcbiAgICAgICAgZWxzZSBpZiAodGhpcy5zdWJoZWFwcy5sZW5ndGggPT0gMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zdWJoZWFwc1swXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBmaXJzdFBhaXIgPSB0aGlzLnN1YmhlYXBzLnBvcCgpLm1lcmdlKHRoaXMuc3ViaGVhcHMucG9wKCksIGxlc3NUaGFuKTtcclxuICAgICAgICAgICAgdmFyIHJlbWFpbmluZyA9IHRoaXMubWVyZ2VQYWlycyhsZXNzVGhhbik7XHJcbiAgICAgICAgICAgIHJldHVybiBmaXJzdFBhaXIubWVyZ2UocmVtYWluaW5nLCBsZXNzVGhhbik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFBhaXJpbmdIZWFwLnByb3RvdHlwZS5kZWNyZWFzZUtleSA9IGZ1bmN0aW9uIChzdWJoZWFwLCBuZXdWYWx1ZSwgc2V0SGVhcE5vZGUsIGxlc3NUaGFuKSB7XHJcbiAgICAgICAgdmFyIG5ld0hlYXAgPSBzdWJoZWFwLnJlbW92ZU1pbihsZXNzVGhhbik7XHJcbiAgICAgICAgc3ViaGVhcC5lbGVtID0gbmV3SGVhcC5lbGVtO1xyXG4gICAgICAgIHN1YmhlYXAuc3ViaGVhcHMgPSBuZXdIZWFwLnN1YmhlYXBzO1xyXG4gICAgICAgIGlmIChzZXRIZWFwTm9kZSAhPT0gbnVsbCAmJiBuZXdIZWFwLmVsZW0gIT09IG51bGwpIHtcclxuICAgICAgICAgICAgc2V0SGVhcE5vZGUoc3ViaGVhcC5lbGVtLCBzdWJoZWFwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHBhaXJpbmdOb2RlID0gbmV3IFBhaXJpbmdIZWFwKG5ld1ZhbHVlKTtcclxuICAgICAgICBpZiAoc2V0SGVhcE5vZGUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgc2V0SGVhcE5vZGUobmV3VmFsdWUsIHBhaXJpbmdOb2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubWVyZ2UocGFpcmluZ05vZGUsIGxlc3NUaGFuKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gUGFpcmluZ0hlYXA7XHJcbn0oKSk7XHJcbmV4cG9ydHMuUGFpcmluZ0hlYXAgPSBQYWlyaW5nSGVhcDtcclxudmFyIFByaW9yaXR5UXVldWUgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gUHJpb3JpdHlRdWV1ZShsZXNzVGhhbikge1xyXG4gICAgICAgIHRoaXMubGVzc1RoYW4gPSBsZXNzVGhhbjtcclxuICAgIH1cclxuICAgIFByaW9yaXR5UXVldWUucHJvdG90eXBlLnRvcCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5lbXB0eSgpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5yb290LmVsZW07XHJcbiAgICB9O1xyXG4gICAgUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYXJncyA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XHJcbiAgICAgICAgICAgIGFyZ3NbX2ldID0gYXJndW1lbnRzW19pXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHBhaXJpbmdOb2RlO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBhcmc7IGFyZyA9IGFyZ3NbaV07ICsraSkge1xyXG4gICAgICAgICAgICBwYWlyaW5nTm9kZSA9IG5ldyBQYWlyaW5nSGVhcChhcmcpO1xyXG4gICAgICAgICAgICB0aGlzLnJvb3QgPSB0aGlzLmVtcHR5KCkgP1xyXG4gICAgICAgICAgICAgICAgcGFpcmluZ05vZGUgOiB0aGlzLnJvb3QubWVyZ2UocGFpcmluZ05vZGUsIHRoaXMubGVzc1RoYW4pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcGFpcmluZ05vZGU7XHJcbiAgICB9O1xyXG4gICAgUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICF0aGlzLnJvb3QgfHwgIXRoaXMucm9vdC5lbGVtO1xyXG4gICAgfTtcclxuICAgIFByaW9yaXR5UXVldWUucHJvdG90eXBlLmlzSGVhcCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yb290LmlzSGVhcCh0aGlzLmxlc3NUaGFuKTtcclxuICAgIH07XHJcbiAgICBQcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gKGYpIHtcclxuICAgICAgICB0aGlzLnJvb3QuZm9yRWFjaChmKTtcclxuICAgIH07XHJcbiAgICBQcmlvcml0eVF1ZXVlLnByb3RvdHlwZS5wb3AgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZW1wdHkoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIG9iaiA9IHRoaXMucm9vdC5taW4oKTtcclxuICAgICAgICB0aGlzLnJvb3QgPSB0aGlzLnJvb3QucmVtb3ZlTWluKHRoaXMubGVzc1RoYW4pO1xyXG4gICAgICAgIHJldHVybiBvYmo7XHJcbiAgICB9O1xyXG4gICAgUHJpb3JpdHlRdWV1ZS5wcm90b3R5cGUucmVkdWNlS2V5ID0gZnVuY3Rpb24gKGhlYXBOb2RlLCBuZXdLZXksIHNldEhlYXBOb2RlKSB7XHJcbiAgICAgICAgaWYgKHNldEhlYXBOb2RlID09PSB2b2lkIDApIHsgc2V0SGVhcE5vZGUgPSBudWxsOyB9XHJcbiAgICAgICAgdGhpcy5yb290ID0gdGhpcy5yb290LmRlY3JlYXNlS2V5KGhlYXBOb2RlLCBuZXdLZXksIHNldEhlYXBOb2RlLCB0aGlzLmxlc3NUaGFuKTtcclxuICAgIH07XHJcbiAgICBQcmlvcml0eVF1ZXVlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QudG9TdHJpbmcoc2VsZWN0b3IpO1xyXG4gICAgfTtcclxuICAgIFByaW9yaXR5UXVldWUucHJvdG90eXBlLmNvdW50ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QuY291bnQoKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gUHJpb3JpdHlRdWV1ZTtcclxufSgpKTtcclxuZXhwb3J0cy5Qcmlvcml0eVF1ZXVlID0gUHJpb3JpdHlRdWV1ZTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cHF1ZXVlLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgX19leHRlbmRzID0gKHRoaXMgJiYgdGhpcy5fX2V4dGVuZHMpIHx8IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBmdW5jdGlvbiAoZCwgYikge1xyXG4gICAgICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICAgICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICAgICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG4gICAgfTtcclxufSkoKTtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG52YXIgVHJlZUJhc2UgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gVHJlZUJhc2UoKSB7XHJcbiAgICAgICAgdGhpcy5maW5kSXRlciA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xyXG4gICAgICAgICAgICB2YXIgaXRlciA9IHRoaXMuaXRlcmF0b3IoKTtcclxuICAgICAgICAgICAgd2hpbGUgKHJlcyAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGMgPSB0aGlzLl9jb21wYXJhdG9yKGRhdGEsIHJlcy5kYXRhKTtcclxuICAgICAgICAgICAgICAgIGlmIChjID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlci5fY3Vyc29yID0gcmVzO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVyO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlci5fYW5jZXN0b3JzLnB1c2gocmVzKTtcclxuICAgICAgICAgICAgICAgICAgICByZXMgPSByZXMuZ2V0X2NoaWxkKGMgPiAwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgVHJlZUJhc2UucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuX3Jvb3QgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuc2l6ZSA9IDA7XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgVHJlZUJhc2UucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xyXG4gICAgICAgIHdoaWxlIChyZXMgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdmFyIGMgPSB0aGlzLl9jb21wYXJhdG9yKGRhdGEsIHJlcy5kYXRhKTtcclxuICAgICAgICAgICAgaWYgKGMgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiByZXMuZGF0YTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5nZXRfY2hpbGQoYyA+IDApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfTtcclxuICAgIDtcclxuICAgIFRyZWVCYXNlLnByb3RvdHlwZS5sb3dlckJvdW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fYm91bmQoZGF0YSwgdGhpcy5fY29tcGFyYXRvcik7XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgVHJlZUJhc2UucHJvdG90eXBlLnVwcGVyQm91bmQgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHZhciBjbXAgPSB0aGlzLl9jb21wYXJhdG9yO1xyXG4gICAgICAgIGZ1bmN0aW9uIHJldmVyc2VfY21wKGEsIGIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNtcChiLCBhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JvdW5kKGRhdGEsIHJldmVyc2VfY21wKTtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBUcmVlQmFzZS5wcm90b3R5cGUubWluID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xyXG4gICAgICAgIGlmIChyZXMgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdoaWxlIChyZXMubGVmdCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXMgPSByZXMubGVmdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlcy5kYXRhO1xyXG4gICAgfTtcclxuICAgIDtcclxuICAgIFRyZWVCYXNlLnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJlcyA9IHRoaXMuX3Jvb3Q7XHJcbiAgICAgICAgaWYgKHJlcyA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2hpbGUgKHJlcy5yaWdodCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICByZXMgPSByZXMucmlnaHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXMuZGF0YTtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBUcmVlQmFzZS5wcm90b3R5cGUuaXRlcmF0b3IgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBJdGVyYXRvcih0aGlzKTtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBUcmVlQmFzZS5wcm90b3R5cGUuZWFjaCA9IGZ1bmN0aW9uIChjYikge1xyXG4gICAgICAgIHZhciBpdCA9IHRoaXMuaXRlcmF0b3IoKSwgZGF0YTtcclxuICAgICAgICB3aGlsZSAoKGRhdGEgPSBpdC5uZXh0KCkpICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNiKGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBUcmVlQmFzZS5wcm90b3R5cGUucmVhY2ggPSBmdW5jdGlvbiAoY2IpIHtcclxuICAgICAgICB2YXIgaXQgPSB0aGlzLml0ZXJhdG9yKCksIGRhdGE7XHJcbiAgICAgICAgd2hpbGUgKChkYXRhID0gaXQucHJldigpKSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjYihkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgVHJlZUJhc2UucHJvdG90eXBlLl9ib3VuZCA9IGZ1bmN0aW9uIChkYXRhLCBjbXApIHtcclxuICAgICAgICB2YXIgY3VyID0gdGhpcy5fcm9vdDtcclxuICAgICAgICB2YXIgaXRlciA9IHRoaXMuaXRlcmF0b3IoKTtcclxuICAgICAgICB3aGlsZSAoY3VyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciBjID0gdGhpcy5fY29tcGFyYXRvcihkYXRhLCBjdXIuZGF0YSk7XHJcbiAgICAgICAgICAgIGlmIChjID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBpdGVyLl9jdXJzb3IgPSBjdXI7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpdGVyLl9hbmNlc3RvcnMucHVzaChjdXIpO1xyXG4gICAgICAgICAgICBjdXIgPSBjdXIuZ2V0X2NoaWxkKGMgPiAwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IGl0ZXIuX2FuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xyXG4gICAgICAgICAgICBjdXIgPSBpdGVyLl9hbmNlc3RvcnNbaV07XHJcbiAgICAgICAgICAgIGlmIChjbXAoZGF0YSwgY3VyLmRhdGEpID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaXRlci5fY3Vyc29yID0gY3VyO1xyXG4gICAgICAgICAgICAgICAgaXRlci5fYW5jZXN0b3JzLmxlbmd0aCA9IGk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpdGVyLl9hbmNlc3RvcnMubGVuZ3RoID0gMDtcclxuICAgICAgICByZXR1cm4gaXRlcjtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICByZXR1cm4gVHJlZUJhc2U7XHJcbn0oKSk7XHJcbmV4cG9ydHMuVHJlZUJhc2UgPSBUcmVlQmFzZTtcclxudmFyIEl0ZXJhdG9yID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIEl0ZXJhdG9yKHRyZWUpIHtcclxuICAgICAgICB0aGlzLl90cmVlID0gdHJlZTtcclxuICAgICAgICB0aGlzLl9hbmNlc3RvcnMgPSBbXTtcclxuICAgICAgICB0aGlzLl9jdXJzb3IgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgSXRlcmF0b3IucHJvdG90eXBlLmRhdGEgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnNvciAhPT0gbnVsbCA/IHRoaXMuX2N1cnNvci5kYXRhIDogbnVsbDtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBJdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5fY3Vyc29yID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciByb290ID0gdGhpcy5fdHJlZS5fcm9vdDtcclxuICAgICAgICAgICAgaWYgKHJvb3QgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX21pbk5vZGUocm9vdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdXJzb3IucmlnaHQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzYXZlO1xyXG4gICAgICAgICAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICAgICAgICAgIHNhdmUgPSB0aGlzLl9jdXJzb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2FuY2VzdG9ycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3Vyc29yID0gdGhpcy5fYW5jZXN0b3JzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3Vyc29yID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSB3aGlsZSAodGhpcy5fY3Vyc29yLnJpZ2h0ID09PSBzYXZlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2FuY2VzdG9ycy5wdXNoKHRoaXMuX2N1cnNvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9taW5Ob2RlKHRoaXMuX2N1cnNvci5yaWdodCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnNvciAhPT0gbnVsbCA/IHRoaXMuX2N1cnNvci5kYXRhIDogbnVsbDtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBJdGVyYXRvci5wcm90b3R5cGUucHJldiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5fY3Vyc29yID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciByb290ID0gdGhpcy5fdHJlZS5fcm9vdDtcclxuICAgICAgICAgICAgaWYgKHJvb3QgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX21heE5vZGUocm9vdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdXJzb3IubGVmdCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHNhdmU7XHJcbiAgICAgICAgICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2F2ZSA9IHRoaXMuX2N1cnNvcjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYW5jZXN0b3JzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdXJzb3IgPSB0aGlzLl9hbmNlc3RvcnMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdXJzb3IgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IHdoaWxlICh0aGlzLl9jdXJzb3IubGVmdCA9PT0gc2F2ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9hbmNlc3RvcnMucHVzaCh0aGlzLl9jdXJzb3IpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbWF4Tm9kZSh0aGlzLl9jdXJzb3IubGVmdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnNvciAhPT0gbnVsbCA/IHRoaXMuX2N1cnNvci5kYXRhIDogbnVsbDtcclxuICAgIH07XHJcbiAgICA7XHJcbiAgICBJdGVyYXRvci5wcm90b3R5cGUuX21pbk5vZGUgPSBmdW5jdGlvbiAoc3RhcnQpIHtcclxuICAgICAgICB3aGlsZSAoc3RhcnQubGVmdCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9hbmNlc3RvcnMucHVzaChzdGFydCk7XHJcbiAgICAgICAgICAgIHN0YXJ0ID0gc3RhcnQubGVmdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gc3RhcnQ7XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgSXRlcmF0b3IucHJvdG90eXBlLl9tYXhOb2RlID0gZnVuY3Rpb24gKHN0YXJ0KSB7XHJcbiAgICAgICAgd2hpbGUgKHN0YXJ0LnJpZ2h0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2FuY2VzdG9ycy5wdXNoKHN0YXJ0KTtcclxuICAgICAgICAgICAgc3RhcnQgPSBzdGFydC5yaWdodDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gc3RhcnQ7XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgcmV0dXJuIEl0ZXJhdG9yO1xyXG59KCkpO1xyXG5leHBvcnRzLkl0ZXJhdG9yID0gSXRlcmF0b3I7XHJcbnZhciBOb2RlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIE5vZGUoZGF0YSkge1xyXG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XHJcbiAgICAgICAgdGhpcy5sZWZ0ID0gbnVsbDtcclxuICAgICAgICB0aGlzLnJpZ2h0ID0gbnVsbDtcclxuICAgICAgICB0aGlzLnJlZCA9IHRydWU7XHJcbiAgICB9XHJcbiAgICBOb2RlLnByb3RvdHlwZS5nZXRfY2hpbGQgPSBmdW5jdGlvbiAoZGlyKSB7XHJcbiAgICAgICAgcmV0dXJuIGRpciA/IHRoaXMucmlnaHQgOiB0aGlzLmxlZnQ7XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgTm9kZS5wcm90b3R5cGUuc2V0X2NoaWxkID0gZnVuY3Rpb24gKGRpciwgdmFsKSB7XHJcbiAgICAgICAgaWYgKGRpcikge1xyXG4gICAgICAgICAgICB0aGlzLnJpZ2h0ID0gdmFsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5sZWZ0ID0gdmFsO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICA7XHJcbiAgICByZXR1cm4gTm9kZTtcclxufSgpKTtcclxudmFyIFJCVHJlZSA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XHJcbiAgICBfX2V4dGVuZHMoUkJUcmVlLCBfc3VwZXIpO1xyXG4gICAgZnVuY3Rpb24gUkJUcmVlKGNvbXBhcmF0b3IpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSBfc3VwZXIuY2FsbCh0aGlzKSB8fCB0aGlzO1xyXG4gICAgICAgIF90aGlzLl9yb290ID0gbnVsbDtcclxuICAgICAgICBfdGhpcy5fY29tcGFyYXRvciA9IGNvbXBhcmF0b3I7XHJcbiAgICAgICAgX3RoaXMuc2l6ZSA9IDA7XHJcbiAgICAgICAgcmV0dXJuIF90aGlzO1xyXG4gICAgfVxyXG4gICAgUkJUcmVlLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHZhciByZXQgPSBmYWxzZTtcclxuICAgICAgICBpZiAodGhpcy5fcm9vdCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLl9yb290ID0gbmV3IE5vZGUoZGF0YSk7XHJcbiAgICAgICAgICAgIHJldCA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMuc2l6ZSsrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGhlYWQgPSBuZXcgTm9kZSh1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICB2YXIgZGlyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHZhciBsYXN0ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHZhciBncCA9IG51bGw7XHJcbiAgICAgICAgICAgIHZhciBnZ3AgPSBoZWFkO1xyXG4gICAgICAgICAgICB2YXIgcCA9IG51bGw7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gdGhpcy5fcm9vdDtcclxuICAgICAgICAgICAgZ2dwLnJpZ2h0ID0gdGhpcy5fcm9vdDtcclxuICAgICAgICAgICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChub2RlID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IG5ldyBOb2RlKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIHAuc2V0X2NoaWxkKGRpciwgbm9kZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNpemUrKztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKFJCVHJlZS5pc19yZWQobm9kZS5sZWZ0KSAmJiBSQlRyZWUuaXNfcmVkKG5vZGUucmlnaHQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5yZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIG5vZGUubGVmdC5yZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBub2RlLnJpZ2h0LnJlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKFJCVHJlZS5pc19yZWQobm9kZSkgJiYgUkJUcmVlLmlzX3JlZChwKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkaXIyID0gZ2dwLnJpZ2h0ID09PSBncDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZSA9PT0gcC5nZXRfY2hpbGQobGFzdCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZ2dwLnNldF9jaGlsZChkaXIyLCBSQlRyZWUuc2luZ2xlX3JvdGF0ZShncCwgIWxhc3QpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdncC5zZXRfY2hpbGQoZGlyMiwgUkJUcmVlLmRvdWJsZV9yb3RhdGUoZ3AsICFsYXN0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIGNtcCA9IHRoaXMuX2NvbXBhcmF0b3Iobm9kZS5kYXRhLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgIGlmIChjbXAgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxhc3QgPSBkaXI7XHJcbiAgICAgICAgICAgICAgICBkaXIgPSBjbXAgPCAwO1xyXG4gICAgICAgICAgICAgICAgaWYgKGdwICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZ2dwID0gZ3A7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBncCA9IHA7XHJcbiAgICAgICAgICAgICAgICBwID0gbm9kZTtcclxuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLmdldF9jaGlsZChkaXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX3Jvb3QgPSBoZWFkLnJpZ2h0O1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9yb290LnJlZCA9IGZhbHNlO1xyXG4gICAgICAgIHJldHVybiByZXQ7XHJcbiAgICB9O1xyXG4gICAgO1xyXG4gICAgUkJUcmVlLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIGlmICh0aGlzLl9yb290ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGhlYWQgPSBuZXcgTm9kZSh1bmRlZmluZWQpO1xyXG4gICAgICAgIHZhciBub2RlID0gaGVhZDtcclxuICAgICAgICBub2RlLnJpZ2h0ID0gdGhpcy5fcm9vdDtcclxuICAgICAgICB2YXIgcCA9IG51bGw7XHJcbiAgICAgICAgdmFyIGdwID0gbnVsbDtcclxuICAgICAgICB2YXIgZm91bmQgPSBudWxsO1xyXG4gICAgICAgIHZhciBkaXIgPSB0cnVlO1xyXG4gICAgICAgIHdoaWxlIChub2RlLmdldF9jaGlsZChkaXIpICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHZhciBsYXN0ID0gZGlyO1xyXG4gICAgICAgICAgICBncCA9IHA7XHJcbiAgICAgICAgICAgIHAgPSBub2RlO1xyXG4gICAgICAgICAgICBub2RlID0gbm9kZS5nZXRfY2hpbGQoZGlyKTtcclxuICAgICAgICAgICAgdmFyIGNtcCA9IHRoaXMuX2NvbXBhcmF0b3IoZGF0YSwgbm9kZS5kYXRhKTtcclxuICAgICAgICAgICAgZGlyID0gY21wID4gMDtcclxuICAgICAgICAgICAgaWYgKGNtcCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgZm91bmQgPSBub2RlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghUkJUcmVlLmlzX3JlZChub2RlKSAmJiAhUkJUcmVlLmlzX3JlZChub2RlLmdldF9jaGlsZChkaXIpKSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKFJCVHJlZS5pc19yZWQobm9kZS5nZXRfY2hpbGQoIWRpcikpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNyID0gUkJUcmVlLnNpbmdsZV9yb3RhdGUobm9kZSwgZGlyKTtcclxuICAgICAgICAgICAgICAgICAgICBwLnNldF9jaGlsZChsYXN0LCBzcik7XHJcbiAgICAgICAgICAgICAgICAgICAgcCA9IHNyO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIVJCVHJlZS5pc19yZWQobm9kZS5nZXRfY2hpbGQoIWRpcikpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNpYmxpbmcgPSBwLmdldF9jaGlsZCghbGFzdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNpYmxpbmcgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFSQlRyZWUuaXNfcmVkKHNpYmxpbmcuZ2V0X2NoaWxkKCFsYXN0KSkgJiYgIVJCVHJlZS5pc19yZWQoc2libGluZy5nZXRfY2hpbGQobGFzdCkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwLnJlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2libGluZy5yZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5yZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRpcjIgPSBncC5yaWdodCA9PT0gcDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChSQlRyZWUuaXNfcmVkKHNpYmxpbmcuZ2V0X2NoaWxkKGxhc3QpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdwLnNldF9jaGlsZChkaXIyLCBSQlRyZWUuZG91YmxlX3JvdGF0ZShwLCBsYXN0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChSQlRyZWUuaXNfcmVkKHNpYmxpbmcuZ2V0X2NoaWxkKCFsYXN0KSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBncC5zZXRfY2hpbGQoZGlyMiwgUkJUcmVlLnNpbmdsZV9yb3RhdGUocCwgbGFzdCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGdwYyA9IGdwLmdldF9jaGlsZChkaXIyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdwYy5yZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5yZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3BjLmxlZnQucmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncGMucmlnaHQucmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGZvdW5kLmRhdGEgPSBub2RlLmRhdGE7XHJcbiAgICAgICAgICAgIHAuc2V0X2NoaWxkKHAucmlnaHQgPT09IG5vZGUsIG5vZGUuZ2V0X2NoaWxkKG5vZGUubGVmdCA9PT0gbnVsbCkpO1xyXG4gICAgICAgICAgICB0aGlzLnNpemUtLTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fcm9vdCA9IGhlYWQucmlnaHQ7XHJcbiAgICAgICAgaWYgKHRoaXMuX3Jvb3QgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fcm9vdC5yZWQgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZvdW5kICE9PSBudWxsO1xyXG4gICAgfTtcclxuICAgIDtcclxuICAgIFJCVHJlZS5pc19yZWQgPSBmdW5jdGlvbiAobm9kZSkge1xyXG4gICAgICAgIHJldHVybiBub2RlICE9PSBudWxsICYmIG5vZGUucmVkO1xyXG4gICAgfTtcclxuICAgIFJCVHJlZS5zaW5nbGVfcm90YXRlID0gZnVuY3Rpb24gKHJvb3QsIGRpcikge1xyXG4gICAgICAgIHZhciBzYXZlID0gcm9vdC5nZXRfY2hpbGQoIWRpcik7XHJcbiAgICAgICAgcm9vdC5zZXRfY2hpbGQoIWRpciwgc2F2ZS5nZXRfY2hpbGQoZGlyKSk7XHJcbiAgICAgICAgc2F2ZS5zZXRfY2hpbGQoZGlyLCByb290KTtcclxuICAgICAgICByb290LnJlZCA9IHRydWU7XHJcbiAgICAgICAgc2F2ZS5yZWQgPSBmYWxzZTtcclxuICAgICAgICByZXR1cm4gc2F2ZTtcclxuICAgIH07XHJcbiAgICBSQlRyZWUuZG91YmxlX3JvdGF0ZSA9IGZ1bmN0aW9uIChyb290LCBkaXIpIHtcclxuICAgICAgICByb290LnNldF9jaGlsZCghZGlyLCBSQlRyZWUuc2luZ2xlX3JvdGF0ZShyb290LmdldF9jaGlsZCghZGlyKSwgIWRpcikpO1xyXG4gICAgICAgIHJldHVybiBSQlRyZWUuc2luZ2xlX3JvdGF0ZShyb290LCBkaXIpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBSQlRyZWU7XHJcbn0oVHJlZUJhc2UpKTtcclxuZXhwb3J0cy5SQlRyZWUgPSBSQlRyZWU7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJidHJlZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIF9fZXh0ZW5kcyA9ICh0aGlzICYmIHRoaXMuX19leHRlbmRzKSB8fCAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoYi5oYXNPd25Qcm9wZXJ0eShwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKGQsIGIpIHtcclxuICAgICAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxuICAgIH07XHJcbn0pKCk7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIHZwc2NfMSA9IHJlcXVpcmUoXCIuL3Zwc2NcIik7XHJcbnZhciByYnRyZWVfMSA9IHJlcXVpcmUoXCIuL3JidHJlZVwiKTtcclxuZnVuY3Rpb24gY29tcHV0ZUdyb3VwQm91bmRzKGcpIHtcclxuICAgIGcuYm91bmRzID0gdHlwZW9mIGcubGVhdmVzICE9PSBcInVuZGVmaW5lZFwiID9cclxuICAgICAgICBnLmxlYXZlcy5yZWR1Y2UoZnVuY3Rpb24gKHIsIGMpIHsgcmV0dXJuIGMuYm91bmRzLnVuaW9uKHIpOyB9LCBSZWN0YW5nbGUuZW1wdHkoKSkgOlxyXG4gICAgICAgIFJlY3RhbmdsZS5lbXB0eSgpO1xyXG4gICAgaWYgKHR5cGVvZiBnLmdyb3VwcyAhPT0gXCJ1bmRlZmluZWRcIilcclxuICAgICAgICBnLmJvdW5kcyA9IGcuZ3JvdXBzLnJlZHVjZShmdW5jdGlvbiAociwgYykgeyByZXR1cm4gY29tcHV0ZUdyb3VwQm91bmRzKGMpLnVuaW9uKHIpOyB9LCBnLmJvdW5kcyk7XHJcbiAgICBnLmJvdW5kcyA9IGcuYm91bmRzLmluZmxhdGUoZy5wYWRkaW5nKTtcclxuICAgIHJldHVybiBnLmJvdW5kcztcclxufVxyXG5leHBvcnRzLmNvbXB1dGVHcm91cEJvdW5kcyA9IGNvbXB1dGVHcm91cEJvdW5kcztcclxudmFyIFJlY3RhbmdsZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBSZWN0YW5nbGUoeCwgWCwgeSwgWSkge1xyXG4gICAgICAgIHRoaXMueCA9IHg7XHJcbiAgICAgICAgdGhpcy5YID0gWDtcclxuICAgICAgICB0aGlzLnkgPSB5O1xyXG4gICAgICAgIHRoaXMuWSA9IFk7XHJcbiAgICB9XHJcbiAgICBSZWN0YW5nbGUuZW1wdHkgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBuZXcgUmVjdGFuZ2xlKE51bWJlci5QT1NJVElWRV9JTkZJTklUWSwgTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIE51bWJlci5ORUdBVElWRV9JTkZJTklUWSk7IH07XHJcbiAgICBSZWN0YW5nbGUucHJvdG90eXBlLmN4ID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gKHRoaXMueCArIHRoaXMuWCkgLyAyOyB9O1xyXG4gICAgUmVjdGFuZ2xlLnByb3RvdHlwZS5jeSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICh0aGlzLnkgKyB0aGlzLlkpIC8gMjsgfTtcclxuICAgIFJlY3RhbmdsZS5wcm90b3R5cGUub3ZlcmxhcFggPSBmdW5jdGlvbiAocikge1xyXG4gICAgICAgIHZhciB1eCA9IHRoaXMuY3goKSwgdnggPSByLmN4KCk7XHJcbiAgICAgICAgaWYgKHV4IDw9IHZ4ICYmIHIueCA8IHRoaXMuWClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuWCAtIHIueDtcclxuICAgICAgICBpZiAodnggPD0gdXggJiYgdGhpcy54IDwgci5YKVxyXG4gICAgICAgICAgICByZXR1cm4gci5YIC0gdGhpcy54O1xyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfTtcclxuICAgIFJlY3RhbmdsZS5wcm90b3R5cGUub3ZlcmxhcFkgPSBmdW5jdGlvbiAocikge1xyXG4gICAgICAgIHZhciB1eSA9IHRoaXMuY3koKSwgdnkgPSByLmN5KCk7XHJcbiAgICAgICAgaWYgKHV5IDw9IHZ5ICYmIHIueSA8IHRoaXMuWSlcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuWSAtIHIueTtcclxuICAgICAgICBpZiAodnkgPD0gdXkgJiYgdGhpcy55IDwgci5ZKVxyXG4gICAgICAgICAgICByZXR1cm4gci5ZIC0gdGhpcy55O1xyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfTtcclxuICAgIFJlY3RhbmdsZS5wcm90b3R5cGUuc2V0WENlbnRyZSA9IGZ1bmN0aW9uIChjeCkge1xyXG4gICAgICAgIHZhciBkeCA9IGN4IC0gdGhpcy5jeCgpO1xyXG4gICAgICAgIHRoaXMueCArPSBkeDtcclxuICAgICAgICB0aGlzLlggKz0gZHg7XHJcbiAgICB9O1xyXG4gICAgUmVjdGFuZ2xlLnByb3RvdHlwZS5zZXRZQ2VudHJlID0gZnVuY3Rpb24gKGN5KSB7XHJcbiAgICAgICAgdmFyIGR5ID0gY3kgLSB0aGlzLmN5KCk7XHJcbiAgICAgICAgdGhpcy55ICs9IGR5O1xyXG4gICAgICAgIHRoaXMuWSArPSBkeTtcclxuICAgIH07XHJcbiAgICBSZWN0YW5nbGUucHJvdG90eXBlLndpZHRoID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLlggLSB0aGlzLng7XHJcbiAgICB9O1xyXG4gICAgUmVjdGFuZ2xlLnByb3RvdHlwZS5oZWlnaHQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuWSAtIHRoaXMueTtcclxuICAgIH07XHJcbiAgICBSZWN0YW5nbGUucHJvdG90eXBlLnVuaW9uID0gZnVuY3Rpb24gKHIpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFJlY3RhbmdsZShNYXRoLm1pbih0aGlzLngsIHIueCksIE1hdGgubWF4KHRoaXMuWCwgci5YKSwgTWF0aC5taW4odGhpcy55LCByLnkpLCBNYXRoLm1heCh0aGlzLlksIHIuWSkpO1xyXG4gICAgfTtcclxuICAgIFJlY3RhbmdsZS5wcm90b3R5cGUubGluZUludGVyc2VjdGlvbnMgPSBmdW5jdGlvbiAoeDEsIHkxLCB4MiwgeTIpIHtcclxuICAgICAgICB2YXIgc2lkZXMgPSBbW3RoaXMueCwgdGhpcy55LCB0aGlzLlgsIHRoaXMueV0sXHJcbiAgICAgICAgICAgIFt0aGlzLlgsIHRoaXMueSwgdGhpcy5YLCB0aGlzLlldLFxyXG4gICAgICAgICAgICBbdGhpcy5YLCB0aGlzLlksIHRoaXMueCwgdGhpcy5ZXSxcclxuICAgICAgICAgICAgW3RoaXMueCwgdGhpcy5ZLCB0aGlzLngsIHRoaXMueV1dO1xyXG4gICAgICAgIHZhciBpbnRlcnNlY3Rpb25zID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCA0OyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIHIgPSBSZWN0YW5nbGUubGluZUludGVyc2VjdGlvbih4MSwgeTEsIHgyLCB5Miwgc2lkZXNbaV1bMF0sIHNpZGVzW2ldWzFdLCBzaWRlc1tpXVsyXSwgc2lkZXNbaV1bM10pO1xyXG4gICAgICAgICAgICBpZiAociAhPT0gbnVsbClcclxuICAgICAgICAgICAgICAgIGludGVyc2VjdGlvbnMucHVzaCh7IHg6IHIueCwgeTogci55IH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gaW50ZXJzZWN0aW9ucztcclxuICAgIH07XHJcbiAgICBSZWN0YW5nbGUucHJvdG90eXBlLnJheUludGVyc2VjdGlvbiA9IGZ1bmN0aW9uICh4MiwgeTIpIHtcclxuICAgICAgICB2YXIgaW50cyA9IHRoaXMubGluZUludGVyc2VjdGlvbnModGhpcy5jeCgpLCB0aGlzLmN5KCksIHgyLCB5Mik7XHJcbiAgICAgICAgcmV0dXJuIGludHMubGVuZ3RoID4gMCA/IGludHNbMF0gOiBudWxsO1xyXG4gICAgfTtcclxuICAgIFJlY3RhbmdsZS5wcm90b3R5cGUudmVydGljZXMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgeyB4OiB0aGlzLngsIHk6IHRoaXMueSB9LFxyXG4gICAgICAgICAgICB7IHg6IHRoaXMuWCwgeTogdGhpcy55IH0sXHJcbiAgICAgICAgICAgIHsgeDogdGhpcy5YLCB5OiB0aGlzLlkgfSxcclxuICAgICAgICAgICAgeyB4OiB0aGlzLngsIHk6IHRoaXMuWSB9XHJcbiAgICAgICAgXTtcclxuICAgIH07XHJcbiAgICBSZWN0YW5nbGUubGluZUludGVyc2VjdGlvbiA9IGZ1bmN0aW9uICh4MSwgeTEsIHgyLCB5MiwgeDMsIHkzLCB4NCwgeTQpIHtcclxuICAgICAgICB2YXIgZHgxMiA9IHgyIC0geDEsIGR4MzQgPSB4NCAtIHgzLCBkeTEyID0geTIgLSB5MSwgZHkzNCA9IHk0IC0geTMsIGRlbm9taW5hdG9yID0gZHkzNCAqIGR4MTIgLSBkeDM0ICogZHkxMjtcclxuICAgICAgICBpZiAoZGVub21pbmF0b3IgPT0gMClcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgdmFyIGR4MzEgPSB4MSAtIHgzLCBkeTMxID0geTEgLSB5MywgbnVtYSA9IGR4MzQgKiBkeTMxIC0gZHkzNCAqIGR4MzEsIGEgPSBudW1hIC8gZGVub21pbmF0b3IsIG51bWIgPSBkeDEyICogZHkzMSAtIGR5MTIgKiBkeDMxLCBiID0gbnVtYiAvIGRlbm9taW5hdG9yO1xyXG4gICAgICAgIGlmIChhID49IDAgJiYgYSA8PSAxICYmIGIgPj0gMCAmJiBiIDw9IDEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHg6IHgxICsgYSAqIGR4MTIsXHJcbiAgICAgICAgICAgICAgICB5OiB5MSArIGEgKiBkeTEyXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfTtcclxuICAgIFJlY3RhbmdsZS5wcm90b3R5cGUuaW5mbGF0ZSA9IGZ1bmN0aW9uIChwYWQpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFJlY3RhbmdsZSh0aGlzLnggLSBwYWQsIHRoaXMuWCArIHBhZCwgdGhpcy55IC0gcGFkLCB0aGlzLlkgKyBwYWQpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBSZWN0YW5nbGU7XHJcbn0oKSk7XHJcbmV4cG9ydHMuUmVjdGFuZ2xlID0gUmVjdGFuZ2xlO1xyXG5mdW5jdGlvbiBtYWtlRWRnZUJldHdlZW4oc291cmNlLCB0YXJnZXQsIGFoKSB7XHJcbiAgICB2YXIgc2kgPSBzb3VyY2UucmF5SW50ZXJzZWN0aW9uKHRhcmdldC5jeCgpLCB0YXJnZXQuY3koKSkgfHwgeyB4OiBzb3VyY2UuY3goKSwgeTogc291cmNlLmN5KCkgfSwgdGkgPSB0YXJnZXQucmF5SW50ZXJzZWN0aW9uKHNvdXJjZS5jeCgpLCBzb3VyY2UuY3koKSkgfHwgeyB4OiB0YXJnZXQuY3goKSwgeTogdGFyZ2V0LmN5KCkgfSwgZHggPSB0aS54IC0gc2kueCwgZHkgPSB0aS55IC0gc2kueSwgbCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSksIGFsID0gbCAtIGFoO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBzb3VyY2VJbnRlcnNlY3Rpb246IHNpLFxyXG4gICAgICAgIHRhcmdldEludGVyc2VjdGlvbjogdGksXHJcbiAgICAgICAgYXJyb3dTdGFydDogeyB4OiBzaS54ICsgYWwgKiBkeCAvIGwsIHk6IHNpLnkgKyBhbCAqIGR5IC8gbCB9XHJcbiAgICB9O1xyXG59XHJcbmV4cG9ydHMubWFrZUVkZ2VCZXR3ZWVuID0gbWFrZUVkZ2VCZXR3ZWVuO1xyXG5mdW5jdGlvbiBtYWtlRWRnZVRvKHMsIHRhcmdldCwgYWgpIHtcclxuICAgIHZhciB0aSA9IHRhcmdldC5yYXlJbnRlcnNlY3Rpb24ocy54LCBzLnkpO1xyXG4gICAgaWYgKCF0aSlcclxuICAgICAgICB0aSA9IHsgeDogdGFyZ2V0LmN4KCksIHk6IHRhcmdldC5jeSgpIH07XHJcbiAgICB2YXIgZHggPSB0aS54IC0gcy54LCBkeSA9IHRpLnkgLSBzLnksIGwgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xyXG4gICAgcmV0dXJuIHsgeDogdGkueCAtIGFoICogZHggLyBsLCB5OiB0aS55IC0gYWggKiBkeSAvIGwgfTtcclxufVxyXG5leHBvcnRzLm1ha2VFZGdlVG8gPSBtYWtlRWRnZVRvO1xyXG52YXIgTm9kZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBOb2RlKHYsIHIsIHBvcykge1xyXG4gICAgICAgIHRoaXMudiA9IHY7XHJcbiAgICAgICAgdGhpcy5yID0gcjtcclxuICAgICAgICB0aGlzLnBvcyA9IHBvcztcclxuICAgICAgICB0aGlzLnByZXYgPSBtYWtlUkJUcmVlKCk7XHJcbiAgICAgICAgdGhpcy5uZXh0ID0gbWFrZVJCVHJlZSgpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIE5vZGU7XHJcbn0oKSk7XHJcbnZhciBFdmVudCA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBFdmVudChpc09wZW4sIHYsIHBvcykge1xyXG4gICAgICAgIHRoaXMuaXNPcGVuID0gaXNPcGVuO1xyXG4gICAgICAgIHRoaXMudiA9IHY7XHJcbiAgICAgICAgdGhpcy5wb3MgPSBwb3M7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gRXZlbnQ7XHJcbn0oKSk7XHJcbmZ1bmN0aW9uIGNvbXBhcmVFdmVudHMoYSwgYikge1xyXG4gICAgaWYgKGEucG9zID4gYi5wb3MpIHtcclxuICAgICAgICByZXR1cm4gMTtcclxuICAgIH1cclxuICAgIGlmIChhLnBvcyA8IGIucG9zKSB7XHJcbiAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgfVxyXG4gICAgaWYgKGEuaXNPcGVuKSB7XHJcbiAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgfVxyXG4gICAgaWYgKGIuaXNPcGVuKSB7XHJcbiAgICAgICAgcmV0dXJuIDE7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gMDtcclxufVxyXG5mdW5jdGlvbiBtYWtlUkJUcmVlKCkge1xyXG4gICAgcmV0dXJuIG5ldyByYnRyZWVfMS5SQlRyZWUoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGEucG9zIC0gYi5wb3M7IH0pO1xyXG59XHJcbnZhciB4UmVjdCA9IHtcclxuICAgIGdldENlbnRyZTogZnVuY3Rpb24gKHIpIHsgcmV0dXJuIHIuY3goKTsgfSxcclxuICAgIGdldE9wZW46IGZ1bmN0aW9uIChyKSB7IHJldHVybiByLnk7IH0sXHJcbiAgICBnZXRDbG9zZTogZnVuY3Rpb24gKHIpIHsgcmV0dXJuIHIuWTsgfSxcclxuICAgIGdldFNpemU6IGZ1bmN0aW9uIChyKSB7IHJldHVybiByLndpZHRoKCk7IH0sXHJcbiAgICBtYWtlUmVjdDogZnVuY3Rpb24gKG9wZW4sIGNsb3NlLCBjZW50ZXIsIHNpemUpIHsgcmV0dXJuIG5ldyBSZWN0YW5nbGUoY2VudGVyIC0gc2l6ZSAvIDIsIGNlbnRlciArIHNpemUgLyAyLCBvcGVuLCBjbG9zZSk7IH0sXHJcbiAgICBmaW5kTmVpZ2hib3VyczogZmluZFhOZWlnaGJvdXJzXHJcbn07XHJcbnZhciB5UmVjdCA9IHtcclxuICAgIGdldENlbnRyZTogZnVuY3Rpb24gKHIpIHsgcmV0dXJuIHIuY3koKTsgfSxcclxuICAgIGdldE9wZW46IGZ1bmN0aW9uIChyKSB7IHJldHVybiByLng7IH0sXHJcbiAgICBnZXRDbG9zZTogZnVuY3Rpb24gKHIpIHsgcmV0dXJuIHIuWDsgfSxcclxuICAgIGdldFNpemU6IGZ1bmN0aW9uIChyKSB7IHJldHVybiByLmhlaWdodCgpOyB9LFxyXG4gICAgbWFrZVJlY3Q6IGZ1bmN0aW9uIChvcGVuLCBjbG9zZSwgY2VudGVyLCBzaXplKSB7IHJldHVybiBuZXcgUmVjdGFuZ2xlKG9wZW4sIGNsb3NlLCBjZW50ZXIgLSBzaXplIC8gMiwgY2VudGVyICsgc2l6ZSAvIDIpOyB9LFxyXG4gICAgZmluZE5laWdoYm91cnM6IGZpbmRZTmVpZ2hib3Vyc1xyXG59O1xyXG5mdW5jdGlvbiBnZW5lcmF0ZUdyb3VwQ29uc3RyYWludHMocm9vdCwgZiwgbWluU2VwLCBpc0NvbnRhaW5lZCkge1xyXG4gICAgaWYgKGlzQ29udGFpbmVkID09PSB2b2lkIDApIHsgaXNDb250YWluZWQgPSBmYWxzZTsgfVxyXG4gICAgdmFyIHBhZGRpbmcgPSByb290LnBhZGRpbmcsIGduID0gdHlwZW9mIHJvb3QuZ3JvdXBzICE9PSAndW5kZWZpbmVkJyA/IHJvb3QuZ3JvdXBzLmxlbmd0aCA6IDAsIGxuID0gdHlwZW9mIHJvb3QubGVhdmVzICE9PSAndW5kZWZpbmVkJyA/IHJvb3QubGVhdmVzLmxlbmd0aCA6IDAsIGNoaWxkQ29uc3RyYWludHMgPSAhZ24gPyBbXVxyXG4gICAgICAgIDogcm9vdC5ncm91cHMucmVkdWNlKGZ1bmN0aW9uIChjY3MsIGcpIHsgcmV0dXJuIGNjcy5jb25jYXQoZ2VuZXJhdGVHcm91cENvbnN0cmFpbnRzKGcsIGYsIG1pblNlcCwgdHJ1ZSkpOyB9LCBbXSksIG4gPSAoaXNDb250YWluZWQgPyAyIDogMCkgKyBsbiArIGduLCB2cyA9IG5ldyBBcnJheShuKSwgcnMgPSBuZXcgQXJyYXkobiksIGkgPSAwLCBhZGQgPSBmdW5jdGlvbiAociwgdikgeyByc1tpXSA9IHI7IHZzW2krK10gPSB2OyB9O1xyXG4gICAgaWYgKGlzQ29udGFpbmVkKSB7XHJcbiAgICAgICAgdmFyIGIgPSByb290LmJvdW5kcywgYyA9IGYuZ2V0Q2VudHJlKGIpLCBzID0gZi5nZXRTaXplKGIpIC8gMiwgb3BlbiA9IGYuZ2V0T3BlbihiKSwgY2xvc2UgPSBmLmdldENsb3NlKGIpLCBtaW4gPSBjIC0gcyArIHBhZGRpbmcgLyAyLCBtYXggPSBjICsgcyAtIHBhZGRpbmcgLyAyO1xyXG4gICAgICAgIHJvb3QubWluVmFyLmRlc2lyZWRQb3NpdGlvbiA9IG1pbjtcclxuICAgICAgICBhZGQoZi5tYWtlUmVjdChvcGVuLCBjbG9zZSwgbWluLCBwYWRkaW5nKSwgcm9vdC5taW5WYXIpO1xyXG4gICAgICAgIHJvb3QubWF4VmFyLmRlc2lyZWRQb3NpdGlvbiA9IG1heDtcclxuICAgICAgICBhZGQoZi5tYWtlUmVjdChvcGVuLCBjbG9zZSwgbWF4LCBwYWRkaW5nKSwgcm9vdC5tYXhWYXIpO1xyXG4gICAgfVxyXG4gICAgaWYgKGxuKVxyXG4gICAgICAgIHJvb3QubGVhdmVzLmZvckVhY2goZnVuY3Rpb24gKGwpIHsgcmV0dXJuIGFkZChsLmJvdW5kcywgbC52YXJpYWJsZSk7IH0pO1xyXG4gICAgaWYgKGduKVxyXG4gICAgICAgIHJvb3QuZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGcpIHtcclxuICAgICAgICAgICAgdmFyIGIgPSBnLmJvdW5kcztcclxuICAgICAgICAgICAgYWRkKGYubWFrZVJlY3QoZi5nZXRPcGVuKGIpLCBmLmdldENsb3NlKGIpLCBmLmdldENlbnRyZShiKSwgZi5nZXRTaXplKGIpKSwgZy5taW5WYXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgdmFyIGNzID0gZ2VuZXJhdGVDb25zdHJhaW50cyhycywgdnMsIGYsIG1pblNlcCk7XHJcbiAgICBpZiAoZ24pIHtcclxuICAgICAgICB2cy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7IHYuY091dCA9IFtdLCB2LmNJbiA9IFtdOyB9KTtcclxuICAgICAgICBjcy5mb3JFYWNoKGZ1bmN0aW9uIChjKSB7IGMubGVmdC5jT3V0LnB1c2goYyksIGMucmlnaHQuY0luLnB1c2goYyk7IH0pO1xyXG4gICAgICAgIHJvb3QuZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGcpIHtcclxuICAgICAgICAgICAgdmFyIGdhcEFkanVzdG1lbnQgPSAoZy5wYWRkaW5nIC0gZi5nZXRTaXplKGcuYm91bmRzKSkgLyAyO1xyXG4gICAgICAgICAgICBnLm1pblZhci5jSW4uZm9yRWFjaChmdW5jdGlvbiAoYykgeyByZXR1cm4gYy5nYXAgKz0gZ2FwQWRqdXN0bWVudDsgfSk7XHJcbiAgICAgICAgICAgIGcubWluVmFyLmNPdXQuZm9yRWFjaChmdW5jdGlvbiAoYykgeyBjLmxlZnQgPSBnLm1heFZhcjsgYy5nYXAgKz0gZ2FwQWRqdXN0bWVudDsgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY2hpbGRDb25zdHJhaW50cy5jb25jYXQoY3MpO1xyXG59XHJcbmZ1bmN0aW9uIGdlbmVyYXRlQ29uc3RyYWludHMocnMsIHZhcnMsIHJlY3QsIG1pblNlcCkge1xyXG4gICAgdmFyIGksIG4gPSBycy5sZW5ndGg7XHJcbiAgICB2YXIgTiA9IDIgKiBuO1xyXG4gICAgY29uc29sZS5hc3NlcnQodmFycy5sZW5ndGggPj0gbik7XHJcbiAgICB2YXIgZXZlbnRzID0gbmV3IEFycmF5KE4pO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IG47ICsraSkge1xyXG4gICAgICAgIHZhciByID0gcnNbaV07XHJcbiAgICAgICAgdmFyIHYgPSBuZXcgTm9kZSh2YXJzW2ldLCByLCByZWN0LmdldENlbnRyZShyKSk7XHJcbiAgICAgICAgZXZlbnRzW2ldID0gbmV3IEV2ZW50KHRydWUsIHYsIHJlY3QuZ2V0T3BlbihyKSk7XHJcbiAgICAgICAgZXZlbnRzW2kgKyBuXSA9IG5ldyBFdmVudChmYWxzZSwgdiwgcmVjdC5nZXRDbG9zZShyKSk7XHJcbiAgICB9XHJcbiAgICBldmVudHMuc29ydChjb21wYXJlRXZlbnRzKTtcclxuICAgIHZhciBjcyA9IG5ldyBBcnJheSgpO1xyXG4gICAgdmFyIHNjYW5saW5lID0gbWFrZVJCVHJlZSgpO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IE47ICsraSkge1xyXG4gICAgICAgIHZhciBlID0gZXZlbnRzW2ldO1xyXG4gICAgICAgIHZhciB2ID0gZS52O1xyXG4gICAgICAgIGlmIChlLmlzT3Blbikge1xyXG4gICAgICAgICAgICBzY2FubGluZS5pbnNlcnQodik7XHJcbiAgICAgICAgICAgIHJlY3QuZmluZE5laWdoYm91cnModiwgc2NhbmxpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc2NhbmxpbmUucmVtb3ZlKHYpO1xyXG4gICAgICAgICAgICB2YXIgbWFrZUNvbnN0cmFpbnQgPSBmdW5jdGlvbiAobCwgcikge1xyXG4gICAgICAgICAgICAgICAgdmFyIHNlcCA9IChyZWN0LmdldFNpemUobC5yKSArIHJlY3QuZ2V0U2l6ZShyLnIpKSAvIDIgKyBtaW5TZXA7XHJcbiAgICAgICAgICAgICAgICBjcy5wdXNoKG5ldyB2cHNjXzEuQ29uc3RyYWludChsLnYsIHIudiwgc2VwKSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHZhciB2aXNpdE5laWdoYm91cnMgPSBmdW5jdGlvbiAoZm9yd2FyZCwgcmV2ZXJzZSwgbWtjb24pIHtcclxuICAgICAgICAgICAgICAgIHZhciB1LCBpdCA9IHZbZm9yd2FyZF0uaXRlcmF0b3IoKTtcclxuICAgICAgICAgICAgICAgIHdoaWxlICgodSA9IGl0W2ZvcndhcmRdKCkpICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWtjb24odSwgdik7XHJcbiAgICAgICAgICAgICAgICAgICAgdVtyZXZlcnNlXS5yZW1vdmUodik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHZpc2l0TmVpZ2hib3VycyhcInByZXZcIiwgXCJuZXh0XCIsIGZ1bmN0aW9uICh1LCB2KSB7IHJldHVybiBtYWtlQ29uc3RyYWludCh1LCB2KTsgfSk7XHJcbiAgICAgICAgICAgIHZpc2l0TmVpZ2hib3VycyhcIm5leHRcIiwgXCJwcmV2XCIsIGZ1bmN0aW9uICh1LCB2KSB7IHJldHVybiBtYWtlQ29uc3RyYWludCh2LCB1KTsgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29uc29sZS5hc3NlcnQoc2NhbmxpbmUuc2l6ZSA9PT0gMCk7XHJcbiAgICByZXR1cm4gY3M7XHJcbn1cclxuZnVuY3Rpb24gZmluZFhOZWlnaGJvdXJzKHYsIHNjYW5saW5lKSB7XHJcbiAgICB2YXIgZiA9IGZ1bmN0aW9uIChmb3J3YXJkLCByZXZlcnNlKSB7XHJcbiAgICAgICAgdmFyIGl0ID0gc2NhbmxpbmUuZmluZEl0ZXIodik7XHJcbiAgICAgICAgdmFyIHU7XHJcbiAgICAgICAgd2hpbGUgKCh1ID0gaXRbZm9yd2FyZF0oKSkgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdmFyIHVvdmVydlggPSB1LnIub3ZlcmxhcFgodi5yKTtcclxuICAgICAgICAgICAgaWYgKHVvdmVydlggPD0gMCB8fCB1b3ZlcnZYIDw9IHUuci5vdmVybGFwWSh2LnIpKSB7XHJcbiAgICAgICAgICAgICAgICB2W2ZvcndhcmRdLmluc2VydCh1KTtcclxuICAgICAgICAgICAgICAgIHVbcmV2ZXJzZV0uaW5zZXJ0KHYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh1b3ZlcnZYIDw9IDApIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIGYoXCJuZXh0XCIsIFwicHJldlwiKTtcclxuICAgIGYoXCJwcmV2XCIsIFwibmV4dFwiKTtcclxufVxyXG5mdW5jdGlvbiBmaW5kWU5laWdoYm91cnModiwgc2NhbmxpbmUpIHtcclxuICAgIHZhciBmID0gZnVuY3Rpb24gKGZvcndhcmQsIHJldmVyc2UpIHtcclxuICAgICAgICB2YXIgdSA9IHNjYW5saW5lLmZpbmRJdGVyKHYpW2ZvcndhcmRdKCk7XHJcbiAgICAgICAgaWYgKHUgIT09IG51bGwgJiYgdS5yLm92ZXJsYXBYKHYucikgPiAwKSB7XHJcbiAgICAgICAgICAgIHZbZm9yd2FyZF0uaW5zZXJ0KHUpO1xyXG4gICAgICAgICAgICB1W3JldmVyc2VdLmluc2VydCh2KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgZihcIm5leHRcIiwgXCJwcmV2XCIpO1xyXG4gICAgZihcInByZXZcIiwgXCJuZXh0XCIpO1xyXG59XHJcbmZ1bmN0aW9uIGdlbmVyYXRlWENvbnN0cmFpbnRzKHJzLCB2YXJzKSB7XHJcbiAgICByZXR1cm4gZ2VuZXJhdGVDb25zdHJhaW50cyhycywgdmFycywgeFJlY3QsIDFlLTYpO1xyXG59XHJcbmV4cG9ydHMuZ2VuZXJhdGVYQ29uc3RyYWludHMgPSBnZW5lcmF0ZVhDb25zdHJhaW50cztcclxuZnVuY3Rpb24gZ2VuZXJhdGVZQ29uc3RyYWludHMocnMsIHZhcnMpIHtcclxuICAgIHJldHVybiBnZW5lcmF0ZUNvbnN0cmFpbnRzKHJzLCB2YXJzLCB5UmVjdCwgMWUtNik7XHJcbn1cclxuZXhwb3J0cy5nZW5lcmF0ZVlDb25zdHJhaW50cyA9IGdlbmVyYXRlWUNvbnN0cmFpbnRzO1xyXG5mdW5jdGlvbiBnZW5lcmF0ZVhHcm91cENvbnN0cmFpbnRzKHJvb3QpIHtcclxuICAgIHJldHVybiBnZW5lcmF0ZUdyb3VwQ29uc3RyYWludHMocm9vdCwgeFJlY3QsIDFlLTYpO1xyXG59XHJcbmV4cG9ydHMuZ2VuZXJhdGVYR3JvdXBDb25zdHJhaW50cyA9IGdlbmVyYXRlWEdyb3VwQ29uc3RyYWludHM7XHJcbmZ1bmN0aW9uIGdlbmVyYXRlWUdyb3VwQ29uc3RyYWludHMocm9vdCkge1xyXG4gICAgcmV0dXJuIGdlbmVyYXRlR3JvdXBDb25zdHJhaW50cyhyb290LCB5UmVjdCwgMWUtNik7XHJcbn1cclxuZXhwb3J0cy5nZW5lcmF0ZVlHcm91cENvbnN0cmFpbnRzID0gZ2VuZXJhdGVZR3JvdXBDb25zdHJhaW50cztcclxuZnVuY3Rpb24gcmVtb3ZlT3ZlcmxhcHMocnMpIHtcclxuICAgIHZhciB2cyA9IHJzLm1hcChmdW5jdGlvbiAocikgeyByZXR1cm4gbmV3IHZwc2NfMS5WYXJpYWJsZShyLmN4KCkpOyB9KTtcclxuICAgIHZhciBjcyA9IGdlbmVyYXRlWENvbnN0cmFpbnRzKHJzLCB2cyk7XHJcbiAgICB2YXIgc29sdmVyID0gbmV3IHZwc2NfMS5Tb2x2ZXIodnMsIGNzKTtcclxuICAgIHNvbHZlci5zb2x2ZSgpO1xyXG4gICAgdnMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkgeyByZXR1cm4gcnNbaV0uc2V0WENlbnRyZSh2LnBvc2l0aW9uKCkpOyB9KTtcclxuICAgIHZzID0gcnMubWFwKGZ1bmN0aW9uIChyKSB7IHJldHVybiBuZXcgdnBzY18xLlZhcmlhYmxlKHIuY3koKSk7IH0pO1xyXG4gICAgY3MgPSBnZW5lcmF0ZVlDb25zdHJhaW50cyhycywgdnMpO1xyXG4gICAgc29sdmVyID0gbmV3IHZwc2NfMS5Tb2x2ZXIodnMsIGNzKTtcclxuICAgIHNvbHZlci5zb2x2ZSgpO1xyXG4gICAgdnMuZm9yRWFjaChmdW5jdGlvbiAodiwgaSkgeyByZXR1cm4gcnNbaV0uc2V0WUNlbnRyZSh2LnBvc2l0aW9uKCkpOyB9KTtcclxufVxyXG5leHBvcnRzLnJlbW92ZU92ZXJsYXBzID0gcmVtb3ZlT3ZlcmxhcHM7XHJcbnZhciBJbmRleGVkVmFyaWFibGUgPSAoZnVuY3Rpb24gKF9zdXBlcikge1xyXG4gICAgX19leHRlbmRzKEluZGV4ZWRWYXJpYWJsZSwgX3N1cGVyKTtcclxuICAgIGZ1bmN0aW9uIEluZGV4ZWRWYXJpYWJsZShpbmRleCwgdykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IF9zdXBlci5jYWxsKHRoaXMsIDAsIHcpIHx8IHRoaXM7XHJcbiAgICAgICAgX3RoaXMuaW5kZXggPSBpbmRleDtcclxuICAgICAgICByZXR1cm4gX3RoaXM7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gSW5kZXhlZFZhcmlhYmxlO1xyXG59KHZwc2NfMS5WYXJpYWJsZSkpO1xyXG5leHBvcnRzLkluZGV4ZWRWYXJpYWJsZSA9IEluZGV4ZWRWYXJpYWJsZTtcclxudmFyIFByb2plY3Rpb24gPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gUHJvamVjdGlvbihub2RlcywgZ3JvdXBzLCByb290R3JvdXAsIGNvbnN0cmFpbnRzLCBhdm9pZE92ZXJsYXBzKSB7XHJcbiAgICAgICAgaWYgKHJvb3RHcm91cCA9PT0gdm9pZCAwKSB7IHJvb3RHcm91cCA9IG51bGw7IH1cclxuICAgICAgICBpZiAoY29uc3RyYWludHMgPT09IHZvaWQgMCkgeyBjb25zdHJhaW50cyA9IG51bGw7IH1cclxuICAgICAgICBpZiAoYXZvaWRPdmVybGFwcyA9PT0gdm9pZCAwKSB7IGF2b2lkT3ZlcmxhcHMgPSBmYWxzZTsgfVxyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdGhpcy5ub2RlcyA9IG5vZGVzO1xyXG4gICAgICAgIHRoaXMuZ3JvdXBzID0gZ3JvdXBzO1xyXG4gICAgICAgIHRoaXMucm9vdEdyb3VwID0gcm9vdEdyb3VwO1xyXG4gICAgICAgIHRoaXMuYXZvaWRPdmVybGFwcyA9IGF2b2lkT3ZlcmxhcHM7XHJcbiAgICAgICAgdGhpcy52YXJpYWJsZXMgPSBub2Rlcy5tYXAoZnVuY3Rpb24gKHYsIGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHYudmFyaWFibGUgPSBuZXcgSW5kZXhlZFZhcmlhYmxlKGksIDEpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChjb25zdHJhaW50cylcclxuICAgICAgICAgICAgdGhpcy5jcmVhdGVDb25zdHJhaW50cyhjb25zdHJhaW50cyk7XHJcbiAgICAgICAgaWYgKGF2b2lkT3ZlcmxhcHMgJiYgcm9vdEdyb3VwICYmIHR5cGVvZiByb290R3JvdXAuZ3JvdXBzICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXYud2lkdGggfHwgIXYuaGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdi5ib3VuZHMgPSBuZXcgUmVjdGFuZ2xlKHYueCwgdi54LCB2LnksIHYueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHcyID0gdi53aWR0aCAvIDIsIGgyID0gdi5oZWlnaHQgLyAyO1xyXG4gICAgICAgICAgICAgICAgdi5ib3VuZHMgPSBuZXcgUmVjdGFuZ2xlKHYueCAtIHcyLCB2LnggKyB3Miwgdi55IC0gaDIsIHYueSArIGgyKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGNvbXB1dGVHcm91cEJvdW5kcyhyb290R3JvdXApO1xyXG4gICAgICAgICAgICB2YXIgaSA9IG5vZGVzLmxlbmd0aDtcclxuICAgICAgICAgICAgZ3JvdXBzLmZvckVhY2goZnVuY3Rpb24gKGcpIHtcclxuICAgICAgICAgICAgICAgIF90aGlzLnZhcmlhYmxlc1tpXSA9IGcubWluVmFyID0gbmV3IEluZGV4ZWRWYXJpYWJsZShpKyssIHR5cGVvZiBnLnN0aWZmbmVzcyAhPT0gXCJ1bmRlZmluZWRcIiA/IGcuc3RpZmZuZXNzIDogMC4wMSk7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy52YXJpYWJsZXNbaV0gPSBnLm1heFZhciA9IG5ldyBJbmRleGVkVmFyaWFibGUoaSsrLCB0eXBlb2YgZy5zdGlmZm5lc3MgIT09IFwidW5kZWZpbmVkXCIgPyBnLnN0aWZmbmVzcyA6IDAuMDEpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBQcm9qZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVTZXBhcmF0aW9uID0gZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICByZXR1cm4gbmV3IHZwc2NfMS5Db25zdHJhaW50KHRoaXMubm9kZXNbYy5sZWZ0XS52YXJpYWJsZSwgdGhpcy5ub2Rlc1tjLnJpZ2h0XS52YXJpYWJsZSwgYy5nYXAsIHR5cGVvZiBjLmVxdWFsaXR5ICE9PSBcInVuZGVmaW5lZFwiID8gYy5lcXVhbGl0eSA6IGZhbHNlKTtcclxuICAgIH07XHJcbiAgICBQcm9qZWN0aW9uLnByb3RvdHlwZS5tYWtlRmVhc2libGUgPSBmdW5jdGlvbiAoYykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgaWYgKCF0aGlzLmF2b2lkT3ZlcmxhcHMpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB2YXIgYXhpcyA9ICd4JywgZGltID0gJ3dpZHRoJztcclxuICAgICAgICBpZiAoYy5heGlzID09PSAneCcpXHJcbiAgICAgICAgICAgIGF4aXMgPSAneScsIGRpbSA9ICdoZWlnaHQnO1xyXG4gICAgICAgIHZhciB2cyA9IGMub2Zmc2V0cy5tYXAoZnVuY3Rpb24gKG8pIHsgcmV0dXJuIF90aGlzLm5vZGVzW28ubm9kZV07IH0pLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGFbYXhpc10gLSBiW2F4aXNdOyB9KTtcclxuICAgICAgICB2YXIgcCA9IG51bGw7XHJcbiAgICAgICAgdnMuZm9yRWFjaChmdW5jdGlvbiAodikge1xyXG4gICAgICAgICAgICBpZiAocCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5leHRQb3MgPSBwW2F4aXNdICsgcFtkaW1dO1xyXG4gICAgICAgICAgICAgICAgaWYgKG5leHRQb3MgPiB2W2F4aXNdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdltheGlzXSA9IG5leHRQb3M7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcCA9IHY7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvamVjdGlvbi5wcm90b3R5cGUuY3JlYXRlQWxpZ25tZW50ID0gZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHZhciB1ID0gdGhpcy5ub2Rlc1tjLm9mZnNldHNbMF0ubm9kZV0udmFyaWFibGU7XHJcbiAgICAgICAgdGhpcy5tYWtlRmVhc2libGUoYyk7XHJcbiAgICAgICAgdmFyIGNzID0gYy5heGlzID09PSAneCcgPyB0aGlzLnhDb25zdHJhaW50cyA6IHRoaXMueUNvbnN0cmFpbnRzO1xyXG4gICAgICAgIGMub2Zmc2V0cy5zbGljZSgxKS5mb3JFYWNoKGZ1bmN0aW9uIChvKSB7XHJcbiAgICAgICAgICAgIHZhciB2ID0gX3RoaXMubm9kZXNbby5ub2RlXS52YXJpYWJsZTtcclxuICAgICAgICAgICAgY3MucHVzaChuZXcgdnBzY18xLkNvbnN0cmFpbnQodSwgdiwgby5vZmZzZXQsIHRydWUpKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBQcm9qZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVDb25zdHJhaW50cyA9IGZ1bmN0aW9uIChjb25zdHJhaW50cykge1xyXG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgdmFyIGlzU2VwID0gZnVuY3Rpb24gKGMpIHsgcmV0dXJuIHR5cGVvZiBjLnR5cGUgPT09ICd1bmRlZmluZWQnIHx8IGMudHlwZSA9PT0gJ3NlcGFyYXRpb24nOyB9O1xyXG4gICAgICAgIHRoaXMueENvbnN0cmFpbnRzID0gY29uc3RyYWludHNcclxuICAgICAgICAgICAgLmZpbHRlcihmdW5jdGlvbiAoYykgeyByZXR1cm4gYy5heGlzID09PSBcInhcIiAmJiBpc1NlcChjKTsgfSlcclxuICAgICAgICAgICAgLm1hcChmdW5jdGlvbiAoYykgeyByZXR1cm4gX3RoaXMuY3JlYXRlU2VwYXJhdGlvbihjKTsgfSk7XHJcbiAgICAgICAgdGhpcy55Q29uc3RyYWludHMgPSBjb25zdHJhaW50c1xyXG4gICAgICAgICAgICAuZmlsdGVyKGZ1bmN0aW9uIChjKSB7IHJldHVybiBjLmF4aXMgPT09IFwieVwiICYmIGlzU2VwKGMpOyB9KVxyXG4gICAgICAgICAgICAubWFwKGZ1bmN0aW9uIChjKSB7IHJldHVybiBfdGhpcy5jcmVhdGVTZXBhcmF0aW9uKGMpOyB9KTtcclxuICAgICAgICBjb25zdHJhaW50c1xyXG4gICAgICAgICAgICAuZmlsdGVyKGZ1bmN0aW9uIChjKSB7IHJldHVybiBjLnR5cGUgPT09ICdhbGlnbm1lbnQnOyB9KVxyXG4gICAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbiAoYykgeyByZXR1cm4gX3RoaXMuY3JlYXRlQWxpZ25tZW50KGMpOyB9KTtcclxuICAgIH07XHJcbiAgICBQcm9qZWN0aW9uLnByb3RvdHlwZS5zZXR1cFZhcmlhYmxlc0FuZEJvdW5kcyA9IGZ1bmN0aW9uICh4MCwgeTAsIGRlc2lyZWQsIGdldERlc2lyZWQpIHtcclxuICAgICAgICB0aGlzLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKHYsIGkpIHtcclxuICAgICAgICAgICAgaWYgKHYuZml4ZWQpIHtcclxuICAgICAgICAgICAgICAgIHYudmFyaWFibGUud2VpZ2h0ID0gdi5maXhlZFdlaWdodCA/IHYuZml4ZWRXZWlnaHQgOiAxMDAwO1xyXG4gICAgICAgICAgICAgICAgZGVzaXJlZFtpXSA9IGdldERlc2lyZWQodik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB2LnZhcmlhYmxlLndlaWdodCA9IDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIHcgPSAodi53aWR0aCB8fCAwKSAvIDIsIGggPSAodi5oZWlnaHQgfHwgMCkgLyAyO1xyXG4gICAgICAgICAgICB2YXIgaXggPSB4MFtpXSwgaXkgPSB5MFtpXTtcclxuICAgICAgICAgICAgdi5ib3VuZHMgPSBuZXcgUmVjdGFuZ2xlKGl4IC0gdywgaXggKyB3LCBpeSAtIGgsIGl5ICsgaCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgUHJvamVjdGlvbi5wcm90b3R5cGUueFByb2plY3QgPSBmdW5jdGlvbiAoeDAsIHkwLCB4KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnJvb3RHcm91cCAmJiAhKHRoaXMuYXZvaWRPdmVybGFwcyB8fCB0aGlzLnhDb25zdHJhaW50cykpXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB0aGlzLnByb2plY3QoeDAsIHkwLCB4MCwgeCwgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHYucHg7IH0sIHRoaXMueENvbnN0cmFpbnRzLCBnZW5lcmF0ZVhHcm91cENvbnN0cmFpbnRzLCBmdW5jdGlvbiAodikgeyByZXR1cm4gdi5ib3VuZHMuc2V0WENlbnRyZSh4W3YudmFyaWFibGUuaW5kZXhdID0gdi52YXJpYWJsZS5wb3NpdGlvbigpKTsgfSwgZnVuY3Rpb24gKGcpIHtcclxuICAgICAgICAgICAgdmFyIHhtaW4gPSB4W2cubWluVmFyLmluZGV4XSA9IGcubWluVmFyLnBvc2l0aW9uKCk7XHJcbiAgICAgICAgICAgIHZhciB4bWF4ID0geFtnLm1heFZhci5pbmRleF0gPSBnLm1heFZhci5wb3NpdGlvbigpO1xyXG4gICAgICAgICAgICB2YXIgcDIgPSBnLnBhZGRpbmcgLyAyO1xyXG4gICAgICAgICAgICBnLmJvdW5kcy54ID0geG1pbiAtIHAyO1xyXG4gICAgICAgICAgICBnLmJvdW5kcy5YID0geG1heCArIHAyO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFByb2plY3Rpb24ucHJvdG90eXBlLnlQcm9qZWN0ID0gZnVuY3Rpb24gKHgwLCB5MCwgeSkge1xyXG4gICAgICAgIGlmICghdGhpcy5yb290R3JvdXAgJiYgIXRoaXMueUNvbnN0cmFpbnRzKVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgdGhpcy5wcm9qZWN0KHgwLCB5MCwgeTAsIHksIGZ1bmN0aW9uICh2KSB7IHJldHVybiB2LnB5OyB9LCB0aGlzLnlDb25zdHJhaW50cywgZ2VuZXJhdGVZR3JvdXBDb25zdHJhaW50cywgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHYuYm91bmRzLnNldFlDZW50cmUoeVt2LnZhcmlhYmxlLmluZGV4XSA9IHYudmFyaWFibGUucG9zaXRpb24oKSk7IH0sIGZ1bmN0aW9uIChnKSB7XHJcbiAgICAgICAgICAgIHZhciB5bWluID0geVtnLm1pblZhci5pbmRleF0gPSBnLm1pblZhci5wb3NpdGlvbigpO1xyXG4gICAgICAgICAgICB2YXIgeW1heCA9IHlbZy5tYXhWYXIuaW5kZXhdID0gZy5tYXhWYXIucG9zaXRpb24oKTtcclxuICAgICAgICAgICAgdmFyIHAyID0gZy5wYWRkaW5nIC8gMjtcclxuICAgICAgICAgICAgZy5ib3VuZHMueSA9IHltaW4gLSBwMjtcclxuICAgICAgICAgICAgO1xyXG4gICAgICAgICAgICBnLmJvdW5kcy5ZID0geW1heCArIHAyO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFByb2plY3Rpb24ucHJvdG90eXBlLnByb2plY3RGdW5jdGlvbnMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICBmdW5jdGlvbiAoeDAsIHkwLCB4KSB7IHJldHVybiBfdGhpcy54UHJvamVjdCh4MCwgeTAsIHgpOyB9LFxyXG4gICAgICAgICAgICBmdW5jdGlvbiAoeDAsIHkwLCB5KSB7IHJldHVybiBfdGhpcy55UHJvamVjdCh4MCwgeTAsIHkpOyB9XHJcbiAgICAgICAgXTtcclxuICAgIH07XHJcbiAgICBQcm9qZWN0aW9uLnByb3RvdHlwZS5wcm9qZWN0ID0gZnVuY3Rpb24gKHgwLCB5MCwgc3RhcnQsIGRlc2lyZWQsIGdldERlc2lyZWQsIGNzLCBnZW5lcmF0ZUNvbnN0cmFpbnRzLCB1cGRhdGVOb2RlQm91bmRzLCB1cGRhdGVHcm91cEJvdW5kcykge1xyXG4gICAgICAgIHRoaXMuc2V0dXBWYXJpYWJsZXNBbmRCb3VuZHMoeDAsIHkwLCBkZXNpcmVkLCBnZXREZXNpcmVkKTtcclxuICAgICAgICBpZiAodGhpcy5yb290R3JvdXAgJiYgdGhpcy5hdm9pZE92ZXJsYXBzKSB7XHJcbiAgICAgICAgICAgIGNvbXB1dGVHcm91cEJvdW5kcyh0aGlzLnJvb3RHcm91cCk7XHJcbiAgICAgICAgICAgIGNzID0gY3MuY29uY2F0KGdlbmVyYXRlQ29uc3RyYWludHModGhpcy5yb290R3JvdXApKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5zb2x2ZSh0aGlzLnZhcmlhYmxlcywgY3MsIHN0YXJ0LCBkZXNpcmVkKTtcclxuICAgICAgICB0aGlzLm5vZGVzLmZvckVhY2godXBkYXRlTm9kZUJvdW5kcyk7XHJcbiAgICAgICAgaWYgKHRoaXMucm9vdEdyb3VwICYmIHRoaXMuYXZvaWRPdmVybGFwcykge1xyXG4gICAgICAgICAgICB0aGlzLmdyb3Vwcy5mb3JFYWNoKHVwZGF0ZUdyb3VwQm91bmRzKTtcclxuICAgICAgICAgICAgY29tcHV0ZUdyb3VwQm91bmRzKHRoaXMucm9vdEdyb3VwKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgUHJvamVjdGlvbi5wcm90b3R5cGUuc29sdmUgPSBmdW5jdGlvbiAodnMsIGNzLCBzdGFydGluZywgZGVzaXJlZCkge1xyXG4gICAgICAgIHZhciBzb2x2ZXIgPSBuZXcgdnBzY18xLlNvbHZlcih2cywgY3MpO1xyXG4gICAgICAgIHNvbHZlci5zZXRTdGFydGluZ1Bvc2l0aW9ucyhzdGFydGluZyk7XHJcbiAgICAgICAgc29sdmVyLnNldERlc2lyZWRQb3NpdGlvbnMoZGVzaXJlZCk7XHJcbiAgICAgICAgc29sdmVyLnNvbHZlKCk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIFByb2plY3Rpb247XHJcbn0oKSk7XHJcbmV4cG9ydHMuUHJvamVjdGlvbiA9IFByb2plY3Rpb247XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlY3RhbmdsZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG52YXIgcHF1ZXVlXzEgPSByZXF1aXJlKFwiLi9wcXVldWVcIik7XHJcbnZhciBOZWlnaGJvdXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gTmVpZ2hib3VyKGlkLCBkaXN0YW5jZSkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBpZDtcclxuICAgICAgICB0aGlzLmRpc3RhbmNlID0gZGlzdGFuY2U7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gTmVpZ2hib3VyO1xyXG59KCkpO1xyXG52YXIgTm9kZSA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBOb2RlKGlkKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGlkO1xyXG4gICAgICAgIHRoaXMubmVpZ2hib3VycyA9IFtdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIE5vZGU7XHJcbn0oKSk7XHJcbnZhciBRdWV1ZUVudHJ5ID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIFF1ZXVlRW50cnkobm9kZSwgcHJldiwgZCkge1xyXG4gICAgICAgIHRoaXMubm9kZSA9IG5vZGU7XHJcbiAgICAgICAgdGhpcy5wcmV2ID0gcHJldjtcclxuICAgICAgICB0aGlzLmQgPSBkO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFF1ZXVlRW50cnk7XHJcbn0oKSk7XHJcbnZhciBDYWxjdWxhdG9yID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIENhbGN1bGF0b3IobiwgZXMsIGdldFNvdXJjZUluZGV4LCBnZXRUYXJnZXRJbmRleCwgZ2V0TGVuZ3RoKSB7XHJcbiAgICAgICAgdGhpcy5uID0gbjtcclxuICAgICAgICB0aGlzLmVzID0gZXM7XHJcbiAgICAgICAgdGhpcy5uZWlnaGJvdXJzID0gbmV3IEFycmF5KHRoaXMubik7XHJcbiAgICAgICAgdmFyIGkgPSB0aGlzLm47XHJcbiAgICAgICAgd2hpbGUgKGktLSlcclxuICAgICAgICAgICAgdGhpcy5uZWlnaGJvdXJzW2ldID0gbmV3IE5vZGUoaSk7XHJcbiAgICAgICAgaSA9IHRoaXMuZXMubGVuZ3RoO1xyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcclxuICAgICAgICAgICAgdmFyIGUgPSB0aGlzLmVzW2ldO1xyXG4gICAgICAgICAgICB2YXIgdSA9IGdldFNvdXJjZUluZGV4KGUpLCB2ID0gZ2V0VGFyZ2V0SW5kZXgoZSk7XHJcbiAgICAgICAgICAgIHZhciBkID0gZ2V0TGVuZ3RoKGUpO1xyXG4gICAgICAgICAgICB0aGlzLm5laWdoYm91cnNbdV0ubmVpZ2hib3Vycy5wdXNoKG5ldyBOZWlnaGJvdXIodiwgZCkpO1xyXG4gICAgICAgICAgICB0aGlzLm5laWdoYm91cnNbdl0ubmVpZ2hib3Vycy5wdXNoKG5ldyBOZWlnaGJvdXIodSwgZCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIENhbGN1bGF0b3IucHJvdG90eXBlLkRpc3RhbmNlTWF0cml4ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBEID0gbmV3IEFycmF5KHRoaXMubik7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm47ICsraSkge1xyXG4gICAgICAgICAgICBEW2ldID0gdGhpcy5kaWprc3RyYU5laWdoYm91cnMoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBEO1xyXG4gICAgfTtcclxuICAgIENhbGN1bGF0b3IucHJvdG90eXBlLkRpc3RhbmNlc0Zyb21Ob2RlID0gZnVuY3Rpb24gKHN0YXJ0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlqa3N0cmFOZWlnaGJvdXJzKHN0YXJ0KTtcclxuICAgIH07XHJcbiAgICBDYWxjdWxhdG9yLnByb3RvdHlwZS5QYXRoRnJvbU5vZGVUb05vZGUgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmRpamtzdHJhTmVpZ2hib3VycyhzdGFydCwgZW5kKTtcclxuICAgIH07XHJcbiAgICBDYWxjdWxhdG9yLnByb3RvdHlwZS5QYXRoRnJvbU5vZGVUb05vZGVXaXRoUHJldkNvc3QgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgcHJldkNvc3QpIHtcclxuICAgICAgICB2YXIgcSA9IG5ldyBwcXVldWVfMS5Qcmlvcml0eVF1ZXVlKGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBhLmQgPD0gYi5kOyB9KSwgdSA9IHRoaXMubmVpZ2hib3Vyc1tzdGFydF0sIHF1ID0gbmV3IFF1ZXVlRW50cnkodSwgbnVsbCwgMCksIHZpc2l0ZWRGcm9tID0ge307XHJcbiAgICAgICAgcS5wdXNoKHF1KTtcclxuICAgICAgICB3aGlsZSAoIXEuZW1wdHkoKSkge1xyXG4gICAgICAgICAgICBxdSA9IHEucG9wKCk7XHJcbiAgICAgICAgICAgIHUgPSBxdS5ub2RlO1xyXG4gICAgICAgICAgICBpZiAodS5pZCA9PT0gZW5kKSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgaSA9IHUubmVpZ2hib3Vycy5sZW5ndGg7XHJcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcclxuICAgICAgICAgICAgICAgIHZhciBuZWlnaGJvdXIgPSB1Lm5laWdoYm91cnNbaV0sIHYgPSB0aGlzLm5laWdoYm91cnNbbmVpZ2hib3VyLmlkXTtcclxuICAgICAgICAgICAgICAgIGlmIChxdS5wcmV2ICYmIHYuaWQgPT09IHF1LnByZXYubm9kZS5pZClcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIHZhciB2aWR1aWQgPSB2LmlkICsgJywnICsgdS5pZDtcclxuICAgICAgICAgICAgICAgIGlmICh2aWR1aWQgaW4gdmlzaXRlZEZyb20gJiYgdmlzaXRlZEZyb21bdmlkdWlkXSA8PSBxdS5kKVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgdmFyIGNjID0gcXUucHJldiA/IHByZXZDb3N0KHF1LnByZXYubm9kZS5pZCwgdS5pZCwgdi5pZCkgOiAwLCB0ID0gcXUuZCArIG5laWdoYm91ci5kaXN0YW5jZSArIGNjO1xyXG4gICAgICAgICAgICAgICAgdmlzaXRlZEZyb21bdmlkdWlkXSA9IHQ7XHJcbiAgICAgICAgICAgICAgICBxLnB1c2gobmV3IFF1ZXVlRW50cnkodiwgcXUsIHQpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcGF0aCA9IFtdO1xyXG4gICAgICAgIHdoaWxlIChxdS5wcmV2KSB7XHJcbiAgICAgICAgICAgIHF1ID0gcXUucHJldjtcclxuICAgICAgICAgICAgcGF0aC5wdXNoKHF1Lm5vZGUuaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcGF0aDtcclxuICAgIH07XHJcbiAgICBDYWxjdWxhdG9yLnByb3RvdHlwZS5kaWprc3RyYU5laWdoYm91cnMgPSBmdW5jdGlvbiAoc3RhcnQsIGRlc3QpIHtcclxuICAgICAgICBpZiAoZGVzdCA9PT0gdm9pZCAwKSB7IGRlc3QgPSAtMTsgfVxyXG4gICAgICAgIHZhciBxID0gbmV3IHBxdWV1ZV8xLlByaW9yaXR5UXVldWUoZnVuY3Rpb24gKGEsIGIpIHsgcmV0dXJuIGEuZCA8PSBiLmQ7IH0pLCBpID0gdGhpcy5uZWlnaGJvdXJzLmxlbmd0aCwgZCA9IG5ldyBBcnJheShpKTtcclxuICAgICAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gdGhpcy5uZWlnaGJvdXJzW2ldO1xyXG4gICAgICAgICAgICBub2RlLmQgPSBpID09PSBzdGFydCA/IDAgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XHJcbiAgICAgICAgICAgIG5vZGUucSA9IHEucHVzaChub2RlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2hpbGUgKCFxLmVtcHR5KCkpIHtcclxuICAgICAgICAgICAgdmFyIHUgPSBxLnBvcCgpO1xyXG4gICAgICAgICAgICBkW3UuaWRdID0gdS5kO1xyXG4gICAgICAgICAgICBpZiAodS5pZCA9PT0gZGVzdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHBhdGggPSBbXTtcclxuICAgICAgICAgICAgICAgIHZhciB2ID0gdTtcclxuICAgICAgICAgICAgICAgIHdoaWxlICh0eXBlb2Ygdi5wcmV2ICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhdGgucHVzaCh2LnByZXYuaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHYgPSB2LnByZXY7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcGF0aDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpID0gdS5uZWlnaGJvdXJzLmxlbmd0aDtcclxuICAgICAgICAgICAgd2hpbGUgKGktLSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5laWdoYm91ciA9IHUubmVpZ2hib3Vyc1tpXTtcclxuICAgICAgICAgICAgICAgIHZhciB2ID0gdGhpcy5uZWlnaGJvdXJzW25laWdoYm91ci5pZF07XHJcbiAgICAgICAgICAgICAgICB2YXIgdCA9IHUuZCArIG5laWdoYm91ci5kaXN0YW5jZTtcclxuICAgICAgICAgICAgICAgIGlmICh1LmQgIT09IE51bWJlci5NQVhfVkFMVUUgJiYgdi5kID4gdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHYuZCA9IHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdi5wcmV2ID0gdTtcclxuICAgICAgICAgICAgICAgICAgICBxLnJlZHVjZUtleSh2LnEsIHYsIGZ1bmN0aW9uIChlLCBxKSB7IHJldHVybiBlLnEgPSBxOyB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZDtcclxuICAgIH07XHJcbiAgICByZXR1cm4gQ2FsY3VsYXRvcjtcclxufSgpKTtcclxuZXhwb3J0cy5DYWxjdWxhdG9yID0gQ2FsY3VsYXRvcjtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c2hvcnRlc3RwYXRocy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG52YXIgUG9zaXRpb25TdGF0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICBmdW5jdGlvbiBQb3NpdGlvblN0YXRzKHNjYWxlKSB7XHJcbiAgICAgICAgdGhpcy5zY2FsZSA9IHNjYWxlO1xyXG4gICAgICAgIHRoaXMuQUIgPSAwO1xyXG4gICAgICAgIHRoaXMuQUQgPSAwO1xyXG4gICAgICAgIHRoaXMuQTIgPSAwO1xyXG4gICAgfVxyXG4gICAgUG9zaXRpb25TdGF0cy5wcm90b3R5cGUuYWRkVmFyaWFibGUgPSBmdW5jdGlvbiAodikge1xyXG4gICAgICAgIHZhciBhaSA9IHRoaXMuc2NhbGUgLyB2LnNjYWxlO1xyXG4gICAgICAgIHZhciBiaSA9IHYub2Zmc2V0IC8gdi5zY2FsZTtcclxuICAgICAgICB2YXIgd2kgPSB2LndlaWdodDtcclxuICAgICAgICB0aGlzLkFCICs9IHdpICogYWkgKiBiaTtcclxuICAgICAgICB0aGlzLkFEICs9IHdpICogYWkgKiB2LmRlc2lyZWRQb3NpdGlvbjtcclxuICAgICAgICB0aGlzLkEyICs9IHdpICogYWkgKiBhaTtcclxuICAgIH07XHJcbiAgICBQb3NpdGlvblN0YXRzLnByb3RvdHlwZS5nZXRQb3NuID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5BRCAtIHRoaXMuQUIpIC8gdGhpcy5BMjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gUG9zaXRpb25TdGF0cztcclxufSgpKTtcclxuZXhwb3J0cy5Qb3NpdGlvblN0YXRzID0gUG9zaXRpb25TdGF0cztcclxudmFyIENvbnN0cmFpbnQgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQ29uc3RyYWludChsZWZ0LCByaWdodCwgZ2FwLCBlcXVhbGl0eSkge1xyXG4gICAgICAgIGlmIChlcXVhbGl0eSA9PT0gdm9pZCAwKSB7IGVxdWFsaXR5ID0gZmFsc2U7IH1cclxuICAgICAgICB0aGlzLmxlZnQgPSBsZWZ0O1xyXG4gICAgICAgIHRoaXMucmlnaHQgPSByaWdodDtcclxuICAgICAgICB0aGlzLmdhcCA9IGdhcDtcclxuICAgICAgICB0aGlzLmVxdWFsaXR5ID0gZXF1YWxpdHk7XHJcbiAgICAgICAgdGhpcy5hY3RpdmUgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLnVuc2F0aXNmaWFibGUgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmxlZnQgPSBsZWZ0O1xyXG4gICAgICAgIHRoaXMucmlnaHQgPSByaWdodDtcclxuICAgICAgICB0aGlzLmdhcCA9IGdhcDtcclxuICAgICAgICB0aGlzLmVxdWFsaXR5ID0gZXF1YWxpdHk7XHJcbiAgICB9XHJcbiAgICBDb25zdHJhaW50LnByb3RvdHlwZS5zbGFjayA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy51bnNhdGlzZmlhYmxlID8gTnVtYmVyLk1BWF9WQUxVRVxyXG4gICAgICAgICAgICA6IHRoaXMucmlnaHQuc2NhbGUgKiB0aGlzLnJpZ2h0LnBvc2l0aW9uKCkgLSB0aGlzLmdhcFxyXG4gICAgICAgICAgICAgICAgLSB0aGlzLmxlZnQuc2NhbGUgKiB0aGlzLmxlZnQucG9zaXRpb24oKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gQ29uc3RyYWludDtcclxufSgpKTtcclxuZXhwb3J0cy5Db25zdHJhaW50ID0gQ29uc3RyYWludDtcclxudmFyIFZhcmlhYmxlID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIFZhcmlhYmxlKGRlc2lyZWRQb3NpdGlvbiwgd2VpZ2h0LCBzY2FsZSkge1xyXG4gICAgICAgIGlmICh3ZWlnaHQgPT09IHZvaWQgMCkgeyB3ZWlnaHQgPSAxOyB9XHJcbiAgICAgICAgaWYgKHNjYWxlID09PSB2b2lkIDApIHsgc2NhbGUgPSAxOyB9XHJcbiAgICAgICAgdGhpcy5kZXNpcmVkUG9zaXRpb24gPSBkZXNpcmVkUG9zaXRpb247XHJcbiAgICAgICAgdGhpcy53ZWlnaHQgPSB3ZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5zY2FsZSA9IHNjYWxlO1xyXG4gICAgICAgIHRoaXMub2Zmc2V0ID0gMDtcclxuICAgIH1cclxuICAgIFZhcmlhYmxlLnByb3RvdHlwZS5kZmR2ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAyLjAgKiB0aGlzLndlaWdodCAqICh0aGlzLnBvc2l0aW9uKCkgLSB0aGlzLmRlc2lyZWRQb3NpdGlvbik7XHJcbiAgICB9O1xyXG4gICAgVmFyaWFibGUucHJvdG90eXBlLnBvc2l0aW9uID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5ibG9jay5wcy5zY2FsZSAqIHRoaXMuYmxvY2sucG9zbiArIHRoaXMub2Zmc2V0KSAvIHRoaXMuc2NhbGU7XHJcbiAgICB9O1xyXG4gICAgVmFyaWFibGUucHJvdG90eXBlLnZpc2l0TmVpZ2hib3VycyA9IGZ1bmN0aW9uIChwcmV2LCBmKSB7XHJcbiAgICAgICAgdmFyIGZmID0gZnVuY3Rpb24gKGMsIG5leHQpIHsgcmV0dXJuIGMuYWN0aXZlICYmIHByZXYgIT09IG5leHQgJiYgZihjLCBuZXh0KTsgfTtcclxuICAgICAgICB0aGlzLmNPdXQuZm9yRWFjaChmdW5jdGlvbiAoYykgeyByZXR1cm4gZmYoYywgYy5yaWdodCk7IH0pO1xyXG4gICAgICAgIHRoaXMuY0luLmZvckVhY2goZnVuY3Rpb24gKGMpIHsgcmV0dXJuIGZmKGMsIGMubGVmdCk7IH0pO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBWYXJpYWJsZTtcclxufSgpKTtcclxuZXhwb3J0cy5WYXJpYWJsZSA9IFZhcmlhYmxlO1xyXG52YXIgQmxvY2sgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQmxvY2sodikge1xyXG4gICAgICAgIHRoaXMudmFycyA9IFtdO1xyXG4gICAgICAgIHYub2Zmc2V0ID0gMDtcclxuICAgICAgICB0aGlzLnBzID0gbmV3IFBvc2l0aW9uU3RhdHModi5zY2FsZSk7XHJcbiAgICAgICAgdGhpcy5hZGRWYXJpYWJsZSh2KTtcclxuICAgIH1cclxuICAgIEJsb2NrLnByb3RvdHlwZS5hZGRWYXJpYWJsZSA9IGZ1bmN0aW9uICh2KSB7XHJcbiAgICAgICAgdi5ibG9jayA9IHRoaXM7XHJcbiAgICAgICAgdGhpcy52YXJzLnB1c2godik7XHJcbiAgICAgICAgdGhpcy5wcy5hZGRWYXJpYWJsZSh2KTtcclxuICAgICAgICB0aGlzLnBvc24gPSB0aGlzLnBzLmdldFBvc24oKTtcclxuICAgIH07XHJcbiAgICBCbG9jay5wcm90b3R5cGUudXBkYXRlV2VpZ2h0ZWRQb3NpdGlvbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnBzLkFCID0gdGhpcy5wcy5BRCA9IHRoaXMucHMuQTIgPSAwO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gdGhpcy52YXJzLmxlbmd0aDsgaSA8IG47ICsraSlcclxuICAgICAgICAgICAgdGhpcy5wcy5hZGRWYXJpYWJsZSh0aGlzLnZhcnNbaV0pO1xyXG4gICAgICAgIHRoaXMucG9zbiA9IHRoaXMucHMuZ2V0UG9zbigpO1xyXG4gICAgfTtcclxuICAgIEJsb2NrLnByb3RvdHlwZS5jb21wdXRlX2xtID0gZnVuY3Rpb24gKHYsIHUsIHBvc3RBY3Rpb24pIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHZhciBkZmR2ID0gdi5kZmR2KCk7XHJcbiAgICAgICAgdi52aXNpdE5laWdoYm91cnModSwgZnVuY3Rpb24gKGMsIG5leHQpIHtcclxuICAgICAgICAgICAgdmFyIF9kZmR2ID0gX3RoaXMuY29tcHV0ZV9sbShuZXh0LCB2LCBwb3N0QWN0aW9uKTtcclxuICAgICAgICAgICAgaWYgKG5leHQgPT09IGMucmlnaHQpIHtcclxuICAgICAgICAgICAgICAgIGRmZHYgKz0gX2RmZHYgKiBjLmxlZnQuc2NhbGU7XHJcbiAgICAgICAgICAgICAgICBjLmxtID0gX2RmZHY7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBkZmR2ICs9IF9kZmR2ICogYy5yaWdodC5zY2FsZTtcclxuICAgICAgICAgICAgICAgIGMubG0gPSAtX2RmZHY7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcG9zdEFjdGlvbihjKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gZGZkdiAvIHYuc2NhbGU7XHJcbiAgICB9O1xyXG4gICAgQmxvY2sucHJvdG90eXBlLnBvcHVsYXRlU3BsaXRCbG9jayA9IGZ1bmN0aW9uICh2LCBwcmV2KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2LnZpc2l0TmVpZ2hib3VycyhwcmV2LCBmdW5jdGlvbiAoYywgbmV4dCkge1xyXG4gICAgICAgICAgICBuZXh0Lm9mZnNldCA9IHYub2Zmc2V0ICsgKG5leHQgPT09IGMucmlnaHQgPyBjLmdhcCA6IC1jLmdhcCk7XHJcbiAgICAgICAgICAgIF90aGlzLmFkZFZhcmlhYmxlKG5leHQpO1xyXG4gICAgICAgICAgICBfdGhpcy5wb3B1bGF0ZVNwbGl0QmxvY2sobmV4dCwgdik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgQmxvY2sucHJvdG90eXBlLnRyYXZlcnNlID0gZnVuY3Rpb24gKHZpc2l0LCBhY2MsIHYsIHByZXYpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIGlmICh2ID09PSB2b2lkIDApIHsgdiA9IHRoaXMudmFyc1swXTsgfVxyXG4gICAgICAgIGlmIChwcmV2ID09PSB2b2lkIDApIHsgcHJldiA9IG51bGw7IH1cclxuICAgICAgICB2LnZpc2l0TmVpZ2hib3VycyhwcmV2LCBmdW5jdGlvbiAoYywgbmV4dCkge1xyXG4gICAgICAgICAgICBhY2MucHVzaCh2aXNpdChjKSk7XHJcbiAgICAgICAgICAgIF90aGlzLnRyYXZlcnNlKHZpc2l0LCBhY2MsIG5leHQsIHYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIEJsb2NrLnByb3RvdHlwZS5maW5kTWluTE0gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIG0gPSBudWxsO1xyXG4gICAgICAgIHRoaXMuY29tcHV0ZV9sbSh0aGlzLnZhcnNbMF0sIG51bGwsIGZ1bmN0aW9uIChjKSB7XHJcbiAgICAgICAgICAgIGlmICghYy5lcXVhbGl0eSAmJiAobSA9PT0gbnVsbCB8fCBjLmxtIDwgbS5sbSkpXHJcbiAgICAgICAgICAgICAgICBtID0gYztcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gbTtcclxuICAgIH07XHJcbiAgICBCbG9jay5wcm90b3R5cGUuZmluZE1pbkxNQmV0d2VlbiA9IGZ1bmN0aW9uIChsdiwgcnYpIHtcclxuICAgICAgICB0aGlzLmNvbXB1dGVfbG0obHYsIG51bGwsIGZ1bmN0aW9uICgpIHsgfSk7XHJcbiAgICAgICAgdmFyIG0gPSBudWxsO1xyXG4gICAgICAgIHRoaXMuZmluZFBhdGgobHYsIG51bGwsIHJ2LCBmdW5jdGlvbiAoYywgbmV4dCkge1xyXG4gICAgICAgICAgICBpZiAoIWMuZXF1YWxpdHkgJiYgYy5yaWdodCA9PT0gbmV4dCAmJiAobSA9PT0gbnVsbCB8fCBjLmxtIDwgbS5sbSkpXHJcbiAgICAgICAgICAgICAgICBtID0gYztcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gbTtcclxuICAgIH07XHJcbiAgICBCbG9jay5wcm90b3R5cGUuZmluZFBhdGggPSBmdW5jdGlvbiAodiwgcHJldiwgdG8sIHZpc2l0KSB7XHJcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgICAgICB2YXIgZW5kRm91bmQgPSBmYWxzZTtcclxuICAgICAgICB2LnZpc2l0TmVpZ2hib3VycyhwcmV2LCBmdW5jdGlvbiAoYywgbmV4dCkge1xyXG4gICAgICAgICAgICBpZiAoIWVuZEZvdW5kICYmIChuZXh0ID09PSB0byB8fCBfdGhpcy5maW5kUGF0aChuZXh0LCB2LCB0bywgdmlzaXQpKSkge1xyXG4gICAgICAgICAgICAgICAgZW5kRm91bmQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgdmlzaXQoYywgbmV4dCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gZW5kRm91bmQ7XHJcbiAgICB9O1xyXG4gICAgQmxvY2sucHJvdG90eXBlLmlzQWN0aXZlRGlyZWN0ZWRQYXRoQmV0d2VlbiA9IGZ1bmN0aW9uICh1LCB2KSB7XHJcbiAgICAgICAgaWYgKHUgPT09IHYpXHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIHZhciBpID0gdS5jT3V0Lmxlbmd0aDtcclxuICAgICAgICB3aGlsZSAoaS0tKSB7XHJcbiAgICAgICAgICAgIHZhciBjID0gdS5jT3V0W2ldO1xyXG4gICAgICAgICAgICBpZiAoYy5hY3RpdmUgJiYgdGhpcy5pc0FjdGl2ZURpcmVjdGVkUGF0aEJldHdlZW4oYy5yaWdodCwgdikpXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIEJsb2NrLnNwbGl0ID0gZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICBjLmFjdGl2ZSA9IGZhbHNlO1xyXG4gICAgICAgIHJldHVybiBbQmxvY2suY3JlYXRlU3BsaXRCbG9jayhjLmxlZnQpLCBCbG9jay5jcmVhdGVTcGxpdEJsb2NrKGMucmlnaHQpXTtcclxuICAgIH07XHJcbiAgICBCbG9jay5jcmVhdGVTcGxpdEJsb2NrID0gZnVuY3Rpb24gKHN0YXJ0VmFyKSB7XHJcbiAgICAgICAgdmFyIGIgPSBuZXcgQmxvY2soc3RhcnRWYXIpO1xyXG4gICAgICAgIGIucG9wdWxhdGVTcGxpdEJsb2NrKHN0YXJ0VmFyLCBudWxsKTtcclxuICAgICAgICByZXR1cm4gYjtcclxuICAgIH07XHJcbiAgICBCbG9jay5wcm90b3R5cGUuc3BsaXRCZXR3ZWVuID0gZnVuY3Rpb24gKHZsLCB2cikge1xyXG4gICAgICAgIHZhciBjID0gdGhpcy5maW5kTWluTE1CZXR3ZWVuKHZsLCB2cik7XHJcbiAgICAgICAgaWYgKGMgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgdmFyIGJzID0gQmxvY2suc3BsaXQoYyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IGNvbnN0cmFpbnQ6IGMsIGxiOiBic1swXSwgcmI6IGJzWzFdIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfTtcclxuICAgIEJsb2NrLnByb3RvdHlwZS5tZXJnZUFjcm9zcyA9IGZ1bmN0aW9uIChiLCBjLCBkaXN0KSB7XHJcbiAgICAgICAgYy5hY3RpdmUgPSB0cnVlO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYi52YXJzLmxlbmd0aDsgaSA8IG47ICsraSkge1xyXG4gICAgICAgICAgICB2YXIgdiA9IGIudmFyc1tpXTtcclxuICAgICAgICAgICAgdi5vZmZzZXQgKz0gZGlzdDtcclxuICAgICAgICAgICAgdGhpcy5hZGRWYXJpYWJsZSh2KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5wb3NuID0gdGhpcy5wcy5nZXRQb3NuKCk7XHJcbiAgICB9O1xyXG4gICAgQmxvY2sucHJvdG90eXBlLmNvc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHN1bSA9IDAsIGkgPSB0aGlzLnZhcnMubGVuZ3RoO1xyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcclxuICAgICAgICAgICAgdmFyIHYgPSB0aGlzLnZhcnNbaV0sIGQgPSB2LnBvc2l0aW9uKCkgLSB2LmRlc2lyZWRQb3NpdGlvbjtcclxuICAgICAgICAgICAgc3VtICs9IGQgKiBkICogdi53ZWlnaHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdW07XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEJsb2NrO1xyXG59KCkpO1xyXG5leHBvcnRzLkJsb2NrID0gQmxvY2s7XHJcbnZhciBCbG9ja3MgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gQmxvY2tzKHZzKSB7XHJcbiAgICAgICAgdGhpcy52cyA9IHZzO1xyXG4gICAgICAgIHZhciBuID0gdnMubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMubGlzdCA9IG5ldyBBcnJheShuKTtcclxuICAgICAgICB3aGlsZSAobi0tKSB7XHJcbiAgICAgICAgICAgIHZhciBiID0gbmV3IEJsb2NrKHZzW25dKTtcclxuICAgICAgICAgICAgdGhpcy5saXN0W25dID0gYjtcclxuICAgICAgICAgICAgYi5ibG9ja0luZCA9IG47XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgQmxvY2tzLnByb3RvdHlwZS5jb3N0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBzdW0gPSAwLCBpID0gdGhpcy5saXN0Lmxlbmd0aDtcclxuICAgICAgICB3aGlsZSAoaS0tKVxyXG4gICAgICAgICAgICBzdW0gKz0gdGhpcy5saXN0W2ldLmNvc3QoKTtcclxuICAgICAgICByZXR1cm4gc3VtO1xyXG4gICAgfTtcclxuICAgIEJsb2Nrcy5wcm90b3R5cGUuaW5zZXJ0ID0gZnVuY3Rpb24gKGIpIHtcclxuICAgICAgICBiLmJsb2NrSW5kID0gdGhpcy5saXN0Lmxlbmd0aDtcclxuICAgICAgICB0aGlzLmxpc3QucHVzaChiKTtcclxuICAgIH07XHJcbiAgICBCbG9ja3MucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChiKSB7XHJcbiAgICAgICAgdmFyIGxhc3QgPSB0aGlzLmxpc3QubGVuZ3RoIC0gMTtcclxuICAgICAgICB2YXIgc3dhcEJsb2NrID0gdGhpcy5saXN0W2xhc3RdO1xyXG4gICAgICAgIHRoaXMubGlzdC5sZW5ndGggPSBsYXN0O1xyXG4gICAgICAgIGlmIChiICE9PSBzd2FwQmxvY2spIHtcclxuICAgICAgICAgICAgdGhpcy5saXN0W2IuYmxvY2tJbmRdID0gc3dhcEJsb2NrO1xyXG4gICAgICAgICAgICBzd2FwQmxvY2suYmxvY2tJbmQgPSBiLmJsb2NrSW5kO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBCbG9ja3MucHJvdG90eXBlLm1lcmdlID0gZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICB2YXIgbCA9IGMubGVmdC5ibG9jaywgciA9IGMucmlnaHQuYmxvY2s7XHJcbiAgICAgICAgdmFyIGRpc3QgPSBjLnJpZ2h0Lm9mZnNldCAtIGMubGVmdC5vZmZzZXQgLSBjLmdhcDtcclxuICAgICAgICBpZiAobC52YXJzLmxlbmd0aCA8IHIudmFycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgci5tZXJnZUFjcm9zcyhsLCBjLCBkaXN0KTtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUobCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBsLm1lcmdlQWNyb3NzKHIsIGMsIC1kaXN0KTtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmUocik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIEJsb2Nrcy5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChmKSB7XHJcbiAgICAgICAgdGhpcy5saXN0LmZvckVhY2goZik7XHJcbiAgICB9O1xyXG4gICAgQmxvY2tzLnByb3RvdHlwZS51cGRhdGVCbG9ja1Bvc2l0aW9ucyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmxpc3QuZm9yRWFjaChmdW5jdGlvbiAoYikgeyByZXR1cm4gYi51cGRhdGVXZWlnaHRlZFBvc2l0aW9uKCk7IH0pO1xyXG4gICAgfTtcclxuICAgIEJsb2Nrcy5wcm90b3R5cGUuc3BsaXQgPSBmdW5jdGlvbiAoaW5hY3RpdmUpIHtcclxuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICAgIHRoaXMudXBkYXRlQmxvY2tQb3NpdGlvbnMoKTtcclxuICAgICAgICB0aGlzLmxpc3QuZm9yRWFjaChmdW5jdGlvbiAoYikge1xyXG4gICAgICAgICAgICB2YXIgdiA9IGIuZmluZE1pbkxNKCk7XHJcbiAgICAgICAgICAgIGlmICh2ICE9PSBudWxsICYmIHYubG0gPCBTb2x2ZXIuTEFHUkFOR0lBTl9UT0xFUkFOQ0UpIHtcclxuICAgICAgICAgICAgICAgIGIgPSB2LmxlZnQuYmxvY2s7XHJcbiAgICAgICAgICAgICAgICBCbG9jay5zcGxpdCh2KS5mb3JFYWNoKGZ1bmN0aW9uIChuYikgeyByZXR1cm4gX3RoaXMuaW5zZXJ0KG5iKTsgfSk7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy5yZW1vdmUoYik7XHJcbiAgICAgICAgICAgICAgICBpbmFjdGl2ZS5wdXNoKHYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIEJsb2NrcztcclxufSgpKTtcclxuZXhwb3J0cy5CbG9ja3MgPSBCbG9ja3M7XHJcbnZhciBTb2x2ZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgZnVuY3Rpb24gU29sdmVyKHZzLCBjcykge1xyXG4gICAgICAgIHRoaXMudnMgPSB2cztcclxuICAgICAgICB0aGlzLmNzID0gY3M7XHJcbiAgICAgICAgdGhpcy52cyA9IHZzO1xyXG4gICAgICAgIHZzLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICAgICAgdi5jSW4gPSBbXSwgdi5jT3V0ID0gW107XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5jcyA9IGNzO1xyXG4gICAgICAgIGNzLmZvckVhY2goZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgYy5sZWZ0LmNPdXQucHVzaChjKTtcclxuICAgICAgICAgICAgYy5yaWdodC5jSW4ucHVzaChjKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmluYWN0aXZlID0gY3MubWFwKGZ1bmN0aW9uIChjKSB7IGMuYWN0aXZlID0gZmFsc2U7IHJldHVybiBjOyB9KTtcclxuICAgICAgICB0aGlzLmJzID0gbnVsbDtcclxuICAgIH1cclxuICAgIFNvbHZlci5wcm90b3R5cGUuY29zdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5icy5jb3N0KCk7XHJcbiAgICB9O1xyXG4gICAgU29sdmVyLnByb3RvdHlwZS5zZXRTdGFydGluZ1Bvc2l0aW9ucyA9IGZ1bmN0aW9uIChwcykge1xyXG4gICAgICAgIHRoaXMuaW5hY3RpdmUgPSB0aGlzLmNzLm1hcChmdW5jdGlvbiAoYykgeyBjLmFjdGl2ZSA9IGZhbHNlOyByZXR1cm4gYzsgfSk7XHJcbiAgICAgICAgdGhpcy5icyA9IG5ldyBCbG9ja3ModGhpcy52cyk7XHJcbiAgICAgICAgdGhpcy5icy5mb3JFYWNoKGZ1bmN0aW9uIChiLCBpKSB7IHJldHVybiBiLnBvc24gPSBwc1tpXTsgfSk7XHJcbiAgICB9O1xyXG4gICAgU29sdmVyLnByb3RvdHlwZS5zZXREZXNpcmVkUG9zaXRpb25zID0gZnVuY3Rpb24gKHBzKSB7XHJcbiAgICAgICAgdGhpcy52cy5mb3JFYWNoKGZ1bmN0aW9uICh2LCBpKSB7IHJldHVybiB2LmRlc2lyZWRQb3NpdGlvbiA9IHBzW2ldOyB9KTtcclxuICAgIH07XHJcbiAgICBTb2x2ZXIucHJvdG90eXBlLm1vc3RWaW9sYXRlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgbWluU2xhY2sgPSBOdW1iZXIuTUFYX1ZBTFVFLCB2ID0gbnVsbCwgbCA9IHRoaXMuaW5hY3RpdmUsIG4gPSBsLmxlbmd0aCwgZGVsZXRlUG9pbnQgPSBuO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBjID0gbFtpXTtcclxuICAgICAgICAgICAgaWYgKGMudW5zYXRpc2ZpYWJsZSlcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB2YXIgc2xhY2sgPSBjLnNsYWNrKCk7XHJcbiAgICAgICAgICAgIGlmIChjLmVxdWFsaXR5IHx8IHNsYWNrIDwgbWluU2xhY2spIHtcclxuICAgICAgICAgICAgICAgIG1pblNsYWNrID0gc2xhY2s7XHJcbiAgICAgICAgICAgICAgICB2ID0gYztcclxuICAgICAgICAgICAgICAgIGRlbGV0ZVBvaW50ID0gaTtcclxuICAgICAgICAgICAgICAgIGlmIChjLmVxdWFsaXR5KVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChkZWxldGVQb2ludCAhPT0gbiAmJlxyXG4gICAgICAgICAgICAobWluU2xhY2sgPCBTb2x2ZXIuWkVST19VUFBFUkJPVU5EICYmICF2LmFjdGl2ZSB8fCB2LmVxdWFsaXR5KSkge1xyXG4gICAgICAgICAgICBsW2RlbGV0ZVBvaW50XSA9IGxbbiAtIDFdO1xyXG4gICAgICAgICAgICBsLmxlbmd0aCA9IG4gLSAxO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdjtcclxuICAgIH07XHJcbiAgICBTb2x2ZXIucHJvdG90eXBlLnNhdGlzZnkgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuYnMgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLmJzID0gbmV3IEJsb2Nrcyh0aGlzLnZzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5icy5zcGxpdCh0aGlzLmluYWN0aXZlKTtcclxuICAgICAgICB2YXIgdiA9IG51bGw7XHJcbiAgICAgICAgd2hpbGUgKCh2ID0gdGhpcy5tb3N0VmlvbGF0ZWQoKSkgJiYgKHYuZXF1YWxpdHkgfHwgdi5zbGFjaygpIDwgU29sdmVyLlpFUk9fVVBQRVJCT1VORCAmJiAhdi5hY3RpdmUpKSB7XHJcbiAgICAgICAgICAgIHZhciBsYiA9IHYubGVmdC5ibG9jaywgcmIgPSB2LnJpZ2h0LmJsb2NrO1xyXG4gICAgICAgICAgICBpZiAobGIgIT09IHJiKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmJzLm1lcmdlKHYpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYgKGxiLmlzQWN0aXZlRGlyZWN0ZWRQYXRoQmV0d2Vlbih2LnJpZ2h0LCB2LmxlZnQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdi51bnNhdGlzZmlhYmxlID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBzcGxpdCA9IGxiLnNwbGl0QmV0d2Vlbih2LmxlZnQsIHYucmlnaHQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHNwbGl0ICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5icy5pbnNlcnQoc3BsaXQubGIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYnMuaW5zZXJ0KHNwbGl0LnJiKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJzLnJlbW92ZShsYik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbmFjdGl2ZS5wdXNoKHNwbGl0LmNvbnN0cmFpbnQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdi51bnNhdGlzZmlhYmxlID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh2LnNsYWNrKCkgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW5hY3RpdmUucHVzaCh2KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYnMubWVyZ2Uodik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgU29sdmVyLnByb3RvdHlwZS5zb2x2ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnNhdGlzZnkoKTtcclxuICAgICAgICB2YXIgbGFzdGNvc3QgPSBOdW1iZXIuTUFYX1ZBTFVFLCBjb3N0ID0gdGhpcy5icy5jb3N0KCk7XHJcbiAgICAgICAgd2hpbGUgKE1hdGguYWJzKGxhc3Rjb3N0IC0gY29zdCkgPiAwLjAwMDEpIHtcclxuICAgICAgICAgICAgdGhpcy5zYXRpc2Z5KCk7XHJcbiAgICAgICAgICAgIGxhc3Rjb3N0ID0gY29zdDtcclxuICAgICAgICAgICAgY29zdCA9IHRoaXMuYnMuY29zdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY29zdDtcclxuICAgIH07XHJcbiAgICBTb2x2ZXIuTEFHUkFOR0lBTl9UT0xFUkFOQ0UgPSAtMWUtNDtcclxuICAgIFNvbHZlci5aRVJPX1VQUEVSQk9VTkQgPSAtMWUtMTA7XHJcbiAgICByZXR1cm4gU29sdmVyO1xyXG59KCkpO1xyXG5leHBvcnRzLlNvbHZlciA9IFNvbHZlcjtcclxuZnVuY3Rpb24gcmVtb3ZlT3ZlcmxhcEluT25lRGltZW5zaW9uKHNwYW5zLCBsb3dlckJvdW5kLCB1cHBlckJvdW5kKSB7XHJcbiAgICB2YXIgdnMgPSBzcGFucy5tYXAoZnVuY3Rpb24gKHMpIHsgcmV0dXJuIG5ldyBWYXJpYWJsZShzLmRlc2lyZWRDZW50ZXIpOyB9KTtcclxuICAgIHZhciBjcyA9IFtdO1xyXG4gICAgdmFyIG4gPSBzcGFucy5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG4gLSAxOyBpKyspIHtcclxuICAgICAgICB2YXIgbGVmdCA9IHNwYW5zW2ldLCByaWdodCA9IHNwYW5zW2kgKyAxXTtcclxuICAgICAgICBjcy5wdXNoKG5ldyBDb25zdHJhaW50KHZzW2ldLCB2c1tpICsgMV0sIChsZWZ0LnNpemUgKyByaWdodC5zaXplKSAvIDIpKTtcclxuICAgIH1cclxuICAgIHZhciBsZWZ0TW9zdCA9IHZzWzBdLCByaWdodE1vc3QgPSB2c1tuIC0gMV0sIGxlZnRNb3N0U2l6ZSA9IHNwYW5zWzBdLnNpemUgLyAyLCByaWdodE1vc3RTaXplID0gc3BhbnNbbiAtIDFdLnNpemUgLyAyO1xyXG4gICAgdmFyIHZMb3dlciA9IG51bGwsIHZVcHBlciA9IG51bGw7XHJcbiAgICBpZiAobG93ZXJCb3VuZCkge1xyXG4gICAgICAgIHZMb3dlciA9IG5ldyBWYXJpYWJsZShsb3dlckJvdW5kLCBsZWZ0TW9zdC53ZWlnaHQgKiAxMDAwKTtcclxuICAgICAgICB2cy5wdXNoKHZMb3dlcik7XHJcbiAgICAgICAgY3MucHVzaChuZXcgQ29uc3RyYWludCh2TG93ZXIsIGxlZnRNb3N0LCBsZWZ0TW9zdFNpemUpKTtcclxuICAgIH1cclxuICAgIGlmICh1cHBlckJvdW5kKSB7XHJcbiAgICAgICAgdlVwcGVyID0gbmV3IFZhcmlhYmxlKHVwcGVyQm91bmQsIHJpZ2h0TW9zdC53ZWlnaHQgKiAxMDAwKTtcclxuICAgICAgICB2cy5wdXNoKHZVcHBlcik7XHJcbiAgICAgICAgY3MucHVzaChuZXcgQ29uc3RyYWludChyaWdodE1vc3QsIHZVcHBlciwgcmlnaHRNb3N0U2l6ZSkpO1xyXG4gICAgfVxyXG4gICAgdmFyIHNvbHZlciA9IG5ldyBTb2x2ZXIodnMsIGNzKTtcclxuICAgIHNvbHZlci5zb2x2ZSgpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuZXdDZW50ZXJzOiB2cy5zbGljZSgwLCBzcGFucy5sZW5ndGgpLm1hcChmdW5jdGlvbiAodikgeyByZXR1cm4gdi5wb3NpdGlvbigpOyB9KSxcclxuICAgICAgICBsb3dlckJvdW5kOiB2TG93ZXIgPyB2TG93ZXIucG9zaXRpb24oKSA6IGxlZnRNb3N0LnBvc2l0aW9uKCkgLSBsZWZ0TW9zdFNpemUsXHJcbiAgICAgICAgdXBwZXJCb3VuZDogdlVwcGVyID8gdlVwcGVyLnBvc2l0aW9uKCkgOiByaWdodE1vc3QucG9zaXRpb24oKSArIHJpZ2h0TW9zdFNpemVcclxuICAgIH07XHJcbn1cclxuZXhwb3J0cy5yZW1vdmVPdmVybGFwSW5PbmVEaW1lbnNpb24gPSByZW1vdmVPdmVybGFwSW5PbmVEaW1lbnNpb247XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXZwc2MuanMubWFwIl19
