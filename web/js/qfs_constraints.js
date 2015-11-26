var qfs_constraint_rules = {
    nodes: [
        {id: 'Client', partition: 'class'},
        {id: 'Metaserver', partition: 'class'},
        {id: 'ChunkServer', partition: 'class'},
        {id: 'Attached Volume', partition: 'class'}
    ],
    edges: [
        {source: 'Client', target: 'Metaserver', produce: {axis: 'y', gap: 100, equality: true}},
        {source: 'Client', target: 'Metaserver', reverse: true,
         produce: function(members) {
             return {axis: 'x', gap: (members.ChunkServer.nodes.length+1)*60, equality: true};
         }},
        {source: 'Client', target: 'ChunkServer', produce: {axis: 'y', gap: 200, equality: true}},
        {source: 'Client', target: 'Attached Volume', produce: {axis: 'y', gap: 300, equality: true}},
        {source: 'Metaserver', target: 'Attached Volume', produce: {axis: 'y', gap: 200, equality: true}},
        {source: 'Metaserver', target: 'ChunkServer', produce: {axis: 'y', gap: 100, equality: true}},
        {source: 'ChunkServer', target: 'Attached Volume', produce: {axis: 'y', gap: 100, equality: true}},

        {source: 'ChunkServer', target: 'ChunkServer',
         produce: {type: 'alignment', axis: 'y'}, listname: 'offsets',
         wrap: function(x) { return {node: x, offset: 0}; }},
        {source: 'Attached Volume', target: 'Attached Volume',
         produce: {type: 'alignment', axis: 'y'}, listname: 'offsets',
         wrap: function(x) { return {node: x, offset: 0}; }},

        {source: 'ChunkServer', target: 'ChunkServer',
         produce: {type: 'ordering', axis: 'x', gap: 60,
                   ordering: function(kv) {
                       return +kv.value.label.slice(2);
                   }
                  }},
        {source: 'Attached Volume', target: 'Attached Volume',
         produce: {type: 'ordering', axis: 'x', gap: 60,
                   ordering: function(kv) {
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
                   }
                  }}
    ]
};

function qfs_edges(nodes, edges, constraints) {
    var dids = {
        CCS: 0,
        CAV: 0,
        MAV: 1,
        MCS: 0,
        CSAV: 1
    };
    function do_disp(key) {
        return !dids[key]++;
    }
    var num_chunks = nodes.filter(function(n) { return n.orig.value.class === 'ChunkServer'; }).length;
    edges.forEach(function(e) {
        var s = e.source, t = e.target;
        if(s.orig.value.class === 'Client' && t.orig.value.class === 'Metaserver') {
            // vertical displacement for Client/Metaserver
            constraints.push({
                left: e.source.orig.key,
                right: e.target.orig.key,
                axis: 'y',
                gap: 100,
                equality: true
            });
            // this one is just to untangle the diagram by putting metaserver left, client right
            constraints.push({
                left: e.target.orig.key,
                right: e.source.orig.key,
                axis: 'x',
                gap: (num_chunks+1)*60
            });
        }
        else if(s.orig.value.class === 'Client') {
            if(t.orig.value.class === 'ChunkServer' && do_disp('CCS'))
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 200,
                    equality: true
                });
            if(t.orig.value.class === 'Attached Volume' && do_disp('CAV'))
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 300,
                    equality: true
                });
        }
        else if(s.orig.value.class === 'Metaserver') {
            if(t.orig.value.class === 'Attached Volume' && do_disp('MAV'))
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 200,
                    equality: true
                });
            if(t.orig.value.class === 'ChunkServer' && do_disp('MCS'))
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 100,
                    equality: true
                });
        }
        else if(s.orig.value.class === 'ChunkServer' && t.orig.value.class === 'Attached Volume' && do_disp('CSAV')) {
            constraints.push({
                left: e.source.orig.key,
                right: e.target.orig.key,
                axis: 'y',
                gap: 100,
                equality: true
            });
        }
    });
    return constraints;
}

function qfs_alignment(nodes, edges, constraints) {
    //return constraints;
    // put ChunkServers and Volumes in same levels
    function level_start() {
        return {
            offsets: [],
            type: 'alignment',
            axis: 'y'
        };
    }
    var CSLevel = level_start(),
        VolLevel = level_start();
    nodes.forEach(function(n, i) {
        switch(n.orig.value.class) {
        case 'ChunkServer':
            CSLevel.offsets.push({node: n.orig.key, offset: 0});
            break;
        case 'Attached Volume':
            VolLevel.offsets.push({node: n.orig.key, offset: 0});
        }
    });
    if(CSLevel.offsets.length)
        constraints.push(CSLevel);
    if(VolLevel.offsets.length)
        constraints.push(VolLevel);
    if(1) {
        if(CSLevel.offsets.length) {
            constraints.push({
                type: 'ordering',
                nodes: CSLevel.offsets.map(function(ni) { return ni.node; }),
                axis: 'x',
                gap: 60,
                ordering: function(kv) {
                    return +kv.value.label.slice(2);
                }
            });
        }
        var idex = /^Vol([0-9]+)_([A-Za-z]+)([0-9]+)$/;
        if(VolLevel.offsets.length) {
            constraints.push({
                type: 'ordering',
                nodes: VolLevel.offsets.map(function(ni) { return ni.node; }),
                axis: 'x',
                gap: 60,
                ordering: function(kv) {
                    var match = idex.exec(kv.value.name);
                    switch(match[2]) {
                    case 'Cl':
                        match[1] = 100;
                        break;
                    case 'MS':
                        match[1] = -100;
                        break;
                    };
                    return +match[1]*1000 + +match[3];
                }
            });
        }
    }
    return constraints;
}

function qfs_color(n) {
    var colors = {
        ChunkServer: d3.rgb(152,251,152),
        Metaserver: d3.rgb(135,255,255),
        "Attached Volume": d3.rgb(255,180,0),
        Client: d3.rgb(150,184,255)
    };
    return colors[n.value.class];
}
