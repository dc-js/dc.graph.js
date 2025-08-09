import { ascending, range, shuffle } from 'd3-array';
import { map, nest, set } from 'd3-collection';
import { dispatch } from 'd3-dispatch';
import { json, text } from 'd3-fetch';
import { scaleOrdinal } from 'd3-scale';
import { select, selectAll } from 'd3-selection';
import querystring from 'querystring';
import {
    deleteNodes,
    deleteThings,
    diagram,
    drawGraphs,
    fixNodes,
    flatGroup,
    labelEdges,
    labelNodes,
    matchPorts,
    moveNodes,
    placePorts,
    selectEdges,
    selectNode,
    selectNodes,
    selectPort,
    selectPorts,
    selectThingsGroup,
    spawnEngine,
    symbolPortStyle,
    textContents,
    tip,
    troubleshoot,
    validate,
    wildcardPorts,
    withIconContents,
} from './dc-graph.js';

const qs = querystring.parse();

const options = Object.assign({
    catalog: 'catalog/get.json',
    catformat: 'demo',
    solution: '',
}, qs);

// abstract away the data formats
function demo_catalog_reader(catalog) {
    return {
        models() {
            return catalog.components;
        },
        composites() {
            if (arguments.length) {
                catalog.solutions = arguments[0];
                return this;
            }
            return catalog.solutions;
        },
        fModelId(model) {
            return model.name;
        },
        fModelName(model) {
            return model.name;
        },
        fModelCategory(model) {
            return model.category;
        },
        fModelUrl(model) {
            return model.url;
        },
        fCompositeId(comp) {
            return comp.name;
        },
        fTypeName(type) {
            return type.name;
        },
        ports: function ports(nid, def) {
            return def.requirements.map(r => ({
                nodeId: nid,
                portname: `req-${r}`,
                wild: r === 'wild',
                type: r === 'wild' ? null : r,
                bounds: inbounds,
            })).concat(def.capabilities.map(r => ({
                nodeId: nid,
                portname: `cap-${r}`,
                wild: r === 'wild',
                type: r === 'wild' ? null : r,
                bounds: outbounds,
            }))).concat((def.extras || []).map(x => ({
                nodeId: nid,
                portname: `xtra-${x}`,
                wild: x === 'wild',
                type: x === 'wild' ? null : x,
                bounds: xtrabounds,
            })));
        },
    };
}

const catalog_readers = {
    'demo': demo_catalog_reader,
};

function show_while_promise(selector, promise) {
    select(selector).style('visibility', 'visible');
    promise.then(() => {
        // let it run a little longer so that it's guaranteed to show
        window.setTimeout(() => {
            select(selector).style('visibility', 'hidden');
        }, 100);
    });
    return promise;
}

function get_catalog() {
    return json(options.catalog);
}

// canvas
let _compositionDiagram, _rendered = false, _drawGraphs, _solution, _ports = [];
// save-area (needs version too)
let _currentSoln = null, _solutionName, _description, _dirty = false;
// palette
let _catalog, _components, _palette;

function set_dirty(whether) {
    _dirty = whether;
    if (whether) {
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
    return new Promise((resolve, reject) => {
        diagram.on('end', () => {
            resolve();
        });
        diagram.redraw();
    });
}

const lbounds = [Math.PI*5/6, -Math.PI*5/6],
    rbounds = [-Math.PI/6, Math.PI/6],
    dbounds = [Math.PI/6, Math.PI*5/6],
    ubounds = [-Math.PI*5/6, -Math.PI/6];
let inbounds, outbounds, xtrabounds;
if (options.rankdir === 'TB') {
    inbounds = ubounds;
    outbounds = dbounds;
    xtrabounds = [Math.PI, Math.PI];
} else {
    inbounds = lbounds;
    outbounds = rbounds;
    xtrabounds = [-Math.PI/2, -Math.PI/2];
}
function update_ports() {
    const port_flat = flatGroup.make(_ports, d => `${d.nodeId}/${d.portname}`);
    _compositionDiagram
        .portDimension(port_flat.dimension).portGroup(port_flat.group);
}
const _fakeDB = {};
async function display_solution(catalog, solution) {
    _compositionDiagram.child('fix-nodes')
        .clearFixes();
    _description.editable('setValue', solution.description || null);
    const types = set(solution.nodes.map(n => n.type)).values();
    Promise.all(
        types.map(t => _components.get(t).url).map(json),
    ).then(async defns => {
        const defn = {};
        types.forEach((t, i) => defn[t] = defns[i]);
        _ports = [];
        solution.nodes.forEach(n => {
            _ports = _ports.concat(catalog.ports(n.id, defn[n.type]));
        });
        const node_flat = flatGroup.make(solution.nodes, d => d.id),
            edge_flat = flatGroup.make(solution.edges, e => e.id);
        _compositionDiagram
            .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
            .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group);
        update_ports();
        _drawGraphs
            .nodeCrossfilter(node_flat.crossfilter)
            .edgeCrossfilter(edge_flat.crossfilter);
        if (!_rendered) {
            await _compositionDiagram.render();
            _rendered = true;
        } else _compositionDiagram.redraw();
    });
}

//
// SAVE AREA
// & loading composite solutions
//

function load_solution(name, url) {
    if (_fakeDB[name])
        return Promise.resolve(_fakeDB[name]);
    else return json(url);
}
function load_sol(name, url) {
    load_solution(name, url).then(solution => {
        _solution = solution;
        return display_solution(_catalog, _solution);
    });
}
function save_solution(catalog, name) {
    _compositionDiagram.child('fix-nodes').fixAllNodes();
    _solution.nodes = _drawGraphs.nodeCrossfilter().all();
    _solution.edges = _drawGraphs.edgeCrossfilter().all();
    _fakeDB[name] = _solution;
    set_dirty(false);
    if (
        !_.find(catalog.composites(), comp => catalog.fCompositeId(comp) === name)
    )
        catalog.composites().push({
            name,
            url: null,
        });
    return Promise.resolve(catalog);
}
function maybe_save_solution(catalog) {
    if (!_dirty || !confirm('Current solution is unsaved - save it now?'))
        return Promise.resolve(catalog);
    let name = _currentSoln;
    if (!name)
        name = prompt('Enter a solution name', 'Solution');
    return save_solution(catalog, name);
}

function rename_solution(catalog, oldname, newname) {
    if (
        _.find(catalog.composites(), comp => catalog.fCompositeId(comp) === newname)
    ) return Promise.reject('name already used');
    catalog.composites(
        catalog.composites().map(soln => {
            soln = Object.assign({}, soln);
            if (catalog.fCompositeId(soln) === oldname)
                soln.name = newname;
            return soln;
        }),
    );
    if (_fakeDB[oldname]) {
        _fakeDB[newname] = _fakeDB[oldname];
        delete _fakeDB[oldname];
    }
    return Promise.resolve(catalog);
}
function delete_solution(catalog, name) {
    if (
        !_.find(catalog.composites(), comp => catalog.fCompositeId(comp) === name)
    )
        return Promise.reject('solution not in catalog');
    catalog.composites(
        catalog.composites().filter(soln => catalog.fCompositeId(soln) !== name),
    );
    if (_fakeDB[name]) delete _fakeDB[name];
    return Promise.resolve(catalog);
}

//
// PROPERTIES PANE
//

function print_value(v) {
    if (!v || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1)
        return v.toString();
    else
        return JSON.stringify(v);
}
function display_properties(catalog, content) {
    const dest = select('#properties-content');
    if (typeof content === 'string') { // url
        json(content).then(content => {
            display_properties(catalog, content);
        });
    } else if (typeof content === 'object') { // json
        content = Object.assign({}, content);
        const name = catalog.fTypeName(content);
        delete content.name;
        dest.style('visibility', 'visible');
        select('#selected-name')
            .text(name);
        const table = select('#properties-table');
        const keys = Object.keys(content).sort();
        const rows = table.selectAll('tr.property').data(keys);
        rows.exit().remove();
        rows.enter().append('tr').attr('class', 'property');
        const cols = rows.selectAll('td').data(x => [x, print_value(content[x])]);
        cols.enter().append('td');
        cols.text(x => x);
    } else dest.style('visibility', 'hidden');
}

//
// PALETTE
//

function make_palette(selector) {
    const _dispatch = dispatch('selected');
    let _categories, _keyFunction, _nameFunction;
    function sanitize_id(key) {
        return key.toLowerCase().replace(' ', '-').replace(/[.]/g, '');
    }
    function heading_id(kvs) {
        return `heading-${sanitize_id(kvs.key)}`;
    }
    function collapse_id(kvs) {
        return `collapse-${sanitize_id(kvs.key)}`;
    }
    function select_id(comp) {
        return `select-${sanitize_id(_keyFunction(comp))}`;
    }
    function pass_through(x) {
        return [x];
    }
    function show_selection(parent, key) {
        parent.selectAll('li')
            .classed('ui-selected', comp2 => _keyFunction(comp2) === key);
    }
    function data(categories) {
        const nulls = [];
        let i = 0;
        categories.forEach(c => {
            if (!c)
                nulls.push(i);
            else ++i;
        });
        categories = categories.filter(c => !!c);
        let card = select('#palette')
            .selectAll('div.card').data(categories, kvs => kvs.key);
        const cardEnter = card.enter().append('div')
            .attr('class', 'card');
        cardEnter.each(function() {
            let card = select(this);
            if (!card.datum().noheader) {
                card = card.append('div')
                    .attr('class', 'card-header')
                    .attr('role', 'tab')
                    .append('h5')
                    .attr('class', 'mb-0');
            }
            card.append('a')
                .attr('class', 'collapser')
                .attr('data-toggle', 'collapse')
                .attr('data-parent', '#palette')
                .attr('aria-expanded', 'true')
                .text(kvs => kvs.key);
        });
        card = card.merge(cardEnter);
        card.selectAll('div.card-header')
            .data(pass_through)
            .attr('id', heading_id);
        const collapser = card.selectAll('a.collapser')
            .data(pass_through);
        collapser
            .attr('href', kvs => `#${collapse_id(kvs)}`)
            .attr('aria-controls', collapse_id);
        const contentEnter = cardEnter.insert('div')
            .attr('class', 'collapse')
            .attr('role', 'tabpanel')
            .append('div')
            .attr('class', 'card-block');
        card.selectAll('div.collapse')
            .data(pass_through)
            .attr('id', collapse_id)
            .attr('aria-labelledby', heading_id);
        card.exit().remove();
        select('#palette hr.separator').remove();
        nulls.forEach(j => {
            select('#palette')
                .insert('hr', `div.card:nth-child(${j+1})`)
                .attr('class', 'separator');
        });
        $('#palette').on('hide.bs.collapse', () => {
            _palette.select(null);
        });
        contentEnter.append('ul')
            .attr('class', 'component-selection');
        const selection = card.selectAll('ul.component-selection')
            .data(pass_through);
        let components = selection.selectAll('li')
            .data(kvs => kvs.values);
        const componentsEnter = components.enter().append('li')
            .on('mousedown', function(comp) {
                show_selection(select(this.parentElement), _keyFunction(comp));
                _dispatch.call('selected', comp);
            });
        components = components.merge(componentsEnter);
        components
            .attr('id', select_id)
            .text(comp => _nameFunction(comp));
        $('ul.component-selection').each(function() {
            if (select(this).datum().draggable)
                $('li', this).draggable({
                    helper: 'clone',
                    opacity: 0.5,
                });
        });
        components.exit().remove();
    }
    const _palette = {
        data(categories) {
            if (!arguments.length)
                return _categories;
            _categories = categories;
            data(categories);
            return this;
        },
        keyFunction(keyFunction) {
            if (!arguments.length)
                return _keyFunction;
            _keyFunction = keyFunction;
            return this;
        },
        nameFunction(nameFunction) {
            if (!arguments.length)
                return _keyFunction;
            _nameFunction = nameFunction;
            return this;
        },
        select(id) {
            if (!id) {
                _dispatch.call('selected', null);
                selectAll('ul.component-selection li.ui-selected')
                    .classed('ui-selected', false);
            } else {
                throw new Error('not implemented');
                // will need to open its drawer, apply class as in click handler
                // and then dispatch event
            }
        },
        on(event, callback) {
            switch (arguments.length) {
                case 0:
                    throw new Error('event is not optional');
                case 1:
                    return _dispatch.on(event);
                default:
                    _dispatch.on(event, callback);
                    return this;
            }
        },
    };
    return _palette;
}
function update_palette(catalog) {
    // throw out any models which don't have a category, to avoid "null drawer"
    const models = catalog.models().filter(catalog.fModelCategory);
    const categories = nest().key(catalog.fModelCategory)
        .sortKeys(ascending)
        .entries(models);
    categories.forEach(kvs => {
        kvs.draggable = true;
    });
    categories.unshift(null);
    categories.unshift({
        key: 'Saved Solutions',
        draggable: false,
        noheader: true,
        values: catalog.composites().map(v => {
            v.category = 'solution';
            return v;
        }).sort((a, b) => ascending(catalog.fModelName(a), catalog.fModelName(b))),
    });
    _palette.data(categories);
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
function hashCode(s) {
    let hash = 0, i, chr;
    if (s.length === 0) return hash;
    for (i = 0; i < s.length; i++) {
        chr = s.charCodeAt(i);
        hash = ((hash<<5)-hash)+chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash>>>0; // convert to unsigned
}
let _icons;
text('iconlist.txt').then(list => {
    _icons = list.split(/\n/);
});
function hashIcon(icons, type) {
    const h = hashCode(type);
    return _icons[h%icons.length];
}

const _ionicons = {
    AlarmGenerator: 'ion-arrow-graph-up-right.png',
    Classifier: 'ion-levels.png',
    Aggregator: 'ion-pie-graph.png',
    Predictor: 'ion-stats-bars.png',
};

function apply_engine_parameters(engine) {
    switch (engine.layoutAlgorithm()) {
        case 'cola':
            engine
                .baseLength(5)
                .groupConnected(true)
                .handleDisconnected(false)
                .unconstrainedIterations(5)
                .userConstraintIterations(5)
                .allConstraintsIterations(5)
                .flowLayout({
                    axis: options.rankdir === 'TB' ? 'y' : 'x',
                    minSeparation: options.rankdir === 'TB'
                        ? function(e) {
                            return (e.source.height+e.target.height)/2+engine.ranksep();
                        }
                        : function(e) {
                            return (e.source.width+e.target.width)/2+engine.ranksep();
                        },
                });
            break;
        case 'dagre':
            engine.rankdir('LR');
            break;
        case 'dynadag':
            engine
                .rankdir('LR')
                .defaultsize({width: 150, height: 40});
    }
}

//
// INITIALIZATION
//

get_catalog().then(catalog => {
    console.log('Catalog loaded successfully:', catalog);
    _catalog = catalog = catalog_readers[options.catformat](catalog);
    _components = map(catalog.models(), catalog.fModelName);

    // PALETTE
    _palette = make_palette('#palette')
        .keyFunction(catalog.fModelId)
        .nameFunction(catalog.fModelName)
        .on('selected', comp => {
            if (!comp)
                display_properties(catalog, null);
            else if (comp.category === 'solution') {
                _solutionName.editable('setValue', _currentSoln = comp.name);
                $('#delete-button').removeClass('button-disabled');
                load_sol(comp.name, comp.url);
            } else
                display_properties(catalog, catalog.fModelUrl(comp));
        });
    update_palette(catalog);

    // CANVAS
    _compositionDiagram = diagram('#canvas');
    const engine = spawnEngine(qs.layout || 'cola', qs, qs.worker);
    apply_engine_parameters(engine);

    _compositionDiagram
        .width('auto')
        .height('auto')
        .layoutEngine(engine)
        .timeLimit(500)
        .margins({left: 5, top: 5, right: 5, bottom: 5})
        .modKeyZoom(options.mkzoom || null)
        .transitionDuration(qs.duration !== undefined ? +qs.duration : 1000)
        .fitStrategy('zoom')
        .autoZoom('always')
        .restrictPan(true)
        .stageTransitions(qs.stage || 'insmod')
        .enforceEdgeDirection(options.rankdir || 'LR')
        .edgeSource(e => e.value.sourcename)
        .edgeTarget(e => e.value.targetname)
        .edgeArrowhead(null)
        .enforceEdgeDirection('LR')
        .edgeLabel(e => e.value.name || '')
        .nodeLabel(n => n.value.name || n.key)
        .nodeLabelPadding({x: 10, y: 0})
        .nodeTitle(null)
        .nodeStrokeWidth(1)
        .nodeStroke('#777')
        .edgeStroke('#777')
        .nodeShape({shape: 'rounded-rect'})
        .nodePadding(20)
        .nodeContent('text-with-icon')
        .nodeIcon(d => hashIcon(_icons, d.value.type))
        .nodeFixed(n => n.value.fixedPos)
        .portNodeKey(p => p.value.nodeId).portName(p => p.value.portname).portBounds(p =>
            p.value.bounds
        ).edgeSourcePortName(e => e.value.sourceport).edgeTargetPortName(e => e.value.targetport);

    if (qs.showFixed)
        _compositionDiagram.nodeStrokeDashArray(n => n.value.fixedPos ? null : '5,5');

    _compositionDiagram.content('text-with-icon', withIconContents(textContents(), 35, 35));

    _compositionDiagram.child('place-ports', placePorts());

    const symbolPorts = symbolPortStyle()
        // .outline(symbolPortStyle.outline.square())
        .outlineStrokeWidth(1)
        //        .portLabel(p => p.value.portname)
        .symbol(p => p.orig.value.type).color(p => p.orig.value.type).colorScale(
            scaleOrdinal().range(
                // colorbrewer qualitative scale
                shuffle(
                    [
                        '#e41a1c',
                        '#377eb8',
                        '#4daf4a',
                        '#984ea3',
                        '#ff7f00',
                        '#eebb22',
                        '#a65628',
                        '#f781bf',
                    ], // 8-class set1
                    // ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666'] // 8-class dark2
                ),
            ),
        );
    if (qs.direcports)
        symbolPorts.outline(
            symbolPortStyle.outline.arrow()
                .outie(p => p.value.bounds === outbounds),
        );
    if (qs.lettports)
        symbolPorts
            .content(symbolPortStyle.content.letter());
    const letterPorts = symbolPortStyle()
        .content(symbolPortStyle.content.letter())
        .outlineStrokeWidth(1)
        .symbol('S')
        .symbolScale(x => x)
        .color('black')
        .colorScale(null);
    _compositionDiagram
        .portStyle('symbols', symbolPorts)
        .portStyle('letters', letterPorts)
        .portStyleName(p => /^xtra-/.test(p.value.portname) ? 'letters' : 'symbols');

    const portMatcher = matchPorts(_compositionDiagram, symbolPorts)
        .allowParallel(qs.parallel || false);

    const wildcard = wildcardPorts({
        get_type: function get_type(p) {
            return p.orig.value.type;
        },
        set_type: function set_type(p, src) {
            return p.orig.value.type = src && src.orig.value.type;
        },
        get_wild: function get_wild(p) {
            return p.orig.value.wild;
        },
        update_ports,
    });

    portMatcher.isValid((sourcePort, targetPort) =>
        wildcard.isValid(sourcePort, targetPort)
        && sourcePort.orig.value.bounds !== xtrabounds
        && targetPort.orig.value.bounds !== xtrabounds
        && sourcePort.orig.value.bounds !== targetPort.orig.value.bounds
    );

    portMatcher.whyInvalid((sourcePort, targetPort) =>
        sourcePort.orig.value.bounds === xtrabounds
            && "can't connect to that type of source port"
        || targetPort.orig.value.bounds === xtrabounds
            && "can't connect to that type of target port"
        || sourcePort.orig.value.bounds === targetPort.orig.value.bounds
            && "can't connect ports facing the same direction"
        || wildcard.whyInvalid(sourcePort, targetPort)
    );
    let gropts;
    _drawGraphs = drawGraphs(
        gropts = {
            idTag: 'id',
            sourceTag: 'sourcename',
            targetTag: 'targetname',
        },
    )
        .clickCreatesNodes(false)
        .usePorts(symbolPorts)
        .conduct(portMatcher)
        .addEdge((e, sport, tport) => {
            set_dirty(true);
            // reverse edge if it's going from requirement to capability
            // again, the bounds object comparison is not good.
            // maybe it would be clearer to return a new edge object.
            if (sport.orig.value.bounds === inbounds) {
                console.assert(tport.orig.value.bounds === outbounds);
                let t;
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

    _compositionDiagram.mode('draw-graphs', _drawGraphs);

    const select_nodes = selectNodes({
        nodeStroke: 'orange',
        nodeStrokeWidth: 3,
        nodeLabelFill: 'orange',
    }).multipleSelect(false);
    _compositionDiagram.child('select-nodes', select_nodes);

    const select_nodes_group = selectThingsGroup('select-nodes-group', 'select-nodes');
    select_nodes_group.on('set_changed.show-info', (nodes, refresh) => {
        _palette.select(null);
        if (nodes.length > 1)
            throw new Error('not expecting multiple select');
        else if (nodes.length === 1) {
            select_edges_group.call('set_changed', null, [], refresh);
            select_ports_group.call('set_changed', null, [], refresh);
            const type = _compositionDiagram.getNode(nodes[0]).value.type;
            const comps = catalog.models().filter(comp => catalog.fModelName(comp) === type);
            if (comps.length === 1)
                display_properties(catalog, catalog.fModelUrl(comps[0]));
        } else display_properties(catalog, null);
    });

    const select_edges = selectEdges({
        edgeStroke: 'lightblue',
        edgeStrokeWidth: 3,
    }).multipleSelect(false);
    _compositionDiagram.child('select-edges', select_edges);
    const select_edges_group = selectThingsGroup('select-edges-group', 'select-edges');
    select_edges_group.on('set_changed.show-info', (edges, refresh) => {
        _palette.select(null);
        if (edges.length > 0) {
            select_nodes_group.call('set_changed', null, [], refresh);
            select_ports_group.call('set_changed', null, [], refresh);
            const edge = _compositionDiagram.getEdge(edges[0]);
            display_properties(catalog, edge);
        } else display_properties(catalog, null);
    });

    const select_ports = selectPorts({
        portBackgroundFill: 'orange',
        // portBackgroundStroke: 'lightblue',
        // portBackgroundStrokeWidth: 2
    }).multipleSelect(false);
    _compositionDiagram.child('select-ports', select_ports);
    const select_ports_group = selectThingsGroup('select-ports-group', 'select-ports');
    select_ports_group.on('set_changed.show-info', (ports, refresh) => {
        _palette.select(null);
        if (ports.length > 0) {
            select_nodes_group.call('set_changed', null, [], refresh);
            select_edges_group.call('set_changed', null, [], refresh);
            display_properties(catalog, ports[0]);
        } else display_properties(catalog, null);
    });

    const move_nodes = moveNodes();
    _compositionDiagram.child('move-nodes', move_nodes);

    const fix_nodes = fixNodes()
        .strategy(fixNodes.strategy.lastNPerComponent(Infinity));
    _compositionDiagram.child('fix-nodes', fix_nodes);

    const label_nodes = labelNodes({
        labelTag: 'name',
        align: 'left',
        class: 'node-label',
    }).changeNodeLabel((nodeId, text) => {
        const node = _compositionDiagram.getNode(nodeId);
        // execute on server first, which could reject or change text
        return Promise.resolve(text);
    });
    _compositionDiagram.child('label-nodes', label_nodes);

    const label_edges = labelEdges({
        labelTag: 'name',
        align: 'center',
        class: 'edge-label',
    }).changeEdgeLabel((edgeId, text) =>
        // execute on server first, which could reject or change text
        Promise.resolve(text)
    );
    _compositionDiagram.child('label-edges', label_edges);

    const delete_nodes = deleteNodes()
        .crossfilterAccessor(diagram => _drawGraphs.nodeCrossfilter())
        .dimensionAccessor(diagram => _compositionDiagram.nodeDimension())
        .onDelete(nodes =>
            // confirm with server here
            Promise.resolve(nodes)
                .then(nodes => {
                    // after the back-end has accepted the deletion, we can remove unneeded ports
                    _ports = _ports.filter(p => p.nodeId !== nodes[0]);
                    update_ports();
                    return nodes;
                })
        );
    _compositionDiagram.child('delete-nodes', delete_nodes);

    const delete_edges = deleteThings(select_edges_group, 'delete-edges', 'id')
        .crossfilterAccessor(diagram => _drawGraphs.edgeCrossfilter())
        .dimensionAccessor(diagram => _compositionDiagram.edgeDimension())
        .onDelete(edges =>
            // confirm with server here, promise-then pass to wildcard
            wildcard.resetTypes(_compositionDiagram, edges)
        );
    _compositionDiagram.child('delete-edges', delete_edges);

    const operations = ['run', 'jump', 'talk', 'sleep'];
    const messages = ['hill', 'storm', 'furiously', 'stile', 'mile'];

    function generate_operation(id) {
        const op = operations[Math.floor(id%operations.length)],
            msgs = range(Math.floor(id%3)).map(() => messages[Math.floor(id%messages.length)]);
        return `${op}(${
            msgs.map(msg => `<a href="#" class="tip-link" id="${op}_${msg}">${msg}</a>`).join(', ')
        })`;
    }

    const port_tips = tip()
        .delay(200)
        .clickable(true)
        .selection(selectPort())
        .content(async d => generate_operation(hashCode(`${d.node.orig.key}-${d.name}`)))
        .offset(function() {
            // I don't entirely understand how d3-tip is calculating position
            // this attempts to keep position fixed even though size of g.port is changing
            return [this.getBBox().height/2-20, 0];
        })
        .linkCallback(id => {
            alert(id);
        });

    _compositionDiagram.child('port-tips', port_tips);

    const node_tips = tip({namespace: 'node-tips'})
        .selection(selectNode())
        .content(async d => d.orig.value && d.orig.value.type);

    _compositionDiagram.child('node-tips', node_tips);

    const negative_tips = tip({namespace: 'hint-negative-tips', class: 'd3-tip hint-negative'})
        .selection(selectPort())
        .programmatic(true)
        .hideDelay(1000);

    _compositionDiagram.child('hint-negative-tips', negative_tips);

    const positive_tips = tip({namespace: 'hint-positive-tips', class: 'd3-tip hint-positive'})
        .selection(selectPort())
        .direction('s')
        .programmatic(true)
        .hideDelay(1000);

    _compositionDiagram.child('hint-positive-tips', positive_tips);

    gropts.tipsDisable = [port_tips, node_tips];
    gropts.negativeTip = negative_tips;
    gropts.positiveTip = positive_tips;

    if (qs.debug) {
        const troubleshootMode = troubleshoot();
        _compositionDiagram.child('troubleshoot', troubleshootMode);
    }

    if (qs.validate) {
        const validateMode = validate();
        _compositionDiagram.child('validate', validateMode);
    }

    $('#canvas').droppable({
        drop(event, ui) {
            set_dirty(true);
            const component = select(ui.draggable[0]).datum();
            const type = catalog.fModelName(component);
            let max = 0;
            _drawGraphs.nodeCrossfilter().all().forEach(n => {
                let number = n.id.match(/[0-9]+$/);
                if (!number)
                    return; // currently all ids will be type + number
                number = number[0];
                const type2 = n.id.slice(0, -number.length);
                if (type2 === type && +number > max)
                    max = +number;
            });
            const data = {
                id: type+(max+1),
                type,
            };
            const bound = _compositionDiagram.root().node().getBoundingClientRect();
            const pos = _compositionDiagram.invertCoord([
                event.clientX-bound.left,
                event.clientY-bound.top,
            ]);
            json(catalog.fModelUrl(_components.get(type))).then(def => {
                _ports = _ports.concat(catalog.ports(data.id, def));
                update_ports();
                _drawGraphs.createNode(pos, data);
            });
        },
    });

    // SAVE AREA
    $.fn.editable.defaults.mode = 'inline';
    _solutionName = $('#solution-name').editable({
        emptytext: '(untitled)',
        success(response, value) {
            let promise = Promise.resolve(catalog);
            if (_currentSoln) {
                promise = save_solution(catalog, _currentSoln).then(cat2 =>
                    rename_solution(cat2, _currentSoln, value)
                );
            } else {
                promise = save_solution(catalog, value);
            }
            promise.then(cat3 => {
                catalog = cat3;
                update_palette(catalog);
                _currentSoln = value;
                $('#delete-button').removeClass('button-disabled');
            });
        },
    });
    _description = $('#description').editable({
        emptytext: '(no description)',
        success(response, value) {
            set_dirty(true);
            _solution.description = value;
        },
    });

    $('#new-button').click(() => {
        maybe_save_solution(catalog).then(cat2 => {
            catalog = cat2;
            update_palette(catalog);
            _currentSoln = null;
            $('#delete-button').addClass('button-disabled');
            _solution = {nodes: [], edges: []};
            display_solution(catalog, _solution);
        });
    });
    $('#save-button').click(() => {
        if (_dirty) {
            if (!_currentSoln) {
                _currentSoln = prompt('Enter a solution name', 'Solution');
                $('#delete-button').removeClass('button-disabled');
            }
            save_solution(catalog, _currentSoln)
                .then(cat2 => {
                    catalog = cat2;
                    update_palette(catalog);
                });
        }
    });
    $('#delete-button').click(() => {
        if (_currentSoln && confirm(`Really delete solution "${_currentSoln}"?`))
            delete_solution(catalog, _currentSoln).then(cat2 => {
                catalog = cat2;
                update_palette(catalog);
            });
    });

    // load initial composite solution
    let catsol;
    if (options.solution)
        catsol = catalog.composites().find(sol => sol.name === options.solution);
    if (catsol)
        load_sol(catsol.name, catsol.url);
    else {
        _solution = {nodes: [], edges: []};
        display_solution(catalog, _solution);
    }
}).catch(error => {
    console.error('Failed to load catalog:', error);
    console.error('Attempted to load:', options.catalog);
});
