import { scaleLinear, scaleOrdinal } from 'd3-scale';
import { MarginMixin, utils, pluck, redrawAll, renderAll, registerChart, BadArgumentException } from 'dc';
import * as cola from 'webcola';
import * as dagre from '@dagrejs/dagre';
import * as Viz from '@viz-js/viz';
import { graph_pattern, subgraph_pattern, compose as compose$1, graph_detect, graph } from 'metagraph';
import crossfilter from 'crossfilter2';
import * as graphlibDot from '@dagrejs/graphlib-dot';
import lysenkoIntervalTree from 'interval-tree-1d';
import tippy from 'tippy.js';

var version = "0.9.95";

/**
 * Core utilities and functions for dc.graph.js
 * @module core
 */

const constants$1 = {
    CHART_CLASS: 'dc-graph',
};

function getOriginal(x) {
    return x.orig;
}

function identity$2(x) {
    return x;
}

const property = function(defaultValue, unwrap) {
    if (unwrap === undefined)
        unwrap = getOriginal;
    else if (unwrap === false)
        unwrap = identity$2;
    let value = defaultValue, react = null;
    const cascade = [];
    const ret = function(_) {
        if (!arguments.length) {
            return value;
        }
        if (react)
            react(_);
        value = _;
        return this;
    };
    ret.cascade = function(n, f) {
        for (let i = 0; i < cascade.length; ++i) {
            if (cascade[i].n === n) {
                if (f)
                    cascade[i].f = f;
                else cascade.splice(i, 1);
                return ret;
            } else if (cascade[i].n > n) {
                cascade.splice(i, 0, {n, f});
                return ret;
            }
        }
        cascade.push({n, f});
        return ret;
    };
    ret._eval = function(o, n) {
        if (n === 0 || !cascade.length)
            return functorWrap$1(ret(), unwrap)(o);
        else {
            const last = cascade[n-1];
            return last.f(o, () => ret._eval(o, n-1));
        }
    };
    ret.eval = function(o) {
        return ret._eval(o, cascade.length);
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

function namedChildren() {
    const _children = {};
    const f = function(id, object) {
        if (arguments.length === 1)
            return _children[id];
        if (f.reject) {
            const reject = f.reject(id, object);
            if (reject) {
                console.groupCollapsed(reject);
                console.trace();
                console.groupEnd();
                return this;
            }
        }
        // do not notify unnecessarily
        if (_children[id] === object)
            return this;
        if (_children[id])
            _children[id].parent(null);
        _children[id] = object;
        if (object)
            object.parent(this);
        return this;
    };
    f.enum = function() {
        return Object.keys(_children);
    };
    f.nameOf = function(o) {
        const found = Object.entries(_children).find(kv => kv[1] == o);
        return found ? found[0] : null;
    };
    return f;
}

function deprecatedProperty(message, defaultValue) {
    const prop = property(defaultValue);
    const ret = function() {
        if (arguments.length) {
            console.warn(message);
            prop.apply(property, arguments);
            return this;
        }
        return prop();
    };
    ['cascade', '_eval', 'eval', 'react'].forEach(method => {
        ret[method] = prop[method];
    });
    return ret;
}

function onetimeTrace(level, message) {
    let said = false;
    return function() {
        if (said)
            return;
        if (level === 'trace') ; else
            console[level](message);
        said = true;
    };
}

function deprecationWarning(message) {
    return onetimeTrace('warn', message);
}

function traceFunction(level, message, f) {
    const dep = onetimeTrace(level, message);
    return function() {
        dep();
        return f.apply(this, arguments);
    };
}

function deprecateFunction(message, f) {
    return traceFunction('warn', message, f);
}

// http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

function isIe() {
    const ua = window.navigator.userAgent;

    return (ua.indexOf('MSIE ') > 0
        || ua.indexOf('Trident/') > 0
        || ua.indexOf('Edge/') > 0);
}

function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// polyfill Object.assign for IE
// it's just too useful to do without
if (typeof Object.assign != 'function') {
    // Must be writable: true, enumerable: false, configurable: true
    Object.defineProperty(Object, 'assign', {
        value: function assign(target, _varArgs) { // .length of function is 2
            if (target == null) { // TypeError if undefined or null
                throw new TypeError('Cannot convert undefined or null to object');
            }

            const to = Object(target);

            for (let index = 1; index < arguments.length; index++) {
                const nextSource = arguments[index];

                if (nextSource != null) { // Skip over if undefined or null
                    for (const nextKey in nextSource) {
                        // Avoid bugs when hasOwnProperty is shadowed
                        if (Object.hasOwn(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        },
        writable: true,
        configurable: true,
    });
}

// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
        value(valueToFind, fromIndex) {
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            // 1. Let O be ? ToObject(this value).
            const o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            const len = o.length>>>0;

            // 3. If len is 0, return false.
            if (len === 0) {
                return false;
            }

            // 4. Let n be ? ToInteger(fromIndex).
            //    (If fromIndex is undefined, this step produces the value 0.)
            const n = fromIndex|0;

            // 5. If n >= 0, then
            //  a. Let k be n.
            // 6. Else n < 0,
            //  a. Let k be len + n.
            //  b. If k < 0, let k be 0.
            let k = Math.max(n >= 0 ? n : len-Math.abs(n), 0);

            function sameValueZero(x, y) {
                return x === y
                    || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
            }

            // 7. Repeat, while k < len
            while (k < len) {
                // a. Let elementK be the result of ? Get(O, ! ToString(k)).
                // b. If SameValueZero(valueToFind, elementK) is true, return true.
                if (sameValueZero(o[k], valueToFind)) {
                    return true;
                }
                // c. Increase k by 1.
                k++;
            }

            // 8. Return false
            return false;
        },
    });
}

if (!Object.entries) {
    Object.entries = function(obj) {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i); // preallocate the Array
        while (i--)
            resArray[i] = [ownProps[i], obj[ownProps[i]]];
        return resArray;
    };
}

// https://github.com/KhaledElAnsari/Object.values
Object.values = Object.values ? Object.values : function(obj) {
    const allowedTypes = [
        '[object String]',
        '[object Object]',
        '[object Array]',
        '[object Function]',
    ];
    const objType = Object.prototype.toString.call(obj);

    if (obj === null || typeof obj === 'undefined') {
        throw new TypeError('Cannot convert undefined or null to object');
    } else if (!~allowedTypes.indexOf(objType)) {
        return [];
    } else {
        // if ES6 is supported
        if (Object.keys) {
            return Object.keys(obj).map(key => obj[key]);
        }

        const result = [];
        for (const prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                result.push(obj[prop]);
            }
        }

        return result;
    }
};

function getBBoxNoThrow(elem) {
    // firefox seems to have issues with some of my texts
    // just catch for now
    try {
        return elem.getBBox();
    } catch (_xep) {
        return {x: 0, y: 0, width: 0, height: 0};
    }
}

// version of d3.functor that optionally wraps the function with another
// one, if the parameter is a function
function functorWrap$1(v, wrap) {
    if (typeof v === 'function') {
        return wrap
            ? function(x) {
                return v(wrap(x));
            }
            : v;
    } else return function() {
            return v;
        };
}

function ascending$1(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function bisector(compare) {
  if (compare.length === 1) compare = ascendingComparator(compare);
  return {
    left: function(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    right: function(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) > 0) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    }
  };
}

function ascendingComparator(f) {
  return function(d, x) {
    return ascending$1(f(d), x);
  };
}

bisector(ascending$1);

function extent(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      min,
      max;

  if (valueof == null) {
    while (++i < n) { // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        min = max = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = values[i]) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
          }
        }
      }
    }
  }

  else {
    while (++i < n) { // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = max = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
          }
        }
      }
    }
  }

  return [min, max];
}

function range(start, stop, step) {
  start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;

  var i = -1,
      n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
      range = new Array(n);

  while (++i < n) {
    range[i] = start + i * step;
  }

  return range;
}

function min(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      min;

  if (valueof == null) {
    while (++i < n) { // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        min = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = values[i]) != null && min > value) {
            min = value;
          }
        }
      }
    }
  }

  else {
    while (++i < n) { // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null && min > value) {
            min = value;
          }
        }
      }
    }
  }

  return min;
}

function shuffle(array, i0, i1) {
  var m = (array.length ) - (i0 = i0 == null ? 0 : +i0),
      t,
      i;

  while (m) {
    i = Math.random() * m-- | 0;
    t = array[m + i0];
    array[m + i0] = array[i + i0];
    array[i + i0] = t;
  }

  return array;
}

function sum(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      sum = 0;

  if (valueof == null) {
    while (++i < n) {
      if (value = +values[i]) sum += value; // Note: zero and null are equivalent.
    }
  }

  else {
    while (++i < n) {
      if (value = +valueof(values[i], i, values)) sum += value;
    }
  }

  return sum;
}

var prefix = "$";

function Map$1() {}

Map$1.prototype = map.prototype = {
  constructor: Map$1,
  has: function(key) {
    return (prefix + key) in this;
  },
  get: function(key) {
    return this[prefix + key];
  },
  set: function(key, value) {
    this[prefix + key] = value;
    return this;
  },
  remove: function(key) {
    var property = prefix + key;
    return property in this && delete this[property];
  },
  clear: function() {
    for (var property in this) if (property[0] === prefix) delete this[property];
  },
  keys: function() {
    var keys = [];
    for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
    return keys;
  },
  values: function() {
    var values = [];
    for (var property in this) if (property[0] === prefix) values.push(this[property]);
    return values;
  },
  entries: function() {
    var entries = [];
    for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
    return entries;
  },
  size: function() {
    var size = 0;
    for (var property in this) if (property[0] === prefix) ++size;
    return size;
  },
  empty: function() {
    for (var property in this) if (property[0] === prefix) return false;
    return true;
  },
  each: function(f) {
    for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
  }
};

function map(object, f) {
  var map = new Map$1;

  // Copy constructor.
  if (object instanceof Map$1) object.each(function(value, key) { map.set(key, value); });

  // Index array by numeric index or specified key function.
  else if (Array.isArray(object)) {
    var i = -1,
        n = object.length,
        o;

    if (f == null) while (++i < n) map.set(i, object[i]);
    else while (++i < n) map.set(f(o = object[i], i, object), o);
  }

  // Convert object to map.
  else if (object) for (var key in object) map.set(key, object[key]);

  return map;
}

function Set$1() {}

var proto = map.prototype;

Set$1.prototype = set$2.prototype = {
  constructor: Set$1,
  has: proto.has,
  add: function(value) {
    value += "";
    this[prefix + value] = value;
    return this;
  },
  remove: proto.remove,
  clear: proto.clear,
  values: proto.keys,
  size: proto.size,
  empty: proto.empty,
  each: proto.each
};

function set$2(object, f) {
  var set = new Set$1;

  // Copy constructor.
  if (object instanceof Set$1) object.each(function(value) { set.add(value); });

  // Otherwise, assume it’s an array.
  else if (object) {
    var i = -1, n = object.length;
    if (f == null) while (++i < n) set.add(object[i]);
    else while (++i < n) set.add(f(object[i], i, object));
  }

  return set;
}

var noop$1 = {value: function() {}};

function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}

function Dispatch(_) {
  this._ = _;
}

function parseTypenames$1(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return {type: t, name: name};
  });
}

Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._,
        T = parseTypenames$1(typename + "", _),
        t,
        i = -1,
        n = T.length;

    // If no callback was specified, return the callback of the given type and name.
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
      return;
    }

    // If a type was specified, set the callback for the given type and name.
    // Otherwise, if a null callback was specified, remove callbacks of the given name.
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
    }

    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};

function get$1(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}

function set$1(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop$1, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({name: name, value: callback});
  return type;
}

var xhtml = "http://www.w3.org/1999/xhtml";

var namespaces = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

function namespace(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
}

function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}

function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}

function creator(name) {
  var fullname = namespace(name);
  return (fullname.local
      ? creatorFixed
      : creatorInherit)(fullname);
}

function none() {}

function selector(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

function selection_select(select) {
  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }

  return new Selection$1(subgroups, this._parents);
}

function empty$1() {
  return [];
}

function selectorAll(selector) {
  return selector == null ? empty$1 : function() {
    return this.querySelectorAll(selector);
  };
}

function selection_selectAll(select) {
  if (typeof select !== "function") select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }

  return new Selection$1(subgroups, parents);
}

var matcher = function(selector) {
  return function() {
    return this.matches(selector);
  };
};

if (typeof document !== "undefined") {
  var element$1 = document.documentElement;
  if (!element$1.matches) {
    var vendorMatches = element$1.webkitMatchesSelector
        || element$1.msMatchesSelector
        || element$1.mozMatchesSelector
        || element$1.oMatchesSelector;
    matcher = function(selector) {
      return function() {
        return vendorMatches.call(this, selector);
      };
    };
  }
}

var matcher$1 = matcher;

function selection_filter(match) {
  if (typeof match !== "function") match = matcher$1(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Selection$1(subgroups, this._parents);
}

function sparse(update) {
  return new Array(update.length);
}

function selection_enter() {
  return new Selection$1(this._enter || this._groups.map(sparse), this._parents);
}

function EnterNode(parent, datum) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum;
}

EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
  insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
  querySelector: function(selector) { return this._parent.querySelector(selector); },
  querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
};

function constant$5(x) {
  return function() {
    return x;
  };
}

var keyPrefix = "$"; // Protect against keys like “__proto__”.

function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0,
      node,
      groupLength = group.length,
      dataLength = data.length;

  // Put any non-null nodes that fit into update.
  // Put any null nodes into enter.
  // Put any remaining data into enter.
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Put any non-null nodes that don’t fit into exit.
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}

function bindKey(parent, group, enter, update, exit, data, key) {
  var i,
      node,
      nodeByKeyValue = {},
      groupLength = group.length,
      dataLength = data.length,
      keyValues = new Array(groupLength),
      keyValue;

  // Compute the key for each node.
  // If multiple nodes have the same key, the duplicates are added to exit.
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
      if (keyValue in nodeByKeyValue) {
        exit[i] = node;
      } else {
        nodeByKeyValue[keyValue] = node;
      }
    }
  }

  // Compute the key for each datum.
  // If there a node associated with this key, join and add it to update.
  // If there is not (or the key is a duplicate), add it to enter.
  for (i = 0; i < dataLength; ++i) {
    keyValue = keyPrefix + key.call(parent, data[i], i, data);
    if (node = nodeByKeyValue[keyValue]) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue[keyValue] = null;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Add any remaining nodes that were not bound to data to exit.
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
      exit[i] = node;
    }
  }
}

function selection_data(value, key) {
  if (!value) {
    data = new Array(this.size()), j = -1;
    this.each(function(d) { data[++j] = d; });
    return data;
  }

  var bind = key ? bindKey : bindIndex,
      parents = this._parents,
      groups = this._groups;

  if (typeof value !== "function") value = constant$5(value);

  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j],
        group = groups[j],
        groupLength = group.length,
        data = value.call(parent, parent && parent.__data__, j, parents),
        dataLength = data.length,
        enterGroup = enter[j] = new Array(dataLength),
        updateGroup = update[j] = new Array(dataLength),
        exitGroup = exit[j] = new Array(groupLength);

    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

    // Now connect the enter nodes to their following update node, such that
    // appendChild can insert the materialized enter node before this node,
    // rather than at the end of the parent node.
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength);
        previous._next = next || null;
      }
    }
  }

  update = new Selection$1(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}

function selection_exit() {
  return new Selection$1(this._exit || this._groups.map(sparse), this._parents);
}

function selection_merge(selection) {

  for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Selection$1(merges, this._parents);
}

function selection_order() {

  for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
      if (node = group[i]) {
        if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }

  return this;
}

function selection_sort(compare) {
  if (!compare) compare = ascending;

  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }

  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }

  return new Selection$1(sortgroups, this._parents).order();
}

function ascending(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function selection_call() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

function selection_nodes() {
  var nodes = new Array(this.size()), i = -1;
  this.each(function() { nodes[++i] = this; });
  return nodes;
}

function selection_node() {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }

  return null;
}

function selection_size() {
  var size = 0;
  this.each(function() { ++size; });
  return size;
}

function selection_empty() {
  return !this.node();
}

function selection_each(callback) {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }

  return this;
}

function attrRemove$1(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS$1(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant$1(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}

function attrConstantNS$1(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}

function attrFunction$1(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}

function attrFunctionNS$1(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}

function selection_attr(name, value) {
  var fullname = namespace(name);

  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local
        ? node.getAttributeNS(fullname.space, fullname.local)
        : node.getAttribute(fullname);
  }

  return this.each((value == null
      ? (fullname.local ? attrRemoveNS$1 : attrRemove$1) : (typeof value === "function"
      ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)
      : (fullname.local ? attrConstantNS$1 : attrConstant$1)))(fullname, value));
}

function defaultView(node) {
  return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
      || (node.document && node) // node is a Window
      || node.defaultView; // node is a Document
}

function styleRemove$1(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant$1(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}

function styleFunction$1(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}

function selection_style(name, value, priority) {
  return arguments.length > 1
      ? this.each((value == null
            ? styleRemove$1 : typeof value === "function"
            ? styleFunction$1
            : styleConstant$1)(name, value, priority == null ? "" : priority))
      : styleValue(this.node(), name);
}

function styleValue(node, name) {
  return node.style.getPropertyValue(name)
      || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
}

function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}

function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}

function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}

function selection_property(name, value) {
  return arguments.length > 1
      ? this.each((value == null
          ? propertyRemove : typeof value === "function"
          ? propertyFunction
          : propertyConstant)(name, value))
      : this.node()[name];
}

function classArray(string) {
  return string.trim().split(/^|\s+/);
}

function classList(node) {
  return node.classList || new ClassList(node);
}

function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}

ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};

function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}

function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}

function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}

function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}

function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}

function selection_classed(name, value) {
  var names = classArray(name + "");

  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }

  return this.each((typeof value === "function"
      ? classedFunction : value
      ? classedTrue
      : classedFalse)(names, value));
}

function textRemove() {
  this.textContent = "";
}

function textConstant$1(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction$1(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}

function selection_text(value) {
  return arguments.length
      ? this.each(value == null
          ? textRemove : (typeof value === "function"
          ? textFunction$1
          : textConstant$1)(value))
      : this.node().textContent;
}

function htmlRemove() {
  this.innerHTML = "";
}

function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}

function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}

function selection_html(value) {
  return arguments.length
      ? this.each(value == null
          ? htmlRemove : (typeof value === "function"
          ? htmlFunction
          : htmlConstant)(value))
      : this.node().innerHTML;
}

function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}

function selection_raise() {
  return this.each(raise);
}

function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}

function selection_lower() {
  return this.each(lower);
}

function selection_append(name) {
  var create = typeof name === "function" ? name : creator(name);
  return this.select(function() {
    return this.appendChild(create.apply(this, arguments));
  });
}

function constantNull() {
  return null;
}

function selection_insert(name, before) {
  var create = typeof name === "function" ? name : creator(name),
      select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
  return this.select(function() {
    return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}

function selection_remove() {
  return this.each(remove);
}

function selection_cloneShallow() {
  return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
}

function selection_cloneDeep() {
  return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
}

function selection_clone(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

function selection_datum(value) {
  return arguments.length
      ? this.property("__data__", value)
      : this.node().__data__;
}

var filterEvents = {};

var event = null;

if (typeof document !== "undefined") {
  var element = document.documentElement;
  if (!("onmouseenter" in element)) {
    filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
  }
}

function filterContextListener(listener, index, group) {
  listener = contextListener(listener, index, group);
  return function(event) {
    var related = event.relatedTarget;
    if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
      listener.call(this, event);
    }
  };
}

function contextListener(listener, index, group) {
  return function(event1) {
    var event0 = event; // Events can be reentrant (e.g., focus).
    event = event1;
    try {
      listener.call(this, this.__data__, index, group);
    } finally {
      event = event0;
    }
  };
}

function parseTypenames(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return {type: t, name: name};
  });
}

function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.capture);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}

function onAdd(typename, value, capture) {
  var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
  return function(d, i, group) {
    var on = this.__on, o, listener = wrap(value, i, group);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.capture);
        this.addEventListener(o.type, o.listener = listener, o.capture = capture);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, capture);
    o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
    if (!on) this.__on = [o];
    else on.push(o);
  };
}

function selection_on(typename, value, capture) {
  var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }

  on = value ? onAdd : onRemove;
  if (capture == null) capture = false;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
  return this;
}

function customEvent(event1, listener, that, args) {
  var event0 = event;
  event1.sourceEvent = event;
  event = event1;
  try {
    return listener.apply(that, args);
  } finally {
    event = event0;
  }
}

function dispatchEvent(node, type, params) {
  var window = defaultView(node),
      event = window.CustomEvent;

  if (typeof event === "function") {
    event = new event(type, params);
  } else {
    event = window.document.createEvent("Event");
    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type, false, false);
  }

  node.dispatchEvent(event);
}

function dispatchConstant(type, params) {
  return function() {
    return dispatchEvent(this, type, params);
  };
}

function dispatchFunction(type, params) {
  return function() {
    return dispatchEvent(this, type, params.apply(this, arguments));
  };
}

function selection_dispatch(type, params) {
  return this.each((typeof params === "function"
      ? dispatchFunction
      : dispatchConstant)(type, params));
}

var root = [null];

function Selection$1(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}

function selection() {
  return new Selection$1([[document.documentElement]], root);
}

Selection$1.prototype = selection.prototype = {
  constructor: Selection$1,
  select: selection_select,
  selectAll: selection_selectAll,
  filter: selection_filter,
  data: selection_data,
  enter: selection_enter,
  exit: selection_exit,
  merge: selection_merge,
  order: selection_order,
  sort: selection_sort,
  call: selection_call,
  nodes: selection_nodes,
  node: selection_node,
  size: selection_size,
  empty: selection_empty,
  each: selection_each,
  attr: selection_attr,
  style: selection_style,
  property: selection_property,
  classed: selection_classed,
  text: selection_text,
  html: selection_html,
  raise: selection_raise,
  lower: selection_lower,
  append: selection_append,
  insert: selection_insert,
  remove: selection_remove,
  clone: selection_clone,
  datum: selection_datum,
  on: selection_on,
  dispatch: selection_dispatch
};

function select(selector) {
  return typeof selector === "string"
      ? new Selection$1([[document.querySelector(selector)]], [document.documentElement])
      : new Selection$1([[selector]], root);
}

var nextId = 0;

function Local() {
  this._ = "@" + (++nextId).toString(36);
}

Local.prototype = {
  constructor: Local,
  get: function(node) {
    var id = this._;
    while (!(id in node)) if (!(node = node.parentNode)) return;
    return node[id];
  },
  set: function(node, value) {
    return node[this._] = value;
  },
  remove: function(node) {
    return this._ in node && delete node[this._];
  },
  toString: function() {
    return this._;
  }
};

function sourceEvent() {
  var current = event, source;
  while (source = current.sourceEvent) current = source;
  return current;
}

function point$4(node, event) {
  var svg = node.ownerSVGElement || node;

  if (svg.createSVGPoint) {
    var point = svg.createSVGPoint();
    point.x = event.clientX, point.y = event.clientY;
    point = point.matrixTransform(node.getScreenCTM().inverse());
    return [point.x, point.y];
  }

  var rect = node.getBoundingClientRect();
  return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
}

function mouse(node) {
  var event = sourceEvent();
  if (event.changedTouches) event = event.changedTouches[0];
  return point$4(node, event);
}

function selectAll(selector) {
  return typeof selector === "string"
      ? new Selection$1([document.querySelectorAll(selector)], [document.documentElement])
      : new Selection$1([selector], root);
}

function touch(node, touches, identifier) {
  if (arguments.length < 3) identifier = touches, touches = sourceEvent().changedTouches;

  for (var i = 0, n = touches ? touches.length : 0, touch; i < n; ++i) {
    if ((touch = touches[i]).identifier === identifier) {
      return point$4(node, touch);
    }
  }

  return null;
}

function noevent$2() {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function dragDisable(view) {
  var root = view.document.documentElement,
      selection = select(view).on("dragstart.drag", noevent$2, true);
  if ("onselectstart" in root) {
    selection.on("selectstart.drag", noevent$2, true);
  } else {
    root.__noselect = root.style.MozUserSelect;
    root.style.MozUserSelect = "none";
  }
}

function yesdrag(view, noclick) {
  var root = view.document.documentElement,
      selection = select(view).on("dragstart.drag", null);
  if (noclick) {
    selection.on("click.drag", noevent$2, true);
    setTimeout(function() { selection.on("click.drag", null); }, 0);
  }
  if ("onselectstart" in root) {
    selection.on("selectstart.drag", null);
  } else {
    root.style.MozUserSelect = root.__noselect;
    delete root.__noselect;
  }
}

function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex3 = /^#([0-9a-f]{3})$/,
    reHex6 = /^#([0-9a-f]{6})$/,
    reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
    reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
    reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
    reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
    reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
    reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color, {
  displayable: function() {
    return this.rgb().displayable();
  },
  toString: function() {
    return this.rgb() + "";
  }
});

function color(format) {
  var m;
  format = (format + "").trim().toLowerCase();
  return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
      : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format])
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb, extend(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb: function() {
    return this;
  },
  displayable: function() {
    return (0 <= this.r && this.r <= 255)
        && (0 <= this.g && this.g <= 255)
        && (0 <= this.b && this.b <= 255)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  toString: function() {
    var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (a === 1 ? "rgb(" : "rgba(")
        + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.b) || 0))
        + (a === 1 ? ")" : ", " + a + ")");
  }
}));

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  displayable: function() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  }
}));

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

var deg2rad = Math.PI / 180;
var rad2deg = 180 / Math.PI;

var Kn = 18,
    Xn = 0.950470, // D65 standard referent
    Yn = 1,
    Zn = 1.088830,
    t0 = 4 / 29,
    t1 = 6 / 29,
    t2 = 3 * t1 * t1,
    t3 = t1 * t1 * t1;

function labConvert(o) {
  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
  if (o instanceof Hcl) {
    var h = o.h * deg2rad;
    return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
  }
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var b = rgb2xyz(o.r),
      a = rgb2xyz(o.g),
      l = rgb2xyz(o.b),
      x = xyz2lab((0.4124564 * b + 0.3575761 * a + 0.1804375 * l) / Xn),
      y = xyz2lab((0.2126729 * b + 0.7151522 * a + 0.0721750 * l) / Yn),
      z = xyz2lab((0.0193339 * b + 0.1191920 * a + 0.9503041 * l) / Zn);
  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
}

function lab(l, a, b, opacity) {
  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
}

function Lab(l, a, b, opacity) {
  this.l = +l;
  this.a = +a;
  this.b = +b;
  this.opacity = +opacity;
}

define(Lab, lab, extend(Color, {
  brighter: function(k) {
    return new Lab(this.l + Kn * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  darker: function(k) {
    return new Lab(this.l - Kn * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  rgb: function() {
    var y = (this.l + 16) / 116,
        x = isNaN(this.a) ? y : y + this.a / 500,
        z = isNaN(this.b) ? y : y - this.b / 200;
    y = Yn * lab2xyz(y);
    x = Xn * lab2xyz(x);
    z = Zn * lab2xyz(z);
    return new Rgb(
      xyz2rgb( 3.2404542 * x - 1.5371385 * y - 0.4985314 * z), // D65 -> sRGB
      xyz2rgb(-0.969266 * x + 1.8760108 * y + 0.0415560 * z),
      xyz2rgb( 0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
      this.opacity
    );
  }
}));

function xyz2lab(t) {
  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
}

function lab2xyz(t) {
  return t > t1 ? t * t * t : t2 * (t - t0);
}

function xyz2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function rgb2xyz(x) {
  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function hclConvert(o) {
  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
  if (!(o instanceof Lab)) o = labConvert(o);
  var h = Math.atan2(o.b, o.a) * rad2deg;
  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}

function hcl(h, c, l, opacity) {
  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}

function Hcl(h, c, l, opacity) {
  this.h = +h;
  this.c = +c;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hcl, hcl, extend(Color, {
  brighter: function(k) {
    return new Hcl(this.h, this.c, this.l + Kn * (k == null ? 1 : k), this.opacity);
  },
  darker: function(k) {
    return new Hcl(this.h, this.c, this.l - Kn * (k == null ? 1 : k), this.opacity);
  },
  rgb: function() {
    return labConvert(this).rgb();
  }
}));

var A = -0.14861,
    B = 1.78277,
    C = -0.29227,
    D = -0.90649,
    E = 1.97294,
    ED = E * D,
    EB = E * B,
    BC_DA = B * C - D * A;

function cubehelixConvert(o) {
  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
      bl = b - l,
      k = (E * (g - l) - C * bl) / D,
      s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
      h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
}

function cubehelix$1(h, s, l, opacity) {
  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
}

function Cubehelix(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Cubehelix, cubehelix$1, extend(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function() {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
        l = +this.l,
        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
        cosh = Math.cos(h),
        sinh = Math.sin(h);
    return new Rgb(
      255 * (l + a * (A * cosh + B * sinh)),
      255 * (l + a * (C * cosh + D * sinh)),
      255 * (l + a * (E * cosh)),
      this.opacity
    );
  }
}));

function constant$4(x) {
  return function() {
    return x;
  };
}

function linear(a, d) {
  return function(t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}

function hue(a, b) {
  var d = b - a;
  return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$4(isNaN(a) ? b : a);
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant$4(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : constant$4(isNaN(a) ? b : a);
}

var interpolateRgb = (function rgbGamma(y) {
  var color = gamma(y);

  function rgb$1(start, end) {
    var r = color((start = rgb(start)).r, (end = rgb(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb$1.gamma = rgbGamma;

  return rgb$1;
})(1);

function array(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = interpolate$1(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];

  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

function date(a, b) {
  var d = new Date;
  return a = +a, b -= a, function(t) {
    return d.setTime(a + b * t), d;
  };
}

function interpolateNumber(a, b) {
  return a = +a, b -= a, function(t) {
    return a + b * t;
  };
}

function object(a, b) {
  var i = {},
      c = {},
      k;

  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = interpolate$1(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero(b) {
  return function() {
    return b;
  };
}

function one(b) {
  return function(t) {
    return b(t) + "";
  };
}

function interpolateString(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
      am, // current match in a
      bm, // current match in b
      bs, // string preceding current number in b, if any
      i = -1, // index in s
      s = [], // string constants and placeholders
      q = []; // number interpolators

  // Coerce inputs to strings.
  a = a + "", b = b + "";

  // Interpolate pairs of numbers in a & b.
  while ((am = reA.exec(a))
      && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) { // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else { // interpolate non-matching numbers
      s[++i] = null;
      q.push({i: i, x: interpolateNumber(am, bm)});
    }
    bi = reB.lastIndex;
  }

  // Add remains of b.
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  }

  // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.
  return s.length < 2 ? (q[0]
      ? one(q[0].x)
      : zero(b))
      : (b = q.length, function(t) {
          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
          return s.join("");
        });
}

function interpolate$1(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant$4(b)
      : (t === "number" ? interpolateNumber
      : t === "string" ? ((c = color(b)) ? (b = c, interpolateRgb) : interpolateString)
      : b instanceof color ? interpolateRgb
      : b instanceof Date ? date
      : Array.isArray(b) ? array
      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
      : interpolateNumber)(a, b);
}

var degrees = 180 / Math.PI;

var identity$1 = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};

function decompose(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX: scaleX,
    scaleY: scaleY
  };
}

var cssNode,
    cssRoot,
    cssView,
    svgNode;

function parseCss(value) {
  if (value === "none") return identity$1;
  if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
  cssNode.style.transform = value;
  value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
  cssRoot.removeChild(cssNode);
  value = value.slice(7, -1).split(",");
  return decompose(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
}

function parseSvg(value) {
  if (value == null) return identity$1;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity$1;
  value = value.matrix;
  return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
}

function interpolateTransform(parse, pxComma, pxParen, degParen) {

  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }

  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }

  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
      q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: interpolateNumber(a, b)});
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }

  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: interpolateNumber(a, b)});
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }

  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }

  return function(a, b) {
    var s = [], // string constants and placeholders
        q = []; // number interpolators
    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null; // gc
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}

var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

var rho = Math.SQRT2,
    rho2 = 2,
    rho4 = 4,
    epsilon2 = 1e-12;

function cosh(x) {
  return ((x = Math.exp(x)) + 1 / x) / 2;
}

function sinh(x) {
  return ((x = Math.exp(x)) - 1 / x) / 2;
}

function tanh(x) {
  return ((x = Math.exp(2 * x)) - 1) / (x + 1);
}

// p0 = [ux0, uy0, w0]
// p1 = [ux1, uy1, w1]
function interpolateZoom(p0, p1) {
  var ux0 = p0[0], uy0 = p0[1], w0 = p0[2],
      ux1 = p1[0], uy1 = p1[1], w1 = p1[2],
      dx = ux1 - ux0,
      dy = uy1 - uy0,
      d2 = dx * dx + dy * dy,
      i,
      S;

  // Special case for u0 ≅ u1.
  if (d2 < epsilon2) {
    S = Math.log(w1 / w0) / rho;
    i = function(t) {
      return [
        ux0 + t * dx,
        uy0 + t * dy,
        w0 * Math.exp(rho * t * S)
      ];
    };
  }

  // General case.
  else {
    var d1 = Math.sqrt(d2),
        b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
        b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
        r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
        r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / rho;
    i = function(t) {
      var s = t * S,
          coshr0 = cosh(r0),
          u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
      return [
        ux0 + u * dx,
        uy0 + u * dy,
        w0 * coshr0 / cosh(rho * s + r0)
      ];
    };
  }

  i.duration = S * 1000;

  return i;
}

function cubehelix(hue) {
  return (function cubehelixGamma(y) {
    y = +y;

    function cubehelix(start, end) {
      var h = hue((start = cubehelix$1(start)).h, (end = cubehelix$1(end)).h),
          s = nogamma(start.s, end.s),
          l = nogamma(start.l, end.l),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.h = h(t);
        start.s = s(t);
        start.l = l(Math.pow(t, y));
        start.opacity = opacity(t);
        return start + "";
      };
    }

    cubehelix.gamma = cubehelixGamma;

    return cubehelix;
  })(1);
}

cubehelix(hue);
cubehelix(nogamma);

var frame = 0, // is an animation frame pending?
    timeout$1 = 0, // is a timeout pending?
    interval = 0, // are any timers active?
    pokeDelay = 1000, // how frequently we check for clock skew
    taskHead,
    taskTail,
    clockLast = 0,
    clockNow = 0,
    clockSkew = 0,
    clock = typeof performance === "object" && performance.now ? performance : Date,
    setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}

function clearNow() {
  clockNow = 0;
}

function Timer() {
  this._call =
  this._time =
  this._next = null;
}

Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};

function timer(callback, delay, time) {
  var t = new Timer;
  t.restart(callback, delay, time);
  return t;
}

function timerFlush() {
  now(); // Get the current time, if not already set.
  ++frame; // Pretend we’ve set an alarm, if we haven’t already.
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
    t = t._next;
  }
  --frame;
}

function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout$1 = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}

function poke() {
  var now = clock.now(), delay = now - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}

function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}

function sleep(time) {
  if (frame) return; // Soonest alarm already set, or will be.
  if (timeout$1) timeout$1 = clearTimeout(timeout$1);
  var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
  if (delay > 24) {
    if (time < Infinity) timeout$1 = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

function timeout(callback, delay, time) {
  var t = new Timer;
  delay = delay == null ? 0 : +delay;
  t.restart(function(elapsed) {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

var emptyOn = dispatch("start", "end", "interrupt");
var emptyTween = [];

var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;

function schedule(node, name, id, index, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id in schedules) return;
  create(node, id, {
    name: name,
    index: index, // For context during callback.
    group: group, // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}

function init(node, id) {
  var schedule = get(node, id);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}

function set(node, id) {
  var schedule = get(node, id);
  if (schedule.state > STARTING) throw new Error("too late; already started");
  return schedule;
}

function get(node, id) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
  return schedule;
}

function create(node, id, self) {
  var schedules = node.__transition,
      tween;

  // Initialize the self timer when the transition is created.
  // Note the actual delay is not known until the first callback!
  schedules[id] = self;
  self.timer = timer(schedule, 0, self.time);

  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start, self.delay, self.time);

    // If the elapsed delay is less than our first sleep, start immediately.
    if (self.delay <= elapsed) start(elapsed - self.delay);
  }

  function start(elapsed) {
    var i, j, n, o;

    // If the state is not SCHEDULED, then we previously errored on start.
    if (self.state !== SCHEDULED) return stop();

    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;

      // While this element already has a starting transition during this frame,
      // defer starting an interrupting transition until that transition has a
      // chance to tick (and possibly end); see d3/d3-transition#54!
      if (o.state === STARTED) return timeout(start);

      // Interrupt the active transition, if any.
      // Dispatch the interrupt event.
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }

      // Cancel any pre-empted transitions. No interrupt event is dispatched
      // because the cancelled transitions never started. Note that this also
      // removes this transition from the pending list!
      else if (+i < id) {
        o.state = ENDED;
        o.timer.stop();
        delete schedules[i];
      }
    }

    // Defer the first tick to end of the current frame; see d3/d3#1576.
    // Note the transition may be canceled after start and before the first tick!
    // Note this must be scheduled before the start event; see d3/d3-transition#16!
    // Assuming this is successful, subsequent callbacks go straight to tick.
    timeout(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });

    // Dispatch the start event.
    // Note this must be done before the tween are initialized.
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return; // interrupted
    self.state = STARTED;

    // Initialize the tween, deleting null tween.
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }

  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
        i = -1,
        n = tween.length;

    while (++i < n) {
      tween[i].call(null, t);
    }

    // Dispatch the end event.
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }

  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id];
    for (var i in schedules) return; // eslint-disable-line no-unused-vars
    delete node.__transition;
  }
}

function interrupt(node, name) {
  var schedules = node.__transition,
      schedule,
      active,
      empty = true,
      i;

  if (!schedules) return;

  name = name == null ? null : name + "";

  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    if (active) schedule.on.call("interrupt", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }

  if (empty) delete node.__transition;
}

function selection_interrupt(name) {
  return this.each(function() {
    interrupt(this, name);
  });
}

function tweenRemove(id, name) {
  var tween0, tween1;
  return function() {
    var schedule = set(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }

    schedule.tween = tween1;
  };
}

function tweenFunction(id, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error;
  return function() {
    var schedule = set(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }

    schedule.tween = tween1;
  };
}

function transition_tween(name, value) {
  var id = this._id;

  name += "";

  if (arguments.length < 2) {
    var tween = get(this.node(), id).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }

  return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
}

function tweenValue(transition, name, value) {
  var id = transition._id;

  transition.each(function() {
    var schedule = set(this, id);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });

  return function(node) {
    return get(node, id).value[name];
  };
}

function interpolate(a, b) {
  var c;
  return (typeof b === "number" ? interpolateNumber
      : b instanceof color ? interpolateRgb
      : (c = color(b)) ? (b = c, interpolateRgb)
      : interpolateString)(a, b);
}

function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant(name, interpolate, value1) {
  var value00,
      interpolate0;
  return function() {
    var value0 = this.getAttribute(name);
    return value0 === value1 ? null
        : value0 === value00 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value1);
  };
}

function attrConstantNS(fullname, interpolate, value1) {
  var value00,
      interpolate0;
  return function() {
    var value0 = this.getAttributeNS(fullname.space, fullname.local);
    return value0 === value1 ? null
        : value0 === value00 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value1);
  };
}

function attrFunction(name, interpolate, value) {
  var value00,
      value10,
      interpolate0;
  return function() {
    var value0, value1 = value(this);
    if (value1 == null) return void this.removeAttribute(name);
    value0 = this.getAttribute(name);
    return value0 === value1 ? null
        : value0 === value00 && value1 === value10 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value10 = value1);
  };
}

function attrFunctionNS(fullname, interpolate, value) {
  var value00,
      value10,
      interpolate0;
  return function() {
    var value0, value1 = value(this);
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    value0 = this.getAttributeNS(fullname.space, fullname.local);
    return value0 === value1 ? null
        : value0 === value00 && value1 === value10 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value10 = value1);
  };
}

function transition_attr(name, value) {
  var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
  return this.attrTween(name, typeof value === "function"
      ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value))
      : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname)
      : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value + ""));
}

function attrTweenNS(fullname, value) {
  function tween() {
    var node = this, i = value.apply(node, arguments);
    return i && function(t) {
      node.setAttributeNS(fullname.space, fullname.local, i(t));
    };
  }
  tween._value = value;
  return tween;
}

function attrTween(name, value) {
  function tween() {
    var node = this, i = value.apply(node, arguments);
    return i && function(t) {
      node.setAttribute(name, i(t));
    };
  }
  tween._value = value;
  return tween;
}

function transition_attrTween(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  var fullname = namespace(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

function delayFunction(id, value) {
  return function() {
    init(this, id).delay = +value.apply(this, arguments);
  };
}

function delayConstant(id, value) {
  return value = +value, function() {
    init(this, id).delay = value;
  };
}

function transition_delay(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? delayFunction
          : delayConstant)(id, value))
      : get(this.node(), id).delay;
}

function durationFunction(id, value) {
  return function() {
    set(this, id).duration = +value.apply(this, arguments);
  };
}

function durationConstant(id, value) {
  return value = +value, function() {
    set(this, id).duration = value;
  };
}

function transition_duration(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? durationFunction
          : durationConstant)(id, value))
      : get(this.node(), id).duration;
}

function easeConstant(id, value) {
  if (typeof value !== "function") throw new Error;
  return function() {
    set(this, id).ease = value;
  };
}

function transition_ease(value) {
  var id = this._id;

  return arguments.length
      ? this.each(easeConstant(id, value))
      : get(this.node(), id).ease;
}

function transition_filter(match) {
  if (typeof match !== "function") match = matcher$1(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Transition(subgroups, this._parents, this._name, this._id);
}

function transition_merge(transition) {
  if (transition._id !== this._id) throw new Error;

  for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Transition(merges, this._parents, this._name, this._id);
}

function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}

function onFunction(id, name, listener) {
  var on0, on1, sit = start(name) ? init : set;
  return function() {
    var schedule = sit(this, id),
        on = schedule.on;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

    schedule.on = on1;
  };
}

function transition_on(name, listener) {
  var id = this._id;

  return arguments.length < 2
      ? get(this.node(), id).on.on(name)
      : this.each(onFunction(id, name, listener));
}

function removeFunction(id) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id) return;
    if (parent) parent.removeChild(this);
  };
}

function transition_remove() {
  return this.on("end.remove", removeFunction(this._id));
}

function transition_select(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule(subgroup[i], name, id, i, subgroup, get(node, id));
      }
    }
  }

  return new Transition(subgroups, this._parents, name, id);
}

function transition_selectAll(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) {
          if (child = children[k]) {
            schedule(child, name, id, k, children, inherit);
          }
        }
        subgroups.push(children);
        parents.push(node);
      }
    }
  }

  return new Transition(subgroups, parents, name, id);
}

var Selection = selection.prototype.constructor;

function transition_selection() {
  return new Selection(this._groups, this._parents);
}

function styleRemove(name, interpolate) {
  var value00,
      value10,
      interpolate0;
  return function() {
    var value0 = styleValue(this, name),
        value1 = (this.style.removeProperty(name), styleValue(this, name));
    return value0 === value1 ? null
        : value0 === value00 && value1 === value10 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value10 = value1);
  };
}

function styleRemoveEnd(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant(name, interpolate, value1) {
  var value00,
      interpolate0;
  return function() {
    var value0 = styleValue(this, name);
    return value0 === value1 ? null
        : value0 === value00 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value1);
  };
}

function styleFunction(name, interpolate, value) {
  var value00,
      value10,
      interpolate0;
  return function() {
    var value0 = styleValue(this, name),
        value1 = value(this);
    if (value1 == null) value1 = (this.style.removeProperty(name), styleValue(this, name));
    return value0 === value1 ? null
        : value0 === value00 && value1 === value10 ? interpolate0
        : interpolate0 = interpolate(value00 = value0, value10 = value1);
  };
}

function transition_style(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
  return value == null ? this
          .styleTween(name, styleRemove(name, i))
          .on("end.style." + name, styleRemoveEnd(name))
      : this.styleTween(name, typeof value === "function"
          ? styleFunction(name, i, tweenValue(this, "style." + name, value))
          : styleConstant(name, i, value + ""), priority);
}

function styleTween(name, value, priority) {
  function tween() {
    var node = this, i = value.apply(node, arguments);
    return i && function(t) {
      node.style.setProperty(name, i(t), priority);
    };
  }
  tween._value = value;
  return tween;
}

function transition_styleTween(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}

function transition_text(value) {
  return this.tween("text", typeof value === "function"
      ? textFunction(tweenValue(this, "text", value))
      : textConstant(value == null ? "" : value + ""));
}

function transition_transition() {
  var name = this._name,
      id0 = this._id,
      id1 = newId();

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit = get(node, id0);
        schedule(node, name, id1, i, group, {
          time: inherit.time + inherit.delay + inherit.duration,
          delay: 0,
          duration: inherit.duration,
          ease: inherit.ease
        });
      }
    }
  }

  return new Transition(groups, this._parents, name, id1);
}

var id = 0;

function Transition(groups, parents, name, id) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id;
}

function newId() {
  return ++id;
}

var selection_prototype = selection.prototype;

Transition.prototype = {
  constructor: Transition,
  select: transition_select,
  selectAll: transition_selectAll,
  filter: transition_filter,
  merge: transition_merge,
  selection: transition_selection,
  transition: transition_transition,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: transition_on,
  attr: transition_attr,
  attrTween: transition_attrTween,
  style: transition_style,
  styleTween: transition_styleTween,
  text: transition_text,
  remove: transition_remove,
  tween: transition_tween,
  delay: transition_delay,
  duration: transition_duration,
  ease: transition_ease
};

function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

var exponent = 3;

((function custom(e) {
  e = +e;

  function polyIn(t) {
    return Math.pow(t, e);
  }

  polyIn.exponent = custom;

  return polyIn;
}))(exponent);

((function custom(e) {
  e = +e;

  function polyOut(t) {
    return 1 - Math.pow(1 - t, e);
  }

  polyOut.exponent = custom;

  return polyOut;
}))(exponent);

((function custom(e) {
  e = +e;

  function polyInOut(t) {
    return ((t *= 2) <= 1 ? Math.pow(t, e) : 2 - Math.pow(2 - t, e)) / 2;
  }

  polyInOut.exponent = custom;

  return polyInOut;
}))(exponent);

var pi$2 = Math.PI;

function sinInOut(t) {
  return (1 - Math.cos(pi$2 * t)) / 2;
}

var b1 = 4 / 11,
    b2 = 6 / 11,
    b3 = 8 / 11,
    b4 = 3 / 4,
    b5 = 9 / 11,
    b6 = 10 / 11,
    b7 = 15 / 16,
    b8 = 21 / 22,
    b9 = 63 / 64,
    b0 = 1 / b1 / b1;

function bounceOut(t) {
  return (t = +t) < b1 ? b0 * t * t : t < b3 ? b0 * (t -= b2) * t + b4 : t < b6 ? b0 * (t -= b5) * t + b7 : b0 * (t -= b8) * t + b9;
}

var overshoot = 1.70158;

((function custom(s) {
  s = +s;

  function backIn(t) {
    return t * t * ((s + 1) * t - s);
  }

  backIn.overshoot = custom;

  return backIn;
}))(overshoot);

((function custom(s) {
  s = +s;

  function backOut(t) {
    return --t * t * ((s + 1) * t + s) + 1;
  }

  backOut.overshoot = custom;

  return backOut;
}))(overshoot);

((function custom(s) {
  s = +s;

  function backInOut(t) {
    return ((t *= 2) < 1 ? t * t * ((s + 1) * t - s) : (t -= 2) * t * ((s + 1) * t + s) + 2) / 2;
  }

  backInOut.overshoot = custom;

  return backInOut;
}))(overshoot);

var tau$2 = 2 * Math.PI,
    amplitude = 1,
    period = 0.3;

((function custom(a, p) {
  var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$2);

  function elasticIn(t) {
    return a * Math.pow(2, 10 * --t) * Math.sin((s - t) / p);
  }

  elasticIn.amplitude = function(a) { return custom(a, p * tau$2); };
  elasticIn.period = function(p) { return custom(a, p); };

  return elasticIn;
}))(amplitude, period);

((function custom(a, p) {
  var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$2);

  function elasticOut(t) {
    return 1 - a * Math.pow(2, -10 * (t = +t)) * Math.sin((t + s) / p);
  }

  elasticOut.amplitude = function(a) { return custom(a, p * tau$2); };
  elasticOut.period = function(p) { return custom(a, p); };

  return elasticOut;
}))(amplitude, period);

((function custom(a, p) {
  var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau$2);

  function elasticInOut(t) {
    return ((t = t * 2 - 1) < 0
        ? a * Math.pow(2, 10 * t) * Math.sin((s - t) / p)
        : 2 - a * Math.pow(2, -10 * t) * Math.sin((s + t) / p)) / 2;
  }

  elasticInOut.amplitude = function(a) { return custom(a, p * tau$2); };
  elasticInOut.period = function(p) { return custom(a, p); };

  return elasticInOut;
}))(amplitude, period);

var defaultTiming = {
  time: null, // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};

function inherit(node, id) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id])) {
    if (!(node = node.parentNode)) {
      return defaultTiming.time = now(), defaultTiming;
    }
  }
  return timing;
}

function selection_transition(name) {
  var id,
      timing;

  if (name instanceof Transition) {
    id = name._id, name = name._name;
  } else {
    id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule(node, name, id, i, group, timing || inherit(node, id));
      }
    }
  }

  return new Transition(groups, this._parents, name, id);
}

selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;

function constant$3(x) {
  return function() {
    return x;
  };
}

function ZoomEvent(target, type, transform) {
  this.target = target;
  this.type = type;
  this.transform = transform;
}

function Transform(k, x, y) {
  this.k = k;
  this.x = x;
  this.y = y;
}

Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x, y) {
    return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
  },
  apply: function(point) {
    return [point[0] * this.k + this.x, point[1] * this.k + this.y];
  },
  applyX: function(x) {
    return x * this.k + this.x;
  },
  applyY: function(y) {
    return y * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x) {
    return (x - this.x) / this.k;
  },
  invertY: function(y) {
    return (y - this.y) / this.k;
  },
  rescaleX: function(x) {
    return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
  },
  rescaleY: function(y) {
    return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};

var identity = new Transform(1, 0, 0);

transform.prototype = Transform.prototype;

function transform(node) {
  return node.__zoom || identity;
}

function nopropagation$1() {
  event.stopImmediatePropagation();
}

function noevent$1() {
  event.preventDefault();
  event.stopImmediatePropagation();
}

// Ignore right-click, since that should open the context menu.
function defaultFilter$1() {
  return !event.button;
}

function defaultExtent$1() {
  var e = this, w, h;
  if (e instanceof SVGElement) {
    e = e.ownerSVGElement || e;
    w = e.width.baseVal.value;
    h = e.height.baseVal.value;
  } else {
    w = e.clientWidth;
    h = e.clientHeight;
  }
  return [[0, 0], [w, h]];
}

function defaultTransform() {
  return this.__zoom || identity;
}

function defaultWheelDelta() {
  return -event.deltaY * (event.deltaMode ? 120 : 1) / 500;
}

function defaultTouchable() {
  return "ontouchstart" in this;
}

function defaultConstrain(transform, extent, translateExtent) {
  var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0],
      dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0],
      dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1],
      dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
  return transform.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}

function zoom() {
  var filter = defaultFilter$1,
      extent = defaultExtent$1,
      constrain = defaultConstrain,
      wheelDelta = defaultWheelDelta,
      touchable = defaultTouchable,
      scaleExtent = [0, Infinity],
      translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]],
      duration = 250,
      interpolate = interpolateZoom,
      gestures = [],
      listeners = dispatch("start", "zoom", "end"),
      touchstarting,
      touchending,
      touchDelay = 500,
      wheelDelay = 150,
      clickDistance2 = 0;

  function zoom(selection) {
    selection
        .property("__zoom", defaultTransform)
        .on("wheel.zoom", wheeled)
        .on("mousedown.zoom", mousedowned)
        .on("dblclick.zoom", dblclicked)
      .filter(touchable)
        .on("touchstart.zoom", touchstarted)
        .on("touchmove.zoom", touchmoved)
        .on("touchend.zoom touchcancel.zoom", touchended)
        .style("touch-action", "none")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }

  zoom.transform = function(collection, transform) {
    var selection = collection.selection ? collection.selection() : collection;
    selection.property("__zoom", defaultTransform);
    if (collection !== selection) {
      schedule(collection, transform);
    } else {
      selection.interrupt().each(function() {
        gesture(this, arguments)
            .start()
            .zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform)
            .end();
      });
    }
  };

  zoom.scaleBy = function(selection, k) {
    zoom.scaleTo(selection, function() {
      var k0 = this.__zoom.k,
          k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return k0 * k1;
    });
  };

  zoom.scaleTo = function(selection, k) {
    zoom.transform(selection, function() {
      var e = extent.apply(this, arguments),
          t0 = this.__zoom,
          p0 = centroid(e),
          p1 = t0.invert(p0),
          k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return constrain(translate(scale(t0, k1), p0, p1), e, translateExtent);
    });
  };

  zoom.translateBy = function(selection, x, y) {
    zoom.transform(selection, function() {
      return constrain(this.__zoom.translate(
        typeof x === "function" ? x.apply(this, arguments) : x,
        typeof y === "function" ? y.apply(this, arguments) : y
      ), extent.apply(this, arguments), translateExtent);
    });
  };

  zoom.translateTo = function(selection, x, y) {
    zoom.transform(selection, function() {
      var e = extent.apply(this, arguments),
          t = this.__zoom,
          p = centroid(e);
      return constrain(identity.translate(p[0], p[1]).scale(t.k).translate(
        typeof x === "function" ? -x.apply(this, arguments) : -x,
        typeof y === "function" ? -y.apply(this, arguments) : -y
      ), e, translateExtent);
    });
  };

  function scale(transform, k) {
    k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
    return k === transform.k ? transform : new Transform(k, transform.x, transform.y);
  }

  function translate(transform, p0, p1) {
    var x = p0[0] - p1[0] * transform.k, y = p0[1] - p1[1] * transform.k;
    return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
  }

  function centroid(extent) {
    return [(+extent[0][0] + +extent[1][0]) / 2, (+extent[0][1] + +extent[1][1]) / 2];
  }

  function schedule(transition, transform, center) {
    transition
        .on("start.zoom", function() { gesture(this, arguments).start(); })
        .on("interrupt.zoom end.zoom", function() { gesture(this, arguments).end(); })
        .tween("zoom", function() {
          var that = this,
              args = arguments,
              g = gesture(that, args),
              e = extent.apply(that, args),
              p = center || centroid(e),
              w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]),
              a = that.__zoom,
              b = typeof transform === "function" ? transform.apply(that, args) : transform,
              i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
          return function(t) {
            if (t === 1) t = b; // Avoid rounding error on end.
            else { var l = i(t), k = w / l[2]; t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k); }
            g.zoom(null, t);
          };
        });
  }

  function gesture(that, args) {
    for (var i = 0, n = gestures.length, g; i < n; ++i) {
      if ((g = gestures[i]).that === that) {
        return g;
      }
    }
    return new Gesture(that, args);
  }

  function Gesture(that, args) {
    this.that = that;
    this.args = args;
    this.index = -1;
    this.active = 0;
    this.extent = extent.apply(that, args);
  }

  Gesture.prototype = {
    start: function() {
      if (++this.active === 1) {
        this.index = gestures.push(this) - 1;
        this.emit("start");
      }
      return this;
    },
    zoom: function(key, transform) {
      if (this.mouse && key !== "mouse") this.mouse[1] = transform.invert(this.mouse[0]);
      if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
      if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);
      this.that.__zoom = transform;
      this.emit("zoom");
      return this;
    },
    end: function() {
      if (--this.active === 0) {
        gestures.splice(this.index, 1);
        this.index = -1;
        this.emit("end");
      }
      return this;
    },
    emit: function(type) {
      customEvent(new ZoomEvent(zoom, type, this.that.__zoom), listeners.apply, listeners, [type, this.that, this.args]);
    }
  };

  function wheeled() {
    if (!filter.apply(this, arguments)) return;
    var g = gesture(this, arguments),
        t = this.__zoom,
        k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))),
        p = mouse(this);

    // If the mouse is in the same location as before, reuse it.
    // If there were recent wheel events, reset the wheel idle timeout.
    if (g.wheel) {
      if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
        g.mouse[1] = t.invert(g.mouse[0] = p);
      }
      clearTimeout(g.wheel);
    }

    // If this wheel event won’t trigger a transform change, ignore it.
    else if (t.k === k) return;

    // Otherwise, capture the mouse point and location at the start.
    else {
      g.mouse = [p, t.invert(p)];
      interrupt(this);
      g.start();
    }

    noevent$1();
    g.wheel = setTimeout(wheelidled, wheelDelay);
    g.zoom("mouse", constrain(translate(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));

    function wheelidled() {
      g.wheel = null;
      g.end();
    }
  }

  function mousedowned() {
    if (touchending || !filter.apply(this, arguments)) return;
    var g = gesture(this, arguments),
        v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true),
        p = mouse(this),
        x0 = event.clientX,
        y0 = event.clientY;

    dragDisable(event.view);
    nopropagation$1();
    g.mouse = [p, this.__zoom.invert(p)];
    interrupt(this);
    g.start();

    function mousemoved() {
      noevent$1();
      if (!g.moved) {
        var dx = event.clientX - x0, dy = event.clientY - y0;
        g.moved = dx * dx + dy * dy > clickDistance2;
      }
      g.zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = mouse(g.that), g.mouse[1]), g.extent, translateExtent));
    }

    function mouseupped() {
      v.on("mousemove.zoom mouseup.zoom", null);
      yesdrag(event.view, g.moved);
      noevent$1();
      g.end();
    }
  }

  function dblclicked() {
    if (!filter.apply(this, arguments)) return;
    var t0 = this.__zoom,
        p0 = mouse(this),
        p1 = t0.invert(p0),
        k1 = t0.k * (event.shiftKey ? 0.5 : 2),
        t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, arguments), translateExtent);

    noevent$1();
    if (duration > 0) select(this).transition().duration(duration).call(schedule, t1, p0);
    else select(this).call(zoom.transform, t1);
  }

  function touchstarted() {
    if (!filter.apply(this, arguments)) return;
    var g = gesture(this, arguments),
        touches = event.changedTouches,
        started,
        n = touches.length, i, t, p;

    nopropagation$1();
    for (i = 0; i < n; ++i) {
      t = touches[i], p = touch(this, touches, t.identifier);
      p = [p, this.__zoom.invert(p), t.identifier];
      if (!g.touch0) g.touch0 = p, started = true;
      else if (!g.touch1) g.touch1 = p;
    }

    // If this is a dbltap, reroute to the (optional) dblclick.zoom handler.
    if (touchstarting) {
      touchstarting = clearTimeout(touchstarting);
      if (!g.touch1) {
        g.end();
        p = select(this).on("dblclick.zoom");
        if (p) p.apply(this, arguments);
        return;
      }
    }

    if (started) {
      touchstarting = setTimeout(function() { touchstarting = null; }, touchDelay);
      interrupt(this);
      g.start();
    }
  }

  function touchmoved() {
    var g = gesture(this, arguments),
        touches = event.changedTouches,
        n = touches.length, i, t, p, l;

    noevent$1();
    if (touchstarting) touchstarting = clearTimeout(touchstarting);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = touch(this, touches, t.identifier);
      if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
      else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
    }
    t = g.that.__zoom;
    if (g.touch1) {
      var p0 = g.touch0[0], l0 = g.touch0[1],
          p1 = g.touch1[0], l1 = g.touch1[1],
          dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp,
          dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
      t = scale(t, Math.sqrt(dp / dl));
      p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
    }
    else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
    else return;
    g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
  }

  function touchended() {
    var g = gesture(this, arguments),
        touches = event.changedTouches,
        n = touches.length, i, t;

    nopropagation$1();
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() { touchending = null; }, touchDelay);
    for (i = 0; i < n; ++i) {
      t = touches[i];
      if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
      else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
    }
    if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
    if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
    else g.end();
  }

  zoom.wheelDelta = function(_) {
    return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant$3(+_), zoom) : wheelDelta;
  };

  zoom.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant$3(!!_), zoom) : filter;
  };

  zoom.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant$3(!!_), zoom) : touchable;
  };

  zoom.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant$3([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
  };

  zoom.scaleExtent = function(_) {
    return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
  };

  zoom.translateExtent = function(_) {
    return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
  };

  zoom.constrain = function(_) {
    return arguments.length ? (constrain = _, zoom) : constrain;
  };

  zoom.duration = function(_) {
    return arguments.length ? (duration = +_, zoom) : duration;
  };

  zoom.interpolate = function(_) {
    return arguments.length ? (interpolate = _, zoom) : interpolate;
  };

  zoom.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? zoom : value;
  };

  zoom.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
  };

  return zoom;
}

/**
 * Object generation and management utilities
 * @module generate_objects
 */

// create or re-use objects in a map, delete the ones that were not reused
function regenerateObjects(preserved, list, need, key, assign, create, destroy) {
    if (!create) create = function(_k, _o) {};
    if (!destroy) destroy = function(_k) {};
    const keep = {};
    function wrap(o) {
        const k = key(o);
        if (!preserved[k])
            create(k, preserved[k] = {}, o);
        const o1 = preserved[k];
        assign(o1, o);
        keep[k] = true;
        return o1;
    }
    const wlist = list.map(wrap);
    if (need)
        need.forEach(k => {
            if (!preserved[k]) { // hasn't been created, needs to be
                create(k, preserved[k] = {}, null);
                assign(preserved[k], null);
            }
            if (!keep[k]) { // wasn't in list, should be
                wlist.push(preserved[k]);
                keep[k] = true;
            }
        });
    // delete any objects from last round that are no longer used
    for (const k in preserved)
        if (!keep[k]) {
            destroy(k, preserved[k]);
            delete preserved[k];
        }
    return wlist;
}

function propertyIf(pred, curr) {
    return function(o, last) {
        return pred(o) ? curr(o) : last();
    };
}

function propertyInterpolate(value, curr) {
    return function(o, last) {
        return interpolate$1(last(o), curr(o))(value(o));
    };
}

function multiplyProperties(pred, props, blend) {
    const props2 = {};
    for (const p in props)
        props2[p] = blend(pred, param(props[p]));
    return props2;
}

function conditionalProperties(pred, props) {
    return multiplyProperties(pred, props, propertyIf);
}

function nodeEdgeConditions(npred, epred, props) {
    const nprops = {}, eprops = {}, badprops = [];
    for (const p in props) {
        if (/^node/.test(p))
            nprops[p] = props[p];
        else if (/^edge/.test(p))
            eprops[p] = props[p];
        else badprops.push(p);
    }
    if (badprops.length)
        console.error(
            'only know how to deal with properties that start with "node" or "edge"',
            badprops,
        );
    const props2 = npred ? conditionalProperties(npred, nprops) : {};
    if (epred)
        Object.assign(props2, conditionalProperties(epred, eprops));
    return props2;
}

function cascade(parent) {
    return function(level, add, props) {
        for (const p in props) {
            if (!parent[p])
                throw new Error(`unknown attribute ${p}`);
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
function functorWrap(v, wrap) {
    if (typeof v === 'function') {
        return wrap
            ? function(x) {
                return v(wrap(x));
            }
            : v;
    } else return function() {
            return v;
        };
}

// we want to allow either values or functions to be passed to specify parameters.
// if a function, the function needs a preprocessor to extract the original key/value
// pair from the wrapper object we put it in.
function param(v) {
    return functorWrap(v, getOriginal);
}

// http://jsperf.com/cloning-an-object/101
function clone(obj) {
    const target = {};
    for (const i in obj) {
        if (obj.hasOwnProperty(i)) {
            target[i] = obj[i];
        }
    }
    return target;
}

// because i don't think we need to bind edge point data (yet!)
const bez_cmds = {
    1: 'L',
    2: 'Q',
    3: 'C',
};

function generatePath(pts, bezDegree, close) {
    const cats = ['M', pts[0].x, ',', pts[0].y];
    let remain = bezDegree;
    for (let i = 1; i < pts.length; ++i) {
        if (isNaN(pts[i].x) || isNaN(pts[i].y))
            ;
        cats.push(remain === bezDegree ? bez_cmds[bezDegree] : ' ', pts[i].x, ',', pts[i].y);
        if (--remain === 0)
            remain = bezDegree;
    }
    if (remain != bezDegree)
        console.log("warning: pts.length didn't match bezian degree", pts, bezDegree);
    if (close)
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
        y += arguments[i]*arguments[i];
    }
    return Math.sqrt(y);
};

// outputs the array with adjacent identical lines collapsed to one
function uniq(a) {
    const ret = [];
    a.forEach((x, i) => {
        if (i === 0 || x !== a[i-1])
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
            const len = o.length>>>0;

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
        },
    });
}

const scriptPath = function() {
    let _path;
    return function() {
        if (_path === undefined) {
            _path = null; // only try once

            // For ES6 modules, try to use import.meta.url if available
            try {
                if (import.meta && import.meta.url) {
                    const url = new URL(import.meta.url);
                    _path = url.pathname.replace(/[^/]*$/, '');
                    return _path;
                }
            } catch (_e) {
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
                if (!_path) {
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

function eventCoords(diagram, event) {
    const bound = diagram.root().node().getBoundingClientRect();
    return diagram.invertCoord([event.clientX-bound.left, event.clientY-bound.top]);
}

function promiseIdentity(x) {
    return Promise.resolve(x);
}

// http://stackoverflow.com/questions/7044944/jquery-javascript-to-detect-os-without-a-plugin
const is_a_mac = navigator.platform.toUpperCase().indexOf('MAC') !== -1;

// https://stackoverflow.com/questions/16863917/check-if-class-exists-somewhere-in-parent-vanilla-js
function ancestorHasClass(element, classname) {
    if (select(element).classed(classname))
        return true;
    return element.parentElement && ancestorHasClass(element.parentElement, classname);
}

if (typeof SVGElement.prototype.contains == 'undefined') {
    SVGElement.prototype.contains = HTMLDivElement.prototype.contains;
}

function pointOnEllipse(A, B, dx, dy) {
    let tansq = Math.tan(Math.atan2(dy, dx));
    tansq = tansq*tansq; // why is this not just dy*dy/dx*dx ? ?
    const ret = {x: A*B/Math.sqrt(B*B+A*A*tansq), y: A*B/Math.sqrt(A*A+B*B/tansq)};
    if (dx < 0)
        ret.x = -ret.x;
    if (dy < 0)
        ret.y = -ret.y;
    return ret;
}

const eps = 0.0000001;
function between(a, b, c) {
    return a-eps <= b && b <= c+eps;
}

// Adapted from http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/1968345#1968345
function segmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const x = ((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))
        /((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    const y = ((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))
        /((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    if (isNaN(x) || isNaN(y)) {
        return false;
    } else {
        if (x1 >= x2) {
            if (!between(x2, x, x1)) { return false; }
        } else {
            if (!between(x1, x, x2)) { return false; }
        }
        if (y1 >= y2) {
            if (!between(y2, y, y1)) { return false; }
        } else {
            if (!between(y1, y, y2)) { return false; }
        }
        if (x3 >= x4) {
            if (!between(x4, x, x3)) { return false; }
        } else {
            if (!between(x3, x, x4)) { return false; }
        }
        if (y3 >= y4) {
            if (!between(y4, y, y3)) { return false; }
        } else {
            if (!between(y3, y, y4)) { return false; }
        }
    }
    return {x, y};
}

function pointOnPolygon(points, x0, y0, x1, y1) {
    for (let i = 0; i < points.length; ++i) {
        const next = i === points.length-1 ? 0 : i+1;
        const isect = segmentIntersection(
            points[i].x,
            points[i].y,
            points[next].x,
            points[next].y,
            x0,
            y0,
            x1,
            y1,
        );
        if (isect)
            return isect;
    }
    return null;
}

// as many as we can get from
// http://www.graphviz.org/doc/info/shapes.html
const shapePresets = {
    egg: {
        // not really: an ovoid should be two half-ellipses stuck together
        // https://en.wikipedia.org/wiki/Oval
        generator: 'polygon',
        preset() {
            return {sides: 100, distortion: -0.25};
        },
    },
    triangle: {
        generator: 'polygon',
        preset() {
            return {sides: 3};
        },
    },
    rectangle: {
        generator: 'polygon',
        preset() {
            return {sides: 4};
        },
    },
    diamond: {
        generator: 'polygon',
        preset() {
            return {sides: 4, rotation: 45};
        },
    },
    trapezium: {
        generator: 'polygon',
        preset() {
            return {sides: 4, distortion: -0.5};
        },
    },
    parallelogram: {
        generator: 'polygon',
        preset() {
            return {sides: 4, skew: 0.5};
        },
    },
    pentagon: {
        generator: 'polygon',
        preset() {
            return {sides: 5};
        },
    },
    hexagon: {
        generator: 'polygon',
        preset() {
            return {sides: 6};
        },
    },
    septagon: {
        generator: 'polygon',
        preset() {
            return {sides: 7};
        },
    },
    octagon: {
        generator: 'polygon',
        preset() {
            return {sides: 8};
        },
    },
    invtriangle: {
        generator: 'polygon',
        preset() {
            return {sides: 3, rotation: 180};
        },
    },
    invtrapezium: {
        generator: 'polygon',
        preset() {
            return {sides: 4, distortion: 0.5};
        },
    },
    square: {
        generator: 'polygon',
        preset() {
            return {
                sides: 4,
                regular: true,
            };
        },
    },
    plain: {
        generator: 'rounded-rect',
        preset() {
            return {
                noshape: true,
            };
        },
    },
    house: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: rx, y: ry*2/3},
                        {x: rx, y: -ry/2},
                        {x: 0, y: -ry},
                        {x: -rx, y: -ry/2},
                        {x: -rx, y: ry*2/3},
                    ];
                },
                minrx: 30,
            };
        },
    },
    invhouse: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: rx, y: ry/2},
                        {x: rx, y: -ry*2/3},
                        {x: -rx, y: -ry*2/3},
                        {x: -rx, y: ry/2},
                        {x: 0, y: ry},
                    ];
                },
                minrx: 30,
            };
        },
    },
    rarrow: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: rx, y: ry},
                        {x: rx, y: ry*1.5},
                        {x: rx+ry*1.5, y: 0},
                        {x: rx, y: -ry*1.5},
                        {x: rx, y: -ry},
                        {x: -rx, y: -ry},
                        {x: -rx, y: ry},
                    ];
                },
                minrx: 30,
            };
        },
    },
    larrow: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: -rx, y: ry},
                        {x: -rx, y: ry*1.5},
                        {x: -rx-ry*1.5, y: 0},
                        {x: -rx, y: -ry*1.5},
                        {x: -rx, y: -ry},
                        {x: rx, y: -ry},
                        {x: rx, y: ry},
                    ];
                },
                minrx: 30,
            };
        },
    },
    rpromoter: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: rx, y: ry},
                        {x: rx, y: ry*1.5},
                        {x: rx+ry*1.5, y: 0},
                        {x: rx, y: -ry*1.5},
                        {x: rx, y: -ry},
                        {x: -rx, y: -ry},
                        {x: -rx, y: ry*1.5},
                        {x: 0, y: ry*1.5},
                        {x: 0, y: ry},
                    ];
                },
                minrx: 30,
            };
        },
    },
    lpromoter: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: -rx, y: ry},
                        {x: -rx, y: ry*1.5},
                        {x: -rx-ry*1.5, y: 0},
                        {x: -rx, y: -ry*1.5},
                        {x: -rx, y: -ry},
                        {x: rx, y: -ry},
                        {x: rx, y: ry*1.5},
                        {x: 0, y: ry*1.5},
                        {x: 0, y: ry},
                    ];
                },
                minrx: 30,
            };
        },
    },
    cds: {
        generator: 'elaborated-rect',
        preset() {
            return {
                get_points(rx, ry) {
                    return [
                        {x: rx, y: ry},
                        {x: rx+ry, y: 0},
                        {x: rx, y: -ry},
                        {x: -rx, y: -ry},
                        {x: -rx, y: ry},
                    ];
                },
                minrx: 30,
            };
        },
    },
};

shapePresets.box = shapePresets.rect = shapePresets.rectangle;

function availableShapes() {
    const shapes = Object.keys(shapePresets);
    return shapes.slice(0, shapes.length-1); // not including polygon
}

const defaultShape = {shape: 'ellipse'};

function normalizeShapeDef(diagram, n) {
    let def = diagram.nodeShape.eval(n);
    if (!def)
        def = {...defaultShape};
    else if (typeof def === 'string')
        def = {shape: def};
    def.nodeOutlineClip = diagram.nodeOutlineClip.eval(n);
    return def;
}

function elaborateShape(diagram, def) {
    let shape = def.shape;
    const def2 = Object.assign({}, def);
    delete def2.shape;
    if (shape === 'random') {
        const available = availableShapes(); // could include diagram.shape !== ellipse, polygon
        shape = available[Math.floor(Math.random()*available.length)];
    } else if (diagram.shape.enum().indexOf(shape) !== -1)
        return diagram.shape(shape).elaborate({shape}, def2);
    if (!shapePresets[shape]) {
        console.warn('unknown shape ', shape);
        return defaultShape;
    }
    const preset = shapePresets[shape].preset(def2);
    preset.shape = shapePresets[shape].generator;
    return diagram.shape(preset.shape).elaborate(preset, def2);
}

function inferShape(diagram) {
    return function(n) {
        const def = normalizeShapeDef(diagram, n);
        n.dcg_shape = elaborateShape(diagram, def);
        n.dcg_shape.abstract = def;
    };
}

function shapeChanged(diagram) {
    return function(n) {
        const def = normalizeShapeDef(diagram, n);
        const old = n.dcg_shape.abstract;
        if (def.shape !== old.shape)
            return true;
        else if (def.nodeOutlineClip !== old.nodeOutlineClip)
            return true;
        else if (def.shape === 'polygon') {
            return def.shape.sides !== old.sides || def.shape.skew !== old.skew
                || def.shape.distortion !== old.distortion || def.shape.rotation !== old.rotation;
        } else return false;
    };
}

function nodeLabelPadding(diagram, n) {
    const nlp = diagram.nodeLabelPadding.eval(n);
    if (typeof nlp === 'number' || typeof nlp === 'string')
        return {x: +nlp, y: +nlp};
    else return nlp;
}

function fitShape(shape, diagram) {
    return function(content) {
        content.each(function(n) {
            let bbox = null;
            if (
                (!shape.useTextSize || shape.useTextSize(n.dcg_shape))
                && diagram.nodeFitLabel.eval(n)
            ) {
                bbox = getBBoxNoThrow(this);
                bbox = {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
                let padding;
                const content = diagram.nodeContent.eval(n);
                if (content && diagram.content(content).padding)
                    padding = diagram.content(content).padding(n);
                else {
                    const padding2 = nodeLabelPadding(diagram, n);
                    padding = {
                        x: padding2.x*2,
                        y: padding2.y*2,
                    };
                }
                bbox.width += padding.x;
                bbox.height += padding.y;
                n.bbox = bbox;
            }
            let r = 0, radii;
            if (!shape.useRadius || shape.useRadius(n.dcg_shape))
                r = Math.max(0, diagram.nodeRadius.eval(n) || 0);
            if (
                bbox && bbox.width && bbox.height
                || shape.useTextSize && !shape.useTextSize(n.dcg_shape)
            )
                radii = shape.calc_radii(n, r, bbox);
            else
                radii = {rx: r, ry: r};
            n.dcg_rx = Math.max(0, radii.rx || 0);
            n.dcg_ry = Math.max(0, radii.ry || 0);

            let w = radii.rx*2, h = radii.ry*2;
            // fixme: this is only consistent if regular || !squeeze
            // but we'd need to calculate polygon first in order to find out
            // (not a bad idea, just no time right now)
            // if(w<h) w = h;

            if (!shape.usePaddingAndStroke || shape.usePaddingAndStroke(n.dcg_shape)) {
                const pands = diagram.nodePadding.eval(n)+diagram.nodeStrokeWidth.eval(n);
                w += pands;
                h += pands;
            }
            n.cola.width = w;
            n.cola.height = h;
        });
    };
}

function polygonPath(n) {
    let rx = n.dcg_rx, ry = n.dcg_ry;
    const def = n.dcg_shape,
        sides = def.sides || 4,
        skew = def.skew || 0,
        distortion = def.distortion || 0,
        align = sides%2 ? 0 : 0.5, // even-sided horizontal top, odd pointy top
        angles = [];
    let rotation = def.rotation || 0;
    rotation = rotation/360+0.25; // start at y axis not x
    for (let i = 0; i < sides; ++i) {
        const theta = -((i+align)/sides+rotation)*Math.PI*2; // svg is up-negative
        angles.push({x: Math.cos(theta), y: Math.sin(theta)});
    }
    const yext = extent(angles, theta => theta.y);
    if (def.regular)
        rx = ry = Math.max(rx, ry);
    else if (rx < ry && !def.squeeze)
        rx = ry;
    else
        ry = ry/Math.min(-yext[0], yext[1]);
    n.dcg_points = angles.map(theta => {
        let x = rx*theta.x;
        const y = ry*theta.y;
        x *= 1+distortion*((ry-y)/ry-1);
        x -= skew*y/2;
        return {x, y};
    });
    return generatePath(n.dcg_points, 1, true);
}

function binarySearch(f, a, b) {
    let patience = 100;
    if (f(a).val >= 0)
        throw new Error('f(a) must be less than 0');
    if (f(b).val <= 0)
        throw new Error('f(b) must be greater than 0');
    while (true) {
        if (!--patience)
            throw new Error('patience ran out');
        const c = (a+b)/2,
            f_c = f(c),
            fv = f_c.val;
        if (Math.abs(fv) < 0.5)
            return f_c;
        if (fv > 0)
            b = c;
        else
            a = c;
    }
}

function drawEdgeToShapes(
    diagram,
    e,
    sx,
    sy,
    tx,
    ty,
    neighbor,
    dir,
    offset,
    source_padding,
    target_padding,
) {
    let sp, tp, points, bezDegree;
    if (!neighbor) {
        sp = e.sourcePort.pos;
        tp = e.targetPort.pos;
        if (!sp) sp = {x: 0, y: 0};
        if (!tp) tp = {x: 0, y: 0};
        points = [{
            x: sx+sp.x,
            y: sy+sp.y,
        }, {
            x: tx+tp.x,
            y: ty+tp.y,
        }];
        bezDegree = 1;
    } else {
        const p_on_s = function(node, ang) {
            return diagram.shape(node.dcg_shape.shape).intersect_vec(
                node,
                Math.cos(ang)*1000,
                Math.sin(ang)*1000,
            );
        };
        const compare_dist = function(node, port0, goal) {
            return function(ang) {
                const port = p_on_s(node, ang);
                if (!port)
                    return {
                        port: {x: 0, y: 0},
                        val: 0,
                        ang,
                    };
                else
                    return {
                        port,
                        val: Math.hypot(port.x-port0.x, port.y-port0.y)-goal,
                        ang,
                    };
            };
        };
        const srcang = Math.atan2(neighbor.sourcePort.y, neighbor.sourcePort.x),
            tarang = Math.atan2(neighbor.targetPort.y, neighbor.targetPort.x);
        let bss, bst;

        // don't like this but throwing is unacceptable
        try {
            bss = binarySearch(
                compare_dist(e.source, neighbor.sourcePort, offset),
                srcang,
                srcang+2*dir*offset/source_padding,
            );
        } catch (_x) {
            bss = {ang: srcang, port: neighbor.sourcePort};
        }
        try {
            bst = binarySearch(
                compare_dist(e.target, neighbor.targetPort, offset),
                tarang,
                tarang-2*dir*offset/source_padding,
            );
        } catch (_x) {
            bst = {ang: tarang, port: neighbor.targetPort};
        }

        sp = bss.port;
        tp = bst.port;
        const sdist = Math.hypot(sp.x, sp.y),
            tdist = Math.hypot(tp.x, tp.y),
            c1dist = sdist+source_padding/2,
            c2dist = tdist+target_padding/2;
        const c1X = sx+c1dist*Math.cos(bss.ang),
            c1Y = sy+c1dist*Math.sin(bss.ang),
            c2X = tx+c2dist*Math.cos(bst.ang),
            c2Y = ty+c2dist*Math.sin(bst.ang);
        points = [
            {x: sx+sp.x, y: sy+sp.y},
            {x: c1X, y: c1Y},
            {x: c2X, y: c2Y},
            {x: tx+tp.x, y: ty+tp.y},
        ];
        bezDegree = 3;
    }
    return {
        sourcePort: sp,
        targetPort: tp,
        points,
        bezDegree,
    };
}

function isOneSegment(path) {
    return path.bezDegree === 1 && path.points.length === 2
        || path.bezDegree === 3 && path.points.length === 4;
}

function asBezier3(path) {
    const p = path.points;
    if (path.bezDegree === 3) return p;
    else if (path.bezDegree === 1)
        return [
            {
                x: p[0].x,
                y: p[0].y,
            },
            {
                x: p[0].x+(p[1].x-p[0].x)/3,
                y: p[0].y+(p[1].y-p[0].y)/3,
            },
            {
                x: p[0].x+2*(p[1].x-p[0].x)/3,
                y: p[0].y+2*(p[1].y-p[0].y)/3,
            },
            {
                x: p[1].x,
                y: p[1].y,
            },
        ];
    else throw new Error(`unknown bezDegree ${path.bezDegree}`);
}

// from https://stackoverflow.com/questions/8369488/splitting-a-bezier-curve#8405756
// somewhat redundant with the above but different objective
function splitBezier(p, t) {
    const x1 = p[0].x,
        y1 = p[0].y,
        x2 = p[1].x,
        y2 = p[1].y,
        x3 = p[2].x,
        y3 = p[2].y,
        x4 = p[3].x,
        y4 = p[3].y,
        x12 = (x2-x1)*t+x1,
        y12 = (y2-y1)*t+y1,
        x23 = (x3-x2)*t+x2,
        y23 = (y3-y2)*t+y2,
        x34 = (x4-x3)*t+x3,
        y34 = (y4-y3)*t+y3,
        x123 = (x23-x12)*t+x12,
        y123 = (y23-y12)*t+y12,
        x234 = (x34-x23)*t+x23,
        y234 = (y34-y23)*t+y23,
        x1234 = (x234-x123)*t+x123,
        y1234 = (y234-y123)*t+y123;

    return [
        [{x: x1, y: y1}, {x: x12, y: y12}, {x: x123, y: y123}, {x: x1234, y: y1234}],
        [{x: x1234, y: y1234}, {x: x234, y: y234}, {x: x34, y: y34}, {x: x4, y: y4}],
    ];
}
function splitBezierN(p, n) {
    const ret = [];
    while (n > 1) {
        const parts = splitBezier(p, 1/n);
        ret.push(parts[0][0], parts[0][1], parts[0][2]);
        p = parts[1];
        --n;
    }
    ret.push.apply(ret, p);
    return ret;
}

// binary search for a point along a bezier that is a certain distance from one of the end points
// return the bezier cut at that point.
function chopBezier(points, end, dist) {
    const EPS = 0.1, dist2 = dist*dist;
    let ref, dir, segment;
    if (end === 'head') {
        ref = points[points.length-1];
        segment = points.slice(points.length-4);
        dir = -1;
    } else {
        ref = points[0];
        segment = points.slice(0, 4);
        dir = 1;
    }
    let parts, d2, t = 0.5, dt = 0.5, dx, dy;
    do {
        parts = splitBezier(segment, t);
        dx = ref.x-parts[1][0].x;
        dy = ref.y-parts[1][0].y;
        d2 = dx*dx+dy*dy;
        dt /= 2;
        if (d2 > dist2)
            t -= dt*dir;
        else
            t += dt*dir;
        // console.log('dist', dist, 'dir', dir, 'd', d, 't', t, 'dt', dt);
    } while (dt > 0.0000001 && Math.abs(d2-dist2) > EPS);
    points = points.slice();
    if (end === 'head')
        return points.slice(0, points.length-4).concat(parts[0]);
    else
        return parts[1].concat(points.slice(4));
}

function angleBetweenPoints(p0, p1) {
    return Math.atan2(p1.y-p0.y, p1.x-p0.x);
}

function noShape() {
    const _shape = {
        parent: property(null),
        elaborate(preset, def) {
            return Object.assign(preset, def);
        },
        useTextSize() {
            return false;
        },
        useRadius() {
            return false;
        },
        usePaddingAndStroke() {
            return false;
        },
        intersect_vec(_n, _deltaX, _deltaY) {
            return {x: 0, y: 0};
        },
        calc_radii(_n, _ry, _bbox) {
            return {rx: 0, ry: 0};
        },
        create(_nodeEnter) {
        },
        replace(_nodeChanged) {
        },
        update(_node) {
        },
    };
    return _shape;
}

function createMaybeClipped(diagram, nodeEnter, element) {
    const clipped = nodeEnter.filter(n => diagram.nodeOutlineClip.eval(n));
    const unclipped = nodeEnter.filter(n => !diagram.nodeOutlineClip.eval(n));
    clipped.insert(element, ':first-child')
        .attr('class', 'node-outline')
        .attr('fill', 'none')
        .attr('clip-path', n => `url(#node-clip-${diagram.nodeOutlineClip.eval(n)})`);
    clipped.insert(element, ':first-child')
        .attr('class', 'node-fill');
    unclipped.insert(element, ':first-child')
        .attr('class', 'node-outline node-fill');
}

function ellipseShape() {
    const _shape = {
        parent: property(null),
        elaborate(preset, def) {
            return Object.assign(preset, def);
        },
        intersect_vec(n, deltaX, deltaY) {
            return pointOnEllipse(n.dcg_rx, n.dcg_ry, deltaX, deltaY);
        },
        calc_radii(n, ry, bbox) {
            // make sure we can fit height in r
            ry = Math.max(ry, bbox.height/2+5);
            let rx = bbox.width/2;

            // solve (x/A)^2 + (y/B)^2) = 1 for A, with B=r, to fit text in ellipse
            // http://stackoverflow.com/a/433438/676195
            const y_over_B = bbox.height/2/ry;
            rx = rx/Math.sqrt(1-y_over_B*y_over_B);
            rx = Math.max(rx, ry);

            return {rx, ry};
        },
        create(nodeEnter) {
            createMaybeClipped(_shape.parent(), nodeEnter, 'ellipse');
        },
        update(node) {
            node.selectAll('ellipse.node-fill,ellipse.node-outline')
                .attr('rx', n => n.dcg_rx)
                .attr('ry', n => n.dcg_ry);
        },
    };
    return _shape;
}

function polygonShape() {
    const _shape = {
        parent: property(null),
        elaborate(preset, def) {
            return Object.assign(preset, def);
        },
        intersect_vec(n, deltaX, deltaY) {
            return pointOnPolygon(n.dcg_points, 0, 0, deltaX, deltaY);
        },
        calc_radii(n, ry, bbox) {
            // make sure we can fit height in r
            ry = Math.max(ry, bbox.height/2+5);
            let rx = bbox.width/2;

            // this is cribbed from graphviz but there is much i don't understand
            // and any errors are mine
            // https://github.com/ellson/graphviz/blob/6acd566eab716c899ef3c4ddc87eceb9b428b627/lib/common/shapes.c#L1996
            rx = rx*Math.sqrt(2)/Math.cos(Math.PI/(n.dcg_shape.sides || 4));

            return {rx, ry};
        },
        create(nodeEnter) {
            createMaybeClipped(_shape.parent(), nodeEnter, 'path');
        },
        update(node) {
            node.selectAll('path.node-fill,path.node-outline')
                .attr('d', polygonPath);
        },
    };
    return _shape;
}

function roundedRectangleShape() {
    const _shape = {
        parent: property(null),
        elaborate(preset, def) {
            preset = Object.assign({rx: 10, ry: 10}, preset);
            return Object.assign(preset, def);
        },
        intersect_vec(n, deltaX, deltaY) {
            const points = [
                {x: n.dcg_rx, y: n.dcg_ry},
                {x: n.dcg_rx, y: -n.dcg_ry},
                {x: -n.dcg_rx, y: -n.dcg_ry},
                {x: -n.dcg_rx, y: n.dcg_ry},
            ];
            return pointOnPolygon(points, 0, 0, deltaX, deltaY); // not rounded
        },
        useRadius(shape) {
            return !shape.noshape;
        },
        calc_radii(n, ry, bbox) {
            let fity = bbox.height/2;
            // fixme: fudge to make sure text is not too tall for node
            if (!n.dcg_shape.noshape)
                fity += 5;
            return {
                rx: bbox.width/2,
                ry: Math.max(ry, fity),
            };
        },
        create(nodeEnter) {
            createMaybeClipped(
                _shape.parent(),
                nodeEnter.filter(n => !n.dcg_shape.noshape),
                'rect',
            );
        },
        update(node) {
            node.selectAll('rect.node-fill,rect.node-outline')
                .attr('x', n => -n.dcg_rx)
                .attr('y', n => -n.dcg_ry)
                .attr('width', n => 2*n.dcg_rx)
                .attr('height', n => 2*n.dcg_ry)
                .attr('rx', n => `${n.dcg_shape.rx}px`)
                .attr('ry', n => `${n.dcg_shape.ry}px`);
        },
    };
    return _shape;
}

// this is not all that accurate - idea is that arrows, houses, etc, are rectangles
// in terms of sizing, but elaborated drawing & clipping. refine until done.
function elaboratedRectangleShape() {
    const _shape = roundedRectangleShape();
    _shape.intersect_vec = function(n, deltaX, deltaY) {
        const points = n.dcg_shape.get_points(n.dcg_rx, n.dcg_ry);
        return pointOnPolygon(points, 0, 0, deltaX, deltaY);
    };
    delete _shape.useRadius;
    const orig_radii = _shape.calc_radii;
    _shape.calc_radii = function(n, ry, bbox) {
        const ret = orig_radii(n, ry, bbox);
        return {
            rx: Math.max(ret.rx, n.dcg_shape.minrx),
            ry: ret.ry,
        };
    };
    _shape.create = function(nodeEnter) {
        createMaybeClipped(_shape.parent(), nodeEnter, 'path');
    };
    _shape.update = function(node) {
        node.selectAll('path.node-fill,path.node-outline')
            .attr('d', n => generatePath(n.dcg_shape.get_points(n.dcg_rx, n.dcg_ry), 1, true));
    };
    return _shape;
}

function textContents() {
    const _contents = {
        parent: property(null),
        update(container) {
            let text = container.selectAll('text.node-label')
                .data(n => [n]);
            const textEnter = text.enter().append('text')
                .attr('class', 'node-label');
            text = text.merge(textEnter);
            let tspan = text.selectAll('tspan').data(n => {
                let lines = _contents.parent().nodeLabel.eval(n);
                if (!lines)
                    return [];
                else if (typeof lines === 'string')
                    lines = [lines];
                const lineHeight = _contents.parent().nodeLineHeight();
                let first = 0.5-((lines.length-1)*lineHeight+1)/2;
                // IE, Edge, and Safari do not seem to support
                // dominant-baseline: central although they say they do
                if (isIe() || isSafari())
                    first += 0.3;
                return lines.map((line, i) => ({
                    node: n,
                    line,
                    yofs: `${i == 0 ? first : lineHeight}em`,
                }));
            });
            const tspanEnter = tspan.enter().append('tspan');
            tspan = tspan.merge(tspanEnter);
            tspan
                .attr('text-anchor', 'start')
                .attr(
                    'text-decoration',
                    line => _contents.parent().nodeLabelDecoration.eval(line.node),
                )
                .attr('x', 0)
                .html(s => s.line);
            text
                .each(n => {
                    n.xofs = 0;
                })
                .filter(n => _contents.parent().nodeLabelAlignment.eval(n) !== 'center')
                .each(function(n) {
                    const bbox = getBBoxNoThrow(this);
                    n.bbox = {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
                    switch (_contents.parent().nodeLabelAlignment.eval(n)) {
                        case 'left':
                            n.xofs = -n.bbox.width/2;
                            break;
                        case 'right':
                            n.xofs = n.bbox.width/2;
                            break;
                    }
                })
                .selectAll('tspan');
            tspan
                .attr('text-anchor', s => {
                    switch (_contents.parent().nodeLabelAlignment.eval(s.node)) {
                        case 'left':
                            return 'start';
                        case 'center':
                            return 'middle';
                        case 'right':
                            return 'end';
                    }
                    return null;
                })
                .attr('x', s => s.node.xofs)
                .attr('dy', d => d.yofs);

            tspan.exit().remove();
            text
                .attr('fill', _contents.parent().nodeLabelFill.eval);
        },
        textbox(container) {
            const bbox = getBBoxNoThrow(this.selectContent(container).node());
            return {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
        },
        selectContent(container) {
            return container.select('text.node-label');
        },
        selectText(container) {
            return this.selectContent(container);
        },
    };
    return _contents;
}

function withIconContents(contents, width, height) {
    const _contents = {
        parent: property(null).react(parent => {
            contents.parent(parent);
        }),
        padding(n) {
            const padding = nodeLabelPadding(_contents.parent(), n);
            return {
                x: padding.x*3,
                y: padding.y*3,
            };
        },
        update(container) {
            let g = container.selectAll('g.with-icon')
                .data(n => [n]);
            const gEnter = g.enter();
            gEnter.append('g')
                .attr('class', 'with-icon')
                .append('image')
                .attr('class', 'icon')
                .attr('width', `${width}px`)
                .attr('height', `${height}px`);
            g = g.merge(gEnter.select('g.with-icon'));
            g.call(contents.update);
            contents.selectContent(g)
                .attr('transform', `translate(${width/2})`);
            g.selectAll('image.icon')
                .attr('href', _contents.parent().nodeIcon.eval)
                .attr('x', function(n) {
                    const totwid = width+contents.textbox(select(this.parentNode)).width;
                    return -totwid/2-nodeLabelPadding(_contents.parent(), n).x;
                })
                .attr('y', -height/2);
        },
        textbox(container) {
            const box = contents.textbox(container);
            box.x += width/2;
            return box;
        },
        selectContent(container) {
            return container.select('g.with-icon');
        },
        selectText(container) {
            return this.selectContent(container).select('text.node-label');
        },
    };
    return _contents;
}

function portName(nodeId, edgeId, portName) {
    if (!(nodeId || edgeId))
        return null; // must have one key or the other
    if (nodeId) nodeId = nodeId.replace(/\//g, '%2F');
    if (edgeId) edgeId = edgeId.replace(/\//g, '%2F');
    return `${nodeId ? `node/${nodeId}` : `edge/${edgeId}`}/${portName}`;
}
function splitPortName(portname) {
    let parts = portname.split('/');
    console.assert(parts.length === 3);
    parts = parts.map(p => p.replace(/%2F/g, '/'));
    if (parts[0] === 'node')
        return {
            nodeKey: parts[1],
            name: parts[2],
        };
    else return {
            edgeKey: parts[1],
            name: parts[2],
        };
}
function projectPort(diagram, n, p) {
    if (!p.vec) {
        console.assert(!p.edges.length);
        throw new Error(`port has not been placed, maybe install place_ports? ${p.name}`);
    }
    p.pos = diagram.shape(n.dcg_shape.shape).intersect_vec(n, p.vec[0]*1000, p.vec[1]*1000);
}

function placePorts() {
    function received_layout(diagram, nodes, _wnodes, _edges, _wedges, _ports, _wports) {
        const node_ports = diagram.nodePorts();

        function is_ccw(u, v) {
            return u[0]*v[1]-u[1]*v[0] > 0;
        }
        function in_bounds(v, bounds) {
            // assume bounds are ccw
            return is_ccw(bounds[0], v) && is_ccw(v, bounds[1]);
        }
        function clip(v, bounds) {
            if (is_ccw(v, bounds[0]))
                return bounds[0];
            else if (is_ccw(bounds[1], v))
                return bounds[1];
            else return v;
        }
        function a_to_v(a) {
            return [Math.cos(a), Math.sin(a)];
        }
        function v_to_a(v) {
            return Math.atan2(v[1], v[0]);
        }
        function distance(p, p2) {
            return Math.hypot(p2.pos.x-p.pos.x, p2.pos.y-p.pos.y);
        }
        function misses(p, p2) {
            const dist = distance(p, p2);
            const misses = dist > _mode.minDistance();
            return misses;
        }
        function rand_within(a, b) {
            return a+Math.random()*(b-a);
        }
        // calculate port positions
        for (const nid in node_ports) {
            const n = nodes[nid],
                nports = node_ports[nid];

            // make sure that we have vector and angle bounds for any ports with specification
            nports.forEach(p => {
                const bounds = p.orig && diagram.portBounds.eval(p) || [0, 2*Math.PI];
                if (Array.isArray(bounds[0])) {
                    p.vbounds = bounds;
                    p.abounds = bounds.map(v_to_a);
                } else {
                    p.vbounds = bounds.map(a_to_v);
                    p.abounds = bounds;
                }
                if (p.abounds[0] > p.abounds[1])
                    p.abounds[1] += 2*Math.PI;
                console.assert(p.orig || p.vec, 'unplaced unspecified port');
            });

            // determine which ports satisfy bounds or are unplaced
            let inside = [], unplaced = [];
            const outside = [];
            nports.forEach(p => {
                if (!p.vec)
                    unplaced.push(p);
                else if (p.vbounds && !in_bounds(p.vec, p.vbounds))
                    outside.push(p);
                else
                    inside.push(p);
            });

            // shunt outside ports into their bounds
            outside.forEach(p => {
                p.vec = clip(p.vec, p.vbounds);
                inside.push(p);
            });

            // for all unplaced ports that share a bounds, evenly distribute them within those bounds.
            // assume that bounds are disjoint.
            const boundses = {}, boundports = {};
            unplaced.forEach(p => {
                const boundskey = p.abounds.map(x => x.toFixed(3)).join(',');
                boundses[boundskey] = p.abounds;
                boundports[boundskey] = boundports[boundskey] || [];
                boundports[boundskey].push(p);
            });
            for (const b in boundports) {
                const bounds = boundses[b], bports = boundports[b];
                if (bports.length === 1)
                    bports[0].vec = a_to_v((bounds[0]+bounds[1])/2);
                else {
                    const slice = (bounds[1]-bounds[0])/(boundports[b].length-1);
                    boundports[b].forEach((p, i) => {
                        p.vec = a_to_v(bounds[0]+i*slice);
                    });
                }
            }
            inside = inside.concat(unplaced);
            unplaced = [];

            // determine positions of all satisfied
            inside.forEach(p => {
                projectPort(diagram, n, p);
            });

            // detect any existing collisions, unplace the one without edges or second one
            for (let i = 0; i < inside.length; ++i) {
                const x = inside[i];
                if (unplaced.includes(x))
                    continue;
                for (let j = i+1; j < inside.length; ++j) {
                    const y = inside[j];
                    if (unplaced.includes(y))
                        continue;
                    if (!misses(x, y)) {
                        if (!x.edges.length) {
                            unplaced.push(x);
                            continue;
                        } else
                            unplaced.push(y);
                    }
                }
            }
            inside = inside.filter(p => !unplaced.includes(p));

            // place any remaining by trying random spots within the range until it misses all or we give up
            let patience = _mode.patience(), maxdist = 0, maxvec;
            while (unplaced.length) {
                const p = unplaced[0];
                p.vec = a_to_v(rand_within(p.abounds[0], p.abounds[1]));
                projectPort(diagram, n, p);
                const mindist = min(inside, p2 => distance(p, p2));
                if (mindist > maxdist) {
                    maxdist = mindist;
                    maxvec = p.vec;
                }
                if (!patience-- || mindist > _mode.minDistance()) {
                    if (patience < 0) {
                        console.warn('ran out of patience placing a port');
                        p.vec = maxvec;
                        projectPort(diagram, n, p);
                    }
                    inside.push(p);
                    unplaced.shift();
                    patience = _mode.patience();
                    maxdist = 0;
                }
            }
        }
    }
    const _mode = {
        parent: property(null).react(p => {
            if (p) {
                p.on('receivedLayout.place-ports', received_layout);
            } else if (_mode.parent())
                _mode.parent().on('receivedLayout.place-ports', null);
        }),
        // minimum distance between ports
        minDistance: property(20),
        // number of random places to try when resolving collision
        patience: property(20),
    };

    return _mode;
}

const offsetx = ofsx => p => ({x: p.x+ofsx, y: p.y});

const builtinArrows = {
    box: (open, side) => {
        if (!open)
            return {
                frontRef: [8, 0],
                drawFunction: (marker, ofs, stemWidth) => {
                    marker.append('rect')
                        .attr('x', ofs[0])
                        .attr('y', side === 'right' ? -stemWidth/2 : -4)
                        .attr('width', 8)
                        .attr('height', side ? 4+stemWidth/2 : 8)
                        .attr('stroke-width', 0);
                },
            };
        else return {
                frontRef: [8, 0],
                drawFunction: (marker, ofs, stemWidth) => {
                    marker.append('rect')
                        .attr('x', ofs[0]+0.5)
                        .attr('y', side === 'right' ? 0 : -3.5)
                        .attr('width', 7)
                        .attr('height', side ? 3.5 : 7)
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side)
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h', 8].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                },
            };
    },
    curve: (open, side) => ({
        stems: [true, false],
        kernstems: [0, 0.25],
        frontRef: [8, 0],
        drawFunction: (marker, ofs, stemWidth) => {
            const instrs = [];
            instrs.push(
                'M',
                (side === 'left' ? 7.5 : 4)+ofs[0],
                side === 'left' ? stemWidth/2 : 3.5,
            );
            if (side === 'left')
                instrs.push('v', -stemWidth/2);
            instrs.push(
                'A',
                3.5,
                3.5,
                0,
                0,
                0,
                (side === 'right' ? 7.5 : 4)+ofs[0],
                side === 'right' ? 0 : -3.5,
            );
            if (side === 'right')
                instrs.push('v', -stemWidth/2);
            marker.append('svg:path')
                .attr('d', instrs.join(' '))
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            marker.append('svg:path')
                .attr('d', ['M', 7+ofs[0], 0, 'h  -7'].join(' '))
                .attr('stroke-width', stemWidth)
                .attr('fill', 'none');
        },
    }),
    icurve: (open, side) => ({
        stems: [false, true],
        kernstems: [0.25, 0],
        frontRef: [8, 0],
        drawFunction: (marker, ofs, stemWidth) => {
            const instrs = [];
            instrs.push(
                'M',
                (side === 'left' ? 0.5 : 4)+ofs[0],
                side === 'left' ? stemWidth/2 : 3.5,
            );
            if (side === 'left')
                instrs.push('v', -stemWidth/2);
            instrs.push(
                'A',
                3.5,
                3.5,
                0,
                0,
                1,
                (side === 'right' ? 0.5 : 4)+ofs[0],
                side === 'right' ? 0 : -3.5,
            );
            if (side === 'right')
                instrs.push('v', -stemWidth/2);
            marker.append('svg:path')
                .attr('d', instrs.join(' '))
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            marker.append('svg:path')
                .attr('d', ['M', 1+ofs[0], 0, 'h 7'].join(' '))
                .attr('stroke-width', stemWidth)
                .attr('fill', 'none');
        },
    }),
    diamond: (open, side) => {
        if (!open)
            return {
                frontRef: [side ? 11.25 : 12, 0],
                backRef: [side ? 0.75 : 0, 0],
                viewBox: [0, -4, 12, 8],
                stems: [!!side, !!side],
                kernstems: stemWidth => [side ? 0 : .75*stemWidth, side ? 0 : .75*stemWidth],
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [{x: 0, y: 0}];
                    if (side !== 'left')
                        upoints.push({x: 6, y: 4});
                    else
                        upoints.push({x: 6, y: -4});
                    upoints.push({x: 12, y: 0});
                    if (!side)
                        upoints.push({x: 6, y: -4});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, true))
                        .attr('stroke-width', 0);
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', 0.75+ofs[0], 0, 'h 10.5'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
        else return {
                frontRef: [side ? 11.25 : 12, 0],
                backRef: [side ? 0.75 : 0, 0],
                viewBox: [0, -4, 12, 8],
                stems: [!!side, !!side],
                kernstems: stemWidth => [side ? 0 : .75*stemWidth, side ? 0 : .75*stemWidth],
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [{x: 0.9, y: 0}];
                    if (side !== 'left')
                        upoints.push({x: 6, y: 3.4});
                    else
                        upoints.push({x: 6, y: -3.4});
                    upoints.push({x: 11.1, y: 0});
                    if (!side)
                        upoints.push({x: 6, y: -3.4});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, !side))
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', 0.75+ofs[0], 0, 'h 10.5'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
    },
    dot(open, side) {
        if (!open)
            return {
                frontRef: [8, 0],
                stems: [!!side, !!side],
                drawFunction: (marker, ofs, stemWidth) => {
                    if (side) {
                        marker.append('svg:path')
                            .attr(
                                'd',
                                [
                                    'M',
                                    ofs[0],
                                    0,
                                    'A',
                                    4,
                                    4,
                                    0,
                                    0,
                                    side === 'left' ? 1 : 0,
                                    8+ofs[0],
                                    0,
                                ].join(' '),
                            )
                            .attr('stroke-width', 0);
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h 8'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    } else {
                        marker.append('svg:circle')
                            .attr('r', 4)
                            .attr('cx', 4+ofs[0])
                            .attr('cy', 0)
                            .attr('stroke-width', '0px');
                    }
                },
            };
        else return {
                frontRef: [8, 0],
                stems: [!!side, !!side],
                drawFunction: (marker, ofs, stemWidth) => {
                    if (side) {
                        marker.append('svg:path')
                            .attr(
                                'd',
                                [
                                    'M',
                                    0.5+ofs[0],
                                    0,
                                    'A',
                                    3.5,
                                    3.5,
                                    0,
                                    0,
                                    side === 'left' ? 1 : 0,
                                    7.5+ofs[0],
                                    0,
                                ].join(' '),
                            )
                            .attr('stroke-width', 1)
                            .attr('fill', 'none');
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h 8'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    } else {
                        marker.append('svg:circle')
                            .attr('r', 3.5)
                            .attr('cx', 4+ofs[0])
                            .attr('cy', 0)
                            .attr('fill', 'none')
                            .attr('stroke-width', '1px');
                    }
                },
            };
    },
    normal(open, side) {
        if (!open)
            return {
                frontRef: [side ? 8-4/3 : 8, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [0, stemWidth*4/3];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [];
                    if (side === 'left')
                        upoints.push({x: 0, y: 0});
                    else
                        upoints.push({x: 0, y: 3});
                    switch (side) {
                        case 'left':
                            upoints.push({x: 8-stemWidth*4/3, y: -stemWidth/2});
                            break;
                        case 'right':
                            upoints.push({x: 8-stemWidth*4/3, y: stemWidth/2});
                            break;
                        default:
                            upoints.push({x: 8, y: 0});
                    }
                    if (side === 'right')
                        upoints.push({x: 0, y: 0});
                    else
                        upoints.push({x: 0, y: -3});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, true))
                        .attr('stroke-width', '0px');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h', 8-4*stemWidth/3].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
        else return {
                frontRef: [side ? 8-4/3 : 8, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [0, stemWidth*4/3];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    let upoints = [];
                    if (!side) {
                        upoints = [
                            {x: 0.5, y: 2.28},
                            {x: 6.57, y: 0},
                            {x: 0.5, y: -2.28},
                        ];
                    } else {
                        upoints = [
                            {x: 0.5, y: 0},
                            {x: 0.5, y: side === 'left' ? -2.28 : 2.28},
                            {x: 8-4/3, y: 0},
                        ];
                    }
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, !side))
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h', 8-4/3].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
    },
    inv(open, side) {
        if (!open)
            return {
                frontRef: [8, 0],
                backRef: [side ? 4/3 : 0, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [stemWidth*4/3, 0];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [];
                    if (side === 'left')
                        upoints.push({x: 8, y: 0});
                    else
                        upoints.push({x: 8, y: 3});
                    switch (side) {
                        case 'left':
                            upoints.push({x: stemWidth*4/3, y: -stemWidth/2});
                            break;
                        case 'right':
                            upoints.push({x: stemWidth*4/3, y: stemWidth/2});
                            break;
                        default:
                            upoints.push({x: 0, y: 0});
                    }
                    if (side === 'right')
                        upoints.push({x: 8, y: 0});
                    else
                        upoints.push({x: 8, y: -3});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, true))
                        .attr('stroke-width', '0px');
                    if (side) {
                        marker.append('svg:path')
                            .attr(
                                'd',
                                ['M', 4*stemWidth/3+ofs[0], 0, 'h', 8-4*stemWidth/3].join(' '),
                            )
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
        else return {
                frontRef: [8, 0],
                backRef: [side ? 4/3 : 0, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [stemWidth*4/3, 0];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    let upoints = [];
                    if (!side) {
                        upoints = [
                            {x: 7.5, y: 2.28},
                            {x: 1.43, y: 0},
                            {x: 7.5, y: -2.28},
                        ];
                    } else {
                        upoints = [
                            {x: 7.5, y: 0},
                            {x: 7.5, y: side === 'left' ? -2.28 : 2.28},
                            {x: 1.43, y: 0},
                        ];
                    }
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, !side))
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', 4*stemWidth/3+ofs[0], 0, 'h', 8-4/3].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
    },
    tee(open, side) {
        return {
            frontRef: [5, 0],
            viewBox: [0, -5, 5, 10],
            stems: [true, false],
            drawFunction: (marker, ofs, stemWidth) => {
                const b = side === 'right' ? 0 : -5,
                    t = side === 'left' ? 0 : 5;
                const points = [
                    {x: 2, y: t},
                    {x: 5, y: t},
                    {x: 5, y: b},
                    {x: 2, y: b},
                ].map(offsetx(ofs[0]));
                marker.append('svg:path')
                    .attr('d', generatePath(points, 1, true))
                    .attr('stroke-width', '0px');
                marker.append('svg:path')
                    .attr('d', ['M', ofs[0], 0, 'h', 5].join(' '))
                    .attr('stroke-width', stemWidth)
                    .attr('fill', 'none');
            },
        };
    },
    vee(open, side) {
        return {
            stems: [true, false],
            kernstems(stemWidth) {
                return [0, stemWidth];
            },
            drawFunction: (marker, ofs, stemWidth) => {
                const upoints = [
                    {x: 0, y: -5},
                    {x: 10, y: 0},
                    {x: 0, y: 5},
                    {x: 5, y: 0},
                ];
                if (side === 'right')
                    upoints.splice(0, 1, {x: 5, y: -stemWidth/2}, {x: 10, y: -stemWidth/2});
                else if (side === 'left')
                    upoints.splice(2, 1, {x: 10, y: stemWidth/2}, {x: 5, y: stemWidth/2});
                const points = upoints.map(offsetx(ofs[0]));
                marker.append('svg:path')
                    .attr('d', generatePath(points, 1, true))
                    .attr('stroke-width', '0px');
                marker.append('svg:path')
                    .attr('d', ['M', ofs[0]+5, 0, 'h', -5].join(' '))
                    .attr('stroke-width', stemWidth);
            },
        };
    },
    crow(open, side) {
        return {
            stems: [false, true],
            kernstems(stemWidth) {
                return [stemWidth, 0];
            },
            drawFunction: (marker, ofs, stemWidth) => {
                const upoints = [
                    {x: 10, y: -5},
                    {x: 0, y: 0},
                    {x: 10, y: 5},
                    {x: 5, y: 0},
                ];
                if (side === 'right')
                    upoints.splice(0, 1, {x: 5, y: -stemWidth/2}, {x: 0, y: -stemWidth/2});
                else if (side === 'left')
                    upoints.splice(2, 1, {x: 0, y: stemWidth/2}, {x: 5, y: stemWidth/2});
                const points = upoints.map(offsetx(ofs[0]));
                marker.append('svg:path')
                    .attr('d', generatePath(points, 1, true))
                    .attr('stroke-width', '0px');
                marker.append('svg:path')
                    .attr('d', ['M', ofs[0]+5, 0, 'h', 5].join(' '))
                    .attr('stroke-width', stemWidth);
            },
        };
    },
};

function arrowDef(arrdefs, shape, open, side) {
    return arrdefs[shape](open, side);
}

function arrowParts(arrdefs, desc) {
    // graphviz appears to use a real parser for this
    const parts = [];
    while (desc && desc.length) {
        let mods = /^o?(?:l|r)?/.exec(desc);
        let open = false, side = null;
        if (mods[0]) {
            mods = mods[0];
            desc = desc.slice(mods.length);
            open = mods[0] === 'o';
            switch (mods[mods.length-1]) {
                case 'l':
                    side = 'left';
                    break;
                case 'r':
                    side = 'right';
            }
        }
        let ok = false;
        for (const aname in arrdefs)
            if (desc.substring(0, aname.length) === aname) {
                ok = true;
                parts.push(arrowDef(arrdefs, aname, open, side));
                desc = desc.slice(aname.length);
                break;
            }
        if (!ok) {
            console.warn(`couldn't find arrow name in ${desc}`);
            break;
        }
    }
    return parts;
}

function unionViewbox(vb1, vb2) {
    const left = Math.min(vb1[0], vb2[0]),
        bottom = Math.min(vb1[1], vb2[1]),
        right = Math.max(vb1[0]+vb1[2], vb2[0]+vb2[2]),
        top = Math.max(vb1[1]+vb1[3], vb2[1]+vb2[3]);
    return [left, bottom, right-left, top-bottom];
}

function subtractPoints(p1, p2) {
    return [p1[0]-p2[0], p1[1]-p2[1]];
}

function addPoints(p1, p2) {
    return [p1[0]+p2[0], p1[1]+p2[1]];
}

function multPoint(p, s) {
    return p.map(x => x*s);
}

function defaulted(def) {
    return function(x) {
        return x || def;
    };
}

const view_box = defaulted([0, -5, 10, 10]),
    front_ref = defaulted([10, 0]),
    back_ref = defaulted([0, 0]);

function arrowOffsets(parts, stemWidth) {
    return parts.map((p, i) => {
        const fr = front_ref(p.frontRef).slice(),
            br = back_ref(p.backRef).slice();
        if (p.kernstems) {
            let kernstems = p.kernstems;
            if (typeof kernstems === 'function')
                kernstems = kernstems(stemWidth);
            if (i !== 0 && kernstems[1]) {
                const last = parts[i-1];
                if (last.stems && last.stems[0])
                    fr[0] -= kernstems[1];
            }
            if (kernstems[0]) {
                let kern = false;
                if (i === parts.length-1)
                    kern = true;
                else {
                    const next = parts[i+1];
                    if (next.stems && next.stems[1])
                        kern = true;
                }
                if (kern)
                    br[0] += kernstems[0];
            }
        }
        if (i === 0) {
            const backRef = br;
            return {backRef, offset: [0, 0]};
        } else {
            let backRef = br;
            const ofs = subtractPoints(backRef, fr);
            backRef = addPoints(br, ofs);
            return {backRef, offset: ofs};
        }
    });
}

function arrowBounds(parts, stemWidth) {
    let viewBox = null;
    const offsets = arrowOffsets(parts, stemWidth);
    parts.forEach((p, i) => {
        const vb = view_box(p.viewBox);
        const ofs = offsets[i].offset;
        if (!viewBox)
            viewBox = vb.slice();
        else
            viewBox = unionViewbox(viewBox, [vb[0]+ofs[0], vb[1]+ofs[1], vb[2], vb[3]]);
    });
    return {offsets, viewBox};
}

function arrowLength(parts, stemWidth) {
    if (!parts.length)
        return 0;
    const offsets = arrowOffsets(parts, stemWidth);
    return front_ref(parts[0].frontRef)[0]-offsets[parts.length-1].backRef[0];
}

function scaledArrowLengths(diagram, e) {
    const arrowSize = diagram.edgeArrowSize.eval(e),
        stemWidth = diagram.edgeStrokeWidth.eval(e)/arrowSize;
    const headLength = arrowSize
            *(arrowLength(arrowParts(diagram.arrows(), diagram.edgeArrowhead.eval(e)), stemWidth)
                +diagram.nodeStrokeWidth.eval(e.target)/2),
        tailLength = arrowSize
            *(arrowLength(arrowParts(diagram.arrows(), diagram.edgeArrowtail.eval(e)), stemWidth)
                +diagram.nodeStrokeWidth.eval(e.source)/2);
    return {headLength, tailLength};
}

function clipPathToArrows(headLength, tailLength, path) {
    const points0 = asBezier3(path),
        points = chopBezier(points0, 'head', headLength);
    return {
        bezDegree: 3,
        points: chopBezier(points, 'tail', tailLength),
        sourcePort: path.sourcePort,
        targetPort: path.targetPort,
    };
}

function placeArrowsOnSpline(diagram, e, points) {
    const alengths = scaledArrowLengths(diagram, e);
    const path0 = {
        points,
        bezDegree: 3,
    };
    const path = clipPathToArrows(alengths.headLength, alengths.tailLength, path0);
    return {
        path,
        full: path0,
        orienthead: `${
            angleBetweenPoints(
                path.points[path.points.length-1],
                path0.points[path0.points.length-1],
            )
        }rad`, // calculate_arrowhead_orientation(e.cola.points, 'head'),
        orienttail: `${angleBetweenPoints(path.points[0], path0.points[0])}rad`, // calculate_arrowhead_orientation(e.cola.points, 'tail')
    };
}

// determine pre-transition orientation that won't spin a lot going to new orientation
function unsurprisingOrient(oldorient, neworient) {
    let oldang = +oldorient.slice(0, -3);
    const newang = +neworient.slice(0, -3);
    if (Math.abs(oldang-newang) > Math.PI) {
        if (newang > oldang)
            oldang += 2*Math.PI;
        else oldang -= 2*Math.PI;
    }
    return oldang;
}

function edgeArrow(diagram, arrdefs, e, kind, desc) {
    const id = diagram.arrowId(e, kind);
    let strokeOfs, edgeStroke;
    function arrow_sig() {
        return `${desc}-${strokeOfs}-${edgeStroke}`;
    }
    if (desc) {
        strokeOfs = diagram.nodeStrokeWidth.eval(kind === 'tail' ? e.source : e.target)/2;
        edgeStroke = diagram.edgeStroke.eval(e);
        if (e[`${kind}ArrowLast`] === arrow_sig())
            return id;
    }
    const parts = arrowParts(arrdefs, desc),
        marker = diagram.addOrRemoveDef(id, !!parts.length, 'svg:marker');

    if (parts.length) {
        const arrowSize = diagram.edgeArrowSize.eval(e),
            stemWidth = diagram.edgeStrokeWidth.eval(e)/arrowSize,
            bounds = arrowBounds(parts, stemWidth),
            frontRef = front_ref(parts[0].frontRef);
        bounds.viewBox[0] -= strokeOfs/arrowSize;
        bounds.viewBox[3] += strokeOfs/arrowSize;
        marker
            .attr('viewBox', bounds.viewBox.join(' '))
            .attr('refX', frontRef[0])
            .attr('refY', frontRef[1])
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', bounds.viewBox[2]*arrowSize)
            .attr('markerHeight', bounds.viewBox[3]*arrowSize)
            .attr('stroke', edgeStroke)
            .attr('fill', edgeStroke);
        marker.html(null);
        parts.forEach((p, i) => {
            marker
                .call(
                    p.drawFunction,
                    addPoints([-strokeOfs/arrowSize, 0], bounds.offsets[i].offset),
                    stemWidth,
                );
        });
    }
    e[`${kind}ArrowLast`] = arrow_sig();
    return desc ? id : null;
}

/**
 * Graphviz attributes for layout engines
 * @module graphviz_attrs
 */


/**
 * `graphvizAttrs` defines a basic set of attributes which layout engines should
 * implement - although these are not required, they make it easier for clients and
 * modes (like expand_collapse) to work with multiple layout engines.
 *
 * these attributes are {@link http://www.graphviz.org/doc/info/attrs.html from graphviz}
 * @return {Object}
 */
function graphvizAttrs() {
    return {
        /**
         * Direction to draw ranks.
         * @method rankdir
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [rankdir='TB'] 'TB', 'LR', 'BT', or 'RL'
         */
        rankdir: property('TB'),
        /**
         * Spacing in between nodes in the same rank.
         * @method nodesep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [nodesep=40]
         */
        nodesep: property(40),
        /**
         * Spacing in between ranks.
         * @method ranksep
         * @memberof dc_graph.graphviz_attrs
         * @instance
         * @param {String} [ranksep=40]
         */
        ranksep: property(40),
    };
}

// graphlib-dot seems to wrap nodes in an extra {value}
// actually this is quite a common problem with generic libs
function nvalue(n) {
    return n.value.value ? n.value.value : n.value;
}

// apply standard accessors to a diagram in order to style it as graphviz would
// this is a work in progress
function applyGraphvizAccessors(diagram) {
    diagram
        .nodeLabel(n => {
            let label = nvalue(n).label;
            if (label === undefined)
                label = n.key;
            return label && label.split(/\n|\\n/);
        })
        .nodeRadius(n =>
            // should do width & height instead, #25
            nvalue(n).radius || 25
        )
        .nodeShape(n => nvalue(n).shape)
        .nodeFill(n => nvalue(n).fillcolor || 'white')
        .nodeOpacity(n =>
            // not standard gv
            nvalue(n).opacity || 1
        )
        .nodeLabelFill(n => nvalue(n).fontcolor || 'black')
        .nodeTitle(n =>
            (nvalue(n).htmltip || nvalue(n).jsontip)
                ? null
                : nvalue(n).tooltip !== undefined
                ? nvalue(n).tooltip
                : diagram.nodeLabel()(n)
        )
        .nodeStrokeWidth(n => {
            // it is debatable whether a point === a pixel but they are close
            // https://graphicdesign.stackexchange.com/questions/199/point-vs-pixel-what-is-the-difference
            const penwidth = nvalue(n).penwidth;
            return penwidth !== undefined ? +penwidth : 1;
        })
        .edgeLabel(e => e.value.label ? e.value.label.split(/\n|\\n/) : '')
        .edgeStroke(e => e.value.color || 'black')
        .edgeOpacity(e =>
            // not standard gv
            e.value.opacity || 1
        )
        .edgeArrowSize(e => e.value.arrowsize || 1)
        // need directedness to default these correctly, see #106
        .edgeArrowhead(e => {
            const head = e.value.arrowhead;
            return head !== undefined ? head : 'vee';
        })
        .edgeArrowtail(e => {
            const tail = e.value.arrowtail;
            return tail !== undefined ? tail : null;
        })
        .edgeStrokeDashArray(e => {
            switch (e.value.style) {
                case 'dotted':
                    return [1, 5];
            }
            return null;
        });
    const draw_clusters = diagram.child('draw-clusters');
    if (draw_clusters) {
        draw_clusters
            .clusterStroke(c => c.value.color || 'black')
            .clusterFill(c =>
                c.value.style === 'filled'
                    ? c.value.fillcolor || c.value.color || c.value.bgcolor
                    : null
            )
            .clusterLabel(c => c.value.label);
    }
}

function snapshotGraphviz(diagram) {
    const xDomain = diagram.x().domain(), yDomain = diagram.y().domain();
    return {
        nodes: diagram.nodeGroup().all().map(n => diagram.getWholeNode(n.key))
            .filter(x => x)
            .map(n => ({
                key: diagram.nodeKey.eval(n),
                label: diagram.nodeLabel.eval(n),
                fillcolor: diagram.nodeFillScale()(diagram.nodeFill.eval(n)),
                penwidth: diagram.nodeStrokeWidth.eval(n),
                // not supported as input, see dc.graph.js#25
                // width: n.cola.dcg_rx*2,
                // height: n.cola.dcg_ry*2,

                // not graphviz attributes
                // until we have w/h
                radius: diagram.nodeRadius.eval(n),
                // does not seem to exist in gv
                opacity: diagram.nodeOpacity.eval(n),
                // should be pos
                x: n.cola.x,
                y: n.cola.y,
            })),
        edges: diagram.edgeGroup().all().map(e => diagram.getWholeEdge(e.key)).map(e => ({
            key: diagram.edgeKey.eval(e),
            source: diagram.edgeSource.eval(e),
            target: diagram.edgeTarget.eval(e),
            color: diagram.edgeStroke.eval(e),
            arrowsize: diagram.edgeArrowSize.eval(e),
            opacity: diagram.edgeOpacity.eval(e),
            // should support dir, see dc.graph.js#106
            arrowhead: diagram.edgeArrowhead.eval(e),
            arrowtail: diagram.edgeArrowtail.eval(e),
        })),
        bounds: {
            left: xDomain[0],
            top: yDomain[0],
            right: xDomain[1],
            bottom: yDomain[1],
        },
    };
}

/**
 * Cola.js layout adaptor for dc.graph.js
 * @module cola_layout
 */


/**
 * `colaLayout` is an adaptor for cola.js layouts in dc.graph.js
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} cola layout engine
 */
function colaLayout(id) {
    const _layoutId = id || uuid();
    let _d3cola = null;
    let _setcola_nodes;
    const _dispatch = (globalThis.d3?.dispatch || dispatch)('tick', 'start', 'end');
    let _flowLayout;
    // node and edge objects shared with cola.js, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    const _nodes = {}, _edges = {};
    let _options;

    function init(options) {
        _options = options;
        _d3cola = cola.d3adaptor(globalThis.d3)
            .avoidOverlaps(true)
            .size([options.width, options.height])
            .handleDisconnected(options.handleDisconnected);

        if (_d3cola.tickSize) // non-standard
            _d3cola.tickSize(options.tickSize);

        switch (options.lengthStrategy) {
            case 'symmetric':
                _d3cola.symmetricDiffLinkLengths(options.baseLength);
                break;
            case 'jaccard':
                _d3cola.jaccardLinkLengths(options.baseLength);
                break;
            case 'individual':
                _d3cola.linkDistance(e => e.dcg_edgeLength || options.baseLength);
                break;
        }
        if (options.flowLayout) {
            _d3cola.flowLayout(options.flowLayout.axis, options.flowLayout.minSeparation);
        }
    }

    function data(nodes, edges, clusters, constraints) {
        let wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.dcg_nodeParentCluster = v.dcg_nodeParentCluster;
            v1.width = v.width;
            v1.height = v.height;
            v1.fixed = !!v.dcg_nodeFixed;
            _options.nodeAttrs.forEach(key => {
                v1[key] = v[key];
            });

            if (v1.fixed && typeof v.dcg_nodeFixed === 'object') {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            } else {
                // should we support e.g. null to unset x,y?
                if (v.x !== undefined)
                    v1.x = v.x;
                if (v.y !== undefined)
                    v1.y = v.y;
            }
        });
        const wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            // cola edges can work with indices or with object references
            // but it will replace indices with object references
            e1.source = _nodes[e.dcg_edgeSource];
            e1.target = _nodes[e.dcg_edgeTarget];
            e1.dcg_edgeLength = e.dcg_edgeLength;
            _options.edgeAttrs.forEach(key => {
                e1[key] = e[key];
            });
        });

        // cola needs each node object to have an index property
        wnodes.forEach((v, i) => {
            v.index = i;
        });

        let groups = null;
        if (engine.groupConnected()) {
            const components = cola.separateGraphs(wnodes, wedges);
            groups = components.map(g => ({
                dcg_autoGroup: true,
                leaves: g.array.map(n => n.index),
            }));
        } else if (clusters) {
            const G = {};
            groups = clusters.filter(c => /^cluster/.test(c.dcg_clusterKey)).map((c, i) =>
                G[c.dcg_clusterKey] = {
                    dcg_clusterKey: c.dcg_clusterKey,
                    index: i,
                    groups: [],
                    leaves: [],
                }
            );
            clusters.forEach(c => {
                if (c.dcg_clusterParent && G[c.dcg_clusterParent])
                    G[c.dcg_clusterParent].groups.push(G[c.dcg_clusterKey].index);
            });
            wnodes.forEach((n, i) => {
                if (n.dcg_nodeParentCluster && G[n.dcg_nodeParentCluster])
                    G[n.dcg_nodeParentCluster].leaves.push(i);
            });
        }

        function dispatchState(event) {
            // Get the actual nodes that WebCola is working with and make copies
            const currentNodes = _d3cola.nodes().map(n => {
                const copy = Object.assign({}, n);
                // clean up extra setcola annotations from the copy
                Object.keys(copy).forEach(key => {
                    if (/^get/.test(key) && typeof copy[key] === 'function')
                        delete copy[key];
                });
                return copy;
            });
            _dispatch.call(
                event,
                null,
                currentNodes,
                wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})),
                groups.filter(g => !g.dcg_autoGroup).map(g => {
                    g = Object.assign({}, g);
                    g.bounds = {
                        left: g.bounds.x,
                        top: g.bounds.y,
                        right: g.bounds.X,
                        bottom: g.bounds.Y,
                    };
                    return g;
                }),
                _setcola_nodes,
            );
        }
        _d3cola.on('tick', /* _tick = */ () => {
            dispatchState('tick');
        }).on('start', () => {
            _dispatch.call('start');
        }).on('end', /* _done = */ () => {
            dispatchState('end');
        });

        if (_options.setcolaSpec && typeof setcola !== 'undefined') {
            console.log('generating setcola constrains');
            const setcola_result = setcola
                .nodes(wnodes)
                .links(wedges)
                .constraints(_options.setcolaSpec)
                .gap(10) // default value is 10, can be customized in setcolaSpec
                .layout();

            _setcola_nodes = setcola_result.nodes.filter(n => n._cid);
            wnodes = setcola_result.nodes;
            _d3cola.nodes(setcola_result.nodes)
                .links(setcola_result.links)
                .constraints(setcola_result.constraints)
                .groups(groups);
        } else {
            _d3cola.nodes(wnodes)
                .links(wedges)
                .constraints(constraints)
                .groups(groups);
        }
    }

    function start() {
        _d3cola.start(
            engine.unconstrainedIterations(),
            engine.userConstraintIterations(),
            engine.allConstraintsIterations(),
            engine.gridSnapIterations(),
        );
    }

    function stop() {
        if (_d3cola)
            _d3cola.stop();
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
    graphviz.rankdir(null);

    const engine = Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'cola';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        supportsMoving() {
            return true;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            this.propagateOptions(options);
            init(options);
            return this;
        },
        data(graph, nodes, edges, clusters, constraints) {
            data(nodes, edges, clusters, constraints);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return [
                'handleDisconnected',
                'lengthStrategy',
                'baseLength',
                'flowLayout',
                'tickSize',
                'groupConnected',
                'setcolaSpec',
                'setcolaNodes',
                'unconstrainedIterations',
                'userConstraintIterations',
                'allConstraintsIterations',
                'gridSnapIterations',
            ]
                .concat(graphviz_keys);
        },
        passThru() {
            return ['extractNodeAttrs', 'extractEdgeAttrs'];
        },
        propagateOptions(options) {
            if (!options.nodeAttrs)
                options.nodeAttrs = Object.keys(engine.extractNodeAttrs());
            if (!options.edgeAttrs)
                options.edgeAttrs = Object.keys(engine.extractEdgeAttrs());
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
        /**
         * Instructs cola.js to fit the connected components.
         * @method handleDisconnected
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Boolean} [handleDisconnected=true]
         * @return {Boolean}
         * @return {dc_graph.cola_layout}
         */
        handleDisconnected: property(true),
        /**
         * Currently, three strategies are supported for specifying the lengths of edges:
         * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
         * `baseLength`
         * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
         * the edge. See
         * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
         * for more details.
         * 'none' - no edge lengths will be specified
         * @method lengthStrategy
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Function|String} [lengthStrategy='symmetric']
         * @return {Function|String}
         * @return {dc_graph.cola_layout}
         */
        lengthStrategy: property('symmetric'),
        /**
         * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
         * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
         * lengths.
         * @method baseLength
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Number} [baseLength=30]
         * @return {Number}
         * @return {dc_graph.cola_layout}
         */
        baseLength: property(30),
        /**
         * If `flowLayout` is set, it determines the axis and separation for
         * {@link http://marvl.infotech.monash.edu/webcola/doc/classes/cola.layout.html#flowlayout cola flow layout}.
         * If it is not set, `flowLayout` will be calculated from the {@link dc_graph.graphviz_attrs#rankdir rankdir}
         * and {@link dc_graph.graphviz_attrs#ranksep ranksep}; if `rankdir` is also null (the
         * default for cola layout), then there will be no flow.
         * @method flowLayout
         * @memberof dc_graph.cola_layout
         * @instance
         * @param {Object} [flowLayout=null]
         * @example
         * // No flow (default)
         * diagram.flowLayout(null)
         * // flow in x with min separation 200
         * diagram.flowLayout({axis: 'x', minSeparation: 200})
         */
        flowLayout(flow) {
            if (!arguments.length) {
                if (_flowLayout)
                    return _flowLayout;
                const dir = engine.rankdir();
                switch (dir) {
                    case 'LR':
                        return {
                            axis: 'x',
                            minSeparation: engine.ranksep()+engine.parent().nodeRadius()*2,
                        };
                    case 'TB':
                        return {
                            axis: 'y',
                            minSeparation: engine.ranksep()+engine.parent().nodeRadius()*2,
                        };
                    default:
                        return null; // RL, BT do not appear to be possible (negative separation) (?)
                }
            }
            _flowLayout = flow;
            return this;
        },
        unconstrainedIterations: property(10),
        userConstraintIterations: property(20),
        allConstraintsIterations: property(20),
        gridSnapIterations: property(0),
        tickSize: property(1),
        groupConnected: property(false),
        setcolaSpec: property(null),
        setcolaNodes() {
            return _setcola_nodes;
        },
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({}),
        processExtraWorkerResults(setcolaNodes) {
            _setcola_nodes = setcolaNodes;
        },
    });
    return engine;
}

// Scripts needed for web worker
colaLayout.scripts = ['d3.js', 'cola.js'];
colaLayout.optionalScripts = ['setcola.js'];

/**
 * Dagre.js layout adaptor for dc.graph.js
 * @module dagre_layout
 */


/**
 * `dagreLayout` is an adaptor for dagre.js layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `dagreLayout` also implements the attributes from
 * {@link graphvizAttrs graphviz_attrs}
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} dagre layout engine
 */
function dagreLayout(id) {
    const _layoutId = id || uuid();
    let _dagreGraph = null, _done;
    const _dispatch = dispatch('tick', 'start', 'end');
    // node and edge objects preserved from one iteration
    // to the next (as long as the object is still in the layout)
    const _nodes = {}, _edges = {};

    function init(options) {
        // Create a new directed graph
        _dagreGraph = new dagre.graphlib.Graph({multigraph: true, compound: true});

        // Set an object for the graph label
        _dagreGraph.setGraph({
            rankdir: options.rankdir,
            nodesep: options.nodesep,
            ranksep: options.ranksep,
        });

        // Default to assigning a new object as a label for each new edge.
        _dagreGraph.setDefaultEdgeLabel(() => ({}));
    }

    function data(nodes, edges, clusters) {
        const wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            /*
              dagre does not seem to accept input positions
              if(v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
              }
             */
        }, (k, o) => {
            _dagreGraph.setNode(k, o);
        }, k => {
            _dagreGraph.removeNode(k);
        });
        const wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, (k, o, e) => {
            _dagreGraph.setEdge(e.dcg_edgeSource, e.dcg_edgeTarget, o);
        }, (k, e) => {
            _dagreGraph.removeEdge(e.dcg_edgeSource, e.dcg_edgeTarget, e.dcg_edgeKey);
        });
        clusters = clusters.filter(c => /^cluster/.test(c.dcg_clusterKey));
        clusters.forEach(c => {
            _dagreGraph.setNode(c.dcg_clusterKey, c);
        });
        clusters.forEach(c => {
            if (c.dcg_clusterParent)
                _dagreGraph.setParent(c.dcg_clusterKey, c.dcg_clusterParent);
        });
        nodes.forEach(n => {
            if (n.dcg_nodeParentCluster)
                _dagreGraph.setParent(n.dcg_nodeKey, n.dcg_nodeParentCluster);
        });

        function dispatchState(event) {
            _dispatch.call(
                event,
                null,
                wnodes,
                wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})),
                clusters.map(c => {
                    const cluster = Object.assign({}, _dagreGraph.node(c.dcg_clusterKey));
                    cluster.bounds = {
                        left: cluster.x-cluster.width/2,
                        top: cluster.y-cluster.height/2,
                        right: cluster.x+cluster.width/2,
                        bottom: cluster.y+cluster.height/2,
                    };
                    return cluster;
                }),
            );
        }
        _done = function() {
            dispatchState('end');
        };
    }

    function start(_options) {
        _dispatch.call('start');
        dagre.layout(_dagreGraph);
        _done();
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'dagre';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges, clusters) {
            data(nodes, edges, clusters);
        },
        start() {
            start();
        },
        stop() {
        },
        optionNames() {
            return graphviz_keys;
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
    });
}

function nodeName(i) {
    // a-z, A-Z, aa-Zz, then quit
    if (i < 26)
        return String.fromCharCode(97+i);
    else if (i < 52)
        return String.fromCharCode(65+i-26);
    else if (i < 52*52)
        return nodeName(Math.floor(i/52))+nodeName(i%52);
    else throw new Error("no, that's too large");
}
function nodeObject(i, attrs) {
    attrs = attrs || {};
    return {
        id: i,
        name: nodeName(i),
        ...attrs,
    };
}

function edgeObject(namef, i, j, attrs) {
    attrs = attrs || {};
    return {
        source: i,
        target: j,
        sourcename: namef(i),
        targetname: namef(j),
        ...attrs,
    };
}

function generate(type, args, env, callback) {
    let nodes, edges, i, j;
    const nodePrefix = env.nodePrefix || '';
    const namef = function(i) {
        return nodes[i].name;
    };
    const N = args[0];
    const linkLength = env.linkLength || 30;
    switch (type) {
        case 'clique':
        case 'cliquestf':
            nodes = new Array(N);
            edges = [];
            for (i = 0; i < N; ++i) {
                nodes[i] = nodeObject(i, {circle: 'A', name: nodePrefix+nodeName(i)});
                for (j = 0; j < i; ++j)
                    edges.push(edgeObject(namef, i, j, {notLayout: true, undirected: true}));
            }
            if (type === 'cliquestf') {
                for (i = 0; i < N; ++i) {
                    nodes[i+N] = nodeObject(i+N);
                    nodes[i+2*N] = nodeObject(i+2*N);
                    edges.push(edgeObject(namef, i, i+N, {undirected: true}));
                    edges.push(edgeObject(namef, i, i+2*N, {undirected: true}));
                }
            }
            break;
        case 'wheel': {
            nodes = new Array(N);
            for (i = 0; i < N; ++i)
                nodes[i] = nodeObject(i, {name: nodePrefix+nodeName(i)});
            edges = wheelEdges(namef, range(N), N*linkLength/2);
            const rimLength = edges[0].distance;
            for (i = 0; i < args[1]; ++i)
                for (j = 0; j < N; ++j) {
                    let a = j, b = (j+1)%N, t;
                    if (i%2 === 1) {
                        t = a;
                        a = b;
                        b = t;
                    }
                    edges.push(edgeObject(namef, a, b, {distance: rimLength, par: i+2}));
                }
            break;
        }
        default:
            throw new Error(`unknown generation type ${type}`);
    }
    const graph = {nodes, links: edges};
    callback(null, graph);
}

function wheelEdges(namef, nindices, R) {
    const N = nindices.length;
    const edges = [];
    const strutSkip = Math.floor(N/2),
        rimLength = 2*R*Math.sin(Math.PI/N),
        strutLength = 2*R*Math.sin(strutSkip*Math.PI/N);
    let i;
    for (i = 0; i < N; ++i)
        edges.push(edgeObject(namef, nindices[i], nindices[(i+1)%N], {distance: rimLength}));
    for (i = 0; i < N/2; ++i) {
        edges.push(
            edgeObject(namef, nindices[i], nindices[(i+strutSkip)%N], {distance: strutLength}),
        );
        if (N%2 && i != Math.floor(N/2))
            edges.push(
                edgeObject(namef, nindices[i], nindices[(i+N-strutSkip)%N], {
                    distance: strutLength,
                }),
            );
    }
    return edges;
}

function randomGraph(options) {
    options = Object.assign({
        ncolors: 5,
        ndashes: 4,
        nodeKey: 'key',
        edgeKey: 'key',
        sourceKey: 'sourcename',
        targetKey: 'targetname',
        colorTag: 'color',
        dashTag: 'dash',
        nodeKeyGen(i) {
            return `n${i}`;
        },
        edgeKeyGen(i) {
            return `e${i}`;
        },
        newComponentProb: 0.1,
        newNodeProb: 0.9,
        removeEdgeProb: 0.75,
        allowParallelEdges: true,
        log: false,
    }, options);
    if (isNaN(options.newNodeProb))
        options.newNodeProb = 0.9;
    if (options.newNodProb <= 0)
        options.newNodeProb = 0.1;
    const _nodes = [], _edges = [];
    function new_node() {
        const n = {};
        n[options.nodeKey] = options.nodeKeyGen(_nodes.length);
        n[options.colorTag] = Math.floor(Math.random()*options.ncolors);
        _nodes.push(n);
        return n;
    }
    function random_node() {
        return _nodes[Math.floor(Math.random()*_nodes.length)];
    }
    return {
        nodes() {
            return _nodes;
        },
        edges() {
            return _edges;
        },
        generate(N) {
            const edgeInserted = {};
            while (N > 0) {
                const choice = Math.random();
                let n1, n2;
                if (!_nodes.length || choice < options.newComponentProb) {
                    n1 = new_node();
                    N--;
                } else
                    n1 = random_node();
                if (choice < options.newNodeProb) {
                    n2 = new_node();
                    N--;
                } else
                    n2 = random_node();
                if (n1 && n2) {
                    const edge = {};
                    edge[options.edgeKey] = options.edgeKeyGen(_edges.length);
                    const sourceKey = n1[options.nodeKey], targetKey = n2[options.nodeKey];
                    if (!options.allowParallelEdges) {
                        if (edgeInserted[sourceKey] && edgeInserted[sourceKey][targetKey])
                            continue;
                        edgeInserted[sourceKey] = edgeInserted[sourceKey] || {};
                        edgeInserted[sourceKey][targetKey] = true;
                    }
                    edge[options.sourceKey] = sourceKey;
                    edge[options.targetKey] = targetKey;
                    edge[options.dashTag] = Math.floor(Math.random()*options.ndashes);
                    if (options.log)
                        console.log(`${n1[options.nodeKey]} -> ${n2[options.nodeKey]}`);
                    _edges.push(edge);
                }
            }
        },
        remove(N) {
            while (N-- > 0) {
                const choice = Math.random();
                if (choice < options.removeEdgeProb)
                    _edges.splice(Math.floor(Math.random()*_edges.length), 1);
                else {
                    const n = _nodes[Math.floor(Math.random()*_nodes.length)];
                    const eis = [];
                    _edges.forEach((e, ei) => {
                        if (
                            e[options.sourceKey] === n[options.nodeKey]
                            || e[options.targetKey] === n[options.nodeKey]
                        )
                            eis.push(ei);
                    });
                    eis.reverse().forEach(ei => {
                        _edges.splice(ei, 1);
                    });
                }
            }
        },
    };
}

function mode(event_namespace, options) {
    const _mode = {};
    const _eventName = options.laterDraw ? 'transitionsStarted' : 'drawn';
    let draw = options.draw, remove = options.remove;
    const supported_renderers = options.renderers || ['svg'];

    if (!draw) {
        console.warn('behavior.add_behavior has been replaced by mode.draw');
        draw = options.add_behavior;
    }
    if (!remove) {
        console.warn('behavior.remove_behavior has been replaced by mode.remove');
        remove = options.remove_behavior;
    }

    /**
     #### .parent([object])
     Assigns this mode to a diagram.
     **/
    _mode.parent = property(null)
        .react(p => {
            let diagram;
            if (p) {
                let first = true;
                diagram = p;
                p.on(`${_eventName}.${event_namespace}`, function() {
                    const args2 = [diagram].concat(Array.prototype.slice.call(arguments));
                    draw.apply(null, args2);
                    if (first && options.first) {
                        options.first.apply(null, args2);
                        first = false;
                    } else if (options.rest)
                        options.rest.apply(null, args2);
                });
                p.on(`reset.${event_namespace}`, () => {
                    const rend = diagram.renderer(),
                        node = rend.selectAllNodes ? rend.selectAllNodes() : null,
                        edge = rend.selectAllEdges ? rend.selectAllEdges() : null,
                        edgeHover = rend.selectAllEdges ? rend.selectAllEdges('.edge-hover') : null;
                    remove(diagram, node, edge, edgeHover);
                });
            } else if (_mode.parent()) {
                diagram = _mode.parent();
                diagram.on(`${_eventName}.${event_namespace}`, (node, edge, ehover) => {
                    remove(diagram, node, edge, ehover);
                    diagram.on(`${_eventName}.${event_namespace}`, null);
                });
            }
            options.parent && options.parent(p);
        });

    _mode.supportsRenderer = function(rendererType) {
        return supported_renderers.includes(rendererType);
    };

    return _mode;
}

const behavior = deprecateFunction('behavior has been renamed mode', mode);

function keyboard() {
    const _dispatch = dispatch('keydown', 'keyup', 'modkeyschanged');
    const _unique_id = `keyboard${Math.floor(Math.random()*100000)}`;
    const _mod_keys = set$2(['Shift', 'Control', 'Alt', 'Meta']);
    let _pressed = set$2();

    function pressed() {
        return _pressed.values().sort();
    }
    function keydown() {
        if (_mod_keys.has(event.key)) {
            _pressed.add(event.key);
            _dispatch.call('modkeyschanged', null, pressed());
        }
        _dispatch.call('keydown', null, event);
    }
    function keyup() {
        if (_mod_keys.has(event.key)) {
            _pressed.remove(event.key);
            _dispatch.call('modkeyschanged', null, pressed());
        }
        _dispatch.call('keyup', null, event);
    }
    function clear() {
        if (!_pressed.empty()) {
            _pressed = set$2();
            _dispatch.call('modkeyschanged', null, pressed());
        }
    }
    function draw(_diagram) {
        select(window)
            .on(`keydown.${_unique_id}`, keydown)
            .on(`keyup.${_unique_id}`, keyup)
            .on(`blur.${_unique_id}`, clear);
    }
    function remove(_diagram) {
        select(window)
            .on(`keydown.${_unique_id}`, null)
            .on(`keyup.${_unique_id}`, null)
            .on(`blur.${_unique_id}`, null);
    }
    const _mode = mode('brush', {
        draw,
        remove,
    });

    _mode.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };

    _mode.modKeysPressed = function() {
        return pressed();
    };
    _mode.modKeysMatch = function(keys, ignoreKeys) {
        const pressed = set$2(_pressed.values());
        if (ignoreKeys) {
            if (!Array.isArray(ignoreKeys))
                ignoreKeys = [ignoreKeys];
            ignoreKeys.forEach(_key => pressed.remove(_key));
        }
        if (!keys || keys.length === 0)
            return pressed.empty();
        if (!Array.isArray(keys))
            keys = [keys];
        const pv = pressed.values();
        if (pv.length !== keys.length)
            return false;
        return keys.slice().sort().every((k, i) => k === pv[i]);
    };

    return _mode;
}

function renderSvg() {
    let _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    let _animating = false; // do not refresh during animations
    let _zoom;
    const _renderer = {};

    _renderer.rendererType = function() {
        return 'svg';
    };

    _renderer.parent = property(null);

    _renderer.renderNode = _renderer._enterNode = function(nodeEnter) {
        if (_renderer.parent().nodeTitle())
            nodeEnter.append('title');
        nodeEnter.each(inferShape(_renderer.parent()));
        _renderer.parent().forEachShape(nodeEnter, (shape, node) => {
            node.call(shape.create);
        });
        return _renderer;
    };
    _renderer.redrawNode = _renderer._updateNode = function(node) {
        const changedShape = node.filter(shapeChanged(_renderer.parent()));
        changedShape.selectAll('.node-outline,.node-fill').remove();
        changedShape.each(inferShape(_renderer.parent()));
        _renderer.parent().forEachShape(changedShape, (shape, node) => {
            node.call(shape.create);
        });
        node.select('title')
            .text(_renderer.parent().nodeTitle.eval);
        _renderer.parent().forEachContent(node, (contentType, node) => {
            node.call(contentType.update);
            _renderer.parent().forEachShape(contentType.selectContent(node), (shape, content) => {
                content
                    .call(fitShape(shape, _renderer.parent()));
            });
        });
        // Ensure nodes without content also get their dimensions calculated
        const nodesWithoutContent = node.filter(n => !_renderer.parent().nodeContent.eval(n));
        _renderer.parent().forEachShape(nodesWithoutContent, (shape, node) => {
            node.call(fitShape(shape, _renderer.parent()));
        });
        _renderer.parent().forEachShape(node, (shape, node) => {
            node.call(shape.update);
        });
        node.select('.node-fill')
            .attr(
                'fill',
                compose(
                    _renderer.parent().nodeFillScale() || identity$2,
                    _renderer.parent().nodeFill.eval,
                ),
            );
        node.select('.node-outline')
            .attr('stroke', _renderer.parent().nodeStroke.eval)
            .attr('stroke-width', _renderer.parent().nodeStrokeWidth.eval)
            .attr('stroke-dasharray', _renderer.parent().nodeStrokeDashArray.eval);
        return _renderer;
    };
    _renderer.redrawEdge = _renderer._updateEdge = function(edge, edgeArrows) {
        edge
            .attr('stroke', _renderer.parent().edgeStroke.eval)
            .attr('stroke-width', _renderer.parent().edgeStrokeWidth.eval)
            .attr('stroke-dasharray', _renderer.parent().edgeStrokeDashArray.eval);
        edgeArrows
            .attr('marker-end', e => {
                const name = _renderer.parent().edgeArrowhead.eval(e),
                    id = edgeArrow(
                        _renderer.parent(),
                        _renderer.parent().arrows(),
                        e,
                        'head',
                        name,
                    );
                return id ? `url(#${id})` : null;
            })
            .attr('marker-start', e => {
                const name = _renderer.parent().edgeArrowtail.eval(e),
                    arrow_id = edgeArrow(
                        _renderer.parent(),
                        _renderer.parent().arrows(),
                        e,
                        'tail',
                        name,
                    );
                return name ? `url(#${arrow_id})` : null;
            })
            .each(e => {
                _renderer.parent().edgeStroke.eval(e);
                _renderer.selectAll(`#${_renderer.parent().arrowId(e, 'head')}`)
                    .attr('fill', _renderer.parent().edgeStroke.eval(e));
                _renderer.selectAll(`#${_renderer.parent().arrowId(e, 'tail')}`)
                    .attr('fill', _renderer.parent().edgeStroke.eval(e));
            });
    };

    _renderer.selectAllNodes = function(selector) {
        selector = selector || '.node';
        return _nodeLayer && _nodeLayer.selectAll(selector).filter(n => !n.deleted)
            || selectAll('.foo-this-does-not-exist');
    };

    _renderer.selectAllEdges = function(selector) {
        selector = selector || '.edge';
        return _edgeLayer && _edgeLayer.selectAll(selector).filter(e => !e.deleted)
            || selectAll('.foo-this-does-not-exist');
    };

    _renderer.selectAllDefs = function(selector) {
        return _defs && _defs.selectAll(selector).filter(def => !def.deleted)
            || selectAll('.foo-this-does-not-exist');
    };

    _renderer.resize = function(w, h) {
        if (_svg) {
            _svg.attr(
                'width',
                w
                    || (_renderer.parent().width_is_automatic()
                        ? '100%'
                        : _renderer.parent().width()),
            )
                .attr(
                    'height',
                    h || (_renderer.parent().height_is_automatic()
                        ? '100%'
                        : _renderer.parent().height()),
                );
        }
        return _renderer;
    };

    _renderer.rezoom = function(oldWidth, oldHeight, newWidth, newHeight) {
        const currentTransform = transform(_svg.node());
        const scale = currentTransform.k, translate = [currentTransform.x, currentTransform.y];
        _svg.call(_zoom.transform, identity);
        const xDomain = _renderer.parent().x().domain(), yDomain = _renderer.parent().y().domain();
        _renderer.parent().x()
            .domain([xDomain[0], xDomain[0]+(xDomain[1]-xDomain[0])*newWidth/oldWidth])
            .range([0, newWidth]);
        _renderer.parent().y()
            .domain([yDomain[0], yDomain[0]+(yDomain[1]-yDomain[0])*newHeight/oldHeight])
            .range([0, newHeight]);
        // D3 v5: apply the transform directly instead of using .x()/.y() methods
        _svg.call(_zoom.transform, identity.translate(translate[0], translate[1]).scale(scale));
    };

    _renderer.globalTransform = function(pos, scale, animate) {
        // _translate = pos;
        // _scale = scale;
        let obj = _g;
        if (animate)
            obj = _g.transition().duration(_renderer.parent().zoomDuration());
        obj.attr('transform', `translate(${pos})`+` scale(${scale})`);
    };

    _renderer.translate = function(_) {
        if (!arguments.length) {
            const transform$1 = transform(_svg.node());
            return [transform$1.x, transform$1.y];
        }
        const currentTransform = transform(_svg.node());
        _svg.call(_zoom.transform, identity.translate(_[0], _[1]).scale(currentTransform.k));
        return this;
    };

    _renderer.scale = function(_) {
        if (!arguments.length) {
            if (!_zoom) return 1;
            const transform$1 = transform(_svg.node());
            return transform$1.k;
        }
        const currentTransform = transform(_svg.node());
        _svg.call(
            _zoom.transform,
            identity.translate(currentTransform.x, currentTransform.y).scale(_),
        );
        return this;
    };

    _renderer.commitTranslateScale = function() {
        return this;
    };

    _renderer.zoom = function(_) {
        if (!arguments.length)
            return _zoom;
        _zoom = _; // is this a good idea?
        return _renderer;
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        // create edge SVG elements
        let edge = _edgeLayer.selectAll('.edge')
            .data(wedges, _renderer.parent().edgeKey.eval);

        const edgeExit = edge.exit();
        edgeExit.each(e => {
            e.deleted = true;
        });
        const duration = _renderer.parent().stagedDuration();
        if (duration === 0) {
            edgeExit.remove();
        } else {
            edgeExit.transition()
                .duration(duration)
                .delay(_renderer.parent().deleteDelay())
                .attr('opacity', 0)
                .on('end', function() {
                    console.log('render_svg: transition end, removing edge element');
                    select(this).remove();
                });
        }

        // Handle enter selection
        const edgeEnter = edge.enter().append('svg:path')
            .attr('class', 'edge')
            .attr('id', _renderer.parent().edgeId)
            .attr('opacity', 0)
            .each(e => {
                e.deleted = false;
            });

        edge = edge.merge(edgeEnter);

        let edgeArrows = _edgeLayer.selectAll('.edge-arrows')
            .data(wedges, _renderer.parent().edgeKey.eval);
        const edgeArrowsEnter = edgeArrows.enter().append('svg:path')
            .attr('class', 'edge-arrows')
            .attr('id', d => `${_renderer.parent().edgeId(d)}-arrows`)
            .attr('fill', 'none')
            .attr('opacity', 0);
        const edgeArrowsExit = edgeArrows.exit();
        edgeArrowsExit.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .on('end', function(e) {
                edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'head', null);
                edgeArrow(_renderer.parent(), _renderer.parent().arrows(), e, 'tail', null);
                select(this).remove();
            });
        if (_renderer.parent().stagedDuration() === 0) {
            edgeArrowsExit.remove();
        }
        edgeArrows = edgeArrows.merge(edgeArrowsEnter);

        if (_renderer.parent().edgeSort()) {
            edge.sort((a, b) => {
                const as = _renderer.parent().edgeSort.eval(a),
                    bs = _renderer.parent().edgeSort.eval(b);
                return as < bs ? -1 : bs < as ? 1 : 0;
            });
        }

        // another wider copy of the edge just for hover events
        let edgeHover = _edgeLayer.selectAll('.edge-hover')
            .data(wedges, _renderer.parent().edgeKey.eval);
        const edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'edge-hover')
            .attr('opacity', 0)
            .attr('fill', 'none')
            .attr('stroke', 'green')
            .attr('stroke-width', 10)
            .on('mouseover.diagram', e => {
                _renderer.select(`#${_renderer.parent().edgeId(e)}-label`)
                    .attr('visibility', 'visible');
            })
            .on('mouseout.diagram', e => {
                _renderer.select(`#${_renderer.parent().edgeId(e)}-label`)
                    .attr('visibility', 'hidden');
            });
        edgeHover.exit().remove();
        edgeHover = edgeHover.merge(edgeHoverEnter);

        let edgeLabels = _edgeLayer.selectAll('g.edge-label-wrapper')
            .data(wedges, _renderer.parent().edgeKey.eval);
        const edgeLabelsEnter = edgeLabels.enter()
            .append('g')
            .attr('class', 'edge-label-wrapper')
            .attr('visibility', 'hidden')
            .attr('id', e => `${_renderer.parent().edgeId(e)}-label`);
        const edgeLabelsExit = edgeLabels.exit();
        edgeLabelsExit.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .on('end', function() {
                select(this).remove();
            });
        if (_renderer.parent().stagedDuration() === 0) {
            edgeLabelsExit.remove();
        }
        edgeLabels = edgeLabels.merge(edgeLabelsEnter);

        let textPaths = _defs.selectAll('path.edge-label-path')
            .data(wedges, _renderer.parent().textpathId);
        const textPathsEnter = textPaths.enter()
            .append('svg:path')
            .attr('class', 'edge-label-path')
            .attr('id', _renderer.parent().textpathId);
        textPaths.exit().remove();
        textPaths = textPaths.merge(textPathsEnter);

        // create node SVG elements
        let node = _nodeLayer.selectAll('.node')
            .data(wnodes, _renderer.parent().nodeKey.eval);
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('opacity', '0') // don't show until has layout
            .each(n => {
                n.deleted = false;
            });
        const nodeExit = node.exit().each(n => {
            n.deleted = true;
        });
        nodeExit.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(_renderer.parent().deleteDelay())
            .attr('opacity', 0)
            .on('end', function() {
                select(this).remove();
            });
        if (_renderer.parent().stagedDuration() === 0) {
            nodeExit.remove();
        }
        node = node.merge(nodeEnter);
        // .call(_d3cola.drag);

        _renderer.renderNode(nodeEnter);

        dispatch.call('drawn', null, node, edge, edgeHover);

        const drawState = {
            node,
            nodeEnter,
            edge,
            edgeEnter,
            edgeHover,
            edgeHoverEnter,
            edgeLabels,
            edgeLabelsEnter,
            edgeArrows,
            edgeArrowsEnter,
            textPaths,
            textPathsEnter,
        };

        _refresh(drawState);

        return drawState;
    };

    function _refresh(drawState) {
        _renderer.redrawEdge(drawState.edge, drawState.edgeArrows);
        _renderer.redrawNode(drawState.node);
        _renderer.drawPorts(drawState);
    }

    _renderer.refresh = function(node, edge, edgeHover, edgeLabels, textPaths) {
        if (_animating)
            return this; // but what about changed attributes?
        node = node || _renderer.selectAllNodes();
        edge = edge || _renderer.selectAllEdges();
        const edgeArrows = _renderer.selectAllEdges('.edge-arrows');
        _refresh({node, edge, edgeArrows});

        edgeHover = edgeHover || _renderer.selectAllEdges('.edge-hover');
        edgeLabels = edgeLabels || _renderer.selectAllEdges('.edge-label-wrapper');
        textPaths = textPaths || _renderer.selectAllDefs('path.edge-label-path');
        const nullSel = select(null); // no enters
        draw(
            node,
            nullSel,
            edge,
            nullSel,
            edgeHover,
            nullSel,
            edgeLabels,
            nullSel,
            edgeArrows,
            nullSel,
            textPaths,
            nullSel,
            false,
        );
        return this;
    };

    _renderer.reposition = function(node, edge) {
        node
            .attr('transform', n => `translate(${n.cola.x},${n.cola.y})`);
        // reset edge ports
        edge.each(e => {
            e.pos.new = null;
            e.pos.old = null;
            e.cola.points = null;
            _renderer.parent().calcEdgePath(
                e,
                'new',
                e.source.cola.x,
                e.source.cola.y,
                e.target.cola.x,
                e.target.cola.y,
            );
            if (_renderer.parent().edgeArrowhead.eval(e))
                _renderer.select(`#${_renderer.parent().arrowId(e, 'head')}`)
                    .attr('orient', () => e.pos.new.orienthead);
            if (_renderer.parent().edgeArrowtail.eval(e))
                _renderer.select(`#${_renderer.parent().arrowId(e, 'tail')}`)
                    .attr('orient', () => e.pos.new.orienttail);
            _renderer.select(`#${_renderer.parent().edgeId(e)}-arrows`)
                .attr('d', generate_edge_path('new', true));
        })
            .attr('d', generate_edge_path('new'));
        return this;
    };

    function generate_edge_path(age, full) {
        const field = full ? 'full' : 'path';
        return function(e) {
            const path = e.pos?.[age]?.[field];
            if (!path) return '';
            return generatePath(path.points, path.bezDegree);
        };
    }

    function generate_edge_label_path(age) {
        return function(e) {
            const path = e.pos?.[age]?.path;
            if (!path) return '';
            const points = path.points[path.points.length-1].x < path.points[0].x
                ? path.points.slice(0).reverse()
                : path.points;
            return generatePath(points, path.bezDegree);
        };
    }

    function with_rad(f) {
        return function() {
            return `${f.apply(this, arguments)}rad`;
        };
    }

    function unsurprising_orient_rad(oldorient, neworient) {
        return with_rad(unsurprisingOrient)(oldorient, neworient);
    }

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    _renderer.draw = function(drawState, animatePositions) {
        draw(
            drawState.node,
            drawState.nodeEnter,
            drawState.edge,
            drawState.edgeEnter,
            drawState.edgeHover,
            drawState.edgeHoverEnter,
            drawState.edgeLabels,
            drawState.edgeLabelsEnter,
            drawState.edgeArrows,
            drawState.edgeArrowsEnter,
            drawState.textPaths,
            drawState.textPathsEnter,
            animatePositions,
        );
    };

    function draw(
        node,
        nodeEnter,
        edge,
        edgeEnter,
        edgeHover,
        edgeHoverEnter,
        edgeLabels,
        edgeLabelsEnter,
        edgeArrows,
        edgeArrowsEnter,
        textPaths,
        textPathsEnter,
        animatePositions,
    ) {
        console.assert(edge.data().every(has_source_and_target));

        const nodeEntered = {};
        nodeEnter
            .each(n => {
                nodeEntered[_renderer.parent().nodeKey.eval(n)] = true;
            })
            .attr('transform', n =>
                // start new nodes at their final position
                `translate(${n.cola.x},${n.cola.y})`);
        const ntrans = node
            .transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(n =>
                _renderer.parent().stagedDelay(nodeEntered[_renderer.parent().nodeKey.eval(n)])
            )
            .attr('opacity', _renderer.parent().nodeOpacity.eval);
        if (animatePositions)
            ntrans
                .attr('transform', n => `translate(${n.cola.x},${n.cola.y})`)
                .on('end.record', n => {
                    n.prevX = n.cola.x;
                    n.prevY = n.cola.y;
                });

        // recalculate edge positions
        edge.each(e => {
            e.pos.new = null;
        });
        edge.each(e => {
            if (e.cola.points) {
                e.pos.new = placeArrowsOnSpline(_renderer.parent(), e, e.cola.points);
            } else {
                if (!e.pos.old)
                    _renderer.parent().calcEdgePath(
                        e,
                        'old',
                        e.source.prevX || e.source.cola.x,
                        e.source.prevY || e.source.cola.y,
                        e.target.prevX || e.target.cola.x,
                        e.target.prevY || e.target.cola.y,
                    );
                if (!e.pos.new)
                    _renderer.parent().calcEdgePath(
                        e,
                        'new',
                        e.source.cola.x,
                        e.source.cola.y,
                        e.target.cola.x,
                        e.target.cola.y,
                    );
            }
            if (e.pos.old) {
                if (
                    e.pos.old.path.bezDegree !== e.pos.new.path.bezDegree
                    || e.pos.old.path.points.length !== e.pos.new.path.points.length
                ) {
                    // console.log('old', e.pos.old.path.points.length, 'new', e.pos.new.path.points.length);
                    if (isOneSegment(e.pos.old.path)) {
                        e.pos.new.path.points = asBezier3(e.pos.new.path);
                        e.pos.old.path.points = splitBezierN(
                            asBezier3(e.pos.old.path),
                            (e.pos.new.path.points.length-1)/3,
                        );
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    } else if (isOneSegment(e.pos.new.path)) {
                        e.pos.old.path.points = asBezier3(e.pos.old.path);
                        e.pos.new.path.points = splitBezierN(
                            asBezier3(e.pos.new.path),
                            (e.pos.old.path.points.length-1)/3,
                        );
                        e.pos.old.path.bezDegree = e.pos.new.bezDegree = 3;
                    } else console.warn("don't know how to interpolate two multi-segments");
                }
            } else
                e.pos.old = e.pos.new;
        });

        const edgeEntered = {};
        edgeEnter
            .each(e => {
                edgeEntered[_renderer.parent().edgeKey.eval(e)] = true;
            })
            .attr(
                'd',
                generate_edge_path(
                    _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old',
                ),
            );

        edgeArrowsEnter
            .each(e => {
                // if staging transitions, just fade new edges in at new position
                // else start new edges at old positions of nodes, if any, else new positions
                const age = _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old';
                if (_renderer.parent().edgeArrowhead.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'head')}`)
                        .attr('orient', () => e.pos[age].orienthead);
                if (_renderer.parent().edgeArrowtail.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'tail')}`)
                        .attr('orient', () => e.pos[age].orienttail);
            })
            .attr(
                'd',
                generate_edge_path(
                    _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old',
                    true,
                ),
            );

        edgeArrows
            .each(e => {
                if (_renderer.parent().edgeArrowhead.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'head')}`)
                        .attr(
                            'orient',
                            unsurprising_orient_rad(e.pos.old.orienthead, e.pos.new.orienthead),
                        )
                        .transition().duration(_renderer.parent().stagedDuration())
                        .delay(_renderer.parent().stagedDelay(false))
                        .attr('orient', () => e.pos.new.orienthead);
                if (_renderer.parent().edgeArrowtail.eval(e))
                    _renderer.select(`#${_renderer.parent().arrowId(e, 'tail')}`)
                        .attr(
                            'orient',
                            unsurprising_orient_rad(e.pos.old.orienttail, e.pos.new.orienttail),
                        )
                        .transition().duration(_renderer.parent().stagedDuration())
                        .delay(_renderer.parent().stagedDelay(false))
                        .attr('orient', () => e.pos.new.orienttail);
            });

        let etrans = edge
            .transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(e =>
                _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)])
            )
            .attr('opacity', _renderer.parent().edgeOpacity.eval);
        const arrowtrans = edgeArrows
            .transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(e =>
                _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)])
            )
            .attr('opacity', _renderer.parent().edgeOpacity.eval);
        (animatePositions ? etrans : edge)
            .attr('d', e => {
                const when = _renderer.parent().stageTransitions() === 'insmod'
                        && edgeEntered[_renderer.parent().edgeKey.eval(e)]
                    ? 'old'
                    : 'new';
                return generate_edge_path(when)(e);
            });
        (animatePositions ? arrowtrans : edgeArrows)
            .attr('d', e => {
                const when = _renderer.parent().stageTransitions() === 'insmod'
                        && edgeEntered[_renderer.parent().edgeKey.eval(e)]
                    ? 'old'
                    : 'new';
                return generate_edge_path(when, true)(e);
            });
        const elabels = edgeLabels
            .selectAll('text').data(e => {
                const labels = _renderer.parent().edgeLabel.eval(e);
                if (!labels)
                    return [];
                else if (typeof labels === 'string')
                    return [labels];
                else return labels;
            });
        elabels.enter()
            .append('text')
            .attr('class', 'edge-label')
            .attr('text-anchor', 'middle')
            .attr('dy', function(_, i) {
                return i*_renderer.parent().edgeLabelSpacing.eval(this.parentNode)-2;
            })
            .append('textPath')
            .attr('startOffset', '50%');
        elabels
            .select('textPath')
            .html(t => t)
            .attr('opacity', function() {
                return _renderer.parent().edgeOpacity.eval(
                    select(this.parentNode.parentNode).datum(),
                );
            })
            .attr('xlink:href', function(_e) {
                const id = _renderer.parent().textpathId(
                    select(this.parentNode.parentNode).datum(),
                );
                // angular on firefox needs absolute paths for fragments
                return `${window.location.href.split('#')[0]}#${id}`;
            });
        textPathsEnter
            .attr(
                'd',
                generate_edge_label_path(
                    _renderer.parent().stageTransitions() === 'modins' ? 'new' : 'old',
                ),
            );
        let textTrans = textPaths.transition()
            .duration(_renderer.parent().stagedDuration())
            .delay(e =>
                _renderer.parent().stagedDelay(edgeEntered[_renderer.parent().edgeKey.eval(e)])
            );
        if (animatePositions)
            textTrans
                .attr('d', e => {
                    const when = _renderer.parent().stageTransitions() === 'insmod'
                            && edgeEntered[_renderer.parent().edgeKey.eval(e)]
                        ? 'old'
                        : 'new';
                    return generate_edge_label_path(when)(e);
                });
        if (_renderer.parent().stageTransitions() === 'insmod' && animatePositions) {
            // inserted edges transition twice in insmod mode
            if (_renderer.parent().stagedDuration() >= 50) {
                etrans = etrans.transition()
                    .duration(_renderer.parent().stagedDuration())
                    .attr('d', generate_edge_path('new'));
                textTrans = textTrans.transition()
                    .duration(_renderer.parent().stagedDuration())
                    .attr('d', generate_edge_label_path('new'));
                arrowtrans.transition()
                    .duration(_renderer.parent().stagedDuration())
                    .attr('d', generate_edge_path('new', true));
            } else {
                // if transitions are too short, we run into various problems,
                // from transitions not completing to objects not found
                // so don't try to chain in that case
                // this also helped once: d3.timer.flush();
                etrans
                    .attr('d', generate_edge_path('new'));
                textTrans
                    .attr('d', generate_edge_path('new'));
                arrowtrans
                    .attr('d', generate_edge_path('new', true));
            }
        }

        // signal layout done when all transitions complete
        // because otherwise client might start another layout and lock the processor
        _animating = true;
        if (!_renderer.parent().showLayoutSteps())
            endall([ntrans, etrans, textTrans], () => {
                _animating = false;
                _renderer.parent().layoutDone(true);
            });

        if (animatePositions)
            edgeHover.attr('d', generate_edge_path('new'));

        edge.each(e => {
            e.pos.old = e.pos.new;
        });
    }

    // wait on multiple transitions, adapted from
    // http://stackoverflow.com/questions/10692100/invoke-a-callback-at-the-end-of-a-transition
    function endall(transitions, callback) {
        if (transitions.every(transition => transition.size() === 0))
            callback();
        let n = 0;
        transitions.forEach(transition => {
            transition
                .each(() => {
                    ++n;
                })
                .on('end.all', () => {
                    if (!--n) callback();
                });
        });
    }

    _renderer.isRendered = function() {
        return !!_svg;
    };

    _renderer.initializeDrawing = function() {
        _renderer.resetSvg();
        _g = _svg.selectAll('g.draw')
            .data([1])
            .enter().append('g')
            .attr('class', 'draw');

        const layers = ['edge-layer', 'node-layer'];
        if (_renderer.parent().edgesInFront())
            layers.reverse();
        _g.selectAll('g').data(layers)
            .enter().append('g')
            .attr('class', l => l);
        _edgeLayer = _g.selectAll('g.edge-layer');
        _nodeLayer = _g.selectAll('g.node-layer');
        return this;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Execute a d3 single selection in the diagram's scope using the given selector
     * and return the d3 selection. Roughly the same as
     * ```js
     * d3.select('#diagram-id').select(selector)
     * ```
     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @method select
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     */
    _renderer.select = function(s) {
        return _renderer.parent().root().select(s);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Selects all elements that match the d3 single selector in the diagram's scope,
     * and return the d3 selection. Roughly the same as
     *
     * ```js
     * d3.select('#diagram-id').selectAll(selector)
     * ```
     *
     * Since this function returns a d3 selection, it is not chainable. (However, d3 selection
     * calls can be chained after it.)
     * @method selectAll
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [selector]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     */
    _renderer.selectAll = function(s) {
        return _renderer.parent().root() ? _renderer.parent().root().selectAll(s) : null;
    };

    _renderer.selectNodePortsOfStyle = function(node, style) {
        return node.selectAll('g.port').filter(p =>
            _renderer.parent().portStyleName.eval(p) === style
        );
    };

    _renderer.drawPorts = function(drawState) {
        const nodePorts = _renderer.parent().nodePorts();
        if (!nodePorts)
            return;
        _renderer.parent().portStyle.enum().forEach(style => {
            const nodePorts2 = {};
            for (const nid in nodePorts)
                nodePorts2[nid] = nodePorts[nid].filter(p =>
                    _renderer.parent().portStyleName.eval(p) === style
                );
            const port = _renderer.selectNodePortsOfStyle(drawState.node, style);
            _renderer.parent().portStyle(style).drawPorts(port, nodePorts2, drawState.node);
        });
    };

    _renderer.fireTSEvent = function(dispatch, drawState) {
        dispatch.call(
            'transitionsStarted',
            null,
            drawState.node,
            drawState.edge,
            drawState.edgeHover,
        );
    };

    _renderer.calculateBounds = function(drawState) {
        if (!drawState.node.size())
            return null;
        return _renderer.parent().calculateBounds(drawState.node.data(), drawState.edge.data());
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Returns the top `svg` element for this specific diagram. You can also pass in a new
     * svg element, but setting the svg element on a diagram may have unexpected consequences.
     * @method svg
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}
     */
    _renderer.svg = function(_) {
        if (!arguments.length) {
            return _svg;
        }
        _svg = _;
        return _renderer;
    };

    /**
     * Returns the top `g` element for this specific diagram. This method is usually used to
     * retrieve the g element in order to overlay custom svg drawing
     * programatically. **Caution**: The root g element is usually generated internally, and
     * resetting it might produce unpredictable results.
     * @method g
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.selection} [selection]
     * @return {d3.selection}
     * @return {dc_graph.diagram}

     **/
    _renderer.g = function(_) {
        if (!arguments.length) {
            return _g;
        }
        _g = _;
        return _renderer;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Remove the diagram's SVG elements from the dom and recreate the container SVG
     * element.
     * @method resetSvg
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _renderer.resetSvg = function() {
        // we might be re-initialized in a div, in which case
        // we already have an <svg> element to delete
        const svg = _svg || _renderer.select('svg');
        svg.remove();
        _svg = null;
        // _renderer.parent().x(null).y(null);
        return generateSvg();
    };

    _renderer.addOrRemoveDef = function(id, whether, tag, onEnter) {
        const data = whether ? [0] : [];
        const sel = _defs.selectAll(`#${id}`).data(data);

        const selEnter = sel
            .enter().append(tag)
            .attr('id', id);
        if (selEnter.size() && onEnter)
            selEnter.call(onEnter);
        sel.exit().remove();
        return sel.merge(selEnter);
    };

    function generateSvg() {
        const root = _renderer.parent().root();
        _svg = root.selectAll('svg')
            .data([1])
            .enter().append('svg');
        _renderer.resize();

        _defs = _svg.selectAll('defs')
            .data([1])
            .enter().append('svg:defs');

        // for lack of a better place
        _renderer.addOrRemoveDef('node-clip-top', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1e3)
                .attr('y', -1e3)
                .attr('width', 2000)
                .attr('height', 1000);
        });
        _renderer.addOrRemoveDef('node-clip-bottom', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1e3)
                .attr('y', 0)
                .attr('width', 2000)
                .attr('height', 1000);
        });
        _renderer.addOrRemoveDef('node-clip-left', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', -1e3)
                .attr('y', -1e3)
                .attr('width', 1000)
                .attr('height', 2000);
        });
        _renderer.addOrRemoveDef('node-clip-right', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', 0)
                .attr('y', -1e3)
                .attr('width', 1000)
                .attr('height', 2000);
        });
        _renderer.addOrRemoveDef('node-clip-none', true, 'clipPath', clipPath => {
            clipPath.selectAll('rect').data([0])
                .enter().append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0);
        });

        _zoom = zoom()
            .on('zoom.diagram', _renderer.parent().doZoom)
            .scaleExtent(_renderer.parent().zoomExtent());

        if (_renderer.parent().mouseZoomable()) {
            _renderer.parent().child('brush');
            let keyboard$1 = _renderer.parent().child('keyboard');
            if (!keyboard$1)
                _renderer.parent().child('keyboard', keyboard$1 = keyboard());

            _zoom.filter(() => keyboard$1.modKeysMatch(_renderer.parent().modKeyZoom()));

            _svg.call(_zoom);
            _svg.on('dblclick.zoom', null);
        } else {
            _zoom.filter(() => false);
            _svg.call(_zoom);
        }

        return _svg;
    }

    _renderer.animating = function() {
        return _animating;
    };

    return _renderer;
}

/**
 * Web worker layout wrapper
 * @module webworker_layout
 */


const _workers = {};
const NUMBER_RESULTS = 3;
function createWorker(workerName) {
    if (!_workers[workerName]) {
        const worker = _workers[workerName] = {
            worker: new Worker(`${scriptPath()}dc.graph.${workerName}.worker.js`, {type: 'module'}),
            layouts: {},
        };
        worker.worker.onmessage = function(e) {
            const layoutId = e.data.layoutId;
            if (!worker.layouts[layoutId])
                throw new Error(`layoutId "${layoutId}" unknown!`);
            const engine = worker.layouts[layoutId].getEngine();
            engine.layoutAlgorithm?.() || 'unknown';
            if (e.data.args.length > NUMBER_RESULTS && engine.processExtraWorkerResults)
                engine.processExtraWorkerResults.apply(engine, e.data.args.slice(NUMBER_RESULTS));
            const dispatch = worker.layouts[layoutId].dispatch();
            dispatch.call(e.data.response, null, ...e.data.args);
        };
        worker.worker.onerror = function(e) {
            console.error(`[WORKER] Worker error for layout ${workerName}:`, e);
        };
    }
    return _workers[workerName];
}

function webworkerLayout(layoutEngine, workerName) {
    const _dispatch = dispatch('init', 'start', 'tick', 'end');
    const _worker = createWorker(workerName || layoutEngine.layoutAlgorithm());
    const engine = {};
    _worker.layouts[layoutEngine.layoutId()] = engine;

    engine.parent = function(parent) {
        if (layoutEngine.parent)
            layoutEngine.parent(parent);
    };
    // Helper function to clone options while filtering out functions
    function serializeOptions(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (typeof obj === 'function') {
            console.warn(
                '[WORKER] Filtering out function from options:',
                `${obj.toString().slice(0, 100)}...`,
            );
            return null; // Remove functions
        }
        if (Array.isArray(obj)) return obj.map(serializeOptions);

        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = serializeOptions(obj[key]);
                if (value !== null) { // Only include non-null values
                    result[key] = value;
                }
            }
        }
        return result;
    }

    engine.init = async function(options) {
        options = layoutEngine.optionNames().reduce(
            (options, option) => {
                const value = layoutEngine[option]();
                // Serialize each option value as we collect it
                options[option] = serializeOptions(value);
                return options;
            },
            options,
        );
        if (layoutEngine.propagateOptions)
            layoutEngine.propagateOptions(options);

        return new Promise((resolve, reject) => {
            // Set up one-time listener for init completion
            const originalOnMessage = _worker.worker.onmessage;
            const initTimeout = setTimeout(() => {
                _worker.worker.onmessage = originalOnMessage;
                reject(new Error('Worker init timeout'));
            }, 10000); // 10 second timeout

            _worker.worker.onmessage = function(e) {
                if (e.data.response === 'init' && e.data.layoutId === layoutEngine.layoutId()) {
                    clearTimeout(initTimeout);
                    _worker.worker.onmessage = originalOnMessage;
                    resolve();
                } else {
                    // Pass other messages to original handler
                    originalOnMessage.call(this, e);
                }
            };

            _worker.worker.postMessage({
                command: 'init',
                args: {
                    layoutId: layoutEngine.layoutId(),
                    options: serializeOptions(options),
                },
            });
        });
    };
    engine.data = function(graph, nodes, edges, clusters, constraints) {
        _worker.worker.postMessage({
            command: 'data',
            args: {
                layoutId: layoutEngine.layoutId(),
                graph,
                nodes,
                edges,
                clusters,
                constraints,
            },
        });
    };
    engine.start = function() {
        _worker.worker.postMessage({
            command: 'start',
            args: {
                layoutId: layoutEngine.layoutId(),
            },
        });
    };
    engine.stop = function() {
        _worker.worker.postMessage({
            command: 'stop',
            args: {
                layoutId: layoutEngine.layoutId(),
            },
        });
        return this;
    };
    // stopgap while layout options are still on diagram
    engine.getEngine = function() {
        return layoutEngine;
    };
    // somewhat sketchy - do we want this object to be transparent or not?
    const passthroughs = [
        'layoutAlgorithm',
        'populateLayoutNode',
        'populateLayoutEdge',
        'rankdir',
        'ranksep',
    ];
    passthroughs.concat(
        layoutEngine.optionNames(),
        layoutEngine.passThru ? layoutEngine.passThru() : [],
    ).forEach(name => {
        engine[name] = function() {
            const ret = layoutEngine[name].apply(layoutEngine, arguments);
            return arguments.length ? this : ret;
        };
    });
    engine.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    engine.dispatch = function() {
        return _dispatch;
    };
    return engine;
}

/**
 * Main diagram component for dc.graph.js
 * @module diagram
 */


/**
 * `diagram` is a dc.js-compatible network visualization component. It registers in
 * the dc.js chart registry and its nodes and edges are generated from crossfilter groups. It
 * logically derives from the dc.js
 * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin},
 * but it does not physically derive from it since so much is different about network
 * visualization versus conventional charts.
 * @param {String|node} parent - Any valid
 * {@link https://github.com/mbostock/d3/wiki/Selections#selecting-elements d3 single selector}
 * specifying a dom block element such as a div; or a dom element.
 * @param {String} [chartGroup] - The name of the dc.js chart group this diagram instance
 * should be placed in. Filter interaction with a diagram will only trigger events and redraws
 * within the diagram's group.
 * @return {Object} diagram instance
 */
function diagram(parent, chartGroup) {
    // different enough from regular dc charts that we don't use dc.baseMixin
    // but attempt to implement most of that interface, copying some of the most basic stuff
    const _diagram = new MarginMixin({});
    _diagram.__dcFlag__ = utils.uniqueId();
    _diagram.margins({left: 10, top: 10, right: 10, bottom: 10});
    const _dispatch = dispatch(
        'preDraw',
        'data',
        'end',
        'start',
        'render',
        'drawn',
        'receivedLayout',
        'transitionsStarted',
        'zoomed',
        'reset',
    );
    let _nodes = {}, _edges = {}; // hold state between runs
    let _ports = {}; // id = node|edge/id/name
    let _clusters = {};
    let _nodePorts; // ports sorted by node id
    let _stats = {};
    let _nodes_snapshot, _edges_snapshot;
    const _arrows = {};
    let _running = false; // for detecting concurrency issues
    let _anchor, _chartGroup;
    let _animateZoom;

    let _minWidth = 200;
    const _defaultWidthCalc = function(element) {
        const width = element && element.getBoundingClientRect
            && element.getBoundingClientRect().width;
        return (width && width > _minWidth) ? width : _minWidth;
    };
    let _widthCalc = _defaultWidthCalc;

    let _minHeight = 200;
    const _defaultHeightCalc = function(element) {
        const height = element && element.getBoundingClientRect
            && element.getBoundingClientRect().height;
        return (height && height > _minHeight) ? height : _minHeight;
    };
    let _heightCalc = _defaultHeightCalc;
    let _width, _height, _lastWidth, _lastHeight;

    function deprecate_layout_algo_parameter(name) {
        return function(value) {
            if (!_diagram.layoutEngine())
                _diagram.layoutAlgorithm('cola', true);
            let engine = _diagram.layoutEngine();
            if (engine.getEngine)
                engine = engine.getEngine();
            if (engine[name]) {
                console.warn(
                    `property is deprecated, call on layout engine instead: dc_graph.diagram.%c${name}`,
                    'font-weight: bold',
                );
                if (!arguments.length)
                    return engine[name]();
                engine[name](value);
            } else {
                console.warn(
                    `property is deprecated, and is not supported for Warning: dc_graph.diagram.<b>${name}</b> is deprecated, and it is not supported for the "${engine.layoutAlgorithm()}" layout algorithm: ignored.`,
                );
                if (!arguments.length)
                    return null;
            }
            return this;
        };
    }

    /**
     * Set or get the height attribute of the diagram. If a value is given, then the diagram is
     * returned for method chaining. If no value is given, then the current value of the height
     * attribute will be returned.
     *
     * The width and height are applied to the SVG element generated by the diagram on render, or
     * when `resizeSvg` is called.
     *
     * If the value is falsy or a function, the height will be calculated the first time it is
     * needed, using the provided function or default height calculator, and then cached. The
     * default calculator uses the client rect of the element specified when constructing the chart,
     * with a minimum of `minHeight`. A custom calculator will be passed the element.
     *
     * If the value is `'auto'`, the height will be calculated every time the diagram is drawn, and
     * it will not be set on the `<svg>` element. Instead, the element will be pinned to the same
     * rectangle as its containing div using CSS.
     *
     * @method height
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [height=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    _diagram.height = function(height) {
        if (!arguments.length) {
            if (!utils.isNumber(_height)) {
                _lastHeight = _heightCalc(_diagram.root().node());
                if (_height === 'auto') // 'auto' => calculate every time
                    return _lastHeight;
                // null/undefined => calculate once only
                _height = _lastHeight;
            }
            return _height;
        }
        if (utils.isNumber(height) || !height || height === 'auto')
            _height = height;
        else if (typeof height === 'function') {
            _heightCalc = height;
            _height = undefined;
        } else throw new Error(
                `don't know what to do with height type ${typeof height} value ${height}`,
            );
        return _diagram;
    };
    _diagram.minHeight = function(height) {
        if (!arguments.length)
            return _minHeight;
        _minHeight = height;
        return _diagram;
    };
    /**
     * Set or get the width attribute of the diagram. If a value is given, then the diagram is
     * returned for method chaining. If no value is given, then the current value of the width
     * attribute will be returned.
     *
     * The width and height are applied to the SVG element generated by the diagram on render, or
     * when `resizeSvg` is called.
     *
     * If the value is falsy or a function, the width will be calculated the first time it is
     * needed, using the provided function or default width calculator, and then cached. The default
     * calculator uses the client rect of the element specified when constructing the chart, with a
     * minimum of `minWidth`. A custom calculator will be passed the element.
     *
     * If the value is `'auto'`, the width will be calculated every time the diagram is drawn, and
     * it will not be set on the `<svg>` element. Instead, the element will be pinned to the same
     * rectangle as its containing div using CSS.
     *
     * @method width
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [width=200]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    _diagram.width = function(width) {
        if (!arguments.length) {
            if (!utils.isNumber(_width)) {
                _lastWidth = _widthCalc(_diagram.root().node());
                if (_width === 'auto') // 'auto' => calculate every time
                    return _lastWidth;
                // null/undefined => calculate once only
                _width = _lastWidth;
            }
            return _width;
        }
        if (utils.isNumber(width) || !width || width === 'auto')
            _width = width;
        else if (typeof width === 'function') {
            _widthCalc = width;
            _width = undefined;
        } else throw new Error(
                `don't know what to do with width type ${typeof width} value ${width}`,
            );
        return _diagram;
    };
    _diagram.minWidth = function(width) {
        if (!arguments.length)
            return _minWidth;
        _minWidth = width;
        return _diagram;
    };

    /**
     * Get or set the root element, which is usually the parent div. Normally the root is set
     * when the diagram is constructed; setting it later may have unexpected consequences.
     * @method root
     * @memberof dc_graph.diagram
     * @instance
     * @param {node} [root=null]
     * @return {node}
     * @return {dc_graph.diagram}
     */
    _diagram.root = property(null).react(e => {
        if (e.empty())
            console.log(`Warning: parent selector ${parent} doesn't seem to exist`);
    });

    /**
     * Get or set whether mouse wheel rotation or touchpad gestures will zoom the diagram, and
     * whether dragging on the background pans the diagram.
     * @method mouseZoomable
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [mouseZoomable=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.mouseZoomable = property(true);

    _diagram.zoomExtent = property([.1, 2]);

    /**
     * What key or keys should be pressed to enabled zoom.
     * @method modKeyZoom
     * @memberof dc_graph.diagram
     * @instance
     * @param {String|String[]} [modKeyZoom=true]
     * @return {String|String[]}
     * @return {dc_graph.diagram}
     */
    _diagram.modKeyZoom = property('Alt');

    /**
     * Set or get the fitting strategy for the canvas, which affects how the translate
     * and scale get calculated when `autoZoom` is triggered.
     *
     * * `'default'` - simulates the preserveAspectRatio behavior of `xMidYMid meet`, but
     *   with margins - the content is stretched or squished in the more constrained
     *   direction, and centered in the other direction
     * * `'vertical'` - fits the canvas vertically (with vertical margins) and centers
     *   it horizontally. If the canvas is taller than the viewport, it will meet
     *   vertically and there will be blank areas to the left and right. If the canvas
     *   is wider than the viewport, it will be sliced.
     * * `'horizontal'` - fits the canvas horizontally (with horizontal margins) and
     *   centers it vertically. If the canvas is wider than the viewport, it will meet
     *   horizontally and there will be blank areas above and below. If the canvas is
     *   taller than the viewport, it will be sliced.
     *
     * Other options
     * * `null` - no attempt is made to fit the content in the viewport
     * * `'zoom'` - does not scale the content, but attempts to bring as much content
     *   into view as possible, using using the same algorithm as `restrictPan`
     * * `'align_{tlbrc}[2]'` - does not scale; aligns up to two sides or centers them
     * @method fitStrategy
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [fitStrategy='default']
     * @return {String}
     * @return {dc_graph.diagram}
     */
    _diagram.fitStrategy = property('default');

    /**
     * Do not allow panning (scrolling) to push the diagram out of the viewable area, if there
     * is space for it to be shown. */
    _diagram.restrictPan = property(false);

    /**
     * Auto-zoom behavior.
     * * `'always'` - zoom every time layout happens
     * * `'once'` - zoom the next time layout happens
     * * `null` - manual, call `zoomToFit` to fit
     * @method autoZoom
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [autoZoom=null]
     * @return {String}
     * @return {dc_graph.diagram}
     */
    _diagram.autoZoom = property(null);
    _diagram.zoomToFit = function(animate) {
        // if(!(_nodeLayer && _edgeLayer))
        //     return;
        auto_zoom(animate);
    };
    _diagram.zoomDuration = property(500);

    /**
     * Set or get the crossfilter dimension which represents the nodes (vertices) in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.
     *
     * *Dimensions are included on the diagram for similarity to dc.js, however the diagram
     * itself does not use them - but {@link dc_graph.filter_selection filter_selection} will.*
     * @method nodeDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [nodeDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeDimension = property();

    /**
     * Set or get the crossfilter group which is the data source for the nodes in the
     * diagram. The diagram will use the group's `.all()` method to get an array of `{key,
     * value}` pairs, where the key is a unique identifier, and the value is usually an object
     * containing the node's attributes. All accessors work with these key/value pairs.
     *
     * If the group is changed or returns different values, the next call to `.redraw()` will
     * reflect the changes incrementally.
     *
     * It is possible to pass another object with the same `.all()` interface instead of a
     * crossfilter group.
     * @method nodeGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [nodeGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeGroup = property();

    /**
     * Set or get the crossfilter dimension which represents the edges in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.
     *
     * *Dimensions are included on the diagram for similarity to dc.js, however the diagram
     * itself does not use them - but {@link dc_graph.filter_selection filter_selection} will.*
     * @method edgeDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [edgeDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeDimension = property();

    /**
     * Set or get the crossfilter group which is the data source for the edges in the
     * diagram. See `.nodeGroup` above for the way data is loaded from a crossfilter group.
     *
     * The values in the key/value pairs returned by `diagram.edgeGroup().all()` need to
     * support, at a minimum, the {@link dc_graph.diagram#nodeSource nodeSource} and
     * {@link dc_graph.diagram#nodeTarget nodeTarget}, which should return the same
     * keys as the {@link dc_graph.diagram#nodeKey nodeKey}
     *
     * @method edgeGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [edgeGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeGroup = property();

    _diagram.edgesInFront = property(false);

    /**
     * Set or get the function which will be used to retrieve the unique key for each node. By
     * default, this accesses the `key` field of the object passed to it. The keys should match
     * the keys returned by the {@link dc_graph.diagram#edgeSource edgeSource} and
     * {@link dc_graph.diagram#edgeTarget edgeTarget}.
     *
     * @method nodeKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeKey=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeKey = _diagram.nodeKeyAccessor = property(kv => kv.key);

    /**
     * Set or get the function which will be used to retrieve the unique key for each edge. By
     * default, this accesses the `key` field of the object passed to it.
     *
     * @method edgeKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeKey=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeKey = _diagram.edgeKeyAccessor = property(kv => kv.key);

    /**
     * Set or get the function which will be used to retrieve the source (origin/tail) key of
     * the edge objects.  The key must equal the key returned by the `.nodeKey` for one of the
     * nodes; if it does not, or if the node is currently filtered out, the edge will not be
     * displayed. By default, looks for `.value.sourcename`.
     *
     * @method edgeSource
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeSource=function(kv) { return kv.value.sourcename; }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeSource = _diagram.sourceAccessor = property(kv => kv.value.sourcename);

    /**
     * Set or get the function which will be used to retrieve the target (destination/head) key
     * of the edge objects.  The key must equal the key returned by the
     * {@link dc_graph.diagram#nodeKey nodeKey} for one of the nodes; if it does not, or if the node
     * is currently filtered out, the edge will not be displayed. By default, looks for
     * `.value.targetname`.
     * @method edgeTarget
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeTarget=function(kv) { return kv.value.targetname; }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeTarget = _diagram.targetAccessor = property(kv => kv.value.targetname);

    _diagram.portDimension = property(null);
    _diagram.portGroup = property(null);
    _diagram.portNodeKey = property(null);
    _diagram.portEdgeKey = property(null);
    _diagram.portName = property(null);
    _diagram.portStyleName = property(null);
    _diagram.portElastic = property(true);

    _diagram.portStyle = namedChildren();

    _diagram.portBounds = property(null); // position limits, in radians

    _diagram.edgeSourcePortName = property(null);
    _diagram.edgeTargetPortName = property(null);

    /**
     * Set or get the crossfilter dimension which represents the edges in the
     * diagram. Typically there will be a crossfilter instance for the nodes, and another for
     * the edges.
     *
     * *As with node and edge dimensions, the diagram will itself not filter on cluster dimensions;
     * this is included for symmetry, and for modes which may want to filter clusters.*
     * @method clusterDimension
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.dimension} [clusterDimension]
     * @return {crossfilter.dimension}
     * @return {dc_graph.diagram}
     */
    _diagram.clusterDimension = property(null);

    /**
     * Set or get the crossfilter group which is the data source for clusters in the
     * diagram.
     *
     * The key/value pairs returned by `diagram.clusterGroup().all()` need to support, at a minimum,
     * the {@link dc_graph.diagram#clusterKey clusterKey} and {@link dc_graph.diagram#clusterParent clusterParent}
     * accessors, which should return keys in this group.
     *
     * @method clusterGroup
     * @memberof dc_graph.diagram
     * @instance
     * @param {crossfilter.group} [clusterGroup]
     * @return {crossfilter.group}
     * @return {dc_graph.diagram}
     */
    _diagram.clusterGroup = property(null);

    // cluster accessors
    /**
     * Set or get the function which will be used to retrieve the unique key for each cluster. By
     * default, this accesses the `key` field of the object passed to it.
     *
     * @method clusterKey
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [clusterKey=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.clusterKey = property(pluck('key'));

    /**
     * Set or get the function which will be used to retrieve the key of the parent of a cluster,
     * which is another cluster.
     *
     * @method clusterParent
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [clusterParent=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.clusterParent = property(null);

    /**
     * Set or get the function which will be used to retrieve the padding, in pixels, around a cluster.
     *
     * **To be implemented.** If a single value is returned, it will be used on all sides; if two
     * values are returned they will be interpreted as the vertical and horizontal padding.
     *
     * @method clusterPadding
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [clusterPadding=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.clusterPadding = property(8);

    // node accessor
    /**
     * Set or get the function which will be used to retrieve the parent cluster of a node, or
     * `null` if the node is not in a cluster.
     *
     * @method nodeParentCluster
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeParentCluster=function(kv) { return kv.key }]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeParentCluster = property(null);

    /**
     * Set or get the function which will be used to retrieve the radius, in pixels, for each
     * node. This determines the height of nodes,and if `nodeFitLabel` is false, the width too.
     * @method nodeRadius
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeRadius=25]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeRadius = _diagram.nodeRadiusAccessor = property(25);

    /**
     * Set or get the function which will be used to retrieve the stroke width, in pixels, for
     * drawing the outline of each node. According to the SVG specification, the outline will
     * be drawn half on top of the fill, and half outside. Default: 1
     * @method nodeStrokeWidth
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeStrokeWidth=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeStrokeWidth = _diagram.nodeStrokeWidthAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the stroke color for the outline
     * of each node.
     * @method nodeStroke
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeStroke='black']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeStroke = _diagram.nodeStrokeAccessor = property('black');

    _diagram.nodeStrokeDashArray = property(null);

    /**
     * If set, the value returned from `nodeFill` will be processed through this
     * {@link https://github.com/mbostock/d3/wiki/Scales d3.scale}
     * to return the fill color. If falsy, uses the identity function (no scale).
     * @method nodeFillScale
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|d3.scale} [nodeFillScale]
     * @return {Function|d3.scale}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeFillScale = property(null);

    /**
     * Set or get the function which will be used to retrieve the fill color for the body of each
     * node.
     * @method nodeFill
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeFill='white']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeFill = _diagram.nodeFillAccessor = property('white');

    /**
     * Set or get the function which will be used to retrieve the opacity of each node.
     * @method nodeOpacity
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeOpacity=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeOpacity = property(1);

    /**
     * Set or get the padding or minimum distance, in pixels, for a node. (Will be distributed
     * to both sides of the node.)
     * @method nodePadding
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodePadding=6]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.nodePadding = property(6);

    /**
     * Set or get the padding, in pixels, for a node's label. If an object, should contain fields
     * `x` and `y`. If a number, will be applied to both x and y.
     * @method nodeLabelPadding
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number|Object} [nodeLabelPadding=0]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeLabelPadding = property(0);

    /**
     * Set or get the line height for nodes with multiple lines of text, in ems.
     * @method nodeLineHeight
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [nodeLineHeight=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeLineHeight = property(1);

    /**
     * Set or get the function which will be used to retrieve the label text to display in each
     * node. By default, looks for a field `label` or `name` inside the `value` field.
     * @method nodeLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeLabel]
     * @return {Function|String}
     * @example
     * // Default behavior
     * diagram.nodeLabel(function(kv) {
     *   return kv.value.label || kv.value.name;
     * });
     * @return {dc_graph.diagram}
     */
    _diagram.nodeLabel = _diagram.nodeLabelAccessor = property(kv =>
        kv.value.label || kv.value.name
    );

    _diagram.nodeLabelAlignment = property('center');
    _diagram.nodeLabelDecoration = property(null);

    /**
     * Set or get the function which will be used to retrieve the label fill color. Default: null
     * @method nodeLabelFill
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeLabelFill=null]
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeLabelFill = _diagram.nodeLabelFillAccessor = property(null);

    /**
     * Whether to fit the node shape around the label
     * @method nodeFitLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Boolean} [nodeFitLabel=true]
     * @return {Function|Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeFitLabel = _diagram.nodeFitLabelAccessor = property(true);

    /**
     * The shape to use for drawing each node, specified as an object with at least the field
     * `shape`. The names of shapes are mostly taken
     * [from graphviz](http://www.graphviz.org/doc/info/shapes.html); currently ellipse, egg,
     * triangle, rectangle, diamond, trapezium, parallelogram, pentagon, hexagon, septagon, octagon,
     * invtriangle, invtrapezium, square, polygon are supported.
     *
     * If `shape = polygon`:
     * * `sides`: number of sides for a polygon
     * @method nodeShape
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Object} [nodeShape={shape: 'ellipse'}]
     * @return {Function|Object}
     * @return {dc_graph.diagram}
     * @example
     * // set shape to diamond or parallelogram based on flag
     * diagram.nodeShape(function(kv) {
     *   return {shape: kv.value.flag ? 'diamond' : 'parallelogram'};
     * });
     */
    _diagram.nodeShape = property(defaultShape);

    // for defining custom (and standard) shapes
    _diagram.shape = namedChildren();

    _diagram.shape('nothing', noShape());
    _diagram.shape('ellipse', ellipseShape());
    _diagram.shape('polygon', polygonShape());
    _diagram.shape('rounded-rect', roundedRectangleShape());
    _diagram.shape('elaborated-rect', elaboratedRectangleShape());

    _diagram.nodeOutlineClip = property(null);

    _diagram.nodeContent = property('text');
    _diagram.content = namedChildren();
    _diagram.content('text', textContents());

    // really looks like these should reside in an open namespace - this used only by an extension
    // but it's no less real than any other computed property
    _diagram.nodeIcon = property(null);

    /**
     * Set or get the function which will be used to retrieve the node title, usually rendered
     * as a tooltip. By default, uses the key of the node.
     * @method nodeTitle
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [nodeTitle]
     * @return {Function|String}
     * @example
     * // Default behavior
     * diagram.nodeTitle(function(kv) {
     *   return _diagram.nodeKey()(kv);
     * });
     * @return {dc_graph.diagram}
     */
    _diagram.nodeTitle = _diagram.nodeTitleAccessor = property(kv => _diagram.nodeKey()(kv));

    /**
     * By default, nodes are added to the layout in the order that `.nodeGroup().all()` returns
     * them. If specified, `.nodeOrdering` provides an accessor that returns a key to sort the
     * nodes on.  *It would be better not to rely on ordering to affect layout, but it may
     * affect the layout in some cases.*
     * @method nodeOrdering
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [nodeOrdering=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeOrdering = property(null);

    /**
     * Specify an accessor that returns an {x,y} coordinate for a node that should be
     * {@link https://github.com/tgdwyer/WebCola/wiki/Fixed-Node-Positions fixed in place},
     * and returns falsy for other nodes.
     * @method nodeFixed
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Object} [nodeFixed=null]
     * @return {Function|Object}
     * @return {dc_graph.diagram}
     */
    _diagram.nodeFixed = _diagram.nodeFixedAccessor = property(null);

    /**
     * Set or get the function which will be used to retrieve the stroke color for the edges.
     * @method edgeStroke
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeStroke='black']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeStroke = _diagram.edgeStrokeAccessor = property('black');

    /**
     * Set or get the function which will be used to retrieve the stroke width for the edges.
     * @method edgeStrokeWidth
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeStrokeWidth=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeStrokeWidth = _diagram.edgeStrokeWidthAccessor = property(1);

    _diagram.edgeStrokeDashArray = property(null);

    /**
     * Set or get the function which will be used to retrieve the edge opacity, a number from 0
     * to 1.
     * @method edgeOpacity
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeOpacity=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeOpacity = _diagram.edgeOpacityAccessor = property(1);

    /**
     * Set or get the function which will be used to retrieve the edge label text. The label is
     * displayed when an edge is hovered over. By default, uses the `edgeKey`.
     * @method edgeLabel
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeLabel]
     * @example
     * // Default behavior
     * diagram.edgeLabel(function(e) {
     *   return _diagram.edgeKey()(e);
     * });
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeLabel = _diagram.edgeLabelAccessor = property(e => _diagram.edgeKey()(e));
    // vertical spacing when there are multiple lines of edge label
    _diagram.edgeLabelSpacing = property(12);

    /**
     * Set or get the function which will be used to retrieve the name of the arrowhead to use
     * for the target/ head/destination of the edge. Arrow symbols can be specified with
     * `.defineArrow()`. Return null to display no arrowhead.
     * @method edgeArrowhead
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeArrowhead='vee']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeArrowhead = _diagram.edgeArrowheadAccessor = property('vee');

    /**
     * Set or get the function which will be used to retrieve the name of the arrow tail to use
     * for the tail/source of the edge. Arrow symbols can be specified with
     * `.defineArrow()`. Return null to display no arrowtail.
     * @method edgeArrowtail
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [edgeArrowtail=null]
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeArrowtail = _diagram.edgeArrowtailAccessor = property(null);

    /**
     * Multiplier for arrow size.
     * @method edgeArrowSize
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeArrowSize=1]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeArrowSize = property(1);

    /**
     * To draw an edge but not have it affect the layout, specify a function which returns
     * false for that edge.  By default, will return false if the `notLayout` field of the edge
     * value is truthy, true otherwise.
     * @method edgeIsLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Boolean} [edgeIsLayout]
     * @example
     * // Default behavior
     * diagram.edgeIsLayout(function(kv) {
     *   return !kv.value.notLayout;
     * });
     * @return {Function|Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeIsLayout = _diagram.edgeIsLayoutAccessor = property(kv => !kv.value.notLayout);

    // if false, don't draw or layout the edge. this is not documented because it seems like
    // the interface could be better and this combined with edgeIsLayout. (currently there is
    // no way to layout but not draw an edge.)
    _diagram.edgeIsShown = property(true);

    /**
     * Currently, three strategies are supported for specifying the lengths of edges:
     * * 'individual' - uses the `edgeLength` for each edge. If it returns falsy, uses the
     * `baseLength`
     * * 'symmetric', 'jaccard' - compute the edge length based on the graph structure around
     * the edge. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/link-lengths the cola.js wiki}
     * for more details.
     * 'none' - no edge lengths will be specified
     *
     * **Deprecated**: Use {@link dc_graph.cola_layout#lengthStrategy cola_layout.lengthStrategy} instead.
     * @method lengthStrategy
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|String} [lengthStrategy='symmetric']
     * @return {Function|String}
     * @return {dc_graph.diagram}
     */
    _diagram.lengthStrategy = deprecate_layout_algo_parameter('lengthStrategy');

    /**
     * When the `.lengthStrategy` is 'individual', this accessor will be used to read the
     * length of each edge.  By default, reads the `distance` field of the edge. If the
     * distance is falsy, uses the `baseLength`.
     * @method edgeLength
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [edgeLength]
     * @example
     * // Default behavior
     * diagram.edgeLength(function(kv) {
     *   return kv.value.distance;
     * });
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeLength = _diagram.edgeDistanceAccessor = property(kv => kv.value.distance);

    /**
     * This should be equivalent to rankdir and ranksep in the dagre/graphviz nomenclature, but for
     * now it is separate.
     *
     * **Deprecated**: use {@link dc_graph.cola_layout#flowLayout cola_layout.flowLayout} instead.
     * @method flowLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [flowLayout]
     * @example
     * // No flow (default)
     * diagram.flowLayout(null)
     * // flow in x with min separation 200
     * diagram.flowLayout({axis: 'x', minSeparation: 200})
     */
    _diagram.flowLayout = deprecate_layout_algo_parameter('flowLayout');

    /**
     * Direction to draw ranks. Currently for dagre and expand_collapse, but I think cola could be
     * generated from graphviz-style since it is more general.
     *
     * **Deprecated**: use {@link dc_graph.dagre_layout#rankdir dagre_layout.rankdir} instead.
     * @method rankdir
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [rankdir]
     */
    _diagram.rankdir = deprecate_layout_algo_parameter('rankdir');

    /**
     * Gets or sets the default edge length (in pixels) when the `.lengthStrategy` is
     * 'individual', and the base value to be multiplied for 'symmetric' and 'jaccard' edge
     * lengths.
     *
     * **Deprecated**: use {@link dc_graph.cola_layout#baseLength cola_layout.baseLength} instead.
     * @method baseLength
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [baseLength]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    _diagram.baseLength = deprecate_layout_algo_parameter('baseLength');

    /**
     * Gets or sets the transition duration, the length of time each change to the diagram will
     * be animated.
     * @method transitionDuration
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [transitionDuration=500]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    _diagram.transitionDuration = property(500);

    /**
     * How transitions should be split into separate animations to emphasize
     * the delete, modify, and insert operations:
     * * `none`: modify and insert operations animate at the same time
     * * `modins`: modify operations happen before inserts
     * * `insmod`: insert operations happen before modifies
     *
     * Deletions always happen before/during layout computation.
     * @method stageTransitions
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [stageTransitions='none']
     * @return {String}
     * @return {dc_graph.diagram}
     */
    _diagram.stageTransitions = property('none');

    /**
     * The delete transition happens simultaneously with layout, which can take longer
     * than the transition duration. Delaying it can bring it closer to the other
     * staged transitions.
     * @method deleteDelay
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [deleteDelay=0]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    _diagram.deleteDelay = property(0);

    /**
     * Whether to put connected components each in their own group, to stabilize layout.
     * @method groupConnected
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [groupConnected=false]
     * @return {String}
     * @return {dc_graph.diagram}
     */
    _diagram.groupConnected = deprecate_layout_algo_parameter('groupConnected');

    /**
     * Gets or sets the maximum time spent doing layout for a render or redraw. Set to 0 for no
     * limit.
     * @method timeLimit
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function|Number} [timeLimit=0]
     * @return {Function|Number}
     * @return {dc_graph.diagram}
     */
    _diagram.timeLimit = property(0);

    /**
     * Gets or sets a function which will be called with the current nodes and edges on each
     * redraw in order to derive new layout constraints. The constraints are built from scratch
     * on each redraw.
     *
     * This can be used to generate alignment (rank) or axis constraints. By default, no
     * constraints will be added, although cola.js uses constraints internally to implement
     * flow and overlap prevention. See
     * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints the cola.js wiki}
     * for more details.
     *
     * For convenience, dc.graph.js implements a other constraints on top of those implemented
     * by cola.js:
     * * 'ordering' - the nodes will be ordered on the specified `axis` according to the keys
     * returned by the `ordering` function, by creating separation constraints using the
     * specified `gap`.
     * * 'circle' - (experimental) the nodes will be placed in a circle using "wheel"
     * edge lengths similar to those described in
     * {@link http://www.csse.monash.edu.au/~tdwyer/Dwyer2009FastConstraints.pdf Scalable, Versatile, and Simple Constrained Graph Layout}
     * *Although this is not as performant or stable as might be desired, it may work for
     * simple cases. In particular, it should use edge length *constraints*, which don't yet
     * exist in cola.js.*
     *
     * Because it is tedious to write code to generate constraints for a graph, **dc.graph.js**
     * also includes a {@link #dc_graph+constraint_pattern constraint generator} to produce
     * this constrain function, specifying the constraints themselves in a graph.
     * @method constrain
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [constrain]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.constrain = property((_nodes, _edges) => []);

    /**
     * If there are multiple edges between the same two nodes, start them this many pixels away
     * from the original so they don't overlap.
     * @method parallelEdgeOffset
     * @memberof dc_graph.diagram
     * @instance
     * @param {Number} [parallelEdgeOffset=10]
     * @return {Number}
     * @return {dc_graph.diagram}
     */
    _diagram.parallelEdgeOffset = property(10);

    /**
     * By default, edges are added to the layout in the order that `.edgeGroup().all()` returns
     * them. If specified, `.edgeOrdering` provides an accessor that returns a key to sort the
     * edges on.
     *
     * *It would be better not to rely on ordering to affect layout, but it may affect the
     * layout in some cases. (Probably less than node ordering, but it does affect which
     * parallel edge is which.)*
     * @method edgeOrdering
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [edgeOrdering=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.edgeOrdering = property(null);

    _diagram.edgeSort = property(null);

    _diagram.cascade = cascade(_diagram);

    /**
     * Currently there are some bugs when the same instance of cola.js is used multiple
     * times. (In particular, overlaps between nodes may not be eliminated
     * {@link https://github.com/tgdwyer/WebCola/issues/118 if cola is not reinitialized}
     * This flag can be set true to construct a new cola layout object on each redraw. However,
     * layout seems to be more stable if this is set false, so hopefully this will be fixed
     * soon.
     * @method initLayoutOnRedraw
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [initLayoutOnRedraw=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.initLayoutOnRedraw = property(false);

    /**
     * Whether to perform layout when the data is unchanged from the last redraw.
     * @method layoutUnchanged
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [layoutUnchanged=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.layoutUnchanged = property(false);
    _diagram.nodeChangeSelect = property(() => {
        if (_diagram.layoutEngine().supportsMoving && _diagram.layoutEngine().supportsMoving())
            return topology_node;
        else
            return basic_node;
    });
    _diagram.edgeChangeSelect = property(() => {
        if (_diagram.layoutEngine().supportsMoving && _diagram.layoutEngine().supportsMoving())
            return topology_edge;
        else
            return basic_edge;
    });

    /**
     * When `layoutUnchanged` is false, this will force layout to happen again. This may be needed
     * when changing a parameter but not changing the topology of the graph. (Yes, probably should
     * not be necessary.)
     * @method relayout
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.relayout = function() {
        _nodes_snapshot = _edges_snapshot = null;
        return this;
    };

    /**
     * Function to call to generate an initial layout. Takes (diagram, nodes, edges)
     *
     * **Deprecated**: The only layout that was using this was `tree_positions` and it never
     * worked as an initialization step for cola, as was originally intended. Now that
     * `tree_layout` is a layout algorithm, this should go away.
     *
     * In the future, there will be support for chaining layout algorithms. But that will be a
     * matter of composing them into a super-algorithm, not a special step like this was.
     * @method initialLayout
     * @memberof dc_graph.diagram
     * @instance
     * @param {Function} [initialLayout=null]
     * @return {Function}
     * @return {dc_graph.diagram}
     */
    _diagram.initialLayout = deprecatedProperty(
        'initialLayout is deprecated - use layout algorithms instead',
        null,
    );

    _diagram.initialOnly = deprecatedProperty(
        'initialOnly is deprecated - see the initialLayout deprecation notice in the documentation',
        false,
    );

    /**
     * By default, all nodes are included, and edges are only included if both end-nodes are
     * visible.  If `.induceNodes` is set, then only nodes which have at least one edge will be
     * shown.
     * @method induceNodes
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [induceNodes=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.induceNodes = property(false);

    /**
     * If this flag is true, the positions of nodes and will be updated while layout is
     * iterating. If false, the positions will only be updated once layout has
     * stabilized. Note: this may not be compatible with transitionDuration.
     * @method showLayoutSteps
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [showLayoutSteps=false]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.showLayoutSteps = property(false);

    /**
     * Assigns a legend object which will be displayed within the same SVG element and
     * according to the visual encoding of this diagram.
     * @method legend
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [legend=null]
     * @return {Object}
     * @return {dc_graph.diagram}
     */
    // (pre-deprecated; see below)

    /**
     * Specifies another kind of child layer or interface. For example, this can
     * be used to display tooltips on nodes using `tip`.

     * The child needs to support a `parent` method, the diagram to modify.
     * @method child
     * @memberof diagram
     * @instance
     * @param {String} [id] - the name of the child to modify or add
     * @param {Object} [object] - the child object to add, or null to remove
     * @example
     * // Display tooltips on node hover, via the d3-tip library
     * import { tip } from 'dc-graph';
     * var myTip = tip()
     * tip.content(function(n) {
     *   // you can do an asynchronous call here, e.g. d3.json, if you need
     *   // to fetch data to show the tooltip - just return a promise or the content directly
     *   return "This is <em>" + n.orig.value.name + "</em>";
     * });
     * diagram.child('tip', tip);
     * @return {dc_graph.diagram}
     **/
    _diagram.mode = _diagram.child = namedChildren();

    _diagram.mode.reject = function(id, object) {
        const rtype = _diagram.renderer().rendererType();
        if (!object)
            return false; // null is always a valid mode for any renderer
        if (!object.supportsRenderer)
            ;
        else if (!object.supportsRenderer(rtype))
            return `not installing "${id}" because it is not compatible with renderer ${rtype}`;
        return false;
    };

    _diagram.legend = deprecateFunction(
        '.legend() is deprecated; use .child() for more control & multiple legends',
        function(_) {
            if (!arguments.length)
                return _diagram.child('node-legend');
            _diagram.child('node-legend', _);
            return _diagram;
        },
    );

    /**
     * Specify 'cola' (the default) or 'dagre' as the Layout Algorithm and it will replace the
     * back-end.
     *
     * **Deprecated**: use {@link dc_graph.diagram#layoutEngine diagram.layoutEngine} with the engine
     * object instead
     * @method layoutAlgorithm
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [algo='cola'] - the name of the layout algorithm to use
     * @example
     * // use dagre for layout
     * diagram.layoutAlgorithm('dagre');
     * @return {dc_graph.diagram}
     */
    _diagram.layoutAlgorithm = function(value, skipWarning) {
        if (!arguments.length)
            return _diagram.layoutEngine() ? _diagram.layoutEngine().layoutAlgorithm() : 'cola';
        if (!skipWarning)
            console.warn(
                'dc.graph.diagram.layoutAlgorithm is deprecated - pass the layout engine object to dc_graph.diagram.layoutEngine instead',
            );

        let engine;
        switch (value) {
            case 'cola':
                engine = colaLayout();
                break;
            case 'dagre':
                engine = dagreLayout();
        }
        engine = webworkerLayout(engine);
        _diagram.layoutEngine(engine);
        return this;
    };

    /**
     * The layout engine determines positions of nodes and edges.
     * @method layoutEngine
     * @memberof dc_graph.diagram
     * @instance
     * @param {Object} [engine=null] - the layout engine to use
     * @example
     * // use cola with no webworker
     * import { colaLayout } from 'dc-graph';
     * diagram.layoutEngine(colaLayout());
     * // use dagre with a webworker
     * import { webworkerLayout, dagreLayout } from 'dc-graph';
     * diagram.layoutEngine(webworkerLayout(dagreLayout()));
     */
    _diagram.layoutEngine = property(null).react(async val => {
        if (val && val.parent)
            val.parent(_diagram);
        if (_diagram.renderer().isRendered()) {
            // remove any calculated points, if engine did that
            Object.keys(_edges).forEach(k => {
                _edges[k].cola.points = null;
            });
            // initialize engine
            await initLayout(val);
        }
    });

    _diagram.renderer = property(renderSvg().parent(_diagram)).react(r => {
        if (_diagram.renderer())
            _diagram.renderer().parent(null);
        r.parent(_diagram);
    });

    // S-spline any edges that are not going in this direction
    _diagram.enforceEdgeDirection = property(null);

    _diagram.tickSize = deprecate_layout_algo_parameter('tickSize');

    _diagram.uniqueId = function() {
        return _diagram.anchorName().replace(/[ .#=[\]"]/g, '-');
    };

    _diagram.edgeId = function(e) {
        return `edge-${_diagram.edgeKey.eval(e).replace(/[^\w-_]/g, '-')}`;
    };

    _diagram.arrowId = function(e, kind) {
        return `arrow-${kind}-${_diagram.uniqueId()}-${_diagram.edgeId(e)}`;
    };
    _diagram.textpathId = function(e) {
        return `textpath-${_diagram.uniqueId()}-${_diagram.edgeId(e)}`;
    };

    // this kind of begs a (meta)graph ADT
    // instead of munging this into the diagram
    _diagram.getNode = function(id) {
        return _nodes[id] ? _nodes[id].orig : null;
    };

    _diagram.getWholeNode = function(id) {
        return _nodes[id] ? _nodes[id] : null;
    };

    _diagram.getEdge = function(id) {
        return _edges[id] ? _edges[id].orig : null;
    };

    _diagram.getWholeEdge = function(id) {
        return _edges[id] ? _edges[id] : null;
    };

    // again, awful, we need an ADT
    _diagram.getPort = function(nid, eid, name) {
        return _ports[portName(nid, eid, name)];
    };

    _diagram.nodePorts = function() {
        return _nodePorts;
    };

    _diagram.getWholeCluster = function(id) {
        return _clusters[id] || null;
    };

    /**
     * Instructs cola.js to fit the connected components.
     *
     * **Deprecated**: Use
     * {@link dc_graph.cola_layout#handleDisconnected cola_layout.handleDisconnected} instead.
     * @method handleDisconnected
     * @memberof dc_graph.diagram
     * @instance
     * @param {Boolean} [handleDisconnected=true]
     * @return {Boolean}
     * @return {dc_graph.diagram}
     */
    _diagram.handleDisconnected = deprecate_layout_algo_parameter('handleDisconnected');

    async function initLayout(engine) {
        if (!_diagram.layoutEngine())
            _diagram.layoutAlgorithm('cola', true);
        await (engine || _diagram.layoutEngine()).init({
            width: _diagram.width(),
            height: _diagram.height(),
        });
    }

    _diagram.forEachChild = function(node, children, idf, f) {
        children.enum().forEach(key => {
            f(children(key), node.filter(n => idf(n) === key));
        });
    };
    _diagram.forEachShape = function(node, f) {
        _diagram.forEachChild(node, _diagram.shape, n => n.dcg_shape.shape, f);
    };
    _diagram.forEachContent = function(node, f) {
        _diagram.forEachChild(node, _diagram.content, _diagram.nodeContent.eval, f);
    };

    function has_source_and_target(e) {
        return !!e.source && !!e.target;
    }

    // three stages: delete before layout, and modify & insert split the transitionDuration
    _diagram.stagedDuration = function() {
        return (_diagram.stageTransitions() !== 'none')
            ? _diagram.transitionDuration()/2
            : _diagram.transitionDuration();
    };

    _diagram.stagedDelay = function(is_enter) {
        return _diagram.stageTransitions() === 'none'
                || _diagram.stageTransitions() === 'modins' === !is_enter
            ? 0
            : _diagram.transitionDuration()/2;
    };

    _diagram.isRunning = function() {
        return _running;
    };

    function svg_specific(name) {
        return traceFunction('trace', `${name}() is specific to the SVG renderer`, function() {
            return _diagram.renderer()[name].apply(this, arguments);
        });
    }

    function call_on_renderer(name) {
        return traceFunction('trace', `calling ${name}() on renderer`, function() {
            return _diagram.renderer()[name].apply(this, arguments);
        });
    }

    _diagram.svg = svg_specific('svg');
    _diagram.g = svg_specific('g');
    _diagram.select = svg_specific('select');
    _diagram.selectAll = svg_specific('selectAll');
    _diagram.addOrRemoveDef = svg_specific('addOrRemoveDef');
    _diagram.selectAllNodes = svg_specific('selectAllNodes');
    _diagram.selectAllEdges = svg_specific('selectAllEdges');
    _diagram.selectNodePortsOfStyle = svg_specific('selectNodePortsOfStyle');
    _diagram.zoom = svg_specific('zoom');
    _diagram.translate = svg_specific('translate');
    _diagram.scale = svg_specific('scale');
    _diagram.renderNode = svg_specific('renderNode');
    _diagram.renderEdge = svg_specific('renderEdge');
    _diagram.redrawNode = svg_specific('redrawNode');
    _diagram.redrawEdge = svg_specific('redrawEdge');
    _diagram.reposition = call_on_renderer('reposition');

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Computes a new layout based on the nodes and edges in the edge groups, and
     * displays the diagram.  To the extent possible, the diagram will minimize changes in
     * positions from the previous layout.  `.render()` must be called the first time, and
     * `.redraw()` can be called after that.
     *
     * `.redraw()` will be triggered by changes to the filters in any other charts in the same
     * dc.js chart group.
     *
     * Unlike in dc.js, `redraw` executes asynchronously, because drawing can be computationally
     * intensive, and the diagram will be drawn multiple times if
     * {@link #dc_graph.diagram+showLayoutSteps showLayoutSteps}
     * is enabled. Watch the {@link #dc_graph.diagram+on 'end'} event to know when layout is
     * complete.
     * @method redraw
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    let _needsRedraw = false;
    _diagram.redraw = async function() {
        // since dc.js can receive UI events and trigger redraws whenever it wants,
        // and cola absolutely will not tolerate being poked while it's doing layout,
        // we need to guard the startLayout call.
        if (_running) {
            _needsRedraw = true;
            return this;
        } else return await _diagram.startLayout();
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Erases any existing SVG elements and draws the diagram from scratch. `.render()`
     * must be called the first time, and `.redraw()` can be called after that.
     * @method render
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.render = async function() {
        if (_diagram.renderer().isRendered())
            _dispatch.call('reset');
        if (!_diagram.initLayoutOnRedraw())
            await initLayout();

        _nodes = {};
        _edges = {};
        _ports = {};
        _clusters = {};

        // start out with 1:1 zoom
        _diagram.x(
            scaleLinear()
                .domain([0, _diagram.width()])
                .range([0, _diagram.width()]),
        );
        _diagram.y(
            scaleLinear()
                .domain([0, _diagram.height()])
                .range([0, _diagram.height()]),
        );
        _diagram.renderer().initializeDrawing();
        _dispatch.call('render');
        _diagram.redraw();
        return this;
    };

    _diagram.refresh = call_on_renderer('refresh');

    _diagram.width_is_automatic = function() {
        return _width === 'auto';
    };

    _diagram.height_is_automatic = function() {
        return _height === 'auto';
    };

    function detect_size_change() {
        const oldWidth = _lastWidth, oldHeight = _lastHeight;
        const newWidth = _diagram.width(), newHeight = _diagram.height();
        if (oldWidth !== newWidth || oldHeight !== newHeight)
            _diagram.renderer().rezoom(oldWidth, oldHeight, newWidth, newHeight);
    }

    // extract just the topology-related parts of nodes & edges to see if
    // graph has changed wrt layout. imperfect heuristic: assume that the original
    // data as well as all cola fields starting with dcg_ are related to topology
    function dcg_fields(cola) {
        const entries = Object.entries(cola)
            .filter(entry => /^dcg_/.test(entry[0]));
        return entries.reduce((p, entry) => {
            p[entry[0]] = entry[1];
            return p;
        }, {});
    }
    function topology_node(n) {
        return {orig: getOriginal(n), cola: dcg_fields(n.cola)};
    }
    function topology_edge(e) {
        return {orig: getOriginal(e), cola: dcg_fields(e.cola)};
    }
    function basic_node(n) {
        const n0 = getOriginal(n);
        return {
            orig: {
                key: n0.key,
                value: Object.fromEntries(
                    Object.entries(n0.value)
                        .filter(kv => kv[0] !== 'fixedPos'),
                ),
            },
        };
    }
    function basic_edge(e) {
        return {orig: getOriginal(e)};
    }

    _diagram.startLayout = async function() {
        let nodes = _diagram.nodeGroup().all();
        let edges = _diagram.edgeGroup().all();
        let ports = _diagram.portGroup() ? _diagram.portGroup().all() : [];
        const clusters = _diagram.clusterGroup() ? _diagram.clusterGroup().all() : [];
        if (_running) {
            throw new Error('diagram.redraw already running!');
        }
        _running = true;

        if (_diagram.width_is_automatic() || _diagram.height_is_automatic())
            detect_size_change();
        else
            _diagram.renderer().resize();

        if (_diagram.initLayoutOnRedraw())
            await initLayout();
        _diagram.layoutEngine().stop();
        _dispatch.call('preDraw');

        // ordering shouldn't matter, but we support ordering in case it does
        if (_diagram.nodeOrdering()) {
            nodes = nodes.slice(0).sort((a, b) =>
                ascending$1(_diagram.nodeOrdering()(a), _diagram.nodeOrdering()(b))
            );
        }
        if (_diagram.edgeOrdering()) {
            edges = edges.slice(0).sort((a, b) =>
                ascending$1(_diagram.edgeOrdering()(a), _diagram.edgeOrdering()(b))
            );
        }

        let wnodes = regenerateObjects(_nodes, nodes, null, v => _diagram.nodeKey()(v), (v1, v) => {
            v1.orig = v;
            v1.cola = v1.cola || {};
            v1.cola.dcg_nodeKey = _diagram.nodeKey.eval(v1);
            v1.cola.dcg_nodeParentCluster = _diagram.nodeParentCluster.eval(v1);
            _diagram.layoutEngine().populateLayoutNode(v1.cola, v1);
        });
        let wedges = regenerateObjects(_edges, edges, null, e => _diagram.edgeKey()(e), (e1, e) => {
            e1.orig = e;
            e1.cola = e1.cola || {};
            e1.cola.dcg_edgeKey = _diagram.edgeKey.eval(e1);
            e1.cola.dcg_edgeSource = _diagram.edgeSource.eval(e1);
            e1.cola.dcg_edgeTarget = _diagram.edgeTarget.eval(e1);
            e1.source = _nodes[e1.cola.dcg_edgeSource];
            e1.target = _nodes[e1.cola.dcg_edgeTarget];
            e1.sourcePort = e1.sourcePort || {};
            e1.targetPort = e1.targetPort || {};
            _diagram.layoutEngine().populateLayoutEdge(e1.cola, e1);
        });

        // remove edges that don't have both end nodes
        wedges = wedges.filter(has_source_and_target);

        // remove self-edges (since we can't draw them - will be option later)
        wedges = wedges.filter(e => e.source !== e.target);

        wedges = wedges.filter(_diagram.edgeIsShown.eval);

        // now we know which ports should exist
        let needports = wedges.map(e => {
            if (_diagram.edgeSourcePortName.eval(e))
                return portName(
                    _diagram.edgeSource.eval(e),
                    null,
                    _diagram.edgeSourcePortName.eval(e),
                );
            else return portName(null, _diagram.edgeKey.eval(e), 'source');
        });
        needports = needports.concat(wedges.map(e => {
            if (_diagram.edgeTargetPortName.eval(e))
                return portName(
                    _diagram.edgeTarget.eval(e),
                    null,
                    _diagram.edgeTargetPortName.eval(e),
                );
            else return portName(null, _diagram.edgeKey.eval(e), 'target');
        }));
        // remove any invalid ports so they don't crash in confusing ways later
        ports = ports.filter(p =>
            _diagram.portNodeKey() && _diagram.portNodeKey()(p)
            || _diagram.portEdgeKey() && _diagram.portEdgeKey()(p)
        );
        let wports = regenerateObjects(
            _ports,
            ports,
            needports,
            p => portName(
                _diagram.portNodeKey() && _diagram.portNodeKey()(p),
                _diagram.portEdgeKey() && _diagram.portEdgeKey()(p),
                _diagram.portName()(p),
            ),
            (p1, p) => {
                p1.orig = p;
                if (p1.named)
                    p1.edges = [];
            },
            (k, p) => {
                console.assert(k, 'should have screened out invalid ports');
                // it's dumb to parse the id we just created. as usual, i blame the lack of metagraphs
                const parse = splitPortName(k);
                if (parse.nodeKey) {
                    p.node = _nodes[parse.nodeKey];
                    p.named = true;
                } else {
                    const e = _edges[parse.edgeKey];
                    p.node = e[parse.name];
                    p.edges = [e];
                    p.named = false;
                }
                p.name = parse.name;
            },
        );
        // remove any ports where the end-node was not found, to avoid crashing elsewhere
        wports = wports.filter(p => p.node);

        // find all edges for named ports
        wedges.forEach(e => {
            let name = _diagram.edgeSourcePortName.eval(e);
            if (name)
                _ports[portName(_diagram.nodeKey.eval(e.source), null, name)].edges.push(e);
            name = _diagram.edgeTargetPortName.eval(e);
            if (name)
                _ports[portName(_diagram.nodeKey.eval(e.target), null, name)].edges.push(e);
        });

        // optionally, delete nodes that have no edges
        if (_diagram.induceNodes()) {
            const keeps = {};
            wedges.forEach(e => {
                keeps[e.cola.dcg_edgeSource] = true;
                keeps[e.cola.dcg_edgeTarget] = true;
            });
            wnodes = wnodes.filter(n => keeps[n.cola.dcg_nodeKey]);
            for (const k in _nodes)
                if (!keeps[k])
                    delete _nodes[k];
        }

        const needclusters = set$2(
            wnodes.map(n => _diagram.nodeParentCluster.eval(n)).filter(identity$2),
        ).values();

        const wclusters = regenerateObjects(
            _clusters,
            clusters,
            needclusters,
            c => _diagram.clusterKey()(c),
            (c1, c) => { // assign
                c1.orig = c;
                c1.cola = c1.cola || {
                    dcg_clusterKey: _diagram.clusterKey.eval(c1),
                    dcg_clusterParent: _diagram.clusterParent.eval(c1),
                };
            },
            (_k, _c) => { // create
            },
        );

        wnodes.forEach((v, i) => {
            v.index = i;
        });

        // announce new data
        _dispatch.call('data', null, _diagram, _nodes, wnodes, _edges, wedges, _ports, wports);
        _stats = {nnodes: wnodes.length, nedges: wedges.length};

        // fixed nodes may have been affected by .data() so calculate now
        wnodes.forEach(v => {
            if (_diagram.nodeFixed())
                v.cola.dcg_nodeFixed = _diagram.nodeFixed.eval(v);
        });

        // annotate parallel edges so we can draw them specially
        if (_diagram.parallelEdgeOffset()) {
            const em = new Array(wnodes.length);
            for (let i = 0; i < wnodes.length; ++i)
                em[i] = new Array(i);
            wedges.forEach(e => {
                e.pos = e.pos || {};
                let min, max, minattr, maxattr;
                if (e.source.index < e.target.index) {
                    min = e.source.index;
                    max = e.target.index;
                    minattr = 'edgeSourcePortName';
                    maxattr = 'edgeTargetPortName';
                } else {
                    max = e.source.index;
                    min = e.target.index;
                    maxattr = 'edgeSourcePortName';
                    minattr = 'edgeTargetPortName';
                }
                const minport = _diagram[minattr].eval(e) || 'no port',
                    maxport = _diagram[maxattr].eval(e) || 'no port';
                em[max][min] = em[max][min] || {};
                em[max][min][maxport] = em[max][min][maxport] || {};
                e.parallel = em[max][min][maxport][minport] = em[max][min][maxport][minport] || {
                    rev: [],
                    edges: [],
                };
                e.parallel.edges.push(e);
                e.parallel.rev.push(min !== e.source.index);
            });
        }

        const drawState = _diagram.renderer().startRedraw(_dispatch, wnodes, wedges);

        // really we should have layout chaining like in the good old Dynagraph days
        // the ordering of this and the previous 4 statements is somewhat questionable
        if (_diagram.initialLayout())
            _diagram.initialLayout()(_diagram, wnodes, wedges);

        // no layout if the topology and layout parameters haven't changed
        let skip_layout = false;
        if (!_diagram.layoutUnchanged()) {
            const node_fields = _diagram.nodeChangeSelect()(),
                edge_fields = _diagram.edgeChangeSelect()();
            const nodes_snapshot = JSON.stringify(wnodes.map(node_fields));
            const edges_snapshot = JSON.stringify(wedges.map(edge_fields));
            if (nodes_snapshot === _nodes_snapshot && edges_snapshot === _edges_snapshot)
                skip_layout = true;
            _nodes_snapshot = nodes_snapshot;
            _edges_snapshot = edges_snapshot;
        }

        // edge lengths may be affected by node sizes
        wedges.forEach(e => {
            e.cola.dcg_edgeLength = _diagram.edgeLength.eval(e);
        });

        // cola constraints always use indices, but node references
        // are more friendly, so translate those

        // i am not satisfied with this constraint generation api...
        // https://github.com/dc-js/dc.graph.js/issues/10
        let constraints = _diagram.constrain()(_diagram, wnodes, wedges);

        // warn if there are any loops (before changing names to indices)
        // it would be better to do this in webcola
        // (for one thing, this duplicates logic in rectangle.ts)
        // but by that time it has lost the names of things,
        // so the output would be difficult to use
        const constraints_by_left = constraints.reduce((p, c) => {
            if (c.type) {
                switch (c.type) {
                    case 'alignment': {
                        const left = c.offsets[0].node;
                        p[left] = p[left] || [];
                        c.offsets.slice(1).forEach(o => {
                            p[left].push({node: o.node, in_constraint: c});
                        });
                        break;
                    }
                }
            } else if (c.axis) {
                p[c.left] = p[c.left] || [];
                p[c.left].push({node: c.right, in_constraint: c});
            }
            return p;
        }, {});
        const touched = {};
        function find_constraint_loops(con, stack) {
            const left = con.node;
            stack = stack || [];
            const loop = stack.find(con => con.node === left);
            stack = stack.concat([con]);
            if (loop)
                console.warn('found a loop in constraints', stack);
            if (touched[left])
                return;
            touched[left] = true;
            if (!constraints_by_left[left])
                return;
            constraints_by_left[left].forEach(right => {
                find_constraint_loops(right, stack);
            });
        }
        Object.keys(constraints_by_left).forEach(left => {
            if (!touched[left])
                find_constraint_loops({node: left, in_constraint: null});
        });

        // translate references from names to indices (ugly)
        const invalid_constraints = [];
        constraints.forEach(c => {
            if (c.type) {
                switch (c.type) {
                    case 'alignment':
                        c.offsets.forEach(o => {
                            o.node = _nodes[o.node].index;
                        });
                        break;
                    case 'circle':
                        c.nodes.forEach(n => {
                            n.node = _nodes[n.node].index;
                        });
                        break;
                }
            } else if (c.axis && c.left && c.right) {
                c.left = _nodes[c.left].index;
                c.right = _nodes[c.right].index;
            } else invalid_constraints.push(c);
        });

        if (invalid_constraints.length)
            console.warn(`${invalid_constraints.length} invalid constraints`, invalid_constraints);

        // pseudo-cola.js features

        // 1. non-layout edges are drawn but not told to cola.js
        let layout_edges = wedges.filter(_diagram.edgeIsLayout.eval);
        wedges.filter(x => !_diagram.edgeIsLayout.eval(x));

        // 2. type=circle constraints
        const circle_constraints = constraints.filter(c => c.type === 'circle');
        constraints = constraints.filter(c => c.type !== 'circle');
        circle_constraints.forEach(c => {
            const R = (c.distance || _diagram.baseLength()*4)/(2*Math.sin(Math.PI/c.nodes.length));
            const nindices = c.nodes.map(x => x.node);
            const namef = function(i) {
                return _diagram.nodeKey.eval(wnodes[i]);
            };
            const wheel = wheelEdges(namef, nindices, R)
                .map(e => {
                    const e1 = {internal: e};
                    e1.source = _nodes[e.sourcename];
                    e1.target = _nodes[e.targetname];
                    return e1;
                });
            layout_edges = layout_edges.concat(wheel);
        });

        // 3. ordered alignment
        const ordered_constraints = constraints.filter(c => c.type === 'ordering');
        constraints = constraints.filter(c => c.type !== 'ordering');
        ordered_constraints.forEach(c => {
            let sorted = c.nodes.map(n => _nodes[n]);
            if (c.ordering) {
                const orderingFn = param(c.ordering);
                sorted = sorted.sort((a, b) => ascending$1(orderingFn(a), orderingFn(b)));
            }
            let left;
            sorted.forEach((n, i) => {
                if (i === 0)
                    left = n;
                else {
                    constraints.push({
                        left: left.index,
                        right: (left = n).index,
                        axis: c.axis,
                        gap: c.gap,
                    });
                }
            });
        });
        if (skip_layout) {
            _running = false;
            // init_node_ports?
            _diagram.renderer().draw(drawState, true);
            _diagram.renderer().drawPorts(drawState);
            _diagram.renderer().fireTSEvent(_dispatch, drawState);
            check_zoom(drawState);
            return this;
        }
        const startTime = Date.now();

        function populate_cola(rnodes, redges, rclusters) {
            rnodes.forEach(rn => {
                const n = _nodes[rn.dcg_nodeKey];
                if (!n) {
                    console.warn(`received node "${rn.dcg_nodeKey}" that we did not send, ignored`);
                    return;
                }
                n.cola.x = rn.x;
                n.cola.y = rn.y;
                n.cola.z = rn.z;
            });
            (redges || []).forEach(re => {
                const e = _edges[re.dcg_edgeKey];
                if (!e) {
                    console.warn(`received edge "${re.dcg_edgeKey}" that we did not send, ignored`);
                    return;
                }
                if (re.points)
                    e.cola.points = re.points;
            });
            (wclusters || []).forEach(c => {
                c.cola.bounds = null;
            });
            if (rclusters)
                rclusters.forEach(rc => {
                    const c = _clusters[rc.dcg_clusterKey];
                    if (!c) {
                        console.warn(
                            `received cluster "${rc.dcg_clusterKey}" that we did not send, ignored`,
                        );
                        return;
                    }
                    if (rc.bounds)
                        c.cola.bounds = rc.bounds;
                });
        }
        _diagram.layoutEngine()
            .on('tick.diagram', (nodes, edges, clusters) => {
                const elapsed = Date.now()-startTime;
                if (!_diagram.initialOnly())
                    populate_cola(nodes, edges, clusters);
                if (_diagram.showLayoutSteps()) {
                    init_node_ports(_nodes, wports);
                    _dispatch.call(
                        'receivedLayout',
                        null,
                        _diagram,
                        _nodes,
                        wnodes,
                        _edges,
                        wedges,
                        _ports,
                        wports,
                    );
                    propagate_port_positions(_nodes, wedges, _ports);
                    _diagram.renderer().draw(drawState, true);
                    _diagram.renderer().drawPorts(drawState);
                    // should do this only once
                    _diagram.renderer().fireTSEvent(_dispatch, drawState);
                }
                if (_needsRedraw || _diagram.timeLimit() && elapsed > _diagram.timeLimit()) {
                    console.log('cancelled');
                    _diagram.layoutEngine().stop();
                }
            })
            .on('end.diagram', (nodes, edges, clusters) => {
                if (!_diagram.showLayoutSteps()) {
                    if (!_diagram.initialOnly())
                        populate_cola(nodes, edges, clusters);
                    init_node_ports(_nodes, wports);
                    _dispatch.call(
                        'receivedLayout',
                        null,
                        _diagram,
                        _nodes,
                        wnodes,
                        _edges,
                        wedges,
                        _ports,
                        wports,
                    );
                    propagate_port_positions(_nodes, wedges, _ports);
                    _diagram.renderer().draw(drawState, true);
                    _diagram.renderer().drawPorts(drawState);
                    _diagram.renderer().fireTSEvent(_dispatch, drawState);
                } else _diagram.layoutDone(true);
                check_zoom(drawState);
            })
            .on('start.diagram', () => {
                console.log(`algo ${_diagram.layoutEngine().layoutAlgorithm()} started.`);
                _dispatch.call('start');
            });

        if (_diagram.initialOnly())
            _diagram.layoutEngine().dispatch().end(wnodes, wedges);
        else {
            _dispatch.call('start'); // cola doesn't seem to fire this itself?
            const engine = _diagram.layoutEngine();
            engine.data(
                {width: _diagram.width(), height: _diagram.height()},
                wnodes.map(v => {
                    const lv = Object.assign({}, v.dcg_shape, v.cola);
                    if (engine.annotateNode)
                        engine.annotateNode(lv, v);
                    else if (engine.extractNodeAttrs)
                        Object.keys(engine.extractNodeAttrs()).forEach(key => {
                            lv[key] = engine.extractNodeAttrs()[key](v.orig);
                        });
                    return lv;
                }),
                layout_edges.map(e => {
                    const le = e.cola;
                    if (engine.annotateEdge)
                        engine.annotateEdge(le, e);
                    else if (engine.extractEdgeAttrs)
                        Object.keys(engine.extractEdgeAttrs()).forEach(key => {
                            le[key] = engine.extractEdgeAttrs()[key](e.orig);
                        });
                    return le;
                }),
                wclusters.map(c => c.cola),
                constraints,
            );
            engine.start();
        }
        return this;
    };

    function check_zoom(drawState) {
        let do_zoom, animate = true;
        if (_diagram.width_is_automatic() || _diagram.height_is_automatic())
            detect_size_change();
        switch (_diagram.autoZoom()) {
            case 'always-skipanimonce':
                animate = false;
                _diagram.autoZoom('always');
                // falls through
            case 'always':
                do_zoom = true;
                break;
            case 'once-noanim':
                animate = false;
                // falls through
            case 'once':
                do_zoom = true;
                _diagram.autoZoom(null);
                break;
            default:
                do_zoom = false;
        }
        calc_bounds(drawState);
        if (do_zoom)
            auto_zoom(animate);
    }

    function norm(v) {
        const len = Math.hypot(v[0], v[1]);
        return [v[0]/len, v[1]/len];
    }
    function edge_vec(n, e) {
        let dy = e.target.cola.y-e.source.cola.y,
            dx = e.target.cola.x-e.source.cola.x;
        if (dy === 0 && dx === 0)
            return [1, 0];
        if (e.source !== n)
            dy = -dy, dx = -dx;
        if (e.parallel && e.parallel.edges.length > 1 && e.source.index > e.target.index)
            dy = -dy, dx = -dx;
        return norm([dx, dy]);
    }
    function init_node_ports(nodes, wports) {
        _nodePorts = {};
        // assemble port-lists for nodes, again because we don't have a metagraph.
        wports.forEach(p => {
            const nid = _diagram.nodeKey.eval(p.node);
            const np = _nodePorts[nid] = _nodePorts[nid] || [];
            np.push(p);
        });
        for (const nid in _nodePorts) {
            const n = nodes[nid],
                nports = _nodePorts[nid];
            // initial positions: use average of edge vectors, if any, or existing position
            nports.forEach(p => {
                if (_diagram.portElastic.eval(p) && p.edges.length) {
                    const vecs = p.edges.map(edge_vec.bind(null, n));
                    p.vec = [
                        sum(vecs, v => v[0])/vecs.length,
                        sum(vecs, v => v[1])/vecs.length,
                    ];
                } else p.vec = p.vec || undefined;
                p.pos = null;
            });
        }
    }
    function propagate_port_positions(nodes, wedges, ports) {
        // make sure we have projected vectors to positions
        for (const nid in _nodePorts) {
            const n = nodes[nid];
            _nodePorts[nid].forEach(p => {
                if (!p.pos)
                    projectPort(_diagram, n, p);
            });
        }

        // propagate port positions to edge endpoints
        wedges.forEach(e => {
            let name = _diagram.edgeSourcePortName.eval(e);
            e.sourcePort.pos = name
                ? ports[portName(_diagram.nodeKey.eval(e.source), null, name)].pos
                : ports[portName(null, _diagram.edgeKey.eval(e), 'source')].pos;
            name = _diagram.edgeTargetPortName.eval(e);
            e.targetPort.pos = name
                ? ports[portName(_diagram.nodeKey.eval(e.target), null, name)].pos
                : ports[portName(null, _diagram.edgeKey.eval(e), 'target')].pos;
            console.assert(e.sourcePort.pos && e.targetPort.pos);
        });
    }

    _diagram.requestRefresh = function(durationOverride) {
        window.requestAnimationFrame(() => {
            let transdur;
            if (durationOverride !== undefined) {
                transdur = _diagram.transitionDuration();
                _diagram.transitionDuration(durationOverride);
            }
            _diagram.renderer().refresh();
            if (durationOverride !== undefined)
                _diagram.transitionDuration(transdur);
        });
    };

    _diagram.layoutDone = function(happens) {
        _dispatch.call('end', null, happens);
        _running = false;
        if (_needsRedraw) {
            _needsRedraw = false;
            window.setTimeout(() => {
                if (!_diagram.isRunning()) // someone else may already have started
                    _diagram.redraw();
            }, 0);
        }
    };

    function enforce_path_direction(path, spos, tpos) {
        const points = path.points, first = points[0], last = points[points.length-1];
        switch (_diagram.enforceEdgeDirection()) {
            case 'LR':
                if (spos.x >= tpos.x) {
                    const dx = first.x-last.x;
                    return {
                        points: [
                            first,
                            {x: first.x+dx, y: first.y-dx/2},
                            {x: last.x-dx, y: last.y-dx/2},
                            last,
                        ],
                        bezDegree: 3,
                        sourcePort: path.sourcePort,
                        targetPort: path.targetPort,
                    };
                }
                break;
            case 'TB':
                if (spos.y >= tpos.y) {
                    const dy = first.y-last.y;
                    return {
                        points: [
                            first,
                            {x: first.x+dy/2, y: first.y+dy},
                            {x: last.x+dy/2, y: last.y-dy},
                            last,
                        ],
                        bezDegree: 3,
                        sourcePort: path.sourcePort,
                        targetPort: path.targetPort,
                    };
                }
                break;
        }
        return path;
    }
    _diagram.calcEdgePath = function(e, age, sx, sy, tx, ty) {
        const parallel = e.parallel;
        let source = e.source, target = e.target;
        if (parallel.edges.length > 1 && e.source.index > e.target.index) {
            let t;
            t = target;
            target = source;
            source = t;
            t = tx;
            tx = sx;
            sx = t;
            t = ty;
            ty = sy;
            sy = t;
        }
        const source_padding = source.dcg_ry
                +_diagram.nodeStrokeWidth.eval(source)/2,
            target_padding = target.dcg_ry
                +_diagram.nodeStrokeWidth.eval(target)/2;
        for (let p = 0; p < parallel.edges.length; ++p) {
            // alternate parallel edges over, then under
            const dir = (!!(p%2) === (sx < tx)) ? -1 : 1,
                port = Math.floor((p+1)/2),
                last = port > 0 ? parallel.edges[p > 2 ? p-2 : 0].pos[age].path : null;
            let path = drawEdgeToShapes(
                _diagram,
                e,
                sx,
                sy,
                tx,
                ty,
                last,
                dir,
                _diagram.parallelEdgeOffset(),
                source_padding,
                target_padding,
            );
            if (parallel.edges.length > 1 && parallel.rev[p])
                path.points.reverse();
            if (_diagram.enforceEdgeDirection())
                path = enforce_path_direction(path, source.cola, target.cola);
            const path0 = {
                points: path.points,
                bezDegree: path.bezDegree,
            };
            const alengths = scaledArrowLengths(_diagram, parallel.edges[p]);
            path = clipPathToArrows(alengths.headLength, alengths.tailLength, path);
            const points = path.points, points0 = path0.points;
            parallel.edges[p].pos[age] = {
                path,
                full: path0,
                orienthead: `${
                    angleBetweenPoints(points[points.length-1], points0[points0.length-1])
                }rad`,
                orienttail: `${angleBetweenPoints(points[0], points0[0])}rad`,
            };
        }
    };

    function node_bounds(n) {
        let bounds = {
            left: n.cola.x-n.dcg_rx,
            top: n.cola.y-n.dcg_ry,
            right: n.cola.x+n.dcg_rx,
            bottom: n.cola.y+n.dcg_ry,
        };
        if (_diagram.portStyle.enum().length) {
            const ports = _nodePorts[_diagram.nodeKey.eval(n)];
            if (ports)
                ports.forEach(p => {
                    const portStyle = _diagram.portStyleName.eval(p);
                    if (!portStyle || !_diagram.portStyle(portStyle))
                        return;
                    const pb = _diagram.portStyle(portStyle).portBounds(p);
                    pb.left += n.cola.x;
                    pb.top += n.cola.y;
                    pb.right += n.cola.x;
                    pb.bottom += n.cola.y;
                    bounds = union_bounds(bounds, pb);
                });
        }
        return bounds;
    }

    function union_bounds(b1, b2) {
        return {
            left: Math.min(b1.left, b2.left),
            top: Math.min(b1.top, b2.top),
            right: Math.max(b1.right, b2.right),
            bottom: Math.max(b1.bottom, b2.bottom),
        };
    }

    function point_to_bounds(p) {
        return {
            left: p.x,
            top: p.y,
            right: p.x,
            bottom: p.y,
        };
    }

    function edge_bounds(e) {
        // assumption: edge must have some points
        const points = e.pos.new.path.points;
        return points.map(point_to_bounds).reduce(union_bounds);
    }

    _diagram.calculateBounds = function(ndata, edata) {
        // assumption: there can be no edges without nodes
        const bounds = ndata.map(node_bounds).reduce(union_bounds);
        return edata.map(edge_bounds).reduce(union_bounds, bounds);
    };
    let _bounds;
    function calc_bounds(drawState) {
        if ((_diagram.fitStrategy() || _diagram.restrictPan())) {
            _bounds = _diagram.renderer().calculateBounds(drawState);
        }
    }

    _diagram.animateZoom = function(_) {
        if (!arguments.length)
            return _animateZoom;
        _animateZoom = _;
        return _diagram;
    };

    function auto_zoom(animate) {
        if (_diagram.fitStrategy()) {
            if (!_bounds)
                return;
            const vwidth = _bounds.right-_bounds.left,
                vheight = _bounds.bottom-_bounds.top,
                swidth = _diagram.width()-_diagram.margins().left-_diagram.margins().right,
                sheight = _diagram.height()-_diagram.margins().top-_diagram.margins().bottom;
            const fitS = _diagram.fitStrategy();
            let translate = [0, 0], scale = 1;
            if (['default', 'vertical', 'horizontal'].indexOf(fitS) >= 0) {
                const sAR = sheight/swidth,
                    vAR = vheight/vwidth,
                    vrl = vAR < sAR, // view aspect ratio is less (wider)
                    amv = (fitS === 'default') ? !vrl : (fitS === 'vertical'); // align margins vertically
                scale = amv ? sheight/vheight : swidth/vwidth;
                scale = Math.max(
                    _diagram.zoomExtent()[0],
                    Math.min(_diagram.zoomExtent()[1], scale),
                );
                translate = [
                    _diagram.margins().left-_bounds.left*scale+(swidth-vwidth*scale)/2,
                    _diagram.margins().top-_bounds.top*scale+(sheight-vheight*scale)/2,
                ];
            } else if (typeof fitS === 'string' && fitS.match(/^align_/)) {
                const sides = fitS.split('_')[1].toLowerCase().split('');
                if (sides.length > 2)
                    throw new Error(`align_ expecting 0-2 sides, not ${sides.length}`);
                const bounds = margined_bounds();
                translate = _diagram.renderer().translate();
                scale = _diagram.renderer().scale();
                let vertalign = false, horzalign = false;
                sides.forEach(s => {
                    switch (s) {
                        case 'l':
                            translate[0] = align_left(translate, bounds.left);
                            horzalign = true;
                            break;
                        case 't':
                            translate[1] = align_top(translate, bounds.top);
                            vertalign = true;
                            break;
                        case 'r':
                            translate[0] = align_right(translate, bounds.right);
                            horzalign = true;
                            break;
                        case 'b':
                            translate[1] = align_bottom(translate, bounds.bottom);
                            vertalign = true;
                            break;
                        case 'c': // handled below
                            break;
                        default:
                            throw new Error(`align_ expecting l t r b or c, not '${s}'`);
                    }
                });
                if (sides.includes('c')) {
                    if (!horzalign)
                        translate[0] = center_horizontally(translate, bounds);
                    if (!vertalign)
                        translate[1] = center_vertically(translate, bounds);
                }
            } else if (fitS === 'zoom') {
                scale = _diagram.renderer().scale();
                translate = bring_in_bounds(_diagram.renderer().translate());
            } else
                throw new Error(`unknown fitStrategy type ${typeof fitS}`);

            _animateZoom = animate;
            _diagram.renderer().translate(translate).scale(scale).commitTranslateScale();
            _animateZoom = false;
        }
    }
    function namespace_event_reducer(msg_fun) {
        return function(p, ev) {
            const namespace = {};
            p[ev] = function(ns) {
                return namespace[ns] = namespace[ns] || onetimeTrace('trace', msg_fun(ns, ev));
            };
            return p;
        };
    }
    const renderer_specific_events = ['drawn', 'transitionsStarted', 'zoomed']
        .reduce(
            namespace_event_reducer((ns, ev) =>
                `subscribing "${ns}" to event "${ev}" which takes renderer-specific parameters`
            ),
            {},
        );
    const inconsistent_arguments = ['end']
        .reduce(
            namespace_event_reducer((ns, ev) =>
                `subscribing "${ns}" to event "${ev}" which may receive inconsistent arguments`
            ),
            {},
        );

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Attaches an event handler to the diagram. The currently supported events are
     * * `start()` - layout is starting
     * * `drawn(nodes, edges)` - the node and edge elements have been rendered to the screen
     * and can be modified through the passed d3 selections.
     * * `end()` - diagram layout has completed.
     * @method on
     * @memberof dc_graph.diagram
     * @instance
     * @param {String} [event] - the event to subscribe to
     * @param {Function} [f] - the event handler
     * @return {dc_graph.diagram}
     */
    _diagram.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        const evns = event.split('.'),
            warning = renderer_specific_events[evns[0]] || inconsistent_arguments[evns[0]];
        if (warning)
            warning(evns[1] || '')();
        _dispatch.on(event, f);
        return this;
    };

    /**
     * Returns an object with current statistics on graph layout.
     * * `nnodes` - number of nodes displayed
     * * `nedges` - number of edges displayed
     * @method getStats
     * @memberof dc_graph.diagram
     * @instance
     * @return {}
     * @return {dc_graph.diagram}
     */
    _diagram.getStats = function() {
        return _stats;
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Gets or sets the x scale.
     * @method x
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.scale} [scale]
     * @return {d3.scale}
     * @return {dc_graph.diagram}

     **/
    _diagram.x = property(null);

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Gets or sets the y scale.
     * @method y
     * @memberof dc_graph.diagram
     * @instance
     * @param {d3.scale} [scale]
     * @return {d3.scale}
     * @return {dc_graph.diagram}

     **/
    _diagram.y = property(null);

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be redrawn.
     * @method redrawGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.redrawGroup = function() {
        redrawAll(_chartGroup);
    };

    /**
     * Standard dc.js
     * {@link https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.baseMixin baseMixin}
     * method. Causes all charts in the chart group to be rendered.
     * @method renderGroup
     * @memberof dc_graph.diagram
     * @instance
     * @return {dc_graph.diagram}
     */
    _diagram.renderGroup = function() {
        renderAll(_chartGroup);
    };

    /**
     * Creates an svg marker definition for drawing edge arrow tails or heads.
     *
     * Sorry, this is not currently documented - please see
     * [arrows.js](https://github.com/dc-js/dc.graph.js/blob/develop/src/arrows.js)
     * for examples
     * @return {dc_graph.diagram}
     */
    _diagram.defineArrow = function(name, defn) {
        if (typeof defn !== 'function')
            throw new Error(
                'sorry, defineArrow no longer takes specific shape parameters, and the parameters have changed too much to convert them. it takes a name and a function returning a definition - please look at arrows.js for new format',
            );
        _arrows[name] = defn;
        return _diagram;
    };

    // hmm
    _diagram.arrows = function() {
        return _arrows;
    };

    Object.keys(builtinArrows).forEach(aname => {
        const defn = builtinArrows[aname];
        _diagram.defineArrow(aname, defn);
    });

    function margined_bounds() {
        const bounds = _bounds || {left: 0, top: 0, right: 0, bottom: 0};
        const scale = _diagram.renderer().scale();
        return {
            left: bounds.left-_diagram.margins().left/scale,
            top: bounds.top-_diagram.margins().top/scale,
            right: bounds.right+_diagram.margins().right/scale,
            bottom: bounds.bottom+_diagram.margins().bottom/scale,
        };
    }

    // with thanks to comments in https://github.com/d3/d3/issues/1084
    function align_left(translate, x) {
        return translate[0]-_diagram.x()(x)+_diagram.x().range()[0];
    }
    function align_top(translate, y) {
        return translate[1]-_diagram.y()(y)+_diagram.y().range()[0];
    }
    function align_right(translate, x) {
        return translate[0]-_diagram.x()(x)+_diagram.x().range()[1];
    }
    function align_bottom(translate, y) {
        return translate[1]-_diagram.y()(y)+_diagram.y().range()[1];
    }
    function center_horizontally(translate, bounds) {
        return (align_left(translate, bounds.left)+align_right(translate, bounds.right))/2;
    }
    function center_vertically(translate, bounds) {
        return (align_top(translate, bounds.top)+align_bottom(translate, bounds.bottom))/2;
    }

    function bring_in_bounds(translate) {
        const xDomain = _diagram.x().domain(), yDomain = _diagram.y().domain();
        const bounds = margined_bounds();
        let less1 = bounds.left < xDomain[0],
            less2 = bounds.right < xDomain[1],
            lessExt = (bounds.right-bounds.left) < (xDomain[1]-xDomain[0]);
        let align;
        if (less1 && less2) {
            if (lessExt)
                align = 'left';
            else
                align = 'right';
        } else if (!less1 && !less2) {
            if (lessExt)
                align = 'right';
            else
                align = 'left';
        }
        switch (align) {
            case 'left':
                translate[0] = align_left(translate, bounds.left);
                break;
            case 'right':
                translate[0] = align_right(translate, bounds.right);
                break;
        }
        less1 = bounds.top < yDomain[0];
        less2 = bounds.bottom < yDomain[1];
        lessExt = (bounds.bottom-bounds.top) < (yDomain[1]-yDomain[0]);
        if (less1 && less2) {
            if (lessExt)
                align = 'top';
            else
                align = 'bottom';
        } else if (!less1 && !less2) {
            if (lessExt)
                align = 'bottom';
            else
                align = 'top';
        }
        switch (align) {
            case 'top':
                translate[1] = align_top(translate, bounds.top);
                break;
            case 'bottom':
                translate[1] = align_bottom(translate, bounds.bottom);
                break;
        }
        return translate;
    }

    _diagram.doZoom = function() {
        if (_diagram.width_is_automatic() || _diagram.height_is_automatic())
            detect_size_change();

        const transform$1 = transform(_diagram.renderer().svg().node());
        const scale = transform$1.k;
        let translate;
        if (_diagram.restrictPan())
            translate = bring_in_bounds([transform$1.x, transform$1.y]);
        else translate = [transform$1.x, transform$1.y];

        // Manually rescale x and y scales for D3 v5
        const newX = transform$1.rescaleX(_diagram.x());
        const newY = transform$1.rescaleY(_diagram.y());

        _diagram.renderer().globalTransform(translate, scale, _animateZoom);
        _dispatch.call('zoomed', null, translate, scale, newX.domain(), newY.domain());
    };

    _diagram.invertCoord = function(clientCoord) {
        return [
            _diagram.x().invert(clientCoord[0]),
            _diagram.y().invert(clientCoord[1]),
        ];
    };

    /**
     * Set the root SVGElement to either be any valid [d3 single
     * selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom
     * block element such as a div; or a dom element or d3 selection. This class is called
     * internally on diagram initialization, but be called again to relocate the diagram. However, it
     * will orphan any previously created SVGElements.
     * @method anchor
     * @memberof dc_graph.diagram
     * @instance
     * @param {anchorSelector|anchorNode|d3.selection} [parent]
     * @param {String} [chartGroup]
     * @return {String|node|d3.selection}
     * @return {dc_graph.diagram}
     */
    _diagram.anchor = function(parent, chartGroup) {
        if (!arguments.length) {
            return _anchor;
        }
        if (parent) {
            if (parent.select && parent.classed) { // detect d3 selection
                _anchor = parent.node();
            } else {
                _anchor = parent;
            }
            _diagram.root(select(_anchor));
            _diagram.root().classed(constants$1.CHART_CLASS, true);
            registerChart(_diagram, chartGroup);
        } else {
            throw new BadArgumentException('parent must be defined');
        }
        _chartGroup = chartGroup;
        return _diagram;
    };

    /**
     * Returns the internal numeric ID of the chart.
     * @method chartID
     * @memberof dc.baseMixin
     * @instance
     * @returns {String}
     */
    _diagram.chartID = function() {
        return _diagram.__dcFlag__;
    };

    /**
     * Returns the DOM id for the chart's anchored location.
     * @method anchorName
     * @memberof dc_graph.diagram
     * @instance
     * @return {String}
     */
    _diagram.anchorName = function() {
        const a = _diagram.anchor();
        if (a && a.id) {
            return a.id;
        }
        if (a && a.replace) {
            return a.replace('#', '');
        }
        return `dc-graph${_diagram.chartID()}`;
    };

    return _diagram.anchor(parent, chartGroup);
}

function forceCenter(x, y) {
  var nodes;

  if (x == null) x = 0;
  if (y == null) y = 0;

  function force() {
    var i,
        n = nodes.length,
        node,
        sx = 0,
        sy = 0;

    for (i = 0; i < n; ++i) {
      node = nodes[i], sx += node.x, sy += node.y;
    }

    for (sx = sx / n - x, sy = sy / n - y, i = 0; i < n; ++i) {
      node = nodes[i], node.x -= sx, node.y -= sy;
    }
  }

  force.initialize = function(_) {
    nodes = _;
  };

  force.x = function(_) {
    return arguments.length ? (x = +_, force) : x;
  };

  force.y = function(_) {
    return arguments.length ? (y = +_, force) : y;
  };

  return force;
}

function constant$2(x) {
  return function() {
    return x;
  };
}

function jiggle() {
  return (Math.random() - 0.5) * 1e-6;
}

function tree_add(d) {
  var x = +this._x.call(null, d),
      y = +this._y.call(null, d);
  return add(this.cover(x, y), x, y, d);
}

function add(tree, x, y, d) {
  if (isNaN(x) || isNaN(y)) return tree; // ignore invalid points

  var parent,
      node = tree._root,
      leaf = {data: d},
      x0 = tree._x0,
      y0 = tree._y0,
      x1 = tree._x1,
      y1 = tree._y1,
      xm,
      ym,
      xp,
      yp,
      right,
      bottom,
      i,
      j;

  // If the tree is empty, initialize the root as a leaf.
  if (!node) return tree._root = leaf, tree;

  // Find the existing leaf for the new point, or add it.
  while (node.length) {
    if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
    if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
    if (parent = node, !(node = node[i = bottom << 1 | right])) return parent[i] = leaf, tree;
  }

  // Is the new point is exactly coincident with the existing point?
  xp = +tree._x.call(null, node.data);
  yp = +tree._y.call(null, node.data);
  if (x === xp && y === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;

  // Otherwise, split the leaf node until the old and new point are separated.
  do {
    parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
    if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
    if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
  } while ((i = bottom << 1 | right) === (j = (yp >= ym) << 1 | (xp >= xm)));
  return parent[j] = node, parent[i] = leaf, tree;
}

function addAll(data) {
  var d, i, n = data.length,
      x,
      y,
      xz = new Array(n),
      yz = new Array(n),
      x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;

  // Compute the points and their extent.
  for (i = 0; i < n; ++i) {
    if (isNaN(x = +this._x.call(null, d = data[i])) || isNaN(y = +this._y.call(null, d))) continue;
    xz[i] = x;
    yz[i] = y;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }

  // If there were no (valid) points, inherit the existing extent.
  if (x1 < x0) x0 = this._x0, x1 = this._x1;
  if (y1 < y0) y0 = this._y0, y1 = this._y1;

  // Expand the tree to cover the new points.
  this.cover(x0, y0).cover(x1, y1);

  // Add the new points.
  for (i = 0; i < n; ++i) {
    add(this, xz[i], yz[i], data[i]);
  }

  return this;
}

function tree_cover(x, y) {
  if (isNaN(x = +x) || isNaN(y = +y)) return this; // ignore invalid points

  var x0 = this._x0,
      y0 = this._y0,
      x1 = this._x1,
      y1 = this._y1;

  // If the quadtree has no extent, initialize them.
  // Integer extent are necessary so that if we later double the extent,
  // the existing quadrant boundaries don’t change due to floating point error!
  if (isNaN(x0)) {
    x1 = (x0 = Math.floor(x)) + 1;
    y1 = (y0 = Math.floor(y)) + 1;
  }

  // Otherwise, double repeatedly to cover.
  else if (x0 > x || x > x1 || y0 > y || y > y1) {
    var z = x1 - x0,
        node = this._root,
        parent,
        i;

    switch (i = (y < (y0 + y1) / 2) << 1 | (x < (x0 + x1) / 2)) {
      case 0: {
        do parent = new Array(4), parent[i] = node, node = parent;
        while (z *= 2, x1 = x0 + z, y1 = y0 + z, x > x1 || y > y1);
        break;
      }
      case 1: {
        do parent = new Array(4), parent[i] = node, node = parent;
        while (z *= 2, x0 = x1 - z, y1 = y0 + z, x0 > x || y > y1);
        break;
      }
      case 2: {
        do parent = new Array(4), parent[i] = node, node = parent;
        while (z *= 2, x1 = x0 + z, y0 = y1 - z, x > x1 || y0 > y);
        break;
      }
      case 3: {
        do parent = new Array(4), parent[i] = node, node = parent;
        while (z *= 2, x0 = x1 - z, y0 = y1 - z, x0 > x || y0 > y);
        break;
      }
    }

    if (this._root && this._root.length) this._root = node;
  }

  // If the quadtree covers the point already, just return.
  else return this;

  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  return this;
}

function tree_data() {
  var data = [];
  this.visit(function(node) {
    if (!node.length) do data.push(node.data); while (node = node.next)
  });
  return data;
}

function tree_extent(_) {
  return arguments.length
      ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1])
      : isNaN(this._x0) ? undefined : [[this._x0, this._y0], [this._x1, this._y1]];
}

function Quad(node, x0, y0, x1, y1) {
  this.node = node;
  this.x0 = x0;
  this.y0 = y0;
  this.x1 = x1;
  this.y1 = y1;
}

function tree_find(x, y, radius) {
  var data,
      x0 = this._x0,
      y0 = this._y0,
      x1,
      y1,
      x2,
      y2,
      x3 = this._x1,
      y3 = this._y1,
      quads = [],
      node = this._root,
      q,
      i;

  if (node) quads.push(new Quad(node, x0, y0, x3, y3));
  if (radius == null) radius = Infinity;
  else {
    x0 = x - radius, y0 = y - radius;
    x3 = x + radius, y3 = y + radius;
    radius *= radius;
  }

  while (q = quads.pop()) {

    // Stop searching if this quadrant can’t contain a closer node.
    if (!(node = q.node)
        || (x1 = q.x0) > x3
        || (y1 = q.y0) > y3
        || (x2 = q.x1) < x0
        || (y2 = q.y1) < y0) continue;

    // Bisect the current quadrant.
    if (node.length) {
      var xm = (x1 + x2) / 2,
          ym = (y1 + y2) / 2;

      quads.push(
        new Quad(node[3], xm, ym, x2, y2),
        new Quad(node[2], x1, ym, xm, y2),
        new Quad(node[1], xm, y1, x2, ym),
        new Quad(node[0], x1, y1, xm, ym)
      );

      // Visit the closest quadrant first.
      if (i = (y >= ym) << 1 | (x >= xm)) {
        q = quads[quads.length - 1];
        quads[quads.length - 1] = quads[quads.length - 1 - i];
        quads[quads.length - 1 - i] = q;
      }
    }

    // Visit this point. (Visiting coincident points isn’t necessary!)
    else {
      var dx = x - +this._x.call(null, node.data),
          dy = y - +this._y.call(null, node.data),
          d2 = dx * dx + dy * dy;
      if (d2 < radius) {
        var d = Math.sqrt(radius = d2);
        x0 = x - d, y0 = y - d;
        x3 = x + d, y3 = y + d;
        data = node.data;
      }
    }
  }

  return data;
}

function tree_remove(d) {
  if (isNaN(x = +this._x.call(null, d)) || isNaN(y = +this._y.call(null, d))) return this; // ignore invalid points

  var parent,
      node = this._root,
      retainer,
      previous,
      next,
      x0 = this._x0,
      y0 = this._y0,
      x1 = this._x1,
      y1 = this._y1,
      x,
      y,
      xm,
      ym,
      right,
      bottom,
      i,
      j;

  // If the tree is empty, initialize the root as a leaf.
  if (!node) return this;

  // Find the leaf node for the point.
  // While descending, also retain the deepest parent with a non-removed sibling.
  if (node.length) while (true) {
    if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
    if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
    if (!(parent = node, node = node[i = bottom << 1 | right])) return this;
    if (!node.length) break;
    if (parent[(i + 1) & 3] || parent[(i + 2) & 3] || parent[(i + 3) & 3]) retainer = parent, j = i;
  }

  // Find the point to remove.
  while (node.data !== d) if (!(previous = node, node = node.next)) return this;
  if (next = node.next) delete node.next;

  // If there are multiple coincident points, remove just the point.
  if (previous) return (next ? previous.next = next : delete previous.next), this;

  // If this is the root point, remove it.
  if (!parent) return this._root = next, this;

  // Remove this leaf.
  next ? parent[i] = next : delete parent[i];

  // If the parent now contains exactly one leaf, collapse superfluous parents.
  if ((node = parent[0] || parent[1] || parent[2] || parent[3])
      && node === (parent[3] || parent[2] || parent[1] || parent[0])
      && !node.length) {
    if (retainer) retainer[j] = node;
    else this._root = node;
  }

  return this;
}

function removeAll(data) {
  for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
  return this;
}

function tree_root() {
  return this._root;
}

function tree_size() {
  var size = 0;
  this.visit(function(node) {
    if (!node.length) do ++size; while (node = node.next)
  });
  return size;
}

function tree_visit(callback) {
  var quads = [], q, node = this._root, child, x0, y0, x1, y1;
  if (node) quads.push(new Quad(node, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    if (!callback(node = q.node, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1) && node.length) {
      var xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
      if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
      if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
      if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
    }
  }
  return this;
}

function tree_visitAfter(callback) {
  var quads = [], next = [], q;
  if (this._root) quads.push(new Quad(this._root, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    var node = q.node;
    if (node.length) {
      var child, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
      if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
      if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
      if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
    }
    next.push(q);
  }
  while (q = next.pop()) {
    callback(q.node, q.x0, q.y0, q.x1, q.y1);
  }
  return this;
}

function defaultX(d) {
  return d[0];
}

function tree_x(_) {
  return arguments.length ? (this._x = _, this) : this._x;
}

function defaultY(d) {
  return d[1];
}

function tree_y(_) {
  return arguments.length ? (this._y = _, this) : this._y;
}

function quadtree(nodes, x, y) {
  var tree = new Quadtree(x == null ? defaultX : x, y == null ? defaultY : y, NaN, NaN, NaN, NaN);
  return nodes == null ? tree : tree.addAll(nodes);
}

function Quadtree(x, y, x0, y0, x1, y1) {
  this._x = x;
  this._y = y;
  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  this._root = undefined;
}

function leaf_copy(leaf) {
  var copy = {data: leaf.data}, next = copy;
  while (leaf = leaf.next) next = next.next = {data: leaf.data};
  return copy;
}

var treeProto = quadtree.prototype = Quadtree.prototype;

treeProto.copy = function() {
  var copy = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1),
      node = this._root,
      nodes,
      child;

  if (!node) return copy;

  if (!node.length) return copy._root = leaf_copy(node), copy;

  nodes = [{source: node, target: copy._root = new Array(4)}];
  while (node = nodes.pop()) {
    for (var i = 0; i < 4; ++i) {
      if (child = node.source[i]) {
        if (child.length) nodes.push({source: child, target: node.target[i] = new Array(4)});
        else node.target[i] = leaf_copy(child);
      }
    }
  }

  return copy;
};

treeProto.add = tree_add;
treeProto.addAll = addAll;
treeProto.cover = tree_cover;
treeProto.data = tree_data;
treeProto.extent = tree_extent;
treeProto.find = tree_find;
treeProto.remove = tree_remove;
treeProto.removeAll = removeAll;
treeProto.root = tree_root;
treeProto.size = tree_size;
treeProto.visit = tree_visit;
treeProto.visitAfter = tree_visitAfter;
treeProto.x = tree_x;
treeProto.y = tree_y;

function x$1(d) {
  return d.x + d.vx;
}

function y$1(d) {
  return d.y + d.vy;
}

function forceCollide(radius) {
  var nodes,
      radii,
      strength = 1,
      iterations = 1;

  if (typeof radius !== "function") radius = constant$2(radius == null ? 1 : +radius);

  function force() {
    var i, n = nodes.length,
        tree,
        node,
        xi,
        yi,
        ri,
        ri2;

    for (var k = 0; k < iterations; ++k) {
      tree = quadtree(nodes, x$1, y$1).visitAfter(prepare);
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        ri = radii[node.index], ri2 = ri * ri;
        xi = node.x + node.vx;
        yi = node.y + node.vy;
        tree.visit(apply);
      }
    }

    function apply(quad, x0, y0, x1, y1) {
      var data = quad.data, rj = quad.r, r = ri + rj;
      if (data) {
        if (data.index > node.index) {
          var x = xi - data.x - data.vx,
              y = yi - data.y - data.vy,
              l = x * x + y * y;
          if (l < r * r) {
            if (x === 0) x = jiggle(), l += x * x;
            if (y === 0) y = jiggle(), l += y * y;
            l = (r - (l = Math.sqrt(l))) / l * strength;
            node.vx += (x *= l) * (r = (rj *= rj) / (ri2 + rj));
            node.vy += (y *= l) * r;
            data.vx -= x * (r = 1 - r);
            data.vy -= y * r;
          }
        }
        return;
      }
      return x0 > xi + r || x1 < xi - r || y0 > yi + r || y1 < yi - r;
    }
  }

  function prepare(quad) {
    if (quad.data) return quad.r = radii[quad.data.index];
    for (var i = quad.r = 0; i < 4; ++i) {
      if (quad[i] && quad[i].r > quad.r) {
        quad.r = quad[i].r;
      }
    }
  }

  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, node;
    radii = new Array(n);
    for (i = 0; i < n; ++i) node = nodes[i], radii[node.index] = +radius(node, i, nodes);
  }

  force.initialize = function(_) {
    nodes = _;
    initialize();
  };

  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };

  force.strength = function(_) {
    return arguments.length ? (strength = +_, force) : strength;
  };

  force.radius = function(_) {
    return arguments.length ? (radius = typeof _ === "function" ? _ : constant$2(+_), initialize(), force) : radius;
  };

  return force;
}

function index(d) {
  return d.index;
}

function find(nodeById, nodeId) {
  var node = nodeById.get(nodeId);
  if (!node) throw new Error("missing: " + nodeId);
  return node;
}

function forceLink(links) {
  var id = index,
      strength = defaultStrength,
      strengths,
      distance = constant$2(30),
      distances,
      nodes,
      count,
      bias,
      iterations = 1;

  if (links == null) links = [];

  function defaultStrength(link) {
    return 1 / Math.min(count[link.source.index], count[link.target.index]);
  }

  function force(alpha) {
    for (var k = 0, n = links.length; k < iterations; ++k) {
      for (var i = 0, link, source, target, x, y, l, b; i < n; ++i) {
        link = links[i], source = link.source, target = link.target;
        x = target.x + target.vx - source.x - source.vx || jiggle();
        y = target.y + target.vy - source.y - source.vy || jiggle();
        l = Math.sqrt(x * x + y * y);
        l = (l - distances[i]) / l * alpha * strengths[i];
        x *= l, y *= l;
        target.vx -= x * (b = bias[i]);
        target.vy -= y * b;
        source.vx += x * (b = 1 - b);
        source.vy += y * b;
      }
    }
  }

  function initialize() {
    if (!nodes) return;

    var i,
        n = nodes.length,
        m = links.length,
        nodeById = map(nodes, id),
        link;

    for (i = 0, count = new Array(n); i < m; ++i) {
      link = links[i], link.index = i;
      if (typeof link.source !== "object") link.source = find(nodeById, link.source);
      if (typeof link.target !== "object") link.target = find(nodeById, link.target);
      count[link.source.index] = (count[link.source.index] || 0) + 1;
      count[link.target.index] = (count[link.target.index] || 0) + 1;
    }

    for (i = 0, bias = new Array(m); i < m; ++i) {
      link = links[i], bias[i] = count[link.source.index] / (count[link.source.index] + count[link.target.index]);
    }

    strengths = new Array(m), initializeStrength();
    distances = new Array(m), initializeDistance();
  }

  function initializeStrength() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      strengths[i] = +strength(links[i], i, links);
    }
  }

  function initializeDistance() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      distances[i] = +distance(links[i], i, links);
    }
  }

  force.initialize = function(_) {
    nodes = _;
    initialize();
  };

  force.links = function(_) {
    return arguments.length ? (links = _, initialize(), force) : links;
  };

  force.id = function(_) {
    return arguments.length ? (id = _, force) : id;
  };

  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };

  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant$2(+_), initializeStrength(), force) : strength;
  };

  force.distance = function(_) {
    return arguments.length ? (distance = typeof _ === "function" ? _ : constant$2(+_), initializeDistance(), force) : distance;
  };

  return force;
}

function x(d) {
  return d.x;
}

function y(d) {
  return d.y;
}

var initialRadius = 10,
    initialAngle = Math.PI * (3 - Math.sqrt(5));

function forceSimulation(nodes) {
  var simulation,
      alpha = 1,
      alphaMin = 0.001,
      alphaDecay = 1 - Math.pow(alphaMin, 1 / 300),
      alphaTarget = 0,
      velocityDecay = 0.6,
      forces = map(),
      stepper = timer(step),
      event = dispatch("tick", "end");

  if (nodes == null) nodes = [];

  function step() {
    tick();
    event.call("tick", simulation);
    if (alpha < alphaMin) {
      stepper.stop();
      event.call("end", simulation);
    }
  }

  function tick(iterations) {
    var i, n = nodes.length, node;

    if (iterations === undefined) iterations = 1;

    for (var k = 0; k < iterations; ++k) {
      alpha += (alphaTarget - alpha) * alphaDecay;

      forces.each(function (force) {
        force(alpha);
      });

      for (i = 0; i < n; ++i) {
        node = nodes[i];
        if (node.fx == null) node.x += node.vx *= velocityDecay;
        else node.x = node.fx, node.vx = 0;
        if (node.fy == null) node.y += node.vy *= velocityDecay;
        else node.y = node.fy, node.vy = 0;
      }
    }

    return simulation;
  }

  function initializeNodes() {
    for (var i = 0, n = nodes.length, node; i < n; ++i) {
      node = nodes[i], node.index = i;
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      if (isNaN(node.x) || isNaN(node.y)) {
        var radius = initialRadius * Math.sqrt(i), angle = i * initialAngle;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      }
      if (isNaN(node.vx) || isNaN(node.vy)) {
        node.vx = node.vy = 0;
      }
    }
  }

  function initializeForce(force) {
    if (force.initialize) force.initialize(nodes);
    return force;
  }

  initializeNodes();

  return simulation = {
    tick: tick,

    restart: function() {
      return stepper.restart(step), simulation;
    },

    stop: function() {
      return stepper.stop(), simulation;
    },

    nodes: function(_) {
      return arguments.length ? (nodes = _, initializeNodes(), forces.each(initializeForce), simulation) : nodes;
    },

    alpha: function(_) {
      return arguments.length ? (alpha = +_, simulation) : alpha;
    },

    alphaMin: function(_) {
      return arguments.length ? (alphaMin = +_, simulation) : alphaMin;
    },

    alphaDecay: function(_) {
      return arguments.length ? (alphaDecay = +_, simulation) : +alphaDecay;
    },

    alphaTarget: function(_) {
      return arguments.length ? (alphaTarget = +_, simulation) : alphaTarget;
    },

    velocityDecay: function(_) {
      return arguments.length ? (velocityDecay = 1 - _, simulation) : 1 - velocityDecay;
    },

    force: function(name, _) {
      return arguments.length > 1 ? ((_ == null ? forces.remove(name) : forces.set(name, initializeForce(_))), simulation) : forces.get(name);
    },

    find: function(x, y, radius) {
      var i = 0,
          n = nodes.length,
          dx,
          dy,
          d2,
          node,
          closest;

      if (radius == null) radius = Infinity;
      else radius *= radius;

      for (i = 0; i < n; ++i) {
        node = nodes[i];
        dx = x - node.x;
        dy = y - node.y;
        d2 = dx * dx + dy * dy;
        if (d2 < radius) closest = node, radius = d2;
      }

      return closest;
    },

    on: function(name, _) {
      return arguments.length > 1 ? (event.on(name, _), simulation) : event.on(name);
    }
  };
}

function forceManyBody() {
  var nodes,
      node,
      alpha,
      strength = constant$2(-30),
      strengths,
      distanceMin2 = 1,
      distanceMax2 = Infinity,
      theta2 = 0.81;

  function force(_) {
    var i, n = nodes.length, tree = quadtree(nodes, x, y).visitAfter(accumulate);
    for (alpha = _, i = 0; i < n; ++i) node = nodes[i], tree.visit(apply);
  }

  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, node;
    strengths = new Array(n);
    for (i = 0; i < n; ++i) node = nodes[i], strengths[node.index] = +strength(node, i, nodes);
  }

  function accumulate(quad) {
    var strength = 0, q, c, weight = 0, x, y, i;

    // For internal nodes, accumulate forces from child quadrants.
    if (quad.length) {
      for (x = y = i = 0; i < 4; ++i) {
        if ((q = quad[i]) && (c = Math.abs(q.value))) {
          strength += q.value, weight += c, x += c * q.x, y += c * q.y;
        }
      }
      quad.x = x / weight;
      quad.y = y / weight;
    }

    // For leaf nodes, accumulate forces from coincident quadrants.
    else {
      q = quad;
      q.x = q.data.x;
      q.y = q.data.y;
      do strength += strengths[q.data.index];
      while (q = q.next);
    }

    quad.value = strength;
  }

  function apply(quad, x1, _, x2) {
    if (!quad.value) return true;

    var x = quad.x - node.x,
        y = quad.y - node.y,
        w = x2 - x1,
        l = x * x + y * y;

    // Apply the Barnes-Hut approximation if possible.
    // Limit forces for very close nodes; randomize direction if coincident.
    if (w * w / theta2 < l) {
      if (l < distanceMax2) {
        if (x === 0) x = jiggle(), l += x * x;
        if (y === 0) y = jiggle(), l += y * y;
        if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
        node.vx += x * quad.value * alpha / l;
        node.vy += y * quad.value * alpha / l;
      }
      return true;
    }

    // Otherwise, process points directly.
    else if (quad.length || l >= distanceMax2) return;

    // Limit forces for very close nodes; randomize direction if coincident.
    if (quad.data !== node || quad.next) {
      if (x === 0) x = jiggle(), l += x * x;
      if (y === 0) y = jiggle(), l += y * y;
      if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
    }

    do if (quad.data !== node) {
      w = strengths[quad.data.index] * alpha / l;
      node.vx += x * w;
      node.vy += y * w;
    } while (quad = quad.next);
  }

  force.initialize = function(_) {
    nodes = _;
    initialize();
  };

  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant$2(+_), initialize(), force) : strength;
  };

  force.distanceMin = function(_) {
    return arguments.length ? (distanceMin2 = _ * _, force) : Math.sqrt(distanceMin2);
  };

  force.distanceMax = function(_) {
    return arguments.length ? (distanceMax2 = _ * _, force) : Math.sqrt(distanceMax2);
  };

  force.theta = function(_) {
    return arguments.length ? (theta2 = _ * _, force) : Math.sqrt(theta2);
  };

  return force;
}

function forceX(x) {
  var strength = constant$2(0.1),
      nodes,
      strengths,
      xz;

  if (typeof x !== "function") x = constant$2(x == null ? 0 : +x);

  function force(alpha) {
    for (var i = 0, n = nodes.length, node; i < n; ++i) {
      node = nodes[i], node.vx += (xz[i] - node.x) * strengths[i] * alpha;
    }
  }

  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length;
    strengths = new Array(n);
    xz = new Array(n);
    for (i = 0; i < n; ++i) {
      strengths[i] = isNaN(xz[i] = +x(nodes[i], i, nodes)) ? 0 : +strength(nodes[i], i, nodes);
    }
  }

  force.initialize = function(_) {
    nodes = _;
    initialize();
  };

  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant$2(+_), initialize(), force) : strength;
  };

  force.x = function(_) {
    return arguments.length ? (x = typeof _ === "function" ? _ : constant$2(+_), initialize(), force) : x;
  };

  return force;
}

function forceY(y) {
  var strength = constant$2(0.1),
      nodes,
      strengths,
      yz;

  if (typeof y !== "function") y = constant$2(y == null ? 0 : +y);

  function force(alpha) {
    for (var i = 0, n = nodes.length, node; i < n; ++i) {
      node = nodes[i], node.vy += (yz[i] - node.y) * strengths[i] * alpha;
    }
  }

  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length;
    strengths = new Array(n);
    yz = new Array(n);
    for (i = 0; i < n; ++i) {
      strengths[i] = isNaN(yz[i] = +y(nodes[i], i, nodes)) ? 0 : +strength(nodes[i], i, nodes);
    }
  }

  force.initialize = function(_) {
    nodes = _;
    initialize();
  };

  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant$2(+_), initialize(), force) : strength;
  };

  force.y = function(_) {
    return arguments.length ? (y = typeof _ === "function" ? _ : constant$2(+_), initialize(), force) : y;
  };

  return force;
}

function forceStraightenPaths(paths) {
    var _nodes,
        _inputPaths = [],
        _paths, _id = function(n) { return n.index; },
        _angleForce = 0.1,
        _pathNodes = function(p) { return p.nodes; },
        _pathStrength = function(p) { return typeof p.strength !== 'undefined' ? +p.strength : 1; },
        _debug = false;
    var force = function(alpha) {
        function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; }        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); }        function _angle(v1, v2) {
            var a = _dot(v1, v2) / (_len(v1)*_len(v2));
            a = Math.min(a, 1);
            a = Math.max(a, -1);
            return Math.acos(a);
        }        // perpendicular unit length vector
        function _pVec(v) {
            var xx = -v.y/v.x, yy = 1;
            var length = _len({x: xx, y: yy});
            return {x: xx/length, y: yy/length};
        }
        function _displaceAdjacent(node, angle, pVec, k) {
            var turn = Math.PI-angle,
                turn2 = turn*turn;
            return {
                kind: 'adjacent',
                x: pVec.x*turn2*k,
                y: pVec.y*turn2*k
            };
        }

        function _displaceCenter(dadj1, dadj2) {
            return {
                kind: 'center',
                x: -(dadj1.x + dadj2.x),
                y: -(dadj1.y + dadj2.y)
            };
        }

        function _offsetNode(node, disp) {
            node.x += disp.x;
            node.y += disp.y;
        }
        var report = [];
        _paths.forEach(function(path, i) {
            var pnodes = path.nodes,
                strength = path.strength;
            if(typeof strength !== 'number')
                strength = 1;
            if(pnodes.length < 3) return; // at least 3 nodes (and 2 edges):  A->B->C
            if(_debug) {
                report.push({
                    action: 'init',
                    nodes: pnodes.map(function(n) {
                        return {
                            id: _id(n),
                            x: n.x,
                            y: n.y
                        };
                    }),
                    edges: pnodes.reduce(function(p, n) {
                        if(!Array.isArray(p))
                            return [{source: _id(p), target: _id(n)}];
                        p.push({source: p[p.length-1].target, target: _id(n)});
                        return p;
                    })
                });
            }
            for(var i = 1; i < pnodes.length-1; ++i) {
                var current = pnodes[i];
                var prev = pnodes[i-1];
                var next = pnodes[i+1];

                // we can't do anything for two-cycles
                if(prev === next)
                    continue;

                // calculate the angle
                var vPrev = {x: prev.x - current.x, y: prev.y - current.y};
                var vNext = {x: next.x - current.x, y: next.y - current.y};

                var angle = _angle(vPrev, vNext); // angle in [0, PI]

                var pvecPrev = _pVec(vPrev);
                var pvecNext = _pVec(vNext);

                // make sure the perpendicular vector is in the
                // direction that makes the angle more towards 180 degree
                // 1. calculate the middle point of node 'prev' and 'next'
                var mid = {x: (prev.x+next.x)/2.0, y: (prev.y+next.y)/2.0};

                // 2. calculate the vectors: 'prev' pointing to 'mid', 'next' pointing to 'mid'
                var prev_mid = {x: mid.x-prev.x, y: mid.y-prev.y};
                var next_mid = {x: mid.x-next.x, y: mid.y-next.y};

                // 3. the 'correct' vector: the angle between pvec and prev_mid(next_mid) should
                //    be an obtuse angle
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.y};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.y};

                // modify positions of nodes
                var prevDisp = _displaceAdjacent(prev, angle, pvecPrev, strength * _angleForce);
                var nextDisp = _displaceAdjacent(next, angle, pvecNext, strength * _angleForce);
                var centerDisp = _displaceCenter(prevDisp, nextDisp);
                if(_debug) {
                    report.push({
                        action: 'force',
                        nodes: [{
                            id: _id(prev),
                            x: prev.x,
                            y: prev.y,
                            force: prevDisp
                        }, {
                            id: _id(current),
                            x: current.x,
                            y: current.y,
                            force: centerDisp
                        }, {
                            id: _id(next),
                            x: next.x,
                            y: next.y,
                            force: nextDisp
                        }],
                        edges: [{
                            source: _id(prev),
                            target: _id(current)
                        }, {
                            source: _id(current),
                            target: _id(next)
                        }]
                    });
                }
                _offsetNode(prev, prevDisp);
                _offsetNode(next, nextDisp);
                _offsetNode(current, centerDisp);
            }
        });
        if(_debug)
            console.log(report);
    };
    function find(nodeById, nodeId) {
        var node = nodeById.get(nodeId);
        if(!node)
            throw new Error('node missing: ' + nodeId);
        return node;
    }
    function init() {
        if(!_nodes)
            return;
        var nodeById = d3.map(_nodes, _id);
        _paths = _inputPaths.map(function(path) {
            return {
                nodes: _pathNodes(path).map(function(n) {
                    return typeof n !== 'object' ?
                        find(nodeById, n) :
                        n;
                }),
                strength: _pathStrength(path)
            };
        });
    }
    force.initialize = function(nodes) {
        _nodes = nodes;
        init();
    };
    force.paths = function(paths) {
        if(!arguments.length) return _paths;
        _inputPaths = paths;
        init();
        return this;
    };
    force.id = function(id) {
        if(!arguments.length) return _id;
        _id = id;
        return this;
    };
    force.angleForce = function(angleForce) {
        if(!arguments.length) return _angleForce;
        _angleForce = angleForce;
        return this;
    };
    force.pathNodes = function(pathNodes) {
        if(!arguments.length) return _pathNodes;
        _pathNodes = pathNodes;
        return this;
    };
    force.pathStrength = function(pathStrength) {
        if(!arguments.length) return _pathStrength;
        _pathStrength = pathStrength;
        return this;
    };
    force.debug = function(debug) {
        if(!arguments.length) return _debug;
        _debug = debug;
        return this;
    };
    return force;
}

/**
 * D3 v4 force layout adaptor for dc.graph.js
 * @module d3v4_force_layout
 */


/**
 * `d3v4ForceLayout` is an adaptor for d3-force version 4 layouts in dc.graph.js
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} d3v4 force layout engine
 */
function d3v4ForceLayout(id) {
    const _layoutId = id || uuid();
    let _simulation = null; // d3-force simulation
    const _dispatch = dispatch('tick', 'start', 'end');
    // node and edge objects shared with d3-force, preserved from one iteration
    // to the next (as long as the object is still in the layout)
    const _nodes = {}, _edges = {};
    let _wnodes = [], _wedges = [];
    let _options = null;
    let _paths = null;

    function init(options) {
        _options = options;

        _simulation = forceSimulation()
            .force('link', forceLink())
            .force('center', forceCenter(options.width/2, options.height/2))
            .force('gravityX', forceX(options.width/2).strength(_options.gravityStrength))
            .force('gravityY', forceY(options.height/2).strength(_options.gravityStrength))
            .force('collision', forceCollide(_options.collisionRadius))
            .force('charge', forceManyBody())
            .stop();
    }

    function dispatchState(event) {
        _dispatch.call(
            event,
            null,
            _wnodes,
            (_wedges || []).map(e => ({dcg_edgeKey: e.dcg_edgeKey})),
        );
    }

    function data(nodes, edges) {
        const nodeIDs = {};
        nodes.forEach((d, i) => {
            nodeIDs[d.dcg_nodeKey] = i;
        });

        _wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            v1.id = v.dcg_nodeKey;
            if (v.dcg_nodeFixed) {
                v1.fx = v.dcg_nodeFixed.x;
                v1.fy = v.dcg_nodeFixed.y;
            } else v1.fx = v1.fy = null;
        });

        _wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.source = nodeIDs[_nodes[e.dcg_edgeSource].dcg_nodeKey];
            e1.target = nodeIDs[_nodes[e.dcg_edgeTarget].dcg_nodeKey];
            e1.dcg_edgeLength = e.dcg_edgeLength;
        });

        _simulation.force('straighten', null);
        _simulation.nodes(_wnodes);
        _simulation.force('link').links(_wedges);
    }

    function start() {
        _dispatch.call('start');
        installForces(_paths);
        runSimulation(_options.iterations);
    }

    function savePositions() {
        const data = {};
        Object.keys(_nodes).forEach(key => {
            data[key] = {x: _nodes[key].x, y: _nodes[key].y};
        });
        return data;
    }
    function restorePositions(data) {
        Object.keys(data).forEach(key => {
            if (_nodes[key]) {
                _nodes[key].fx = data[key].x;
                _nodes[key].fy = data[key].y;
            }
        });
    }
    function installForces(paths) {
        if (paths)
            paths = paths.filter(path => path.nodes.every(nk => _nodes[nk]));
        if (paths === null || !paths.length) {
            _simulation.force('charge').strength(_options.initialCharge);
        } else {
            let nodesOnPath;
            if (_options.fixOffPathNodes) {
                nodesOnPath = set$2();
                paths.forEach(path => {
                    path.nodes.forEach(nid => {
                        nodesOnPath.add(nid);
                    });
                });
            }

            // fix nodes not on paths
            Object.keys(_nodes).forEach(key => {
                if (_options.fixOffPathNodes && !nodesOnPath.has(key)) {
                    _nodes[key].fx = _nodes[key].x;
                    _nodes[key].fy = _nodes[key].y;
                } else {
                    _nodes[key].fx = null;
                    _nodes[key].fy = null;
                }
            });

            _simulation.force('charge').strength(_options.chargeForce);
            _simulation.force(
                'straighten',
                forceStraightenPaths()
                    .id(n => n.dcg_nodeKey)
                    .angleForce(_options.angleForce)
                    .pathNodes(p => p.nodes)
                    .pathStrength(p => p.strength)
                    .paths(paths),
            );
        }
    }

    function runSimulation(iterations) {
        _simulation.alpha(1);
        for (let i = 0; i < iterations; ++i) {
            _simulation.tick();
            dispatchState('tick');
        }
        dispatchState('end');
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);

    const engine = Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'd3v4-force';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        supportsMoving() {
            return true;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges, constraints) {
            data(nodes, edges);
        },
        start() {
            start();
        },
        stop() {
        },
        paths(paths) {
            _paths = paths;
        },
        savePositions,
        restorePositions,
        optionNames() {
            return [
                'iterations',
                'angleForce',
                'chargeForce',
                'gravityStrength',
                'collisionRadius',
                'initialCharge',
                'fixOffPathNodes',
            ]
                .concat(graphviz_keys);
        },
        iterations: property(300),
        angleForce: property(0.01),
        chargeForce: property(-600),
        gravityStrength: property(0.3),
        collisionRadius: property(8),
        initialCharge: property(-100),
        fixOffPathNodes: property(false),
        populateLayoutNode() {},
        populateLayoutEdge() {},
    });
    engine.pathStraightenForce = engine.angleForce;
    return engine;
}

// Scripts needed for web worker
d3v4ForceLayout.scripts = ['d3.js', 'd3v4-force.js'];

/**
 * Dynagraph-wasm layout adaptor for dc.graph.js
 * @module dynagraph_layout
 */


/**
 * `dynagraphLayout` connects to dynagraph WebAssembly module and does dynamic directed graph layout.
 * @param {String} [id=uuid()] - Unique identifier
 * @param {String} [layout] - Layout algorithm name
 * @return {Object} dynagraph layout engine
 */
function dynagraphLayout(id, layout) {
    const _layoutId = id || uuid();
    const _Gname = _layoutId;
    let _layout = null;
    const _dispatch = (globalThis.d3?.dispatch || dispatch)('tick', 'start', 'end');
    let _done;
    const _nodes = {}, _edges = {};
    let _linesOut = [], _incrIn = [], _opened = false, _open_graph;
    let _lock = 0;

    let bb = null;
    // dg2incr
    function dg2incr_coord(c) {
        const [x, y] = c;
        return [x, /*(bb && bb[0][1] || 0)*/ -y];
    }

    function dg2incr_graph_attrs() {
        return [
            ['rankdir', _layout.rankdir()],
            ['resolution', [_layout.resolution().x, _layout.resolution().y]],
            ['defaultsize', [_layout.defaultsize().width, _layout.defaultsize().height]],
            ['separation', [_layout.separation().x, _layout.separation().y]],
        ];
    }

    function dg2incr_node_attrs(n) {
        const attr_pairs = [];
        if (n.x !== undefined && n.y !== undefined)
            attr_pairs.push(['pos', dg2incr_coord([n.x, n.y]).map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_node_attrs_changed(n, n2) {
        const attr_pairs = [];
        if (n2.x !== undefined && n2.y !== undefined && (n2.x !== n.x || n2.y !== n.y))
            attr_pairs.push(['pos', dg2incr_coord([n2.x, n2.y]).map(String).join(',')]);
        return attr_pairs;
    }

    function dg2incr_edge_attrs(_e) {
        return [];
    }

    function mq(x) { // maybe quote
        if (x === +x) // isNumber
            return x;
        else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(x))
            return x;
        else return `"${x}"`;
    }

    function print_incr_attrs(attr_pairs) {
        return `[${attr_pairs.map(([a, b]) => `${mq(a)}=${mq(b)}`).join(', ')}]`;
    }

    // incr2dg
    function incr2dg_coord(c) {
        const [x, y] = c;
        return [+x, /*(bb && bb[0][1] || 0)*/ -y];
    }
    function incr2dg_bb(bb) {
        const [x1, y1, x2, y2] = bb.split(',');
        return [incr2dg_coord([x1, y1]), incr2dg_coord([x2, y2])];
    }
    function incr2dg_node_attrs(n) {
        const attrs = {};
        if (n.pos)
            [attrs.x, attrs.y] = incr2dg_coord(n.pos.split(',').map(Number));
        return attrs;
    }
    function incr2dg_edge_attrs(e) {
        const attrs = {};
        if (e.pos)
            attrs.points = e.pos.split(' ')
                .map(coord => coord.split(',').map(Number))
                .map(incr2dg_coord)
                .map(([x, y]) => ({x, y}));
        return attrs;
    }

    function runCommands(cmds) {
        for (const cmd of cmds) {
            const {action, kind} = cmd;
            switch (`${action}_${kind}`) {
                case 'open_graph': {
                    const {attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('open graph', attrs);
                        console.log('open graph bb', bb);
                    }
                    bb = incr2dg_bb(attrs.bb);
                    if (_layout.verbose()) {
                        console.log('open graph bb', bb);
                    }
                    break;
                }
                case 'modify_graph': {
                    const {attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('modify graph', attrs);
                        console.log('modify graph bb', bb);
                    }
                    bb = incr2dg_bb(attrs.bb);
                    if (_layout.verbose()) {
                        console.log('modify graph bb', bb);
                    }
                    break;
                }
                case 'close_graph': {
                    if (_layout.verbose()) {
                        console.log('close graph');
                    }
                    break;
                }
                case 'insert_node': {
                    const {node, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('insert node', node, attrs);
                        console.log('insert node2', _nodes[node]);
                    }
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('insert node3', _nodes[node]);
                    }
                    break;
                }
                case 'modify_node': {
                    const {node, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('modify node', node, attrs);
                        console.log('modify node2', _nodes[node]);
                    }
                    Object.assign(_nodes[node], incr2dg_node_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('modify node3', _nodes[node]);
                    }
                    break;
                }
                case 'delete_node': {
                    const {node} = cmd;
                    if (_layout.verbose()) {
                        console.log('delete node', node);
                    }
                    break;
                }
                case 'insert_edge': {
                    const {edge, source, target, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('insert edge', edge, source, target, attrs);
                        console.log('insert edge2', _edges[edge]);
                    }
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('insert edge3', _edges[edge]);
                    }
                    break;
                }
                case 'modify_edge': {
                    const {edge, attrs} = cmd;
                    if (_layout.verbose()) {
                        console.log('modify edge', edge, attrs);
                        console.log('modify edge2', _edges[edge]);
                    }
                    Object.assign(_edges[edge], incr2dg_edge_attrs(attrs));
                    if (_layout.verbose()) {
                        console.log('modify edge3', _edges[edge]);
                    }
                    break;
                }
                case 'delete_edge': {
                    const {edge} = cmd;
                    if (_layout.verbose()) {
                        console.log('delete edge', edge);
                    }
                    break;
                }
            }
        }
    }
    function receiveIncr(text) {
        if (_layout.verbose()) {
            console.log(text);
        }
        let cmds = null;
        try {
            const parseIncrface = globalThis.parseIncrface || self.parseIncrface
                || (self.incrface && self.incrface.parse);
            if (!parseIncrface) {
                console.log('[DYNAGRAPH] parseIncrface not available, skipping');
                return;
            }
            cmds = parseIncrface(text);
        } catch (xep) {
            console.log('[DYNAGRAPH] incrface parse failed', xep);
        }
        if (!cmds) {
            return;
        }
        for (const cmd of cmds) {
            const {action, kind, graph} = cmd;
            if (action === 'message') {
                console.warn('[DYNAGRAPH] dynagraph message', cmd.message);
                continue;
            }
            if (graph !== _Gname) {
                console.warn('[DYNAGRAPH] graph name mismatch', _Gname, 'vs', graph);
                continue;
            }
            switch (`${action}_${kind}`) {
                case 'lock_graph':
                    _lock++;
                    break;
                case 'unlock_graph':
                    // maybe error on negative lock?
                    if (--_lock <= 0) {
                        runCommands(_incrIn);
                        _incrIn = [];
                    }
                    break;
                default:
                    if (_lock > 0) {
                        _incrIn.push(cmd);
                    } else {
                        runCommands([cmd]);
                    }
            }
        }
        _done();
    }

    function init(_options) {
        self.receiveIncr = receiveIncr;
        _opened = false;
        _open_graph = `open graph ${mq(_Gname)} ${print_incr_attrs(dg2incr_graph_attrs())}`;
    }

    function data(nodes, edges, _clusters) {
        const linesOutDeleteNode = [];
        const wnodes = regenerateObjects(_nodes, nodes, null, v => v.dcg_nodeKey, (v1, v) => {
            v1.dcg_nodeKey = v.dcg_nodeKey;
            v1.width = v.width;
            v1.height = v.height;
            if (v.dcg_nodeFixed) {
                v1.x = v.dcg_nodeFixed.x;
                v1.y = v.dcg_nodeFixed.y;
            }
            const na = dg2incr_node_attrs_changed(v1, v);
            if (na.length)
                _linesOut.push(
                    `modify node ${mq(_Gname)} ${mq(v1.dcg_nodeKey)} ${print_incr_attrs(na)}`,
                );
        }, (k, o) => {
            _linesOut.push(
                `insert node ${mq(_Gname)} ${mq(k)} ${print_incr_attrs(dg2incr_node_attrs(o))}`,
            );
        }, k => {
            linesOutDeleteNode.push(`delete node ${mq(_Gname)} ${mq(k)}`);
        });
        const wedges = regenerateObjects(_edges, edges, null, e => e.dcg_edgeKey, (e1, e) => {
            e1.dcg_edgeKey = e.dcg_edgeKey;
            e1.dcg_edgeSource = e.dcg_edgeSource;
            e1.dcg_edgeTarget = e.dcg_edgeTarget;
        }, (k, o, e) => {
            _linesOut.push(
                `insert edge ${mq(_Gname)} ${mq(k)} ${mq(e.dcg_edgeSource)} ${
                    mq(e.dcg_edgeTarget)
                } ${print_incr_attrs(dg2incr_edge_attrs())}`,
            );
        }, (k, _e) => {
            _linesOut.push(`delete edge ${mq(_Gname)} ${k}`);
        });
        _linesOut.push(...linesOutDeleteNode);

        function dispatchState(event) {
            _dispatch.call(event, null, wnodes, wedges);
        }
        _done = function() {
            dispatchState('end');
        };
    }

    async function start() {
        // Ensure dynagraph is initialized for main thread (no-op in worker)
        if (globalThis.ensureDynagraphInitialized && typeof importScripts === 'undefined') {
            try {
                await globalThis.ensureDynagraphInitialized();
            } catch (error) {
                console.error('[DYNAGRAPH] Failed to initialize dynagraph:', error);
                return;
            }
        }

        if (_linesOut.length) {
            const open = _opened ? [] : [_open_graph];
            _opened = true;
            const actions = _linesOut.length > 1
                ? [
                    `lock graph ${mq(_Gname)}`,
                    ..._linesOut,
                    `unlock graph ${mq(_Gname)}`,
                ]
                : _linesOut;
            const input = [...open, ...actions].join('\n');
            if (_layout.verbose()) {
                console.log('dynagraph input:', input);
            }
            self.incrface_input = input;
            _linesOut = [];
        } else {
            _done();
        }
    }

    _layout = {
        ...graphvizAttrs(),
        layoutAlgorithm() {
            return layout;
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        resolution: property({x: 5, y: 5}),
        defaultsize: property({width: 50, height: 50}),
        separation: property({x: 20, y: 20}),
        verbose: property(false),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init();
            return this;
        },
        data(graph, nodes, edges) {
            data(nodes, edges);
        },
        async start() {
            await start();
        },
        stop() {
        },
        optionNames() {
            return ['resolution', 'defaultsize', 'separation', 'verbose'];
        },
        populateLayoutNode(_layout, _node) {},
        populateLayoutEdge() {},
    };
    return _layout;
}

var loadYoga = (() => {
  var _scriptDir = import.meta.url;
  
  return (
function(loadYoga) {
  loadYoga = loadYoga || {};


var h;h||(h=typeof loadYoga !== 'undefined' ? loadYoga : {});var aa,ca;h.ready=new Promise(function(a,b){aa=a;ca=b;});var da=Object.assign({},h),q="";"undefined"!=typeof document&&document.currentScript&&(q=document.currentScript.src);_scriptDir&&(q=_scriptDir);0!==q.indexOf("blob:")?q=q.substr(0,q.replace(/[?#].*/,"").lastIndexOf("/")+1):q="";var ea=h.print||console.log.bind(console),v=h.printErr||console.warn.bind(console);Object.assign(h,da);da=null;var w;h.wasmBinary&&(w=h.wasmBinary);
h.noExitRuntime||true;"object"!=typeof WebAssembly&&x("no native wasm support detected");var fa,ha=false;function z(a,b,c){c=b+c;for(var d="";!(b>=c);){var e=a[b++];if(!e)break;if(e&128){var f=a[b++]&63;if(192==(e&224))d+=String.fromCharCode((e&31)<<6|f);else {var g=a[b++]&63;e=224==(e&240)?(e&15)<<12|f<<6|g:(e&7)<<18|f<<12|g<<6|a[b++]&63;65536>e?d+=String.fromCharCode(e):(e-=65536,d+=String.fromCharCode(55296|e>>10,56320|e&1023));}}else d+=String.fromCharCode(e);}return d}
var ia,ja,A,C,ka,D,E,la,ma;function na(){var a=fa.buffer;ia=a;h.HEAP8=ja=new Int8Array(a);h.HEAP16=C=new Int16Array(a);h.HEAP32=D=new Int32Array(a);h.HEAPU8=A=new Uint8Array(a);h.HEAPU16=ka=new Uint16Array(a);h.HEAPU32=E=new Uint32Array(a);h.HEAPF32=la=new Float32Array(a);h.HEAPF64=ma=new Float64Array(a);}var oa,pa=[],qa=[],ra=[];function sa(){var a=h.preRun.shift();pa.unshift(a);}var F=0,G=null;
function x(a){if(h.onAbort)h.onAbort(a);a="Aborted("+a+")";v(a);ha=true;a=new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info.");ca(a);throw a;}function ua(a){return a.startsWith("data:application/octet-stream;base64,")}var H;H="data:application/octet-stream;base64,AGFzbQEAAAABugM3YAF/AGACf38AYAF/AX9gA39/fwBgAn98AGACf38Bf2ADf39/AX9gBH9/f30BfWADf398AGAAAGAEf39/fwBgAX8BfGACf38BfGAFf39/f38Bf2AAAX9gA39/fwF9YAZ/f31/fX8AYAV/f39/fwBgAn9/AX1gBX9/f319AX1gAX8BfWADf35/AX5gB39/f39/f38AYAZ/f39/f38AYAR/f39/AX9gBn9/f319fQF9YAR/f31/AGADf399AX1gBn98f39/fwF/YAR/fHx/AGACf30AYAh/f39/f39/fwBgDX9/f39/f39/f39/f38AYAp/f39/f39/f39/AGAFf39/f38BfGAEfHx/fwF9YA1/fX1/f399fX9/f39/AX9gB39/f319f38AYAJ+fwF/YAN/fX0BfWABfAF8YAN/fHwAYAR/f319AGAHf39/fX19fQF9YA1/fX99f31/fX19fX1/AX9gC39/f39/f399fX19AX9gCH9/f39/f319AGAEf39+fgBgB39/f39/f38Bf2ACfH8BfGAFf398fH8AYAN/f38BfGAEf39/fABgA39/fQBgBn9/fX99fwF/ArUBHgFhAWEAHwFhAWIAAwFhAWMACQFhAWQAFgFhAWUAEQFhAWYAIAFhAWcAAAFhAWgAIQFhAWkAAwFhAWoAAAFhAWsAFwFhAWwACgFhAW0ABQFhAW4AAwFhAW8AAQFhAXAAFwFhAXEABgFhAXIAAAFhAXMAIgFhAXQACgFhAXUADQFhAXYAFgFhAXcAAgFhAXgAAwFhAXkAGAFhAXoAAgFhAUEAAQFhAUIAEQFhAUMAAQFhAUQAAAOiAqACAgMSBwcACRkDAAoRBgYKEwAPDxMBBiMTCgcHGgMUASQFJRQHAwMKCgMmAQYYDxobFAAKBw8KBwMDAgkCAAAFGwACBwIHBgIDAQMIDAABKAkHBQURACkZASoAAAIrLAIALQcHBy4HLwkFCgMCMA0xAgMJAgACAQYKAQIBBQEACQIFAQEABQAODQ0GFQIBHBUGAgkCEAAAAAUyDzMMBQYINAUCAwUODg41AgMCAgIDBgICNgIBDAwMAQsLCwsLCx0CAAIAAAABABABBQICAQMCEgMMCwEBAQEBAQsLAQICAwICAgICAgIDAgIICAEICAgEBAQEBAQEBAQABAQABAQEBAAE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GiABQQA2AvADIAFCADcC6AMgAigC7AMiAyACKALoAyIERwRAIAMgBGsiBEEASA0FIAEgBBAeIgM2AuwDIAEgAzYC6AMgASADIARqNgLwAyACKALoAyIEIAIoAuwDIghHBEADQCADIAQoAgA2AgAgA0EEaiEDIARBBGoiBCAIRw0ACwsgASADNgLsAwsgASACKQL0AzcC9AMgASACKAKEBDYChAQgASACKQL8AzcC/AMgAUEANgLkAwsgBSABNgIAIAEgADYC5AMLIAZBAWohBiAFQQRqIgUgB0cNAAsLDwsQAgALUAACQAJAAkACQAJAIAIOBAQAAQIDCyAAIAEgAUEwahBDDwsgACABIAFBMGogAxBEDwsgACABIAFBMGoQQg8LECQACyAAIAEgAUEwaiADEEULcAIBfwF9IwBBEGsiBCQAIARBCGogACABQQJ0QdwlaigCACACEDZDAADAfyEFAkACQAJAIAQtAAxBAWsOAgABAgsgBCoCCCEFDAELIAQqAgggA5RDCtcjPJQhBQsgBEEQaiQAIAVDAAAAACAFIAVbGwt5AgF/AX0jAEEQayIDJAAgA0EIaiAAIAFBAnRB7CVqKAIAIAIQU0MAAMB/IQQCQAJAAkAgAy0ADEEBaw4CAAECCyADKgIIIQQMAQsgAyoCCEMAAAAAlEMK1yM8lCEECyADQRBqJAAgBEMAAAAAl0MAAAAAIAQgBFsbC1QAAkACQAJAAkACQCACDgQEAAECAwsgACABIAFBwgBqEEMPCyAAIAEgAUHCAGogAxBEDwsgACABIAFBwgBqEEIPCxAkAAsgACABIAFBwgBqIAMQRQsvACAAIAJFQQF0IgIgASADEGAgACACIAEQS5IgACACIAEgAxB/IAAgAiABEFKSkgvOAQIDfwJ9IwBBEGsiAyQAQQEhBCADQQhqIABB/ABqIgUgACABQQF0akH2AGoiAS8BABAfAkACQCADKgIIIgcgAioCACIGXARAIAcgB1sEQCACLQAEIQIMAgsgBiAGXCEECyACLQAEIQIgBEUNACADLQAMIAJB/wFxRg0BCyAFIAEgBiACEDkDQCAALQAAIgFBBHENASAAIAFBBHI6AAAgACgCECIBBEAgACABEQAACyAAQYCAgP4HNgKcASAAKALkAyIADQALCyADQRBqJAALzgECA38CfSMAQRBrIgMkAEEBIQQgA0EIaiAAQfwAaiIFIAAgAUEBdGpB8gBqIgEvAQAQHwJAAkAgAyoCCCIHIAIqAgAiBlwEQCAHIAdbBEAgAi0ABCECDAILIAYgBlwhBAsgAi0ABCECIARFDQAgAy0ADCACQf8BcUYNAQsgBSABIAYgAhA5A0AgAC0AACIBQQRxDQEgACABQQRyOgAAIAAoAhAiAQRAIAAgAREAAAsgAEGAgID+BzYCnAEgACgC5AMiAA0ACwsgA0EQaiQACwoAIABBMGtBCkkLBQAQAgALBAAgAAsUACAABEAgACAAKAIAKAIEEQAACwsrAQF/IAAoAgwiAQRAIAEQIwsgACgCACIBBEAgACABNgIEIAEQIwsgABAjC4EEAQN/IwBBEGsiAyQAIABCADcCBCAAQcEgOwAVIABCADcCDCAAQoCAgICAgIACNwIYIAAgAC0AF0HgAXE6ABcgACAALQAAQeABcUEFcjoAACAAIAAtABRBgAFxOgAUIABBIGpBAEHOABAqGiAAQgA3AXIgAEGEgBA2AW4gAEEANgF6IABCADcCgAEgAEIANwKIASAAQgA3ApABIABCADcCoAEgAEKAgICAgICA4P8ANwKYASAAQQA6AKgBIABBrAFqQQBBxAEQKhogAEHwAmohBCAAQbABaiECA0AgAkKAgID8i4CAwL9/NwIQIAJCgYCAgBA3AgggAkKAgID8i4CAwL9/NwIAIAJBGGoiAiAERw0ACyAAQoCAgPyLgIDAv383AvACIABCgICA/IuAgMC/fzcCgAMgAEKBgICAEDcC+AIgAEKAgID+h4CA4P8ANwKUAyAAQoCAgP6HgIDg/wA3AowDIABBiANqIgIgAi0AAEH4AXE6AAAgAEGcA2pBAEHYABAqGiAAQQA6AIQEIABBgICA/gc2AoAEIABBADoA/AMgAEGAgID+BzYC+AMgACABNgL0AyABBEAgAS0ACEEBcQRAIAAgAC0AFEHzAXFBCHI6ABQgACAALwAVQfD/A3FBBHI7ABULIANBEGokACAADwsgA0GiGjYCACADEHIQJAALMwAgACABQQJ0QfwlaigCAEECdGoqApQDIABBFGoiACABQQEgAhAiIAAgAUEBIAIQIZKSC44DAQp/IwBB0AJrIgEkACAAKALoAyIDIAAoAuwDIgVHBEAgAUGMAmohBiABQeABaiEHIAFBIGohCCABQRxqIQkgAUEQaiEEA0AgAygCACICLQAXQRB0QYCAMHFBgIAgRgRAIAFBCGpBAEHEAhAqGiABQYCAgP4HNgIMIARBADoACCAEQgA3AgAgCUEAQcQBECoaIAghAANAIABCgICA/IuAgMC/fzcCECAAQoGAgIAQNwIIIABCgICA/IuAgMC/fzcCACAAQRhqIgAgB0cNAAsgAUKAgID8i4CAwL9/NwPwASABQoGAgIAQNwPoASABQoCAgPyLgIDAv383A+ABIAFCgICA/oeAgOD/ADcChAIgAUKAgID+h4CA4P8ANwL8ASABIAEtAPgBQfgBcToA+AEgBkEAQcAAECoaIAJBmAFqIAFBCGpBxAIQKxogAkIANwKMAyACIAItAAAiAEEBciIKQfsBcSAKIABBBHEbOgAAIAIQTyACEF4LIANBBGoiAyAFRw0ACwsgAUHQAmokAAtMAQF/QQEhAQJAIAAtAB5BB3ENACAALQAiQQdxDQAgAC0ALkEHcQ0AIAAtACpBB3ENACAALQAmQQdxDQAgAC0AKEEHcUEARyEBCyABC3YCAX8BfSMAQRBrIgQkACAEQQhqIAAgAUECdEHcJWooAgAgAhBQQwAAwH8hBQJAAkACQCAELQAMQQFrDgIAAQILIAQqAgghBQwBCyAEKgIIIAOUQwrXIzyUIQULIARBEGokACAFQwAAAACXQwAAAAAgBSAFWxsLogQCBn8CfgJ/QQghBAJAAkAgAEFHSw0AA0BBCCAEIARBCE0bIQRB6DopAwAiBwJ/QQggAEEDakF8cSAAQQhNGyIAQf8ATQRAIABBA3ZBAWsMAQsgAEEdIABnIgFrdkEEcyABQQJ0a0HuAGogAEH/H00NABpBPyAAQR4gAWt2QQJzIAFBAXRrQccAaiIBIAFBP08bCyIDrYgiCFBFBEADQCAIIAh6IgiIIQcCfiADIAinaiIDQQR0IgJB6DJqKAIAIgEgAkHgMmoiBkcEQCABIAQgABBjIgUNBSABKAIEIgUgASgCCDYCCCABKAIIIAU2AgQgASAGNgIIIAEgAkHkMmoiAigCADYCBCACIAE2AgAgASgCBCABNgIIIANBAWohAyAHQgGIDAELQeg6Qeg6KQMAQn4gA62JgzcDACAHQgGFCyIIQgBSDQALQeg6KQMAIQcLAkAgB1BFBEBBPyAHeadrIgZBBHQiAkHoMmooAgAhAQJAIAdCgICAgARUDQBB4wAhAyABIAJB4DJqIgJGDQADQCADRQ0BIAEgBCAAEGMiBQ0FIANBAWshAyABKAIIIgEgAkcNAAsgAiEBCyAAQTBqEGQNASABRQ0EIAEgBkEEdEHgMmoiAkYNBANAIAEgBCAAEGMiBQ0EIAEoAggiASACRw0ACwwECyAAQTBqEGRFDQMLQQAhBSAEIARBAWtxDQEgAEFHTQ0ACwsgBQwBC0EACwtwAgF/AX0jAEEQayIEJAAgBEEIaiAAIAFBAnRB7CVqKAIAIAIQKEMAAMB/IQUCQAJAAkAgBC0ADEEBaw4CAAECCyAEKgIIIQUMAQsgBCoCCCADlEMK1yM8lCEFCyAEQRBqJAAgBUMAAAAAIAUgBVsbC6ADAQN/IAEgAEEEaiIEakEBa0EAIAFrcSIFIAJqIAAgACgCACIBakEEa00EfyAAKAIEIgMgACgCCDYCCCAAKAIIIAM2AgQgBCAFRwRAIAAgAEEEaygCAEF+cWsiAyAFIARrIgQgAygCAGoiBTYCACAFQXxxIANqQQRrIAU2AgAgACAEaiIAIAEgBGsiATYCAAsCQCABIAJBGGpPBEAgACACakEIaiIDIAEgAmtBCGsiATYCACABQXxxIANqQQRrIAFBAXI2AgAgAwJ/IAMoAgBBCGsiAUH/AE0EQCABQQN2QQFrDAELIAFnIQQgAUEdIARrdkEEcyAEQQJ0a0HuAGogAUH/H00NABpBPyABQR4gBGt2QQJzIARBAXRrQccAaiIBIAFBP08bCyIBQQR0IgRB4DJqNgIEIAMgBEHoMmoiBCgCADYCCCAEIAM2AgAgAygCCCADNgIEQeg6Qeg6KQMAQgEgAa2GhDcDACAAIAJBCGoiATYCACABQXxxIABqQQRrIAE2AgAMAQsgACABakEEayABNgIACyAAQQRqBSADCwvmAwEFfwJ/QbAwKAIAIgEgAEEHakF4cSIDaiECAkAgA0EAIAEgAk8bDQAgAj8AQRB0SwRAIAIQFkUNAQtBsDAgAjYCACABDAELQfw7QTA2AgBBfwsiAkF/RwRAIAAgAmoiA0EQayIBQRA2AgwgAUEQNgIAAkACf0HgOigCACIABH8gACgCCAVBAAsgAkYEQCACIAJBBGsoAgBBfnFrIgRBBGsoAgAhBSAAIAM2AghBcCAEIAVBfnFrIgAgACgCAGpBBGstAABBAXFFDQEaIAAoAgQiAyAAKAIINgIIIAAoAgggAzYCBCAAIAEgAGsiATYCAAwCCyACQRA2AgwgAkEQNgIAIAIgAzYCCCACIAA2AgRB4DogAjYCAEEQCyACaiIAIAEgAGsiATYCAAsgAUF8cSAAakEEayABQQFyNgIAIAACfyAAKAIAQQhrIgFB/wBNBEAgAUEDdkEBawwBCyABQR0gAWciA2t2QQRzIANBAnRrQe4AaiABQf8fTQ0AGkE/IAFBHiADa3ZBAnMgA0EBdGtBxwBqIgEgAUE/TxsLIgFBBHQiA0HgMmo2AgQgACADQegyaiIDKAIANgIIIAMgADYCACAAKAIIIAA2AgRB6DpB6DopAwBCASABrYaENwMACyACQX9HC80BAgN/An0jAEEQayIDJABBASEEIANBCGogAEH8AGoiBSAAIAFBAXRqQSBqIgEvAQAQHwJAAkAgAyoCCCIHIAIqAgAiBlwEQCAHIAdbBEAgAi0ABCECDAILIAYgBlwhBAsgAi0ABCECIARFDQAgAy0ADCACQf8BcUYNAQsgBSABIAYgAhA5A0AgAC0AACIBQQRxDQEgACABQQRyOgAAIAAoAhAiAQRAIAAgAREAAAsgAEGAgID+BzYCnAEgACgC5AMiAA0ACwsgA0EQaiQAC0ABAX8CQEGsOy0AAEEBcQRAQag7KAIAIQIMAQtBAUGAJxAMIQJBrDtBAToAAEGoOyACNgIACyACIAAgAUEAEBMLzQECA38CfSMAQRBrIgMkAEEBIQQgA0EIaiAAQfwAaiIFIAAgAUEBdGpBMmoiAS8BABAfAkACQCADKgIIIgcgAioCACIGXARAIAcgB1sEQCACLQAEIQIMAgsgBiAGXCEECyACLQAEIQIgBEUNACADLQAMIAJB/wFxRg0BCyAFIAEgBiACEDkDQCAALQAAIgFBBHENASAAIAFBBHI6AAAgACgCECIBBEAgACABEQAACyAAQYCAgP4HNgKcASAAKALkAyIADQALCyADQRBqJAALDwAgASAAKAIAaiACOQMACw0AIAEgACgCAGorAwALCwAgAARAIAAQIwsLxwECBH8CfSMAQRBrIgIkACACQQhqIABB/ABqIgQgAEEeaiIFLwEAEB9BASEDAkACQCACKgIIIgcgASoCACIGXARAIAcgB1sEQCABLQAEIQEMAgsgBiAGXCEDCyABLQAEIQEgA0UNACACLQAMIAFB/wFxRg0BCyAEIAUgBiABEDkDQCAALQAAIgFBBHENASAAIAFBBHI6AAAgACgCECIBBEAgACABEQAACyAAQYCAgP4HNgKcASAAKALkAyIADQALCyACQRBqJAALlgMCA34CfyAAvSICQjSIp0H/D3EiBEH/D0YEQCAARAAAAAAAAPA/oiIAIACjDwsgAkIBhiIBQoCAgICAgIDw/wBYBEAgAEQAAAAAAAAAAKIgACABQoCAgICAgIDw/wBRGw8LAn4gBEUEQEEAIQQgAkIMhiIBQgBZBEADQCAEQQFrIQQgAUIBhiIBQgBZDQALCyACQQEgBGuthgwBCyACQv////////8Hg0KAgICAgICACIQLIQEgBEH/B0oEQANAAkAgAUKAgICAgICACH0iA0IAUw0AIAMiAUIAUg0AIABEAAAAAAAAAACiDwsgAUIBhiEBIARBAWsiBEH/B0oNAAtB/wchBAsCQCABQoCAgICAgIAIfSIDQgBTDQAgAyIBQgBSDQAgAEQAAAAAAAAAAKIPCyABQv////////8HWARAA0AgBEEBayEEIAFCgICAgICAgARUIQUgAUIBhiEBIAUNAAsLIAJCgICAgICAgICAf4MgAUKAgICAgICACH0gBK1CNIaEIAFBASAEa62IIARBAEobhL8LiwEBA38DQCAAQQR0IgFB5DJqIAFB4DJqIgI2AgAgAUHoMmogAjYCACAAQQFqIgBBwABHDQALQTAQZBpBmDtBBjYCAEGcO0EANgIAEJwBQZw7Qcg7KAIANgIAQcg7QZg7NgIAQcw7QcMBNgIAQdA7QQA2AgAQjwFB0DtByDsoAgA2AgBByDtBzDs2AgALjwEBAn8jAEEQayIEJAACfUMAAAAAIAAvABVBgOAAcUUNABogBEEIaiAAQRRqIgBBASACQQJGQQF0IAFB/gFxQQJHGyIFIAIQNgJAIAQtAAxFDQAgBEEIaiAAIAUgAhA2IAQtAAxBA0YNACAAIAEgAiADEIEBDAELIAAgASACIAMQgAGMCyEDIARBEGokACADC4QBAQJ/AkACQCAAKALoAyICIAAoAuwDIgNGDQADQCACKAIAIAFGDQEgAkEEaiICIANHDQALDAELIAIgA0YNACABLQAXQRB0QYCAMHFBgIAgRgRAIAAgACgC4ANBAWs2AuADCyACIAJBBGoiASADIAFrEDMaIAAgA0EEazYC7ANBAQ8LQQALCwBByDEgACABEEkLPAAgAEUEQCACQQVHQQAgAhtFBEBBuDAgAyAEEEkaDwsgAyAEEHAaDwsgACABIAIgAyAEIAAoAgQRDQAaCyYBAX8jAEEQayIBJAAgASAANgIMQbgwQdglIAAQSRogAUEQaiQAC4cDAwN/BXwCfSAAKgKgA7siBiACoCECIAAqApwDuyIHIAGgIQggACgC9AMqAhgiC0MAAAAAXARAIAAqApADuyEJIAAqAowDIQwgACAHIAu7IgFBACAALQAAQRBxIgNBBHYiBBA0OAKcAyAAIAYgAUEAIAQQNDgCoAMgASAMuyIHohBsIgYgBmIiBEUgBplELUMc6+I2Gj9jcUUEQCAEIAZEAAAAAAAA8L+gmUQtQxzr4jYaP2NFciEFCyACIAmgIQogCCAHoCEHAn8gASAJohBsIgYgBmIiBEUEQEEAIAaZRC1DHOviNho/Yw0BGgsgBCAGRAAAAAAAAPC/oJlELUMc6+I2Gj9jRXILIQQgACAHIAEgA0EARyIDIAVxIAMgBUEBc3EQNCAIIAFBACADEDSTOAKMAyAAIAogASADIARxIAMgBEEBc3EQNCACIAFBACADEDSTOAKQAwsgACgC6AMiAyAAKALsAyIARwRAA0AgAygCACAIIAIQcyADQQRqIgMgAEcNAAsLC1UBAX0gAEEUaiIAIAEgAkECSSICIAQgBRA1IQYgACABIAIgBCAFEC0iBUMAAAAAYCADIAVecQR9IAUFIAZDAAAAAGBFBEAgAw8LIAYgAyADIAZdGwsLeAEBfwJAIAAoAgAiAgRAA0AgAUUNAiACIAEoAgQ2AgQgAiABKAIINgIIIAEoAgAhASAAKAIAIQAgAigCACICDQALCyAAIAEQPA8LAkAgAEUNACAAKAIAIgFFDQAgAEEANgIAA0AgASgCACEAIAEQIyAAIgENAAsLC5kCAgZ/AX0gAEEUaiEHQQMhBCAALQAUQQJ2QQNxIQUCQAJ/AkAgAUEBIAAoAuQDGyIIQQJGBEACQCAFQQJrDgIEAAILQQIhBAwDC0ECIQRBACAFQQFLDQEaCyAECyEGIAUhBAsgACAEIAggAyACIARBAkkiBRsQbiEKIAAgBiAIIAIgAyAFGxBuIQMgAEGcA2oiAEEBIAFBAkZBAXQiCCAFG0ECdGogCiAHIAQgASACECKSOAIAIABBAyABQQJHQQF0IgkgBRtBAnRqIAogByAEIAEgAhAhkjgCACAAIAhBASAGQQF2IgQbQQJ0aiADIAcgBiABIAIQIpI4AgAgACAJQQMgBBtBAnRqIAMgByAGIAEgAhAhkjgCAAvUAgEDfyMAQdACayIBJAAgAUEIakEAQcQCECoaIAFBADoAGCABQgA3AxAgAUGAgID+BzYCDCABQRxqQQBBxAEQKhogAUHgAWohAyABQSBqIQIDQCACQoCAgPyLgIDAv383AhAgAkKBgICAEDcCCCACQoCAgPyLgIDAv383AgAgAkEYaiICIANHDQALIAFCgICA/IuAgMC/fzcD8AEgAUKBgICAEDcD6AEgAUKAgID8i4CAwL9/NwPgASABQoCAgP6HgIDg/wA3AoQCIAFCgICA/oeAgOD/ADcC/AEgASABLQD4AUH4AXE6APgBIAFBjAJqQQBBwAAQKhogAEGYAWogAUEIakHEAhArGiAAQgA3AowDIAAgAC0AAEEBcjoAACAAEE8gACgC6AMiAiAAKALsAyIARwRAA0AgAigCABB3IAJBBGoiAiAARw0ACwsgAUHQAmokAAuuAgIKfwJ9IwBBIGsiASQAIAFBgAI7AB4gAEHuAGohByAAQfgDaiEFIABB8gBqIQggAEH2AGohCSAAQfwAaiEDQQAhAANAIAFBEGogAyAJIAFBHmogBGotAAAiAkEBdCIEaiIGLwEAEB8CQAJAIAEtABRFDQAgAUEIaiADIAYvAQAQHyABIAMgBCAIai8BABAfIAEtAAwgAS0ABEcNAAJAIAEqAggiDCAMXCIKIAEqAgAiCyALXHJFBEAgDCALk4tDF7fROF0NAQwCCyAKRSALIAtbcg0BCyABQRBqIAMgBi8BABAfDAELIAFBEGogAyAEIAdqLwEAEB8LIAUgAkEDdGoiAiABLQAUOgAEIAIgASgCEDYCAEEBIQQgACECQQEhACACRQ0ACyABQSBqJAALMgACf0EAIAAvABVBgOAAcUGAwABGDQAaQQEgABA7QwAAAABcDQAaIAAQQEMAAAAAXAsLewEBfSADIASTIgMgA1sEfUMAAAAAIABBFGoiACABIAIgBSAGEDUiByAEkyAHIAdcGyIHQ///f38gACABIAIgBSAGEC0iBSAEkyAFIAVcGyIEIAMgAyAEXhsiAyADIAddGyAHIAMgAyADXBsgAyADWyAHIAdbcRsFIAMLC98FAwR/BX0BfCAJQwAAAABdIAhDAAAAAF1yBH8gDQUgBSESIAEhEyADIRQgByERIAwqAhgiFUMAAAAAXARAIAG7IBW7IhZBAEEAEDQhEyADuyAWQQBBABA0IRQgBbsgFkEAQQAQNCESIAe7IBZBAEEAEDQhEQsCf0EAIAAgBEcNABogEiATk4tDF7fROF0gEyATXCINIBIgElxyRQ0AGkEAIBIgElsNABogDQshDAJAIAIgBkcNACAUIBRcIg0gESARXHJFBEAgESAUk4tDF7fROF0hDwwBCyARIBFbDQAgDSEPC0EBIQ5BASENAkAgDA0AIAEgCpMhAQJAIABFBEAgASABXCIAIAggCFxyRQRAQQAhDCABIAiTi0MXt9E4XUUNAgwDC0EAIQwgCCAIWw0BIAANAgwBCyAAQQJGIQwgAEECRw0AIARBAUcNACABIAhgDQECQCAIIAhcIgAgASABXHJFBEAgASAIk4tDF7fROF1FDQEMAwtBACENIAEgAVsNAkEBIQ0gAA0CC0EAIQ0MAQtBACENIAggCFwiACABIAVdRXINACAMRSABIAFcIhAgBSAFXHIgBEECR3JyDQBBASENIAEgCGANAEEAIQ0gACAQcg0AIAEgCJOLQxe30ThdIQ0LAkAgDw0AIAMgC5MhAQJAAkAgAkUEQCABIAFcIgIgCSAJXHJFBEBBACEAIAEgCZOLQxe30ThdRQ0CDAQLQQAhACAJIAlbDQEgAg0DDAELIAJBAkYhACACQQJHIAZBAUdyDQAgASAJYARADAMLIAkgCVwiACABIAFcckUEQCABIAmTi0MXt9E4XUUNAgwDC0EAIQ4gASABWw0CQQEhDiAADQIMAQsgCSAJXCICIAEgB11Fcg0AIABFIAEgAVwiBCAHIAdcciAGQQJHcnINACABIAlgDQFBACEOIAIgBHINASABIAmTi0MXt9E4XSEODAELQQAhDgsgDSAOcQsL4wEBA38jAEEQayIBJAACQAJAIAAtABRBCHFFDQBBASEDIAAvABVB8AFxQdAARg0AIAEgABAyIAEoAgQhAAJAIAEoAgAiAkUEQEEAIQMgAEUNAQsDQCACKALsAyACKALoAyICa0ECdSAATQ0DIAIgAEECdGooAgAiAC8AFSAALQAXQRB0ciIAQYDgAHFBgMAARyAAQYAecUGACkZxIgMNASABEC4gASgCBCIAIAEoAgAiAnINAAsLIAEoAggiAEUNAANAIAAoAgAhAiAAECMgAiIADQALCyABQRBqJAAgAw8LEAIAC7IBAQR/AkACQCAAKAIEIgMgACgCACIEKALsAyAEKALoAyIBa0ECdUkEQCABIANBAnRqIQIDQCACKAIAIgEtABdBEHRBgIAwcUGAgCBHDQMgASgC7AMgASgC6ANGDQJBDBAeIgIgBDYCBCACIAM2AgggAiAAKAIINgIAQQAhAyAAQQA2AgQgACABNgIAIAAgAjYCCCABIQQgASgC6AMiAiABKALsA0cNAAsLEAIACyAAEC4LC4wQAgx/B30jAEEgayINJAAgDUEIaiABEDIgDSgCCCIOIA0oAgwiDHIEQCADQQEgAxshFSAAQRRqIRQgBUEBaiEWA0ACQAJAAn8CQAJAAkACQAJAIAwgDigC7AMgDigC6AMiDmtBAnVJBEAgDiAMQQJ0aigCACILLwAVIAstABdBEHRyIgxBgIAwcUGAgBBGDQgCQAJAIAxBDHZBA3EOAwEKAAoLIAkhFyAKIRogASgC9AMtABRBBHFFBEAgACoClAMgFEECQQEQMCAUQQJBARAvkpMhFyAAKgKYAyAUQQBBARAwIBRBAEEBEC+SkyEaCyALQRRqIQ8gAS0AFEECdkEDcSEQAkACfwJAIANBAkciE0UEQEEAIQ5BAyEMAkAgEEECaw4CBAACC0ECIQwMAwtBAiEMQQAgEEEBSw0BGgsgDAshDiAQIQwLIA9BAkEBIBcQIiAPQQJBASAXECGSIR0gD0EAQQEgFxAiIRwgD0EAQQEgFxAhIRsgCyoC+AMhGAJAAkACQAJAIAstAPwDQQFrDgIBAAILIBggF5RDCtcjPJQhGAsgGEMAAAAAYEUNACAdIAsgA0EAIBcgFxAxkiEYDAELIA1BGGogDyALQTJqIhAgAxBFQwAAwH8hGCANLQAcRQ0AIA1BGGogDyAQIAMQRCANLQAcRQ0AIA1BGGogDyAQIAMQRSANLQAcQQNGDQAgDUEYaiAPIBAgAxBEIA0tABxBA0YNACALQQIgAyAAKgKUAyAUQQIgAxBLIBRBAiADEFKSkyAPQQIgAyAXEFEgD0ECIAMgFxCDAZKTIBcgFxAlIRgLIBwgG5IhHCALKgKABCEZAkACQAJAIAstAIQEQQFrDgIBAAILIBkgGpRDCtcjPJQhGQsgGUMAAAAAYEUNACAcIAsgA0EBIBogFxAxkiEZDAMLIA1BGGogDyALQTJqIhAQQwJAIA0tABxFDQAgDUEYaiAPIBAQQiANLQAcRQ0AIA1BGGogDyAQEEMgDS0AHEEDRg0AIA1BGGogDyAQEEIgDS0AHEEDRg0AIAtBACADIAAqApgDIBRBACADEEsgFEEAIAMQUpKTIA9BACADIBoQUSAPQQAgAyAaEIMBkpMgGiAXECUhGQwDC0MAAMB/IRkgGCAYXA0GIAtB/ABqIhAgC0H6AGoiEi8BABAgIhsgG1sNAwwFCyALLQAAQQhxDQggCxBPIAAgCyACIAstABRBA3EiDCAVIAwbIAQgFiAGIAsqApwDIAeSIAsqAqADIAiSIAkgChB+IBFyIQxBACERIAxBAXFFDQhBASERIAsgCy0AAEEBcjoAAAwICxACAAsgGCAYXCAZIBlcRg0BIAtB/ABqIhAgC0H6AGoiEi8BABAgIhsgG1wNASAYIBhcBEAgGSAckyAQIAsvAXoQIJQgHZIhGAwCCyAZIBlbDQELIBwgGCAdkyAQIBIvAQAQIJWSIRkLIBggGFwNASAZIBlbDQMLQQAMAQtBAQshEiALIBcgGCACQQFHIAxBAklxIBdDAAAAAF5xIBJxIhAbIBkgA0ECIBIgEBsgGSAZXCAXIBpBAEEGIAQgBSAGED0aIAsqApQDIA9BAkEBIBcQIiAPQQJBASAXECGSkiEYIAsqApgDIA9BAEEBIBcQIiAPQQBBASAXECGSkiEZC0EBIRAgCyAYIBkgA0EAQQAgFyAaQQFBASAEIAUgBhA9GiAAIAEgCyADIAxBASAXIBoQggEgACABIAsgAyAOQQAgFyAaEIIBIBFBAXFFBEAgCy0AAEEBcSEQCyABLQAUIhJBAnZBA3EhDAJAAn8CQAJAAkACQAJAAkACQAJAAkACfwJAIBNFBEBBACERQQMhDiAMQQJrDgIDDQELQQIhDkEAIAxBAUsNARoLIA4LIREgEkEEcUUNBCASQQhxRQ0BIAwhDgsgASEMIA8QXw0BDAILAkAgCy0ANEEHcQ0AIAstADhBB3ENACALLQBCQQdxDQAgDCEOIAEhDCALQUBrLwEAQQdxRQ0CDAELIAwhDgsgACEMCwJ/AkACQAJAIA5BAWsOAwABAgULIAtBmANqIQ4gC0GoA2ohE0EBIRIgDEGYA2oMAgsgC0GUA2ohDiALQZwDaiETQQIhEiAMQZQDagwBCyALQZQDaiEOIAtBpANqIRNBACESIAxBlANqCyEMIAsgEkECdGogDCoCACAOKgIAkyATKgIAkzgCnAMLIBFBAXFFDQUCQAJAIBFBAnEEQCABIQwgDxBfDQEMAgsgCy0ANEEHcQ0AIAstADhBB3ENACALLQBCQQdxDQAgASEMIAtBQGsvAQBBB3FFDQELIAAhDAsgEUEBaw4DAQIDAAsQJAALIAtBmANqIREgC0GoA2ohDkEBIRMgDEGYA2oMAgsgC0GUA2ohESALQZwDaiEOQQIhEyAMQZQDagwBCyALQZQDaiERIAtBpANqIQ5BACETIAxBlANqCyEMIAsgE0ECdGogDCoCACARKgIAkyAOKgIAkzgCnAMLIAsqAqADIRsgCyoCnAMgB0MAAAAAIA8QXxuTIRcCfQJAIAstADRBB3ENACALLQA4QQdxDQAgCy0AQkEHcQ0AIAtBQGsvAQBBB3ENAEMAAAAADAELIAgLIRogCyAXOAKcAyALIBsgGpM4AqADIBAhEQsgDUEIahAuIA0oAgwiDCANKAIIIg5yDQALCyANKAIQIgwEQANAIAwoAgAhACAMECMgACIMDQALCyANQSBqJAAgEUEBcQt2AgF/AX0jAEEQayIEJAAgBEEIaiAAIAFBAnRB7CVqKAIAIAIQUEMAAMB/IQUCQAJAAkAgBC0ADEEBaw4CAAECCyAEKgIIIQUMAQsgBCoCCCADlEMK1yM8lCEFCyAEQRBqJAAgBUMAAAAAl0MAAAAAIAUgBVsbC3gCAX8BfSMAQRBrIgQkACAEQQhqIABBAyACQQJHQQF0IAFB/gFxQQJHGyACEDZDAADAfyEFAkACQAJAIAQtAAxBAWsOAgABAgsgBCoCCCEFDAELIAQqAgggA5RDCtcjPJQhBQsgBEEQaiQAIAVDAAAAACAFIAVbGwt4AgF/AX0jAEEQayIEJAAgBEEIaiAAQQEgAkECRkEBdCABQf4BcUECRxsgAhA2QwAAwH8hBQJAAkACQCAELQAMQQFrDgIAAQILIAQqAgghBQwBCyAEKgIIIAOUQwrXIzyUIQULIARBEGokACAFQwAAAAAgBSAFWxsLoA0BBH8jAEEQayIJJAAgCUEIaiACQRRqIgggA0ECRkEBdEEBIARB/gFxQQJGIgobIgsgAxA2IAYgByAKGyEHAkACQAJAAkACQAJAIAktAAxFDQAgCUEIaiAIIAsgAxA2IAktAAxBA0YNACAIIAQgAyAHEIEBIABBFGogBCADEDCSIAggBCADIAcQIpIhBkEBIQMCQAJ/AkACQAJAAkAgBA4EAgMBAAcLQQIhAwwBC0EAIQMLIAMgC0YNAgJAAkAgBA4EAgIAAQYLIABBlANqIQNBAAwCCyAAQZQDaiEDQQAMAQsgAEGYA2ohA0EBCyEAIAMqAgAgAiAAQQJ0aioClAOTIAaTIQYLIAIgBEECdEHcJWooAgBBAnRqIAY4ApwDDAULIAlBCGogCCADQQJHQQF0QQMgChsiCiADEDYCQCAJLQAMRQ0AIAlBCGogCCAKIAMQNiAJLQAMQQNGDQACfwJAAkACQCAEDgQCAgABBQsgAEGUA2ohBUEADAILIABBlANqIQVBAAwBCyAAQZgDaiEFQQELIQEgBSoCACACQZQDaiIFIAFBAnRqKgIAkyAAQRRqIAQgAxAvkyAIIAQgAyAHECGTIAggBCADIAcQgAGTIQZBASEDAkACfwJAAkACQAJAIAQOBAIDAQAHC0ECIQMMAQtBACEDCyADIAtGDQICQAJAIAQOBAICAAEGCyAAQZQDaiEDQQAMAgsgAEGUA2ohA0EADAELIABBmANqIQNBAQshACADKgIAIAUgAEECdGoqAgCTIAaTIQYLIAIgBEECdEHcJWooAgBBAnRqIAY4ApwDDAULAkACQAJAIAUEQCABLQAUQQR2QQdxIgBBBUsNCEEBIAB0IgBBMnENASAAQQlxBEAgBEECdEHcJWooAgAhACAIIAQgAyAGEEEgASAAQQJ0IgBqIgEqArwDkiEGIAAgAmogAigC9AMtABRBAnEEfSAGBSAGIAEqAswDkgs4ApwDDAkLIAEgBEECdEHsJWooAgBBAnRqIgAqArwDIAggBCADIAYQYpIhBiACKAL0Ay0AFEECcUUEQCAGIAAqAswDkiEGCwJAAkACQAJAIAQOBAEBAgAICyABKgKUAyACKgKUA5MhB0ECIQMMAgsgASoCmAMgAioCmAOTIQdBASEDAkAgBA4CAgAHC0EDIQMMAQsgASoClAMgAioClAOTIQdBACEDCyACIANBAnRqIAcgBpM4ApwDDAgLIAIvABZBD3EiBUUEQCABLQAVQQR2IQULIAVBBUYEQCABLQAUQQhxRQ0CCyABLwAVQYCAA3FBgIACRgRAIAVBAmsOAgEHAwsgBUEISw0HQQEgBXRB8wNxDQYgBUECRw0CC0EAIQACfQJ/AkACQAJAAkACfwJAAkACQCAEDgQCAgABBAsgASoClAMhB0ECIQAgAUG8A2oMAgsgASoClAMhByABQcQDagwBCyABKgKYAyEHAkACQCAEDgIAAQMLQQMhACABQcADagwBC0EBIQAgAUHIA2oLIQUgByAFKgIAkyABQbwDaiIIIABBAnRqKgIAkyIHIAIoAvQDLQAUQQJxDQUaAkAgBA4EAAIDBAELQQMhACABQdADagwECxAkAAtBASEAIAFB2ANqDAILQQIhACABQcwDagwBC0EAIQAgAUHUA2oLIQUgByAFKgIAkyABIABBAnRqKgLMA5MLIAIgBEECdCIFQfwlaigCAEECdGoqApQDIAJBFGoiACAEQQEgBhAiIAAgBEEBIAYQIZKSk0MAAAA/lCAIIAVB3CVqKAIAIgVBAnRqKgIAkiAAIAQgAyAGEEGSIQYgAiAFQQJ0aiACKAL0Ay0AFEECcQR9IAYFIAYgASAFQQJ0aioCzAOSCzgCnAMMBgsgAS8AFUGAgANxQYCAAkcNBAsgASAEQQJ0QewlaigCAEECdGoiACoCvAMgCCAEIAMgBhBikiEGIAIoAvQDLQAUQQJxRQRAIAYgACoCzAOSIQYLAkACQCAEDgQBAQMAAgsgASoClAMgAioClAOTIQdBAiEDDAMLIAEqApgDIAIqApgDkyEHQQEhAwJAIAQOAgMAAQtBAyEDDAILECQACyABKgKUAyACKgKUA5MhB0EAIQMLIAIgA0ECdGogByAGkzgCnAMMAQsgBEECdEHcJWooAgAhACAIIAQgAyAGEEEgASAAQQJ0IgBqIgEqArwDkiEGIAAgAmogAigC9AMtABRBAnEEfSAGBSAGIAEqAswDkgs4ApwDCyAJQRBqJAALcAIBfwF9IwBBEGsiBCQAIARBCGogACABQQJ0QewlaigCACACEDZDAADAfyEFAkACQAJAIAQtAAxBAWsOAgABAgsgBCoCCCEFDAELIAQqAgggA5RDCtcjPJQhBQsgBEEQaiQAIAVDAAAAACAFIAVbGwscACAAIAFBCCACpyACQiCIpyADpyADQiCIpxAVCwUAEFgACzkAIABFBEBBAA8LAn8gAUGAf3FBgL8DRiABQf8ATXJFBEBB/DtBGTYCAEF/DAELIAAgAToAAEEBCwvEAgACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCABQQlrDhIACgsMCgsCAwQFDAsMDAoLBwgJCyACIAIoAgAiAUEEajYCACAAIAEoAgA2AgAPCwALIAIgAigCACIBQQRqNgIAIAAgATIBADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATMBADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATAAADcDAA8LIAIgAigCACIBQQRqNgIAIAAgATEAADcDAA8LAAsgAiACKAIAQQdqQXhxIgFBCGo2AgAgACABKwMAOQMADwsgACACIAMRAQALDwsgAiACKAIAIgFBBGo2AgAgACABNAIANwMADwsgAiACKAIAIgFBBGo2AgAgACABNQIANwMADwsgAiACKAIAQQdqQXhxIgFBCGo2AgAgACABKQMANwMAC84BAgN/An0jAEEQayIDJABBASEEIANBCGogAEH8AGoiBSAAIAFBAXRqQegAaiIBLwEAEB8CQAJAIAMqAggiByACKgIAIgZcBEAgByAHWwRAIAItAAQhAgwCCyAGIAZcIQQLIAItAAQhAiAERQ0AIAMtAAwgAkH/AXFGDQELIAUgASAGIAIQOQNAIAAtAAAiAUEEcQ0BIAAgAUEEcjoAACAAKAIQIgEEQCAAIAERAAALIABBgICA/gc2ApwBIAAoAuQDIgANAAsLIANBEGokAAtdAQR/IAAoAgAhAgNAIAIsAAAiAxBXBEBBfyEEIAAgAkEBaiICNgIAIAFBzJmz5gBNBH9BfyADQTBrIgMgAUEKbCIEaiADIARB/////wdzShsFIAQLIQEMAQsLIAELrhQCEn8BfiMAQdAAayIIJAAgCCABNgJMIAhBN2ohFyAIQThqIRQCQAJAAkACQANAIAEhDSAHIA5B/////wdzSg0BIAcgDmohDgJAAkACQCANIgctAAAiCQRAA0ACQAJAIAlB/wFxIgFFBEAgByEBDAELIAFBJUcNASAHIQkDQCAJLQABQSVHBEAgCSEBDAILIAdBAWohByAJLQACIQogCUECaiIBIQkgCkElRg0ACwsgByANayIHIA5B/////wdzIhhKDQcgAARAIAAgDSAHECYLIAcNBiAIIAE2AkwgAUEBaiEHQX8hEgJAIAEsAAEiChBXRQ0AIAEtAAJBJEcNACABQQNqIQcgCkEwayESQQEhFQsgCCAHNgJMQQAhDAJAIAcsAAAiCUEgayIBQR9LBEAgByEKDAELIAchCkEBIAF0IgFBidEEcUUNAANAIAggB0EBaiIKNgJMIAEgDHIhDCAHLAABIglBIGsiAUEgTw0BIAohB0EBIAF0IgFBidEEcQ0ACwsCQCAJQSpGBEACfwJAIAosAAEiARBXRQ0AIAotAAJBJEcNACABQQJ0IARqQcABa0EKNgIAIApBA2ohCUEBIRUgCiwAAUEDdCADakGAA2soAgAMAQsgFQ0GIApBAWohCSAARQRAIAggCTYCTEEAIRVBACETDAMLIAIgAigCACIBQQRqNgIAQQAhFSABKAIACyETIAggCTYCTCATQQBODQFBACATayETIAxBgMAAciEMDAELIAhBzABqEIkBIhNBAEgNCCAIKAJMIQkLQQAhB0F/IQsCfyAJLQAAQS5HBEAgCSEBQQAMAQsgCS0AAUEqRgRAAn8CQCAJLAACIgEQV0UNACAJLQADQSRHDQAgAUECdCAEakHAAWtBCjYCACAJQQRqIQEgCSwAAkEDdCADakGAA2soAgAMAQsgFQ0GIAlBAmohAUEAIABFDQAaIAIgAigCACIKQQRqNgIAIAooAgALIQsgCCABNgJMIAtBf3NBH3YMAQsgCCAJQQFqNgJMIAhBzABqEIkBIQsgCCgCTCEBQQELIQ8DQCAHIRFBHCEKIAEiECwAACIHQfsAa0FGSQ0JIBBBAWohASAHIBFBOmxqQf8qai0AACIHQQFrQQhJDQALIAggATYCTAJAAkAgB0EbRwRAIAdFDQsgEkEATgRAIAQgEkECdGogBzYCACAIIAMgEkEDdGopAwA3A0AMAgsgAEUNCCAIQUBrIAcgAiAGEIcBDAILIBJBAE4NCgtBACEHIABFDQcLIAxB//97cSIJIAwgDEGAwABxGyEMQQAhEkGPCSEWIBQhCgJAAkACQAJ/AkACQAJAAkACfwJAAkACQAJAAkACQAJAIBAsAAAiB0FfcSAHIAdBD3FBA0YbIAcgERsiB0HYAGsOIQQUFBQUFBQUFA4UDwYODg4UBhQUFBQCBQMUFAkUARQUBAALAkAgB0HBAGsOBw4UCxQODg4ACyAHQdMARg0JDBMLIAgpA0AhGUGPCQwFC0EAIQcCQAJAAkACQAJAAkACQCARQf8BcQ4IAAECAwQaBQYaCyAIKAJAIA42AgAMGQsgCCgCQCAONgIADBgLIAgoAkAgDqw3AwAMFwsgCCgCQCAOOwEADBYLIAgoAkAgDjoAAAwVCyAIKAJAIA42AgAMFAsgCCgCQCAOrDcDAAwTC0EIIAsgC0EITRshCyAMQQhyIQxB+AAhBwsgFCENIAgpA0AiGVBFBEAgB0EgcSEQA0AgDUEBayINIBmnQQ9xQZAvai0AACAQcjoAACAZQg9WIQkgGUIEiCEZIAkNAAsLIAxBCHFFIAgpA0BQcg0DIAdBBHZBjwlqIRZBAiESDAMLIBQhByAIKQNAIhlQRQRAA0AgB0EBayIHIBmnQQdxQTByOgAAIBlCB1YhDSAZQgOIIRkgDQ0ACwsgByENIAxBCHFFDQIgCyAUIA1rIgdBAWogByALSBshCwwCCyAIKQNAIhlCAFMEQCAIQgAgGX0iGTcDQEEBIRJBjwkMAQsgDEGAEHEEQEEBIRJBkAkMAQtBkQlBjwkgDEEBcSISGwshFiAZIBQQRyENCyAPQQAgC0EASBsNDiAMQf//e3EgDCAPGyEMIAgpA0AiGUIAUiALckUEQCAUIQ1BACELDAwLIAsgGVAgFCANa2oiByAHIAtIGyELDAsLQQAhDAJ/Qf////8HIAsgC0H/////B08bIgoiEUEARyEQAkACfwJAAkAgCCgCQCIHQY4lIAcbIg0iD0EDcUUgEUVyDQADQCAPLQAAIgxFDQIgEUEBayIRQQBHIRAgD0EBaiIPQQNxRQ0BIBENAAsLIBBFDQICQCAPLQAARSARQQRJckUEQANAIA8oAgAiB0F/cyAHQYGChAhrcUGAgYKEeHENAiAPQQRqIQ8gEUEEayIRQQNLDQALCyARRQ0DC0EADAELQQELIRADQCAQRQRAIA8tAAAhDEEBIRAMAQsgDyAMRQ0CGiAPQQFqIQ8gEUEBayIRRQ0BQQAhEAwACwALQQALIgcgDWsgCiAHGyIHIA1qIQogC0EATgRAIAkhDCAHIQsMCwsgCSEMIAchCyAKLQAADQ0MCgsgCwRAIAgoAkAMAgtBACEHIABBICATQQAgDBApDAILIAhBADYCDCAIIAgpA0A+AgggCCAIQQhqIgc2AkBBfyELIAcLIQlBACEHAkADQCAJKAIAIg1FDQEgCEEEaiANEIYBIgpBAEgiDSAKIAsgB2tLckUEQCAJQQRqIQkgCyAHIApqIgdLDQEMAgsLIA0NDQtBPSEKIAdBAEgNCyAAQSAgEyAHIAwQKSAHRQRAQQAhBwwBC0EAIQogCCgCQCEJA0AgCSgCACINRQ0BIAhBBGogDRCGASINIApqIgogB0sNASAAIAhBBGogDRAmIAlBBGohCSAHIApLDQALCyAAQSAgEyAHIAxBgMAAcxApIBMgByAHIBNIGyEHDAgLIA9BACALQQBIGw0IQT0hCiAAIAgrA0AgEyALIAwgByAFERwAIgdBAE4NBwwJCyAIIAgpA0A8ADdBASELIBchDSAJIQwMBAsgBy0AASEJIAdBAWohBwwACwALIAANByAVRQ0CQQEhBwNAIAQgB0ECdGooAgAiAARAIAMgB0EDdGogACACIAYQhwFBASEOIAdBAWoiB0EKRw0BDAkLC0EBIQ4gB0EKTw0HA0AgBCAHQQJ0aigCAA0BIAdBAWoiB0EKRw0ACwwHC0EcIQoMBAsgCyAKIA1rIhAgCyAQShsiCSASQf////8Hc0oNAkE9IQogEyAJIBJqIgsgCyATSBsiByAYSg0DIABBICAHIAsgDBApIAAgFiASECYgAEEwIAcgCyAMQYCABHMQKSAAQTAgCSAQQQAQKSAAIA0gEBAmIABBICAHIAsgDEGAwABzECkMAQsLQQAhDgwDC0E9IQoLQfw7IAo2AgALQX8hDgsgCEHQAGokACAOC9kCAQR/IwBB0AFrIgUkACAFIAI2AswBIAVBoAFqIgJBAEEoECoaIAUgBSgCzAE2AsgBAkBBACABIAVByAFqIAVB0ABqIAIgAyAEEIoBQQBIBEBBfyEEDAELQQEgBiAAKAJMQQBOGyEGIAAoAgAhByAAKAJIQQBMBEAgACAHQV9xNgIACwJ/AkACQCAAKAIwRQRAIABB0AA2AjAgAEEANgIcIABCADcDECAAKAIsIQggACAFNgIsDAELIAAoAhANAQtBfyAAEJ0BDQEaCyAAIAEgBUHIAWogBUHQAGogBUGgAWogAyAEEIoBCyECIAgEQCAAQQBBACAAKAIkEQYAGiAAQQA2AjAgACAINgIsIABBADYCHCAAKAIUIQEgAEIANwMQIAJBfyABGyECCyAAIAAoAgAiACAHQSBxcjYCAEF/IAIgAEEgcRshBCAGRQ0ACyAFQdABaiQAIAQLfwIBfwF+IAC9IgNCNIinQf8PcSICQf8PRwR8IAJFBEAgASAARAAAAAAAAAAAYQR/QQAFIABEAAAAAAAA8EOiIAEQjAEhACABKAIAQUBqCzYCACAADwsgASACQf4HazYCACADQv////////+HgH+DQoCAgICAgIDwP4S/BSAACwsVACAARQRAQQAPC0H8OyAANgIAQX8LzgECA38CfSMAQRBrIgMkAEEBIQQgA0EIaiAAQfwAaiIFIAAgAUEBdGpBxABqIgEvAQAQHwJAAkAgAyoCCCIHIAIqAgAiBlwEQCAHIAdbBEAgAi0ABCECDAILIAYgBlwhBAsgAi0ABCECIARFDQAgAy0ADCACQf8BcUYNAQsgBSABIAYgAhA5A0AgAC0AACIBQQRxDQEgACABQQRyOgAAIAAoAhAiAQRAIAAgAREAAAsgAEGAgID+BzYCnAEgACgC5AMiAA0ACwsgA0EQaiQAC9EDAEHUO0GoHBAcQdU7QYoWQQFBAUEAEBtB1jtB/RJBAUGAf0H/ABAEQdc7QfYSQQFBgH9B/wAQBEHYO0H0EkEBQQBB/wEQBEHZO0GUCkECQYCAfkH//wEQBEHaO0GLCkECQQBB//8DEARB2ztBsQpBBEGAgICAeEH/////BxAEQdw7QagKQQRBAEF/EARB3TtB+BhBBEGAgICAeEH/////BxAEQd47Qe8YQQRBAEF/EARB3ztBjxBCgICAgICAgICAf0L///////////8AEIQBQeA7QY4QQgBCfxCEAUHhO0GIEEEEEA1B4jtB9BtBCBANQeM7QaQZEA5B5DtBmSIQDkHlO0EEQZcZEAhB5jtBAkGwGRAIQec7QQRBvxkQCEHoO0GPFhAaQek7QQBB1CEQAUHqO0EAQboiEAFB6ztBAUHyIRABQew7QQJB5B4QAUHtO0EDQYMfEAFB7jtBBEGrHxABQe87QQVByB8QAUHwO0EEQd8iEAFB8TtBBUH9IhABQeo7QQBBriAQAUHrO0EBQY0gEAFB7DtBAkHwIBABQe07QQNBziAQAUHuO0EEQbMhEAFB7ztBBUGRIRABQfI7QQZB7h8QAUHzO0EHQaQjEAELJQAgAEH0JjYCACAALQAEBEAgACgCCEH9DxBmCyAAKAIIEAYgAAsDAAALJQAgAEHsJzYCACAALQAEBEAgACgCCEH9DxBmCyAAKAIIEAYgAAs3AQJ/QQQQHiICIAE2AgBBBBAeIgMgATYCAEGjOyAAQeI7QfooQcEBIAJB4jtB/ihBwgEgAxAHCzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRBQALOQEBfyABIAAoAgQiBEEBdWohASAAKAIAIQAgASACIAMgBEEBcQR/IAEoAgAgAGooAgAFIAALEQMACwkAIAEgABEAAAsHACAAEQ4ACzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAACzABAX8jAEEQayICJAAgAiABNgIIIAJBCGogABECACEAIAIoAggQBiACQRBqJAAgAAsMACABIAAoAgARAAALCQAgAEEBOgAEC9coAQJ/QaA7QaE7QaI7QQBBjCZBB0GPJkEAQY8mQQBB2RZBkSZBCBAFQQgQHiIAQoiAgIAQNwMAQaA7QZcbQQZBoCZBuCZBCSAAQQEQAEGkO0GlO0GmO0GgO0GMJkEKQYwmQQtBjCZBDEG4EUGRJkENEAVBBBAeIgBBDjYCAEGkO0HoFEECQcAmQcgmQQ8gAEEAEABBoDtBowxBAkHMJkHUJkEQQREQA0GgO0GAHEEDQaQnQbAnQRJBExADQbg7Qbk7Qbo7QQBBjCZBFEGPJkEAQY8mQQBB6RZBkSZBFRAFQQgQHiIAQoiAgIAQNwMAQbg7QegcQQJBuCdByCZBFiAAQQEQAEG7O0G8O0G9O0G4O0GMJkEXQYwmQRhBjCZBGUHPEUGRJkEaEAVBBBAeIgBBGzYCAEG7O0HoFEECQcAnQcgmQRwgAEEAEABBuDtBowxBAkHIJ0HUJkEdQR4QA0G4O0GAHEEDQaQnQbAnQRJBHxADQb47Qb87QcA7QQBBjCZBIEGPJkEAQY8mQQBB2hpBkSZBIRAFQb47QQFB+CdBjCZBIkEjEA9BvjtBkBtBAUH4J0GMJkEiQSMQA0G+O0HpCEECQfwnQcgmQSRBJRADQQgQHiIAQQA2AgQgAEEmNgIAQb47Qa0cQQRBkChBoChBJyAAQQAQAEEIEB4iAEEANgIEIABBKDYCAEG+O0GkEUEDQagoQbQoQSkgAEEAEABBCBAeIgBBADYCBCAAQSo2AgBBvjtByB1BA0G8KEHIKEErIABBABAAQQgQHiIAQQA2AgQgAEEsNgIAQb47QaYQQQNB0ChByChBLSAAQQAQAEEIEB4iAEEANgIEIABBLjYCAEG+O0HLHEEDQdwoQbAnQS8gAEEAEABBCBAeIgBBADYCBCAAQTA2AgBBvjtB0h1BAkHoKEHUJkExIABBABAAQQgQHiIAQQA2AgQgAEEyNgIAQb47QZcQQQJB8ChB1CZBMyAAQQAQAEHBO0GECkH4KEE0QZEmQTUQCkHiD0EAEEhB6g5BCBBIQYITQRAQSEHxFUEYEEhBgxdBIBBIQfAOQSgQSEHBOxAJQaM7Qf8aQfgoQTZBkSZBNxAKQYMXQQAQkwFB8A5BCBCTAUGjOxAJQcI7QYobQfgoQThBkSZBORAKQQQQHiIAQQg2AgBBBBAeIgFBCDYCAEHCO0GEG0HiO0H6KEE6IABB4jtB/ihBOyABEAdBBBAeIgBBADYCAEEEEB4iAUEANgIAQcI7QeUOQds7QdQmQTwgAEHbO0HIKEE9IAEQB0HCOxAJQcM7QcQ7QcU7QQBBjCZBPkGPJkEAQY8mQQBB+xtBkSZBPxAFQcM7QQFBhClBjCZBwABBwQAQD0HDO0HXDkEBQYQpQYwmQcAAQcEAEANBwztB0BpBAkGIKUHUJkHCAEHDABADQcM7QekIQQJBkClByCZBxABBxQAQA0EIEB4iAEEANgIEIABBxgA2AgBBwztB9w9BAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABByAA2AgBBwztB6htBA0GYKUHIKEHJACAAQQAQAEEIEB4iAEEANgIEIABBygA2AgBBwztBnxtBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABBzAA2AgBBwztB0BRBBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABBzgA2AgBBwztBiA1BBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABBzwA2AgBBwztB3RNBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB0AA2AgBBwztB+QtBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB0QA2AgBBwztBuBBBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB0gA2AgBBwztB5RpBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB0wA2AgBBwztB/BRBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB1AA2AgBBwztBlRNBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB1QA2AgBBwztBtQpBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB1gA2AgBBwztBuBVBBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB1wA2AgBBwztBmw1BBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB2AA2AgBBwztB7RNBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB2QA2AgBBwztBxAlBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB2gA2AgBBwztB8QhBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB2wA2AgBBwztBhwlBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB3QA2AgBBwztB1BBBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB3gA2AgBBwztB5gxBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB3wA2AgBBwztBzBNBAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABB4AA2AgBBwztBrAlBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB4QA2AgBBwztBnxZBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB4gA2AgBBwztBoRdBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB4wA2AgBBwztBvw1BA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB5AA2AgBBwztB+xNBAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABB5QA2AgBBwztBkQ9BA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB5gA2AgBBwztBwQxBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB5wA2AgBBwztBvhNBAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABB6AA2AgBBwztBsxdBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB6QA2AgBBwztBzw1BA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB6gA2AgBBwztBpQ9BA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB6wA2AgBBwztB0gxBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB7AA2AgBBwztBiRdBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB7QA2AgBBwztBrA1BA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB7gA2AgBBwztB9w5BA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB7wA2AgBBwztBrQxBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB8AA2AgBBwztB/RhBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB8QA2AgBBwztBshRBA0HIKUH+KEHcACAAQQAQAEEIEB4iAEEANgIEIABB8gA2AgBBwztBlBJBBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB8wA2AgBBwztBzhlBBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB9AA2AgBBwztB4g1BBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB9QA2AgBBwztBrRNBBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB9gA2AgBBwztB+gxBBEGwKUHAKUHNACAAQQAQAEEIEB4iAEEANgIEIABB9wA2AgBBwztBnhVBA0GkKUHIKEHLACAAQQAQAEEIEB4iAEEANgIEIABB+AA2AgBBwztBrxtBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABB+gA2AgBBwztB3BRBA0HcKUGwJ0H7ACAAQQAQAEEIEB4iAEEANgIEIABB/AA2AgBBwztBiQxBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABB/QA2AgBBwztBxhBBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABB/gA2AgBBwztB8hpBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABB/wA2AgBBwztBjRVBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABBgAE2AgBBwztBoRNBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABBgQE2AgBBwztBxwpBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABBggE2AgBBwztBwhVBA0HcKUGwJ0H7ACAAQQAQAEEIEB4iAEEANgIEIABBgwE2AgBBwztB4RBBAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBhQE2AgBBwztBuAlBAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBhwE2AgBBwztBrRZBAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBiAE2AgBBwztBqhdBAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBiQE2AgBBwztBmw9BAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBigE2AgBBwztBvxdBAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBiwE2AgBBwztBsg9BAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBjAE2AgBBwztBlRdBAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBjQE2AgBBwztBhA9BAkHoKUHUJkGEASAAQQAQAEEIEB4iAEEANgIEIABBjgE2AgBBwztBihlBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABBjwE2AgBBwztBwRRBAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBkAE2AgBBwztBnhJBA0H4KUGEKkGRASAAQQAQAEEIEB4iAEEANgIEIABBkgE2AgBBwztB0AlBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABBkwE2AgBBwztB/AhBAkHUKUHUJkH5ACAAQQAQAEEIEB4iAEEANgIEIABBlAE2AgBBwztB2RlBA0HcKUGwJ0H7ACAAQQAQAEEIEB4iAEEANgIEIABBlQE2AgBBwztBtBNBA0GMKkGYKkGWASAAQQAQAEEIEB4iAEEANgIEIABBlwE2AgBBwztBhxxBBEGgKkGgKEGYASAAQQAQAEEIEB4iAEEANgIEIABBmQE2AgBBwztBnBxBA0GwKkHIKEGaASAAQQAQAEEIEB4iAEEANgIEIABBmwE2AgBBwztBmgpBAkG8KkHUJkGcASAAQQAQAEEIEB4iAEEANgIEIABBnQE2AgBBwztBmQxBAkHEKkHUJkGeASAAQQAQAEEIEB4iAEEANgIEIABBnwE2AgBBwztBkxxBA0HMKkGwJ0GgASAAQQAQAEEIEB4iAEEANgIEIABBoQE2AgBBwztBuxZBA0HYKkHIKEGiASAAQQAQAEEIEB4iAEEANgIEIABBowE2AgBBwztBvxtBAkHkKkHUJkGkASAAQQAQAEEIEB4iAEEANgIEIABBpQE2AgBBwztB0xtBA0HYKkHIKEGiASAAQQAQAEEIEB4iAEEANgIEIABBpgE2AgBBwztBqB1BA0HsKkHIKEGnASAAQQAQAEEIEB4iAEEANgIEIABBqAE2AgBBwztBph1BAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABBqQE2AgBBwztBuR1BA0H4KkHIKEGqASAAQQAQAEEIEB4iAEEANgIEIABBqwE2AgBBwztBtx1BAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABBrAE2AgBBwztB3whBAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABBrQE2AgBBwztB1whBAkGEK0HUJkGuASAAQQAQAEEIEB4iAEEANgIEIABBrwE2AgBBwztB3hVBAkGQKUHIJkHHACAAQQAQAEEIEB4iAEEANgIEIABBsAE2AgBBwztB3AlBAkGEK0HUJkGuASAAQQAQAEEIEB4iAEEANgIEIABBsQE2AgBBwztB6QlBBUGQK0GkK0GyASAAQQAQAEEIEB4iAEEANgIEIABBswE2AgBBwztB5w9BAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBtAE2AgBBwztB0Q9BAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBtQE2AgBBwztBhhNBAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBtgE2AgBBwztB+BVBAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBtwE2AgBBwztByxdBAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBuAE2AgBBwztBvw9BAkHwKUH6KEGGASAAQQAQAEEIEB4iAEEANgIEIABBuQE2AgBBwztB+QlBAkGsK0HUJkG6ASAAQQAQAEEIEB4iAEEANgIEIABBuwE2AgBBwztBzBVBA0H4KUGEKkGRASAAQQAQAEEIEB4iAEEANgIEIABBvAE2AgBBwztBqBJBA0H4KUGEKkGRASAAQQAQAEEIEB4iAEEANgIEIABBvQE2AgBBwztB5BlBA0H4KUGEKkGRASAAQQAQAEEIEB4iAEEANgIEIABBvgE2AgBBwztBqxVBAkHUKUHUJkH5ACAAQQAQAAtZAQF/IAAgACgCSCIBQQFrIAFyNgJIIAAoAgAiAUEIcQRAIAAgAUEgcjYCAEF/DwsgAEIANwIEIAAgACgCLCIBNgIcIAAgATYCFCAAIAEgACgCMGo2AhBBAAtHAAJAIAFBA00EfyAAIAFBAnRqQQRqBSABQQRrIgEgACgCGCIAKAIEIAAoAgAiAGtBAnVPDQEgACABQQJ0agsoAgAPCxACAAs4AQF/IAFBAEgEQBACAAsgAUEBa0EFdkEBaiIBQQJ0EB4hAiAAIAE2AgggAEEANgIEIAAgAjYCAAvSBQEJfyAAIAEvAQA7AQAgACABKQIENwIEIAAgASkCDDcCDCAAIAEoAhQ2AhQCQAJAIAEoAhgiA0UNAEEYEB4iBUEANgIIIAVCADcCACADKAIEIgEgAygCACICRwRAIAEgAmsiAkEASA0CIAUgAhAeIgE2AgAgBSABIAJqNgIIIAMoAgAiAiADKAIEIgZHBEADQCABIAIoAgA2AgAgAUEEaiEBIAJBBGoiAiAGRw0ACwsgBSABNgIECyAFQgA3AgwgBUEANgIUIAMoAhAiAUUNACAFQQxqIAEQnwEgAygCDCEGIAUgBSgCECIEIAMoAhAiAkEfcWogAkFgcWoiATYCEAJAAkAgBEUEQCABQQFrIQMMAQsgAUEBayIDIARBAWtzQSBJDQELIAUoAgwgA0EFdkEAIAFBIU8bQQJ0akEANgIACyAFKAIMIARBA3ZB/P///wFxaiEBIARBH3EiA0UEQCACQQBMDQEgAkEgbSEDIAJBH2pBP08EQCABIAYgA0ECdBAzGgsgAiADQQV0ayICQQBMDQEgASADQQJ0IgNqIgEgASgCAEF/QSAgAmt2IgFBf3NxIAMgBmooAgAgAXFyNgIADAELIAJBAEwNAEF/IAN0IQhBICADayEEIAJBIE4EQCAIQX9zIQkgASgCACEHA0AgASAHIAlxIAYoAgAiByADdHI2AgAgASABKAIEIAhxIAcgBHZyIgc2AgQgBkEEaiEGIAFBBGohASACQT9LIQogAkEgayECIAoNAAsgAkEATA0BCyABIAEoAgBBfyAEIAQgAiACIARKGyIEa3YgCHFBf3NxIAYoAgBBf0EgIAJrdnEiBiADdHI2AgAgAiAEayICQQBMDQAgASADIARqQQN2Qfz///8BcWoiASABKAIAQX9BICACa3ZBf3NxIAYgBHZyNgIACyAAKAIYIQEgACAFNgIYIAEEQCABEFsLDwsQAgALvQMBB38gAARAIwBBIGsiBiQAIAAoAgAiASgC5AMiAwRAIAMgARBvGiABQQA2AuQDCyABKALsAyICIAEoAugDIgNHBEBBASACIANrQQJ1IgIgAkEBTRshBEEAIQIDQCADIAJBAnRqKAIAQQA2AuQDIAJBAWoiAiAERw0ACwsgASADNgLsAwJAIAMgAUHwA2oiAigCAEYNACAGQQhqQQBBACACEEoiAigCBCABKALsAyABKALoAyIEayIFayIDIAQgBRAzIQUgASgC6AMhBCABIAU2AugDIAIgBDYCBCABKALsAyEFIAEgAigCCDYC7AMgAiAFNgIIIAEoAvADIQcgASACKAIMNgLwAyACIAQ2AgAgAiAHNgIMIAQgBUcEQCACIAUgBCAFa0EDakF8cWo2AggLIARFDQAgBBAnIAEoAugDIQMLIAMEQCABIAM2AuwDIAMQJwsgASgClAEhAyABQQA2ApQBIAMEQCADEFsLIAEQJyAAKAIIIQEgAEEANgIIIAEEQCABIAEoAgAoAgQRAAALIAAoAgQhASAAQQA2AgQgAQRAIAEgASgCACgCBBEAAAsgBkEgaiQAIAAQIwsLtQEBAX8jAEEQayICJAACfyABBEAgASgCACEBQYgEEB4gARBcIAENARogAkH3GTYCACACEHIQJAALQZQ7LQAARQRAQfg6QQM2AgBBiDtCgICAgICAgMA/NwIAQYA7QgA3AgBBlDtBAToAAEH8OkH8Oi0AAEH+AXE6AABB9DpBADYCAEGQO0EANgIAC0GIBBAeQfQ6EFwLIQEgAEIANwIEIAAgATYCACABIAA2AgQgAkEQaiQAIAALGwEBfyAABEAgACgCACIBBEAgARAjCyAAECMLC0kBAn9BBBAeIQFBIBAeIgBBADYCHCAAQoCAgICAgIDAPzcCFCAAQgA3AgwgAEEAOgAIIABBAzYCBCAAQQA2AgAgASAANgIAIAELIAAgAkEFR0EAIAIbRQRAQbgwIAMgBBBJDwsgAyAEEHALIgEBfiABIAKtIAOtQiCGhCAEIAARFQAiBUIgiKckASAFpwuoAQEFfyAAKAJUIgMoAgAhBSADKAIEIgQgACgCFCAAKAIcIgdrIgYgBCAGSRsiBgRAIAUgByAGECsaIAMgAygCACAGaiIFNgIAIAMgAygCBCAGayIENgIECyAEIAIgAiAESxsiBARAIAUgASAEECsaIAMgAygCACAEaiIFNgIAIAMgAygCBCAEazYCBAsgBUEAOgAAIAAgACgCLCIBNgIcIAAgATYCFCACCwQAQgALBABBAAuKBQIGfgJ/IAEgASgCAEEHakF4cSIBQRBqNgIAIAAhCSABKQMAIQMgASkDCCEGIwBBIGsiCCQAAkAgBkL///////////8AgyIEQoCAgICAgMCAPH0gBEKAgICAgIDA/8MAfVQEQCAGQgSGIANCPIiEIQQgA0L//////////w+DIgNCgYCAgICAgIAIWgRAIARCgYCAgICAgIDAAHwhAgwCCyAEQoCAgICAgICAQH0hAiADQoCAgICAgICACFINASACIARCAYN8IQIMAQsgA1AgBEKAgICAgIDA//8AVCAEQoCAgICAgMD//wBRG0UEQCAGQgSGIANCPIiEQv////////8Dg0KAgICAgICA/P8AhCECDAELQoCAgICAgID4/wAhAiAEQv///////7//wwBWDQBCACECIARCMIinIgBBkfcASQ0AIAMhAiAGQv///////z+DQoCAgICAgMAAhCIFIQcCQCAAQYH3AGsiAUHAAHEEQCACIAFBQGqthiEHQgAhAgwBCyABRQ0AIAcgAa0iBIYgAkHAACABa62IhCEHIAIgBIYhAgsgCCACNwMQIAggBzcDGAJAQYH4ACAAayIAQcAAcQRAIAUgAEFAaq2IIQNCACEFDAELIABFDQAgBUHAACAAa62GIAMgAK0iAoiEIQMgBSACiCEFCyAIIAM3AwAgCCAF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ASAAKAIAIQAgASACQQFxBH8gASgCACAAaigCAAUgAAsRCwALYQECfyMAQRBrIgIkACABIAAoAgQiA0EBdWohASAAKAIAIQAgAiABIANBAXEEfyABKAIAIABqKAIABSAACxEBAEEQEB4iACACKQMINwMIIAAgAikDADcDACACQRBqJAAgAAtjAQJ/IwBBEGsiAyQAIAEgACgCBCIEQQF1aiEBIAAoAgAhACADIAEgAiAEQQFxBH8gASgCACAAaigCAAUgAAsRAwBBEBAeIgAgAykDCDcDCCAAIAMpAwA3AwAgA0EQaiQAIAALNwEBfyABIAAoAgQiA0EBdWohASAAKAIAIQAgASACIANBAXEEfyABKAIAIABqKAIABSAACxEEAAs5AQF/IAEgACgCBCIEQQF1aiEBIAAoAgAhACABIAIgAyAEQQFxBH8gASgCACAAaigCAAUgAAsRCAALCQAgASAAEQIACwUAQcM7Cw8AIAEgACgCAGogAjYCAAsNACABIAAoAgBqKAIACxgBAX9BEBAeIgBCADcDCCAAQQA2AgAgAAsYAQF/QRAQHiIAQgA3AwAgAEIANwMIIAALDABBMBAeQQBBMBAqCzcBAX8gASAAKAIEIgNBAXVqIQEgACgCACEAIAEgAiADQQFxBH8gASgCACAAaigCAAUgAAsRHgALBQBBvjsLIQAgACABKAIAIAEgASwAC0EASBtBuzsgAigCABAQNgIACyoBAX9BDBAeIgFBADoABCABIAAoAgA2AgggAEEANgIAIAFB2Cc2AgAgAQsFAEG7OwsFAEG4OwshACAAIAEoAgAgASABLAALQQBIG0GkOyACKAIAEBA2AgAL2AEBBH8jAEEgayIDJAAgASgCACIEQfD///8HSQRAAkACQCAEQQtPBEAgBEEPckEBaiIFEB4hBiADIAVBgICAgHhyNgIQIAMgBjYCCCADIAQ2AgwgBCAGaiEFDAELIAMgBDoAEyADQQhqIgYgBGohBSAERQ0BCyAGIAFBBGogBBArGgsgBUEAOgAAIAMgAjYCACADQRhqIANBCGogAyAAEQMAIAMoAhgQHSADKAIYIgAQBiADKAIAEAYgAywAE0EASARAIAMoAggQIwsgA0EgaiQAIAAPCxACAAsqAQF/QQwQHiIBQQA6AAQgASAAKAIANgIIIABBADYCACABQeAmNgIA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AkEIaiAIIAYQHyACIAcgAC8AABAfQQEhAyACKgIIIgogAioCACILXAR/IAogClsNAyALIAtcBSADC0UNAiACLQAMIAItAARHDQILIABBAmohAEEBIQMgBCEGQQEhBCAGRQ0ACyABLwB6IgBBB3FFBEAgBS0AekEHcUUNAgsgCCAAECAiCiAHIAUvAHoQICILWw0BIAogClsNACALIAtcDQELIAFBFGogBUEUakHoABArGiABQfwAaiAFQfwAahCgAQNAIAEtAAAiAEEEcQ0BIAEgAEEEcjoAACABKAIQIgAEQCABIAARAAALIAFBgICA/gc2ApwBIAEoAuQDIgENAAsLIAJBEGokAAvGAwEEfyMAQaAEayICJAAgACgCBCEBIABBADYCBCABBEAgASABKAIAKAIEEQAACyAAKAIIIQEgAEEANgIIIAEEQCABIAEoAgAoAgQRAAALAkAgACgCACIAKALoAyAAKALsA0YEQCAAKALkAw0BIAAgAkEYaiAAKAL0AxBcIgEpAgA3AgAgACABKAIQNgIQIAAgASkCCDcCCCAAQRRqIAFBFGpB6AAQKxogACABKQKMATcCjAEgACABKQKEATcChAEgACABKQJ8NwJ8IAEoApQBIQQgAUEANgKUASAAKAKUASEDIAAgBDYClAEgAwRAIAMQWwsgAEGYAWogAUGYAWpB0AIQKxogACgC6AMiAwRAIAAgAzYC7AMgAxAjCyAAIAEoAugDNgLoAyAAIAEoAuwDNgLsAyAAIAEoAvADNgLwAyABQQA2AvADIAFCADcC6AMgACABKQL8AzcC/AMgACABKQL0AzcC9AMgACABKAKEBDYChAQgASgClAEhACABQQA2ApQBIAAEQCAAEFsLIAJBoARqJAAPCyACQfAcNgIQIABBBUHYJSACQRBqECwQJAALIAJB5hE2AgAgAEEFQdglIAIQLBAkAAsLAEEMEB4gABCiAQsLAEEMEB5BABCiAQsNACAAKAIALQAIQQFxCwoAIAAoAgAoAhQLGQAgAUH/AXEEQBACAAsgACgCACgCEEEBcQsYACAAKAIAIgAgAC0ACEH+AXEgAXI6AAgLJgAgASAAKAIAIgAoAhRHBEAgACABNgIUIAAgACgCDEEBajYCDAsLkgEBAn8jAEEQayICJAAgACgCACEAIAFDAAAAAGAEQCABIAAqAhhcBEAgACABOAIYIAAgACgCDEEBajYCDAsgAkEQaiQADwsgAkGIFDYCACMAQRBrIgMkACADIAI2AgwCQCAARQRAQbgwQdglIAIQSRoMAQsgAEEAQQVB2CUgAiAAKAIEEQ0AGgsgA0EQaiQAECQACz8AIAFB/wFxRQRAIAIgACgCACIAKAIQIgFBAXFHBEAgACABQX5xIAJyNgIQIAAgACgCDEEBajYCDAsPCxACAAsL4CYjAEGACAuBHk9ubHkgbGVhZiBub2RlcyB3aXRoIGN1c3RvbSBtZWFzdXJlIGZ1bmN0aW9ucyBzaG91bGQgbWFudWFsbHkgbWFyayB0aGVtc2VsdmVzIGFzIGRpcnR5AGlzRGlydHkAbWFya0RpcnR5AGRlc3Ryb3kAc2V0RGlzcGxheQBnZXREaXNwbGF5AHNldEZsZXgALSsgICAwWDB4AC0wWCswWCAwWC0weCsweCAweABzZXRGbGV4R3JvdwBnZXRGbGV4R3JvdwBzZXRPdmVyZmxvdwBnZXRPdmVyZmxvdwBoYXNOZXdMYXlvdXQAY2FsY3VsYXRlTGF5b3V0AGdldENvbXB1dGVkTGF5b3V0AHVuc2lnbmVkIHNob3J0AGdldENoaWxkQ291bnQAdW5zaWduZWQgaW50AHNldEp1c3RpZnlDb250ZW50AGdldEp1c3RpZnlDb250ZW50AGF2YWlsYWJsZUhlaWdodCBpcyBpbmRlZmluaXRlIHNvIGhlaWdodFNpemluZ01vZGUgbXVzdCBiZSBTaXppbmdNb2RlOjpNYXhDb250ZW50AGF2YWlsYWJsZVdpZHRoIGlzIGluZGVmaW5pdGUgc28gd2lkdGhTaXppbmdNb2RlIG11c3QgYmUgU2l6aW5nTW9kZTo6TWF4Q29udGVudABzZXRBbGlnbkNvbnRlbnQAZ2V0QWxpZ25Db250ZW50AGdldFBhcmVudABpbXBsZW1lbnQAc2V0TWF4SGVpZ2h0UGVyY2VudABzZXRIZWlnaHRQZXJjZW50AHNldE1pbkhlaWdodFBlcmNlbnQAc2V0RmxleEJhc2lzUGVyY2VudABzZXRHYXBQZXJjZW50AHNldFBvc2l0aW9uUGVyY2VudABzZXRNYXJnaW5QZXJjZW50AHNldE1heFdpZHRoUGVyY2VudABzZXRXaWR0aFBlcmNlbnQAc2V0TWluV2lkdGhQZXJjZW50AHNldFBhZGRpbmdQZXJjZW50AGhhbmRsZS50eXBlKCkgPT0gU3R5bGVWYWx1ZUhhbmRsZTo6VHlwZTo6UG9pbnQgfHwgaGFuZGxlLnR5cGUoKSA9PSBTdHlsZVZhbHVlSGFuZGxlOjpUeXBlOjpQZXJjZW50AGNyZWF0ZURlZmF1bHQAdW5pdAByaWdodABoZWlnaHQAc2V0TWF4SGVpZ2h0AGdldE1heEhlaWdodABzZXRIZWlnaHQAZ2V0SGVpZ2h0AHNldE1pbkhlaWdodABnZXRNaW5IZWlnaHQAZ2V0Q29tcHV0ZWRIZWlnaHQAZ2V0Q29tcHV0ZWRSaWdodABsZWZ0AGdldENvbXB1dGVkTGVmdAByZXNldABfX2Rlc3RydWN0AGZsb2F0AHVpbnQ2NF90AHVzZVdlYkRlZmF1bHRzAHNldFVzZVdlYkRlZmF1bHRzAHNldEFsaWduSXRlbXMAZ2V0QWxpZ25JdGVtcwBzZXRGbGV4QmFzaXMAZ2V0RmxleEJhc2lzAENhbm5vdCBnZXQgbGF5b3V0IHByb3BlcnRpZXMgb2YgbXVsdGktZWRnZSBzaG9ydGhhbmRzAHNldFBvaW50U2NhbGVGYWN0b3IATWVhc3VyZUNhbGxiYWNrV3JhcHBlcgBEaXJ0aWVkQ2FsbGJhY2tXcmFwcGVyAENhbm5vdCByZXNldCBhIG5vZGUgc3RpbGwgYXR0YWNoZWQgdG8gYSBvd25lcgBzZXRCb3JkZXIAZ2V0Qm9yZGVyAGdldENvbXB1dGVkQm9yZGVyAGdldE51bWJlcgBoYW5kbGUudHlwZSgpID09IFN0eWxlVmFsdWVIYW5kbGU6OlR5cGU6Ok51bWJlcgB1bnNpZ25lZCBjaGFyAHRvcABnZXRDb21wdXRlZFRvcABzZXRGbGV4V3JhcABnZXRGbGV4V3JhcABzZXRHYXAAZ2V0R2FwACVwAHNldEhlaWdodEF1dG8Ac2V0RmxleEJhc2lzQXV0bwBzZXRQb3NpdGlvbkF1dG8Ac2V0TWFyZ2luQXV0bwBzZXRXaWR0aEF1dG8AU2NhbGUgZmFjdG9yIHNob3VsZCBub3QgYmUgbGVzcyB0aGFuIHplcm8Ac2V0QXNwZWN0UmF0aW8AZ2V0QXNwZWN0UmF0aW8Ac2V0UG9zaXRpb24AZ2V0UG9zaXRpb24Abm90aWZ5T25EZXN0cnVjdGlvbgBzZXRGbGV4RGlyZWN0aW9uAGdldEZsZXhEaXJlY3Rpb24Ac2V0RGlyZWN0aW9uAGdldERpcmVjdGlvbgBzZXRNYXJnaW4AZ2V0TWFyZ2luAGdldENvbXB1dGVkTWFyZ2luAG1hcmtMYXlvdXRTZWVuAG5hbgBib3R0b20AZ2V0Q29tcHV0ZWRCb3R0b20AYm9vbABlbXNjcmlwdGVuOjp2YWwAc2V0RmxleFNocmluawBnZXRGbGV4U2hyaW5rAHNldEFsd2F5c0Zvcm1zQ29udGFpbmluZ0Jsb2NrAE1lYXN1cmVDYWxsYmFjawBEaXJ0aWVkQ2FsbGJhY2sAZ2V0TGVuZ3RoAHdpZHRoAHNldE1heFdpZHRoAGdldE1heFdpZHRoAHNldFdpZHRoAGdldFdpZHRoAHNldE1pbldpZHRoAGdldE1pbldpZHRoAGdldENvbXB1dGVkV2lkdGgAcHVzaAAvaG9tZS9ydW5uZXIvd29yay95b2dhL3lvZ2EvamF2YXNjcmlwdC8uLi95b2dhL3N0eWxlL1NtYWxsVmFsdWVCdWZmZXIuaAAvaG9tZS9ydW5uZXIvd29yay95b2dhL3lvZ2EvamF2YXNjcmlwdC8uLi95b2dhL3N0eWxlL1N0eWxlVmFsdWVQb29sLmgAdW5zaWduZWQgbG9uZwBzZXRCb3hTaXppbmcAZ2V0Qm94U2l6aW5nAHN0ZDo6d3N0cmluZwBzdGQ6OnN0cmluZwBzdGQ6OnUxNnN0cmluZwBzdGQ6OnUzMnN0cmluZwBzZXRQYWRkaW5nAGdldFBhZGRpbmcAZ2V0Q29tcHV0ZWRQYWRkaW5nAFRyaWVkIHRvIGNvbnN0cnVjdCBZR05vZGUgd2l0aCBudWxsIGNvbmZpZwBBdHRlbXB0aW5nIHRvIGNvbnN0cnVjdCBOb2RlIHdpdGggbnVsbCBjb25maWcAY3JlYXRlV2l0aENvbmZpZwBpbmYAc2V0QWxpZ25TZWxmAGdldEFsaWduU2VsZgBTaXplAHZhbHVlAFZhbHVlAGNyZWF0ZQBtZWFzdXJlAHNldFBvc2l0aW9uVHlwZQBnZXRQb3NpdGlvblR5cGUAaXNSZWZlcmVuY2VCYXNlbGluZQBzZXRJc1JlZmVyZW5jZUJhc2VsaW5lAGNvcHlTdHlsZQBkb3VibGUATm9kZQBleHRlbmQAaW5zZXJ0Q2hpbGQAZ2V0Q2hpbGQAcmVtb3ZlQ2hpbGQAdm9pZABzZXRFeHBlcmltZW50YWxGZWF0dXJlRW5hYmxlZABpc0V4cGVyaW1lbnRhbEZlYXR1cmVFbmFibGVkAGRpcnRpZWQAQ2Fubm90IHJlc2V0IGEgbm9kZSB3aGljaCBzdGlsbCBoYXMgY2hpbGRyZW4gYXR0YWNoZWQAdW5zZXRNZWFzdXJlRnVuYwB1bnNldERpcnRpZWRGdW5jAHNldEVycmF0YQBnZXRFcnJhdGEATWVhc3VyZSBmdW5jdGlvbiByZXR1cm5lZCBhbiBpbnZhbGlkIGRpbWVuc2lvbiB0byBZb2dhOiBbd2lkdGg9JWYsIGhlaWdodD0lZl0ARXhwZWN0IGN1c3RvbSBiYXNlbGluZSBmdW5jdGlvbiB0byBub3QgcmV0dXJuIE5hTgBOQU4ASU5GAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ4X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8Y2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4Ac3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVk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";if(!ua(H)){var va=H;H=h.locateFile?h.locateFile(va,q):q+va;}
function wa(){var a=H;try{if(a==H&&w)return new Uint8Array(w);if(ua(a))try{var b=xa(a.slice(37)),c=new Uint8Array(b.length);for(a=0;a<b.length;++a)c[a]=b.charCodeAt(a);var d=c;}catch(f){throw Error("Converting base64 string to bytes failed.");}else d=void 0;var e=d;if(e)return e;throw "both async and sync fetching of the wasm failed";}catch(f){x(f);}}
function ya(){return w||"function"!=typeof fetch?Promise.resolve().then(function(){return wa()}):fetch(H,{credentials:"same-origin"}).then(function(a){if(!a.ok)throw "failed to load wasm binary file at '"+H+"'";return a.arrayBuffer()}).catch(function(){return wa()})}function za(a){for(;0<a.length;)a.shift()(h);}function Aa(a){if(void 0===a)return "_unknown";a=a.replace(/[^a-zA-Z0-9_]/g,"$");var b=a.charCodeAt(0);return 48<=b&&57>=b?"_"+a:a}
function Ba(a,b){a=Aa(a);return function(){return b.apply(this,arguments)}}var J=[{},{value:void 0},{value:null},{value:true},{value:false}],Ca=[];function Da(a){var b=Error,c=Ba(a,function(d){this.name=a;this.message=d;d=Error(d).stack;void 0!==d&&(this.stack=this.toString()+"\n"+d.replace(/^Error(:[^\n]*)?\n/,""));});c.prototype=Object.create(b.prototype);c.prototype.constructor=c;c.prototype.toString=function(){return void 0===this.message?this.name:this.name+": "+this.message};return c}var K=void 0;
function L(a){throw new K(a);}var M=a=>{a||L("Cannot use deleted val. handle = "+a);return J[a].value},Ea=a=>{switch(a){case void 0:return 1;case null:return 2;case true:return 3;case false:return 4;default:var b=Ca.length?Ca.pop():J.length;J[b]={ga:1,value:a};return b}},Fa=void 0,Ga=void 0;function N(a){for(var b="";A[a];)b+=Ga[A[a++]];return b}var O=[];function Ha(){for(;O.length;){var a=O.pop();a.M.$=false;a["delete"]();}}var P=void 0,Q={};
function Ia(a,b){for(void 0===b&&L("ptr should not be undefined");a.R;)b=a.ba(b),a=a.R;return b}var R={};function Ja(a){a=Ka(a);var b=N(a);S(a);return b}function La(a,b){var c=R[a];void 0===c&&L(b+" has unknown type "+Ja(a));return c}function Ma(){}var Na=false;function Oa(a){--a.count.value;0===a.count.value&&(a.T?a.U.W(a.T):a.P.N.W(a.O));}function Pa(a,b,c){if(b===c)return a;if(void 0===c.R)return null;a=Pa(a,b,c.R);return null===a?null:c.na(a)}var Qa={};function Ra(a,b){b=Ia(a,b);return Q[b]}
var Sa=void 0;function Ta(a){throw new Sa(a);}function Ua(a,b){b.P&&b.O||Ta("makeClassHandle requires ptr and ptrType");!!b.U!==!!b.T&&Ta("Both smartPtrType and smartPtr must be specified");b.count={value:1};return T(Object.create(a,{M:{value:b}}))}function T(a){if("undefined"===typeof FinalizationRegistry)return T=b=>b,a;Na=new FinalizationRegistry(b=>{Oa(b.M);});T=b=>{var c=b.M;c.T&&Na.register(b,{M:c},b);return b};Ma=b=>{Na.unregister(b);};return T(a)}var Va={};
function Wa(a){for(;a.length;){var b=a.pop();a.pop()(b);}}function Xa(a){return this.fromWireType(D[a>>2])}var U={},Ya={};function V(a,b,c){function d(k){k=c(k);k.length!==a.length&&Ta("Mismatched type converter count");for(var m=0;m<a.length;++m)W(a[m],k[m]);}a.forEach(function(k){Ya[k]=b;});var e=Array(b.length),f=[],g=0;b.forEach((k,m)=>{R.hasOwnProperty(k)?e[m]=R[k]:(f.push(k),U.hasOwnProperty(k)||(U[k]=[]),U[k].push(()=>{e[m]=R[k];++g;g===f.length&&d(e);}));});0===f.length&&d(e);}
function Za(a){switch(a){case 1:return 0;case 2:return 1;case 4:return 2;case 8:return 3;default:throw new TypeError("Unknown type size: "+a);}}
function W(a,b,c={}){if(!("argPackAdvance"in b))throw new TypeError("registerType registeredInstance requires argPackAdvance");var d=b.name;a||L('type "'+d+'" must have a positive integer typeid pointer');if(R.hasOwnProperty(a)){if(c.ua)return;L("Cannot register type '"+d+"' twice");}R[a]=b;delete Ya[a];U.hasOwnProperty(a)&&(b=U[a],delete U[a],b.forEach(e=>e()));}function $a(a){L(a.M.P.N.name+" instance already deleted");}function X(){}
function ab(a,b,c){if(void 0===a[b].S){var d=a[b];a[b]=function(){a[b].S.hasOwnProperty(arguments.length)||L("Function '"+c+"' called with an invalid number of arguments ("+arguments.length+") - expects one of ("+a[b].S+")!");return a[b].S[arguments.length].apply(this,arguments)};a[b].S=[];a[b].S[d.Z]=d;}}
function bb(a,b){h.hasOwnProperty(a)?(L("Cannot register public name '"+a+"' twice"),ab(h,a,a),h.hasOwnProperty(void 0)&&L("Cannot register multiple overloads of a function with the same number of arguments (undefined)!"),h[a].S[void 0]=b):h[a]=b;}function cb(a,b,c,d,e,f,g,k){this.name=a;this.constructor=b;this.X=c;this.W=d;this.R=e;this.pa=f;this.ba=g;this.na=k;this.ja=[];}
function db(a,b,c){for(;b!==c;)b.ba||L("Expected null or instance of "+c.name+", got an instance of "+b.name),a=b.ba(a),b=b.R;return a}function eb(a,b){if(null===b)return this.ea&&L("null is not a valid "+this.name),0;b.M||L('Cannot pass "'+fb(b)+'" as a '+this.name);b.M.O||L("Cannot pass deleted object as a pointer of type "+this.name);return db(b.M.O,b.M.P.N,this.N)}
function gb(a,b){if(null===b){this.ea&&L("null is not a valid "+this.name);if(this.da){var c=this.fa();null!==a&&a.push(this.W,c);return c}return 0}b.M||L('Cannot pass "'+fb(b)+'" as a '+this.name);b.M.O||L("Cannot pass deleted object as a pointer of type "+this.name);!this.ca&&b.M.P.ca&&L("Cannot convert argument of type "+(b.M.U?b.M.U.name:b.M.P.name)+" to parameter type "+this.name);c=db(b.M.O,b.M.P.N,this.N);if(this.da)switch(void 0===b.M.T&&L("Passing raw pointer to smart pointer is illegal"),
this.Ba){case 0:b.M.U===this?c=b.M.T:L("Cannot convert argument of type "+(b.M.U?b.M.U.name:b.M.P.name)+" to parameter type "+this.name);break;case 1:c=b.M.T;break;case 2:if(b.M.U===this)c=b.M.T;else {var d=b.clone();c=this.xa(c,Ea(function(){d["delete"]();}));null!==a&&a.push(this.W,c);}break;default:L("Unsupporting sharing policy");}return c}
function hb(a,b){if(null===b)return this.ea&&L("null is not a valid "+this.name),0;b.M||L('Cannot pass "'+fb(b)+'" as a '+this.name);b.M.O||L("Cannot pass deleted object as a pointer of type "+this.name);b.M.P.ca&&L("Cannot convert argument of type "+b.M.P.name+" to parameter type "+this.name);return db(b.M.O,b.M.P.N,this.N)}
function Y(a,b,c,d){this.name=a;this.N=b;this.ea=c;this.ca=d;this.da=false;this.W=this.xa=this.fa=this.ka=this.Ba=this.wa=void 0;void 0!==b.R?this.toWireType=gb:(this.toWireType=d?eb:hb,this.V=null);}function ib(a,b){h.hasOwnProperty(a)||Ta("Replacing nonexistant public symbol");h[a]=b;h[a].Z=void 0;}
function jb(a,b){var c=[];return function(){c.length=0;Object.assign(c,arguments);if(a.includes("j")){var d=h["dynCall_"+a];d=c&&c.length?d.apply(null,[b].concat(c)):d.call(null,b);}else d=oa.get(b).apply(null,c);return d}}function Z(a,b){a=N(a);var c=a.includes("j")?jb(a,b):oa.get(b);"function"!=typeof c&&L("unknown function pointer with signature "+a+": "+b);return c}var mb=void 0;
function nb(a,b){function c(f){e[f]||R[f]||(Ya[f]?Ya[f].forEach(c):(d.push(f),e[f]=true));}var d=[],e={};b.forEach(c);throw new mb(a+": "+d.map(Ja).join([", "]));}
function ob(a,b,c,d,e){var f=b.length;2>f&&L("argTypes array size mismatch! Must at least get return value and 'this' types!");var g=null!==b[1]&&null!==c,k=false;for(c=1;c<b.length;++c)if(null!==b[c]&&void 0===b[c].V){k=true;break}var m="void"!==b[0].name,l=f-2,n=Array(l),p=[],r=[];return function(){arguments.length!==l&&L("function "+a+" called with "+arguments.length+" arguments, expected "+l+" args!");r.length=0;p.length=g?2:1;p[0]=e;if(g){var u=b[1].toWireType(r,this);p[1]=u;}for(var t=0;t<l;++t)n[t]=
b[t+2].toWireType(r,arguments[t]),p.push(n[t]);t=d.apply(null,p);if(k)Wa(r);else for(var y=g?1:2;y<b.length;y++){var B=1===y?u:n[y-2];null!==b[y].V&&b[y].V(B);}u=m?b[0].fromWireType(t):void 0;return u}}function pb(a,b){for(var c=[],d=0;d<a;d++)c.push(E[b+4*d>>2]);return c}function qb(a){4<a&&0===--J[a].ga&&(J[a]=void 0,Ca.push(a));}function fb(a){if(null===a)return "null";var b=typeof a;return "object"===b||"array"===b||"function"===b?a.toString():""+a}
function rb(a,b){switch(b){case 2:return function(c){return this.fromWireType(la[c>>2])};case 3:return function(c){return this.fromWireType(ma[c>>3])};default:throw new TypeError("Unknown float type: "+a);}}
function sb(a,b,c){switch(b){case 0:return c?function(d){return ja[d]}:function(d){return A[d]};case 1:return c?function(d){return C[d>>1]}:function(d){return ka[d>>1]};case 2:return c?function(d){return D[d>>2]}:function(d){return E[d>>2]};default:throw new TypeError("Unknown integer type: "+a);}}function tb(a,b){for(var c="",d=0;!(d>=b/2);++d){var e=C[a+2*d>>1];if(0==e)break;c+=String.fromCharCode(e);}return c}
function ub(a,b,c){ void 0===c&&(c=2147483647);if(2>c)return 0;c-=2;var d=b;c=c<2*a.length?c/2:a.length;for(var e=0;e<c;++e)C[b>>1]=a.charCodeAt(e),b+=2;C[b>>1]=0;return b-d}function vb(a){return 2*a.length}function wb(a,b){for(var c=0,d="";!(c>=b/4);){var e=D[a+4*c>>2];if(0==e)break;++c;65536<=e?(e-=65536,d+=String.fromCharCode(55296|e>>10,56320|e&1023)):d+=String.fromCharCode(e);}return d}
function xb(a,b,c){ void 0===c&&(c=2147483647);if(4>c)return 0;var d=b;c=d+c-4;for(var e=0;e<a.length;++e){var f=a.charCodeAt(e);if(55296<=f&&57343>=f){var g=a.charCodeAt(++e);f=65536+((f&1023)<<10)|g&1023;}D[b>>2]=f;b+=4;if(b+4>c)break}D[b>>2]=0;return b-d}function yb(a){for(var b=0,c=0;c<a.length;++c){var d=a.charCodeAt(c);55296<=d&&57343>=d&&++c;b+=4;}return b}var zb={};function Ab(a){var b=zb[a];return void 0===b?N(a):b}var Bb=[];function Cb(a){var b=Bb.length;Bb.push(a);return b}
function Db(a,b){for(var c=Array(a),d=0;d<a;++d)c[d]=La(E[b+4*d>>2],"parameter "+d);return c}var Eb=[],Fb=[null,[],[]];K=h.BindingError=Da("BindingError");h.count_emval_handles=function(){for(var a=0,b=5;b<J.length;++b) void 0!==J[b]&&++a;return a};h.get_first_emval=function(){for(var a=5;a<J.length;++a)if(void 0!==J[a])return J[a];return null};Fa=h.PureVirtualError=Da("PureVirtualError");for(var Gb=Array(256),Hb=0;256>Hb;++Hb)Gb[Hb]=String.fromCharCode(Hb);Ga=Gb;h.getInheritedInstanceCount=function(){return Object.keys(Q).length};
h.getLiveInheritedInstances=function(){var a=[],b;for(b in Q)Q.hasOwnProperty(b)&&a.push(Q[b]);return a};h.flushPendingDeletes=Ha;h.setDelayFunction=function(a){P=a;O.length&&P&&P(Ha);};Sa=h.InternalError=Da("InternalError");X.prototype.isAliasOf=function(a){if(!(this instanceof X&&a instanceof X))return  false;var b=this.M.P.N,c=this.M.O,d=a.M.P.N;for(a=a.M.O;b.R;)c=b.ba(c),b=b.R;for(;d.R;)a=d.ba(a),d=d.R;return b===d&&c===a};
X.prototype.clone=function(){this.M.O||$a(this);if(this.M.aa)return this.M.count.value+=1,this;var a=T,b=Object,c=b.create,d=Object.getPrototypeOf(this),e=this.M;a=a(c.call(b,d,{M:{value:{count:e.count,$:e.$,aa:e.aa,O:e.O,P:e.P,T:e.T,U:e.U}}}));a.M.count.value+=1;a.M.$=false;return a};X.prototype["delete"]=function(){this.M.O||$a(this);this.M.$&&!this.M.aa&&L("Object already scheduled for deletion");Ma(this);Oa(this.M);this.M.aa||(this.M.T=void 0,this.M.O=void 0);};X.prototype.isDeleted=function(){return !this.M.O};
X.prototype.deleteLater=function(){this.M.O||$a(this);this.M.$&&!this.M.aa&&L("Object already scheduled for deletion");O.push(this);1===O.length&&P&&P(Ha);this.M.$=true;return this};Y.prototype.qa=function(a){this.ka&&(a=this.ka(a));return a};Y.prototype.ha=function(a){this.W&&this.W(a);};Y.prototype.argPackAdvance=8;Y.prototype.readValueFromPointer=Xa;Y.prototype.deleteObject=function(a){if(null!==a)a["delete"]();};
Y.prototype.fromWireType=function(a){function b(){return this.da?Ua(this.N.X,{P:this.wa,O:c,U:this,T:a}):Ua(this.N.X,{P:this,O:a})}var c=this.qa(a);if(!c)return this.ha(a),null;var d=Ra(this.N,c);if(void 0!==d){if(0===d.M.count.value)return d.M.O=c,d.M.T=a,d.clone();d=d.clone();this.ha(a);return d}d=this.N.pa(c);d=Qa[d];if(!d)return b.call(this);d=this.ca?d.la:d.pointerType;var e=Pa(c,this.N,d.N);return null===e?b.call(this):this.da?Ua(d.N.X,{P:d,O:e,U:this,T:a}):Ua(d.N.X,{P:d,O:e})};
mb=h.UnboundTypeError=Da("UnboundTypeError");
var xa="function"==typeof atob?atob:function(a){var b="",c=0;a=a.replace(/[^A-Za-z0-9\+\/=]/g,"");do{var d="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(a.charAt(c++));var e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(a.charAt(c++));var f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(a.charAt(c++));var g="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(a.charAt(c++));d=d<<2|e>>4;
e=(e&15)<<4|f>>2;var k=(f&3)<<6|g;b+=String.fromCharCode(d);64!==f&&(b+=String.fromCharCode(e));64!==g&&(b+=String.fromCharCode(k));}while(c<a.length);return b},Jb={l:function(a,b,c,d){x("Assertion failed: "+(a?z(A,a):"")+", at: "+[b?b?z(A,b):"":"unknown filename",c,d?d?z(A,d):"":"unknown function"]);},q:function(a,b,c){a=N(a);b=La(b,"wrapper");c=M(c);var d=[].slice,e=b.N,f=e.X,g=e.R.X,k=e.R.constructor;a=Ba(a,function(){e.R.ja.forEach(function(l){if(this[l]===g[l])throw new Fa("Pure virtual function "+
l+" must be implemented in JavaScript");}.bind(this));Object.defineProperty(this,"__parent",{value:f});this.__construct.apply(this,d.call(arguments));});f.__construct=function(){this===f&&L("Pass correct 'this' to __construct");var l=k.implement.apply(void 0,[this].concat(d.call(arguments)));Ma(l);var n=l.M;l.notifyOnDestruction();n.aa=true;Object.defineProperties(this,{M:{value:n}});T(this);l=n.O;l=Ia(e,l);Q.hasOwnProperty(l)?L("Tried to register registered instance: "+l):Q[l]=this;};f.__destruct=function(){this===
f&&L("Pass correct 'this' to __destruct");Ma(this);var l=this.M.O;l=Ia(e,l);Q.hasOwnProperty(l)?delete Q[l]:L("Tried to unregister unregistered instance: "+l);};a.prototype=Object.create(f);for(var m in c)a.prototype[m]=c[m];return Ea(a)},j:function(a){var b=Va[a];delete Va[a];var c=b.fa,d=b.W,e=b.ia,f=e.map(g=>g.ta).concat(e.map(g=>g.za));V([a],f,g=>{var k={};e.forEach((m,l)=>{var n=g[l],p=m.ra,r=m.sa,u=g[l+e.length],t=m.ya,y=m.Aa;k[m.oa]={read:B=>n.fromWireType(p(r,B)),write:(B,ba)=>{var I=[];t(y,
B,u.toWireType(I,ba));Wa(I);}};});return [{name:b.name,fromWireType:function(m){var l={},n;for(n in k)l[n]=k[n].read(m);d(m);return l},toWireType:function(m,l){for(var n in k)if(!(n in l))throw new TypeError('Missing field:  "'+n+'"');var p=c();for(n in k)k[n].write(p,l[n]);null!==m&&m.push(d,p);return p},argPackAdvance:8,readValueFromPointer:Xa,V:d}]});},v:function(){},B:function(a,b,c,d,e){var f=Za(c);b=N(b);W(a,{name:b,fromWireType:function(g){return !!g},toWireType:function(g,k){return k?d:e},argPackAdvance:8,
readValueFromPointer:function(g){if(1===c)var k=ja;else if(2===c)k=C;else if(4===c)k=D;else throw new TypeError("Unknown boolean type size: "+b);return this.fromWireType(k[g>>f])},V:null});},f:function(a,b,c,d,e,f,g,k,m,l,n,p,r){n=N(n);f=Z(e,f);k&&(k=Z(g,k));l&&(l=Z(m,l));r=Z(p,r);var u=Aa(n);bb(u,function(){nb("Cannot construct "+n+" due to unbound types",[d]);});V([a,b,c],d?[d]:[],function(t){t=t[0];if(d){var y=t.N;var B=y.X;}else B=X.prototype;t=Ba(u,function(){if(Object.getPrototypeOf(this)!==ba)throw new K("Use 'new' to construct "+
n);if(void 0===I.Y)throw new K(n+" has no accessible constructor");var kb=I.Y[arguments.length];if(void 0===kb)throw new K("Tried to invoke ctor of "+n+" with invalid number of parameters ("+arguments.length+") - expected ("+Object.keys(I.Y).toString()+") parameters instead!");return kb.apply(this,arguments)});var ba=Object.create(B,{constructor:{value:t}});t.prototype=ba;var I=new cb(n,t,ba,r,y,f,k,l);y=new Y(n,I,true,false);B=new Y(n+"*",I,false,false);var lb=new Y(n+" const*",I,false,true);Qa[a]={pointerType:B,
la:lb};ib(u,t);return [y,B,lb]});},d:function(a,b,c,d,e,f,g){var k=pb(c,d);b=N(b);f=Z(e,f);V([],[a],function(m){function l(){nb("Cannot call "+n+" due to unbound types",k);}m=m[0];var n=m.name+"."+b;b.startsWith("@@")&&(b=Symbol[b.substring(2)]);var p=m.N.constructor;void 0===p[b]?(l.Z=c-1,p[b]=l):(ab(p,b,n),p[b].S[c-1]=l);V([],k,function(r){r=ob(n,[r[0],null].concat(r.slice(1)),null,f,g);void 0===p[b].S?(r.Z=c-1,p[b]=r):p[b].S[c-1]=r;return []});return []});},p:function(a,b,c,d,e,f){0<b||x();var g=pb(b,
c);e=Z(d,e);V([],[a],function(k){k=k[0];var m="constructor "+k.name;void 0===k.N.Y&&(k.N.Y=[]);if(void 0!==k.N.Y[b-1])throw new K("Cannot register multiple constructors with identical number of parameters ("+(b-1)+") for class '"+k.name+"'! Overload resolution is currently only performed using the parameter count, not actual type info!");k.N.Y[b-1]=()=>{nb("Cannot construct "+k.name+" due to unbound types",g);};V([],g,function(l){l.splice(1,0,null);k.N.Y[b-1]=ob(m,l,null,e,f);return []});return []});},
a:function(a,b,c,d,e,f,g,k){var m=pb(c,d);b=N(b);f=Z(e,f);V([],[a],function(l){function n(){nb("Cannot call "+p+" due to unbound types",m);}l=l[0];var p=l.name+"."+b;b.startsWith("@@")&&(b=Symbol[b.substring(2)]);k&&l.N.ja.push(b);var r=l.N.X,u=r[b];void 0===u||void 0===u.S&&u.className!==l.name&&u.Z===c-2?(n.Z=c-2,n.className=l.name,r[b]=n):(ab(r,b,p),r[b].S[c-2]=n);V([],m,function(t){t=ob(p,t,l,f,g);void 0===r[b].S?(t.Z=c-2,r[b]=t):r[b].S[c-2]=t;return []});return []});},A:function(a,b){b=N(b);W(a,
{name:b,fromWireType:function(c){var d=M(c);qb(c);return d},toWireType:function(c,d){return Ea(d)},argPackAdvance:8,readValueFromPointer:Xa,V:null});},n:function(a,b,c){c=Za(c);b=N(b);W(a,{name:b,fromWireType:function(d){return d},toWireType:function(d,e){return e},argPackAdvance:8,readValueFromPointer:rb(b,c),V:null});},e:function(a,b,c,d,e){b=N(b);-1===e&&(e=4294967295);e=Za(c);var f=k=>k;if(0===d){var g=32-8*c;f=k=>k<<g>>>g;}c=b.includes("unsigned")?function(k,m){return m>>>0}:function(k,m){return m};
W(a,{name:b,fromWireType:f,toWireType:c,argPackAdvance:8,readValueFromPointer:sb(b,e,0!==d),V:null});},b:function(a,b,c){function d(f){f>>=2;var g=E;return new e(ia,g[f+1],g[f])}var e=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][b];c=N(c);W(a,{name:c,fromWireType:d,argPackAdvance:8,readValueFromPointer:d},{ua:true});},o:function(a,b){b=N(b);var c="std::string"===b;W(a,{name:b,fromWireType:function(d){var e=E[d>>2],f=d+4;if(c)for(var g=f,k=0;k<=e;++k){var m=
f+k;if(k==e||0==A[m]){g=g?z(A,g,m-g):"";if(void 0===l)var l=g;else l+=String.fromCharCode(0),l+=g;g=m+1;}}else {l=Array(e);for(k=0;k<e;++k)l[k]=String.fromCharCode(A[f+k]);l=l.join("");}S(d);return l},toWireType:function(d,e){e instanceof ArrayBuffer&&(e=new Uint8Array(e));var f,g="string"==typeof e;g||e instanceof Uint8Array||e instanceof Uint8ClampedArray||e instanceof Int8Array||L("Cannot pass non-string to std::string");if(c&&g){var k=0;for(f=0;f<e.length;++f){var m=e.charCodeAt(f);127>=m?k++:2047>=
m?k+=2:55296<=m&&57343>=m?(k+=4,++f):k+=3;}f=k;}else f=e.length;k=Ib(4+f+1);m=k+4;E[k>>2]=f;if(c&&g){if(g=m,m=f+1,f=A,0<m){m=g+m-1;for(var l=0;l<e.length;++l){var n=e.charCodeAt(l);if(55296<=n&&57343>=n){var p=e.charCodeAt(++l);n=65536+((n&1023)<<10)|p&1023;}if(127>=n){if(g>=m)break;f[g++]=n;}else {if(2047>=n){if(g+1>=m)break;f[g++]=192|n>>6;}else {if(65535>=n){if(g+2>=m)break;f[g++]=224|n>>12;}else {if(g+3>=m)break;f[g++]=240|n>>18;f[g++]=128|n>>12&63;}f[g++]=128|n>>6&63;}f[g++]=128|n&63;}}f[g]=0;}}else if(g)for(g=
0;g<f;++g)l=e.charCodeAt(g),255<l&&(S(m),L("String has UTF-16 code units that do not fit in 8 bits")),A[m+g]=l;else for(g=0;g<f;++g)A[m+g]=e[g];null!==d&&d.push(S,k);return k},argPackAdvance:8,readValueFromPointer:Xa,V:function(d){S(d);}});},i:function(a,b,c){c=N(c);if(2===b){var d=tb;var e=ub;var f=vb;var g=()=>ka;var k=1;}else 4===b&&(d=wb,e=xb,f=yb,g=()=>E,k=2);W(a,{name:c,fromWireType:function(m){for(var l=E[m>>2],n=g(),p,r=m+4,u=0;u<=l;++u){var t=m+4+u*b;if(u==l||0==n[t>>k])r=d(r,t-r),void 0===
p?p=r:(p+=String.fromCharCode(0),p+=r),r=t+b;}S(m);return p},toWireType:function(m,l){"string"!=typeof l&&L("Cannot pass non-string to C++ string type "+c);var n=f(l),p=Ib(4+n+b);E[p>>2]=n>>k;e(l,p+4,n+b);null!==m&&m.push(S,p);return p},argPackAdvance:8,readValueFromPointer:Xa,V:function(m){S(m);}});},k:function(a,b,c,d,e,f){Va[a]={name:N(b),fa:Z(c,d),W:Z(e,f),ia:[]};},h:function(a,b,c,d,e,f,g,k,m,l){Va[a].ia.push({oa:N(b),ta:c,ra:Z(d,e),sa:f,za:g,ya:Z(k,m),Aa:l});},C:function(a,b){b=N(b);W(a,{va:true,name:b,
argPackAdvance:0,fromWireType:function(){},toWireType:function(){}});},s:function(a,b,c,d,e){a=Bb[a];b=M(b);c=Ab(c);var f=[];E[d>>2]=Ea(f);return a(b,c,f,e)},t:function(a,b,c,d){a=Bb[a];b=M(b);c=Ab(c);a(b,c,null,d);},g:qb,m:function(a,b){var c=Db(a,b),d=c[0];b=d.name+"_$"+c.slice(1).map(function(g){return g.name}).join("_")+"$";var e=Eb[b];if(void 0!==e)return e;var f=Array(a-1);e=Cb((g,k,m,l)=>{for(var n=0,p=0;p<a-1;++p)f[p]=c[p+1].readValueFromPointer(l+n),n+=c[p+1].argPackAdvance;g=g[k].apply(g,
f);for(p=0;p<a-1;++p)c[p+1].ma&&c[p+1].ma(f[p]);if(!d.va)return d.toWireType(m,g)});return Eb[b]=e},D:function(a){4<a&&(J[a].ga+=1);},r:function(a){var b=M(a);Wa(b);qb(a);},c:function(){x("");},x:function(a,b,c){A.copyWithin(a,b,b+c);},w:function(a){var b=A.length;a>>>=0;if(2147483648<a)return  false;for(var c=1;4>=c;c*=2){var d=b*(1+.2/c);d=Math.min(d,a+100663296);var e=Math;d=Math.max(a,d);e=e.min.call(e,2147483648,d+(65536-d%65536)%65536);a:{try{fa.grow(e-ia.byteLength+65535>>>16);na();var f=1;break a}catch(g){}f=
void 0;}if(f)return  true}return  false},z:function(){return 52},u:function(){return 70},y:function(a,b,c,d){for(var e=0,f=0;f<c;f++){var g=E[b>>2],k=E[b+4>>2];b+=8;for(var m=0;m<k;m++){var l=A[g+m],n=Fb[a];0===l||10===l?((1===a?ea:v)(z(n,0)),n.length=0):n.push(l);}e+=k;}E[d>>2]=e;return 0}};
(function(){function a(e){h.asm=e.exports;fa=h.asm.E;na();oa=h.asm.J;qa.unshift(h.asm.F);F--;h.monitorRunDependencies&&h.monitorRunDependencies(F);0==F&&(G&&(e=G,G=null,e()));}function b(e){a(e.instance);}function c(e){return ya().then(function(f){return WebAssembly.instantiate(f,d)}).then(function(f){return f}).then(e,function(f){v("failed to asynchronously prepare wasm: "+f);x(f);})}var d={a:Jb};F++;h.monitorRunDependencies&&h.monitorRunDependencies(F);if(h.instantiateWasm)try{return h.instantiateWasm(d,
a)}catch(e){v("Module.instantiateWasm callback failed with error: "+e),ca(e);}(function(){return w||"function"!=typeof WebAssembly.instantiateStreaming||ua(H)||"function"!=typeof fetch?c(b):fetch(H,{credentials:"same-origin"}).then(function(e){return WebAssembly.instantiateStreaming(e,d).then(b,function(f){v("wasm streaming compile failed: "+f);v("falling back to ArrayBuffer instantiation");return c(b)})})})().catch(ca);return {}})();
h.___wasm_call_ctors=function(){return (h.___wasm_call_ctors=h.asm.F).apply(null,arguments)};var Ka=h.___getTypeName=function(){return (Ka=h.___getTypeName=h.asm.G).apply(null,arguments)};h.__embind_initialize_bindings=function(){return (h.__embind_initialize_bindings=h.asm.H).apply(null,arguments)};var Ib=h._malloc=function(){return (Ib=h._malloc=h.asm.I).apply(null,arguments)},S=h._free=function(){return (S=h._free=h.asm.K).apply(null,arguments)};
h.dynCall_jiji=function(){return (h.dynCall_jiji=h.asm.L).apply(null,arguments)};var Kb;G=function Lb(){Kb||Mb();Kb||(G=Lb);};
function Mb(){function a(){if(!Kb&&(Kb=true,h.calledRun=true,!ha)){za(qa);aa(h);if(h.onRuntimeInitialized)h.onRuntimeInitialized();if(h.postRun)for("function"==typeof h.postRun&&(h.postRun=[h.postRun]);h.postRun.length;){var b=h.postRun.shift();ra.unshift(b);}za(ra);}}if(!(0<F)){if(h.preRun)for("function"==typeof h.preRun&&(h.preRun=[h.preRun]);h.preRun.length;)sa();za(pa);0<F||(h.setStatus?(h.setStatus("Running..."),setTimeout(function(){setTimeout(function(){h.setStatus("");},1);a();},1)):a());}}
if(h.preInit)for("function"==typeof h.preInit&&(h.preInit=[h.preInit]);0<h.preInit.length;)h.preInit.pop()();Mb();


  return loadYoga.ready
}
);
})();

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @generated by enums.py

let Align = /*#__PURE__*/function (Align) {
  Align[Align["Auto"] = 0] = "Auto";
  Align[Align["FlexStart"] = 1] = "FlexStart";
  Align[Align["Center"] = 2] = "Center";
  Align[Align["FlexEnd"] = 3] = "FlexEnd";
  Align[Align["Stretch"] = 4] = "Stretch";
  Align[Align["Baseline"] = 5] = "Baseline";
  Align[Align["SpaceBetween"] = 6] = "SpaceBetween";
  Align[Align["SpaceAround"] = 7] = "SpaceAround";
  Align[Align["SpaceEvenly"] = 8] = "SpaceEvenly";
  return Align;
}({});
let BoxSizing = /*#__PURE__*/function (BoxSizing) {
  BoxSizing[BoxSizing["BorderBox"] = 0] = "BorderBox";
  BoxSizing[BoxSizing["ContentBox"] = 1] = "ContentBox";
  return BoxSizing;
}({});
let Dimension = /*#__PURE__*/function (Dimension) {
  Dimension[Dimension["Width"] = 0] = "Width";
  Dimension[Dimension["Height"] = 1] = "Height";
  return Dimension;
}({});
let Direction = /*#__PURE__*/function (Direction) {
  Direction[Direction["Inherit"] = 0] = "Inherit";
  Direction[Direction["LTR"] = 1] = "LTR";
  Direction[Direction["RTL"] = 2] = "RTL";
  return Direction;
}({});
let Display = /*#__PURE__*/function (Display) {
  Display[Display["Flex"] = 0] = "Flex";
  Display[Display["None"] = 1] = "None";
  Display[Display["Contents"] = 2] = "Contents";
  return Display;
}({});
let Edge = /*#__PURE__*/function (Edge) {
  Edge[Edge["Left"] = 0] = "Left";
  Edge[Edge["Top"] = 1] = "Top";
  Edge[Edge["Right"] = 2] = "Right";
  Edge[Edge["Bottom"] = 3] = "Bottom";
  Edge[Edge["Start"] = 4] = "Start";
  Edge[Edge["End"] = 5] = "End";
  Edge[Edge["Horizontal"] = 6] = "Horizontal";
  Edge[Edge["Vertical"] = 7] = "Vertical";
  Edge[Edge["All"] = 8] = "All";
  return Edge;
}({});
let Errata = /*#__PURE__*/function (Errata) {
  Errata[Errata["None"] = 0] = "None";
  Errata[Errata["StretchFlexBasis"] = 1] = "StretchFlexBasis";
  Errata[Errata["AbsolutePositionWithoutInsetsExcludesPadding"] = 2] = "AbsolutePositionWithoutInsetsExcludesPadding";
  Errata[Errata["AbsolutePercentAgainstInnerSize"] = 4] = "AbsolutePercentAgainstInnerSize";
  Errata[Errata["All"] = 2147483647] = "All";
  Errata[Errata["Classic"] = 2147483646] = "Classic";
  return Errata;
}({});
let ExperimentalFeature = /*#__PURE__*/function (ExperimentalFeature) {
  ExperimentalFeature[ExperimentalFeature["WebFlexBasis"] = 0] = "WebFlexBasis";
  return ExperimentalFeature;
}({});
let FlexDirection = /*#__PURE__*/function (FlexDirection) {
  FlexDirection[FlexDirection["Column"] = 0] = "Column";
  FlexDirection[FlexDirection["ColumnReverse"] = 1] = "ColumnReverse";
  FlexDirection[FlexDirection["Row"] = 2] = "Row";
  FlexDirection[FlexDirection["RowReverse"] = 3] = "RowReverse";
  return FlexDirection;
}({});
let Gutter = /*#__PURE__*/function (Gutter) {
  Gutter[Gutter["Column"] = 0] = "Column";
  Gutter[Gutter["Row"] = 1] = "Row";
  Gutter[Gutter["All"] = 2] = "All";
  return Gutter;
}({});
let Justify = /*#__PURE__*/function (Justify) {
  Justify[Justify["FlexStart"] = 0] = "FlexStart";
  Justify[Justify["Center"] = 1] = "Center";
  Justify[Justify["FlexEnd"] = 2] = "FlexEnd";
  Justify[Justify["SpaceBetween"] = 3] = "SpaceBetween";
  Justify[Justify["SpaceAround"] = 4] = "SpaceAround";
  Justify[Justify["SpaceEvenly"] = 5] = "SpaceEvenly";
  return Justify;
}({});
let LogLevel = /*#__PURE__*/function (LogLevel) {
  LogLevel[LogLevel["Error"] = 0] = "Error";
  LogLevel[LogLevel["Warn"] = 1] = "Warn";
  LogLevel[LogLevel["Info"] = 2] = "Info";
  LogLevel[LogLevel["Debug"] = 3] = "Debug";
  LogLevel[LogLevel["Verbose"] = 4] = "Verbose";
  LogLevel[LogLevel["Fatal"] = 5] = "Fatal";
  return LogLevel;
}({});
let MeasureMode = /*#__PURE__*/function (MeasureMode) {
  MeasureMode[MeasureMode["Undefined"] = 0] = "Undefined";
  MeasureMode[MeasureMode["Exactly"] = 1] = "Exactly";
  MeasureMode[MeasureMode["AtMost"] = 2] = "AtMost";
  return MeasureMode;
}({});
let NodeType = /*#__PURE__*/function (NodeType) {
  NodeType[NodeType["Default"] = 0] = "Default";
  NodeType[NodeType["Text"] = 1] = "Text";
  return NodeType;
}({});
let Overflow = /*#__PURE__*/function (Overflow) {
  Overflow[Overflow["Visible"] = 0] = "Visible";
  Overflow[Overflow["Hidden"] = 1] = "Hidden";
  Overflow[Overflow["Scroll"] = 2] = "Scroll";
  return Overflow;
}({});
let PositionType = /*#__PURE__*/function (PositionType) {
  PositionType[PositionType["Static"] = 0] = "Static";
  PositionType[PositionType["Relative"] = 1] = "Relative";
  PositionType[PositionType["Absolute"] = 2] = "Absolute";
  return PositionType;
}({});
let Unit = /*#__PURE__*/function (Unit) {
  Unit[Unit["Undefined"] = 0] = "Undefined";
  Unit[Unit["Point"] = 1] = "Point";
  Unit[Unit["Percent"] = 2] = "Percent";
  Unit[Unit["Auto"] = 3] = "Auto";
  return Unit;
}({});
let Wrap = /*#__PURE__*/function (Wrap) {
  Wrap[Wrap["NoWrap"] = 0] = "NoWrap";
  Wrap[Wrap["Wrap"] = 1] = "Wrap";
  Wrap[Wrap["WrapReverse"] = 2] = "WrapReverse";
  return Wrap;
}({});
const constants = {
  ALIGN_AUTO: Align.Auto,
  ALIGN_FLEX_START: Align.FlexStart,
  ALIGN_CENTER: Align.Center,
  ALIGN_FLEX_END: Align.FlexEnd,
  ALIGN_STRETCH: Align.Stretch,
  ALIGN_BASELINE: Align.Baseline,
  ALIGN_SPACE_BETWEEN: Align.SpaceBetween,
  ALIGN_SPACE_AROUND: Align.SpaceAround,
  ALIGN_SPACE_EVENLY: Align.SpaceEvenly,
  BOX_SIZING_BORDER_BOX: BoxSizing.BorderBox,
  BOX_SIZING_CONTENT_BOX: BoxSizing.ContentBox,
  DIMENSION_WIDTH: Dimension.Width,
  DIMENSION_HEIGHT: Dimension.Height,
  DIRECTION_INHERIT: Direction.Inherit,
  DIRECTION_LTR: Direction.LTR,
  DIRECTION_RTL: Direction.RTL,
  DISPLAY_FLEX: Display.Flex,
  DISPLAY_NONE: Display.None,
  DISPLAY_CONTENTS: Display.Contents,
  EDGE_LEFT: Edge.Left,
  EDGE_TOP: Edge.Top,
  EDGE_RIGHT: Edge.Right,
  EDGE_BOTTOM: Edge.Bottom,
  EDGE_START: Edge.Start,
  EDGE_END: Edge.End,
  EDGE_HORIZONTAL: Edge.Horizontal,
  EDGE_VERTICAL: Edge.Vertical,
  EDGE_ALL: Edge.All,
  ERRATA_NONE: Errata.None,
  ERRATA_STRETCH_FLEX_BASIS: Errata.StretchFlexBasis,
  ERRATA_ABSOLUTE_POSITION_WITHOUT_INSETS_EXCLUDES_PADDING: Errata.AbsolutePositionWithoutInsetsExcludesPadding,
  ERRATA_ABSOLUTE_PERCENT_AGAINST_INNER_SIZE: Errata.AbsolutePercentAgainstInnerSize,
  ERRATA_ALL: Errata.All,
  ERRATA_CLASSIC: Errata.Classic,
  EXPERIMENTAL_FEATURE_WEB_FLEX_BASIS: ExperimentalFeature.WebFlexBasis,
  FLEX_DIRECTION_COLUMN: FlexDirection.Column,
  FLEX_DIRECTION_COLUMN_REVERSE: FlexDirection.ColumnReverse,
  FLEX_DIRECTION_ROW: FlexDirection.Row,
  FLEX_DIRECTION_ROW_REVERSE: FlexDirection.RowReverse,
  GUTTER_COLUMN: Gutter.Column,
  GUTTER_ROW: Gutter.Row,
  GUTTER_ALL: Gutter.All,
  JUSTIFY_FLEX_START: Justify.FlexStart,
  JUSTIFY_CENTER: Justify.Center,
  JUSTIFY_FLEX_END: Justify.FlexEnd,
  JUSTIFY_SPACE_BETWEEN: Justify.SpaceBetween,
  JUSTIFY_SPACE_AROUND: Justify.SpaceAround,
  JUSTIFY_SPACE_EVENLY: Justify.SpaceEvenly,
  LOG_LEVEL_ERROR: LogLevel.Error,
  LOG_LEVEL_WARN: LogLevel.Warn,
  LOG_LEVEL_INFO: LogLevel.Info,
  LOG_LEVEL_DEBUG: LogLevel.Debug,
  LOG_LEVEL_VERBOSE: LogLevel.Verbose,
  LOG_LEVEL_FATAL: LogLevel.Fatal,
  MEASURE_MODE_UNDEFINED: MeasureMode.Undefined,
  MEASURE_MODE_EXACTLY: MeasureMode.Exactly,
  MEASURE_MODE_AT_MOST: MeasureMode.AtMost,
  NODE_TYPE_DEFAULT: NodeType.Default,
  NODE_TYPE_TEXT: NodeType.Text,
  OVERFLOW_VISIBLE: Overflow.Visible,
  OVERFLOW_HIDDEN: Overflow.Hidden,
  OVERFLOW_SCROLL: Overflow.Scroll,
  POSITION_TYPE_STATIC: PositionType.Static,
  POSITION_TYPE_RELATIVE: PositionType.Relative,
  POSITION_TYPE_ABSOLUTE: PositionType.Absolute,
  UNIT_UNDEFINED: Unit.Undefined,
  UNIT_POINT: Unit.Point,
  UNIT_PERCENT: Unit.Percent,
  UNIT_AUTO: Unit.Auto,
  WRAP_NO_WRAP: Wrap.NoWrap,
  WRAP_WRAP: Wrap.Wrap,
  WRAP_WRAP_REVERSE: Wrap.WrapReverse
};

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapAssembly(lib) {
  function patch(prototype, name, fn) {
    const original = prototype[name];
    prototype[name] = function () {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      return fn.call(this, original, ...args);
    };
  }
  for (const fnName of ['setPosition', 'setMargin', 'setFlexBasis', 'setWidth', 'setHeight', 'setMinWidth', 'setMinHeight', 'setMaxWidth', 'setMaxHeight', 'setPadding', 'setGap']) {
    const methods = {
      [Unit.Point]: lib.Node.prototype[fnName],
      [Unit.Percent]: lib.Node.prototype[`${fnName}Percent`],
      [Unit.Auto]: lib.Node.prototype[`${fnName}Auto`]
    };
    patch(lib.Node.prototype, fnName, function (original) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      // We patch all these functions to add support for the following calls:
      // .setWidth(100) / .setWidth("100%") / .setWidth(.getWidth()) / .setWidth("auto")

      const value = args.pop();
      let unit, asNumber;
      if (value === 'auto') {
        unit = Unit.Auto;
        asNumber = undefined;
      } else if (typeof value === 'object') {
        unit = value.unit;
        asNumber = value.valueOf();
      } else {
        unit = typeof value === 'string' && value.endsWith('%') ? Unit.Percent : Unit.Point;
        asNumber = parseFloat(value);
        if (value !== undefined && !Number.isNaN(value) && Number.isNaN(asNumber)) {
          throw new Error(`Invalid value ${value} for ${fnName}`);
        }
      }
      if (!methods[unit]) throw new Error(`Failed to execute "${fnName}": Unsupported unit '${value}'`);
      if (asNumber !== undefined) {
        return methods[unit].call(this, ...args, asNumber);
      } else {
        return methods[unit].call(this, ...args);
      }
    });
  }
  function wrapMeasureFunction(measureFunction) {
    return lib.MeasureCallback.implement({
      measure: function () {
        const {
          width,
          height
        } = measureFunction(...arguments);
        return {
          width: width ?? NaN,
          height: height ?? NaN
        };
      }
    });
  }
  patch(lib.Node.prototype, 'setMeasureFunc', function (original, measureFunc) {
    // This patch is just a convenience patch, since it helps write more
    // idiomatic source code (such as .setMeasureFunc(null))
    if (measureFunc) {
      return original.call(this, wrapMeasureFunction(measureFunc));
    } else {
      return this.unsetMeasureFunc();
    }
  });
  function wrapDirtiedFunc(dirtiedFunction) {
    return lib.DirtiedCallback.implement({
      dirtied: dirtiedFunction
    });
  }
  patch(lib.Node.prototype, 'setDirtiedFunc', function (original, dirtiedFunc) {
    original.call(this, wrapDirtiedFunc(dirtiedFunc));
  });
  patch(lib.Config.prototype, 'free', function () {
    // Since we handle the memory allocation ourselves (via lib.Config.create),
    // we also need to handle the deallocation
    lib.Config.destroy(this);
  });
  patch(lib.Node, 'create', (_, config) => {
    // We decide the constructor we want to call depending on the parameters
    return config ? lib.Node.createWithConfig(config) : lib.Node.createDefault();
  });
  patch(lib.Node.prototype, 'free', function () {
    // Since we handle the memory allocation ourselves (via lib.Node.create),
    // we also need to handle the deallocation
    lib.Node.destroy(this);
  });
  patch(lib.Node.prototype, 'freeRecursive', function () {
    for (let t = 0, T = this.getChildCount(); t < T; ++t) {
      this.getChild(0).freeRecursive();
    }
    this.free();
  });
  patch(lib.Node.prototype, 'calculateLayout', function (original) {
    let width = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : NaN;
    let height = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : NaN;
    let direction = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Direction.LTR;
    // Just a small patch to add support for the function default parameters
    return original.call(this, width, height, direction);
  });
  return {
    Config: lib.Config,
    Node: lib.Node,
    ...constants
  };
}

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

const Yoga = wrapAssembly(await loadYoga());

/**
 * `dc_graph.flexbox_layout` lays out nodes in accordance with the
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout/Basic_Concepts_of_Flexbox flexbox layout algorithm}.
 * Nodes fit into a containment hierarchy based on their keys; edges do not affect the layout but
 * are drawn from node to node.
 *
 * Since the flexbox algorithm is not ordinarily available in SVG, this class uses the
 * {@link https://github.com/facebook/yoga yoga-layout} package.
 *
 * Unlike conventional graph layout, where positions are determined based on a few attributes and
 * the topological structure of the eedges, flexbox layout is determined based on the node hierarchy
 * and a large number of attributes on the nodes. See yoga-layout's
 * {@link https://github.com/facebook/yoga#supported-attributes Supported Attributes}
 * for a list of those attributes, and see below to understand how the hierarchy is inferred from
 * node keys.
 *
 * `flexbox_layout` does not require all internal nodes to be specified. The node keys are parsed as
 * "addresses" or paths (arrays of strings) and the tree is built from those paths. Wherever a
 * node's path terminates is where that node's data will be applied.
 *
 * Since flexbox supports a vast number of attributes, we don't attempt to create accessors for
 * every one. Instead, any attributes in the node data are copied which match the names of flexbox
 * attributes.
 *
 * @class flexbox_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.flexbox_layout}
 */
/**
 * Flexbox layout for dc.graph.js
 * @module flexbox_layout
 */


function flexboxLayout(id, _options) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');

    let _graph, _tree, _wnodes;
    // like d3.nest but address can be of arbitrary (and different) length
    // probably less efficient too
    function add_node(adhead, adtail, n, tree) {
        tree.address = adhead.slice();
        tree.children = tree.children || {};
        if (!adtail.length) {
            tree.node = n;
            return;
        }
        const t = tree.children[adtail[0]] = tree.children[adtail[0]] || {};
        adhead.push(adtail.shift());
        add_node(adhead, adtail, n, t);
    }
    function all_keys(tree) {
        const key = _engine.addressToKey()(tree.address);
        return Array.prototype.concat.apply(
            [key],
            Object.keys(tree.children || {}).map(k => all_keys(tree.children[k])),
        );
    }
    function data(graph, nodes) {
        _graph = graph;
        _tree = {address: [], children: {}};
        nodes.forEach(n => {
            const ad = _engine.keyToAddress()(n.dcg_nodeKey);
            add_node([], ad, n, _tree);
        });
        all_keys(_tree);
        _wnodes = nodes;
    }
    function ensure_inner_nodes(tree) {
        if (!tree.node)
            tree.node = {
                dcg_nodeKey: tree.address.length ? tree.address[tree.address.length-1] : null,
            };
        Object.values(tree.children).forEach(ensure_inner_nodes);
    }
    function set_yoga_attr(flexnode, attr, value) {
        const fname = `set${attr.charAt(0).toUpperCase()}${attr.slice(1)}`;
        if (typeof flexnode[fname] !== 'function')
            throw new Error(`Could not set yoga attr "${attr}" (${fname})`);

        // Map string values to yoga constants
        const constantMaps = {
            alignItems: {
                stretch: Yoga.ALIGN_STRETCH,
                'flex-start': Yoga.ALIGN_FLEX_START,
                center: Yoga.ALIGN_CENTER,
                'flex-end': Yoga.ALIGN_FLEX_END,
                baseline: Yoga.ALIGN_BASELINE,
            },
            alignSelf: {
                stretch: Yoga.ALIGN_STRETCH,
                'flex-start': Yoga.ALIGN_FLEX_START,
                center: Yoga.ALIGN_CENTER,
                'flex-end': Yoga.ALIGN_FLEX_END,
                baseline: Yoga.ALIGN_BASELINE,
            },
            alignContent: {
                'flex-start': Yoga.ALIGN_FLEX_START,
                'flex-end': Yoga.ALIGN_FLEX_END,
                stretch: Yoga.ALIGN_STRETCH,
                center: Yoga.ALIGN_CENTER,
                'space-between': Yoga.ALIGN_SPACE_BETWEEN,
                'space-around': Yoga.ALIGN_SPACE_AROUND,
            },
            flexDirection: {
                column: Yoga.FLEX_DIRECTION_COLUMN,
                'column-reverse': Yoga.FLEX_DIRECTION_COLUMN_REVERSE,
                row: Yoga.FLEX_DIRECTION_ROW,
                'row-reverse': Yoga.FLEX_DIRECTION_ROW_REVERSE,
            },
            justifyContent: {
                'flex-start': Yoga.JUSTIFY_FLEX_START,
                center: Yoga.JUSTIFY_CENTER,
                'flex-end': Yoga.JUSTIFY_FLEX_END,
                'space-between': Yoga.JUSTIFY_SPACE_BETWEEN,
                'space-around': Yoga.JUSTIFY_SPACE_AROUND,
                'space-evenly': Yoga.JUSTIFY_SPACE_EVENLY,
            },
        };

        if (constantMaps[attr] && constantMaps[attr][value])
            value = constantMaps[attr][value];

        // Handle attributes that need an edge parameter (padding, margin, border, position)
        if (
            attr === 'padding' || attr === 'margin' || attr === 'border' || attr.endsWith('Padding')
            || attr.endsWith('Margin')
        ) {
            // For generic padding/margin, apply to all edges
            flexnode[fname](Yoga.EDGE_ALL, value);
        } else if (attr === 'width') {
            flexnode.setWidth(value);
        } else if (attr === 'height') {
            flexnode.setHeight(value);
        } else {
            flexnode[fname](value);
        }
    }
    function get_yoga_attr(flexnode, attr) {
        const fname = `getComputed${attr.charAt(0).toUpperCase()}${attr.slice(1)}`;
        if (typeof flexnode[fname] !== 'function')
            throw new Error(`Could not get yoga attr "${attr}" (${fname})`);
        return flexnode[fname]();
    }
    const internal_attrs = [
            'sort',
            'order',
            'dcg_nodeKey',
            'dcg_nodeParentCluster',
            'shape',
            'abstract',
            'rx',
            'ry',
            'x',
            'y',
            'z',
            'nodeOutlineClip',
        ],
        skip_on_parents = ['width', 'height'];
    function create_flextree(attrs, tree) {
        // Create yoga layout node
        const flexnode = new Yoga.Node();
        const attrs2 = Object.assign({}, attrs);
        const isParent = Object.keys(tree.children).length;
        if (tree.node)
            Object.assign(attrs, tree.node);
        for (const attr in attrs) {
            if (internal_attrs.includes(attr))
                continue;
            if (isParent && skip_on_parents.includes(attr))
                continue;
            let value = attrs[attr];
            if (typeof value === 'function')
                value = value(tree.node);
            // Set yoga layout attribute
            set_yoga_attr(flexnode, attr, value);
        }
        if (isParent) {
            const children = Object.values(tree.children)
                .sort(attrs.sort)
                .map(c => c.address[c.address.length-1])
                .map(key => create_flextree(Object.assign({}, attrs2), tree.children[key]));
            // Insert children into yoga layout node
            children.forEach((child, i) => {
                flexnode.insertChild(child, i);
            });
        }
        tree.flexnode = flexnode;
        return flexnode;
    }
    function apply_layout(offset, tree) {
        // Get layout values from yoga
        const left = get_yoga_attr(tree.flexnode, 'left');
        const width = get_yoga_attr(tree.flexnode, 'width');
        const top = get_yoga_attr(tree.flexnode, 'top');
        const height = get_yoga_attr(tree.flexnode, 'height');
        tree.node.x = offset.x+left+width/2;
        tree.node.y = offset.y+top+height/2;
        Object.keys(tree.children)
            .map(key => tree.children[key])
            .forEach(child => {
                apply_layout({x: offset.x+left, y: offset.y+top}, child);
            });
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch.call(event, null, wnodes, wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})));
    }
    function start() {
        const defaults = {
            sort(a, b) {
                return ascending$1(a.node.dcg_nodeKey, b.node.dcg_nodeKey);
            },
        };
        ensure_inner_nodes(_tree);
        const flexTree = create_flextree(defaults, _tree);
        // Set root container dimensions
        set_yoga_attr(flexTree, 'width', _graph.width);
        set_yoga_attr(flexTree, 'height', _graph.height);
        if (_engine.logStuff())
            console.log(JSON.stringify(flexTree, null, 2));
        // Use yoga-layout for flexbox computation
        flexTree.calculateLayout();
        apply_layout({x: 0, y: 0}, _tree);
        dispatchState(_wnodes, [], 'end');
    }

    // currently dc.graph populates the "cola" (really "layout") member with the attributes
    // needed for layout and does not pass in the original data. flexbox has a huge number of attributes
    // and it might be more appropriate for it to look at the original data.
    // (Especially because it also computes some attributes based on data.)
    const supportedAttributes = [
        'width',
        'height', // positive number
        'minWidth',
        'minHeight', // positive number
        'maxWidth',
        'maxHeight', // positive number
        'left',
        'right',
        'top',
        'bottom', // number
        'margin',
        'marginLeft',
        'marginRight',
        'marginTop',
        'marginBottom', // number
        'padding',
        'paddingLeft',
        'paddingRight',
        'paddingTop',
        'paddingBottom', // positive number
        'borderWidth',
        'borderLeftWidth',
        'borderRightWidth',
        'borderTopWidth',
        'borderBottomWidth', // positive number
        'flexDirection', // 'column', 'row'
        'justifyContent', // 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'
        'alignItems',
        'alignSelf', // 'flex-start', 'center', 'flex-end', 'stretch'
        'flex', // positive number
        'flexWrap', // 'wrap', 'nowrap'
        'position', // 'relative', 'absolute'
    ];

    const _engine = {
        layoutAlgorithm() {
            return 'cola';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            return this;
        },
        data(graph, nodes) {
            data(graph, nodes);
        },
        start() {
            start();
        },
        stop() {
        },
        optionNames() {
            return [];
        },
        populateLayoutNode(n1, n) {
            ['sort', 'order'].concat(supportedAttributes).forEach(attr => {
                if (n.orig.value[attr])
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge() {},
        /**
         * This function constructs a node key string from an "address". An address is an array of
         * strings identifying the path from the root to the node.
         *
         * By default, it joins the address with commas.
         * @method addressToKey
         * @memberof dc_graph.flexbox_layout
         * @instance
         * @param {Function} [addressToKey = function(ad) { return ad.join(','); }]
         * @return {Function}
         * @return {dc_graph.flexbox_layout}
         */
        addressToKey: property(ad => ad.join(',')),
        /**
         * This function constructs an "address" from a node key string. An address is an array of
         * strings identifying the path from the root to the node.
         *
         * By default, it splits the key by its commas.
         * @method keyToAddress
         * @memberof dc_graph.flexbox_layout
         * @instance
         * @param {Function} [keyToAddress = function(nid) { return nid.split(','); }]
         * @return {Function}
         * @return {dc_graph.flexbox_layout}
         */
        keyToAddress: property(nid => nid.split(',')),
        yogaConstants() {
            // Direct access to yoga constants
            return Yoga;
        },
        logStuff: property(false),
    };
    return _engine;
}

// No external scripts needed - yoga-layout is imported as ES6 module
flexboxLayout.scripts = [];

var EOL = {},
    EOF = {},
    QUOTE = 34,
    NEWLINE = 10,
    RETURN = 13;

function objectConverter(columns) {
  return new Function("d", "return {" + columns.map(function(name, i) {
    return JSON.stringify(name) + ": d[" + i + "]";
  }).join(",") + "}");
}

function customConverter(columns, f) {
  var object = objectConverter(columns);
  return function(row, i) {
    return f(object(row), i, columns);
  };
}

// Compute unique columns in order of discovery.
function inferColumns(rows) {
  var columnSet = Object.create(null),
      columns = [];

  rows.forEach(function(row) {
    for (var column in row) {
      if (!(column in columnSet)) {
        columns.push(columnSet[column] = column);
      }
    }
  });

  return columns;
}

function dsvFormat(delimiter) {
  var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
      DELIMITER = delimiter.charCodeAt(0);

  function parse(text, f) {
    var convert, columns, rows = parseRows(text, function(row, i) {
      if (convert) return convert(row, i - 1);
      columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
    });
    rows.columns = columns || [];
    return rows;
  }

  function parseRows(text, f) {
    var rows = [], // output rows
        N = text.length,
        I = 0, // current character index
        n = 0, // current line number
        t, // current token
        eof = N <= 0, // current token followed by EOF?
        eol = false; // current token followed by EOL?

    // Strip the trailing newline.
    if (text.charCodeAt(N - 1) === NEWLINE) --N;
    if (text.charCodeAt(N - 1) === RETURN) --N;

    function token() {
      if (eof) return EOF;
      if (eol) return eol = false, EOL;

      // Unescape quotes.
      var i, j = I, c;
      if (text.charCodeAt(j) === QUOTE) {
        while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
        if ((i = I) >= N) eof = true;
        else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        return text.slice(j + 1, i - 1).replace(/""/g, "\"");
      }

      // Find next delimiter or newline.
      while (I < N) {
        if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        else if (c !== DELIMITER) continue;
        return text.slice(j, i);
      }

      // Return last token before EOF.
      return eof = true, text.slice(j, N);
    }

    while ((t = token()) !== EOF) {
      var row = [];
      while (t !== EOL && t !== EOF) row.push(t), t = token();
      if (f && (row = f(row, n++)) == null) continue;
      rows.push(row);
    }

    return rows;
  }

  function format(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
      return columns.map(function(column) {
        return formatValue(row[column]);
      }).join(delimiter);
    })).join("\n");
  }

  function formatRows(rows) {
    return rows.map(formatRow).join("\n");
  }

  function formatRow(row) {
    return row.map(formatValue).join(delimiter);
  }

  function formatValue(text) {
    return text == null ? ""
        : reFormat.test(text += "") ? "\"" + text.replace(/"/g, "\"\"") + "\""
        : text;
  }

  return {
    parse: parse,
    parseRows: parseRows,
    format: format,
    formatRows: formatRows
  };
}

var csv$1 = dsvFormat(",");

var csvParse = csv$1.parse;

dsvFormat("\t");

function responseText(response) {
  if (!response.ok) throw new Error(response.status + " " + response.statusText);
  return response.text();
}

function text(input, init) {
  return fetch(input, init).then(responseText);
}

function dsvParse(parse) {
  return function(input, init, row) {
    if (arguments.length === 2 && typeof init === "function") row = init, init = undefined;
    return text(input, init).then(function(response) {
      return parse(response, row);
    });
  };
}

function dsv(delimiter, input, init, row) {
  var format = dsvFormat(delimiter);
  return text(input, init).then(function(response) {
    return format.parse(response, row);
  });
}

var csv = dsvParse(csvParse);

function responseJson(response) {
  if (!response.ok) throw new Error(response.status + " " + response.statusText);
  if (response.status === 204 || response.status === 205) return;
  return response.json();
}

function json(input, init) {
  return fetch(input, init).then(responseJson);
}

/**
 * Graphviz layout for dc.graph.js
 * @module graphviz_layout
 */


/**
 * `graphvizLayout` is an adaptor for viz.js (graphviz) layouts in dc.graph.js
 *
 * In addition to the below layout attributes, `graphvizLayout` also implements the attributes from
 * {@link graphvizAttrs graphviz_attrs}
 * @param {String} [id=uuid()] - Unique identifier
 * @param {String} [layout] - Layout algorithm
 * @param {String} [server] - Server URL
 * @return {Object} graphviz layout engine
 */
function graphvizLayout(id, layout, server) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');
    let _dotInput, _dotString;

    function encode_name(name) {
        return name.replace(/^%/, '&#37;');
    }
    function decode_name(name) {
        return name.replace(/^&#37;/, '%');
    }
    function stringize_property(prop, value) {
        return [prop, `"${value}"`].join('=');
    }
    function stringize_properties(props) {
        return `[${props.join(', ')}]`;
    }
    function data(nodes, edges, clusters) {
        if (_dotInput) {
            _dotString = _dotInput;
            return;
        }
        let lines = [];
        const directed = layout !== 'neato';
        lines.push(`${directed ? 'digraph' : 'graph'} g {`);
        lines.push(`graph ${
            stringize_properties([
                stringize_property('nodesep', graphviz.nodesep()/72),
                stringize_property('ranksep', graphviz.ranksep()/72),
                stringize_property('rankdir', graphviz.rankdir()),
            ])
        }`);
        const cluster_nodes = {};
        nodes.forEach(n => {
            const cl = n.dcg_nodeParentCluster;
            if (cl) {
                cluster_nodes[cl] = cluster_nodes[cl] || [];
                cluster_nodes[cl].push(n.dcg_nodeKey);
            }
        });
        const cluster_children = {}, tops = [];
        clusters.forEach(c => {
            const p = c.dcg_clusterParent;
            if (p) {
                cluster_children[p] = cluster_children[p] || [];
                cluster_children[p].push(c.dcg_clusterKey);
            } else tops.push(c.dcg_clusterKey);
        });

        function print_subgraph(i, c) {
            const indent = ' '.repeat(i*2);
            lines.push(`${indent}subgraph "${c}" {`);
            if (cluster_children[c])
                cluster_children[c].forEach(print_subgraph.bind(null, i+1));
            if (cluster_nodes[c])
                lines.push(`${indent}  ${cluster_nodes[c].map(s => JSON.stringify(s)).join(' ')}`);
            lines.push(`${indent}}`);
        }
        tops.forEach(print_subgraph.bind(null, 1));

        lines = lines.concat(nodes.map(v => {
            const props = [
                stringize_property('width', v.width/72),
                stringize_property('height', v.height/72),
                stringize_property('fixedsize', 'shape'),
                stringize_property('shape', v.abstract.shape),
            ];
            if (v.dcg_nodeFixed)
                props.push(stringize_property(
                    'pos',
                    [
                        v.dcg_nodeFixed.x,
                        1000-v.dcg_nodeFixed.y,
                    ].join(','),
                ));
            return `  "${encode_name(v.dcg_nodeKey)}" ${stringize_properties(props)}`;
        }));
        lines = lines.concat(
            edges.map(e =>
                `  "${encode_name(e.dcg_edgeSource)}${directed ? '" -> "' : '" -- "'}${
                    encode_name(e.dcg_edgeTarget)
                }" ${
                    stringize_properties([
                        stringize_property('id', encode_name(e.dcg_edgeKey)),
                        stringize_property('arrowhead', 'none'),
                        stringize_property('arrowtail', 'none'),
                    ])
                }`
            ),
        );
        lines.push('}');
        lines.push('');
        _dotString = lines.join('\n');
    }

    function process_layout_result(result) {
        _dispatch.call('start');
        const bb = result.bb.split(',').map(x => +x);
        const nodes = (result.objects || []).filter(n => n.pos // remove non-nodes like clusters
        ).map(n => {
            const pos = n.pos.split(',');
            if (isNaN(pos[0]) || isNaN(pos[1])) {
                console.warn('got a NaN position from graphviz');
                pos[0] = pos[1] = 0;
            }
            return {
                dcg_nodeKey: decode_name(n.name),
                x: +pos[0],
                y: bb[3]-pos[1],
            };
        });
        const clusters = (result.objects || []).filter(n => /^cluster/.test(n.name) && n.bb);
        clusters.forEach(c => {
            c.dcg_clusterKey = c.name;

            // gv: llx, lly, urx, ury, up-positive
            const cbb = c.bb.split(',').map(s => +s);
            c.bounds = {left: cbb[0], top: bb[3]-cbb[3], right: cbb[2], bottom: bb[3]-cbb[1]};
        });
        const edges = (result.edges || []).map(e => {
            const e2 = {
                dcg_edgeKey: decode_name(e.id || `n${e._gvid}`),
            };
            if (e._draw_) {
                const directive = e._draw_.find(d => d.op && d.points);
                e2.points = directive.points.map(p => ({x: p[0], y: bb[3]-p[1]}));
            }
            return e2;
        });
        _dispatch.call('end', null, nodes, edges, clusters);
        return {nodes, edges, clusters};
    }

    async function start() {
        try {
            let result;
            if (server) {
                result = await json(server)
                    .header('Content-type', 'application/x-www-form-urlencoded')
                    .post(`layouttool=${layout}&${encodeURIComponent(_dotString)}`);
            } else {
                const viz = await Viz.instance();
                result = viz.renderJSON(_dotString, {engine: layout});
            }
            return process_layout_result(result);
        } catch (error) {
            console.warn('graphviz layout failed: ', error);
            throw error;
        }
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);
    return Object.assign(graphviz, {
        layoutAlgorithm() {
            return layout;
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
        },
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            return this;
        },
        data(graph, nodes, edges, clusters) {
            data(nodes, edges, clusters);
        },
        dotInput(text) {
            _dotInput = text;
            return this;
        },
        start() {
            start();
        },
        stop() {
        },
        optionNames() {
            return graphviz_keys;
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
    });
}

function supergraph(data, options) {
    if (!supergraph.pattern) {
        const graph_and_subgraph = {
            nodes: {
                graph: graph_pattern(options),
                sg: subgraph_pattern(options),
                subgraph: graph_pattern(options),
            },
            edges: {
                to_sg: {
                    source: 'graph',
                    target: 'sg',
                    input: 'parent',
                },
                from_sg: {
                    source: 'subgraph',
                    target: 'sg',
                    input: 'child',
                },
            },
        };
        supergraph.pattern = compose$1(graph_detect(graph_and_subgraph));
    }
    return supergraph.pattern.node('graph.Graph').value().create(data);
}

/**
 * Layered layout for dc.graph.js
 * @module layered_layout
 */


/**
 * `layeredLayout` produces 3D layered layouts, utilizing another layout
 * that supports fixed nodes and position hints for the layers
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} layered layout engine
 */
function layeredLayout(id) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');
    let _supergraph, _subgraphs;
    let _layers;
    let _options = null;

    function init(options) {
        _options = options;
    }

    function data(nodes, edges, _constraints) {
        _supergraph = supergraph({nodes, edges}, {
            nodeKey(n) {
                return n.dcg_nodeKey;
            },
            edgeKey(n) {
                return n.dcg_edgeKey;
            },
            nodeValue(n) {
                return n;
            },
            edgeValue(e) {
                return e;
            },
            edgeSource(e) {
                return e.dcg_edgeSource;
            },
            edgeTarget(e) {
                return e.dcg_edgeTarget;
            },
        });

        // every node belongs natively in one rank
        const nranks = _supergraph.nodes().reduce((p, n) => {
            const rank = engine.layerAccessor()(n.value());
            p[rank] = p[rank] || [];
            p[rank].push(n);
            return p;
        }, {});
        const eranks = Object.keys(nranks).reduce((p, r) => {
            p[r] = [];
            return p;
        }, {});

        // nodes are shadowed into any layers to which they are adjacent
        // edges are induced from the native&shadow nodes in each layer
        _supergraph.edges().forEach(e => {
            const srank = engine.layerAccessor()(e.source().value()),
                trank = engine.layerAccessor()(e.target().value());
            if (srank == trank) {
                eranks[srank].push(e);
                return;
            }
            nranks[trank].push(e.source());
            eranks[trank].push(e);
            nranks[srank].push(e.target());
            eranks[srank].push(e);
        });

        // produce a subgraph for each layer
        _subgraphs = Object.keys(nranks).reduce((p, r) => {
            p[r] = _supergraph.subgraph(
                nranks[r].map(n => n.key()),
                eranks[r].map(e => e.key()),
            );
            return p;
        }, {});

        // start from the most populous layer
        let max = null;
        Object.keys(nranks).forEach(r => {
            if (
                max === null
                || _subgraphs[r].nodes().length > _subgraphs[max].nodes().length
            )
                max = +r;
        });

        // travel up and down from there, each time fixing the nodes from the last layer
        const ranks = Object.keys(nranks).map(r => +r).sort();
        _layers = ranks.map(r => ({
            rank: r,
            z: -r*engine.layerSeparationZ(),
        }));
        const mi = ranks.indexOf(max);
        const ups = ranks.slice(mi+1), downs = ranks.slice(0, mi).reverse();
        layout_layer(max).then(layout => {
            Promise.all([
                layout_layers(layout, max, ups),
                layout_layers(layout, max, downs),
            ]).then(() => {
                _dispatch.call(
                    'end',
                    null,
                    _supergraph.nodes().map(n => n.value()),
                    _supergraph.edges().map(e => e.value()),
                );
            });
        });
    }

    function layout_layers(layout, last, layers) {
        if (layers.length === 0)
            return Promise.resolve(layout);
        const curr = layers.shift();
        return layout_layer(curr).then(layout => layout_layers(layout, curr, layers));
    }

    function layout_layer(r, _last) {
        _subgraphs[r].nodes().forEach(n => {
            if (
                engine.layerAccessor()(n.value()) !== r
                && n.value().x !== undefined
                && n.value().y !== undefined
            )
                n.value().dcg_nodeFixed = {
                    x: n.value().x,
                    y: n.value().y,
                };
            else n.value().dcg_nodeFixed = null;
        });
        const subengine = engine.engineFactory()();
        subengine.init(_options);
        subengine.data(
            {},
            _subgraphs[r].nodes().map(n => n.value()),
            _subgraphs[r].edges().map(e => e.value()),
        );
        return promise_layout(r, subengine);
    }

    function promise_layout(r, subengine) {
        // stopgap - engine.start() should return a promise
        return new Promise((resolve, _reject) => {
            subengine.on('end', (nodes, edges) => {
                resolve({nodes, edges});
            });
            subengine.start();
        }).then(layout => {
            // copy positions back into the subgraph (and hence supergraph)
            layout.nodes.forEach(ln => {
                const n = _subgraphs[r].node(ln.dcg_nodeKey);
                // do not copy positions for shadow nodes
                if (engine.layerAccessor()(n.value()) !== r)
                    return;
                n.value().x = ln.x;
                n.value().y = ln.y;
                n.value().z = -r*engine.layerSeparationZ(); // lowest rank at top
            });
            return layout;
        });
    }

    function start() {
        _dispatch.call('start');
    }

    const graphviz = graphvizAttrs(), graphviz_keys = Object.keys(graphviz);

    const engine = Object.assign(graphviz, {
        layoutAlgorithm() {
            return 'layered';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes, edges, constraints) {
            data(nodes, edges);
        },
        start() {
            start();
        },
        stop() {
        },
        optionNames() {
            return []
                .concat(graphviz_keys);
        },
        engineFactory: property(null),
        layerAccessor: property(null),
        layerSeparationZ: property(50),
        layers() {
            return _layers;
        },
        populateLayoutNode() {},
        populateLayoutEdge() {},
        extractNodeAttrs: property({}), // {attr: function(node)}
        extractEdgeAttrs: property({}),
    });
    return engine;
}

/**
 * Manual layout for dc.graph.js
 * @module manual_layout
 */


function manualLayout(id) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');

    let _wnodes;
    function data(nodes) {
        _wnodes = nodes;
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch.call(event, null, wnodes, wedges.map(e => ({dcg_edgeKey: e.dcg_edgeKey})));
    }
    function start() {
        dispatchState(_wnodes, [], 'end');
    }

    const _engine = {
        layoutAlgorithm() {
            return 'manual';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return false;
        },
        parent: property(null),
        on(event, f) {
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
                options[option] = options[option] || this[option]();
            });
            return this;
        },
        data(graph, nodes, _edges) {
            data(nodes);
        },
        start() {
            start();
        },
        stop() {
        },
        optionNames() {
            return [];
        },
        populateLayoutNode(n1, n) {
            ['x', 'y'].forEach(attr => {
                if (n.orig.value[attr] !== undefined)
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge() {},
        addressToKey: property(ad => ad.join(',')),
        keyToAddress: property(nid => nid.split(',')),
    };
    return _engine;
}

// Scripts needed for web worker
manualLayout.scripts = ['css-layout.js'];

// arguably depth first search is a stupid algorithm to modularize -
// there are many, many interesting moments to insert a behavior
// and those end up being almost bigger than the function itself

// this is an argument for providing a graph API which could make it
// easy to just write a recursive function instead of using this
/**
 * Depth first traversal utility
 * @module depth_first_traversal
 */

function depthFirstTraversal(callbacks) { // {[init, root, row, tree, place, sib, push, pop, skip,] finish, nodeid, sourceid, targetid}
    return function(nodes, edges) {
        callbacks.init && callbacks.init();
        if (callbacks.tree)
            edges = edges.filter(e => callbacks.tree(e));
        const indegree = {};
        const outmap = edges.reduce((m, e) => {
            const tail = callbacks.sourceid(e),
                head = callbacks.targetid(e);
            if (!m[tail]) m[tail] = [];
            m[tail].push(e);
            indegree[head] = (indegree[head] || 0)+1;
            return m;
        }, {});
        const nmap = nodes.reduce((m, n) => {
            const key = callbacks.nodeid(n);
            m[key] = n;
            return m;
        }, {});

        const rows = [];
        const placed = {};
        function place_tree(n, r) {
            const key = callbacks.nodeid(n);
            if (placed[key]) {
                callbacks.skip && callbacks.skip(n, indegree[key]);
                return;
            }
            if (!rows[r])
                rows[r] = [];
            callbacks.place && callbacks.place(n, r, rows[r]);
            rows[r].push(n);
            placed[key] = true;
            if (outmap[key])
                outmap[key].forEach((e, ei) => {
                    const target = nmap[callbacks.targetid(e)];
                    if (ei && callbacks.sib)
                        callbacks.sib(false, nmap[callbacks.targetid(outmap[key][ei-1])], target);
                    callbacks.push && callbacks.push();
                    place_tree(target, r+1);
                });
            callbacks.pop && callbacks.pop(n);
        }

        let roots;
        if (callbacks.root)
            roots = nodes.filter(n => callbacks.root(n));
        else {
            roots = nodes.filter(n => !indegree[callbacks.nodeid(n)]);
            if (nodes.length && !roots.length) // all nodes are in a cycle
                roots = [nodes[0]];
        }
        roots.forEach((n, ni) => {
            if (ni && callbacks.sib)
                callbacks.sib(true, roots[ni-1], n);
            callbacks.push && callbacks.push();
            place_tree(n, callbacks.row && callbacks.row(n) || 0);
        });
        callbacks.finish(rows);
    };
}

// basically, see if it's any simpler if we start from scratch
// (well, of course it's simpler because we have less callbacks)
// same caveats as above
function undirectedDfs(callbacks) { // {[comp, node], nodeid, sourceid, targetid}
    return function(nodes, edges) {
        const adjacencies = edges.reduce((m, e) => {
            const tail = callbacks.sourceid(e),
                head = callbacks.targetid(e);
            if (!m[tail]) m[tail] = [];
            if (!m[head]) m[head] = [];
            m[tail].push(head);
            m[head].push(tail);
            return m;
        }, {});
        const nmap = nodes.reduce((m, n) => {
            const key = callbacks.nodeid(n);
            m[key] = n;
            return m;
        }, {});
        const found = {};
        function recurse(n) {
            const nid = callbacks.nodeid(n);
            callbacks.node(compid, n);
            found[nid] = true;
            if (adjacencies[nid])
                adjacencies[nid].forEach(adj => {
                    if (!found[adj])
                        recurse(nmap[adj]);
                });
        }
        let compid = 0;
        nodes.forEach(n => {
            if (!found[callbacks.nodeid(n)]) {
                callbacks.comp && callbacks.comp(compid);
                recurse(n);
                ++compid;
            }
        });
    };
}

/**
 * Tree layout for dc.graph.js
 * @module tree_layout
 */


/**
 * `treeLayout` is a very simple and not very bright tree layout. It can draw any DAG, but
 * tries to position the nodes as a tree.
 * @param {String} [id=uuid()] - Unique identifier
 * @return {Object} tree layout engine
 */
function treeLayout(id) {
    const _layoutId = id || uuid();
    const _dispatch = dispatch('tick', 'start', 'end');
    let _dfs;

    function init(options) {
        let x;
        const nodeWidth = typeof options.nodeWidth === 'function' ? options.nodeWidth : function() {
            return options.nodeWidth;
        };
        function best_dist(left, right) {
            return (nodeWidth(left)+nodeWidth(right))/2;
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
                if (row.length) {
                    const left = row[row.length-1];
                    const g = (nodeWidth(left)+nodeWidth(n))/2;
                    x = Math.max(x, left.left_x+g);
                }
                n.left_x = x;
                n.hit_ins = 1;
                n.y = r*options.gapY+options.offsetY;
            },
            sib(isroot, left, right) {
                let g = best_dist(left, right);
                if (isroot) g = g*1.5;
                x += g;
            },
            pop(n) {
                n.x = (n.left_x+x)/2;
            },
            skip(n, indegree) {
                // rolling average of in-neighbor x positions
                n.x = (n.hit_ins*n.x+x)/++n.hit_ins;
                if (n.hit_ins === indegree)
                    delete n.hit_ins;
            },
            finish(rows) {
                // this is disgusting. patch up any places where nodes overlap by scanning
                // right far enough to find the space, then fill from left to right at the
                // minimum gap
                rows.forEach(row => {
                    const sort = row.sort((a, b) => a.x-b.x);
                    let badi = null, badl = null, want;
                    for (let i = 0; i < sort.length-1; ++i) {
                        const left = sort[i], right = sort[i+1];
                        if (!badi) {
                            if (right.x-left.x < best_dist(left, right)) {
                                badi = i;
                                badl = left.x;
                                want = best_dist(left, right);
                            } // else still not bad
                        } else {
                            want += best_dist(left, right);
                            if (i < sort.length-2 && right.x < badl+want)
                                continue; // still bad
                            else {
                                if (badi > 0)
                                    --badi; // might want to use more left
                                let l, limit;
                                if (i < sort.length-2) { // found space before right
                                    const extra = right.x-(badl+want);
                                    l = sort[badi].x+extra/2;
                                    limit = i+1;
                                } else {
                                    l = Math.max(
                                        sort[badi].x,
                                        badl-best_dist(
                                            sort[badi],
                                            sort[badi+1],
                                        )-(want-right.x+badl)/2,
                                    );
                                    limit = sort.length;
                                }
                                for (let j = badi+1; j < limit; ++j) {
                                    l += best_dist(sort[j-1], sort[j]);
                                    sort[j].x = l;
                                }
                                badi = badl = want = null;
                            }
                        }
                    }
                });
            },
        });
    }

    let _nodes, _edges;
    function data(nodes, edges) {
        _nodes = nodes;
        _edges = edges;
    }

    function start() {
        _dfs(_nodes, _edges);
        _dispatch.call('end', null, _nodes, _edges);
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
            if (arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach(option => {
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
        },
        optionNames() {
            return ['nodeWidth', 'offsetX', 'offsetY', 'rowFunction', 'gapY'];
        },
        populateLayoutNode(layout, node) {
            if (this.rowFunction())
                layout.dcg_rank = this.rowFunction.eval(node);
        },
        populateLayoutEdge() {},
        nodeWidth: property(n => n.width),
        offsetX: property(30),
        offsetY: property(30),
        rowFunction: property(null),
        gapY: property(100),
    };
    return layout;
}

// Scripts needed for web worker
treeLayout.scripts = [];

/**
 * Layout engine registry and management
 * @module engine
 */


function spawnEngine(layout, args, worker) {
    args = args || {};
    worker = worker && !!window.Worker;
    let engine = engines.instantiate(layout, args, worker);
    if (!engine) {
        console.warn(`layout engine ${layout} not found; using default ${_defaultEngine}`);
        engine = engines.instantiate(_defaultEngine, args, worker);
    }
    return engine;
}

const _engines = [
    {
        name: 'dagre',
        params: ['rankdir'],
        instantiate() {
            return dagreLayout();
        },
    },
    {
        name: 'd3v4force',
        instantiate() {
            return d3v4ForceLayout();
        },
    },
    {
        name: 'tree',
        instantiate() {
            return treeLayout();
        },
    },
    {
        names: ['circo', 'dot', 'neato', 'osage', 'twopi', 'fdp'],
        instantiate(layout, args) {
            return graphvizLayout(null, layout, args.server);
        },
    },
    {
        name: 'cola',
        params: ['lengthStrategy'],
        instantiate() {
            return colaLayout();
        },
    },
    {
        names: ['dynadag'],
        workerName: 'dynagraph',
        instantiate(layout, args) {
            return dynagraphLayout(null, layout, args.server);
        },
    },
    {
        name: 'manual',
        instantiate() {
            return manualLayout();
        },
    },
    {
        name: 'flexbox',
        instantiate() {
            return flexboxLayout();
        },
    },
    {
        name: 'layered',
        instantiate() {
            return layeredLayout();
        },
    },
];
const _defaultEngine = 'cola';

const engines = {
    entry_pred(layoutName) {
        return function(e) {
            return e.name && e.name === layoutName || e.names && e.names.includes(layoutName);
        };
    },
    get(layoutName) {
        return _engines.find(this.entry_pred(layoutName));
    },
    is_directed(layoutName) {
        // to a first approximation. cola is sometimes directed
        return ['dagre', 'dot'].includes(layoutName);
    },
    instantiate(layout, args, worker) {
        const entry = this.get(layout);
        if (!entry)
            return null;
        let engine = entry.instantiate(layout, args);
        const params = entry.params || [];
        params.forEach(p => {
            if (args[p])
                engine[p](args[p]);
        });
        if (engine.supportsWebworker && engine.supportsWebworker() && worker)
            engine = webworkerLayout(engine, entry.workerName);
        return engine;
    },
    available() {
        return _engines.reduce(
            (avail, entry) => avail.concat(entry.name ? [entry.name] : entry.names),
            [],
        );
    },
    unregister(layoutName) {
        // meh. this is a bit much. there is such a thing as making the api too "easy".
        const i = _engines.findIndex(this.entry_pred(layoutName));
        let remove = false;
        if (i < 0)
            return false;
        const entry = _engines[i];
        if (entry.name === layoutName)
            remove = true;
        else {
            const j = entry.names.indexOf(layoutName);
            if (j >= 0)
                entry.names.splice(j, 1);
            else
                console.warn('search for engine failed', layoutName);
            if (entry.names.length === 0)
                remove = true;
        }
        if (remove)
            _engines.splice(i, 1);
        return true;
    },
    register(entry) {
        const that = this;
        if (!entry.instantiate) {
            console.error('engine definition needs instantiate: function(layout, args) { ... }');
            return this;
        }
        if (entry.name)
            this.unregister(entry.name);
        else if (entry.names)
            entry.names.forEach(layoutName => {
                that.unregister(layoutName);
            });
        else {
            console.error('engine definition needs name or names[]');
            return this;
        }
        _engines.push(entry);
        return this;
    },
};

function annotateLayers() {
    // svg-specific
    let _drawLayer;
    // wegl-specific
    let _planes = [];
    let _planeGeometry;
    const _mode = mode('annotate-layers', {
        laterDraw: true,
        renderers: ['svg', 'webgl'],
        draw,
        remove,
    });
    function draw(_diagram) {
        const rendererType = _mode.parent().renderer().rendererType();
        const engine = _mode.parent().layoutEngine();
        if (rendererType === 'svg') {
            if (
                engine.layoutAlgorithm() === 'cola'
                && engine.setcolaSpec() && engine.setcolaNodes()
            ) {
                _drawLayer = _mode.parent().select('g.draw').selectAll('g.divider-layer').data([0]);
                _drawLayer.enter().append('g').attr('class', 'divider-layer');
                const boundary_nodes = engine.setcolaNodes().filter(n =>
                    /^sort_order_boundary/.test(n.name)
                );
                const lines = _drawLayer.selectAll('line.divider').data(boundary_nodes);
                lines.exit().remove();
                lines.enter().append('line')
                    .attr('class', 'divider');
                lines.attr('stroke', _mode.stroke())
                    .attr('stroke-width', _mode.strokeWidth())
                    .attr('stroke-dasharray', _mode.strokeDashArray())
                    .attr('x1', -5e3)
                    .attr('y1', n => n.y)
                    .attr('x2', 5000)
                    .attr('y2', n => n.y);
            }
        } else if (rendererType === 'webgl') {
            const MULT = _mode.parent().renderer().multiplier();
            const scene = arguments[1], drawState = arguments[2];
            if (engine.layoutAlgorithm() === 'layered' && engine.layers()) {
                const width =
                        drawState.extents[0][1]-drawState.extents[0][0]+_mode.planePadding()*MULT*2,
                    height =
                        drawState.extents[1][1]-drawState.extents[1][0]+_mode.planePadding()*MULT*2;
                let delGeom;
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.lineTo(0, height);
                shape.lineTo(width, height);
                shape.lineTo(width, 0);
                shape.lineTo(0, 0);
                if (_planeGeometry)
                    delGeom = _planeGeometry;
                _planeGeometry = new THREE.ShapeBufferGeometry(shape);

                const layers = engine.layers();
                if (layers.length < _planes.length) {
                    for (let i = layers.length; i < _planes.length; ++i)
                        scene.remove(_planes[i].mesh);
                    _planes = _planes.slice(0, layers.length);
                }
                layers.forEach((layer, i) => {
                    if (!_planes[i])
                        _planes[i] = Object.assign({}, layer);
                    if (_planes[i].mesh)
                        scene.remove(_planes[i].mesh);
                    const mesh = _planes[i].mesh = new THREE.Mesh(
                        _planeGeometry,
                        new THREE.MeshStandardMaterial({
                            opacity: _mode.planeOpacity(),
                            transparent: true,
                            color: _mode.parent().renderer().color_to_int(_mode.planeColor()),
                            side: THREE.DoubleSide,
                        }),
                    );
                    mesh.position.set(
                        drawState.extents[0][0]-_mode.planePadding()*MULT,
                        drawState.extents[1][0]-_mode.planePadding()*MULT,
                        layer.z*MULT,
                    );
                    scene.add(mesh);
                });
                if (delGeom)
                    delGeom.dispose();
            }
        } else throw new Error(
                `annotate_layers doesn't know how to work with renderer ${rendererType}`,
            );
    }
    function remove() {
        if (_drawLayer)
            _drawLayer.remove();
    }

    // line properties for svg
    _mode.stroke = property('black');
    _mode.strokeWidth = property(2);
    _mode.strokeDashArray = property([5, 5]);

    // plane properties
    _mode.planePadding = property(5);
    _mode.planeOpacity = property(0.2);
    _mode.planeColor = property('#ffffdd');
    return _mode;
}

const annotateNodes = () => {
    function draw(diagram) {
        const roots = diagram.g().selectAll('g.node-layer g.node');
        const annots = roots.selectAll('text.node-annotation').data(d =>
            d.orig.value.ceq ? [d] : []
        );
        annots.enter().append('text')
            .attr('class', 'node-annotation')
            .attr('fill', d => {
                const nf = diagram.nodeFill.eval(d);
                return diagram.nodeFillScale()(nf-((nf%2) ? 0 : 1));
            })
            .attr('font-weight', 750)
            .attr('font-size', '50px')
            .attr('alignment-baseline', 'central')
            .attr('dx', d => `${Math.round(d.dcg_rx+10)}px`);
        annots.exit().remove();
        annots
            .text(d => d.orig.value.ceq);
    }
    function remove() {}
    const _mode = mode('annotate-nodes', {
        draw,
        remove,
        laterDraw: true,
    });
    return _mode;
};

function constant$1(x) {
  return function() {
    return x;
  };
}

function BrushEvent(target, type, selection) {
  this.target = target;
  this.type = type;
  this.selection = selection;
}

function nopropagation() {
  event.stopImmediatePropagation();
}

function noevent() {
  event.preventDefault();
  event.stopImmediatePropagation();
}

var MODE_DRAG = {},
    MODE_SPACE = {name: "space"},
    MODE_HANDLE = {name: "handle"},
    MODE_CENTER = {name: "center"};

var X = {
  };

var Y = {
  };

var XY = {
  name: "xy",
  handles: ["n", "e", "s", "w", "nw", "ne", "se", "sw"].map(type),
  input: function(xy) { return xy; },
  output: function(xy) { return xy; }
};

var cursors = {
  overlay: "crosshair",
  selection: "move",
  n: "ns-resize",
  e: "ew-resize",
  s: "ns-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize"
};

var flipX = {
  e: "w",
  w: "e",
  nw: "ne",
  ne: "nw",
  se: "sw",
  sw: "se"
};

var flipY = {
  n: "s",
  s: "n",
  nw: "sw",
  ne: "se",
  se: "ne",
  sw: "nw"
};

var signsX = {
  overlay: 1,
  selection: 1,
  n: null,
  e: 1,
  s: null,
  w: -1,
  nw: -1,
  ne: 1,
  se: 1,
  sw: -1
};

var signsY = {
  overlay: 1,
  selection: 1,
  n: -1,
  e: null,
  s: 1,
  w: null,
  nw: -1,
  ne: -1,
  se: 1,
  sw: 1
};

function type(t) {
  return {type: t};
}

// Ignore right-click, since that should open the context menu.
function defaultFilter() {
  return !event.button;
}

function defaultExtent() {
  var svg = this.ownerSVGElement || this;
  return [[0, 0], [svg.width.baseVal.value, svg.height.baseVal.value]];
}

// Like d3.local, but with the name “__brush” rather than auto-generated.
function local(node) {
  while (!node.__brush) if (!(node = node.parentNode)) return;
  return node.__brush;
}

function empty(extent) {
  return extent[0][0] === extent[1][0]
      || extent[0][1] === extent[1][1];
}

function d3Brush() {
  return brush$1(XY);
}

function brush$1(dim) {
  var extent = defaultExtent,
      filter = defaultFilter,
      listeners = dispatch(brush, "start", "brush", "end"),
      handleSize = 6,
      touchending;

  function brush(group) {
    var overlay = group
        .property("__brush", initialize)
      .selectAll(".overlay")
      .data([type("overlay")]);

    overlay.enter().append("rect")
        .attr("class", "overlay")
        .attr("pointer-events", "all")
        .attr("cursor", cursors.overlay)
      .merge(overlay)
        .each(function() {
          var extent = local(this).extent;
          select(this)
              .attr("x", extent[0][0])
              .attr("y", extent[0][1])
              .attr("width", extent[1][0] - extent[0][0])
              .attr("height", extent[1][1] - extent[0][1]);
        });

    group.selectAll(".selection")
      .data([type("selection")])
      .enter().append("rect")
        .attr("class", "selection")
        .attr("cursor", cursors.selection)
        .attr("fill", "#777")
        .attr("fill-opacity", 0.3)
        .attr("stroke", "#fff")
        .attr("shape-rendering", "crispEdges");

    var handle = group.selectAll(".handle")
      .data(dim.handles, function(d) { return d.type; });

    handle.exit().remove();

    handle.enter().append("rect")
        .attr("class", function(d) { return "handle handle--" + d.type; })
        .attr("cursor", function(d) { return cursors[d.type]; });

    group
        .each(redraw)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)")
        .on("mousedown.brush touchstart.brush", started);
  }

  brush.move = function(group, selection) {
    if (group.selection) {
      group
          .on("start.brush", function() { emitter(this, arguments).beforestart().start(); })
          .on("interrupt.brush end.brush", function() { emitter(this, arguments).end(); })
          .tween("brush", function() {
            var that = this,
                state = that.__brush,
                emit = emitter(that, arguments),
                selection0 = state.selection,
                selection1 = dim.input(typeof selection === "function" ? selection.apply(this, arguments) : selection, state.extent),
                i = interpolate$1(selection0, selection1);

            function tween(t) {
              state.selection = t === 1 && empty(selection1) ? null : i(t);
              redraw.call(that);
              emit.brush();
            }

            return selection0 && selection1 ? tween : tween(1);
          });
    } else {
      group
          .each(function() {
            var that = this,
                args = arguments,
                state = that.__brush,
                selection1 = dim.input(typeof selection === "function" ? selection.apply(that, args) : selection, state.extent),
                emit = emitter(that, args).beforestart();

            interrupt(that);
            state.selection = selection1 == null || empty(selection1) ? null : selection1;
            redraw.call(that);
            emit.start().brush().end();
          });
    }
  };

  function redraw() {
    var group = select(this),
        selection = local(this).selection;

    if (selection) {
      group.selectAll(".selection")
          .style("display", null)
          .attr("x", selection[0][0])
          .attr("y", selection[0][1])
          .attr("width", selection[1][0] - selection[0][0])
          .attr("height", selection[1][1] - selection[0][1]);

      group.selectAll(".handle")
          .style("display", null)
          .attr("x", function(d) { return d.type[d.type.length - 1] === "e" ? selection[1][0] - handleSize / 2 : selection[0][0] - handleSize / 2; })
          .attr("y", function(d) { return d.type[0] === "s" ? selection[1][1] - handleSize / 2 : selection[0][1] - handleSize / 2; })
          .attr("width", function(d) { return d.type === "n" || d.type === "s" ? selection[1][0] - selection[0][0] + handleSize : handleSize; })
          .attr("height", function(d) { return d.type === "e" || d.type === "w" ? selection[1][1] - selection[0][1] + handleSize : handleSize; });
    }

    else {
      group.selectAll(".selection,.handle")
          .style("display", "none")
          .attr("x", null)
          .attr("y", null)
          .attr("width", null)
          .attr("height", null);
    }
  }

  function emitter(that, args) {
    return that.__brush.emitter || new Emitter(that, args);
  }

  function Emitter(that, args) {
    this.that = that;
    this.args = args;
    this.state = that.__brush;
    this.active = 0;
  }

  Emitter.prototype = {
    beforestart: function() {
      if (++this.active === 1) this.state.emitter = this, this.starting = true;
      return this;
    },
    start: function() {
      if (this.starting) this.starting = false, this.emit("start");
      return this;
    },
    brush: function() {
      this.emit("brush");
      return this;
    },
    end: function() {
      if (--this.active === 0) delete this.state.emitter, this.emit("end");
      return this;
    },
    emit: function(type) {
      customEvent(new BrushEvent(brush, type, dim.output(this.state.selection)), listeners.apply, listeners, [type, this.that, this.args]);
    }
  };

  function started() {
    if (event.touches) { if (event.changedTouches.length < event.touches.length) return noevent(); }
    else if (touchending) return;
    if (!filter.apply(this, arguments)) return;

    var that = this,
        type = event.target.__data__.type,
        mode = (event.metaKey ? type = "overlay" : type) === "selection" ? MODE_DRAG : (event.altKey ? MODE_CENTER : MODE_HANDLE),
        signX = dim === Y ? null : signsX[type],
        signY = dim === X ? null : signsY[type],
        state = local(that),
        extent = state.extent,
        selection = state.selection,
        W = extent[0][0], w0, w1,
        N = extent[0][1], n0, n1,
        E = extent[1][0], e0, e1,
        S = extent[1][1], s0, s1,
        dx,
        dy,
        moving,
        shifting = signX && signY && event.shiftKey,
        lockX,
        lockY,
        point0 = mouse(that),
        point = point0,
        emit = emitter(that, arguments).beforestart();

    if (type === "overlay") {
      state.selection = selection = [
        [w0 = dim === Y ? W : point0[0], n0 = dim === X ? N : point0[1]],
        [e0 = dim === Y ? E : w0, s0 = dim === X ? S : n0]
      ];
    } else {
      w0 = selection[0][0];
      n0 = selection[0][1];
      e0 = selection[1][0];
      s0 = selection[1][1];
    }

    w1 = w0;
    n1 = n0;
    e1 = e0;
    s1 = s0;

    var group = select(that)
        .attr("pointer-events", "none");

    var overlay = group.selectAll(".overlay")
        .attr("cursor", cursors[type]);

    if (event.touches) {
      group
          .on("touchmove.brush", moved, true)
          .on("touchend.brush touchcancel.brush", ended, true);
    } else {
      var view = select(event.view)
          .on("keydown.brush", keydowned, true)
          .on("keyup.brush", keyupped, true)
          .on("mousemove.brush", moved, true)
          .on("mouseup.brush", ended, true);

      dragDisable(event.view);
    }

    nopropagation();
    interrupt(that);
    redraw.call(that);
    emit.start();

    function moved() {
      var point1 = mouse(that);
      if (shifting && !lockX && !lockY) {
        if (Math.abs(point1[0] - point[0]) > Math.abs(point1[1] - point[1])) lockY = true;
        else lockX = true;
      }
      point = point1;
      moving = true;
      noevent();
      move();
    }

    function move() {
      var t;

      dx = point[0] - point0[0];
      dy = point[1] - point0[1];

      switch (mode) {
        case MODE_SPACE:
        case MODE_DRAG: {
          if (signX) dx = Math.max(W - w0, Math.min(E - e0, dx)), w1 = w0 + dx, e1 = e0 + dx;
          if (signY) dy = Math.max(N - n0, Math.min(S - s0, dy)), n1 = n0 + dy, s1 = s0 + dy;
          break;
        }
        case MODE_HANDLE: {
          if (signX < 0) dx = Math.max(W - w0, Math.min(E - w0, dx)), w1 = w0 + dx, e1 = e0;
          else if (signX > 0) dx = Math.max(W - e0, Math.min(E - e0, dx)), w1 = w0, e1 = e0 + dx;
          if (signY < 0) dy = Math.max(N - n0, Math.min(S - n0, dy)), n1 = n0 + dy, s1 = s0;
          else if (signY > 0) dy = Math.max(N - s0, Math.min(S - s0, dy)), n1 = n0, s1 = s0 + dy;
          break;
        }
        case MODE_CENTER: {
          if (signX) w1 = Math.max(W, Math.min(E, w0 - dx * signX)), e1 = Math.max(W, Math.min(E, e0 + dx * signX));
          if (signY) n1 = Math.max(N, Math.min(S, n0 - dy * signY)), s1 = Math.max(N, Math.min(S, s0 + dy * signY));
          break;
        }
      }

      if (e1 < w1) {
        signX *= -1;
        t = w0, w0 = e0, e0 = t;
        t = w1, w1 = e1, e1 = t;
        if (type in flipX) overlay.attr("cursor", cursors[type = flipX[type]]);
      }

      if (s1 < n1) {
        signY *= -1;
        t = n0, n0 = s0, s0 = t;
        t = n1, n1 = s1, s1 = t;
        if (type in flipY) overlay.attr("cursor", cursors[type = flipY[type]]);
      }

      if (state.selection) selection = state.selection; // May be set by brush.move!
      if (lockX) w1 = selection[0][0], e1 = selection[1][0];
      if (lockY) n1 = selection[0][1], s1 = selection[1][1];

      if (selection[0][0] !== w1
          || selection[0][1] !== n1
          || selection[1][0] !== e1
          || selection[1][1] !== s1) {
        state.selection = [[w1, n1], [e1, s1]];
        redraw.call(that);
        emit.brush();
      }
    }

    function ended() {
      nopropagation();
      if (event.touches) {
        if (event.touches.length) return;
        if (touchending) clearTimeout(touchending);
        touchending = setTimeout(function() { touchending = null; }, 500); // Ghost clicks are delayed!
        group.on("touchmove.brush touchend.brush touchcancel.brush", null);
      } else {
        yesdrag(event.view, moving);
        view.on("keydown.brush keyup.brush mousemove.brush mouseup.brush", null);
      }
      group.attr("pointer-events", "all");
      overlay.attr("cursor", cursors.overlay);
      if (state.selection) selection = state.selection; // May be set by brush.move (on start)!
      if (empty(selection)) state.selection = null, redraw.call(that);
      emit.end();
    }

    function keydowned() {
      switch (event.keyCode) {
        case 16: { // SHIFT
          shifting = signX && signY;
          break;
        }
        case 18: { // ALT
          if (mode === MODE_HANDLE) {
            if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
            if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
            mode = MODE_CENTER;
            move();
          }
          break;
        }
        case 32: { // SPACE; takes priority over ALT
          if (mode === MODE_HANDLE || mode === MODE_CENTER) {
            if (signX < 0) e0 = e1 - dx; else if (signX > 0) w0 = w1 - dx;
            if (signY < 0) s0 = s1 - dy; else if (signY > 0) n0 = n1 - dy;
            mode = MODE_SPACE;
            overlay.attr("cursor", cursors.selection);
            move();
          }
          break;
        }
        default: return;
      }
      noevent();
    }

    function keyupped() {
      switch (event.keyCode) {
        case 16: { // SHIFT
          if (shifting) {
            lockX = lockY = shifting = false;
            move();
          }
          break;
        }
        case 18: { // ALT
          if (mode === MODE_CENTER) {
            if (signX < 0) e0 = e1; else if (signX > 0) w0 = w1;
            if (signY < 0) s0 = s1; else if (signY > 0) n0 = n1;
            mode = MODE_HANDLE;
            move();
          }
          break;
        }
        case 32: { // SPACE
          if (mode === MODE_SPACE) {
            if (event.altKey) {
              if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
              if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
              mode = MODE_CENTER;
            } else {
              if (signX < 0) e0 = e1; else if (signX > 0) w0 = w1;
              if (signY < 0) s0 = s1; else if (signY > 0) n0 = n1;
              mode = MODE_HANDLE;
            }
            overlay.attr("cursor", cursors[type]);
            move();
          }
          break;
        }
        default: return;
      }
      noevent();
    }
  }

  function initialize() {
    var state = this.__brush || {selection: null};
    state.extent = extent.apply(this, arguments);
    state.dim = dim;
    return state;
  }

  brush.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant$1([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), brush) : extent;
  };

  brush.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant$1(!!_), brush) : filter;
  };

  brush.handleSize = function(_) {
    return arguments.length ? (handleSize = +_, brush) : handleSize;
  };

  brush.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? brush : value;
  };

  return brush;
}

/**
 * `brush` is a {@link mode mode} providing a simple wrapper over
 * [d3.svg.brush](https://github.com/d3/d3-3.x-api-reference/blob/master/SVG-Controls.md#brush)
 * @class brush
 * @return {brush}
 */
function brush() {
    let _brush = null, _gBrush;
    const _dispatch = dispatch('brushstart', 'brushmove', 'brushend');
    let _clearing = false;

    function brushstart() {
        if (!_clearing) {
            _dispatch.call('brushstart');
        }
    }
    function brushmove() {
        if (!_clearing) {
            const ext = event.selection;
            _dispatch.call('brushmove', null, ext);
        }
    }
    function brushend() {
        if (!_clearing) {
            _dispatch.call('brushend');
            _clearing = true;
            _gBrush.call(_brush.move, null);
            _clearing = false;
        }
    }
    function install_brush(diagram) {
        if (!_brush) {
            const extent = [[diagram.x().range()[0], diagram.y().range()[0]], [
                diagram.x().range()[1],
                diagram.y().range()[1],
            ]];
            _brush = d3Brush()
                .extent(extent)
                .on('start.brush-mode', brushstart)
                .on('brush.brush-mode', brushmove)
                .on('end.brush-mode', brushend);
        }
        if (!_gBrush) {
            _gBrush = diagram.svg().insert('g', ':first-child')
                .attr('class', 'brush')
                .call(_brush);
        }
    }
    function remove_brush() {
        if (_gBrush) {
            _gBrush.remove();
            _gBrush = null;
        }
    }
    const _mode = mode('brush', {
        draw() {},
        remove: remove_brush,
    });

    /**
     * Subscribe to a brush event, currently `brushstart`, `brushmove`, or `brushend`
     * @method on
     * @memberof dc_graph.brush
     * @instance
     * @param {String} event the name of the event; please namespace with `'namespace.event'`
     * @param {Function} [f] the handler function; if omitted, returns the current handler
     * @return {dc_graph.brush}
     * @return {Function}
     */
    _mode.on = function(event, f) {
        if (arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    /**
     * Add the brush to the parent diagram's SVG
     * @method activate
     * @memberof dc_graph.brush
     * @instance
     * @return {dc_graph.brush}
     */
    _mode.activate = function() {
        install_brush(_mode.parent());
        return this;
    };
    /**
     * Remove the brush from the parent diagram's SVG
     * @method deactivate
     * @memberof dc_graph.brush
     * @instance
     * @return {dc_graph.brush}
     */
    _mode.deactivate = function() {
        remove_brush();
        return this;
    };
    /**
     * Retrieve whether the brush is currently active
     * @method isActive
     * @memberof dc_graph.brush
     * @instance
     * @return {Boolean}
     */
    _mode.isActive = function() {
        return !!_gBrush;
    };

    return _mode;
}

/**
 * In cola.js there are three factors which influence the positions of nodes:
 * * *edge length* suggestions, controlled by the
 * lengthStrategy, baseLength, and edgeLength parameters
 * * *automatic constraints* based on the global edge flow direction (`cola.flowLayout`) and overlap
 * avoidance parameters (`cola.avoidOverlaps`)
 * * *manual constraints* such as alignment, inequality and equality constraints in a dimension/axis.
 *
 * Generally when the
 * {@link https://github.com/tgdwyer/WebCola/wiki/Constraints cola.js documentation mentions constraints},
 * it means the manual constraints.
 *
 * This utility creates a constraint generator function from a *pattern*, a graph where:
 *  1. Nodes represent *types* or classes of layout nodes, annotated with a specification
 * of how to match the nodes belonging each type.
 *  2. Edges represent *rules* to generate constraints. There are two kinds of rules:
 * <ol type='a'>
 *    <li>To generate additional constraints on edges besides the built-in ones, create a rules
 * between two different types. The rule will apply to any edges in the layout which match the
 * source and target types, and generate simple "left/right" constraints. (Note that "left" and
 * "right" in this context refer to sides of an inequality constraint `left + gap <= right`)
 *    <li>To generate constraints on a set of nodes, such as alignment, ordering, or circle
 * constraints, create a rule from a type to itself, a self edge.
 * </ol>
 * (It is also conceivable to want constraints between individual nodes which don't
 * have edges between them. This is not directly supported at this time; right now the workaround
 * is to create the edge but not draw it, e.g. by setting its edgeOpacity
 * to zero. If you have a use-case for this, please
 * {@link https://github.com/dc-js/dc.graph.js/issues/new file an issue}.
 *
 * The pattern syntax is an embedded domain specific language designed to be terse without
 * restricting its power. As such, there are complicated rules for defaulting and inferring
 * parameters from other parameters. Since most users will want the simplest form, this document
 * will start from the highest level and then show how to use more complicated forms in order to
 * gain more control.
 *
 * Then we'll build back up from the ground up and show how inference works.
 * @param {Object} pattern - a graph which defines the constraints to be generated
 * @return {Function}
 */
function constraintPattern(pattern) {
    const types = {}, rules = [];

    pattern.nodes.forEach(n => {
        const id = n.id;
        const type = types[id] || (types[id] = {});
        // partitions could be done more efficiently; this is POC
        if (n.partition) {
            const partition = n.partition;
            const value = n.value || n.id;
            if (n.all || n.typename) {
                type.match = n.extract
                    ? function(n2) {
                        return n.extract(n2.value[partition]);
                    }
                    : function(n2) {
                        return n2.value[partition];
                    };
                type.typename = n.typename || function(n2) {
                    return `${partition}=${n2.value[partition]}`;
                };
            } else
                type.match = function(n2) {
                    return n2.value[partition] === value;
                };
        } else if (n.match)
            type.match = n.match;
        else throw new Error(`couldn't determine matcher for type ${JSON.stringify(n)}`);
    });
    pattern.edges.forEach(e => {
        if (e.disable)
            return;
        const rule = {source: e.source, target: e.target};
        rule.produce = typeof e.produce === 'function' ? e.produce : function() {
            return clone(e.produce);
        };
        ['listname', 'wrap', 'reverse'].forEach(k => {
            if (e[k] !== undefined) rule[k] = e[k];
        });
        rules.push(rule);
    });

    return function(diagram, nodes, edges) {
        const constraints = [];
        const members = {};
        nodes.forEach(n => {
            const key = diagram.nodeKey.eval(n);
            for (const t in types) {
                const type = types[t], value = type.match(n.orig);
                if (value) {
                    const tname = type.typename ? type.typename(t, value) : t;
                    if (!members[tname])
                        members[tname] = {
                            nodes: [], // original ordering
                            whether: {}, // boolean
                        };
                    members[tname].nodes.push(key);
                    members[tname].whether[key] = true;
                }
            }
        });
        // traversal of rules could be more efficient, again POC
        const edge_rules = rules.filter(r => r.source !== r.target);
        const type_rules = rules.filter(r => r.source === r.target);
        edges.forEach(e => {
            const source = diagram.edgeSource.eval(e),
                target = diagram.edgeTarget.eval(e);
            edge_rules.forEach(r => {
                if (
                    members[r.source] && members[r.source].whether[source]
                    && members[r.target] && members[r.target].whether[target]
                ) {
                    const constraint = r.produce(members, nodes, edges);
                    if (r.reverse) {
                        constraint.left = target;
                        constraint.right = source;
                    } else {
                        constraint.left = source;
                        constraint.right = target;
                    }
                    constraints.push(constraint);
                }
            });
        });
        type_rules.forEach(r => {
            if (!members[r.source])
                return;
            const constraint = r.produce(),
                listname = r.listname || r.produce.listname || 'nodes',
                wrap = r.wrap || r.produce.wrap || function(x) {
                    return x;
                };
            constraint[listname] = members[r.source].nodes.map(wrap);
            constraints.push(constraint);
        });
        return constraints;
    };
}

// constraint generation convenience functions
function gapY(gap, equality) {
    return {
        axis: 'y',
        gap,
        equality: !!equality,
    };
}
function gapX(gap, equality) {
    return {
        axis: 'x',
        gap,
        equality: !!equality,
    };
}

function alignF(axis) {
    const ret = function() {
        return {
            type: 'alignment',
            axis,
        };
    };
    ret.listname = 'offsets';
    ret.wrap = function(x) {
        return {node: x, offset: 0};
    };
    return ret;
}

function alignY() {
    return alignF('y');
}
function alignX() {
    return alignF('x');
}

function orderX(gap, ordering) {
    return {
        type: 'ordering',
        axis: 'x',
        gap: 60,
        ordering,
    };
}
function orderY(gap, ordering) {
    return {
        type: 'ordering',
        axis: 'y',
        gap: 60,
        ordering,
    };
}

const convert_tree_helper = function(data, attrs, options, parent, level, inherit) {
    level = level || 0;
    if (attrs.length > (options.valuesByAttr ? 1 : 0)) {
        const attr = attrs.shift();
        const nodes = [], edges = [];
        const children = data.map(v => {
            const key = v[options.nestKey];
            const childKey = options.nestKeysUnique ? key : uuid();
            if (childKey) {
                let node;
                if (options.ancestorKeys) {
                    inherit = inherit || {};
                    if (attr)
                        inherit[attr] = key;
                    node = Object.assign({}, inherit);
                } else node = {};
                node[options.nodeKey] = childKey;
                if (options.label && options.labelFun)
                    node[options.label] = options.labelFun(key, attr, v);
                if (options.level)
                    node[options.level] = level+1;
                nodes.push(node);
                if (parent) {
                    const edge = {};
                    edge[options.edgeSource] = parent;
                    edge[options.edgeTarget] = childKey;
                    edges.push(edge);
                }
            }
            const children = options.valuesByAttr ? v[attrs[0]] : v.values;
            const recurse = convert_tree_helper(
                children,
                attrs.slice(0),
                options,
                childKey,
                level+1,
                Object.assign({}, inherit),
            );
            return recurse;
        });
        return {
            nodes: Array.prototype.concat.apply(nodes, children.map(pluck('nodes'))),
            edges: Array.prototype.concat.apply(edges, children.map(pluck('edges'))),
        };
    } else return {
            nodes: data.map(v => {
                v = Object.assign({}, v);
                if (options.level)
                    v[options.level] = level+1;
                return v;
            }),
            edges: data.map(v => {
                const edge = {};
                edge[options.edgeSource] = parent;
                edge[options.edgeTarget] = v[options.nodeKey];
                return edge;
            }),
        };
};

function convertTree(data, attrs, options) {
    options = Object.assign({
        nodeKey: 'key',
        edgeKey: 'key',
        edgeSource: 'sourcename',
        edgeTarget: 'targetname',
        nestKey: 'key',
    }, options);
    if (Array.isArray(data))
        return convert_tree_helper(data, attrs, options, options.root, 0, options.inherit);
    else {
        attrs = [''].concat(attrs);
        return convert_tree_helper([data], attrs, options, options.root, 0, options.inherit);
    }
}

function convertNest(
    nest,
    attrs,
    nodeKeyAttr,
    edgeSourceAttr,
    edgeTargetAttr,
    parent,
    inherit,
) {
    return convertTree(nest, attrs, {
        nodeKey: nodeKeyAttr,
        edgeSource: edgeSourceAttr,
        edgeTarget: edgeTargetAttr,
        root: parent,
        inherit,
        ancestorKeys: true,
        label: 'name',
        labelFun(key, attr, _v) {
            return `${attr}:${key}`;
        },
        level: '_level',
    });
}

// https://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
const type_of = obj => ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
const object_to_keyed_array = obj => Object.entries(obj).map(([key, value]) => ({key, ...value}));

function convertAdjacencyList(nodes, namesIn, namesOut) {
    if (type_of(nodes) === 'object') {
        const graph = namesIn.multipleGraphs ? Object.values(nodes)[0] : nodes;
        nodes = object_to_keyed_array(graph);
    }
    const adjkey = namesIn.adjacencies || namesIn.revAdjacencies,
        revadj = !namesIn.adjacencies;
    if (!adjkey)
        throw new Error('must specify namesIn.adjacencies or namesIn.revAdjacencies');
    const edges = Array.prototype.concat.apply(
        [],
        nodes.map(n =>
            n[adjkey].map(adj => {
                const e = {};
                if (namesOut.edgeKey)
                    e[namesOut.edgeKey] = uuid();
                e[namesOut.edgeSource] = n[namesIn.nodeKey];
                e[namesOut.edgeTarget] = (namesIn.targetKey ? adj[namesIn.targetKey] : adj)
                    .toString();
                if (revadj)
                    [e[namesOut.edgeSource], e[namesOut.edgeTarget]] = [
                        e[namesOut.edgeTarget],
                        e[namesOut.edgeSource],
                    ];
                if (namesOut.adjacency)
                    e[namesOut.adjacency] = adj;
                return e;
            })
        ),
    );
    return {
        nodes,
        edges,
        nodekeyattr: namesIn.nodeKey,
        sourceattr: namesOut.edgeSource,
        targetattr: namesOut.edgeTarget,
    };
}

function deleteThings(things_group, mode_name, id_tag) {
    id_tag = id_tag || 'id';
    const _deleteKey = is_a_mac ? 'Backspace' : 'Delete';
    let _keyboard, _selected = [];
    function selection_changed(selection) {
        _selected = selection;
    }
    function row_id(r) {
        return r[id_tag];
    }
    function delete_selection(selection) {
        if (!_mode.crossfilterAccessor())
            throw new Error('need crossfilterAccessor');
        if (!_mode.dimensionAccessor())
            throw new Error('need dimensionAccessor');
        selection = selection || _selected;
        if (selection.length === 0)
            return Promise.resolve([]);
        let promise = _mode.preDelete() ? _mode.preDelete()(selection) : Promise.resolve(selection);
        if (_mode.onDelete())
            promise = promise.then(_mode.onDelete());
        return promise.then(selection => {
            if (selection && selection.length) {
                const crossfilter = _mode.crossfilterAccessor()(_mode.parent()),
                    dimension = _mode.dimensionAccessor()(_mode.parent());
                const all = crossfilter.all().slice(); all.length;
                dimension.filter(null);
                crossfilter.remove();
                const filtered = all.filter(r => selection.indexOf(row_id(r)) === -1);
                if (all.length !== filtered.length+selection.length)
                    console.warn(
                        'size after deletion is not previous size minus selection size',
                        filtered.map(row_id),
                        all.map(row_id),
                        selection,
                    );
                crossfilter.add(filtered);

                _mode.parent().redrawGroup();
            }
            return true;
        });
    }
    function draw(_diagram) {
        _keyboard.on(`keyup.${mode_name}`, () => {
            if (event.code === _deleteKey)
                delete_selection();
        });
    }
    function remove(_diagram) {
    }
    const _mode = mode(mode_name, {
        draw,
        remove,
        parent(p) {
            things_group.on(`set_changed.${mode_name}`, selection_changed);
            if (p) {
                _keyboard = p.child('keyboard');
                if (!_keyboard)
                    p.child('keyboard', _keyboard = keyboard());
            }
        },
    });
    _mode.preDelete = property(null);
    _mode.onDelete = property(null);
    _mode.crossfilterAccessor = property(null);
    _mode.dimensionAccessor = property(null);
    _mode.deleteSelection = delete_selection;
    return _mode;
}

function selectThings(things_group, things_name, thinginess) {
    let _selected = [], _oldSelected;
    let _mousedownThing = null;
    let _keyboard;

    const contains_predicate = thinginess.keysEqual
        ? function(k1) {
            return function(k2) {
                return thinginess.keysEqual(k1, k2);
            };
        }
        : function(k1) {
            return function(k2) {
                return k1 === k2;
            };
        };
    function contains(array, key) {
        return !!_selected.find(contains_predicate(key));
    }
    function isUnion(event) {
        return event.shiftKey;
    }
    function isToggle(event) {
        return is_a_mac ? event.metaKey : event.ctrlKey;
    }
    function add_array(array, key) {
        return contains(array, key) ? array : array.concat([key]);
    }
    function toggle_array(array, key) {
        return contains(array, key) ? array.filter(x => x != key) : array.concat([key]);
    }

    function selection_changed(diagram) {
        return function(selection, refresh) {
            if (refresh === undefined)
                refresh = true;
            _selected = selection;
            if (refresh)
                diagram.requestRefresh();
        };
    }
    let _have_bce = false;
    function background_click_event(diagram, v) {
        // we seem to have nodes-background interrupting edges-background by reinstalling uselessly
        if (_have_bce === v)
            return;
        diagram.svg().on(
            `click.${things_name}`,
            v
                ? function(_t) {
                    if (event.target === this)
                        things_group.call('set_changed', null, []);
                }
                : null,
        );
        _have_bce = v;
    }
    function modkeyschanged() {
        if (_mode.multipleSelect()) {
            const brush_mode = _mode.parent().child('brush');
            if (_keyboard.modKeysMatch(_mode.modKeys(), is_a_mac ? 'Meta' : 'Control'))
                brush_mode.activate();
            else
                brush_mode.deactivate();
        }
    }
    function brushstart() {
        if (isUnion(event.sourceEvent) || isToggle(event.sourceEvent))
            _oldSelected = _selected.slice();
        else {
            _oldSelected = [];
            things_group.call('set_changed', null, []);
        }
    }
    function brushmove(ext) {
        if (!thinginess.intersectRect)
            return;
        const rectSelect = ext ? thinginess.intersectRect(ext) : [];
        let newSelected;
        if (isUnion(event.sourceEvent))
            newSelected = rectSelect.reduce(add_array, _oldSelected);
        else if (isToggle(event.sourceEvent))
            newSelected = rectSelect.reduce(toggle_array, _oldSelected);
        else
            newSelected = rectSelect;
        things_group.call('set_changed', null, newSelected);
    }

    function draw(diagram, node, edge) {
        const condition = _mode.noneIsAll()
            ? function(t) {
                return !_selected.length || contains(_selected, thinginess.key(t));
            }
            : function(t) {
                return contains(_selected, thinginess.key(t));
            };
        thinginess.applyStyles(condition);

        thinginess.clickables(diagram, node, edge).on(`mousedown.${things_name}`, t => {
            _mousedownThing = t;
        });

        thinginess.clickables(diagram, node, edge).on(`mouseup.${things_name}`, t => {
            if (thinginess.excludeClick && thinginess.excludeClick(event.target))
                return;
            // it's only a click if the same target was mousedown & mouseup
            // but we can't use click event because things may have been reordered
            if (_mousedownThing !== t)
                return;
            const key = thinginess.key(t);
            let newSelected;
            if (_mode.multipleSelect()) {
                if (isUnion(event))
                    newSelected = add_array(_selected, key);
                else if (isToggle(event))
                    newSelected = toggle_array(_selected, key);
            }
            if (!newSelected)
                newSelected = [key];
            things_group.call('set_changed', null, newSelected);
        });

        if (_mode.multipleSelect()) {
            if (_keyboard.modKeysMatch(_mode.modKeys()))
                diagram.child('brush').activate();
        } else
            background_click_event(diagram, _mode.clickBackgroundClears());

        if (_mode.autoCropSelection()) {
            // drop any selected which no longer exist in the diagram
            const present = thinginess.clickables(diagram, node, edge).data().map(thinginess.key);
            const now_selected = _selected.filter(k => contains(present, k));
            if (_selected.length !== now_selected.length)
                things_group.call('set_changed', null, now_selected, false);
        }
    }

    function remove(diagram, node, edge) {
        thinginess.clickables(diagram, node, edge).on(`click.${things_name}`, null);
        diagram.svg().on(`click.${things_name}`, null);
        thinginess.removeStyles();
    }

    const _mode = mode(things_name, {
        draw,
        remove,
        parent(p) {
            things_group.on(`set_changed.${things_name}`, p ? selection_changed(p) : null);
            if (p && _mode.multipleSelect()) {
                let brush_mode = p.child('brush');
                if (!brush_mode) {
                    brush_mode = brush();
                    p.child('brush', brush_mode);
                }
                brush_mode
                    .on(`brushstart.${things_name}`, brushstart)
                    .on(`brushmove.${things_name}`, brushmove);
            }
            _keyboard = p.child('keyboard');
            if (!_keyboard)
                p.child('keyboard', _keyboard = keyboard());
            _keyboard.on(`modkeyschanged.${things_name}`, modkeyschanged);
        },
        laterDraw: thinginess.laterDraw || false,
    });

    _mode.multipleSelect = property(true);
    _mode.modKeys = property(null);
    _mode.clickBackgroundClears = property(true, false).react(v => {
        if (!_mode.multipleSelect() && _mode.parent())
            background_click_event(_mode.parent(), v);
    });
    _mode.noneIsAll = property(false);
    // if you're replacing the data, you probably want the selection not to be preserved when a thing
    // with the same key re-appears later (true). however, if you're filtering dc.js-style, you
    // probably want filters to be independent between diagrams (false)
    _mode.autoCropSelection = property(true);
    // if you want to do the cool things select_things can do
    _mode.thinginess = function() {
        return thinginess;
    };
    return _mode;
}

function selectThingsGroup(brushgroup, type) {
    window.chart_registry.create_type(type, () => dispatch('set_changed'));

    return window.chart_registry.create_group(type, brushgroup);
}

function deleteNodes(id_tag, options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );
    const select_edges_group = selectThingsGroup(
        options.select_edges_group || 'select-edges-group',
        'select-edges',
    );
    const _mode = deleteThings(select_nodes_group, 'delete-nodes', id_tag);

    _mode.preDelete(nodes => {
        // request a delete of all attached edges, using the delete edges mode
        // kind of horrible
        const diagram = _mode.parent();
        const deleteEdgesMode = diagram.child('delete-edges');
        if (!deleteEdgesMode)
            return null; // reject if we can't delete the edges
        // it is likely that the delete_edges mode is listening to the same keyup event we
        // are. introduce a pause to let it process the delete key now, deleting any selected edges.
        // then select any remaining edges connected to the selected nodes and delete those.
        //
        // more evidence that modes need to be able to say "i got this", or that we should have
        // batch deletion. otoh, given the current behavior, delete_nodes deferring to delete_edges
        // makes about as much sense as anything
        return Promise.resolve(undefined).then(() => {
            const deleteEdges = diagram.edgeGroup().all().filter(e =>
                nodes.indexOf(diagram.edgeSource()(e)) !== -1
                || nodes.indexOf(diagram.edgeTarget()(e)) !== -1
            ).map(diagram.edgeKey());
            select_edges_group.call('set_changed', null, deleteEdges);
            return deleteEdgesMode.deleteSelection().then(() => nodes);
        });
    });
    return _mode;
}

function drawClusters() {
    function apply_bounds(rect) {
        rect.attr('x', c => c.cola.bounds.left)
            .attr('y', c => c.cola.bounds.top)
            .attr('width', c => c.cola.bounds.right-c.cola.bounds.left)
            .attr('height', c => c.cola.bounds.bottom-c.cola.bounds.top);
    }
    function draw(diagram) {
        if (!diagram.clusterGroup())
            return;
        const clayer = diagram.g().selectAll('g.cluster-layer').data([0]);
        clayer.enter().insert('g', ':first-child')
            .attr('class', 'cluster-layer');
        const clusters = diagram.clusterGroup().all().map(kv =>
            _mode.parent().getWholeCluster(kv.key)
        ).filter(c => c && c.cola.bounds);
        const rects = clayer.selectAll('rect.cluster')
            .data(clusters, c => c.orig.key);
        rects.exit().remove();
        rects.enter().append('rect')
            .attr('class', 'cluster')
            .attr('opacity', 0)
            .attr('stroke', _mode.clusterStroke.eval)
            .attr('stroke-width', _mode.clusterStrokeWidth.eval)
            .attr('fill', c => _mode.clusterFill.eval(c) || 'none')
            .call(apply_bounds);
        rects.transition()
            .duration(_mode.parent().stagedDuration())
            .attr('opacity', _mode.clusterOpacity.eval)
            .call(apply_bounds);
    }
    function remove(_diagram, _node, _edge, _ehover) {
    }
    const _mode = mode('draw-clusters', {
        laterDraw: true,
        draw,
        remove,
    });
    _mode.clusterOpacity = property(0.25);
    _mode.clusterStroke = property('black');
    _mode.clusterStrokeWidth = property(1);
    _mode.clusterFill = property(null);
    _mode.clusterLabel = property(null);
    _mode.clusterLabelFill = property('black');
    _mode.clusterLabelAlignment = property(['bottom', 'right']);

    return _mode;
}

function fixNodes(options) {
    options = options || {};
    const fix_nodes_group = fixNodesGroup(options.fix_nodes_group || 'fix-nodes-group');
    const _fixedPosTag = options.fixedPosTag || 'fixedPos';
    let _fixes = [], _nodes, _wnodes;

    const _execute = {
        nodeid(n) {
            return _mode.parent().nodeKey.eval(n);
        },
        sourceid(e) {
            return _mode.parent().edgeSource.eval(e);
        },
        targetid(e) {
            return _mode.parent().edgeTarget.eval(e);
        },
        get_fix(n) {
            return _mode.parent().nodeFixed.eval(n);
        },
        fix_node(n, pos) {
            n[_fixedPosTag] = pos;
        },
        unfix_node(n) {
            n[_fixedPosTag] = null;
        },
        clear_fixes() {
            _fixes = {};
        },
        register_fix(id, pos) {
            _fixes[id] = pos;
        },
    };

    function request_fixes(fixes) {
        _mode.strategy().request_fixes(_execute, fixes);
        tell_then_set(find_changes()).then(() => {
            _mode.parent().redraw();
        });
    }
    function new_node(nid, n, pos) {
        _mode.strategy().new_node(_execute, nid, n, pos);
    }
    function new_edge(eid, sourceid, targetid) {
        const source = _nodes[sourceid], target = _nodes[targetid];
        _mode.strategy().new_edge(_execute, eid, source, target);
    }
    function find_changes() {
        const changes = [];
        _wnodes.forEach(n => {
            const key = _mode.parent().nodeKey.eval(n),
                fixPos = _fixes[key];
            const oldFixed = n.orig.value[_fixedPosTag];
            let changed = false;
            if (oldFixed) {
                if (!fixPos || fixPos.x !== oldFixed.x || fixPos.y !== oldFixed.y)
                    changed = true;
            } else changed = fixPos;
            if (changed)
                changes.push({n, fixed: fixPos ? {x: fixPos.x, y: fixPos.y} : null});
        });
        return changes;
    }
    function execute_change(n, fixed) {
        if (fixed)
            _execute.fix_node(n.orig.value, fixed);
        else
            _execute.unfix_node(n.orig.value);
    }
    function tell_then_set(changes) {
        const callback = _mode.fixNode() || function(n, pos) {
            return Promise.resolve(pos);
        };
        const promises = changes.map(change => {
            const key = _mode.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed)
                .then(fixed => {
                    execute_change(change.n, fixed);
                });
        });
        return Promise.all(promises);
    }
    function set_changes(changes) {
        changes.forEach(change => {
            execute_change(change.n, change.fixed);
        });
    }
    function tell_changes(changes) {
        const callback = _mode.fixNode() || function(n, pos) {
            return Promise.resolve(pos);
        };
        const promises = changes.map(change => {
            const key = _mode.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed);
        });
        return Promise.all(promises);
    }
    function fix_all_nodes(tell) {
        if (tell === undefined)
            tell = true;
        const changes = _wnodes.map(n => ({n, fixed: {x: n.cola.x, y: n.cola.y}}));
        if (tell)
            return tell_then_set(changes);
        else {
            set_changes(changes);
            return Promise.resolve(undefined);
        }
    }
    function clear_fixes() {
        _mode.strategy().clear_all_fixes && _mode.strategy().clear_all_fixes();
        _execute.clear_fixes();
    }
    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        console.assert(
            Array.isArray(wnodes),
            'fix_nodes.on_data: wnodes should be an array, got:',
            wnodes,
        );
        _nodes = nodes;
        _wnodes = wnodes;
        if (_mode.strategy().on_data) {
            _mode.strategy().on_data(_execute, nodes, wnodes, edges, wedges, ports, wports); // ghastly
            const changes = find_changes();
            set_changes(changes);
            // can't wait for backend to acknowledge/approve so just set then blast
            if (_mode.reportOverridesAsynchronously())
                tell_changes(changes); // dangling promise
        }
    }

    const _mode = {
        parent: property(null).react(p => {
            fix_nodes_group
                .on('request_fixes.fix-nodes', p ? request_fixes : null)
                .on('new_node.fix_nodes', p ? new_node : null)
                .on('new_edge.fix_nodes', p ? new_edge : null);
            if (p) {
                p.on('data.fix-nodes', on_data);
            } else if (_mode.parent())
                _mode.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null),
        // save/load may want to nail everything / start from scratch
        // (should probably be automatic though)
        fixAllNodes: fix_all_nodes,
        clearFixes: clear_fixes,
        strategy: property(fixNodes.strategy.fixLast()),
        reportOverridesAsynchronously: property(true),
    };

    return _mode;
}

fixNodes.strategy = {};
fixNodes.strategy.fixLast = function() {
    return {
        request_fixes(exec, fixes) {
            exec.clear_fixes();
            fixes.forEach(fix => {
                exec.register_fix(fix.id, fix.pos);
            });
        },
        new_node(exec, nid, n, pos) {
            exec.fix_node(n, pos);
        },
        new_edge(exec, eid, source, target) {
            exec.unfix_node(source.orig.value);
            exec.unfix_node(target.orig.value);
        },
    };
};
fixNodes.strategy.lastNPerComponent = function(maxf) {
    maxf = maxf || 1;
    let _age = 0;
    let _allFixes = {};
    return {
        clear_all_fixes() {
            _allFixes = {};
        },
        request_fixes(exec, fixes) {
            ++_age;
            fixes.forEach(fix => {
                _allFixes[fix.id] = {id: fix.id, age: _age, pos: fix.pos};
            });
        },
        new_node(exec, nid, n, pos) {
            ++_age;
            _allFixes[nid] = {id: nid, age: _age, pos};
            exec.fix_node(n, pos);
        },
        new_edge() {},
        on_data(exec, nodes, wnodes, edges, wedges, _ports, _wports) {
            ++_age;
            // add any existing fixes as requests
            console.assert(
                Array.isArray(wnodes),
                'fix_nodes strategy.on_data: wnodes should be an array, got:',
                wnodes,
            );
            wnodes.forEach(n => {
                const nid = exec.nodeid(n), pos = exec.get_fix(n);
                if (pos && !_allFixes[nid])
                    _allFixes[nid] = {id: nid, age: _age, pos};
            });
            // determine components
            const components = [];
            const dfs = undirectedDfs({
                nodeid: exec.nodeid,
                sourceid: exec.sourceid,
                targetid: exec.targetid,
                comp() {
                    components.push([]);
                },
                node(compid, n) {
                    components[compid].push(n);
                },
            });
            dfs(wnodes, wedges);
            // start from scratch
            exec.clear_fixes();
            // keep or produce enough fixed nodes per component
            components.forEach((comp, i) => {
                const oldcomps = comp.reduce((cc, n) => {
                    if (n.last_component) {
                        const counts = cc[n.last_component] = cc[n.last_component] || {
                            total: 0,
                            fixed: 0,
                        };
                        counts.total++;
                        if (_allFixes[exec.nodeid(n)])
                            counts.fixed++;
                    }
                    return cc;
                }, {});
                const fixed_by_size = Object.keys(oldcomps).reduce((ff, compid) => {
                    if (oldcomps[compid].fixed)
                        ff.push({
                            compid: +compid,
                            total: oldcomps[compid].total,
                            fixed: oldcomps[compid].fixed,
                        });
                    return ff;
                }, []).sort((coa, cob) => cob.total-coa.total);
                const largest_fixed = fixed_by_size.length && fixed_by_size[0].compid;
                let fixes = comp.filter(n =>
                    !n.last_component || n.last_component === largest_fixed
                ).map(n => _allFixes[exec.nodeid(n)]).filter(fix => fix);
                if (fixes.length > maxf) {
                    fixes.sort((f1, f2) => f2.age-f1.age);
                    fixes = fixes.slice(0, maxf);
                }
                fixes.forEach(fix => {
                    exec.register_fix(fix.id, fix.pos);
                });
                const kept = fixes.reduce((m, fix) => {
                    m[fix.id] = true;
                    return m;
                }, {});
                comp.forEach(n => {
                    const nid = exec.nodeid(n);
                    if (!kept[nid])
                        _allFixes[nid] = null;
                    n.last_component = i+1;
                });
            });
        },
    };
};

function fixNodesGroup(brushgroup) {
    window.chart_registry.create_type(
        'fix-nodes',
        () => dispatch('request_fixes', 'new_node', 'new_edge'),
    );

    return window.chart_registry.create_group('fix-nodes', brushgroup);
}

// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652


function editText(parent, options) {
    const foreign = parent.append('foreignObject')
        .attr('height', '100%')
        .attr('width', '100%'); // don't wrap
    const padding = options.padding !== undefined ? options.padding : 2;
    function reposition() {
        let pos;
        switch (options.align) {
            case 'left':
                pos = [options.box.x-padding, options.box.y-padding];
                break;
            default:
            case 'center':
                pos = [
                    options.box.x+(options.box.width-textdiv.node().offsetWidth)/2,
                    options.box.y+(options.box.height-textdiv.node().offsetHeight)/2,
                ];
                break;
        }
        foreign.attr('transform', `translate(${pos.join(' ')})`);
    }
    const textdiv = foreign.append('xhtml:div');
    const text = options.text || 'type on me';
    textdiv.text(text)
        .attr('contenteditable', true)
        .attr('width', 'auto')
        .attr('class', options.class || null).style({
            display: 'inline-block',
            'background-color': 'white',
            padding: `${padding}px`,
        });

    function stopProp() {
        event.stopPropagation();
    }
    foreign
        .on('mousedown.edit-text', stopProp)
        .on('mousemove.edit-text', stopProp)
        .on('mouseup.edit-text', stopProp)
        .on('dblclick.edit-text', stopProp);

    function accept() {
        options.accept && options.accept(textdiv.text());
        textdiv.on('blur.edit-text', null);
        foreign.remove();
        options.finally && options.finally();
    }
    function cancel() {
        options.cancel && options.cancel();
        textdiv.on('blur.edit-text', null);
        foreign.remove();
        options.finally && options.finally();
    }

    textdiv.on('keydown.edit-text', () => {
        // prevent keyboard mode from seeing this (especially delete key!)
        event.stopPropagation();
        if (event.keyCode === 13) {
            event.preventDefault();
        }
    }).on('keyup.edit-text', () => {
        event.stopPropagation();
        if (event.keyCode === 13) {
            accept();
        } else if (event.keyCode === 27) {
            cancel();
        }
        reposition();
    }).on('blur.edit-text', cancel);
    reposition();
    textdiv.node().focus();

    const range = document.createRange();
    if (options.selectText) {
        range.selectNodeContents(textdiv.node());
    } else {
        range.setStart(textdiv.node(), 1);
        range.setEnd(textdiv.node(), 1);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function labelThings(options) {
    options = options || {};
    const select_things_group = selectThingsGroup(options.select_group, options.select_type),
        label_things_group = labelThingsGroup(options.label_group, options.label_type);
    let _selected = [];
    let _keyboard, _selectThings;

    function selection_changed_listener(_diagram) {
        return function(selection) {
            _selected = selection;
        };
    }

    function edit_label_listener(diagram) {
        return function(thing, eventOptions) {
            const box = options.thing_box(thing);
            options.hide_thing_label(thing, true);
            editText(
                diagram.g(),
                {
                    text: eventOptions.text || options.thing_label(thing) || options.default_label,
                    align: options.align,
                    class: options.class,
                    box,
                    selectText: eventOptions.selectText,
                    accept(text) {
                        return options.accept(thing, text);
                    },
                    finally() {
                        options.hide_thing_label(thing, false);
                    },
                },
            );
        };
    }

    function edit_selection(node, edge, eventOptions) {
        // less than ideal interface.
        // what if there are other things? can i blame the missing metagraph?
        const thing = options.find_thing(_selected[0], node, edge);
        if (thing.empty()) {
            console.error(`couldn't find thing '${_selected[0]}'!`);
            return;
        }
        if (thing.size() > 1) {
            console.error(`found too many things for '${_selected[0]}' (${thing.size()})!`);
            return;
        }
        label_things_group.call('edit_label', null, thing, eventOptions);
    }
    function draw(diagram, node, edge) {
        _keyboard.on(`keyup.${options.label_type}`, () => {
            if (_selected.length) {
                // printable characters should start edit
                if (event.key.length !== 1)
                    return;
                edit_selection(node, edge, {text: event.key, selectText: false});
            }
        });
        if (_selectThings)
            _selectThings.thinginess().clickables(diagram, node, edge).on(
                `dblclick.${options.label_type}`,
                () => {
                    edit_selection(node, edge, {selectText: true});
                },
            );
    }

    function remove(_diagram, _node, _edge) {
    }

    const _mode = mode(options.label_type, {
        draw,
        remove,
        parent(p) {
            select_things_group.on(
                `set_changed.${options.label_type}`,
                p ? selection_changed_listener() : null,
            );
            label_things_group.on(
                `edit_label.${options.label_type}`,
                p ? edit_label_listener(p) : null,
            );
            if (p) {
                _keyboard = p.child('keyboard');
                if (!_keyboard)
                    p.child('keyboard', _keyboard = keyboard());
                _selectThings = p.child(options.select_type);
            }
        },
    });
    _mode.editSelection = function(eventOptions) {
        edit_selection(
            _mode.parent().selectAllNodes(),
            _mode.parent().selectAllEdges(),
            eventOptions,
        );
    };
    return _mode;
}

function labelThingsGroup(brushgroup, type) {
    window.chart_registry.create_type(type, () => dispatch('edit_label'));

    return window.chart_registry.create_group(type, brushgroup);
}

function drawGraphs(options) {
    const select_nodes_group = selectThingsGroup(
            options.select_nodes_group || 'select-nodes-group',
            'select-nodes',
        ),
        select_edges_group = selectThingsGroup(
            options.select_edges_group || 'select-edges-group',
            'select-edges',
        );
        labelThingsGroup('label-nodes-group', 'label-nodes');
        labelThingsGroup('label-edges-group', 'label-edges');
        const fix_nodes_group = fixNodesGroup('fix-nodes-group');
    const _nodeIdTag = options.idTag || 'id',
        _edgeIdTag = options.edgeIdTag || _nodeIdTag,
        _sourceTag = options.sourceTag || 'source',
        _targetTag = options.targetTag || 'target',
        _nodeLabelTag = options.labelTag || 'label',
        _edgeLabelTag = options.edgeLabelTag || _nodeLabelTag;

    let _sourceDown = null,
        _targetMove = null,
        _targetValid = false,
        _edgeLayer = null,
        _hintData = [],
        _crossout;

    function update_hint() {
        const data = _hintData.filter(h => h.source && h.target);
        let line = _edgeLayer.selectAll('line.hint-edge').data(data);
        line.exit().remove();
        const lineEnter = line.enter().append('line')
            .attr('class', 'hint-edge')
            .attr('stroke', _mode.hintStroke())
            .style('fill', 'none')
            .style('pointer-events', 'none');

        line = lineEnter.merge(line);

        line.attr('x1', n => n.source.x)
            .attr('y1', n => n.source.y)
            .attr('x2', n => n.target.x)
            .attr('y2', n => n.target.y);
    }

    function port_pos(p) {
        const style = _mode.parent().portStyle(_mode.parent().portStyleName.eval(p));
        const pos = style.portPosition(p);
        pos.x += p.node.cola.x;
        pos.y += p.node.cola.y;
        return pos;
    }

    function update_crossout() {
        let data;
        if (_crossout) {
            if (_mode.usePorts())
                data = [port_pos(_crossout)];
            else
                data = [{x: _crossout.node.cola.x, y: _crossout.node.cola.y}];
        } else data = [];

        const size = _mode.crossSize(), wid = _mode.crossWidth();
        let cross = _edgeLayer.selectAll('polygon.graph-draw-crossout').data(data);
        cross.exit().remove();
        const crossEnter = cross.enter().append('polygon')
            .attr('class', 'graph-draw-crossout');
        cross = cross.merge(crossEnter);
        cross
            .attr('points', d => {
                const x = d.x, y = d.y;
                return [
                    [x-size/2, y+size/2],
                    [x-size/2+wid, y+size/2],
                    [x, y+wid/2],
                    [x+size/2-wid, y+size/2],
                    [x+size/2, y+size/2],
                    [x+wid/2, y],
                    [x+size/2, y-size/2],
                    [x+size/2-wid, y-size/2],
                    [x, y-wid/2],
                    [x-size/2+wid, y-size/2],
                    [x-size/2, y-size/2],
                    [x-wid/2, y],
                ]
                    .map(p => p.join(','))
                    .join(' ');
            });
    }
    function erase_hint() {
        _hintData = [];
        _targetValid = false;
        _sourceDown = _targetMove = null;
        update_hint();
    }

    function create_node(diagram, pos, data) {
        if (!_mode.nodeCrossfilter())
            throw new Error('need nodeCrossfilter');
        let node;
        const callback = _mode.addNode() || promiseIdentity;
        if (data)
            node = data;
        else {
            node = {};
            node[_nodeIdTag] = uuid();
            node[_nodeLabelTag] = '';
        }
        if (pos)
            fix_nodes_group.call('new_node', null, node[_nodeIdTag], node, {x: pos[0], y: pos[1]});
        callback(node).then(node2 => {
            if (!node2)
                return;
            _mode.nodeCrossfilter().add([node2]);
            diagram.redrawGroup();
            select_nodes_group.call('set_changed', null, [node2[_nodeIdTag]]);
        });
    }

    function create_edge(diagram, source, target) {
        if (!_mode.edgeCrossfilter())
            throw new Error('need edgeCrossfilter');
        const edge = {}, callback = _mode.addEdge() || promiseIdentity;
        edge[_edgeIdTag] = uuid();
        edge[_edgeLabelTag] = '';
        if (
            _mode.conduct().detectReversedEdge
            && _mode.conduct().detectReversedEdge(edge, source.port, target.port)
        ) {
            edge[_sourceTag] = target.node.orig.key;
            edge[_targetTag] = source.node.orig.key;
            const t = source;
            source = target;
            target = t;
        } else {
            edge[_sourceTag] = source.node.orig.key;
            edge[_targetTag] = target.node.orig.key;
        }
        callback(edge, source.port, target.port).then(edge2 => {
            if (!edge2)
                return;
            fix_nodes_group.call(
                'new_edge',
                null,
                edge[_edgeIdTag],
                edge2[_sourceTag],
                edge2[_targetTag],
            );
            _mode.edgeCrossfilter().add([edge2]);
            select_nodes_group.call('set_changed', null, [], false);
            select_edges_group.call('set_changed', null, [edge2[_edgeIdTag]], false);
            diagram.redrawGroup();
        });
    }

    function check_invalid_drag(coords, event) {
        let msg;
        if (!(event.buttons&1)) {
            // mouse button was released but we missed it
            _crossout = null;
            if (_mode.conduct().cancelDragEdge)
                _mode.conduct().cancelDragEdge(_sourceDown);
            erase_hint();
            update_crossout();
            return true;
        }
        if (
            !_sourceDown.started
            && Math.hypot(coords[0]-_hintData[0].source.x, coords[1]-_hintData[0].source.y)
                > _mode.dragSize()
        ) {
            if (_mode.conduct().startDragEdge) {
                if (_mode.conduct().startDragEdge(_sourceDown)) {
                    _sourceDown.started = true;
                } else {
                    if (_mode.conduct().invalidSourceMessage) {
                        msg = _mode.conduct().invalidSourceMessage(_sourceDown);
                        if (options.negativeTip) {
                            options.negativeTip
                                .content(() => msg)
                                .displayTip(_mode.usePorts() ? _sourceDown.port : _sourceDown.node);
                        }
                    }
                    erase_hint();
                    return true;
                }
            }
        }
        return false;
    }

    function draw(diagram, node, _edge, _ehover) {
        const select_nodes = diagram.child('select-nodes');
        if (select_nodes) {
            if (_mode.clickCreatesNodes())
                select_nodes.clickBackgroundClears(false);
        }
        node
            .on('mousedown.draw-graphs', n => {
                event.stopPropagation();
                if (!_mode.dragCreatesEdges())
                    return;
                if (options.tipsDisable)
                    options.tipsDisable.forEach(tip => {
                        tip
                            .hideTip()
                            .disabled(true);
                    });
                if (_mode.usePorts()) {
                    let activePort;
                    if (typeof _mode.usePorts() === 'object' && _mode.usePorts().eventPort)
                        activePort = _mode.usePorts().eventPort(event);
                    else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'out')
                            || diagram.getPort(diagram.nodeKey.eval(n), null, 'in');
                    if (!activePort)
                        return;
                    _sourceDown = {node: n, port: activePort};
                    _hintData = [{source: port_pos(activePort)}];
                } else {
                    _sourceDown = {node: n};
                    _hintData = [{
                        source: {x: _sourceDown.node.cola.x, y: _sourceDown.node.cola.y},
                    }];
                }
            })
            .on('mousemove.draw-graphs', n => {
                let msg;
                event.stopPropagation();
                if (_sourceDown) {
                    const coords = eventCoords(diagram, event);
                    if (check_invalid_drag(coords, event))
                        return;
                    const oldTarget = _targetMove;
                    if (n === _sourceDown.node) {
                        _mode.conduct().invalidTargetMessage
                            && console.log(
                                _mode.conduct().invalidTargetMessage(_sourceDown, _sourceDown),
                            );
                        _targetMove = null;
                        _hintData[0].target = null;
                    } else if (_mode.usePorts()) {
                        let activePort;
                        if (typeof _mode.usePorts() === 'object' && _mode.usePorts().eventPort)
                            activePort = _mode.usePorts().eventPort(event);
                        else activePort = diagram.getPort(diagram.nodeKey.eval(n), null, 'in')
                                || diagram.getPort(diagram.nodeKey.eval(n), null, 'out');
                        if (activePort)
                            _targetMove = {node: n, port: activePort};
                        else
                            _targetMove = null;
                    } else if (!_targetMove || n !== _targetMove.node) {
                        _targetMove = {node: n};
                    }
                    if (_mode.conduct().changeDragTarget) {
                        let change;
                        if (_mode.usePorts()) {
                            const oldPort = oldTarget && oldTarget.port,
                                newPort = _targetMove && _targetMove.port;
                            change = oldPort !== newPort;
                        } else {
                            const oldNode = oldTarget && oldTarget.node,
                                newNode = _targetMove && _targetMove.node;
                            change = oldNode !== newNode;
                        }
                        if (change) {
                            if (_mode.conduct().changeDragTarget(_sourceDown, _targetMove)) {
                                _crossout = null;
                                if (options.negativeTip)
                                    options.negativeTip.hideTip();
                                msg = _mode.conduct().validTargetMessage
                                        && _mode.conduct().validTargetMessage()
                                    || 'matches';
                                if (options.positiveTip) {
                                    options.positiveTip
                                        .content(() => msg)
                                        .displayTip(
                                            _mode.usePorts() ? _targetMove.port : _targetMove.node,
                                        );
                                }
                                _targetValid = true;
                            } else {
                                _crossout = _mode.usePorts()
                                    ? _targetMove && _targetMove.port
                                    : _targetMove && _targetMove.node;
                                if (_targetMove && _mode.conduct().invalidTargetMessage) {
                                    if (options.positiveTip)
                                        options.positiveTip.hideTip();
                                    msg = _mode.conduct().invalidTargetMessage(
                                        _sourceDown,
                                        _targetMove,
                                    );
                                    if (options.negativeTip) {
                                        options.negativeTip
                                            .content(() => msg)
                                            .displayTip(
                                                _mode.usePorts()
                                                    ? _targetMove.port
                                                    : _targetMove.node,
                                            );
                                    }
                                }
                                _targetValid = false;
                            }
                        }
                    } else _targetValid = true;
                    if (_targetMove) {
                        if (_targetMove.port)
                            _hintData[0].target = port_pos(_targetMove.port);
                        else
                            _hintData[0].target = {x: n.cola.x, y: n.cola.y};
                    } else {
                        _hintData[0].target = {x: coords[0], y: coords[1]};
                    }
                    update_hint();
                    update_crossout();
                }
            })
            .on('mouseup.draw-graphs', _n => {
                _crossout = null;
                if (options.negativeTip)
                    options.negativeTip.hideTip(true);
                if (options.positiveTip)
                    options.positiveTip.hideTip(true);
                if (options.tipsDisable)
                    options.tipsDisable.forEach(tip => {
                        tip.disabled(false);
                    });
                if (_sourceDown && _targetValid) {
                    let finishPromise;
                    if (_mode.conduct().finishDragEdge)
                        finishPromise = _mode.conduct().finishDragEdge(_sourceDown, _targetMove);
                    else finishPromise = Promise.resolve(true);
                    const source = _sourceDown, target = _targetMove;
                    finishPromise.then(ok => {
                        if (ok)
                            create_edge(diagram, source, target);
                    });
                } else if (_sourceDown) {
                    if (_mode.conduct().cancelDragEdge)
                        _mode.conduct().cancelDragEdge(_sourceDown);
                }
                erase_hint();
                update_crossout();
            });

        diagram.svg()
            .on('mousedown.draw-graphs', () => {
                _sourceDown = null;
            })
            .on('mousemove.draw-graphs', () => {
                if (_sourceDown) { // drawing edge
                    const coords = eventCoords(diagram, event);
                    _crossout = null;
                    if (check_invalid_drag(coords, event))
                        return;
                    if (_mode.conduct().dragCanvas)
                        _mode.conduct().dragCanvas(_sourceDown, coords);
                    if (_mode.conduct().changeDragTarget && _targetMove)
                        _mode.conduct().changeDragTarget(_sourceDown, null);
                    _targetMove = null;
                    _hintData[0].target = {x: coords[0], y: coords[1]};
                    update_hint();
                    update_crossout();
                }
            })
            .on('mouseup.draw-graphs', () => {
                _crossout = null;
                if (options.negativeTip)
                    options.negativeTip.hideTip(true);
                if (options.positiveTip)
                    options.positiveTip.hideTip(true);
                if (options.tipsDisable)
                    options.tipsDisable.forEach(tip => {
                        tip.disabled(false);
                    });
                if (_sourceDown) { // drag-edge
                    if (_mode.conduct().cancelDragEdge)
                        _mode.conduct().cancelDragEdge(_sourceDown);
                    erase_hint();
                } else { // click-node
                    if (event.target === event.currentTarget && _mode.clickCreatesNodes())
                        create_node(diagram, eventCoords(diagram, event));
                }
                update_crossout();
            });
        const diagramG = diagram.g();

        const edgeLayerSelection = diagramG.selectAll('g.draw-graphs')
            .data([1]);
        _edgeLayer = edgeLayerSelection.enter().append('g')
            .attr('class', 'draw-graphs')
            .merge(edgeLayerSelection);
    }

    function remove(diagram, node, _edge, _ehover) {
        node
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
        diagram.svg()
            .on('mousedown.draw-graphs', null)
            .on('mousemove.draw-graphs', null)
            .on('mouseup.draw-graphs', null);
    }

    const _mode = mode('highlight-paths', {
        draw,
        remove,
    });

    // update the data source/destination
    _mode.nodeCrossfilter = property(options.nodeCrossfilter);
    _mode.edgeCrossfilter = property(options.edgeCrossfilter);

    // modeal options
    _mode.usePorts = property(null);
    _mode.clickCreatesNodes = property(true);
    _mode.dragCreatesEdges = property(true);
    _mode.dragSize = property(5);

    // draw attributes of indicator for failed edge
    _mode.crossSize = property(15);
    _mode.crossWidth = property(5);

    // hint line stroke color
    _mode.hintStroke = property('black');

    // really this is a behavior or strategy
    _mode.conduct = property({});

    // callbacks to modify data as it's being added
    // as of 0.6, function returns a promise of the new data
    _mode.addNode = property(null); // node -> promise(node2)
    _mode.addEdge = property(null); // edge, sourceport, targetport -> promise(edge2)

    // or, if you want to drive..
    _mode.createNode = function(pos, data) {
        create_node(_mode.parent(), pos, data);
    };

    return _mode;
}

function dropdown() {
    dropdown.unique_id = (dropdown.unique_id || 16)+1;
    const _dropdown = {
        id: `id${dropdown.unique_id}`,
        parent: property(null),
        show(key, x, y) {
            const dropdown = _dropdown.parent().root()
                .selectAll(`div.dropdown.${_dropdown.id}`).data([0]);
            const dropdownEnter = dropdown
                .enter().append('div')
                .attr('class', `dropdown ${_dropdown.id}`);
            dropdown
                .style('visibility', 'visible')
                .style('left', `${x}px`)
                .style('top', `${y}px`);
            let capture;
            const hides = _dropdown.hideOn().split('|');
            const selects = _dropdown.selectOn().split('|');
            if (hides.includes('leave'))
                dropdown.on('mouseleave', () => {
                    dropdown.style('visibility', 'hidden');
                });
            else if (hides.includes('clickout')) {
                const diagram = _dropdown.parent();
                capture = diagram.svg().append('rect')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('width', diagram.width())
                    .attr('height', diagram.height())
                    .attr('opacity', 0)
                    .on('click', () => {
                        capture.remove();
                        dropdown.style('visibility', 'hidden');
                    });
            }
            let container = dropdown;
            if (_dropdown.scrollHeight()) {
                let height = _dropdown.scrollHeight();
                if (typeof height === 'number')
                    height = `${height}px`;
                dropdown
                    .style('max-height', height)
                    .property('scrollTop', 0);
                dropdownEnter
                    .style('overflow-y', 'auto')
                    .append('div')
                    .attr('class', 'scroller');
                container = dropdown.selectAll('div.scroller');
            }
            _dropdown.fetchValues()(key, values => {
                const items = container
                    .selectAll('div.dropdown-item').data(values);
                items
                    .enter().append('div')
                    .attr('class', 'dropdown-item');
                items.exit().remove();
                let select_event = null;
                if (selects.includes('click'))
                    select_event = 'click';
                else if (selects.includes('hover'))
                    select_event = 'mouseenter';
                items
                    .text(item => _dropdown.itemText()(item));
                if (select_event) {
                    items
                        .on(`${select_event}.select`, d => {
                            _dropdown.itemSelected()(d);
                        });
                }
                if (hides.includes('clickitem')) {
                    items
                        .on('click.hide', _d => {
                            capture.remove();
                            dropdown.style('visibility', 'hidden');
                        });
                }
            });
        },
        hideOn: property('clickout|clickitem'),
        selectOn: property('click'),
        height: property(10),
        itemText: property(x => x),
        itemSelected: property(() => {}),
        fetchValues: property((key, k) => {
            k([]);
        }),
        scrollHeight: property('12em'),
    };
    return _dropdown;
}

// External dependencies

function registerHighlightThingsGroup(thingsgroup) {
    window.chart_registry.create_type('highlight-things', () => dispatch('highlight'));

    return window.chart_registry.create_group('highlight-things', thingsgroup);
}

function expandedHidden(opts) {
    const options = Object.assign({
        nodeKey(n) {
            return n.key;
        },
        edgeKey(e) {
            return e.key;
        },
        edgeSource(e) {
            return e.value.source;
        },
        edgeTarget(e) {
            return e.value.target;
        },
    }, opts);
    const _nodeHidden = {}, _edgeHidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    const _nodeDim = options.nodeCrossfilter.dimension(options.nodeKey),
        _edgeDim = options.edgeCrossfilter && options.edgeCrossfilter.dimension(options.edgeRawKey);

    function get_shown(expanded) {
        return Object.keys(expanded).reduce(
            (p, dir) =>
                Array.from(expanded[dir]).reduce((p, nk) => {
                    p[nk] = true;
                    let list;
                    switch (dir) {
                        case 'in':
                            list = in_edges(nk).map(e => options.edgeSource(e));
                            break;
                        case 'out':
                            list = out_edges(nk).map(e => options.edgeTarget(e));
                            break;
                        case 'both':
                            list = adjacent_nodes(nk);
                            break;
                    }
                    list.forEach(nk2 => {
                        if (!_nodeHidden[nk2])
                            p[nk2] = true;
                    });
                    return p;
                }, p),
            {},
        );
    }
    function apply_filter(ec) {
        const _shown = get_shown(ec.getExpanded());
        _nodeDim.filterFunction(nk => _shown[nk]);
        _edgeDim && _edgeDim.filterFunction(ek => !_edgeHidden[ek]);
    }
    function adjacent_edges(nk) {
        return options.edgeGroup.all().filter(e =>
            options.edgeSource(e) === nk || options.edgeTarget(e) === nk
        );
    }
    function out_edges(nk) {
        return options.edgeGroup.all().filter(e => options.edgeSource(e) === nk);
    }
    function in_edges(nk) {
        return options.edgeGroup.all().filter(e => options.edgeTarget(e) === nk);
    }
    const other_node = (e, nk) =>
        options.edgeSource(e) === nk ? options.edgeTarget(e) : options.edgeSource(e);
    function adjacent_nodes(nk) {
        return adjacent_edges(nk).map(e => other_node(e, nk));
    }

    const dfs_pre_order = (nk, seen, traverse, other, fall, funseen, pe = null, pres = null) => {
        fall(pe, pres, nk);
        if (seen.has(nk))
            return;
        seen.add(nk);
        const nres = funseen(pe, pres, nk);
        for (const e of traverse(nk))
            dfs_pre_order(other(e, nk), seen, traverse, other, fall, funseen, e, nres);
    };

    const _strategy = {
        get_edges(nk, dir) {
            switch (dir) {
                case 'in':
                    return in_edges(nk);
                case 'out':
                    return out_edges(nk);
                case 'both':
                    return adjacent_edges(nk);
                default:
                    throw new Error(`unknown dir ${dir}`);
            }
        },
        get_tree_edges: (nk, dir, once = false) => {
            const traverse = dir === 'in'
                ? in_edges
                : dir === 'out'
                ? out_edges
                : adjacent_edges;
            const other = dir === 'in'
                ? options.edgeSource
                : dir === 'out'
                ? options.edgeTarget
                : other_node;
            if (once) {
                const edges = traverse(nk),
                    nks = edges.map(other);
                return {[nk]: {edges, nks}};
            }
            const nodes = {}, seen = new Set();
            dfs_pre_order(nk, seen, traverse, other, (pe, pres, nk) => {
                if (pres) {
                    pres.edges.push(pe);
                    pres.nks.push(nk);
                }
            }, (pe, pres, nk) => nodes[nk] = {edges: [], nks: []});
            return nodes;
        },
        partition_among_visible: (_tree_edges, _visible_nodes) => {
        },
        refresh() {
            apply_filter(_strategy.expandCollapse());
            redrawAll();
            return this;
        },
        collapsibles(nks, dir) {
            const expanded = _strategy.expandCollapse().getExpanded();
            const whatif = structuredClone(expanded);
            nks.forEach(
                nk => whatif[dir].delete(nk),
            );
            const shown = get_shown(expanded), would = get_shown(whatif);
            const going = Object.keys(shown)
                .filter(nk2 => !would[nk2])
                .reduce((p, v) => {
                    p[v] = true;
                    return p;
                }, {});
            return {
                nodes: going,
                edges: options.edgeGroup.all().filter(e =>
                    going[options.edgeSource(e)] || going[options.edgeTarget(e)]
                ).reduce((p, e) => {
                    p[options.edgeKey(e)] = true;
                    return p;
                }, {}),
            };
        },
        hideNode(nk) {
            _nodeHidden[nk] = true;
            _strategy.expandCollapse().expand('both', [nk], false);
        },
        hideEdge(ek) {
            if (!options.edgeCrossfilter)
                console.warn('expanded_hidden needs edgeCrossfilter to hide edges');
            _edgeHidden[ek] = true;
            apply_filter(_strategy.expandCollapse());
            redrawAll();
        },
        expandCollapse: property(null).react(ec => {
            if (ec)
                apply_filter(ec);
        }),
    };
    if (options.directional)
        _strategy.dirs = ['out', 'in'];
    return _strategy;
}

function expandCollapse(options) {
    if (typeof options === 'function') {
        options = {
            get_degree: arguments[0],
            expand: arguments[1],
            collapse: arguments[2],
            dirs: arguments[3],
        };
    }
    let _keyboard, _overNode, _overDir, _overEdge, _changing, _ignore = null;
    const _expanded = {};
    const changing_highlight_group = registerHighlightThingsGroup(
        options.changing_highlight_group || 'changing-highlight-group',
    );
    const expanded_highlight_group = registerHighlightThingsGroup(
        options.expanded_highlight_group || 'expanded-highlight-group',
    );
    const collapse_highlight_group = registerHighlightThingsGroup(
        options.collapse_highlight_group || 'collapse-highlight-group',
    );
    const hide_highlight_group = registerHighlightThingsGroup(
        options.hide_highlight_group || 'hide-highlight-group',
    );
    options.dirs = options.dirs || ['both'];
    options.dirs.forEach(dir => {
        _expanded[dir] = new Set();
    });
    options.hideKey = options.hideKey || 'Alt';
    options.recurseKey = options.recurseKey || 'Shift';
    options.linkKey = options.linkKey || (is_a_mac ? 'Meta' : 'Control');
    if (options.dirs.length > 2)
        throw new Error('there are only two directions to expand in');

    const _gradients_added = {};
    function add_gradient_def(color, diagram) {
        if (_gradients_added[color])
            return;
        _gradients_added[color] = true;
        diagram.addOrRemoveDef(`spike-gradient-${color}`, true, 'linearGradient', gradient => {
            gradient.attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '0%')
                .attr('spreadMethod', 'pad');
            gradient.selectAll('stop').data([[0, color, 1], [100, color, '0']])
                .enter().append('stop')
                .attr('offset', d => `${d[0]}%`)
                .attr('stop-color', d => d[1])
                .attr('stop-opacity', d => d[2]);
        });
    }

    function visible_edges(diagram, edge, dir, key) {
        let fil;
        switch (dir) {
            case 'out':
                fil = function(e) {
                    return diagram.edgeSource.eval(e) === key;
                };
                break;
            case 'in':
                fil = function(e) {
                    return diagram.edgeTarget.eval(e) === key;
                };
                break;
            case 'both':
                fil = function(e) {
                    return diagram.edgeSource.eval(e) === key || diagram.edgeTarget.eval(e) === key;
                };
                break;
        }
        return edge.filter(fil).data();
    }

    const sweep_angle = (N, ofs, span = Math.PI) => i =>
        ofs+((N-1)*span/N)*(-0.5+(N > 1 ? i/(N-1) : 0)); // avoid 0/0

    function spike_directioner(rankdir, dir, N) {
        if (dir === 'both')
            return function(i) {
                return Math.PI*(2*i/N-0.5);
            };
        else {
            let ofs;
            switch (rankdir) {
                case 'LR':
                    ofs = 0;
                    break;
                case 'TB':
                    ofs = Math.PI/2;
                    break;
                case 'RL':
                    ofs = Math.PI;
                    break;
                case 'BT':
                    ofs = -Math.PI/2;
                    break;
            }
            if (dir === 'in')
                ofs += Math.PI;
            return sweep_angle(N, ofs);
        }
    }

    function produce_spikes_helper(cx, cy, rx, ry, a, spike, span, ret) {
        const dx = Math.cos(a)*rx,
            dy = Math.sin(a)*ry;
        const dash = {
            a: a*180/Math.PI,
            x: cx+dx,
            y: cy+dy,
            edge: spike.pe,
        };
        ret.push(dash);
        span *= 0.75;
        const sweep = sweep_angle(spike.children.length, a, span);
        for (const i of range(spike.children.length))
            produce_spikes_helper(
                cx+1.5*dx,
                cy+1.5*dy,
                rx,
                ry,
                sweep(i),
                spike.children[i],
                span,
                ret,
            );
    }

    function produce_spikes(diagram, n, spikeses) {
        const ret = [];
        Object.keys(spikeses).forEach(dir => {
            const sweep = spike_directioner(
                diagram.layoutEngine().rankdir(),
                dir,
                spikeses[dir].length,
            );
            for (const i of range(spikeses[dir].length))
                produce_spikes_helper(
                    0,
                    0,
                    n.dcg_rx*0.9,
                    n.dcg_ry*0.9,
                    sweep(i),
                    spikeses[dir][i],
                    Math.PI,
                    ret,
                );
        });
        return ret;
    }

    function draw_stubs(diagram, node, edge, n, spikeseses) {
        const spike = node
            .selectAll('g.spikes')
            .data(n2 =>
                spikeseses[diagram.nodeKey.eval(n2)]
                    ? [n2]
                    : []
            );
        spike.exit().remove();
        spike
            .enter().insert('g', ':first-child')
            .classed('spikes', true);
        const rect = spike
            .selectAll('rect.spike')
            .data(n => {
                const key = diagram.nodeKey.eval(n);
                return produce_spikes(diagram, n, spikeseses[key]);
            });
        rect
            .enter().append('rect')
            .classed('spike', true)
            .attr('width', 25)
            .attr('height', 3)
            .attr('rx', 1)
            .attr('ry', 1)
            .attr('x', 0)
            .attr('y', 0);
        rect.attr('fill', s => {
            const color = s.edge ? functorWrap$1(diagram.edgeStroke())(s.edge) : 'black';
            add_gradient_def(color, diagram);
            return `url(#spike-gradient-${color})`;
        })
            .attr('transform', d => `translate(${d.x},${d.y}) rotate(${d.a})`);
        rect.exit().remove();
    }

    function clear_stubs(diagram, node, edge) {
        draw_stubs(diagram, node, edge, null, {});
    }

    function zonedir(diagram, event, dirs, n) {
        if (dirs.length === 1) // we assume it's ['out', 'in']
            return dirs[0];
        const bound = diagram.root().node().getBoundingClientRect();
        const invert = diagram.invertCoord([event.clientX-bound.left, event.clientY-bound.top]),
            x = invert[0],
            y = invert[1];
        switch (diagram.layoutEngine().rankdir()) {
            case 'TB':
                return y > n.cola.y ? 'out' : 'in';
            case 'BT':
                return y < n.cola.y ? 'out' : 'in';
            case 'LR':
                return x > n.cola.x ? 'out' : 'in';
            case 'RL':
                return x < n.cola.x ? 'out' : 'in';
        }
        throw new Error(`unknown rankdir ${diagram.layoutEngine().rankdir()}`);
    }

    function detect_key(key, event) {
        switch (key) {
            case 'Alt':
                return event.altKey;
            case 'Meta':
                return event.metaKey;
            case 'Shift':
                return event.shiftKey;
            case 'Control':
                return event.ctrlKey;
        }
        return false;
    }

    function highlight_hiding_node(diagram, n, edge) {
        const nk = diagram.nodeKey.eval(n);
        const hide_nodes_set = {}, hide_edges_set = {};
        hide_nodes_set[nk] = true;
        edge.each(e => {
            if (diagram.edgeSource.eval(e) === nk || diagram.edgeTarget.eval(e) === nk)
                hide_edges_set[diagram.edgeKey.eval(e)] = true;
        });
        hide_highlight_group.call('highlight', null, hide_nodes_set, hide_edges_set);
    }
    function highlight_hiding_edge(diagram, e) {
        const hide_edges_set = {};
        hide_edges_set[diagram.edgeKey.eval(e)] = true;
        hide_highlight_group.call('highlight', null, {}, hide_edges_set);
    }

    function partition_among_visible(tree_edges, visible, parts, nk, pe = null, seen = new Set()) {
        if (seen.has(nk))
            return [];
        seen.add(nk);
        let children = tree_edges[nk].nks
            .filter(nk => !seen.has(nk))
            .flatMap((nk2, i) =>
                partition_among_visible(
                    tree_edges,
                    visible,
                    parts,
                    nk2,
                    tree_edges[nk].edges[i],
                    seen,
                )
            )
            .filter(({nk}) => !visible.has(nk));
        if (visible.has(nk)) {
            parts[nk] = children;
            children = [];
        }
        return [{pe, nk, children}];
    }

    function highlight_expand_collapse(diagram, n, node, edge, dir, recurse) {
        const nk = diagram.nodeKey.eval(n);
        const tree_edges = options.get_tree_edges(nk, dir, !recurse);
        const visible_nodes = new Set(
            node.data().map(n => diagram.nodeKey.eval(n)).filter(nk => tree_edges[nk]),
        );
        const parts = {};
        if (recurse)
            partition_among_visible(tree_edges, visible_nodes, parts, nk);
        const spikeseses = {};
        if (!_expanded[dir].has(nk))
            Object.keys(tree_edges).forEach(nk => {
                let spikes;
                if (recurse) {
                    spikes = parts[nk] || [];
                } else {
                    const edges = tree_edges[nk].edges;
                    const degree = edges.length;
                    const visible_e = visible_edges(diagram, edge, dir, nk);
                    const shown = new Set(visible_e.map(e => diagram.edgeKey.eval(e)));
                    const invis = edges.filter(e => !shown.has(diagram.edgeKey()(e)));
                    spikes = invis.map(e => ({pe: e, children: []}));
                    if (degree-visible_e.length !== spikes.length) {
                        console.log(
                            'number of stubs',
                            spikes.length,
                            'does not equal degree - visible edges',
                            degree-visible_e.length,
                        );
                        // debugger;
                    }
                }
                const spikeses = {};
                if (
                    dir == 'both' && engines.is_directed(diagram.layoutEngine().layoutAlgorithm())
                ) {
                    spikeses.in = [];
                    spikeses.out = [];
                    spikes.forEach(spk => {
                        if (diagram.edgeSource()(spk.pe) === nk)
                            spikeses.out.push(spk);
                        else {
                            console.assert(diagram.edgeTarget()(spk.pe) === nk);
                            spikeses.in.push(spk);
                        }
                    });
                } else spikeses[dir] = spikes;
                spikeseses[nk] = spikeses;
            });
        draw_stubs(diagram, node, edge, n, spikeseses);
        let collapse_nodes_set = {}, collapse_edges_set = {};
        if (_expanded[dir].has(nk)) {
            // collapse
            const will_change = Object.keys(tree_edges).flatMap(nk =>
                _expanded[dir].has(nk) ? [nk] : []
            );
            _changing = Object.fromEntries(will_change.map(nk => [nk, {dir, whether: false}]));
            if (options.collapsibles) {
                const clps = options.collapsibles(will_change, dir);
                collapse_nodes_set = clps.nodes;
                collapse_edges_set = clps.edges;
            }
            changing_highlight_group.call(
                'highlight',
                null,
                Object.fromEntries(will_change.map(nk => [nk, true])),
                {},
            );
        } else {
            _changing = Object.fromEntries(
                Object.keys(tree_edges).map(nk => [nk, {dir, whether: true}]),
            );
            changing_highlight_group.call(
                'highlight',
                null,
                Object.fromEntries(Object.keys(tree_edges).map(nk => [nk, true])),
                {},
            );
        }
        collapse_highlight_group.call('highlight', null, collapse_nodes_set, collapse_edges_set);
    }

    function draw(diagram, node, edge, ehover) {
        function over_node(n) {
            const dir = zonedir(diagram, event, options.dirs, n);
            _overNode = n;
            _overDir = dir;
            if (_ignore && _ignore !== n)
                _ignore = null;
            if (_ignore)
                return;
            if (options.hideNode && detect_key(options.hideKey, event))
                highlight_hiding_node(diagram, n, edge);
            else if (_mode.nodeURL.eval(_overNode) && detect_key(options.linkKey, event)) {
                diagram.selectAllNodes()
                    .filter(n => n === _overNode).attr('cursor', 'pointer');
                diagram.requestRefresh(0);
            } else
                highlight_expand_collapse(
                    diagram,
                    n,
                    node,
                    edge,
                    dir,
                    detect_key(options.recurseKey, event),
                );
        }
        function leave_node(_n) {
            diagram.selectAllNodes()
                .filter(n => n === _overNode).attr('cursor', null);
            _overNode = null;
            _ignore = null;
            clear_stubs(diagram, node, edge);
            _changing = null;
            changing_highlight_group.call('highlight', null, {}, {});
            collapse_highlight_group.call('highlight', null, {}, {});
            hide_highlight_group.call('highlight', null, {}, {});
        }
        function click_node(n) {
            const nk = diagram.nodeKey.eval(n);
            if (options.hideNode && detect_key(options.hideKey, event))
                options.hideNode(nk);
            else if (detect_key(options.linkKey, event)) {
                if (_mode.nodeURL.eval(n) && _mode.urlOpener)
                    _mode.urlOpener()(_mode, n, _mode.nodeURL.eval(n));
            } else {
                clear_stubs(diagram, node, edge);
                _ignore = n;
                _changing = null;
                changing_highlight_group.call('highlight', null, {}, {});
                const dir = zonedir(diagram, event, options.dirs, n);
                let tree_nodes = [nk];
                if (detect_key(options.recurseKey, event) && options.get_tree_edges)
                    tree_nodes = Object.keys(options.get_tree_edges(nk, dir));
                expand(dir, tree_nodes, !_expanded[dir].has(nk));
            }
        }

        function enter_edge(e) {
            _overEdge = e;
            if (options.hideEdge && detect_key(options.hideKey, event))
                highlight_hiding_edge(diagram, e);
        }
        function leave_edge(_e) {
            _overEdge = null;
            hide_highlight_group.call('highlight', null, {}, {});
        }
        function click_edge(e) {
            if (options.hideEdge && detect_key(options.hideKey, event))
                options.hideEdge(diagram.edgeKey.eval(e));
        }

        node
            .on('mouseenter.expand-collapse', over_node)
            .on('mousemove.expand-collapse', over_node)
            .on('mouseout.expand-collapse', leave_node)
            .on('click.expand-collapse', click_node)
            .on('dblclick.expand-collapse', click_node);

        ehover
            .on('mouseenter.expand-collapse', enter_edge)
            .on('mouseout.expand-collapse', leave_edge)
            .on('click.expand-collapse', click_edge);

        _keyboard
            .on('keydown.expand-collapse', () => {
                if (
                    event.key === options.hideKey
                    && (_overNode && options.hideNode || _overEdge && options.hideEdge)
                ) {
                    if (_overNode)
                        highlight_hiding_node(diagram, _overNode, edge);
                    if (_overEdge)
                        highlight_hiding_edge(diagram, _overEdge);
                    clear_stubs(diagram, node, edge);
                    _changing = null;
                    changing_highlight_group.call('highlight', null, {}, {});
                    collapse_highlight_group.call('highlight', null, {}, {});
                } else if (event.key === options.linkKey && _overNode) {
                    if (_overNode && _mode.nodeURL.eval(_overNode)) {
                        diagram.selectAllNodes()
                            .filter(n => n === _overNode).attr('cursor', 'pointer');
                    }
                    hide_highlight_group.call('highlight', null, {}, {});
                    clear_stubs(diagram, node, edge);
                    collapse_highlight_group.call('highlight', null, {}, {});
                } else if (event.key === options.recurseKey && _overNode) {
                    highlight_expand_collapse(diagram, _overNode, node, edge, _overDir, true);
                }
            })
            .on('keyup.expand_collapse', () => {
                if (
                    (event.key === options.hideKey || event.key === options.linkKey
                        || event.key === options.recurseKey) && (_overNode || _overEdge)
                ) {
                    hide_highlight_group.call('highlight', null, {}, {});
                    if (_overNode) {
                        highlight_expand_collapse(
                            diagram,
                            _overNode,
                            node,
                            edge,
                            _overDir,
                            detect_key(options.recurseKey, event),
                        );
                        if (_mode.nodeURL.eval(_overNode)) {
                            diagram.selectAllNodes()
                                .filter(n => n === _overNode).attr('cursor', null);
                        }
                    }
                }
            });
        diagram.cascade(
            97,
            true,
            conditionalProperties(
                n => n === _overNode && n.orig.value.value && n.orig.value.value.URL,
                {
                    nodeLabelDecoration: 'underline',
                },
            ),
        );
    }

    function remove(diagram, node, edge, ehover) {
        node
            .on('mouseenter.expand-collapse', null)
            .on('mousemove.expand-collapse', null)
            .on('mouseout.expand-collapse', null)
            .on('click.expand-collapse', null)
            .on('dblclick.expand-collapse', null);
        ehover
            .on('mouseenter.expand-collapse', null)
            .on('mouseout.expand-collapse', null)
            .on('click.expand-collapse', null);
        clear_stubs(diagram, node, edge);
    }

    function expand(dir, nks, whether) {
        nks.forEach(nk => {
            if (dir === 'both' && !_expanded.both)
                options.dirs.forEach(dir2 => {
                    if (whether)
                        _expanded[dir2].add(nk);
                    else
                        _expanded[dir2].delete(nk);
                });
            else if (whether)
                _expanded[dir].add(nk);
            else
                _expanded[dir].delete(nk);
        });
        let bothmap;
        if (_expanded.both)
            bothmap = Object.fromEntries(
                Array.from(_expanded.both, nk => [nk, true]),
            );
        else {
            bothmap = Object.fromEntries(
                [..._expanded.in, ..._expanded.out]
                    .map(nk => [nk, true]),
            );
        }
        expanded_highlight_group.call('highlight', null, bothmap, {});
        options.refresh();
    }

    function expandNodes(nks, dir) {
        if (!Array.isArray(nks)) {
            Object.keys(nks).forEach(dir => {
                _expanded[dir] = new Set(nks[dir]);
            });
        } else {
            const expset = new Set(nks);
            const dirs = dir == 'both' ? options.dirs : [dir];
            dirs.forEach(dir => {
                _expanded[dir] = new Set(expset);
            });
        }
        const mm = Object.fromEntries(
            Array.prototype.concat.apply(
                [],
                Object.keys(_expanded).map(dir => Array.from(_expanded[dir])),
            )
                .map(nk => [nk, true]),
        );
        expanded_highlight_group.call('highlight', null, mm, {});
        options.refresh();
    }

    function nodeOutlineClip(n) {
        const dirs = _mode.expandedDirs(n.key);
        if (dirs.length == 0) // changing from expanded to not
            return 'none';
        if (dirs.length == 2 || dirs[0] == 'both')
            return null;
        switch (_mode.parent().layoutEngine().rankdir()) {
            case 'TB':
                return dirs[0] == 'in' ? 'top' : 'bottom';
            case 'BT':
                return dirs[0] == 'in' ? 'bottom' : 'top';
            case 'LR':
                return dirs[0] == 'in' ? 'left' : 'right';
            case 'RL':
                return dirs[0] == 'in' ? 'right' : 'left';
            default:
                throw new Error(`unknown rankdir ${mode.parent().layoutEngine().rankdir()}`);
        }
    }

    const _mode = mode('expand-collapse', {
        draw,
        remove,
        parent(p) {
            if (p) {
                _keyboard = p.child('keyboard');
                if (!_keyboard)
                    p.child('keyboard', _keyboard = keyboard());
                const highlight_changing = p.child(
                    options.highlight_changing || 'highlight-changing',
                );
                highlight_changing.includeProps()['nodeOutlineClip'] = nodeOutlineClip;
                const highlight_expanded = p.child(
                    options.highlight_expanded || 'highlight-expanded',
                );
                highlight_expanded.includeProps()['nodeOutlineClip'] = nodeOutlineClip;
            }
        },
    });
    _mode.getExpanded = function() {
        return _expanded;
    };
    _mode.expandedDirs = function(nk) {
        if (_expanded.both)
            return _expanded.both.has(nk) || _changing && _changing[nk] ? ['both'] : [];
        else {
            const dirs = [];
            let has_in = _expanded.in.has(nk);
            if (_changing && _changing[nk] && _changing[nk].dir === 'in')
                has_in = _changing[nk].whether;
            if (has_in)
                dirs.push('in');
            let has_out = _expanded.out.has(nk);
            if (_changing && _changing[nk] && _changing[nk].dir === 'out')
                has_out = _changing[nk].whether;
            if (has_out)
                dirs.push('out');
            return dirs;
        }
    };

    _mode.expand = expand;
    _mode.expandNodes = expandNodes;
    _mode.clickableLinks = deprecatedProperty(
        "warning - clickableLinks doesn't belong in collapse_expand and will be moved",
        false,
    );
    _mode.nodeURL = property(n => n.value && n.value.value && n.value.value.URL);
    _mode.urlTargetWindow = property('dcgraphlink');
    _mode.urlOpener = property(defaultUrlOpener);
    if (options.expandCollapse)
        options.expandCollapse(_mode);
    return _mode;
}

function defaultUrlOpener(mode, node, _url) {
    window.open(mode.nodeURL.eval(node), mode.urlTargetWindow());
}

// Attach strategies to expandCollapse function for backward compatibility
expandCollapse.expanded_hidden = expandedHidden;

function filterSelection(things_group, things_name) {
    things_name = things_name || 'select-nodes';
    const select_nodes_group = selectThingsGroup(things_group || 'select-nodes-group', things_name);

    function selection_changed(diagram) {
        return function(selection) {
            if (selection.length) {
                const selectionSet = set$2(selection);
                _mode.dimensionAccessor()(diagram).filterFunction(k => selectionSet.has(k));
            } else _mode.dimensionAccessor()(diagram).filter(null);
            diagram.redrawGroup();
        };
    }

    const _mode = {
        parent: property(null).react(p => {
            select_nodes_group.on(
                `set_changed.filter-selection-${things_name}`,
                p ? selection_changed(p) : null,
            );
        }),
    };
    _mode.dimensionAccessor = property(diagram => diagram.nodeDimension());
    return _mode;
}

/**
 * `flatGroup` implements a
 * ["fake crossfilter group"](https://github.com/dc-js/dc.js/wiki/FAQ#fake-groups)
 * for the case of a group which is 1:1 with the rows of the data array.
 *
 * Although `dc_graph` can be used with aggregated or reduced data, typically the nodes and edges
 * are rows of two data arrays, and each row has a column which contains the unique identifier for
 * the node or edge.
 */


const flatGroup = (function() {
    const reduce_01 = {
        add(p, v) {
            return v;
        },
        remove() {
            return null;
        },
        init() {
            return null;
        },
    };
    // now we only really want to see the non-null values, so make a fake group
    function non_null(group) {
        return {
            all() {
                return group.all().filter(kv => kv.value !== null);
            },
        };
    }

    function dim_group(ndx, id_accessor) {
        const dimension = ndx.dimension(id_accessor);
        return {
            crossfilter: ndx,
            dimension,
            group: non_null(
                dimension.group().reduce(reduce_01.add, reduce_01.remove, reduce_01.init),
            ),
        };
    }

    return {
        /**
         * Create a crossfilter, dimension, and flat group. Returns an object containing all three.
         *
         *  1. If `source` is an array, create a crossfilter from it. Otherwise assume it is a
         *  crossfilter instance.
         *  2. Create a dimension on the crossfilter keyed by `id_accessor`
         *  3. Create a group from the dimension, reducing to the row when it's filtered in, or
         * `null` when it's out.
         *  4. Wrap the group in a fake group which filters out the nulls.
         *
         * The resulting fake group's `.all()` method returns an array of the currently filtered-in
         * `{key, value}` pairs where the key is `id_accessor(row)` and the value is the row.
         * @method make
         * @memberof dc_graph.flat_group
         * @param {Array} source - the data array for crossfilter, or a crossfilter
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         */
        make(source, id_accessor) {
            let cf;
            if (Array.isArray(source))
                cf = crossfilter(source);
            else cf = source;
            return dim_group(cf, id_accessor);
        },
        /**
         * Create a flat dimension and group from an existing crossfilter.
         *
         * @method another
         * @memberof dc_graph.flat_group
         * @deprecated use .make() instead
         * @param {Object} ndx - crossfilter instance
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         */
        another(cf, id_accessor) {
            console.warn('flat_group.another() is deprecated, use .make() instead');
            return this.make(cf, id_accessor);
        },
    };
})();

function grid() {
    let _gridLayer = null;
    let _scale, _xDomain, _yDomain;

    function drawMode(_diagram, _node, _edge, _ehover) {
        // infer_and_draw(diagram);
    }

    function remove(_diagram, _node, _edge, _ehover) {
        if (_gridLayer)
            _gridLayer.remove();
    }

    function draw(diagram) {
        _gridLayer = diagram.g().selectAll('g.grid-layer').data([0]);
        _gridLayer.enter().append('g').attr('class', 'grid-layer');
        const ofs = _mode.wholeOnLines() ? 0 : 0.5;
        const vline_data = _scale >= _mode.threshold()
            ? range(Math.floor(_xDomain[0]), Math.ceil(_xDomain[1])+1)
            : [];
        let vlines = _gridLayer.selectAll('line.grid-line.vertical')
            .data(vline_data, d => d-ofs);
        vlines.exit().remove();
        const vlinesEnter = vlines.enter().append('line')
            .attr('class', 'grid-line vertical')
            .attr('x1', d => d-ofs)
            .attr('x2', d => d-ofs);
        vlines = vlines.merge(vlinesEnter);
        vlines.attr('stroke-width', 1/_scale)
            .attr('y1', _yDomain[0])
            .attr('y2', _yDomain[1]);
        const hline_data = _scale >= _mode.threshold()
            ? range(Math.floor(_yDomain[0]), Math.ceil(_yDomain[1])+1)
            : [];
        let hlines = _gridLayer.selectAll('line.grid-line.horizontal')
            .data(hline_data, d => d-ofs);
        hlines.exit().remove();
        const hlinesEnter = hlines.enter().append('line')
            .attr('class', 'grid-line horizontal')
            .attr('y1', d => d-ofs)
            .attr('y2', d => d-ofs);
        hlines = hlines.merge(hlinesEnter);
        hlines.attr('stroke-width', 1/_scale)
            .attr('x1', _xDomain[0])
            .attr('x2', _xDomain[1]);
    }

    function on_zoom(translate, scale, xDomain, yDomain) {
        _scale = scale;
        _xDomain = xDomain, _yDomain = yDomain;
        draw(_mode.parent());
    }

    function infer_and_draw(diagram) {
        diagram.translate();
        _scale = diagram.scale();
        _xDomain = diagram.x().domain();
        _yDomain = diagram.y().domain();
        draw(diagram);
    }

    const _mode = mode('highlight-paths', {
        draw: drawMode,
        remove,
        parent(p) {
            if (p) {
                p.on('zoomed.grid', on_zoom);
                infer_and_draw(p);
            }
        },
    });

    _mode.threshold = property(4);
    _mode.wholeOnLines = property(true);

    return _mode;
}

// External dependencies

function registerHighlightNeighborsGroup(neighborsgroup) {
    window.chart_registry.create_type('highlight-neighbors', () => dispatch('highlight_node'));

    return window.chart_registry.create_group('highlight-neighbors', neighborsgroup);
}

function highlightThings(includeprops, excludeprops, modename, groupname, cascbase) {
    const highlight_things_group = registerHighlightThingsGroup(
        groupname || 'highlight-things-group',
    );
    const _includeprops = {...includeprops}, _excludeprops = {...excludeprops};
    let _active, _nodeset = {}, _edgeset = {};
    cascbase = cascbase || 150;

    function highlight(nodeset, edgeset) {
        _active = nodeset || edgeset;
        _nodeset = nodeset || {};
        _edgeset = edgeset || {};
        _mode.parent().requestRefresh(_mode.durationOverride());
    }
    function draw(diagram) {
        diagram.cascade(
            cascbase,
            true,
            nodeEdgeConditions(
                n => _nodeset[_mode.parent().nodeKey.eval(n)],
                e => _edgeset[_mode.parent().edgeKey.eval(e)],
                _includeprops,
            ),
        );
        diagram.cascade(
            cascbase+10,
            true,
            nodeEdgeConditions(
                n => _active && !_nodeset[_mode.parent().nodeKey.eval(n)],
                e => _active && !_edgeset[_mode.parent().edgeKey.eval(e)],
                _excludeprops,
            ),
        );
    }
    function remove(diagram) {
        diagram.cascade(cascbase, false, _includeprops);
        diagram.cascade(cascbase+10, false, _excludeprops);
    }
    const _mode = mode(modename, {
        draw,
        remove,
        parent(p) {
            highlight_things_group.on(`highlight.${modename}`, p ? highlight : null);
        },
    });
    _mode.includeProps = () => _includeprops;
    _mode.excludeProps = () => _excludeprops;
    _mode.durationOverride = property(undefined);
    return _mode;
}

function highlightNeighbors(includeprops, excludeprops, neighborsgroup, thingsgroup) {
    const highlight_neighbors_group = registerHighlightNeighborsGroup(
        neighborsgroup || 'highlight-neighbors-group',
    );
    const highlight_things_group = registerHighlightThingsGroup(
        thingsgroup || 'highlight-things-group',
    );

    function highlight_node(nodeid) {
        const diagram = _mode.parent();
        const nodeset = {}, edgeset = {};
        if (nodeid) {
            nodeset[nodeid] = true;
            _mode.parent().selectAllEdges().each(e => {
                if (diagram.nodeKey.eval(e.source) === nodeid) {
                    edgeset[diagram.edgeKey.eval(e)] = true;
                    nodeset[diagram.nodeKey.eval(e.target)] = true;
                }
                if (diagram.nodeKey.eval(e.target) === nodeid) {
                    edgeset[diagram.edgeKey.eval(e)] = true;
                    nodeset[diagram.nodeKey.eval(e.source)] = true;
                }
            });
            highlight_things_group.call('highlight', null, nodeset, edgeset);
        } else highlight_things_group.call('highlight', null, null, null);
    }
    function draw(diagram, node, _edge) {
        node
            .on('mouseover.highlight-neighbors', n => {
                highlight_neighbors_group.call(
                    'highlight_node',
                    null,
                    _mode.parent().nodeKey.eval(n),
                );
            })
            .on('mouseout.highlight-neighbors', _n => {
                highlight_neighbors_group.call('highlight_node', null, null);
            });
    }

    function remove(diagram, node, _edge) {
        node
            .on('mouseover.highlight-neighbors', null)
            .on('mouseout.highlight-neighbors', null);
        highlight_neighbors_group.call('highlight_node', null, null);
    }

    const _mode = mode('highlight-neighbors', {
        draw,
        remove(diagram, node, edge) {
            remove(diagram, node);
        },
        parent(p) {
            highlight_neighbors_group.on(
                'highlight_node.highlight-neighbors',
                p ? highlight_node : null,
            );
            if (p && !p.child('highlight-things'))
                p.child(
                    'highlight-things',
                    highlightThings(includeprops, excludeprops)
                        .durationOverride(_mode.durationOverride()),
                );
        },
    });
    _mode.durationOverride = property(undefined);
    return _mode;
}

// External dependencies

function registerHighlightPathsGroup(pathsgroup) {
    window.chart_registry.create_type(
        'highlight-paths',
        () => dispatch('paths_changed', 'hover_changed', 'select_changed'),
    );

    return window.chart_registry.create_group('highlight-paths', pathsgroup);
}

function highlightPaths(pathprops, hoverprops, selectprops, pathsgroup) {
    const highlight_paths_group = registerHighlightPathsGroup(
        pathsgroup || 'highlight-paths-group',
    );
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    selectprops = selectprops || {};
    let node_on_paths = {}, edge_on_paths = {}, selected = null, hoverpaths = null;
    let _anchor;

    function refresh() {
        if (_mode.doRedraw())
            _mode.parent().relayout().redraw();
        else
            _mode.parent().refresh();
    }

    function paths_changed(nop, eop) {
        selected = hoverpaths = null;
        // it would be difficult to check if no change, but at least check if changing from empty to empty
        if (
            Object.keys(node_on_paths).length === 0 && Object.keys(nop).length === 0
            && Object.keys(edge_on_paths).length === 0 && Object.keys(eop).length === 0
        )
            return;
        node_on_paths = nop;
        edge_on_paths = eop;
        refresh();
    }

    function hover_changed(hp) {
        if (hp !== hoverpaths) {
            hoverpaths = hp;
            refresh();
        }
    }

    function select_changed(sp) {
        if (sp !== selected) {
            selected = sp;
            refresh();
        }
    }

    function clear_all_highlights() {
        node_on_paths = {};
        edge_on_paths = {};
    }

    function contains_path(paths) {
        return function(path) {
            return paths.indexOf(path) >= 0;
        };
    }

    // sigh
    function doesnt_contain_path(paths) {
        const cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function intersect_paths(pathsA, pathsB) {
        if (!pathsA || !pathsB)
            return false;
        return pathsA.some(contains_path(pathsB));
    }

    function toggle_paths(pathsA, pathsB) {
        if (!pathsA)
            return pathsB;
        else if (!pathsB)
            return pathsA;
        if (pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    function draw(diagram, node, edge, ehover) {
        diagram
            .cascade(
                200,
                true,
                nodeEdgeConditions(
                    n => !!node_on_paths[diagram.nodeKey.eval(n)],
                    e => !!edge_on_paths[diagram.edgeKey.eval(e)],
                    pathprops,
                ),
            )
            .cascade(
                300,
                true,
                nodeEdgeConditions(
                    n => intersect_paths(node_on_paths[diagram.nodeKey.eval(n)], selected),
                    e => intersect_paths(edge_on_paths[diagram.edgeKey.eval(e)], selected),
                    selectprops,
                ),
            )
            .cascade(
                400,
                true,
                nodeEdgeConditions(
                    n => intersect_paths(node_on_paths[diagram.nodeKey.eval(n)], hoverpaths),
                    e => intersect_paths(edge_on_paths[diagram.edgeKey.eval(e)], hoverpaths),
                    hoverprops,
                ),
            );

        node
            .on('mouseover.highlight-paths', n => {
                highlight_paths_group.hover_changed(node_on_paths[diagram.nodeKey.eval(n)] || null);
            })
            .on('mouseout.highlight-paths', _n => {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', n => {
                highlight_paths_group.select_changed(
                    toggle_paths(selected, node_on_paths[diagram.nodeKey.eval(n)]),
                );
            });

        ehover
            .on('mouseover.highlight-paths', e => {
                highlight_paths_group.hover_changed(edge_on_paths[diagram.edgeKey.eval(e)] || null);
            })
            .on('mouseout.highlight-paths', _e => {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.highlight-paths', n => {
                highlight_paths_group.select_changed(
                    toggle_paths(selected, edge_on_paths[diagram.nodeKey.eval(n)]),
                );
            });
    }

    function remove(diagram, node, edge, ehover) {
        node
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        ehover
            .on('mouseover.highlight-paths', null)
            .on('mouseout.highlight-paths', null)
            .on('click.highlight-paths', null);
        clear_all_highlights();
        diagram
            .cascade(200, false, pathprops)
            .cascade(300, false, selectprops)
            .cascade(400, false, hoverprops);
    }

    const _mode = mode('highlight-paths', {
        draw,
        remove(diagram, node, edge, ehover) {
            remove(diagram, node, edge, ehover);
            return this;
        },
        parent(p) {
            if (p)
                _anchor = p.anchorName();
            // else we should have received anchor earlier
            highlight_paths_group.on(
                `paths_changed.highlight-paths-${_anchor}`,
                p ? paths_changed : null,
            );
            highlight_paths_group.on(
                `hover_changed.highlight-paths-${_anchor}`,
                p ? hover_changed : null,
            );
            highlight_paths_group.on(
                `select_changed.highlight-paths-${_anchor}`,
                p ? select_changed : null,
            );
        },
    });

    // whether to do relayout & redraw (true) or just refresh (false)
    _mode.doRedraw = property(false);

    return _mode;
}

function highlightRadius(options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );
    const highlight_things_group = registerHighlightThingsGroup(
        options.highlight_things_group || 'highlight-things-group',
    );
    let _graph, _selection = [];

    function recurse(n, r, nodeset, edgeset) {
        nodeset[n.key()] = true;
        if (r) {
            n.outs().filter(e => !edgeset[e.key()]).forEach(e => {
                edgeset[e.key()] = true;
                recurse(e.target(), r-1, nodeset, edgeset);
            });
            n.ins().filter(e => !edgeset[e.key()]).forEach(e => {
                edgeset[e.key()] = true;
                recurse(e.source(), r-1, nodeset, edgeset);
            });
        }
    }
    function selection_changed(nodes) {
        _selection = nodes;
        console.assert(_graph);
        let nodeset = {}, edgeset = {};
        nodes.forEach(nkey => {
            recurse(_graph.node(nkey), _mode.radius(), nodeset, edgeset);
        });
        if (!Object.keys(nodeset).length && !Object.keys(edgeset).length)
            nodeset = edgeset = null;
        highlight_things_group.call('highlight', null, nodeset, edgeset);
    }

    function on_data(diagram, nodes, wnodes, edges, wedges, _ports, _wports) {
        _graph = graph(wnodes, wedges, {
            nodeKey: diagram.nodeKey.eval,
            edgeKey: diagram.edgeKey.eval,
            edgeSource: diagram.edgeSource.eval,
            edgeTarget: diagram.edgeTarget.eval,
        });
        const sel2 = _selection.filter(nk => !!_graph.node(nk));
        if (sel2.length < _selection.length)
            window.setTimeout(() => {
                select_nodes_group.call('set_changed', null, sel2);
            }, 0);
    }
    const _mode = {
        parent(p) {
            if (p) {
                p.on('data.highlight-radius', on_data);
            } else if (_mode.parent())
                _mode.parent().on('data.highlight-radius', null);
            select_nodes_group.on('set_changed.highlight-radius', selection_changed);
        },
    };
    _mode.radius = property(1);
    return _mode;
}

function labelEdges(options) {
    options = options || {};
    const _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-edges-group';
    options.select_type = options.select_type || 'select-edges';
    options.label_group = options.label_group || 'label-edges-group';
    options.label_type = options.label_type || 'label-edges';
    options.default_label = 'edge name';

    options.find_thing = function(key, node, edge) {
        return edge.filter(e => _mode.parent().edgeKey.eval(e) === key);
    };
    options.hide_thing_label = function(edge, whether) {
        const label = _mode.parent().selectAll(
            `#${_mode.parent().edgeId(edge.datum())}-label textPath`,
        );
        label.attr('visibility', whether ? 'hidden' : 'visible');
    };
    options.thing_box = function(edge, _eventOptions) {
        const points = edge.datum().pos.new.path.points,
            x = (points[0].x+points[1].x)/2,
            y = (points[0].y+points[1].y)/2;
        return {x, y: y-10, width: 0, height: 20};
    };
    options.thing_label = function(edge) {
        return _mode.parent().edgeLabel.eval(edge.datum());
    };
    options.accept = function(edge, text) {
        const callback = _mode.changeEdgeLabel()
            ? _mode.changeEdgeLabel()(_mode.parent().edgeKey.eval(edge.datum()), text)
            : Promise.resolve(text);
        return callback.then(text2 => {
            const e = edge.datum();
            e.orig.value[_labelTag] = text2;
            _mode.parent().redrawGroup();
        });
    };

    const _mode = labelThings(options);
    _mode.changeEdgeLabel = property(null);
    return _mode;
}

function labelNodes(options) {
    options = options || {};
    const _labelTag = options.labelTag || 'label';
    options.select_group = options.select_group || 'select-nodes-group';
    options.select_type = options.select_type || 'select-nodes';
    options.label_group = options.label_group || 'label-nodes-group';
    options.label_type = options.label_type || 'label-nodes';
    options.default_label = 'node name';

    options.find_thing = function(key, node, _edge) {
        return node.filter(n => _mode.parent().nodeKey.eval(n) === key);
    };
    options.hide_thing_label = function(node, whether) {
        const contents = _mode.parent().content(_mode.parent().nodeContent.eval(node.datum()));
        contents.selectText(node).attr('visibility', whether ? 'hidden' : 'visible');
    };
    options.thing_box = function(node, _eventOptions) {
        const contents = _mode.parent().content(_mode.parent().nodeContent.eval(node.datum())),
            box = contents.textbox(node);
        box.x += node.datum().cola.x;
        box.y += node.datum().cola.y;
        return box;
    };
    options.thing_label = function(node) {
        return _mode.parent().nodeLabel.eval(node.datum());
    };
    options.accept = function(node, text) {
        const callback = _mode.changeNodeLabel()
            ? _mode.changeNodeLabel()(_mode.parent().nodeKey.eval(node.datum()), text)
            : Promise.resolve(text);
        return callback.then(text2 => {
            const n = node.datum();
            n.orig.value[_labelTag] = text2;
            _mode.parent().redrawGroup();
        });
    };

    const _mode = labelThings(options);
    _mode.changeNodeLabel = property(null);
    return _mode;
}

/**
## Legend

The dc_graph.legend shows labeled examples of nodes & edges, within the frame of a dc_graph.diagram.
**/

function legend(legend_namespace) {
    legend_namespace = legend_namespace || 'node-legend';
    let _items, _included = [];
    const _dispatch = dispatch('filtered');
    let _totals, _counts;

    let _svg_renderer;

    function apply_filter() {
        if (_legend.customFilter())
            _legend.customFilter()(_included);
        else if (_legend.dimension()) {
            if (_legend.isTagDimension()) {
                _legend.dimension().filterFunction(ks =>
                    !_included.length || ks.filter(k => _included.includes(k)).length
                );
            } else {
                _legend.dimension().filterFunction(k => !_included.length || _included.includes(k));
            }
            _legend.parent().redraw();
        }
    }

    const _legend = mode(legend_namespace, {
        renderers: ['svg', 'webgl'],
        draw: redraw,
        remove() {},
        parent(p) {
            if (p) {
                p
                    .on(`render.${legend_namespace}`, render)
                    .on(`data.${legend_namespace}`, on_data);
            } else {
                _legend.parent()
                    .on(`render.${legend_namespace}`, null)
                    .on(`data.${legend_namespace}`, null);
            }
        },
    });

    /**
     #### .type([value])
     Set or get the handler for the specific type of item to be displayed. Default: dc_graph.legend.node_legend()
     **/
    _legend.type = property(nodeLegend());

    /**
     #### .x([value])
     Set or get x coordinate for legend widget. Default: 0.
     **/
    _legend.x = property(0);

    /**
     #### .y([value])
     Set or get y coordinate for legend widget. Default: 0.
     **/
    _legend.y = property(0);

    /**
     #### .gap([value])
     Set or get gap between legend items. Default: 5.
     **/
    _legend.gap = property(5);

    /**
     #### .itemWidth([value])
     Set or get width to reserve for legend item. Default: 30.
     **/
    _legend.itemWidth = _legend.nodeWidth = property(40);

    /**
     #### .itemHeight([value])
     Set or get height to reserve for legend item. Default: 30.
    **/
    _legend.itemHeight = _legend.nodeHeight = property(40);

    _legend.dyLabel = property('0.3em');

    _legend.omitEmpty = property(false);

    /**
     #### .noLabel([value])
     Remove item labels, since legend labels are displayed outside of the items. Default: true
    **/
    _legend.noLabel = property(true);

    _legend.counter = property(null);

    _legend.replaceFilter = function(filter) {
        if (filter && filter.length === 1)
            _included = filter[0];
        else
            _included = [];
        return _legend;
    };

    _legend.filters = function() {
        return _included;
    };

    _legend.on = function(type, f) {
        _dispatch.on(type, f);
        return _legend;
    };

    /**
     #### .exemplars([object])
     Specifies an object where the keys are the names of items to add to the legend, and the values are
     objects which will be passed to the accessors of the attached diagram in order to determine the
     drawing attributes. Alternately, if the key needs to be specified separately from the name, the
     function can take an array of {name, key, value} objects.
     **/
    _legend.exemplars = property({});

    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        if (_legend.counter())
            _counts = _legend.counter()(
                wnodes.map(getOriginal),
                wedges.map(getOriginal),
                wports.map(getOriginal),
                false,
            );
    }

    _legend.redraw = deprecateFunction(
        'dc_graph.legend is an ordinary mode now; redraw will go away soon',
        redraw,
    );
    function redraw() {
        const legend = (_svg_renderer || _legend.parent()).svg()
            .selectAll(`g.dc-graph-legend.${legend_namespace}`)
            .data([0]);
        legend.enter().append('g')
            .attr('class', `dc-graph-legend ${legend_namespace}`)
            .attr('transform', `translate(${_legend.x()},${_legend.y()})`);

        const items = !_legend.omitEmpty() || !_counts
            ? _items
            : _items.filter(i =>
                _included.length && !_included.includes(i.orig.key) || _counts[i.orig.key]
            );
        const item = legend.selectAll(_legend.type().itemSelector())
            .data(items, n => n.name);
        item.exit().remove();
        const itemEnter = _legend.type().create(
            _legend.parent(),
            item.enter(),
            _legend.itemWidth(),
            _legend.itemHeight(),
        );
        itemEnter.append('text')
            .attr('dy', _legend.dyLabel())
            .attr('class', 'legend-label');
        item
            .attr(
                'transform',
                (n, i) =>
                    `translate(${_legend.itemWidth()/2},${
                        (_legend.itemHeight()+_legend.gap())*(i+0.5)
                    })`,
            );
        item.select('text.legend-label')
            .attr('transform', `translate(${_legend.itemWidth()/2+_legend.gap()},0)`)
            .attr('pointer-events', _legend.dimension() ? 'auto' : 'none')
            .text(d =>
                d.name+(_legend.counter() && _legend.filterable()(d) && _counts
                    ? (` (${_counts[d.orig.key] || 0}${
                        _counts[d.orig.key] !== _totals[d.orig.key]
                            ? `/${_totals[d.orig.key] || 0}`
                            : ''
                    })`)
                    : '')
            );
        _legend.type().draw(_svg_renderer || _legend.parent(), itemEnter, item);
        if (_legend.noLabel())
            item.selectAll(_legend.type().labelSelector()).remove();

        if (_legend.dropdown()) {
            const caret = item.selectAll('text.dropdown-caret').data(x => [x]);
            caret
                .enter().append('text')
                .attr('dy', '0.3em')
                .attr('font-size', '75%')
                .attr('fill', 'blue')
                .attr('class', 'dropdown-caret')
                .style('visibility', 'hidden')
                .html('&emsp;&#x25BC;');
            caret
                .attr('dx', function(_d) {
                    return (_legend.itemWidth()/2+_legend.gap())+getBBoxNoThrow(
                        select(this.parentNode).select('text.legend-label').node(),
                    ).width;
                })
                .on(`mouseenter.${legend_namespace}`, function(n) {
                    const rect = this.getBoundingClientRect();
                    const key = _legend.parent().nodeKey.eval(n);
                    _legend.dropdown()
                        .show(key, rect.x, rect.y);
                });
            item
                .on(`mouseenter.${legend_namespace}`, function(d) {
                    if (_counts && _counts[d.orig.key]) {
                        select(this).selectAll('.dropdown-caret')
                            .style('visibility', 'visible');
                    }
                })
                .on(`mouseleave.${legend_namespace}`, function(_d) {
                    select(this).selectAll('.dropdown-caret')
                        .style('visibility', 'hidden');
                });
        }

        if (_legend.dimension()) {
            item.filter(_legend.filterable())
                .attr('cursor', 'pointer')
                .on(`click.${legend_namespace}`, d => {
                    const key = _legend.parent().nodeKey.eval(d);
                    if (!_included.length && !_legend.isInclusiveDimension())
                        _included = _items.map(_legend.parent().nodeKey.eval);
                    if (_included.includes(key))
                        _included = _included.filter(x => x !== key);
                    else
                        _included.push(key);
                    apply_filter();
                    _dispatch.call('filtered', null, _legend, key);
                    if (_svg_renderer)
                        window.setTimeout(redraw, 250);
                });
        } else {
            item.attr('cursor', 'auto')
                .on(`click.${legend_namespace}`, null);
        }
        item.transition().duration(1000)
            .attr(
                'opacity',
                d => (!_legend.filterable()(d) || !_included.length
                        || _included.includes(_legend.parent().nodeKey.eval(d)))
                    ? 1
                    : 0.25,
            );
    }

    _legend.countBaseline = function() {
        if (_legend.counter())
            _totals = _legend.counter()(
                _legend.parent().nodeGroup().all(),
                _legend.parent().edgeGroup().all(),
                _legend.parent().portGroup() && _legend.parent().portGroup().all(),
                true,
            );
    };

    _legend.render = deprecateFunction(
        'dc_graph.legend is an ordinary mode now; render will go away soon',
        render,
    );
    function render() {
        if (_legend.parent().renderer().rendererType() !== 'svg') {
            _svg_renderer = renderSvg();
            _svg_renderer.parent(_legend.parent())
                .svg(
                    _legend.parent().root().append('svg')
                        .style({
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            fill: 'wheat',
                            'pointer-events': 'none',
                        }),
                );
        }

        const exemplars = _legend.exemplars();
        _legend.countBaseline();
        if (exemplars instanceof Array) {
            _items = exemplars.map(v => ({
                name: v.name,
                orig: {key: v.key, value: v.value},
                cola: {},
            }));
        } else {
            _items = [];
            for (const item in exemplars)
                _items.push({name: item, orig: {key: item, value: exemplars[item]}, cola: {}});
        }
        redraw();
    }

    _legend.dropdown = property(null).react(v => {
        if (
            !!v !== !!_legend.dropdown() && _legend.parent()
            && (_svg_renderer || _legend.parent()).svg()
        )
            window.setTimeout(_legend.redraw, 0);
    });

    /* enables filtering */
    _legend.dimension = property(null)
        .react(v => {
            if (!v) {
                _included = [];
                apply_filter();
            }
        });
    _legend.filterable = property(() => true);
    _legend.isInclusiveDimension = property(false);
    _legend.isTagDimension = property(false);
    _legend.customFilter = property(null);

    return _legend;
}

function nodeLegend() {
    return {
        itemSelector() {
            return '.node';
        },
        labelSelector() {
            return '.node-label';
        },
        create(diagram, selection) {
            return selection.append('g')
                .attr('class', 'node');
        },
        draw(renderer, itemEnter, item) {
            renderer
                .renderNode(itemEnter)
                .redrawNode(item);
        },
    };
}

function edgeLegend() {
    const _type = {
        itemSelector() {
            return '.edge-container';
        },
        labelSelector() {
            return '.edge-label';
        },
        create(diagram, selection, w, h) {
            const edgeEnter = selection.append('g')
                .attr('class', 'edge-container')
                .attr('opacity', 0);
            edgeEnter
                .append('rect')
                .attr('x', -w/2)
                .attr('y', -h/2)
                .attr('width', w)
                .attr('height', h)
                .attr('fill', 'green')
                .attr('opacity', 0);
            edgeEnter
                .selectAll('circle')
                .data([-1, 1])
                .enter()
                .append('circle')
                .attr('r', _type.fakeNodeRadius())
                .attr('fill', 'none')
                .attr('stroke', 'black')
                .attr('stroke-dasharray', '4,4')
                .attr('opacity', 0.15)
                .attr('transform', d => `translate(${[d*_type.length()/2, 0].join(',')})`);
            const edgex = _type.length()/2-_type.fakeNodeRadius();
            edgeEnter.append('svg:path')
                .attr('class', 'edge')
                .attr('id', d => d.name)
                .attr('d', `M${-edgex},0 L${edgex},0`)
                .attr('opacity', diagram.edgeOpacity.eval);

            return edgeEnter;
        },
        fakeNodeRadius: property(10),
        length: property(50),
        draw(renderer, itemEnter, _item) {
            renderer.redrawEdge(
                itemEnter.select('path.edge'),
                renderer.selectAllEdges('.edge-arrows'),
            );
        },
    };
    return _type;
}

function symbolLegend(symbolScale) {
    return {
        itemSelector() {
            return '.symbol';
        },
        labelSelector() {
            return '.symbol-label';
        },
        create(diagram, selection, _w, _h) {
            const symbolEnter = selection.append('g')
                .attr('class', 'symbol');
            return symbolEnter;
        },
        draw(renderer, symbolEnter, _symbol) {
            symbolEnter.append('text')
                .html(d => symbolScale(d.orig.key));
            return symbolEnter;
        },
    };
}

const dont_use_key = deprecationWarning(
    'line_breaks now takes a string - d.key behavior is deprecated and will be removed in a later version',
);

function lineBreaks(charexp, max_line_length) {
    const regexp = new RegExp(charexp, 'g');
    return function(s) {
        if (typeof s === 'object') { // backward compatibility
            dont_use_key();
            s = s.key;
        }
        let result;
        let line = '', part, i = 0;
        const lines = [];
        do {
            result = regexp.exec(s);
            if (result)
                part = s.slice(i, regexp.lastIndex);
            else
                part = s.slice(i);
            if (line.length+part.length > max_line_length && line.length > 0) {
                lines.push(line);
                line = '';
            }
            line += part;
            i = regexp.lastIndex;
        } while (result !== null);
        lines.push(line);
        return lines;
    };
}

function processDot(text) {
    return new Promise((resolve, _reject) => {
        const digraph = graphlibDot.read(text);

        const nodeNames = digraph.nodes();
        const nodes = new Array(nodeNames.length);
        const nodeIdMap = {};

        nodeNames.forEach((name, i) => {
            const nodeLabel = digraph.node(name) || {};
            nodes[i] = Object.assign({}, nodeLabel, {
                id: i,
                name,
            });
            nodeIdMap[name] = i;
        });

        const edges = [];
        digraph.edges().forEach(e => {
            const edgeLabel = digraph.edge(e.v, e.w) || {};
            edges.push(Object.assign({}, edgeLabel, {
                source: nodeIdMap[e.v],
                target: nodeIdMap[e.w],
                sourcename: e.v,
                targetname: e.w,
            }));
        });

        // Handle clusters/subgraphs if supported
        const node_cluster = {}, clusters = [];
        if (typeof digraph.children === 'function') {
            const cluster_names = {};
            let queue = digraph.children().map(c =>
                Object.assign({parent: null, key: c}, digraph.node(c))
            );
            while (queue.length) {
                const item = queue.shift(),
                    children = digraph.children(item.key);
                if (children.length) {
                    clusters.push(item);
                    cluster_names[item.key] = true;
                } else
                    node_cluster[item.key] = item.parent;
                queue = queue.concat(children.map(c => ({parent: item.key, key: c})));
            }
            // Filter out cluster nodes
            const filteredNodes = nodes.filter(n => !cluster_names[n.name]);
            const graph = {nodes: filteredNodes, links: edges, node_cluster, clusters};
            resolve(graph);
        } else {
            const graph = {nodes, links: edges, node_cluster, clusters};
            resolve(graph);
        }
    });
}

function processDsv(data) {
    return new Promise((resolve, _reject) => {
        const keys = Object.keys(data[0]);
        const source = keys[0], target = keys[1];
        let nodes = set$2(data.map(r => r[source]));
        data.forEach(r => {
            nodes.add(r[target]);
        });
        nodes = nodes.values().map(k => ({name: k}));
        resolve({
            nodes,
            links: data.map((r, i) => ({
                key: i,
                sourcename: r[source],
                targetname: r[target],
            })),
        });
    });
}

const fileFormats = [
    {
        exts: 'json',
        mimes: 'application/json',
        from_url: url => json(url),
        from_text: text => Promise.resolve(JSON.parse(text)),
    },
    {
        exts: ['gv', 'dot'],
        mimes: 'text/vnd.graphviz',
        from_url: url => text(url).then(textData => processDot(textData)),
        from_text: text => processDot(text),
    },
    {
        exts: 'psv',
        mimes: 'text/psv',
        from_url: url => dsv('|', 'text/plain')(url).then(data => processDsv(data)),
        from_text: text => processDsv(dsv('|').parse(text)),
    },
    {
        exts: 'csv',
        mimes: 'text/csv',
        from_url: url => csv(url).then(data => processDsv(data)),
        from_text: text => processDsv(csv.parse(text)),
    },
];

function matchFileFormat(filename) {
    return fileFormats.find(format => {
        let exts = format.exts;
        if (!Array.isArray(exts))
            exts = [exts];
        return exts.find(ext => new RegExp(`\\.${ext}$`).test(filename));
    });
}

function matchMimeType(mime) {
    return fileFormats.find(format => {
        let mimes = format.mimes;
        if (!Array.isArray(mimes))
            mimes = [mimes];
        return mimes.includes(mime);
    });
}

function unknownFormatError(filename) {
    const spl = filename.split('.');
    if (spl.length)
        return new Error(`do not know how to process graph file extension ${spl[spl.length-1]}`);
    else
        return new Error(
            `need file extension to process graph file automatically, filename ${filename}`,
        );
}

function unknownMimeError(mime) {
    return new Error(`do not know how to process mime type ${mime}`);
}

// load a graph from various formats and return the data in consistent {nodes, links} format
function loadGraph(file1, file2) {
    // ignore any query parameters for checking extension
    const ignore_query = file => file ? file.replace(/\?.*/, '') : null;

    if (file2) {
        // this is not general - really titan-specific
        return Promise.all([json(file1), json(file2)])
            .then(([nodes, edges]) => ({nodes: nodes.results, edges: edges.results}));
    } else {
        if (/^data:/.test(file1)) {
            const parts = file1.slice(5).split(/,(.+)/);
            const format = matchMimeType(parts[0]);
            if (format)
                return format.from_text(parts[1]);
            else
                return Promise.reject(unknownMimeError(parts[0]));
        } else {
            const file1noq = ignore_query(file1);
            const format = matchFileFormat(file1noq);
            if (format)
                return format.from_url(file1);
            else
                return Promise.reject(unknownFormatError(file1noq));
        }
    }
}

function loadGraphText(text, filename) {
    const format = matchFileFormat(filename);
    if (format)
        return format.from_text(text);
    else
        return Promise.reject(unknownFormatError(filename));
}

function dataUrl(data) {
    return `data:application/json,${JSON.stringify(data)}`;
}

function matchOpposites(diagram, deleteProps, options) {
    options = Object.assign({
        multiplier: 2,
        ease: cubicInOut,
    }, options);
    let _wports, _wedges, _validTargets;

    diagram.cascade(
        100,
        true,
        multiplyProperties(e => options.ease(e.deleting || 0), deleteProps, propertyInterpolate),
    );
    diagram.on('data.match-opposites', (diagram, nodes, wnodes, edges, wedges, ports, wports) => {
        _wports = wports;
        _wedges = wedges;
    });
    function port_pos(p) {
        return {x: p.node.cola.x+p.pos.x, y: p.node.cola.y+p.pos.y};
    }
    function is_valid(sourcePort, targetPort) {
        return (_strategy.allowParallel()
            || !_wedges.some(e =>
                sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0
            )) && _strategy.isValid()(sourcePort, targetPort);
    }
    function reset_deletables(source, targets) {
        targets.forEach(p => {
            p.edges.forEach(e => {
                e.deleting = 0;
            });
        });
        if (source)
            source.port.edges.forEach(e => {
                e.deleting = 0;
            });
    }
    const _strategy = {
        isValid: property((sourcePort, targetPort) =>
            // draw_graphs is already enforcing this, but this makes more sense and i use xor any chance i get
            (diagram.portName.eval(sourcePort) === 'in')^(diagram.portName.eval(targetPort)
                === 'in')
        ),
        allowParallel: property(false),
        hoverPort(_port) {
            // could be called by draw_graphs when node is hovered, isn't
        },
        startDragEdge(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            console.log('valid targets', _validTargets.map(diagram.portNodeKey.eval));
            return _validTargets.length !== 0;
        },
        dragCanvas(source, coords) {
            const closest = _validTargets.map(p => {
                const ppos = port_pos(p);
                return {
                    distance: Math.hypot(coords[0]-ppos.x, coords[1]-ppos.y),
                    port: p,
                };
            }).sort((a, b) => a.distance-b.distance);
            const cpos = port_pos(closest[0].port), spos = port_pos(source.port);
            closest.forEach(c => {
                c.port.edges.forEach(e => {
                    e.deleting =
                        1-options.multiplier*c.distance/Math.hypot(cpos.x-spos.x, cpos.y-spos.y);
                });
            });
            source.port.edges.forEach(e => {
                e.deleting = 1-options.multiplier*closest[0].distance/Math.hypot(
                            cpos.x-spos.x,
                            cpos.y-spos.y,
                        );
            });
            diagram.requestRefresh(0);
        },
        changeDragTarget(source, target) {
            const valid = target && is_valid(source.port, target.port);
            if (valid) {
                target.port.edges.forEach(e => {
                    e.deleting = 1;
                });
                source.port.edges.forEach(e => {
                    e.deleting = 1;
                });
                reset_deletables(null, _validTargets.filter(p => p !== target.port));
                diagram.requestRefresh(0);
            }
            return valid;
        },
        finishDragEdge(source, target) {
            if (is_valid(source.port, target.port)) {
                reset_deletables(null, _validTargets.filter(p => p !== target.port));
                if (options.delete_edges) {
                    const edgeKeys = source.port.edges.map(diagram.edgeKey.eval).concat(
                        target.port.edges.map(diagram.edgeKey.eval),
                    );
                    return options.delete_edges.deleteSelection(edgeKeys);
                }
                return Promise.resolve(true);
            }
            reset_deletables(source, _validTargets || []);
            return Promise.resolve(false);
        },
        cancelDragEdge(source) {
            reset_deletables(source, _validTargets || []);
            return true;
        },
        detectReversedEdge(edge, sourcePort, _targetPort) {
            return diagram.portName.eval(sourcePort) === 'in';
        },
    };
    return _strategy;
}

function matchPorts(diagram, symbolPorts) {
    let _wports, _wedges, _validTargets;
    diagram.on('data.match-ports', (diagram, nodes, wnodes, edges, wedges, ports, wports) => {
        _wports = wports;
        _wedges = wedges;
    });
    diagram.on('transitionsStarted.match-ports', () => {
        symbolPorts.enableHover(true);
    });
    function change_state(ports, state) {
        return ports.map(p => {
            p.state = state;
            return diagram.portNodeKey.eval(p);
        });
    }
    function reset_ports(source) {
        const nids = change_state(_validTargets, 'small');
        source.port.state = 'small';
        nids.push(diagram.portNodeKey.eval(source.port));
        symbolPorts.animateNodes(nids);
    }
    function has_parallel(sourcePort, targetPort) {
        return _wedges.some(e =>
            sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0
        );
    }
    function is_valid(sourcePort, targetPort) {
        return (_strategy.allowParallel() || !has_parallel(sourcePort, targetPort))
            && _strategy.isValid()(sourcePort, targetPort);
    }
    function why_invalid(sourcePort, targetPort) {
        return !_strategy.allowParallel() && has_parallel(sourcePort, targetPort)
                && "can't connect two edges between the same two ports"
            || _strategy.whyInvalid()(sourcePort, targetPort);
    }
    const _strategy = {
        isValid: property((sourcePort, targetPort) =>
            targetPort !== sourcePort && targetPort.name === sourcePort.name
        ),
        whyInvalid: property((sourcePort, targetPort) =>
            targetPort === sourcePort && "can't connect port to itself"
            || targetPort.name !== sourcePort.name && 'must connect ports of the same type'
        ),
        allowParallel: property(false),
        hoverPort(port) {
            if (port) {
                _validTargets = _wports.filter(is_valid.bind(null, port));
                if (_validTargets.length)
                    return change_state(_validTargets, 'shimmer-medium');
            } else if (_validTargets)
                return change_state(_validTargets, 'small');
            return null;
        },
        startDragEdge(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            const nids = change_state(_validTargets, 'shimmer');
            if (_validTargets.length) {
                symbolPorts.enableHover(false);
                source.port.state = 'large';
                nids.push(diagram.portNodeKey.eval(source.port));
                symbolPorts.animateNodes(nids);
            }
            console.log('valid targets', nids);
            return _validTargets.length !== 0;
        },
        invalidSourceMessage(_source) {
            return 'no valid matches for this port';
        },
        changeDragTarget(source, target) {
            let nids, before;
            const valid = target && is_valid(source.port, target.port);
            if (valid) {
                nids = change_state(_validTargets, 'small');
                target.port.state = 'large'; // it's one of the valid
            } else {
                nids = change_state(_validTargets, 'small');
                before = symbolPorts.animateNodes(nids);
                nids = change_state(_validTargets, 'shimmer');
            }
            symbolPorts.animateNodes(nids, before);
            return valid;
        },
        validTargetMessage(_source, _target) {
            return "it's a match!";
        },
        invalidTargetMessage(source, target) {
            return why_invalid(source.port, target.port);
        },
        finishDragEdge(source, target) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return Promise.resolve(is_valid(source.port, target.port));
        },
        cancelDragEdge(source) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return true;
        },
    };
    return _strategy;
}

function moveNodes(options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );
    const fix_nodes_group = fixNodesGroup(options.fix_nodes_group || 'fix-nodes-group');
    let _selected = [], _startPos = null, _downNode, _moveStarted;
    let _brush, _drawGraphs, _keyboard;
    let _maybeSelect = null;

    function selection_changed(_diagram) {
        return function(selection, refresh) {
            _selected = selection;
        };
    }
    function for_each_selected(f, selected) {
        selected = selected || _selected;
        selected.forEach(key => {
            const n = _mode.parent().getWholeNode(key);
            f(n, key);
        });
    }
    function draw(diagram, node, edge) {
        node.on('mousedown.move-nodes', function(n) {
            // Need a more general way for modes to say "I got this"
            if (_drawGraphs && _drawGraphs.usePorts() && _drawGraphs.usePorts().eventPort(event))
                return;
            if (!_keyboard.modKeysMatch(_mode.modKeys()))
                return;
            _startPos = eventCoords(diagram, event);
            _downNode = select(this);
            // if the node under the mouse is not in the selection, need to
            // make that node selected
            const key = diagram.nodeKey.eval(n);
            let selected = _selected;
            if (_selected.indexOf(key) < 0) {
                selected = [key];
                _maybeSelect = key;
            } else _maybeSelect = null;
            for_each_selected(n => {
                n.original_position = [n.cola.x, n.cola.y];
            }, selected);
            if (_brush)
                _brush.deactivate();
        });
        function mouse_move(event) {
            if (_startPos) {
                if (!(event.buttons&1)) {
                    mouse_up();
                    return;
                }
                if (_maybeSelect)
                    select_nodes_group.call('set_changed', null, [_maybeSelect]);
                const pos = eventCoords(diagram, event);
                const dx = pos[0]-_startPos[0],
                    dy = pos[1]-_startPos[1];
                if (!_moveStarted && Math.hypot(dx, dy) > _mode.dragSize()) {
                    _moveStarted = true;
                    // prevent click event for this node setting selection just to this
                    if (_downNode)
                        _downNode.style('pointer-events', 'none');
                }
                if (_moveStarted) {
                    for_each_selected(n => {
                        n.cola.x = n.original_position[0]+dx;
                        n.cola.y = n.original_position[1]+dy;
                    });
                    const node2 = node.filter(n => _selected.includes(n.orig.key)),
                        edge2 = edge.filter(e =>
                            _selected.includes(e.source.orig.key)
                            || _selected.includes(e.target.orig.key)
                        );
                    diagram.reposition(node2, edge2);
                }
            }
        }
        function mouse_up() {
            if (_startPos) {
                if (_moveStarted) {
                    _moveStarted = false;
                    if (_downNode) {
                        _downNode.style('pointer-events', null);
                        _downNode = null;
                    }
                    const fixes = [];
                    for_each_selected((n, id) => {
                        fixes.push({
                            id,
                            pos: {x: n.cola.x, y: n.cola.y},
                        });
                    });
                    fix_nodes_group.call('request_fixes', null, fixes);
                }
                if (_brush)
                    _brush.activate();
                _startPos = null;
            }
        }
        node
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
        diagram.svg()
            .on('mousemove.move-nodes', mouse_move)
            .on('mouseup.move-nodes', mouse_up);
    }

    function remove(diagram, node, _edge) {
        node.on('mousedown.move-nodes', null);
        node.on('mousemove.move-nodes', null);
        node.on('mouseup.move-nodes', null);
    }

    const _mode = mode('move-nodes', {
        draw,
        remove,
        parent(p) {
            select_nodes_group.on('set_changed.move-nodes', p ? selection_changed() : null);
            if (p) {
                _brush = p.child('brush');
                _drawGraphs = p.child('draw-graphs');
                p.child('select-nodes');
                _keyboard = p.child('keyboard');
                if (!_keyboard)
                    p.child('keyboard', _keyboard = keyboard());
            } else _brush = _drawGraphs = null;
        },
    });

    // minimum distance that is considered a drag, not a click
    _mode.dragSize = property(5);
    _mode.modKeys = property(null);

    return _mode;
}

function canGetGraphFromThis(data) {
    return (data.nodes || data.vertices) && (data.edges || data.links);
}

// general-purpose reader of various json-based graph formats
// (esp but not limited to titan graph database-like formats)
// this could be generalized a lot
function mungeGraph(data, nodekeyattr, sourceattr, targetattr) {
    // we want data = {nodes, edges} and the field names for keys; find those in common json formats
    let nodes,
        edges,
        nka = nodekeyattr || 'name',
        sa = sourceattr || 'sourcename',
        ta = targetattr || 'targetname';

    if (!canGetGraphFromThis(data)) {
        const wrappers = ['database', 'response'];
        const wi = wrappers.findIndex(f => data[f] && canGetGraphFromThis(data[f]));
        if (wi < 0)
            throw new Error("couldn't find the data!");
        data = data[wrappers[wi]];
    }
    edges = data.edges || data.links;
    nodes = data.nodes || data.vertices;

    function find_attr(o, attrs) {
        return attrs.filter(a => !!o[a]);
    }

    // var edgekeyattr = "id";
    let edge0 = edges[0];
    if (edge0[sa] === undefined) {
        const sourceattrs = sourceattr
                ? [sourceattr]
                : ['source_ecomp_uid', 'node1', 'source', 'tail'],
            targetattrs = targetattr
                ? [targetattr]
                : ['target_ecomp_uid', 'node2', 'target', 'head'];
        // var edgekeyattrs = ['id', '_id', 'ecomp_uid'];
        const edgewrappers = ['edge'];
        if (edge0.node0 && edge0.node1) { // specific conflict here
            sa = 'node0';
            ta = 'node1';
        } else {
            let candidates = find_attr(edge0, sourceattrs);
            if (!candidates.length) {
                const wi = edgewrappers.findIndex(w =>
                    edge0[w] && find_attr(edge0[w], sourceattrs).length
                );
                if (wi < 0) {
                    if (sourceattr)
                        throw new Error(`sourceattr ${sa} didn't work`);
                    else
                        throw new Error("didn't find any source attr");
                }
                edges = edges.map(e => e[edgewrappers[wi]]);
                edge0 = edges[0];
                candidates = find_attr(edge0, sourceattrs);
            }
            if (candidates.length > 1)
                console.warn('found more than one possible source attr', candidates);
            sa = candidates[0];

            candidates = find_attr(edge0, targetattrs);
            if (!candidates.length) {
                if (targetattr && !edge0[targetattr])
                    throw new Error(`targetattr ${ta} didn't work`);
                else
                    throw new Error("didn't find any target attr");
            }
            if (candidates.length > 1)
                console.warn('found more than one possible target attr', candidates);
            ta = candidates[0];

            /*
             // we're currently assembling our own edgeid
            candidates = find_attr(edge0, edgekeyattrs);
            if(!candidates.length)
                throw new Error("didn't find any edge key");
            if(candidates.length > 1)
                console.warn('found more than one edge key attr', candidates);
            edgekeyattr = candidates[0];
             */
        }
    }
    let node0 = nodes[0];
    if (node0[nka] === undefined) {
        const nodekeyattrs = nodekeyattr ? [nodekeyattr] : ['ecomp_uid', 'id', '_id', 'key'];
        const nodewrappers = ['vertex'];
        let candidates = find_attr(node0, nodekeyattrs);
        if (!candidates.length) {
            const wi = nodewrappers.findIndex(w =>
                node0[w] && find_attr(node0[w], nodekeyattrs).length
            );
            if (wi < 0) {
                if (nodekeyattr)
                    throw new Error(`nodekeyattr ${nka} didn't work`);
                else
                    throw new Error("couldn't find the node data");
            }
            nodes = nodes.map(n => n[nodewrappers[wi]]);
            node0 = nodes[0];
            candidates = find_attr(node0, nodekeyattrs);
        }
        if (candidates.length > 1)
            console.warn('found more than one possible node key attr', candidates);
        nka = candidates[0];
    }

    return {
        nodes,
        edges,
        nodekeyattr: nka,
        sourceattr: sa,
        targetattr: ta,
    };
}

function pathReader(pathsgroup) {
    const highlight_paths_group = registerHighlightPathsGroup(
        pathsgroup || 'highlight-paths-group',
    );
    let _intervals, _intervalTree, _time;

    function register_path_objs(path, nop, eop) {
        reader.elementList.eval(path).forEach(element => {
            let key, paths;
            switch (reader.elementType.eval(element)) {
                case 'node':
                    key = reader.nodeKey.eval(element);
                    paths = nop[key] = nop[key] || [];
                    break;
                case 'edge':
                    key = `${reader.edgeSource.eval(element)}-${reader.edgeTarget.eval(element)}`;
                    paths = eop[key] = eop[key] || [];
                    break;
            }
            paths.push(path);
        });
    }

    const reader = {
        pathList: property(identity$2, false),
        timeRange: property(null, false),
        pathStrength: property(null, false),
        elementList: property(identity$2, false),
        elementType: property(null, false),
        nodeKey: property(null, false),
        edgeSource: property(null, false),
        edgeTarget: property(null, false),
        clear() {
            highlight_paths_group.paths_changed({}, {}, []);
        },
        data(data) {
            const nop = {}, eop = {}, allpaths = [];
            let has_ranges;
            reader.pathList.eval(data).forEach(path => {
                if ((path._range = reader.timeRange.eval(path))) { // ugh modifying user data
                    if (has_ranges === false)
                        throw new Error("can't have a mix of ranged and non-ranged paths");
                    has_ranges = true;
                } else {
                    if (has_ranges === true)
                        throw new Error("can't have a mix of ranged and non-ranged paths");
                    has_ranges = false;
                    register_path_objs(path, nop, eop);
                }
                allpaths.push(path);
            });
            if (has_ranges) {
                _intervals = allpaths.map(path => {
                    const interval = [path._range[0].getTime(), path._range[1].getTime()];
                    interval.path = path;
                    return interval;
                });
                // currently must include lysenko-interval-tree separately
                _intervalTree = lysenkoIntervalTree(_intervals);
                if (_time)
                    this.setTime(_time);
            } else {
                _intervals = null;
                _intervalTree = null;
                highlight_paths_group.paths_changed(nop, eop, allpaths);
            }
        },
        getIntervals() {
            return _intervals;
        },
        setTime(t) {
            if (t && _intervalTree) {
                const paths = [], nop = {}, eop = {};
                _intervalTree.queryPoint(t.getTime(), interval => {
                    paths.push(interval.path);
                    register_path_objs(interval.path, nop, eop);
                });
                highlight_paths_group.paths_changed(nop, eop, paths);
            }
            _time = t;
        },
    };

    return reader;
}

function pathSelector(parent, reader, pathsgroup, chartgroup) {
    const highlight_paths_group = registerHighlightPathsGroup(
        pathsgroup || 'highlight-paths-group',
    );
    const root = select(parent).append('svg');
    let paths_ = [];
    let hovered = null, selected = null;

    // unfortunately these functions are copied from highlightPaths
    function contains_path(paths) {
        return function(path) {
            return paths ? paths.indexOf(path) >= 0 : false;
        };
    }

    function doesnt_contain_path(paths) {
        const cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function toggle_paths(pathsA, pathsB) {
        if (!pathsA)
            return pathsB;
        else if (!pathsB)
            return pathsA;
        if (pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    // this should use the whole cascading architecture
    // and allow customization rather than hardcoding everything
    // in fact, you can't even reliably overlap attributes without that (so we don't)

    function draw_paths(diagram, paths) {
        if (paths.length === 0) return;
        const xpadding = 30;
        const space = 30;
        const radius = 8;
        // set the height of SVG accordingly
        root.attr('height', 20*(paths.length+1))
            .attr('width', xpadding+(space+2*radius)*(paths.length/2+1)+20);

        root.selectAll('.path-selector').remove();

        const pathlist = root.selectAll('g.path-selector').data(paths);
        pathlist.enter()
            .append('g')
            .attr('class', 'path-selector')
            .attr('transform', (path, i) => `translate(0, ${i*20})`)
            .each(function(path_data, i) {
                const nodes = path_data.element_list.filter(d => d.element_type === 'node');
                // line
                const line = select(this).append('line');
                line.attr('x1', xpadding+space)
                    .attr('y1', radius+1)
                    .attr('x2', xpadding+space*nodes.length)
                    .attr('y2', radius+1)
                    .attr('opacity', 0.4)
                    .attr('stroke-width', 5)
                    .attr('stroke', '#bdbdbd');

                // dots
                const path = select(this).selectAll('circle').data(nodes);
                path.enter()
                    .append('circle')
                    .attr('cx', (d, i) => xpadding+space*(i+1))
                    .attr('cy', radius+1)
                    .attr('r', radius)
                    .attr('opacity', 0.4)
                    .attr('fill', d => {
                        // TODO path_selector shouldn't know the data structure of orignal node objects
                        const regeneratedNode = {
                            key: d.property_map.ecomp_uid,
                            value: d.property_map,
                        };
                        return diagram.nodeStroke()(regeneratedNode);
                    });

                // label
                const text = select(this).append('text');
                text.text(`Path ${i}`)
                    .attr('class', 'path_label')
                    .attr('x', 0)
                    .attr('y', radius*1.7)
                    .on('mouseover.path-selector', () => {
                        highlight_paths_group.hover_changed([path_data]);
                    })
                    .on('mouseout.path-selector', () => {
                        highlight_paths_group.hover_changed(null);
                    })
                    .on('click.path-selector', () => {
                        highlight_paths_group.select_changed(toggle_paths(selected, [path_data]));
                    });
            });
        pathlist.exit().transition(1000).attr('opacity', 0).remove();
    }

    function draw_hovered() {
        const is_hovered = contains_path(hovered);
        root.selectAll('g.path-selector')
            .each(function(d, _i) {
                const textColor = is_hovered(d) ? '#e41a1c' : 'black';
                const lineColor = is_hovered(d) ? 'black' : '#bdbdbd';
                const opacity = is_hovered(d) ? '1' : '0.4';
                select(this).select('.path_label').attr('fill', textColor);
                select(this).selectAll('line')
                    .attr('stroke', lineColor)
                    .attr('opacity', opacity);
                select(this).selectAll('circle').attr('opacity', opacity);
            });
    }

    function draw_selected() {
        const is_selected = contains_path(selected);
        root.selectAll('g.path-selector')
            .each(function(d, _i) {
                const textWeight = is_selected(d) ? 'bold' : 'normal';
                const lineColor = is_selected(d) ? 'black' : '#bdbdbd';
                const opacity = is_selected(d) ? '1' : '0.4';
                select(this).select('.path_label')
                    .attr('font-weight', textWeight);
                select(this).selectAll('line')
                    .attr('stroke', lineColor)
                    .attr('opacity', opacity);
                select(this).selectAll('circle').attr('opacity', opacity);
            });
    }

    highlight_paths_group
        .on('paths_changed.path-selector', (nop, eop, paths) => {
            hovered = selected = null;
            paths_ = paths;
            selector.redraw();
        })
        .on('hover_changed.path-selector', hpaths => {
            hovered = hpaths;
            draw_hovered();
        })
        .on('select_changed.path-selector', spaths => {
            selected = spaths;
            draw_selected();
        });
    const selector = {
        default_text: property('Nothing here'),
        zero_text: property('No paths'),
        error_text: property(null),
        queried: property(false),
        redraw() {
            draw_paths(selector, paths_);
            draw_hovered();
            draw_selected();
        },
        render() {
            this.redraw();
            return this;
        },
    };
    registerChart(selector, chartgroup);
    return selector;
}

function renderWebgl() {
    // var _svg = null, _defs = null, _g = null, _nodeLayer = null, _edgeLayer = null;
    let _camera, _scene, _webgl_renderer;
    let _directionalLight, _ambientLight;
    let _controls;
    let _sphereGeometry;
    const _nodes = {}, _edges = {};
    let _animating = false; // do not refresh during animations
    const _renderer = {};

    _renderer.rendererType = function() {
        return 'webgl';
    };

    _renderer.parent = property(null);

    _renderer.isRendered = function() {
        return !!_camera;
    };

    _renderer.resize = function(_w, _h) {
        return _renderer;
    };

    _renderer.rezoom = function(_oldWidth, _oldHeight, _newWidth, _newHeight) {
        return _renderer;
    };

    _renderer.globalTransform = function(_pos, _scale, _animate) {
        return _renderer;
    };

    _renderer.translate = function(_) {
        if (!arguments.length)
            return [0, 0];
        return _renderer;
    };

    _renderer.scale = function(_) {
        if (!arguments.length)
            return 1;
        return _renderer;
    };

    // argh
    _renderer.commitTranslateScale = function() {
    };

    _renderer.initializeDrawing = function() {
        if (_scene) // just treat it as a redraw
            return _renderer;

        _camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 10000);
        _camera.up = new THREE.Vector3(0, 0, 1);

        _scene = new THREE.Scene();

        _sphereGeometry = new THREE.SphereBufferGeometry(10, 32, 32);

        _directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        _directionalLight.position.set(-1, -1, 1).normalize();
        _scene.add(_directionalLight);

        _ambientLight = new THREE.AmbientLight(0xaaaaaa);
        _scene.add(_ambientLight);

        _webgl_renderer = new THREE.WebGLRenderer({antialias: true});
        _webgl_renderer.setPixelRatio(window.devicePixelRatio);
        const boundRect = _renderer.parent().root().node().getBoundingClientRect();
        _webgl_renderer.setSize(boundRect.width, boundRect.height);
        _renderer.parent().root().node().appendChild(_webgl_renderer.domElement);

        _controls = new THREE.OrbitControls(_camera, _webgl_renderer.domElement);
        _controls.minDistance = 300;
        _controls.maxDistance = 1000;
        return _renderer;
    };

    _renderer.startRedraw = function(dispatch, wnodes, wedges) {
        wnodes.forEach(inferShape(_renderer.parent()));
        const rnodes = regenerateObjects(
            _nodes,
            wnodes,
            null,
            n => _renderer.parent().nodeKey.eval(n),
            (rn, n) => {
                rn.wnode = n;
            },
            null,
            (wnode, rnode) => {
                _scene.remove(rnode.mesh);
                // rnode.mesh.dispose();
                rnode.material.dispose();
            },
        );
        const redges = regenerateObjects(
            _edges,
            wedges,
            null,
            e => _renderer.parent().edgeKey.eval(e),
            (re, e) => {
                re.wedge = e;
            },
            null,
            (wedge, redge) => {
                _scene.remove(redge.mesh);
                // redge.mesh.dispose();
                redge.geometry.dispose();
                redge.material.dispose();
            },
        );
        animate();
        return {wnodes, wedges, rnodes, redges};
    };

    function color_to_int(color) {
        // it better be 6 byte hex RGB
        if (color.length !== 7 || color[0] !== '#') {
            console.warn(`don't know how to use color ${color}`);
            color = '#888888';
        }
        return parseInt(color.slice(1), 16);
    }
    _renderer.color_to_int = color_to_int;

    _renderer.draw = function(drawState, _animatePositions) {
        drawState.wedges.forEach(e => {
            if (!e.pos.old)
                _renderer.parent().calcEdgePath(
                    e,
                    'old',
                    e.source.prevX || e.source.cola.x,
                    e.source.prevY || e.source.cola.y,
                    e.target.prevX || e.target.cola.x,
                    e.target.prevY || e.target.cola.y,
                );
            if (!e.pos.new)
                _renderer.parent().calcEdgePath(
                    e,
                    'new',
                    e.source.cola.x,
                    e.source.cola.y,
                    e.target.cola.x,
                    e.target.cola.y,
                );
        });

        const MULT = _renderer.multiplier();
        drawState.rnodes.forEach(rn => {
            let color = _renderer.parent().nodeFill.eval(rn.wnode);
            let add = false;
            if (!rn.mesh) {
                add = true;
                if (_renderer.parent().nodeFillScale())
                    color = _renderer.parent().nodeFillScale()(color);
                const cint = color_to_int(color);
                rn.material = new THREE.MeshLambertMaterial({color: cint});
                rn.mesh = new THREE.Mesh(_sphereGeometry, rn.material);
                rn.mesh.name = _renderer.parent().nodeKey.eval(rn.wnode);
            }
            rn.mesh.position.x = rn.wnode.cola.x*MULT;
            rn.mesh.position.y = -rn.wnode.cola.y*MULT;
            rn.mesh.position.z = rn.wnode.cola.z*MULT || 0;
            if (add)
                _scene.add(rn.mesh);
        });

        const xext = extent(drawState.wnodes, n => n.cola.x*MULT),
            yext = extent(drawState.wnodes, n => -n.cola.y*MULT),
            zext = extent(drawState.wnodes, n => n.cola.z*MULT || 0);
        const cx = (xext[0]+xext[1])/2,
            cy = (yext[0]+yext[1])/2,
            cz = (zext[0]+zext[1])/2;

        drawState.center = [cx, cy, cz];
        drawState.extents = [xext, yext, zext];
        _controls.target.set(cx, cy, cz);
        _controls.update();
        drawState.redges.forEach(re => {
            if (!re.wedge.source || !re.wedge.target)
                return;
            const a = re.wedge.source.cola, b = re.wedge.target.cola;
            let add = false;
            const width = _renderer.parent().edgeStrokeWidth.eval(re.wedge);
            if (!re.mesh) {
                add = true;
                const color = _renderer.parent().edgeStroke.eval(re.wedge);
                const cint = color_to_int(color);
                re.material = new THREE.MeshLambertMaterial({color: cint});
                re.curve = new THREE.LineCurve3(
                    new THREE.Vector3(a.x*MULT, -a.y*MULT, a.z*MULT || 0),
                    new THREE.Vector3(b.x*MULT, -b.y*MULT, b.z*MULT || 0),
                );
                re.geometry = new THREE.TubeBufferGeometry(re.curve, 20, width/2, 8, false);
                re.mesh = new THREE.Mesh(re.geometry, re.material);
                re.mesh.name = _renderer.parent().edgeKey.eval(re.wedge);
            } else {
                re.curve = new THREE.LineCurve3(
                    new THREE.Vector3(a.x*MULT, -a.y*MULT, a.z*MULT || 0),
                    new THREE.Vector3(b.x*MULT, -b.y*MULT, b.z*MULT || 0),
                );
                re.geometry.dispose();
                re.geometry = new THREE.TubeBufferGeometry(re.curve, 20, width/2, 8, false);
                re.mesh.geometry = re.geometry;
            }
            if (add)
                _scene.add(re.mesh);
        });
        _animating = false;
        _renderer.parent().layoutDone(true);
        return _renderer;
    };

    function animate() {
        window.requestAnimationFrame(animate);
        render();
    }

    function render() {
        _webgl_renderer.render(_scene, _camera);
    }

    _renderer.drawPorts = function(drawState) {
        const nodePorts = _renderer.parent().nodePorts();
        if (!nodePorts)
            return;
        _renderer.parent().portStyle.enum().forEach(style => {
            for (const nid in nodePorts)
                nodePorts[nid].filter(p =>
                    _renderer.parent().portStyleName.eval(p) === style
                );
            // not implemented
            _renderer.selectNodePortsOfStyle(drawState.node, style);
            // _renderer.parent().portStyle(style).drawPorts(port, nodePorts2, drawState.node);
        });
    };

    _renderer.fireTSEvent = function(dispatch, drawState) {
        dispatch.call('transitionsStarted', null, _scene, drawState);
    };

    _renderer.calculateBounds = function(drawState) {
        if (!drawState.wnodes.length)
            return null;
        return _renderer.parent().calculateBounds(drawState.wnodes, drawState.wedges);
    };

    _renderer.refresh = function(_node, _edge, _edgeHover, _edgeLabels, _textPaths) {
        if (_animating)
            return _renderer; // but what about changed attributes?
        return _renderer;
    };

    _renderer.reposition = function(_node, _edge) {
        return _renderer;
    };

    _renderer.animating = function() {
        return _animating;
    };

    _renderer.multiplier = property(3);

    return _renderer;
}

function selectEdges(props, options) {
    options = options || {};
    const select_edges_group = selectThingsGroup(
        options.select_edges_group || 'select-edges-group',
        'select-edges',
    );
    const thinginess = {
        intersectRect(ext) {
            return this.clickables().data().filter(e => {
                // this nonsense because another select_things may have invalidated the edge positions (!!)
                const sp = {
                        x: e.source.cola.x+e.sourcePort.pos.x,
                        y: e.source.cola.y+e.sourcePort.pos.y,
                    },
                    tp = {
                        x: e.target.cola.x+e.targetPort.pos.x,
                        y: e.target.cola.y+e.targetPort.pos.y,
                    };
                return [sp, tp].some(p =>
                    ext[0][0] < p.x && p.x < ext[1][0]
                    && ext[0][1] < p.y && p.y < ext[1][1]
                );
            }).map(this.key);
        },
        clickables() {
            return _mode.parent().selectAllEdges('.edge-hover');
        },
        key(e) {
            return _mode.parent().edgeKey.eval(e);
        },
        applyStyles(pred) {
            _mode.parent().cascade(50, true, nodeEdgeConditions(null, pred, props));
        },
        removeStyles() {
            _mode.parent().cascade(50, false, props);
        },
    };
    const _mode = selectThings(select_edges_group, 'select-edges', thinginess);
    return _mode;
}

function selectNodes(props, options) {
    options = options || {};
    const select_nodes_group = selectThingsGroup(
        options.select_nodes_group || 'select-nodes-group',
        'select-nodes',
    );

    const thinginess = {
        intersectRect(ext) {
            return _mode.parent().selectAllNodes().data().filter(n =>
                n && ext[0][0] < n.cola.x && n.cola.x < ext[1][0]
                && ext[0][1] < n.cola.y && n.cola.y < ext[1][1]
            ).map(this.key);
        },
        clickables(diagram, node, _edge) {
            return node;
        },
        excludeClick(element) {
            return ancestorHasClass(element, 'port');
        },
        key(n) {
            return _mode.parent().nodeKey.eval(n);
        },
        applyStyles(pred) {
            _mode.parent().cascade(50, true, nodeEdgeConditions(pred, null, props));
        },
        removeStyles() {
            _mode.parent().cascade(50, false, props);
        },
    };
    const _mode = selectThings(select_nodes_group, 'select-nodes', thinginess);
    return _mode;
}

function selectPorts(props, options) {
    options = options || {};
    const port_style = options.portStyle || 'symbols';
    const select_ports_group = selectThingsGroup(
        options.select_ports_group || 'select-ports-group',
        'select-ports',
    );
    const thinginess = {
        laterDraw: true,
        intersectRect: null, // multiple selection not supported for now
        clickables() {
            return _mode.parent().selectAllNodes('g.port');
        },
        key(p) {
            // this scheme also won't work with multiselect
            return p.named
                ? {node: _mode.parent().nodeKey.eval(p.node), name: p.name}
                : {edge: _mode.parent().edgeKey.eval(p.edges[0]), name: p.name};
        },
        applyStyles(pred) {
            _mode.parent().portStyle(port_style).cascade(
                50,
                true,
                conditionalProperties(pred, props),
            );
        },
        removeStyles() {
            _mode.parent().portStyle(port_style).cascade(50, false, props);
        },
        keysEqual(k1, k2) {
            return k1.name === k2.name && (k1.node ? k1.node === k2.node : k1.edge === k2.edge);
        },
    };
    const _mode = selectThings(select_ports_group, 'select-ports', thinginess);
    return _mode;
}

function splinePaths(pathreader, pathprops, hoverprops, selectprops, pathsgroup) {
    const highlight_paths_group = registerHighlightPathsGroup(
        pathsgroup || 'highlight-paths-group',
    );
    pathprops = pathprops || {};
    hoverprops = hoverprops || {};
    let _paths = null, _hoverpaths = null, _selected = null;
    let _anchor;
    let _layer = null;
    let _savedPositions = null;

    function paths_changed(nop, eop, paths) {
        _paths = paths;

        const engine = _mode.parent().layoutEngine(),
            localPaths = paths.filter(pathIsPresent);
        if (localPaths.length) {
            const nidpaths = localPaths.map(lpath => {
                let strength = pathreader.pathStrength.eval(lpath);
                if (typeof strength !== 'number')
                    strength = 1;
                if (_selected && _selected.indexOf(lpath) !== -1)
                    strength *= _mode.selectedStrength();
                return {
                    nodes: path_keys(lpath),
                    strength,
                };
            });
            engine.paths(nidpaths);
        } else {
            engine.paths(null);
            if (_savedPositions)
                engine.restorePositions(_savedPositions);
        }
        if (_selected)
            _selected = _selected.filter(p => localPaths.indexOf(p) !== -1);
        _mode.parent().redraw();
    }

    function select_changed(sp) {
        if (sp !== _selected) {
            _selected = sp;
            paths_changed(null, null, _paths);
        }
    }

    function path_keys(path, unique) {
        unique = unique !== false;
        const keys = pathreader.elementList.eval(path).filter(elem =>
            pathreader.elementType.eval(elem) === 'node'
        ).map(elem => pathreader.nodeKey.eval(elem));
        return unique ? uniq(keys) : keys;
    }

    // check if entire path is present in this view
    function pathIsPresent(path) {
        return pathreader.elementList.eval(path).every(element =>
            pathreader.elementType.eval(element) !== 'node'
            || _mode.parent().getWholeNode(pathreader.nodeKey.eval(element))
        );
    }

    // get the positions of nodes on path
    function getNodePositions(path, old) {
        return path_keys(path, false).map(key => {
            const node = _mode.parent().getWholeNode(key);
            return {
                x: old && node.prevX !== undefined ? node.prevX : node.cola.x,
                y: old && node.prevY !== undefined ? node.prevY : node.cola.y,
            };
        });
    }

    // helper functions
    const vecDot = function(v0, v1) {
        return v0.x*v1.x+v0.y*v1.y;
    };
    const vecMag = function(v) {
        return Math.sqrt(v.x*v.x+v.y*v.y);
    };
    const l2Dist = function(p1, p2) {
        return Math.sqrt((p1.x-p2.x)*(p1.x-p2.x)+(p1.y-p2.y)*(p1.y-p2.y));
    };

    function drawCardinalSpline(points, lineTension, avoidSharpTurn, angleThreshold) {
        const c = lineTension || 0;
        avoidSharpTurn = avoidSharpTurn !== false;
        angleThreshold = angleThreshold || 0.02;

        // get the path without self loops
        const path_list = [points[0]];
        for (let i = 1; i < points.length; i++) {
            if (l2Dist(points[i], path_list[path_list.length-1]) > 1e-6) {
                path_list.push(points[i]);
            }
        }

        // repeat first and last node
        points = [path_list[0]];
        points = points.concat(path_list);
        points.push(path_list[path_list.length-1]);

        // a segment is a list of three points: [c0, c1, p1],
        // representing the coordinates in "C x0,y0,x1,y1,x,y" in svg:path
        const segments = []; // control points
        for (let i = 1; i < points.length-2; i++) {
            // generate svg:path
            const m_0_x = (1-c)*(points[i+1].x-points[i-1].x)/2;
            const m_0_y = (1-c)*(points[i+1].y-points[i-1].y)/2;

            const m_1_x = (1-c)*(points[i+2].x-points[i].x)/2;
            const m_1_y = (1-c)*(points[i+2].y-points[i].y)/2;

            const p0 = points[i];
            const p1 = points[i+1];
            let c0 = p0;
            if (i !== 1) {
                c0 = {x: p0.x+(m_0_x/3), y: p0.y+(m_0_y/3)};
            }
            let c1 = p1;
            if (i !== points.length-3) {
                c1 = {x: p1.x-(m_1_x/3), y: p1.y-(m_1_y/3)};
            }

            // detect special case by calculating the angle
            if (avoidSharpTurn) {
                const v0 = {x: points[i-1].x-points[i].x, y: points[i-1].y-points[i].y};
                const v1 = {x: points[i+1].x-points[i].x, y: points[i+1].y-points[i].y};
                let acosValue = vecDot(v0, v1)/(vecMag(v0)*vecMag(v1));
                acosValue = Math.max(-1, Math.min(1, acosValue));
                const angle = Math.acos(acosValue);

                if (angle <= angleThreshold) {
                    const m_x = (1-c)*(points[i].x-points[i-1].x)/2;
                    const m_y = (1-c)*(points[i].y-points[i-1].y)/2;
                    const k = 2;

                    const cp1 = {x: p0.x+k*(-m_y/3), y: p0.y+k*(m_x/3)};
                    const cp2 = {x: p0.x-k*(-m_y/3), y: p0.y-k*(m_x/3)};
                    // CP_1CP_2
                    const vCP = {x: cp1.x-cp2.x, y: cp1.y-cp2.y}; // vector cp1->cp2
                    const vPN = {x: points[i-2].x-points[i+2].x, y: points[i-2].y-points[i+2].y}; // vector Previous->Next
                    if (vecDot(vCP, vPN) > 0) {
                        c0 = cp1;
                        segments[segments.length-1][1] = cp2;
                    } else {
                        c0 = cp2;
                        segments[segments.length-1][1] = cp1;
                    }
                }
            }

            segments.push([c0, c1, p1]);
        }

        let path_d = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < segments.length; i++) {
            const s = segments[i];
            path_d += `C${s[0].x},${s[0].y}`;
            path_d += `,${s[1].x},${s[1].y}`;
            path_d += `,${s[2].x},${s[2].y}`;
        }
        return path_d;
    }

    function drawDedicatedLoops(points, _lineTension, _avoidSharpTurn, _angleThreshold) {
        // get loops as segments
        let p1 = 0, p2 = 1;
        const seg_list = []; // (start, end)
        while (p1 < points.length-1 && p2 < points.length) {
            if (l2Dist(points[p1], points[p2]) < 1e-6) {
                const repeated = points[p2];
                while (p2 < points.length && l2Dist(points[p2], repeated) < 1e-6) p2++;
                seg_list.push({'start': Math.max(0, p1-1), 'end': Math.min(points.length-1, p2)});
                p1 = p2;
                p2 = p1+1;
            } else {
                p1++;
                p2++;
            }
        }

        let loopCurves = '';
        for (let i = 0; i < seg_list.length; i++) {
            const segment = seg_list[i];
            const loopCount = segment.end-segment.start-2;
            const anchorPoint = points[segment.start+1];

            // the vector from previous node to next node
            let vec_pre_next = {
                x: points[segment.end].x-points[segment.start].x,
                y: points[segment.end].y-points[segment.start].y,
            };

            // when previous node and next node are the same node, we need to handle
            // them differently.
            // e.g. for a loop segment A->B->B->A, we use the perpendicular vector perp_AB
            // instead of vector AA(which is vec_pre_next in this case).
            if (vecMag(vec_pre_next) == 0) {
                vec_pre_next = {
                    x: -(points[segment.end].y-anchorPoint.y),
                    y: points[segment.end].x-anchorPoint.x,
                };
            }

            // unit length vector
            const vec_pre_next_unit = {
                x: vec_pre_next.x/vecMag(vec_pre_next),
                y: vec_pre_next.y/vecMag(vec_pre_next),
            };
            const vec_pre_next_perp = {
                x: -vec_pre_next.y/vecMag(vec_pre_next),
                y: vec_pre_next.x/vecMag(vec_pre_next),
            };

            let insertP;
            for (let j = 0; j < loopCount; j++) {
                // change the control points every time this loop appears
                const cp_k = 15+2*j;

                // calculate c1 and c4, their tangent match the tangent at anchorPoint
                const c1 = {
                    x: anchorPoint.x+cp_k*vec_pre_next_unit.x,
                    y: anchorPoint.y+cp_k*vec_pre_next_unit.y,
                };

                const c4 = {
                    x: anchorPoint.x-cp_k*vec_pre_next_unit.x,
                    y: anchorPoint.y-cp_k*vec_pre_next_unit.y,
                };

                // change the location of inserted virtual point every time this loop appears
                const control_k = 25+5*j;
                const insertP1 = {
                    x: anchorPoint.x+vec_pre_next_perp.x*control_k,
                    y: anchorPoint.y+vec_pre_next_perp.y*control_k,
                };
                const insertP2 = {
                    x: anchorPoint.x-vec_pre_next_perp.x*control_k,
                    y: anchorPoint.y-vec_pre_next_perp.y*control_k,
                };
                const vec_i_to_next = {
                    x: points[segment.end].x-anchorPoint.x,
                    y: points[segment.end].y-anchorPoint.y,
                };
                const vec_i_to_insert = {
                    x: insertP1.x-anchorPoint.x,
                    y: insertP1.y-anchorPoint.y,
                };
                insertP = insertP1;
                if (vecDot(vec_i_to_insert, vec_i_to_next) > 0) {
                    insertP = insertP2;
                }

                // calculate c2 and c3 based on insertP
                const c2 = {
                    x: insertP.x+cp_k*vec_pre_next_unit.x,
                    y: insertP.y+cp_k*vec_pre_next_unit.y,
                };

                const c3 = {
                    x: insertP.x-cp_k*vec_pre_next_unit.x,
                    y: insertP.y-cp_k*vec_pre_next_unit.y,
                };

                let curve = `M${anchorPoint.x},${anchorPoint.y}`;
                curve += `C${c1.x},${c1.y},${c2.x},${c2.y},${insertP.x},${insertP.y}`;
                curve += `C${c3.x},${c3.y},${c4.x},${c4.y},${anchorPoint.x},${anchorPoint.y}`;

                loopCurves += curve;
            }
        }
        return loopCurves;
    }

    // convert original path data into <d>
    function genPath(originalPoints, old, lineTension, avoidSharpTurn, angleThreshold) {
        // get coordinates
        const path_coord = getNodePositions(originalPoints, old);
        if (path_coord.length < 2) return '';

        let result = '';
        // process the points and treat them differently:
        // 1. sub-path without self loop
        result += drawCardinalSpline(path_coord, lineTension, avoidSharpTurn, angleThreshold);

        // 2. a list of loop segments
        result += drawDedicatedLoops(path_coord);

        return result;
    }

    // draw the spline for paths
    function drawSpline(paths) {
        if (paths === null) {
            _savedPositions = _mode.parent().layoutEngine().savePositions();
            return;
        }

        paths = paths.filter(pathIsPresent);
        const hoverpaths = _hoverpaths || [],
            selected = _selected || [];

        // edge spline
        let edge = _layer.selectAll('.spline-edge').data(paths, path => path_keys(path).join(','));
        edge.exit().remove();
        const edgeEnter = edge.enter().append('svg:path')
            .attr('class', 'spline-edge')
            .attr('id', (d, i) => `spline-path-${i}`)
            .attr('stroke-width', pathprops.edgeStrokeWidth || 1)
            .attr('fill', 'none')
            .attr('d', d => genPath(d, true, pathprops.lineTension, _mode.avoidSharpTurns()));
        edge = edge.merge(edgeEnter);
        edge
            .attr('stroke', p =>
                selected.indexOf(p) !== -1 && selectprops.edgeStroke
                || hoverpaths.indexOf(p) !== -1 && hoverprops.edgeStroke
                || pathprops.edgeStroke || 'black')
            .attr('opacity', p =>
                selected.indexOf(p) !== -1 && selectprops.edgeOpacity
                || hoverpaths.indexOf(p) !== -1 && hoverprops.edgeOpacity
                || pathprops.edgeOpacity || 1);
        function path_order(p) {
            return hoverpaths.indexOf(p) !== -1
                ? 2
                : selected.indexOf(p) !== -1
                ? 1
                : 0;
        }
        edge.sort((a, b) => path_order(a)-path_order(b));
        _layer.selectAll('.spline-edge-hover')
            .each(function() {
                this.parentNode.appendChild(this);
            });
        edge.transition().duration(_mode.parent().transitionDuration())
            .attr('d', d => genPath(d, false, pathprops.lineTension, _mode.avoidSharpTurns()));

        // another wider copy of the edge just for hover events
        let edgeHover = _layer.selectAll('.spline-edge-hover')
            .data(paths, path => path_keys(path).join(','));
        edgeHover.exit().remove();
        const edgeHoverEnter = edgeHover.enter().append('svg:path')
            .attr('class', 'spline-edge-hover')
            .attr('d', d => genPath(d, true, pathprops.lineTension, _mode.avoidSharpTurns()))
            .attr('opacity', 0)
            .attr('stroke', 'green')
            .attr('stroke-width', (pathprops.edgeStrokeWidth || 1)+4)
            .attr('fill', 'none')
            .on('mouseover.spline-paths', d => {
                highlight_paths_group.hover_changed([d]);
            })
            .on('mouseout.spline-paths', _d => {
                highlight_paths_group.hover_changed(null);
            })
            .on('click.spline-paths', d => {
                let selected = _selected && _selected.slice(0) || [];
                const i = selected.indexOf(d);
                if (i !== -1)
                    selected.splice(i, 1);
                else if (event.shiftKey)
                    selected.push(d);
                else
                    selected = [d];
                highlight_paths_group.select_changed(selected);
            });
        edgeHover = edgeHover.merge(edgeHoverEnter);
        edgeHover.transition().duration(_mode.parent().transitionDuration())
            .attr('d', d => genPath(d, false, pathprops.lineTension, _mode.avoidSharpTurns()));
    }

    function draw(_diagram, _node, _edge, _ehover) {
        _layer = _mode.parent().select('g.draw').selectAll('g.spline-layer').data([0]);
        _layer.enter().append('g').attr('class', 'spline-layer');

        drawSpline(_paths);
    }

    const _mode = mode('draw-spline-paths', {
        laterDraw: true,
        draw,
        remove(diagram, node, edge, ehover) {
            return this;
        },
        parent(p) {
            if (p)
                _anchor = p.anchorName();
            highlight_paths_group
                .on(`paths_changed.draw-spline-paths-${_anchor}`, p ? paths_changed : null)
                .on(`select_changed.draw-spline-paths-${_anchor}`, p ? select_changed : null)
                .on(
                    `hover_changed.draw-spline-paths-${_anchor}`,
                    p
                        ? hpaths => {
                            _hoverpaths = hpaths;
                            drawSpline(_paths);
                        }
                        : null,
                );
        },
    });
    _mode.selectedStrength = property(1);
    _mode.avoidSharpTurns = property(true);

    return _mode;
}

const drawSplinePaths = deprecateFunction(
    'draw_spline_paths has been renamed spline_paths, please update',
    splinePaths,
);

var pi$1 = Math.PI,
    tau$1 = 2 * pi$1,
    epsilon$1 = 1e-6,
    tauEpsilon = tau$1 - epsilon$1;

function Path() {
  this._x0 = this._y0 = // start of current subpath
  this._x1 = this._y1 = null; // end of current subpath
  this._ = "";
}

function path() {
  return new Path;
}

Path.prototype = path.prototype = {
  constructor: Path,
  moveTo: function(x, y) {
    this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y);
  },
  closePath: function() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._ += "Z";
    }
  },
  lineTo: function(x, y) {
    this._ += "L" + (this._x1 = +x) + "," + (this._y1 = +y);
  },
  quadraticCurveTo: function(x1, y1, x, y) {
    this._ += "Q" + (+x1) + "," + (+y1) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
  },
  bezierCurveTo: function(x1, y1, x2, y2, x, y) {
    this._ += "C" + (+x1) + "," + (+y1) + "," + (+x2) + "," + (+y2) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
  },
  arcTo: function(x1, y1, x2, y2, r) {
    x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
    var x0 = this._x1,
        y0 = this._y1,
        x21 = x2 - x1,
        y21 = y2 - y1,
        x01 = x0 - x1,
        y01 = y0 - y1,
        l01_2 = x01 * x01 + y01 * y01;

    // Is the radius negative? Error.
    if (r < 0) throw new Error("negative radius: " + r);

    // Is this path empty? Move to (x1,y1).
    if (this._x1 === null) {
      this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
    }

    // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
    else if (!(l01_2 > epsilon$1)) ;

    // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
    // Equivalently, is (x1,y1) coincident with (x2,y2)?
    // Or, is the radius zero? Line to (x1,y1).
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon$1) || !r) {
      this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
    }

    // Otherwise, draw an arc!
    else {
      var x20 = x2 - x0,
          y20 = y2 - y0,
          l21_2 = x21 * x21 + y21 * y21,
          l20_2 = x20 * x20 + y20 * y20,
          l21 = Math.sqrt(l21_2),
          l01 = Math.sqrt(l01_2),
          l = r * Math.tan((pi$1 - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
          t01 = l / l01,
          t21 = l / l21;

      // If the start tangent is not coincident with (x0,y0), line to.
      if (Math.abs(t01 - 1) > epsilon$1) {
        this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
      }

      this._ += "A" + r + "," + r + ",0,0," + (+(y01 * x20 > x01 * y20)) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
    }
  },
  arc: function(x, y, r, a0, a1, ccw) {
    x = +x, y = +y, r = +r;
    var dx = r * Math.cos(a0),
        dy = r * Math.sin(a0),
        x0 = x + dx,
        y0 = y + dy,
        cw = 1 ^ ccw,
        da = ccw ? a0 - a1 : a1 - a0;

    // Is the radius negative? Error.
    if (r < 0) throw new Error("negative radius: " + r);

    // Is this path empty? Move to (x0,y0).
    if (this._x1 === null) {
      this._ += "M" + x0 + "," + y0;
    }

    // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
    else if (Math.abs(this._x1 - x0) > epsilon$1 || Math.abs(this._y1 - y0) > epsilon$1) {
      this._ += "L" + x0 + "," + y0;
    }

    // Is this arc empty? We’re done.
    if (!r) return;

    // Does the angle go the wrong way? Flip the direction.
    if (da < 0) da = da % tau$1 + tau$1;

    // Is this a complete circle? Draw two arcs to complete the circle.
    if (da > tauEpsilon) {
      this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x - dx) + "," + (y - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
    }

    // Is this arc non-empty? Draw an arc!
    else if (da > epsilon$1) {
      this._ += "A" + r + "," + r + ",0," + (+(da >= pi$1)) + "," + cw + "," + (this._x1 = x + r * Math.cos(a1)) + "," + (this._y1 = y + r * Math.sin(a1));
    }
  },
  rect: function(x, y, w, h) {
    this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y) + "h" + (+w) + "v" + (+h) + "h" + (-w) + "Z";
  },
  toString: function() {
    return this._;
  }
};

function constant(x) {
  return function constant() {
    return x;
  };
}

var epsilon = 1e-12;
var pi = Math.PI;
var tau = 2 * pi;

var circle = {
  draw: function(context, size) {
    var r = Math.sqrt(size / pi);
    context.moveTo(r, 0);
    context.arc(0, 0, r, 0, tau);
  }
};

var cross = {
  draw: function(context, size) {
    var r = Math.sqrt(size / 5) / 2;
    context.moveTo(-3 * r, -r);
    context.lineTo(-r, -r);
    context.lineTo(-r, -3 * r);
    context.lineTo(r, -3 * r);
    context.lineTo(r, -r);
    context.lineTo(3 * r, -r);
    context.lineTo(3 * r, r);
    context.lineTo(r, r);
    context.lineTo(r, 3 * r);
    context.lineTo(-r, 3 * r);
    context.lineTo(-r, r);
    context.lineTo(-3 * r, r);
    context.closePath();
  }
};

var tan30 = Math.sqrt(1 / 3),
    tan30_2 = tan30 * 2;

var diamond = {
  draw: function(context, size) {
    var y = Math.sqrt(size / tan30_2),
        x = y * tan30;
    context.moveTo(0, -y);
    context.lineTo(x, 0);
    context.lineTo(0, y);
    context.lineTo(-x, 0);
    context.closePath();
  }
};

var ka = 0.89081309152928522810,
    kr = Math.sin(pi / 10) / Math.sin(7 * pi / 10),
    kx = Math.sin(tau / 10) * kr,
    ky = -Math.cos(tau / 10) * kr;

var star = {
  draw: function(context, size) {
    var r = Math.sqrt(size * ka),
        x = kx * r,
        y = ky * r;
    context.moveTo(0, -r);
    context.lineTo(x, y);
    for (var i = 1; i < 5; ++i) {
      var a = tau * i / 5,
          c = Math.cos(a),
          s = Math.sin(a);
      context.lineTo(s * r, -c * r);
      context.lineTo(c * x - s * y, s * x + c * y);
    }
    context.closePath();
  }
};

var square = {
  draw: function(context, size) {
    var w = Math.sqrt(size),
        x = -w / 2;
    context.rect(x, x, w, w);
  }
};

var sqrt3 = Math.sqrt(3);

var triangle = {
  draw: function(context, size) {
    var y = -Math.sqrt(size / (sqrt3 * 3));
    context.moveTo(0, y * 2);
    context.lineTo(-sqrt3 * y, -y);
    context.lineTo(sqrt3 * y, -y);
    context.closePath();
  }
};

var c = -0.5,
    s = Math.sqrt(3) / 2,
    k = 1 / Math.sqrt(12),
    a = (k / 2 + 1) * 3;

var wye = {
  draw: function(context, size) {
    var r = Math.sqrt(size / a),
        x0 = r / 2,
        y0 = r * k,
        x1 = x0,
        y1 = r * k + r,
        x2 = -x1,
        y2 = y1;
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineTo(c * x0 - s * y0, s * x0 + c * y0);
    context.lineTo(c * x1 - s * y1, s * x1 + c * y1);
    context.lineTo(c * x2 - s * y2, s * x2 + c * y2);
    context.lineTo(c * x0 + s * y0, c * y0 - s * x0);
    context.lineTo(c * x1 + s * y1, c * y1 - s * x1);
    context.lineTo(c * x2 + s * y2, c * y2 - s * x2);
    context.closePath();
  }
};

var symbols = [
  circle,
  cross,
  diamond,
  square,
  star,
  triangle,
  wye
];

function symbol() {
  var type = constant(circle),
      size = constant(64),
      context = null;

  function symbol() {
    var buffer;
    if (!context) context = buffer = path();
    type.apply(this, arguments).draw(context, +size.apply(this, arguments));
    if (buffer) return context = null, buffer + "" || null;
  }

  symbol.type = function(_) {
    return arguments.length ? (type = typeof _ === "function" ? _ : constant(_), symbol) : type;
  };

  symbol.size = function(_) {
    return arguments.length ? (size = typeof _ === "function" ? _ : constant(+_), symbol) : size;
  };

  symbol.context = function(_) {
    return arguments.length ? (context = _ == null ? null : _, symbol) : context;
  };

  return symbol;
}

function noop() {}

function point$3(that, x, y) {
  that._context.bezierCurveTo(
    (2 * that._x0 + that._x1) / 3,
    (2 * that._y0 + that._y1) / 3,
    (that._x0 + 2 * that._x1) / 3,
    (that._y0 + 2 * that._y1) / 3,
    (that._x0 + 4 * that._x1 + x) / 6,
    (that._y0 + 4 * that._y1 + y) / 6
  );
}

function Basis(context) {
  this._context = context;
}

Basis.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 =
    this._y0 = this._y1 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 3: point$3(this, this._x1, this._y1); // proceed
      case 2: this._context.lineTo(this._x1, this._y1); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6); // proceed
      default: point$3(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = x;
    this._y0 = this._y1, this._y1 = y;
  }
};

function Bundle(context, beta) {
  this._basis = new Basis(context);
  this._beta = beta;
}

Bundle.prototype = {
  lineStart: function() {
    this._x = [];
    this._y = [];
    this._basis.lineStart();
  },
  lineEnd: function() {
    var x = this._x,
        y = this._y,
        j = x.length - 1;

    if (j > 0) {
      var x0 = x[0],
          y0 = y[0],
          dx = x[j] - x0,
          dy = y[j] - y0,
          i = -1,
          t;

      while (++i <= j) {
        t = i / j;
        this._basis.point(
          this._beta * x[i] + (1 - this._beta) * (x0 + t * dx),
          this._beta * y[i] + (1 - this._beta) * (y0 + t * dy)
        );
      }
    }

    this._x = this._y = null;
    this._basis.lineEnd();
  },
  point: function(x, y) {
    this._x.push(+x);
    this._y.push(+y);
  }
};

((function custom(beta) {

  function bundle(context) {
    return beta === 1 ? new Basis(context) : new Bundle(context, beta);
  }

  bundle.beta = function(beta) {
    return custom(+beta);
  };

  return bundle;
}))(0.85);

function point$2(that, x, y) {
  that._context.bezierCurveTo(
    that._x1 + that._k * (that._x2 - that._x0),
    that._y1 + that._k * (that._y2 - that._y0),
    that._x2 + that._k * (that._x1 - x),
    that._y2 + that._k * (that._y1 - y),
    that._x2,
    that._y2
  );
}

function Cardinal(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

Cardinal.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x2, this._y2); break;
      case 3: point$2(this, this._x1, this._y1); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; this._x1 = x, this._y1 = y; break;
      case 2: this._point = 3; // proceed
      default: point$2(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

((function custom(tension) {

  function cardinal(context) {
    return new Cardinal(context, tension);
  }

  cardinal.tension = function(tension) {
    return custom(+tension);
  };

  return cardinal;
}))(0);

function CardinalClosed(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

CardinalClosed.prototype = {
  areaStart: noop,
  areaEnd: noop,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
    this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.lineTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        this.point(this._x5, this._y5);
        break;
      }
    }
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
      case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
      case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
      default: point$2(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

((function custom(tension) {

  function cardinal(context) {
    return new CardinalClosed(context, tension);
  }

  cardinal.tension = function(tension) {
    return custom(+tension);
  };

  return cardinal;
}))(0);

function CardinalOpen(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

CardinalOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
      case 3: this._point = 4; // proceed
      default: point$2(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

((function custom(tension) {

  function cardinal(context) {
    return new CardinalOpen(context, tension);
  }

  cardinal.tension = function(tension) {
    return custom(+tension);
  };

  return cardinal;
}))(0);

function point$1(that, x, y) {
  var x1 = that._x1,
      y1 = that._y1,
      x2 = that._x2,
      y2 = that._y2;

  if (that._l01_a > epsilon) {
    var a = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a,
        n = 3 * that._l01_a * (that._l01_a + that._l12_a);
    x1 = (x1 * a - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
    y1 = (y1 * a - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
  }

  if (that._l23_a > epsilon) {
    var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a,
        m = 3 * that._l23_a * (that._l23_a + that._l12_a);
    x2 = (x2 * b + that._x1 * that._l23_2a - x * that._l12_2a) / m;
    y2 = (y2 * b + that._y1 * that._l23_2a - y * that._l12_2a) / m;
  }

  that._context.bezierCurveTo(x1, y1, x2, y2, that._x2, that._y2);
}

function CatmullRom(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRom.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x2, this._y2); break;
      case 3: this.point(this._x2, this._y2); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; // proceed
      default: point$1(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

((function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
}))(0.5);

function CatmullRomClosed(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRomClosed.prototype = {
  areaStart: noop,
  areaEnd: noop,
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 =
    this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.lineTo(this._x3, this._y3);
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        this.point(this._x5, this._y5);
        break;
      }
    }
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; this._x3 = x, this._y3 = y; break;
      case 1: this._point = 2; this._context.moveTo(this._x4 = x, this._y4 = y); break;
      case 2: this._point = 3; this._x5 = x, this._y5 = y; break;
      default: point$1(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

((function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
}))(0.5);

function CatmullRomOpen(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRomOpen.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 3)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2); break;
      case 3: this._point = 4; // proceed
      default: point$1(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

((function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
}))(0.5);

function sign(x) {
  return x < 0 ? -1 : 1;
}

// Calculate the slopes of the tangents (Hermite-type interpolation) based on
// the following paper: Steffen, M. 1990. A Simple Method for Monotonic
// Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
// NOV(II), P. 443, 1990.
function slope3(that, x2, y2) {
  var h0 = that._x1 - that._x0,
      h1 = x2 - that._x1,
      s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
      s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
      p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

// Calculate a one-sided slope.
function slope2(that, t) {
  var h = that._x1 - that._x0;
  return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
}

// According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
// "you can express cubic Hermite interpolation in terms of cubic Bézier curves
// with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
function point(that, t0, t1) {
  var x0 = that._x0,
      y0 = that._y0,
      x1 = that._x1,
      y1 = that._y1,
      dx = (x1 - x0) / 3;
  that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
}

function MonotoneX(context) {
  this._context = context;
}

MonotoneX.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 =
    this._y0 = this._y1 =
    this._t0 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x1, this._y1); break;
      case 3: point(this, this._t0, slope2(this, this._t0)); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    var t1 = NaN;

    x = +x, y = +y;
    if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; point(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
      default: point(this, this._t0, t1 = slope3(this, x, y)); break;
    }

    this._x0 = this._x1, this._x1 = x;
    this._y0 = this._y1, this._y1 = y;
    this._t0 = t1;
  }
};

(Object.create(MonotoneX.prototype)).point = function(x, y) {
  MonotoneX.prototype.point.call(this, y, x);
};

function symbolPortStyle() {
    const _style = {};
    let _nodePorts, _node;
    let _drawConduct;

    _style.symbolScale = property(null);
    _style.colorScale = property(
        scaleOrdinal().range(
            // colorbrewer light qualitative scale
            shuffle([
                '#8dd3c7',
                '#ffffb3',
                '#bebada',
                '#fb8072',
                '#80b1d3',
                '#fdb462',
                '#b3de69',
                '#fccde5',
                '#d9d9d9',
                '#bc80bd',
                '#ccebc5',
                '#ffed6f',
            ]),
        ),
    );

    function name_or_edge(p) {
        return p.named ? p.name : _style.parent().edgeKey.eval(p.edges[0]);
    }
    _style.symbol = _style.portSymbol = property(name_or_edge, false); // non standard properties taking "outer datum"
    _style.color = _style.portColor = property(name_or_edge, false);
    _style.outline = property(symbolPortStyle.outline.circle());
    _style.content = property(symbolPortStyle.content.d3symbol());
    _style.smallRadius = _style.portRadius = property(7);
    _style.mediumRadius = _style.portHoverNodeRadius = property(10);
    _style.largeRadius = _style.portHoverPortRadius = property(14);
    _style.displacement = _style.portDisplacement = property(2);
    _style.outlineFillScale = _style.portBackgroundScale = property(null);
    _style.outlineFill = _style.portBackgroundFill = property(null);
    _style.outlineStroke = _style.portBackgroundStroke = property(null);
    _style.outlineStrokeWidth = _style.portBackgroundStrokeWidth = property(null);
    _style.padding = _style.portPadding = property(2);
    _style.label = _style.portLabel = _style.portText = property(p => p.name);
    _style.portLabelPadding = property({x: 5, y: 5});
    _style.cascade = cascade(_style);

    _style.portPosition = function(p) {
        const l = Math.hypot(p.pos.x, p.pos.y),
            u = {x: p.pos.x/l, y: p.pos.y/l},
            disp = _style.displacement.eval(p);
        return {x: p.pos.x+disp*u.x, y: p.pos.y+disp*u.y};
    };

    _style.portBounds = function(p) {
        const R = _style.largeRadius.eval(p),
            pos = _style.portPosition(p);
        return {
            left: pos.x-R/2,
            top: pos.y-R/2,
            right: pos.x+R/2,
            bottom: pos.y+R/2,
        };
    };

    function symbol_fill(p) {
        const symcolor = _style.color.eval(p);
        return symcolor
            ? (_style.colorScale() ? _style.colorScale()(symcolor) : symcolor)
            : 'none';
    }
    function port_transform(p) {
        const pos = _style.portPosition(p);
        return `translate(${pos.x},${pos.y})`;
    }
    function port_symbol(p) {
        if (!_style.symbolScale())
            _style.symbolScale(scaleOrdinal().range(shuffle(_style.content().enum())));
        const symname = _style.symbol.eval(p);
        return symname && (_style.symbolScale() ? _style.symbolScale()(symname) : symname);
    }
    function is_left(p) {
        return p.vec[0] < 0;
    }
    function hover_radius(p) {
        switch (p.state) {
            case 'large':
                return _style.largeRadius.eval(p);
            case 'medium':
                return _style.mediumRadius.eval(p);
            case 'small':
            default:
                return _style.smallRadius.eval(p);
        }
    }
    function shimmer_radius(p) {
        return /-medium$/.test(p.state)
            ? _style.mediumRadius.eval(p)
            : _style.largeRadius.eval(p);
    }
    // fall back to node aesthetics if not defined for port
    function outline_fill(p) {
        let scale, fill;
        if (_style.outlineFill.eval(p)) {
            scale = _style.outlineFillScale() || identity$2;
            fill = _style.outlineFill.eval(p);
        } else {
            scale = _style.parent().nodeFillScale() || identity$2;
            fill = _style.parent().nodeFill.eval(p.node);
        }
        return fill === 'none' ? 'none' : scale(fill);
    }
    function outline_stroke(p) {
        return _style.outlineStroke.eval(p) || _style.parent().nodeStroke.eval(p.node);
    }
    function outline_stroke_width(p) {
        const sw = _style.outlineStrokeWidth.eval(p);
        return typeof sw === 'number' ? sw : _style.parent().nodeStrokeWidth.eval(p.node);
    }
    _style.animateNodes = function(nids, before) {
        const setn = set$2(nids);
        const node = _node
            .filter(n => setn.has(_style.parent().nodeKey.eval(n)));
        const symbol = _style.parent().selectNodePortsOfStyle(
            node,
            _style.parent().portStyle.nameOf(this),
        );
        const shimmer = symbol.filter(p => /^shimmer/.test(p.state)),
            nonshimmer = symbol.filter(p => !/^shimmer/.test(p.state));
        if (shimmer.size()) {
            if (before)
                before.on('end', repeat);
            else repeat();
        }

        function repeat() {
            const shimin = shimmer.transition()
                .duration(1000)
                .ease(bounceOut);
            shimin.selectAll('.port-outline')
                .call(_style.outline().draw(p => shimmer_radius(p)+_style.portPadding.eval(p)));
            shimin.selectAll('.port-symbol')
                .call(_style.content().draw(port_symbol, shimmer_radius));
            const shimout = shimin.transition()
                .duration(1000)
                .ease(sinInOut);
            shimout.selectAll('.port-outline')
                .call(
                    _style.outline().draw(p =>
                        _style.smallRadius.eval(p)+_style.portPadding.eval(p)
                    ),
                );
            shimout.selectAll('.port-symbol')
                .call(_style.content().draw(port_symbol, _style.smallRadius.eval));
            shimout.on('end', repeat);
        }

        const trans = nonshimmer.transition()
            .duration(250);
        trans.selectAll('.port-outline')
            .call(_style.outline().draw(p => hover_radius(p)+_style.portPadding.eval(p)));
        trans.selectAll('.port-symbol')
            .call(_style.content().draw(port_symbol, hover_radius));

        const text_showing = p => p.state === 'large' || p.state === 'medium';
        trans.selectAll('text.port-label')
            .attr('opacity', p => text_showing(p) ? 1 : 0)
            .attr('pointer-events', p => text_showing(p) ? 'auto' : 'none');
        trans.selectAll('rect.port-label-background')
            .attr('opacity', p => text_showing(p) ? 1 : 0);
        // bring all nodes which have labels showing to the front
        _node.filter(n => {
            const ports = _nodePorts[_style.parent().nodeKey.eval(n)];
            return ports && ports.some(text_showing);
        }).each(function() {
            this.parentNode.appendChild(this);
        });
        // bring all active ports to the front
        symbol.filter(p => p.state !== 'small').each(function() {
            this.parentNode.appendChild(this);
        });
        return trans;
    };
    _style.eventPort = function(event$1) {
        // In D3 v5, use the global event if no event passed
        const evt = event$1 || event;
        if (!evt || !evt.target) return null;
        const parent = select(evt.target.parentNode);
        if (evt.target.parentNode.tagName === 'g' && parent.classed('port'))
            return parent.datum();
        return null;
    };
    _style.drawPorts = function(ports, nodePorts, node) {
        _nodePorts = nodePorts;
        _node = node;
        let port = ports.data(n => nodePorts[_style.parent().nodeKey.eval(n)] || [], name_or_edge);
        port.exit().remove();
        const portEnter = port.enter().append('g')
            .attr('class', 'port')
            .attr('transform', port_transform);
        port = port.merge(portEnter);
        port.transition('port-position')
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .attr('transform', port_transform);

        let outline = port.selectAll('.port-outline').data(p =>
            outline_fill(p) !== 'none' ? [p] : []
        );
        outline.exit().remove();
        const outlineEnter = outline.enter().append(_style.outline().tag())
            .attr('class', 'port-outline')
            .attr('fill', outline_fill)
            .attr('stroke-width', outline_stroke_width)
            .attr('stroke', outline_stroke);
        outline = outline.merge(outlineEnter);
        if (_style.outline().init)
            outlineEnter.call(_style.outline().init);
        outlineEnter
            .call(
                _style.outline().draw(p => _style.smallRadius.eval(p)+_style.portPadding.eval(p)),
            );
        // only position and size are animated (?) - anyway these are not on the node
        // and they are typically used to indicate selection which should be fast
        outline
            .attr('fill', outline_fill)
            .attr('stroke-width', outline_stroke_width)
            .attr('stroke', outline_stroke);
        outline.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .call(
                _style.outline().draw(p => _style.smallRadius.eval(p)+_style.portPadding.eval(p)),
            );

        portEnter.append(_style.content().tag())
            .attr('class', 'port-symbol')
            .call(_style.content().draw(port_symbol, _style.smallRadius.eval));

        const symbol = port.select('.port-symbol');
        symbol.attr('fill', symbol_fill);
        symbol.transition()
            .duration(_style.parent().stagedDuration())
            .delay(_style.parent().stagedDelay(false)) // need to account for enters as well
            .call(_style.content().draw(port_symbol, _style.smallRadius.eval));

        const label = port.selectAll('text.port-label').data(p =>
            _style.portLabel.eval(p) ? [p] : []
        );
        label.exit().remove();
        const labelEnter = label.enter();
        labelEnter.append('rect')
            .attr('class', 'port-label-background')
            .attr('pointer-events', 'none');
        labelEnter.append('text')
            .attr('class', 'port-label')
            .attr('dominant-baseline', 'middle')
            .attr('pointer-events', 'none')
            .attr('cursor', 'default')
            .attr('opacity', 0);
        label
            .each(p => {
                p.offset =
                    (is_left(p) ? -1 : 1)*(_style.largeRadius.eval(p)+_style.portPadding.eval(p));
            })
            .attr('text-anchor', p => is_left(p) ? 'end' : 'start')
            .attr('transform', p => `translate(${p.offset},0)`)
            .text(_style.portLabel.eval)
            .each(function(p) {
                p.bbox = getBBoxNoThrow(this);
            });
        port.selectAll('rect.port-label-background')
            .attr(
                'x',
                p => (p.offset < 0 ? p.offset-p.bbox.width : p.offset)-_style.portLabelPadding.eval(
                    p,
                ).x,
            )
            .attr('y', p => -p.bbox.height/2-_style.portLabelPadding.eval(p).y)
            .attr('width', p => p.bbox.width+2*_style.portLabelPadding.eval(p).x)
            .attr('height', p => p.bbox.height+2*_style.portLabelPadding.eval(p).y)
            .attr('fill', 'white')
            .attr('opacity', 0);
        return _style;
    };

    _style.enableHover = function(whether) {
        if (!_drawConduct) {
            if (_style.parent()) {
                const draw = _style.parent().child('draw-graphs');
                if (draw)
                    _drawConduct = draw.conduct();
            }
        }
        const namespace = `grow-ports-${_style.parent().portStyle.nameOf(this)}`;
        if (whether) {
            _node.on(`mouseover.${namespace}`, d => {
                // In D3 v5, use global event and data is first parameter
                const nid = _style.parent().nodeKey.eval(d);
                const activePort = _style.eventPort();
                if (_nodePorts[nid])
                    _nodePorts[nid].forEach(p => {
                        p.state = p === activePort ? 'large' : activePort ? 'small' : 'medium';
                    });
                const nids = _drawConduct && _drawConduct.hoverPort(activePort) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
            _node.on(`mouseout.${namespace}`, n => {
                const nid = _style.parent().nodeKey.eval(n);
                if (_nodePorts[nid])
                    _nodePorts[nid].forEach(p => {
                        p.state = 'small';
                    });
                const nids = _drawConduct && _drawConduct.hoverPort(null) || [];
                nids.push(nid);
                _style.animateNodes(nids);
            });
        } else {
            _node.on(`mouseover.${namespace}`, null);
            _node.on(`mouseout.${namespace}`, null);
        }
        return _style;
    };

    _style.parent = property(null);
    return _style;
}

symbolPortStyle.outline = {};
symbolPortStyle.outline.circle = function() {
    return {
        tag() {
            return 'circle';
        },
        draw(rf) {
            return function(outlines) {
                outlines.attr('r', p => rf(p));
            };
        },
    };
};
symbolPortStyle.outline.square = function() {
    return {
        tag() {
            return 'rect';
        },
        init(_outlines) {
            // crispEdges can make outline off-center from symbols
            // outlines.attr('shape-rendering', 'crispEdges');
        },
        draw(rf) {
            return function(outlines) {
                outlines.attr('x', p => -rf(p))
                    .attr('y', p => -rf(p))
                    .attr('width', p => 2*rf(p))
                    .attr('height', p => 2*rf(p));
            };
        },
    };
};
symbolPortStyle.outline.arrow = function() {
    // offset needed for body in order to keep centroid at 0,0
    const left_portion = 3/4-Math.PI/8;
    const _outline = {
        tag() {
            return 'path';
        },
        init(_outlines) {
            // outlines.attr('shape-rendering', 'crispEdges');
        },
        draw(rf) {
            return function(outlines) {
                outlines.attr('d', p => {
                    const r = rf(p);
                    if (!_outline.outie() || _outline.outie()(p.orig))
                        return `M${
                            -left_portion*r
                        },${-r} h${r} l${r},${r} l${-r},${r} h${-r} a${r},${r} 0 1,1 0,${ -2*r}`;
                    else
                        return `M${-(2-left_portion)*r},${-r} h${2*r} a${r},${r} 0 1,1 0,${2*r} h${
                            -2*r
                        } l${r},${-r} l${-r},${-r}`;
                });
            };
        },
        outie: property(null),
    };
    return _outline;
};

symbolPortStyle.content = {};
symbolPortStyle.content.d3symbol = function() {
    const _symbol = {
        tag() {
            return 'path';
        },
        enum() {
            return symbols;
        },
        draw(symf, rf) {
            return function(symbols) {
                symbols.attr('d', p => {
                    const sym = symf(p), r = rf(p);
                    return sym
                        ? symbol()
                            .type(sym)
                            .size(r*r)()
                        : '';
                });
                symbols.attr('transform', p => {
                    switch (symf(p)) {
                        case 'triangle-up':
                            return 'translate(0, -1)';
                        case 'triangle-down':
                            return 'translate(0, 1)';
                        default:
                            return null;
                    }
                });
            };
        },
    };
    return _symbol;
};
symbolPortStyle.content.letter = function() {
    const _symbol = {
        tag() {
            return 'text';
        },
        enum() {
            return range(65, 91).map(String.fromCharCode);
        },
        draw(symf, rf) {
            return function(symbols) {
                symbols.text(symf)
                    .attr('dominant-baseline', 'middle')
                    .attr('text-anchor', 'middle');
                symbols.each(function(p) {
                    if (!p.symbol_size)
                        p.symbol_size = getBBoxNoThrow(this);
                });
                symbols.attr(
                    'transform',
                    p => `scale(${2*rf(p)/p.symbol_size.height}) translate(${[0, 2].join(',')})`,
                );
            };
        },
    };
    return _symbol;
};

/**
 * Tippy.js tooltip support for dc.graph.js
 *
 * Modern replacement for d3.tip using tippy.js for better performance and features.
 *
 * @class tip
 * @memberof dc_graph
 * @return {Object}
 */

function tip(options) {
    options = options || {};
    const _namespace = options.namespace || 'tip';
    const _instances = new Map(); // element -> tippy instance
    const _dispatch = dispatch('tipped');

    // Map d3.tip directions to tippy placements
    const directionMap = {
        'n': 'top',
        'ne': 'top-end',
        'e': 'right',
        'se': 'bottom-end',
        's': 'bottom',
        'sw': 'bottom-start',
        'w': 'left',
        'nw': 'top-start',
    };

    function createTippyInstance(element, datum) {
        if (_instances.has(element)) {
            return _instances.get(element);
        }

        const instance = tippy(element, {
            content: '',
            placement: directionMap[_mode.direction()] || 'top',
            interactive: _mode.clickable(),
            appendTo: () => document.body,
            allowHTML: true,
            theme: 'light-border',
            animation: 'scale-subtle',
            maxWidth: 350,
            arrow: true,
            trigger: 'manual', // We'll handle showing/hiding manually
            onHidden() {},
        });

        let showTimeout;
        let hideTimeout;

        // Handle mouse enter - check content before showing
        element.addEventListener('mouseenter', event => {
            // Stop propagation to prevent parent tips from showing
            event.stopPropagation();

            if (
                _mode.disabled()
                || (_mode.selection().exclude && _mode.selection().exclude(element))
            ) {
                return;
            }

            // Clear any pending hide timeout
            clearTimeout(hideTimeout);

            // Set up show timeout
            clearTimeout(showTimeout);
            showTimeout = setTimeout(async () => {
                // Hide all other instances first
                _instances.forEach(otherInstance => {
                    if (otherInstance !== instance) {
                        otherInstance.hide();
                    }
                });

                const d = element._dcgraph_datum || datum;
                try {
                    const content = await _mode.content()(d);
                    // Only show tooltip if content is not empty
                    if (content && content.trim() !== '') {
                        instance.setContent(content);
                        instance.show();
                        _dispatch.call('tipped', null, d);
                    }
                } catch (error) {
                    console.warn('Tooltip content error:', error);
                }
            }, _mode.showDelay());
        });

        // Handle mouse leave - hide after delay
        element.addEventListener('mouseleave', () => {
            clearTimeout(showTimeout);
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                instance.hide();
            }, _mode.hideDelay());
        });

        _instances.set(element, instance);
        element._dcgraph_datum = datum;
        return instance;
    }

    function destroyTippyInstance(element) {
        const instance = _instances.get(element);
        if (instance) {
            instance.destroy();
            _instances.delete(element);
            delete element._dcgraph_datum;
        }
    }

    function draw(diagram, node, edge, ehover) {
        const selection = _mode.selection().select(diagram, node, edge, ehover);
        selection.each(function(d) {
            createTippyInstance(this, d);
        });
    }

    function remove(diagram, node, edge, ehover) {
        const selection = _mode.selection().select(diagram, node, edge, ehover);

        selection.each(function() {
            destroyTippyInstance(this);
        });
    }

    const _mode = mode(_namespace, {
        draw,
        remove,
        laterDraw: true,
    });

    /**
     * Specify the direction for tooltips. Currently supports the
     * cardinal and intercardinal directions: 'n', 'ne', 'e', etc.
     * @name direction
     * @memberof dc_graph.tip
     * @instance
     * @param {String} [direction='n']
     * @return {String}
     * @return {dc_graph.tip}
     */
    _mode.direction = property('n');

    /**
     * Specifies the async function to generate content for the tooltip. This function has the
     * signature `async function(d)`, where `d` is the datum of the thing being hovered over.
     * The function should return a promise that resolves to the HTML content string.
     * @name content
     * @memberof dc_graph.tip
     * @instance
     * @param {Function} [content] - Async function that returns Promise<string>
     * @return {Function}
     */
    _mode.content = property(async n => _mode.parent() ? _mode.parent().nodeTitle.eval(n) : '');

    _mode.on = (event, f) => _dispatch.on(event, f);

    _mode.disabled = property(false);
    _mode.programmatic = property(false);

    _mode.displayTip = (filter, n, cb) => {
        if (typeof filter !== 'function') {
            const d = filter;
            filter = d2 => d2 === d;
        }

        const found = _mode.selection().select(
            _mode.parent(),
            _mode.parent().selectAllNodes(),
            _mode.parent().selectAllEdges(),
            null,
        );
        const elements = [];

        found.each(function(d) {
            if (filter(d)) {
                elements.push(this);
            }
        });

        if (elements.length > 0) {
            const which = (n || 0)%elements.length;
            const element = elements[which];
            const instance = _instances.get(element);
            if (instance) {
                instance.show();
                if (cb) cb(element._dcgraph_datum);
            }
        }
        return _mode;
    };

    _mode.hideTip = _delay => {
        _instances.forEach(instance => {
            instance.hide();
        });
        return _mode;
    };

    _mode.selection = property(selectNodeAndEdge());
    _mode.showDelay = _mode.delay = property(0);
    _mode.hideDelay = property(50);
    _mode.offset = property(null); // Not used with tippy, but kept for API compatibility
    _mode.clickable = property(false);
    _mode.linkCallback = property(null);

    return _mode;
}

/**
 * Generates a handler which can be passed to `tip.content` to produce a table of the
 * attributes and values of the hovered object.
 *
 * @name table
 * @memberof dc_graph.tip
 * @instance
 * @return {Function}
 * @example
 * // show all the attributes and values in the node and edge objects
 * var tip = dc_graph.tip();
 * tip.content(dc_graph.tip.table());
 */
function tipTable() {
    const gen = async function(d) {
        d = gen.fetch()(d);
        if (!d) {
            return ''; // return empty string to prevent tooltip from showing
        }
        let data, keys;
        if (Array.isArray(d))
            data = d;
        else if (typeof d === 'number' || typeof d === 'string')
            data = [d];
        else { // object
            data = keys = Object.keys(d).filter(functorWrap$1(gen.filter()))
                .filter(k => d[k] !== undefined);
        }
        const table = select(document.createElement('table'));
        const rows = table.selectAll('tr').data(data);
        const rowsEnter = rows.enter().append('tr');
        rowsEnter.append('td').text(item => {
            if (keys && typeof item === 'string')
                return item;
            return JSON.stringify(item);
        });
        if (keys)
            rowsEnter.append('td').text(item => JSON.stringify(d[item]));
        return table.node().outerHTML; // optimizing for clarity over speed (?)
    };
    gen.filter = property(true);
    gen.fetch = property(d => d.orig.value);
    return gen;
}

function tipJsonTable() {
    const table = tipTable().fetch(d => {
        const jsontip = table.json()(d);
        if (!jsontip) return null;
        try {
            return JSON.parse(jsontip);
        } catch (_xep) {
            return [jsontip];
        }
    });
    table.json = property(d => (d.orig.value.value || d.orig.value).jsontip);
    return table;
}

function tipHtmlOrJsonTable() {
    const json_table = tipJsonTable();
    const gen = async function(d) {
        const html = gen.html()(d);
        if (html) {
            return html;
        } else {
            return await json_table(d);
        }
    };
    gen.json = json_table.json;
    gen.html = property(d => (d.orig.value.value || d.orig.value).htmltip);
    return gen;
}

function selectNodeAndEdge() {
    return {
        select(diagram, node, edge, ehover) {
            return ehover ? node.merge(ehover) : node;
        },
        exclude(element) {
            return ancestorHasClass(element, 'port');
        },
    };
}

function selectNode() {
    return {
        select(diagram, node, _edge, _ehover) {
            return node;
        },
        exclude(element) {
            return ancestorHasClass(element, 'port');
        },
    };
}

function selectEdge() {
    return {
        select(diagram, node, edge, _ehover) {
            return edge;
        },
    };
}

function selectPort() {
    return {
        select(diagram, node, _edge, _ehover) {
            return node.selectAll('g.port');
        },
    };
}

// collapse edges between same source and target
function deparallelize(group, sourceTag, targetTag, options) {
    options = options || {};
    const both = options.both || false,
        reduce = options.reduce || null;
    return {
        all() {
            const ST = {};
            group.all().forEach(kv => {
                const source = kv.value[sourceTag],
                    target = kv.value[targetTag];
                const dir = both ? true : source < target;
                const min = dir ? source : target, max = dir ? target : source;
                ST[min] = ST[min] || {};
                let entry;
                if (ST[min][max]) {
                    entry = ST[min][max];
                    if (reduce)
                        entry.original = reduce(entry.original, kv);
                } else ST[min][max] = entry = {in: 0, out: 0, original: Object.assign({}, kv)};
                if (dir)
                    ++entry.in;
                else
                    ++entry.out;
            });
            const ret = [];
            Object.keys(ST).forEach(source => {
                Object.keys(ST[source]).forEach(target => {
                    const entry = ST[source][target];
                    entry[sourceTag] = source;
                    entry[targetTag] = target;
                    ret.push({key: entry.original.key, value: entry});
                });
            });
            return ret;
        },
    };
}

// this naive tree-drawer is paraphrased from memory from dot

function treeConstraints(rootf, treef, xgap, _ygap) {
    console.warn(
        'treeConstraints is deprecated - it never worked right and may not be a good idea',
    );
    return function(diagram, nodes, edges) {
        const constraints = [];
        let x = 0;
        const dfs = depthFirstTraversal({
            root: rootf,
            tree: treef,
            place(n, r, row) {
                if (row.length) {
                    const last = row[row.length-1];
                    constraints.push({
                        left: diagram.nodeKey.eval(last),
                        right: diagram.nodeKey.eval(n),
                        axis: 'x',
                        gap: x-last.foo_x,
                        equality: true,
                    });
                }
                n.foo_x = x;
                // n.cola.x = x;
                // n.cola.y = r*ygap;
            },
            sib() {
                x += xgap;
            },
        });
        dfs(diagram, nodes, edges);
        return constraints;
    };
}

// this naive tree-drawer is paraphrased from memory from dot

function treePositions(rootf, rowf, treef, ofsx, ofsy, nwidth, ygap) {
    console.warn('treePositions is deprecated; use the layout engine tree_layout instead');
    if (rootf || treef) {
        console.warn('treePositions: rootf and treef are ignored');
    }
    let x;
    nwidth = typeof nwidth === 'function' ? nwidth : () => nwidth;
    function best_dist(left, right) {
        return (nwidth(left)+nwidth(right))/2;
    }
    const dfs = depthFirstTraversal({
        nodeid(n) {
            return n.cola.dcg_nodeKey;
        },
        sourceid(n) {
            return n.cola.dcg_edgeSource;
        },
        targetid(n) {
            return n.cola.dcg_edgeTarget;
        },
        init() {
            x = ofsx;
        },
        row(n) {
            return rowf(n.orig);
        },
        place(n, r, row) {
            if (row.length) {
                const left = row[row.length-1];
                const g = (nwidth(left)+nwidth(n))/2;
                x = Math.max(x, left.left_x+g);
            }
            n.left_x = x;
            n.hit_ins = 1;
            n.cola.y = r*ygap+ofsy;
        },
        sib(isroot, left, right) {
            let g = best_dist(left, right);
            if (isroot) g = g*1.5;
            x += g;
        },
        pop(n) {
            n.cola.x = (n.left_x+x)/2;
        },
        skip(n, indegree) {
            // rolling average of in-neighbor x positions
            n.cola.x = (n.hit_ins*n.cola.x+x)/++n.hit_ins;
            if (n.hit_ins === indegree)
                delete n.hit_ins;
        },
        finish(rows) {
            // this is disgusting. patch up any places where nodes overlap by scanning
            // right far enough to find the space, then fill from left to right at the
            // minimum gap
            rows.forEach(row => {
                const sort = row.sort((a, b) => a.cola.x-b.cola.x);
                let badi = null, badl = null, want;
                for (let i = 0; i < sort.length-1; ++i) {
                    const left = sort[i], right = sort[i+1];
                    if (!badi) {
                        if (right.cola.x-left.cola.x < best_dist(left, right)) {
                            badi = i;
                            badl = left.cola.x;
                            want = best_dist(left, right);
                        } // else still not bad
                    } else {
                        want += best_dist(left, right);
                        if (i < sort.length-2 && right.cola.x < badl+want)
                            continue; // still bad
                        else {
                            if (badi > 0)
                                --badi; // might want to use more left
                            let l, limit;
                            if (i < sort.length-2) { // found space before right
                                const extra = right.cola.x-(badl+want);
                                l = sort[badi].cola.x+extra/2;
                                limit = i+1;
                            } else {
                                l = Math.max(
                                    sort[badi].cola.x,
                                    badl-best_dist(
                                        sort[badi],
                                        sort[badi+1],
                                    )-(want-right.cola.x+badl)/2,
                                );
                                limit = sort.length;
                            }
                            for (let j = badi+1; j < limit; ++j) {
                                l += best_dist(sort[j-1], sort[j]);
                                sort[j].cola.x = l;
                            }
                            badi = badl = want = null;
                        }
                    }
                }
            });
        },
    });

    return function(diagram, nodes, edges) {
        return dfs(nodes, edges);
    };
}

function troubleshoot() {
    let _debugLayer = null;
    let _scale = 1;

    function draw(diagram, node, edge, _ehover) {
        if (!_debugLayer)
            _debugLayer = diagram.g().append('g')
                .attr('class', 'troubleshoot')
                .attr('pointer-events', 'none');
        const centers = node.data().map(n => ({
            x: n.cola.x,
            y: n.cola.y,
        }));
        let crosshairs = _debugLayer.selectAll('path.nodecenter').data(centers);
        crosshairs.exit().remove();
        const crosshairsEnter = crosshairs.enter().append('path').attr('class', 'nodecenter');
        crosshairs = crosshairs.merge(crosshairsEnter);
        crosshairs.attr(
            'd',
            c => `M${c.x-_mode.xhairWidth()/2},${c.y} h${_mode.xhairWidth()} M${c.x},${
                c.y-_mode.xhairHeight()/2
            } v${_mode.xhairHeight()}`,
        )
            .attr('opacity', _mode.xhairOpacity() !== null ? _mode.xhairOpacity() : _mode.opacity())
            .attr('stroke', _mode.xhairColor())
            .attr('stroke-width', 1/_scale);
        function cola_point(n) {
            return {x: n.cola.x, y: n.cola.y};
        }
        const colabounds = node.data().map(n =>
            boundary(cola_point(n), n.cola.width, n.cola.height)
        );
        const colaboundary = _debugLayer.selectAll('path.colaboundary').data(colabounds);
        draw_corners(colaboundary, 'colaboundary', _mode.boundsColor());

        const textbounds = node.data().map(n => {
            if (!n.bbox || (!n.bbox.width && !n.bbox.height))
                return null;
            return boundary(cola_point(n), n.bbox.width, n.bbox.height);
        }).filter(n => !!n);
        const textboundary = _debugLayer.selectAll('path.textboundary').data(textbounds);
        draw_corners(textboundary, 'textboundary', _mode.boundsColor());

        const radiibounds = node.data().map(n => {
            if (typeof n.dcg_rx !== 'number')
                return null;
            return boundary(cola_point(n), n.dcg_rx*2, n.dcg_ry*2);
        }).filter(n => !!n);
        const radiiboundary = _debugLayer.selectAll('path.radiiboundary').data(radiibounds);
        draw_corners(radiiboundary, 'radiiboundary', _mode.boundsColor());

        diagram.addOrRemoveDef(
            'debug-orient-marker-head',
            true,
            'svg:marker',
            orient_marker.bind(null, _mode.arrowHeadColor()),
        );
        diagram.addOrRemoveDef(
            'debug-orient-marker-tail',
            true,
            'svg:marker',
            orient_marker.bind(null, _mode.arrowTailColor()),
        );
        const heads = _mode.arrowLength()
            ? edge.data().map(e => ({
                pos: e.pos.new.path.points[e.pos.new.path.points.length-1],
                orient: e.pos.new.orienthead,
            }))
            : [];
        const headOrients = _debugLayer.selectAll('line.heads').data(heads);
        draw_arrow_orient(
            headOrients,
            'heads',
            _mode.arrowHeadColor(),
            '#debug-orient-marker-head',
        );

        const tails = _mode.arrowLength()
            ? edge.data().map(e => ({pos: e.pos.new.path.points[0], orient: e.pos.new.orienttail}))
            : [];
        const tailOrients = _debugLayer.selectAll('line.tails').data(tails);
        draw_arrow_orient(
            tailOrients,
            'tails',
            _mode.arrowTailColor(),
            '#debug-orient-marker-tail',
        );

        const headpts = Array.prototype.concat.apply(
            [],
            edge.data().map(e => {
                const arrowSize = diagram.edgeArrowSize.eval(e);
                return edge_arrow_points(
                    diagram.arrows(),
                    diagram.edgeArrowhead.eval(e),
                    arrowSize,
                    diagram.edgeStrokeWidth.eval(e)/arrowSize,
                    unrad(e.pos.new.orienthead),
                    e.pos.new.full.points[e.pos.new.full.points.length-1],
                    diagram.nodeStrokeWidth.eval(e.target),
                );
            }),
        );
        const hp = _debugLayer.selectAll('path.head-point').data(headpts);
        draw_x(hp, 'head-point', _mode.arrowHeadColor());

        const tailpts = Array.prototype.concat.apply(
            [],
            edge.data().map(e => {
                const arrowSize = diagram.edgeArrowSize.eval(e);
                return edge_arrow_points(
                    diagram.arrows(),
                    diagram.edgeArrowtail.eval(e),
                    arrowSize,
                    diagram.edgeStrokeWidth.eval(e)/arrowSize,
                    unrad(e.pos.new.orienttail),
                    e.pos.new.full.points[0],
                    diagram.nodeStrokeWidth.eval(e.source),
                );
            }),
        );
        const tp = _debugLayer.selectAll('path.tail-point').data(tailpts);
        draw_x(tp, 'tail-point', _mode.arrowTailColor());

        let domain = _debugLayer.selectAll('rect.domain').data([0]);
        const domainEnter = domain.enter().append('rect');
        domain = domain.merge(domainEnter);
        const xd = _mode.parent().x().domain(), yd = _mode.parent().y().domain();
        domain.attr('class', 'domain')
            .attr('fill', 'none')
            .attr('opacity', _mode.domainOpacity())
            .attr('stroke', _mode.domainColor())
            .attr('stroke-width', _mode.domainStrokeWidth()/_scale)
            .attr('x', xd[0])
            .attr('y', yd[0])
            .attr('width', xd[1]-xd[0])
            .attr('height', yd[1]-yd[0]);
    }
    function on_zoom(translate, scale, xDomain, yDomain) {
        _scale = scale;
        draw(_mode.parent(), _mode.parent().selectAllNodes(), _mode.parent().selectAllEdges());
    }

    function boundary(point, wid, hei) {
        return {
            left: point.x-wid/2,
            top: point.y-hei/2,
            right: point.x+wid/2,
            bottom: point.y+hei/2,
        };
    }
    function bound_tick(x, y, dx, dy) {
        return `M${x},${y+dy} v${-dy} h${dx}`;
    }
    function corners(bounds) {
        return [
            bound_tick(bounds.left, bounds.top, _mode.boundsWidth(), _mode.boundsHeight()),
            bound_tick(bounds.right, bounds.top, -_mode.boundsWidth(), _mode.boundsHeight()),
            bound_tick(bounds.right, bounds.bottom, -_mode.boundsWidth(), -_mode.boundsHeight()),
            bound_tick(bounds.left, bounds.bottom, _mode.boundsWidth(), -_mode.boundsHeight()),
        ].join(' ');
    }
    function draw_corners(binding, classname, color) {
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr('d', corners)
            .attr(
                'opacity',
                _mode.boundsOpacity() !== null ? _mode.boundsOpacity() : _mode.opacity(),
            )
            .attr('stroke', color)
            .attr('stroke-width', 1/_scale)
            .attr('fill', 'none');
    }
    function unrad(orient) {
        return +orient.replace('rad', '');
    }
    function draw_arrow_orient(binding, classname, color, markerUrl) {
        binding.exit().remove();
        binding.enter().append('line').attr('class', classname);
        binding.attr('x1', d => d.pos.x)
            .attr('y1', d => d.pos.y)
            .attr('x2', d => d.pos.x-Math.cos(unrad(d.orient))*_mode.arrowLength())
            .attr('y2', d => d.pos.y-Math.sin(unrad(d.orient))*_mode.arrowLength())
            .attr('stroke', color)
            .attr('stroke-width', _mode.arrowStrokeWidth()/_scale)
            .attr('opacity', _mode.arrowOpacity() !== null ? _mode.arrowOpacity() : _mode.opacity())
            .attr('marker-end', `url(${markerUrl})`);
    }
    function orient_marker(color, markerEnter) {
        markerEnter
            .attr('viewBox', '0 -3 3 6')
            .attr('refX', 3)
            .attr('refY', 0)
            .attr('orient', 'auto');
        markerEnter.append('path')
            .attr('stroke', color)
            .attr('fill', 'none')
            .attr('d', 'M0,3 L3,0 L0,-3');
    }
    function edge_arrow_points(arrows, defn, arrowSize, stemWidth, orient, endp, strokeWidth) {
        const parts = arrowParts(arrows, defn),
            offsets = arrowOffsets(parts, stemWidth),
            xunit = [Math.cos(orient), Math.sin(orient)];
        endp = [endp.x, endp.y];
        if (!parts.length)
            return [[endp[0]-xunit[0]*strokeWidth/2, endp[1]-xunit[1]*strokeWidth/2]];
        const globofs = addPoints(
            [-strokeWidth/arrowSize/2, 0],
            multPoint(front_ref(parts[0].frontRef), -1),
        );
        const pts = offsets.map((ofs, i) =>
            multPoint(
                [
                    globofs,
                    front_ref(parts[i].frontRef),
                    ofs.offset,
                ].reduce(addPoints),
                arrowSize,
            )
        );
        pts.push(multPoint(
            [
                globofs,
                back_ref(parts[parts.length-1].backRef),
                offsets[parts.length-1].offset,
            ].reduce(addPoints),
            arrowSize,
        ));
        return pts.map(p =>
            addPoints(
                endp,
                [p[0]*xunit[0]-p[1]*xunit[1], p[0]*xunit[1]+p[1]*xunit[0]],
            )
        );
    }

    function draw_x(binding, classname, color) {
        const xw = _mode.xWidth()/2, xh = _mode.xHeight()/2;
        binding.exit().remove();
        binding.enter().append('path').attr('class', classname);
        binding.attr(
            'd',
            pos =>
                [[[-xw, -xh], [xw, xh]], [[xw, -xh], [-xw, xh]]].map(seg =>
                    `M${seg.map(p => `${pos[0]+p[0]},${pos[1]+p[1]}`).join(' L')}`
                ).join(' '),
        )
            .attr('stroke-width', 2/_scale)
            .attr('stroke', color)
            .attr('opacity', _mode.xOpacity());
    }
    function remove(_diagram, _node, _edge, _ehover) {
        if (_debugLayer)
            _debugLayer.remove();
    }

    const _mode = mode('highlight-paths', {
        laterDraw: true,
        draw,
        remove,
        parent(p) {
            if (p) {
                p.translate();
                _scale = p.scale();
                p.on('zoomed.troubleshoot', on_zoom);
            } else if (_mode.parent())
                _mode.parent().on('zoomed.troubleshoot', null);
        },
    });
    _mode.opacity = property(0.75);

    _mode.xhairOpacity = property(null);
    _mode.xhairWidth = property(10);
    _mode.xhairHeight = property(10);
    _mode.xhairColor = property('blue');

    _mode.boundsOpacity = property(null);
    _mode.boundsWidth = property(10);
    _mode.boundsHeight = property(10);
    _mode.boundsColor = property('green');

    _mode.arrowOpacity = property(null);
    _mode.arrowStrokeWidth = property(3);
    _mode.arrowColor = _mode.arrowHeadColor = property('darkorange');
    _mode.arrowTailColor = property('red');
    _mode.arrowLength = property(100);

    _mode.xWidth = property(1);
    _mode.xHeight = property(1);
    _mode.xOpacity = property(0.8);

    _mode.domainOpacity = property(0.6);
    _mode.domainColor = property('darkorange');
    _mode.domainStrokeWidth = property(4);

    return _mode;
}

function buildTypeGraph(nodes, edges, nkey, ntype, esource, etarget) {
    const nmap = {}, tnodes = {}, tedges = {};
    nodes.forEach(n => {
        nmap[nkey(n)] = n;
        const t = ntype(n);
        if (!tnodes[t])
            tnodes[t] = {type: t};
    });
    edges.forEach(e => {
        const source = esource(e), target = etarget(e);
        let sn, tn;
        if (!(sn = nmap[source]))
            throw new Error(`source key ${source} not found!`);
        if (!(tn = nmap[target]))
            throw new Error(`target key ${target} not found!`);
        const etype = `${ntype(sn)}/${ntype(tn)}`;
        if (!tedges[etype])
            tedges[etype] = {
                type: etype,
                source: ntype(sn),
                target: ntype(tn),
            };
    });
    return {
        nodes: Object.keys(tnodes).map(k => tnodes[k]),
        edges: Object.keys(tedges).map(k => tedges[k]),
    };
}

function validate(title) {
    function falsy(objects, accessor, what, who) {
        const f = objects.filter(o => !accessor(o));
        return f.length
            ? [`${what} is empty for ${f.length} of ${objects.length} ${who}`, f]
            : null;
    }
    function build_index(objects, accessor) {
        return objects.reduce((m, o) => {
            m[accessor(o)] = o;
            return m;
        }, {});
    }
    function not_found(index, objects, accessor, what, where, who) {
        const nf = objects.filter(o => !index[accessor(o)]).map(o => ({
            key: accessor(o),
            value: o,
        }));
        return nf.length
            ? [
                `${what} was not found in ${where}`,
                Object.keys(index),
                `for ${nf.length} of ${objects.length} ${who}`,
                nf,
            ]
            : null;
    }
    function validate() {
        const diagram = _mode.parent();
        const nodes = diagram.nodeGroup().all(),
            edges = diagram.edgeGroup().all(),
            ports = diagram.portGroup() ? diagram.portGroup().all() : [];
        const errors = [];

        function check(error) {
            if (error)
                errors.push(error);
        }

        check(falsy(nodes, diagram.nodeKey(), 'nodeKey', 'nodes'));
        check(falsy(edges, diagram.edgeSource(), 'edgeSource', 'edges'));
        check(falsy(edges, diagram.edgeTarget(), 'edgeTarget', 'edges'));

        const contentTypes = set$2(diagram.content.enum());
        const ct = functorWrap$1(diagram.nodeContent());
        const noContentNodes = nodes.filter(kv => !contentTypes.has(ct(kv)));
        if (noContentNodes.length)
            errors.push([
                `there are ${noContentNodes.length} nodes with nodeContent not matching any content`,
                noContentNodes,
            ]);

        const nindex = build_index(nodes, diagram.nodeKey()),
            eindex = build_index(edges, diagram.edgeKey());
        check(not_found(nindex, edges, diagram.edgeSource(), 'edgeSource', 'nodes', 'edges'));
        check(not_found(nindex, edges, diagram.edgeTarget(), 'edgeTarget', 'nodes', 'edges'));

        check(falsy(
            ports,
            p => diagram.portNodeKey() && diagram.portNodeKey()(p)
                || diagram.portEdgeKey() && diagram.portEdgeKey()(p),
            'portNodeKey||portEdgeKey',
            'ports',
        ));

        const named_ports = !diagram.portNodeKey() && []
            || ports.filter(p => diagram.portNodeKey()(p));
        const anonymous_ports = !diagram.portEdgeKey() && []
            || ports.filter(p => diagram.portEdgeKey()(p));
        check(
            not_found(nindex, named_ports, diagram.portNodeKey(), 'portNodeKey', 'nodes', 'ports'),
        );
        check(
            not_found(
                eindex,
                anonymous_ports,
                diagram.portEdgeKey(),
                'portEdgeKey',
                'edges',
                'ports',
            ),
        );

        if (diagram.portName()) {
            const pindex = build_index(
                named_ports,
                p => `${diagram.portNodeKey()(p)} - ${diagram.portName()(p)}`,
            );
            if (diagram.edgeSourcePortName())
                check(
                    not_found(
                        pindex,
                        edges,
                        e => `${diagram.edgeSource()(e)} - ${
                            functorWrap$1(diagram.edgeSourcePortName())(e)
                        }`,
                        'edgeSourcePortName',
                        'ports',
                        'edges',
                    ),
                );
            if (diagram.edgeTargetPortName())
                check(
                    not_found(
                        pindex,
                        edges,
                        e => `${diagram.edgeTarget()(e)} - ${
                            functorWrap$1(diagram.edgeTargetPortName())(e)
                        }`,
                        'edgeTargetPortName',
                        'ports',
                        'edges',
                    ),
                );
        }

        function count_text() {
            return `${nodes.length} nodes, ${edges.length} edges, ${ports.length} ports`;
        }
        if (errors.length) {
            console.warn(`validation of ${title} failed with ${count_text()}:`);
            errors.forEach(err => {
                console.warn.apply(console, err);
            });
        } else
            console.log(`validation of ${title} succeeded with ${count_text()}.`);
    }
    const _mode = {
        parent: property(null).react(p => {
            if (p)
                p.on('data.validate', validate);
            else
                _mode.parent().on('data.validate', null);
        }),
    };

    return _mode;
}

function wildcardPorts(options) {
    const diagram = options.diagram,
        get_type = options.get_type || function(p) {
            return p.orig.value.type;
        },
        set_type = options.set_type || function(p, src) {
            p.orig.value.type = src.orig.value.type;
        },
        get_name = options.get_name || function(p) {
            return p.orig.value.name;
        },
        is_wild = options.is_wild || function(p) {
            return p.orig.value.wild;
        },
        update_ports = options.update_ports || function() {},
        get_linked = options.get_linked || function() {
            return [];
        };
    function linked_ports(n, port) {
        if (!diagram)
            return [];
        const nid = diagram.nodeKey.eval(n);
        const name = get_name(port);
        const links = get_linked(n) || [];
        const found = links.find(set => set.includes(name));
        if (!found) return [];
        return found.filter(link => link !== name).map(link => diagram.getPort(nid, null, link));
    }
    function no_edges(ports) {
        return ports.every(lp => lp.edges.length === 0);
    }
    return {
        isValid(p1, p2) {
            return get_type(p1) === null^get_type(p2) === null
                || get_type(p1) !== null && get_type(p1) === get_type(p2);
        },
        whyInvalid(p1, p2) {
            return get_type(p1) === null && get_type(p2) === null
                    && "can't connect wildcard to wildcard"
                || get_type(p1) !== get_type(p2) && 'the types of ports must match';
        },
        copyLinked(n, port) {
            linked_ports(n, port).forEach(lp => {
                set_type(lp, port);
            });
        },
        copyType(e, sport, tport) {
            if (get_type(sport) === null) {
                set_type(sport, tport);
                this.copyLinked(sport.node, sport);
                update_ports();
            } else if (get_type(tport) === null) {
                set_type(tport, sport);
                this.copyLinked(tport.node, tport);
                update_ports();
            }
            return Promise.resolve(e);
        },
        resetTypes(edges) {
            // backward compatibility: this used to take diagram as
            // first arg, which was wrong
            let dia = diagram;
            if (arguments.length === 2) {
                dia = arguments[0];
                edges = arguments[1];
            }
            edges.forEach(eid => {
                const e = dia.getWholeEdge(eid),
                    spname = dia.edgeSourcePortName.eval(e),
                    tpname = dia.edgeTargetPortName.eval(e);
                let update = false;
                let p = dia.getPort(dia.nodeKey.eval(e.source), null, spname);
                let linked = linked_ports(e.source, p);
                if (is_wild(p) && p.edges.length === 1 && no_edges(linked)) {
                    set_type(p, null);
                    linked.forEach(lp => {
                        set_type(lp, null);
                        update = true;
                    });
                }
                p = dia.getPort(dia.nodeKey.eval(e.target), null, tpname);
                linked = linked_ports(e.target, p);
                if (is_wild(p) && p.edges.length === 1 && no_edges(linked)) {
                    set_type(p, null);
                    linked.forEach(lp => {
                        set_type(lp, null);
                        update = true;
                    });
                }
                if (update)
                    update_ports();
            });
            return Promise.resolve(edges);
        },
    };
}

export { addPoints, alignX, alignY, ancestorHasClass, annotateLayers, annotateNodes, applyGraphvizAccessors, arrowOffsets, arrowParts, availableShapes, behavior, brush, buildTypeGraph, builtinArrows, cascade, clone, colaLayout, conditionalProperties, constants$1 as constants, constraintPattern, convertAdjacencyList, convertNest, convertTree, d3v4ForceLayout, dagreLayout, dataUrl, defaultShape, defaultUrlOpener, deleteNodes, deleteThings, deparallelize, deprecateFunction, deprecatedProperty, deprecationWarning, depthFirstTraversal, diagram, drawClusters, drawGraphs, drawSplinePaths, dropdown, dynagraphLayout, edgeLegend, edgeObject, editText, elaboratedRectangleShape, ellipseShape, engines, eventCoords, expandCollapse, expandedHidden, fileFormats, filterSelection, fixNodes, fixNodesGroup, flatGroup, flexboxLayout, functorWrap$1 as functorWrap, gapX, gapY, generate, getBBoxNoThrow, graphvizAttrs, graphvizLayout, grid, highlightNeighbors, highlightPaths, highlightRadius, highlightThings, identity$2 as identity, isIe, isSafari, keyboard, labelEdges, labelNodes, labelThings, labelThingsGroup, layeredLayout, legend, lineBreaks, loadGraph, loadGraphText, manualLayout, matchFileFormat, matchMimeType, matchOpposites, matchPorts, mode, moveNodes, multPoint, multiplyProperties, mungeGraph, namedChildren, noShape, nodeEdgeConditions, nodeLabelPadding, nodeLegend, nodeName, nodeObject, orderX, orderY, param, pathReader, pathSelector, placePorts, polygonShape, property, randomGraph, regenerateObjects, registerHighlightNeighborsGroup, registerHighlightPathsGroup, registerHighlightThingsGroup, renderSvg, renderWebgl, roundedRectangleShape, scriptPath, selectEdge, selectEdges, selectNode, selectNodeAndEdge, selectNodes, selectPort, selectPorts, selectThings, selectThingsGroup, shapePresets, snapshotGraphviz, spawnEngine, splinePaths, supergraph, symbolLegend, symbolPortStyle, textContents, tip, tipHtmlOrJsonTable, tipJsonTable, tipTable, treeConstraints, treeLayout, treePositions, troubleshoot, uniq, uuid, validate, version, webworkerLayout, wheelEdges, wildcardPorts, withIconContents };
//# sourceMappingURL=dc-graph.js.map
