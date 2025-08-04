import { getOriginal } from './core.js';
import { interpolate } from 'd3-interpolate';
import { select } from 'd3-selection';

export function propertyIf(pred, curr) {
    return function(o, last) {
        return pred(o) ? curr(o) : last();
    };
}

export function propertyInterpolate(value, curr) {
    return function(o, last) {
        return interpolate(last(o), curr(o))(value(o));
    };
}

export function multiplyProperties(pred, props, blend) {
    const props2 = {};
    for(const p in props)
        props2[p] = blend(pred, param(props[p]));
    return props2;
}

export function conditionalProperties(pred, props) {
    return multiplyProperties(pred, props, propertyIf);
}

export function nodeEdgeConditions(npred, epred, props) {
    const nprops = {}, eprops = {}, badprops = [];
    for(const p in props) {
        if(/^node/.test(p))
            nprops[p] = props[p];
        else if(/^edge/.test(p))
            eprops[p] = props[p];
        else badprops.push(p);
    }
    if(badprops.length)
        console.error('only know how to deal with properties that start with "node" or "edge"', badprops);
    const props2 = npred ? conditionalProperties(npred, nprops) : {};
    if(epred)
        Object.assign(props2, conditionalProperties(epred, eprops));
    return props2;
}

export function cascade(parent) {
    return function(level, add, props) {
        for(const p in props) {
            if(!parent[p])
                throw new Error(`unknown attribute ${  p}`);
            parent[p].cascade(level, add ? props[p] : null);
        }
        return parent;
    };
}

export function compose(f, g) {
    return function() {
        return f(g.apply(null, arguments));
    };
}

// version of d3.functor that optionally wraps the function with another
// one, if the parameter is a function
export function functorWrap(v, wrap) {
    if(typeof v === "function") {
        return wrap ? function(x) {
            return v(wrap(x));
        } : v;
    }
    else return function() {
        return v;
    };
}

// we want to allow either values or functions to be passed to specify parameters.
// if a function, the function needs a preprocessor to extract the original key/value
// pair from the wrapper object we put it in.
export function param(v) {
    return functorWrap(v, getOriginal);
}

// http://jsperf.com/cloning-an-object/101
export function clone(obj) {
    const target = {};
    for(const i in obj) {
        if(obj.hasOwnProperty(i)) {
            target[i] = obj[i];
        }
    }
    return target;
}

// because i don't think we need to bind edge point data (yet!)
const bez_cmds = {
    1: 'L', 2: 'Q', 3: 'C'
};

export function generatePath(pts, bezDegree, close) {
    const cats = ['M', pts[0].x, ',', pts[0].y];
    let remain = bezDegree;
    let _hasNaN = false;
    for(let i = 1; i < pts.length; ++i) {
        if(isNaN(pts[i].x) || isNaN(pts[i].y))
            _hasNaN = true;
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
  let y = 0;
  const length = arguments.length;

  for (let i = 0; i < length; i++) {
    if (arguments[i] === Infinity || arguments[i] === -Infinity) {
      return Infinity;
    }
    y += arguments[i] * arguments[i];
  }
  return Math.sqrt(y);
};

// outputs the array with adjacent identical lines collapsed to one
export function uniq(a) {
    const ret = [];
    a.forEach((x, i) => {
        if(i === 0 || x !== a[i-1])
            ret.push(x);
    });
    return ret;
}

// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value(predicate) {
     // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      const o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      const len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      const thisArg = arguments[1];

      // 5. Let k be 0.
      let k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, << kValue, k, O >>)).
        // d. If testResult is true, return kValue.
        const kValue = o[k];
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

export const scriptPath = function() {
    let _path;
    return function() {
        if(_path === undefined) {
            _path = null; // only try once
            
            // For ES6 modules, try to use import.meta.url if available
            try {
                if (import.meta && import.meta.url) {
                    const url = new URL(import.meta.url);
                    _path = url.pathname.replace(/[^/]*$/, '');
                    return _path;
                }
            } catch(_e) {
                // fallback to script tag detection
            }
            
            // Fallback: look for script tags
            const scripts = document.getElementsByTagName('script');
            if (scripts && scripts.length > 0) {
                // Try dc-graph.js (ES6 module version)
                for (const i in scripts) {
                    if (scripts[i].src && scripts[i].src.match(/dc-graph\.js$/)) {
                        _path = scripts[i].src.replace(/(.*)dc-graph\.js$/, '$1');
                        break;
                    }
                }
                // Try dc.graph.js (legacy version)
                if(!_path) {
                    for (const i in scripts) {
                        if (scripts[i].src && scripts[i].src.match(/dc\.graph\.js$/)) {
                            _path = scripts[i].src.replace(/(.*)dc\.graph\.js$/, '$1');
                            break;
                        }
                    }
                }
            }
        }
        return _path;
    };
}();

export function eventCoords(diagram, event) {
    const bound = diagram.root().node().getBoundingClientRect();
    return diagram.invertCoord([event.clientX - bound.left,
                              event.clientY - bound.top]);
}

export function promiseIdentity(x) {
    return Promise.resolve(x);
}

// http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
export const is_a_mac = navigator.platform.toUpperCase().indexOf('MAC')!==-1;

// https://stackoverflow.com/questions/16863917/check-if-class-exists-somewhere-in-parent-vanilla-js
export function ancestorHasClass(element, classname) {
    if(select(element).classed(classname))
        return true;
    return element.parentElement && ancestorHasClass(element.parentElement, classname);
}

if (typeof SVGElement.prototype.contains == 'undefined') {
    SVGElement.prototype.contains = HTMLDivElement.prototype.contains;
}
