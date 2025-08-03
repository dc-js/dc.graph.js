import { createWorkerHandler } from './worker_common.js';
import { colaLayout } from '../cola_layout.js';

onmessage = createWorkerHandler(colaLayout);