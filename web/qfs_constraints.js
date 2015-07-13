function qfs_edges(nodes, edges, constraints) {
    edges.forEach(function(e) {
        var s = nodes[e.source], t = nodes[e.target];
        if(s.orig.value.class === 'Client' && t.orig.value.class === 'Metaserver') {
            // vertical displacement for Client/Metaserver
            constraints.push({
                left: e.source,
                right: e.target,
                axis: 'y',
                gap: 50
            });
            // this one is just to untangle the diagram by putting metaserver left, client right
            constraints.push({
                left: e.target,
                right: e.source,
                axis: 'x',
                gap: 200
            });
        }
        else if(s.orig.value.class === 'Client' && t.orig.value.class === 'ChunkServer') {
            constraints.push({
                left: e.source,
                right: e.target,
                axis: 'y',
                gap: 50
            });
        }
        else if(s.orig.value.class === 'Metaserver' &&
                (t.orig.value.class === 'Attached Volume' || t.orig.value.class === 'ChunkServer')) {
            constraints.push({
                left: e.source,
                right: e.target,
                axis: 'y',
                gap: 100
            });
        }
        else if(s.orig.value.class === 'ChunkServer' && t.orig.value.class === 'Attached Volume') {
            constraints.push({
                left: e.source,
                right: e.target,
                axis: 'y',
                gap: 100
            });
        }
    });
    return constraints;
}

function qfs_alignment(nodes, edges, constraints) {
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
            CSLevel.offsets.push({node: i, offset: 0});
            break;
        case 'Attached Volume':
            VolLevel.offsets.push({node: i, offset: 0});
        }
    });
    if(CSLevel.offsets.length)
        constraints.push(CSLevel);
    if(VolLevel.offsets.length)
        constraints.push(VolLevel);
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
