dc_graph.draw_clusters = function() {

    function apply_bounds(rect) {
        rect.attr({
            x: function(c) {
                return c.cola.bounds.left;
            },
            y: function(c) {
                return c.cola.bounds.top;
            },
            width: function(c) {
                return c.cola.bounds.right - c.cola.bounds.left;
            },
            height: function(c) {
                return c.cola.bounds.bottom - c.cola.bounds.top;
            }
        });
    }
    function draw(diagram) {
        if(!diagram.clusterGroup())
            return;
        var clayer = diagram.g().selectAll('g.clusters').data([0]);
        clayer.enter().insert('g', ':first-child');
        var clusters = diagram.clusterGroup().all().map(function(kv) {
            return _mode.parent().getWholeCluster(kv.key);
        });
        var rects = clayer.selectAll('rect.cluster').data(clusters);
        rects.exit().remove();
        rects.enter().append('rect')
            .attr({
                class: 'cluster',
                opacity: 0,
                stroke: _mode.clusterStroke.eval,
                'stroke-width': _mode.clusterStrokeWidth.eval,
                fill: function(c) {
                    return _mode.clusterFill.eval(c) || 'none';
                }
            })
            .call(apply_bounds);
        rects.transition()
            .duration(_mode.parent().stagedDuration())
            .attr('opacity', _mode.clusterOpacity.eval)
            .call(apply_bounds);
    }
    function remove(diagram, node, edge, ehover) {
    }
    var _mode = dc_graph.mode('draw-clusters', {
        laterDraw: true,
        draw: draw,
        remove: remove
    });
    _mode.clusterOpacity = property(0.25);
    _mode.clusterStroke = property('black');
    _mode.clusterStrokeWidth = property(1);
    _mode.clusterFill = property(null);
    _mode.clusterLabel = property(function(kv) { return kv.key; });
    _mode.clusterLabelFill = property('black');
    _mode.clusterLabelAlignment = property(['bottom','right']);

    return _mode;
};

