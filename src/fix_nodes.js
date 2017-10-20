dc_graph.fix_nodes = function(options) {
    options = options || {};
    var fix_nodes_group = dc_graph.fix_nodes_group('fix-nodes-group');
    var _fixedPosTag = options.fixedPosTag || 'fixedPos';
    var _fixes = [], _nodes, _wnodes, _edges, _wedges;

    var _execute = {
        nodeid: function(n) {
            return _behavior.parent().nodeKey.eval(n);
        },
        sourceid: function(e) {
            return _behavior.parent().edgeSource.eval(e);
        },
        targetid: function(e) {
            return _behavior.parent().edgeTarget.eval(e);
        },
        get_fix: function(n) {
            return _behavior.parent().nodeFixed.eval(n);
        },
        fix_node: function(n, pos) {
            n[_fixedPosTag] = pos;
        },
        unfix_node: function(n) {
            n[_fixedPosTag] = null;
        },
        clear_fixes: function() {
            _fixes = {};
        },
        register_fix: function(id, pos) {
            _fixes[id] = pos;
        }
    };

    function request_fixes(fixes) {
        _behavior.strategy().request_fixes(_execute, fixes);
        tell_then_set(find_changes()).then(function() {
            _behavior.parent().redraw();
        });
    }
    function new_node(nid, n, pos) {
        _behavior.strategy().new_node(_execute, nid, n, pos);
    }
    function new_edge(eid, sourceid, targetid) {
        var source = _nodes[sourceid], target = _nodes[targetid];
        _behavior.strategy().new_edge(_execute, eid, source, target);
    }
    function find_changes() {
        var changes = [];
        _wnodes.forEach(function(n) {
            var key = _behavior.parent().nodeKey.eval(n),
                fixPos = _fixes[key],
                oldFixed = n.orig.value[_fixedPosTag],
                changed = false;
            if(oldFixed) {
                if(!fixPos || fixPos.x !== oldFixed.x || fixPos.y !== oldFixed.y)
                    changed = true;
            }
            else changed = fixPos;
            if(changed)
                changes.push({n: n, fixed: fixPos ? {x: fixPos.x, y: fixPos.y} : null});
        });
        return changes;
    }
    function execute_change(n, fixed) {
        if(fixed)
            _execute.fix_node(n.orig.value, fixed);
        else
            _execute.unfix_node(n.orig.value);
    }
    function tell_then_set(changes) {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = changes.map(function(change) {
            var key = _behavior.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed)
                .then(function(fixed) {
                    execute_change(change.n, fixed);
                });
        });
        return Promise.all(promises);
    }
    function set_changes(changes) {
        changes.forEach(function(change) {
            execute_change(change.n, change.fixed);
        });
    }
    function tell_changes(changes) {
        var callback = _behavior.fixNode() || function(n, pos) { return Promise.resolve(pos); };
        var promises = changes.map(function(change) {
            var key = _behavior.parent().nodeKey.eval(change.n);
            return callback(key, change.fixed);
        });
        return Promise.all(promises);
    }
    function fix_all_nodes(tell) {
        if(tell === undefined)
           tell = true;
        var changes = _wnodes.map(function(n) {
            return {n: n, fixed: {x: n.cola.x, y: n.cola.y}};
        });
        if(tell)
            tell_then_set(changes);
        else
            set_changes(changes);
    }
    function clear_fixes() {
        _behavior.strategy().clear_all_fixes && _behavior.strategy().clear_all_fixes();
        _execute.clear_fixes();
    }
    function on_data(diagram, nodes, wnodes, edges, wedges, ports, wports) {
        _nodes = nodes;
        _wnodes = wnodes;
        _edges = edges;
        _wedges = wedges;
        if(_behavior.strategy().on_data) {
            _behavior.strategy().on_data(_execute, nodes, wnodes, edges, wedges, ports, wports); // ghastly
            var changes = find_changes();
            set_changes(changes);
            // can't wait for backend to acknowledge/approve so just set then blast
            if(_behavior.reportOverridesAsynchronously())
                tell_changes(changes); // dangling promise
        }
    }

    var _behavior = {
        parent: property(null).react(function(p) {
            fix_nodes_group
                .on('request_fixes.fix-nodes', p ? request_fixes : null)
                .on('new_node.fix_nodes', p ? new_node : null)
                .on('new_edge.fix_nodes', p ? new_edge : null);
            if(p) {
                p.on('data.fix-nodes', on_data);
            } else if(_behavior.parent())
                _behavior.parent().on('data.fix-nodes', null);
        }),
        // callback for setting & fixing node position
        fixNode: property(null),
        // save/load may want to nail everything / start from scratch
        // (should probably be automatic though)
        fixAllNodes: fix_all_nodes,
        clearFixes: clear_fixes,
        strategy: property(dc_graph.fix_nodes.strategy.fix_last()),
        reportOverridesAsynchronously: property(true)
    };

    return _behavior;
};

dc_graph.fix_nodes.strategy = {};
dc_graph.fix_nodes.strategy.fix_last = function() {
    return {
        request_fixes: function(exec, fixes) {
            exec.clear_fixes();
            fixes.forEach(function(fix) {
                exec.register_fix(fix.id, fix.pos);
            });
        },
        new_node: function(exec, nid, n, pos) {
            exec.fix_node(n, pos);
        },
        new_edge: function(exec, eid, source, target) {
            exec.unfix_node(source.orig.value);
            exec.unfix_node(target.orig.value);
        }
    };
};
dc_graph.fix_nodes.strategy.last_N_per_component = function(N) {
    var _age = 0;
    var _allFixes = {};
    return {
        clear_all_fixes: function() {
            _allFixes = {};
        },
        request_fixes: function(exec, fixes) {
            ++_age;
            fixes.forEach(function(fix) {
                _allFixes[fix.id] = {id: fix.id, age: _age, pos: fix.pos};
            });
        },
        new_node: function(exec, nid, n, pos) {
            ++_age;
            _allFixes[nid] = {id: nid, age: _age, pos: pos};
            exec.fix_node(n, pos);
        },
        new_edge: function() {},
        on_data: function(exec, nodes, wnodes, edges, wedges, ports, wports) {
            ++_age;
            // add any existing fixes as requests
            wnodes.forEach(function(n) {
                var nid = exec.nodeid(n), pos = exec.get_fix(n);
                if(pos && !_allFixes[nid])
                    _allFixes[nid] = {id: nid, age: _age, pos: pos};
            });
            var components = [];
            var dfs = dc_graph.undirected_dfs({
                nodeid: exec.nodeid,
                sourceid: exec.sourceid,
                targetid: exec.targetid,
                comp: function() {
                    components.push([]);
                },
                node: function(compid, n) {
                    components[compid].push(n);
                }
            });
            dfs(wnodes, wedges);
            exec.clear_fixes();
            components.forEach(function(comp, i) {
                var oldcomps = comp.reduce(function(cc, n) {
                    if(n.last_component) {
                        var counts = cc[n.last_component] = cc[n.last_component] || {
                            total: 0,
                            fixed: 0
                        };
                        counts.total++;
                        if(_allFixes[exec.nodeid(n)])
                            counts.fixed++;
                    }
                    return cc;
                }, {});
                var fixed_by_size = Object.keys(oldcomps).reduce(function(ff, compid) {
                    if(oldcomps[compid].fixed)
                        ff.push({compid: +compid, total: oldcomps[compid].total, fixed: oldcomps[compid].fixed});
                    return ff;
                }, []).sort(function(coa, cob) {
                    return cob.total - coa.total;
                });
                var largest_fixed = fixed_by_size.length && fixed_by_size[0].compid;
                var fixes = comp.filter(function(n) {
                    return !n.last_component || n.last_component === largest_fixed;
                }).map(function(n) {
                    return _allFixes[exec.nodeid(n)];
                }).filter(function(fix) {
                    return fix;
                });
                if(fixes.length > N) {
                    fixes.sort(function(f1, f2) {
                        return f2.age - f1.age;
                    });
                    fixes = fixes.slice(0, N);
                }
                fixes.forEach(function(fix) {
                    exec.register_fix(fix.id, fix.pos);
                });
                var kept = fixes.reduce(function(m, fix) {
                    m[fix.id] = true;
                    return m;
                }, {});
                comp.forEach(function(n) {
                    var nid = exec.nodeid(n);
                    if(!kept[nid])
                        _allFixes[nid] = null;
                    n.last_component = i+1;
                });
            });
        }
    };
};

dc_graph.fix_nodes_group = function(brushgroup) {
    window.chart_registry.create_type('fix-nodes', function() {
        return d3.dispatch('request_fixes', 'new_node', 'new_edge');
    });

    return window.chart_registry.create_group('fix-nodes', brushgroup);
};
