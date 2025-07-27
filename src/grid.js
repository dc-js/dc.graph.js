import { property } from './core.js';
import { mode } from './mode.js';

// External dependencies
import { range } from 'd3-array';

export function grid() {
    var _gridLayer = null;
    var _translate, _scale, _xDomain, _yDomain;

    function draw(diagram, node, edge, ehover) {
        //infer_and_draw(diagram);
    }

    function remove(diagram, node, edge, ehover) {
        if(_gridLayer)
            _gridLayer.remove();
    }

    function draw(diagram) {
        _gridLayer = diagram.g().selectAll('g.grid-layer').data([0]);
        _gridLayer.enter().append('g').attr('class', 'grid-layer');
        var ofs = _mode.wholeOnLines() ? 0 : 0.5;
        var vline_data = _scale >= _mode.threshold() ? range(Math.floor(_xDomain[0]), Math.ceil(_xDomain[1]) + 1) : [];
        var vlines = _gridLayer.selectAll('line.grid-line.vertical')
            .data(vline_data, function(d) { return d - ofs; });
        vlines.exit().remove();
        vlines.enter().append('line')
            .attr('class', 'grid-line vertical')
            .attr('x1', d => d - ofs)
            .attr('x2', d => d - ofs);
        vlines.attr('stroke-width', 1/_scale)
            .attr('y1', _yDomain[0])
            .attr('y2', _yDomain[1]);
        var hline_data = _scale >= _mode.threshold() ? range(Math.floor(_yDomain[0]), Math.ceil(_yDomain[1]) + 1) : [];
        var hlines = _gridLayer.selectAll('line.grid-line.horizontal')
            .data(hline_data, function(d) { return d - ofs; });
        hlines.exit().remove();
        hlines.enter().append('line')
            .attr('class', 'grid-line horizontal')
            .attr('y1', d => d - ofs)
            .attr('y2', d => d - ofs);
        hlines.attr('stroke-width', 1/_scale)
            .attr('x1', _xDomain[0])
            .attr('x2', _xDomain[1]);
    }

    function on_zoom(translate, scale, xDomain, yDomain) {
        _translate = translate;
        _scale = scale;
        _xDomain = xDomain,
        _yDomain = yDomain;
        draw(_mode.parent());
    }

    function infer_and_draw(diagram) {
        _translate = diagram.translate();
        _scale = diagram.scale();
        _xDomain = diagram.x().domain();
        _yDomain = diagram.y().domain();
        draw(diagram);
    }

    var _mode = mode('highlight-paths', {
        draw: draw,
        remove: remove,
        parent: function(p) {
            if(p) {
                p.on('zoomed.grid', on_zoom);
                infer_and_draw(p);
            }
        }
    });

    _mode.threshold = property(4);
    _mode.wholeOnLines = property(true);

    return _mode;
};


