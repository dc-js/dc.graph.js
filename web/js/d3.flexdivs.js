function flex_div_helper_mapper(map) {
    return function flex_div_helper(data) {
        var me = d3.select(this);

        me.style({
            flex: function(d) {
                if(d.flex)
                    return d.flex;
                var pdat = d3.select(this.parentNode).datum();
                return pdat && pdat.deflex || null;
            },
            display: function(d) {
                return d.direction ? 'flex' : null;
            },
            'flex-direction': function(d) {
                return d.direction || null;
            }
        });

        var divs = me.selectAll(function() {
            return this.childNodes;
        }).data(data.divs || []);
        divs.enter().append('div');
        divs.exit().remove();
        divs.attr({
            class: function(d) {
                return d.class || null;
            },
            id: function(d) {
                return d.bring ? 'wrap-' + d.id : d.id;
            }
        });
        divs.each(flex_div_helper);
        divs.filter(function(d) { return d.bring && !map[d.id]; })
            .append('div')
            .attr('id', function(d) {
                return d.id;
            });
    };
}
function bringover(data, map) {
    if(data.id && data.bring) {
        var e = document.getElementById(data.id);
        if(e)
            map[data.id] = e.parentNode.removeChild(e);
    }
    if(data.divs)
        data.divs.forEach(function(d) {
            bringover(d, map);
        });
}

function flex_divs(root, data, place) {
    var map = {};
    bringover(data, map);
    var flex_div_helper = flex_div_helper_mapper(map);
    d3.select(root).data([data])
        .each(flex_div_helper);
    Object.keys(map).forEach(function(k) {
        document.getElementById('wrap-' + k).appendChild(map[k]);
        if(place)
            place(k);
    });
}
