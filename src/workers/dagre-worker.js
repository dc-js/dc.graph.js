import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';

// Load dagre via dynamic import of UMD build as text and eval it
const dagreResponse = await fetch('https://unpkg.com/dagre@0.8.5/dist/dagre.min.js');
const dagreCode = await dagreResponse.text();
eval(dagreCode);

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch
};

import { createWorkerHandler } from './worker_common.js';
import { dagreLayout } from '../dagre_layout.js';

onmessage = createWorkerHandler(dagreLayout);