// D3 Force layout web worker entry point
import { d3ForceLayout } from '../d3_force_layout.js';
import { createWorkerHandler } from './worker_common.js';

onmessage = createWorkerHandler(d3ForceLayout);