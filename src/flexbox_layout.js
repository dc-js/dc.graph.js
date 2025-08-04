/**
 * `dc_graph.flexbox_layout` lays out nodes in accordance with the
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout/Basic_Concepts_of_Flexbox flexbox layout algorithm}.
 * Nodes fit into a containment hierarchy based on their keys; edges do not affect the layout but
 * are drawn from node to node.
 *
 * Since the flexbox algorithm is not ordinarily available in SVG, this class uses the
 * {@link https://npmjs.com/package/css-layout css-layout}
 * package. (It does not currently support css-layout's successor
 * {@link https://github.com/facebook/yoga yoga} but that should be straightforward to add if
 * there is interest.)
 *
 * Unlike conventional graph layout, where positions are determined based on a few attributes and
 * the topological structure of the eedges, flexbox layout is determined based on the node hierarchy
 * and a large number of attributes on the nodes. See css-layout's
 * {@link https://npmjs.com/package/css-layout#supported-attributes Supported Attributes}
 * for a list of those attributes, and see below to understand how the hierarchy is inferred from
 * node keys.
 *
 * `flexbox_layout` does not require all internal nodes to be specified. The node keys are parsed as
 * "addresses" or paths (arrays of strings) and the tree is built from those paths. Wherever a
 * node's path terminates is where that node's data will be applied.
 *
 * Since flexbox supports a vast number of attributes, we don't attempt to create accessors for
 * every one. Instead, any attributes in the node data are copied which match the names of flexbox
 * attributes.
 *
 * @class flexbox_layout
 * @memberof dc_graph
 * @param {String} [id=uuid()] - Unique identifier
 * @return {dc_graph.flexbox_layout}
 **/
/**
 * Flexbox layout for dc.graph.js
 * @module flexbox_layout
 */

import { dispatch } from 'd3-dispatch';
import { ascending } from 'd3-array';
import { uuid, property } from './core.js';
import yoga from 'yoga-layout';

export function flexboxLayout(id, options) {
    const _layoutId = id || uuid();
    options = options || {algo: 'yoga-layout'};
    const _dispatch = dispatch('tick', 'start', 'end');

    let _graph, _tree, _wnodes;
    const _nodes = {};

    function init(_options) {
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
        const t = tree.children[adtail[0]] = tree.children[adtail[0]] || {};
        adhead.push(adtail.shift());
        add_node(adhead, adtail, n, t);
    }
    function all_keys(tree) {
        const key = _engine.addressToKey()(tree.address);
        return Array.prototype.concat.apply([key], Object.keys(tree.children || {}).map((k) => all_keys(tree.children[k])));
    }
    function data(graph, nodes) {
        _graph = graph;
        _tree = {address: [], children: {}};
        nodes.forEach((n) => {
            const ad = _engine.keyToAddress()(n.dcg_nodeKey);
            add_node([], ad, n, _tree);
        });
        const _need = all_keys(_tree);
        _wnodes = nodes;
    }
    function ensure_inner_nodes(tree) {
        if(!tree.node)
            tree.node = {dcg_nodeKey: tree.address.length ? tree.address[tree.address.length-1] : null};
        Object.values(tree.children).forEach(ensure_inner_nodes);
    }
    function set_yoga_attr(flexnode, attr, value) {
        const fname = `set${  attr.charAt(0).toUpperCase()  }${attr.slice(1)}`;
        if(typeof flexnode[fname] !== 'function')
            throw new Error(`Could not set yoga attr "${  attr  }" (${  fname  })`);
        
        // Map string values to yoga constants
        const constantMaps = {
            alignItems: {
                stretch: yoga.ALIGN_STRETCH,
                'flex-start': yoga.ALIGN_FLEX_START,
                center: yoga.ALIGN_CENTER,
                'flex-end': yoga.ALIGN_FLEX_END,
                baseline: yoga.ALIGN_BASELINE
            },
            alignSelf: {
                stretch: yoga.ALIGN_STRETCH,
                'flex-start': yoga.ALIGN_FLEX_START,
                center: yoga.ALIGN_CENTER,
                'flex-end': yoga.ALIGN_FLEX_END,
                baseline: yoga.ALIGN_BASELINE
            },
            alignContent: {
                'flex-start': yoga.ALIGN_FLEX_START,
                'flex-end': yoga.ALIGN_FLEX_END,
                stretch: yoga.ALIGN_STRETCH,
                center: yoga.ALIGN_CENTER,
                'space-between': yoga.ALIGN_SPACE_BETWEEN,
                'space-around': yoga.ALIGN_SPACE_AROUND
            },
            flexDirection: {
                column: yoga.FLEX_DIRECTION_COLUMN,
                'column-reverse': yoga.FLEX_DIRECTION_COLUMN_REVERSE,
                row: yoga.FLEX_DIRECTION_ROW,
                'row-reverse': yoga.FLEX_DIRECTION_ROW_REVERSE
            },
            justifyContent: {
                'flex-start': yoga.JUSTIFY_FLEX_START,
                center: yoga.JUSTIFY_CENTER,
                'flex-end': yoga.JUSTIFY_FLEX_END,
                'space-between': yoga.JUSTIFY_SPACE_BETWEEN,
                'space-around': yoga.JUSTIFY_SPACE_AROUND,
                'space-evenly': yoga.JUSTIFY_SPACE_EVENLY
            }
        };
        
        if(constantMaps[attr] && constantMaps[attr][value])
            value = constantMaps[attr][value];
        
        // Handle attributes that need an edge parameter (padding, margin, border, position)
        if(attr === 'padding' || attr === 'margin' || attr === 'border' || attr.endsWith('Padding') || attr.endsWith('Margin')) {
            // For generic padding/margin, apply to all edges
            flexnode[fname](yoga.EDGE_ALL, value);
        } else if(attr === 'width') {
            flexnode.setWidth(value);
        } else if(attr === 'height') {
            flexnode.setHeight(value);
        } else {
            flexnode[fname](value);
        }
    }
    function get_yoga_attr(flexnode, attr) {
        const fname = `getComputed${  attr.charAt(0).toUpperCase()  }${attr.slice(1)}`;
        if(typeof flexnode[fname] !== 'function')
            throw new Error(`Could not get yoga attr "${  attr  }" (${  fname  })`);
        return flexnode[fname]();
    }
    const internal_attrs = ['sort', 'order', 'dcg_nodeKey', 'dcg_nodeParentCluster', 'shape', 'abstract', 'rx', 'ry', 'x', 'y', 'z', 'nodeOutlineClip'],
        skip_on_parents = ['width', 'height'];
    function create_flextree(attrs, tree) {
        let flexnode;
        switch(options.algo) {
        case 'css-layout':
            flexnode = {name: _engine.addressToKey()(tree.address), style: {}};
            break;
        case 'yoga-layout':
            flexnode = new yoga.Node();
            break;
        }
        const attrs2 = Object.assign({}, attrs);
        const isParent = Object.keys(tree.children).length;
        if(tree.node)
            Object.assign(attrs, tree.node);
        for(const attr in attrs) {
            if(internal_attrs.includes(attr))
                continue;
            if(isParent && skip_on_parents.includes(attr))
                continue;
            let value = attrs[attr];
            if(typeof value === 'function')
                value = value(tree.node);
            switch(options.algo) {
            case 'css-layout':
                flexnode.style[attr] = value;
                break;
            case 'yoga-layout':
                set_yoga_attr(flexnode, attr, value);
                break;
            }
        }
        if(isParent) {
            const children = Object.values(tree.children)
                .sort(attrs.sort)
                .map((c) => c.address[c.address.length-1])
                .map((key) => create_flextree(Object.assign({}, attrs2), tree.children[key]));
            switch(options.algo) {
            case 'css-layout':
                flexnode.children = children;
                break;
            case 'yoga-layout':
                children.forEach((child, i) => {
                    flexnode.insertChild(child, i);
                });
                break;
            }
        }
        tree.flexnode = flexnode;
        return flexnode;
    }
    function apply_layout(offset, tree) {
        let left, top, width, height;
        switch(options.algo) {
        case 'css-layout':
            if(_engine.logStuff())
                console.log(`${tree.node.dcg_nodeKey  }: ${ JSON.stringify(tree.flexnode.layout)}`);
            left = tree.flexnode.layout.left; width = tree.flexnode.layout.width;
            top = tree.flexnode.layout.top; height = tree.flexnode.layout.height;
            break;
        case 'yoga-layout':
            left = get_yoga_attr(tree.flexnode, 'left'); width = get_yoga_attr(tree.flexnode, 'width');
            top = get_yoga_attr(tree.flexnode, 'top'); height = get_yoga_attr(tree.flexnode, 'height');
            break;
        }
        tree.node.x = offset.x + left + width/2;
        tree.node.y = offset.y + top + height/2;
        Object.keys(tree.children)
            .map((key) => tree.children[key])
            .forEach((child) => {
                apply_layout({x: offset.x + left, y: offset.y + top}, child);
            });
    }
    function dispatchState(wnodes, wedges, event) {
        _dispatch.call(event, null,
            wnodes,
            wedges.map((e) => ({dcg_edgeKey: e.dcg_edgeKey}))
        );
    }
    function start() {
        const defaults = {
            sort(a, b) {
                return ascending(a.node.dcg_nodeKey, b.node.dcg_nodeKey);
            }
        };
        ensure_inner_nodes(_tree);
        const flexTree = create_flextree(defaults, _tree);
        switch(options.algo) {
        case 'css-layout':
            flexTree.style.width = _graph.width;
            flexTree.style.height = _graph.height;
            break;
        case 'yoga-layout':
            set_yoga_attr(flexTree, 'width', _graph.width);
            set_yoga_attr(flexTree, 'height', _graph.height);
            break;
        }
        if(_engine.logStuff())
            console.log(JSON.stringify(flexTree, null, 2));
        switch(options.algo) {
        case 'css-layout':
            computeLayout(flexTree);
            break;
        case 'yoga-layout':
            flexTree.calculateLayout();
            break;
        }
        apply_layout({x: 0, y: 0}, _tree);
        dispatchState(_wnodes, [], 'end');
    }
    function stop() {
    }

    // currently dc.graph populates the "cola" (really "layout") member with the attributes
    // needed for layout and does not pass in the original data. flexbox has a huge number of attributes
    // and it might be more appropriate for it to look at the original data.
    // (Especially because it also computes some attributes based on data.)
    const supportedAttributes = [
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

    const _engine = {
        layoutAlgorithm() {
            return 'cola';
        },
        layoutId() {
            return _layoutId;
        },
        supportsWebworker() {
            return true;
        },
        parent: property(null),
        on(event, f) {
            if(arguments.length === 1)
                return _dispatch.on(event);
            _dispatch.on(event, f);
            return this;
        },
        init(options) {
            this.optionNames().forEach((option) => {
                options[option] = options[option] || this[option]();
            });
            init(options);
            return this;
        },
        data(graph, nodes) {
            data(graph, nodes);
        },
        start() {
            start();
        },
        stop() {
            stop();
        },
        optionNames() {
            return [];
        },
        populateLayoutNode(n1, n) {
            ['sort', 'order'].concat(supportedAttributes).forEach((attr) => {
                if(n.orig.value[attr])
                    n1[attr] = n.orig.value[attr];
            });
        },
        populateLayoutEdge() {},
        /**
         * This function constructs a node key string from an "address". An address is an array of
         * strings identifying the path from the root to the node.
         *
         * By default, it joins the address with commas.
         * @method addressToKey
         * @memberof dc_graph.flexbox_layout
         * @instance
         * @param {Function} [addressToKey = function(ad) { return ad.join(','); }]
         * @return {Function}
         * @return {dc_graph.flexbox_layout}
         **/
        addressToKey: property((ad) => ad.join(',')),
        /**
         * This function constructs an "address" from a node key string. An address is an array of
         * strings identifying the path from the root to the node.
         *
         * By default, it splits the key by its commas.
         * @method keyToAddress
         * @memberof dc_graph.flexbox_layout
         * @instance
         * @param {Function} [keyToAddress = function(nid) { return nid.split(','); }]
         * @return {Function}
         * @return {dc_graph.flexbox_layout}
         **/
        keyToAddress: property((nid) => nid.split(',')),
        yogaConstants() {
            // Direct access to yoga constants
            return yoga;
        },
        logStuff: property(false)
    };
    return _engine;
};

// No external scripts needed - yoga-layout is imported as ES6 module
flexboxLayout.scripts = [];
