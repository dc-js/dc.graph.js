import { property, getBBoxNoThrow, isIe, isSafari } from './core.js';
import { select } from 'd3-selection';
import { nodeLabelPadding } from './shape.js';

export function textContents() {
    var _contents = {
        parent: property(null),
        update: function(container) {
            let text = container.selectAll('text.node-label')
                    .data(function(n) { return [n]; });
            const textEnter = text.enter().append('text')
                .attr('class', 'node-label');
            text = text.merge(textEnter);
            let tspan = text.selectAll('tspan').data(function(n) {
                var lines = _contents.parent().nodeLabel.eval(n);
                if(!lines)
                    return [];
                else if(typeof lines === 'string')
                    lines = [lines];
                var lineHeight = _contents.parent().nodeLineHeight();
                var first = 0.5 - ((lines.length - 1) * lineHeight + 1)/2;
                // IE, Edge, and Safari do not seem to support
                // dominant-baseline: central although they say they do
                if(isIe() || isSafari())
                    first += 0.3;
                return lines.map(function(line, i) { return {node: n, line: line, yofs: (i==0 ? first : lineHeight) + 'em'}; });
            });
            const tspanEnter = tspan.enter().append('tspan');
            tspan = tspan.merge(tspanEnter);
            tspan
                .attr('text-anchor', 'start')
                .attr('text-decoration', function(line) {
                    return _contents.parent().nodeLabelDecoration.eval(line.node);
                })
                .attr('x', 0)
                .html(function(s) { return s.line; });
            text
                .each(function(n) {
                    n.xofs = 0;
                })
                .filter(function(n) {
                    return _contents.parent().nodeLabelAlignment.eval(n) !== 'center';
                })
                .each(function(n) {
                    var bbox = getBBoxNoThrow(this);
                    n.bbox = {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
                    switch(_contents.parent().nodeLabelAlignment.eval(n)) {
                    case 'left': n.xofs = -n.bbox.width/2;
                        break;
                    case 'right': n.xofs = n.bbox.width/2;
                        break;
                    }
                })
                .selectAll('tspan');
            tspan
                .attr('text-anchor', function(s) {
                    switch(_contents.parent().nodeLabelAlignment.eval(s.node)) {
                    case 'left': return 'start';
                    case 'center': return 'middle';
                    case 'right': return 'end';
                    }
                    return null;
                })
                .attr('x', function(s) {
                    return s.node.xofs;
                })
                .attr('dy', function(d) { return d.yofs; });

            tspan.exit().remove();
            text
                .attr('fill', _contents.parent().nodeLabelFill.eval);
        },
        textbox: function(container) {
            var bbox = getBBoxNoThrow(this.selectContent(container).node());
            return {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
        },
        selectContent: function(container) {
            return container.select('text.node-label');
        },
        selectText: function(container) {
            return this.selectContent(container);
        }
    };
    return _contents;
};

export function withIconContents(contents, width, height) {
    var _contents = {
        parent: property(null).react(function(parent) {
            contents.parent(parent);
        }),
        padding: function(n) {
            var padding = nodeLabelPadding(_contents.parent(), n);
            return {
                x: padding.x * 3,
                y: padding.y * 3
            };
        },
        update: function(container) {
            let g = container.selectAll('g.with-icon')
                    .data(function(n) { return [n]; });
            const gEnter = g.enter();
            gEnter.append('g')
                .attr('class', 'with-icon')
              .append('image')
                .attr('class', 'icon')
                .attr('width', width + 'px')
                .attr('height', height + 'px');
            g = g.merge(gEnter.select('g.with-icon'));
            g.call(contents.update);
            contents.selectContent(g)
                .attr('transform',  'translate(' + width/2 + ')');
            g.selectAll('image.icon')
                .attr('href', _contents.parent().nodeIcon.eval)
                .attr('x', function(n) {
                    var totwid = width + contents.textbox(select(this.parentNode)).width;
                    return -totwid/2 - nodeLabelPadding(_contents.parent(), n).x;
                })
                .attr('y', -height/2);
        },
        textbox: function(container) {
            var box = contents.textbox(container);
            box.x += width/2;
            return box;
        },
        selectContent: function(container) {
            return container.select('g.with-icon');
        },
        selectText: function(container) {
            return this.selectContent(container).select('text.node-label');
        }
    };
    return _contents;
};

