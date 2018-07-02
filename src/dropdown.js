dc_graph.dropdown = function() {
    var _dropdown = {
        parent: property(null),
        show: function(x, y) {
            var dropdown = _dropdown.parent().root().selectAll('div.dropdown').data([0]);
            dropdown
                .enter().append('div')
                .attr('class', 'dropdown');
            var items = dropdown
                .style('left', x + 'px')
                .style('top', y + 'px')
                .selectAll('div.dropdown-item').data(_dropdown.values());
            items
              .enter().append('div')
                .attr('class', 'dropdown-item');
            items.exit().remove();
            items
                .text(function(item) { return _dropdown.itemText()(item); })
                .on('click', _dropdown.itemSelected());
        },
        height: property(10),
        itemText: property(function(x) { return x; }),
        itemSelected: property(function() {}),
        values: property([])
    };
    return _dropdown;
};
