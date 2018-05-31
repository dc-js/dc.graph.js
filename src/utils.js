function property_if(pred, curr) {
    return function(o, last) {
        return pred(o) ? curr(o) : last();
    };
}

function property_interpolate(value, curr) {
    return function(o, last) {
        return d3.interpolate(last(o), curr(o))(value(o));
    };
}

function multiply_properties(pred, props, blend) {
    var props2 = {};
    for(var p in props)
        props2[p] = blend(pred, param(props[p]));
    return props2;
}

function conditional_properties(pred, props) {
    return multiply_properties(pred, props, property_if);
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

// outputs the array with adjacent identical lines collapsed to one
function uniq(a) {
    var ret = [];
    a.forEach(function(x, i) {
        if(i === 0 || x !== a[i-1])
            ret.push(x);
    });
    return ret;
}

// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
     // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      var thisArg = arguments[1];

      // 5. Let k be 0.
      var k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
        // d. If testResult is true, return kValue.
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return kValue;
        }
        // e. Increase k by 1.
        k++;
      }

      // 7. Return undefined.
      return undefined;
    }
  });
}

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

dc_graph.event_coords = function(diagram) {
    var bound = diagram.root().node().getBoundingClientRect();
    return diagram.invertCoord([d3.event.clientX - bound.left,
                              d3.event.clientY - bound.top]);
};

function promise_identity(x) {
    return Promise.resolve(x);
}

// http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
var is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

// https://stackoverflow.com/questions/16863917/check-if-class-exists-somewhere-in-parent-vanilla-js
function ancestor_has_class(element, classname) {
    if(d3.select(element).classed(classname))
        return true;
    return element.parentElement && ancestor_has_class(element.parentElement, classname);
}
