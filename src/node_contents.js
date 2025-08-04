import { property, getBBoxNoThrow, isIe, isSafari } from './core.js';
import { select } from 'd3-selection';
import { nodeLabelPadding } from './shape.js';

export function textContents() {
    const _contents = {
        parent: property(null),
        update(container) {
            let text = container.selectAll('text.node-label')
                    .data((n) => [n]);
            const textEnter = text.enter().append('text')
                .attr('class', 'node-label');
            text = text.merge(textEnter);
            let tspan = text.selectAll('tspan').data((n) => {
                let lines = _contents.parent().nodeLabel.eval(n);
                if(!lines)
                    return [];
                else if(typeof lines === 'string')
                    lines = [lines];
                const lineHeight = _contents.parent().nodeLineHeight();
                let first = 0.5 - ((lines.length - 1) * lineHeight + 1)/2;
                // IE, Edge, and Safari do not seem to support
                // dominant-baseline: central although they say they do
                if(isIe() || isSafari())
                    first += 0.3;
                return lines.map((line, i) => ({node: n, line, yofs: `${i==0 ? first : lineHeight  }em`}));
            });
            const tspanEnter = tspan.enter().append('tspan');
            tspan = tspan.merge(tspanEnter);
            tspan
                .attr('text-anchor', 'start')
                .attr('text-decoration', (line) => _contents.parent().nodeLabelDecoration.eval(line.node))
                .attr('x', 0)
                .html((s) => s.line);
            text
                .each((n) => {
                    n.xofs = 0;
                })
                .filter((n) => _contents.parent().nodeLabelAlignment.eval(n) !== 'center')
                .each(function(n) {
                    const bbox = getBBoxNoThrow(this);
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
                .attr('text-anchor', (s) => {
                    switch(_contents.parent().nodeLabelAlignment.eval(s.node)) {
                    case 'left': return 'start';
                    case 'center': return 'middle';
                    case 'right': return 'end';
                    }
                    return null;
                })
                .attr('x', (s) => s.node.xofs)
                .attr('dy', (d) => d.yofs);

            tspan.exit().remove();
            text
                .attr('fill', _contents.parent().nodeLabelFill.eval);
        },
        textbox(container) {
            const bbox = getBBoxNoThrow(this.selectContent(container).node());
            return {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
        },
        selectContent(container) {
            return container.select('text.node-label');
        },
        selectText(container) {
            return this.selectContent(container);
        }
    };
    return _contents;
};

export function withIconContents(contents, width, height) {
    const _contents = {
        parent: property(null).react((parent) => {
            contents.parent(parent);
        }),
        padding(n) {
            const padding = nodeLabelPadding(_contents.parent(), n);
            return {
                x: padding.x * 3,
                y: padding.y * 3
            };
        },
        update(container) {
            let g = container.selectAll('g.with-icon')
                    .data((n) => [n]);
            const gEnter = g.enter();
            gEnter.append('g')
                .attr('class', 'with-icon')
              .append('image')
                .attr('class', 'icon')
                .attr('width', `${width  }px`)
                .attr('height', `${height  }px`);
            g = g.merge(gEnter.select('g.with-icon'));
            g.call(contents.update);
            contents.selectContent(g)
                .attr('transform',  `translate(${  width/2  })`);
            g.selectAll('image.icon')
                .attr('href', _contents.parent().nodeIcon.eval)
                .attr('x', function(n) {
                    const totwid = width + contents.textbox(select(this.parentNode)).width;
                    return -totwid/2 - nodeLabelPadding(_contents.parent(), n).x;
                })
                .attr('y', -height/2);
        },
        textbox(container) {
            const box = contents.textbox(container);
            box.x += width/2;
            return box;
        },
        selectContent(container) {
            return container.select('g.with-icon');
        },
        selectText(container) {
            return this.selectContent(container).select('text.node-label');
        }
    };
    return _contents;
};

