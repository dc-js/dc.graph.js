import * as graphlibDot from '@dagrejs/graphlib-dot';
import { set } from 'd3-collection';
import { csv, dsv, json, text } from 'd3-fetch';

function processDot(text) {
    return new Promise((resolve, _reject) => {
        const digraph = graphlibDot.read(text);

        const nodeNames = digraph.nodes();
        const nodes = new Array(nodeNames.length);
        const nodeIdMap = {};

        nodeNames.forEach((name, i) => {
            const nodeLabel = digraph.node(name) || {};
            nodes[i] = Object.assign({}, nodeLabel, {
                id: i,
                name,
            });
            nodeIdMap[name] = i;
        });

        const edges = [];
        digraph.edges().forEach(e => {
            const edgeLabel = digraph.edge(e.v, e.w) || {};
            edges.push(Object.assign({}, edgeLabel, {
                source: nodeIdMap[e.v],
                target: nodeIdMap[e.w],
                sourcename: e.v,
                targetname: e.w,
            }));
        });

        // Handle clusters/subgraphs if supported
        const node_cluster = {}, clusters = [];
        if (typeof digraph.children === 'function') {
            const cluster_names = {};
            let queue = digraph.children().map(c =>
                Object.assign({parent: null, key: c}, digraph.node(c))
            );
            while (queue.length) {
                const item = queue.shift(),
                    children = digraph.children(item.key);
                if (children.length) {
                    clusters.push(item);
                    cluster_names[item.key] = true;
                } else
                    node_cluster[item.key] = item.parent;
                queue = queue.concat(children.map(c => ({parent: item.key, key: c})));
            }
            // Filter out cluster nodes
            const filteredNodes = nodes.filter(n => !cluster_names[n.name]);
            const graph = {nodes: filteredNodes, links: edges, node_cluster, clusters};
            resolve(graph);
        } else {
            const graph = {nodes, links: edges, node_cluster, clusters};
            resolve(graph);
        }
    });
}

function processDsv(data) {
    return new Promise((resolve, _reject) => {
        const keys = Object.keys(data[0]);
        const source = keys[0], target = keys[1];
        let nodes = set(data.map(r => r[source]));
        data.forEach(r => {
            nodes.add(r[target]);
        });
        nodes = nodes.values().map(k => ({name: k}));
        resolve({
            nodes,
            links: data.map((r, i) => ({
                key: i,
                sourcename: r[source],
                targetname: r[target],
            })),
        });
    });
}

export const fileFormats = [
    {
        exts: 'json',
        mimes: 'application/json',
        from_url: url => json(url),
        from_text: text => Promise.resolve(JSON.parse(text)),
    },
    {
        exts: ['gv', 'dot'],
        mimes: 'text/vnd.graphviz',
        from_url: url => text(url).then(textData => processDot(textData)),
        from_text: text => processDot(text),
    },
    {
        exts: 'psv',
        mimes: 'text/psv',
        from_url: url => dsv('|', 'text/plain')(url).then(data => processDsv(data)),
        from_text: text => processDsv(dsv('|').parse(text)),
    },
    {
        exts: 'csv',
        mimes: 'text/csv',
        from_url: url => csv(url).then(data => processDsv(data)),
        from_text: text => processDsv(csv.parse(text)),
    },
];

export function matchFileFormat(filename) {
    return fileFormats.find(format => {
        let exts = format.exts;
        if (!Array.isArray(exts))
            exts = [exts];
        return exts.find(ext => new RegExp(`\\.${ext}$`).test(filename));
    });
}

export function matchMimeType(mime) {
    return fileFormats.find(format => {
        let mimes = format.mimes;
        if (!Array.isArray(mimes))
            mimes = [mimes];
        return mimes.includes(mime);
    });
}

function unknownFormatError(filename) {
    const spl = filename.split('.');
    if (spl.length)
        return new Error(`do not know how to process graph file extension ${spl[spl.length-1]}`);
    else
        return new Error(
            `need file extension to process graph file automatically, filename ${filename}`,
        );
}

function unknownMimeError(mime) {
    return new Error(`do not know how to process mime type ${mime}`);
}

// load a graph from various formats and return the data in consistent {nodes, links} format
export function loadGraph(file1, file2) {
    // ignore any query parameters for checking extension
    const ignore_query = file => file ? file.replace(/\?.*/, '') : null;

    if (file2) {
        // this is not general - really titan-specific
        return Promise.all([json(file1), json(file2)])
            .then(([nodes, edges]) => ({nodes: nodes.results, edges: edges.results}));
    } else {
        if (/^data:/.test(file1)) {
            const parts = file1.slice(5).split(/,(.+)/);
            const format = matchMimeType(parts[0]);
            if (format)
                return format.from_text(parts[1]);
            else
                return Promise.reject(unknownMimeError(parts[0]));
        } else {
            const file1noq = ignore_query(file1);
            const format = matchFileFormat(file1noq);
            if (format)
                return format.from_url(file1);
            else
                return Promise.reject(unknownFormatError(file1noq));
        }
    }
}

export function loadGraphText(text, filename) {
    const format = matchFileFormat(filename);
    if (format)
        return format.from_text(text);
    else
        return Promise.reject(unknownFormatError(filename));
}

export function dataUrl(data) {
    return `data:application/json,${JSON.stringify(data)}`;
}
