var dc_graph = {
    version: '<%= conf.pkg.version %>'
};

var property = function (defaultValue) {
    var value = defaultValue, react = null;
    var ret = function (_) {
        if (!arguments.length) {
            return value;
        }
        value = _;
        if(react)
            react(_);
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

var identity = function(x) { return x; };
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

function point_on_ellipse(A, B, dx, dy) {
    var tansq = Math.tan(Math.atan2(dy, dx));
    tansq = tansq*tansq; // why is this not just dy*dy/dx*dx ? ?
    console.log(tansq);
    var ret = {x: A*B/Math.sqrt(B*B + A*A*tansq), y: A*B/Math.sqrt(A*A + B*B/tansq)};
    if(dx<0)
        ret.x = -ret.x;
    if(dy<0)
        ret.y = -ret.y;
    return ret;
}

// because i don't think we need to bind edge point data (yet!)
var bez_cmds = {
    1: 'L', 2: 'Q', 3: 'C'
};

function generate_path(pts, bezness) {
    var cats = ['M', pts[0], ',', pts[1]], remain = bezness;
    for(var i = 2; i < pts.length; i += 2) {
        cats.push(remain===bezness ? bez_cmds[bezness] : ' ', pts[i], ',', pts[i+1]);
        if(--remain===0)
            remain = bezness;
    }
    if(remain!=bezness)
        console.log("warning: pts.length didn't match bezness", pts, bezness);
    return cats.join('');
}
