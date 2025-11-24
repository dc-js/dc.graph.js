import { app_layouts } from './app_layout.js';
import { alignY, gapY, orderX } from './dc-graph.js';
import { show_stepper } from './original-test-page.js';

app_layouts.qfs = {
    rules: {
        nodes: [
            {
                id: 'class',
                partition: 'class',
                typename(id, value) {
                    return value;
                },
            },
        ],
        edges: [
            {source: 'Client', target: 'Metaserver', produce: gapY(100, true)},
            {
                source: 'Client',
                target: 'Metaserver',
                reverse: true,
                produce(members) {
                    return {
                        axis: 'x',
                        gap: (members.ChunkServer.nodes.length+1)*60,
                        equality: true,
                    };
                },
            },
            {source: 'Client', target: 'ChunkServer', produce: gapY(200, true)},
            {source: 'Client', target: 'Attached Volume', produce: gapY(300, true)},
            {source: 'Metaserver', target: 'Attached Volume', produce: gapY(200, true)},
            {source: 'Metaserver', target: 'ChunkServer', produce: gapY(100, true)},
            {source: 'ChunkServer', target: 'Attached Volume', produce: gapY(100, true)},

            {source: 'ChunkServer', target: 'ChunkServer', produce: alignY()},
            {source: 'Attached Volume', target: 'Attached Volume', produce: alignY()},

            {
                source: 'ChunkServer',
                target: 'ChunkServer',
                produce: orderX(60, kv => +kv.value.label.slice(2)),
            },
            {
                source: 'Attached Volume',
                target: 'Attached Volume',
                produce: orderX(60, function(kv) {
                    if (!this.idex) // is this optimization necessary?
                        this.idex = /^Vol([0-9]+)_([A-Za-z]+)([0-9]+)$/;
                    const match = this.idex.exec(kv.value.name);
                    switch (match[2]) {
                        case 'Cl':
                            match[1] = 100;
                            break;
                        case 'MS':
                            match[1] = -100;
                            break;
                    }
                    return +match[1]*1000+(+match[3]);
                }),
            },
        ],
    },
    colors(n) {
        const colors = {
            ChunkServer: d3.rgb(152, 251, 152),
            Metaserver: d3.rgb(135, 255, 255),
            'Attached Volume': d3.rgb(255, 180, 0),
            Client: d3.rgb(150, 184, 255),
        };
        return colors[n.value.class];
    },
    node_fixed(n) {
        return n.value.class === 'Client' ? {x: 0, y: 0} : null;
    },
    initDiagram(diagram) {
        diagram.nodeLabel(n => n.value.label);
    },
    init() {
        show_stepper();
    },
};
