dc_graph.dropdown = function() {
    dc_graph.dropdown.unique_id = (dc_graph.dropdown.unique_id || 16) + 1;
    var _dropdown = {
        id: 'id' + dc_graph.dropdown.unique_id,
        parent: property(null),
        show: function(key, x, y) {
            var dropdown = _dropdown.parent().root()
                .selectAll('div.dropdown.' + _dropdown.id).data([0]);
            var dropdownEnter = dropdown
                .enter().append('div')
                .attr('class', 'dropdown ' + _dropdown.id);
            dropdown
                .style('visibility', 'visible')
                .style('left', x + 'px')
                .style('top', y + 'px');
            switch(_dropdown.hide()) {
            case 'leave':
                dropdown.on('mouseleave', function() {
                    dropdown.style('visibility', 'hidden');
                });
                break;
            }
            var container = dropdown;
            if(_dropdown.scrollHeight()) {
                var height = _dropdown.scrollHeight();
                if(typeof height === 'number')
                    height = height + 'px';
                dropdown
                    .style('max-height', height)
                    .property('scrollTop', 0);
                dropdownEnter
                    .style('overflow-y', 'auto')
                  .append('div')
                    .attr('class', 'scroller');
                container = dropdown.selectAll('div.scroller');
            }
            var values = _dropdown.fetchValues()(key, function(values) {
                var items = container
                    .selectAll('div.dropdown-item').data(values);
                items
                    .enter().append('div')
                    .attr('class', 'dropdown-item');
                items.exit().remove();
                items
                    .text(function(item) { return _dropdown.itemText()(item); })
                    .on('click', _dropdown.itemSelected());
            });
        },
        hide: property('leave'),
        height: property(10),
        itemText: property(function(x) { return x; }),
        itemSelected: property(function() {}),
        fetchValues: property(function(key, k) { k([]); }),
        scrollHeight: property('12em')
    };
    return _dropdown;
};
