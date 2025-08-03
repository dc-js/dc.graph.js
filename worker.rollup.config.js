import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';

// Rollup configuration for web workers
export default [
    {
        input: 'src/workers/cola-worker.js',
        external: ['https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm', 'https://cdn.jsdelivr.net/npm/d3-selection@1.4.2/+esm', 'https://cdn.jsdelivr.net/npm/d3-timer@1.0.10/+esm', 'https://cdn.jsdelivr.net/npm/webcola@3.4.0/+esm', 'd3-dispatch'],
        plugins: [
            json(),
            replace({
                delimiters: ['', ''],
                'import { dispatch } from \'d3-dispatch\';': '// import { dispatch } from \'d3-dispatch\'; // replaced for worker',
                '    var _dispatch = dispatch(\'tick\', \'start\', \'end\');': '    var _dispatch = globalThis.d3.dispatch(\'tick\', \'start\', \'end\');',
                preventAssignment: true
            }),
            copy({
                targets: [
                    { src: 'dc.graph.cola.worker.js', dest: 'web/js' },
                    { src: 'dc.graph.cola.worker.js.map', dest: 'web/js' }
                ],
                hook: 'writeBundle'
            })
        ],
        output: {
            file: 'dc.graph.cola.worker.js',
            format: 'es',
            sourcemap: true,
            banner: `/*!
 *  dc.graph ${process.env.npm_package_version || '0.9.94'}
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2019 AT&T Intellectual Property & the dc.graph.js Developers
 *  https://github.com/dc-js/dc.graph.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */
import * as d3Dispatch from 'https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm';
import * as d3Selection from 'https://cdn.jsdelivr.net/npm/d3-selection@1.4.2/+esm';
import * as d3Timer from 'https://cdn.jsdelivr.net/npm/d3-timer@1.0.10/+esm';
import * as webcolaModule from 'https://cdn.jsdelivr.net/npm/webcola@3.4.0/+esm';

globalThis.d3 = { 
    dispatch: d3Dispatch.dispatch,
    select: d3Selection.select,
    selectAll: d3Selection.selectAll,
    timer: d3Timer.timer
};
globalThis.cola = webcolaModule;`
        }
    },
    {
        input: 'src/workers/dagre-worker.js',
        external: ['https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm', 'https://cdn.jsdelivr.net/npm/@dagrejs/dagre@1.1.5/+esm', 'd3-dispatch'],
        plugins: [
            json(),
            replace({
                delimiters: ['', ''],
                'import { dispatch } from \'d3-dispatch\';': '// import { dispatch } from \'d3-dispatch\'; // replaced for worker',
                'import * as dagre from \'@dagrejs/dagre\';': 'import * as dagre from \'https://cdn.jsdelivr.net/npm/@dagrejs/dagre@1.1.5/+esm\';',
                '    var _dispatch = dispatch(\'tick\', \'start\', \'end\');': '    var _dispatch = globalThis.d3.dispatch(\'tick\', \'start\', \'end\');',
                preventAssignment: true
            }),
            copy({
                targets: [
                    { src: 'dc.graph.dagre.worker.js', dest: 'web/js' },
                    { src: 'dc.graph.dagre.worker.js.map', dest: 'web/js' }
                ],
                hook: 'writeBundle'
            })
        ],
        output: {
            file: 'dc.graph.dagre.worker.js',
            format: 'es',
            sourcemap: true,
            banner: `/*!
 *  dc.graph ${process.env.npm_package_version || '0.9.94'}
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2019 AT&T Intellectual Property & the dc.graph.js Developers
 *  https://github.com/dc-js/dc.graph.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */`
        }
    },
    {
        input: 'src/workers/d3v4-force-worker.js',
        external: ['https://cdn.jsdelivr.net/npm/d3-dispatch@1.0.6/+esm', 'https://cdn.jsdelivr.net/npm/d3-collection@1.0.7/+esm', 'https://cdn.jsdelivr.net/npm/d3-force@3.0.0/+esm', 'https://cdn.jsdelivr.net/npm/d3-force-straighten-paths@1.0.2/+esm', 'd3-dispatch', 'd3-collection', 'd3-force', 'd3-force-straighten-paths'],
        plugins: [
            json(),
            replace({
                delimiters: ['', ''],
                'import { dispatch } from \'d3-dispatch\';': '// import { dispatch } from \'d3-dispatch\'; // replaced for worker',
                'import { set } from \'d3-collection\';': 'import { set } from \'https://cdn.jsdelivr.net/npm/d3-collection@1.0.7/+esm\';',
                'import { forceSimulation, forceLink, forceCenter, forceX, forceY, forceCollide, forceManyBody } from \'d3-force\';': 'import { forceSimulation, forceLink, forceCenter, forceX, forceY, forceCollide, forceManyBody } from \'https://cdn.jsdelivr.net/npm/d3-force@3.0.0/+esm\';',
                'import { forceStraightenPaths } from \'d3-force-straighten-paths\';': 'import { forceStraightenPaths } from \'https://cdn.jsdelivr.net/npm/d3-force-straighten-paths@1.0.2/+esm\';',
                '    var _dispatch = dispatch(\'tick\', \'start\', \'end\');': '    var _dispatch = globalThis.d3.dispatch(\'tick\', \'start\', \'end\');',
                preventAssignment: true
            }),
            copy({
                targets: [
                    { src: 'dc.graph.d3v4-force.worker.js', dest: 'web/js' },
                    { src: 'dc.graph.d3v4-force.worker.js.map', dest: 'web/js' }
                ],
                hook: 'writeBundle'
            })
        ],
        output: {
            file: 'dc.graph.d3v4-force.worker.js',
            format: 'es',
            sourcemap: true,
            banner: `/*!
 *  dc.graph ${process.env.npm_package_version || '0.9.94'}
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2019 AT&T Intellectual Property & the dc.graph.js Developers
 *  https://github.com/dc-js/dc.graph.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */`
        }
    },
    {
        input: 'src/workers/dynagraph-worker.js',
        plugins: [
            json(),
            copy({
                targets: [
                    { src: 'dc.graph.dynagraph.worker.js', dest: 'web/js' },
                    { src: 'dc.graph.dynagraph.worker.js.map', dest: 'web/js' }
                ],
                hook: 'writeBundle'
            })
        ],
        output: {
            file: 'dc.graph.dynagraph.worker.js',
            format: 'iife',
            sourcemap: true,
            banner: `/*!
 *  dc.graph ${process.env.npm_package_version || '0.9.94'}
 *  http://dc-js.github.io/dc.graph.js/
 *  Copyright 2015-2019 AT&T Intellectual Property & the dc.graph.js Developers
 *  https://github.com/dc-js/dc.graph.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */
importScripts('d3.js', 'dynagraph-wasm.js', 'incrface-umd.js');`
        }
    }
];