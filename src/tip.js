/* asynchronous d3.tip support for dc.graph.js (optional) */
dc_graph.tip = function() {
    var _tip = {}, _d3tip = null;

    /**
     #### .parent([object])
     Assigns this tip object to a diagram. It will show tips for nodes in that diagram.
     **/
    _tip.parent = property(null)
        .react(function(p) {
            if(p)
                p.on('drawn.tip', function(node, edge, ehover) {
                    annotate(node, ehover);
                });
            else if(_tip.parent())
                _tip.parent().on('drawn.tip', null);
        });

    function fetch_and_show_content(fetcher) {
         return function(d) {
             var target = d3.event.target;
             _tip[fetcher]()(d, function(content) {
                 _d3tip.show(content, target);
             });
         };
    }
    function annotate(node, ehover) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; });
            _tip.parent().svg().call(_d3tip);
        }
        node
            .on('mouseover.tip', fetch_and_show_content('content'))
            .on('mouseout.tip', function(d) {
                _d3tip.hide();
            });
        ehover
            .on('mouseover.tip', fetch_and_show_content('content'))
            .on('mouseout.tip', function(d) {
                _d3tip.hide();
            });
    }

    /**
     #### .table()
     Generates a handler which can be passed to `tip.content` which produces a table
     of the attributes and values of the hovered object.
     **/
    _tip.table = function() {
        return function(d, k) {
            d = d.orig.value;
            var keys = Object.keys(d);
            var table = d3.select(document.createElement('table'));
            var rows = table.selectAll('tr').data(keys);
            var rowsEnter = rows.enter().append('tr');
            rowsEnter.append('td').text(function(k) { return k; });
            rowsEnter.append('td').text(function(k) { return d[k]; });
            k(table.node().outerHTML); // optimizing for clarity over speed (?)
        };
    };

    /**
     #### .content([function])
     Specifies the function to generate content for the tooltip. This function has
     the signature `function(d, k)`, where `d` is the datum of the node being hovered over,
     and `k` is a continuation. The function should fetch the content, asynchronously
     if needed, and then pass html forward to `k`.
     **/
    _tip.content = property(function(d, k) {
        k(_tip.parent() ? _tip.parent().nodeTitle.eval(d) : '');
    });

    return _tip;
};
