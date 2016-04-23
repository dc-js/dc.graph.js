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
                p.on('drawn.tip', function(node, edge) {
                    annotate(node);
                });
            else if(_tip.parent())
                _tip.parent().on('drawn.tip', null);
        });

    function annotate(node) {
        if(!_d3tip) {
            _d3tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) { return "<span>" + d + "</span>"; });
            _tip.parent().svg().call(_d3tip);
        }
        node
            .on('mouseover.tip', function(d) {
                var target = d3.event.target;
                _tip.content()(d, function(content) {
                    _d3tip.show(content, target);
                });
            })
	    .on('mouseout.foo', function(d) {
		_d3tip.hide();
	    });
    }

    /**
     #### .content([function])
     Specifies the function to generate content for the tooltip. This function has
     the signature `function(d, k)`, where `d` is the datum of the node being hovered over,
     and `k` is a continuation. The function should fetch the content, asynchronously
     if needed, and then pass it forward to `k`.
     **/
    _tip.content = property(function(d, k) {
        k(_tip.parent() ? _tip.parent().nodeTitle.eval(d) : '');
    });

    return _tip;
};
