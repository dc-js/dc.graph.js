function qfs_edges(nodes, edges, constraints) {
    var dids = {
        CCS: 0,
        CAV: 0,
        MAV: 0,
        MCS: 0,
        CSAV: 0
    };
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
            if(t.orig.value.class === 'ChunkServer' && !dids.CCS++)
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 200,
                    equality: true
                });
            if(t.orig.value.class === 'Attached Volume' && !dids.CAV++)
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 300,
                    equality: true
                });
        }
        else if(s.orig.value.class === 'Metaserver') {
            if(t.orig.value.class === 'Attached Volume' && !dids.MAV++)
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 200,
                    equality: true
                });
            if(t.orig.value.class === 'ChunkServer' && !dids.MCS++)
                constraints.push({
                    left: e.source.orig.key,
                    right: e.target.orig.key,
                    axis: 'y',
                    gap: 100,
                    equality: true
                });
        }
        else if(s.orig.value.class === 'ChunkServer' && t.orig.value.class === 'Attached Volume' && !dids.CSAV++) {
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
