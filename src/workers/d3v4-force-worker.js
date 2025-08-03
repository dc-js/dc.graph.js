import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';
import * as d3Collection from 'https://cdn.jsdelivr.net/npm/d3-collection@1.0.7/+esm';

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch
};

import { createWorkerHandler } from './worker_common.js';
import { d3v4ForceLayout } from '../d3v4_force_layout.js';

onmessage = createWorkerHandler(d3v4ForceLayout);