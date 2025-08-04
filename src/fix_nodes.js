import { dispatch } from 'd3-dispatch';
import { property } from './core.js';
import { undirectedDfs } from './depth_first_traversal.js';

export function fixNodes(options) {
    options = options || {};
    const fix_nodes_group = fixNodesGroup(options.fix_nodes_group || 'fix-nodes-group');
    const _fixedPosTag = options.fixedPosTag || 'fixedPos';
    let _fixes = [], _nodes, _wnodes, _edges, _wedges;

    const _execute = {
        nodeid(n) {
            return _mode.parent().nodeKey.eval(n);
        },
        sourceid(e) {
            return _mode.parent().edgeSource.eval(e);
        },
        targetid(e) {
            return _mode.parent().edgeTarget.eval(e);
        },
        get_fix(n) {
            return _mode.parent().nodeFixed.eval(n);
        },
        fix_node(n, pos) {
            n[_fixedPosTag] = pos;
        },
        unfix_node(n) {
            n[_fixedPosTag] = null;
        },
        clear_fixes() {
            _fixes = {};
        },
        register_fix(id, pos) {
            _fixes[id] = pos;
        },
    };

    function request_fixes(fixes) {
        _mode.strategy().request_fixes(_execute, fixes);
        tell_then_set(find_changes()).then(() => {
            _mode.parent().redraw();
        });
    }
    function new_node(nid, n, pos) {
        _mode.strategy().new_node(_execute, nid, n, pos);
    }
    function new_edge(eid, sourceid, targetid) {
        const source = _nodes[sourceid], target = _nodes[targetid];
        _mode.strategy().new_edge(_execute, eid, source, target);
    }
    function find_changes() {
        const changes = [];
        _wnodes.forEach(n => {
            const key = _mode.parent().nodeKey.eval(n),
                fixPos = _fixes[key];
            const oldFixed = n.orig.value[_fixedPosTag];
            let changed = false;
            if (oldFixed) {
                if (!fixPos || fixPos.x !== oldFixed.x || fixPos.y !== oldFixed.y)
                    changed = true;
            } else changed = fixPos;
            if (changed)
                changes.push({n, fixed: fixPos ? {x: fixPos.x, y: fixPos.y} : null});
        });
        return changes;
    }
    function execute_change(n, fixed) {
        if (fixed)
            _execute.fix_node(n.orig.value, fixed);
        else
            _execute.unfix_node(n.orig.value);
    }
    function tell_then_set(changes) {
        const callback = _mode.fixNode() || function(n, pos) {
            return Promise.resolve(pos);
        };
        const promises = changes.map(change => {
            const key = _mode.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed)
                .then(fixed => {
                    execute_change(change.n, fixed);
                });
        });
        return Promise.all(promises);
    }
    function set_changes(changes) {
        changes.forEach(change => {
            execute_change(change.n, change.fixed);
        });
    }
    function tell_changes(changes) {
        const callback = _mode.fixNode() || function(n, pos) {
            return Promise.resolve(pos);
        };
        const promises = changes.map(change => {
            const key = _mode.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed);
        });
        return Promise.all(promises);
    }
    function fix_all_nodes(tell) {
        if (tell === undefined)
            tell = true;
        const changes = _wnodes.map(n => ({n, fixed: {x: n.cola.x, y: n.cola.y}}));
        if (tell)
            return tell_then_set(changes);
        else {
            set_changes(changes);
            return Promise.resolve(undefined);
        }
    }
    function clear_fixes() {
        _mode.strategy().clear_all_fixes && _mode.strategy().clear_all_fixes();
        _execute.clear_fixes();
    }
    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        console.assert(
            Array.isArray(wnodes),
            'fix_nodes.on_data: wnodes should be an array, got:',
            wnodes,
        );
        _nodes = nodes;
        _wnodes = wnodes;
        _edges = edges;
        _wedges = wedges;
        if (_mode.strategy().on_data) {
            _mode.strategy().on_data(_execute, nodes, wnodes, edges, wedges, ports, wports); // ghastly
            const changes = find_changes();
            set_changes(changes);
            // can't wait for backend to acknowledge/approve so just set then blast
            if (_mode.reportOverridesAsynchronously())
                tell_changes(changes); // dangling promise
        }
    }

    const _mode = {
        parent: property(null).react(p => {
            fix_nodes_group
                .on('request_fixes.fix-nodes', p ? request_fixes : null)
                .on('new_node.fix_nodes', p ? new_node : null)
                .on('new_edge.fix_nodes', p ? new_edge : null);
            if (p) {
                p.on('data.fix-nodes', on_data);
            } else if (_mode.parent())
                _mode.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null),
        // save/load may want to nail everything / start from scratch
        // (should probably be automatic though)
        fixAllNodes: fix_all_nodes,
        clearFixes: clear_fixes,
        strategy: property(fixNodes.strategy.fixLast()),
        reportOverridesAsynchronously: property(true),
    };

    return _mode;
}

fixNodes.strategy = {};
fixNodes.strategy.fixLast = function() {
    return {
        request_fixes(exec, fixes) {
            exec.clear_fixes();
            fixes.forEach(fix => {
                exec.register_fix(fix.id, fix.pos);
            });
        },
        new_node(exec, nid, n, pos) {
            exec.fix_node(n, pos);
        },
        new_edge(exec, eid, source, target) {
            exec.unfix_node(source.orig.value);
            exec.unfix_node(target.orig.value);
        },
    };
};
fixNodes.strategy.lastNPerComponent = function(maxf) {
    maxf = maxf || 1;
    let _age = 0;
    let _allFixes = {};
    return {
        clear_all_fixes() {
            _allFixes = {};
        },
        request_fixes(exec, fixes) {
            ++_age;
            fixes.forEach(fix => {
                _allFixes[fix.id] = {id: fix.id, age: _age, pos: fix.pos};
            });
        },
        new_node(exec, nid, n, pos) {
            ++_age;
            _allFixes[nid] = {id: nid, age: _age, pos};
            exec.fix_node(n, pos);
        },
        new_edge() {},
        on_data(exec, nodes, wnodes, edges, wedges, _ports, _wports) {
            ++_age;
            // add any existing fixes as requests
            console.assert(
                Array.isArray(wnodes),
                'fix_nodes strategy.on_data: wnodes should be an array, got:',
                wnodes,
            );
            wnodes.forEach(n => {
                const nid = exec.nodeid(n), pos = exec.get_fix(n);
                if (pos && !_allFixes[nid])
                    _allFixes[nid] = {id: nid, age: _age, pos};
            });
            // determine components
            const components = [];
            const dfs = undirectedDfs({
                nodeid: exec.nodeid,
                sourceid: exec.sourceid,
                targetid: exec.targetid,
                comp() {
                    components.push([]);
                },
                node(compid, n) {
                    components[compid].push(n);
                },
            });
            dfs(wnodes, wedges);
            // start from scratch
            exec.clear_fixes();
            // keep or produce enough fixed nodes per component
            components.forEach((comp, i) => {
                const oldcomps = comp.reduce((cc, n) => {
                    if (n.last_component) {
                        const counts = cc[n.last_component] = cc[n.last_component] || {
                            total: 0,
                            fixed: 0,
                        };
                        counts.total++;
                        if (_allFixes[exec.nodeid(n)])
                            counts.fixed++;
                    }
                    return cc;
                }, {});
                const fixed_by_size = Object.keys(oldcomps).reduce((ff, compid) => {
                    if (oldcomps[compid].fixed)
                        ff.push({
                            compid: +compid,
                            total: oldcomps[compid].total,
                            fixed: oldcomps[compid].fixed,
                        });
                    return ff;
                }, []).sort((coa, cob) => cob.total-coa.total);
                const largest_fixed = fixed_by_size.length && fixed_by_size[0].compid;
                let fixes = comp.filter(n =>
                    !n.last_component || n.last_component === largest_fixed
                ).map(n => _allFixes[exec.nodeid(n)]).filter(fix => fix);
                if (fixes.length > maxf) {
                    fixes.sort((f1, f2) => f2.age-f1.age);
                    fixes = fixes.slice(0, maxf);
                }
                fixes.forEach(fix => {
                    exec.register_fix(fix.id, fix.pos);
                });
                const kept = fixes.reduce((m, fix) => {
                    m[fix.id] = true;
                    return m;
                }, {});
                comp.forEach(n => {
                    const nid = exec.nodeid(n);
                    if (!kept[nid])
                        _allFixes[nid] = null;
                    n.last_component = i+1;
                });
            });
        },
    };
};

export function fixNodesGroup(brushgroup) {
    window.chart_registry.create_type(
        'fix-nodes',
        () => dispatch('request_fixes', 'new_node', 'new_edge'),
    );

    return window.chart_registry.create_group('fix-nodes', brushgroup);
}
