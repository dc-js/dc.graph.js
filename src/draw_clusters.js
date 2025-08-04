import { mode } from './mode.js';
import { property } from './core.js';

export function drawClusters() {

    function apply_bounds(rect) {
        rect.attr('x', c => c.cola.bounds.left)
            .attr('y', c => c.cola.bounds.top)
            .attr('width', c => c.cola.bounds.right - c.cola.bounds.left)
            .attr('height', c => c.cola.bounds.bottom - c.cola.bounds.top);
    }
    function draw(diagram) {
        if(!diagram.clusterGroup())
            return;
        const clayer = diagram.g().selectAll('g.cluster-layer').data([0]);
        clayer.enter().insert('g', ':first-child')
            .attr('class', 'cluster-layer');
        const clusters = diagram.clusterGroup().all().map((kv) => _mode.parent().getWholeCluster(kv.key)).filter((c) => c && c.cola.bounds);
        const rects = clayer.selectAll('rect.cluster')
            .data(clusters, (c) => c.orig.key);
        rects.exit().remove();
        rects.enter().append('rect')
            .attr('class', 'cluster')
            .attr('opacity', 0)
            .attr('stroke', _mode.clusterStroke.eval)
            .attr('stroke-width', _mode.clusterStrokeWidth.eval)
            .attr('fill', c => _mode.clusterFill.eval(c) || 'none')
            .call(apply_bounds);
        rects.transition()
            .duration(_mode.parent().stagedDuration())
            .attr('opacity', _mode.clusterOpacity.eval)
            .call(apply_bounds);
    }
    function remove(_diagram, _node, _edge, _ehover) {
    }
    const _mode = mode('draw-clusters', {
        laterDraw: true,
        draw,
        remove
    });
    _mode.clusterOpacity = property(0.25);
    _mode.clusterStroke = property('black');
    _mode.clusterStrokeWidth = property(1);
    _mode.clusterFill = property(null);
    _mode.clusterLabel = property(null);
    _mode.clusterLabelFill = property('black');
    _mode.clusterLabelAlignment = property(['bottom','right']);

    return _mode;
};

