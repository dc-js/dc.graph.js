// not quite a dc.js chart, writing it simply in order to
// relearn the basics. i'll probably regret this and dc-ize it later
// why is it not a grouped bar chart with a time x axis?
// because i am not sure that would work even if i had time to merge the PR
// ok i'm rationalizing. it's for the fun. all the more reason to regret later.
function timeline(parent) {
    var _chart = {};
    var _x = null, _y = null;
    var _width, _height;
    var _root = null, _svg = null, _g = null;
    var _tickWidth = 1, _tickOpacity = 0.5;
    var _region;
    var _minHeight = 20;
    var _dispatch = d3.dispatch('jump');
    // input data is just an array of {key: Date, value: {} or {adds: number, dels: number}}
    var _events = null;
    // play head
    var _current = null;
    // time display
    var _timewid = 65, _timefmt = d3.time.format('%-m/%-d %H:%M:%S');

    _chart.x = function(scale) {
        if(!arguments.length)
            return _x;
        _x = scale;
        return _chart;
    };

    _chart.y = function(scale) {
        if(!arguments.length)
            return _y;
        _y = scale;
        return _chart;
    };

    _chart.events = function(events) {
        if(!arguments.length)
            return _events;
        _events = events.map(function(e) {
            var value;
            if(e.value.adds !== undefined) {
                value = [
                    {key: 'adds', height: e.value.adds, fill: 'green'},
                    {key: 'dels', height: e.value.dels, fill: 'red'}
                ];
            } else {
                value = [
                    {key: 'place', height: NaN, fill: 'grey'}
                ];
            }
            return {key: e.key, value: value};
        });
        return _chart;
    };

    // a region {x1, x2, color, opacity} to highlight
    _chart.region = function(region) {
        if(!arguments.length)
            return _region;
        _region = region;
        return _chart;
    };

    _chart.current = function(t) {
        if(!arguments.length)
            return _current;
        _current = t;
        return _chart;
    };

    function baseline() {
        return _height/2;
    }

    function y(height) {
        return isNaN(height) ? 3 : _y(0) - _y(height);
    }

    _chart.minHeight = function(h) {
        if(!arguments.length)
            return _minHeight;
        _minHeight = h;
        return _chart;
    };

    _chart.tickOpacity = function(o) {
        if(!arguments.length)
            return _tickOpacity;
        _tickOpacity = o;
        return _chart;
    };

    _chart.tickWidth = function(o) {
        if(!arguments.length)
            return _tickWidth;
        _tickWidth = o;
        return _chart;
    };

    function height(tick) {
        switch(tick.key) {
        case 'place': return 3;
        case 'marker': return baseline();
        default: return y(tick.height);
        }
    }

    function y0(tick) {
        switch(tick.key) {
        case 'place': return baseline()-1;
        case 'adds': return baseline()-y(tick.height);
        case 'dels': return baseline();
        default: throw new Error('unknown tick type ' + tick.key);
        }
    }

    _chart.redraw = function() {
        var bl = baseline();
        if(!_x) _x = d3.time.scale();
        if(!_y) _y = d3.scale.linear();
        _x.domain(d3.extent(_events, function(e) { return e.key; }))
            .range([_timewid, _width-_tickWidth]);
        var max = Math.max(_minHeight, d3.max(_events, function(e) {
            return e.value[0].key === 'adds' ? Math.max(e.value[0].height, e.value[1].height) : 0;
        }));
        _y.domain([max, -max]).range([0, _height]);

        var axis = _g.selectAll('rect.timeline').data([0]);
        axis.enter().append('rect').attr('class', 'timeline');
        axis.attr({
            width: _width-_timewid, height: 1,
            x: _timewid, y: bl,
            fill: '#ccc'
        });

        var region = _g.selectAll('rect.region')
                .data(_region ? [_region] : []);
        region.enter().append('rect')
            .attr('class', 'region');
        region.attr({
            x: function(d) {
                return _x(d.x1);
            },
            y: 0,
            width: function(d) {
                return _x(d.x2) - _x(d.x1) + _tickWidth;
            },
            height: _height,
            fill: _region && _region.color || 'blue',
            opacity: _region && _region.opacity || 0.5
        });
        region.exit().remove();

        var ticks = _g.selectAll('g.timetick')
                .data(_events, function(e) { return e.key; });
        ticks.enter().append('g').attr('class', 'timetick');
        ticks.attr('transform', function(d) {
            return 'translate(' + Math.floor(_x(d.key)) + ',0)';
        });
        ticks.exit().remove();
        var tick = ticks.selectAll('rect')
                .data(function(d) { return d.value; }, function(t) { return t.key; });
        tick.enter().append('rect');
        tick.attr({
            width: _tickWidth,
            height: height,
            x: 0, y: y0,
            fill: function(t) { return t.fill; },
            opacity: _tickOpacity
        });
        tick.exit().remove();

        if(_current) {
            var text = _g.selectAll('text.currtime')
                    .data([0]);
            text.enter().append('text').attr('class', 'currtime');
            text.text(_timefmt(_current)).attr({
                'font-family': 'sans-serif',
                'font-size': '10px',
                x: 0,
                y: bl
            });
            var head = _g.selectAll('g.playhead')
                    .data([0]);
            head.enter().append('g').attr('class', 'playhead');
            var playbox = head.selectAll('rect')
                    .data([0]);
            playbox.enter().append('rect');
            playbox.attr({
                width: 4, height: _height,
                x: Math.floor(_x(_current))-1, y: 0,
                fill: 'none',
                stroke: 'darkblue',
                'stroke-width': 1,
                opacity: 0.5
            });
        }
        return _chart;
    };

    _chart.render = function() {
        resetSvg();
        _g = _svg
            .append('g');

        _svg.on('click', function() {
            if(_x)
                _dispatch.jump(_x.invert(d3.mouse(this)[0]));
        });
        _chart.redraw();
        return _chart;
    };

    _chart.on = function(event, callback) {
        _dispatch.on(event, callback);
        return _chart;
    };

    _chart.width = function(w) {
        if(!arguments.length)
            return _width;
        _width = w;
        return _chart;
    };

    _chart.height = function(h) {
        if(!arguments.length)
            return _height;
        _height = h;
        return _chart;
    };

    _chart.select = function(s) {
        return _root.select(s);
    };

    _chart.selectAll = function(s) {
        return _root.selectAll(s);
    };

    function resetSvg() {
        _chart.select('svg').remove();
        generateSvg();
    }

    function generateSvg() {
        _svg = _root.append('svg')
            .attr({width: _chart.width(),
                   height: _chart.height()});
    }

    _root = d3.select(parent);
    return _chart;
}
