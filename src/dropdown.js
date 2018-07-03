dc_graph.dropdown = function() {
    var _dropdown = {
        parent: property(null),
        show: function(x, y) {
            var dropdown = _dropdown.parent().root().selectAll('div.dropdown').data([0]);
            var dropdownEnter = dropdown
                .enter().append('div')
                .attr('class', 'dropdown');
            dropdown
                .style('left', x + 'px')
                .style('top', y + 'px');
            if(_dropdown.scrolling()) {
                dropdown
                    .style('height', '10em');
                dropdownEnter
                    .style('overflow-y', 'auto')
                  .append('div')
                    .attr('class', 'scroller');
                dropdown = dropdown.selectAll('div.scroller');
            }
            var items = dropdown
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
        values: property([]),
        scrolling: property(true)
    };
    return _dropdown;
};
