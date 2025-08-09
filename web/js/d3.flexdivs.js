function flex_div_helper_mapper(map) {
    return function flex_div_helper(data) {
        const me = d3.select(this);

        me.style({
            flex(d) {
                if (d.flex)
                    return d.flex;
                const pdat = d3.select(this.parentNode).datum();
                return pdat && pdat.deflex || null;
            },
            display(d) {
                return d.direction ? 'flex' : null;
            },
            'flex-direction'(d) {
                return d.direction || null;
            },
        });

        const divs = me.selectAll(function() {
            return this.childNodes;
        }).data(data.divs || []);
        divs.enter().append('div');
        divs.exit().remove();
        divs.attr({
            class(d) {
                return d.class || null;
            },
            id(d) {
                return d.bring ? `wrap-${d.id}` : d.id;
            },
        });
        divs.each(flex_div_helper);
        divs.filter(d => d.bring && !map[d.id])
            .append('div')
            .attr('id', d => d.id);
    };
}
function bringover(data, map) {
    if (data.id && data.bring) {
        const e = document.getElementById(data.id);
        if (e)
            map[data.id] = e.parentNode.removeChild(e);
    }
    if (data.divs)
        data.divs.forEach(d => {
            bringover(d, map);
        });
}

function flex_divs(root, data, place) {
    const map = {};
    bringover(data, map);
    const flex_div_helper = flex_div_helper_mapper(map);
    d3.select(root).data([data])
        .each(flex_div_helper);
    Object.keys(map).forEach(k => {
        document.getElementById(`wrap-${k}`).appendChild(map[k]);
        if (place)
            place(k);
    });
}
