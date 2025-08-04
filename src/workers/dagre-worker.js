import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';

globalThis.d3 = {
    dispatch: d3Dispatch.dispatch,
};

import { dagreLayout } from '../dagre_layout.js';
import { createWorkerHandler } from './worker_common.js';

onmessage = createWorkerHandler(dagreLayout);
