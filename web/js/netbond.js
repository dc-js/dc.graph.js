var qs = querystring.parse();

function is_value(s) {
    return s && s.trim()!='N/A';
}

d3.csv(qs.data, function(error, data) {
    if(error)
        throw new Error(error);

    var port_flat = flat_group.make(data, function(d) {
            return d.ID;
        });
    var cityDim = port_flat.crossfilter.dimension(function(d) {
        return d.zLocation;
    });
    var cityGroup = cityDim.group();
    var select = dc.selectMenu('#select-location')
            .dimension(cityDim)
            .group(cityGroup)
            .promptText('Select a city');

    var edges; // lame, but we're going to initialize this each time we init nodes
    var thingsGroup = {
        all: function() {
            var ports = port_flat.group.all();
            var things = [];
            edges = [];
            things.push({
                key: 'CBB',
                value: {
                    name: 'CBB'
                }
            });
            var cages = {}, racks = {};
            ports.forEach(function(kv) {
                var tail = 'CBB';
                if(is_value(kv.value.aCage)) {
                    var cage = 'cage-' + kv.value.aCage;
                    if(!cages[kv.value.aCage]) {
                        things.push({
                            key: cage,
                            value: {
                                name: kv.value.aCage
                            }
                        });
                        edges.push({
                            key: tail + '-' + kv.value.aCage,
                            value: {
                                sourcename: tail,
                                targetname: cage
                            }
                        });
                        cages[kv.value.aCage] = true;
                    }
                    tail = cage;
                }
                if(is_value(kv.value.aRackCabinet)) {
                    var rack = 'rack-' + kv.value.aRackCabinet;
                    if(!racks[kv.value.aRackCabinet]) {
                        things.push({
                            key: rack,
                            value: {
                                name: kv.value.aRackCabinet
                            }
                        });
                        edges.push({
                            key: tail + '-' + kv.value.aRackCabinet,
                            value: {
                                sourcename: tail,
                                targetname: rack
                            }
                        });
                        racks[kv.value.aRackCabinet] = true;
                    }
                    tail = rack;
                }
                things.push(kv);
                edges.push({
                    key: kv.key,
                    value: {
                        sourcename: tail,
                        targetname: kv.key
                    }
                });
            });
            return things;
        }
    };
    var edgeGroup = {
        all: function() {
            return edges;
        }
    };

    var topologyDiagram = dc_graph.diagram('#topology');
    topologyDiagram
        .width(1000)
        .height(1000)
        .transitionDuration(250)
        .baseLength(20)
        .showLayoutSteps(true)
        .nodeDimension(port_flat.dimension).nodeGroup(thingsGroup)
        .edgeDimension(null).edgeGroup(edgeGroup)
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
