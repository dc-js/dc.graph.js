import { range } from 'd3-array';
import { renderAll } from 'dc';
import { diagram, flatGroup, flexboxLayout } from './dc-graph.js';

const params = new URLSearchParams(window.location.search);

const parentNodes = [
    {
        id: 'flex+',
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
    },
    {
        id: 'flex+a',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        flex: 1,
    },
    {
        id: 'flex+b',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        flex: 1,
    },
];

const data = range(7).map(i => ({
    id: `flex+a,${i}`,
    label: `node a${i}`,
    alignSelf: 'stretch',
    flex: 0,
})).concat(
    range(9).map(i => ({
        id: `flex+b,${i}`,
        label: `node b${i}`,
        alignSelf: 'stretch',
        flex: 0,
    })),
);

const node_flat = flatGroup.make(parentNodes.concat(data), n => n.id),
    edge_flat = flatGroup.make([], e => e.id);

const _flexboxDiagram = diagram('#graph')
    .layoutEngine(
        flexboxLayout(null, {algo: params.get('algo') || 'yoga-layout'})
            .addressToKey(ad => `flex+${ad.join(',')}`)
            .keyToAddress(key => {
                const ads = key.split('flex+')[1];
                return ads ? ads.split(',') : [];
            }),
    )
    .width(1000).height(1000)
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group);

renderAll();
