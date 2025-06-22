// Dynagraph layout web worker entry point
import { dynagraphLayout } from '../dynagraph_layout.js';
import { createWorkerHandler } from './worker_common.js';

onmessage = createWorkerHandler(dynagraphLayout);