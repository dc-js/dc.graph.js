import { d3v4ForceLayout } from '../d3v4_force_layout.js';
import { createWorkerHandler } from './worker_common.js';

onmessage = createWorkerHandler(d3v4ForceLayout);
