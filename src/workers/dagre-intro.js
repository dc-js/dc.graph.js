// Initialization code for dagre worker
// This sets up globals that need to be available before the layout modules are loaded
import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';

globalThis.d3 = {
    dispatch: d3Dispatch.dispatch,
};
