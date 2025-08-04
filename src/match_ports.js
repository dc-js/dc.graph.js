import { property } from './core.js';

export function matchPorts(diagram, symbolPorts) {
    let _ports, _wports, _wedges, _validTargets;
    diagram.on('data.match-ports', (diagram, nodes, wnodes, edges, wedges, ports, wports) => {
        _ports = ports;
        _wports = wports;
        _wedges = wedges;
    });
    diagram.on('transitionsStarted.match-ports', () => {
        symbolPorts.enableHover(true);
    });
    function change_state(ports, state) {
        return ports.map((p) => {
            p.state = state;
            return diagram.portNodeKey.eval(p);
        });
    }
    function reset_ports(source) {
        const nids = change_state(_validTargets, 'small');
        source.port.state = 'small';
        nids.push(diagram.portNodeKey.eval(source.port));
        symbolPorts.animateNodes(nids);
    }
    function has_parallel(sourcePort, targetPort) {
        return _wedges.some((e) => sourcePort.edges.indexOf(e) >= 0 && targetPort.edges.indexOf(e) >= 0);
    }
    function is_valid(sourcePort, targetPort) {
        return (_strategy.allowParallel() || !has_parallel(sourcePort, targetPort))
            && _strategy.isValid()(sourcePort, targetPort);
    }
    function why_invalid(sourcePort, targetPort) {
        return !_strategy.allowParallel() && has_parallel(sourcePort, targetPort) && "can't connect two edges between the same two ports" ||
            _strategy.whyInvalid()(sourcePort, targetPort);
    }
    const _strategy = {
        isValid: property((sourcePort, targetPort) => targetPort !== sourcePort && targetPort.name === sourcePort.name),
        whyInvalid: property((sourcePort, targetPort) => targetPort === sourcePort && "can't connect port to itself" ||
                targetPort.name !== sourcePort.name && "must connect ports of the same type"),
        allowParallel: property(false),
        hoverPort(port) {
            if(port) {
                _validTargets = _wports.filter(is_valid.bind(null, port));
                if(_validTargets.length)
                    return change_state(_validTargets, 'shimmer-medium');
            } else if(_validTargets)
                return change_state(_validTargets, 'small');
            return null;
        },
        startDragEdge(source) {
            _validTargets = _wports.filter(is_valid.bind(null, source.port));
            const nids = change_state(_validTargets, 'shimmer');
            if(_validTargets.length) {
                symbolPorts.enableHover(false);
                source.port.state = 'large';
                nids.push(diagram.portNodeKey.eval(source.port));
                symbolPorts.animateNodes(nids);
            }
            console.log('valid targets', nids);
            return _validTargets.length !== 0;
        },
        invalidSourceMessage(_source) {
            return "no valid matches for this port";
        },
        changeDragTarget(source, target) {
            let nids, before;
            const valid = target && is_valid(source.port, target.port);
            if(valid) {
                nids = change_state(_validTargets, 'small');
                target.port.state = 'large'; // it's one of the valid
            }
            else {
                nids = change_state(_validTargets, 'small');
                before = symbolPorts.animateNodes(nids);
                nids = change_state(_validTargets, 'shimmer');
            }
            symbolPorts.animateNodes(nids, before);
            return valid;
        },
        validTargetMessage(_source, _target) {
            return "it's a match!";
        },
        invalidTargetMessage(source, target) {
            return why_invalid(source.port, target.port);
        },
        finishDragEdge(source, target) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return Promise.resolve(is_valid(source.port, target.port));
        },
        cancelDragEdge(source) {
            symbolPorts.enableHover(true);
            reset_ports(source);
            return true;
        }
    };
    return _strategy;
};
