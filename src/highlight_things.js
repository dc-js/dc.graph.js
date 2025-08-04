import { mode } from './mode.js';
import { property } from './core.js';
import { registerHighlightThingsGroup } from './highlight_things_group.js';
import { nodeEdgeConditions } from './utils.js';

export function highlightThings(includeprops, excludeprops, modename, groupname, cascbase) {
    const highlight_things_group = registerHighlightThingsGroup(groupname || 'highlight-things-group');
    const _includeprops = {...includeprops}, _excludeprops = {...excludeprops};
    let _active, _nodeset = {}, _edgeset = {};
    cascbase = cascbase || 150;

    function highlight(nodeset, edgeset) {
        _active = nodeset || edgeset;
        _nodeset = nodeset || {};
        _edgeset = edgeset || {};
        _mode.parent().requestRefresh(_mode.durationOverride());
    }
    function draw(diagram) {
        diagram.cascade(cascbase, true, nodeEdgeConditions(
            (n) => _nodeset[_mode.parent().nodeKey.eval(n)], (e) => _edgeset[_mode.parent().edgeKey.eval(e)], _includeprops));
        diagram.cascade(cascbase+10, true, nodeEdgeConditions(
            (n) => _active && !_nodeset[_mode.parent().nodeKey.eval(n)], (e) => _active && !_edgeset[_mode.parent().edgeKey.eval(e)], _excludeprops));
    }
    function remove(diagram) {
        diagram.cascade(cascbase, false, _includeprops);
        diagram.cascade(cascbase + 10, false, _excludeprops);
    }
    const _mode = mode(modename, {
        draw,
        remove,
        parent(p) {
            highlight_things_group.on(`highlight.${  modename}`, p ? highlight : null);
        }
    });
    _mode.includeProps = () => _includeprops;
    _mode.excludeProps = () => _excludeprops;
    _mode.durationOverride = property(undefined);
    return _mode;
};
