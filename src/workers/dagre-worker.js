import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';
import * as dagreModule from 'https://cdn.jsdelivr.net/npm/@dagrejs/dagre@1.1.5/+esm';

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch
};
globalThis.dagre = dagreModule;

import { createWorkerHandler } from './worker_common.js';
import { dagreLayout } from '../dagre_layout.js';

onmessage = createWorkerHandler(dagreLayout);