dc_graph.flexbox_layout = function(id) {
    var _layoutId = id || uuid();
    var _dispatch = d3.dispatch('tick', 'start', 'end');

    var _tree, _nodes = {}, _wnodes;

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
    function data(nodes) {
        _tree = {};
        nodes.forEach(function(n) {
            var ad = _engine.keyToAddress()(n.dcg_nodeKey);
            add_node([], ad, n, _tree);
        });
        var need = all_keys(_tree);
        _wnodes = nodes;
        // var wnodes = regenerate_objects(_nodes, nodes, need, function(n) {
        //     return n.dcg_nodeKey;
        // }, function(n1, n) {
        // }, function(k, n) {
        //     var address = _engine.keyToAddress()(k);
        //     add_node(address, [], n, _tree);
        // });
    }
    var internal_attrs = ['sort', 'dcg_nodeKey'];
    function create_flextree(attrs, tree) {
        var flexnode = {style: {}};
        if(Object.keys(tree.children).length) {
            tree.node.width = tree.node.height = 1000;
        }
        var attrs2 = Object.assign({}, attrs);
        if(tree.node)
            Object.assign(attrs, tree.node);
        for(var attr in attrs) {
            if(internal_attrs.includes(attr))
                continue;
            var value = attrs[attr];
            if(typeof value === 'function')
                value = value(tree.node);
            flexnode.style[attr] = value;
        }
        flexnode.children = Object.keys(tree.children)
                .sort(attrs.sort)
                .map(function(key) {
                    return create_flextree(Object.assign({}, attrs2), tree.children[key]);
                });
        tree.flexnode = flexnode;
        return flexnode;
    }
    function apply_layout(tree) {
        console.log(tree.node.dcg_nodeKey, tree.flexnode.layout);
        tree.node.x = (tree.flexnode.layout.left + tree.flexnode.layout.right)/2;
        tree.node.y = (tree.flexnode.layout.top + tree.flexnode.layout.bottom)/2;
        Object.keys(tree.children)
            .map(function(key) { return tree.children[key]; })
            .map(apply_layout);
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
            sort: d3.ascending
        };
        var flexTree = create_flextree(defaults, _tree);
        console.log(JSON.stringify(flexTree, null, 2));
        computeLayout(flexTree);
        apply_layout(_tree);
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    // currently dc.graph populates the "cola" (really "layout") member with the attributes
    // needed for layout and does not pass in the original data. flexbox has a huge number of attributes
    // and it might be more appropriate for it to look at the original data.
    // (Especially because it also computes some attributes based on data.)
    var supportedAttributes = [
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
        'position', // 'minWidth', 'minHeight', // positive number
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
        needsStage: function(stage) { // stopgap until we have engine chaining
            return stage === 'ports' || stage === 'edgepos';
        },
        parent: property(null),
        on: function(event, f) {
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
        data: function(nodes, edges, constraints, options) {
            data(nodes, edges, constraints, options);
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
            supportedAttributes.forEach(function(attr) {
                if(n.orig.value[attr])
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge: function() {},
        addressToKey: property(function(ad) { return ad.join(','); }),
        keyToAddress: property(function(nid) { return nid.split(','); })
    };
    return _engine;
};

dc_graph.flexbox_layout.scripts = ['css-layout.js'];
