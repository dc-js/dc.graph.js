import { set } from 'd3-collection';
import { functorWrap, property } from './core.js';

export function validate(title) {
    function falsy(objects, accessor, what, who) {
        const f = objects.filter(o => !accessor(o));
        return f.length
            ? [`${what} is empty for ${f.length} of ${objects.length} ${who}`, f]
            : null;
    }
    function build_index(objects, accessor) {
        return objects.reduce((m, o) => {
            m[accessor(o)] = o;
            return m;
        }, {});
    }
    function not_found(index, objects, accessor, what, where, who) {
        const nf = objects.filter(o => !index[accessor(o)]).map(o => ({
            key: accessor(o),
            value: o,
        }));
        return nf.length
            ? [
                `${what} was not found in ${where}`,
                Object.keys(index),
                `for ${nf.length} of ${objects.length} ${who}`,
                nf,
            ]
            : null;
    }
    function validate() {
        const diagram = _mode.parent();
        const nodes = diagram.nodeGroup().all(),
            edges = diagram.edgeGroup().all(),
            ports = diagram.portGroup() ? diagram.portGroup().all() : [];
        const errors = [];

        function check(error) {
            if (error)
                errors.push(error);
        }

        check(falsy(nodes, diagram.nodeKey(), 'nodeKey', 'nodes'));
        check(falsy(edges, diagram.edgeSource(), 'edgeSource', 'edges'));
        check(falsy(edges, diagram.edgeTarget(), 'edgeTarget', 'edges'));

        const contentTypes = set(diagram.content.enum());
        const ct = functorWrap(diagram.nodeContent());
        const noContentNodes = nodes.filter(kv => !contentTypes.has(ct(kv)));
        if (noContentNodes.length)
            errors.push([
                `there are ${noContentNodes.length} nodes with nodeContent not matching any content`,
                noContentNodes,
            ]);

        const nindex = build_index(nodes, diagram.nodeKey()),
            eindex = build_index(edges, diagram.edgeKey());
        check(not_found(nindex, edges, diagram.edgeSource(), 'edgeSource', 'nodes', 'edges'));
        check(not_found(nindex, edges, diagram.edgeTarget(), 'edgeTarget', 'nodes', 'edges'));

        check(falsy(
            ports,
            p => diagram.portNodeKey() && diagram.portNodeKey()(p)
                || diagram.portEdgeKey() && diagram.portEdgeKey()(p),
            'portNodeKey||portEdgeKey',
            'ports',
        ));

        const named_ports = !diagram.portNodeKey() && []
            || ports.filter(p => diagram.portNodeKey()(p));
        const anonymous_ports = !diagram.portEdgeKey() && []
            || ports.filter(p => diagram.portEdgeKey()(p));
        check(
            not_found(nindex, named_ports, diagram.portNodeKey(), 'portNodeKey', 'nodes', 'ports'),
        );
        check(
            not_found(
                eindex,
                anonymous_ports,
                diagram.portEdgeKey(),
                'portEdgeKey',
                'edges',
                'ports',
            ),
        );

        if (diagram.portName()) {
            const pindex = build_index(
                named_ports,
                p => `${diagram.portNodeKey()(p)} - ${diagram.portName()(p)}`,
            );
            if (diagram.edgeSourcePortName())
                check(
                    not_found(
                        pindex,
                        edges,
                        e => `${diagram.edgeSource()(e)} - ${
                            functorWrap(diagram.edgeSourcePortName())(e)
                        }`,
                        'edgeSourcePortName',
                        'ports',
                        'edges',
                    ),
                );
            if (diagram.edgeTargetPortName())
                check(
                    not_found(
                        pindex,
                        edges,
                        e => `${diagram.edgeTarget()(e)} - ${
                            functorWrap(diagram.edgeTargetPortName())(e)
                        }`,
                        'edgeTargetPortName',
                        'ports',
                        'edges',
                    ),
                );
        }

        function count_text() {
            return `${nodes.length} nodes, ${edges.length} edges, ${ports.length} ports`;
        }
        if (errors.length) {
            console.warn(`validation of ${title} failed with ${count_text()}:`);
            errors.forEach(err => {
                console.warn.apply(console, err);
            });
        } else
            console.log(`validation of ${title} succeeded with ${count_text()}.`);
    }
    const _mode = {
        parent: property(null).react(p => {
            if (p)
                p.on('data.validate', validate);
            else
                _mode.parent().on('data.validate', null);
        }),
    };

    return _mode;
}
