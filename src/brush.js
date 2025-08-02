import { mode } from './mode.js';
import { dispatch } from 'd3-dispatch';
import { brush as d3Brush, brushSelection } from 'd3-brush';
import { event } from 'd3-selection';

/**
 * `brush` is a {@link mode mode} providing a simple wrapper over
 * [d3.svg.brush](https://github.com/d3/d3-3.x-api-reference/blob/master/SVG-Controls.md#brush)
 * @class brush
 * @return {brush}
 **/
export function brush() {
    var _brush = null, _gBrush, _dispatch = dispatch('brushstart', 'brushmove', 'brushend');
    var _clearing = false;

    function brushstart() {
        if(!_clearing) {
            _dispatch.call("brushstart");
        }
    }
    function brushmove() {
        if(!_clearing) {
            var ext = event.selection;
            _dispatch.call("brushmove", null, ext);
        }
    }
    function brushend() {
        if(!_clearing) {
            _dispatch.call("brushend");
            _clearing = true;
            _gBrush.call(_brush.move, null);
            _clearing = false;
        }
    }
    function install_brush(diagram) {
        if(!_brush) {
            const extent = [[diagram.x().range()[0], diagram.y().range()[0]], [diagram.x().range()[1], diagram.y().range()[1]]];
            _brush = d3Brush()
                .extent(extent)
                .on('start.brush-mode', brushstart)
                .on('brush.brush-mode', brushmove)
                .on('end.brush-mode', brushend);
        }
        if(!_gBrush) {
            _gBrush = diagram.svg().insert('g', ':first-child')
                .attr('class', 'brush')
                .call(_brush);
        }
    }
    function remove_brush() {
        if(_gBrush) {
            _gBrush.remove();
            _gBrush = null;
        }
    }
    var _mode = mode('brush', {
        draw: function() {},
        remove: remove_brush
    });

    /**
     * Subscribe to a brush event, currently `brushstart`, `brushmove`, or `brushend`
     * @method on
     * @memberof dc_graph.brush
     * @instance
     * @param {String} event the name of the event; please namespace with `'namespace.event'`
     * @param {Function} [f] the handler function; if omitted, returns the current handler
     * @return {dc_graph.brush}
     * @return {Function}
     **/
    _mode.on = function(event, f) {
        if(arguments.length === 1)
            return _dispatch.on(event);
        _dispatch.on(event, f);
        return this;
    };
    /**
     * Add the brush to the parent diagram's SVG
     * @method activate
     * @memberof dc_graph.brush
     * @instance
     * @return {dc_graph.brush}
     **/
    _mode.activate = function() {
        install_brush(_mode.parent());
        return this;
    };
    /**
     * Remove the brush from the parent diagram's SVG
     * @method deactivate
     * @memberof dc_graph.brush
     * @instance
     * @return {dc_graph.brush}
     **/
    _mode.deactivate = function() {
        remove_brush();
        return this;
    };
    /**
     * Retrieve whether the brush is currently active
     * @method isActive
     * @memberof dc_graph.brush
     * @instance
     * @return {Boolean}
     **/
    _mode.isActive = function () {
        return !!_gBrush;
    };

    return _mode;
};
