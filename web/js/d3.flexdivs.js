function flex_div_helper(data) {
    function select_or_create(d) {
        var div;
        if(d.id)
            div = document.getElementById(d.id);
        if(!div)
            (div = document.createElement("div")).id = d.id;
        return div;
    }

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

    if(data.divs) {
        var divs = me.selectAll('div.flex-div').data(data.divs);
        divs.enter().append(select_or_create);
        divs.exit().remove(); // this won't work
        divs.each(flex_div_helper);
    }
}

function flex_divs(root, data) {
    d3.select(root).data([data])
        .each(flex_div_helper);
}
