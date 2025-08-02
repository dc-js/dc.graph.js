import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/dc-graph.js',
    format: 'es',
    sourcemap: true
  },
  external: [
    'd3',
    'dc',
    'crossfilter2',
    'webcola', 
    'dagre',
    'viz.js',
    'css-layout',
    'metagraph',
    'queue-async',
    'tippy.js'
  ],
  plugins: [
    json(),
    resolve({
      preferBuiltins: false
    }),
    commonjs(),
    copy({
      targets: [
        { src: 'dist/dc-graph.js', dest: 'web/js' },
        { src: 'dist/dc-graph.js.map', dest: 'web/js' }
      ],
      hook: 'writeBundle'
    })
  ]
};