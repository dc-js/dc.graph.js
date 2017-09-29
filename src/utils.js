// i'm sure there's a word for this in haskell
function conditional_properties(pred, props) {
    function _if(pred, curr) {
        return function(o, last) {
            return pred(o) ? curr(o) : last();
        };
    }
    var props2 = {};
    for(var p in props)
        props2[p] = _if(pred, param(props[p]));
    return props2;
}

function node_edge_conditions(npred, epred, props) {
    var nprops = {}, eprops = {}, badprops = [];
    for(var p in props) {
        if(/^node/.test(p))
            nprops[p] = props[p];
        else if(/^edge/.test(p))
            eprops[p] = props[p];
        else badprops.push(p);
    }
    if(badprops.length)
        console.error('only know how to deal with properties that start with "node" or "edge"', badprops);
    var props2 = npred ? conditional_properties(npred, nprops) : {};
    if(epred)
        Object.assign(props2, conditional_properties(epred, eprops));
    return props2;
}

function cascade(parent) {
    return function(level, add, props) {
        for(var p in props) {
            if(!parent[p])
                throw new Error('unknown attribute ' + p);
            parent[p].cascade(level, add ? props[p] : null);
        }
        return parent;
    };
}

function compose(f, g) {
    return function() {
        return f(g.apply(null, arguments));
    };
}

// version of d3.functor that optionally wraps the function with another
// one, if the parameter is a function
dc_graph.functor_wrap = function (v, wrap) {
    if(typeof v === "function") {
        return wrap ? function(x) {
            return v(wrap(x));
        } : v;
    }
    else return function() {
        return v;
    };
};

// we want to allow either values or functions to be passed to specify parameters.
// if a function, the function needs a preprocessor to extract the original key/value
// pair from the wrapper object we put it in.
function param(v) {
    return dc_graph.functor_wrap(v, get_original);
}

// http://jsperf.com/cloning-an-object/101
function clone(obj) {
    var target = {};
    for(var i in obj) {
        if(obj.hasOwnProperty(i)) {
            target[i] = obj[i];
        }
    }
    return target;
}

// because i don't think we need to bind edge point data (yet!)
var bez_cmds = {
    1: 'L', 2: 'Q', 3: 'C'
};

function generate_path(pts, bezDegree, close) {
    var cats = ['M', pts[0].x, ',', pts[0].y], remain = bezDegree;
    var hasNaN = false;
    for(var i = 1; i < pts.length; ++i) {
        if(isNaN(pts[i].x) || isNaN(pts[i].y))
            hasNaN = true;
        cats.push(remain===bezDegree ? bez_cmds[bezDegree] : ' ', pts[i].x, ',', pts[i].y);
        if(--remain===0)
            remain = bezDegree;
    }
    if(remain!=bezDegree)
        console.log("warning: pts.length didn't match bezian degree", pts, bezDegree);
    if(close)
        cats.push('Z');
    return cats.join('');
}

// for IE (do we care really?)
Math.hypot = Math.hypot || function() {
  var y = 0;
  var length = arguments.length;

  for (var i = 0; i < length; i++) {
    if (arguments[i] === Infinity || arguments[i] === -Infinity) {
      return Infinity;
    }
    y += arguments[i] * arguments[i];
  }
  return Math.sqrt(y);
};

var script_path = function() {
    var _path;
    return function() {
        if(_path === undefined) {
            // adapted from http://stackoverflow.com/a/18283141/676195
            _path = null; // only try once
            var filename = 'dc.graph.js';
            var scripts = document.getElementsByTagName('script');
            if (scripts && scripts.length > 0) {
                for (var i in scripts) {
                    if (scripts[i].src && scripts[i].src.match(new RegExp(filename+'$'))) {
                        _path = scripts[i].src.replace(new RegExp('(.*)'+filename+'$'), '$1');
                        break;
                    }
                }
            }
        }
        return _path;
    };
}();

dc_graph.event_coords = function(chart) {
    var bound = chart.root().node().getBoundingClientRect();
    return chart.invertCoord([d3.event.clientX - bound.left,
                              d3.event.clientY - bound.top]);
};

function promise_identity(x) {
    return Promise.resolve(x);
}

// http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;
