import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import { generateImportMap } from './scripts/generate-import-map.js';

function sharedImportMapPlugin() {
    return {
        name: 'shared-import-map',
        writeBundle() {
            generateImportMap();
        },
    };
}

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/dc-graph.js',
        format: 'es',
        sourcemap: true,
    },
    external: [
        'd3',
        'dc',
        'crossfilter2',
        'webcola',
        'dagre',
        '@dagrejs/dagre',
        '@dagrejs/graphlib-dot',
        '@viz-js/viz',
        'd3-scale',
        'metagraph',
        'queue-async',
        'tippy.js',
    ],
    plugins: [
        json(),
        resolve({
            preferBuiltins: false,
        }),
        commonjs(),
        copy({
            targets: [
                {src: 'dist/dc-graph.js', dest: 'web/js'},
                {src: 'dist/dc-graph.js.map', dest: 'web/js'},
            ],
            hook: 'writeBundle',
        }),
        sharedImportMapPlugin(),
    ],
};
