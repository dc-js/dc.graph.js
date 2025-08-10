import { dagreLayout } from '../dagre_layout.js';
import { createWorkerHandler } from './worker_common.js';

onmessage = createWorkerHandler(dagreLayout);
