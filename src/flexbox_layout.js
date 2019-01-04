dc_graph.flexbox_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');

    var _graph, _tree, _nodes = {}, _wnodes;

    function init(options) {
    }
    // like d3.nest but address can be of arbitrary (and different) length
    // probably less efficient too
    function add_node(adhead, adtail, n, tree) {
        tree.address = adhead.slice();
        tree.children = tree.children || {};
        if(!adtail.length) {
            tree.node = n;
            return;
        }
        var t = tree.children[adtail[0]] = tree.children[adtail[0]] || {};
        adhead.push(adtail.shift());
        add_node(adhead, adtail, n, t);
    }
    function all_keys(tree) {
        var key = _engine.addressToKey()(tree.address);
        return Array.prototype.concat.apply([key], Object.keys(tree.children).map(function(k) {
            return all_keys(tree.children[k]);
        }));
    }
    function data(graph, nodes) {
        _graph = graph;
        _tree = {};
        nodes.forEach(function(n) {
            var ad = _engine.keyToAddress()(n.dcg_nodeKey);
            add_node([], ad, n, _tree);
        });
        var need = all_keys(_tree);
        _wnodes = nodes;
    }
    var internal_attrs = ['sort', 'dcg_nodeKey', 'x', 'y'],
        skip_on_parents = ['width', 'height'];
    function create_flextree(attrs, tree) {
        var flexnode = {name: _engine.addressToKey()(tree.address), style: {}};
        var attrs2 = Object.assign({}, attrs);
        var isParent = Object.keys(tree.children).length;
        if(tree.node)
            Object.assign(attrs, tree.node);
        for(var attr in attrs) {
            if(internal_attrs.includes(attr))
                continue;
            if(isParent && skip_on_parents.includes(attr))
                continue;
            var value = attrs[attr];
            if(typeof value === 'function')
                value = value(tree.node);
            flexnode.style[attr] = value;
        }
        if(isParent) {
            flexnode.children = Object.values(tree.children)
                .sort(attrs.sort)
                .map(function(c) { return c.address[c.address.length-1]; })
                .map(function(key) {
                    return create_flextree(Object.assign({}, attrs2), tree.children[key]);
                });
        }
        tree.flexnode = flexnode;
        return flexnode;
    }
    function apply_layout(offset, tree) {
        if(_engine.logStuff())
            console.log(tree.node.dcg_nodeKey + ': '+ JSON.stringify(tree.flexnode.layout));
        tree.node.x = offset.x + tree.flexnode.layout.left + tree.flexnode.layout.width/2;
        tree.node.y = offset.y + tree.flexnode.layout.top + tree.flexnode.layout.height/2;
        Object.keys(tree.children)
            .map(function(key) { return tree.children[key]; })
            .forEach(function(child) {
                apply_layout({x: offset.x + tree.flexnode.layout.left, y: offset.y + tree.flexnode.layout.top}, child);
            });
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch[event](
            wnodes,
            wedges.map(function(e) {
                return {dcg_edgeKey: e.dcg_edgeKey};
            })
        );
    }
    function start() {
        var defaults = {
            sort: function(a, b) {
                return d3.ascending(a.node.dcg_nodeKey, b.node.dcg_nodeKey);
            }
        };
        var flexTree = create_flextree(defaults, _tree);
        flexTree.style.width = _graph.width;
        flexTree.style.height = _graph.height;
        if(_engine.logStuff())
            console.log(JSON.stringify(flexTree, null, 2));
        computeLayout(flexTree);
        apply_layout({x: 0, y: 0}, _tree);
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    // currently dc.graph populates the "cola" (really "layout") member with the attributes
    // needed for layout and does not pass in the original data. flexbox has a huge number of attributes
    // and it might be more appropriate for it to look at the original data.
    // (Especially because it also computes some attributes based on data.)
    var supportedAttributes = [
        'width', 'height', // positive number
        'minWidth', 'minHeight', // positive number
        'maxWidth', 'maxHeight', // positive number
        'left', 'right', 'top', 'bottom', // number
        'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom', // number
        'padding', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', // positive number
        'borderWidth', 'borderLeftWidth', 'borderRightWidth', 'borderTopWidth', 'borderBottomWidth', // positive number
        'flexDirection', // 'column', 'row'
        'justifyContent', // 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'
        'alignItems', 'alignSelf', // 'flex-start', 'center', 'flex-end', 'stretch'
        'flex', // positive number
        'flexWrap', // 'wrap', 'nowrap'
        'position' // 'relative', 'absolute'
    ];

    var _engine = {
        layoutAlgorithm: function() {
            return 'cola';
        },
        layoutId: function() {
            return _layoutId;
        },
        supportsWebworker: function() {
            return true;
        },
        parent: property(null),
        on: function(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init: function(options) {
            this.optionNames().forEach(function(option) {
                options[option] = options[option] || this[option]();
            }.bind(this));
            init(options);
            return this;
        },
        data: function(graph, nodes) {
            data(graph, nodes);
        },
        start: function() {
            start();
        },
        stop: function() {
            stop();
        },
        optionNames: function() {
            return [];
        },
        populateLayoutNode: function(n1, n) {
            ['sort', 'order'].concat(supportedAttributes).forEach(function(attr) {
                if(n.orig.value[attr])
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge: function() {},
        addressToKey: property(function(ad) { return ad.join(','); }),
        keyToAddress: property(function(nid) { return nid.split(','); }),
        logStuff: property(false)
    };
    return _engine;
};

dc_graph.flexbox_layout.scripts = ['css-layout.js'];
