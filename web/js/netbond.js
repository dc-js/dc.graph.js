var qs = querystring.parse();

function is_value(s) {
    return s && s.trim()!='N/A';
}

d3.csv(qs.data, function(error, data) {
    if(error)
        throw new Error(error);

    var treeAttrs = ['zLocation', 'aCLLI', 'aSiteID', 'aCage', 'aRackCabinet', 'aRouter', 'aPort'];
    var nester = d3.nest();
    treeAttrs.forEach(function(a) {
        nester.key(dc.pluck(a));
    });
    var supplimented = dc_graph.convert_nest(nester.entries(data), treeAttrs, 'ID', 'sourcename', 'targetname', 'CBB');
    supplimented.nodes.push({ID: 'CBB', name: 'CBB'});
    var topo_nodes = flat_group.make(supplimented.nodes, function(d) {
        return d.ID;
    });
    var topo_edges = flat_group.make(supplimented.edges, function(d) {
        return d.sourcename + '-' + d.targetname;
    });

    var locDim = topo_nodes.crossfilter.dimension(function(d) {
        return d.zLocation;
    });
    var locGroup = locDim.group();
    locDim.filter('no-location');
    var select = dc.selectMenu('#select-location')
            .dimension(locDim)
            .group(locGroup)
            .multiple(true)
            .size(12)
            .promptText('Select location(s)')
            .promptValue('no-location');

    var topologyDiagram = dc_graph.diagram('#topology');
    topologyDiagram
        .width(1000)
        .height(1000)
        .transitionDuration(250)
        .baseLength(20)
        .initLayoutOnRedraw(true)
        .showLayoutSteps(true)
        .nodeDimension(topo_nodes.dimension).nodeGroup(topo_nodes.group)
        .edgeDimension(topo_edges.dimension).edgeGroup(topo_edges.group)
        .flowLayout({axis: 'x', minSeparation: 150})
        .nodeShape({shape: 'rectangle'})
        .nodeLabel(function(d) {
            return d.value.name || d.value.aConnectionID || d.value.aSiteCalc;
        });

    var tip = dc_graph.tip();
    var table = dc_graph.tip.table();
    // table
    //     .filter(function(k) {
    //         return k==='label_' || !(/^_/.test(k) || /_$/.test(k));
    //     });
    tip
        .direction('e')
        .content(table)
        .delay(500);

    topologyDiagram.child('tip', tip);

    dc.renderAll();
});
