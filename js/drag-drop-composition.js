var qs = querystring.parse();

var options = Object.assign({
    catalog: 'catalog/get.json',
    catformat: 'demo',
    solution: ''
}, qs);

// abstract away the data formats
function demo_catalog_reader(catalog) {
    return {
        models: function() {
            return catalog.components;
        },
        composites: function() {
            return catalog.solutions;
        },
        fModelId: function(model) {
            return model.name;
        },
        fModelName: function(model) {
            return model.name;
        },
        fModelCategory: function(model) {
            return model.category;
        },
        fModelUrl: function(model) {
            return model.url;
        },
        fCompositeId: function(comp) {
            return comp.name;
        },
        fTypeName: function(type) {
            return type.name;
        },
        ports: function(nid, def) {
            return def.requirements.map(r => ({nodeId: nid, portname: 'req-' + r, wild: r === 'wild', type: r === 'wild' ? null : r, bounds: inbounds})).concat(
                def.capabilities.map(r => ({nodeId: nid, portname: 'cap-' + r, wild: r === 'wild', type: r === 'wild' ? null : r, bounds: outbounds}))).concat(
                    (def.extras || []).map(x => ({nodeId: nid, portname: 'xtra-' + x, wild: x === 'wild', type: x === 'wild' ? null : x, bounds: xtrabounds})));
        }
    };
}

var catalog_readers = {
    'demo': demo_catalog_reader
};


function show_while_promise(selector, promise) {
    d3.select(selector).style('visibility', 'visible');
    promise.then(function() {
        // let it run a little longer so that it's guaranteed to show
        window.setTimeout(function() {
            d3.select(selector).style('visibility', 'hidden');
        }, 100);
    });
    return promise;
}

function json_promise(url) {
    var request = d3.json(url).get;
    return new Promise(function(resolve, reject) {
        request(function(error, data) {
            if(error)
                reject(error);
            else {
                console.log(data);
                resolve(data);
            }
        });
    });
}

function get_catalog() {
    return json_promise(options.catalog);
}

// canvas
var _diagram, _rendered = false, _drawGraphs, _solution,  _ports = [];
// save-area (needs version too)
var _currentSoln = null, _solutionName, _description, _dirty = false;
// palette
var _catalog, _components, _palette;

function set_dirty(whether) {
    _dirty = whether;
    if(whether) {
        $('#save-button')
            .removeClass('button-disabled')
            .attr('title', 'solution has changes');
    } else {
        $('#save-button')
            .addClass('button-disabled')
            .attr('title', 'solution is saved');
    }
}

//
// CANVAS
//

function redraw_promise(diagram) {
    return new Promise(function(resolve, reject) {
        diagram.on('end', function() {
            resolve();
        });
        diagram.redraw();
    });
}

var lbounds = [Math.PI*5/6, -Math.PI*5/6], rbounds = [-Math.PI/6, Math.PI/6],
    dbounds = [Math.PI/6, Math.PI*5/6], ubounds = [-Math.PI*5/6, -Math.PI/6];
var inbounds, outbounds, xtrabounds;
if(options.rankdir === 'TB') {
    inbounds = ubounds;
    outbounds = dbounds;
    xtrabounds = [Math.PI, Math.PI];
} else  {
    inbounds = lbounds;
    outbounds = rbounds;
    xtrabounds = [-Math.PI/2, -Math.PI/2];
}
function update_ports() {
    var port_flat = dc_graph.flat_group.make(_ports, d => d.nodeId + '/' + d.portname);
    _diagram
        .portDimension(port_flat.dimension).portGroup(port_flat.group);
}
var _fakeDB = {};
function display_solution(catalog, solution) {
    _diagram.child('fix-nodes')
        .clearFixes();
    _description.editable('setValue', solution.description || null);
    var types = d3.set(solution.nodes.map(n => n.type)).values();
    Promise.all(types.map(t => _components.get(t).url).map(json_promise)).then(function(defns) {
        var defn = {};
        types.forEach((t, i) => defn[t] = defns[i]);
        _ports = [];
        solution.nodes.forEach(function(n) {
            _ports = _ports.concat(catalog.ports(n.id, defn[n.type]));
        });
        var node_flat = dc_graph.flat_group.make(solution.nodes, function(d) { return d.id; }),
            edge_flat = dc_graph.flat_group.make(solution.edges, e => e.id);
        _diagram
            .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
            .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group);
        update_ports();
        _drawGraphs
            .nodeCrossfilter(node_flat.crossfilter)
            .edgeCrossfilter(edge_flat.crossfilter);
        if(!_rendered) {
            _diagram.render();
            _rendered = true;
        } else _diagram.redraw();
    });
}

//
// SAVE AREA
// & loading composite solutions
//

function load_solution(name, url) {
    if(_fakeDB[name])
        return Promise.resolve(_fakeDB[name]);
    else return json_promise(url);
}
function load_sol(name, url) {
    load_solution(name, url).then(function(solution) {
        _solution = solution;
        return display_solution(_catalog, _solution);
    });
}
function save_solution(catalog, name) {
    _diagram.child('fix-nodes').fixAllNodes();
    _solution.nodes = _drawGraphs.nodeCrossfilter().all();
    _solution.edges = _drawGraphs.edgeCrossfilter().all();
    _fakeDB[name] = _solution;
    set_dirty(false);
    if(!_.find(catalog.composites(), comp => catalog.fCompositeId(comp) === name))
        catalog.composites().push({
            name: name,
            url: null
        });
    return Promise.resolve(catalog);
}
function maybe_save_solution(catalog) {
    if(!_dirty || !confirm('Current solution is unsaved - save it now?'))
        return Promise.resolve(catalog);
    var name = _currentSoln;
    if(!name)
        name = prompt('Enter a solution name', 'Solution');
    return save_solution(catalog, name);
}

function rename_solution(catalog, oldname, newname) {
    if(_.find(catalog.composites(), comp => catalog.fCompositeId(comp) === newname))
        return Promise.reject('name already used');
    catalog.composites() = catalog.composites().map(function(soln) {
        soln = Object.assign({}, soln);
        if(catalog.fCompositeId(soln) === oldname)
            soln.name = newname;
        return soln;
    });
    if(_fakeDB[oldname]) {
        _fakeDB[newname] = _fakeDB[oldname];
        delete _fakeDB[oldname];
    }
    return Promise.resolve(catalog);
}
function delete_solution(catalog, name) {
    if(!_.find(catalog.composites(), comp => catalog.fCompositeId(comp) === name))
        return Promise.reject('solution not in catalog');
    catalog.composites() = catalog.composites().filter(
        soln => catalog.fCompositeId(soln) !== name
    );
    if(_fakeDB[name])
        delete _fakeDB[name];
    return Promise.resolve(catalog);
}

//
// PROPERTIES PANE
//

function print_value(v) {
    if(!v || ['string','number','boolean'].indexOf(typeof v) !== -1)
        return v.toString();
    else
        return JSON.stringify(v);
}
function display_properties(catalog, content) {
    var dest = d3.select('#properties-content');
    if(typeof content === 'string') { // url
        json_promise(content).then(function(content) {
            display_properties(catalog, content);
        });
    } else if(typeof content === 'object') { // json
        content = Object.assign({}, content);
        var name = catalog.fTypeName(content);
        delete content.name;
        dest.style('visibility', 'visible');
        d3.select('#selected-name')
            .text(name);
        var table = d3.select('#properties-table');
        var keys = Object.keys(content).sort();
        var rows = table.selectAll('tr.property').data(keys);
        rows.exit().remove();
        rows.enter().append('tr').attr('class', 'property');
        var cols = rows.selectAll('td').data(function(x) { return [x, print_value(content[x])]; });
        cols.enter().append('td');
        cols.text(function(x) { return x; });
    }
    else dest.style('visibility', 'hidden');
}

//
// PALETTE
//

function make_palette(selector) {
    var _dispatch = d3.dispatch('selected');
    var _categories, _keyFunction, _nameFunction;
    function sanitize_id(key) {
        return key.toLowerCase().replace(' ', '-').replace(/[.]/g, '');
    }
    function heading_id(kvs) {
        return 'heading-' + sanitize_id(kvs.key);
    }
    function collapse_id(kvs) {
        return 'collapse-' + sanitize_id(kvs.key);
    }
    function select_id(comp) {
        return 'select-' + sanitize_id(_keyFunction(comp));
    }
    function pass_through(x) {
        return [x];
    }
    function show_selection(parent, key) {
        parent.selectAll('li')
            .classed('ui-selected', function(comp2) {
                return _keyFunction(comp2) === key;
            });
    }
    function data(categories) {
        var nulls = [], i = 0;
        categories.forEach(function(c) {
            if(!c)
                nulls.push(i);
            else ++i;
        });
        categories = categories.filter(function(c) { return !!c; });
        var card = d3.select('#palette')
                .selectAll('div.card').data(categories, function(kvs) { return kvs.key; } );
        var cardEnter = card.enter().append('div')
                .attr('class', 'card');
        cardEnter.each(function() {
            var card = d3.select(this);
            if(!card.datum().noheader) {
                card = card.append('div')
                    .attr({
                        class: 'card-header',
                        role: 'tab'
                    })
                    .append('h5')
                    .attr('class', 'mb-0');
            }
            card.append('a')
                .attr({
                    class: 'collapser',
                    'data-toggle': 'collapse',
                    'data-parent': '#palette',
                    'aria-expanded': 'true'
                })
                .text(function(kvs) { return kvs.key; } );
        });
        card.selectAll('div.card-header')
            .data(pass_through)
            .attr('id', heading_id);
        card.selectAll('a.collapser')
            .data(pass_through)
            .attr({
                'href': function(kvs) {
                    return '#' + collapse_id(kvs);
                },
                'aria-controls': collapse_id
            });
        var contentEnter = cardEnter.insert('div')
                .attr({
                    class: 'collapse',
                    role: 'tabpanel'
                })
                .append('div')
                .attr('class', 'card-block');
        card.selectAll('div.collapse')
            .data(pass_through)
            .attr({
                id: collapse_id,
                'aria-labelledby': heading_id
            });
        card.exit().remove();
        d3.select('#palette hr.separator').remove();
        nulls.forEach(function(j) {
            d3.select('#palette')
                .insert('hr', 'div.card:nth-child(' + (j+1) + ')')
                .attr('class', 'separator');
        });
        $('#palette').on('hide.bs.collapse', function () {
            _palette.select(null);
        });
        contentEnter.append('ul')
            .attr('class', 'component-selection');
        var selection = card.selectAll('ul.component-selection')
                .data(pass_through);
        var components = selection.selectAll('li')
                .data(function(kvs) { return kvs.values; });
        components.enter().append('li')
            .on('mousedown', function(comp) {
                show_selection(d3.select(this.parentElement), _keyFunction(comp));
                _dispatch.selected(comp);
            });
        components
            .attr('id', select_id)
            .text(function(comp) { return _nameFunction(comp); });
        $('ul.component-selection').each(function() {
            if(d3.select(this).datum().draggable)
                $('li', this).draggable({
                    helper: "clone",
                    opacity: 0.5
                });
        });
        components.exit().remove();
    }
    var _palette = {
        data: function(categories) {
            if(!arguments.length)
                return _categories;
            _categories = categories;
            data(categories);
            return this;
        },
        keyFunction: function(keyFunction) {
            if(!arguments.length)
                return _keyFunction;
            _keyFunction = keyFunction;
            return this;
        },
        nameFunction: function(nameFunction) {
            if(!arguments.length)
                return _keyFunction;
            _nameFunction = nameFunction;
            return this;
        },
        select: function(id) {
            if(!id) {
                _dispatch.selected(null);
                d3.selectAll('ul.component-selection li.ui-selected')
                    .classed('ui-selected', false);
            } else {
                throw new Error('not implemented');
                // will need to open its drawer, apply class as in click handler
                // and then dispatch event
            }
        },
        on: function(event, callback) {
            switch(arguments.length) {
            case 0:
                throw new Error('event is not optional');
            case 1:
                return _dispatch.on(event);
            default:
                _dispatch.on(event, callback);
                return this;
            }
        }
    };
    return _palette;
}
function update_palette(catalog) {
    // throw out any models which don't have a category, to avoid "null drawer"
    var models = catalog.models().filter(catalog.fModelCategory);
    var categories = d3.nest().key(catalog.fModelCategory)
            .sortKeys(d3.ascending)
            .entries(models);
    categories.forEach(function(kvs) {
        kvs.draggable = true;
    });
    categories.unshift(null);
    categories.unshift({
        key: "Other Solutions...",
        draggable: false,
        noheader: true,
        values: catalog.composites().map(function(v) {
            v.category = 'solution';
            return v;
        }).sort(function(a,b) {
            return d3.ascending(catalog.fModelName(a), catalog.fModelName(b));
        })
    });
    _palette.data(categories);
}

https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
function hashCode(s) {
  var hash = 0, i, chr;
  if (s.length === 0) return hash;
  for (i = 0; i < s.length; i++) {
    chr   = s.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};
var _icons = [
    'iconmonstr-car-4.svg',
    'iconmonstr-flip-chart-3.svg',
    'iconmonstr-paper-plane-2.svg'
];

function hashIcon(icons) {
    return function(d) {
        var h = hashCode(_diagram.nodeKey()(d));
        return _icons[h%icons.length];
    };
}

var _ionicons = {
    AlarmGenerator: 'ion-arrow-graph-up-right.png',
    Classifier: 'ion-levels.png',
    Aggregator: 'ion-pie-graph.png',
    Predictor: 'ion-stats-bars.png'
};

//
// INITIALIZATION
//

get_catalog().then(function(catalog) {
    _catalog = catalog = catalog_readers[options.catformat](catalog);
    _components = d3.map(catalog.models(), catalog.fModelName);

    // PALETTE
    _palette = make_palette('#palette')
        .keyFunction(catalog.fModelId)
        .nameFunction(catalog.fModelName)
        .on('selected', function(comp) {
            if(!comp)
                display_properties(catalog, null);
            else if(comp.category === 'solution') {
                _solutionName.editable('setValue', _currentSoln = comp.name);
                $('#delete-button').removeClass('button-disabled');
                load_sol(comp.name, comp.url);
            }
            else
                display_properties(catalog, catalog.fModelUrl(comp));
        });
    update_palette(catalog);

    // CANVAS
    _diagram = dc_graph.diagram('#canvas');
    var layout = dc_graph.cola_layout()
            .baseLength(5)
            .groupConnected(true)
            .handleDisconnected(false)
            .unconstrainedIterations(5)
            .userConstraintIterations(5)
            .allConstraintsIterations(5)
            .flowLayout({
                axis: options.rankdir === 'TB' ? 'y' : 'x',
                minSeparation: options.rankdir === 'TB' ? function(e) {
                    return (e.source.height + e.target.height) / 2 + layout.ranksep();
                } : function(e) {
                    return (e.source.width + e.target.width) / 2 + layout.ranksep();
                }
            });

    _diagram
        .width(null)
        .height(null)
        .layoutEngine(layout)
        .timeLimit(500)
        .margins({left: 5, top: 5, right: 5, bottom: 5})
        .modKeyZoom(options.mkzoom || null)
        .transitionDuration(1000)
        .fitStrategy('align_tl')
        .restrictPan(true)
        .stageTransitions('insmod')
        .enforceEdgeDirection(options.rankdir || 'LR')
        .edgeSource(function(e) { return e.value.sourcename; })
        .edgeTarget(function(e) { return e.value.targetname; })
        .edgeArrowhead(null)
        .enforceEdgeDirection('LR')
        .edgeLabel(function(e) { return e.value.name || ''; })
        .nodeLabel(function(n) { return n.value.name || n.key; })
        .nodeLabelPadding({x: 10, y: 0})
        .nodeTitle(null)
        .nodeStrokeWidth(1)
        .nodeStroke('#777')
        .edgeStroke('#777')
        .nodeShape({shape: 'rounded-rect'})
        .nodePadding(20)
        .nodeContent('text-with-icon')
        .nodeIcon(function(d) {
            return _ionicons[d.value.type];
        })
        .nodeFixed(function(n) { return n.value.fixedPos; })
        .portNodeKey(p => p.value.nodeId)
        .portName(p => p.value.portname)
        .portBounds(p => p.value.bounds)
        .edgeSourcePortName(e => e.value.sourceport)
        .edgeTargetPortName(e => e.value.targetport);

    $(window).resize(function() {
        _diagram.width(null).height(null).redraw();
    });

    if(qs.showFixed)
        _diagram.nodeStrokeDashArray(n => n.value.fixedPos ? null : '5,5');


    _diagram.content('text-with-icon', dc_graph.with_icon_contents(dc_graph.text_contents(), 35, 35));

    _diagram.child('place-ports', dc_graph.place_ports());

    var symbolPorts = dc_graph.symbol_port_style()
        .outline(dc_graph.symbol_port_style.outline.square())
        .outlineStrokeWidth(1)
//        .portLabel(p => p.value.portname)
        .symbol(p => p.orig.value.type)
        .color(p => p.orig.value.type)
        .colorScale(d3.scale.ordinal().range(
            // colorbrewer qualitative scale
            d3.shuffle(
                ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#eebb22','#a65628','#f781bf'] // 8-class set1
                //['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666'] // 8-class dark2
            )));
    if(qs.direcports)
        symbolPorts.outline(dc_graph.symbol_port_style.outline.arrow()
                            .outie(p => p.value.bounds === outbounds));
    if(qs.lettports)
        symbolPorts
            .content(dc_graph.symbol_port_style.content.letter());
    var letterPorts = dc_graph.symbol_port_style()
        .content(dc_graph.symbol_port_style.content.letter())
        .outlineStrokeWidth(1)
        .symbol('S')
        .symbolScale(x => x)
        .color('black')
        .colorScale(null);
    _diagram
        .portStyle('symbols', symbolPorts)
        .portStyle('letters', letterPorts)
        .portStyleName(function(p) {
            return /^xtra-/.test(p.value.portname) ? 'letters' : 'symbols';
        });

    var portMatcher = dc_graph.match_ports(_diagram, symbolPorts)
            .allowParallel(qs.parallel || false);

    var wildcard = dc_graph.wildcard_ports({
        get_type: p => p.orig.value.type,
        set_type: (p, src) => p.orig.value.type = src && src.orig.value.type,
        get_wild: p => p.orig.value.wild,
        update_ports: update_ports
    });

    portMatcher.isValid(
        (sourcePort, targetPort) => wildcard.isValid(sourcePort, targetPort) &&
            sourcePort.orig.value.bounds !== xtrabounds &&
            targetPort.orig.value.bounds !== xtrabounds &&
            sourcePort.orig.value.bounds !== targetPort.orig.value.bounds);

    _drawGraphs = dc_graph.draw_graphs({
        idTag: 'id',
        sourceTag: 'sourcename',
        targetTag: 'targetname'
    })
        .clickCreatesNodes(false)
        .usePorts(symbolPorts)
        .conduct(portMatcher)
        .addEdge(function(e, sport, tport) {
            set_dirty(true);
            // reverse edge if it's going from requirement to capability
            // again, the bounds object comparison is not good.
            // maybe it would be clearer to return a new edge object.
            if(sport.orig.value.bounds === inbounds) {
                console.assert(tport.orig.value.bounds === outbounds);
                var t;
                t = sport;
                sport = tport;
                tport = t;
                t = e.sourcename;
                e.sourcename = e.targetname;
                e.targetname = t;
            }
            e.sourceport = sport.name;
            e.targetport = tport.name;
            return wildcard.copyType(e, sport, tport);
        });

    _diagram.mode('draw-graphs', _drawGraphs);

    var select_nodes = dc_graph.select_nodes({
        nodeStroke: 'orange',
        nodeStrokeWidth: 3,
        nodeLabelFill: 'orange'
    }).multipleSelect(false);
    _diagram.child('select-nodes', select_nodes);

    var select_nodes_group = dc_graph.select_things_group('select-nodes-group', 'select-nodes');
    select_nodes_group.on('set_changed.show-info', function(nodes) {
        _palette.select(null);
        if(nodes.length>1)
            throw new Error('not expecting multiple select');
        else if(nodes.length === 1) {
            select_edges_group.set_changed([]);
            select_ports_group.set_changed([]);
            var type = _diagram.getNode(nodes[0]).value.type;
            var comps = catalog.models().filter(function(comp) {
                return catalog.fModelName(comp) === type;
            });
            if(comps.length === 1)
                display_properties(catalog, catalog.fModelUrl(comps[0]));
        } else display_properties(catalog, null);
    });

    var select_edges = dc_graph.select_edges({
        edgeStroke: 'lightblue',
        edgeStrokeWidth: 3
    }).multipleSelect(false);
    _diagram.child('select-edges', select_edges);
    var select_edges_group = dc_graph.select_things_group('select-edges-group', 'select-edges');
    select_edges_group.on('set_changed.show-info', function(edges) {
        _palette.select(null);
        if(edges.length>0) {
            select_nodes_group.set_changed([]);
            select_ports_group.set_changed([]);
            var edge = _diagram.getEdge(edges[0]);
            display_properties(catalog, edge);
        } else display_properties(catalog, null);
    });

    var select_ports = dc_graph.select_ports({
        portBackgroundFill: 'orange'
        // portBackgroundStroke: 'lightblue',
        // portBackgroundStrokeWidth: 2
    }).multipleSelect(false);
    _diagram.child('select-ports', select_ports);
    var select_ports_group = dc_graph.select_things_group('select-ports-group', 'select-ports');
    select_ports_group.on('set_changed.show-info', function(ports) {
        _palette.select(null);
        if(ports.length>0) {
            select_nodes_group.set_changed([]);
            select_edges_group.set_changed([]);
            display_properties(catalog, ports[0]);
        } else display_properties(catalog, null);
    });

    var move_nodes = dc_graph.move_nodes();
    _diagram.child('move-nodes', move_nodes);

    var fix_nodes = dc_graph.fix_nodes()
            .strategy(dc_graph.fix_nodes.strategy.last_N_per_component(Infinity));
    _diagram.child('fix-nodes', fix_nodes);

    var label_nodes = dc_graph.label_nodes({
        labelTag: 'name',
        align: 'left'
    }).changeNodeLabel(function(nodeId, text) {
        var node = _diagram.getNode(nodeId);
        // execute on server first, which could reject or change text
        return Promise.resolve(text);
    });
    _diagram.child('label-nodes', label_nodes);

    var label_edges = dc_graph.label_edges({
        labelTag: 'name',
        align: 'center'
    }).changeEdgeLabel(function(edgeId, text) {
        // execute on server first, which could reject or change text
        return Promise.resolve(text);
    });
    _diagram.child('label-edges', label_edges);

    var delete_nodes = dc_graph.delete_nodes()
            .crossfilterAccessor(function(diagram) {
                return _drawGraphs.nodeCrossfilter();
            })
            .dimensionAccessor(function(diagram) {
                return _diagram.nodeDimension();
            })
            .onDelete(function(nodes) {
                // confirm with server here
                return Promise.resolve(nodes)
                    .then(function(nodes) {
                        // after the back-end has accepted the deletion, we can remove unneeded ports
                        _ports = _ports.filter(p => p.nodeId !== nodes[0]);
                        update_ports();
                        return nodes;
                    });
            });
    _diagram.child('delete-nodes', delete_nodes);

    var delete_edges = dc_graph.delete_things(select_edges_group, 'delete-edges', 'id')
            .crossfilterAccessor(function(diagram) {
                return _drawGraphs.edgeCrossfilter();
            })
            .dimensionAccessor(function(diagram) {
                return _diagram.edgeDimension();
            })
            .onDelete(function(edges) {
                // confirm with server here, promise-then pass to wildcard
                return wildcard.resetTypes(_diagram, edges);
            });
    _diagram.child('delete-edges', delete_edges);


    var operations = ['run', 'jump', 'talk', 'sleep'];
    var messages = ['hill', 'storm', 'furiously', 'stile', 'mile'];

    function generate_operation() {
        var op = operations[Math.floor(Math.random()*operations.length)],
            msgs = d3.range(Math.floor(Math.random()*3)).map(function() {
                return messages[Math.floor(Math.random()*messages.length)];
            });
        return op + '(' + msgs.map(function(msg) {
            return '<a href="#" class="tip-link" id="' + op + '_' + msg + '">' + msg + '</a>';
        }).join(', ') + ')';
    }

    var port_tips = dc_graph.tip()
            .delay(200)
            .clickable(true)
            .selection(dc_graph.tip.select_port())
            .content(function(d, k) {
                k(generate_operation());
            })
            .offset(function() {
                // I don't entirely understand how d3-tip is calculating position
                // this attempts to keep position fixed even though size of g.port is changing
                return [this.getBBox().height / 2 - 20, 0];
            })
            .linkCallback(function(id) {
                alert(id);
            });

    _diagram.child('port-tips', port_tips);

    var node_tips = dc_graph.tip({namespace: 'node-tips'})
            .selection(dc_graph.tip.select_node())
            .content(function(d, k) {
                k(d.orig.value && d.orig.value.type);
            });

    _diagram.child('node-tips', node_tips);

    if(qs.debug) {
        var troubleshoot = dc_graph.troubleshoot();
        _diagram.child('troubleshoot', troubleshoot);
    }

    if(qs.validate) {
        var validate = dc_graph.validate();
        _diagram.child('validate', validate);
    }

    $('#canvas').droppable({
        drop: function(event, ui) {
            set_dirty(true);
            var component = d3.select(ui.draggable[0]).datum();
            var type = catalog.fModelName(component);
            var max = 0;
            _drawGraphs.nodeCrossfilter().all().forEach(function(n) {
                var number = n.id.match(/[0-9]+$/);
                if(!number)
                    return; // currently all ids will be type + number
                number = number[0];
                var type2 = n.id.slice(0, -number.length);
                if(type2 === type && +number > max)
                    max = +number;
            });
            var data = {
                id: type + (max+1),
                type: type
            };
            var bound = _diagram.root().node().getBoundingClientRect();
            var pos = _diagram.invertCoord([event.clientX - bound.left,
                                            event.clientY - bound.top]);
            json_promise(catalog.fModelUrl(_components.get(type))).then(function(def) {
                _ports = _ports.concat(catalog.ports(data.id, def));
                update_ports();
                _drawGraphs.createNode(pos, data);
            });
        }
    });

    // SAVE AREA
    $.fn.editable.defaults.mode = 'inline';
    _solutionName = $('#solution-name').editable({
        emptytext: '(untitled)',
        success: function(response, value) {
            var promise = Promise.resolve(catalog);
            if(_currentSoln) {
                promise = save_solution(catalog, _currentSoln).then(function(cat2) {
                    return rename_solution(cat2, _currentSoln, value);
                });
            } else {
                promise = save_solution(catalog, value);
            }
            promise.then(function(cat3) {
                catalog = cat3;
                update_palette(catalog);
                _currentSoln = value;
                $('#delete-button').removeClass('button-disabled');
            });
        }
    });
    _description = $('#description').editable({
        emptytext: '(no description)',
        success: function(response, value) {
            set_dirty(true);
            _solution.description = value;
        }
    });

    $('#new-button').click(function() {
        maybe_save_solution(catalog).then(function(cat2) {
            catalog = cat2;
            update_palette(catalog);
            _currentSoln = null;
            $('#delete-button').addClass('button-disabled');
            _solution = {nodes: [], edges: []};
            display_solution(catalog, _solution);
        });
    });
    $('#save-button').click(function() {
        if(_dirty) {
            if(!_currentSoln) {
                _currentSoln = prompt('Enter a solution name', 'Solution');
                $('#delete-button').removeClass('button-disabled');
            }
            save_solution(catalog, _currentSoln)
                .then(function(cat2) {
                    catalog = cat2;
                    update_palette(catalog);
                });
        }
    });
    $('#delete-button').click(function() {
        if(_currentSoln && confirm('Really delete solution "' + _currentSoln + '"?'))
            delete_solution(catalog, _currentSoln).then(function(cat2) {
                catalog = cat2;
                update_palette(catalog);
            });
    });

    // load initial composite solution
    var catsol;
    if(options.solution)
        catsol = catalog.composites().find(sol => sol.name === options.solution);
    if(catsol)
        load_sol(catsol.name, catsol.url);
    else {
        _solution = {nodes: [], edges: []};
        display_solution(catalog, _solution);
    }
});
