var qfs_constraint_rules = {
    nodes: [
        {id: 'Client', partition: 'class'},
        {id: 'Metaserver', partition: 'class'},
        {id: 'ChunkServer', partition: 'class'},
        {id: 'Attached Volume', partition: 'class'}
    ],
    edges: [
        {source: 'Client', target: 'Metaserver', produce: dc_graph.gap_y(100, true)},
        {source: 'Client', target: 'Metaserver',
         reverse: true,
         produce: function(members) {
             return {
                 axis: 'x',
                 gap: (members.ChunkServer.nodes.length+1)*60,
                 equality: true
             };
         }},
        {source: 'Client', target: 'ChunkServer', produce: dc_graph.gap_y(200, true)},
        {source: 'Client', target: 'Attached Volume', produce: dc_graph.gap_y(300, true)},
        {source: 'Metaserver', target: 'Attached Volume', produce: dc_graph.gap_y(200, true)},
        {source: 'Metaserver', target: 'ChunkServer', produce: dc_graph.gap_y(100, true)},
        {source: 'ChunkServer', target: 'Attached Volume', produce: dc_graph.gap_y(100, true)},

        {source: 'ChunkServer', target: 'ChunkServer', produce: dc_graph.align_y()},
        {source: 'Attached Volume', target: 'Attached Volume', produce: dc_graph.align_y()},

        {source: 'ChunkServer', target: 'ChunkServer',
         produce: dc_graph.order_x(60, function(kv) {
            return +kv.value.label.slice(2);
         })
        },
        {source: 'Attached Volume', target: 'Attached Volume',
         produce: dc_graph.order_x(60, function(kv) {
             if(!this.idex) // is this optimization necessary?
                 this.idex = /^Vol([0-9]+)_([A-Za-z]+)([0-9]+)$/;
             var match = this.idex.exec(kv.value.name);
             switch(match[2]) {
             case 'Cl':
                 match[1] = 100;
                 break;
             case 'MS':
                 match[1] = -100;
                 break;
             };
             return +match[1]*1000 + +match[3];
         })
        }
    ]
};

function qfs_color(n) {
    var colors = {
        ChunkServer: d3.rgb(152,251,152),
        Metaserver: d3.rgb(135,255,255),
        "Attached Volume": d3.rgb(255,180,0),
        Client: d3.rgb(150,184,255)
    };
    return colors[n.value.class];
}
