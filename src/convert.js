import { uuid } from './core.js';
import { pluck } from 'dc';

const convert_tree_helper = function(data, attrs, options, parent, level, inherit) {
    level = level || 0;
    if(attrs.length > (options.valuesByAttr ? 1 : 0)) {
        const attr = attrs.shift();
        const nodes = [], edges = [];
        const children = data.map((v) => {
            const key = v[options.nestKey];
            const childKey = options.nestKeysUnique ? key : uuid();
            if(childKey) {
                let node;
                if(options.ancestorKeys) {
                    inherit = inherit || {};
                    if(attr)
                        inherit[attr] = key;
                    node = Object.assign({}, inherit);
                } else node = {};
                node[options.nodeKey] = childKey;
                if(options.label && options.labelFun)
                    node[options.label] = options.labelFun(key, attr, v);
                if(options.level)
                    node[options.level] = level+1;
                nodes.push(node);
                if(parent) {
                    const edge = {};
                    edge[options.edgeSource] = parent;
                    edge[options.edgeTarget] = childKey;
                    edges.push(edge);
                }
            }
            const children = options.valuesByAttr ? v[attrs[0]] : v.values;
            const recurse = convert_tree_helper(children, attrs.slice(0), options,
                                              childKey, level+1, Object.assign({}, inherit));
            return recurse;
        });
        return {nodes: Array.prototype.concat.apply(nodes, children.map(pluck('nodes'))),
                edges: Array.prototype.concat.apply(edges, children.map(pluck('edges')))};
    }
    else return {nodes: data.map((v) => {
        v = Object.assign({}, v);
        if(options.level)
            v[options.level] = level+1;
        return v;
    }), edges: data.map((v) => {
        const edge = {};
        edge[options.edgeSource] = parent;
        edge[options.edgeTarget] = v[options.nodeKey];
        return edge;
    })};
};

export function convertTree(data, attrs, options) {
    options = Object.assign({
        nodeKey: 'key',
        edgeKey: 'key',
        edgeSource: 'sourcename',
        edgeTarget: 'targetname',
        nestKey: 'key'
    }, options);
    if(Array.isArray(data))
        return convert_tree_helper(data, attrs, options, options.root, 0, options.inherit);
    else {
        attrs = [''].concat(attrs);
        return convert_tree_helper([data], attrs, options, options.root, 0, options.inherit);
    }
};

export function convertNest(nest, attrs, nodeKeyAttr, edgeSourceAttr, edgeTargetAttr, parent, inherit) {
    return convertTree(nest, attrs, {
        nodeKey: nodeKeyAttr,
        edgeSource: edgeSourceAttr,
        edgeTarget: edgeTargetAttr,
        root: parent,
        inherit,
        ancestorKeys: true,
        label: 'name',
        labelFun(key, attr, _v) { return `${attr  }:${  key}`; },
        level: '_level'
    });
};

// https://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
const type_of = obj => ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
const object_to_keyed_array = obj => Object.entries(obj).map(([key,value]) => ({key, ...value}));

export function convertAdjacencyList(nodes, namesIn, namesOut) {
    if(type_of(nodes) === 'object') {
        const graph = namesIn.multipleGraphs ? Object.values(nodes)[0] : nodes;
        nodes = object_to_keyed_array(graph);
    }
    const adjkey = namesIn.adjacencies || namesIn.revAdjacencies,
          revadj = !namesIn.adjacencies;
    if(!adjkey)
        throw new Error('must specify namesIn.adjacencies or namesIn.revAdjacencies');
    const edges = Array.prototype.concat.apply([], nodes.map((n) => n[adjkey].map((adj) => {
            const e = {};
            if(namesOut.edgeKey)
                e[namesOut.edgeKey] = uuid();
            e[namesOut.edgeSource] = n[namesIn.nodeKey];
            e[namesOut.edgeTarget] = (namesIn.targetKey ? adj[namesIn.targetKey] : adj).toString();
            if(revadj)
                [e[namesOut.edgeSource], e[namesOut.edgeTarget]] = [e[namesOut.edgeTarget], e[namesOut.edgeSource]];
            if(namesOut.adjacency)
                e[namesOut.adjacency] = adj;
            return e;
        })));
    return {
        nodes,
        edges,
        nodekeyattr: namesIn.nodeKey,
        sourceattr: namesOut.edgeSource,
        targetattr: namesOut.edgeTarget
    };
};

