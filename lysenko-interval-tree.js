(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.lysenkoIntervalTree = factory());
}(this, (function () { 'use strict';

function compileSearch(funcName, predicate, reversed, extraArgs, useNdarray, earlyOut) {
  var code = [
    "function ", funcName, "(a,l,h,", extraArgs.join(","),  "){",
earlyOut ? "" : "var i=", (reversed ? "l-1" : "h+1"),
";while(l<=h){\
var m=(l+h)>>>1,x=a", useNdarray ? ".get(m)" : "[m]"];
  if(earlyOut) {
    if(predicate.indexOf("c") < 0) {
      code.push(";if(x===y){return m}else if(x<=y){");
    } else {
      code.push(";var p=c(x,y);if(p===0){return m}else if(p<=0){");
    }
  } else {
    code.push(";if(", predicate, "){i=m;");
  }
  if(reversed) {
    code.push("l=m+1}else{h=m-1}");
  } else {
    code.push("h=m-1}else{l=m+1}");
  }
  code.push("}");
  if(earlyOut) {
    code.push("return -1};");
  } else {
    code.push("return i};");
  }
  return code.join("")
}

function compileBoundsSearch(predicate, reversed, suffix, earlyOut) {
  var result = new Function([
  compileSearch("A", "x" + predicate + "y", reversed, ["y"], false, earlyOut),
  compileSearch("B", "x" + predicate + "y", reversed, ["y"], true, earlyOut),
  compileSearch("P", "c(x,y)" + predicate + "0", reversed, ["y", "c"], false, earlyOut),
  compileSearch("Q", "c(x,y)" + predicate + "0", reversed, ["y", "c"], true, earlyOut),
"function dispatchBsearch", suffix, "(a,y,c,l,h){\
if(a.shape){\
if(typeof(c)==='function'){\
return Q(a,(l===undefined)?0:l|0,(h===undefined)?a.shape[0]-1:h|0,y,c)\
}else{\
return B(a,(c===undefined)?0:c|0,(l===undefined)?a.shape[0]-1:l|0,y)\
}}else{\
if(typeof(c)==='function'){\
return P(a,(l===undefined)?0:l|0,(h===undefined)?a.length-1:h|0,y,c)\
}else{\
return A(a,(c===undefined)?0:c|0,(l===undefined)?a.length-1:l|0,y)\
}}}\
return dispatchBsearch", suffix].join(""));
  return result()
}

var searchBounds = {
  ge: compileBoundsSearch(">=", false, "GE"),
  gt: compileBoundsSearch(">", false, "GT"),
  lt: compileBoundsSearch("<", true, "LT"),
  le: compileBoundsSearch("<=", true, "LE"),
  eq: compileBoundsSearch("-", true, "EQ", true)
};

var NOT_FOUND = 0;
var SUCCESS = 1;
var EMPTY = 2;

var intervalTree = createWrapper;

function IntervalTreeNode(mid, left, right, leftPoints, rightPoints) {
  this.mid = mid;
  this.left = left;
  this.right = right;
  this.leftPoints = leftPoints;
  this.rightPoints = rightPoints;
  this.count = (left ? left.count : 0) + (right ? right.count : 0) + leftPoints.length;
}

var proto = IntervalTreeNode.prototype;

function copy(a, b) {
  a.mid = b.mid;
  a.left = b.left;
  a.right = b.right;
  a.leftPoints = b.leftPoints;
  a.rightPoints = b.rightPoints;
  a.count = b.count;
}

function rebuild(node, intervals) {
  var ntree = createIntervalTree(intervals);
  node.mid = ntree.mid;
  node.left = ntree.left;
  node.right = ntree.right;
  node.leftPoints = ntree.leftPoints;
  node.rightPoints = ntree.rightPoints;
  node.count = ntree.count;
}

function rebuildWithInterval(node, interval) {
  var intervals = node.intervals([]);
  intervals.push(interval);
  rebuild(node, intervals);    
}

function rebuildWithoutInterval(node, interval) {
  var intervals = node.intervals([]);
  var idx = intervals.indexOf(interval);
  if(idx < 0) {
    return NOT_FOUND
  }
  intervals.splice(idx, 1);
  rebuild(node, intervals);
  return SUCCESS
}

proto.intervals = function(result) {
  result.push.apply(result, this.leftPoints);
  if(this.left) {
    this.left.intervals(result);
  }
  if(this.right) {
    this.right.intervals(result);
  }
  return result
};

proto.insert = function(interval) {
  var weight = this.count - this.leftPoints.length;
  this.count += 1;
  if(interval[1] < this.mid) {
    if(this.left) {
      if(4*(this.left.count+1) > 3*(weight+1)) {
        rebuildWithInterval(this, interval);
      } else {
        this.left.insert(interval);
      }
    } else {
      this.left = createIntervalTree([interval]);
    }
  } else if(interval[0] > this.mid) {
    if(this.right) {
      if(4*(this.right.count+1) > 3*(weight+1)) {
        rebuildWithInterval(this, interval);
      } else {
        this.right.insert(interval);
      }
    } else {
      this.right = createIntervalTree([interval]);
    }
  } else {
    var l = searchBounds.ge(this.leftPoints, interval, compareBegin);
    var r = searchBounds.ge(this.rightPoints, interval, compareEnd);
    this.leftPoints.splice(l, 0, interval);
    this.rightPoints.splice(r, 0, interval);
  }
};

proto.remove = function(interval) {
  var weight = this.count - this.leftPoints;
  if(interval[1] < this.mid) {
    if(!this.left) {
      return NOT_FOUND
    }
    var rw = this.right ? this.right.count : 0;
    if(4 * rw > 3 * (weight-1)) {
      return rebuildWithoutInterval(this, interval)
    }
    var r = this.left.remove(interval);
    if(r === EMPTY) {
      this.left = null;
      this.count -= 1;
      return SUCCESS
    } else if(r === SUCCESS) {
      this.count -= 1;
    }
    return r
  } else if(interval[0] > this.mid) {
    if(!this.right) {
      return NOT_FOUND
    }
    var lw = this.left ? this.left.count : 0;
    if(4 * lw > 3 * (weight-1)) {
      return rebuildWithoutInterval(this, interval)
    }
    var r = this.right.remove(interval);
    if(r === EMPTY) {
      this.right = null;
      this.count -= 1;
      return SUCCESS
    } else if(r === SUCCESS) {
      this.count -= 1;
    }
    return r
  } else {
    if(this.count === 1) {
      if(this.leftPoints[0] === interval) {
        return EMPTY
      } else {
        return NOT_FOUND
      }
    }
    if(this.leftPoints.length === 1 && this.leftPoints[0] === interval) {
      if(this.left && this.right) {
        var p = this;
        var n = this.left;
        while(n.right) {
          p = n;
          n = n.right;
        }
        if(p === this) {
          n.right = this.right;
        } else {
          var l = this.left;
          var r = this.right;
          p.count -= n.count;
          p.right = n.left;
          n.left = l;
          n.right = r;
        }
        copy(this, n);
        this.count = (this.left?this.left.count:0) + (this.right?this.right.count:0) + this.leftPoints.length;
      } else if(this.left) {
        copy(this, this.left);
      } else {
        copy(this, this.right);
      }
      return SUCCESS
    }
    for(var l = searchBounds.ge(this.leftPoints, interval, compareBegin); l<this.leftPoints.length; ++l) {
      if(this.leftPoints[l][0] !== interval[0]) {
        break
      }
      if(this.leftPoints[l] === interval) {
        this.count -= 1;
        this.leftPoints.splice(l, 1);
        for(var r = searchBounds.ge(this.rightPoints, interval, compareEnd); r<this.rightPoints.length; ++r) {
          if(this.rightPoints[r][1] !== interval[1]) {
            break
          } else if(this.rightPoints[r] === interval) {
            this.rightPoints.splice(r, 1);
            return SUCCESS
          }
        }
      }
    }
    return NOT_FOUND
  }
};

function reportLeftRange(arr, hi, cb) {
  for(var i=0; i<arr.length && arr[i][0] <= hi; ++i) {
    var r = cb(arr[i]);
    if(r) { return r }
  }
}

function reportRightRange(arr, lo, cb) {
  for(var i=arr.length-1; i>=0 && arr[i][1] >= lo; --i) {
    var r = cb(arr[i]);
    if(r) { return r }
  }
}

function reportRange(arr, cb) {
  for(var i=0; i<arr.length; ++i) {
    var r = cb(arr[i]);
    if(r) { return r }
  }
}

proto.queryPoint = function(x, cb) {
  if(x < this.mid) {
    if(this.left) {
      var r = this.left.queryPoint(x, cb);
      if(r) { return r }
    }
    return reportLeftRange(this.leftPoints, x, cb)
  } else if(x > this.mid) {
    if(this.right) {
      var r = this.right.queryPoint(x, cb);
      if(r) { return r }
    }
    return reportRightRange(this.rightPoints, x, cb)
  } else {
    return reportRange(this.leftPoints, cb)
  }
};

proto.queryInterval = function(lo, hi, cb) {
  if(lo < this.mid && this.left) {
    var r = this.left.queryInterval(lo, hi, cb);
    if(r) { return r }
  }
  if(hi > this.mid && this.right) {
    var r = this.right.queryInterval(lo, hi, cb);
    if(r) { return r }
  }
  if(hi < this.mid) {
    return reportLeftRange(this.leftPoints, hi, cb)
  } else if(lo > this.mid) {
    return reportRightRange(this.rightPoints, lo, cb)
  } else {
    return reportRange(this.leftPoints, cb)
  }
};

function compareNumbers(a, b) {
  return a - b
}

function compareBegin(a, b) {
  var d = a[0] - b[0];
  if(d) { return d }
  return a[1] - b[1]
}

function compareEnd(a, b) {
  var d = a[1] - b[1];
  if(d) { return d }
  return a[0] - b[0]
}

function createIntervalTree(intervals) {
  if(intervals.length === 0) {
    return null
  }
  var pts = [];
  for(var i=0; i<intervals.length; ++i) {
    pts.push(intervals[i][0], intervals[i][1]);
  }
  pts.sort(compareNumbers);

  var mid = pts[pts.length>>1];

  var leftIntervals = [];
  var rightIntervals = [];
  var centerIntervals = [];
  for(var i=0; i<intervals.length; ++i) {
    var s = intervals[i];
    if(s[1] < mid) {
      leftIntervals.push(s);
    } else if(mid < s[0]) {
      rightIntervals.push(s);
    } else {
      centerIntervals.push(s);
    }
  }

  //Split center intervals
  var leftPoints = centerIntervals;
  var rightPoints = centerIntervals.slice();
  leftPoints.sort(compareBegin);
  rightPoints.sort(compareEnd);

  return new IntervalTreeNode(mid, 
    createIntervalTree(leftIntervals),
    createIntervalTree(rightIntervals),
    leftPoints,
    rightPoints)
}

//User friendly wrapper that makes it possible to support empty trees
function IntervalTree(root) {
  this.root = root;
}

var tproto = IntervalTree.prototype;

tproto.insert = function(interval) {
  if(this.root) {
    this.root.insert(interval);
  } else {
    this.root = new IntervalTreeNode(interval[0], null, null, [interval], [interval]);
  }
};

tproto.remove = function(interval) {
  if(this.root) {
    var r = this.root.remove(interval);
    if(r === EMPTY) {
      this.root = null;
    }
    return r !== NOT_FOUND
  }
  return false
};

tproto.queryPoint = function(p, cb) {
  if(this.root) {
    return this.root.queryPoint(p, cb)
  }
};

tproto.queryInterval = function(lo, hi, cb) {
  if(lo <= hi && this.root) {
    return this.root.queryInterval(lo, hi, cb)
  }
};

Object.defineProperty(tproto, "count", {
  get: function() {
    if(this.root) {
      return this.root.count
    }
    return 0
  }
});

Object.defineProperty(tproto, "intervals", {
  get: function() {
    if(this.root) {
      return this.root.intervals([])
    }
    return []
  }
});

function createWrapper(intervals) {
  if(!intervals || intervals.length === 0) {
    return new IntervalTree(null)
  }
  return new IntervalTree(createIntervalTree(intervals))
}

return intervalTree;

})));
