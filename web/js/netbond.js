var options = {
    data: {
        default: 'RoutersLocationsPorts.csv'
    },
    unconstrained: {
        default: false,
        selector: '#unconstrained',
        needs_relayout: true,
        exert: function(val, diagram) {
            diagram.flowLayout(val ? null : {axis: 'x', minSeparation: 150});
        }
    }
};


var topologyDiagram = dc_graph.diagram('#topology');
var tracker = querystring.option_tracker(options, dcgraph_domain(topologyDiagram), topologyDiagram);

function is_value(s) {
    return s && s.trim()!='N/A';
}

d3.csv(tracker.vals.data, function(error, data) {
    if(error)
        throw new Error(error);

    data = data.filter(function(r) { return !!r.zLocation; });
    var treeAttrs = ['zLocation', 'aCLLI', 'aSiteID', 'aCage', 'aRackCabinet', 'aRouter', 'aPort'];
    var nester = d3.nest();
    treeAttrs.forEach(function(a) {
        nester.key(dc.pluck(a));
    });
    var supplemented = dc_graph.convert_nest(nester.entries(data), treeAttrs, 'ID', 'sourcename', 'targetname', 'CBB');
    var CBB = {ID: 'CBB', name: 'CBB', _level: 0};
    supplemented.nodes.push(CBB);
    var topo_nodes = flat_group.make(supplemented.nodes, function(d) {
        return d.ID;
    });
    var topo_edges = flat_group.make(supplemented.edges, function(d) {
        return d.sourcename + '-' + d.targetname;
    });

    var locDim = topo_nodes.crossfilter.dimension(function(d) {
        return d.zLocation;
    });
    function include_cbb(group) {
        return {
            all: function() {
                var ret = group.all().slice(0);
                ret.push({key: 'CBB', value: CBB});
                return ret;
            }
        };
    };
    function freeze_group(group) {
        var all = group.all().map(function(kv) { return Object.assign({}, kv); });
        return {
            all: function() {
                return all;
            }
        };
    }
    var locGroup = locDim.group();
    locDim.filter('no-location');
    var select = dc.selectMenu('#select-location')
            .dimension(locDim)
            .group(freeze_group(locGroup))
            .multiple(true)
            .numberVisible(12)
            .promptText('Select location(s)')
            .promptValue('no-location');

    topologyDiagram
        .width(window.innerWidth)
        .height(window.innerHeight)
        .transitionDuration(0)
        .baseLength(20)
        .initLayoutOnRedraw(true)
        .showLayoutSteps(true)
        .nodeDimension(topo_nodes.dimension).nodeGroup(include_cbb(topo_nodes.group))
        .edgeDimension(topo_edges.dimension).edgeGroup(topo_edges.group)
        .nodeShape({shape: 'rectangle'})
        .nodeLabel(function(d) {
            return d.value.name || d.value.aConnectionID || d.value.aSiteCalc;
        });

    function child_edges(nk) {
        return supplemented.edges.filter(function(kv) {
            return kv.sourcename === nk;
        });
    }

    // here's where you start to want a real graph ADT
    // not that the slowness matters yet...
    function child_tree_nodes(nk) {
        var es = child_edges(nk), tn = es.map(function(e) {
            return e.targetname;
        });
        return Array.prototype.concat.apply(tn, tn.map(child_tree_nodes));
    }

    var colspand = topo_nodes.crossfilter.dimension(function(d) {
        return d._level + '/' + d.ID;
    });

    var level = +d3.select('#level').node().value, xpand = [];

    var expand = dc_graph.expand_collapse(function(nk) { // degree
        return 1 + child_edges(nk).length; // 1 parent, children
    }, function(nk) { // expand
        var es = child_edges(nk);
        Array.prototype.push.apply(xpand, es.map(function(e) {
            return e.targetname;
        }));
        colspand.filterFunction(expandf);
        dc.redrawAll();
    }, function(nk) { // collapse
        var tree = child_tree_nodes(nk);
        // slow n^2
        xpand = xpand.filter(function(nk) { return tree.indexOf(nk)<0; });
        colspand.filterFunction(expandf);
        dc.redrawAll();
    });

    function expandf(d) {
        d = d.split('/');
        return +d[0] <= level || xpand.indexOf(d[1]) >= 0;
    }

    colspand.filterFunction(expandf);

    topologyDiagram.child('expand-collapse', expand);

    d3.select('#level').on('change', function() {
        level = +this.value;
        colspand.filterFunction(expandf);
        dc.redrawAll();
    });

    // respond to browser resize (not necessary if width/height is static)
    d3.select(window).on('resize', function() {
        topologyDiagram
            .width(window.innerWidth)
            .height(window.innerHeight);
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

    tracker.exert();

    dc.renderAll();
});
