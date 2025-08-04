/**
 * Core utilities and functions for dc.graph.js
 * @module core
 */

import { version } from '../package.json';
export { version };
export const constants = {
    CHART_CLASS: 'dc-graph',
};

export function getOriginal(x) {
    return x.orig;
}

export function identity(x) {
    return x;
}

export const property = function(defaultValue, unwrap) {
    if(unwrap === undefined)
        unwrap = getOriginal;
    else if(unwrap === false)
        unwrap = identity;
    let value = defaultValue, react = null;
    const cascade = [];
    const ret = function(_) {
        if(!arguments.length) {
            return value;
        }
        if(react)
            react(_);
        value = _;
        return this;
    };
    ret.cascade = function(n, f) {
        for(let i = 0; i < cascade.length; ++i) {
            if(cascade[i].n === n) {
                if(f)
                    cascade[i].f = f;
                else cascade.splice(i, 1);
                return ret;
            } else if(cascade[i].n > n) {
                cascade.splice(i, 0, {n, f});
                return ret;
            }
        }
        cascade.push({n, f});
        return ret;
    };
    ret._eval = function(o, n) {
        if(n === 0 || !cascade.length)
            return functorWrap(ret(), unwrap)(o);
        else {
            const last = cascade[n-1];
            return last.f(o, () => ret._eval(o, n-1));
        }
    };
    ret.eval = function(o) {
        return ret._eval(o, cascade.length);
    };
    ret.react = function(_) {
        if(!arguments.length) {
            return react;
        }
        react = _;
        return this;
    };
    return ret;
};

export function namedChildren() {
    const _children = {};
    const f = function(id, object) {
        if(arguments.length === 1)
            return _children[id];
        if(f.reject) {
            const reject = f.reject(id, object);
            if(reject) {
                console.groupCollapsed(reject);
                console.trace();
                console.groupEnd();
                return this;
            }
        }
        // do not notify unnecessarily
        if(_children[id] === object)
            return this;
        if(_children[id])
            _children[id].parent(null);
        _children[id] = object;
        if(object)
            object.parent(this);
        return this;
    };
    f.enum = function() {
        return Object.keys(_children);
    };
    f.nameOf = function(o) {
        const found = Object.entries(_children).find((kv) => kv[1] == o);
        return found ? found[0] : null;
    };
    return f;
}

export function deprecatedProperty(message, defaultValue) {
    const prop = property(defaultValue);
    const ret = function() {
        if(arguments.length) {
            console.warn(message);
            prop.apply(property, arguments);
            return this;
        }
        return prop();
    };
    ['cascade', '_eval', 'eval', 'react'].forEach((method) => {
        ret[method] = prop[method];
    });
    return ret;
}

export function onetimeTrace(level, message) {
    let said = false;
    return function() {
        if(said)
            return;
        if(level === 'trace') {
            // todo: implement levels?
            // console.groupCollapsed(message);
            // console.trace();
            // console.groupEnd();
        } else
            console[level](message);
        said = true;
    };
}

export function deprecationWarning(message) {
    return onetimeTrace('warn', message);
}

export function traceFunction(level, message, f) {
    const dep = onetimeTrace(level, message);
    return function() {
        dep();
        return f.apply(this, arguments);
    };
}

export function deprecateFunction(message, f) {
    return traceFunction('warn', message, f);
}

// http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
export function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

export function isIe() {
    const ua = window.navigator.userAgent;

    return (ua.indexOf('MSIE ') > 0
        || ua.indexOf('Trident/') > 0
        || ua.indexOf('Edge/') > 0);
}

export function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// polyfill Object.assign for IE
// it's just too useful to do without
if(typeof Object.assign != 'function') {
    // Must be writable: true, enumerable: false, configurable: true
    Object.defineProperty(Object, 'assign', {
        value: function assign(target, _varArgs) { // .length of function is 2
            'use strict';
            if(target == null) { // TypeError if undefined or null
                throw new TypeError('Cannot convert undefined or null to object');
            }

            const to = Object(target);

            for(let index = 1; index < arguments.length; index++) {
                const nextSource = arguments[index];

                if(nextSource != null) { // Skip over if undefined or null
                    for (const nextKey in nextSource) {
                        // Avoid bugs when hasOwnProperty is shadowed
                        if(Object.hasOwn(nextSource, nextKey)) {
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
if(!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
        value(valueToFind, fromIndex) {
            if(this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            // 1. Let O be ? ToObject(this value).
            const o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            const len = o.length>>>0;

            // 3. If len is 0, return false.
            if(len === 0) {
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
            while(k < len) {
                // a. Let elementK be the result of ? Get(O, ! ToString(k)).
                // b. If SameValueZero(valueToFind, elementK) is true, return true.
                if(sameValueZero(o[k], valueToFind)) {
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

if(!Object.entries) {
    Object.entries = function(obj) {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i); // preallocate the Array
        while(i--)
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

    if(obj === null || typeof obj === 'undefined') {
        throw new TypeError('Cannot convert undefined or null to object');
    } else if(!~allowedTypes.indexOf(objType)) {
        return [];
    } else {
        // if ES6 is supported
        if(Object.keys) {
            return Object.keys(obj).map((key) => obj[key]);
        }

        const result = [];
        for (const prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                result.push(obj[prop]);
            }
        }

        return result;
    }
};

export function getBBoxNoThrow(elem) {
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
export function functorWrap(v, wrap) {
    if(typeof v === 'function') {
        return wrap
            ? function(x) {
                return v(wrap(x));
            }
            : v;
    } else return function() {
            return v;
        };
}
