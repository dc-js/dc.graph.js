import { colaLayout } from '../cola_layout.js';
import { createWorkerHandler } from './worker_common.js';

onmessage = createWorkerHandler(colaLayout);
