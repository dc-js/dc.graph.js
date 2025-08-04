import { redrawAll } from 'dc';
import { property } from './core.js';

export function expandedHidden(opts) {
    const options = Object.assign({
        nodeKey(n) {
            return n.key;
        },
        edgeKey(e) {
            return e.key;
        },
        edgeSource(e) {
            return e.value.source;
        },
        edgeTarget(e) {
            return e.value.target;
        },
    }, opts);
    const _nodeHidden = {}, _edgeHidden = {};

    // independent dimension on keys so that the diagram dimension will observe it
    const _nodeDim = options.nodeCrossfilter.dimension(options.nodeKey),
        _edgeDim = options.edgeCrossfilter && options.edgeCrossfilter.dimension(options.edgeRawKey);

    function get_shown(expanded) {
        return Object.keys(expanded).reduce(
            (p, dir) =>
                Array.from(expanded[dir]).reduce((p, nk) => {
                    p[nk] = true;
                    let list;
                    switch (dir) {
                        case 'in':
                            list = in_edges(nk).map(e => options.edgeSource(e));
                            break;
                        case 'out':
                            list = out_edges(nk).map(e => options.edgeTarget(e));
                            break;
                        case 'both':
                            list = adjacent_nodes(nk);
                            break;
                    }
                    list.forEach(nk2 => {
                        if (!_nodeHidden[nk2])
                            p[nk2] = true;
                    });
                    return p;
                }, p),
            {},
        );
    }
    function apply_filter(ec) {
        const _shown = get_shown(ec.getExpanded());
        _nodeDim.filterFunction(nk => _shown[nk]);
        _edgeDim && _edgeDim.filterFunction(ek => !_edgeHidden[ek]);
    }
    function adjacent_edges(nk) {
        return options.edgeGroup.all().filter(e =>
            options.edgeSource(e) === nk || options.edgeTarget(e) === nk
        );
    }
    function out_edges(nk) {
        return options.edgeGroup.all().filter(e => options.edgeSource(e) === nk);
    }
    function in_edges(nk) {
        return options.edgeGroup.all().filter(e => options.edgeTarget(e) === nk);
    }
    const other_node = (e, nk) =>
        options.edgeSource(e) === nk ? options.edgeTarget(e) : options.edgeSource(e);
    function adjacent_nodes(nk) {
        return adjacent_edges(nk).map(e => other_node(e, nk));
    }

    const dfs_pre_order = (nk, seen, traverse, other, fall, funseen, pe = null, pres = null) => {
        fall(pe, pres, nk);
        if (seen.has(nk))
            return;
        seen.add(nk);
        const nres = funseen(pe, pres, nk);
        for (const e of traverse(nk))
            dfs_pre_order(other(e, nk), seen, traverse, other, fall, funseen, e, nres);
    };

    const _strategy = {
        get_edges(nk, dir) {
            switch (dir) {
                case 'in':
                    return in_edges(nk);
                case 'out':
                    return out_edges(nk);
                case 'both':
                    return adjacent_edges(nk);
                default:
                    throw new Error(`unknown dir ${dir}`);
            }
        },
        get_tree_edges: (nk, dir, once = false) => {
            const traverse = dir === 'in'
                ? in_edges
                : dir === 'out'
                ? out_edges
                : adjacent_edges;
            const other = dir === 'in'
                ? options.edgeSource
                : dir === 'out'
                ? options.edgeTarget
                : other_node;
            if (once) {
                const edges = traverse(nk),
                    nks = edges.map(other);
                return {[nk]: {edges, nks}};
            }
            const nodes = {}, seen = new Set();
            dfs_pre_order(nk, seen, traverse, other, (pe, pres, nk) => {
                if (pres) {
                    pres.edges.push(pe);
                    pres.nks.push(nk);
                }
            }, (pe, pres, nk) => nodes[nk] = {edges: [], nks: []});
            return nodes;
        },
        partition_among_visible: (_tree_edges, _visible_nodes) => {
        },
        refresh() {
            apply_filter(_strategy.expandCollapse());
            redrawAll();
            return this;
        },
        collapsibles(nks, dir) {
            const expanded = _strategy.expandCollapse().getExpanded();
            const whatif = structuredClone(expanded);
            nks.forEach(
                nk => whatif[dir].delete(nk),
            );
            const shown = get_shown(expanded), would = get_shown(whatif);
            const going = Object.keys(shown)
                .filter(nk2 => !would[nk2])
                .reduce((p, v) => {
                    p[v] = true;
                    return p;
                }, {});
            return {
                nodes: going,
                edges: options.edgeGroup.all().filter(e =>
                    going[options.edgeSource(e)] || going[options.edgeTarget(e)]
                ).reduce((p, e) => {
                    p[options.edgeKey(e)] = true;
                    return p;
                }, {}),
            };
        },
        hideNode(nk) {
            _nodeHidden[nk] = true;
            _strategy.expandCollapse().expand('both', [nk], false);
        },
        hideEdge(ek) {
            if (!options.edgeCrossfilter)
                console.warn('expanded_hidden needs edgeCrossfilter to hide edges');
            _edgeHidden[ek] = true;
            apply_filter(_strategy.expandCollapse());
            redrawAll();
        },
        expandCollapse: property(null).react(ec => {
            if (ec)
                apply_filter(ec);
        }),
    };
    if (options.directional)
        _strategy.dirs = ['out', 'in'];
    return _strategy;
}
