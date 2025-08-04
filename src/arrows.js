import { angleBetweenPoints, asBezier3, chopBezier } from './shape.js';
import { generatePath } from './utils.js';

const offsetx = ofsx => p => ({x: p.x+ofsx, y: p.y});

export const builtinArrows = {
    box: (open, side) => {
        if (!open)
            return {
                frontRef: [8, 0],
                drawFunction: (marker, ofs, stemWidth) => {
                    marker.append('rect')
                        .attr('x', ofs[0])
                        .attr('y', side === 'right' ? -stemWidth/2 : -4)
                        .attr('width', 8)
                        .attr('height', side ? 4+stemWidth/2 : 8)
                        .attr('stroke-width', 0);
                },
            };
        else return {
                frontRef: [8, 0],
                drawFunction: (marker, ofs, stemWidth) => {
                    marker.append('rect')
                        .attr('x', ofs[0]+0.5)
                        .attr('y', side === 'right' ? 0 : -3.5)
                        .attr('width', 7)
                        .attr('height', side ? 3.5 : 7)
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side)
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h', 8].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                },
            };
    },
    curve: (open, side) => ({
        stems: [true, false],
        kernstems: [0, 0.25],
        frontRef: [8, 0],
        drawFunction: (marker, ofs, stemWidth) => {
            const instrs = [];
            instrs.push(
                'M',
                (side === 'left' ? 7.5 : 4)+ofs[0],
                side === 'left' ? stemWidth/2 : 3.5,
            );
            if (side === 'left')
                instrs.push('v', -stemWidth/2);
            instrs.push(
                'A',
                3.5,
                3.5,
                0,
                0,
                0,
                (side === 'right' ? 7.5 : 4)+ofs[0],
                side === 'right' ? 0 : -3.5,
            );
            if (side === 'right')
                instrs.push('v', -stemWidth/2);
            marker.append('svg:path')
                .attr('d', instrs.join(' '))
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            marker.append('svg:path')
                .attr('d', ['M', 7+ofs[0], 0, 'h  -7'].join(' '))
                .attr('stroke-width', stemWidth)
                .attr('fill', 'none');
        },
    }),
    icurve: (open, side) => ({
        stems: [false, true],
        kernstems: [0.25, 0],
        frontRef: [8, 0],
        drawFunction: (marker, ofs, stemWidth) => {
            const instrs = [];
            instrs.push(
                'M',
                (side === 'left' ? 0.5 : 4)+ofs[0],
                side === 'left' ? stemWidth/2 : 3.5,
            );
            if (side === 'left')
                instrs.push('v', -stemWidth/2);
            instrs.push(
                'A',
                3.5,
                3.5,
                0,
                0,
                1,
                (side === 'right' ? 0.5 : 4)+ofs[0],
                side === 'right' ? 0 : -3.5,
            );
            if (side === 'right')
                instrs.push('v', -stemWidth/2);
            marker.append('svg:path')
                .attr('d', instrs.join(' '))
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            marker.append('svg:path')
                .attr('d', ['M', 1+ofs[0], 0, 'h 7'].join(' '))
                .attr('stroke-width', stemWidth)
                .attr('fill', 'none');
        },
    }),
    diamond: (open, side) => {
        if (!open)
            return {
                frontRef: [side ? 11.25 : 12, 0],
                backRef: [side ? 0.75 : 0, 0],
                viewBox: [0, -4, 12, 8],
                stems: [!!side, !!side],
                kernstems: stemWidth => [side ? 0 : .75*stemWidth, side ? 0 : .75*stemWidth],
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [{x: 0, y: 0}];
                    if (side !== 'left')
                        upoints.push({x: 6, y: 4});
                    else
                        upoints.push({x: 6, y: -4});
                    upoints.push({x: 12, y: 0});
                    if (!side)
                        upoints.push({x: 6, y: -4});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, true))
                        .attr('stroke-width', 0);
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', 0.75+ofs[0], 0, 'h 10.5'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
        else return {
                frontRef: [side ? 11.25 : 12, 0],
                backRef: [side ? 0.75 : 0, 0],
                viewBox: [0, -4, 12, 8],
                stems: [!!side, !!side],
                kernstems: stemWidth => [side ? 0 : .75*stemWidth, side ? 0 : .75*stemWidth],
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [{x: 0.9, y: 0}];
                    if (side !== 'left')
                        upoints.push({x: 6, y: 3.4});
                    else
                        upoints.push({x: 6, y: -3.4});
                    upoints.push({x: 11.1, y: 0});
                    if (!side)
                        upoints.push({x: 6, y: -3.4});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, !side))
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', 0.75+ofs[0], 0, 'h 10.5'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
    },
    dot(open, side) {
        if (!open)
            return {
                frontRef: [8, 0],
                stems: [!!side, !!side],
                drawFunction: (marker, ofs, stemWidth) => {
                    if (side) {
                        marker.append('svg:path')
                            .attr(
                                'd',
                                [
                                    'M',
                                    ofs[0],
                                    0,
                                    'A',
                                    4,
                                    4,
                                    0,
                                    0,
                                    side === 'left' ? 1 : 0,
                                    8+ofs[0],
                                    0,
                                ].join(' '),
                            )
                            .attr('stroke-width', 0);
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h 8'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    } else {
                        marker.append('svg:circle')
                            .attr('r', 4)
                            .attr('cx', 4+ofs[0])
                            .attr('cy', 0)
                            .attr('stroke-width', '0px');
                    }
                },
            };
        else return {
                frontRef: [8, 0],
                stems: [!!side, !!side],
                drawFunction: (marker, ofs, stemWidth) => {
                    if (side) {
                        marker.append('svg:path')
                            .attr(
                                'd',
                                [
                                    'M',
                                    0.5+ofs[0],
                                    0,
                                    'A',
                                    3.5,
                                    3.5,
                                    0,
                                    0,
                                    side === 'left' ? 1 : 0,
                                    7.5+ofs[0],
                                    0,
                                ].join(' '),
                            )
                            .attr('stroke-width', 1)
                            .attr('fill', 'none');
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h 8'].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    } else {
                        marker.append('svg:circle')
                            .attr('r', 3.5)
                            .attr('cx', 4+ofs[0])
                            .attr('cy', 0)
                            .attr('fill', 'none')
                            .attr('stroke-width', '1px');
                    }
                },
            };
    },
    normal(open, side) {
        if (!open)
            return {
                frontRef: [side ? 8-4/3 : 8, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [0, stemWidth*4/3];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [];
                    if (side === 'left')
                        upoints.push({x: 0, y: 0});
                    else
                        upoints.push({x: 0, y: 3});
                    switch (side) {
                        case 'left':
                            upoints.push({x: 8-stemWidth*4/3, y: -stemWidth/2});
                            break;
                        case 'right':
                            upoints.push({x: 8-stemWidth*4/3, y: stemWidth/2});
                            break;
                        default:
                            upoints.push({x: 8, y: 0});
                    }
                    if (side === 'right')
                        upoints.push({x: 0, y: 0});
                    else
                        upoints.push({x: 0, y: -3});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, true))
                        .attr('stroke-width', '0px');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h', 8-4*stemWidth/3].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
        else return {
                frontRef: [side ? 8-4/3 : 8, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [0, stemWidth*4/3];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    let upoints = [];
                    if (!side) {
                        upoints = [
                            {x: 0.5, y: 2.28},
                            {x: 6.57, y: 0},
                            {x: 0.5, y: -2.28},
                        ];
                    } else {
                        upoints = [
                            {x: 0.5, y: 0},
                            {x: 0.5, y: side === 'left' ? -2.28 : 2.28},
                            {x: 8-4/3, y: 0},
                        ];
                    }
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, !side))
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', ofs[0], 0, 'h', 8-4/3].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
    },
    inv(open, side) {
        if (!open)
            return {
                frontRef: [8, 0],
                backRef: [side ? 4/3 : 0, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [stemWidth*4/3, 0];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    const upoints = [];
                    if (side === 'left')
                        upoints.push({x: 8, y: 0});
                    else
                        upoints.push({x: 8, y: 3});
                    switch (side) {
                        case 'left':
                            upoints.push({x: stemWidth*4/3, y: -stemWidth/2});
                            break;
                        case 'right':
                            upoints.push({x: stemWidth*4/3, y: stemWidth/2});
                            break;
                        default:
                            upoints.push({x: 0, y: 0});
                    }
                    if (side === 'right')
                        upoints.push({x: 8, y: 0});
                    else
                        upoints.push({x: 8, y: -3});
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, true))
                        .attr('stroke-width', '0px');
                    if (side) {
                        marker.append('svg:path')
                            .attr(
                                'd',
                                ['M', 4*stemWidth/3+ofs[0], 0, 'h', 8-4*stemWidth/3].join(' '),
                            )
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
        else return {
                frontRef: [8, 0],
                backRef: [side ? 4/3 : 0, 0],
                viewBox: [0, -3, 8, 6],
                kernstems(stemWidth) {
                    return [stemWidth*4/3, 0];
                },
                drawFunction: (marker, ofs, stemWidth) => {
                    let upoints = [];
                    if (!side) {
                        upoints = [
                            {x: 7.5, y: 2.28},
                            {x: 1.43, y: 0},
                            {x: 7.5, y: -2.28},
                        ];
                    } else {
                        upoints = [
                            {x: 7.5, y: 0},
                            {x: 7.5, y: side === 'left' ? -2.28 : 2.28},
                            {x: 1.43, y: 0},
                        ];
                    }
                    const points = upoints.map(offsetx(ofs[0]));
                    marker.append('svg:path')
                        .attr('d', generatePath(points, 1, !side))
                        .attr('stroke-width', 1)
                        .attr('fill', 'none');
                    if (side) {
                        marker.append('svg:path')
                            .attr('d', ['M', 4*stemWidth/3+ofs[0], 0, 'h', 8-4/3].join(' '))
                            .attr('stroke-width', stemWidth)
                            .attr('fill', 'none');
                    }
                },
            };
    },
    tee(open, side) {
        return {
            frontRef: [5, 0],
            viewBox: [0, -5, 5, 10],
            stems: [true, false],
            drawFunction: (marker, ofs, stemWidth) => {
                const b = side === 'right' ? 0 : -5,
                    t = side === 'left' ? 0 : 5;
                const points = [
                    {x: 2, y: t},
                    {x: 5, y: t},
                    {x: 5, y: b},
                    {x: 2, y: b},
                ].map(offsetx(ofs[0]));
                marker.append('svg:path')
                    .attr('d', generatePath(points, 1, true))
                    .attr('stroke-width', '0px');
                marker.append('svg:path')
                    .attr('d', ['M', ofs[0], 0, 'h', 5].join(' '))
                    .attr('stroke-width', stemWidth)
                    .attr('fill', 'none');
            },
        };
    },
    vee(open, side) {
        return {
            stems: [true, false],
            kernstems(stemWidth) {
                return [0, stemWidth];
            },
            drawFunction: (marker, ofs, stemWidth) => {
                const upoints = [
                    {x: 0, y: -5},
                    {x: 10, y: 0},
                    {x: 0, y: 5},
                    {x: 5, y: 0},
                ];
                if (side === 'right')
                    upoints.splice(0, 1, {x: 5, y: -stemWidth/2}, {x: 10, y: -stemWidth/2});
                else if (side === 'left')
                    upoints.splice(2, 1, {x: 10, y: stemWidth/2}, {x: 5, y: stemWidth/2});
                const points = upoints.map(offsetx(ofs[0]));
                marker.append('svg:path')
                    .attr('d', generatePath(points, 1, true))
                    .attr('stroke-width', '0px');
                marker.append('svg:path')
                    .attr('d', ['M', ofs[0]+5, 0, 'h', -5].join(' '))
                    .attr('stroke-width', stemWidth);
            },
        };
    },
    crow(open, side) {
        return {
            stems: [false, true],
            kernstems(stemWidth) {
                return [stemWidth, 0];
            },
            drawFunction: (marker, ofs, stemWidth) => {
                const upoints = [
                    {x: 10, y: -5},
                    {x: 0, y: 0},
                    {x: 10, y: 5},
                    {x: 5, y: 0},
                ];
                if (side === 'right')
                    upoints.splice(0, 1, {x: 5, y: -stemWidth/2}, {x: 0, y: -stemWidth/2});
                else if (side === 'left')
                    upoints.splice(2, 1, {x: 0, y: stemWidth/2}, {x: 5, y: stemWidth/2});
                const points = upoints.map(offsetx(ofs[0]));
                marker.append('svg:path')
                    .attr('d', generatePath(points, 1, true))
                    .attr('stroke-width', '0px');
                marker.append('svg:path')
                    .attr('d', ['M', ofs[0]+5, 0, 'h', 5].join(' '))
                    .attr('stroke-width', stemWidth);
            },
        };
    },
};

function arrowDef(arrdefs, shape, open, side) {
    return arrdefs[shape](open, side);
}

export function arrowParts(arrdefs, desc) {
    // graphviz appears to use a real parser for this
    const parts = [];
    while (desc && desc.length) {
        let mods = /^o?(?:l|r)?/.exec(desc);
        let open = false, side = null;
        if (mods[0]) {
            mods = mods[0];
            desc = desc.slice(mods.length);
            open = mods[0] === 'o';
            switch (mods[mods.length-1]) {
                case 'l':
                    side = 'left';
                    break;
                case 'r':
                    side = 'right';
            }
        }
        let ok = false;
        for (const aname in arrdefs)
            if (desc.substring(0, aname.length) === aname) {
                ok = true;
                parts.push(arrowDef(arrdefs, aname, open, side));
                desc = desc.slice(aname.length);
                break;
            }
        if (!ok) {
            console.warn(`couldn't find arrow name in ${desc}`);
            break;
        }
    }
    return parts;
}

function unionViewbox(vb1, vb2) {
    const left = Math.min(vb1[0], vb2[0]),
        bottom = Math.min(vb1[1], vb2[1]),
        right = Math.max(vb1[0]+vb1[2], vb2[0]+vb2[2]),
        top = Math.max(vb1[1]+vb1[3], vb2[1]+vb2[3]);
    return [left, bottom, right-left, top-bottom];
}

function subtractPoints(p1, p2) {
    return [p1[0]-p2[0], p1[1]-p2[1]];
}

export function addPoints(p1, p2) {
    return [p1[0]+p2[0], p1[1]+p2[1]];
}

export function multPoint(p, s) {
    return p.map(x => x*s);
}

function defaulted(def) {
    return function(x) {
        return x || def;
    };
}

const view_box = defaulted([0, -5, 10, 10]),
    front_ref = defaulted([10, 0]),
    back_ref = defaulted([0, 0]);

export function arrowOffsets(parts, stemWidth) {
    return parts.map((p, i) => {
        const fr = front_ref(p.frontRef).slice(),
            br = back_ref(p.backRef).slice();
        if (p.kernstems) {
            let kernstems = p.kernstems;
            if (typeof kernstems === 'function')
                kernstems = kernstems(stemWidth);
            if (i !== 0 && kernstems[1]) {
                const last = parts[i-1];
                if (last.stems && last.stems[0])
                    fr[0] -= kernstems[1];
            }
            if (kernstems[0]) {
                let kern = false;
                if (i === parts.length-1)
                    kern = true;
                else {
                    const next = parts[i+1];
                    if (next.stems && next.stems[1])
                        kern = true;
                }
                if (kern)
                    br[0] += kernstems[0];
            }
        }
        if (i === 0) {
            const backRef = br;
            return {backRef, offset: [0, 0]};
        } else {
            let backRef = br;
            const ofs = subtractPoints(backRef, fr);
            backRef = addPoints(br, ofs);
            return {backRef, offset: ofs};
        }
    });
}

function arrowBounds(parts, stemWidth) {
    let viewBox = null;
    const offsets = arrowOffsets(parts, stemWidth);
    parts.forEach((p, i) => {
        const vb = view_box(p.viewBox);
        const ofs = offsets[i].offset;
        if (!viewBox)
            viewBox = vb.slice();
        else
            viewBox = unionViewbox(viewBox, [vb[0]+ofs[0], vb[1]+ofs[1], vb[2], vb[3]]);
    });
    return {offsets, viewBox};
}

function arrowLength(parts, stemWidth) {
    if (!parts.length)
        return 0;
    const offsets = arrowOffsets(parts, stemWidth);
    return front_ref(parts[0].frontRef)[0]-offsets[parts.length-1].backRef[0];
}

export function scaledArrowLengths(diagram, e) {
    const arrowSize = diagram.edgeArrowSize.eval(e),
        stemWidth = diagram.edgeStrokeWidth.eval(e)/arrowSize;
    const headLength = arrowSize
            *(arrowLength(arrowParts(diagram.arrows(), diagram.edgeArrowhead.eval(e)), stemWidth)
                +diagram.nodeStrokeWidth.eval(e.target)/2),
        tailLength = arrowSize
            *(arrowLength(arrowParts(diagram.arrows(), diagram.edgeArrowtail.eval(e)), stemWidth)
                +diagram.nodeStrokeWidth.eval(e.source)/2);
    return {headLength, tailLength};
}

export function clipPathToArrows(headLength, tailLength, path) {
    const points0 = asBezier3(path),
        points = chopBezier(points0, 'head', headLength);
    return {
        bezDegree: 3,
        points: chopBezier(points, 'tail', tailLength),
        sourcePort: path.sourcePort,
        targetPort: path.targetPort,
    };
}

export function placeArrowsOnSpline(diagram, e, points) {
    const alengths = scaledArrowLengths(diagram, e);
    const path0 = {
        points,
        bezDegree: 3,
    };
    const path = clipPathToArrows(alengths.headLength, alengths.tailLength, path0);
    return {
        path,
        full: path0,
        orienthead: `${
            angleBetweenPoints(
                path.points[path.points.length-1],
                path0.points[path0.points.length-1],
            )
        }rad`, // calculate_arrowhead_orientation(e.cola.points, 'head'),
        orienttail: `${angleBetweenPoints(path.points[0], path0.points[0])}rad`, // calculate_arrowhead_orientation(e.cola.points, 'tail')
    };
}

// determine pre-transition orientation that won't spin a lot going to new orientation
export function unsurprisingOrient(oldorient, neworient) {
    let oldang = +oldorient.slice(0, -3);
    const newang = +neworient.slice(0, -3);
    if (Math.abs(oldang-newang) > Math.PI) {
        if (newang > oldang)
            oldang += 2*Math.PI;
        else oldang -= 2*Math.PI;
    }
    return oldang;
}

export function edgeArrow(diagram, arrdefs, e, kind, desc) {
    const id = diagram.arrowId(e, kind);
    let strokeOfs, edgeStroke;
    function arrow_sig() {
        return `${desc}-${strokeOfs}-${edgeStroke}`;
    }
    if (desc) {
        strokeOfs = diagram.nodeStrokeWidth.eval(kind === 'tail' ? e.source : e.target)/2;
        edgeStroke = diagram.edgeStroke.eval(e);
        if (e[`${kind}ArrowLast`] === arrow_sig())
            return id;
    }
    const parts = arrowParts(arrdefs, desc),
        marker = diagram.addOrRemoveDef(id, !!parts.length, 'svg:marker');

    if (parts.length) {
        const arrowSize = diagram.edgeArrowSize.eval(e),
            stemWidth = diagram.edgeStrokeWidth.eval(e)/arrowSize,
            bounds = arrowBounds(parts, stemWidth),
            frontRef = front_ref(parts[0].frontRef);
        bounds.viewBox[0] -= strokeOfs/arrowSize;
        bounds.viewBox[3] += strokeOfs/arrowSize;
        marker
            .attr('viewBox', bounds.viewBox.join(' '))
            .attr('refX', frontRef[0])
            .attr('refY', frontRef[1])
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', bounds.viewBox[2]*arrowSize)
            .attr('markerHeight', bounds.viewBox[3]*arrowSize)
            .attr('stroke', edgeStroke)
            .attr('fill', edgeStroke);
        marker.html(null);
        parts.forEach((p, i) => {
            marker
                .call(
                    p.drawFunction,
                    addPoints([-strokeOfs/arrowSize, 0], bounds.offsets[i].offset),
                    stemWidth,
                );
        });
    }
    e[`${kind}ArrowLast`] = arrow_sig();
    return desc ? id : null;
}
