import json from '@rollup/plugin-json';

// Rollup configuration for web workers
export default [
    {
        input: 'src/workers/cola-worker.js',
        plugins: [json()],
        output: {
            file: 'dc.graph.cola.worker.js',
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
importScripts('d3.js', 'cola.js');`
        }
    },
    {
        input: 'src/workers/dagre-worker.js',
        plugins: [json()],
        output: {
            file: 'dc.graph.dagre.worker.js',
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
importScripts('d3.js', 'dagre.js');`
        }
    },
    {
        input: 'src/workers/d3v4-force-worker.js',
        plugins: [json()],
        output: {
            file: 'dc.graph.d3v4-force.worker.js',
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
importScripts('d3.js', 'd3v4-force.js');`
        }
    },
    {
        input: 'src/workers/d3-force-worker.js',
        plugins: [json()],
        output: {
            file: 'dc.graph.d3-force.worker.js',
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
importScripts('d3.js');`
        }
    },
    {
        input: 'src/workers/dynagraph-worker.js',
        plugins: [json()],
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