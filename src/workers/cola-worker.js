import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';
import * as d3Selection from 'https://cdn.jsdelivr.net/npm/d3-selection@1.4.2/+esm';
import * as webcolaModule from 'https://cdn.jsdelivr.net/npm/webcola@3.4.0/+esm';

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch,
    select: d3Selection.select,
    selectAll: d3Selection.selectAll
};
globalThis.cola = webcolaModule;

import { createWorkerHandler } from './worker_common.js';
import { colaLayout } from '../cola_layout.js';

onmessage = createWorkerHandler(colaLayout);