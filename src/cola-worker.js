importScripts('cola.js');

var _d3cola = null;

function init_d3cola() {
    _d3cola = cola.d3adaptor()
        .avoidOverlaps(true)
        .size([_chart.width(), _chart.height()])
        .handleDisconnected(_chart.handleDisconnected());
}
function data_d3cola(wnodes, layout_edges, constraints) {
    _d3cola.nodes(wnodes)
        .links(layout_edges)
        .constraints(constraints);
}
function start_d3cola(initialUnconstrainedIterations, initialUserConstraintIterations, initialAllConstraintsIterations, gridSnapIterations) {
}

window.onmessage = function(e) {
    switch(e.data.command) {
    case 'init':
        init_d3cola(e.data.width, e.data.height, );
        break;
    case 'data':
        data_d3cola.apply(null, e.data.args);
        break;
    case 'start':
        start_d3cola.apply(null, e.data.args);
        break;
    }
};

