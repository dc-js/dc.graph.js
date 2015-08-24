function qfs_edges(nodes, edges, constraints) {
    var dids = {
        CCS: 0,
        CAV: 0,
        MAV: 0,
        MCS: 0,
        CSAV: 0
    };
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
                gap: 700
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
    var chunks = nodes.filter(function(n) { return n.orig.value.class === 'ChunkServer'; });
    chunks.sort(function(a, b) {
        return +a.orig.value.label.slice(2) - +b.orig.value.label.slice(2);
    });
    chunks.forEach(function(ch, i) {
        if(i>0)
            constraints.push({
                left: chunks[i-1].orig.key,
                right: chunks[i].orig.key,
                axis: 'x',
                gap: 60
            });
    });
    var idex = /^Vol([0-9]+)_([A-Za-z]+)([0-9]+)$/;
    var chunkvols = nodes.filter(function(n) { return n.orig.value.class === 'Attached Volume'; });
    chunkvols.sort(function(a, b) {
        var ma = idex.exec(a.orig.value.name), mb = idex.exec(b.orig.value.name);
        switch(ma[2]) {
        case 'Cl':
            ma[1] = 100;
            break;
        case 'MS':
            ma[1] = -100;
            break;
        };
        switch(mb[2]) {
        case 'Cl':
            mb[1] = 100;
            break;
        case 'MS':
            mb[1] = -100;
            break;
        };
        var A = +ma[1]*1000 + +ma[3], B = mb[1]*1000 + +mb[3];
        return A - B;
    });
    chunkvols.forEach(function(ch, i) {
        if(i>0)
            constraints.push({
                left: chunkvols[i-1].orig.key,
                right: chunkvols[i].orig.key,
                axis: 'x',
                gap: 60
            });
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
